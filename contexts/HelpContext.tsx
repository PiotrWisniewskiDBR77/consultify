/**
 * Help Context
 * 
 * React Context for the In-App Help + Training + Playbooks system.
 * Provides contextual help based on AccessPolicy and user role.
 * 
 * Step 6: Enterprise+ Ready
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAppStore } from '../store/useAppStore';

// Types
export interface PlaybookStep {
    id: string;
    stepOrder: number;
    title: string;
    contentMd: string;
    uiTarget: string | null;
    actionType: 'INFO' | 'CTA' | 'LINK';
    actionPayload: Record<string, any>;
}

export interface Playbook {
    id: string;
    key: string;
    title: string;
    description: string | null;
    targetRole: string;
    targetOrgType: string;
    priority: number;
    isActive: boolean;
    isCompleted: boolean;
    isDismissed: boolean;
    status: 'AVAILABLE' | 'COMPLETED' | 'DISMISSED';
    isRecommended?: boolean;
    recommendationReason?: string;
    steps?: PlaybookStep[];
}

export interface HelpHint {
    featureKey: string;
    isBlocked: boolean;
    isLimited: boolean;
    reason: string | null;
    playbook: {
        key: string;
        title: string;
        description: string;
    } | null;
    suggestedAction: 'upgrade' | 'learn' | null;
}

interface HelpContextValue {
    playbooks: Playbook[];
    loading: boolean;
    error: string | null;
    refresh: () => Promise<void>;
    logEvent: (playbookKey: string, eventType: string, context?: Record<string, any>) => Promise<void>;
    getPlaybook: (key: string) => Promise<Playbook | null>;
    getHelpHint: (featureKey: string) => Promise<HelpHint | null>;
    isPanelOpen: boolean;
    setPanelOpen: (open: boolean) => void;
    currentRoute: string;
    setCurrentRoute: (route: string) => void;
}

const HelpContext = createContext<HelpContextValue | undefined>(undefined);

// Helper to get auth token
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

export const HelpProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { currentUser } = useAppStore();
    const [playbooks, setPlaybooks] = useState<Playbook[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isPanelOpen, setPanelOpen] = useState(false);
    const [currentRoute, setCurrentRoute] = useState<string>('');

    // Fetch playbooks
    const fetchPlaybooks = useCallback(async () => {
        const token = getAuthToken();
        if (!currentUser || !token) {
            setPlaybooks([]);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const response = await fetch(`/api/help/playbooks?route=${encodeURIComponent(currentRoute)}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error('Failed to fetch playbooks');
            }

            const data = await response.json();
            setPlaybooks(data.playbooks || []);
        } catch (err: any) {
            console.error('[HelpContext] Error fetching playbooks:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [currentUser, currentRoute]);

    // Fetch on mount and when route changes
    useEffect(() => {
        if (currentUser) {
            fetchPlaybooks();
        }
    }, [fetchPlaybooks, currentUser]);

    // Log event (append-only)
    const logEvent = useCallback(async (
        playbookKey: string,
        eventType: string,
        context: Record<string, any> = {}
    ) => {
        const token = getAuthToken();
        if (!token) return;

        try {
            await fetch('/api/help/events', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    playbookKey,
                    eventType,
                    context: {
                        ...context,
                        route: currentRoute
                    }
                })
            });

            // Refresh playbooks to update completion status
            if (eventType === 'COMPLETED' || eventType === 'DISMISSED') {
                await fetchPlaybooks();
            }
        } catch (err) {
            console.error('[HelpContext] Error logging event:', err);
        }
    }, [currentRoute, fetchPlaybooks]);

    // Get single playbook with steps
    const getPlaybook = useCallback(async (key: string): Promise<Playbook | null> => {
        const token = getAuthToken();
        if (!token) return null;

        try {
            const response = await fetch(`/api/help/playbooks/${key}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                return null;
            }

            return await response.json();
        } catch (err) {
            console.error('[HelpContext] Error fetching playbook:', err);
            return null;
        }
    }, []);

    // Get help hint for feature
    const getHelpHint = useCallback(async (featureKey: string): Promise<HelpHint | null> => {
        const token = getAuthToken();
        if (!token) return null;

        try {
            const response = await fetch(`/api/help/hint/${featureKey}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                return null;
            }

            const data = await response.json();
            return data.hint;
        } catch (err) {
            console.error('[HelpContext] Error fetching hint:', err);
            return null;
        }
    }, []);

    return (
        <HelpContext.Provider value={{
            playbooks,
            loading,
            error,
            refresh: fetchPlaybooks,
            logEvent,
            getPlaybook,
            getHelpHint,
            isPanelOpen,
            setPanelOpen,
            currentRoute,
            setCurrentRoute
        }}>
            {children}
        </HelpContext.Provider>
    );
};

// Main hook
export const useHelp = (): HelpContextValue => {
    const context = useContext(HelpContext);
    if (!context) {
        throw new Error('useHelp must be used within HelpProvider');
    }
    return context;
};

// Convenience hooks
export const useHelpPlaybooks = (): Playbook[] => {
    const { playbooks } = useHelp();
    return playbooks;
};

export const useHelpPanel = () => {
    const { isPanelOpen, setPanelOpen } = useHelp();
    return { isPanelOpen, openPanel: () => setPanelOpen(true), closePanel: () => setPanelOpen(false) };
};

/**
 * Hook for inline help hints
 * Use in components to show contextual help for specific features
 */
export const useHelpHint = (featureKey: string) => {
    const { getHelpHint } = useHelp();
    const [hint, setHint] = useState<HelpHint | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!featureKey) return;

        setLoading(true);
        getHelpHint(featureKey)
            .then(setHint)
            .finally(() => setLoading(false));
    }, [featureKey, getHelpHint]);

    return { hint, loading };
};
