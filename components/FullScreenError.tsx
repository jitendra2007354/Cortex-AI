import React from 'react';
import { WarningIcon } from './Icons';

export const FullScreenError: React.FC<{ message: string }> = ({ message }) => (
    <div className="flex flex-col items-center justify-center h-screen bg-zinc-950 text-zinc-100 p-4">
        <WarningIcon />
        <h1 className="text-2xl font-bold mt-4">Configuration Error</h1>
        <p className="mt-2 text-zinc-400 max-w-md text-center">{message}</p>
        <p className="mt-4 text-xs text-zinc-500">Please refer to the setup instructions to configure your API key.</p>
    </div>
);
