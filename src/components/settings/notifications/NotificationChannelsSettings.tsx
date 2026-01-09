// @ts-nocheck
/**
 * NotificationChannelsSettings - Notification Channels Configuration
 *
 * Features:
 * - Slack integration for notifications
 * - Microsoft Teams integration
 * - SMS notifications (critical only)
 * - WhatsApp notifications
 * - In-app notification center preferences
 */

import {
    AlertCircle,
    Bell,
    Check,
    ExternalLink,
    Link,
    Loader2,
    Mail,
    MessageSquare,
    Phone,
    Save,
    Settings,
    Smartphone,
    Unlink,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '../../../services/api';
import { User } from '../../../types';
import { InfoButton } from '../../shared/InfoButton';

interface NotificationChannelsSettingsProps {
    currentUser: User;
    onUpdateUser: (updates: Partial<User>) => void;
}

interface ChannelConfig {
    enabled: boolean;
    connected: boolean;
    settings: Record<string, any>;
}

interface ChannelsState {
    slack: ChannelConfig & { workspaceName?: string; channelName?: string };
    teams: ChannelConfig & { tenantName?: string };
    sms: ChannelConfig & { phoneNumber?: string; verified?: boolean };
    whatsapp: ChannelConfig & { phoneNumber?: string; verified?: boolean };
    email: ChannelConfig;
    inApp: ChannelConfig & {
        showUnreadBadge: boolean;
        autoMarkAsRead: boolean;
        groupByType: boolean;
        maxNotifications: number;
    };
}

const defaultChannels: ChannelsState = {
    slack: { enabled: false, connected: false, settings: {} },
    teams: { enabled: false, connected: false, settings: {} },
    sms: { enabled: false, connected: false, settings: { criticalOnly: true } },
    whatsapp: { enabled: false, connected: false, settings: {} },
    email: { enabled: true, connected: true, settings: {} },
    inApp: {
        enabled: true,
        connected: true,
        settings: {},
        showUnreadBadge: true,
        autoMarkAsRead: false,
        groupByType: true,
        maxNotifications: 100,
    },
};

export const NotificationChannelsSettings: React.FC<NotificationChannelsSettingsProps> = ({
    currentUser,
    onUpdateUser,
}) => {
    const { t } = useTranslation();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [connecting, setConnecting] = useState<string | null>(null);
    const [channels, setChannels] = useState<ChannelsState>(defaultChannels);
    const [smsVerificationCode, setSmsVerificationCode] = useState('');
    const [showSmsVerification, setShowSmsVerification] = useState(false);

    useEffect(() => {
        loadSettings();
    }, [currentUser.id]);

    const loadSettings = async () => {
        try {
            setLoading(true);
            const response = await Api.get('/api/user/notification-channels');
            if (response.success && response.data) {
                setChannels({ ...defaultChannels, ...response.data });
            }
        } catch (error) {
            console.error('Error loading notification channels:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        try {
            setSaving(true);
            await Api.put('/api/user/notification-channels', channels);
            toast.success(t('settings.notifications.channelsSaved', 'Notification channels saved'));
        } catch (error) {
            toast.error(t('settings.notifications.channelsError', 'Failed to save notification channels'));
        } finally {
            setSaving(false);
        }
    };

    const connectChannel = async (channel: string) => {
        setConnecting(channel);
        try {
            // In production, this would initiate OAuth or connection flow
            const response = await Api.post(`/api/integrations/${channel}/connect`, {});
            if (response.success) {
                if (response.authUrl) {
                    window.open(response.authUrl, '_blank', 'width=600,height=700');
                } else {
                    setChannels({
                        ...channels,
                        [channel]: { ...channels[channel as keyof ChannelsState], connected: true },
                    });
                    toast.success(`${channel} connected successfully`);
                }
            }
        } catch (error) {
            toast.error(`Failed to connect ${channel}`);
        } finally {
            setConnecting(null);
        }
    };

    const disconnectChannel = async (channel: string) => {
        try {
            await Api.post(`/api/integrations/${channel}/disconnect`, {});
            setChannels({
                ...channels,
                [channel]: { ...channels[channel as keyof ChannelsState], connected: false, enabled: false },
            });
            toast.success(`${channel} disconnected`);
        } catch (error) {
            toast.error(`Failed to disconnect ${channel}`);
        }
    };

    const handleSmsSetup = async (phoneNumber: string) => {
        try {
            await Api.post('/api/user/notification-channels/sms/setup', { phoneNumber });
            setShowSmsVerification(true);
            toast.success('Verification code sent to your phone');
        } catch (error) {
            toast.error('Failed to send verification code');
        }
    };

    const verifySms = async () => {
        try {
            await Api.post('/api/user/notification-channels/sms/verify', { code: smsVerificationCode });
            setChannels({
                ...channels,
                sms: { ...channels.sms, connected: true, verified: true },
            });
            setShowSmsVerification(false);
            toast.success('Phone number verified');
        } catch (error) {
            toast.error('Invalid verification code');
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 size={32} className="animate-spin text-teal-600" />
            </div>
        );
    }

    const ChannelCard: React.FC<{
        id: keyof ChannelsState;
        name: string;
        description: string;
        icon: React.ElementType;
        iconColor: string;
        config: ChannelConfig;
    }> = ({ id, name, description, icon: Icon, iconColor, config }) => (
        <div
            className={`p-6 rounded-xl border-2 transition-all ${
                config.enabled && config.connected
                    ? 'border-teal-500 bg-teal-50 dark:bg-teal-500/10'
                    : 'border-slate-200 dark:border-white/10 bg-white dark:bg-navy-900'
            }`}
        >
            <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className={`p-3 rounded-xl ${iconColor}`}>
                        <Icon size={24} className="text-white" />
                    </div>
                    <div>
                        <h4 className="font-semibold text-slate-900 dark:text-white">{name}</h4>
                        <p className="text-sm text-slate-500">{description}</p>
                    </div>
                </div>
                {config.connected && (
                    <span className="flex items-center gap-1 px-2 py-1 text-xs bg-green-100 text-green-700 rounded-full">
                        <Check size={12} />
                        Connected
                    </span>
                )}
            </div>

            <div className="space-y-3">
                {config.connected ? (
                    <>
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-slate-600 dark:text-slate-400">Enable notifications</span>
                            <button
                                onClick={() =>
                                    setChannels({
                                        ...channels,
                                        [id]: { ...config, enabled: !config.enabled },
                                    })
                                }
                                className={`relative w-12 h-6 rounded-full transition-colors ${
                                    config.enabled ? 'bg-teal-600' : 'bg-slate-300 dark:bg-slate-600'
                                }`}
                            >
                                <span
                                    className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${
                                        config.enabled ? 'left-7' : 'left-1'
                                    }`}
                                />
                            </button>
                        </div>
                        <button
                            onClick={() => disconnectChannel(id)}
                            className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
                        >
                            <Unlink size={16} />
                            Disconnect
                        </button>
                    </>
                ) : (
                    <button
                        onClick={() => connectChannel(id)}
                        disabled={connecting === id}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-lg transition-colors disabled:opacity-50"
                    >
                        {connecting === id ? <Loader2 size={16} className="animate-spin" /> : <Link size={16} />}
                        Connect {name}
                    </button>
                )}
            </div>
        </div>
    );

    return (
        <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 relative">
            <InfoButton cardId="settings-notification-channels" position="top-right" />

            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                        <MessageSquare size={28} className="text-teal-500" />
                        {t('settings.notifications.channels.title', 'Notification Channels')}
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                        {t('settings.notifications.channels.description', 'Choose where to receive notifications')}
                    </p>
                </div>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-lg transition-colors disabled:opacity-50"
                >
                    {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                    Save Changes
                </button>
            </div>

            {/* External Channels */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <ChannelCard
                    id="slack"
                    name="Slack"
                    description="Receive notifications in Slack"
                    icon={MessageSquare}
                    iconColor="bg-[#4A154B]"
                    config={channels.slack}
                />
                <ChannelCard
                    id="teams"
                    name="Microsoft Teams"
                    description="Receive notifications in Teams"
                    icon={MessageSquare}
                    iconColor="bg-[#6264A7]"
                    config={channels.teams}
                />
            </div>

            {/* SMS Notifications */}
            <div
                className={`p-6 rounded-xl border-2 transition-all ${
                    channels.sms.enabled && channels.sms.connected
                        ? 'border-teal-500 bg-teal-50 dark:bg-teal-500/10'
                        : 'border-slate-200 dark:border-white/10 bg-white dark:bg-navy-900'
                }`}
            >
                <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="p-3 rounded-xl bg-green-600">
                            <Phone size={24} className="text-white" />
                        </div>
                        <div>
                            <h4 className="font-semibold text-slate-900 dark:text-white">SMS Notifications</h4>
                            <p className="text-sm text-slate-500">Receive critical notifications via SMS</p>
                        </div>
                    </div>
                    {channels.sms.verified && (
                        <span className="flex items-center gap-1 px-2 py-1 text-xs bg-green-100 text-green-700 rounded-full">
                            <Check size={12} />
                            Verified
                        </span>
                    )}
                </div>

                {!channels.sms.connected && !showSmsVerification && (
                    <div className="space-y-3">
                        <input
                            type="tel"
                            placeholder="+1 (555) 123-4567"
                            className="w-full px-4 py-2 bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-white/10 rounded-lg"
                            onChange={(e) =>
                                setChannels({
                                    ...channels,
                                    sms: { ...channels.sms, phoneNumber: e.target.value },
                                })
                            }
                        />
                        <button
                            onClick={() => handleSmsSetup(channels.sms.phoneNumber || '')}
                            className="w-full px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg"
                        >
                            Send Verification Code
                        </button>
                    </div>
                )}

                {showSmsVerification && (
                    <div className="space-y-3">
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                            Enter the verification code sent to your phone
                        </p>
                        <input
                            type="text"
                            placeholder="123456"
                            value={smsVerificationCode}
                            onChange={(e) => setSmsVerificationCode(e.target.value)}
                            className="w-full px-4 py-2 bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-white/10 rounded-lg text-center text-2xl tracking-widest"
                            maxLength={6}
                        />
                        <button
                            onClick={verifySms}
                            className="w-full px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg"
                        >
                            Verify
                        </button>
                    </div>
                )}

                {channels.sms.connected && (
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-slate-600 dark:text-slate-400">Enable SMS notifications</span>
                            <button
                                onClick={() =>
                                    setChannels({
                                        ...channels,
                                        sms: { ...channels.sms, enabled: !channels.sms.enabled },
                                    })
                                }
                                className={`relative w-12 h-6 rounded-full transition-colors ${
                                    channels.sms.enabled ? 'bg-green-600' : 'bg-slate-300 dark:bg-slate-600'
                                }`}
                            >
                                <span
                                    className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${
                                        channels.sms.enabled ? 'left-7' : 'left-1'
                                    }`}
                                />
                            </button>
                        </div>
                        <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                            <input
                                type="checkbox"
                                checked={channels.sms.settings.criticalOnly !== false}
                                onChange={(e) =>
                                    setChannels({
                                        ...channels,
                                        sms: {
                                            ...channels.sms,
                                            settings: { ...channels.sms.settings, criticalOnly: e.target.checked },
                                        },
                                    })
                                }
                                className="rounded"
                            />
                            Critical notifications only (urgent tasks, security alerts)
                        </label>
                    </div>
                )}
            </div>

            {/* WhatsApp */}
            <ChannelCard
                id="whatsapp"
                name="WhatsApp"
                description="Receive notifications via WhatsApp"
                icon={Smartphone}
                iconColor="bg-[#25D366]"
                config={channels.whatsapp}
            />

            {/* In-App Notification Center */}
            <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-xl p-6 space-y-4">
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-3 rounded-xl bg-blue-600">
                        <Bell size={24} className="text-white" />
                    </div>
                    <div>
                        <h4 className="font-semibold text-slate-900 dark:text-white">In-App Notification Center</h4>
                        <p className="text-sm text-slate-500">Configure the in-app notification experience</p>
                    </div>
                </div>

                <div className="space-y-3">
                    {[
                        {
                            key: 'showUnreadBadge',
                            label: 'Show Unread Badge',
                            desc: 'Display count of unread notifications',
                        },
                        {
                            key: 'autoMarkAsRead',
                            label: 'Auto Mark as Read',
                            desc: 'Mark notifications as read when viewed',
                        },
                        { key: 'groupByType', label: 'Group by Type', desc: 'Group similar notifications together' },
                    ].map((item) => (
                        <div
                            key={item.key}
                            className="flex items-center justify-between p-4 bg-slate-50 dark:bg-navy-950 rounded-lg"
                        >
                            <div>
                                <p className="font-medium text-slate-900 dark:text-white">{item.label}</p>
                                <p className="text-sm text-slate-500">{item.desc}</p>
                            </div>
                            <button
                                onClick={() =>
                                    setChannels({
                                        ...channels,
                                        inApp: {
                                            ...channels.inApp,
                                            [item.key]: !channels.inApp[item.key as keyof typeof channels.inApp],
                                        },
                                    })
                                }
                                className={`relative w-12 h-6 rounded-full transition-colors ${
                                    channels.inApp[item.key as keyof typeof channels.inApp]
                                        ? 'bg-blue-600'
                                        : 'bg-slate-300 dark:bg-slate-600'
                                }`}
                            >
                                <span
                                    className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${
                                        channels.inApp[item.key as keyof typeof channels.inApp] ? 'left-7' : 'left-1'
                                    }`}
                                />
                            </button>
                        </div>
                    ))}

                    <div className="p-4 bg-slate-50 dark:bg-navy-950 rounded-lg">
                        <label className="block text-sm font-medium text-slate-900 dark:text-white mb-2">
                            Max Notifications to Keep
                        </label>
                        <select
                            value={channels.inApp.maxNotifications}
                            onChange={(e) =>
                                setChannels({
                                    ...channels,
                                    inApp: { ...channels.inApp, maxNotifications: parseInt(e.target.value) },
                                })
                            }
                            className="w-full px-3 py-2 bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-lg"
                        >
                            <option value={50}>50 notifications</option>
                            <option value={100}>100 notifications</option>
                            <option value={200}>200 notifications</option>
                            <option value={500}>500 notifications</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Email (always connected) */}
            <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-xl p-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-3 rounded-xl bg-red-500">
                            <Mail size={24} className="text-white" />
                        </div>
                        <div>
                            <h4 className="font-semibold text-slate-900 dark:text-white">Email Notifications</h4>
                            <p className="text-sm text-slate-500">{currentUser.email}</p>
                        </div>
                    </div>
                    <button
                        onClick={() =>
                            setChannels({
                                ...channels,
                                email: { ...channels.email, enabled: !channels.email.enabled },
                            })
                        }
                        className={`relative w-12 h-6 rounded-full transition-colors ${
                            channels.email.enabled ? 'bg-red-600' : 'bg-slate-300 dark:bg-slate-600'
                        }`}
                    >
                        <span
                            className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${
                                channels.email.enabled ? 'left-7' : 'left-1'
                            }`}
                        />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default NotificationChannelsSettings;
