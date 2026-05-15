import { createContext, useContext, useMemo } from 'react';

import { usePolicySnapshot } from './AccessPolicyContext';

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
  const { snapshot, loading, refresh } = usePolicySnapshot();

  const value = useMemo<TrialState>(() => {
    return {
      isTrial: snapshot?.isTrial ?? false,
      isExpired: snapshot?.isTrialExpired ?? false,
      daysRemaining: snapshot?.trialDaysLeft ?? 0,
      trialExpiresAt: snapshot?.trialExpiresAt ?? null,
      limits: snapshot?.limits
        ? {
            maxProjects: snapshot.limits.maxProjects,
            maxUsers: snapshot.limits.maxUsers,
            maxAICallsPerDay: snapshot.limits.maxAICallsPerDay,
            maxInitiatives: snapshot.limits.maxInitiatives,
            maxStorageMb: snapshot.limits.maxStorageMb,
            maxTotalTokens: snapshot.limits.maxTotalTokens,
          }
        : null,
      usage: {
        aiCalls: snapshot?.usageToday?.aiCalls ?? 0,
        projects: snapshot?.usageToday?.projects ?? 0,
        users: snapshot?.usageToday?.users ?? 0,
        trialTokensUsed: snapshot?.usageToday?.tokensUsed ?? 0,
      },
      blockedActions: Array.isArray(snapshot?.blockedActions) ? snapshot.blockedActions : [],
      loading,
      refreshTrialStatus: refresh,
    };
  }, [snapshot, loading, refresh]);

  return <TrialContext.Provider value={value}>{children}</TrialContext.Provider>;
};
