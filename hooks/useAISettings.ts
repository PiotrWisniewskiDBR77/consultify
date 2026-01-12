/**
 * useAISettings Hook
 *
 * React hook for fetching and managing AI settings.
 * Provides access to effective settings, proactivity mode, and update methods.
 */

import { useCallback, useEffect, useState } from 'react';

import { AIProactivityMode, EffectiveAISettings, ProactivityBehavior, UserAISettings } from '../types';

interface UseAISettingsReturn {
    // Effective settings (merged from all levels)
    effectiveSettings: EffectiveAISettings | null;

    // User settings (editable)
    userSettings: UserAISettings | null;

    // Proactivity
    proactivityMode: AIProactivityMode;
    proactivityBehavior: ProactivityBehavior;
    setProactivityMode: (mode: AIProactivityMode) => Promise<void>;

    // Available models
    availableModels: Array<{ id: string; name: string; provider: string }>;

    // State
    loading: boolean;
    error: string | null;

    // Actions
    updateUserSettings: (settings: Partial<UserAISettings>) => Promise<void>;
    refresh: () => Promise<void>;
}

// Default proactivity behaviors
const PROACTIVITY_BEHAVIORS: Record<AIProactivityMode, ProactivityBehavior> = {
    REACTIVE: {
        autoSuggest: false,
        nudges: false,
        contextualHints: false,
        initiateConversation: false,
    },
    BALANCED: {
        autoSuggest: true,
        nudges: true,
        contextualHints: true,
        initiateConversation: false,
    },
    PROACTIVE: {
        autoSuggest: true,
        nudges: true,
        contextualHints: true,
        initiateConversation: true,
    },
};

export const useAISettings = (): UseAISettingsReturn => {
    const [effectiveSettings, setEffectiveSettings] = useState<EffectiveAISettings | null>(null);
    const [userSettings, setUserSettings] = useState<UserAISettings | null>(null);
    const [availableModels, setAvailableModels] = useState<Array<{ id: string; name: string; provider: string }>>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Derived proactivity values
    const proactivityMode: AIProactivityMode = effectiveSettings?.proactivityMode || 'BALANCED';
    const proactivityBehavior: ProactivityBehavior = PROACTIVITY_BEHAVIORS[proactivityMode];

    const fetchSettings = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            const token = localStorage.getItem('token');
            const headers = { Authorization: `Bearer ${token}` };

            // Fetch all settings in parallel
            const [effectiveRes, userRes, modelsRes] = await Promise.all([
                fetch('/api/ai-settings/effective', { headers }),
                fetch('/api/ai-settings/user', { headers }),
                fetch('/api/ai-settings/available-models', { headers }),
            ]);

            if (effectiveRes.ok) {
                const data = await effectiveRes.json();
                setEffectiveSettings(data);
            }

            if (userRes.ok) {
                const data = await userRes.json();
                setUserSettings(data);
            }

            if (modelsRes.ok) {
                const data = await modelsRes.json();
                setAvailableModels(data);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load AI settings');
        } finally {
            setLoading(false);
        }
    }, []);

    // Initial fetch
    useEffect(() => {
        fetchSettings();
    }, [fetchSettings]);

    // Set proactivity mode
    const setProactivityMode = useCallback(async (mode: AIProactivityMode) => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch('/api/ai-settings/user', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ proactivityMode: mode }),
            });

            if (!res.ok) {
                throw new Error('Failed to update proactivity mode');
            }

            // Update local state
            setUserSettings((prev) => (prev ? { ...prev, proactivityMode: mode } : null));
            setEffectiveSettings((prev) =>
                prev
                    ? {
                          ...prev,
                          proactivityMode: mode,
                          proactivityBehavior: PROACTIVITY_BEHAVIORS[mode],
                      }
                    : null,
            );
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to update settings');
            throw err;
        }
    }, []);

    // Update user settings
    const updateUserSettings = useCallback(
        async (settings: Partial<UserAISettings>) => {
            try {
                const token = localStorage.getItem('token');
                const res = await fetch('/api/ai-settings/user', {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify(settings),
                });

                if (!res.ok) {
                    throw new Error('Failed to update settings');
                }

                const updated = await res.json();
                setUserSettings(updated);

                // Refresh effective settings
                await fetchSettings();
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to update settings');
                throw err;
            }
        },
        [fetchSettings],
    );

    return {
        effectiveSettings,
        userSettings,
        proactivityMode,
        proactivityBehavior,
        setProactivityMode,
        availableModels,
        loading,
        error,
        updateUserSettings,
        refresh: fetchSettings,
    };
};

/**
 * useProactivityMode Hook
 *
 * Simplified hook for just proactivity mode and behaviors.
 */
export const useProactivityMode = () => {
    const { proactivityMode, proactivityBehavior, setProactivityMode, loading } = useAISettings();

    return {
        mode: proactivityMode,
        behaviors: proactivityBehavior,
        setMode: setProactivityMode,
        loading,

        // Convenience checks
        isReactive: proactivityMode === 'REACTIVE',
        isBalanced: proactivityMode === 'BALANCED',
        isProactive: proactivityMode === 'PROACTIVE',

        // Behavior checks
        canAutoSuggest: proactivityBehavior.autoSuggest,
        canShowNudges: proactivityBehavior.nudges,
        canShowHints: proactivityBehavior.contextualHints,
        canInitiateConversation: proactivityBehavior.initiateConversation,
    };
};

export default useAISettings;
