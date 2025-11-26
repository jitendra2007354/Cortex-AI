import { useState, useEffect, useCallback, type SetStateAction } from 'react';
import { type DisplayMessage, type StoredChatSession, type GeminiChatSession, type User } from '../types';
import { createChatSession, CREATE_ZIP_FUNCTION } from '../services/geminiService';
import { type Part, type Content } from '@google/genai';

const WELCOME_MESSAGE: DisplayMessage = {
    role: 'model',
    parts: [{ text: "Hello! I'm Cortex, your AI assistant. You can ask me anything or switch to Image mode to generate pictures." }],
    displayParts: [{ text: "Hello! I'm Cortex, your AI assistant. You can ask me anything or switch to Image mode to generate pictures." }],
    timestamp: Date.now(),
};

const CHAT_HISTORY_KEY = 'cortex-chat-history';
const MAX_TITLE_LENGTH = 35;

// Helper to generate a title from the first user message
const generateTitle = (messages: DisplayMessage[]): string => {
    const firstUserMessage = messages.find(m => m.role === 'user');
    const firstText = firstUserMessage?.displayParts.find(p => p.text)?.text || 'New Chat';
    return firstText.length > MAX_TITLE_LENGTH
        ? firstText.substring(0, MAX_TITLE_LENGTH) + '...'
        : firstText;
};

