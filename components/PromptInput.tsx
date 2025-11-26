

import React, { useState, useRef, useCallback, useEffect, ChangeEvent, KeyboardEvent } from 'react';
import { type Part } from '@google/genai';
import { type DisplayMessagePart } from '../types';
import { SendIcon, PaperclipIcon, XIcon, MicrophoneIcon, ImageIcon, MessageIcon, SpinnerIcon, AvatarIcon, SearchIcon, VideoIcon } from './Icons';

type AppMode = 'chat' | 'image' | 'video';

export interface VideoOptions {
    startImage?: File | null;
    endImage?: File | null;
    referenceImages: File[];
    resolution: '720p' | '1080p';
    aspectRatio: '16:9' | '9:16';
}

interface PromptInputProps {
    onSendMessage: (userMessageParts: Part[], displayParts: DisplayMessagePart[], videoOptions?: VideoOptions) => void;
    isLoading: boolean;
    disabled: boolean;
    mode: AppMode;
    onModeChange: (mode: AppMode) => void;
    webSearchEnabled: boolean;
    onWebSearchChange: (enabled: boolean) => void;
    isExtending?: boolean;
    onCancelExtension?: () => void;
    onAvatarChange: (file: File) => void;
}

interface SpeechRecognitionAlternative {
    readonly transcript: string;
    readonly confidence: number;
}
  
interface SpeechRecognitionResult {
    readonly isFinal: boolean;
    readonly length: number;
    item(index: number): SpeechRecognitionAlternative;
    [index: number]: SpeechRecognitionAlternative;
}
  
interface SpeechRecognitionResultList {
    readonly length: number;
    item(index: number): SpeechRecognitionResult;
    [index: number]: SpeechRecognitionResult;
}
  
interface SpeechRecognitionEvent extends Event {
    readonly resultIndex: number;
    readonly results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
    readonly error: string;
    readonly message: string;
}

interface SpeechRecognition extends EventTarget {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    start(): void;
    stop(): void;
    onresult: (event: SpeechRecognitionEvent) => void;
    onend: () => void;
    onerror: (event: SpeechRecognitionErrorEvent) => void;
}

interface SpeechRecognitionStatic {
    new (): SpeechRecognition;
}

interface CustomWindow extends Window {
  SpeechRecognition: SpeechRecognitionStatic;
  webkitSpeechRecognition: SpeechRecognitionStatic;
}
declare const window: CustomWindow;


const fileToPart = async (file: File): Promise<Part> => {
    const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = (error) => reject(error);
    });
    return {
        inlineData: {
            mimeType: file.type,
            data: base64,
        },
    };
};

const fileToDisplayPart = async (file: File): Promise<DisplayMessagePart> => {
    if (file.type.startsWith("image/")) {
        const dataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = (error) => reject(error);
        });
        return {
            image: {
                data: dataUrl,
                mimeType: file.type
            }
        };
    }
    return {
        file: {
            name: file.name,
            type: file.type,
        }
    }
};


