import React, { useState, useEffect } from 'react';
import { User } from '../../types';
import { Bell, Mail, Check, AlertCircle, Slack, MessageCircle, Trello, Database, CheckCircle, Hash } from 'lucide-react';

interface NotificationSettingsProps {
    currentUser: User;
    onUpdateUser: (updates: Partial<User>) => void;
}

// Map provider IDs to Icons
const PROVIDER_ICONS: Record<string, any> = {
    slack: Slack,
    teams: MessageCircle,
    whatsapp: MessageCircle,
    trello: Trello,
    jira: Database,
    clickup: CheckCircle
};

interface Integration {
    id: string;
    provider: string;
    config: any;
    status: 'active' | 'error' | 'disabled';
}

interface ChannelPreferences {
    email: boolean;
    inApp: boolean;
    [key: string]: boolean; // Dynamic keys for integration providers (e.g. 'slack', 'teams')
}

interface NotificationPreferences {
    taskAssignment: ChannelPreferences;
    taskUpdates: ChannelPreferences;
    milestones: ChannelPreferences;
    mentions: ChannelPreferences;
}

const defaultPreferences: NotificationPreferences = {
    taskAssignment: { email: true, inApp: true },
    taskUpdates: { email: false, inApp: true },
    milestones: { email: true, inApp: true },
    mentions: { email: true, inApp: true }
};

export const NotificationSettings: React.FC<NotificationSettingsProps> = ({ currentUser, onUpdateUser }) => {
    const [preferences, setPreferences] = useState<NotificationPreferences>(defaultPreferences);
    const [integrations, setIntegrations] = useState<Integration[]>([]);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    // Fetch existing preferences
    useEffect(() => {
        const fetchPrefs = async () => {
            try {
                const res = await fetch(`http://localhost:3005/api/settings/notifications?userId=${currentUser.id}`);
                if (res.ok) {
                    const data = await res.json();
                    if (data && Object.keys(data).length > 0) {
                        setPreferences(data);
                    }
                }
            } catch (err) {
                console.error("Failed to fetch notification preferences", err);
            }
        };
        fetchPrefs();
    }, [currentUser.id]);

    // Fetch active integrations
    useEffect(() => {
        const fetchIntegrations = async () => {
            if (!currentUser.organizationId) return;
            try {
                // In a real app, we might want to cache this or pass it down from parent
                const res = await fetch(`http://localhost:3005/api/settings/integrations?organizationId=${currentUser.organizationId}`);
                if (res.ok) {
                    const data: Integration[] = await res.json();
                    // Filter only active integrations
                    setIntegrations(data.filter(i => i.status === 'active' || !i.status)); // Assume active if status missing for now
                }
            } catch (err) {
                console.error("Failed to fetch integrations", err);
            }
        };
        fetchIntegrations();
    }, [currentUser.organizationId]);

    const handleSave = async () => {
        setLoading(true);
        setMessage(null);
        try {
            const res = await fetch('http://localhost:3005/api/settings/notifications', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: currentUser.id, preferences })
            });

            if (!res.ok) throw new Error('Failed to save');

            setMessage({ type: 'success', text: 'Notification preferences saved successfully.' });
            onUpdateUser({ ...currentUser, ...{ notification_preferences: JSON.stringify(preferences) } } as any);
        } catch (err) {
            setMessage({ type: 'error', text: 'Failed to save preferences.' });
        } finally {
            setLoading(false);
        }
    };

    const toggle = (category: keyof NotificationPreferences, channel: string) => {
        setPreferences(prev => ({
            ...prev,
            [category]: {
                ...prev[category],
                [channel]: !prev[category][channel]
            }
        }));
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div className="mb-6">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Notification Preferences</h2>
                <p className="text-slate-500 dark:text-slate-400">Manage how and when you receive notifications across all channels.</p>
            </div>

            {message && (
                <div className={`p-4 rounded-lg flex items-center gap-2 ${message.type === 'success' ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400' : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'}`}>
                    {message.type === 'success' ? <Check size={18} /> : <AlertCircle size={18} />}
                    {message.text}
                </div>
            )}

            <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-white/10 overflow-hidden">
                <div className="p-6">
                    <div className="space-y-6">

                        {/* Header Row */}
                        <div className="grid grid-cols-12 gap-4 pb-4 border-b border-slate-200 dark:border-white/10 text-sm font-medium text-slate-500 dark:text-slate-400">
                            <div className="col-span-4">Activity</div>
                            <div className="col-span-8 grid grid-cols-4 gap-4">
                                <div className="text-center flex flex-col items-center gap-1">
                                    <Bell size={16} />
                                    <span>In-App</span>
                                </div>
                                <div className="text-center flex flex-col items-center gap-1">
                                    <Mail size={16} />
                                    <span>Email</span>
                                </div>
                                {integrations.map(int => {
                                    const Icon = PROVIDER_ICONS[int.provider] || Hash;
                                    return (
                                        <div key={int.id} className="text-center flex flex-col items-center gap-1">
                                            <Icon size={16} />
                                            <span className="capitalize">{int.provider}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Rows */}
                        <RenderRow
                            title="Task Assignments"
                            description="When a new task is assigned to you"
                            category="taskAssignment"
                            preferences={preferences}
                            integrations={integrations}
                            onToggle={toggle}
                        />
                        <RenderRow
                            title="Task Updates"
                            description="When status changes or comments are added"
                            category="taskUpdates"
                            preferences={preferences}
                            integrations={integrations}
                            onToggle={toggle}
                        />
                        <RenderRow
                            title="Mentions"
                            description="When someone mentions you in a comment"
                            category="mentions"
                            preferences={preferences}
                            integrations={integrations}
                            onToggle={toggle}
                        />
                        <RenderRow
                            title="Project Milestones"
                            description="Major project updates and completions"
                            category="milestones"
                            preferences={preferences}
                            integrations={integrations}
                            onToggle={toggle}
                        />

                    </div>
                </div>
                <div className="px-6 py-4 bg-slate-50 dark:bg-navy-900/50 border-t border-slate-200 dark:border-white/10 flex justify-end">
                    <button
                        onClick={handleSave}
                        disabled={loading}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? 'Saving...' : 'Save Preferences'}
                    </button>
                </div>
            </div>
        </div>
    );
};

// Helper Component for Rows
const RenderRow = ({ title, description, category, preferences, integrations, onToggle }: any) => {
    return (
        <div className="grid grid-cols-12 gap-4 items-center py-4 border-b border-slate-100 dark:border-white/5 last:border-0">
            <div className="col-span-4">
                <h4 className="text-sm font-semibold text-slate-900 dark:text-white">{title}</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">{description}</p>
            </div>
            <div className="col-span-8 grid grid-cols-4 gap-4">
                <div className="flex justify-center">
                    <Toggle checked={preferences[category]?.inApp ?? false} onChange={() => onToggle(category, 'inApp')} />
                </div>
                <div className="flex justify-center">
                    <Toggle checked={preferences[category]?.email ?? false} onChange={() => onToggle(category, 'email')} />
                </div>
                {integrations.map((int: Integration) => (
                    <div key={int.id} className="flex justify-center">
                        <Toggle
                            checked={preferences[category]?.[int.provider] ?? false}
                            onChange={() => onToggle(category, int.provider)}
                        />
                    </div>
                ))}
            </div>
        </div>
    );
};

const Toggle = ({ checked, onChange }: { checked: boolean; onChange: () => void }) => (
    <button
        onClick={onChange}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${checked ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-700'}`}
    >
        <span
            className={`${checked ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
        />
    </button>
);

