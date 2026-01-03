/**
 * AppearanceSettings Component
 * 
 * Combines theme, UI density, start page, and font scale settings
 * for a complete appearance customization experience.
 */

import React, { useState, useEffect } from 'react';
import { User } from '../../types';
import { useTranslation } from 'react-i18next';
import { 
    Palette, 
    Layout, 
    Home,
    Type,
    Save,
    Loader2,
    Sun,
    Moon,
    Monitor,
    LayoutGrid,
    Minus,
    Plus,
    CheckCircle
} from 'lucide-react';
import { Api } from '../../services/api';
import { toast } from 'react-hot-toast';
import { InfoButton } from '../shared/InfoButton';

interface AppearanceSettingsProps {
    currentUser: User;
    onUpdateUser: (updates: Partial<User>) => void;
    theme: 'light' | 'dark' | 'system';
    toggleTheme: (newTheme?: 'light' | 'dark' | 'system') => void;
}

interface AppearancePreferences {
    uiDensity: 'comfortable' | 'compact' | 'spacious';
    startPage: 'dashboard' | 'myTasks' | 'inbox' | 'lastVisited';
    fontScale: number; // 90, 100, 110, 120
    sidebarCollapsed: boolean;
    showWelcomeTips: boolean;
}

const DEFAULT_PREFERENCES: AppearancePreferences = {
    uiDensity: 'comfortable',
    startPage: 'dashboard',
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
    { value: 'dashboard', label: 'Dashboard', icon: LayoutGrid, description: 'Overview of your workspace' },
    { value: 'myTasks', label: 'My Tasks', icon: CheckCircle, description: 'Jump straight to your tasks' },
    { value: 'inbox', label: 'Inbox', icon: Home, description: 'Start with notifications' },
    { value: 'lastVisited', label: 'Last Visited', icon: Monitor, description: 'Continue where you left off' },
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
    toggleTheme
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
                setPreferences(prev => ({ ...prev, uiDensity: currentUser.uiDensity as AppearancePreferences['uiDensity'] }));
            }
            if (currentUser.startPage) {
                setPreferences(prev => ({ ...prev, startPage: currentUser.startPage as AppearancePreferences['startPage'] }));
            }
            if (currentUser.fontScale) {
                setPreferences(prev => ({ ...prev, fontScale: currentUser.fontScale as number }));
            }
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await Api.put('/api/settings/preferences/appearance', { preferences });
            
            // Update user context
            onUpdateUser({
                uiDensity: preferences.uiDensity,
                startPage: preferences.startPage,
                fontScale: preferences.fontScale,
            });
            
            // Apply immediately
            applyPreferences(preferences);
            
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

    const updatePreference = <K extends keyof AppearancePreferences>(key: K, value: AppearancePreferences[K]) => {
        const newPrefs = { ...preferences, [key]: value };
        setPreferences(newPrefs);
        // Apply preview immediately
        applyPreferences(newPrefs);
    };

    // Styles
    const cardClass = "bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-xl p-6";
    
    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 size={32} className="animate-spin text-purple-600" />
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 relative">
            <InfoButton cardId="settings-appearance" position="top-right" />
            
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                        <Palette size={28} className="text-purple-500" />
                        {t('settings.appearance.title', 'Appearance')}
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                        {t('settings.appearance.description', 'Customize how Consultify looks and feels')}
                    </p>
                </div>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-colors disabled:opacity-50"
                >
                    {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                    {saving ? 'Saving...' : 'Save Changes'}
                </button>
            </div>

            {/* Theme Selection */}
            <div className={cardClass}>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                    <Sun size={20} className="text-amber-500" />
                    {t('settings.appearance.theme', 'Theme')}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                    {t('settings.appearance.themeDescription', 'Choose your preferred color scheme')}
                </p>
                
                <div className="grid grid-cols-3 gap-4">
                    {[
                        { value: 'light', label: 'Light', icon: Sun, colors: 'bg-white border-slate-200' },
                        { value: 'dark', label: 'Dark', icon: Moon, colors: 'bg-slate-900 border-slate-700' },
                        { value: 'system', label: 'System', icon: Monitor, colors: 'bg-gradient-to-r from-white to-slate-900 border-slate-300' },
                    ].map(option => {
                        const isSelected = theme === option.value;
                        const Icon = option.icon;
                        return (
                            <button
                                key={option.value}
                                onClick={() => toggleTheme(option.value as 'light' | 'dark' | 'system')}
                                className={`p-4 rounded-xl border-2 transition-all ${
                                    isSelected
                                        ? 'border-purple-500 bg-purple-50 dark:bg-purple-500/10'
                                        : 'border-slate-200 dark:border-white/10 hover:border-purple-300 dark:hover:border-purple-500/50'
                                }`}
                            >
                                <div className={`w-full h-16 rounded-lg border mb-3 ${option.colors}`} />
                                <div className="flex items-center justify-center gap-2">
                                    <Icon size={16} className={isSelected ? 'text-purple-600 dark:text-purple-400' : 'text-slate-500'} />
                                    <span className={`font-medium ${isSelected ? 'text-purple-700 dark:text-purple-400' : 'text-slate-700 dark:text-slate-300'}`}>
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
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                    <Layout size={20} className="text-blue-500" />
                    {t('settings.appearance.uiDensity', 'UI Density')}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                    {t('settings.appearance.uiDensityDescription', 'Control spacing and padding throughout the interface')}
                </p>
                
                <div className="space-y-3">
                    {UI_DENSITY_OPTIONS.map(option => {
                        const isSelected = preferences.uiDensity === option.value;
                        return (
                            <button
                                key={option.value}
                                onClick={() => updatePreference('uiDensity', option.value as AppearancePreferences['uiDensity'])}
                                className={`w-full p-4 rounded-xl border-2 flex items-center justify-between transition-all ${
                                    isSelected
                                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10'
                                        : 'border-slate-200 dark:border-white/10 hover:border-blue-300 dark:hover:border-blue-500/50'
                                }`}
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                                        isSelected ? 'border-blue-500 bg-blue-500' : 'border-slate-300 dark:border-slate-600'
                                    }`}>
                                        {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                                    </div>
                                    <div className="text-left">
                                        <span className={`font-medium ${isSelected ? 'text-blue-700 dark:text-blue-400' : 'text-slate-700 dark:text-slate-300'}`}>
                                            {option.label}
                                        </span>
                                        <p className="text-sm text-slate-500 dark:text-slate-400">{option.description}</p>
                                    </div>
                                </div>
                                {/* Visual preview */}
                                <div className={`flex flex-col gap-${option.value === 'compact' ? '0.5' : option.value === 'comfortable' ? '1' : '2'}`}>
                                    <div className={`h-2 rounded bg-slate-300 dark:bg-slate-600 ${option.value === 'compact' ? 'w-16' : option.value === 'comfortable' ? 'w-20' : 'w-24'}`} />
                                    <div className={`h-2 rounded bg-slate-200 dark:bg-slate-700 ${option.value === 'compact' ? 'w-12' : option.value === 'comfortable' ? 'w-16' : 'w-20'}`} />
                                    <div className={`h-2 rounded bg-slate-300 dark:bg-slate-600 ${option.value === 'compact' ? 'w-14' : option.value === 'comfortable' ? 'w-18' : 'w-22'}`} />
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Start Page */}
            <div className={cardClass}>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                    <Home size={20} className="text-emerald-500" />
                    {t('settings.appearance.startPage', 'Start Page')}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                    {t('settings.appearance.startPageDescription', 'Choose which page to show when you open Consultify')}
                </p>
                
                <div className="grid grid-cols-2 gap-4">
                    {START_PAGE_OPTIONS.map(option => {
                        const isSelected = preferences.startPage === option.value;
                        const Icon = option.icon;
                        return (
                            <button
                                key={option.value}
                                onClick={() => updatePreference('startPage', option.value as AppearancePreferences['startPage'])}
                                className={`p-4 rounded-xl border-2 flex items-center gap-4 transition-all ${
                                    isSelected
                                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10'
                                        : 'border-slate-200 dark:border-white/10 hover:border-emerald-300 dark:hover:border-emerald-500/50'
                                }`}
                            >
                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                                    isSelected ? 'bg-emerald-100 dark:bg-emerald-500/20' : 'bg-slate-100 dark:bg-white/10'
                                }`}>
                                    <Icon size={20} className={isSelected ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500'} />
                                </div>
                                <div className="text-left">
                                    <span className={`font-medium ${isSelected ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-700 dark:text-slate-300'}`}>
                                        {option.label}
                                    </span>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">{option.description}</p>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Font Scale */}
            <div className={cardClass}>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                    <Type size={20} className="text-indigo-500" />
                    {t('settings.appearance.fontScale', 'Font Scale')}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                    {t('settings.appearance.fontScaleDescription', 'Adjust the overall text size throughout the application')}
                </p>
                
                {/* Slider-style selector */}
                <div className="relative">
                    <div className="flex items-center justify-between mb-4">
                        <button
                            onClick={() => {
                                const currentIndex = FONT_SCALE_OPTIONS.findIndex(o => o.value === preferences.fontScale);
                                if (currentIndex > 0) {
                                    updatePreference('fontScale', FONT_SCALE_OPTIONS[currentIndex - 1].value);
                                }
                            }}
                            disabled={preferences.fontScale === 90}
                            className="p-2 rounded-lg bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-navy-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Minus size={16} />
                        </button>
                        
                        <div className="flex-1 mx-6">
                            <div className="flex justify-between mb-2">
                                {FONT_SCALE_OPTIONS.map(option => {
                                    const isSelected = preferences.fontScale === option.value;
                                    return (
                                        <button
                                            key={option.value}
                                            onClick={() => updatePreference('fontScale', option.value)}
                                            className={`px-3 py-1 rounded-full text-sm font-medium transition-all ${
                                                isSelected
                                                    ? 'bg-indigo-500 text-white'
                                                    : 'text-slate-500 hover:text-slate-700'
                                            }`}
                                        >
                                            {option.value}%
                                        </button>
                                    );
                                })}
                            </div>
                            {/* Progress bar */}
                            <div className="h-2 bg-slate-200 dark:bg-navy-800 rounded-full">
                                <div 
                                    className="h-full bg-indigo-500 rounded-full transition-all"
                                    style={{ width: `${((preferences.fontScale - 90) / 30) * 100}%` }}
                                />
                            </div>
                        </div>
                        
                        <button
                            onClick={() => {
                                const currentIndex = FONT_SCALE_OPTIONS.findIndex(o => o.value === preferences.fontScale);
                                if (currentIndex < FONT_SCALE_OPTIONS.length - 1) {
                                    updatePreference('fontScale', FONT_SCALE_OPTIONS[currentIndex + 1].value);
                                }
                            }}
                            disabled={preferences.fontScale === 120}
                            className="p-2 rounded-lg bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-navy-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Plus size={16} />
                        </button>
                    </div>

                    {/* Preview */}
                    <div className="p-4 bg-slate-50 dark:bg-navy-950/50 rounded-lg border border-slate-200 dark:border-white/10">
                        <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">Preview:</p>
                        <p 
                            className="text-slate-900 dark:text-white font-medium"
                            style={{ fontSize: `${16 * (preferences.fontScale / 100)}px` }}
                        >
                            The quick brown fox jumps over the lazy dog.
                        </p>
                        <p 
                            className="text-slate-600 dark:text-slate-400 mt-1"
                            style={{ fontSize: `${14 * (preferences.fontScale / 100)}px` }}
                        >
                            This is how body text will appear at {preferences.fontScale}% scale.
                        </p>
                    </div>
                </div>
            </div>

            {/* Language */}
            <div className={cardClass}>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                    {t('settings.appearance.language', 'Language')}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                    {t('settings.appearance.languageDescription', 'Select your preferred interface language')}
                </p>
                
                <div className="flex flex-wrap gap-2">
                    {[
                        { code: 'en', label: 'English', flag: '🇬🇧' },
                        { code: 'pl', label: 'Polski', flag: '🇵🇱' },
                        { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
                        { code: 'es', label: 'Español', flag: '🇪🇸' },
                        { code: 'ar', label: 'العربية', flag: '🇸🇦' },
                        { code: 'ja', label: '日本語', flag: '🇯🇵' },
                    ].map(lang => {
                        const isSelected = i18n.language === lang.code;
                        return (
                            <button
                                key={lang.code}
                                onClick={() => i18n.changeLanguage(lang.code)}
                                className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-all ${
                                    isSelected
                                        ? 'bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 border-2 border-purple-500'
                                        : 'bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-400 border-2 border-transparent hover:border-purple-300'
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






