/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { usePMOContext, useTaskPMOLabel, usePhaseAction } from '../../hooks/usePMOContext';

// Mock stores
const mockFetchPMOContext = vi.fn();
const mockFetchTaskLabels = vi.fn();
const mockIsPhaseBlocked = vi.fn(() => false);
const mockIsActionAllowed = vi.fn(() => true);
const mockGetWarningMessages = vi.fn(() => []);
const mockGetCriticalMessages = vi.fn(() => []);
const mockGetTaskLabel = vi.fn(() => null);

vi.mock('../../store/usePMOStore', () => ({
    usePMOStore: vi.fn((selector) => {
        const state = {
            fetchPMOContext: mockFetchPMOContext,
            fetchTaskLabels: mockFetchTaskLabels,
            currentPhase: 'EXECUTION',
            phaseNumber: 3,
            totalPhases: 5,
            gateStatus: { isReady: true, gateType: 'EXECUTION_GATE' },
            systemMessages: [],
            blockingIssues: [],
            isLoading: false,
            error: null,
            isPhaseBlocked: mockIsPhaseBlocked,
            isActionAllowed: mockIsActionAllowed,
            getWarningMessages: mockGetWarningMessages,
            getCriticalMessages: mockGetCriticalMessages,
            getTaskLabel: mockGetTaskLabel
        };
        return selector ? selector(state) : state;
    })
}));

vi.mock('../../store/useAppStore', () => ({
    useAppStore: vi.fn((selector) => {
        const state = { currentProjectId: 'proj-1' };
        return selector ? selector(state) : state;
    })
}));

describe('usePMOContext Hook', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe('Initial Load', () => {
        it('fetches PMO context on mount', () => {
            renderHook(() => usePMOContext());

            expect(mockFetchPMOContext).toHaveBeenCalledWith('proj-1');
        });

        it('fetches task labels on mount', () => {
            renderHook(() => usePMOContext());

            expect(mockFetchTaskLabels).toHaveBeenCalledWith('proj-1');
        });
    });

    describe('State Access', () => {
        it('returns current phase', () => {
            const { result } = renderHook(() => usePMOContext());

            expect(result.current.currentPhase).toBe('EXECUTION');
        });

        it('returns phase number', () => {
            const { result } = renderHook(() => usePMOContext());

            expect(result.current.phaseNumber).toBe(3);
        });

        it('returns total phases', () => {
            const { result } = renderHook(() => usePMOContext());

            expect(result.current.totalPhases).toBe(5);
        });

        it('returns gate status', () => {
            const { result } = renderHook(() => usePMOContext());

            expect(result.current.gateStatus).toEqual({
                isReady: true,
                gateType: 'EXECUTION_GATE'
            });
        });

        it('returns loading state', () => {
            const { result } = renderHook(() => usePMOContext());

            expect(result.current.isLoading).toBe(false);
        });

        it('returns error state', () => {
            const { result } = renderHook(() => usePMOContext());

            expect(result.current.error).toBeNull();
        });
    });

    describe('Helper Methods', () => {
        it('provides isPhaseBlocked method', () => {
            const { result } = renderHook(() => usePMOContext());

            expect(result.current.isPhaseBlocked).toBeDefined();
            expect(typeof result.current.isPhaseBlocked).toBe('function');
        });

        it('provides isActionAllowed method', () => {
            const { result } = renderHook(() => usePMOContext());

            expect(result.current.isActionAllowed).toBeDefined();
            expect(typeof result.current.isActionAllowed).toBe('function');
        });

        it('provides getWarningMessages method', () => {
            const { result } = renderHook(() => usePMOContext());

            expect(result.current.getWarningMessages).toBeDefined();
        });

        it('provides getCriticalMessages method', () => {
            const { result } = renderHook(() => usePMOContext());

            expect(result.current.getCriticalMessages).toBeDefined();
        });

        it('provides getTaskLabel method', () => {
            const { result } = renderHook(() => usePMOContext());

            expect(result.current.getTaskLabel).toBeDefined();
        });
    });

    describe('Refresh Action', () => {
        it('provides refresh function', () => {
            const { result } = renderHook(() => usePMOContext());

            expect(result.current.refresh).toBeDefined();
            expect(typeof result.current.refresh).toBe('function');
        });

        it('calls fetchPMOContext on refresh', () => {
            const { result } = renderHook(() => usePMOContext());

            mockFetchPMOContext.mockClear();
            result.current.refresh();

            expect(mockFetchPMOContext).toHaveBeenCalledWith('proj-1');
        });

        it('calls fetchTaskLabels on refresh', () => {
            const { result } = renderHook(() => usePMOContext());

            mockFetchTaskLabels.mockClear();
            result.current.refresh();

            expect(mockFetchTaskLabels).toHaveBeenCalledWith('proj-1');
        });
    });

    describe('Periodic Refresh', () => {
        it('sets up interval for periodic refresh', () => {
            renderHook(() => usePMOContext());

            mockFetchPMOContext.mockClear();
            mockFetchTaskLabels.mockClear();

            // Advance 5 minutes
            vi.advanceTimersByTime(5 * 60 * 1000);

            expect(mockFetchPMOContext).toHaveBeenCalledWith('proj-1');
            expect(mockFetchTaskLabels).toHaveBeenCalledWith('proj-1');
        });

        it('clears interval on unmount', () => {
            const { unmount } = renderHook(() => usePMOContext());

            mockFetchPMOContext.mockClear();
            unmount();

            // Advance 5 minutes after unmount
            vi.advanceTimersByTime(5 * 60 * 1000);

            expect(mockFetchPMOContext).not.toHaveBeenCalled();
        });
    });
});

describe('useTaskPMOLabel Hook', () => {
    it('calls getTaskLabel with task id', () => {
        renderHook(() => useTaskPMOLabel('task-1'));

        expect(mockGetTaskLabel).toHaveBeenCalledWith('task-1');
    });

    it('returns label from store', () => {
        mockGetTaskLabel.mockReturnValue({ phase: 'EXECUTION', priority: 'high' });

        const { result } = renderHook(() => useTaskPMOLabel('task-1'));

        expect(result.current).toEqual({ phase: 'EXECUTION', priority: 'high' });
    });
});

describe('usePhaseAction Hook', () => {
    it('calls isActionAllowed with action', () => {
        renderHook(() => usePhaseAction('CREATE_TASK'));

        expect(mockIsActionAllowed).toHaveBeenCalledWith('CREATE_TASK');
    });

    it('returns boolean result', () => {
        mockIsActionAllowed.mockReturnValue(true);

        const { result } = renderHook(() => usePhaseAction('CREATE_TASK'));

        expect(result.current).toBe(true);
    });

    it('returns false when action not allowed', () => {
        mockIsActionAllowed.mockReturnValue(false);

        const { result } = renderHook(() => usePhaseAction('DELETE_PROJECT'));

        expect(result.current).toBe(false);
    });
});

