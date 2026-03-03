/**
 * Access Policy Context
 *
 * React Context for consuming policy snapshot (single source of truth)
 * UI should ONLY use this context for gating - no local calculations
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { useAppStore } from '../store/useAppStore';

interface PolicyLimits {
  maxProjects: number;
  maxUsers: number;
  maxAICallsPerDay: number;
  maxInitiatives: number;
  maxStorageMb: number;
  maxTotalTokens: number;
  aiRolesEnabled: string[];
}

interface UsageToday {
  aiCalls: number;
  projects: number;
  users: number;
  initiatives: number;
  storageMb: number;
  tokensUsed: number;
}

interface UsagePercent {
  aiCalls: number;
  projects: number;
  users: number;
  initiatives: number;
  storage: number;
  tokens: number;
}

interface UpgradeCtas {
  primaryAction: string;
  primaryActionKey: string;
  urlOrRoute: string;
  reason?: string;
}

interface PolicyMessages {
  bannerText: string | null;
  bannerTextKey: string | null;
  modalText: string | null;
  modalTextKey: string | null;
}

export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'canceling' | 'canceled';

export interface PolicySnapshot {
  orgType: 'DEMO' | 'TRIAL' | 'PAID';
  isDemo: boolean;
  isTrial: boolean;
  isPaid: boolean;
  subscriptionStatus: SubscriptionStatus | null;
  trialStartedAt: string | null;
  trialExpiresAt: string | null;
  trialDaysLeft: number;
  isTrialExpired: boolean;
  warningLevel: 'none' | 'warning' | 'critical' | 'expired';
  limits: PolicyLimits | null;
  usageToday: UsageToday;
  usagePercent: UsagePercent;
  blockedFeatures: string[];
  blockedActions: string[];
  upgradeCtas: UpgradeCtas;
  messages: PolicyMessages;
  hasPaymentMethod: boolean;
}

interface AccessPolicyContextValue {
  snapshot: PolicySnapshot | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  isActionBlocked: (action: string) => boolean;
  isFeatureBlocked: (feature: string) => boolean;
  isApproachingLimit: (resource: keyof UsagePercent) => boolean;
  isAtLimit: (resource: keyof UsagePercent) => boolean;
}

const AccessPolicyContext = createContext<AccessPolicyContextValue | undefined>(undefined);

const getAuthToken = (): string | null => {
  try {
    const stored = localStorage.getItem('consultify-storage');
    if (stored) {
      const parsed = JSON.parse(stored);
      return parsed.state?.currentUser?.token || localStorage.getItem('auth_token') || null;
    }
    return localStorage.getItem('auth_token');
  } catch {
    return null;
  }
};

export const AccessPolicyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const currentUser = useAppStore((s) => s.currentUser);
  const [snapshot, setSnapshot] = useState<PolicySnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const authKey = useMemo(() => {
    if (!currentUser?.isAuthenticated) return null;
    return currentUser.id || null;
  }, [currentUser?.id, currentUser?.isAuthenticated]);

  const fetchSnapshot = useCallback(async () => {
    const token = getAuthToken();

    if (!currentUser?.isAuthenticated || !token) {
      setSnapshot((prev) => (prev === null ? prev : null));
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/organization/policy-snapshot', {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.status === 404) {
        setSnapshot(null);
        return;
      }

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
  }, [currentUser?.isAuthenticated]);

  useEffect(() => {
    if (authKey) {
      fetchSnapshot();
    } else {
      setSnapshot(null);
    }
  }, [authKey, fetchSnapshot]);

  const isActionBlocked = useCallback(
    (action: string): boolean => {
      if (!snapshot) return false;
      return snapshot.blockedActions.includes(action);
    },
    [snapshot]
  );

  const isFeatureBlocked = useCallback(
    (feature: string): boolean => {
      if (!snapshot) return false;
      return snapshot.blockedFeatures.includes(feature);
    },
    [snapshot]
  );

  const isApproachingLimit = useCallback(
    (resource: keyof UsagePercent): boolean => {
      if (!snapshot?.usagePercent) return false;
      const pct = snapshot.usagePercent[resource];
      return pct >= 70 && pct < 100;
    },
    [snapshot]
  );

  const isAtLimit = useCallback(
    (resource: keyof UsagePercent): boolean => {
      if (!snapshot?.usagePercent) return false;
      return snapshot.usagePercent[resource] >= 100;
    },
    [snapshot]
  );

  return (
    <AccessPolicyContext.Provider
      value={{
        snapshot,
        loading,
        error,
        refresh: fetchSnapshot,
        isActionBlocked,
        isFeatureBlocked,
        isApproachingLimit,
        isAtLimit,
      }}
    >
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

export const useSubscriptionStatus = (): SubscriptionStatus | null => {
  const { snapshot } = usePolicySnapshot();
  return snapshot?.subscriptionStatus ?? null;
};

export const useWarningLevel = (): string => {
  const { snapshot } = usePolicySnapshot();
  return snapshot?.warningLevel ?? 'none';
};

export const useHasPaymentMethod = (): boolean => {
  const { snapshot } = usePolicySnapshot();
  return snapshot?.hasPaymentMethod ?? false;
};

export const useUpgradeCtas = (): PolicySnapshot['upgradeCtas'] | null => {
  const { snapshot } = usePolicySnapshot();
  return snapshot?.upgradeCtas ?? null;
};

export const useUsagePercent = (): UsagePercent | null => {
  const { snapshot } = usePolicySnapshot();
  return snapshot?.usagePercent ?? null;
};
