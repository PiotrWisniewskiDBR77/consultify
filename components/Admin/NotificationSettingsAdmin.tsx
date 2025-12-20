import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Bell, Save, Loader2, CheckCircle2, Mail, Clock, AlertTriangle, Flag, Target } from 'lucide-react';
import { Api } from '../../services/api';
import toast from 'react-hot-toast';

/**
 * MED-04: Project Notification Settings Admin UI
 * Allows admin to configure notification settings per project
 */

interface NotificationSettings {
    task_overdue_enabled: boolean;
    task_due_soon_enabled: boolean;
    task_blocked_enabled: boolean;
    decision_pending_enabled: boolean;
    decision_escalation_enabled: boolean;
    phase_transition_enabled: boolean;
    gate_blocked_enabled: boolean;
    initiative_at_risk_enabled: boolean;
    escalation_days: number;
    escalation_email_enabled: boolean;
    email_daily_digest: boolean;
    email_weekly_summary: boolean;
}

interface NotificationSettingsAdminProps {
    projectId: string;
    onSave?: () => void;
}

const defaultSettings: NotificationSettings = {
    task_overdue_enabled: true,
    task_due_soon_enabled: true,
    task_blocked_enabled: true,
    decision_pending_enabled: true,
    decision_escalation_enabled: true,
    phase_transition_enabled: true,
    gate_blocked_enabled: true,
    initiative_at_risk_enabled: true,
    escalation_days: 3,
    escalation_email_enabled: false,
    email_daily_digest: false,
    email_weekly_summary: false
};

