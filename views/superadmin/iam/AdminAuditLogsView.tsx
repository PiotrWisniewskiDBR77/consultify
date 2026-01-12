/**
 * Admin Audit Logs View
 *
 * Displays admin audit logs with risk scoring and filtering capabilities.
 */

import {
    AlertCircle,
    AlertTriangle,
    Calendar,
    Check,
    CheckCircle,
    Clock,
    Download,
    Eye,
    Filter,
    Loader2,
    RefreshCw,
    Shield,
    X,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

import { Card, CardWithHeader } from '../../../components/Admin/shared/Card';
import { Api } from '../../../services/api';

interface AuditLog {
    id: string;
    admin_id: string;
    action_type: string;
    resource_type: string;
    resource_id: string;
    ip_address: string;
    user_agent: string;
    risk_score: number;
    status: string;
    metadata_json: any;
    created_at: string;
    resolved_at: string | null;
    resolution_notes: string | null;
    admin: {
        email: string;
        firstName: string;
        lastName: string;
    };
}

interface AuditStats {
    total_logs: number;
    unresolved_count: number;
    high_risk_count: number;
    medium_risk_count: number;
    low_risk_count: number;
    avg_risk_score: number;
}

const AdminAuditLogsView: React.FC = () => {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [stats, setStats] = useState<AuditStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filters, setFilters] = useState({
        actionType: '',
        status: '',
        riskScoreMin: '',
        fromDate: '',
        toDate: '',
    });
    const [showFilters, setShowFilters] = useState(false);
    const [resolving, setResolving] = useState<string | null>(null);
    const [resolutionNotes, setResolutionNotes] = useState('');
    const [showResolveModal, setShowResolveModal] = useState<string | null>(null);
    const [exporting, setExporting] = useState(false);

    useEffect(() => {
        loadData();
    }, [filters]);

    const loadData = async () => {
        try {
            setLoading(true);
            setError(null);

            const params: any = { limit: 100 };
            if (filters.actionType) params.actionType = filters.actionType;
            if (filters.status) params.status = filters.status;
            if (filters.riskScoreMin) params.riskScoreMin = parseInt(filters.riskScoreMin);

            const [logsData, statsData] = await Promise.all([Api.getAdminAuditLogs(params), Api.getAdminAuditStats()]);

            setLogs(logsData);
            setStats(statsData);
        } catch (err: any) {
            setError(err.message || 'Failed to load audit logs');
        } finally {
            setLoading(false);
        }
    };

    const handleResolve = async (logId: string) => {
        try {
            setResolving(logId);
            await Api.resolveAdminAuditLog(logId, resolutionNotes);
            setLogs((prev) =>
                prev.map((log) =>
                    log.id === logId
                        ? {
                              ...log,
                              status: 'resolved',
                              resolved_at: new Date().toISOString(),
                              resolution_notes: resolutionNotes,
                          }
                        : log,
                ),
            );
            setShowResolveModal(null);
            setResolutionNotes('');
            toast.success('Audit log resolved successfully');
        } catch (err: any) {
            setError(err.message || 'Failed to resolve audit log');
            toast.error(err.message || 'Failed to resolve audit log');
        } finally {
            setResolving(null);
        }
    };

    const handleExport = async () => {
        try {
            setExporting(true);
            const blob = await Api.exportAdminAuditLogs({
                ...filters,
                riskScoreMin: filters.riskScoreMin ? parseInt(filters.riskScoreMin) : undefined,
                format: 'csv',
            });

            // Create download link
            const url = URL.createObjectURL(blob as Blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `audit_logs_${new Date().toISOString().split('T')[0]}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            toast.success('Export downloaded successfully');
        } catch (err: any) {
            toast.error(err.message || 'Failed to export audit logs');
        } finally {
            setExporting(false);
        }
    };

    const clearFilters = () => {
        setFilters({
            actionType: '',
            status: '',
            riskScoreMin: '',
            fromDate: '',
            toDate: '',
        });
    };

    const getRiskBadge = (score: number) => {
        if (score >= 80) {
            return (
                <span className="flex items-center gap-1 px-2 py-1 bg-rose-600/20 text-rose-400 rounded text-xs font-medium animate-pulse">
                    <AlertCircle className="w-3 h-3" />
                    CRITICAL ({score})
                </span>
            );
        }
        if (score >= 60) {
            return (
                <span className="flex items-center gap-1 px-2 py-1 bg-red-500/10 text-red-400 rounded text-xs font-medium">
                    <AlertCircle className="w-3 h-3" />
                    HIGH ({score})
                </span>
            );
        }
        if (score >= 30) {
            return (
                <span className="flex items-center gap-1 px-2 py-1 bg-amber-500/10 text-amber-400 rounded text-xs font-medium">
                    <AlertTriangle className="w-3 h-3" />
                    MEDIUM ({score})
                </span>
            );
        }
        return (
            <span className="flex items-center gap-1 px-2 py-1 bg-emerald-500/10 text-emerald-400 rounded text-xs font-medium">
                <CheckCircle className="w-3 h-3" />
                LOW ({score})
            </span>
        );
    };

    const getStatusBadge = (status: string) => {
        if (status === 'resolved') {
            return <span className="px-2 py-1 bg-emerald-500/10 text-emerald-400 rounded text-xs">Resolved</span>;
        }
        return <span className="px-2 py-1 bg-amber-500/10 text-amber-400 rounded text-xs">Unresolved</span>;
    };

    if (loading && logs.length === 0) {
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
                            <p className="text-sm text-slate-400">Total Logs</p>
                            <p className="text-xl font-semibold">{stats?.total_logs || 0}</p>
                        </div>
                    </div>
                </Card>

                <Card variant="bordered" className="p-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-amber-500/10 rounded-lg">
                            <AlertTriangle className="w-5 h-5 text-amber-500" />
                        </div>
                        <div>
                            <p className="text-sm text-slate-400">Unresolved</p>
                            <p className="text-xl font-semibold">{stats?.unresolved_count || 0}</p>
                        </div>
                    </div>
                </Card>

                <Card variant="bordered" className="p-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-red-500/10 rounded-lg">
                            <AlertCircle className="w-5 h-5 text-red-500" />
                        </div>
                        <div>
                            <p className="text-sm text-slate-400">High Risk</p>
                            <p className="text-xl font-semibold">{stats?.high_risk_count || 0}</p>
                        </div>
                    </div>
                </Card>

                <Card variant="bordered" className="p-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-amber-500/10 rounded-lg">
                            <AlertTriangle className="w-5 h-5 text-amber-500" />
                        </div>
                        <div>
                            <p className="text-sm text-slate-400">Medium Risk</p>
                            <p className="text-xl font-semibold">{stats?.medium_risk_count || 0}</p>
                        </div>
                    </div>
                </Card>

                <Card variant="bordered" className="p-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-500/10 rounded-lg">
                            <CheckCircle className="w-5 h-5 text-emerald-500" />
                        </div>
                        <div>
                            <p className="text-sm text-slate-400">Low Risk</p>
                            <p className="text-xl font-semibold">{stats?.low_risk_count || 0}</p>
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

            {/* Filters */}
            <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold">Audit Logs</h2>
                <div className="flex gap-2">
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors ${
                            showFilters ? 'bg-indigo-500/20 text-indigo-400' : 'bg-slate-700 hover:bg-slate-600'
                        }`}
                    >
                        <Filter className="w-4 h-4" />
                        Filters
                        {Object.values(filters).some((v) => v) && (
                            <span className="w-2 h-2 bg-indigo-500 rounded-full" />
                        )}
                    </button>
                    <button
                        onClick={handleExport}
                        disabled={exporting}
                        className="flex items-center gap-2 px-3 py-2 text-sm bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors disabled:opacity-50"
                    >
                        {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                        Export CSV
                    </button>
                    <button
                        onClick={loadData}
                        disabled={loading}
                        className="flex items-center gap-2 px-3 py-2 text-sm bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        Refresh
                    </button>
                </div>
            </div>

            {/* Filter Panel */}
            {showFilters && (
                <Card variant="bordered" className="p-4">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-sm font-medium text-slate-300">Filter Audit Logs</h3>
                        {Object.values(filters).some((v) => v) && (
                            <button
                                onClick={clearFilters}
                                className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-300"
                            >
                                <X className="w-3 h-3" />
                                Clear Filters
                            </button>
                        )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
                        <div>
                            <label className="block text-sm text-slate-400 mb-1">Action Type</label>
                            <select
                                value={filters.actionType}
                                onChange={(e) => setFilters({ ...filters, actionType: e.target.value })}
                                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm"
                            >
                                <option value="">All Actions</option>
                                <option value="login">Login</option>
                                <option value="logout">Logout</option>
                                <option value="create">Create</option>
                                <option value="modify">Modify</option>
                                <option value="delete">Delete</option>
                                <option value="export_data">Export Data</option>
                                <option value="bulk_action">Bulk Action</option>
                                <option value="session_revoke">Session Revoke</option>
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
                                <option value="unresolved">Unresolved</option>
                                <option value="resolved">Resolved</option>
                                <option value="success">Success</option>
                                <option value="failure">Failure</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm text-slate-400 mb-1">Risk Level</label>
                            <select
                                value={filters.riskScoreMin}
                                onChange={(e) => setFilters({ ...filters, riskScoreMin: e.target.value })}
                                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm"
                            >
                                <option value="">Any Risk</option>
                                <option value="80">Critical (80+)</option>
                                <option value="60">High+ (60+)</option>
                                <option value="30">Medium+ (30+)</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm text-slate-400 mb-1">From Date</label>
                            <div className="relative">
                                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input
                                    type="date"
                                    value={filters.fromDate}
                                    onChange={(e) => setFilters({ ...filters, fromDate: e.target.value })}
                                    className="w-full pl-10 pr-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm text-slate-400 mb-1">To Date</label>
                            <div className="relative">
                                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input
                                    type="date"
                                    value={filters.toDate}
                                    onChange={(e) => setFilters({ ...filters, toDate: e.target.value })}
                                    className="w-full pl-10 pr-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm"
                                />
                            </div>
                        </div>
                    </div>
                </Card>
            )}

            {/* Logs Table */}
            <CardWithHeader title="Audit Logs" subtitle={`${logs.length} logs`}>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-slate-700">
                                <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Admin</th>
                                <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Action</th>
                                <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Resource</th>
                                <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">IP Address</th>
                                <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Risk</th>
                                <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Status</th>
                                <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Time</th>
                                <th className="text-right py-3 px-4 text-sm font-medium text-slate-400">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {logs.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="text-center py-8 text-slate-400">
                                        No audit logs found
                                    </td>
                                </tr>
                            ) : (
                                logs.map((log) => (
                                    <tr
                                        key={log.id}
                                        className="border-b border-slate-700/50 hover:bg-slate-800/50 transition-colors"
                                    >
                                        <td className="py-3 px-4">
                                            <div>
                                                <p className="font-medium">
                                                    {log.admin?.firstName} {log.admin?.lastName}
                                                </p>
                                                <p className="text-sm text-slate-400">{log.admin?.email}</p>
                                            </div>
                                        </td>
                                        <td className="py-3 px-4">
                                            <span className="text-sm font-mono bg-slate-800 px-2 py-1 rounded">
                                                {log.action_type}
                                            </span>
                                        </td>
                                        <td className="py-3 px-4">
                                            <div>
                                                <p className="text-sm">{log.resource_type || '-'}</p>
                                                <p className="text-xs text-slate-400 truncate max-w-[150px]">
                                                    {log.resource_id || '-'}
                                                </p>
                                            </div>
                                        </td>
                                        <td className="py-3 px-4 text-sm">{log.ip_address || 'Unknown'}</td>
                                        <td className="py-3 px-4">{getRiskBadge(log.risk_score)}</td>
                                        <td className="py-3 px-4">{getStatusBadge(log.status)}</td>
                                        <td className="py-3 px-4">
                                            <div className="flex items-center gap-1 text-sm text-slate-300">
                                                <Clock className="w-4 h-4 text-slate-400" />
                                                {new Date(log.created_at).toLocaleString()}
                                            </div>
                                        </td>
                                        <td className="py-3 px-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                {log.status !== 'resolved' && (
                                                    <button
                                                        onClick={() => setShowResolveModal(log.id)}
                                                        className="p-2 text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors"
                                                        title="Resolve"
                                                    >
                                                        <Check className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </CardWithHeader>

            {/* Resolve Modal */}
            {showResolveModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <Card variant="elevated" className="w-full max-w-md p-6">
                        <h3 className="text-lg font-semibold mb-4">Resolve Audit Log</h3>
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
                                disabled={resolving === showResolveModal}
                                className="flex items-center gap-2 px-4 py-2 text-sm bg-emerald-500 hover:bg-emerald-600 rounded-lg disabled:opacity-50"
                            >
                                {resolving === showResolveModal ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Check className="w-4 h-4" />
                                )}
                                Resolve
                            </button>
                        </div>
                    </Card>
                </div>
            )}
        </div>
    );
};

export default AdminAuditLogsView;