const PromptInput: React.FC<PromptInputProps> = (props) => {
    const { onSendMessage, isLoading, disabled, mode, onModeChange, webSearchEnabled, onWebSearchChange, isExtending, onCancelExtension, onAvatarChange } = props;
    const [prompt, setPrompt] = useState('');
    const [files, setFiles] = useState<File[]>([]);
    const [isRecording, setIsRecording] = useState(false);
    const [videoOptions, setVideoOptions] = useState<VideoOptions>({
        referenceImages: [],
        resolution: '720p',
        aspectRatio: '16:9'
    });
    
    const fileInputRef = useRef<HTMLInputElement>(null);
    const avatarInputRef = useRef<HTMLInputElement>(null);
    const videoStartImageInputRef = useRef<HTMLInputElement>(null);
    const videoEndImageInputRef = useRef<HTMLInputElement>(null);
    const videoRefImagesInputRef = useRef<HTMLInputElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const recognitionRef = useRef<SpeechRecognition | null>(null);
    const textBeforeRecordingRef = useRef('');

    const removeFile = useCallback((index: number) => {
        setFiles(prev => prev.filter((_, i) => i !== index));
    }, []);

    useEffect(() => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            console.warn("Speech recognition not supported in this browser.");
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onresult = (event: SpeechRecognitionEvent) => {
            let final_transcript = '';
            let interim_transcript = '';

            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    final_transcript += event.results[i][0].transcript;
                } else {
                    interim_transcript += event.results[i][0].transcript;
                }
            }
            
            const fullTranscript = textBeforeRecordingRef.current + final_transcript + interim_transcript;
            setPrompt(fullTranscript);

            if (textareaRef.current) {
                textareaRef.current.style.height = 'auto';
                textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
            }
        };

        recognition.onend = () => {
            setIsRecording(false);
        };

        recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
            console.error('Speech recognition error:', event.error);
            setIsRecording(false);
        };
        
        recognitionRef.current = recognition;

    }, []);

    const handleMicClick = () => {
        if (!recognitionRef.current) return;

        if (isRecording) {
            recognitionRef.current.stop();
        } else {
            textBeforeRecordingRef.current = prompt ? prompt + ' ' : '';
            try {
                recognitionRef.current.start();
                setIsRecording(true);
            } catch (error) {
                console.error("Error starting speech recognition:", error);
            }
        }
    };

    const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setFiles(prev => [...prev, ...Array.from(e.target.files!)]);
        }
        if (e.target) e.target.value = '';
    };

    const handleAvatarFileChange = (e: ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            onAvatarChange(e.target.files[0]);
        }
        if (e.target) e.target.value = '';
    };

    const handleVideoFileChange = (e: ChangeEvent<HTMLInputElement>, type: 'start' | 'end' | 'ref') => {
        if (e.target.files && e.target.files.length > 0) {
            const newFiles = Array.from(e.target.files);
            if (type === 'start') setVideoOptions(prev => ({ ...prev, startImage: newFiles[0] }));
            if (type === 'end') setVideoOptions(prev => ({ ...prev, endImage: newFiles[0] }));
            if (type === 'ref') setVideoOptions(prev => ({ ...prev, referenceImages: [...prev.referenceImages, ...newFiles].slice(0, 3) }));
        }
        if (e.target) e.target.value = '';
    };

    const handleSend = useCallback(async () => {
        const hasVideoImages = videoOptions.startImage || videoOptions.endImage || videoOptions.referenceImages.length > 0;
        if ((!prompt.trim() && files.length === 0 && !hasVideoImages && !isExtending) || isLoading || disabled) return;

        const apiParts: Part[] = [];
        const displayParts: DisplayMessagePart[] = [];
        
        let filesToProcess = files;
        // In video mode, also add video-related images as attachments for display
        if (mode === 'video') {
            const videoImages = [videoOptions.startImage, videoOptions.endImage, ...videoOptions.referenceImages].filter(Boolean) as File[];
            filesToProcess = [...filesToProcess, ...videoImages];
        }

        for (const file of filesToProcess) {
            apiParts.push(await fileToPart(file));
            displayParts.push(await fileToDisplayPart(file));
        }

        if (prompt.trim()) {
            apiParts.push({ text: prompt });
            displayParts.push({ text: prompt });
        }
        
        onSendMessage(apiParts, displayParts, mode === 'video' ? videoOptions : undefined);
        setPrompt('');
        setFiles([]);
        setVideoOptions(prev => ({ ...prev, startImage: null, endImage: null, referenceImages: []}));

    }, [prompt, files, isLoading, disabled, onSendMessage, mode, videoOptions, isExtending]);
    
    const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleInput = (e: React.FormEvent<HTMLTextAreaElement>) => {
        const target = e.currentTarget;
        setPrompt(target.value);
        target.style.height = 'auto';
        target.style.height = `${target.scrollHeight}px`;
    };
    
    const isSendDisabled = (!prompt.trim() && files.length === 0 && (mode !== 'video' || (!videoOptions.startImage && videoOptions.referenceImages.length === 0 && !isExtending))) || isLoading || disabled;

    const placeholderText = disabled
        ? "API Key not configured. Please add a custom key in the sidebar."
        : mode === 'chat'
        ? "Message Cortex or attach files..."
        : mode === 'image'
        ? "Describe an image to generate..."
        : isExtending
        ? "Describe what happens next to extend the video..."
        : "Describe a video to generate...";

    // FIX: Explicitly type `VideoFileChip` as a `React.FC` to allow the special `key` prop to be passed during mapping without causing a TypeScript error.
    const VideoFileChip: React.FC<{ file: File, onRemove: () => void }> = ({ file, onRemove }) => (
        <div className="flex items-center gap-2 bg-zinc-700 text-zinc-200 text-xs px-2 py-1 rounded-full">
            <span className="truncate max-w-28">{file.name}</span>
            <button onClick={onRemove} className="p-0.5 rounded-full hover:bg-zinc-600">
                <XIcon />
            </button>
        </div>
    );

    return (
        <div className="bg-zinc-900/70 backdrop-blur-lg border border-zinc-700 rounded-2xl p-2 flex flex-col shadow-2xl w-full max-w-4xl mx-auto">
            <div className="flex items-center flex-wrap gap-2 px-2 pt-1 pb-2 border-b border-zinc-700/50 mb-2">
                <button onClick={() => onModeChange('chat')} className={`flex items-center gap-2 px-3 py-1 text-sm rounded-lg transition-colors font-medium ${mode === 'chat' ? 'bg-blue-600 text-white' : 'text-zinc-400 hover:bg-zinc-700'}`}><MessageIcon /> Chat</button>
                <button onClick={() => onModeChange('image')} className={`flex items-center gap-2 px-3 py-1 text-sm rounded-lg transition-colors font-medium ${mode === 'image' ? 'bg-blue-600 text-white' : 'text-zinc-400 hover:bg-zinc-700'}`}><ImageIcon /> Image</button>
                <button onClick={() => onModeChange('video')} className={`flex items-center gap-2 px-3 py-1 text-sm rounded-lg transition-colors font-medium ${mode === 'video' ? 'bg-blue-600 text-white' : 'text-zinc-400 hover:bg-zinc-700'}`}><VideoIcon /> Video</button>
                {mode === 'chat' && (<button onClick={() => onWebSearchChange(!webSearchEnabled)} className={`flex items-center gap-2 px-3 py-1 text-sm rounded-lg transition-colors font-medium ${webSearchEnabled ? 'bg-blue-600 text-white' : 'text-zinc-400 hover:bg-zinc-700'}`}><SearchIcon /> Web Search</button>)}
            </div>
            
            {mode === 'video' && !isExtending && (
                <div className="px-2 py-2 border-b border-zinc-700/50 mb-2 space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div className="flex items-center justify-between">
                            <span className="text-zinc-300 font-medium">Resolution</span>
                            <select value={videoOptions.resolution} onChange={e => setVideoOptions(v => ({...v, resolution: e.target.value as any}))} className="bg-zinc-800 border border-zinc-700 rounded-md px-2 py-1 text-zinc-200">
                                <option value="720p">720p</option>
                                <option value="1080p">1080p</option>
                            </select>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-zinc-300 font-medium">Aspect Ratio</span>
                            <select value={videoOptions.aspectRatio} onChange={e => setVideoOptions(v => ({...v, aspectRatio: e.target.value as any}))} className="bg-zinc-800 border border-zinc-700 rounded-md px-2 py-1 text-zinc-200">
                                <option value="16:9">16:9 Landscape</option>
                                <option value="9:16">9:16 Portrait</option>
                            </select>
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <input type="file" ref={videoStartImageInputRef} onChange={(e) => handleVideoFileChange(e, 'start')} accept="image/*" className="hidden" />
                        <button onClick={() => videoStartImageInputRef.current?.click()} className="text-xs font-semibold bg-zinc-700 hover:bg-zinc-600 text-zinc-200 px-3 py-1.5 rounded-md">Start Image</button>
                        {videoOptions.startImage && <VideoFileChip file={videoOptions.startImage} onRemove={() => setVideoOptions(v => ({...v, startImage: null}))} />}
                        
                        <input type="file" ref={videoEndImageInputRef} onChange={(e) => handleVideoFileChange(e, 'end')} accept="image/*" className="hidden" />
                        <button onClick={() => videoEndImageInputRef.current?.click()} className="text-xs font-semibold bg-zinc-700 hover:bg-zinc-600 text-zinc-200 px-3 py-1.5 rounded-md">End Image</button>
                        {videoOptions.endImage && <VideoFileChip file={videoOptions.endImage} onRemove={() => setVideoOptions(v => ({...v, endImage: null}))} />}

                        <input type="file" ref={videoRefImagesInputRef} onChange={(e) => handleVideoFileChange(e, 'ref')} accept="image/*" multiple className="hidden" />
                        <button onClick={() => videoRefImagesInputRef.current?.click()} className="text-xs font-semibold bg-zinc-700 hover:bg-zinc-600 text-zinc-200 px-3 py-1.5 rounded-md">Ref Images ({videoOptions.referenceImages.length}/3)</button>
                        {videoOptions.referenceImages.map((file, i) => <VideoFileChip key={i} file={file} onRemove={() => setVideoOptions(v => ({...v, referenceImages: v.referenceImages.filter((_, idx) => idx !== i)}))} />)}
                    </div>
                </div>
            )}

            {mode === 'video' && isExtending && (
                <div className="px-3 py-2 border-b border-zinc-700/50 mb-2 flex items-center justify-between gap-2 text-sm bg-yellow-900/40 rounded-lg">
                    <p className="font-medium text-yellow-300">Extending previous video.</p>
                    <button onClick={onCancelExtension} className="text-xs font-semibold text-zinc-300 hover:text-white hover:underline shrink-0">Cancel</button>
                </div>
            )}

            {files.length > 0 && (
                <div className="p-2 flex flex-wrap gap-2">
                    {files.map((file, index) => (
                        <div key={index} className="relative w-20 h-20 bg-zinc-800 rounded-lg flex items-center justify-center p-1">
                             {file.type.startsWith("image/") ? ( <img src={URL.createObjectURL(file)} alt={file.name} className="max-w-full max-h-full rounded object-contain" /> ) : ( <div className="text-center text-zinc-300 text-xs break-words"><p className="font-bold">{file.name.split('.').pop()?.toUpperCase()}</p><p className="truncate">{file.name}</p></div> )}
                            <button onClick={() => removeFile(index)} className="absolute -top-1 -right-1 p-0.5 bg-red-600 rounded-full text-white hover:bg-red-500 transition-colors" aria-label={`Remove ${file.name}`}><XIcon /></button>
                        </div>
                    ))}
                </div>
            )}
            <div className="flex items-end gap-2 p-2">
                <button onClick={() => avatarInputRef.current?.click()} className="p-2 text-zinc-400 hover:text-white transition-colors disabled:opacity-50" disabled={isLoading || disabled} aria-label="Change avatar"><AvatarIcon /></button>
                <input type="file" ref={avatarInputRef} onChange={handleAvatarFileChange} className="hidden" accept="image/*"/>

                <button onClick={() => fileInputRef.current?.click()} className="p-2 text-zinc-400 hover:text-white transition-colors disabled:opacity-50" disabled={isLoading || disabled} aria-label="Attach file"><PaperclipIcon /></button>
                <input type="file" ref={fileInputRef} onChange={handleFileChange} multiple className="hidden"/>
                <textarea ref={textareaRef} value={prompt} onChange={handleInput} onKeyDown={handleKeyDown} placeholder={placeholderText} className="flex-1 bg-transparent resize-none outline-none text-zinc-100 placeholder-zinc-500 max-h-48 ring-0 focus:ring-0" rows={1} disabled={isLoading || disabled}/>
                <button onClick={handleMicClick} disabled={isLoading || disabled} className={`p-2 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${isRecording ? 'bg-red-600 text-white' : 'text-zinc-400 hover:text-white'}`} aria-label={isRecording ? 'Stop recording' : 'Start recording'}><MicrophoneIcon /></button>
                <button onClick={handleSend} disabled={isSendDisabled} className="p-2 rounded-full bg-blue-600 text-white disabled:bg-zinc-700 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors" aria-label={isLoading ? "Processing request" : "Send message"}>
                    {isLoading ? <SpinnerIcon /> : <SendIcon />}
                </button>
            </div>
        </div>
    );
};

export default PromptInput;