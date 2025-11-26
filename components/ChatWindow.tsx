import React from 'react';
import { type FunctionCall } from '@google/genai';
import { type DisplayMessage } from '../types';
import Message from './Message';

interface ChatWindowProps {
    history: DisplayMessage[];
    userAvatar: string | null;
    onPlayAudio: (text: string, messageId: number) => void;
    currentlyPlayingId: number | null;
    onDownloadZip: (functionCall: FunctionCall) => void;
    onExtendVideo: (videoObject: any) => void;
    onBuyPlanClick: () => void;
}

const ChatWindow: React.FC<ChatWindowProps> = ({ history, userAvatar, onPlayAudio, currentlyPlayingId, onDownloadZip, onExtendVideo, onBuyPlanClick }) => {
    return (
        <div className="max-w-4xl mx-auto p-4 sm:p-6 md:p-8 space-y-6 md:space-y-8">
            {history.map((msg) => (
                <Message 
                    key={msg.timestamp} 
                    message={msg} 
                    userAvatar={userAvatar}
                    onPlayAudio={onPlayAudio}
                    currentlyPlayingId={currentlyPlayingId}
                    onDownloadZip={onDownloadZip}
                    onExtendVideo={onExtendVideo}
                    onBuyPlanClick={onBuyPlanClick}
                />
            ))}
        </div>
    );
};

export default ChatWindow;