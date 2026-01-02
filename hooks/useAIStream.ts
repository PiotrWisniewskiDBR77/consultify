import { useCallback, useRef, useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { useArtifactsStore, parseArtifactsFromResponse } from '../store/useArtifactsStore';
import { Api } from '../services/api';
import { ThinkingStep, Artifact, FocusMode } from '../types';

// ==================== THINKING EXTRACTION UTILITIES ====================

/**
 * Categorize a thinking step based on its content
 */
function categorizeThinkingStep(stepContent: string): ThinkingStep['category'] {
    const lower = stepContent.toLowerCase();

    if (lower.includes('analyz') || lower.includes('examin') || lower.includes('assess')) {
        return 'analysis';
    }
    if (lower.includes('search') || lower.includes('look') || lower.includes('find') || lower.includes('research')) {
        return 'research';
    }
    if (lower.includes('combin') || lower.includes('integrat') || lower.includes('synthesiz') || lower.includes('creat')) {
        return 'synthesis';
    }
    if (lower.includes('verify') || lower.includes('check') || lower.includes('valid') || lower.includes('confirm')) {
        return 'validation';
    }

    return 'analysis'; // Default
}

/**
 * Extract thinking steps from AI response content
 */
function extractThinkingSteps(content: string): { cleanContent: string; thinkingSteps: ThinkingStep[] } {
    if (!content) return { cleanContent: '', thinkingSteps: [] };

    const thinkingSteps: ThinkingStep[] = [];
    let stepId = 1;

    // Pattern for <thinking>...</thinking> blocks
    const thinkingPattern = /<thinking>([\s\S]*?)<\/thinking>/gi;

    let match;
    while ((match = thinkingPattern.exec(content)) !== null) {
        const thinkingContent = match[1].trim();

        // Split into individual steps if numbered or bulleted
        const stepLines = thinkingContent.split(/\n(?=\d+\.|[-*•])/);

        stepLines.forEach((line) => {
            const cleanLine = line.replace(/^\d+\.\s*|^[-*•]\s*/, '').trim();
            if (cleanLine) {
                thinkingSteps.push({
                    id: `think-${stepId++}`,
                    label: `Step ${thinkingSteps.length + 1}`,
                    content: cleanLine,
                    status: 'done',
                    timestamp: new Date(),
                    category: categorizeThinkingStep(cleanLine)
                });
            }
        });
    }

    // Remove thinking blocks from content
    const cleanContent = content.replace(thinkingPattern, '').trim();

    return { cleanContent, thinkingSteps };
}

// ==================== INTERFACES ====================

interface UseAIStreamOptions {
    onStreamDone?: (fullText: string, thinkingSteps?: ThinkingStep[], artifacts?: Artifact[]) => void;
    onStreamError?: (error: any) => void;
    onThinkingUpdate?: (steps: ThinkingStep[]) => void;
    onArtifactDetected?: (artifact: Artifact) => void;
}

interface StreamState {
    isStreaming: boolean;
    streamedContent: string;
    thinkingSteps: ThinkingStep[];
    artifacts: Artifact[];
    progress: number; // 0-100 for UI progress indicator
}

// ==================== HOOK ====================

export const useAIStream = (options: UseAIStreamOptions = {}) => {
    const {
        updateLastChatMessage,
        setIsBotTyping,
        setCurrentStreamContent,
        currentStreamContent,
        isBotTyping
    } = useAppStore();

    const { addArtifact } = useArtifactsStore();

    // Enhanced state tracking
    const [thinkingSteps, setThinkingSteps] = useState<ThinkingStep[]>([]);
    const [streamArtifacts, setStreamArtifacts] = useState<Artifact[]>([]);
    const [streamProgress, setStreamProgress] = useState(0);

    // Refs for accumulation to avoid stale closures
    const contentRef = useRef('');
    const thinkingRef = useRef<ThinkingStep[]>([]);
    const artifactsRef = useRef<Artifact[]>([]);

    // Get current language
    const currentLanguage = localStorage.getItem('i18nextLng') || 'pl';

    /**
     * Process incoming chunk for thinking steps and artifacts
     */
    const processChunk = useCallback((chunk: string): string => {
        // Check for thinking block markers
        const fullContent = contentRef.current + chunk;

        // Try to extract thinking steps from accumulated content
        const { cleanContent, thinkingSteps: extractedSteps } = extractThinkingSteps(fullContent);

        if (extractedSteps.length > thinkingRef.current.length) {
            thinkingRef.current = extractedSteps;
            setThinkingSteps(extractedSteps);
            if (options.onThinkingUpdate) {
                options.onThinkingUpdate(extractedSteps);
            }
        }

        // Check for artifact markers
        const newArtifacts = parseArtifactsFromResponse(fullContent);
        if (newArtifacts.length > artifactsRef.current.length) {
            const addedArtifacts = newArtifacts.slice(artifactsRef.current.length);
            artifactsRef.current = newArtifacts;
            setStreamArtifacts(newArtifacts);

            // Notify about new artifacts
            addedArtifacts.forEach(artifact => {
                addArtifact(artifact);
                if (options.onArtifactDetected) {
                    options.onArtifactDetected(artifact);
                }
            });
        }

        // Return the chunk (possibly cleaned of thinking markers for display)
        return chunk;
    }, [options, addArtifact]);

    /**
     * Process thinking event from backend
     */
    const processThought = useCallback((thought: any) => {
        const step: ThinkingStep = {
            id: thought.id || `think-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            label: thought.detail || capitalize(thought.stage),
            content: thought.detail,
            status: 'done',
            timestamp: new Date(thought.timestamp),
            category: thought.stage || 'analysis'
        };

        thinkingRef.current = [...thinkingRef.current, step];
        setThinkingSteps(thinkingRef.current);
        if (options.onThinkingUpdate) {
            options.onThinkingUpdate(thinkingRef.current);
        }
    }, [options]);

    function capitalize(s: string) {
        return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
    }

    /**
     * Start streaming with enhanced features
     */
    const startStream = useCallback(async (
        userMessage: string,
        history: any[],
        systemPrompt?: string,
        context?: any,
        focusMode?: FocusMode,
        overrideOptions?: any
    ) => {
        // Merge hook options with override options
        const effectiveOptions = { ...options, ...overrideOptions };

        // Reset state
        setIsBotTyping(true);
        setCurrentStreamContent('');
        setThinkingSteps([]);
        setStreamArtifacts([]);
        setStreamProgress(0);
        contentRef.current = '';
        thinkingRef.current = [];
        artifactsRef.current = [];

        try {
            await Api.chatWithAIStream(
                userMessage,
                history,
                (chunk) => {
                    // Process chunk for structured content
                    processChunk(chunk);

                    // Accumulate raw content
                    contentRef.current += chunk;
                    setCurrentStreamContent(contentRef.current);

                    // Update progress estimate
                    const estimatedTotal = 2000;
                    const progress = Math.min(95, (contentRef.current.length / estimatedTotal) * 100);
                    setStreamProgress(progress);
                },
                () => {
                    setIsBotTyping(false);
                    setStreamProgress(100);

                    // Final extraction
                    const { cleanContent, thinkingSteps: finalThinking } = extractThinkingSteps(contentRef.current);
                    const finalArtifacts = parseArtifactsFromResponse(contentRef.current);

                    // Update store
                    updateLastChatMessage(cleanContent || contentRef.current);

                    // Callback
                    if (effectiveOptions.onStreamDone) {
                        effectiveOptions.onStreamDone(
                            cleanContent || contentRef.current,
                            // Merge backend steps with extracted text steps if needed
                            [...thinkingRef.current, ...finalThinking],
                            finalArtifacts.length > 0 ? finalArtifacts : undefined
                        );
                    }

                    setCurrentStreamContent('');
                },
                systemPrompt,
                { ...context, focusMode },
                undefined,
                currentLanguage,
                // Pass the thinking handler
                processThought,
                overrideOptions // Pass options to API
            );
        } catch (error) {
            console.error('AI Stream Error:', error);
            setIsBotTyping(false);
            setStreamProgress(0);

            if (effectiveOptions.onStreamError) effectiveOptions.onStreamError(error);

            if (!contentRef.current) {
                updateLastChatMessage('Sorry, I encountered an error. Please try again.');
            }
            setCurrentStreamContent('');
        }
    }, [
        updateLastChatMessage,
        setIsBotTyping,
        setCurrentStreamContent,
        processChunk,
        processThought,
        options,
        currentLanguage
    ]);

    /**
     * Abort current stream (if supported)
     */
    const abortStream = useCallback(() => {
        // TODO: Implement abort controller for streaming
        setIsBotTyping(false);
        setCurrentStreamContent('');
        setStreamProgress(0);
    }, [setIsBotTyping, setCurrentStreamContent]);

    return {
        // Basic state
        isStreaming: isBotTyping,
        streamedContent: currentStreamContent,

        // Enhanced state (World-Class Chat 2025)
        thinkingSteps,
        artifacts: streamArtifacts,
        progress: streamProgress,

        // Actions
        startStream,
        abortStream
    };
};
