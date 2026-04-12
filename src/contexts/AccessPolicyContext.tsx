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
export type BillingRail = 'stripe_subscription' | 'manual_invoice' | 'hybrid_usage_invoice';
export type ContractStatus =
  | 'draft'
  | 'active'
  | 'renewal_due'
  | 'grace'
  | 'suspended'
  | 'expired'
  | 'canceled';
export type AccessPosture =
  | 'demo_org'
  | 'demo_view'
  | 'trial_active'
  | 'trial_expiring'
  | 'trial_expired'
  | 'paid_active'
  | 'paid_past_due'
  | 'paid_canceling'
  | 'paid_manual_active'
  | 'paid_manual_renewal_due'
  | 'suspended';

export interface PolicySnapshot {
  orgType: 'DEMO' | 'TRIAL' | 'PAID';
  posture: AccessPosture;
  isDemo: boolean;
  isDemoView: boolean;
  isTrial: boolean;
  isPaid: boolean;
  billingRail: BillingRail | null;
  contractStatus: ContractStatus | null;
  subscriptionStatus: SubscriptionStatus | null;
  sourceOfTruth: 'trial_clock' | 'demo_mode' | 'stripe' | 'manual_contract';
  trialStartedAt: string | null;
  trialExpiresAt: string | null;
  trialDaysLeft: number;
  isTrialExpired: boolean;
  warningLevel: 'none' | 'warning' | 'critical' | 'expired';
  renewalAt?: string | null;
  graceUntil?: string | null;
  accessExpiresAt?: string | null;
  managedByUserId?: string | null;
  isManualBilling: boolean;
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

export const getAuthToken = (): string | null => {
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

const isPolicyBypassedRole = (role: unknown): boolean => {
  const normalizedRole = String(role || '').trim().toUpperCase();
  return normalizedRole === 'SUPERADMIN' || normalizedRole === 'SUPER_ADMIN';
};

export const AccessPolicyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const currentUser = useAppStore((s) => s.currentUser);
  const [snapshot, setSnapshot] = useState<PolicySnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const authKey = useMemo(() => {
    if (!currentUser?.isAuthenticated) return null;
    if (isPolicyBypassedRole(currentUser?.role)) return null;
    return currentUser.id || null;
  }, [currentUser?.id, currentUser?.isAuthenticated, currentUser?.role]);

  const fetchSnapshot = useCallback(async () => {
    if (isPolicyBypassedRole(currentUser?.role)) {
      setError(null);
      setLoading(false);
      setSnapshot((prev) => (prev === null ? prev : null));
      return;
    }

    const token = getAuthToken();

    if (!currentUser?.isAuthenticated || !token) {
      setSnapshot((prev) => (prev === null ? prev : null));
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const headers: Record<string, string> = {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      };
      if (useAppStore.getState().isDemoMode) {
        headers['X-Demo-Mode'] = 'true';
      }
      const response = await fetch('/api/organization/policy-snapshot', { headers });

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
  }, [currentUser?.isAuthenticated, currentUser?.role]);

  const isDemoMode = useAppStore((s) => s.isDemoMode);

  useEffect(() => {
    if (authKey) {
      fetchSnapshot();
    } else {
      setSnapshot(null);
    }
  }, [authKey, isDemoMode, fetchSnapshot]);

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
