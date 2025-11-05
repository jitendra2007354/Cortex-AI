import React, { useMemo, useState, useEffect } from 'react';
import { type FunctionCall } from '@google/genai';
import { type DisplayMessage, DisplayMessagePart } from '../types';
import { UserIcon, CortexIcon, ClipboardIcon, CheckIcon, PlayIcon, StopIcon, DownloadIcon, ZipIcon, VideoIcon, CreditCardIcon } from './Icons';

interface MessageProps {
    message: DisplayMessage;
    userAvatar: string | null;
    onPlayAudio: (text: string, messageId: number) => void;
    currentlyPlayingId: number | null;
    onDownloadZip: (functionCall: FunctionCall) => void;
    onExtendVideo: (videoObject: any) => void;
    onBuyPlanClick: () => void;
}

const IMAGE_STEPS = ["Contacting the creative AI...", "Sketching the initial concept...", "Adding colors and textures...", "Applying the final touches...", "Almost ready..."];
const VIDEO_STEPS = ["Initializing video request...", "Queued for processing...", "Generating initial frames...", "Upscaling to high resolution...", "Applying post-processing...", "Finalizing video..."];

const ImageGenerationLoader: React.FC<{ prompt: string }> = ({ prompt }) => {
    const [stepIndex, setStepIndex] = useState(0);
    useEffect(() => {
        const interval = setInterval(() => { setStepIndex(prev => (prev >= IMAGE_STEPS.length - 1 ? prev : prev + 1)); }, 2500);
        return () => clearInterval(interval);
    }, []);
    return (
        <div className="flex flex-col gap-3">
            <p className="text-sm text-zinc-400 italic">{prompt ? `Generating an image of "${prompt.substring(0, 50)}${prompt.length > 50 ? '...' : ''}"` : "Generating image..."}</p>
            <div className="w-full bg-zinc-700 rounded-full h-2 overflow-hidden"><div className="bg-blue-600 h-2 rounded-full animate-pulse" style={{ width: '100%' }}></div></div>
            <p className="text-xs text-zinc-400 text-center font-medium">{IMAGE_STEPS[stepIndex]}</p>
        </div>
    );
};

const VideoGenerationLoader: React.FC<{ prompt: string, progress: string }> = ({ prompt, progress }) => {
    return (
        <div className="flex flex-col gap-3">
            <p className="text-sm text-zinc-400 italic">{prompt ? `Generating a video of "${prompt.substring(0, 50)}${prompt.length > 50 ? '...' : ''}"` : "Generating video..."}</p>
            <div className="w-full bg-zinc-700 rounded-full h-2 overflow-hidden"><div className="bg-blue-600 h-2 rounded-full animate-pulse" style={{ width: '100%' }}></div></div>
            <p className="text-xs text-zinc-400 text-center font-medium">{progress || "Contacting video service..."}</p>
        </div>
    );
}

const CodeBlock: React.FC<{ code: string; language: string }> = ({ code, language }) => {
    const [isCopied, setIsCopied] = useState(false);
    const handleCopy = () => {
        navigator.clipboard.writeText(code);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
    };
    return (
        <div className="bg-zinc-900 rounded-md my-2 overflow-hidden border border-zinc-800">
            <div className="flex justify-between items-center px-4 py-1 bg-black/30 text-xs text-zinc-400">
                <span>{language || 'code'}</span>
                <button onClick={handleCopy} className="flex items-center gap-1.5 text-zinc-400 hover:text-white transition-colors disabled:opacity-50" disabled={isCopied}>
                    {isCopied ? (<><CheckIcon />Copied!</>) : (<><ClipboardIcon />Copy</>)}
                </button>
            </div>
            <pre className="p-4 overflow-x-auto text-sm text-zinc-200"><code className={`language-${language}`}>{code.trim()}</code></pre>
        </div>
    );
};

const RenderedPart: React.FC<{ part: DisplayMessagePart, onExtendVideo: (videoObject: any) => void }> = ({ part, onExtendVideo }) => {
    if (part.image) {
        return (
            <div className="relative group w-fit">
                <img src={part.image.data} alt="Image content" className="rounded-lg max-w-full sm:max-w-md md:max-w-lg max-h-[50vh] object-contain border-2 border-zinc-700" />
                <a href={part.image.data} download={`cortex-image-${Date.now()}.png`} className="absolute bottom-2 right-2 p-2 bg-black/60 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-blue-600" aria-label="Download image"><DownloadIcon /></a>
            </div>
        );
    }
    if (part.video) {
         return (
            <div className="relative group w-fit">
                <video src={part.video.src} controls className="rounded-lg max-w-full sm:max-w-md md:max-w-lg max-h-[50vh] object-contain border-2 border-zinc-700" />
                <div className="absolute bottom-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    {part.video.videoObject && (
                        <button onClick={() => onExtendVideo(part.video.videoObject)} className="p-2 bg-black/60 rounded-full text-white hover:bg-blue-600" aria-label="Extend video"><VideoIcon /></button>
                    )}
                    <a href={part.video.src} download={`cortex-video-${Date.now()}.mp4`} className="p-2 bg-black/60 rounded-full text-white hover:bg-blue-600" aria-label="Download video"><DownloadIcon /></a>
                </div>
            </div>
        );
    }
    if (part.file) {
        return ( <div className="bg-zinc-700/50 p-3 rounded-lg border border-zinc-700"><p className="text-sm font-medium text-zinc-300">Attached File:</p><p className="text-xs text-zinc-400 truncate">{part.file.name} ({part.file.type})</p></div> )
    }
    return null;
}

