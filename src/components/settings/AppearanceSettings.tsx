/**
 * AppearanceSettings Component
 *
 * Combines theme, UI density, start page, and font scale settings
 * for a complete appearance customization experience.
 */

import {
  CheckCircle,
  Home,
  Layout,
  LayoutGrid,
  Loader2,
  Minus,
  Monitor,
  Moon,
  Palette,
  Plus,
  Save,
  Sun,
  Type,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { LoadingState } from '@/components/ui/primitives';

import {
  changeLanguage,
  LANGUAGE_NAMES,
  SUPPORTED_LANGUAGES,
  type SupportedLanguage,
} from '../../i18n';
import { Api } from '../../services/api';
import { User } from '../../types';

interface AppearanceSettingsProps {
  currentUser: User;
  onUpdateUser: (updates: Partial<User>) => void;
  theme: 'light' | 'dark' | 'system';
  toggleTheme: (newTheme?: 'light' | 'dark' | 'system') => void;
}

interface AppearancePreferences {
  uiDensity: 'comfortable' | 'compact' | 'spacious';
  startPage: 'chat' | 'myTasks' | 'inbox' | 'lastVisited';
  fontScale: number; // 90, 100, 110, 120
  sidebarCollapsed: boolean;
  showWelcomeTips: boolean;
}

const DEFAULT_PREFERENCES: AppearancePreferences = {
  uiDensity: 'comfortable',
  startPage: 'chat',
  fontScale: 100,
  sidebarCollapsed: false,
  showWelcomeTips: true,
};

const UI_DENSITY_OPTIONS = [
  { value: 'compact', label: 'Compact', description: 'Minimal spacing, more content visible' },
  { value: 'comfortable', label: 'Comfortable', description: 'Balanced spacing (default)' },
  { value: 'spacious', label: 'Spacious', description: 'More breathing room' },
];

const START_PAGE_OPTIONS = [
  {
    value: 'chat',
    label: 'AI Chat',
    icon: LayoutGrid,
    description: 'Start with AI assistant',
  },
  {
    value: 'myTasks',
    label: 'My Tasks',
    icon: CheckCircle,
    description: 'Jump straight to your tasks',
  },
  { value: 'inbox', label: 'Inbox', icon: Home, description: 'Start with notifications' },
  {
    value: 'lastVisited',
    label: 'Last Visited',
    icon: Monitor,
    description: 'Continue where you left off',
  },
];

const FONT_SCALE_OPTIONS = [
  { value: 90, label: 'Small', preview: '14px' },
  { value: 100, label: 'Medium', preview: '16px' },
  { value: 110, label: 'Large', preview: '17.6px' },
  { value: 120, label: 'Extra Large', preview: '19.2px' },
];

export const AppearanceSettings: React.FC<AppearanceSettingsProps> = ({
  currentUser,
  onUpdateUser,
  theme,
  toggleTheme,
}) => {
  const { t, i18n } = useTranslation();
  const [preferences, setPreferences] = useState<AppearancePreferences>(DEFAULT_PREFERENCES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    try {
      const data = await Api.get('/api/settings/preferences/appearance');
      if (data.preferences) {
        setPreferences({ ...DEFAULT_PREFERENCES, ...data.preferences });
        applyPreferences({ ...DEFAULT_PREFERENCES, ...data.preferences });
      }
    } catch (error) {
      console.error('Failed to load appearance preferences:', error);
      // Load from user if available
      if (currentUser.uiDensity) {
        setPreferences((prev) => ({
          ...prev,
          uiDensity: currentUser.uiDensity as AppearancePreferences['uiDensity'],
        }));
      }
      if (currentUser.startPage) {
        setPreferences((prev) => ({
          ...prev,
          startPage: currentUser.startPage as AppearancePreferences['startPage'],
        }));
      }
      if (currentUser.fontScale) {
        setPreferences((prev) => ({ ...prev, fontScale: currentUser.fontScale as number }));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await Api.put('/api/settings/preferences/appearance', { preferences });
      const data = await Api.get('/api/settings/preferences/appearance').catch(() => null);
      const persisted = data?.preferences
        ? ({ ...DEFAULT_PREFERENCES, ...data.preferences } as AppearancePreferences)
        : preferences;

      // Update user context
      onUpdateUser({
        uiDensity: persisted.uiDensity,
        startPage: persisted.startPage,
        fontScale: persisted.fontScale,
      });

      // Apply immediately
      setPreferences(persisted);
      applyPreferences(persisted);

      toast.success(t('settings.appearance.saved', 'Appearance settings saved'));
    } catch (error) {
      toast.error(t('settings.appearance.error', 'Failed to save settings'));
    } finally {
      setSaving(false);
    }
  };

  const applyPreferences = (prefs: AppearancePreferences) => {
    const root = document.documentElement;

    // Font scale
    root.style.setProperty('--font-scale', `${prefs.fontScale / 100}`);
    root.style.fontSize = `${16 * (prefs.fontScale / 100)}px`;

    // UI Density via CSS variables
    const densityMap = {
      compact: { spacing: '0.5rem', padding: '0.25rem' },
      comfortable: { spacing: '1rem', padding: '0.5rem' },
      spacious: { spacing: '1.5rem', padding: '0.75rem' },
    };
    const density = densityMap[prefs.uiDensity];
    root.style.setProperty('--ui-spacing', density.spacing);
    root.style.setProperty('--ui-padding', density.padding);

    // Store preference
    localStorage.setItem('ui-density', prefs.uiDensity);
    localStorage.setItem('font-scale', prefs.fontScale.toString());
    localStorage.setItem('start-page', prefs.startPage);
  };

  const updatePreference = <K extends keyof AppearancePreferences>(
    key: K,
    value: AppearancePreferences[K]
  ) => {
    const newPrefs = { ...preferences, [key]: value };
    setPreferences(newPrefs);
    // Apply preview immediately
    applyPreferences(newPrefs);
  };

  // Styles
  const cardClass =
    'bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-xl p-6';

  if (loading) {
    return <LoadingState variant="spinner" />;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 relative">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-c-text flex items-center gap-3">
            <Palette size={28} className="text-c-accent" />
            {t('settings.appearance.title', 'Appearance')}
          </h2>
          <p className="text-c-text-muted text-sm mt-1">
            {t('settings.appearance.description', 'Customize how Consultify looks and feels')}
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-c-text hover:bg-c-text text-c-surface rounded-lg transition-colors disabled:opacity-50"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          {saving ? t('common.saving', 'Saving...') : t('common.saveChanges', 'Save Changes')}
        </button>
      </div>

      {/* Theme Selection */}
      <div className={cardClass}>
        <h3 className="text-lg font-semibold text-c-text mb-4 flex items-center gap-2">
          <Sun size={20} className="text-amber-500" />
          {t('settings.appearance.theme', 'Theme')}
        </h3>
        <p className="text-sm text-c-text-muted mb-4">
          {t('settings.appearance.themeDescription', 'Choose your preferred color scheme')}
        </p>

        <div className="grid grid-cols-3 gap-4">
          {[
            {
              value: 'light',
              label: t('settings.appearance.light', 'Light'),
              icon: Sun,
              colors: 'bg-c-surface border-c-border-subtle dark:border-navy-700',
            },
            {
              value: 'dark',
              label: t('settings.appearance.dark', 'Dark'),
              icon: Moon,
              colors: 'bg-c-surface border-c-border-strong',
            },
            {
              value: 'system',
              label: t('settings.appearance.system', 'System'),
              icon: Monitor,
              colors:
                'bg-gradient-to-r from-white to-c-surface border-c-border-subtle dark:border-navy-700',
            },
          ].map((option) => {
            const isSelected = theme === option.value;
            const Icon = option.icon;
            return (
              <button
                key={option.value}
                onClick={() => toggleTheme(option.value as 'light' | 'dark' | 'system')}
                className={`p-4 rounded-xl border-2 transition-all ${
                  isSelected
                    ? 'border-c-accent bg-c-accent-soft dark:bg-c-accent-soft'
                    : 'border-c-border-subtle dark:border-navy-700 hover:border-c-accent dark:hover:border-c-accent'
                }`}
              >
                <div className={`w-full h-16 rounded-lg border mb-3 ${option.colors}`} />
                <div className="flex items-center justify-center gap-2">
                  <Icon size={16} className={isSelected ? 'text-c-accent' : 'text-c-text-muted'} />
                  <span
                    className={`font-medium ${isSelected ? 'text-c-accent' : 'text-c-text-secondary'}`}
                  >
                    {option.label}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* UI Density */}
      <div className={cardClass}>
        <h3 className="text-lg font-semibold text-c-text mb-4 flex items-center gap-2">
          <Layout size={20} className="text-blue-500" />
          {t('settings.appearance.uiDensity', 'UI Density')}
        </h3>
        <p className="text-sm text-c-text-muted mb-4">
          {t(
            'settings.appearance.uiDensityDescription',
            'Control spacing and padding throughout the interface'
          )}
        </p>

        <div className="space-y-3">
          {UI_DENSITY_OPTIONS.map((option) => {
            const isSelected = preferences.uiDensity === option.value;
            return (
              <button
                key={option.value}
                onClick={() =>
                  updatePreference('uiDensity', option.value as AppearancePreferences['uiDensity'])
                }
                className={`w-full p-4 rounded-xl border-2 flex items-center justify-between transition-all ${
                  isSelected
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10'
                    : 'border-c-border-subtle dark:border-navy-700 hover:border-blue-300 dark:hover:border-blue-500/50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                      isSelected ? 'border-blue-500 bg-blue-500' : 'border-c-border-subtle'
                    }`}
                  >
                    {isSelected && <div className="w-2 h-2 rounded-full bg-c-surface" />}
                  </div>
                  <div className="text-left">
                    <span
                      className={`font-medium ${isSelected ? 'text-blue-700 dark:text-blue-400' : 'text-c-text-secondary'}`}
                    >
                      {t(`settings.appearance.uiDensityOptions.${option.value}`, option.label)}
                    </span>
                    <p className="text-sm text-c-text-muted">
                      {t(
                        `settings.appearance.uiDensityOptions.${option.value}Desc`,
                        option.description
                      )}
                    </p>
                  </div>
                </div>
                {/* Visual preview */}
                <div
                  className={`flex flex-col gap-${option.value === 'compact' ? '0.5' : option.value === 'comfortable' ? '1' : '2'}`}
                >
                  <div
                    className={`h-2 rounded bg-c-surface-raised ${option.value === 'compact' ? 'w-16' : option.value === 'comfortable' ? 'w-20' : 'w-24'}`}
                  />
                  <div
                    className={`h-2 rounded bg-c-surface-raised ${option.value === 'compact' ? 'w-12' : option.value === 'comfortable' ? 'w-16' : 'w-20'}`}
                  />
                  <div
                    className={`h-2 rounded bg-c-surface-raised ${option.value === 'compact' ? 'w-14' : option.value === 'comfortable' ? 'w-18' : 'w-22'}`}
                  />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Start Page */}
      <div className={cardClass}>
        <h3 className="text-lg font-semibold text-c-text mb-4 flex items-center gap-2">
          <Home size={20} className="text-emerald-500" />
          {t('settings.appearance.startPage', 'Start Page')}
        </h3>
        <p className="text-sm text-c-text-muted mb-4">
          {t(
            'settings.appearance.startPageDescription',
            'Choose which page to show when you open Consultify'
          )}
        </p>

        <div className="grid grid-cols-2 gap-4">
          {START_PAGE_OPTIONS.map((option) => {
            const isSelected = preferences.startPage === option.value;
            const Icon = option.icon;
            return (
              <button
                key={option.value}
                onClick={() =>
                  updatePreference('startPage', option.value as AppearancePreferences['startPage'])
                }
                className={`p-4 rounded-xl border-2 flex items-center gap-4 transition-all ${
                  isSelected
                    ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10'
                    : 'border-c-border-subtle dark:border-navy-700 hover:border-emerald-300 dark:hover:border-emerald-500/50'
                }`}
              >
                <div
                  className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    isSelected ? 'bg-emerald-100 dark:bg-emerald-500/20' : 'bg-c-surface-raised'
                  }`}
                >
                  <Icon
                    size={20}
                    className={
                      isSelected ? 'text-emerald-600 dark:text-emerald-400' : 'text-c-text-muted'
                    }
                  />
                </div>
                <div className="text-left">
                  <span
                    className={`font-medium ${isSelected ? 'text-emerald-700 dark:text-emerald-400' : 'text-c-text-secondary'}`}
                  >
                    {t(`settings.appearance.startPageOptions.${option.value}`, option.label)}
                  </span>
                  <p className="text-xs text-c-text-muted">
                    {t(
                      `settings.appearance.startPageOptions.${option.value}Desc`,
                      option.description
                    )}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Font Scale */}
      <div className={cardClass}>
        <h3 className="text-lg font-semibold text-c-text mb-4 flex items-center gap-2">
          <Type size={20} className="text-indigo-500" />
          {t('settings.appearance.fontScale', 'Font Scale')}
        </h3>
        <p className="text-sm text-c-text-muted mb-4">
          {t(
            'settings.appearance.fontScaleDescription',
            'Adjust the overall text size throughout the application'
          )}
        </p>

        {/* Slider-style selector */}
        <div className="relative">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => {
                const currentIndex = FONT_SCALE_OPTIONS.findIndex(
                  (o) => o.value === preferences.fontScale
                );
                if (currentIndex > 0) {
                  updatePreference('fontScale', FONT_SCALE_OPTIONS[currentIndex - 1].value);
                }
              }}
              disabled={preferences.fontScale === 90}
              className="p-2 rounded-lg bg-c-surface-raised text-c-text-secondary hover:bg-c-surface-raised dark:hover:bg-navy-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Minus size={16} />
            </button>

            <div className="flex-1 mx-6">
              <div className="flex justify-between mb-2">
                {FONT_SCALE_OPTIONS.map((option) => {
                  const isSelected = preferences.fontScale === option.value;
                  return (
                    <button
                      key={option.value}
                      onClick={() => updatePreference('fontScale', option.value)}
                      className={`px-3 py-1 rounded-full text-sm font-medium transition-all ${
                        isSelected
                          ? 'bg-indigo-500 text-white'
                          : 'text-c-text-muted hover:text-c-text-secondary'
                      }`}
                    >
                      {option.value}%
                    </button>
                  );
                })}
              </div>
              {/* Progress bar */}
              <div className="h-2 bg-c-surface-raised rounded-full">
                <div
                  className="h-full bg-indigo-500 rounded-full transition-all"
                  style={{ width: `${((preferences.fontScale - 90) / 30) * 100}%` }}
                />
              </div>
            </div>

            <button
              onClick={() => {
                const currentIndex = FONT_SCALE_OPTIONS.findIndex(
                  (o) => o.value === preferences.fontScale
                );
                if (currentIndex < FONT_SCALE_OPTIONS.length - 1) {
                  updatePreference('fontScale', FONT_SCALE_OPTIONS[currentIndex + 1].value);
                }
              }}
              disabled={preferences.fontScale === 120}
              className="p-2 rounded-lg bg-c-surface-raised text-c-text-secondary hover:bg-c-surface-raised dark:hover:bg-navy-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus size={16} />
            </button>
          </div>

          {/* Preview */}
          <div className="p-4 bg-c-surface-raised rounded-lg border border-c-border-subtle dark:border-navy-700">
            <p className="text-sm text-c-text-muted mb-2">
              {t('settings.appearance.preview', 'Preview:')}
            </p>
            <p
              className="text-c-text font-medium"
              style={{ fontSize: `${16 * (preferences.fontScale / 100)}px` }}
            >
              {t(
                'settings.appearance.previewSentence',
                'The quick brown fox jumps over the lazy dog.'
              )}
            </p>
            <p
              className="text-c-text-secondary mt-1"
              style={{ fontSize: `${14 * (preferences.fontScale / 100)}px` }}
            >
              {t(
                'settings.appearance.previewScale',
                'This is how body text will appear at {{scale}}% scale.',
                { scale: preferences.fontScale }
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Language */}
      <div className={cardClass}>
        <h3 className="text-lg font-semibold text-c-text mb-4">
          {t('settings.appearance.language', 'Language')}
        </h3>
        <p className="text-sm text-c-text-muted mb-4">
          {t('settings.appearance.languageDescription', 'Select your preferred interface language')}
        </p>

        <div className="flex flex-wrap gap-2">
          {(() => {
            // SuperAdmin: only Polish and English
            // Regular users: all supported languages
            const isSuperAdmin = currentUser?.role?.toUpperCase() === 'SUPERADMIN';
            const languageFlags: Record<SupportedLanguage, string> = {
              en: '🇬🇧',
              pl: '🇵🇱',
              de: '🇩🇪',
              es: '🇪🇸',
              ar: '🇸🇦',
              ja: '🇯🇵',
            };
            const allLanguages = SUPPORTED_LANGUAGES.map((code) => ({
              code,
              label: LANGUAGE_NAMES[code],
              flag: languageFlags[code],
            }));
            const availableLanguages = isSuperAdmin
              ? allLanguages.filter((lang) => ['en', 'pl'].includes(lang.code))
              : allLanguages;
            return availableLanguages;
          })().map((lang) => {
            const isSelected = i18n.language === lang.code;
            return (
              <button
                key={lang.code}
                onClick={() => changeLanguage(lang.code)}
                className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-all ${
                  isSelected
                    ? 'bg-c-accent-soft dark:bg-c-accent-soft text-c-accent border-2 border-c-accent'
                    : 'bg-c-surface-raised text-c-text-secondary border-2 border-transparent hover:border-c-accent'
                }`}
              >
                <span>{lang.flag}</span>
                <span className="font-medium">{lang.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default AppearanceSettings;
