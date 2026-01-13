/**
 * @vitest-environment jsdom
 * 
 * useTokenBalance Hook Tests
 * Tests for token balance management and low balance alerts
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useTokenBalance } from '@/hooks/useTokenBalance';

// Mock useAppStore
vi.mock('@/store/useAppStore', () => ({
    useAppStore: vi.fn(() => ({
        currentUser: {
            id: 'user-1',
            organizationId: 'org-1'
        }
    }))
}));

// Mock Api service
vi.mock('@/services/api', () => ({
    Api: {
        getOrganizationBillingDetails: vi.fn().mockResolvedValue({
            tokenBalance: 5000
        })
    }
}));

describe('useTokenBalance Hook', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('Initial State', () => {
        it('returns balance state', async () => {
            const { result } = renderHook(() => useTokenBalance());

            // Balance should be defined
            expect(typeof result.current.balance).toBe('number');
        });

        it('returns loading state', () => {
            const { result } = renderHook(() => useTokenBalance());

            expect(typeof result.current.isLoading).toBe('boolean');
        });

        it('returns error state', () => {
            const { result } = renderHook(() => useTokenBalance());

            expect(result.current.error === null || typeof result.current.error === 'string').toBe(true);
        });
    });

    describe('Balance Thresholds', () => {
        it('exposes LOW_BALANCE_THRESHOLD', () => {
            const { result } = renderHook(() => useTokenBalance());

            expect(result.current.LOW_BALANCE_THRESHOLD).toBe(1000);
        });

        it('exposes ZERO_BALANCE_THRESHOLD', () => {
            const { result } = renderHook(() => useTokenBalance());

            expect(result.current.ZERO_BALANCE_THRESHOLD).toBe(100);
        });
    });

    describe('Balance Flags', () => {
        it('returns isLowBalance flag', () => {
            const { result } = renderHook(() => useTokenBalance());

            expect(typeof result.current.isLowBalance).toBe('boolean');
        });

        it('returns isZeroBalance flag', () => {
            const { result } = renderHook(() => useTokenBalance());

            expect(typeof result.current.isZeroBalance).toBe('boolean');
        });

        it('returns shouldShowWarning computed value', () => {
            const { result } = renderHook(() => useTokenBalance());

            expect(typeof result.current.shouldShowWarning).toBe('boolean');
        });

        it('returns shouldBlockAI computed value', () => {
            const { result } = renderHook(() => useTokenBalance());

            expect(typeof result.current.shouldBlockAI).toBe('boolean');
        });
    });

    describe('API Methods', () => {
        it('exposes refreshBalance method', () => {
            const { result } = renderHook(() => useTokenBalance());

            expect(typeof result.current.refreshBalance).toBe('function');
        });
    });

    describe('Timestamp', () => {
        it('returns lastUpdated timestamp', async () => {
            const { result } = renderHook(() => useTokenBalance());

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            // lastUpdated should be null initially or a Date after fetch
            expect(
                result.current.lastUpdated === null ||
                result.current.lastUpdated instanceof Date
            ).toBe(true);
        });
    });
});
