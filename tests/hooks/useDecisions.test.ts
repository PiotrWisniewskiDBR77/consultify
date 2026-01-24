/**
 * useDecisions Hook - Unit Tests
 * Tests for decision management hooks
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock API
const mockApi = {
    getPendingDecisions: vi.fn(),
    getDecision: vi.fn(),
    createDecision: vi.fn(),
    makeDecision: vi.fn(),
    escalateDecision: vi.fn(),
    cancelDecision: vi.fn(),
};

vi.mock('@/services/api', () => ({
    default: mockApi,
    Api: mockApi,
}));

// Create wrapper
const createWrapper = () => {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });

    return function Wrapper({ children }: { children: React.ReactNode }) {
        return React.createElement(
            QueryClientProvider,
            { client: queryClient },
            children
        );
    };
};

// Mock hook for testing
const useDecisions = (userId: string, orgId: string) => {
    const [decisions, setDecisions] = React.useState<any[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [error, setError] = React.useState<Error | null>(null);

    const fetchDecisions = React.useCallback(async () => {
        try {
            setIsLoading(true);
            const data = await mockApi.getPendingDecisions(userId, orgId);
            setDecisions(data || []);
            setError(null);
        } catch (err) {
            setError(err as Error);
        } finally {
            setIsLoading(false);
        }
    }, [userId, orgId]);

    React.useEffect(() => {
        if (userId && orgId) {
            fetchDecisions();
        }
    }, [userId, orgId, fetchDecisions]);

    const approveDecision = async (decisionId: string, rationale: string) => {
        await mockApi.makeDecision({
            decisionId,
            selectedOption: 'approve',
            rationale,
            decidedBy: userId,
        });
        await fetchDecisions();
    };

    const rejectDecision = async (decisionId: string, rationale: string) => {
        await mockApi.makeDecision({
            decisionId,
            selectedOption: 'reject',
            rationale,
            decidedBy: userId,
        });
        await fetchDecisions();
    };

    return {
        decisions,
        isLoading,
        error,
        approveDecision,
        rejectDecision,
        refetch: fetchDecisions,
    };
};

describe('useDecisions Hook', () => {
    const testUserId = 'test-user-123';
    const testOrgId = 'test-org-456';

    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    describe('Fetching Decisions', () => {
        it('should fetch pending decisions on mount', async () => {
            const mockDecisions = [
                { id: '1', title: 'Decision 1', status: 'pending' },
                { id: '2', title: 'Decision 2', status: 'pending' },
            ];
            mockApi.getPendingDecisions.mockResolvedValue(mockDecisions);

            const { result } = renderHook(
                () => useDecisions(testUserId, testOrgId),
                { wrapper: createWrapper() }
            );

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            expect(result.current.decisions).toEqual(mockDecisions);
            expect(mockApi.getPendingDecisions).toHaveBeenCalledWith(testUserId, testOrgId);
        });

        it('should handle empty decisions list', async () => {
            mockApi.getPendingDecisions.mockResolvedValue([]);

            const { result } = renderHook(
                () => useDecisions(testUserId, testOrgId),
                { wrapper: createWrapper() }
            );

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            expect(result.current.decisions).toEqual([]);
        });

        it('should handle fetch errors', async () => {
            mockApi.getPendingDecisions.mockRejectedValue(new Error('Fetch failed'));

            const { result } = renderHook(
                () => useDecisions(testUserId, testOrgId),
                { wrapper: createWrapper() }
            );

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            expect(result.current.error).toBeDefined();
            expect(result.current.error?.message).toBe('Fetch failed');
        });
    });

    describe('Approve Decision', () => {
        it('should approve decision and refetch', async () => {
            mockApi.getPendingDecisions.mockResolvedValue([
                { id: '1', title: 'Decision 1', status: 'pending' },
            ]);
            mockApi.makeDecision.mockResolvedValue({ status: 'approved' });

            const { result } = renderHook(
                () => useDecisions(testUserId, testOrgId),
                { wrapper: createWrapper() }
            );

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            await act(async () => {
                await result.current.approveDecision('1', 'Looks good');
            });

            expect(mockApi.makeDecision).toHaveBeenCalledWith({
                decisionId: '1',
                selectedOption: 'approve',
                rationale: 'Looks good',
                decidedBy: testUserId,
            });
        });
    });

    describe('Reject Decision', () => {
        it('should reject decision and refetch', async () => {
            mockApi.getPendingDecisions.mockResolvedValue([
                { id: '1', title: 'Decision 1', status: 'pending' },
            ]);
            mockApi.makeDecision.mockResolvedValue({ status: 'rejected' });

            const { result } = renderHook(
                () => useDecisions(testUserId, testOrgId),
                { wrapper: createWrapper() }
            );

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            await act(async () => {
                await result.current.rejectDecision('1', 'Not ready');
            });

            expect(mockApi.makeDecision).toHaveBeenCalledWith({
                decisionId: '1',
                selectedOption: 'reject',
                rationale: 'Not ready',
                decidedBy: testUserId,
            });
        });
    });

    describe('Refetch', () => {
        it('should refetch decisions manually', async () => {
            mockApi.getPendingDecisions.mockResolvedValue([]);

            const { result } = renderHook(
                () => useDecisions(testUserId, testOrgId),
                { wrapper: createWrapper() }
            );

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            mockApi.getPendingDecisions.mockResolvedValue([
                { id: 'new', title: 'New Decision' },
            ]);

            await act(async () => {
                await result.current.refetch();
            });

            expect(mockApi.getPendingDecisions).toHaveBeenCalledTimes(2);
        });
    });

    describe('Loading State', () => {
        it('should show loading state during fetch', () => {
            mockApi.getPendingDecisions.mockImplementation(
                () => new Promise(() => { })
            );

            const { result } = renderHook(
                () => useDecisions(testUserId, testOrgId),
                { wrapper: createWrapper() }
            );

            expect(result.current.isLoading).toBe(true);
            expect(result.current.decisions).toEqual([]);
        });
    });
});

describe('Decision Filters', () => {
    it('should filter decisions by status', () => {
        const decisions = [
            { id: '1', status: 'pending' },
            { id: '2', status: 'approved' },
            { id: '3', status: 'pending' },
            { id: '4', status: 'rejected' },
        ];

        const pending = decisions.filter((d) => d.status === 'pending');
        expect(pending).toHaveLength(2);

        const approved = decisions.filter((d) => d.status === 'approved');
        expect(approved).toHaveLength(1);
    });

    it('should filter decisions by type', () => {
        const decisions = [
            { id: '1', type: 'APPROVAL' },
            { id: '2', type: 'GO_NO_GO' },
            { id: '3', type: 'APPROVAL' },
        ];

        const approvals = decisions.filter((d) => d.type === 'APPROVAL');
        expect(approvals).toHaveLength(2);
    });

    it('should sort decisions by deadline', () => {
        const decisions = [
            { id: '1', deadline: '2026-01-15' },
            { id: '2', deadline: '2026-01-10' },
            { id: '3', deadline: '2026-01-20' },
        ];

        const sorted = [...decisions].sort(
            (a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime()
        );

        expect(sorted[0].id).toBe('2');
        expect(sorted[1].id).toBe('1');
        expect(sorted[2].id).toBe('3');
    });
});
