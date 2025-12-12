import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import { useAppStore } from '../store/useAppStore';
import {
    ScreenContextPayload,
    validateScreenContext,
    ScreenContextSchema
} from '../types/AIContract';

interface AIContextProps {
    isChatOpen: boolean;
    toggleChat: () => void;
    openChat: (initialMessage?: string) => void;
    // screenContext is now strictly typed
    screenContext: ScreenContextPayload | null;
    setScreenContext: (ctx: unknown) => void;
    globalContext: any;
}

const AIContext = createContext<AIContextProps | undefined>(undefined);

export const AIProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const {
        currentUser
    } = useAppStore();

    // Local state for chat visibility
    const [isChatOpen, setIsChatOpen] = useState(false);

    // Strict Screen Context State
    const [screenContext, _setScreenContext] = useState<ScreenContextPayload | null>(null);

    // Robust setter with validation
    const setScreenContext = useCallback((rawContext: unknown) => {
        // If null/undefined passed, clear context
        if (!rawContext) {
            _setScreenContext(null);
            return;
        }

        // Validate against contract
        const validContext = validateScreenContext(rawContext);
        if (validContext) {
            _setScreenContext(validContext);
        } else {
            console.warn("[AIContext] Invalid context payload rejected", rawContext);
        }
    }, []);

    const toggleChat = () => setIsChatOpen(prev => !prev);

    const openChat = (initialMessage?: string) => {
        setIsChatOpen(true);
        if (initialMessage) {
            console.log("Open with message:", initialMessage);
        }
    };

    const globalContext = {
        user: currentUser,
        company: currentUser ? { name: currentUser.companyName } : null
    };

    return (
        <AIContext.Provider value={{
            isChatOpen,
            toggleChat,
            openChat,
            screenContext,
            setScreenContext,
            globalContext
        }}>
            {children}
        </AIContext.Provider>
    );
};

export const useAIContext = () => {
    const context = useContext(AIContext);
    if (!context) {
        throw new Error('useAIContext must be used within an AIProvider');
    }
    return context;
};
