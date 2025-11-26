import React, { useState, useEffect, useCallback, useRef } from 'react';
import { type Part, FunctionCall, GroundingChunk } from '@google/genai';
import { type DisplayMessage, type User } from './types';
import { generateImage, generateSpeech, generateVideos, streamMessage, VideoGenerationParams, getCustomApiKey, setCustomApiKey, clearCustomApiKey, getEffectiveApiKey, setVideoApiKey, getVideoApiKey, clearVideoApiKey } from './services/geminiService';
import { type VideoOptions } from './components/PromptInput';
import { playSound } from './services/soundService';
import { useChatHistory } from './hooks/useChatHistory';
import PromptInput from './components/PromptInput';
import ChatWindow from './components/ChatWindow';
import BuyPlan from './components/BuyPlan';
import { PlusIcon, MessageIcon, TrashIcon, CortexIcon, MenuIcon, XIcon, VolumeOnIcon, VolumeOffIcon, PencilIcon, BookmarkIcon, WarningIcon, KeyIcon, EyeIcon, EyeOffIcon, LogoutIcon, CreditCardIcon, VideoIcon } from './components/Icons';
import { FullScreenError } from './components/FullScreenError';

type AppMode = 'chat' | 'image' | 'video';

// --- Audio Decoding Utilities ---
function decode(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}
// --- End Audio Utilities ---

