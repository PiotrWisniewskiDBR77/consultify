import { useState, useCallback } from 'react';
import { Api } from '../services/api';

/**
 * Hook for independent AI operations (not tied to global Chat Store).
 * Perfect for "Smart Inputs", "Magic Buttons", etc.
 */
export const useIndependentAI = () => {
    const [isLoading, setIsLoading] = useState(false);
    const [result, setResult] = useState<string | null>(null);

    const callAI = useCallback(async (
        prompt: string,
        systemInstruction?: string,
        context?: any,
        streamCallback?: (chunk: string) => void
    ) => {
        setIsLoading(true);
        setResult(''); // Clear previous
        let fullContent = '';

        try {
            await Api.chatWithAIStream(
                prompt,
                [], // No history for atomic actions
                (chunk) => {
                    fullContent += chunk;
                    if (streamCallback) streamCallback(chunk);
                    setResult(prev => (prev || '') + chunk);
                },
                () => {
                    setIsLoading(false);
                },
                systemInstruction || "You are a helpful assistant.",
                context
            );
            return fullContent;
        } catch (error) {
            console.error("Independent AI Error:", error);
            setIsLoading(false);
            throw error;
        }
    }, []);

    // Specific Action: Refine Text
    const refineText = useCallback(async (text: string, context?: any) => {
        const prompt = `Rewrite the following text to be more professional, concise, and impactful for a business consulting context. Keep the meaning but improve clarity.\n\nText: "${text}"`;
        return callAI(prompt, "You are a Senior Editor.", context);
    }, [callAI]);

    return {
        isLoading,
        result,
        callAI,
        refineText
    };
};
