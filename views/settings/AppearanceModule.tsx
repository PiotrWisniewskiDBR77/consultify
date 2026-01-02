/**
 * AppearanceModule - Appearance & Regional Settings
 * 
 * Tabs: Theme | Language | Regional | Accessibility | Work | Dashboard
 */

import React, { useState } from 'react';
import { Palette, Globe, Clock, Accessibility, Briefcase, LayoutDashboard } from 'lucide-react';
import { TabLayout, Tab } from '../../components/SuperAdmin/TabLayout';
import { RegionalSettings } from '../../components/settings/RegionalSettings';
import { AccessibilitySettings } from '../../components/settings/AccessibilitySettings';
import { WorkPreferencesSettings } from '../../components/settings/WorkPreferencesSettings';
import { DashboardPreferencesSettings } from '../../components/settings/DashboardPreferencesSettings';
import { useTranslation } from 'react-i18next';
import { User } from '../../types';

interface AppearanceModuleProps {
    initialTab?: string;
    currentUser: User;
    onUpdateUser: (updates: Partial<User>) => void;
    theme: 'light' | 'dark' | 'system';
    toggleTheme: (newTheme?: 'light' | 'dark' | 'system') => void;
}

// Theme Settings Component
const ThemeSettings: React.FC<{
    theme: 'light' | 'dark' | 'system';
    toggleTheme: (newTheme?: 'light' | 'dark' | 'system') => void;
}> = ({ theme, toggleTheme }) => {
    const { t } = useTranslation();

    const themes = [
        { id: 'light', label: t('settings.theme.light', 'Light'), icon: '☀️' },
        { id: 'dark', label: t('settings.theme.dark', 'Dark'), icon: '🌙' },
        { id: 'system', label: t('settings.theme.system', 'System'), icon: '💻' },
    ] as const;

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                    {t('settings.theme.title', 'Theme')}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
                    {t('settings.theme.description', 'Choose your preferred appearance')}
                </p>
            </div>

            <div className="grid grid-cols-3 gap-4">
                {themes.map((t_) => (
                    <button
                        key={t_.id}
                        onClick={() => toggleTheme(t_.id)}
                        className={`p-6 rounded-xl border-2 transition-all ${
                            theme === t_.id
                                ? 'border-purple-500 bg-purple-50 dark:bg-purple-500/20'
                                : 'border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20 bg-white dark:bg-white/5'
                        }`}
                    >
                        <div className="text-4xl mb-3">{t_.icon}</div>
                        <p className={`font-medium ${
                            theme === t_.id
                                ? 'text-purple-700 dark:text-purple-300'
                                : 'text-slate-900 dark:text-white'
                        }`}>
                            {t_.label}
                        </p>
                    </button>
                ))}
            </div>

            {/* Theme Preview */}
            <div className="p-4 bg-slate-50 dark:bg-white/5 rounded-lg">
                <p className="text-sm text-slate-500 dark:text-slate-400">
                    {t('settings.theme.currentTheme', 'Current theme')}: <strong className="text-slate-900 dark:text-white">{theme}</strong>
                </p>
            </div>
        </div>
    );
};

// Language Settings Component
const LanguageSettings: React.FC<{ currentUser: User; onUpdateUser: (updates: Partial<User>) => void }> = ({ 
    currentUser, 
    onUpdateUser 
}) => {
    const { t, i18n } = useTranslation();
    const [selectedLanguage, setSelectedLanguage] = useState(i18n.language || 'en');

    const languages = [
        { code: 'en', name: 'English', flag: '🇬🇧' },
        { code: 'pl', name: 'Polski', flag: '🇵🇱' },
    ];

    const handleLanguageChange = (code: string) => {
        setSelectedLanguage(code);
        i18n.changeLanguage(code);
        onUpdateUser({ preferredLanguage: code });
    };

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                    {t('settings.language.title', 'Language')}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
                    {t('settings.language.description', 'Choose your preferred language')}
                </p>
            </div>

            <div className="space-y-3">
                {languages.map((lang) => (
                    <button
                        key={lang.code}
                        onClick={() => handleLanguageChange(lang.code)}
                        className={`w-full p-4 rounded-lg border-2 transition-all flex items-center gap-4 ${
                            selectedLanguage === lang.code
                                ? 'border-purple-500 bg-purple-50 dark:bg-purple-500/20'
                                : 'border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20 bg-white dark:bg-white/5'
                        }`}
                    >
                        <span className="text-2xl">{lang.flag}</span>
                        <span className={`font-medium ${
                            selectedLanguage === lang.code
                                ? 'text-purple-700 dark:text-purple-300'
                                : 'text-slate-900 dark:text-white'
                        }`}>
                            {lang.name}
                        </span>
                        {selectedLanguage === lang.code && (
                            <span className="ml-auto text-purple-500">✓</span>
                        )}
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
    toggleTheme
}) => {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState(initialTab || 'theme');

    const tabs: Tab[] = [
        { 
            id: 'theme', 
            label: t('settings.tabs.theme', 'Theme'), 
            icon: <Palette size={16} /> 
        },
        { 
            id: 'language', 
            label: t('settings.tabs.language', 'Language'), 
            icon: <Globe size={16} /> 
        },
        { 
            id: 'regional', 
            label: t('settings.tabs.regional', 'Regional'), 
            icon: <Clock size={16} /> 
        },
        { 
            id: 'accessibility', 
            label: t('settings.tabs.accessibility', 'Accessibility'), 
            icon: <Accessibility size={16} /> 
        },
        { 
            id: 'work', 
            label: t('settings.tabs.work', 'Work'), 
            icon: <Briefcase size={16} /> 
        },
        { 
            id: 'dashboard', 
            label: t('settings.tabs.dashboard', 'Dashboard'), 
            icon: <LayoutDashboard size={16} /> 
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
            case 'work':
                return <WorkPreferencesSettings currentUser={currentUser} onUpdateUser={onUpdateUser} />;
            case 'dashboard':
                return <DashboardPreferencesSettings currentUser={currentUser} onUpdateUser={onUpdateUser} />;
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
            subtitle={t('settings.modules.appearanceDesc', 'Customize theme, language, accessibility, and work preferences')}
        >
            {renderContent()}
        </TabLayout>
    );
};

export default AppearanceModule;


