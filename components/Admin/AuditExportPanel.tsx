/**
 * AuditExportPanel - Export audit logs and compliance reports
 *
 * Features:
 * - Export audit logs to CSV/JSON
 * - Scheduled audit reports
 * - Compliance report generation (GDPR, SOC2)
 * - Anomaly detection alerts
 */

import {
    AlertTriangle,
    Bell,
    Calendar,
    CheckCircle,
    Clock,
    Download,
    FileJson,
    FileSpreadsheet,
    FileText,
    Filter,
    Loader2,
    Shield,
    XCircle,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

interface ExportJob {
    id: string;
    type: 'audit_log' | 'compliance_report';
    format: 'csv' | 'json' | 'pdf';
    status: 'pending' | 'processing' | 'completed' | 'failed';
    created_at: string;
    completed_at?: string;
    download_url?: string;
    file_size?: string;
}

interface ScheduledReport {
    id: string;
    name: string;
    report_type: string;
    frequency: 'daily' | 'weekly' | 'monthly';
    recipients: string[];
    next_run: string;
    enabled: boolean;
}

const REPORT_TYPES = [
    { id: 'gdpr', label: 'GDPR Compliance', description: 'Data processing activities and consent records' },
    { id: 'soc2', label: 'SOC 2 Type II', description: 'Security, availability, and confidentiality controls' },
    { id: 'iso27001', label: 'ISO 27001', description: 'Information security management' },
    { id: 'hipaa', label: 'HIPAA', description: 'Health information privacy (if applicable)' },
    { id: 'custom', label: 'Custom Audit', description: 'Custom date range and filters' },
];

export const AuditExportPanel: React.FC = () => {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState<'export' | 'scheduled' | 'anomalies'>('export');
    const [loading, setLoading] = useState(false);
    const [exportFormat, setExportFormat] = useState<'csv' | 'json'>('csv');
    const [dateRange, setDateRange] = useState({
        start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        end: new Date().toISOString().split('T')[0],
    });
    const [selectedReportType, setSelectedReportType] = useState('gdpr');
    const [exportJobs, setExportJobs] = useState<ExportJob[]>([
        {
            id: '1',
            type: 'audit_log',
            format: 'csv',
            status: 'completed',
            created_at: '2024-12-28T10:00:00Z',
            completed_at: '2024-12-28T10:05:00Z',
            download_url: '#',
            file_size: '2.4 MB',
        },
        {
            id: '2',
            type: 'compliance_report',
            format: 'pdf',
            status: 'completed',
            created_at: '2024-12-27T14:00:00Z',
            completed_at: '2024-12-27T14:15:00Z',
            download_url: '#',
            file_size: '1.8 MB',
        },
        { id: '3', type: 'audit_log', format: 'json', status: 'processing', created_at: '2024-12-28T11:30:00Z' },
    ]);
    const [scheduledReports, setScheduledReports] = useState<ScheduledReport[]>([
        {
            id: '1',
            name: 'Weekly Security Audit',
            report_type: 'soc2',
            frequency: 'weekly',
            recipients: ['admin@company.com'],
            next_run: '2024-12-30T09:00:00Z',
            enabled: true,
        },
        {
            id: '2',
            name: 'Monthly GDPR Report',
            report_type: 'gdpr',
            frequency: 'monthly',
            recipients: ['dpo@company.com', 'legal@company.com'],
            next_run: '2025-01-01T09:00:00Z',
            enabled: true,
        },
    ]);
    const [anomalies, setAnomalies] = useState([
        {
            id: '1',
            severity: 'high',
            type: 'Multiple failed logins',
            count: 47,
            time_range: 'Last 24 hours',
            resolved: false,
        },
        {
            id: '2',
            severity: 'medium',
            type: 'Unusual data export volume',
            count: 3,
            time_range: 'Last 7 days',
            resolved: true,
        },
        { id: '3', severity: 'low', type: 'New device login', count: 12, time_range: 'Last 30 days', resolved: true },
    ]);

    const handleExportAuditLog = async () => {
        try {
            setLoading(true);
            // API call would go here
            await new Promise((resolve) => setTimeout(resolve, 1000));
            const newJob: ExportJob = {
                id: `job-${Date.now()}`,
                type: 'audit_log',
                format: exportFormat,
                status: 'processing',
                created_at: new Date().toISOString(),
            };
            setExportJobs((prev) => [newJob, ...prev]);
            toast.success(t('admin.audit.exportStarted', 'Export started. You will be notified when ready.'));
        } catch (error) {
            toast.error(t('admin.audit.exportError', 'Failed to start export'));
        } finally {
            setLoading(false);
        }
    };

    const handleGenerateReport = async () => {
        try {
            setLoading(true);
            // API call would go here
            await new Promise((resolve) => setTimeout(resolve, 1000));
            const newJob: ExportJob = {
                id: `job-${Date.now()}`,
                type: 'compliance_report',
                format: 'pdf',
                status: 'processing',
                created_at: new Date().toISOString(),
            };
            setExportJobs((prev) => [newJob, ...prev]);
            toast.success(t('admin.audit.reportStarted', 'Report generation started.'));
        } catch (error) {
            toast.error(t('admin.audit.reportError', 'Failed to generate report'));
        } finally {
            setLoading(false);
        }
    };

    const getStatusIcon = (status: ExportJob['status']) => {
        switch (status) {
            case 'completed':
                return <CheckCircle className="w-4 h-4 text-green-500" />;
            case 'processing':
                return <Loader2 className="w-4 h-4 text-amber-500 animate-spin" />;
            case 'failed':
                return <XCircle className="w-4 h-4 text-red-500" />;
            default:
                return <Clock className="w-4 h-4 text-slate-400" />;
        }
    };

    const getSeverityColor = (severity: string) => {
        switch (severity) {
            case 'high':
                return 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-300';
            case 'medium':
                return 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300';
            default:
                return 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300';
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                    <FileText className="w-5 h-5 text-purple-500" />
                    {t('admin.audit.title', 'Audit & Compliance')}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    {t('admin.audit.description', 'Export audit logs and generate compliance reports')}
                </p>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 border-b border-slate-200 dark:border-white/10">
                {['export', 'scheduled', 'anomalies'].map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab as any)}
                        className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                            activeTab === tab
                                ? 'border-purple-500 text-purple-600 dark:text-purple-400'
                                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                        }`}
                    >
                        {tab === 'export' && t('admin.audit.tabs.export', 'Export')}
                        {tab === 'scheduled' && t('admin.audit.tabs.scheduled', 'Scheduled')}
                        {tab === 'anomalies' && (
                            <span className="flex items-center gap-2">
                                {t('admin.audit.tabs.anomalies', 'Anomalies')}
                                {anomalies.filter((a) => !a.resolved).length > 0 && (
                                    <span className="px-1.5 py-0.5 bg-red-500 text-white text-xs rounded-full">
                                        {anomalies.filter((a) => !a.resolved).length}
                                    </span>
                                )}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* Export Tab */}
            {activeTab === 'export' && (
                <div className="space-y-6">
                    {/* Quick Export */}
                    <div className="p-4 bg-white dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/10 space-y-4">
                        <h4 className="font-medium text-slate-900 dark:text-white flex items-center gap-2">
                            <Download className="w-4 h-4 text-slate-500" />
                            {t('admin.audit.quickExport', 'Quick Export Audit Log')}
                        </h4>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                    {t('admin.audit.startDate', 'Start Date')}
                                </label>
                                <input
                                    type="date"
                                    value={dateRange.start}
                                    onChange={(e) => setDateRange((prev) => ({ ...prev, start: e.target.value }))}
                                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-navy-950 text-slate-900 dark:text-white"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                    {t('admin.audit.endDate', 'End Date')}
                                </label>
                                <input
                                    type="date"
                                    value={dateRange.end}
                                    onChange={(e) => setDateRange((prev) => ({ ...prev, end: e.target.value }))}
                                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-navy-950 text-slate-900 dark:text-white"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                    {t('admin.audit.format', 'Format')}
                                </label>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setExportFormat('csv')}
                                        className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
                                            exportFormat === 'csv'
                                                ? 'bg-purple-50 dark:bg-purple-500/20 border-purple-500 text-purple-700 dark:text-purple-300'
                                                : 'border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300'
                                        }`}
                                    >
                                        <FileSpreadsheet className="w-4 h-4" />
                                        CSV
                                    </button>
                                    <button
                                        onClick={() => setExportFormat('json')}
                                        className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
                                            exportFormat === 'json'
                                                ? 'bg-purple-50 dark:bg-purple-500/20 border-purple-500 text-purple-700 dark:text-purple-300'
                                                : 'border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300'
                                        }`}
                                    >
                                        <FileJson className="w-4 h-4" />
                                        JSON
                                    </button>
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={handleExportAuditLog}
                            disabled={loading}
                            className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                            {t('admin.audit.exportBtn', 'Export Audit Log')}
                        </button>
                    </div>

                    {/* Compliance Reports */}
                    <div className="p-4 bg-white dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/10 space-y-4">
                        <h4 className="font-medium text-slate-900 dark:text-white flex items-center gap-2">
                            <Shield className="w-4 h-4 text-slate-500" />
                            {t('admin.audit.complianceReports', 'Compliance Reports')}
                        </h4>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {REPORT_TYPES.map((report) => (
                                <button
                                    key={report.id}
                                    onClick={() => setSelectedReportType(report.id)}
                                    className={`p-3 rounded-xl border text-left transition-all ${
                                        selectedReportType === report.id
                                            ? 'bg-purple-50 dark:bg-purple-500/20 border-purple-500'
                                            : 'bg-slate-50 dark:bg-navy-950 border-slate-200 dark:border-white/10 hover:border-purple-300'
                                    }`}
                                >
                                    <p className="font-medium text-slate-900 dark:text-white">{report.label}</p>
                                    <p className="text-xs text-slate-500 mt-1">{report.description}</p>
                                </button>
                            ))}
                        </div>

                        <button
                            onClick={handleGenerateReport}
                            disabled={loading}
                            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                            {t('admin.audit.generateReport', 'Generate Report')}
                        </button>
                    </div>

                    {/* Recent Exports */}
                    <div className="p-4 bg-white dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/10 space-y-4">
                        <h4 className="font-medium text-slate-900 dark:text-white">
                            {t('admin.audit.recentExports', 'Recent Exports')}
                        </h4>

                        <div className="space-y-2">
                            {exportJobs.map((job) => (
                                <div
                                    key={job.id}
                                    className="flex items-center justify-between p-3 bg-slate-50 dark:bg-navy-950 rounded-lg"
                                >
                                    <div className="flex items-center gap-3">
                                        {getStatusIcon(job.status)}
                                        <div>
                                            <p className="text-sm font-medium text-slate-900 dark:text-white">
                                                {job.type === 'audit_log' ? 'Audit Log' : 'Compliance Report'}
                                                <span className="ml-2 text-xs text-slate-400 uppercase">
                                                    {job.format}
                                                </span>
                                            </p>
                                            <p className="text-xs text-slate-500">
                                                {new Date(job.created_at).toLocaleString()}
                                                {job.file_size && ` • ${job.file_size}`}
                                            </p>
                                        </div>
                                    </div>
                                    {job.status === 'completed' && job.download_url && (
                                        <button className="px-3 py-1 text-sm text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-500/10 rounded-lg">
                                            <Download className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Scheduled Tab */}
            {activeTab === 'scheduled' && (
                <div className="space-y-4">
                    <div className="flex justify-end">
                        <button className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium">
                            + {t('admin.audit.addSchedule', 'Add Scheduled Report')}
                        </button>
                    </div>

                    {scheduledReports.map((report) => (
                        <div
                            key={report.id}
                            className="p-4 bg-white dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/10"
                        >
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-3">
                                    <Calendar className="w-5 h-5 text-purple-500" />
                                    <div>
                                        <p className="font-medium text-slate-900 dark:text-white">{report.name}</p>
                                        <p className="text-xs text-slate-500">
                                            {report.frequency} • Next: {new Date(report.next_run).toLocaleDateString()}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() =>
                                        setScheduledReports((prev) =>
                                            prev.map((r) => (r.id === report.id ? { ...r, enabled: !r.enabled } : r)),
                                        )
                                    }
                                    className={`w-10 h-5 rounded-full transition-colors ${
                                        report.enabled ? 'bg-purple-600' : 'bg-slate-300 dark:bg-slate-600'
                                    }`}
                                >
                                    <div
                                        className={`w-4 h-4 bg-white rounded-full transform transition-transform ${
                                            report.enabled ? 'translate-x-5' : 'translate-x-0.5'
                                        }`}
                                    />
                                </button>
                            </div>
                            <div className="flex gap-2">
                                {report.recipients.map((email, idx) => (
                                    <span
                                        key={idx}
                                        className="px-2 py-1 bg-slate-100 dark:bg-white/10 text-xs text-slate-600 dark:text-slate-400 rounded-full"
                                    >
                                        {email}
                                    </span>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Anomalies Tab */}
            {activeTab === 'anomalies' && (
                <div className="space-y-4">
                    <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-500/10 rounded-xl border border-amber-200 dark:border-amber-500/20">
                        <Bell className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                        <div>
                            <p className="font-medium text-amber-800 dark:text-amber-300">
                                {t('admin.audit.anomalyInfo', 'Anomaly Detection Active')}
                            </p>
                            <p className="text-sm text-amber-700 dark:text-amber-400 mt-1">
                                {t(
                                    'admin.audit.anomalyInfoDesc',
                                    'AI-powered monitoring detects unusual patterns in user activity and data access.',
                                )}
                            </p>
                        </div>
                    </div>

                    {anomalies.map((anomaly) => (
                        <div
                            key={anomaly.id}
                            className={`p-4 rounded-xl border ${
                                anomaly.resolved
                                    ? 'bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 opacity-60'
                                    : 'bg-white dark:bg-white/5 border-slate-200 dark:border-white/10'
                            }`}
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <span
                                        className={`px-2 py-1 rounded-full text-xs font-medium ${getSeverityColor(anomaly.severity)}`}
                                    >
                                        {anomaly.severity.toUpperCase()}
                                    </span>
                                    <div>
                                        <p className="font-medium text-slate-900 dark:text-white">{anomaly.type}</p>
                                        <p className="text-xs text-slate-500">
                                            {anomaly.count} occurrences • {anomaly.time_range}
                                        </p>
                                    </div>
                                </div>
                                {!anomaly.resolved && (
                                    <button
                                        onClick={() =>
                                            setAnomalies((prev) =>
                                                prev.map((a) => (a.id === anomaly.id ? { ...a, resolved: true } : a)),
                                            )
                                        }
                                        className="px-3 py-1 text-sm text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-500/10 rounded-lg"
                                    >
                                        {t('admin.audit.resolve', 'Mark Resolved')}
                                    </button>
                                )}
                                {anomaly.resolved && (
                                    <span className="flex items-center gap-1 text-sm text-green-600 dark:text-green-400">
                                        <CheckCircle className="w-4 h-4" />
                                        {t('admin.audit.resolved', 'Resolved')}
                                    </span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default AuditExportPanel;



