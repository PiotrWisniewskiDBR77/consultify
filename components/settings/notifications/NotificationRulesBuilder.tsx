/**
 * NotificationRulesBuilder - Advanced Notification Rules Configuration
 * 
 * Features:
 * - Custom notification rules builder (if/then)
 * - Notification grouping (digest mode)
 * - Quiet hours per day of week
 * - Notification sound per type
 * - Desktop notification settings
 * - Mobile notification settings
 */

import React, { useState, useEffect } from 'react';
import { User } from '../../../types';
import { useTranslation } from 'react-i18next';
import {
    Bell,
    BellOff,
    Plus,
    Trash2,
    Save,
    Loader2,
    Clock,
    Volume2,
    VolumeX,
    Monitor,
    Smartphone,
    Filter,
    Layers,
    Calendar,
    ChevronDown,
    ChevronRight,
    Play,
    Pause,
    AlertCircle
} from 'lucide-react';
import { Api } from '../../../services/api';
import { toast } from 'react-hot-toast';
import { InfoButton } from '../../shared/InfoButton';

interface NotificationRulesBuilderProps {
    currentUser: User;
    onUpdateUser: (updates: Partial<User>) => void;
}

interface NotificationRule {
    id: string;
    name: string;
    enabled: boolean;
    conditions: {
        type: string;
        field: string;
        operator: string;
        value: string;
    }[];
    actions: {
        type: string;
        channel: string;
        sound?: string;
        priority?: string;
    }[];
}

interface QuietHours {
    enabled: boolean;
    startTime: string;
    endTime: string;
    days: string[];
    allowUrgent: boolean;
}

interface SoundSettings {
    enabled: boolean;
    volume: number;
    sounds: {
        [key: string]: string;
    };
}

interface DeviceSettings {
    desktop: {
        enabled: boolean;
        showPreview: boolean;
        playSound: boolean;
        badgeCount: boolean;
    };
    mobile: {
        enabled: boolean;
        showPreview: boolean;
        vibration: boolean;
        led: boolean;
    };
}

interface DigestSettings {
    enabled: boolean;
    frequency: 'hourly' | 'daily' | 'weekly';
    time: string;
    includeTypes: string[];
}

const notificationTypes = [
    { id: 'task_assigned', label: 'Task Assigned' },
    { id: 'task_completed', label: 'Task Completed' },
    { id: 'comment_added', label: 'New Comment' },
    { id: 'mention', label: 'Mentioned' },
    { id: 'project_update', label: 'Project Update' },
    { id: 'due_date', label: 'Due Date Reminder' },
    { id: 'approval_needed', label: 'Approval Needed' },
    { id: 'report_generated', label: 'Report Generated' }
];

const soundOptions = [
    { id: 'default', label: 'Default' },
    { id: 'chime', label: 'Chime' },
    { id: 'bell', label: 'Bell' },
    { id: 'pop', label: 'Pop' },
    { id: 'ping', label: 'Ping' },
    { id: 'none', label: 'No Sound' }
];

const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

