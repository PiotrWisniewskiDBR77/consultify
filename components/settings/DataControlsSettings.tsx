/**
 * DataControlsSettings - Enhanced GDPR Compliance Data Controls
 * 
 * Features:
 * - Consent management dashboard
 * - Data portability (full GDPR export)
 * - Third-party data sharing toggles
 * - AI training opt-out
 * - Data retention period selector
 * - Right to be forgotten workflow
 */

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Database,
    Eye,
    Trash2,
    Download,
    Shield,
    Clock,
    AlertTriangle,
    CheckCircle,
    XCircle,
    FileText,
    Loader2,
    ChevronRight,
    RefreshCw,
    Globe,
    Brain,
    BarChart3,
    Share2,
    Calendar,
    Info,
    Mail,
    Lock
} from 'lucide-react';
import toast from 'react-hot-toast';
import { User } from '../../types';
import { Api } from '../../services/api';

interface DataControlsSettingsProps {
    currentUser: User;
    onUpdateUser?: (updates: Partial<User>) => void;
    className?: string;
}

interface ConsentSettings {
    analytics: boolean;
    personalization: boolean;
    marketing: boolean;
    thirdPartySharing: boolean;
    aiTraining: boolean;
}

interface DataRetention {
    period: '30' | '90' | '180' | '365' | 'forever';
    autoDelete: boolean;
}

interface ExportRequest {
    id: string;
    status: 'pending' | 'processing' | 'ready' | 'expired';
    requestedAt: string;
    expiresAt?: string;
    downloadUrl?: string;
}

interface DeletionRequest {
    id: string;
    status: 'pending' | 'scheduled' | 'completed' | 'cancelled';
    requestedAt: string;
    scheduledFor?: string;
}

const DEFAULT_CONSENTS: ConsentSettings = {
    analytics: true,
    personalization: true,
    marketing: false,
    thirdPartySharing: false,
    aiTraining: true
};

const DEFAULT_RETENTION: DataRetention = {
    period: '365',
    autoDelete: false
};

