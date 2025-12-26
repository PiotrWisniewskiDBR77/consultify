/**
 * NotificationPreferences - User notification settings panel
 * Part of My Work Module PMO Upgrade
 */

import React from 'react';
import { motion } from 'framer-motion';
import {
    Bell,
    Mail,
    Smartphone,
    Monitor,
    Moon,
    Calendar,
    Loader2,
    Save
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNotificationPreferences } from '../../../hooks/useNotificationPreferences';
import type { NotificationCategory, ChannelSettings } from '../../../types/myWork';

interface NotificationPreferencesProps {
    className?: string;
}

/**
 * Notification category configuration
 */
const categoryConfig: Record<NotificationCategory, { label: string; description: string; icon: React.ReactNode }> = {
    task_assigned: {
        label: 'Task Assigned',
        description: 'When a task is assigned to you',
        icon: <Bell size={16} />
    },
    task_due_soon: {
        label: 'Task Due Soon',
        description: 'Reminder for upcoming deadlines',
        icon: <Calendar size={16} />
    },
    task_overdue: {
        label: 'Task Overdue',
        description: 'When a task passes its due date',
        icon: <Bell size={16} />
    },
    decision_required: {
        label: 'Decision Required',
        description: 'When your decision is needed',
        icon: <Bell size={16} />
    },
    mention: {
        label: '@Mentions',
        description: 'When someone mentions you',
        icon: <Bell size={16} />
    },
    comment: {
        label: 'Comments',
        description: 'New comments on your tasks',
        icon: <Bell size={16} />
    },
    status_change: {
        label: 'Status Changes',
        description: 'When task status changes',
        icon: <Bell size={16} />
    },
    ai_insight: {
        label: 'AI Insights',
        description: 'AI-generated recommendations',
        icon: <Bell size={16} />
    },
    phase_transition: {
        label: 'Phase Transitions',
        description: 'Project phase changes',
        icon: <Bell size={16} />
    },
    blocking_alert: {
        label: 'Blocking Alerts',
        description: 'Critical blocking issues',
        icon: <Bell size={16} />
    }
};

/**
 * Channel toggle component
 */
const ChannelToggle: React.FC<{
    channel: keyof ChannelSettings;
    enabled: boolean;
    onChange: (enabled: boolean) => void;
    icon: React.ReactNode;
    label: string;
}> = ({ enabled, onChange, icon, label }) => (
    <button
        onClick={() => onChange(!enabled)}
        className={`
            flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs transition-colors
            ${enabled 
                ? 'bg-brand/10 text-brand dark:bg-brand/20 border border-brand/20' 
                : 'bg-slate-100 dark:bg-white/5 text-slate-500 border border-transparent hover:border-slate-200 dark:hover:border-white/10'
            }
        `}
        title={label}
    >
        {icon}
        <span className="hidden sm:inline">{label}</span>
    </button>
);

/**
 * Category row component
 */
const CategoryRow: React.FC<{
    category: NotificationCategory;
    settings: ChannelSettings;
    onChannelChange: (channel: keyof ChannelSettings, enabled: boolean) => void;
}> = ({ category, settings, onChannelChange }) => {
    const config = categoryConfig[category];
    if (!config) return null;
    
    return (
        <div className="flex items-center justify-between py-3 border-b border-slate-100 dark:border-white/5 last:border-0">
            <div className="flex items-center gap-3">
                <div className="text-slate-400">
                    {config.icon}
                </div>
                <div>
                    <h4 className="text-sm font-medium text-navy-900 dark:text-white">
                        {config.label}
                    </h4>
                    <p className="text-xs text-slate-500">
                        {config.description}
                    </p>
                </div>
            </div>
            
            <div className="flex items-center gap-2">
                <ChannelToggle
                    channel="inapp"
                    enabled={settings.inapp}
                    onChange={(v) => onChannelChange('inapp', v)}
                    icon={<Monitor size={12} />}
                    label="In-App"
                />
                <ChannelToggle
                    channel="push"
                    enabled={settings.push}
                    onChange={(v) => onChannelChange('push', v)}
                    icon={<Smartphone size={12} />}
                    label="Push"
                />
                <ChannelToggle
                    channel="email"
                    enabled={settings.email}
                    onChange={(v) => onChannelChange('email', v)}
                    icon={<Mail size={12} />}
                    label="Email"
                />
            </div>
        </div>
    );
};

/**
 * NotificationPreferences Component
 */
