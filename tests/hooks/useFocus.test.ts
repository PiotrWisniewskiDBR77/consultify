/**
 * @vitest-environment jsdom
 *
 * useFocus Hook Tests
 * Tests for focus board state management
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useFocus } from '@/hooks/useFocus';

// Mock Api
vi.mock('@/services/api', () => ({
  Api: {
    get: vi.fn().mockResolvedValue({ board: null, tasks: [] }),
    post: vi.fn().mockResolvedValue({}),
  },
}));

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

describe('useFocus Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Initial State', () => {
    it('returns board state', () => {
      const { result } = renderHook(() => useFocus({ autoLoad: false }));
      expect(result.current.board === null || typeof result.current.board === 'object').toBe(true);
    });

    it('returns tasks array', () => {
      const { result } = renderHook(() => useFocus({ autoLoad: false }));
      expect(Array.isArray(result.current.tasks)).toBe(true);
    });

    it('returns loading state', () => {
      const { result } = renderHook(() => useFocus({ autoLoad: false }));
      expect(typeof result.current.loading).toBe('boolean');
    });

    it('returns error state', () => {
      const { result } = renderHook(() => useFocus({ autoLoad: false }));
      expect(result.current.error === null || result.current.error instanceof Error).toBe(true);
    });

    it('returns suggestions state', () => {
      const { result } = renderHook(() => useFocus({ autoLoad: false }));
      expect(
        result.current.suggestions === null || typeof result.current.suggestions === 'object'
      ).toBe(true);
    });
  });

  describe('Computed Values', () => {
    it('returns completedCount', () => {
      const { result } = renderHook(() => useFocus({ autoLoad: false }));
      expect(typeof result.current.completedCount).toBe('number');
    });

    it('returns totalCount', () => {
      const { result } = renderHook(() => useFocus({ autoLoad: false }));
      expect(typeof result.current.totalCount).toBe('number');
    });

    it('returns executionScore', () => {
      const { result } = renderHook(() => useFocus({ autoLoad: false }));
      expect(typeof result.current.executionScore).toBe('number');
    });

    it('returns canAddMore', () => {
      const { result } = renderHook(() => useFocus({ autoLoad: false }));
      expect(typeof result.current.canAddMore).toBe('boolean');
    });
  });

  describe('API Methods', () => {
    it('exposes loadFocus method', () => {
      const { result } = renderHook(() => useFocus({ autoLoad: false }));
      expect(typeof result.current.loadFocus).toBe('function');
    });

    it('exposes addToFocus method', () => {
      const { result } = renderHook(() => useFocus({ autoLoad: false }));
      expect(typeof result.current.addToFocus).toBe('function');
    });

    it('exposes removeFromFocus method', () => {
      const { result } = renderHook(() => useFocus({ autoLoad: false }));
      expect(typeof result.current.removeFromFocus).toBe('function');
    });

    it('exposes reorderTasks method', () => {
      const { result } = renderHook(() => useFocus({ autoLoad: false }));
      expect(typeof result.current.reorderTasks).toBe('function');
    });

    it('exposes completeTask method', () => {
      const { result } = renderHook(() => useFocus({ autoLoad: false }));
      expect(typeof result.current.completeTask).toBe('function');
    });

    it('exposes requestAISuggestions method', () => {
      const { result } = renderHook(() => useFocus({ autoLoad: false }));
      expect(typeof result.current.requestAISuggestions).toBe('function');
    });

    it('exposes setDate method', () => {
      const { result } = renderHook(() => useFocus({ autoLoad: false }));
      expect(typeof result.current.setDate).toBe('function');
    });
  });

  describe('Options', () => {
    it('accepts autoLoad option', () => {
      const { result } = renderHook(() => useFocus({ autoLoad: false }));
      expect(result.current).toBeDefined();
    });

    it('accepts date option', () => {
      const { result } = renderHook(() => useFocus({ autoLoad: false, date: new Date() }));
      expect(result.current).toBeDefined();
    });
  });
});