export const DataControlsSettings: React.FC<DataControlsSettingsProps> = ({ 
    currentUser,
    onUpdateUser,
    className = '' 
}) => {
    const { t } = useTranslation();
    const [consents, setConsents] = useState<ConsentSettings>(DEFAULT_CONSENTS);
    const [retention, setRetention] = useState<DataRetention>(DEFAULT_RETENTION);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [exportRequest, setExportRequest] = useState<ExportRequest | null>(null);
    const [deletionRequest, setDeletionRequest] = useState<DeletionRequest | null>(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deleteConfirmText, setDeleteConfirmText] = useState('');
    const [exporting, setExporting] = useState(false);
    const [requestingDeletion, setRequestingDeletion] = useState(false);

    useEffect(() => {
        loadSettings();
    }, [currentUser.id]);

    const loadSettings = async () => {
        setLoading(true);
        try {
            const [consentsRes, retentionRes, exportRes] = await Promise.all([
                Api.get('/api/gdpr/consents').catch(() => null),
                Api.get('/api/gdpr/retention').catch(() => null),
                Api.get('/api/gdpr/export-status').catch(() => null)
            ]);

            if (consentsRes?.consents) {
                setConsents({ ...DEFAULT_CONSENTS, ...consentsRes.consents });
            }
            if (retentionRes?.retention) {
                setRetention(retentionRes.retention);
            }
            if (exportRes?.request) {
                setExportRequest(exportRes.request);
            }
        } catch (error) {
            console.error('Failed to load data controls:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleConsentChange = async (key: keyof ConsentSettings, value: boolean) => {
        const newConsents = { ...consents, [key]: value };
        setConsents(newConsents);

        try {
            await Api.put('/api/gdpr/consents', { consents: newConsents });
            toast.success(t('settings.data.consentUpdated', 'Consent preferences updated'));
        } catch (error) {
            setConsents(consents); // Revert
            toast.error(t('settings.data.consentError', 'Failed to update consent'));
        }
    };

    const handleRetentionChange = async (period: DataRetention['period']) => {
        const newRetention = { ...retention, period };
        setRetention(newRetention);

        try {
            await Api.put('/api/gdpr/retention', { retention: newRetention });
            toast.success(t('settings.data.retentionUpdated', 'Data retention period updated'));
        } catch (error) {
            setRetention(retention); // Revert
            toast.error(t('settings.data.retentionError', 'Failed to update retention'));
        }
    };

    const handleExportRequest = async () => {
        setExporting(true);
        try {
            const response = await Api.post('/api/gdpr/export-request', {});
            if (response?.request) {
                setExportRequest(response.request);
                toast.success(t('settings.data.exportRequested', 'Data export requested. You will be notified when ready.'));
            } else {
                // Fallback: direct download
                const data = await Api.get('/api/user/data-export');
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `consultify-data-export-${new Date().toISOString().split('T')[0]}.json`;
                a.click();
                URL.revokeObjectURL(url);
                toast.success(t('settings.data.exportSuccess', 'Data exported successfully'));
            }
        } catch (error) {
            toast.error(t('settings.data.exportError', 'Failed to request data export'));
        } finally {
            setExporting(false);
        }
    };

    const handleDownloadExport = async () => {
        if (exportRequest?.downloadUrl) {
            window.open(exportRequest.downloadUrl, '_blank');
        }
    };

    const handleDeleteRequest = async () => {
        if (deleteConfirmText.toLowerCase() !== 'delete my data') {
            toast.error(t('settings.data.deleteConfirmError', 'Please type "delete my data" to confirm'));
            return;
        }

        setRequestingDeletion(true);
        try {
            const response = await Api.post('/api/gdpr/deletion-request', {});
            if (response?.request) {
                setDeletionRequest(response.request);
                setShowDeleteConfirm(false);
                setDeleteConfirmText('');
                toast.success(t('settings.data.deletionRequested', 'Account deletion scheduled. You will receive a confirmation email.'));
            }
        } catch (error) {
            toast.error(t('settings.data.deletionError', 'Failed to request account deletion'));
        } finally {
            setRequestingDeletion(false);
        }
    };

    const handleCancelDeletion = async () => {
        if (!deletionRequest) return;

        try {
            await Api.post('/api/gdpr/cancel-deletion', { requestId: deletionRequest.id });
            setDeletionRequest(null);
            toast.success(t('settings.data.deletionCancelled', 'Account deletion cancelled'));
        } catch (error) {
            toast.error(t('settings.data.cancelError', 'Failed to cancel deletion'));
        }
    };

    const retentionOptions = [
        { value: '30', label: t('settings.data.retention30', '30 days') },
        { value: '90', label: t('settings.data.retention90', '90 days') },
        { value: '180', label: t('settings.data.retention180', '6 months') },
        { value: '365', label: t('settings.data.retention365', '1 year') },
        { value: 'forever', label: t('settings.data.retentionForever', 'Forever') }
    ];

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
            </div>
        );
    }

    return (
        <div className={`max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 ${className}`}>
            {/* Header */}
            <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-teal-500/25">
                    <Database className="w-7 h-7 text-white" />
                </div>
                <div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                        {t('settings.data.title', 'Data Controls')}
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400">
                        {t('settings.data.description', 'Manage how your data is collected, used, and stored')}
                    </p>
                </div>
            </div>

            {/* GDPR Compliance Banner */}
            <div className="bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 rounded-xl p-4 flex items-start gap-4">
                <Shield className="w-6 h-6 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                <div>
                    <h4 className="font-semibold text-blue-800 dark:text-blue-400">
                        {t('settings.data.gdprTitle', 'GDPR Compliant')}
                    </h4>
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                        {t('settings.data.gdprDesc', 'We comply with GDPR regulations. You have full control over your personal data, including the right to access, export, and delete it.')}
                    </p>
                </div>
            </div>

            {/* Consent Management */}
            <div className="bg-white dark:bg-navy-900 rounded-2xl border border-slate-200 dark:border-white/10 overflow-hidden">
                <div className="p-6 border-b border-slate-100 dark:border-white/5">
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                        <CheckCircle className="w-5 h-5 text-emerald-500" />
                        {t('settings.data.consentsTitle', 'Consent Management')}
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        {t('settings.data.consentsDesc', 'Choose how we can use your data')}
                    </p>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-white/5">
                    <ConsentToggle
                        icon={<BarChart3 className="w-5 h-5" />}
                        title={t('settings.data.analytics', 'Usage Analytics')}
                        description={t('settings.data.analyticsDesc', 'Help improve the product by sharing anonymous usage data')}
                        checked={consents.analytics}
                        onChange={(checked) => handleConsentChange('analytics', checked)}
                    />
                    <ConsentToggle
                        icon={<Brain className="w-5 h-5" />}
                        title={t('settings.data.personalization', 'Personalization')}
                        description={t('settings.data.personalizationDesc', 'Use your data to personalize your experience and recommendations')}
                        checked={consents.personalization}
                        onChange={(checked) => handleConsentChange('personalization', checked)}
                    />
                    <ConsentToggle
                        icon={<Mail className="w-5 h-5" />}
                        title={t('settings.data.marketing', 'Marketing Communications')}
                        description={t('settings.data.marketingDesc', 'Receive product updates, tips, and promotional offers')}
                        checked={consents.marketing}
                        onChange={(checked) => handleConsentChange('marketing', checked)}
                    />
                    <ConsentToggle
                        icon={<Share2 className="w-5 h-5" />}
                        title={t('settings.data.thirdParty', 'Third-Party Data Sharing')}
                        description={t('settings.data.thirdPartyDesc', 'Share data with trusted partners for enhanced features')}
                        checked={consents.thirdPartySharing}
                        onChange={(checked) => handleConsentChange('thirdPartySharing', checked)}
                    />
                    <ConsentToggle
                        icon={<Brain className="w-5 h-5" />}
                        title={t('settings.data.aiTraining', 'AI Model Training')}
                        description={t('settings.data.aiTrainingDesc', 'Allow your anonymized data to improve our AI models')}
                        checked={consents.aiTraining}
                        onChange={(checked) => handleConsentChange('aiTraining', checked)}
                        highlight={!consents.aiTraining}
                    />
                </div>
            </div>

            {/* Data Retention */}
            <div className="bg-white dark:bg-navy-900 rounded-2xl border border-slate-200 dark:border-white/10 p-6">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                            <Clock className="w-5 h-5 text-amber-500" />
                            {t('settings.data.retentionTitle', 'Data Retention')}
                        </h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                            {t('settings.data.retentionDesc', 'Choose how long we keep your data')}
                        </p>
                    </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    {retentionOptions.map((option) => (
                        <button
                            key={option.value}
                            onClick={() => handleRetentionChange(option.value as DataRetention['period'])}
                            className={`px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                                retention.period === option.value
                                    ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/25'
                                    : 'bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/20'
                            }`}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>
                <p className="text-xs text-slate-500 mt-4 flex items-center gap-1">
                    <Info className="w-4 h-4" />
                    {t('settings.data.retentionNote', 'After this period, inactive data will be automatically anonymized or deleted.')}
                </p>
            </div>

            {/* Data Actions */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* View Data */}
                <DataActionCard
                    icon={<Eye className="w-6 h-6" />}
                    title={t('settings.data.viewData', 'View My Data')}
                    description={t('settings.data.viewDataDesc', 'See all data we have about you')}
                    buttonText={t('settings.data.viewDataBtn', 'View Data')}
                    onClick={() => window.open('/settings/my-data', '_blank')}
                />

                {/* Export Data */}
                <DataActionCard
                    icon={<Download className="w-6 h-6" />}
                    title={t('settings.data.exportData', 'Export My Data')}
                    description={
                        exportRequest?.status === 'ready'
                            ? t('settings.data.exportReady', 'Your export is ready to download')
                            : exportRequest?.status === 'processing'
                            ? t('settings.data.exportProcessing', 'Export is being prepared...')
                            : t('settings.data.exportDataDesc', 'Download all your data (GDPR)')
                    }
                    buttonText={
                        exportRequest?.status === 'ready'
                            ? t('settings.data.downloadExport', 'Download')
                            : exportRequest?.status === 'processing'
                            ? t('settings.data.exportPending', 'Processing...')
                            : t('settings.data.requestExport', 'Request Export')
                    }
                    loading={exporting || exportRequest?.status === 'processing'}
                    onClick={exportRequest?.status === 'ready' ? handleDownloadExport : handleExportRequest}
                    status={exportRequest?.status}
                />

                {/* Delete Data */}
                <DataActionCard
                    icon={<Trash2 className="w-6 h-6" />}
                    title={t('settings.data.deleteData', 'Delete My Data')}
                    description={
                        deletionRequest?.status === 'scheduled'
                            ? t('settings.data.deletionScheduled', `Deletion scheduled for ${new Date(deletionRequest.scheduledFor!).toLocaleDateString()}`)
                            : t('settings.data.deleteDataDesc', 'Permanently delete your account and data')
                    }
                    buttonText={
                        deletionRequest?.status === 'scheduled'
                            ? t('settings.data.cancelDeletion', 'Cancel Deletion')
                            : t('settings.data.requestDeletion', 'Request Deletion')
                    }
                    onClick={deletionRequest?.status === 'scheduled' ? handleCancelDeletion : () => setShowDeleteConfirm(true)}
                    variant="danger"
                    status={deletionRequest?.status}
                />
            </div>

            {/* Delete Confirmation Modal */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-navy-900 rounded-2xl max-w-md w-full p-6 animate-in zoom-in-95 duration-200">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-3 bg-red-100 dark:bg-red-500/20 rounded-xl">
                                <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
                            </div>
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                                {t('settings.data.deleteConfirmTitle', 'Delete All Your Data?')}
                            </h3>
                        </div>
                        <p className="text-slate-600 dark:text-slate-400 mb-4">
                            {t('settings.data.deleteConfirmDesc', 'This action cannot be undone. All your data, including projects, settings, and history will be permanently deleted after a 30-day grace period.')}
                        </p>
                        <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-lg p-4 mb-4">
                            <p className="text-sm text-red-700 dark:text-red-400 font-medium mb-2">
                                {t('settings.data.deleteConfirmType', 'Type "delete my data" to confirm:')}
                            </p>
                            <input
                                type="text"
                                value={deleteConfirmText}
                                onChange={(e) => setDeleteConfirmText(e.target.value)}
                                className="w-full px-4 py-2 border border-red-200 dark:border-red-500/30 rounded-lg bg-white dark:bg-navy-950 text-slate-900 dark:text-white focus:ring-2 focus:ring-red-500"
                                placeholder="delete my data"
                            />
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText(''); }}
                                className="flex-1 py-3 bg-slate-100 dark:bg-navy-800 hover:bg-slate-200 dark:hover:bg-navy-700 text-slate-700 dark:text-slate-300 rounded-xl font-medium transition-colors"
                            >
                                {t('common.cancel', 'Cancel')}
                            </button>
                            <button
                                onClick={handleDeleteRequest}
                                disabled={requestingDeletion || deleteConfirmText.toLowerCase() !== 'delete my data'}
                                className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {requestingDeletion ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Trash2 className="w-4 h-4" />
                                )}
                                {t('settings.data.confirmDelete', 'Delete Everything')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Privacy Documents */}
            <div className="bg-slate-50 dark:bg-white/5 rounded-xl p-4">
                <h4 className="font-medium text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    {t('settings.data.relatedDocs', 'Related Documents')}
                </h4>
                <div className="flex flex-wrap gap-3">
                    <a href="/privacy" className="text-sm text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1">
                        <Globe className="w-3 h-3" />
                        {t('settings.data.privacyPolicy', 'Privacy Policy')}
                    </a>
                    <a href="/legal/dpa" className="text-sm text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1">
                        <Lock className="w-3 h-3" />
                        {t('settings.data.dpa', 'Data Processing Agreement')}
                    </a>
                    <a href="/cookies" className="text-sm text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1">
                        <Database className="w-3 h-3" />
                        {t('settings.data.cookiePolicy', 'Cookie Policy')}
                    </a>
                </div>
            </div>
        </div>
    );
};

// Consent Toggle Component
interface ConsentToggleProps {
    icon: React.ReactNode;
    title: string;
    description: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
    highlight?: boolean;
}

const ConsentToggle: React.FC<ConsentToggleProps> = ({
    icon,
    title,
    description,
    checked,
    onChange,
    highlight
}) => {
    return (
        <div className={`p-4 flex items-center justify-between ${highlight ? 'bg-amber-50 dark:bg-amber-500/5' : ''}`}>
            <div className="flex items-center gap-4">
                <div className={`p-2 rounded-lg ${checked ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' : 'bg-slate-100 dark:bg-white/10 text-slate-500'}`}>
                    {icon}
                </div>
                <div>
                    <p className="font-medium text-slate-900 dark:text-white">{title}</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{description}</p>
                </div>
            </div>
            <button
                onClick={() => onChange(!checked)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    checked ? 'bg-emerald-600' : 'bg-slate-200 dark:bg-slate-700'
                }`}
            >
                <span 
                    className={`${checked ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
                />
            </button>
        </div>
    );
};

// Data Action Card Component
interface DataActionCardProps {
    icon: React.ReactNode;
    title: string;
    description: string;
    buttonText: string;
    onClick: () => void;
    variant?: 'default' | 'danger';
    loading?: boolean;
    status?: string;
}

const DataActionCard: React.FC<DataActionCardProps> = ({
    icon,
    title,
    description,
    buttonText,
    onClick,
    variant = 'default',
    loading,
    status
}) => {
    const isDanger = variant === 'danger';

    return (
        <div className={`bg-white dark:bg-navy-900 rounded-xl border ${
            isDanger ? 'border-red-200 dark:border-red-500/30' : 'border-slate-200 dark:border-white/10'
        } p-6 flex flex-col`}>
            <div className={`w-12 h-12 rounded-xl ${
                isDanger 
                    ? 'bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400' 
                    : 'bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-400'
            } flex items-center justify-center mb-4`}>
                {icon}
            </div>
            <h4 className={`font-semibold ${isDanger ? 'text-red-700 dark:text-red-400' : 'text-slate-900 dark:text-white'} mb-1`}>
                {title}
            </h4>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4 flex-1">
                {description}
            </p>
            <button
                onClick={onClick}
                disabled={loading}
                className={`w-full py-2.5 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
                    isDanger
                        ? status === 'scheduled'
                            ? 'bg-slate-100 dark:bg-navy-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-navy-700'
                            : 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-500/30'
                        : 'bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/20'
                } disabled:opacity-50`}
            >
                {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                ) : status === 'ready' ? (
                    <Download className="w-4 h-4" />
                ) : null}
                {buttonText}
            </button>
        </div>
    );
};

export default DataControlsSettings;