export const NotificationPreferences: React.FC<NotificationPreferencesProps> = ({ className = '' }) => {
    const { t } = useTranslation();
    const {
        preferences,
        loading,
        saving,
        updateCategoryChannel,
        updateQuietHours,
        updateDigestSettings
    } = useNotificationPreferences();
    
    if (loading) {
        return (
            <div className={`flex items-center justify-center p-12 ${className}`}>
                <Loader2 size={32} className="animate-spin text-brand" />
            </div>
        );
    }
    
    if (!preferences) {
        return (
            <div className={`text-center p-8 text-slate-500 ${className}`}>
                {t('myWork.notifications.loadError', 'Failed to load preferences')}
            </div>
        );
    }
    
    return (
        <div className={`space-y-6 ${className}`}>
            {/* Saving indicator */}
            {saving && (
                <div className="fixed top-4 right-4 bg-brand text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 z-50">
                    <Loader2 size={16} className="animate-spin" />
                    <span className="text-sm">{t('common.saving', 'Saving...')}</span>
                </div>
            )}
            
            {/* Category Preferences */}
            <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-white/10 p-6">
                <h3 className="text-lg font-semibold text-navy-900 dark:text-white mb-4">
                    {t('myWork.notifications.categories', 'Notification Categories')}
                </h3>
                
                <p className="text-sm text-slate-500 mb-6">
                    {t('myWork.notifications.categoriesDescription', 'Choose how you want to receive different types of notifications.')}
                </p>
                
                <div className="space-y-1">
                    {(Object.keys(categoryConfig) as NotificationCategory[]).map(category => (
                        <CategoryRow
                            key={category}
                            category={category}
                            settings={preferences.categories[category] || { inapp: true, push: false, email: false }}
                            onChannelChange={(channel, enabled) => updateCategoryChannel(category, channel, enabled)}
                        />
                    ))}
                </div>
            </div>
            
            {/* Quiet Hours */}
            <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-white/10 p-6">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <Moon size={18} className="text-slate-400" />
                        <h3 className="text-lg font-semibold text-navy-900 dark:text-white">
                            {t('myWork.notifications.quietHours', 'Quiet Hours')}
                        </h3>
                    </div>
                    
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input
                            type="checkbox"
                            checked={preferences.quietHours?.enabled || false}
                            onChange={(e) => updateQuietHours(e.target.checked)}
                            className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-brand/20 dark:peer-focus:ring-brand/40 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-brand"></div>
                    </label>
                </div>
                
                <p className="text-sm text-slate-500 mb-4">
                    {t('myWork.notifications.quietHoursDescription', 'Pause notifications during specific hours. Critical notifications will still come through.')}
                </p>
                
                {preferences.quietHours?.enabled && (
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <label className="text-sm text-slate-600 dark:text-slate-400">From</label>
                            <input
                                type="time"
                                value={preferences.quietHours?.start || '20:00'}
                                onChange={(e) => updateQuietHours(true, e.target.value)}
                                className="px-3 py-1.5 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg text-sm"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <label className="text-sm text-slate-600 dark:text-slate-400">To</label>
                            <input
                                type="time"
                                value={preferences.quietHours?.end || '08:00'}
                                onChange={(e) => updateQuietHours(true, undefined, e.target.value)}
                                className="px-3 py-1.5 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg text-sm"
                            />
                        </div>
                    </div>
                )}
            </div>
            
            {/* Digest Settings */}
            <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-white/10 p-6">
                <div className="flex items-center gap-2 mb-4">
                    <Calendar size={18} className="text-slate-400" />
                    <h3 className="text-lg font-semibold text-navy-900 dark:text-white">
                        {t('myWork.notifications.digest', 'Email Digest')}
                    </h3>
                </div>
                
                <div className="space-y-4">
                    {/* Daily Digest */}
                    <div className="flex items-center justify-between py-3 border-b border-slate-100 dark:border-white/5">
                        <div>
                            <h4 className="text-sm font-medium text-navy-900 dark:text-white">
                                {t('myWork.notifications.dailyDigest', 'Daily Digest')}
                            </h4>
                            <p className="text-xs text-slate-500">
                                {t('myWork.notifications.dailyDigestDesc', 'Summary of your tasks and activity')}
                            </p>
                        </div>
                        
                        <div className="flex items-center gap-3">
                            {preferences.dailyDigest?.enabled && (
                                <input
                                    type="time"
                                    value={preferences.dailyDigest?.time || '09:00'}
                                    onChange={(e) => updateDigestSettings('daily', { time: e.target.value })}
                                    className="px-3 py-1.5 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg text-sm"
                                />
                            )}
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={preferences.dailyDigest?.enabled || false}
                                    onChange={(e) => updateDigestSettings('daily', { enabled: e.target.checked })}
                                    className="sr-only peer"
                                />
                                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-brand/20 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand"></div>
                            </label>
                        </div>
                    </div>
                    
                    {/* Weekly Digest */}
                    <div className="flex items-center justify-between py-3">
                        <div>
                            <h4 className="text-sm font-medium text-navy-900 dark:text-white">
                                {t('myWork.notifications.weeklyDigest', 'Weekly Digest')}
                            </h4>
                            <p className="text-xs text-slate-500">
                                {t('myWork.notifications.weeklyDigestDesc', 'Weekly summary with trends and insights')}
                            </p>
                        </div>
                        
                        <div className="flex items-center gap-3">
                            {preferences.weeklyDigest?.enabled && (
                                <>
                                    <select
                                        value={preferences.weeklyDigest?.day || 'monday'}
                                        onChange={(e) => updateDigestSettings('weekly', { day: e.target.value })}
                                        className="px-3 py-1.5 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg text-sm"
                                    >
                                        {['monday', 'tuesday', 'wednesday', 'thursday', 'friday'].map(day => (
                                            <option key={day} value={day}>{day.charAt(0).toUpperCase() + day.slice(1)}</option>
                                        ))}
                                    </select>
                                    <input
                                        type="time"
                                        value={preferences.weeklyDigest?.time || '09:00'}
                                        onChange={(e) => updateDigestSettings('weekly', { time: e.target.value })}
                                        className="px-3 py-1.5 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg text-sm"
                                    />
                                </>
                            )}
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={preferences.weeklyDigest?.enabled || false}
                                    onChange={(e) => updateDigestSettings('weekly', { enabled: e.target.checked })}
                                    className="sr-only peer"
                                />
                                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-brand/20 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand"></div>
                            </label>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default NotificationPreferences;

