/**
 * @vitest-environment jsdom
 * 
 * useInbox Hook Tests
 * Tests for inbox triage state management
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useInbox } from '@/hooks/useInbox';

// Mock Api
vi.mock('@/services/api', () => ({
    Api: {
        get: vi.fn().mockResolvedValue({ items: [], summary: null })
    }
}));

// Mock react-i18next
vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => key })
}));

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({
    default: { success: vi.fn(), error: vi.fn() }
}));

describe('useInbox Hook', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Initial State', () => {
        it('returns items array', () => {
            const { result } = renderHook(() => useInbox({ autoLoad: false }));
            expect(Array.isArray(result.current.items)).toBe(true);
        });

        it('returns loading state', () => {
            const { result } = renderHook(() => useInbox({ autoLoad: false }));
            expect(typeof result.current.loading).toBe('boolean');
        });

        it('returns error state', () => {
            const { result } = renderHook(() => useInbox({ autoLoad: false }));
            expect(result.current.error === null || result.current.error instanceof Error).toBe(true);
        });

        it('returns selectedIds as Set', () => {
            const { result } = renderHook(() => useInbox({ autoLoad: false }));
            expect(result.current.selectedIds instanceof Set).toBe(true);
        });
    });

    describe('Computed Values', () => {
        it('returns totalCount', () => {
            const { result } = renderHook(() => useInbox({ autoLoad: false }));
            expect(typeof result.current.totalCount).toBe('number');
        });

        it('returns criticalCount', () => {
            const { result } = renderHook(() => useInbox({ autoLoad: false }));
            expect(typeof result.current.criticalCount).toBe('number');
        });

        it('returns hasSelection', () => {
            const { result } = renderHook(() => useInbox({ autoLoad: false }));
            expect(typeof result.current.hasSelection).toBe('boolean');
        });
    });

    describe('API Methods', () => {
        it('exposes loadInbox method', () => {
            const { result } = renderHook(() => useInbox({ autoLoad: false }));
            expect(typeof result.current.loadInbox).toBe('function');
        });

        it('exposes triageItem method', () => {
            const { result } = renderHook(() => useInbox({ autoLoad: false }));
            expect(typeof result.current.triageItem).toBe('function');
        });

        it('exposes bulkTriage method', () => {
            const { result } = renderHook(() => useInbox({ autoLoad: false }));
            expect(typeof result.current.bulkTriage).toBe('function');
        });

        it('exposes selectItem method', () => {
            const { result } = renderHook(() => useInbox({ autoLoad: false }));
            expect(typeof result.current.selectItem).toBe('function');
        });

        it('exposes selectAll method', () => {
            const { result } = renderHook(() => useInbox({ autoLoad: false }));
            expect(typeof result.current.selectAll).toBe('function');
        });

        it('exposes clearSelection method', () => {
            const { result } = renderHook(() => useInbox({ autoLoad: false }));
            expect(typeof result.current.clearSelection).toBe('function');
        });

        it('exposes toggleSelection method', () => {
            const { result } = renderHook(() => useInbox({ autoLoad: false }));
            expect(typeof result.current.toggleSelection).toBe('function');
        });
    });

    describe('Options', () => {
        it('accepts autoLoad option', () => {
            const { result } = renderHook(() => useInbox({ autoLoad: false }));
            expect(result.current).toBeDefined();
        });

        it('accepts includeTriaged option', () => {
            const { result } = renderHook(() => useInbox({ autoLoad: false, includeTriaged: true }));
            expect(result.current).toBeDefined();
        });

        it('accepts limit option', () => {
            const { result } = renderHook(() => useInbox({ autoLoad: false, limit: 25 }));
            expect(result.current).toBeDefined();
        });
    });
});
