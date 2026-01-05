/**
 * useStudioDocument Hook Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useStudioDocument } from '@/components/Studio/hooks/useStudioDocument';
import { Api } from '@/services/api';
import { toast } from 'react-hot-toast';

// Mock API
vi.mock('@/services/api', () => ({
    Api: {
        get: vi.fn(),
        post: vi.fn(),
        put: vi.fn(),
        delete: vi.fn()
    }
}));

// Mock toast
vi.mock('react-hot-toast', () => ({
    toast: {
        success: vi.fn(),
        error: vi.fn()
    }
}));

// Mock React Flow hooks
vi.mock('reactflow', () => ({
    useNodesState: () => [[], vi.fn(), vi.fn()],
    useEdgesState: () => [[], vi.fn(), vi.fn()],
    addEdge: (edge: any) => edge
}));

describe('useStudioDocument', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should initialize with empty state', () => {
        const { result } = renderHook(() => useStudioDocument({}));

        expect(result.current.document).toBeNull();
        expect(result.current.nodes).toEqual([]);
        expect(result.current.edges).toEqual([]);
        expect(result.current.loading).toBe(false);
    });

    it('should load document when documentId provided', async () => {
        const mockDoc = {
            id: 'doc-1',
            name: 'Test Doc',
            nodes: [{ id: 'n1' }],
            edges: [{ id: 'e1' }]
        };

        vi.mocked(Api.get).mockResolvedValue({ data: mockDoc });

        const { result } = renderHook(() => useStudioDocument({ documentId: 'doc-1' }));

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        expect(Api.get).toHaveBeenCalledWith('/api/studio/documents/doc-1');
    });

    it('should create document', async () => {
        const mockDoc = {
            id: 'doc-1',
            name: 'New Doc',
            nodes: [],
            edges: []
        };

        vi.mocked(Api.post).mockResolvedValue({ data: mockDoc });

        const { result } = renderHook(() => useStudioDocument({}));

        await act(async () => {
            await result.current.createDocument({ name: 'New Doc', type: 'process_flow' });
        });

        expect(Api.post).toHaveBeenCalledWith('/api/studio/documents', expect.objectContaining({
            name: 'New Doc',
            type: 'process_flow'
        }));
    });

    it('should save document', async () => {
        const mockDoc = { id: 'doc-1', name: 'Test', nodes: [], edges: [] };
        vi.mocked(Api.get).mockResolvedValue({ data: mockDoc });
        vi.mocked(Api.put).mockResolvedValue({ data: mockDoc });

        const { result } = renderHook(() => useStudioDocument({ documentId: 'doc-1' }));

        await waitFor(() => {
            expect(result.current.document).toBeTruthy();
        }, { timeout: 3000 });

        await act(async () => {
            await result.current.saveDocument();
        });

        expect(Api.put).toHaveBeenCalled();
    }, { timeout: 5000 });

    it('should update metadata', async () => {
        const mockDoc = { id: 'doc-1', name: 'Test', nodes: [], edges: [] };
        vi.mocked(Api.get).mockResolvedValue({ data: mockDoc });
        vi.mocked(Api.put).mockResolvedValue({ data: { ...mockDoc, name: 'Updated' } });

        const { result } = renderHook(() => useStudioDocument({ documentId: 'doc-1' }));

        await waitFor(() => {
            expect(result.current.document).toBeTruthy();
        }, { timeout: 3000 });

        await act(async () => {
            await result.current.updateMetadata({ name: 'Updated' });
        });

        expect(Api.put).toHaveBeenCalledWith('/api/studio/documents/doc-1', { name: 'Updated' });
    }, { timeout: 5000 });

    it('should handle connection', async () => {
        const { result } = renderHook(() => useStudioDocument({}));

        await act(() => {
            result.current.onConnect({
                source: 'node-1',
                target: 'node-2'
            } as any);
        });

        expect(result.current.hasUnsavedChanges).toBe(true);
    });

    it('should auto-save after delay', async () => {
        vi.useFakeTimers();
        
        const mockDoc = { id: 'doc-1', name: 'Test', nodes: [], edges: [] };
        vi.mocked(Api.get).mockResolvedValue({ data: mockDoc });
        vi.mocked(Api.put).mockResolvedValue({ data: mockDoc });

        const { result } = renderHook(() => 
            useStudioDocument({ documentId: 'doc-1', autoSave: true, autoSaveDelay: 1000 })
        );

        await waitFor(() => {
            expect(result.current.document).toBeTruthy();
        });

        // Trigger change
        await act(() => {
            result.current.setNodes([{ id: 'n1' }] as any);
        });

        // Fast-forward time
        act(() => {
            vi.advanceTimersByTime(1000);
        });

        await waitFor(() => {
            expect(Api.put).toHaveBeenCalled();
        });

        vi.useRealTimers();
    });
});

