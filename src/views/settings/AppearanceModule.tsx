/**
 * AppearanceModule - Appearance & Regional Settings
 *
 * Tabs: Theme | Language | Regional | Accessibility | Work | Dashboard
 */

import {
  Accessibility,
  Briefcase,
  Clock,
  Globe,
  Keyboard,
  LayoutDashboard,
  Moon,
  Palette,
  Shield,
  Zap,
} from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { AccessibilitySettings } from '../../components/settings/AccessibilitySettings';
import { DashboardPreferencesSettings } from '../../components/settings/DashboardPreferencesSettings';
import { DataPrivacySettings } from '../../components/settings/DataPrivacySettings';
import { KeyboardShortcutsSettings } from '../../components/settings/KeyboardShortcutsSettings';
import { PerformanceSettings } from '../../components/settings/PerformanceSettings';
import { QuietHoursSettings } from '../../components/settings/QuietHoursSettings';
import { RegionalSettings } from '../../components/settings/RegionalSettings';
import { WorkPreferencesSettings } from '../../components/settings/WorkPreferencesSettings';
import { Tab, TabLayout } from '../../components/SuperAdmin/TabLayout';
import {
  changeLanguage,
  LANGUAGE_NAMES,
  SUPPORTED_LANGUAGES,
  type SupportedLanguage,
} from '../../i18n';
import { Language, User } from '../../types';

// Accent color options
const ACCENT_COLORS = [
  { id: 'crimson', label: 'Crimson', value: '#A51C30', dark: '#E45868' },
  { id: 'purple', label: 'Purple', value: '#6366F1', dark: '#A78BFA' },
  { id: 'blue', label: 'Blue', value: '#3B82F6', dark: '#60A5FA' },
  { id: 'green', label: 'Green', value: '#10B981', dark: '#34D399' },
  { id: 'amber', label: 'Amber', value: '#F59E0B', dark: '#FBBF24' },
  { id: 'rose', label: 'Rose', value: '#F43F5E', dark: '#FB7185' },
  { id: 'cyan', label: 'Cyan', value: '#3B82F6', dark: '#22D3EE' },
  { id: 'indigo', label: 'Indigo', value: '#6366F1', dark: '#818CF8' },
  { id: 'teal', label: 'Teal', value: '#3B82F6', dark: '#2DD4BF' },
];

interface AppearanceModuleProps {
  initialTab?: string;
  currentUser: User;
  onUpdateUser: (updates: Partial<User>) => void;
  theme: 'light' | 'dark' | 'system';
  toggleTheme: (newTheme?: 'light' | 'dark' | 'system') => void;
}