export const NotificationRulesBuilder: React.FC<NotificationRulesBuilderProps> = ({
    currentUser,
    onUpdateUser
}) => {
    const { t } = useTranslation();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [activeTab, setActiveTab] = useState<'rules' | 'quiet' | 'sounds' | 'devices' | 'digest'>('rules');
    
    const [rules, setRules] = useState<NotificationRule[]>([]);
    const [quietHours, setQuietHours] = useState<QuietHours>({
        enabled: false,
        startTime: '22:00',
        endTime: '08:00',
        days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
        allowUrgent: true
    });
    const [soundSettings, setSoundSettings] = useState<SoundSettings>({
        enabled: true,
        volume: 80,
        sounds: {}
    });
    const [deviceSettings, setDeviceSettings] = useState<DeviceSettings>({
        desktop: { enabled: true, showPreview: true, playSound: true, badgeCount: true },
        mobile: { enabled: true, showPreview: true, vibration: true, led: true }
    });
    const [digestSettings, setDigestSettings] = useState<DigestSettings>({
        enabled: false,
        frequency: 'daily',
        time: '09:00',
        includeTypes: []
    });
    
    const [expandedRule, setExpandedRule] = useState<string | null>(null);
    const [showAddRule, setShowAddRule] = useState(false);

    useEffect(() => {
        loadSettings();
    }, [currentUser.id]);

    const loadSettings = async () => {
        try {
            setLoading(true);
            const response = await Api.get('/api/user/notification-rules');
            if (response.success && response.data) {
                if (response.data.rules) setRules(response.data.rules);
                if (response.data.quietHours) setQuietHours({ ...quietHours, ...response.data.quietHours });
                if (response.data.soundSettings) setSoundSettings({ ...soundSettings, ...response.data.soundSettings });
                if (response.data.deviceSettings) setDeviceSettings({ ...deviceSettings, ...response.data.deviceSettings });
                if (response.data.digestSettings) setDigestSettings({ ...digestSettings, ...response.data.digestSettings });
            }
        } catch (error) {
            console.error('Error loading notification rules:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        try {
            setSaving(true);
            await Api.put('/api/user/notification-rules', {
                rules,
                quietHours,
                soundSettings,
                deviceSettings,
                digestSettings
            });
            toast.success(t('settings.notifications.rulesSaved', 'Notification rules saved'));
        } catch (error) {
            toast.error(t('settings.notifications.rulesError', 'Failed to save notification rules'));
        } finally {
            setSaving(false);
        }
    };

    const addRule = () => {
        const newRule: NotificationRule = {
            id: `rule_${Date.now()}`,
            name: 'New Rule',
            enabled: true,
            conditions: [{ type: 'notification_type', field: 'type', operator: 'equals', value: 'task_assigned' }],
            actions: [{ type: 'notify', channel: 'all' }]
        };
        setRules([...rules, newRule]);
        setExpandedRule(newRule.id);
        setShowAddRule(false);
    };

    const deleteRule = (ruleId: string) => {
        setRules(rules.filter(r => r.id !== ruleId));
    };

    const updateRule = (ruleId: string, updates: Partial<NotificationRule>) => {
        setRules(rules.map(r => r.id === ruleId ? { ...r, ...updates } : r));
    };

    const toggleRuleEnabled = (ruleId: string) => {
        setRules(rules.map(r => r.id === ruleId ? { ...r, enabled: !r.enabled } : r));
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 size={32} className="animate-spin text-orange-600" />
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 relative">
            <InfoButton cardId="settings-notification-rules" position="top-right" />
            
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                        <Bell size={28} className="text-orange-500" />
                        {t('settings.notifications.rules.title', 'Notification Rules')}
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                        {t('settings.notifications.rules.description', 'Configure advanced notification preferences')}
                    </p>
                </div>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-lg transition-colors disabled:opacity-50"
                >
                    {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                    Save Changes
                </button>
            </div>

            {/* Tabs */}
            <div className="flex flex-wrap gap-2 border-b border-slate-200 dark:border-white/10 pb-4">
                {[
                    { id: 'rules', label: 'Custom Rules', icon: Filter },
                    { id: 'quiet', label: 'Quiet Hours', icon: BellOff },
                    { id: 'sounds', label: 'Sounds', icon: Volume2 },
                    { id: 'devices', label: 'Devices', icon: Monitor },
                    { id: 'digest', label: 'Digest', icon: Layers }
                ].map(tab => {
                    const Icon = tab.icon;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                                activeTab === tab.id
                                    ? 'bg-orange-600 text-white'
                                    : 'bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-navy-700'
                            }`}
                        >
                            <Icon size={16} />
                            {tab.label}
                        </button>
                    );
                })}
            </div>

            {/* Custom Rules Tab */}
            {activeTab === 'rules' && (
                <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-xl p-6 space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Custom Notification Rules</h3>
                        <button
                            onClick={addRule}
                            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-orange-600 hover:bg-orange-500 text-white rounded-lg transition-colors"
                        >
                            <Plus size={16} />
                            Add Rule
                        </button>
                    </div>

                    <div className="space-y-3">
                        {rules.map(rule => (
                            <div
                                key={rule.id}
                                className={`border rounded-lg transition-all ${
                                    rule.enabled
                                        ? 'border-orange-200 dark:border-orange-500/30 bg-orange-50 dark:bg-orange-500/5'
                                        : 'border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-navy-950 opacity-60'
                                }`}
                            >
                                <div
                                    className="flex items-center justify-between p-4 cursor-pointer"
                                    onClick={() => setExpandedRule(expandedRule === rule.id ? null : rule.id)}
                                >
                                    <div className="flex items-center gap-3">
                                        {expandedRule === rule.id ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                                        <input
                                            type="text"
                                            value={rule.name}
                                            onChange={(e) => {
                                                e.stopPropagation();
                                                updateRule(rule.id, { name: e.target.value });
                                            }}
                                            onClick={(e) => e.stopPropagation()}
                                            className="font-medium text-slate-900 dark:text-white bg-transparent border-none focus:outline-none focus:ring-2 focus:ring-orange-500 rounded px-2 py-1"
                                        />
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                toggleRuleEnabled(rule.id);
                                            }}
                                            className={`p-2 rounded-lg transition-colors ${
                                                rule.enabled ? 'text-orange-600 hover:bg-orange-100' : 'text-slate-400 hover:bg-slate-100'
                                            }`}
                                        >
                                            {rule.enabled ? <Play size={16} /> : <Pause size={16} />}
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                deleteRule(rule.id);
                                            }}
                                            className="p-2 text-red-600 hover:bg-red-100 dark:hover:bg-red-500/20 rounded-lg"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                                
                                {expandedRule === rule.id && (
                                    <div className="px-4 pb-4 space-y-4 border-t border-slate-200 dark:border-white/10 pt-4">
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                                When notification type is:
                                            </label>
                                            <select
                                                value={rule.conditions[0]?.value || ''}
                                                onChange={(e) => updateRule(rule.id, {
                                                    conditions: [{ ...rule.conditions[0], value: e.target.value }]
                                                })}
                                                className="w-full px-3 py-2 bg-white dark:bg-navy-950 border border-slate-200 dark:border-white/10 rounded-lg"
                                            >
                                                {notificationTypes.map(type => (
                                                    <option key={type.id} value={type.id}>{type.label}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                                Then:
                                            </label>
                                            <select
                                                value={rule.actions[0]?.channel || 'all'}
                                                onChange={(e) => updateRule(rule.id, {
                                                    actions: [{ ...rule.actions[0], channel: e.target.value }]
                                                })}
                                                className="w-full px-3 py-2 bg-white dark:bg-navy-950 border border-slate-200 dark:border-white/10 rounded-lg"
                                            >
                                                <option value="all">Notify on all channels</option>
                                                <option value="desktop">Desktop only</option>
                                                <option value="mobile">Mobile only</option>
                                                <option value="email">Email only</option>
                                                <option value="none">Don't notify</option>
                                            </select>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                        
                        {rules.length === 0 && (
                            <div className="text-center py-8 text-slate-500">
                                <Bell size={32} className="mx-auto mb-2 opacity-30" />
                                <p>No custom rules configured</p>
                                <button
                                    onClick={addRule}
                                    className="mt-2 text-orange-600 hover:underline text-sm"
                                >
                                    Add your first rule
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Quiet Hours Tab */}
            {activeTab === 'quiet' && (
                <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-xl p-6 space-y-6">
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                            <BellOff size={20} className="text-slate-500" />
                            Quiet Hours
                        </h3>
                        <button
                            onClick={() => setQuietHours({ ...quietHours, enabled: !quietHours.enabled })}
                            className={`relative w-12 h-6 rounded-full transition-colors ${
                                quietHours.enabled ? 'bg-orange-600' : 'bg-slate-300 dark:bg-slate-600'
                            }`}
                        >
                            <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${
                                quietHours.enabled ? 'left-7' : 'left-1'
                            }`} />
                        </button>
                    </div>

                    {quietHours.enabled && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Start Time</label>
                                    <input
                                        type="time"
                                        value={quietHours.startTime}
                                        onChange={(e) => setQuietHours({ ...quietHours, startTime: e.target.value })}
                                        className="w-full px-3 py-2 bg-white dark:bg-navy-950 border border-slate-200 dark:border-white/10 rounded-lg"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">End Time</label>
                                    <input
                                        type="time"
                                        value={quietHours.endTime}
                                        onChange={(e) => setQuietHours({ ...quietHours, endTime: e.target.value })}
                                        className="w-full px-3 py-2 bg-white dark:bg-navy-950 border border-slate-200 dark:border-white/10 rounded-lg"
                                    />
                                </div>
                            </div>
                            
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Active Days</label>
                                <div className="flex flex-wrap gap-2">
                                    {days.map(day => (
                                        <button
                                            key={day}
                                            onClick={() => {
                                                const newDays = quietHours.days.includes(day)
                                                    ? quietHours.days.filter(d => d !== day)
                                                    : [...quietHours.days, day];
                                                setQuietHours({ ...quietHours, days: newDays });
                                            }}
                                            className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition-all ${
                                                quietHours.days.includes(day)
                                                    ? 'bg-orange-600 text-white'
                                                    : 'bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-400'
                                            }`}
                                        >
                                            {day.slice(0, 3)}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <label className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-navy-950 rounded-lg cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={quietHours.allowUrgent}
                                    onChange={(e) => setQuietHours({ ...quietHours, allowUrgent: e.target.checked })}
                                    className="rounded"
                                />
                                <div>
                                    <p className="font-medium text-slate-900 dark:text-white">Allow Urgent Notifications</p>
                                    <p className="text-sm text-slate-500">Still receive critical notifications during quiet hours</p>
                                </div>
                            </label>
                        </div>
                    )}
                </div>
            )}

            {/* Sounds Tab */}
            {activeTab === 'sounds' && (
                <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-xl p-6 space-y-6">
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                            <Volume2 size={20} className="text-blue-500" />
                            Sound Settings
                        </h3>
                        <button
                            onClick={() => setSoundSettings({ ...soundSettings, enabled: !soundSettings.enabled })}
                            className={`relative w-12 h-6 rounded-full transition-colors ${
                                soundSettings.enabled ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-600'
                            }`}
                        >
                            <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${
                                soundSettings.enabled ? 'left-7' : 'left-1'
                            }`} />
                        </button>
                    </div>

                    {soundSettings.enabled && (
                        <div className="space-y-4">
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Volume</label>
                                    <span className="text-sm text-blue-600">{soundSettings.volume}%</span>
                                </div>
                                <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    value={soundSettings.volume}
                                    onChange={(e) => setSoundSettings({ ...soundSettings, volume: parseInt(e.target.value) })}
                                    className="w-full h-2 bg-slate-200 dark:bg-navy-800 rounded-lg appearance-none cursor-pointer accent-blue-600"
                                />
                            </div>

                            <div className="space-y-3">
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Sound per Notification Type</label>
                                {notificationTypes.slice(0, 5).map(type => (
                                    <div key={type.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-navy-950 rounded-lg">
                                        <span className="text-sm text-slate-900 dark:text-white">{type.label}</span>
                                        <select
                                            value={soundSettings.sounds[type.id] || 'default'}
                                            onChange={(e) => setSoundSettings({
                                                ...soundSettings,
                                                sounds: { ...soundSettings.sounds, [type.id]: e.target.value }
                                            })}
                                            className="px-3 py-1.5 bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-lg text-sm"
                                        >
                                            {soundOptions.map(sound => (
                                                <option key={sound.id} value={sound.id}>{sound.label}</option>
                                            ))}
                                        </select>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Devices Tab */}
            {activeTab === 'devices' && (
                <div className="space-y-4">
                    {/* Desktop */}
                    <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-xl p-6 space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                                <Monitor size={20} className="text-purple-500" />
                                Desktop Notifications
                            </h3>
                            <button
                                onClick={() => setDeviceSettings({
                                    ...deviceSettings,
                                    desktop: { ...deviceSettings.desktop, enabled: !deviceSettings.desktop.enabled }
                                })}
                                className={`relative w-12 h-6 rounded-full transition-colors ${
                                    deviceSettings.desktop.enabled ? 'bg-purple-600' : 'bg-slate-300 dark:bg-slate-600'
                                }`}
                            >
                                <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${
                                    deviceSettings.desktop.enabled ? 'left-7' : 'left-1'
                                }`} />
                            </button>
                        </div>

                        {deviceSettings.desktop.enabled && (
                            <div className="space-y-3">
                                {[
                                    { key: 'showPreview', label: 'Show Preview', desc: 'Display notification content' },
                                    { key: 'playSound', label: 'Play Sound', desc: 'Play sound for notifications' },
                                    { key: 'badgeCount', label: 'Badge Count', desc: 'Show unread count on icon' }
                                ].map(item => (
                                    <label key={item.key} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-navy-950 rounded-lg cursor-pointer">
                                        <div>
                                            <p className="font-medium text-slate-900 dark:text-white text-sm">{item.label}</p>
                                            <p className="text-xs text-slate-500">{item.desc}</p>
                                        </div>
                                        <input
                                            type="checkbox"
                                            checked={(deviceSettings.desktop as any)[item.key]}
                                            onChange={(e) => setDeviceSettings({
                                                ...deviceSettings,
                                                desktop: { ...deviceSettings.desktop, [item.key]: e.target.checked }
                                            })}
                                            className="rounded"
                                        />
                                    </label>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Mobile */}
                    <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-xl p-6 space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                                <Smartphone size={20} className="text-green-500" />
                                Mobile Notifications
                            </h3>
                            <button
                                onClick={() => setDeviceSettings({
                                    ...deviceSettings,
                                    mobile: { ...deviceSettings.mobile, enabled: !deviceSettings.mobile.enabled }
                                })}
                                className={`relative w-12 h-6 rounded-full transition-colors ${
                                    deviceSettings.mobile.enabled ? 'bg-green-600' : 'bg-slate-300 dark:bg-slate-600'
                                }`}
                            >
                                <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${
                                    deviceSettings.mobile.enabled ? 'left-7' : 'left-1'
                                }`} />
                            </button>
                        </div>

                        {deviceSettings.mobile.enabled && (
                            <div className="space-y-3">
                                {[
                                    { key: 'showPreview', label: 'Show Preview', desc: 'Display notification content' },
                                    { key: 'vibration', label: 'Vibration', desc: 'Vibrate for notifications' },
                                    { key: 'led', label: 'LED Light', desc: 'Flash LED for notifications' }
                                ].map(item => (
                                    <label key={item.key} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-navy-950 rounded-lg cursor-pointer">
                                        <div>
                                            <p className="font-medium text-slate-900 dark:text-white text-sm">{item.label}</p>
                                            <p className="text-xs text-slate-500">{item.desc}</p>
                                        </div>
                                        <input
                                            type="checkbox"
                                            checked={(deviceSettings.mobile as any)[item.key]}
                                            onChange={(e) => setDeviceSettings({
                                                ...deviceSettings,
                                                mobile: { ...deviceSettings.mobile, [item.key]: e.target.checked }
                                            })}
                                            className="rounded"
                                        />
                                    </label>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Digest Tab */}
            {activeTab === 'digest' && (
                <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-xl p-6 space-y-6">
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                            <Layers size={20} className="text-amber-500" />
                            Notification Digest
                        </h3>
                        <button
                            onClick={() => setDigestSettings({ ...digestSettings, enabled: !digestSettings.enabled })}
                            className={`relative w-12 h-6 rounded-full transition-colors ${
                                digestSettings.enabled ? 'bg-amber-600' : 'bg-slate-300 dark:bg-slate-600'
                            }`}
                        >
                            <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${
                                digestSettings.enabled ? 'left-7' : 'left-1'
                            }`} />
                        </button>
                    </div>

                    {digestSettings.enabled && (
                        <div className="space-y-4">
                            <p className="text-sm text-slate-500">Group notifications together and receive them as a summary</p>
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Frequency</label>
                                    <select
                                        value={digestSettings.frequency}
                                        onChange={(e) => setDigestSettings({ ...digestSettings, frequency: e.target.value as any })}
                                        className="w-full px-3 py-2 bg-white dark:bg-navy-950 border border-slate-200 dark:border-white/10 rounded-lg"
                                    >
                                        <option value="hourly">Hourly</option>
                                        <option value="daily">Daily</option>
                                        <option value="weekly">Weekly</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Delivery Time</label>
                                    <input
                                        type="time"
                                        value={digestSettings.time}
                                        onChange={(e) => setDigestSettings({ ...digestSettings, time: e.target.value })}
                                        className="w-full px-3 py-2 bg-white dark:bg-navy-950 border border-slate-200 dark:border-white/10 rounded-lg"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Include in Digest</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {notificationTypes.map(type => (
                                        <label key={type.id} className="flex items-center gap-2 p-2 bg-slate-50 dark:bg-navy-950 rounded-lg cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={digestSettings.includeTypes.includes(type.id)}
                                                onChange={(e) => {
                                                    const newTypes = e.target.checked
                                                        ? [...digestSettings.includeTypes, type.id]
                                                        : digestSettings.includeTypes.filter(t => t !== type.id);
                                                    setDigestSettings({ ...digestSettings, includeTypes: newTypes });
                                                }}
                                                className="rounded"
                                            />
                                            <span className="text-sm">{type.label}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default NotificationRulesBuilder;

