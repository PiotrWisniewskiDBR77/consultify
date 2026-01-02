/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useInbox } from '../../hooks/useInbox';
import { Api } from '../../services/api';

// Mock dependencies
vi.mock('../../services/api', () => ({
    Api: {
        get: vi.fn(),
        post: vi.fn()
    }
}));

vi.mock('react-hot-toast', () => ({
    default: {
        success: vi.fn(),
        error: vi.fn()
    }
}));

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, fallback?: string) => fallback || key
    })
}));

const mockInboxItems = [
    {
        id: 'item-1',
        type: 'TASK',
        title: 'Review proposal',
        urgency: 'high',
        triaged: false,
        createdAt: '2024-01-15T10:00:00Z'
    },
    {
        id: 'item-2',
        type: 'DECISION',
        title: 'Approve budget',
        urgency: 'critical',
        triaged: false,
        createdAt: '2024-01-15T09:00:00Z'
    },
    {
        id: 'item-3',
        type: 'NOTIFICATION',
        title: 'Meeting reminder',
        urgency: 'low',
        triaged: true,
        createdAt: '2024-01-15T08:00:00Z'
    }
];

const mockSummary = {
    total: 3,
    untriaged: 2,
    critical: 1,
    byType: {
        TASK: 1,
        DECISION: 1,
        NOTIFICATION: 1
    }
};

