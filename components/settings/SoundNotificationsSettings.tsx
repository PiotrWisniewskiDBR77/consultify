/**
 * SoundNotificationsSettings - Sound notification preferences
 * 
 * Features:
 * - Enable/disable sound notifications
 * - Volume control
 * - Sound selection
 * - Preview sounds
 * - Quiet hours
 */

import React, { useState, useEffect, useRef } from 'react';
import { User } from '../../types';
import { useTranslation } from 'react-i18next';
import { 
    Volume2, 
    VolumeX, 
    Volume1,
    Bell,
    Play,
    Pause,
    Moon,
    Save,
    Loader2,
    Clock
} from 'lucide-react';
import { Api } from '../../services/api';
import { toast } from 'react-hot-toast';

interface SoundNotificationsSettingsProps {
    currentUser: User;
    className?: string;
}

interface SoundPreferences {
    enabled: boolean;
    volume: number; // 0-100
    soundTheme: 'default' | 'minimal' | 'playful' | 'professional';
    
    // Individual sounds
    taskAssigned: boolean;
    taskCompleted: boolean;
    mention: boolean;
    message: boolean;
    reminder: boolean;
    
    // Quiet Hours
    quietHoursEnabled: boolean;
    quietHoursStart: string; // HH:mm
    quietHoursEnd: string;   // HH:mm
    quietHoursWeekends: boolean;
}

const DEFAULT_PREFERENCES: SoundPreferences = {
    enabled: true,
    volume: 70,
    soundTheme: 'default',
    taskAssigned: true,
    taskCompleted: true,
    mention: true,
    message: true,
    reminder: true,
    quietHoursEnabled: false,
    quietHoursStart: '22:00',
    quietHoursEnd: '08:00',
    quietHoursWeekends: true
};

// Sound themes
const SOUND_THEMES = [
    { id: 'default', name: 'Default', description: 'Clean, professional sounds' },
    { id: 'minimal', name: 'Minimal', description: 'Subtle, quiet notifications' },
    { id: 'playful', name: 'Playful', description: 'Fun, engaging sounds' },
    { id: 'professional', name: 'Professional', description: 'Discreet, office-friendly' }
];

// Notification types
const NOTIFICATION_TYPES = [
    { key: 'taskAssigned', label: 'Task Assigned', description: 'When a task is assigned to you' },
    { key: 'taskCompleted', label: 'Task Completed', description: 'When a task you follow is completed' },
    { key: 'mention', label: 'Mentions', description: 'When someone mentions you' },
    { key: 'message', label: 'Messages', description: 'New chat messages' },
    { key: 'reminder', label: 'Reminders', description: 'Task and event reminders' }
];

