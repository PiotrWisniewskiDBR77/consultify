/**
 * useFeatureFlags Hook - Feature Flag Management
 *
 * Enterprise-grade feature flag system with local storage persistence,
 * remote flag support, and development tools.
 *
 * @example
 * // Check a feature flag
 * const { isEnabled, flags } = useFeatureFlags();
 * if (isEnabled('newSidebar')) {
 *   return <NewSidebar />;
 * }
 *
 * // Toggle a flag in development
 * const { setFlag } = useFeatureFlags();
 * setFlag('commandPalette', true);
 */

import { useCallback, useEffect, useMemo, useState } from 'react';

// ============================================
// TYPES
// ============================================

export interface FeatureFlag {
    /** Unique flag identifier */
    id: string;
    /** Human-readable name */
    name: string;
    /** Flag description */
    description?: string;
    /** Whether the flag is enabled by default */
    defaultValue: boolean;
    /** Category for organization */
    category: 'ui' | 'ai' | 'performance' | 'experimental' | 'beta';
    /** Flag expiry date (for temporary flags) */
    expiresAt?: Date;
    /** Percentage rollout (0-100) */
    rolloutPercent?: number;
    /** Whether the flag can be toggled locally */
    allowLocalOverride?: boolean;
}

export interface FeatureFlagsConfig {
    /** Available feature flags */
    flags: FeatureFlag[];
    /** Remote endpoint for fetching flags */
    remoteEndpoint?: string;
    /** Enable DevTools panel */
    enableDevTools?: boolean;
    /** Storage key prefix */
    storagePrefix?: string;
    /** User ID for consistent rollout */
    userId?: string;
}

export interface UseFeatureFlagsReturn {
    /** Check if a feature flag is enabled */
    isEnabled: (flagId: string) => boolean;
    /** Get all flag values */
    flags: Record<string, boolean>;
    /** Set a local flag override */
    setFlag: (flagId: string, value: boolean) => void;
    /** Clear a local override */
    clearOverride: (flagId: string) => void;
    /** Clear all local overrides */
    clearAllOverrides: () => void;
    /** Get flag metadata */
    getFlagInfo: (flagId: string) => FeatureFlag | undefined;
    /** All flag definitions */
    flagDefinitions: FeatureFlag[];
    /** Loading state for remote flags */
    isLoading: boolean;
    /** Error from remote flag fetch */
    error: Error | null;
    /** Refresh flags from remote */
    refresh: () => Promise<void>;
}

// ============================================
// DEFAULT FLAGS
// ============================================

export const DEFAULT_FLAGS: FeatureFlag[] = [
    {
        id: 'newSidebar',
        name: 'New HIG Sidebar',
        description: 'Apple Human Interface Guidelines compliant sidebar',
        defaultValue: true,
        category: 'ui',
        allowLocalOverride: true,
    },
    {
        id: 'commandPalette',
        name: 'Command Palette (Cmd+K)',
        description: 'Quick navigation via keyboard shortcut',
        defaultValue: true,
        category: 'ui',
        allowLocalOverride: true,
    },
    {
        id: 'darkModeRefined',
        name: 'Refined Dark Mode',
        description: 'Softer dark mode colors for reduced eye strain',
        defaultValue: true,
        category: 'ui',
        allowLocalOverride: true,
    },
    {
        id: 'optimizedImages',
        name: 'Optimized Images',
        description: 'Lazy loading and WebP support for images',
        defaultValue: true,
        category: 'performance',
        allowLocalOverride: true,
    },
    {
        id: 'aiThinkingVisualization',
        name: 'AI Thinking Visualization',
        description: 'Show AI reasoning steps during processing',
        defaultValue: true,
        category: 'ai',
        allowLocalOverride: true,
    },
    {
        id: 'aiStreamingResponses',
        name: 'AI Streaming Responses',
        description: 'Stream AI responses in real-time',
        defaultValue: true,
        category: 'ai',
        allowLocalOverride: true,
    },
    {
        id: 'advancedAnalytics',
        name: 'Advanced Analytics',
        description: 'Detailed usage analytics and metrics',
        defaultValue: false,
        category: 'beta',
        allowLocalOverride: true,
    },
    {
        id: 'experimentalCharts',
        name: 'Experimental Charts',
        description: 'New chart visualizations (may be unstable)',
        defaultValue: false,
        category: 'experimental',
        allowLocalOverride: true,
    },
];

// ============================================
// STORAGE HELPERS
// ============================================

const STORAGE_KEY = 'consultinity_feature_flags';

function getStoredOverrides(): Record<string, boolean> {
    if (typeof window === 'undefined') return {};

    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        return stored ? JSON.parse(stored) : {};
    } catch {
        return {};
    }
}

