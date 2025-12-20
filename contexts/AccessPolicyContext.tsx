/**
 * Access Policy Context
 * 
 * React Context for consuming policy snapshot (single source of truth)
 * UI should ONLY use this context for gating - no local calculations
 * 
 * Step 2 Finalization: Enterprise+ Ready
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAppStore } from '../store/useAppStore';

interface PolicyLimits {
    maxProjects: number;
    maxUsers: number;
    maxAICallsPerDay: number;
    maxInitiatives: number;
    maxStorageMb: number;
    aiRolesEnabled: string[];
}

interface UsageToday {
    aiCalls: number;
    projects: number;
    users: number;
}

interface UpgradeCtas {
    primaryAction: string;
    urlOrRoute: string;
}

interface PolicyMessages {
    bannerText: string | null;
    modalText: string | null;
}

export interface PolicySnapshot {
    orgType: 'DEMO' | 'TRIAL' | 'PAID';
    isDemo: boolean;
    isTrial: boolean;
    isPaid: boolean;
    trialStartedAt: string | null;
    trialExpiresAt: string | null;
    trialDaysLeft: number;
    isTrialExpired: boolean;
    warningLevel: 'none' | 'warning' | 'critical' | 'expired';
    limits: PolicyLimits | null;
    usageToday: UsageToday;
    blockedFeatures: string[];
    blockedActions: string[];
    upgradeCtas: UpgradeCtas;
    messages: PolicyMessages;
}

interface AccessPolicyContextValue {
    snapshot: PolicySnapshot | null;
    loading: boolean;
    error: string | null;
    refresh: () => Promise<void>;
    isActionBlocked: (action: string) => boolean;
    isFeatureBlocked: (feature: string) => boolean;
}

const AccessPolicyContext = createContext<AccessPolicyContextValue | undefined>(undefined);

// Helper to get auth token from localStorage
const getAuthToken = (): string | null => {
    try {
        const stored = localStorage.getItem('consultify-storage');
        if (stored) {
            const parsed = JSON.parse(stored);
            // Token may be stored in user object or separately
            return parsed.state?.currentUser?.token || localStorage.getItem('auth_token') || null;
        }
        return localStorage.getItem('auth_token');
    } catch {
        return null;
    }
};

export const AccessPolicyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { currentUser } = useAppStore();
    const [snapshot, setSnapshot] = useState<PolicySnapshot | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchSnapshot = useCallback(async () => {
        const token = getAuthToken();

        if (!currentUser || !token) {
            setSnapshot(null);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const response = await fetch('/api/organization/policy-snapshot', {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error('Failed to fetch policy snapshot');
            }

            const data = await response.json();
            setSnapshot(data);
        } catch (err: any) {
            console.error('[AccessPolicyContext] Error fetching snapshot:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [currentUser]);

    // Fetch on mount and auth change
    useEffect(() => {
        fetchSnapshot();
    }, [fetchSnapshot]);

    const isActionBlocked = useCallback((action: string): boolean => {
        if (!snapshot) return false;
        return snapshot.blockedActions.includes(action);
    }, [snapshot]);

    const isFeatureBlocked = useCallback((feature: string): boolean => {
        if (!snapshot) return false;
        return snapshot.blockedFeatures.includes(feature);
    }, [snapshot]);

    return (
        <AccessPolicyContext.Provider value={{
            snapshot,
            loading,
            error,
            refresh: fetchSnapshot,
            isActionBlocked,
            isFeatureBlocked
        }}>
            {children}
        </AccessPolicyContext.Provider>
    );
};

export const usePolicySnapshot = (): AccessPolicyContextValue => {
    const context = useContext(AccessPolicyContext);
    if (!context) {
        throw new Error('usePolicySnapshot must be used within AccessPolicyProvider');
    }
    return context;
};

// Convenience hooks
export const useIsDemo = (): boolean => {
    const { snapshot } = usePolicySnapshot();
    return snapshot?.isDemo ?? false;
};

export const useIsTrial = (): boolean => {
    const { snapshot } = usePolicySnapshot();
    return snapshot?.isTrial ?? false;
};

export const useIsPaid = (): boolean => {
    const { snapshot } = usePolicySnapshot();
    return snapshot?.isPaid ?? false;
};

export const useTrialDaysLeft = (): number => {
    const { snapshot } = usePolicySnapshot();
    return snapshot?.trialDaysLeft ?? 0;
};

export const useIsTrialExpired = (): boolean => {
    const { snapshot } = usePolicySnapshot();
    return snapshot?.isTrialExpired ?? false;
};

export default AccessPolicyContext;