// Theme Settings Component with Accent Colors
const ThemeSettings: React.FC<{
  theme: 'light' | 'dark' | 'system';
  toggleTheme: (newTheme?: 'light' | 'dark' | 'system') => void;
}> = ({ theme, toggleTheme }) => {
  const { t } = useTranslation();
  const [accentColor, setAccentColor] = useState('crimson');

  const themes = [
    { id: 'light', label: t('settings.theme.light', 'Light'), icon: '☀️' },
    { id: 'dark', label: t('settings.theme.dark', 'Dark'), icon: '🌙' },
    { id: 'system', label: t('settings.theme.system', 'System'), icon: '💻' },
  ] as const;

  const handleAccentColorChange = (colorId: string) => {
    setAccentColor(colorId);
    const color = ACCENT_COLORS.find((c) => c.id === colorId);
    if (color) {
      document.documentElement.style.setProperty('--accent-color', color.value);
      document.documentElement.style.setProperty('--accent-color-dark', color.dark);
    }
  };

  return (
    <div className="space-y-8">
      {/* Theme Mode */}
      <div>
        <h3 className="text-lg font-semibold text-c-text mb-4">
          {t('settings.theme.title', 'Theme Mode')}
        </h3>
        <p className="text-sm text-c-text-muted mb-6">
          {t('settings.theme.description', 'Choose your preferred appearance')}
        </p>

        <div className="grid grid-cols-3 gap-4">
          {themes.map((t_) => (
            <button
              key={t_.id}
              onClick={() => toggleTheme(t_.id)}
              className={`p-6 rounded-xl border-2 transition-all ${
                theme === t_.id
                  ? 'border-c-accent bg-c-accent-soft dark:bg-c-accent-soft'
                  : 'border-c-border-subtle dark:border-navy-700 hover:border-c-border dark:hover:border-white/20 bg-c-surface'
              }`}
            >
              <div className="text-4xl mb-3">{t_.icon}</div>
              <p className={`font-medium ${theme === t_.id ? 'text-c-accent' : 'text-c-text'}`}>
                {t_.label}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Accent Color */}
      <div className="pt-6 border-t border-c-border-subtle dark:border-navy-700">
        <h3 className="text-lg font-semibold text-c-text mb-4">
          {t('settings.theme.accentColor', 'Accent Color')}
        </h3>
        <p className="text-sm text-c-text-muted mb-6">
          {t(
            'settings.theme.accentColorDescription',
            'Customize the highlight color used throughout the app'
          )}
        </p>

        <div className="grid grid-cols-4 md:grid-cols-8 gap-3">
          {ACCENT_COLORS.map((color) => (
            <button
              key={color.id}
              onClick={() => handleAccentColorChange(color.id)}
              className={`relative w-12 h-12 rounded-full transition-all transform hover:scale-110 ${
                accentColor === color.id
                  ? 'ring-2 ring-offset-2 ring-c-border-strong dark:ring-white'
                  : ''
              }`}
              style={{ backgroundColor: color.value }}
              title={color.label}
            >
              {accentColor === color.id && (
                <span className="absolute inset-0 flex items-center justify-center text-white font-bold">
                  ✓
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Theme Preview */}
      <div className="p-4 bg-c-surface-raised rounded-lg">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-c-text-muted">
              {t('settings.theme.currentTheme', 'Current theme')}:{' '}
              <strong className="text-c-text capitalize">{theme}</strong>
            </p>
            <p className="text-sm text-c-text-muted mt-1">
              {t('settings.theme.currentAccent', 'Accent color')}:{' '}
              <strong
                className="capitalize"
                style={{ color: ACCENT_COLORS.find((c) => c.id === accentColor)?.value }}
              >
                {accentColor}
              </strong>
            </p>
          </div>
          {/* Preview Swatch */}
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-lg border border-c-border-subtle dark:border-navy-700"
              style={{ backgroundColor: ACCENT_COLORS.find((c) => c.id === accentColor)?.value }}
            />
            <div className="text-sm text-c-text-muted">
              {ACCENT_COLORS.find((c) => c.id === accentColor)?.value}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Language Settings Component
const LanguageSettings: React.FC<{
  currentUser: User;
  onUpdateUser: (updates: Partial<User>) => void;
}> = ({ currentUser, onUpdateUser }) => {
  const { t, i18n } = useTranslation();
  const [selectedLanguage, setSelectedLanguage] = useState<Language>(
    (i18n.language?.toUpperCase() as Language) || 'EN'
  );

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
    code: code.toUpperCase() as Language,
    name: LANGUAGE_NAMES[code],
    flag: languageFlags[code],
  }));
  const languages = isSuperAdmin
    ? allLanguages.filter((lang) => ['EN', 'PL'].includes(lang.code))
    : allLanguages;

  const handleLanguageChange = async (code: Language) => {
    setSelectedLanguage(code);
    await changeLanguage(code.toLowerCase());
    onUpdateUser({ preferredLanguage: code });
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-c-text mb-4">
          {t('settings.language.title', 'Language')}
        </h3>
        <p className="text-sm text-c-text-muted mb-6">
          {t('settings.language.description', 'Choose your preferred language')}
        </p>
      </div>

      <div className="space-y-3">
        {languages.map((lang) => (
          <button
            key={lang.code}
            onClick={() => handleLanguageChange(lang.code as Language)}
            className={`w-full p-4 rounded-lg border-2 transition-all flex items-center gap-4 ${
              selectedLanguage === lang.code
                ? 'border-c-accent bg-c-accent-soft dark:bg-c-accent-soft'
                : 'border-c-border-subtle dark:border-navy-700 hover:border-c-border dark:hover:border-white/20 bg-c-surface'
            }`}
          >
            <span className="text-2xl">{lang.flag}</span>
            <span
              className={`font-medium ${
                selectedLanguage === lang.code ? 'text-c-accent' : 'text-c-text'
              }`}
            >
              {lang.name}
            </span>
            {selectedLanguage === lang.code && <span className="ml-auto text-c-accent">✓</span>}
          </button>
        ))}
      </div>
    </div>
  );
};

export const AppearanceModule: React.FC<AppearanceModuleProps> = ({
  initialTab,
  currentUser,
  onUpdateUser,
  theme,
  toggleTheme,
}) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState(initialTab || 'theme');

  const tabs: Tab[] = [
    // Appearance
    {
      id: 'theme',
      label: t('settings.tabs.theme', 'Theme'),
      icon: <Palette size={16} />,
    },
    {
      id: 'language',
      label: t('settings.tabs.language', 'Language'),
      icon: <Globe size={16} />,
    },
    {
      id: 'regional',
      label: t('settings.tabs.regional', 'Regional'),
      icon: <Clock size={16} />,
    },
    {
      id: 'accessibility',
      label: t('settings.tabs.accessibility', 'Accessibility'),
      icon: <Accessibility size={16} />,
    },
    // Productivity
    {
      id: 'shortcuts',
      label: t('settings.tabs.shortcuts', 'Shortcuts'),
      icon: <Keyboard size={16} />,
    },
    {
      id: 'work',
      label: t('settings.tabs.work', 'Work'),
      icon: <Briefcase size={16} />,
    },
    {
      id: 'dashboard',
      label: t('settings.tabs.dashboard', 'Dashboard'),
      icon: <LayoutDashboard size={16} />,
    },
    // Focus & Privacy
    {
      id: 'quiet-hours',
      label: t('settings.tabs.quietHours', 'Quiet Hours'),
      icon: <Moon size={16} />,
    },
    {
      id: 'performance',
      label: t('settings.tabs.performance', 'Performance'),
      icon: <Zap size={16} />,
    },
    {
      id: 'privacy',
      label: t('settings.tabs.privacy', 'Privacy'),
      icon: <Shield size={16} />,
    },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'theme':
        return (
          <div className="p-6 overflow-y-auto h-full">
            <ThemeSettings theme={theme} toggleTheme={toggleTheme} />
          </div>
        );
      case 'language':
        return (
          <div className="p-6 overflow-y-auto h-full">
            <LanguageSettings currentUser={currentUser} onUpdateUser={onUpdateUser} />
          </div>
        );
      case 'regional':
        return <RegionalSettings currentUser={currentUser} onUpdateUser={onUpdateUser} />;
      case 'accessibility':
        return <AccessibilitySettings currentUser={currentUser} onUpdateUser={onUpdateUser} />;
      case 'shortcuts':
        return (
          <div className="p-6 overflow-y-auto h-full">
            <KeyboardShortcutsSettings currentUser={currentUser} />
          </div>
        );
      case 'work':
        return <WorkPreferencesSettings currentUser={currentUser} onUpdateUser={onUpdateUser} />;
      case 'dashboard':
        return (
          <DashboardPreferencesSettings currentUser={currentUser} onUpdateUser={onUpdateUser} />
        );
      case 'quiet-hours':
        return (
          <div className="p-6 overflow-y-auto h-full">
            <QuietHoursSettings currentUser={currentUser} />
          </div>
        );
      case 'performance':
        return (
          <div className="p-6 overflow-y-auto h-full">
            <PerformanceSettings currentUser={currentUser} />
          </div>
        );
      case 'privacy':
        return (
          <div className="p-6 overflow-y-auto h-full">
            <DataPrivacySettings currentUser={currentUser} />
          </div>
        );
      default:
        return (
          <div className="p-6 overflow-y-auto h-full">
            <ThemeSettings theme={theme} toggleTheme={toggleTheme} />
          </div>
        );
    }
  };

  return (
    <TabLayout
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      title={t('settings.modules.appearance', 'Appearance & Regional')}
      subtitle={t(
        'settings.modules.appearanceDesc',
        'Customize theme, language, accessibility, and work preferences'
      )}
    >
      {renderContent()}
    </TabLayout>
  );
};

export default AppearanceModule;
