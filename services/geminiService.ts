

import {
    GoogleGenAI,
    Chat,
    Modality,
    FunctionDeclaration,
    Type,
    Part,
    Content,
    GenerateVideosOperation,
    Operation,
    VideoGenerationReferenceImage,
    VideoGenerationReferenceType
} from "@google/genai";

const CUSTOM_API_KEY_STORAGE_KEY = 'cortex-custom-api-key';
const VIDEO_API_KEY_STORAGE_KEY = 'cortex-video-api-key';

export const getCustomApiKey = (): string | null => {
    try {
        return localStorage.getItem(CUSTOM_API_KEY_STORAGE_KEY);
    } catch (e) {
        console.error("Failed to get custom API key from localStorage", e);
        return null;
    }
};

export const setCustomApiKey = (key: string): void => {
    try {
        localStorage.setItem(CUSTOM_API_KEY_STORAGE_KEY, key);
    } catch (e) {
        console.error("Failed to set custom API key in localStorage", e);
    }
};

export const clearCustomApiKey = (): void => {
    try {
        localStorage.removeItem(CUSTOM_API_KEY_STORAGE_KEY);
    } catch (e) {
        console.error("Failed to clear custom API key from localStorage", e);
    }
};

export const getVideoApiKey = (): string | null => {
    try {
        return localStorage.getItem(VIDEO_API_KEY_STORAGE_KEY);
    } catch (e) {
        console.error("Failed to get video API key from localStorage", e);
        return null;
    }
};

export const setVideoApiKey = (key: string): void => {
    try {
        localStorage.setItem(VIDEO_API_KEY_STORAGE_KEY, key);
    } catch (e) {
        console.error("Failed to set video API key in localStorage", e);
    }
};

export const clearVideoApiKey = (): void => {
    try {
        localStorage.removeItem(VIDEO_API_KEY_STORAGE_KEY);
    } catch (e) {
        console.error("Failed to clear video API key from localStorage", e);
    }
};

export const getEffectiveApiKey = (): string | null => {
    // Custom key for chat/image takes precedence over any environment default.
    return getCustomApiKey() || process.env.API_KEY || null;
}

export const getAi = () => {
    const apiKey = getEffectiveApiKey();

    if (!apiKey) {
        throw new Error("API Key not configured. Please add a custom key in the sidebar.");
    }
    // Always create a new instance for chat/image.
    return new GoogleGenAI({ apiKey });
};

export const CREATE_ZIP_FUNCTION: FunctionDeclaration = {
    name: "create_zip_file",
    description: "Creates a zip file containing one or more files with specified content. Use this to provide multiple files to the user, like for a coding project.",
    parameters: {
        type: Type.OBJECT,
        properties: {
            filename: {
                type: Type.STRING,
                description: "The name of the zip file to be created, e.g., 'project.zip'.",
            },
            files: {
                type: Type.ARRAY,
                description: "An array of file objects to be included in the zip.",
                items: {
                    type: Type.OBJECT,
                    properties: {
                        path: {
                            type: Type.STRING,
                            description: "The full path of the file within the zip, including directories, e.g., 'src/index.js'.",
                        },
                        content: {
                            type: Type.STRING,
                            description: "The text content of the file.",
                        },
                    },
                    required: ["path", "content"],
                },
            },
        },
        required: ["filename", "files"],
    },
};

export const createChatSession = (history?: Content[], tools?: any[]): Chat => {
    const aiInstance = getAi();
    return aiInstance.chats.create({
        model: 'gemini-2.5-flash',
        config: {
            systemInstruction: 'You are Cortex, a helpful and creative AI assistant. Your responses should be engaging, informative, and friendly.',
            tools,
        },
        history,
    });
};

export const streamMessage = async (
    chat: Chat,
    messageParts: Part[]
) => {
    const result = await chat.sendMessageStream({ message: messageParts });
    return result;
};

export const sendFunctionResponse = async (chat: Chat, functionResponse: Part[]) => {
    const result = await chat.sendMessageStream({ message: functionResponse });
    return result;
};


