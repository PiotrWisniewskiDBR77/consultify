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

import { API_URL, getHeaders } from '@/services/api';

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
  /** Allow local overrides (dev-only) */
  enableLocalOverrides?: boolean;
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
    id: 'myWorkNotebookV2',
    name: 'My Work Notebook (V2)',
    description: 'Backend-persisted Notebook with search + active notes surfaces',
    defaultValue: true,
    category: 'beta',
    allowLocalOverride: true,
  },
  {
    id: 'myWorkSignalsV2',
    name: 'My Work Signals Feed (V2)',
    description: 'Backend-driven signals feed with mute/snooze/dismiss learning loop',
    defaultValue: true,
    category: 'beta',
    allowLocalOverride: true,
  },
  {
    id: 'abTestingFramework',
    name: 'A/B Testing Framework',
    description: 'Experiment platform for A/B testing features with cohort allocation',
    defaultValue: false,
    category: 'performance',
    allowLocalOverride: true,
  },
  {
    id: 'landingProfitHeroV1',
    name: 'Landing: Profit Hero (V1)',
    description: 'Landing override: profit-first hero + video demo modal',
    defaultValue: false,
    category: 'experimental',
    allowLocalOverride: true,
  },
  {
    id: 'landingEpicHeroV1',
    name: 'Landing: Epic Hero (V1)',
    description: 'Landing override: cinematic hero (100vh) with floating preview + neon ambience',
    defaultValue: false,
    category: 'experimental',
    allowLocalOverride: true,
  },
  {
    id: 'landingHeroExperimentV2',
    name: 'Landing: Hero Experiment (V2)',
    description: '3-way bucketing on LP (control vs profit vs epic) with stable cohorts',
    defaultValue: true,
    category: 'experimental',
    allowLocalOverride: true,
  },
  {
    id: 'tablePlatformMetadataFirst',
    name: 'Table Platform: Metadata-First Backend',
    description:
      'Routes table persistence to the new metadata-first Records API instead of workspace graph',
    defaultValue: false,
    category: 'beta',
    allowLocalOverride: false,
  },
  {
    id: 'tablePlatformRecordsApi',
    name: 'Table Platform: Records API',
    description:
      'Enables the new /api/v1/bases and /api/v1/tables endpoints for the table platform',
    defaultValue: true,
    category: 'beta',
    allowLocalOverride: true,
  },
  {
    id: 'assessmentInitiativesWizard',
    name: 'Assessment: Initiatives Wizard',
    description: 'Controls the wizard flow for generated assessment initiatives',
    defaultValue: false,
    category: 'experimental',
    allowLocalOverride: false,
  },
  {
    id: 'mindmapHeuristicAiOverlays',
    name: 'Mind Map: Heuristic AI Overlays (DP-5)',
    description:
      'DP-5 honesty gate for mind-map overlays whose displayed result is a client-side ' +
      'heuristic rather than real LLM output: AIBranchBalancer (no LLM call at all), ' +
      'AISentimentOverlay (sentiment = confidence-threshold mapping), AIAutoClustering ' +
      '(cluster membership = substring match), AIDependencyDetector (node pairs default to ' +
      'indices the backend never returns). OFF by default until backed by real AI analysis.',
    defaultValue: false,
    category: 'ai',
    allowLocalOverride: true,
  },
];

// ============================================
// STORAGE HELPERS
// ============================================

const STORAGE_KEY = 'consultify_feature_flags';
const CLEARED_FLAG_OVERRIDES = new Set(['tablePlatformMetadataFirst']);

function sanitizeStoredOverrides(overrides: Record<string, boolean>): Record<string, boolean> {
  if (!overrides || typeof overrides !== 'object') return {};
  const next = { ...overrides };
  for (const flagId of CLEARED_FLAG_OVERRIDES) {
    delete next[flagId];
  }
  return next;
}

function getStoredOverrides(): Record<string, boolean> {
  if (typeof window === 'undefined') return {};

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    const parsed = stored ? JSON.parse(stored) : {};
    const sanitized = sanitizeStoredOverrides(parsed);
    if (stored && JSON.stringify(parsed) !== JSON.stringify(sanitized)) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitized));
    }
    return sanitized;
  } catch {
    return {};
  }
}

function setStoredOverrides(overrides: Record<string, boolean>): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitizeStoredOverrides(overrides)));
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
  const { flags: customFlags = [], remoteEndpoint, userId, enableLocalOverrides = false } = config;

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
    const endpoint = remoteEndpoint ?? `${API_URL}/feature-flags/runtime`;
    const headers = getHeaders();
    const hasAuthToken = Boolean(headers.Authorization && headers.Authorization.trim());

    if (!remoteEndpoint && !hasAuthToken) {
      setRemoteFlags({});
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(endpoint, { headers });

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
  }, [remoteEndpoint]);

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
      if (enableLocalOverrides && flag.allowLocalOverride && flag.id in localOverrides) {
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

    for (const [flagId, value] of Object.entries(remoteFlags)) {
      if (!(flagId in result)) {
        result[flagId] = Boolean(value);
      }
    }

    return result;
  }, [enableLocalOverrides, flagDefinitions, localOverrides, remoteFlags, userId]);

  // Check if a flag is enabled
  const isEnabled = useCallback(
    (flagId: string): boolean => {
      return flags[flagId] ?? false;
    },
    [flags]
  );

  // Set a local override
  const setFlag = useCallback(
    (flagId: string, value: boolean): void => {
      const flag = flagDefinitions.find((f) => f.id === flagId);

      // Only allow override if flag exists and permits it
      if (!enableLocalOverrides || !flag || flag.allowLocalOverride === false) {
        console.warn(`Cannot override flag: ${flagId}`);
        return;
      }

      setLocalOverrides((prev) => {
        const updated = { ...prev, [flagId]: value };
        setStoredOverrides(updated);
        return updated;
      });
    },
    [enableLocalOverrides, flagDefinitions]
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
    [flagDefinitions]
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
