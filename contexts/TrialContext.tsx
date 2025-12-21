import { createContext, useContext, useEffect, useState } from 'react';
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
    refreshTrialStatus: async () => { },
};

const TrialContext = createContext<TrialState>(defaultState);

export const useTrial = () => useContext(TrialContext);

export const TrialProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { currentUser: user } = useAppStore();
    const token = localStorage.getItem('token'); // Fallback or from store if available (store doesn't expose it directly usually?)
    // Actually we should use Api class or similar, but for now lets try getting token from localStorage as useAppStore doesn't seem to have it?
    // checking useAppStore again.. it persists but doesn't explicitly type token.
    // However, the fetch call needs it.

    const [state, setState] = useState<TrialState>(defaultState);

    const refreshTrialStatus = async () => {
        if (!user) return;
        const storedToken = localStorage.getItem('token');
        if (!storedToken) return;

        try {
            // Fetch policy snapshot
            const response = await fetch('/api/access-control/policy', {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (response.ok) {
                const policy = await response.json();
                setState({
                    isTrial: policy.isTrial,
                    isExpired: policy.isTrialExpired,
                    daysRemaining: policy.trialDaysLeft,
                    trialExpiresAt: policy.trialExpiresAt,
                    limits: policy.limits,
                    usage: {
                        aiCalls: policy.usageToday.aiCalls,
                        projects: policy.usageToday.projects,
                        users: policy.usageToday.users,
                        trialTokensUsed: policy.trialTokenUsage?.tokensUsed || 0 // Assuming backend returns this
                    },
                    blockedActions: policy.blockedActions,
                    loading: false,
                    refreshTrialStatus
                });
            }
        } catch (err) {
            console.error("Failed to fetch trial status", err);
            setState(prev => ({ ...prev, loading: false }));
        }
    };

    useEffect(() => {
        if (user) {
            refreshTrialStatus();
        } else {
            setState(defaultState);
        }
    }, [user]);

    return (
        <TrialContext.Provider value={state}>
            {children}
        </TrialContext.Provider>
    );
};
