import React, { useState, useEffect, useCallback } from 'react';
import { useStore } from '../../store';
import { useTranslation } from 'react-i18next';
import {
    Bell,
    Mail,
    CheckCircle,
    RefreshCw
} from 'lucide-react';

interface NotificationPreferences {
    channel_email: boolean;
    channel_slack: boolean;
    channel_teams: boolean;
    event_approval_due: boolean;
    event_playbook_stuck: boolean;
    event_dead_letter: boolean;
    event_escalation: boolean;
    isDefault?: boolean;
}

const NotificationSettingsPage: React.FC = () => {
    const { t } = useTranslation();
    const token = localStorage.getItem('token');
    const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const fetchPrefs = useCallback(async () => {
        if (!token) return;

        setLoading(true);
        setError(null);

        try {
            const response = await fetch('/api/settings/workflow-notifications', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) {
                throw new Error('Failed to fetch preferences');
            }

            const data = await response.json();
            setPrefs(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setLoading(false);
        }
    }, [token]);

    useEffect(() => {
        fetchPrefs();
    }, [fetchPrefs]);

    const handleSave = async () => {
        if (!token || !prefs) return;

        setSaving(true);
        setError(null);
        setSuccess(false);

        try {
            const response = await fetch('/api/settings/workflow-notifications', {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(prefs)
            });

            if (!response.ok) {
                throw new Error('Failed to save preferences');
            }

            setSuccess(true);
            setTimeout(() => setSuccess(false), 3000);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setSaving(false);
        }
    };

    const handleToggle = (key: keyof NotificationPreferences) => {
        if (!prefs) return;
        setPrefs({ ...prefs, [key]: !prefs[key], isDefault: false });
    };

    const ToggleSwitch: React.FC<{ enabled: boolean; onChange: () => void; label: string; description?: string }> =
        ({ enabled, onChange, label, description }) => (
            <div className="flex items-center justify-between py-3">
                <div>
                    <div className="text-sm font-medium text-gray-900 dark:text-white">{label}</div>
                    {description && (
                        <div className="text-xs text-gray-500 dark:text-gray-400">{description}</div>
                    )}
                </div>
                <button
                    onClick={onChange}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${enabled ? 'bg-indigo-600' : 'bg-gray-300 dark:bg-gray-600'
                        }`}
                >
                    <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${enabled ? 'translate-x-6' : 'translate-x-1'
                            }`}
                    />
                </button>
            </div>
        );

    return (
        <div className="p-6 max-w-2xl mx-auto">
            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
                <Bell className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                        Notification Settings
                    </h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        Configure how you receive workflow notifications
                    </p>
                </div>
            </div>

            {/* Error */}
            {error && (
                <div className="p-4 mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400">
                    {error}
                </div>
            )}

            {/* Success */}
            {success && (
                <div className="p-4 mb-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-green-700 dark:text-green-400 flex items-center gap-2">
                    <CheckCircle className="w-5 h-5" />
                    Settings saved successfully
                </div>
            )}

            {/* Loading */}
            {loading && (
                <div className="flex items-center justify-center py-12">
                    <RefreshCw className="w-8 h-8 animate-spin text-indigo-600" />
                </div>
            )}

            {!loading && prefs && (
                <>
                    {/* Channels Section */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 mb-6">
                        <div className="flex items-center gap-2 mb-4">
                            <Mail className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                                Notification Channels
                            </h2>
                        </div>
                        <div className="divide-y divide-gray-200 dark:divide-gray-700">
                            <ToggleSwitch
                                enabled={prefs.channel_email}
                                onChange={() => handleToggle('channel_email')}
                                label="Email"
                                description="Receive notifications via email"
                            />
                            <ToggleSwitch
                                enabled={prefs.channel_slack}
                                onChange={() => handleToggle('channel_slack')}
                                label="Slack"
                                description="Coming soon"
                            />
                            <ToggleSwitch
                                enabled={prefs.channel_teams}
                                onChange={() => handleToggle('channel_teams')}
                                label="Microsoft Teams"
                                description="Coming soon"
                            />
                        </div>
                    </div>

                    {/* Events Section */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 mb-6">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                            Event Types
                        </h2>
                        <div className="divide-y divide-gray-200 dark:divide-gray-700">
                            <ToggleSwitch
                                enabled={prefs.event_approval_due}
                                onChange={() => handleToggle('event_approval_due')}
                                label="Approval Due"
                                description="When an assigned approval is approaching or past its SLA"
                            />
                            <ToggleSwitch
                                enabled={prefs.event_escalation}
                                onChange={() => handleToggle('event_escalation')}
                                label="Escalations"
                                description="When an approval is escalated to you"
                            />
                            <ToggleSwitch
                                enabled={prefs.event_playbook_stuck}
                                onChange={() => handleToggle('event_playbook_stuck')}
                                label="Playbook Stuck"
                                description="When a playbook run is stuck waiting for action"
                            />
                            <ToggleSwitch
                                enabled={prefs.event_dead_letter}
                                onChange={() => handleToggle('event_dead_letter')}
                                label="Dead Letter Jobs"
                                description="When a job fails after maximum retry attempts"
                            />
                        </div>
                    </div>

                    {/* Save Button */}
                    <div className="flex justify-end">
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="flex items-center gap-2 px-6 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {saving ? (
                                <>
                                    <RefreshCw className="w-4 h-4 animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                'Save Preferences'
                            )}
                        </button>
                    </div>
                </>
            )}
        </div>
    );
};

export default NotificationSettingsPage;
