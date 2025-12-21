import React, { useState, useEffect } from 'react';
import {
    FileText, Download, Filter, ChevronLeft, ChevronRight,
    Calendar, User, Activity, Search, RefreshCw
} from 'lucide-react';

interface AuditEntry {
    id: string;
    organizationId: string;
    actorId: string;
    actorRole?: string;
    action: string;
    resourceType: string;
    resourceId?: string;
    before?: Record<string, unknown>;
    after?: Record<string, unknown>;
    correlationId?: string;
    createdAt: string;
}

interface AuditLogViewerProps {
    organizationId?: string;
    isSuperAdmin?: boolean;
}

const actionColors: Record<string, string> = {
    CREATE: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    UPDATE: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    DELETE: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    PUBLISH: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
    TOGGLE: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    GRANT_PERMISSION: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
    REVOKE_PERMISSION: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
    BREAK_GLASS_START: 'bg-red-200 text-red-900 dark:bg-red-900/50 dark:text-red-300',
    BREAK_GLASS_CLOSE: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
};

export const AuditLogViewer: React.FC<AuditLogViewerProps> = ({
    organizationId,
    isSuperAdmin = false
}) => {
    const [entries, setEntries] = useState<AuditEntry[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(0);
    const [pageSize] = useState(20);
    const [filters, setFilters] = useState({
        action: '',
        resourceType: '',
        startDate: '',
        endDate: '',
        search: ''
    });
    const [selectedEntry, setSelectedEntry] = useState<AuditEntry | null>(null);

    const fetchAuditLog = async () => {
        setLoading(true);
        setError(null);

        try {
            const params = new URLSearchParams();
            if (filters.action) params.append('action', filters.action);
            if (filters.resourceType) params.append('resourceType', filters.resourceType);
            if (filters.startDate) params.append('startDate', filters.startDate);
            if (filters.endDate) params.append('endDate', filters.endDate);
            params.append('limit', String(pageSize));
            params.append('offset', String(page * pageSize));

            const token = localStorage.getItem('token');
            const response = await fetch(`/api/governance/audit?${params}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) throw new Error('Failed to fetch audit log');

            const data = await response.json();
            setEntries(data.entries || []);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setLoading(false);
        }
    };

    const exportAuditLog = async (format: 'json' | 'csv') => {
        try {
            const params = new URLSearchParams();
            params.append('format', format);
            if (filters.startDate) params.append('startDate', filters.startDate);
            if (filters.endDate) params.append('endDate', filters.endDate);

            const token = localStorage.getItem('token');
            const response = await fetch(`/api/governance/audit/export?${params}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) throw new Error('Export failed');

            if (format === 'csv') {
                const blob = await response.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `audit_log_${new Date().toISOString().split('T')[0]}.csv`;
                a.click();
                URL.revokeObjectURL(url);
            } else {
                const data = await response.json();
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `audit_log_${new Date().toISOString().split('T')[0]}.json`;
                a.click();
                URL.revokeObjectURL(url);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Export failed');
        }
    };

    useEffect(() => {
        fetchAuditLog();
    }, [page, filters.action, filters.resourceType]);

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleString();
    };

    return (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg">
            {/* Header */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <FileText className="w-5 h-5 text-blue-500" />
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                            Governance Audit Log
                        </h2>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => fetchAuditLog()}
                            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                            title="Refresh"
                        >
                            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        </button>
                        <button
                            onClick={() => exportAuditLog('csv')}
                            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-green-500 text-white rounded hover:bg-green-600"
                        >
                            <Download className="w-4 h-4" />
                            CSV
                        </button>
                        <button
                            onClick={() => exportAuditLog('json')}
                            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
                        >
                            <Download className="w-4 h-4" />
                            JSON
                        </button>
                    </div>
                </div>

                {/* Filters */}
                <div className="flex flex-wrap gap-3">
                    <div className="flex items-center gap-2">
                        <Filter className="w-4 h-4 text-gray-400" />
                        <select
                            value={filters.action}
                            onChange={(e) => setFilters({ ...filters, action: e.target.value })}
                            className="px-2 py-1 text-sm border rounded dark:bg-gray-700 dark:border-gray-600"
                        >
                            <option value="">All Actions</option>
                            <option value="CREATE">Create</option>
                            <option value="UPDATE">Update</option>
                            <option value="DELETE">Delete</option>
                            <option value="TOGGLE">Toggle</option>
                            <option value="PUBLISH">Publish</option>
                            <option value="GRANT_PERMISSION">Grant Permission</option>
                            <option value="REVOKE_PERMISSION">Revoke Permission</option>
                            <option value="BREAK_GLASS_START">Break-Glass Start</option>
                            <option value="BREAK_GLASS_CLOSE">Break-Glass Close</option>
                        </select>
                    </div>

                    <select
                        value={filters.resourceType}
                        onChange={(e) => setFilters({ ...filters, resourceType: e.target.value })}
                        className="px-2 py-1 text-sm border rounded dark:bg-gray-700 dark:border-gray-600"
                    >
                        <option value="">All Resources</option>
                        <option value="POLICY_RULE">Policy Rules</option>
                        <option value="PLAYBOOK_TEMPLATE">Playbook Templates</option>
                        <option value="CONNECTOR">Connectors</option>
                        <option value="PERMISSION">Permissions</option>
                        <option value="BREAK_GLASS_SESSION">Break-Glass Sessions</option>
                    </select>

                    <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        <input
                            type="date"
                            value={filters.startDate}
                            onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                            className="px-2 py-1 text-sm border rounded dark:bg-gray-700 dark:border-gray-600"
                        />
                        <span className="text-gray-400">—</span>
                        <input
                            type="date"
                            value={filters.endDate}
                            onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                            className="px-2 py-1 text-sm border rounded dark:bg-gray-700 dark:border-gray-600"
                        />
                    </div>

                    <button
                        onClick={() => fetchAuditLog()}
                        className="px-3 py-1 text-sm bg-gray-100 dark:bg-gray-700 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
                    >
                        Apply
                    </button>
                </div>
            </div>

            {/* Error */}
            {error && (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400">
                    {error}
                </div>
            )}

            {/* Table */}
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead className="bg-gray-50 dark:bg-gray-700/50">
                        <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                                Timestamp
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                                Actor
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                                Action
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                                Resource
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                                Details
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {loading ? (
                            <tr>
                                <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                                    <RefreshCw className="w-6 h-6 mx-auto animate-spin" />
                                </td>
                            </tr>
                        ) : entries.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                                    No audit entries found
                                </td>
                            </tr>
                        ) : (
                            entries.map((entry) => (
                                <tr
                                    key={entry.id}
                                    className="hover:bg-gray-50 dark:hover:bg-gray-700/30 cursor-pointer"
                                    onClick={() => setSelectedEntry(entry)}
                                >
                                    <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                                        {formatDate(entry.createdAt)}
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-2">
                                            <User className="w-4 h-4 text-gray-400" />
                                            <span className="text-sm text-gray-900 dark:text-white">
                                                {entry.actorId?.slice(0, 8) || 'System'}
                                            </span>
                                            {entry.actorRole && (
                                                <span className="text-xs text-gray-500">({entry.actorRole})</span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded ${actionColors[entry.action] || 'bg-gray-100 text-gray-800'}`}>
                                            {entry.action}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-2">
                                            <Activity className="w-4 h-4 text-gray-400" />
                                            <span className="text-sm text-gray-900 dark:text-gray-200">
                                                {entry.resourceType}
                                            </span>
                                            {entry.resourceId && (
                                                <span className="text-xs text-gray-500 font-mono">
                                                    {entry.resourceId.slice(0, 8)}...
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-sm text-gray-500">
                                        {entry.correlationId && (
                                            <span className="text-xs font-mono">{entry.correlationId.slice(0, 12)}</span>
                                        )}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between p-4 border-t border-gray-200 dark:border-gray-700">
                <div className="text-sm text-gray-500">
                    Showing {page * pageSize + 1} - {page * pageSize + entries.length}
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setPage(Math.max(0, page - 1))}
                        disabled={page === 0}
                        className="p-2 disabled:opacity-50 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-sm">Page {page + 1}</span>
                    <button
                        onClick={() => setPage(page + 1)}
                        disabled={entries.length < pageSize}
                        className="p-2 disabled:opacity-50 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                    >
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Detail Modal */}
            {selectedEntry && (
                <div
                    className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
                    onClick={() => setSelectedEntry(null)}
                >
                    <div
                        className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[80vh] overflow-auto m-4"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                            <h3 className="text-lg font-semibold">Audit Entry Details</h3>
                            <button
                                onClick={() => setSelectedEntry(null)}
                                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                            >
                                ×
                            </button>
                        </div>
                        <div className="p-4 space-y-4">
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <label className="text-gray-500">ID</label>
                                    <div className="font-mono">{selectedEntry.id}</div>
                                </div>
                                <div>
                                    <label className="text-gray-500">Timestamp</label>
                                    <div>{formatDate(selectedEntry.createdAt)}</div>
                                </div>
                                <div>
                                    <label className="text-gray-500">Actor</label>
                                    <div>{selectedEntry.actorId} ({selectedEntry.actorRole})</div>
                                </div>
                                <div>
                                    <label className="text-gray-500">Action</label>
                                    <div className={`inline-flex px-2 py-1 rounded ${actionColors[selectedEntry.action]}`}>
                                        {selectedEntry.action}
                                    </div>
                                </div>
                                <div>
                                    <label className="text-gray-500">Resource Type</label>
                                    <div>{selectedEntry.resourceType}</div>
                                </div>
                                <div>
                                    <label className="text-gray-500">Resource ID</label>
                                    <div className="font-mono">{selectedEntry.resourceId || '–'}</div>
                                </div>
                                {selectedEntry.correlationId && (
                                    <div className="col-span-2">
                                        <label className="text-gray-500">Correlation ID</label>
                                        <div className="font-mono">{selectedEntry.correlationId}</div>
                                    </div>
                                )}
                            </div>

                            {(selectedEntry.before || selectedEntry.after) && (
                                <div className="space-y-2">
                                    {selectedEntry.before && (
                                        <div>
                                            <label className="text-gray-500 text-sm">Before (PII Redacted)</label>
                                            <pre className="mt-1 p-2 bg-gray-100 dark:bg-gray-900 rounded text-xs overflow-auto max-h-32">
                                                {JSON.stringify(selectedEntry.before, null, 2)}
                                            </pre>
                                        </div>
                                    )}
                                    {selectedEntry.after && (
                                        <div>
                                            <label className="text-gray-500 text-sm">After (PII Redacted)</label>
                                            <pre className="mt-1 p-2 bg-gray-100 dark:bg-gray-900 rounded text-xs overflow-auto max-h-32">
                                                {JSON.stringify(selectedEntry.after, null, 2)}
                                            </pre>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AuditLogViewer;
