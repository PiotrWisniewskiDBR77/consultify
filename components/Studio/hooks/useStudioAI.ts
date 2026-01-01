/**
 * useStudioAI - Hook for AI-powered diagram generation
 */

import { useState, useCallback } from 'react';
import { Node, Edge } from 'reactflow';
import { Api } from '../../../services/api';
import { toast } from 'react-hot-toast';

export interface AIMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    diagramUpdate?: {
        action: 'replace' | 'update';
        nodes: Node[];
        edges: Edge[];
        changes?: {
            added?: string[];
            modified?: string[];
            removed?: string[];
        };
    };
}

interface UseStudioAIOptions {
    documentId?: string | null;
    onDiagramUpdate?: (nodes: Node[], edges: Edge[], action: 'replace' | 'update') => void;
}

export const useStudioAI = (options: UseStudioAIOptions = {}) => {
    const { documentId, onDiagramUpdate } = options;

    const [messages, setMessages] = useState<AIMessage[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [currentIntent, setCurrentIntent] = useState<string | null>(null);

    // Generate diagram from text
    const generateDiagram = useCallback(async (prompt: string, diagramType = 'process_flow') => {
        setIsProcessing(true);
        try {
            const response = await Api.post('/api/studio/ai/generate', {
                prompt,
                diagramType
            });

            const result = response.data || response;
            
            if (result.nodes) {
                onDiagramUpdate?.(result.nodes, result.edges || [], 'replace');
                return result;
            }
            
            throw new Error('Invalid response from AI');
        } catch (error: any) {
            console.error('[StudioAI] Generation error:', error);
            toast.error('Failed to generate diagram');
            throw error;
        } finally {
            setIsProcessing(false);
        }
    }, [onDiagramUpdate]);

    // Modify existing diagram
    const modifyDiagram = useCallback(async (
        prompt: string, 
        currentNodes: Node[], 
        currentEdges: Edge[]
    ) => {
        setIsProcessing(true);
        try {
            const response = await Api.post('/api/studio/ai/modify', {
                prompt,
                nodes: currentNodes,
                edges: currentEdges
            });

            const result = response.data || response;
            
            if (result.nodes) {
                onDiagramUpdate?.(result.nodes, result.edges || [], 'update');
                return result;
            }
            
            throw new Error('Invalid response from AI');
        } catch (error: any) {
            console.error('[StudioAI] Modification error:', error);
            toast.error('Failed to modify diagram');
            throw error;
        } finally {
            setIsProcessing(false);
        }
    }, [onDiagramUpdate]);

    // Send chat message and get response
    const sendMessage = useCallback(async (
        message: string,
        context: { nodes: Node[]; edges: Edge[] }
    ) => {
        // Add user message
        const userMessage: AIMessage = {
            id: `user-${Date.now()}`,
            role: 'user',
            content: message,
            timestamp: new Date()
        };
        setMessages(prev => [...prev, userMessage]);
        setIsProcessing(true);

        try {
            const response = await Api.post('/api/studio/ai/chat', {
                message,
                documentId,
                context
            });

            const result = response.data || response;

            // Add assistant message
            const assistantMessage: AIMessage = {
                id: `assistant-${Date.now()}`,
                role: 'assistant',
                content: result.text || 'Done!',
                timestamp: new Date(),
                diagramUpdate: result.diagramUpdate
            };
            setMessages(prev => [...prev, assistantMessage]);
            setCurrentIntent(result.intent);

            // Apply diagram update if present
            if (result.diagramUpdate?.nodes) {
                onDiagramUpdate?.(
                    result.diagramUpdate.nodes,
                    result.diagramUpdate.edges || [],
                    result.diagramUpdate.action || 'update'
                );
            }

            return result;
        } catch (error: any) {
            console.error('[StudioAI] Chat error:', error);
            
            // Add error message
            const errorMessage: AIMessage = {
                id: `error-${Date.now()}`,
                role: 'assistant',
                content: 'Sorry, I encountered an error processing your request. Please try again.',
                timestamp: new Date()
            };
            setMessages(prev => [...prev, errorMessage]);
            
            throw error;
        } finally {
            setIsProcessing(false);
        }
    }, [documentId, onDiagramUpdate]);

    // Get suggestions for diagram optimization
    const getSuggestions = useCallback(async (
        nodes: Node[],
        edges: Edge[],
        diagramType = 'process_flow'
    ) => {
        try {
            const response = await Api.post('/api/studio/ai/suggest', {
                nodes,
                edges,
                diagramType
            });

            return (response.data || response).suggestions || [];
        } catch (error) {
            console.error('[StudioAI] Suggestions error:', error);
            return [];
        }
    }, []);

    // Classify intent of a message
    const classifyIntent = useCallback(async (message: string) => {
        try {
            const response = await Api.post('/api/studio/ai/classify', { message });
            return response.data || response;
        } catch (error) {
            console.error('[StudioAI] Classification error:', error);
            return { intent: 'unknown', confidence: 0 };
        }
    }, []);

    // Clear chat history
    const clearMessages = useCallback(() => {
        setMessages([]);
        setCurrentIntent(null);
    }, []);

    // Add a system message
    const addSystemMessage = useCallback((content: string) => {
        const message: AIMessage = {
            id: `system-${Date.now()}`,
            role: 'assistant',
            content,
            timestamp: new Date()
        };
        setMessages(prev => [...prev, message]);
    }, []);

    return {
        // State
        messages,
        isProcessing,
        currentIntent,
        
        // Actions
        generateDiagram,
        modifyDiagram,
        sendMessage,
        getSuggestions,
        classifyIntent,
        clearMessages,
        addSystemMessage
    };
};

export default useStudioAI;


