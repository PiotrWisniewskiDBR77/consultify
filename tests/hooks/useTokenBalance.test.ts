/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useTokenBalance } from '../../hooks/useTokenBalance';
import { Api } from '../../services/api';
import { useAppStore } from '../../store/useAppStore';

// Mock dependencies
vi.mock('../../services/api', () => ({
    Api: {
        getOrganizationBilling: vi.fn()
    }
}));

vi.mock('../../store/useAppStore', () => ({
    useAppStore: vi.fn()
}));

describe('useTokenBalance Hook', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (useAppStore as any).mockReturnValue({
            currentUser: {
                id: 'user-1',
                organizationId: 'org-1'
            }
        });
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    describe('Initial State', () => {
        it('starts with loading true', () => {
            (Api.getOrganizationBilling as any).mockImplementation(() => new Promise(() => {}));

            const { result } = renderHook(() => useTokenBalance());

            expect(result.current.isLoading).toBe(true);
        });

        it('starts with balance 0', () => {
            (Api.getOrganizationBilling as any).mockImplementation(() => new Promise(() => {}));

            const { result } = renderHook(() => useTokenBalance());

            expect(result.current.balance).toBe(0);
        });
    });

    describe('Balance Fetching', () => {
        it('fetches balance on mount', async () => {
            (Api.getOrganizationBilling as any).mockResolvedValue({
                usage: { tokensUsed: 5000, tokenLimit: 10000 }
            });

            renderHook(() => useTokenBalance());

            await waitFor(() => {
                expect(Api.getOrganizationBilling).toHaveBeenCalledWith('org-1');
            });
        });

        it('calculates balance from usage', async () => {
            (Api.getOrganizationBilling as any).mockResolvedValue({
                usage: { tokensUsed: 3000, tokenLimit: 10000 }
            });

            const { result } = renderHook(() => useTokenBalance());

            await waitFor(() => {
                expect(result.current.balance).toBe(7000);
            });
        });

        it('falls back to tokenBalance field', async () => {
            (Api.getOrganizationBilling as any).mockResolvedValue({
                tokenBalance: 5000
            });

            const { result } = renderHook(() => useTokenBalance());

            await waitFor(() => {
                expect(result.current.balance).toBe(5000);
            });
        });

        it('sets lastUpdated on success', async () => {
            (Api.getOrganizationBilling as any).mockResolvedValue({
                tokenBalance: 5000
            });

            const { result } = renderHook(() => useTokenBalance());

            await waitFor(() => {
                expect(result.current.lastUpdated).not.toBeNull();
            });
        });

        it('handles error', async () => {
            (Api.getOrganizationBilling as any).mockRejectedValue(new Error('API Error'));

            const { result } = renderHook(() => useTokenBalance());

            await waitFor(() => {
                expect(result.current.error).toBe('API Error');
            });
        });

        it('does not fetch without organizationId', async () => {
            (useAppStore as any).mockReturnValue({
                currentUser: { id: 'user-1' }
            });

            renderHook(() => useTokenBalance());

            await waitFor(() => {
                expect(Api.getOrganizationBilling).not.toHaveBeenCalled();
            });
        });
    });

    describe('Low Balance Detection', () => {
        it('sets isLowBalance when below threshold', async () => {
            (Api.getOrganizationBilling as any).mockResolvedValue({
                tokenBalance: 500 // Below 1000 (LOW_BALANCE_THRESHOLD)
            });

            const { result } = renderHook(() => useTokenBalance());

            await waitFor(() => {
                expect(result.current.isLowBalance).toBe(true);
            });
        });

        it('isLowBalance is false above threshold', async () => {
            (Api.getOrganizationBilling as any).mockResolvedValue({
                tokenBalance: 5000
            });

            const { result } = renderHook(() => useTokenBalance());

            await waitFor(() => {
                expect(result.current.isLowBalance).toBe(false);
            });
        });

        it('isLowBalance is false when zero balance', async () => {
            // Zero balance takes precedence over low balance
            (Api.getOrganizationBilling as any).mockResolvedValue({
                tokenBalance: 50 // Below 100 (ZERO_BALANCE_THRESHOLD)
            });

            const { result } = renderHook(() => useTokenBalance());

            await waitFor(() => {
                expect(result.current.isLowBalance).toBe(false);
                expect(result.current.isZeroBalance).toBe(true);
            });
        });
    });

    describe('Zero Balance Detection', () => {
        it('sets isZeroBalance when below threshold', async () => {
            (Api.getOrganizationBilling as any).mockResolvedValue({
                tokenBalance: 50 // Below 100 (ZERO_BALANCE_THRESHOLD)
            });

            const { result } = renderHook(() => useTokenBalance());

            await waitFor(() => {
                expect(result.current.isZeroBalance).toBe(true);
            });
        });

        it('isZeroBalance is false above threshold', async () => {
            (Api.getOrganizationBilling as any).mockResolvedValue({
                tokenBalance: 500
            });

            const { result } = renderHook(() => useTokenBalance());

            await waitFor(() => {
                expect(result.current.isZeroBalance).toBe(false);
            });
        });
    });

    describe('Warning Flags', () => {
        it('shouldShowWarning is true for low balance', async () => {
            (Api.getOrganizationBilling as any).mockResolvedValue({
                tokenBalance: 500
            });

            const { result } = renderHook(() => useTokenBalance());

            await waitFor(() => {
                expect(result.current.shouldShowWarning).toBe(true);
            });
        });

        it('shouldShowWarning is false while loading', async () => {
            (Api.getOrganizationBilling as any).mockImplementation(() => new Promise(() => {}));

            const { result } = renderHook(() => useTokenBalance());

            expect(result.current.shouldShowWarning).toBe(false);
        });

        it('shouldBlockAI is true for zero balance', async () => {
            (Api.getOrganizationBilling as any).mockResolvedValue({
                tokenBalance: 50
            });

            const { result } = renderHook(() => useTokenBalance());

            await waitFor(() => {
                expect(result.current.shouldBlockAI).toBe(true);
            });
        });

        it('shouldBlockAI is false while loading', async () => {
            (Api.getOrganizationBilling as any).mockImplementation(() => new Promise(() => {}));

            const { result } = renderHook(() => useTokenBalance());

            expect(result.current.shouldBlockAI).toBe(false);
        });
    });

    describe('Refresh Balance', () => {
        it('refreshBalance triggers re-fetch', async () => {
            (Api.getOrganizationBilling as any).mockResolvedValue({
                tokenBalance: 5000
            });

            const { result } = renderHook(() => useTokenBalance());

            await waitFor(() => {
                expect(result.current.balance).toBe(5000);
            });

            // Update mock for second call
            (Api.getOrganizationBilling as any).mockResolvedValue({
                tokenBalance: 4500
            });

            await act(async () => {
                result.current.refreshBalance();
            });

            await waitFor(() => {
                expect(Api.getOrganizationBilling).toHaveBeenCalledTimes(2);
            });
        });
    });

    describe('Thresholds', () => {
        it('exposes LOW_BALANCE_THRESHOLD', () => {
            (Api.getOrganizationBilling as any).mockResolvedValue({
                tokenBalance: 5000
            });

            const { result } = renderHook(() => useTokenBalance());

            expect(result.current.LOW_BALANCE_THRESHOLD).toBe(1000);
        });

        it('exposes ZERO_BALANCE_THRESHOLD', () => {
            (Api.getOrganizationBilling as any).mockResolvedValue({
                tokenBalance: 5000
            });

            const { result } = renderHook(() => useTokenBalance());

            expect(result.current.ZERO_BALANCE_THRESHOLD).toBe(100);
        });
    });

    describe('Edge Cases', () => {
        it('handles exactly LOW_BALANCE_THRESHOLD', async () => {
            (Api.getOrganizationBilling as any).mockResolvedValue({
                tokenBalance: 1000
            });

            const { result } = renderHook(() => useTokenBalance());

            await waitFor(() => {
                expect(result.current.isLowBalance).toBe(false);
            });
        });

        it('handles exactly ZERO_BALANCE_THRESHOLD', async () => {
            (Api.getOrganizationBilling as any).mockResolvedValue({
                tokenBalance: 100
            });

            const { result } = renderHook(() => useTokenBalance());

            await waitFor(() => {
                expect(result.current.isZeroBalance).toBe(false);
                expect(result.current.isLowBalance).toBe(true);
            });
        });

        it('handles zero tokens', async () => {
            (Api.getOrganizationBilling as any).mockResolvedValue({
                tokenBalance: 0
            });

            const { result } = renderHook(() => useTokenBalance());

            await waitFor(() => {
                expect(result.current.balance).toBe(0);
                expect(result.current.isZeroBalance).toBe(true);
            });
        });
    });
});