function setStoredOverrides(overrides: Record<string, boolean>): void {
    if (typeof window === 'undefined') return;

    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
    } catch {
        // Storage full or unavailable
    }
}

// ============================================
// ROLLOUT HELPERS
// ============================================

/**
 * Deterministic hash for consistent rollout based on user ID and flag ID
 */
function hashStringToNumber(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
}

function isInRollout(flagId: string, userId: string, percent: number): boolean {
    const hash = hashStringToNumber(`${flagId}:${userId}`);
    return hash % 100 < percent;
}

// ============================================
// HOOK
// ============================================

export function useFeatureFlags(config: Partial<FeatureFlagsConfig> = {}): UseFeatureFlagsReturn {
    const { flags: customFlags = [], remoteEndpoint, userId } = config;

    // Merge default and custom flags
    const flagDefinitions = useMemo(() => {
        const defaultIds = new Set(DEFAULT_FLAGS.map((f) => f.id));
        const uniqueCustom = customFlags.filter((f) => !defaultIds.has(f.id));
        return [...DEFAULT_FLAGS, ...uniqueCustom];
    }, [customFlags]);

    // State
    const [localOverrides, setLocalOverrides] = useState<Record<string, boolean>>(getStoredOverrides);
    const [remoteFlags, setRemoteFlags] = useState<Record<string, boolean>>({});
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    // Fetch remote flags
    const fetchRemoteFlags = useCallback(async () => {
        if (!remoteEndpoint) return;

        setIsLoading(true);
        setError(null);

        try {
            const response = await fetch(remoteEndpoint, {
                headers: {
                    'Content-Type': 'application/json',
                    ...(userId && { 'X-User-Id': userId }),
                },
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch flags: ${response.statusText}`);
            }

            const data = await response.json();
            setRemoteFlags(data.flags || {});
        } catch (err) {
            setError(err instanceof Error ? err : new Error('Unknown error'));
        } finally {
            setIsLoading(false);
        }
    }, [remoteEndpoint, userId]);

    // Initial fetch
    useEffect(() => {
        fetchRemoteFlags();
    }, [fetchRemoteFlags]);

    // Compute final flag values
    const flags = useMemo(() => {
        const result: Record<string, boolean> = {};

        for (const flag of flagDefinitions) {
            // Check if expired
            if (flag.expiresAt && new Date() > new Date(flag.expiresAt)) {
                result[flag.id] = false;
                continue;
            }

            // Priority: local override > remote > rollout > default
            if (flag.allowLocalOverride && flag.id in localOverrides) {
                result[flag.id] = localOverrides[flag.id];
                continue;
            }

            if (flag.id in remoteFlags) {
                result[flag.id] = remoteFlags[flag.id];
                continue;
            }

            // Check rollout percentage
            if (flag.rolloutPercent !== undefined && userId) {
                result[flag.id] = isInRollout(flag.id, userId, flag.rolloutPercent);
                continue;
            }

            result[flag.id] = flag.defaultValue;
        }

        return result;
    }, [flagDefinitions, localOverrides, remoteFlags, userId]);

    // Check if a flag is enabled
    const isEnabled = useCallback(
        (flagId: string): boolean => {
            return flags[flagId] ?? false;
        },
        [flags],
    );

    // Set a local override
    const setFlag = useCallback(
        (flagId: string, value: boolean): void => {
            const flag = flagDefinitions.find((f) => f.id === flagId);

            // Only allow override if flag exists and permits it
            if (!flag || flag.allowLocalOverride === false) {
                console.warn(`Cannot override flag: ${flagId}`);
                return;
            }

            setLocalOverrides((prev) => {
                const updated = { ...prev, [flagId]: value };
                setStoredOverrides(updated);
                return updated;
            });
        },
        [flagDefinitions],
    );

    // Clear a single override
    const clearOverride = useCallback((flagId: string): void => {
        setLocalOverrides((prev) => {
            const { [flagId]: _, ...rest } = prev;
            setStoredOverrides(rest);
            return rest;
        });
    }, []);

    // Clear all overrides
    const clearAllOverrides = useCallback((): void => {
        setLocalOverrides({});
        setStoredOverrides({});
    }, []);

    // Get flag metadata
    const getFlagInfo = useCallback(
        (flagId: string): FeatureFlag | undefined => {
            return flagDefinitions.find((f) => f.id === flagId);
        },
        [flagDefinitions],
    );

    return {
        isEnabled,
        flags,
        setFlag,
        clearOverride,
        clearAllOverrides,
        getFlagInfo,
        flagDefinitions,
        isLoading,
        error,
        refresh: fetchRemoteFlags,
    };
}

export default useFeatureFlags;
