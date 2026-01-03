import { useState, useEffect, useCallback } from 'react';
import { Api } from '../services/api';
import { useAppStore } from '../store/useAppStore';

interface TokenBalanceState {
    balance: number;
    isLoading: boolean;
    error: string | null;
    isLowBalance: boolean;
    isZeroBalance: boolean;
    lastUpdated: Date | null;
}

const LOW_BALANCE_THRESHOLD = 1000; // Show warning below 1000 tokens
const ZERO_BALANCE_THRESHOLD = 100; // Block AI below 100 tokens

export const useTokenBalance = () => {
    const { currentUser } = useAppStore();
    const [state, setState] = useState<TokenBalanceState>({
        balance: 0,
        isLoading: true,
        error: null,
        isLowBalance: false,
        isZeroBalance: false,
        lastUpdated: null
    });

    const fetchBalance = useCallback(async () => {
        if (!currentUser?.organizationId) {
            setState(prev => ({ ...prev, isLoading: false }));
            return;
        }

        try {
            setState(prev => ({ ...prev, isLoading: true, error: null }));

            const billing = await (Api as any).getOrganizationBillingDetails(currentUser.organizationId);
            const balance = billing.tokenBalance || 0;

            setState({
                balance,
                isLoading: false,
                error: null,
                isLowBalance: balance < LOW_BALANCE_THRESHOLD && balance >= ZERO_BALANCE_THRESHOLD,
                isZeroBalance: balance < ZERO_BALANCE_THRESHOLD,
                lastUpdated: new Date()
            });
        } catch (error: any) {
            console.error('[useTokenBalance] Failed to fetch balance:', error);
            setState(prev => ({
                ...prev,
                isLoading: false,
                error: error.message || 'Failed to fetch token balance'
            }));
        }
    }, [currentUser?.organizationId]);

    // Initial fetch
    useEffect(() => {
        fetchBalance();
    }, [fetchBalance]);

    // Refresh balance after AI calls
    const refreshBalance = useCallback(() => {
        fetchBalance();
    }, [fetchBalance]);

    // Check if user should see low balance warning
    const shouldShowWarning = state.isLowBalance && !state.isLoading;

    // Check if user should see zero balance modal
    const shouldBlockAI = state.isZeroBalance && !state.isLoading;

    return {
        ...state,
        refreshBalance,
        shouldShowWarning,
        shouldBlockAI,
        LOW_BALANCE_THRESHOLD,
        ZERO_BALANCE_THRESHOLD
    };
};

export default useTokenBalance;









