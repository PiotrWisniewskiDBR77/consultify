import {
  BarChart3,
  Brain,
  Briefcase,
  Calendar,
  CheckSquare,
  Eye,
  Home,
  LayoutDashboard,
  MessageSquare,
  Minimize2,
  RefreshCw,
  RotateCcw,
  Zap,
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
import { InfoButton } from '../shared/InfoButton';

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

  const landingPageOptions = [
    { value: 'ai-assistant', label: t('settings.dashboard.pages.ai', 'AI Chat'), icon: Brain },
    { value: 'my-work', label: t('settings.dashboard.pages.myWork', 'My Work'), icon: Home },
    {
      value: 'projects',
      label: t('settings.dashboard.pages.projects', 'Projects'),
      icon: Briefcase,
    },
    { value: 'tasks', label: t('settings.dashboard.pages.tasks', 'My Tasks'), icon: CheckSquare },
    {
      value: 'calendar',
      label: t('settings.dashboard.pages.calendar', 'Calendar'),
      icon: Calendar,
    },
    {
      value: 'dashboard',
      label: t('settings.dashboard.pages.dashboard', 'Dashboard'),
      icon: LayoutDashboard,
    },
    {
      value: 'initiatives',
      label: t('settings.dashboard.pages.initiatives', 'Initiatives'),
      icon: Briefcase,
    },
  ];

  const widgetOptions = [
    {
      key: 'tasks' as const,
      label: t('settings.dashboard.widgets.tasks', 'My Tasks'),
      icon: CheckSquare,
    },
    {
      key: 'initiatives' as const,
      label: t('settings.dashboard.widgets.initiatives', 'Active Initiatives'),
      icon: Briefcase,
    },
    {
      key: 'calendar' as const,
      label: t('settings.dashboard.widgets.calendar', 'Calendar Preview'),
      icon: Calendar,
    },
    {
      key: 'aiInsights' as const,
      label: t('settings.dashboard.widgets.aiInsights', 'AI Insights'),
      icon: Brain,
    },
    {
      key: 'recentActivity' as const,
      label: t('settings.dashboard.widgets.activity', 'Recent Activity'),
      icon: RefreshCw,
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
      <InfoButton cardId="settings-profile" position="top-right" />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
            {t('settings.dashboard.title', 'Dashboard Preferences')}
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            {t(
              'settings.dashboard.description',
              'Customize your dashboard layout and default views'
            )}
          </p>
        </div>
        <button
          onClick={handleReset}
          disabled={!!loadError}
          className="flex items-center gap-2 px-4 py-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-navy-700 hover:border-slate-300 dark:hover:border-navy-600 rounded-lg transition-colors text-sm"
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
          {/* Default Landing Page */}
          <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <Home size={20} className="text-blue-500" />
              {t('settings.dashboard.landingPage', 'Default Landing Page')}
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
              {t(
                'settings.dashboard.landingPageDescription',
                'Choose where you want to land after logging in'
              )}
            </p>

            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
              {landingPageOptions.map((option) => {
                const Icon = option.icon;
                const isSelected = preferences.defaultLandingPage === option.value;
                return (
                  <button
                    key={option.value}
                    onClick={() => updatePreference('defaultLandingPage', option.value)}
                    className={`p-4 rounded-xl border-2 transition-all text-center ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10'
                        : 'border-slate-200 dark:border-navy-700 hover:border-blue-300 dark:hover:border-blue-500/50'
                    }`}
                  >
                    <Icon
                      size={24}
                      className={`mx-auto ${isSelected ? 'text-blue-600' : 'text-slate-600 dark:text-slate-500'}`}
                    />
                    <div
                      className={`mt-2 text-xs font-medium ${isSelected ? 'text-blue-700 dark:text-blue-400' : 'text-slate-700 dark:text-slate-300'}`}
                    >
                      {option.label}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Widget Visibility */}
          <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <Eye size={20} className="text-green-500" />
              {t('settings.dashboard.widgetVisibility', 'Widget Visibility')}
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
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
                    className="flex items-center justify-between p-4 rounded-lg bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-700"
                  >
                    <div className="flex items-center gap-3">
                      <Icon
                        size={20}
                        className={
                          isEnabled ? 'text-green-500' : 'text-slate-600 dark:text-slate-500'
                        }
                      />
                      <span className="font-medium text-slate-700 dark:text-slate-300">
                        {option.label}
                      </span>
                    </div>
                    <button
                      onClick={() => toggleWidget(option.key)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        isEnabled ? 'bg-green-600' : 'bg-slate-200 dark:bg-slate-700'
                      }`}
                    >
                      <span
                        className={`${isEnabled ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white dark:bg-navy-900 transition-transform`}
                      />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Display Options */}
          <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <Minimize2 size={20} className="text-primary-500" />
              {t('settings.dashboard.displayOptions', 'Display Options')}
            </h3>

            <div className="space-y-6">
              {/* Compact Mode */}
              <div className="flex items-center justify-between">
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300">
                    {t('settings.dashboard.compactMode', 'Compact Mode')}
                  </label>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {t(
                      'settings.dashboard.compactModeDescription',
                      'Reduce padding and margins for denser information display'
                    )}
                  </p>
                </div>
                <button
                  onClick={() => updatePreference('compactMode', !preferences.compactMode)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    preferences.compactMode ? 'bg-primary-600' : 'bg-slate-200 dark:bg-slate-700'
                  }`}
                >
                  <span
                    className={`${preferences.compactMode ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white dark:bg-navy-900 transition-transform`}
                  />
                </button>
              </div>

              {/* Show Greeting */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-navy-700">
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
                    <MessageSquare size={16} className="text-amber-500" />
                    {t('settings.dashboard.showGreeting', 'Show Greeting Message')}
                  </label>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {t(
                      'settings.dashboard.showGreetingDescription',
                      'Display personalized greeting on dashboard'
                    )}
                  </p>
                </div>
                <button
                  onClick={() => updatePreference('showGreeting', !preferences.showGreeting)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    preferences.showGreeting ? 'bg-primary-600' : 'bg-slate-200 dark:bg-slate-700'
                  }`}
                >
                  <span
                    className={`${preferences.showGreeting ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white dark:bg-navy-900 transition-transform`}
                  />
                </button>
              </div>

              {/* Live Updates */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-navy-700">
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
                    <Zap size={16} className="text-blue-500" />
                    {t('settings.dashboard.liveUpdates', 'Live Updates')}
                  </label>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {t(
                      'settings.dashboard.liveUpdatesDescription',
                      'Automatically refresh dashboard data when changes occur'
                    )}
                  </p>
                </div>
                <button
                  onClick={() => updatePreference('liveUpdates', !preferences.liveUpdates)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    preferences.liveUpdates ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-700'
                  }`}
                >
                  <span
                    className={`${preferences.liveUpdates ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white dark:bg-navy-900 transition-transform`}
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
