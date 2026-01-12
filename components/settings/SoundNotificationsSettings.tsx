/**
 * SoundNotificationsSettings - Sound preferences per notification type
 *
 * Features:
 * - Enable/disable sounds
 * - Select sound per notification type
 * - Desktop notification position
 * - Desktop notification duration
 */

import { AlertCircle, CheckCircle, Loader2, Monitor, Save, Volume2, VolumeX } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '../../services/api';
import { User } from '../../types';

interface SoundNotificationsSettingsProps {
    currentUser: User;
    onUpdateUser: (updates: Partial<User>) => void;
}

const SOUND_OPTIONS = [
    { value: 'default', label: 'Default' },
    { value: 'chime', label: 'Chime' },
    { value: 'bell', label: 'Bell' },
    { value: 'pop', label: 'Pop' },
    { value: 'none', label: 'None' },
] as const;

const POSITION_OPTIONS = [
    { value: 'top-right', label: 'Top Right' },
    { value: 'top-left', label: 'Top Left' },
    { value: 'bottom-right', label: 'Bottom Right' },
    { value: 'bottom-left', label: 'Bottom Left' },
] as const;

const NOTIFICATION_TYPES = [
    { id: 'task_assigned', label: 'Task Assigned' },
    { id: 'task_updated', label: 'Task Updated' },
    { id: 'mention', label: 'Mentions' },
    { id: 'milestone', label: 'Milestones' },
] as const;

export const SoundNotificationsSettings: React.FC<SoundNotificationsSettingsProps> = ({
    currentUser,
    onUpdateUser,
}) => {
    const { t } = useTranslation();
    const [soundEnabled, setSoundEnabled] = useState(true);
    const [soundPerType, setSoundPerType] = useState<Record<string, string>>({});
    const [desktopPosition, setDesktopPosition] = useState('top-right');
    const [desktopDuration, setDesktopDuration] = useState(5000);
    const [isSaving, setIsSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');

    useEffect(() => {
        // Load preferences from API
        const loadPreferences = async () => {
            try {
                const prefs = await Api.get('/settings/notifications/sounds');
                if (prefs) {
                    setSoundEnabled(prefs.soundEnabled !== false);
                    setSoundPerType(prefs.soundPerType || {});
                    setDesktopPosition(prefs.desktopPosition || 'top-right');
                    setDesktopDuration(prefs.desktopDuration || 5000);
                }
            } catch (err) {
                console.error('Failed to load sound preferences', err);
            }
        };
        loadPreferences();
    }, []);

    const handleSave = async () => {
        setIsSaving(true);
        setSaveStatus('idle');

        try {
            await Api.put('/settings/notifications/sounds', {
                soundEnabled,
                soundPerType,
                desktopPosition,
                desktopDuration,
            });

            setSaveStatus('success');
            toast.success(t('settings.notifications.sounds.saved', 'Sound preferences saved'));

            setTimeout(() => setSaveStatus('idle'), 2000);
        } catch (error: any) {
            setSaveStatus('error');
            toast.error(error.message || t('settings.notifications.sounds.error', 'Failed to save sound preferences'));
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                    {t('settings.notifications.sounds.title', 'Sound & Desktop Notifications')}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                    {t(
                        'settings.notifications.sounds.subtitle',
                        'Configure sound alerts and desktop notification settings',
                    )}
                </p>
            </div>

            {/* Sound Toggle */}
            <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-navy-950/50 rounded-lg border border-slate-200 dark:border-white/10">
                <div className="flex items-center gap-3">
                    {soundEnabled ? (
                        <Volume2 size={20} className="text-purple-600" />
                    ) : (
                        <VolumeX size={20} className="text-slate-400" />
                    )}
                    <div>
                        <label className="text-sm font-medium text-slate-900 dark:text-white">
                            {t('settings.notifications.sounds.enableSounds', 'Enable Sounds')}
                        </label>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                            {t('settings.notifications.sounds.enableSoundsDesc', 'Play sound alerts for notifications')}
                        </p>
                    </div>
                </div>
                <button
                    onClick={() => setSoundEnabled(!soundEnabled)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        soundEnabled ? 'bg-purple-600' : 'bg-slate-300 dark:bg-slate-600'
                    }`}
                >
                    <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            soundEnabled ? 'translate-x-6' : 'translate-x-1'
                        }`}
                    />
                </button>
            </div>

            {/* Sound per Type */}
            {soundEnabled && (
                <div className="space-y-4">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                        {t('settings.notifications.sounds.soundPerType', 'Sound per Notification Type')}
                    </label>
                    {NOTIFICATION_TYPES.map((type) => (
                        <div key={type.id} className="flex items-center justify-between">
                            <span className="text-sm text-slate-600 dark:text-slate-400">{type.label}</span>
                            <select
                                value={soundPerType[type.id] || 'default'}
                                onChange={(e) => setSoundPerType({ ...soundPerType, [type.id]: e.target.value })}
                                className="px-3 py-1.5 bg-slate-50 dark:bg-navy-950/50 border border-slate-200 dark:border-white/10 rounded-lg text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500/50 outline-none"
                            >
                                {SOUND_OPTIONS.map((option) => (
                                    <option key={option.value} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                    ))}
                </div>
            )}

            {/* Desktop Position */}
            <div className="space-y-4">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
                    <Monitor size={16} />
                    {t('settings.notifications.sounds.desktopPosition', 'Desktop Notification Position')}
                </label>
                <div className="grid grid-cols-2 gap-3">
                    {POSITION_OPTIONS.map((option) => (
                        <button
                            key={option.value}
                            onClick={() => setDesktopPosition(option.value)}
                            className={`px-4 py-2 rounded-lg border-2 transition-all text-sm ${
                                desktopPosition === option.value
                                    ? 'border-purple-500 bg-purple-50 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300'
                                    : 'border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:border-purple-300'
                            }`}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Desktop Duration */}
            <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                    {t('settings.notifications.sounds.desktopDuration', 'Desktop Notification Duration')}
                </label>
                <div className="flex items-center gap-4">
                    <input
                        type="range"
                        min="1000"
                        max="10000"
                        step="500"
                        value={desktopDuration}
                        onChange={(e) => setDesktopDuration(Number(e.target.value))}
                        className="flex-1"
                    />
                    <span className="text-sm text-slate-600 dark:text-slate-400 w-20 text-right">
                        {desktopDuration / 1000}s
                    </span>
                </div>
            </div>

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
                    {t('settings.notifications.sounds.saved', 'Sound preferences saved')}
                </div>
            )}
            {saveStatus === 'error' && (
                <div className="flex items-center gap-2 text-red-600 dark:text-red-400 text-sm">
                    <AlertCircle size={16} />
                    {t('settings.notifications.sounds.error', 'Failed to save sound preferences')}
                </div>
            )}
        </div>
    );
};

export default SoundNotificationsSettings;
