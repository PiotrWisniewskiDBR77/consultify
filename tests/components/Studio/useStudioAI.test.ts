/**
 * useStudioAI Hook Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useStudioAI } from '../../../components/Studio/hooks/useStudioAI';
import { Api } from '../../../services/api';

// Mock API
vi.mock('../../../services/api', () => ({
    Api: {
        post: vi.fn()
    }
}));

describe('useStudioAI', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should initialize with empty state', () => {
        const { result } = renderHook(() => useStudioAI({}));

        expect(result.current.messages).toEqual([]);
        expect(result.current.isProcessing).toBe(false);
        expect(result.current.currentIntent).toBeNull();
    });

    it('should generate diagram', async () => {
        const mockResult = {
            nodes: [{ id: 'n1' }],
            edges: [{ id: 'e1' }],
            diagramType: 'process_flow',
            tokensUsed: 100
        };

        vi.mocked(Api.post).mockResolvedValue({ data: mockResult });

        const onDiagramUpdate = vi.fn();
        const { result } = renderHook(() => 
            useStudioAI({ onDiagramUpdate })
        );

        await act(async () => {
            await result.current.generateDiagram('Create a process flow', 'process_flow');
        });

        expect(Api.post).toHaveBeenCalledWith('/api/studio/ai/generate', {
            prompt: 'Create a process flow',
            diagramType: 'process_flow'
        });

        expect(onDiagramUpdate).toHaveBeenCalledWith(
            mockResult.nodes,
            mockResult.edges,
            'replace'
        );
    });

    it('should modify diagram', async () => {
        const mockResult = {
            nodes: [{ id: 'n1' }, { id: 'n2' }],
            edges: [{ id: 'e1' }],
            changes: { added: ['n2'] },
            tokensUsed: 50
        };

        vi.mocked(Api.post).mockResolvedValue({ data: mockResult });

        const onDiagramUpdate = vi.fn();
        const { result } = renderHook(() => 
            useStudioAI({ onDiagramUpdate })
        );

        await act(async () => {
            await result.current.modifyDiagram(
                'Add a node',
                [{ id: 'n1' }],
                []
            );
        });

        expect(Api.post).toHaveBeenCalledWith('/api/studio/ai/modify', {
            prompt: 'Add a node',
            nodes: [{ id: 'n1' }],
            edges: []
        });

        expect(onDiagramUpdate).toHaveBeenCalledWith(
            mockResult.nodes,
            mockResult.edges,
            'update'
        );
    });

    it('should send chat message', async () => {
        const mockResponse = {
            text: 'I created the diagram',
            intent: 'CREATE_DIAGRAM',
            confidence: 0.9,
            diagramUpdate: {
                action: 'replace',
                nodes: [{ id: 'n1' }],
                edges: []
            }
        };

        vi.mocked(Api.post).mockResolvedValue({ data: mockResponse });

        const onDiagramUpdate = vi.fn();
        const { result } = renderHook(() => 
            useStudioAI({ documentId: 'doc-1', onDiagramUpdate })
        );

        await act(async () => {
            await result.current.sendMessage('Create a flow', {
                nodes: [],
                edges: []
            });
        });

        expect(Api.post).toHaveBeenCalledWith('/api/studio/ai/chat', {
            message: 'Create a flow',
            documentId: 'doc-1',
            context: { nodes: [], edges: [] }
        });

        expect(result.current.messages).toHaveLength(2); // user + assistant
        expect(result.current.messages[0].role).toBe('user');
        expect(result.current.messages[1].role).toBe('assistant');
        expect(result.current.messages[1].content).toBe('I created the diagram');
    });

    it('should get suggestions', async () => {
        const mockSuggestions = [
            { type: 'warning', message: 'Disconnected node', nodeIds: ['n1'] }
        ];

        vi.mocked(Api.post).mockResolvedValue({ data: { suggestions: mockSuggestions } });

        const { result } = renderHook(() => useStudioAI({}));

        const suggestions = await act(async () => {
            return await result.current.getSuggestions(
                [{ id: 'n1' }],
                [],
                'process_flow'
            );
        });

        expect(Api.post).toHaveBeenCalledWith('/api/studio/ai/suggest', {
            nodes: [{ id: 'n1' }],
            edges: [],
            diagramType: 'process_flow'
        });

        expect(suggestions).toEqual(mockSuggestions);
    });

    it('should classify intent', async () => {
        vi.mocked(Api.post).mockResolvedValue({ 
            data: { intent: 'CREATE_DIAGRAM', confidence: 0.9 }
        });

        const { result } = renderHook(() => useStudioAI({}));

        const classification = await act(async () => {
            return await result.current.classifyIntent('Create a process flow');
        });

        expect(Api.post).toHaveBeenCalledWith('/api/studio/ai/classify', {
            message: 'Create a process flow'
        });

        expect(classification.intent).toBe('CREATE_DIAGRAM');
        expect(classification.confidence).toBe(0.9);
    });

    it('should clear messages', () => {
        const { result } = renderHook(() => useStudioAI({}));

        act(() => {
            result.current.addSystemMessage('Test message');
        });

        expect(result.current.messages.length).toBeGreaterThan(0);

        act(() => {
            result.current.clearMessages();
        });

        expect(result.current.messages).toEqual([]);
    });

    it('should handle errors gracefully', async () => {
        vi.mocked(Api.post).mockRejectedValue(new Error('API Error'));

        const onDiagramUpdate = vi.fn();
        const { result } = renderHook(() => useStudioAI({ onDiagramUpdate }));

        await act(async () => {
            try {
                await result.current.generateDiagram('Test', 'process_flow');
            } catch (e) {
                // Expected - error is thrown
                expect(e).toBeDefined();
            }
        });

        // Error should be thrown, not added to messages
        // The error handling is done at the component level
        expect(result.current.messages.length).toBe(0);
    });
});