export const SoundNotificationsSettings: React.FC<SoundNotificationsSettingsProps> = ({ 
    currentUser,
    className = '' 
}) => {
    const { t } = useTranslation();
    const [preferences, setPreferences] = useState<SoundPreferences>(DEFAULT_PREFERENCES);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [playingSound, setPlayingSound] = useState<string | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    useEffect(() => {
        loadPreferences();
        return () => {
            if (audioRef.current) {
                audioRef.current.pause();
            }
        };
    }, [currentUser.id]);

    const loadPreferences = async () => {
        try {
            const data = await Api.get('/settings/preferences/sound');
            if (data.preferences) {
                setPreferences({ ...DEFAULT_PREFERENCES, ...data.preferences });
            }
        } catch (error) {
            console.error('Failed to load sound preferences:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await Api.put('/settings/preferences/sound', { preferences });
            toast.success(t('settings.sound.saved', 'Sound settings saved'));
        } catch (error) {
            toast.error(t('settings.sound.error', 'Failed to save settings'));
        } finally {
            setSaving(false);
        }
    };

    const updatePreference = <K extends keyof SoundPreferences>(key: K, value: SoundPreferences[K]) => {
        setPreferences(prev => ({ ...prev, [key]: value }));
    };

    const playPreviewSound = (soundType: string) => {
        // In production, this would play actual sound files
        // For now, we use Web Audio API to generate a simple beep
        try {
            const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            // Different frequencies for different sounds
            const frequencies: Record<string, number> = {
                taskAssigned: 523.25,  // C5
                taskCompleted: 659.25, // E5
                mention: 783.99,       // G5
                message: 440,          // A4
                reminder: 587.33       // D5
            };
            
            oscillator.frequency.value = frequencies[soundType] || 440;
            oscillator.type = 'sine';
            gainNode.gain.value = preferences.volume / 100 * 0.3;
            
            oscillator.start();
            setPlayingSound(soundType);
            
            setTimeout(() => {
                oscillator.stop();
                setPlayingSound(null);
            }, 200);
        } catch (error) {
            console.error('Failed to play sound:', error);
        }
    };

    const getVolumeIcon = () => {
        if (!preferences.enabled || preferences.volume === 0) return VolumeX;
        if (preferences.volume < 50) return Volume1;
        return Volume2;
    };

    const VolumeIcon = getVolumeIcon();

    if (loading) {
        return (
            <div className="flex items-center justify-center h-32">
                <Loader2 size={24} className="animate-spin text-purple-600" />
            </div>
        );
    }

    return (
        <div className={`space-y-8 ${className}`}>
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                        <Volume2 size={20} className="text-purple-500" />
                        {t('settings.sound.title', 'Sound Notifications')}
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        {t('settings.sound.description', 'Configure audio alerts for notifications')}
                    </p>
                </div>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-colors disabled:opacity-50"
                >
                    {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                    {saving ? t('settings.saving', 'Saving...') : t('settings.save', 'Save')}
                </button>
            </div>

            {/* Master Sound Toggle */}
            <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-xl p-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-xl ${preferences.enabled ? 'bg-purple-100 dark:bg-purple-500/20' : 'bg-slate-100 dark:bg-slate-800'}`}>
                            <VolumeIcon size={24} className={preferences.enabled ? 'text-purple-600 dark:text-purple-400' : 'text-slate-400'} />
                        </div>
                        <div>
                            <h4 className="font-medium text-slate-900 dark:text-white">
                                {t('settings.sound.enabled', 'Sound Notifications')}
                            </h4>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                {preferences.enabled 
                                    ? t('settings.sound.enabledDesc', 'You will hear sounds for notifications')
                                    : t('settings.sound.disabledDesc', 'All notification sounds are muted')}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => updatePreference('enabled', !preferences.enabled)}
                        className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors ${
                            preferences.enabled ? 'bg-purple-600' : 'bg-slate-200 dark:bg-slate-700'
                        }`}
                    >
                        <span className={`${preferences.enabled ? 'translate-x-8' : 'translate-x-1'} inline-block h-5 w-5 transform rounded-full bg-white transition-transform shadow-sm`} />
                    </button>
                </div>

                {/* Volume Slider */}
                {preferences.enabled && (
                    <div className="mt-6 pt-6 border-t border-slate-100 dark:border-white/5">
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                            {t('settings.sound.volume', 'Volume')}: {preferences.volume}%
                        </label>
                        <div className="flex items-center gap-4">
                            <VolumeX size={18} className="text-slate-400" />
                            <input
                                type="range"
                                min="0"
                                max="100"
                                value={preferences.volume}
                                onChange={(e) => updatePreference('volume', parseInt(e.target.value))}
                                className="flex-1 h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-600"
                            />
                            <Volume2 size={18} className="text-slate-400" />
                        </div>
                    </div>
                )}
            </div>

            {/* Sound Theme */}
            {preferences.enabled && (
                <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-xl p-6">
                    <h4 className="font-medium text-slate-900 dark:text-white mb-4">
                        {t('settings.sound.theme', 'Sound Theme')}
                    </h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {SOUND_THEMES.map(theme => {
                            const isSelected = preferences.soundTheme === theme.id;
                            return (
                                <button
                                    key={theme.id}
                                    onClick={() => updatePreference('soundTheme', theme.id as SoundPreferences['soundTheme'])}
                                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                                        isSelected
                                            ? 'border-purple-500 bg-purple-50 dark:bg-purple-500/10'
                                            : 'border-slate-200 dark:border-white/10 hover:border-purple-300'
                                    }`}
                                >
                                    <span className={`font-medium ${isSelected ? 'text-purple-700 dark:text-purple-300' : 'text-slate-700 dark:text-slate-300'}`}>
                                        {t(`settings.sound.themes.${theme.id}`, theme.name)}
                                    </span>
                                    <p className="text-xs text-slate-500 mt-1">{theme.description}</p>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Individual Sound Settings */}
            {preferences.enabled && (
                <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-xl p-6">
                    <h4 className="font-medium text-slate-900 dark:text-white mb-4">
                        {t('settings.sound.notificationSounds', 'Notification Sounds')}
                    </h4>
                    <div className="space-y-3">
                        {NOTIFICATION_TYPES.map(type => {
                            const isEnabled = preferences[type.key as keyof SoundPreferences] as boolean;
                            return (
                                <div 
                                    key={type.key}
                                    className="flex items-center justify-between p-3 bg-slate-50 dark:bg-navy-950 rounded-lg"
                                >
                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={() => playPreviewSound(type.key)}
                                            disabled={!isEnabled}
                                            className={`p-2 rounded-lg transition-colors ${
                                                isEnabled 
                                                    ? 'hover:bg-purple-100 dark:hover:bg-purple-500/20 text-purple-600' 
                                                    : 'text-slate-300 cursor-not-allowed'
                                            }`}
                                        >
                                            {playingSound === type.key ? (
                                                <Pause size={16} />
                                            ) : (
                                                <Play size={16} />
                                            )}
                                        </button>
                                        <div>
                                            <span className="font-medium text-slate-700 dark:text-slate-300">
                                                {t(`settings.sound.types.${type.key}`, type.label)}
                                            </span>
                                            <p className="text-xs text-slate-500">{type.description}</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => updatePreference(type.key as keyof SoundPreferences, !isEnabled as any)}
                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                            isEnabled ? 'bg-purple-600' : 'bg-slate-200 dark:bg-slate-700'
                                        }`}
                                    >
                                        <span className={`${isEnabled ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white transition-transform`} />
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Quiet Hours */}
            <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-100 dark:bg-indigo-500/20 rounded-lg">
                            <Moon size={20} className="text-indigo-600 dark:text-indigo-400" />
                        </div>
                        <div>
                            <h4 className="font-medium text-slate-900 dark:text-white">
                                {t('settings.sound.quietHours', 'Quiet Hours')}
                            </h4>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                {t('settings.sound.quietHoursDesc', 'Mute sounds during specific times')}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => updatePreference('quietHoursEnabled', !preferences.quietHoursEnabled)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                            preferences.quietHoursEnabled ? 'bg-indigo-600' : 'bg-slate-200 dark:bg-slate-700'
                        }`}
                    >
                        <span className={`${preferences.quietHoursEnabled ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white transition-transform`} />
                    </button>
                </div>

                {preferences.quietHoursEnabled && (
                    <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-white/5">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                    {t('settings.sound.startTime', 'Start Time')}
                                </label>
                                <div className="relative">
                                    <Clock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input
                                        type="time"
                                        value={preferences.quietHoursStart}
                                        onChange={(e) => updatePreference('quietHoursStart', e.target.value)}
                                        className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-white/10 rounded-lg text-slate-900 dark:text-white"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                    {t('settings.sound.endTime', 'End Time')}
                                </label>
                                <div className="relative">
                                    <Clock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input
                                        type="time"
                                        value={preferences.quietHoursEnd}
                                        onChange={(e) => updatePreference('quietHoursEnd', e.target.value)}
                                        className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-white/10 rounded-lg text-slate-900 dark:text-white"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-navy-950 rounded-lg">
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                {t('settings.sound.quietWeekends', 'Also quiet on weekends')}
                            </span>
                            <button
                                onClick={() => updatePreference('quietHoursWeekends', !preferences.quietHoursWeekends)}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                    preferences.quietHoursWeekends ? 'bg-indigo-600' : 'bg-slate-200 dark:bg-slate-700'
                                }`}
                            >
                                <span className={`${preferences.quietHoursWeekends ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white transition-transform`} />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SoundNotificationsSettings;


