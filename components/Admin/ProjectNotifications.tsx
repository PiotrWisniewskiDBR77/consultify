import React, { useState, useEffect } from 'react';
import { Bell, Save, AlertCircle, CheckCircle, Clock, Shield, Mail, MessageSquare } from 'lucide-react';
import { toast } from 'react-hot-toast';

/**
 * MED-04c: Project Notification Settings UI
 * Allows admins to configure per-project notification preferences
 */

interface NotificationSettings {
    project_id: string;
    task_overdue_enabled: boolean;
    task_due_today_enabled: boolean;
    blocker_detected_enabled: boolean;
    gate_ready_enabled: boolean;
    decision_required_enabled: boolean;
    escalation_enabled: boolean;
    escalation_days: number;
    email_notifications: boolean;
    in_app_notifications: boolean;
}

interface ProjectNotificationsProps {
    projectId: string;
    onSave?: () => void;
}

export const ProjectNotifications: React.FC<ProjectNotificationsProps> = ({ projectId, onSave }) => {
    const [settings, setSettings] = useState<NotificationSettings | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        fetchSettings();
    }, [projectId]);

    const fetchSettings = async () => {
        setIsLoading(true);
        try {
            const res = await fetch(`/api/projects/${projectId}/notification-settings`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            if (res.ok) {
                const data = await res.json();
                setSettings({
                    ...data,
                    task_overdue_enabled: !!data.task_overdue_enabled,
                    task_due_today_enabled: !!data.task_due_today_enabled,
                    blocker_detected_enabled: !!data.blocker_detected_enabled,
                    gate_ready_enabled: !!data.gate_ready_enabled,
                    decision_required_enabled: !!data.decision_required_enabled,
                    escalation_enabled: !!data.escalation_enabled,
                    email_notifications: !!data.email_notifications,
                    in_app_notifications: !!data.in_app_notifications
                });
            }
        } catch (err) {
            console.error('Failed to load notification settings', err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleToggle = (key: keyof NotificationSettings) => {
        if (!settings) return;
        setSettings({ ...settings, [key]: !settings[key] });
    };

    const handleEscalationDaysChange = (value: number) => {
        if (!settings) return;
        setSettings({ ...settings, escalation_days: Math.max(1, Math.min(30, value)) });
    };

    const handleSave = async () => {
        if (!settings) return;
        setIsSaving(true);
        try {
            const res = await fetch(`/api/projects/${projectId}/notification-settings`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify(settings)
            });
            if (res.ok) {
                toast.success('Notification settings saved');
                onSave?.();
            } else {
                toast.error('Failed to save settings');
            }
        } catch (err) {
            toast.error('Error saving settings');
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-8">
                <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    if (!settings) {
        return <div className="text-slate-500 dark:text-slate-400">Failed to load settings</div>;
    }

    const toggles = [
        { key: 'task_overdue_enabled' as const, label: 'Task Overdue', icon: AlertCircle, description: 'Notify when tasks become overdue' },
        { key: 'task_due_today_enabled' as const, label: 'Task Due Today', icon: Clock, description: 'Notify about tasks due today' },
        { key: 'blocker_detected_enabled' as const, label: 'Blocker Detected', icon: Shield, description: 'Notify when blockers are detected' },
        { key: 'gate_ready_enabled' as const, label: 'Gate Ready', icon: CheckCircle, description: 'Notify when stage gates become passable' },
        { key: 'decision_required_enabled' as const, label: 'Decision Required', icon: MessageSquare, description: 'Notify about pending decisions' },
    ];

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-2 text-lg font-semibold text-navy-900 dark:text-white">
                <Bell className="text-purple-500" size={20} />
                Notification Settings
            </div>

            {/* Notification Type Toggles */}
            <div className="space-y-3">
                <h3 className="text-sm font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wide">Notification Types</h3>
                {toggles.map(({ key, label, icon: Icon, description }) => (
                    <div key={key} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-navy-800 rounded-lg">
                        <div className="flex items-center gap-3">
                            <Icon size={18} className="text-slate-500 dark:text-slate-400" />
                            <div>
                                <div className="text-sm font-medium text-navy-900 dark:text-white">{label}</div>
                                <div className="text-xs text-slate-500 dark:text-slate-400">{description}</div>
                            </div>
                        </div>
                        <button
                            onClick={() => handleToggle(key)}
                            className={`w-12 h-6 rounded-full transition-colors relative ${settings[key] ? 'bg-purple-600' : 'bg-slate-300 dark:bg-slate-600'
                                }`}
                        >
                            <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform ${settings[key] ? 'translate-x-6' : 'translate-x-0.5'
                                }`} />
                        </button>
                    </div>
                ))}
            </div>

            {/* Escalation Settings */}
            <div className="space-y-3">
                <h3 className="text-sm font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wide">Escalation</h3>
                <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-navy-800 rounded-lg">
                    <div>
                        <div className="text-sm font-medium text-navy-900 dark:text-white">Enable Escalation</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">Auto-escalate after inactivity</div>
                    </div>
                    <button
                        onClick={() => handleToggle('escalation_enabled')}
                        className={`w-12 h-6 rounded-full transition-colors relative ${settings.escalation_enabled ? 'bg-purple-600' : 'bg-slate-300 dark:bg-slate-600'
                            }`}
                    >
                        <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform ${settings.escalation_enabled ? 'translate-x-6' : 'translate-x-0.5'
                            }`} />
                    </button>
                </div>
                {settings.escalation_enabled && (
                    <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-navy-800 rounded-lg">
                        <span className="text-sm text-navy-900 dark:text-white">Escalate after</span>
                        <input
                            type="number"
                            min={1}
                            max={30}
                            value={settings.escalation_days}
                            onChange={(e) => handleEscalationDaysChange(parseInt(e.target.value) || 3)}
                            className="w-16 px-2 py-1 bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded text-center text-sm"
                        />
                        <span className="text-sm text-navy-900 dark:text-white">days of inactivity</span>
                    </div>
                )}
            </div>

            {/* Delivery Method */}
            <div className="space-y-3">
                <h3 className="text-sm font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wide">Delivery</h3>
                <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-navy-800 rounded-lg">
                    <div className="flex items-center gap-3">
                        <MessageSquare size={18} className="text-slate-500" />
                        <div className="text-sm font-medium text-navy-900 dark:text-white">In-App Notifications</div>
                    </div>
                    <button
                        onClick={() => handleToggle('in_app_notifications')}
                        className={`w-12 h-6 rounded-full transition-colors relative ${settings.in_app_notifications ? 'bg-purple-600' : 'bg-slate-300 dark:bg-slate-600'
                            }`}
                    >
                        <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform ${settings.in_app_notifications ? 'translate-x-6' : 'translate-x-0.5'
                            }`} />
                    </button>
                </div>
                <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-navy-800 rounded-lg">
                    <div className="flex items-center gap-3">
                        <Mail size={18} className="text-slate-500" />
                        <div className="text-sm font-medium text-navy-900 dark:text-white">Email Notifications</div>
                    </div>
                    <button
                        onClick={() => handleToggle('email_notifications')}
                        className={`w-12 h-6 rounded-full transition-colors relative ${settings.email_notifications ? 'bg-purple-600' : 'bg-slate-300 dark:bg-slate-600'
                            }`}
                    >
                        <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform ${settings.email_notifications ? 'translate-x-6' : 'translate-x-0.5'
                            }`} />
                    </button>
                </div>
            </div>

            {/* Save Button */}
            <button
                onClick={handleSave}
                disabled={isSaving}
                className="w-full py-3 bg-purple-600 hover:bg-purple-500 disabled:bg-slate-400 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-colors"
            >
                {isSaving ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                    <>
                        <Save size={18} />
                        Save Notification Settings
                    </>
                )}
            </button>
        </div>
    );
};

export default ProjectNotifications;
