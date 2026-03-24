import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { useAppStore } from '../store/useAppStore';

interface TrialState {
  isTrial: boolean;
  isExpired: boolean;
  daysRemaining: number;
  trialExpiresAt: string | null;
  limits: {
    maxProjects: number;
    maxUsers: number;
    maxAICallsPerDay: number;
    maxInitiatives: number;
    maxStorageMb: number;
    maxTotalTokens: number;
  } | null;
  usage: {
    aiCalls: number;
    projects: number;
    users: number;
    trialTokensUsed: number;
  };
  blockedActions: string[];
  loading: boolean;
  refreshTrialStatus: () => Promise<void>;
}

const defaultState: TrialState = {
  isTrial: false,
  isExpired: false,
  daysRemaining: 0,
  trialExpiresAt: null,
  limits: null,
  usage: { aiCalls: 0, projects: 0, users: 0, trialTokensUsed: 0 },
  blockedActions: [],
  loading: true,
  refreshTrialStatus: async () => {},
};

const TrialContext = createContext<TrialState>(defaultState);

export const useTrial = () => useContext(TrialContext);

export const TrialProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // NOTE (React 19 + useSyncExternalStore):
  // Avoid selectors that return a new object each call (even with shallow),
  // because it can trigger "getSnapshot should be cached" warnings/loops.
  const user = useAppStore((s) => s.currentUser);

  const [state, setState] = useState<TrialState>(defaultState);

  const refreshTrialStatus = useCallback(async () => {
    if (!user?.isAuthenticated) return;
    const storedToken = localStorage.getItem('token');
    if (!storedToken) return;

    try {
      const headers: Record<string, string> = { Authorization: `Bearer ${storedToken}` };
      if (useAppStore.getState().isDemoMode) {
        headers['X-Demo-Mode'] = 'true';
      }
      const response = await fetch('/api/organization/policy-snapshot', { headers });

      if (response.status === 404) {
        // Endpoint may not exist in some dev/stub setups.
        setState((prev) => ({ ...prev, loading: false }));
        return;
      }

      if (response.ok) {
        const policy = await response.json();
        setState((prev) => ({
          ...prev,
          isTrial: policy.isTrial ?? false,
          isExpired: policy.isTrialExpired ?? false,
          daysRemaining: policy.trialDaysLeft ?? 0,
          trialExpiresAt: policy.trialExpiresAt ?? null,
          limits: policy.limits ?? null,
          usage: {
            aiCalls: policy.usageToday?.aiCalls ?? 0,
            projects: policy.usageToday?.projects ?? 0,
            users: policy.usageToday?.users ?? 0,
            trialTokensUsed: policy.trialTokenUsage?.tokensUsed ?? 0,
          },
          blockedActions: Array.isArray(policy.blockedActions) ? policy.blockedActions : [],
          loading: false,
        }));
      } else {
        // API returned non-200 - set safe defaults
        console.warn('[TrialContext] Policy snapshot returned:', response.status);
        setState((prev) => ({ ...prev, loading: false }));
      }
    } catch (err) {
      console.error('Failed to fetch trial status', err);
      setState((prev) => ({ ...prev, loading: false }));
    }
  }, [user?.isAuthenticated]);

  useEffect(() => {
    if (user?.isAuthenticated) {
      refreshTrialStatus();
    } else {
      queueMicrotask(() => setState({ ...defaultState, loading: false }));
    }
  }, [user?.isAuthenticated, refreshTrialStatus]);

  const value = useMemo<TrialState>(() => {
    return {
      ...state,
      refreshTrialStatus,
    };
  }, [state, refreshTrialStatus]);

  return <TrialContext.Provider value={value}>{children}</TrialContext.Provider>;
};
