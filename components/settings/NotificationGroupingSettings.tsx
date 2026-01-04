/**
 * NotificationGroupingSettings - Notification grouping options
 *
 * Features:
 * - Enable/disable grouping
 * - Group by (project, type, time)
 * - Batch window
 */

import { AlertCircle, CheckCircle, Layers, Loader2, Save } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '../../services/api';
import { User } from '../../types';

interface NotificationGroupingSettingsProps {
    currentUser: User;
    onUpdateUser: (updates: Partial<User>) => void;
}

const GROUPING_OPTIONS = [
    { value: 'project', label: 'By Project' },
    { value: 'type', label: 'By Type' },
    { value: 'time', label: 'By Time' },
] as const;

export const NotificationGroupingSettings: React.FC<NotificationGroupingSettingsProps> = ({
    currentUser,
    onUpdateUser,
}) => {
    const { t } = useTranslation();
    const [groupingEnabled, setGroupingEnabled] = useState(true);
    const [groupingBy, setGroupingBy] = useState<'project' | 'type' | 'time'>('project');
    const [batchingEnabled, setBatchingEnabled] = useState(true);
    const [batchWindow, setBatchWindow] = useState(5);
    const [isSaving, setIsSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');

    useEffect(() => {
        const loadPreferences = async () => {
            try {
                const prefs = await Api.get('/settings/notifications/grouping');
                if (prefs) {
                    setGroupingEnabled(prefs.enabled !== false);
                    setGroupingBy(prefs.groupingBy || 'project');
                    setBatchingEnabled(prefs.batchingEnabled !== false);
                    setBatchWindow(prefs.batchWindow || 5);
                }
            } catch (err) {
                console.error('Failed to load grouping preferences', err);
            }
        };
        loadPreferences();
    }, []);

    const handleSave = async () => {
        setIsSaving(true);
        setSaveStatus('idle');

        try {
            await Api.put('/settings/notifications/grouping', {
                enabled: groupingEnabled,
                groupingBy,
                batchingEnabled,
                batchWindow,
            });

            setSaveStatus('success');
            toast.success(t('settings.notifications.grouping.saved', 'Grouping preferences saved'));

            setTimeout(() => setSaveStatus('idle'), 2000);
        } catch (error: any) {
            setSaveStatus('error');
            toast.error(
                error.message || t('settings.notifications.grouping.error', 'Failed to save grouping preferences'),
            );
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
                    <Layers size={20} />
                    {t('settings.notifications.grouping.title', 'Notification Grouping')}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                    {t(
                        'settings.notifications.grouping.subtitle',
                        'Organize notifications by grouping similar ones together',
                    )}
                </p>
            </div>

            {/* Grouping Toggle */}
            <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-navy-950/50 rounded-lg border border-slate-200 dark:border-white/10">
                <div>
                    <label className="text-sm font-medium text-slate-900 dark:text-white">
                        {t('settings.notifications.grouping.enable', 'Enable Grouping')}
                    </label>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                        {t('settings.notifications.grouping.enableDesc', 'Group similar notifications together')}
                    </p>
                </div>
                <button
                    onClick={() => setGroupingEnabled(!groupingEnabled)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        groupingEnabled ? 'bg-purple-600' : 'bg-slate-300 dark:bg-slate-600'
                    }`}
                >
                    <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            groupingEnabled ? 'translate-x-6' : 'translate-x-1'
                        }`}
                    />
                </button>
            </div>

            {groupingEnabled && (
                <>
                    {/* Group By */}
                    <div className="space-y-4">
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                            {t('settings.notifications.grouping.groupBy', 'Group By')}
                        </label>
                        <div className="grid grid-cols-3 gap-3">
                            {GROUPING_OPTIONS.map((option) => (
                                <button
                                    key={option.value}
                                    onClick={() => setGroupingBy(option.value)}
                                    className={`px-4 py-2 rounded-lg border-2 transition-all text-sm ${
                                        groupingBy === option.value
                                            ? 'border-purple-500 bg-purple-50 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300'
                                            : 'border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:border-purple-300'
                                    }`}
                                >
                                    {option.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Batching */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <label className="text-sm font-medium text-slate-900 dark:text-white">
                                    {t('settings.notifications.grouping.batching', 'Batching')}
                                </label>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    {t(
                                        'settings.notifications.grouping.batchingDesc',
                                        'Batch notifications within a time window',
                                    )}
                                </p>
                            </div>
                            <button
                                onClick={() => setBatchingEnabled(!batchingEnabled)}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                    batchingEnabled ? 'bg-purple-600' : 'bg-slate-300 dark:bg-slate-600'
                                }`}
                            >
                                <span
                                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                        batchingEnabled ? 'translate-x-6' : 'translate-x-1'
                                    }`}
                                />
                            </button>
                        </div>
                        {batchingEnabled && (
                            <div className="space-y-2">
                                <label className="text-xs text-slate-500 dark:text-slate-400">
                                    {t('settings.notifications.grouping.batchWindow', 'Batch Window (minutes)')}
                                </label>
                                <input
                                    type="number"
                                    min="1"
                                    max="60"
                                    value={batchWindow}
                                    onChange={(e) => setBatchWindow(Number(e.target.value))}
                                    className="w-full px-3 py-2 bg-slate-50 dark:bg-navy-950/50 border border-slate-200 dark:border-white/10 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500/50 outline-none"
                                />
                            </div>
                        )}
                    </div>
                </>
            )}

            {/* Save Button */}
            <div className="flex justify-end">
                <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isSaving ? (
                        <>
                            <Loader2 size={16} className="animate-spin" />
                            {t('common.saving', 'Saving...')}
                        </>
                    ) : (
                        <>
                            <Save size={16} />
                            {t('common.save', 'Save')}
                        </>
                    )}
                </button>
            </div>

            {/* Success/Error Messages */}
            {saveStatus === 'success' && (
                <div className="flex items-center gap-2 text-green-600 dark:text-green-400 text-sm">
                    <CheckCircle size={16} />
                    {t('settings.notifications.grouping.saved', 'Grouping preferences saved')}
                </div>
            )}
            {saveStatus === 'error' && (
                <div className="flex items-center gap-2 text-red-600 dark:text-red-400 text-sm">
                    <AlertCircle size={16} />
                    {t('settings.notifications.grouping.error', 'Failed to save grouping preferences')}
                </div>
            )}
        </div>
    );
};

export default NotificationGroupingSettings;



