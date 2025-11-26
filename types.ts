import { type Chat, Part, FunctionCall, GroundingChunk } from "@google/genai";

export interface DisplayMessagePart {
  text?: string;
  image?: {
    data: string; // data URL for display, can be static image or animated GIF
    mimeType: string;
  };
  file?: {
    name: string;
    type: string;
  };
  video?: {
    src: string; // Object URL for the video blob
    videoObject?: any; // The raw video object from the API for extensions
  }
}

export interface DisplayMessage {
  role: 'user' | 'model';
  parts: Part[]; // Storing the API-compatible parts
  displayParts: DisplayMessagePart[]; // Storing the UI-compatible parts
  timestamp: number; // for unique key
  isError?: boolean;
  isGenerating?: boolean;
  isCreditError?: boolean;
  generationProgress?: string; // For video generation steps
  functionCall?: FunctionCall;
  groundingSources?: GroundingChunk[];
}

export type GeminiChatSession = Chat;

export interface User {
  id: string;
  email: string;
  password?: string; // Stored plaintext for simplicity, should be hashed in production.
  username: string;
  avatar: string | null;
  isGoogleUser?: boolean;
}

export interface StoredChatSession {
    id: string;
    title: string;
    messages: DisplayMessage[];
    createdAt: number;
    userId: string;
}