/**
 * DataGovernancePanel - Data retention policy configuration
 *
 * Features:
 * - Data retention policy configuration
 * - Automatic data purge rules
 * - Geographic data residency settings
 * - Cross-border transfer controls
 */

import { AlertTriangle, Clock, Database, Globe, Info, Loader2, MapPin, Save, Shield, Trash2 } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

interface RetentionPolicy {
    id: string;
    data_type: string;
    retention_days: number;
    auto_purge: boolean;
    description: string;
}

interface DataGovernanceSettings {
    retention_policies: RetentionPolicy[];
    data_residency: string;
    cross_border_allowed: boolean;
    encryption_at_rest: boolean;
    encryption_in_transit: boolean;
    audit_log_retention_days: number;
}

const DATA_TYPES = [
    { id: 'user_activity', label: 'User Activity Logs', description: 'Login history, page views, actions' },
    { id: 'chat_history', label: 'AI Chat History', description: 'Conversations with AI assistants' },
    { id: 'task_history', label: 'Task History', description: 'Completed and archived tasks' },
    { id: 'documents', label: 'Deleted Documents', description: 'Documents in trash' },
    { id: 'analytics', label: 'Analytics Data', description: 'Usage statistics and metrics' },
    { id: 'exports', label: 'Data Exports', description: 'Generated export files' },
];

const REGIONS = [
    { code: 'eu-west', label: 'EU West (Ireland)', flag: '🇪🇺' },
    { code: 'eu-central', label: 'EU Central (Frankfurt)', flag: '🇩🇪' },
    { code: 'us-east', label: 'US East (Virginia)', flag: '🇺🇸' },
    { code: 'us-west', label: 'US West (Oregon)', flag: '🇺🇸' },
    { code: 'ap-southeast', label: 'Asia Pacific (Singapore)', flag: '🇸🇬' },
];

