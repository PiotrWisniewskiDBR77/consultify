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
        systemPrompt?: string,
        context?: any
    ) => {
        // #region agent log
        console.log('[DEBUG-D] startStream entry:', { msgLength: userMessage?.length || 0, historyLength: history?.length || 0, hasSystemPrompt: !!systemPrompt, hasContext: !!context });
        fetch('http://127.0.0.1:7242/ingest/690b8f02-96fa-4527-ae57-5d2b028e8181',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useAIStream.ts:startStream:entry',message:'Starting stream',data:{msgLength:userMessage?.length||0,historyLength:history?.length||0,hasSystemPrompt:!!systemPrompt,hasContext:!!context},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'D'})}).catch(()=>{});
        // #endregion
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
                    // #region agent log
                    console.log('[DEBUG-A,C] startStream onDone:', { responseLength: contentRef.current?.length || 0 });
                    fetch('http://127.0.0.1:7242/ingest/690b8f02-96fa-4527-ae57-5d2b028e8181',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useAIStream.ts:startStream:onDone',message:'Stream completed',data:{responseLength:contentRef.current?.length||0},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'A,C'})}).catch(()=>{});
                    // #endregion
                    setIsBotTyping(false);
                    // Update global store one last time with full unique content (Persistent)
                    updateLastChatMessage(contentRef.current);
                    if (options.onStreamDone) options.onStreamDone(contentRef.current);
                    setCurrentStreamContent(''); // Clear global buffer since it's now in persistent store
                },
                systemPrompt,
                context
            );
        } catch (error) {
            // #region agent log
            console.log('[DEBUG-A,C] startStream error:', { errorMsg: String(error) });
            fetch('http://127.0.0.1:7242/ingest/690b8f02-96fa-4527-ae57-5d2b028e8181',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useAIStream.ts:startStream:error',message:'Stream error caught',data:{errorMsg:String(error)},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'A,C'})}).catch(()=>{});
            // #endregion
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
