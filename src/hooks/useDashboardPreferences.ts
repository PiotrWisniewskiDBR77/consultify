import { useCallback, useEffect, useRef, useState } from 'react';

import { Api } from '../services/api';

export interface DashboardWidgetVisibility {
  tasks: boolean;
  initiatives: boolean;
  calendar: boolean;
  aiInsights: boolean;
  recentActivity: boolean;
  quickActions: boolean;
  metrics: boolean;
}

export interface DashboardPreferences {
  defaultLandingPage: string;
  showGreeting: boolean;
  compactMode: boolean;
  autoRefreshInterval: number;
  liveUpdates: boolean;
  widgets: DashboardWidgetVisibility;
}

const DEFAULT_PREFERENCES: DashboardPreferences = {
  defaultLandingPage: 'ai-assistant',
  showGreeting: true,
  compactMode: false,
  autoRefreshInterval: 0,
  liveUpdates: false,
  widgets: {
    tasks: true,
    initiatives: true,
    calendar: true,
    aiInsights: true,
    recentActivity: true,
    quickActions: true,
    metrics: true,
  },
};

interface UseDashboardPreferencesReturn {
  preferences: DashboardPreferences;
  loading: boolean;
  refresh: () => Promise<void>;
}

let cachedPreferences: DashboardPreferences | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 60_000;

export function useDashboardPreferences(): UseDashboardPreferencesReturn {
  const [preferences, setPreferences] = useState<DashboardPreferences>(
    cachedPreferences ?? DEFAULT_PREFERENCES
  );
  const [loading, setLoading] = useState(!cachedPreferences);
  const mountedRef = useRef(true);

  const load = useCallback(async () => {
    const now = Date.now();
    if (cachedPreferences && now - cacheTimestamp < CACHE_TTL_MS) {
      setPreferences(cachedPreferences);
      setLoading(false);
      return;
    }

    try {
      const data = (await Api.get('/settings/preferences/dashboard')) as {
        preferences?: Partial<DashboardPreferences>;
      };
      if (data?.preferences && mountedRef.current) {
        const merged = {
          ...DEFAULT_PREFERENCES,
          ...data.preferences,
          widgets: { ...DEFAULT_PREFERENCES.widgets, ...data.preferences.widgets },
        };
        cachedPreferences = merged;
        cacheTimestamp = Date.now();
        setPreferences(merged);
      }
    } catch {
      // keep defaults
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    cachedPreferences = null;
    cacheTimestamp = 0;
    await load();
  }, [load]);

  useEffect(() => {
    mountedRef.current = true;
    load();
    return () => {
      mountedRef.current = false;
    };
  }, [load]);

  return { preferences, loading, refresh };
}

export function invalidateDashboardPreferencesCache() {
  cachedPreferences = null;
  cacheTimestamp = 0;
}