export const useChatHistory = (userId: string, webSearchEnabled: boolean, apiKeyVersion: number) => {
    const [sessions, setSessions] = useState<StoredChatSession[]>([]);
    const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
    const [geminiSession, setGeminiSession] = useState<GeminiChatSession | null>(null);
    const [contextSessionIds, setContextSessionIds] = useState<Set<string>>(new Set());
    
    // Load sessions from localStorage on initial render for the current user
    useEffect(() => {
        try {
            const savedSessions = localStorage.getItem(CHAT_HISTORY_KEY);
            const allSessions: StoredChatSession[] = savedSessions ? JSON.parse(savedSessions) : [];
            const userSessions = allSessions.filter(s => s.userId === userId);
            
            if (userSessions.length > 0) {
                const sortedSessions = [...userSessions].sort((a, b) => b.createdAt - a.createdAt);
                setSessions(sortedSessions);
                setActiveSessionId(sortedSessions[0].id);
            } else {
                // If the user has no chats, start a new one
                const newSessionId = startNewChat(true);
                setActiveSessionId(newSessionId);
            }
        } catch (error) {
            console.error("Failed to load chat history:", error);
            const newSessionId = startNewChat(true);
            setActiveSessionId(newSessionId);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userId]);

    // Save sessions to localStorage whenever they change
    useEffect(() => {
        try {
            const allSavedSessions = localStorage.getItem(CHAT_HISTORY_KEY);
            const allSessions: StoredChatSession[] = allSavedSessions ? JSON.parse(allSavedSessions) : [];
            const otherUserSessions = allSessions.filter(s => s.userId !== userId);
            const updatedAllSessions = [...otherUserSessions, ...sessions];
            localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(updatedAllSessions));
        } catch (error) {
            console.error("Failed to save chat history:", error);
        }
    }, [sessions, userId]);

    const startNewChat = useCallback((isInitial: boolean = false) => {
        const newSession: StoredChatSession = {
            id: Date.now().toString(),
            title: 'New Chat',
            messages: [WELCOME_MESSAGE],
            createdAt: Date.now(),
            userId: userId,
        };
        if (isInitial) {
            // When it's the very first chat for a user, set it directly
            setSessions([newSession]);
        } else {
            setSessions(prev => [newSession, ...prev]);
        }
        setActiveSessionId(newSession.id);
        return newSession.id;
    }, [userId]);

    const recreateGeminiSession = useCallback((targetSessionId: string, allSessions: StoredChatSession[], currentContextIds: Set<string>, isWebSearchEnabled: boolean) => {
        try {
            const contextSessions = allSessions.filter(s => currentContextIds.has(s.id));
            const activeSession = allSessions.find(s => s.id === targetSessionId);

            if (!activeSession) return;

            // FIX: Correctly map DisplayMessage[] to Content[] for the API history.
            // Combine histories, excluding the initial welcome message from the context.
            const contextHistory: Content[] = contextSessions
                .flatMap(s => s.messages.slice(1)) 
                .map(msg => ({ role: msg.role, parts: msg.parts }));

            const activeHistory: Content[] = activeSession.messages
                .slice(1) // Also exclude welcome message from the active session's history for the API
                .map(msg => ({ role: msg.role, parts: msg.parts }));

            const combinedHistory = [...contextHistory, ...activeHistory];
            
            const tools: any[] = [{ functionDeclarations: [CREATE_ZIP_FUNCTION] }];
            if (isWebSearchEnabled) {
                tools.push({ googleSearch: {} });
            }
            setGeminiSession(createChatSession(combinedHistory, tools));
        } catch (error) {
            console.error("Failed to create Gemini session:", error);
            setGeminiSession(null);
        }
    }, []);

    // Effect to recreate the Gemini session whenever context or the active session changes
    useEffect(() => {
        if (activeSessionId && sessions.length > 0) {
            recreateGeminiSession(activeSessionId, sessions, contextSessionIds, webSearchEnabled);
        }
    }, [activeSessionId, contextSessionIds, sessions, recreateGeminiSession, webSearchEnabled, apiKeyVersion]);

    const updateSessionMessages = useCallback((sessionId: string, updater: SetStateAction<DisplayMessage[]>) => {
        setSessions(prevSessions =>
            prevSessions.map(session => {
                if (session.id === sessionId) {
                    const oldMessages = session.messages;
                    const newMessages = typeof updater === 'function' ? updater(oldMessages) : updater;
                    
                    const updatedSession = { ...session, messages: newMessages };
    
                    // Auto-generate title for the first user message, but only if it's a "New Chat".
                    if (newMessages.filter(m => m.role === 'user').length === 1 && session.title === 'New Chat') {
                        updatedSession.title = generateTitle(newMessages);
                    }
    
                    return updatedSession;
                }
                return session;
            })
        );
    }, []);

    const loadChatSession = useCallback((sessionId: string) => {
        if (sessions.find(s => s.id === sessionId)) {
            setActiveSessionId(sessionId);
        }
    }, [sessions]);
    
    const deleteChatSession = useCallback((sessionId: string) => {
        setContextSessionIds(prev => {
            const newSet = new Set(prev);
            newSet.delete(sessionId);
            return newSet;
        });

        setSessions(prevSessions => {
            const newSessions = prevSessions.filter(s => s.id !== sessionId);

            if (sessionId === activeSessionId) {
                if (newSessions.length > 0) {
                    const mostRecent = [...newSessions].sort((a, b) => b.createdAt - a.createdAt)[0];
                    setActiveSessionId(mostRecent.id);
                } else {
                    const newSession: StoredChatSession = {
                        id: Date.now().toString(),
                        title: 'New Chat',
                        messages: [WELCOME_MESSAGE],
                        createdAt: Date.now(),
                        userId: userId,
                    };
                    setActiveSessionId(newSession.id);
                    return [newSession];
                }
            }
            return newSessions;
        });
    }, [activeSessionId, userId]);


    const updateSessionTitle = useCallback((sessionId: string, newTitle: string) => {
        const trimmedTitle = newTitle.trim();
        if (!trimmedTitle) return;
        setSessions(prev =>
            prev.map(s => (s.id === sessionId ? { ...s, title: trimmedTitle } : s))
        );
    }, []);

    const toggleContextSession = useCallback((sessionId: string) => {
        setContextSessionIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(sessionId)) {
                newSet.delete(sessionId);
            } else {
                newSet.add(sessionId);
            }
            return newSet;
        });
    }, []);

    const activeChatHistory = sessions.find(s => s.id === activeSessionId)?.messages || [];

    const setActiveChatHistory = (updater: SetStateAction<DisplayMessage[]>) => {
        if(activeSessionId) {
            updateSessionMessages(activeSessionId, updater);
        }
    };

    return {
        sessions,
        activeSessionId,
        activeChatHistory,
        setActiveChatHistory,
        geminiSession,
        startNewChat,
        loadChatSession,
        deleteChatSession,
        updateSessionTitle,
        contextSessionIds,
        toggleContextSession,
    };
};