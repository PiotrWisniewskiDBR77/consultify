/**
 * Security Incidents View
 * Manages security incidents in the IAM module
 */

import {
    AlertCircle,
    AlertTriangle,
    Check,
    CheckCircle,
    Clock,
    Eye,
    Filter,
    Loader2,
    Plus,
    RefreshCw,
    Shield,
    Trash2,
    X,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

import { Card, CardWithHeader } from '../../../components/Admin/shared/Card';
import { Api } from '../../../services/api';

interface SecurityIncident {
    id: string;
    incidentType: string;
    severity: string;
    status: string;
    description: string;
    affectedResources: string[];
    detectedAt: string;
    resolvedAt: string | null;
    resolutionNotes: string | null;
    createdAt: string;
    resolvedBy: {
        id: string;
        email: string;
        firstName: string;
        lastName: string;
    } | null;
}

interface IncidentStats {
    totalIncidents: number;
    byStatus: {
        open: number;
        inProgress: number;
        resolved: number;
        closed: number;
    };
    bySeverity: {
        critical: number;
        high: number;
        medium: number;
        low: number;
    };
}

const SEVERITY_OPTIONS = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const STATUS_OPTIONS = ['open', 'in_progress', 'resolved', 'closed'];
const INCIDENT_TYPES = [
    { value: 'unauthorized_access', label: 'Unauthorized Access' },
    { value: 'data_breach', label: 'Data Breach' },
    { value: 'malware', label: 'Malware' },
    { value: 'phishing', label: 'Phishing' },
    { value: 'dos_attack', label: 'DoS Attack' },
    { value: 'brute_force', label: 'Brute Force' },
    { value: 'privilege_escalation', label: 'Privilege Escalation' },
    { value: 'data_exfiltration', label: 'Data Exfiltration' },
    { value: 'insider_threat', label: 'Insider Threat' },
    { value: 'configuration_error', label: 'Configuration Error' },
    { value: 'suspicious_activity', label: 'Suspicious Activity' },
    { value: 'other', label: 'Other' },
];

const SecurityIncidentsView: React.FC = () => {
    const [incidents, setIncidents] = useState<SecurityIncident[]>([]);
    const [stats, setStats] = useState<IncidentStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filters, setFilters] = useState({
        severity: '',
        status: '',
        incidentType: '',
    });
    const [showFilters, setShowFilters] = useState(false);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showResolveModal, setShowResolveModal] = useState<string | null>(null);
    const [showDetailModal, setShowDetailModal] = useState<SecurityIncident | null>(null);
    const [resolutionNotes, setResolutionNotes] = useState('');
    const [saving, setSaving] = useState(false);
    const [formData, setFormData] = useState({
        incidentType: 'suspicious_activity',
        severity: 'MEDIUM',
        description: '',
        affectedResources: '',
    });

    useEffect(() => {
        loadData();
    }, [filters.severity, filters.status, filters.incidentType]);

    const loadData = async () => {
        try {
            setLoading(true);
            setError(null);

            const params: any = {};
            if (filters.severity) params.severity = filters.severity;
            if (filters.status) params.status = filters.status;
            if (filters.incidentType) params.incidentType = filters.incidentType;

            const [incidentsData, statsData] = await Promise.all([
                Api.getSecurityIncidents(params),
                Api.getSecurityIncidentStats(),
            ]);

            setIncidents(incidentsData);
            setStats(statsData);
        } catch (err: any) {
            setError(err.message || 'Failed to load security incidents');
            toast.error(err.message || 'Failed to load security incidents');
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async () => {
        try {
            setSaving(true);
            await Api.createSecurityIncident({
                incidentType: formData.incidentType,
                severity: formData.severity,
                description: formData.description,
                affectedResources: formData.affectedResources
                    .split(',')
                    .map((r) => r.trim())
                    .filter(Boolean),
            });
            toast.success('Security incident created successfully');
            await loadData();
            setShowCreateModal(false);
            setFormData({
                incidentType: 'suspicious_activity',
                severity: 'MEDIUM',
                description: '',
                affectedResources: '',
            });
        } catch (err: any) {
            toast.error(err.message || 'Failed to create security incident');
        } finally {
            setSaving(false);
        }
    };

    const handleResolve = async (incidentId: string) => {
        try {
            setSaving(true);
            await Api.resolveSecurityIncident(incidentId, resolutionNotes);
            toast.success('Incident resolved successfully');
            setIncidents((prev) =>
                prev.map((inc) =>
                    inc.id === incidentId
                        ? { ...inc, status: 'resolved', resolvedAt: new Date().toISOString(), resolutionNotes }
                        : inc,
                ),
            );
            setShowResolveModal(null);
            setResolutionNotes('');
            loadData(); // Refresh stats
        } catch (err: any) {
            toast.error(err.message || 'Failed to resolve incident');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (incidentId: string) => {
        if (!confirm('Are you sure you want to delete this incident?')) return;
        try {
            await Api.deleteSecurityIncident(incidentId);
            toast.success('Incident deleted successfully');
            setIncidents((prev) => prev.filter((inc) => inc.id !== incidentId));
            loadData(); // Refresh stats
        } catch (err: any) {
            toast.error(err.message || 'Failed to delete incident');
        }
    };

    const getSeverityBadge = (severity: string) => {
        switch (severity) {
            case 'CRITICAL':
                return (
                    <span className="flex items-center gap-1 px-2 py-1 bg-red-600/20 text-red-400 rounded text-xs font-medium">
                        <AlertCircle className="w-3 h-3" />
                        CRITICAL
                    </span>
                );
            case 'HIGH':
                return (
                    <span className="flex items-center gap-1 px-2 py-1 bg-orange-500/20 text-orange-400 rounded text-xs font-medium">
                        <AlertTriangle className="w-3 h-3" />
                        HIGH
                    </span>
                );
            case 'MEDIUM':
                return (
                    <span className="flex items-center gap-1 px-2 py-1 bg-amber-500/20 text-amber-400 rounded text-xs font-medium">
                        <AlertTriangle className="w-3 h-3" />
                        MEDIUM
                    </span>
                );
            default:
                return (
                    <span className="flex items-center gap-1 px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded text-xs font-medium">
                        <CheckCircle className="w-3 h-3" />
                        LOW
                    </span>
                );
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'open':
                return <span className="px-2 py-1 bg-red-500/10 text-red-400 rounded text-xs">Open</span>;
            case 'in_progress':
                return <span className="px-2 py-1 bg-amber-500/10 text-amber-400 rounded text-xs">In Progress</span>;
            case 'resolved':
                return <span className="px-2 py-1 bg-emerald-500/10 text-emerald-400 rounded text-xs">Resolved</span>;
            case 'closed':
                return <span className="px-2 py-1 bg-slate-500/10 text-slate-400 rounded text-xs">Closed</span>;
            default:
                return <span className="px-2 py-1 bg-slate-500/10 text-slate-400 rounded text-xs">{status}</span>;
        }
    };

    const getIncidentTypeLabel = (type: string) => {
        return INCIDENT_TYPES.find((t) => t.value === type)?.label || type;
    };

    if (loading && incidents.length === 0) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <Card variant="bordered" className="p-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-500/10 rounded-lg">
                            <Shield className="w-5 h-5 text-indigo-500" />
                        </div>
                        <div>
                            <p className="text-sm text-slate-400">Total Incidents</p>
                            <p className="text-xl font-semibold">{stats?.totalIncidents || 0}</p>
                        </div>
                    </div>
                </Card>

                <Card variant="bordered" className="p-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-red-500/10 rounded-lg">
                            <AlertCircle className="w-5 h-5 text-red-500" />
                        </div>
                        <div>
                            <p className="text-sm text-slate-400">Open</p>
                            <p className="text-xl font-semibold">{stats?.byStatus.open || 0}</p>
                        </div>
                    </div>
                </Card>

                <Card variant="bordered" className="p-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-red-600/10 rounded-lg">
                            <AlertCircle className="w-5 h-5 text-red-600" />
                        </div>
                        <div>
                            <p className="text-sm text-slate-400">Critical</p>
                            <p className="text-xl font-semibold">{stats?.bySeverity.critical || 0}</p>
                        </div>
                    </div>
                </Card>

                <Card variant="bordered" className="p-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-orange-500/10 rounded-lg">
                            <AlertTriangle className="w-5 h-5 text-orange-500" />
                        </div>
                        <div>
                            <p className="text-sm text-slate-400">High</p>
                            <p className="text-xl font-semibold">{stats?.bySeverity.high || 0}</p>
                        </div>
                    </div>
                </Card>

                <Card variant="bordered" className="p-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-500/10 rounded-lg">
                            <CheckCircle className="w-5 h-5 text-emerald-500" />
                        </div>
                        <div>
                            <p className="text-sm text-slate-400">Resolved</p>
                            <p className="text-xl font-semibold">{stats?.byStatus.resolved || 0}</p>
                        </div>
                    </div>
                </Card>
            </div>

            {/* Error Alert */}
            {error && (
                <Card variant="bordered" className="p-4 border-red-500/30 bg-red-500/5">
                    <div className="flex items-center gap-2 text-red-400">
                        <AlertTriangle className="w-5 h-5" />
                        <span>{error}</span>
                        <button onClick={() => setError(null)} className="ml-auto text-sm hover:text-red-300">
                            Dismiss
                        </button>
                    </div>
                </Card>
            )}

            {/* Filters and Actions */}
            <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold">Security Incidents</h2>
                <div className="flex gap-2">
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors ${
                            showFilters ? 'bg-indigo-500/20 text-indigo-400' : 'bg-slate-700 hover:bg-slate-600'
                        }`}
                    >
                        <Filter className="w-4 h-4" />
                        Filters
                    </button>
                    <button
                        onClick={loadData}
                        disabled={loading}
                        className="flex items-center gap-2 px-3 py-2 text-sm bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        Refresh
                    </button>
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="flex items-center gap-2 px-3 py-2 text-sm bg-red-500 hover:bg-red-600 rounded-lg transition-colors"
                    >
                        <Plus className="w-4 h-4" />
                        Report Incident
                    </button>
                </div>
            </div>

            {/* Filter Panel */}
            {showFilters && (
                <Card variant="bordered" className="p-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm text-slate-400 mb-1">Severity</label>
                            <select
                                value={filters.severity}
                                onChange={(e) => setFilters({ ...filters, severity: e.target.value })}
                                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm"
                            >
                                <option value="">All Severities</option>
                                {SEVERITY_OPTIONS.map((s) => (
                                    <option key={s} value={s}>
                                        {s}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm text-slate-400 mb-1">Status</label>
                            <select
                                value={filters.status}
                                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm"
                            >
                                <option value="">All Statuses</option>
                                {STATUS_OPTIONS.map((s) => (
                                    <option key={s} value={s}>
                                        {s.charAt(0).toUpperCase() + s.slice(1).replace('_', ' ')}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm text-slate-400 mb-1">Incident Type</label>
                            <select
                                value={filters.incidentType}
                                onChange={(e) => setFilters({ ...filters, incidentType: e.target.value })}
                                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm"
                            >
                                <option value="">All Types</option>
                                {INCIDENT_TYPES.map((t) => (
                                    <option key={t.value} value={t.value}>
                                        {t.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                </Card>
            )}

            {/* Incidents Table */}
            <CardWithHeader title="Incidents" subtitle={`${incidents.length} incidents`}>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-slate-700">
                                <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Type</th>
                                <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Description</th>
                                <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Severity</th>
                                <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Status</th>
                                <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Detected</th>
                                <th className="text-right py-3 px-4 text-sm font-medium text-slate-400">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {incidents.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="text-center py-8 text-slate-400">
                                        No security incidents found
                                    </td>
                                </tr>
                            ) : (
                                incidents.map((incident) => (
                                    <tr
                                        key={incident.id}
                                        className="border-b border-slate-700/50 hover:bg-slate-800/50 transition-colors"
                                    >
                                        <td className="py-3 px-4">
                                            <span className="px-2 py-1 bg-slate-700 rounded text-xs font-mono">
                                                {getIncidentTypeLabel(incident.incidentType)}
                                            </span>
                                        </td>
                                        <td className="py-3 px-4">
                                            <p className="text-sm max-w-xs truncate">{incident.description}</p>
                                        </td>
                                        <td className="py-3 px-4">{getSeverityBadge(incident.severity)}</td>
                                        <td className="py-3 px-4">{getStatusBadge(incident.status)}</td>
                                        <td className="py-3 px-4">
                                            <div className="flex items-center gap-1 text-sm text-slate-300">
                                                <Clock className="w-4 h-4 text-slate-400" />
                                                {new Date(incident.detectedAt).toLocaleString()}
                                            </div>
                                        </td>
                                        <td className="py-3 px-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => setShowDetailModal(incident)}
                                                    className="p-2 text-slate-400 hover:bg-slate-700 rounded-lg transition-colors"
                                                    title="View Details"
                                                >
                                                    <Eye className="w-4 h-4" />
                                                </button>
                                                {incident.status !== 'resolved' && incident.status !== 'closed' && (
                                                    <button
                                                        onClick={() => setShowResolveModal(incident.id)}
                                                        className="p-2 text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors"
                                                        title="Resolve"
                                                    >
                                                        <Check className="w-4 h-4" />
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => handleDelete(incident.id)}
                                                    className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                                    title="Delete"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </CardWithHeader>

            {/* Create Incident Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <Card variant="elevated" className="w-full max-w-lg p-6">
                        <h3 className="text-lg font-semibold mb-4">Report Security Incident</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm text-slate-400 mb-1">Incident Type</label>
                                <select
                                    value={formData.incidentType}
                                    onChange={(e) => setFormData({ ...formData, incidentType: e.target.value })}
                                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm"
                                >
                                    {INCIDENT_TYPES.map((t) => (
                                        <option key={t.value} value={t.value}>
                                            {t.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm text-slate-400 mb-1">Severity</label>
                                <select
                                    value={formData.severity}
                                    onChange={(e) => setFormData({ ...formData, severity: e.target.value })}
                                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm"
                                >
                                    {SEVERITY_OPTIONS.map((s) => (
                                        <option key={s} value={s}>
                                            {s}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm text-slate-400 mb-1">Description</label>
                                <textarea
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    placeholder="Describe the security incident..."
                                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm h-24 resize-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-slate-400 mb-1">
                                    Affected Resources (comma-separated)
                                </label>
                                <input
                                    type="text"
                                    value={formData.affectedResources}
                                    onChange={(e) => setFormData({ ...formData, affectedResources: e.target.value })}
                                    placeholder="e.g., server-1, database-prod, user-accounts"
                                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm"
                                />
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 mt-6">
                            <button
                                onClick={() => {
                                    setShowCreateModal(false);
                                    setFormData({
                                        incidentType: 'suspicious_activity',
                                        severity: 'MEDIUM',
                                        description: '',
                                        affectedResources: '',
                                    });
                                }}
                                className="px-4 py-2 text-sm bg-slate-700 hover:bg-slate-600 rounded-lg"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleCreate}
                                disabled={saving || !formData.description}
                                className="flex items-center gap-2 px-4 py-2 text-sm bg-red-500 hover:bg-red-600 rounded-lg disabled:opacity-50"
                            >
                                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                                Report Incident
                            </button>
                        </div>
                    </Card>
                </div>
            )}

            {/* Resolve Modal */}
            {showResolveModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <Card variant="elevated" className="w-full max-w-md p-6">
                        <h3 className="text-lg font-semibold mb-4">Resolve Incident</h3>
                        <textarea
                            value={resolutionNotes}
                            onChange={(e) => setResolutionNotes(e.target.value)}
                            placeholder="Resolution notes..."
                            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm mb-4 h-24 resize-none"
                        />
                        <div className="flex justify-end gap-2">
                            <button
                                onClick={() => {
                                    setShowResolveModal(null);
                                    setResolutionNotes('');
                                }}
                                className="px-4 py-2 text-sm bg-slate-700 hover:bg-slate-600 rounded-lg"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => handleResolve(showResolveModal)}
                                disabled={saving}
                                className="flex items-center gap-2 px-4 py-2 text-sm bg-emerald-500 hover:bg-emerald-600 rounded-lg disabled:opacity-50"
                            >
                                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                Resolve
                            </button>
                        </div>
                    </Card>
                </div>
            )}

            {/* Detail Modal */}
            {showDetailModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <Card variant="elevated" className="w-full max-w-2xl p-6">
                        <div className="flex justify-between items-start mb-4">
                            <h3 className="text-lg font-semibold">Incident Details</h3>
                            <button
                                onClick={() => setShowDetailModal(null)}
                                className="p-1 text-slate-400 hover:text-slate-200"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-sm text-slate-400">Incident Type</p>
                                    <p className="font-medium">{getIncidentTypeLabel(showDetailModal.incidentType)}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-slate-400">Severity</p>
                                    {getSeverityBadge(showDetailModal.severity)}
                                </div>
                                <div>
                                    <p className="text-sm text-slate-400">Status</p>
                                    {getStatusBadge(showDetailModal.status)}
                                </div>
                                <div>
                                    <p className="text-sm text-slate-400">Detected At</p>
                                    <p>{new Date(showDetailModal.detectedAt).toLocaleString()}</p>
                                </div>
                            </div>
                            <div>
                                <p className="text-sm text-slate-400">Description</p>
                                <p className="mt-1 text-slate-200">{showDetailModal.description}</p>
                            </div>
                            {showDetailModal.affectedResources && showDetailModal.affectedResources.length > 0 && (
                                <div>
                                    <p className="text-sm text-slate-400">Affected Resources</p>
                                    <div className="flex flex-wrap gap-2 mt-1">
                                        {showDetailModal.affectedResources.map((r, i) => (
                                            <span key={i} className="px-2 py-1 bg-slate-700 rounded text-xs">
                                                {r}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {showDetailModal.resolvedAt && (
                                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-700">
                                    <div>
                                        <p className="text-sm text-slate-400">Resolved At</p>
                                        <p>{new Date(showDetailModal.resolvedAt).toLocaleString()}</p>
                                    </div>
                                    {showDetailModal.resolvedBy && (
                                        <div>
                                            <p className="text-sm text-slate-400">Resolved By</p>
                                            <p>
                                                {showDetailModal.resolvedBy.firstName}{' '}
                                                {showDetailModal.resolvedBy.lastName}
                                            </p>
                                        </div>
                                    )}
                                    {showDetailModal.resolutionNotes && (
                                        <div className="col-span-2">
                                            <p className="text-sm text-slate-400">Resolution Notes</p>
                                            <p className="mt-1">{showDetailModal.resolutionNotes}</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                        <div className="flex justify-end mt-6">
                            <button
                                onClick={() => setShowDetailModal(null)}
                                className="px-4 py-2 text-sm bg-slate-700 hover:bg-slate-600 rounded-lg"
                            >
                                Close
                            </button>
                        </div>
                    </Card>
                </div>
            )}
        </div>
    );
};

export default SecurityIncidentsView;