const generateAvatar = (username: string): string => {
    const initial = username?.[0]?.toUpperCase() || '?';
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect width="100" height="100" fill="#475569" /><text x="50%" y="50%" font-family="Inter, sans-serif" font-size="50" fill="white" text-anchor="middle" dy=".3em">${initial}</text></svg>`;
    return `data:image/svg+xml;base64,${btoa(svg)}`;
};

const fileToPart = async (file: File): Promise<{ data: string; mimeType: string }> => {
    const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = (error) => reject(error);
    });
    return { data: base64, mimeType: file.type };
};

const isCreditError = (error: any): boolean => {
    const message = (error?.message || '').toLowerCase();
    // Keywords that might indicate a quota/billing issue.
    return message.includes('quota') || 
           message.includes('billing') || 
           message.includes('credit') ||
           message.includes('rate limit');
};

interface MainAppProps {
    user: User;
    onLogout: () => void;
    onAvatarChange: (avatarDataUrl: string) => void;
}

export default function MainApp({ user, onLogout, onAvatarChange }: MainAppProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [mode, setMode] = useState<AppMode>('chat');
    const [userAvatar, setUserAvatar] = useState<string | null>(null);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isMuted, setIsMuted] = useState(true);
    const [currentlyPlayingId, setCurrentlyPlayingId] = useState<number | null>(null);
    const [editingSession, setEditingSession] = useState<{ id: string; title: string } | null>(null);
    const [webSearchEnabled, setWebSearchEnabled] = useState(false);
    const [showBuyPlanModal, setShowBuyPlanModal] = useState(false);
    const [videoToExtend, setVideoToExtend] = useState<any | null>(null);

    const [customApiKeyInput, setCustomApiKeyInput] = useState('');
    const [showCustomApiKey, setShowCustomApiKey] = useState(false);
    const [isApiConfigured, setIsApiConfigured] = useState(false);
    const [videoApiKeyInput, setVideoApiKeyInput] = useState('');
    const [showVideoApiKey, setShowVideoApiKey] = useState(false);
    const [isVideoApiConfigured, setIsVideoApiConfigured] = useState(false);
    const [apiKeyVersion, setApiKeyVersion] = useState(0);

    const { sessions, activeSessionId, activeChatHistory, setActiveChatHistory, geminiSession, startNewChat, loadChatSession, deleteChatSession, updateSessionTitle, contextSessionIds, toggleContextSession } = useChatHistory(user.id, webSearchEnabled, apiKeyVersion);

    const chatContainerRef = useRef<HTMLDivElement>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);

    useEffect(() => { document.documentElement.classList.add('dark'); }, []);
    
    useEffect(() => {
        setUserAvatar(user.avatar || generateAvatar(user.username));
    }, [user.avatar, user.username]);

    useEffect(() => {
        const chatKey = getCustomApiKey();
        if (chatKey) {
            setCustomApiKeyInput(chatKey);
        }
        setIsApiConfigured(!!getEffectiveApiKey());

        const videoKey = getVideoApiKey();
        if (videoKey) {
            setVideoApiKeyInput(videoKey);
        }
        setIsVideoApiConfigured(!!videoKey);
    }, [apiKeyVersion]);
    
    useEffect(() => {
        if (chatContainerRef.current) chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }, [activeChatHistory]);

    useEffect(() => {
        const initAudioContext = () => { if (!audioContextRef.current) audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 }); };
        document.addEventListener('click', initAudioContext, { once: true });
        return () => { document.removeEventListener('click', initAudioContext); audioContextRef.current?.close(); }
    }, []);

    const handleCloseBuyPlanModal = useCallback(() => {
        setShowBuyPlanModal(false);
    }, []);

    const handleStopAudio = useCallback(() => {
        if (audioSourceRef.current) {
            audioSourceRef.current.stop();
            audioSourceRef.current = null;
            setCurrentlyPlayingId(null);
        }
    }, []);

    const handlePlayAudio = useCallback(async (text: string, messageId: number) => {
        if (!audioContextRef.current || isMuted) return;
        handleStopAudio();
        setCurrentlyPlayingId(messageId);
        try {
            const base64Audio = await generateSpeech(text);
            const audioData = decode(base64Audio);
            const audioBuffer = await decodeAudioData(audioData, audioContextRef.current, 24000, 1);
            const source = audioContextRef.current.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(audioContextRef.current.destination);
            source.onended = () => { setCurrentlyPlayingId(null); if (audioSourceRef.current === source) audioSourceRef.current = null; };
            source.start();
            audioSourceRef.current = source;
        } catch (error) { console.error("Failed to play audio:", error); setCurrentlyPlayingId(null); }
    }, [isMuted, handleStopAudio]);

    const handleModeChange = useCallback((newMode: AppMode) => {
        if (mode !== newMode) { 
            setMode(newMode); 
            if (newMode !== 'video') {
                setVideoToExtend(null);
            }
            if (!isMuted) playSound('switch'); 
        }
    }, [isMuted, mode]);

    const handleNewChat = useCallback(() => {
        handleStopAudio();
        startNewChat();
        if (!isMuted) playSound('new');
        setIsSidebarOpen(false);
    }, [handleStopAudio, startNewChat, isMuted]);

    const handleLoadChat = useCallback((sessionId: string) => {
        if(activeSessionId === sessionId) return;
        handleStopAudio();
        loadChatSession(sessionId);
        if (!isMuted) playSound('switch');
        setIsSidebarOpen(false);
    }, [activeSessionId, handleStopAudio, loadChatSession, isMuted]);

    const handleDeleteChat = useCallback((sessionId: string) => {
        if (window.confirm("Are you sure you want to delete this chat? This action cannot be undone.")) {
            deleteChatSession(sessionId);
            if (!isMuted) playSound('send');
        }
    }, [deleteChatSession, isMuted]);

    const handleTitleSave = useCallback(() => {
        if (editingSession && editingSession.title.trim()) updateSessionTitle(editingSession.id, editingSession.title.trim());
        setEditingSession(null);
    }, [editingSession, updateSessionTitle]);

    const handleAvatarChange = (file: File) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64String = reader.result as string;
            onAvatarChange(base64String);
        };
        reader.readAsDataURL(file);
    };

    const handleDownloadZip = useCallback(async (functionCall: FunctionCall) => {
        const { filename, files } = functionCall.args as { filename: string, files: { path: string, content: string }[] };
        if (!filename || !Array.isArray(files)) return;
        const JSZip = (window as any).JSZip;
        if (!JSZip) return;
        const zip = new JSZip();
        files.forEach((file: { path: string, content: string }) => zip.file(file.path, file.content));
        const content = await zip.generateAsync({ type: "blob" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(content);
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }, []);

    const handleExtendVideo = useCallback((videoObject: any) => {
        if (isLoading) return;
        setVideoToExtend(videoObject);
        handleModeChange('video');
    }, [isLoading, handleModeChange]);

    const handleSendMessage = useCallback(async (userMessageParts: Part[], displayParts: DisplayMessage['displayParts'], videoOptions?: VideoOptions) => {
        if (isLoading) return;
        setIsLoading(true);
        handleStopAudio();

        const userMessage: DisplayMessage = { role: 'user', parts: userMessageParts, displayParts, timestamp: Date.now() };

        if (mode === 'chat' && geminiSession) {
            if (!isMuted) playSound('send');
            setActiveChatHistory(prev => [...prev, userMessage]);
            let currentResponse: DisplayMessage = { role: 'model', parts: [{ text: '' }], displayParts: [{ text: '' }], timestamp: Date.now() + 1 };
            setActiveChatHistory(prev => [...prev, currentResponse]);
            try {
                const stream = await streamMessage(geminiSession, userMessageParts);
                let text = '', finalFunctionCall: FunctionCall | undefined, finalGroundingChunks: GroundingChunk[] | undefined;
                for await (const chunk of stream) {
                    const chunkText = chunk.text;
                    if (chunkText) {
                       text = chunkText;
                    }
                    if (chunk.functionCalls && chunk.functionCalls.length > 0) finalFunctionCall = chunk.functionCalls[0];
                    finalGroundingChunks = chunk.candidates?.[0]?.groundingMetadata?.groundingChunks;
                    currentResponse = { ...currentResponse, parts: [{ text }], displayParts: [{ text }], functionCall: finalFunctionCall, groundingSources: finalGroundingChunks };
                    setActiveChatHistory(prev => { const newHistory = [...prev]; newHistory[newHistory.length - 1] = currentResponse; return newHistory; });
                }
                if (!isMuted) { playSound('receive'); if (text) handlePlayAudio(text, currentResponse.timestamp); }
            } catch (error) {
                console.error("Error streaming message:", error);
                const creditError = isCreditError(error);
                const errorMessageContent = `Sorry, something went wrong. Please try again. \n\n${error instanceof Error ? error.message : String(error)}`;

                const errorMessage: DisplayMessage = { 
                    role: 'model', 
                    parts: [{ text: errorMessageContent }], 
                    displayParts: [{ text: errorMessageContent }], 
                    timestamp: Date.now() + 1, 
                    isError: true,
                    isCreditError: creditError 
                };
                setActiveChatHistory(prev => [...prev.slice(0, -1), errorMessage]);
            } finally { setIsLoading(false); }
        } else if (mode === 'image') {
            if (!isMuted) playSound('send');
            setActiveChatHistory(prev => [...prev, userMessage]);
            const loadingResponse: DisplayMessage = { role: 'model', parts: userMessageParts, displayParts: displayParts, timestamp: Date.now() + 1, isGenerating: true };
            setActiveChatHistory(prev => [...prev, loadingResponse]);
            try {
                const base64Image = await generateImage(userMessageParts);
                const imageResponse: DisplayMessage = { role: 'model', parts: [{ inlineData: { data: base64Image, mimeType: 'image/png' } }], displayParts: [{ image: { data: `data:image/png;base64,${base64Image}`, mimeType: 'image/png' } }], timestamp: Date.now() + 1 };
                setActiveChatHistory(prev => [...prev.slice(0, -1), imageResponse]);
                if (!isMuted) playSound('receive');
            } catch (error) {
                 console.error("Error generating image:", error);
                const creditError = isCreditError(error);
                const errorMessageContent = `Sorry, I couldn't generate the image. Please try again. \n\n${error instanceof Error ? error.message : String(error)}`;

                const errorMessage: DisplayMessage = { 
                    role: 'model', 
                    parts: [{ text: errorMessageContent }], 
                    displayParts: [{ text: errorMessageContent }], 
                    timestamp: Date.now() + 1, 
                    isError: true,
                    isCreditError: creditError
                };
                setActiveChatHistory(prev => [...prev.slice(0, -1), errorMessage]);
            } finally { setIsLoading(false); }
        } else if (mode === 'video' && videoOptions) {
            setVideoToExtend(null);
            if (!isMuted) playSound('send');
            
            setActiveChatHistory(prev => [...prev, userMessage]);
            const loadingResponse: DisplayMessage = { role: 'model', parts: userMessageParts, displayParts, timestamp: Date.now() + 1, isGenerating: true, generationProgress: "Preparing request..." };
            const loadingTimestamp = loadingResponse.timestamp;
            setActiveChatHistory(prev => [...prev, loadingResponse]);
        
            const onProgress = (status: string) => {
                setActiveChatHistory(prev => prev.map(msg => msg.timestamp === loadingTimestamp ? { ...msg, generationProgress: status } : msg));
            };
        
            try {
                const videoKey = getVideoApiKey();
                if (!videoKey) {
                    throw new Error("Video API Key is not set. Please add it in the sidebar.");
                }

                const finalVideoOptions = videoToExtend ? { ...videoOptions, video: videoToExtend } : videoOptions;

                const params: VideoGenerationParams = {
                    prompt: userMessageParts.find(p => p.text)?.text || '',
                    config: { resolution: finalVideoOptions.resolution, aspectRatio: finalVideoOptions.aspectRatio },
                };
                if (finalVideoOptions.startImage) params.image = await fileToPart(finalVideoOptions.startImage);
                if (finalVideoOptions.endImage) params.lastFrame = await fileToPart(finalVideoOptions.endImage);
                if (finalVideoOptions.referenceImages.length > 0) params.referenceImages = await Promise.all(finalVideoOptions.referenceImages.map(fileToPart));
                // FIX: Use 'in' operator to safely check for the 'video' property, which is only present when extending a video.
                if ('video' in finalVideoOptions && finalVideoOptions.video) {
                    params.video = finalVideoOptions.video;
                }
        
                const { video, uri } = await generateVideos(params, onProgress);
        
                const response = await fetch(`${uri}&key=${videoKey}`);
                const blob = await response.blob();
                const videoUrl = URL.createObjectURL(blob);
        
                const videoResponse: DisplayMessage = {
                    role: 'model',
                    parts: [],
                    displayParts: [{ video: { src: videoUrl, videoObject: video } }],
                    timestamp: Date.now(),
                };
                setActiveChatHistory(prev => prev.map(msg => msg.timestamp === loadingTimestamp ? videoResponse : msg));
                if (!isMuted) playSound('receive');
            } catch (error) {
                console.error("Error generating video:", error);
                const creditError = isCreditError(error);
                const errorMessageContent = `Sorry, I couldn't generate the video. Please try again. \n\n${error instanceof Error ? error.message : String(error)}`;
                
                const errorResponse: DisplayMessage = { 
                    role: 'model', 
                    parts: [{ text: errorMessageContent }], 
                    displayParts: [{ text: errorMessageContent }], 
                    timestamp: Date.now(), 
                    isError: true,
                    isCreditError: creditError 
                };
                setActiveChatHistory(prev => prev.map(msg => msg.timestamp === loadingTimestamp ? errorResponse : msg));
            } finally {
                setIsLoading(false);
            }
        } else {
            setIsLoading(false);
        }
    }, [geminiSession, isLoading, mode, isMuted, handlePlayAudio, handleStopAudio, setActiveChatHistory, videoToExtend]);
    
    const handleSaveApiKey = useCallback((key: string) => {
        const trimmedKey = key.trim();
        if (trimmedKey) {
            setCustomApiKey(trimmedKey);
            setCustomApiKeyInput(trimmedKey);
            setApiKeyVersion(v => v + 1);
            if (!isMuted) playSound('receive');
        }
    }, [isMuted]);

    const handleClearApiKey = useCallback(() => {
        clearCustomApiKey();
        setCustomApiKeyInput('');
        setApiKeyVersion(v => v + 1);
    }, []);

    const handleSaveVideoApiKey = useCallback((key: string) => {
        const trimmedKey = key.trim();
        if (trimmedKey) {
            setVideoApiKey(trimmedKey);
            setVideoApiKeyInput(trimmedKey);
            setApiKeyVersion(v => v + 1);
            if (!isMuted) playSound('receive');
        }
    }, [isMuted]);

    const handleClearVideoApiKey = useCallback(() => {
        clearVideoApiKey();
        setVideoApiKeyInput('');
        setApiKeyVersion(v => v + 1);
    }, []);

    const SidebarContent = () => (<>
        <div className="flex gap-2 mb-4"><button onClick={handleNewChat} className="flex-1 flex items-center justify-center gap-2 p-2 rounded-md bg-cyan-500 hover:bg-cyan-600 text-white transition-colors duration-200 disabled:bg-zinc-300 dark:disabled:bg-zinc-700 disabled:cursor-not-allowed font-semibold"><PlusIcon /><span>New Chat</span></button></div>
        <div className="mb-4">
            <button onClick={() => setShowBuyPlanModal(true)} className="w-full flex items-center justify-center gap-2 p-2 rounded-md bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white transition-all duration-200 font-semibold shadow-lg">
                <CreditCardIcon /><span>Upgrade Plan</span>
            </button>
        </div>
        <h2 className="text-lg font-semibold mb-2 text-zinc-200">History</h2>
        <div className="flex-grow overflow-y-auto pr-2 space-y-1.5 -mr-2">{sessions.map(session => (<div key={session.id} className={`group flex items-center justify-between gap-2 p-2 rounded-md transition-colors ${activeSessionId === session.id ? 'bg-blue-600/20' : 'hover:bg-zinc-800'}`}>
            <div className="flex items-center gap-3 flex-grow truncate cursor-pointer" onClick={() => editingSession?.id !== session.id && handleLoadChat(session.id)}><MessageIcon />{editingSession?.id === session.id ? (<input type="text" value={editingSession.title} onChange={(e) => setEditingSession({ ...editingSession, title: e.target.value })} onKeyDown={(e) => {if (e.key === 'Enter') handleTitleSave(); if (e.key === 'Escape') setEditingSession(null);}} onBlur={handleTitleSave} autoFocus className="bg-transparent outline-none ring-1 ring-blue-500 rounded p-1 -m-1 w-full text-sm font-medium" />) : (<span className="truncate text-sm font-medium">{session.title}</span>)}</div>
            <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">{editingSession?.id !== session.id && (<button onClick={(e) => { e.stopPropagation(); setEditingSession({ id: session.id, title: session.title }); }} className="p-1 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-700" aria-label="Edit title"><PencilIcon /></button>)}<button onClick={(e) => { e.stopPropagation(); toggleContextSession(session.id); }} disabled={activeSessionId === session.id} className={`p-1 rounded-md transition-colors ${contextSessionIds.has(session.id) ? 'text-blue-400 bg-blue-600/30' : 'text-zinc-400 hover:text-white hover:bg-zinc-700'} disabled:opacity-30 disabled:cursor-not-allowed`} aria-label="Use as context"><BookmarkIcon /></button><button onClick={(e) => { e.stopPropagation(); handleDeleteChat(session.id); }} className="p-1 rounded-md text-zinc-400 hover:text-red-500 hover:bg-zinc-700" aria-label="Delete chat"><TrashIcon /></button></div>
        </div>))}</div>
        <div className="mt-auto pt-4 border-t border-zinc-700 space-y-4">
            <div>
                <label htmlFor="api-key-input" className="flex items-center gap-2 text-sm font-semibold text-zinc-300 mb-1.5"><KeyIcon /> Chat & Image API Key</label>
                <div className="relative flex items-center">
                    <input
                        id="api-key-input"
                        type={showCustomApiKey ? 'text' : 'password'}
                        value={customApiKeyInput}
                        onChange={(e) => setCustomApiKeyInput(e.target.value)}
                        placeholder="Enter your personal key"
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-md pl-3 pr-10 py-1.5 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                    <button
                        type="button"
                        onClick={() => setShowCustomApiKey(s => !s)}
                        className="absolute right-0 flex items-center px-3 text-zinc-400 hover:text-white"
                        aria-label={showCustomApiKey ? 'Hide API key' : 'Show API key'}
                    >
                        {showCustomApiKey ? <EyeOffIcon /> : <EyeIcon />}
                    </button>
                </div>
                <div className="flex gap-2 mt-2">
                    <button onClick={() => handleSaveApiKey(customApiKeyInput)} className="flex-1 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-md transition-colors">Save</button>
                    <button onClick={handleClearApiKey} className="flex-1 text-xs font-semibold bg-zinc-700 hover:bg-zinc-600 text-zinc-200 px-3 py-1.5 rounded-md transition-colors">Clear</button>
                </div>
                <p className="text-xs text-zinc-500 mt-2">Your personal key for text and image generation, stored in your browser.</p>
            </div>
            <div>
                <label htmlFor="video-api-key-input" className="flex items-center gap-2 text-sm font-semibold text-zinc-300 mb-1.5"><VideoIcon /> Video Generation API Key</label>
                <div className="relative flex items-center">
                    <input
                        id="video-api-key-input"
                        type={showVideoApiKey ? 'text' : 'password'}
                        value={videoApiKeyInput}
                        onChange={(e) => setVideoApiKeyInput(e.target.value)}
                        placeholder="Enter your Veo API key"
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-md pl-3 pr-10 py-1.5 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                    <button
                        type="button"
                        onClick={() => setShowVideoApiKey(s => !s)}
                        className="absolute right-0 flex items-center px-3 text-zinc-400 hover:text-white"
                        aria-label={showVideoApiKey ? 'Hide API key' : 'Show API key'}
                    >
                        {showVideoApiKey ? <EyeOffIcon /> : <EyeIcon />}
                    </button>
                </div>
                <div className="flex gap-2 mt-2">
                    <button onClick={() => handleSaveVideoApiKey(videoApiKeyInput)} className="flex-1 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-md transition-colors">Save</button>
                    <button onClick={handleClearVideoApiKey} className="flex-1 text-xs font-semibold bg-zinc-700 hover:bg-zinc-600 text-zinc-200 px-3 py-1.5 rounded-md transition-colors">Clear</button>
                </div>
                <p className="text-xs text-zinc-500 mt-2">Your personal key for video generation, stored in your browser. Requires a project with Veo API and billing enabled.</p>
            </div>
            <div className="flex items-center justify-between gap-2">
                 <div className="flex items-center gap-3 truncate">
                    <img src={userAvatar || ''} alt="User Avatar" className="w-9 h-9 rounded-full object-cover bg-zinc-700 shrink-0" />
                    <div className="truncate">
                        <p className="font-semibold text-sm text-zinc-200 truncate">{user.username}</p>
                        <p className="text-xs text-zinc-400 truncate">{user.email}</p>
                    </div>
                 </div>
                 <button onClick={onLogout} className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-700 rounded-full transition-colors shrink-0" aria-label="Log out"><LogoutIcon /></button>
            </div>
        </div>
    </>);

    return (
        <div className="relative min-h-screen bg-zinc-950 font-sans">
            {isSidebarOpen && <div onClick={() => setIsSidebarOpen(false)} className="fixed inset-0 bg-black/60 z-30 lg:hidden" />}
            {showBuyPlanModal && <BuyPlan onClose={handleCloseBuyPlanModal} />}
            <aside className={`fixed inset-y-0 left-0 w-64 bg-zinc-900/80 backdrop-blur-lg p-4 flex flex-col border-r border-zinc-800 transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 transition-transform duration-300 ease-in-out z-40`}>
                <button onClick={() => setIsSidebarOpen(false)} className="absolute top-2 right-2 p-2 text-zinc-300 rounded-full hover:bg-zinc-700 lg:hidden" aria-label="Close sidebar"><XIcon /></button>
                <SidebarContent />
            </aside>
            <div className="lg:pl-64">
                <main className="flex flex-col h-screen bg-zinc-950">
                    <header className="p-4 border-b border-zinc-800 flex items-center gap-3 bg-zinc-950/80 backdrop-blur-sm z-20">
                        <button onClick={() => setIsSidebarOpen(p => !p)} className="p-1 text-zinc-300 rounded-md hover:bg-zinc-700 lg:hidden" aria-label="Open sidebar"><MenuIcon /></button>
                        <CortexIcon /><h1 className="text-xl font-bold text-zinc-100">Cortex AI</h1><div className="flex-grow" />
                        <button onClick={() => { const newMutedState = !isMuted; setIsMuted(newMutedState); if (newMutedState) handleStopAudio(); }} className="p-2 text-zinc-400 hover:bg-zinc-700 rounded-full transition-colors" aria-label={isMuted ? "Enable voice output" : "Disable voice output"}>{isMuted ? <VolumeOffIcon /> : <VolumeOnIcon />}</button>
                    </header>
                    <div ref={chatContainerRef} className="flex-1 overflow-y-auto">
                        <ChatWindow 
                            history={activeChatHistory} 
                            userAvatar={userAvatar} 
                            onPlayAudio={handlePlayAudio} 
                            currentlyPlayingId={currentlyPlayingId} 
                            onDownloadZip={handleDownloadZip} 
                            onExtendVideo={handleExtendVideo}
                            onBuyPlanClick={() => setShowBuyPlanModal(true)}
                        />
                    </div>
                    <div className="p-4 bg-gradient-to-t from-zinc-950 via-zinc-950/80 to-transparent">
                        <PromptInput 
                            mode={mode} 
                            onModeChange={handleModeChange} 
                            onSendMessage={handleSendMessage} 
                            isLoading={isLoading} 
                            disabled={isLoading || ((mode === 'chat' || mode === 'image') ? (!isApiConfigured || !geminiSession) : !isVideoApiConfigured)} 
                            webSearchEnabled={webSearchEnabled} 
                            onWebSearchChange={setWebSearchEnabled} 
                            isExtending={!!videoToExtend}
                            onCancelExtension={() => setVideoToExtend(null)}
                            onAvatarChange={handleAvatarChange}
                        />
                    </div>
                </main>
            </div>
        </div>
    );
}