export const NotificationSettingsAdmin: React.FC<NotificationSettingsAdminProps> = ({ projectId, onSave }) => {
    const { t } = useTranslation();
    const [settings, setSettings] = useState<NotificationSettings>(defaultSettings);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);

    useEffect(() => {
        fetchSettings();
    }, [projectId]);

    const fetchSettings = async () => {
        setIsLoading(true);
        try {
            const res = await fetch(`/api/notification-settings/project/${projectId}`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            if (res.ok) {
                const data = await res.json();
                setSettings(data);
            }
        } catch (err) {
            console.error('Failed to load notification settings:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const res = await fetch(`/api/notification-settings/project/${projectId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify(settings)
            });

            if (res.ok) {
                toast.success('Notification settings saved');
                setHasChanges(false);
                onSave?.();
            } else {
                throw new Error('Failed to save');
            }
        } catch (err) {
            toast.error('Failed to save notification settings');
        } finally {
            setIsSaving(false);
        }
    };

    const toggleSetting = (key: keyof NotificationSettings) => {
        setSettings(prev => ({
            ...prev,
            [key]: !prev[key]
        }));
        setHasChanges(true);
    };

    const updateDays = (days: number) => {
        setSettings(prev => ({ ...prev, escalation_days: days }));
        setHasChanges(true);
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="animate-spin text-purple-500" size={24} />
            </div>
        );
    }

    const ToggleSwitch = ({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) => (
        <button
            onClick={onToggle}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${enabled ? 'bg-purple-600' : 'bg-slate-300 dark:bg-slate-600'
                }`}
        >
            <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${enabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
            />
        </button>
    );

    const SettingRow = ({ icon: Icon, label, description, settingKey }: {
        icon: any;
        label: string;
        description: string;
        settingKey: keyof NotificationSettings
    }) => (
        <div className="flex items-center justify-between py-3 border-b border-slate-100 dark:border-white/5 last:border-0">
            <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center flex-shrink-0">
                    <Icon size={16} className="text-slate-500 dark:text-slate-400" />
                </div>
                <div>
                    <div className="text-sm font-medium text-slate-700 dark:text-white">{label}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">{description}</div>
                </div>
            </div>
            <ToggleSwitch
                enabled={!!settings[settingKey]}
                onToggle={() => toggleSetting(settingKey)}
            />
        </div>
    );

    return (
        <div className="space-y-6">
            {/* Task Notifications */}
            <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-white/10 p-4">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2 mb-4">
                    <CheckCircle2 size={16} className="text-blue-500" />
                    Task Notifications
                </h3>
                <SettingRow
                    icon={AlertTriangle}
                    label="Overdue Tasks"
                    description="Notify when tasks pass their due date"
                    settingKey="task_overdue_enabled"
                />
                <SettingRow
                    icon={Clock}
                    label="Due Soon"
                    description="Notify when tasks are approaching their due date"
                    settingKey="task_due_soon_enabled"
                />
                <SettingRow
                    icon={Flag}
                    label="Blocked Tasks"
                    description="Notify when tasks become blocked"
                    settingKey="task_blocked_enabled"
                />
            </div>

            {/* Decision Notifications */}
            <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-white/10 p-4">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2 mb-4">
                    <Target size={16} className="text-purple-500" />
                    Decision Notifications
                </h3>
                <SettingRow
                    icon={Bell}
                    label="Pending Decisions"
                    description="Notify when decisions await your input"
                    settingKey="decision_pending_enabled"
                />
                <SettingRow
                    icon={AlertTriangle}
                    label="Decision Escalations"
                    description="Notify when decisions are escalated"
                    settingKey="decision_escalation_enabled"
                />
            </div>

            {/* Phase & Gate Notifications */}
            <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-white/10 p-4">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2 mb-4">
                    <Flag size={16} className="text-green-500" />
                    Phase & Gate Notifications
                </h3>
                <SettingRow
                    icon={CheckCircle2}
                    label="Phase Transitions"
                    description="Notify when project moves to a new phase"
                    settingKey="phase_transition_enabled"
                />
                <SettingRow
                    icon={AlertTriangle}
                    label="Gate Blocked"
                    description="Notify when stage gate criteria are not met"
                    settingKey="gate_blocked_enabled"
                />
                <SettingRow
                    icon={Flag}
                    label="Initiatives at Risk"
                    description="Notify when initiatives are flagged as at risk"
                    settingKey="initiative_at_risk_enabled"
                />
            </div>

            {/* Escalation Settings */}
            <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-white/10 p-4">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2 mb-4">
                    <Clock size={16} className="text-orange-500" />
                    Escalation Settings
                </h3>
                <div className="flex items-center justify-between py-3 border-b border-slate-100 dark:border-white/5">
                    <div>
                        <div className="text-sm font-medium text-slate-700 dark:text-white">Escalation Delay</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">Days before escalating unresolved items</div>
                    </div>
                    <select
                        value={settings.escalation_days}
                        onChange={(e) => updateDays(parseInt(e.target.value))}
                        className="px-3 py-1.5 bg-slate-100 dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-lg text-sm text-slate-700 dark:text-white"
                    >
                        {[1, 2, 3, 5, 7, 14].map(d => (
                            <option key={d} value={d}>{d} day{d > 1 ? 's' : ''}</option>
                        ))}
                    </select>
                </div>
                <SettingRow
                    icon={Mail}
                    label="Email Escalations"
                    description="Send escalation notifications via email"
                    settingKey="escalation_email_enabled"
                />
            </div>

            {/* Email Digest Settings */}
            <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-white/10 p-4">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2 mb-4">
                    <Mail size={16} className="text-blue-500" />
                    Email Digests
                </h3>
                <SettingRow
                    icon={Mail}
                    label="Daily Digest"
                    description="Receive a daily summary of project activity"
                    settingKey="email_daily_digest"
                />
                <SettingRow
                    icon={Mail}
                    label="Weekly Summary"
                    description="Receive a weekly project summary report"
                    settingKey="email_weekly_summary"
                />
            </div>

            {/* Save Button */}
            <div className="flex justify-end">
                <button
                    onClick={handleSave}
                    disabled={!hasChanges || isSaving}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${hasChanges
                            ? 'bg-purple-600 hover:bg-purple-500 text-white'
                            : 'bg-slate-200 dark:bg-slate-700 text-slate-400 cursor-not-allowed'
                        }`}
                >
                    {isSaving ? (
                        <Loader2 size={16} className="animate-spin" />
                    ) : (
                        <Save size={16} />
                    )}
                    Save Notification Settings
                </button>
            </div>
        </div>
    );
};

export default NotificationSettingsAdmin;
