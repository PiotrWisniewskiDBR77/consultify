import { useState, useEffect, useCallback } from 'react';
import { Api } from '../services/api';
import { useAppStore } from '../store/useAppStore';

export interface UsageLimits {
    projects: { current: number; limit: number; percentage: number };
    users: { current: number; limit: number; percentage: number };
    storage: { current: number; limit: number; percentage: number }; // in MB
    aiCalls: { current: number; limit: number; percentage: number };
    tokens: { current: number; limit: number; percentage: number };
}

interface UsageLimitsState {
    limits: UsageLimits | null;
    isLoading: boolean;
    error: string | null;
    warnings: Array<{
        type: 'projects' | 'users' | 'storage' | 'ai_calls' | 'tokens';
        percentage: number;
        severity: 'warning' | 'critical';
    }>;
}

const WARNING_THRESHOLD = 75; // Show warning at 75%
const CRITICAL_THRESHOLD = 90; // Critical warning at 90%

export const useUsageLimits = () => {
    const { currentUser } = useAppStore();
    const [state, setState] = useState<UsageLimitsState>({
        limits: null,
        isLoading: true,
        error: null,
        warnings: []
    });

    const fetchLimits = useCallback(async () => {
        if (!currentUser?.organizationId) {
            setState(prev => ({ ...prev, isLoading: false }));
            return;
        }

        try {
            setState(prev => ({ ...prev, isLoading: true, error: null }));

            // Fetch billing/usage data
            const billingData = await Api.getOrganizationBilling(currentUser.organizationId);
            
            // Calculate usage percentages
            const usage = billingData?.usage || {};
            const limits: UsageLimits = {
                projects: {
                    current: usage.projectsUsed || 0,
                    limit: usage.projectLimit || 3,
                    percentage: Math.round(((usage.projectsUsed || 0) / (usage.projectLimit || 3)) * 100)
                },
                users: {
                    current: usage.usersUsed || 0,
                    limit: usage.userLimit || 4,
                    percentage: Math.round(((usage.usersUsed || 0) / (usage.userLimit || 4)) * 100)
                },
                storage: {
                    current: usage.storageUsed || 0,
                    limit: usage.storageLimit || 100,
                    percentage: Math.round(((usage.storageUsed || 0) / (usage.storageLimit || 100)) * 100)
                },
                aiCalls: {
                    current: usage.aiCallsUsed || 0,
                    limit: usage.aiCallLimit || 50,
                    percentage: Math.round(((usage.aiCallsUsed || 0) / (usage.aiCallLimit || 50)) * 100)
                },
                tokens: {
                    current: usage.tokensUsed || 0,
                    limit: usage.tokenLimit || 100000,
                    percentage: Math.round(((usage.tokensUsed || 0) / (usage.tokenLimit || 100000)) * 100)
                }
            };

            // Calculate warnings
            const warnings: UsageLimitsState['warnings'] = [];

            const checkLimit = (type: 'projects' | 'users' | 'storage' | 'ai_calls' | 'tokens', data: { percentage: number }) => {
                if (data.percentage >= CRITICAL_THRESHOLD) {
                    warnings.push({ type, percentage: data.percentage, severity: 'critical' });
                } else if (data.percentage >= WARNING_THRESHOLD) {
                    warnings.push({ type, percentage: data.percentage, severity: 'warning' });
                }
            };

            checkLimit('projects', limits.projects);
            checkLimit('users', limits.users);
            checkLimit('storage', limits.storage);
            checkLimit('ai_calls', limits.aiCalls);
            checkLimit('tokens', limits.tokens);

            // Sort by percentage (highest first)
            warnings.sort((a, b) => b.percentage - a.percentage);

            setState({
                limits,
                isLoading: false,
                error: null,
                warnings
            });

        } catch (error: any) {
            console.error('[useUsageLimits] Failed to fetch limits:', error);
            setState(prev => ({
                ...prev,
                isLoading: false,
                error: error.message || 'Failed to fetch usage limits'
            }));
        }
    }, [currentUser?.organizationId]);

    // Initial fetch
    useEffect(() => {
        fetchLimits();
    }, [fetchLimits]);

    // Refresh function
    const refreshLimits = useCallback(() => {
        fetchLimits();
    }, [fetchLimits]);

    // Check specific limit
    const isNearLimit = useCallback((type: keyof UsageLimits): boolean => {
        if (!state.limits) return false;
        return state.limits[type].percentage >= WARNING_THRESHOLD;
    }, [state.limits]);

    const isAtLimit = useCallback((type: keyof UsageLimits): boolean => {
        if (!state.limits) return false;
        return state.limits[type].percentage >= 100;
    }, [state.limits]);

    // Get the most critical warning
    const mostCriticalWarning = state.warnings.length > 0 ? state.warnings[0] : null;

    return {
        ...state,
        refreshLimits,
        isNearLimit,
        isAtLimit,
        mostCriticalWarning,
        hasWarnings: state.warnings.length > 0,
        WARNING_THRESHOLD,
        CRITICAL_THRESHOLD
    };
};

export default useUsageLimits;






