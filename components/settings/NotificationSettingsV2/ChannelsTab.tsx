/**
 * ChannelsTab - Email notification preferences
 * Configure which emails you want to receive
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Mail, Check } from 'lucide-react';
import type { NotificationPreferences } from '../../../hooks/useUserNotificationPreferences';
import type { UserIntegration, Provider } from '../../../hooks/useUserIntegrations';

interface ChannelsTabProps {
    preferences: NotificationPreferences;
    integrations: UserIntegration[];
    providers: Provider[];
    onUpdatePreferences: (updates: Partial<NotificationPreferences>) => Promise<void>;
}

const EMAIL_CATEGORIES = [
    { key: 'taskUpdates', label: 'Task Updates', desc: 'Updates on tasks assigned to you' },
    { key: 'projectAlerts', label: 'Project Alerts', desc: 'Important project notifications' },
    { key: 'weeklyDigest', label: 'Weekly Digest', desc: 'Weekly summary of activity' },
    { key: 'marketing', label: 'Marketing', desc: 'Product updates and tips' },
] as const;

const ChannelsTab: React.FC<ChannelsTabProps> = ({
    preferences,
    integrations,
    providers,
    onUpdatePreferences
}) => {
    const { t } = useTranslation();
    
    // Get email settings from preferences
    const getEmailEnabled = (key: string): boolean => {
        switch (key) {
            case 'taskUpdates':
                return preferences.categories.tasks?.channels?.email ?? true;
            case 'projectAlerts':
                return preferences.categories.governance?.channels?.email ?? true;
            case 'weeklyDigest':
                return preferences.digests?.weeklyEnabled ?? true;
            case 'marketing':
                return false; // Default off
            default:
                return true;
        }
    };

    const toggleEmail = async (key: string) => {
        const current = getEmailEnabled(key);
        
        switch (key) {
            case 'taskUpdates':
                await onUpdatePreferences({
                    categories: {
                        ...preferences.categories,
                        tasks: {
                            ...preferences.categories.tasks,
                            channels: {
                                ...preferences.categories.tasks.channels,
                                email: !current
                            }
                        }
                    }
                });
                break;
            case 'projectAlerts':
                await onUpdatePreferences({
                    categories: {
                        ...preferences.categories,
                        governance: {
                            ...preferences.categories.governance,
                            channels: {
                                ...preferences.categories.governance.channels,
                                email: !current
                            }
                        }
                    }
                });
                break;
            case 'weeklyDigest':
                await onUpdatePreferences({
                    digests: {
                        ...preferences.digests,
                        weeklyEnabled: !current
                    }
                });
                break;
            default:
                break;
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-medium text-slate-900 dark:text-white flex items-center gap-2">
                    <Mail size={20} />
                    {t('settings.notifications.emailTitle', 'Email Notifications')}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    {t('settings.notifications.emailDesc', 'Choose which emails you want to receive.')}
                </p>
            </div>

            <div className="space-y-3">
                {EMAIL_CATEGORIES.map(({ key, label, desc }) => {
                    const enabled = getEmailEnabled(key);
                    
                    return (
                        <div
                            key={key}
                            className="flex items-center justify-between p-4 bg-slate-50 dark:bg-navy-800/50 rounded-lg"
                        >
                            <div>
                                <p className="font-medium text-slate-900 dark:text-white">
                                    {t(`settings.notifications.${key}`, label)}
                                </p>
                                <p className="text-sm text-slate-500 dark:text-slate-400">
                                    {t(`settings.notifications.${key}Desc`, desc)}
                                </p>
                            </div>
                            <button
                                onClick={() => toggleEmail(key)}
                                className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-colors ${
                                    enabled
                                        ? 'bg-brand border-brand text-white'
                                        : 'border-slate-300 dark:border-navy-600'
                                }`}
                            >
                                {enabled && <Check size={14} />}
                            </button>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default ChannelsTab;







