import {
  BarChart3,
  Brain,
  Briefcase,
  Eye,
  Home,
  MessageSquare,
  Minimize2,
  RotateCcw,
} from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Banner } from '@/components/shared/Banner';
import { LoadingState } from '@/components/ui/primitives';

import { invalidateDashboardPreferencesCache } from '../../hooks/useDashboardPreferences';
import { Api } from '../../services/api';
import { User } from '../../types';
import { normalizeApiErrorMessage } from '../../utils/apiError';
import { DegradedState } from '../Admin/AdminState';

interface DashboardPreferencesSettingsProps {
  currentUser: User;
  onUpdateUser: (updates: Partial<User>) => void;
}

interface DashboardPreferences {
  defaultLandingPage: string;
  showGreeting: boolean;
  compactMode: boolean;
  autoRefreshInterval: number;
  liveUpdates: boolean;
  widgets: {
    tasks: boolean;
    initiatives: boolean;
    calendar: boolean;
    aiInsights: boolean;
    recentActivity: boolean;
    quickActions: boolean;
    metrics: boolean;
  };
}

interface DashboardPreferencesResponse {
  preferences?: DashboardPreferences;
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

export const DashboardPreferencesSettings: React.FC<DashboardPreferencesSettingsProps> = ({
  currentUser,
}) => {
  const { t } = useTranslation();
  const [preferences, setPreferences] = useState<DashboardPreferences>(DEFAULT_PREFERENCES);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestPrefsRef = useRef<DashboardPreferences>(DEFAULT_PREFERENCES);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  const normalizePreferences = useCallback(
    (data: DashboardPreferencesResponse | null | undefined) => {
      if (!data?.preferences) return null;
      return {
        ...DEFAULT_PREFERENCES,
        ...data.preferences,
        widgets: { ...DEFAULT_PREFERENCES.widgets, ...data.preferences.widgets },
      };
    },
    []
  );

  const preferencesMatch = useCallback(
    (left: DashboardPreferences, right: DashboardPreferences) =>
      JSON.stringify(left) === JSON.stringify(right),
    []
  );

  const applyPersistedPreferences = useCallback(
    (data: DashboardPreferencesResponse | null | undefined) => {
      const merged = normalizePreferences(data);
      if (!merged) return null;
      setPreferences(merged);
      latestPrefsRef.current = merged;
      return merged;
    },
    [normalizePreferences]
  );

  const loadPreferences = useCallback(async () => {
    try {
      setLoadError(null);
      const data = (await Api.get(
        '/settings/preferences/dashboard'
      )) as DashboardPreferencesResponse;
      const merged = applyPersistedPreferences(data);
      if (!merged) {
        throw new Error('Dashboard preferences response was missing preferences');
      }
    } catch (error: unknown) {
      setLoadError(normalizeApiErrorMessage(error, 'Failed to load dashboard preferences'));
      setPreferences(DEFAULT_PREFERENCES);
      latestPrefsRef.current = DEFAULT_PREFERENCES;
    } finally {
      setLoading(false);
    }
  }, [applyPersistedPreferences]);

  useEffect(() => {
    void loadPreferences();
  }, [currentUser.id, loadPreferences]);

  const persistPreferences = useCallback(
    async (expected: DashboardPreferences) => {
      setActionError(null);
      await Api.put('/settings/preferences/dashboard', { preferences: expected });
      const persisted = (await Api.get(
        '/settings/preferences/dashboard'
      )) as DashboardPreferencesResponse;
      const merged = applyPersistedPreferences(persisted);
      if (!merged || !preferencesMatch(merged, expected)) {
        throw new Error('Dashboard preferences save was not confirmed by the server');
      }
      invalidateDashboardPreferencesCache();
      return merged;
    },
    [applyPersistedPreferences, preferencesMatch]
  );

  const debouncedSave = useCallback(
    (newPrefs: DashboardPreferences) => {
      latestPrefsRef.current = newPrefs;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(async () => {
        try {
          await persistPreferences(latestPrefsRef.current);
          toast.success(t('settings.dashboard.saved', 'Preferences saved'), {
            id: 'dash-prefs-save',
            duration: 1500,
          });
        } catch (error: unknown) {
          const message = normalizeApiErrorMessage(
            error,
            t('settings.dashboard.error', 'Failed to save preferences')
          );
          setActionError(message);
          toast.error(message);
        }
      }, 600);
    },
    [persistPreferences, t]
  );

  const updatePreference = <K extends keyof DashboardPreferences>(
    key: K,
    value: DashboardPreferences[K]
  ) => {
    setPreferences((prev) => {
      const next = { ...prev, [key]: value };
      debouncedSave(next);
      return next;
    });
  };

  const toggleWidget = (widget: keyof DashboardPreferences['widgets']) => {
    setPreferences((prev) => {
      const next = {
        ...prev,
        widgets: { ...prev.widgets, [widget]: !prev.widgets[widget] },
      };
      debouncedSave(next);
      return next;
    });
  };

  const handleReset = useCallback(async () => {
    setPreferences(DEFAULT_PREFERENCES);
    latestPrefsRef.current = DEFAULT_PREFERENCES;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    try {
      await persistPreferences(DEFAULT_PREFERENCES);
      toast.success(t('settings.dashboard.reset', 'Preferences reset to defaults'));
    } catch (error: unknown) {
      const message = normalizeApiErrorMessage(
        error,
        t('settings.dashboard.error', 'Failed to save preferences')
      );
      setActionError(message);
      toast.error(message);
    }
  }, [persistPreferences, t]);

  if (loading) {
    return <LoadingState variant="spinner" />;
  }

  // Only widgets that actually exist on the dashboard are exposed here. The
  // previous `tasks`, `calendar` and `recentActivity` toggles had no widget to
  // gate in DashboardOverview, so they were removed to avoid dead controls.
  const widgetOptions = [
    {
      key: 'initiatives' as const,
      label: t('settings.dashboard.widgets.initiatives', 'Active Initiatives'),
      icon: Briefcase,
    },
    {
      key: 'aiInsights' as const,
      label: t('settings.dashboard.widgets.aiInsights', 'AI Insights'),
      icon: Brain,
    },
    {
      key: 'quickActions' as const,
      label: t('settings.dashboard.widgets.quickActions', 'Quick Actions'),
      icon: Home,
    },
    {
      key: 'metrics' as const,
      label: t('settings.dashboard.widgets.metrics', 'Metrics Overview'),
      icon: BarChart3,
    },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 relative">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-c-text">
            {t('settings.dashboard.title', 'Dashboard Preferences')}
          </h2>
          <p className="text-c-text-muted text-sm mt-1">
            {t(
              'settings.dashboard.description',
              'Customize your dashboard layout and default views'
            )}
          </p>
        </div>
        <button
          onClick={handleReset}
          disabled={!!loadError}
          className="flex items-center gap-2 px-4 py-2 text-c-text-secondary hover:text-c-text dark:hover:text-white border border-c-border-subtle dark:border-navy-700 hover:border-c-border-subtle dark:hover:border-navy-600 rounded-lg transition-colors text-sm"
        >
          <RotateCcw size={14} />
          {t('settings.dashboard.resetDefaults', 'Reset to Defaults')}
        </button>
      </div>

      {loadError && (
        <DegradedState title="Dashboard preferences unavailable" description={loadError} />
      )}

      {actionError && <Banner variant="danger" title={actionError} />}

      {!loadError && (
        <>
          {/* Widget Visibility */}
          <div className="bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-c-text mb-4 flex items-center gap-2">
              <Eye size={20} className="text-green-500" />
              {t('settings.dashboard.widgetVisibility', 'Widget Visibility')}
            </h3>
            <p className="text-sm text-c-text-muted mb-4">
              {t(
                'settings.dashboard.widgetVisibilityDescription',
                'Choose which widgets to show on your dashboard'
              )}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {widgetOptions.map((option) => {
                const Icon = option.icon;
                const isEnabled = preferences.widgets[option.key];
                return (
                  <div
                    key={option.key}
                    className="flex items-center justify-between p-4 rounded-lg bg-c-surface-raised border border-c-border-subtle dark:border-navy-700"
                  >
                    <div className="flex items-center gap-3">
                      <Icon
                        size={20}
                        className={isEnabled ? 'text-green-500' : 'text-c-text-secondary'}
                      />
                      <span className="font-medium text-c-text-secondary">{option.label}</span>
                    </div>
                    <button
                      onClick={() => toggleWidget(option.key)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        isEnabled ? 'bg-green-600' : 'bg-c-surface-raised'
                      }`}
                    >
                      <span
                        className={`${isEnabled ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-c-surface transition-transform`}
                      />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Display Options */}
          <div className="bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-c-text mb-4 flex items-center gap-2">
              <Minimize2 size={20} className="text-c-accent" />
              {t('settings.dashboard.displayOptions', 'Display Options')}
            </h3>

            <div className="space-y-6">
              {/* Compact Mode */}
              <div className="flex items-center justify-between">
                <div>
                  <label className="block font-medium text-c-text-secondary">
                    {t('settings.dashboard.compactMode', 'Compact Mode')}
                  </label>
                  <p className="text-sm text-c-text-muted">
                    {t(
                      'settings.dashboard.compactModeDescription',
                      'Reduce padding and margins for denser information display'
                    )}
                  </p>
                </div>
                <button
                  onClick={() => updatePreference('compactMode', !preferences.compactMode)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    preferences.compactMode ? 'bg-navy-900' : 'bg-c-surface-raised'
                  }`}
                >
                  <span
                    className={`${preferences.compactMode ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-c-surface transition-transform`}
                  />
                </button>
              </div>

              {/* Show Greeting */}
              <div className="flex items-center justify-between pt-4 border-t border-c-border-subtle dark:border-navy-700">
                <div>
                  <label className="block font-medium text-c-text-secondary flex items-center gap-2">
                    <MessageSquare size={16} className="text-amber-500" />
                    {t('settings.dashboard.showGreeting', 'Show Greeting Message')}
                  </label>
                  <p className="text-sm text-c-text-muted">
                    {t(
                      'settings.dashboard.showGreetingDescription',
                      'Display personalized greeting on dashboard'
                    )}
                  </p>
                </div>
                <button
                  onClick={() => updatePreference('showGreeting', !preferences.showGreeting)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    preferences.showGreeting ? 'bg-navy-900' : 'bg-c-surface-raised'
                  }`}
                >
                  <span
                    className={`${preferences.showGreeting ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-c-surface transition-transform`}
                  />
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default DashboardPreferencesSettings;
