import { useEffect, useRef } from 'react';
import { useAIContext } from '../contexts/AIContext';
import { ScreenContextPayload, AIContextPersona } from '../types/AIContract';

// Global sequence counter
let globalSequenceId = 0;

export const useScreenContext = (
    screenId: string,
    title: string,
    data: any,
    description?: string,
    persona: AIContextPersona = 'consultant'
) => {
    const { setScreenContext } = useAIContext();
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        // Debounce updates to avoid jitter
        if (timeoutRef.current) clearTimeout(timeoutRef.current);

        timeoutRef.current = setTimeout(() => {
            globalSequenceId++;

            const payload: ScreenContextPayload = {
                version: '1.0',
                screenId,
                timestamp: Date.now(),
                sequenceId: globalSequenceId,
                persona,
                data: {
                    ...data,
                    _meta: { title, description }
                },
                intent: description
            };

            setScreenContext(payload);
        }, 300);

        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            // We consciously DO NOT clear context on unmount here to prevent flashing.
            // The next screen will overwrite it.
        };
    }, [screenId, title, JSON.stringify(data), description, persona, setScreenContext]);
};
