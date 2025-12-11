import { useCallback, useRef } from 'react';
import { useAppStore } from '../store/useAppStore';
import { Api } from '../services/api';

interface UseAIStreamOptions {
    onStreamDone?: (fullText: string) => void;
    onStreamError?: (error: any) => void;
}

export const useAIStream = (options: UseAIStreamOptions = {}) => {
    const {
        updateLastChatMessage,
        setIsBotTyping,
        setCurrentStreamContent,
        currentStreamContent,
        isBotTyping
    } = useAppStore();

    // We use a ref for accumulation to avoid dependency cycles / stale closures during the stream callback
    const contentRef = useRef('');

    const startStream = useCallback(async (
        userMessage: string,
        history: any[],
        systemPrompt?: string
    ) => {
        setIsBotTyping(true);
        setCurrentStreamContent('');
        contentRef.current = '';

        try {
            await Api.chatWithAIStream(
                userMessage,
                history,
                (chunk) => {
                    contentRef.current += chunk; // Accumulate chunks
                    setCurrentStreamContent(contentRef.current); // Update global store (non-persisted)
                },
                () => {
                    setIsBotTyping(false);
                    // Update global store one last time with full unique content (Persistent)
                    updateLastChatMessage(contentRef.current);
                    if (options.onStreamDone) options.onStreamDone(contentRef.current);
                    setCurrentStreamContent(''); // Clear global buffer since it's now in persistent store
                },
                systemPrompt
            );
        } catch (error) {
            console.error('AI Stream Error:', error);
            setIsBotTyping(false);
            if (options.onStreamError) options.onStreamError(error);
            // Fallback: update store with error message if empty
            if (!contentRef.current) {
                updateLastChatMessage('Sorry, I encountered an error. Please try again.');
            }
            setCurrentStreamContent('');
        }
    }, [updateLastChatMessage, setIsBotTyping, setCurrentStreamContent, options]);

    return {
        isStreaming: isBotTyping, // Map isBotTyping to isStreaming for consumer convenience
        streamedContent: currentStreamContent,
        startStream
    };
};