export const DataGovernancePanel: React.FC = () => {
    const { t } = useTranslation();
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [settings, setSettings] = useState<DataGovernanceSettings>({
        retention_policies: DATA_TYPES.map((dt) => ({
            id: dt.id,
            data_type: dt.id,
            retention_days: 365,
            auto_purge: false,
            description: dt.description,
        })),
        data_residency: 'eu-west',
        cross_border_allowed: false,
        encryption_at_rest: true,
        encryption_in_transit: true,
        audit_log_retention_days: 730,
    });

    const handleUpdatePolicy = (dataType: string, field: string, value: any) => {
        setSettings((prev) => ({
            ...prev,
            retention_policies: prev.retention_policies.map((p) =>
                p.data_type === dataType ? { ...p, [field]: value } : p,
            ),
        }));
    };

    const handleSave = async () => {
        try {
            setSaving(true);
            // API call would go here
            await new Promise((resolve) => setTimeout(resolve, 1000)); // Simulated
            toast.success(t('admin.dataGovernance.saved', 'Data governance settings saved'));
        } catch (error) {
            toast.error(t('admin.dataGovernance.saveError', 'Failed to save settings'));
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                    <Database className="w-5 h-5 text-purple-500" />
                    {t('admin.dataGovernance.title', 'Data Governance')}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    {t(
                        'admin.dataGovernance.description',
                        'Configure data retention, residency, and compliance settings',
                    )}
                </p>
            </div>

            {/* Data Residency */}
            <div className="p-4 bg-white dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/10 space-y-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center">
                        <Globe className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                        <h4 className="font-medium text-slate-900 dark:text-white">
                            {t('admin.dataGovernance.residency', 'Data Residency')}
                        </h4>
                        <p className="text-sm text-slate-500">
                            {t('admin.dataGovernance.residencyDesc', 'Primary region where your data is stored')}
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {REGIONS.map((region) => (
                        <button
                            key={region.code}
                            onClick={() => setSettings((prev) => ({ ...prev, data_residency: region.code }))}
                            className={`p-3 rounded-xl border transition-all text-left ${
                                settings.data_residency === region.code
                                    ? 'bg-purple-50 dark:bg-purple-500/20 border-purple-500'
                                    : 'bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 hover:border-purple-300'
                            }`}
                        >
                            <span className="text-2xl">{region.flag}</span>
                            <p className="text-sm font-medium text-slate-900 dark:text-white mt-1">{region.label}</p>
                        </button>
                    ))}
                </div>
            </div>

            {/* Cross-Border Transfer */}
            <div className="p-4 bg-white dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/10">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <MapPin className="w-5 h-5 text-amber-500" />
                        <div>
                            <p className="font-medium text-slate-900 dark:text-white">
                                {t('admin.dataGovernance.crossBorder', 'Cross-Border Data Transfer')}
                            </p>
                            <p className="text-sm text-slate-500">
                                {t(
                                    'admin.dataGovernance.crossBorderDesc',
                                    'Allow data processing in other regions for performance',
                                )}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() =>
                            setSettings((prev) => ({ ...prev, cross_border_allowed: !prev.cross_border_allowed }))
                        }
                        className={`w-12 h-6 rounded-full transition-colors ${
                            settings.cross_border_allowed ? 'bg-purple-600' : 'bg-slate-300 dark:bg-slate-600'
                        }`}
                    >
                        <div
                            className={`w-5 h-5 bg-white rounded-full transform transition-transform ${
                                settings.cross_border_allowed ? 'translate-x-6' : 'translate-x-0.5'
                            }`}
                        />
                    </button>
                </div>
                {!settings.cross_border_allowed && (
                    <div className="mt-3 flex items-start gap-2 p-2 bg-blue-50 dark:bg-blue-500/10 rounded-lg">
                        <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5" />
                        <p className="text-xs text-blue-700 dark:text-blue-300">
                            {t(
                                'admin.dataGovernance.crossBorderNote',
                                'Data will only be stored and processed in the selected region (GDPR compliant)',
                            )}
                        </p>
                    </div>
                )}
            </div>

            {/* Encryption Settings */}
            <div className="p-4 bg-white dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/10 space-y-3">
                <div className="flex items-center gap-2">
                    <Shield className="w-5 h-5 text-emerald-500" />
                    <h4 className="font-medium text-slate-900 dark:text-white">
                        {t('admin.dataGovernance.encryption', 'Encryption')}
                    </h4>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-navy-950 rounded-lg">
                        <div>
                            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">At Rest</p>
                            <p className="text-xs text-slate-500">AES-256</p>
                        </div>
                        <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center ${
                                settings.encryption_at_rest
                                    ? 'bg-emerald-100 dark:bg-emerald-500/20'
                                    : 'bg-red-100 dark:bg-red-500/20'
                            }`}
                        >
                            <Shield
                                className={`w-4 h-4 ${settings.encryption_at_rest ? 'text-emerald-600' : 'text-red-600'}`}
                            />
                        </div>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-navy-950 rounded-lg">
                        <div>
                            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">In Transit</p>
                            <p className="text-xs text-slate-500">TLS 1.3</p>
                        </div>
                        <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center ${
                                settings.encryption_in_transit
                                    ? 'bg-emerald-100 dark:bg-emerald-500/20'
                                    : 'bg-red-100 dark:bg-red-500/20'
                            }`}
                        >
                            <Shield
                                className={`w-4 h-4 ${settings.encryption_in_transit ? 'text-emerald-600' : 'text-red-600'}`}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Retention Policies */}
            <div className="p-4 bg-white dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/10 space-y-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-500/20 flex items-center justify-center">
                        <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div>
                        <h4 className="font-medium text-slate-900 dark:text-white">
                            {t('admin.dataGovernance.retention', 'Data Retention Policies')}
                        </h4>
                        <p className="text-sm text-slate-500">
                            {t(
                                'admin.dataGovernance.retentionDesc',
                                'Configure how long different types of data are kept',
                            )}
                        </p>
                    </div>
                </div>

                <div className="space-y-3">
                    {settings.retention_policies.map((policy) => {
                        const dataType = DATA_TYPES.find((dt) => dt.id === policy.data_type);
                        return (
                            <div key={policy.id} className="p-4 bg-slate-50 dark:bg-navy-950 rounded-lg">
                                <div className="flex items-center justify-between mb-3">
                                    <div>
                                        <p className="font-medium text-slate-900 dark:text-white">
                                            {dataType?.label || policy.data_type}
                                        </p>
                                        <p className="text-xs text-slate-500">{dataType?.description}</p>
                                    </div>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <span className="text-xs text-slate-500">Auto-purge</span>
                                        <button
                                            onClick={() =>
                                                handleUpdatePolicy(policy.data_type, 'auto_purge', !policy.auto_purge)
                                            }
                                            className={`w-10 h-5 rounded-full transition-colors ${
                                                policy.auto_purge ? 'bg-red-500' : 'bg-slate-300 dark:bg-slate-600'
                                            }`}
                                        >
                                            <div
                                                className={`w-4 h-4 bg-white rounded-full transform transition-transform ${
                                                    policy.auto_purge ? 'translate-x-5' : 'translate-x-0.5'
                                                }`}
                                            />
                                        </button>
                                    </label>
                                </div>
                                <div className="flex items-center gap-3">
                                    <select
                                        value={policy.retention_days}
                                        onChange={(e) =>
                                            handleUpdatePolicy(
                                                policy.data_type,
                                                'retention_days',
                                                parseInt(e.target.value),
                                            )
                                        }
                                        className="flex-1 px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-navy-950 text-slate-900 dark:text-white text-sm"
                                    >
                                        <option value={30}>30 days</option>
                                        <option value={90}>90 days</option>
                                        <option value={180}>180 days</option>
                                        <option value={365}>1 year</option>
                                        <option value={730}>2 years</option>
                                        <option value={1825}>5 years</option>
                                        <option value={-1}>Forever</option>
                                    </select>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Audit Log Retention */}
                <div className="pt-4 border-t border-slate-200 dark:border-white/10">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="font-medium text-slate-900 dark:text-white">
                                {t('admin.dataGovernance.auditRetention', 'Audit Log Retention')}
                            </p>
                            <p className="text-sm text-slate-500">
                                {t('admin.dataGovernance.auditRetentionDesc', 'Security and compliance audit logs')}
                            </p>
                        </div>
                        <select
                            value={settings.audit_log_retention_days}
                            onChange={(e) =>
                                setSettings((prev) => ({ ...prev, audit_log_retention_days: parseInt(e.target.value) }))
                            }
                            className="px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-navy-950 text-slate-900 dark:text-white text-sm"
                        >
                            <option value={365}>1 year</option>
                            <option value={730}>2 years</option>
                            <option value={1825}>5 years</option>
                            <option value={2555}>7 years</option>
                            <option value={-1}>Forever</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Warning */}
            <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-500/10 rounded-xl border border-amber-200 dark:border-amber-500/20">
                <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                    <p className="font-medium text-amber-800 dark:text-amber-300">
                        {t('admin.dataGovernance.warning', 'Important')}
                    </p>
                    <p className="text-sm text-amber-700 dark:text-amber-400 mt-1">
                        {t(
                            'admin.dataGovernance.warningText',
                            'Changing data retention policies will affect data available for compliance audits. Purged data cannot be recovered.',
                        )}
                    </p>
                </div>
            </div>

            {/* Save Button */}
            <div className="flex justify-end pt-4">
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-medium transition-colors disabled:opacity-50"
                >
                    {saving ? (
                        <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            {t('common.saving', 'Saving...')}
                        </>
                    ) : (
                        <>
                            <Save className="w-4 h-4" />
                            {t('common.saveChanges', 'Save Changes')}
                        </>
                    )}
                </button>
            </div>
        </div>
    );
};

export default DataGovernancePanel;