export const generateImage = async (parts: Part[]): Promise<string> => {
    const aiInstance = getAi();
    const response = await aiInstance.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts },
        config: {
            responseModalities: [Modality.IMAGE],
        },
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
            return part.inlineData.data;
        }
    }

    throw new Error("Image generation failed. No image data was returned.");
};

export const generateSpeech = async (text: string): Promise<string> => {
    const aiInstance = getAi();
    const response = await aiInstance.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text }] }],
        config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: 'Kore' },
                },
            },
        },
    });
    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) {
        throw new Error("Speech generation failed. No audio data was returned.");
    }
    return base64Audio;
};

export interface VideoGenerationParams {
    prompt: string;
    image?: { data: string; mimeType: string };
    lastFrame?: { data: string; mimeType: string };
    referenceImages?: { data: string; mimeType: string }[];
    video?: any; // For video extension
    config: {
        resolution: '720p' | '1080p';
        aspectRatio: '16:9' | '9:16';
    };
}

const getVideoAi = () => {
    const apiKey = getVideoApiKey(); 

    if (!apiKey) {
        // This case is handled by the UI (disabling the input), but as a safeguard.
        throw new Error("Video generation API Key not configured. Please add a key in the sidebar.");
    }
    return new GoogleGenAI({ apiKey });
};

export const generateVideos = async (
    params: VideoGenerationParams,
    onProgress: (status: string) => void
): Promise<{ video: any; uri: string }> => {
    const ai = getVideoAi();
    
    const useHighQualityModel = params.referenceImages && params.referenceImages.length > 0;
    const model = useHighQualityModel ? 'veo-3.1-generate-preview' : 'veo-3.1-fast-generate-preview';
    
    const requestPayload: any = {
        model,
        prompt: params.prompt || 'An amazing video.',
        config: {
            numberOfVideos: 1,
            resolution: params.config.resolution,
            aspectRatio: params.config.aspectRatio,
        }
    };

    if (params.image) {
        requestPayload.image = { imageBytes: params.image.data, mimeType: params.image.mimeType };
    }
    if (params.lastFrame) {
        requestPayload.config.lastFrame = { imageBytes: params.lastFrame.data, mimeType: params.lastFrame.mimeType };
    }
    if (params.referenceImages && params.referenceImages.length > 0) {
         if (!params.prompt) throw new Error("A text prompt is required when using reference images.");
        requestPayload.config.referenceImages = params.referenceImages.map(img => ({
            image: { imageBytes: img.data, mimeType: img.mimeType },
            referenceType: VideoGenerationReferenceType.ASSET
        }));
        // These are requirements for multi-reference model
        requestPayload.config.resolution = '720p';
        requestPayload.config.aspectRatio = '16:9';
    }
    if (params.video) {
        if (!params.prompt) throw new Error("A text prompt is required to extend a video.");
        requestPayload.model = 'veo-3.1-generate-preview'; // Extension requires this model
        requestPayload.video = params.video;
        requestPayload.config.resolution = '720p'; // Extension requires 720p
    }

    onProgress("Sending video generation request...");
    let operation: GenerateVideosOperation = await ai.models.generateVideos(requestPayload);
    onProgress("Request accepted. Your video is in the queue.");

    let lastStatus = "queued";

    while (!operation.done) {
        await new Promise(resolve => setTimeout(resolve, 10000));
        operation = await ai.operations.getVideosOperation({ operation: operation });
        const progressList = operation.metadata?.progress;
        if (Array.isArray(progressList) && progressList.length > 0) {
            const progress = progressList[progressList.length - 1]?.status;
            if(progress && progress !== lastStatus) {
                onProgress(`Processing: ${progress.toLowerCase().replace(/_/g, ' ')}...`);
                lastStatus = progress;
            }
        }
    }
    onProgress("Finalizing video...");

    const generatedVideo = (operation.response as any)?.generatedVideos?.[0]?.video;
    if (!generatedVideo || !generatedVideo.uri) {
        throw new Error("Video generation failed to return a valid video.");
    }

    return { video: generatedVideo, uri: generatedVideo.uri };
};