const Message: React.FC<MessageProps> = ({ message, userAvatar, onPlayAudio, currentlyPlayingId, onDownloadZip, onExtendVideo, onBuyPlanClick }) => {
    const { role, displayParts, isError, isGenerating, isCreditError, generationProgress, timestamp, functionCall, groundingSources } = message;
    const isModel = role === 'model';
    const isPlaying = currentlyPlayingId === timestamp;

    const fullText = useMemo(() => displayParts.map(p => p.text || '').join(''), [displayParts]);

    const renderedContent = useMemo(() => {
        if (isModel && isCreditError) {
            return (
               <div className="flex flex-col gap-2">
                   <p className="font-semibold text-red-400">API Limit Reached</p>
                   <p className="text-zinc-300">The app's shared API key has reached its daily limit. Please upgrade to continue using your own key.</p>
                   <button onClick={onBuyPlanClick} className="inline-flex items-center gap-2 px-3 py-1.5 mt-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors self-start text-sm"><CreditCardIcon /> Upgrade Plan</button>
               </div>
           );
        }

        const hasNonTextParts = displayParts.some(p => !p.text);
        const hasImagePart = displayParts.some(p => p.image);
        const hasVideoPart = displayParts.some(p => p.video);

        if (isModel && isGenerating) {
            const isImageGeneration = hasImagePart && !hasVideoPart;
            return (
                <div className="flex flex-col gap-4">
                    {displayParts.map((part, index) => <RenderedPart key={index} part={part} onExtendVideo={onExtendVideo}/>)}
                    {isImageGeneration
                        ? <ImageGenerationLoader prompt={fullText} />
                        : <VideoGenerationLoader prompt={fullText} progress={generationProgress || ''} />
                    }
                </div>
            );
        }

        if (isModel && !fullText && !hasNonTextParts && !functionCall) {
            return ( <div className="flex items-center space-x-2"><div className="h-2 w-2 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div><div className="h-2 w-2 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div><div className="h-2 w-2 bg-blue-500 rounded-full animate-bounce"></div></div> )
        }
        
        const textChunks = fullText.split(/(```[\w\s]*\n[\s\S]*?\n```)/g);
        const renderedText = textChunks.map((chunk, index) => {
            if (chunk.startsWith('```')) {
                const lines = chunk.split('\n');
                const language = lines[0].replace('```', '').trim();
                const code = lines.slice(1, -1).join('\n');
                return <CodeBlock key={index} code={code} language={language} />;
            } else if (chunk.trim()) {
                const boldedChunk = chunk.replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold">$1</strong>');
                return (<p key={index} className="whitespace-pre-wrap leading-relaxed" dangerouslySetInnerHTML={{ __html: boldedChunk }} />);
            }
            return null;
        }).filter(Boolean);

        return (
            <div className="flex flex-col gap-3">
                {displayParts.map((part, index) => <RenderedPart key={index} part={part} onExtendVideo={onExtendVideo}/>)}
                {renderedText}
                {functionCall?.name === 'create_zip_file' && ( <button onClick={() => onDownloadZip(functionCall)} className="inline-flex items-center gap-2 px-4 py-2 mt-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors self-start"><ZipIcon />Download {(functionCall.args as any).filename || '.zip file'}</button> )}
                {groundingSources && groundingSources.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-zinc-700/50">
                        <h4 className="text-xs font-semibold text-zinc-400 mb-1.5">Sources:</h4>
                        <div className="flex flex-wrap gap-2">
                            {groundingSources.filter(source => source.web).map((source, index) => (
                                <a key={index} href={source.web?.uri} target="_blank" rel="noopener noreferrer" className="text-xs bg-zinc-700 text-zinc-300 px-2 py-0.5 rounded-full hover:bg-zinc-600 hover:text-white transition-colors truncate" title={source.web?.title}>
                                   {index + 1}. {source.web?.title || (source.web?.uri && new URL(source.web.uri).hostname)}
                                </a>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        );
    }, [displayParts, isModel, isGenerating, isCreditError, fullText, functionCall, groundingSources, onDownloadZip, generationProgress, onExtendVideo, onBuyPlanClick]);

    const icon = isModel ? (<div className="w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-sky-500 self-start text-white"><CortexIcon /></div>) : userAvatar ? (<img src={userAvatar} alt="User Avatar" className="w-8 h-8 flex-shrink-0 rounded-full object-cover self-start" />) : (<div className="w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-full bg-zinc-600 self-start"><UserIcon /></div>);
    const messageBubbleClasses = isModel ? 'bg-zinc-800 text-zinc-200' : 'bg-blue-600/25 text-zinc-100';
    const layoutClasses = isModel ? 'flex-row' : 'flex-row-reverse';

    return (
        <div className={`flex items-start gap-4 w-full ${layoutClasses} ${isError && !isCreditError ? 'text-red-400' : ''}`}>
            {icon}
            <div className={`flex-1 pt-0.5 rounded-xl px-4 py-3 ${messageBubbleClasses}`}>{renderedContent}</div>
            {isModel && fullText && !isGenerating && !isError && (<button onClick={() => onPlayAudio(fullText, timestamp)} className="p-2 self-center text-zinc-400 hover:bg-zinc-700 rounded-full transition-colors" aria-label={isPlaying ? 'Stop audio' : 'Play audio'}>{isPlaying ? <StopIcon /> : <PlayIcon />}</button>)}
        </div>
    );
};

export default Message;