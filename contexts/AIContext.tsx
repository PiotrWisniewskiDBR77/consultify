import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAppStore } from '../store/useAppStore';
import { User, CompanyProfile } from '../types';

export interface ScreenContextData {
    screenId: string;
    title: string;
    data: any; // JSON summary of what's on screen
    description?: string;
}

interface AIContextType {
    isChatOpen: boolean;
    toggleChat: () => void;
    openChat: (initialMessage?: string) => void;
    screenContext: ScreenContextData | null;
    setScreenContext: (ctx: ScreenContextData) => void;
    globalContext: {
        user: User | null;
        companyProfile: Partial<CompanyProfile> | null;
    };
}

const AIContext = createContext<AIContextType | undefined>(undefined);

export const AIProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { currentUser, freeSessionData } = useAppStore();
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [screenContext, setScreenContext] = useState<ScreenContextData | null>(null);

    // Global Context derived from AppStore
    const globalContext = {
        user: currentUser,
        // Construct a profile summary depending on what we have (FreeSession or full)
        companyProfile: {
            name: currentUser?.companyName,
            // Add more specific mapping if needed
        }
    };

    const toggleChat = () => setIsChatOpen(prev => !prev);
    const openChat = (initialMessage?: string) => {
        setIsChatOpen(true);
        // If we implement pre-filled message logic later
        if (initialMessage) {
            console.log("Open with message:", initialMessage);
        }
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
