/**
 * DashboardPreferencesSettings Component
 * 
 * User preferences for dashboard customization:
 * - Default landing page after login
 * - Widget visibility toggles
 * - Compact mode
 * - Greeting message
 * - Auto-refresh interval
 */

import React, { useState, useEffect } from 'react';
import { User } from '../../types';
import { useTranslation } from 'react-i18next';
import { 
    LayoutDashboard, 
    Eye, 
    EyeOff, 
    RefreshCw, 
    Minimize2, 
    MessageSquare,
    Save,
    Loader2,
    Home,
    Briefcase,
    CheckSquare,
    Calendar,
    Brain,
    BarChart3
} from 'lucide-react';
import { Api } from '../../services/api';
import { toast } from 'react-hot-toast';
import { InfoButton } from '../shared/InfoButton';

interface DashboardPreferencesSettingsProps {
    currentUser: User;
    onUpdateUser: (updates: Partial<User>) => void;
}

interface DashboardPreferences {
    defaultLandingPage: 'dashboard' | 'projects' | 'tasks' | 'calendar' | 'ai-assistant';
    showGreeting: boolean;
    compactMode: boolean;
    autoRefreshInterval: number; // in seconds, 0 = disabled
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

const DEFAULT_PREFERENCES: DashboardPreferences = {
    defaultLandingPage: 'dashboard',
    showGreeting: true,
    compactMode: false,
    autoRefreshInterval: 60,
    widgets: {
        tasks: true,
        initiatives: true,
        calendar: true,
        aiInsights: true,
        recentActivity: true,
        quickActions: true,
        metrics: true
    }
};

export const DashboardPreferencesSettings: React.FC<DashboardPreferencesSettingsProps> = ({ currentUser, onUpdateUser }) => {
    const { t } = useTranslation();
    const [preferences, setPreferences] = useState<DashboardPreferences>(DEFAULT_PREFERENCES);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        loadPreferences();
    }, [currentUser.id]);

    const loadPreferences = async () => {
        try {
            const data = await Api.get('/settings/preferences/dashboard');
            if (data.preferences) {
                setPreferences({ ...DEFAULT_PREFERENCES, ...data.preferences });
            }
        } catch (error) {
            console.error('Failed to load dashboard preferences:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await Api.put('/settings/preferences/dashboard', { preferences });
            toast.success(t('settings.dashboard.saved', 'Dashboard preferences saved successfully'));
        } catch (error) {
            toast.error(t('settings.dashboard.error', 'Failed to save preferences'));
        } finally {
            setSaving(false);
        }
    };

    const updatePreference = <K extends keyof DashboardPreferences>(key: K, value: DashboardPreferences[K]) => {
        setPreferences(prev => ({ ...prev, [key]: value }));
    };

    const toggleWidget = (widget: keyof DashboardPreferences['widgets']) => {
        setPreferences(prev => ({
            ...prev,
            widgets: { ...prev.widgets, [widget]: !prev.widgets[widget] }
        }));
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 size={32} className="animate-spin text-purple-600" />
            </div>
        );
    }

    const landingPageOptions = [
        { value: 'dashboard', label: t('settings.dashboard.pages.dashboard', 'Dashboard'), icon: LayoutDashboard },
        { value: 'projects', label: t('settings.dashboard.pages.projects', 'Projects'), icon: Briefcase },
        { value: 'tasks', label: t('settings.dashboard.pages.tasks', 'My Tasks'), icon: CheckSquare },
        { value: 'calendar', label: t('settings.dashboard.pages.calendar', 'Calendar'), icon: Calendar },
        { value: 'ai-assistant', label: t('settings.dashboard.pages.ai', 'AI Assistant'), icon: Brain }
    ];

    const widgetOptions = [
        { key: 'tasks' as const, label: t('settings.dashboard.widgets.tasks', 'My Tasks'), icon: CheckSquare },
        { key: 'initiatives' as const, label: t('settings.dashboard.widgets.initiatives', 'Active Initiatives'), icon: Briefcase },
        { key: 'calendar' as const, label: t('settings.dashboard.widgets.calendar', 'Calendar Preview'), icon: Calendar },
        { key: 'aiInsights' as const, label: t('settings.dashboard.widgets.aiInsights', 'AI Insights'), icon: Brain },
        { key: 'recentActivity' as const, label: t('settings.dashboard.widgets.activity', 'Recent Activity'), icon: RefreshCw },
        { key: 'quickActions' as const, label: t('settings.dashboard.widgets.quickActions', 'Quick Actions'), icon: Home },
        { key: 'metrics' as const, label: t('settings.dashboard.widgets.metrics', 'Metrics Overview'), icon: BarChart3 }
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
                        {t('settings.dashboard.description', 'Customize your dashboard layout and default views')}
                    </p>
                </div>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-colors disabled:opacity-50"
                >
                    {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                    {saving ? t('settings.saving', 'Saving...') : t('settings.save', 'Save Changes')}
                </button>
            </div>

            {/* Default Landing Page */}
            <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                    <Home size={20} className="text-blue-500" />
                    {t('settings.dashboard.landingPage', 'Default Landing Page')}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                    {t('settings.dashboard.landingPageDescription', 'Choose where you want to land after logging in')}
                </p>
                
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    {landingPageOptions.map(option => {
                        const Icon = option.icon;
                        const isSelected = preferences.defaultLandingPage === option.value;
                        return (
                            <button
                                key={option.value}
                                onClick={() => updatePreference('defaultLandingPage', option.value as DashboardPreferences['defaultLandingPage'])}
                                className={`p-4 rounded-xl border-2 transition-all text-center ${
                                    isSelected
                                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10'
                                        : 'border-slate-200 dark:border-white/10 hover:border-blue-300 dark:hover:border-blue-500/50'
                                }`}
                            >
                                <Icon size={24} className={`mx-auto ${isSelected ? 'text-blue-600' : 'text-slate-400'}`} />
                                <div className={`mt-2 text-sm font-medium ${isSelected ? 'text-blue-700 dark:text-blue-400' : 'text-slate-700 dark:text-slate-300'}`}>
                                    {option.label}
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Widget Visibility */}
            <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                    <Eye size={20} className="text-green-500" />
                    {t('settings.dashboard.widgetVisibility', 'Widget Visibility')}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                    {t('settings.dashboard.widgetVisibilityDescription', 'Choose which widgets to show on your dashboard')}
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {widgetOptions.map(option => {
                        const Icon = option.icon;
                        const isEnabled = preferences.widgets[option.key];
                        return (
                            <div
                                key={option.key}
                                className="flex items-center justify-between p-4 rounded-lg bg-slate-50 dark:bg-navy-950 border border-slate-100 dark:border-white/5"
                            >
                                <div className="flex items-center gap-3">
                                    <Icon size={20} className={isEnabled ? 'text-green-500' : 'text-slate-400'} />
                                    <span className="font-medium text-slate-700 dark:text-slate-300">{option.label}</span>
                                </div>
                                <button
                                    onClick={() => toggleWidget(option.key)}
                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                        isEnabled ? 'bg-green-600' : 'bg-slate-200 dark:bg-slate-700'
                                    }`}
                                >
                                    <span className={`${isEnabled ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white transition-transform`} />
                                </button>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Display Options */}
            <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                    <Minimize2 size={20} className="text-purple-500" />
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
                                {t('settings.dashboard.compactModeDescription', 'Reduce padding and margins for denser information display')}
                            </p>
                        </div>
                        <button
                            onClick={() => updatePreference('compactMode', !preferences.compactMode)}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                preferences.compactMode ? 'bg-purple-600' : 'bg-slate-200 dark:bg-slate-700'
                            }`}
                        >
                            <span className={`${preferences.compactMode ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white transition-transform`} />
                        </button>
                    </div>

                    {/* Show Greeting */}
                    <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-white/5">
                        <div>
                            <label className="block font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
                                <MessageSquare size={16} className="text-amber-500" />
                                {t('settings.dashboard.showGreeting', 'Show Greeting Message')}
                            </label>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                {t('settings.dashboard.showGreetingDescription', 'Display personalized greeting on dashboard')}
                            </p>
                        </div>
                        <button
                            onClick={() => updatePreference('showGreeting', !preferences.showGreeting)}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                preferences.showGreeting ? 'bg-purple-600' : 'bg-slate-200 dark:bg-slate-700'
                            }`}
                        >
                            <span className={`${preferences.showGreeting ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white transition-transform`} />
                        </button>
                    </div>

                    {/* Auto Refresh */}
                    <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-white/5">
                        <div>
                            <label className="block font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
                                <RefreshCw size={16} className="text-blue-500" />
                                {t('settings.dashboard.autoRefresh', 'Auto-Refresh Interval')}
                            </label>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                {t('settings.dashboard.autoRefreshDescription', 'Automatically refresh dashboard data')}
                            </p>
                        </div>
                        <select
                            value={preferences.autoRefreshInterval}
                            onChange={(e) => updatePreference('autoRefreshInterval', parseInt(e.target.value))}
                            className="px-4 py-2 bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-white/10 rounded-lg text-slate-900 dark:text-white"
                        >
                            <option value="0">{t('settings.dashboard.disabled', 'Disabled')}</option>
                            <option value="30">{t('settings.dashboard.seconds', '{{count}} seconds', { count: 30 })}</option>
                            <option value="60">{t('settings.dashboard.minute', '1 minute')}</option>
                            <option value="300">{t('settings.dashboard.minutes', '{{count}} minutes', { count: 5 })}</option>
                            <option value="600">{t('settings.dashboard.minutes', '{{count}} minutes', { count: 10 })}</option>
                        </select>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DashboardPreferencesSettings;