describe('useInbox Hook', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (Api.get as any).mockResolvedValue({
            items: mockInboxItems,
            summary: mockSummary
        });
        (Api.post as any).mockResolvedValue({});
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    describe('Initialization', () => {
        it('loads inbox on mount by default', async () => {
            renderHook(() => useInbox());

            await waitFor(() => {
                expect(Api.get).toHaveBeenCalledWith(expect.stringContaining('/my-work/inbox'));
            });
        });

        it('does not auto-load when autoLoad is false', async () => {
            renderHook(() => useInbox({ autoLoad: false }));

            expect(Api.get).not.toHaveBeenCalled();
        });

        it('returns loading state during fetch', async () => {
            (Api.get as any).mockImplementation(() => new Promise(() => {}));

            const { result } = renderHook(() => useInbox());

            expect(result.current.loading).toBe(true);
        });
    });

    describe('Data Loading', () => {
        it('returns items after loading', async () => {
            const { result } = renderHook(() => useInbox());

            await waitFor(() => {
                expect(result.current.items.length).toBeGreaterThan(0);
            });

            // Should filter out triaged items
            expect(result.current.items.length).toBe(2);
        });

        it('returns summary after loading', async () => {
            const { result } = renderHook(() => useInbox());

            await waitFor(() => {
                expect(result.current.summary).not.toBeNull();
            });

            expect(result.current.summary?.total).toBe(3);
        });

        it('sets error on fetch failure', async () => {
            (Api.get as any).mockRejectedValue(new Error('Network error'));

            const { result } = renderHook(() => useInbox());

            await waitFor(() => {
                expect(result.current.error).not.toBeNull();
            });

            expect(result.current.error?.message).toBe('Network error');
        });

        it('includes triaged items when option is set', async () => {
            renderHook(() => useInbox({ includeTriaged: true }));

            await waitFor(() => {
                expect(Api.get).toHaveBeenCalledWith(expect.stringContaining('includeTriaged=true'));
            });
        });

        it('respects limit option', async () => {
            renderHook(() => useInbox({ limit: 100 }));

            await waitFor(() => {
                expect(Api.get).toHaveBeenCalledWith(expect.stringContaining('limit=100'));
            });
        });
    });

    describe('Computed Values', () => {
        it('calculates totalCount correctly', async () => {
            const { result } = renderHook(() => useInbox());

            await waitFor(() => {
                expect(result.current.totalCount).toBe(2);
            });
        });

        it('calculates criticalCount correctly', async () => {
            const { result } = renderHook(() => useInbox());

            await waitFor(() => {
                expect(result.current.criticalCount).toBe(1);
            });
        });

        it('hasSelection is false initially', async () => {
            const { result } = renderHook(() => useInbox());

            await waitFor(() => {
                expect(result.current.hasSelection).toBe(false);
            });
        });
    });

    describe('Selection Management', () => {
        it('selectItem adds item to selection', async () => {
            const { result } = renderHook(() => useInbox());

            await waitFor(() => {
                expect(result.current.items.length).toBeGreaterThan(0);
            });

            act(() => {
                result.current.selectItem('item-1');
            });

            expect(result.current.selectedIds.has('item-1')).toBe(true);
            expect(result.current.hasSelection).toBe(true);
        });

        it('selectAll selects all items', async () => {
            const { result } = renderHook(() => useInbox());

            await waitFor(() => {
                expect(result.current.items.length).toBeGreaterThan(0);
            });

            act(() => {
                result.current.selectAll();
            });

            expect(result.current.selectedIds.size).toBe(2);
        });

        it('clearSelection removes all selections', async () => {
            const { result } = renderHook(() => useInbox());

            await waitFor(() => {
                expect(result.current.items.length).toBeGreaterThan(0);
            });

            act(() => {
                result.current.selectAll();
            });

            expect(result.current.selectedIds.size).toBe(2);

            act(() => {
                result.current.clearSelection();
            });

            expect(result.current.selectedIds.size).toBe(0);
            expect(result.current.hasSelection).toBe(false);
        });

        it('toggleSelection toggles item selection', async () => {
            const { result } = renderHook(() => useInbox());

            await waitFor(() => {
                expect(result.current.items.length).toBeGreaterThan(0);
            });

            // Toggle on
            act(() => {
                result.current.toggleSelection('item-1');
            });
            expect(result.current.selectedIds.has('item-1')).toBe(true);

            // Toggle off
            act(() => {
                result.current.toggleSelection('item-1');
            });
            expect(result.current.selectedIds.has('item-1')).toBe(false);
        });
    });

    describe('Triage Actions', () => {
        it('triageItem calls API with correct params', async () => {
            const { result } = renderHook(() => useInbox());

            await waitFor(() => {
                expect(result.current.items.length).toBeGreaterThan(0);
            });

            await act(async () => {
                await result.current.triageItem('item-1', 'SCHEDULE', { date: '2024-01-20' });
            });

            expect(Api.post).toHaveBeenCalledWith(
                '/my-work/inbox/item-1/triage',
                { action: 'SCHEDULE', params: { date: '2024-01-20' } }
            );
        });

        it('triageItem performs optimistic update', async () => {
            const { result } = renderHook(() => useInbox());

            await waitFor(() => {
                expect(result.current.items.length).toBe(2);
            });

            act(() => {
                result.current.triageItem('item-1', 'DISMISS');
            });

            // Item should be removed immediately
            expect(result.current.items.find(i => i.id === 'item-1')).toBeUndefined();
        });

        it('triageItem reverts on error', async () => {
            (Api.post as any).mockRejectedValue(new Error('API Error'));
            (Api.get as any).mockResolvedValue({
                items: mockInboxItems,
                summary: mockSummary
            });

            const { result } = renderHook(() => useInbox());

            await waitFor(() => {
                expect(result.current.items.length).toBe(2);
            });

            await act(async () => {
                try {
                    await result.current.triageItem('item-1', 'DISMISS');
                } catch {}
            });

            // Should reload inbox on error
            expect(Api.get).toHaveBeenCalledTimes(2);
        });

        it('triageItem removes item from selection', async () => {
            const { result } = renderHook(() => useInbox());

            await waitFor(() => {
                expect(result.current.items.length).toBeGreaterThan(0);
            });

            act(() => {
                result.current.selectItem('item-1');
            });
            expect(result.current.selectedIds.has('item-1')).toBe(true);

            await act(async () => {
                await result.current.triageItem('item-1', 'DISMISS');
            });

            expect(result.current.selectedIds.has('item-1')).toBe(false);
        });
    });

    describe('Bulk Triage', () => {
        it('bulkTriage does nothing when no selection', async () => {
            const { result } = renderHook(() => useInbox());

            await waitFor(() => {
                expect(result.current.items.length).toBeGreaterThan(0);
            });

            await act(async () => {
                await result.current.bulkTriage('DISMISS');
            });

            expect(Api.post).not.toHaveBeenCalled();
        });

        it('bulkTriage calls API with selected IDs', async () => {
            const { result } = renderHook(() => useInbox());

            await waitFor(() => {
                expect(result.current.items.length).toBeGreaterThan(0);
            });

            act(() => {
                result.current.selectAll();
            });

            await act(async () => {
                await result.current.bulkTriage('DISMISS');
            });

            expect(Api.post).toHaveBeenCalledWith(
                '/my-work/inbox/bulk-triage',
                expect.objectContaining({
                    itemIds: expect.arrayContaining(['item-1', 'item-2']),
                    action: 'DISMISS'
                })
            );
        });

        it('bulkTriage clears selection after success', async () => {
            const { result } = renderHook(() => useInbox());

            await waitFor(() => {
                expect(result.current.items.length).toBeGreaterThan(0);
            });

            act(() => {
                result.current.selectAll();
            });

            await act(async () => {
                await result.current.bulkTriage('DISMISS');
            });

            expect(result.current.selectedIds.size).toBe(0);
        });

        it('bulkTriage removes items optimistically', async () => {
            const { result } = renderHook(() => useInbox());

            await waitFor(() => {
                expect(result.current.items.length).toBe(2);
            });

            act(() => {
                result.current.selectAll();
            });

            act(() => {
                result.current.bulkTriage('DISMISS');
            });

            // All items should be removed
            expect(result.current.items.length).toBe(0);
        });
    });

    describe('Manual Load', () => {
        it('loadInbox can be called manually', async () => {
            const { result } = renderHook(() => useInbox({ autoLoad: false }));

            expect(Api.get).not.toHaveBeenCalled();

            await act(async () => {
                await result.current.loadInbox();
            });

            expect(Api.get).toHaveBeenCalled();
        });

        it('loadInbox updates items', async () => {
            const { result } = renderHook(() => useInbox({ autoLoad: false }));

            expect(result.current.items.length).toBe(0);

            await act(async () => {
                await result.current.loadInbox();
            });

            expect(result.current.items.length).toBe(2);
        });
    });
});



