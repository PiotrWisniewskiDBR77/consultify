/**
 * @vitest-environment jsdom
 *
 * usePMOContext Hook Tests
 * Tests for PMO context state management
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { usePMOContext, useTaskPMOLabel, usePhaseAction } from '@/hooks/usePMOContext';

// Mock stores
vi.mock('@/store/useAppStore', () => ({
  useAppStore: vi.fn((selector) => {
    const state = { currentProjectId: 'project-1' };
    return selector ? selector(state) : state;
  }),
}));

vi.mock('@/store/usePMOStore', () => ({
  usePMOStore: vi.fn((selector) => {
    const state = {
      fetchPMOContext: vi.fn(),
      fetchTaskLabels: vi.fn(),
      currentPhase: 'discovery',
      phaseNumber: 1,
      totalPhases: 5,
      gateStatus: 'open',
      systemMessages: [],
      blockingIssues: [],
      isLoading: false,
      error: null,
      isPhaseBlocked: vi.fn(() => false),
      isActionAllowed: vi.fn(() => true),
      getWarningMessages: vi.fn(() => []),
      getCriticalMessages: vi.fn(() => []),
      getTaskLabel: vi.fn(() => null),
    };
    return selector ? selector(state) : state;
  }),
}));

describe('usePMOContext Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('State', () => {
    it('returns currentPhase', () => {
      const { result } = renderHook(() => usePMOContext());
      expect(result.current.currentPhase).toBeDefined();
    });

    it('returns phaseNumber', () => {
      const { result } = renderHook(() => usePMOContext());
      expect(typeof result.current.phaseNumber).toBe('number');
    });

    it('returns totalPhases', () => {
      const { result } = renderHook(() => usePMOContext());
      expect(typeof result.current.totalPhases).toBe('number');
    });

    it('returns gateStatus', () => {
      const { result } = renderHook(() => usePMOContext());
      expect(result.current.gateStatus).toBeDefined();
    });

    it('returns isLoading', () => {
      const { result } = renderHook(() => usePMOContext());
      expect(typeof result.current.isLoading).toBe('boolean');
    });

    it('returns error state', () => {
      const { result } = renderHook(() => usePMOContext());
      expect(result.current.error === null || typeof result.current.error === 'string').toBe(true);
    });

    it('returns systemMessages array', () => {
      const { result } = renderHook(() => usePMOContext());
      expect(Array.isArray(result.current.systemMessages)).toBe(true);
    });

    it('returns blockingIssues array', () => {
      const { result } = renderHook(() => usePMOContext());
      expect(Array.isArray(result.current.blockingIssues)).toBe(true);
    });
  });

  describe('Helper Methods', () => {
    it('exposes isPhaseBlocked method', () => {
      const { result } = renderHook(() => usePMOContext());
      expect(typeof result.current.isPhaseBlocked).toBe('function');
    });

    it('exposes isActionAllowed method', () => {
      const { result } = renderHook(() => usePMOContext());
      expect(typeof result.current.isActionAllowed).toBe('function');
    });

    it('exposes getWarningMessages method', () => {
      const { result } = renderHook(() => usePMOContext());
      expect(typeof result.current.getWarningMessages).toBe('function');
    });

    it('exposes getCriticalMessages method', () => {
      const { result } = renderHook(() => usePMOContext());
      expect(typeof result.current.getCriticalMessages).toBe('function');
    });

    it('exposes getTaskLabel method', () => {
      const { result } = renderHook(() => usePMOContext());
      expect(typeof result.current.getTaskLabel).toBe('function');
    });
  });

  describe('Actions', () => {
    it('exposes refresh method', () => {
      const { result } = renderHook(() => usePMOContext());
      expect(typeof result.current.refresh).toBe('function');
    });
  });
});

describe('useTaskPMOLabel Hook', () => {
  it('returns task label for given taskId', () => {
    const { result } = renderHook(() => useTaskPMOLabel('task-1'));
    // Should return null or label object
    expect(result.current === null || typeof result.current === 'object').toBe(true);
  });
});

describe('usePhaseAction Hook', () => {
  it('returns boolean for action availability', () => {
    const { result } = renderHook(() => usePhaseAction('create_task'));
    expect(typeof result.current).toBe('boolean');
  });
});
