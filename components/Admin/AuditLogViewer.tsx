/**
 * AuditLogViewer Component
 * 
 * Super Admin panel for viewing AI audit logs with filtering and export capabilities.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
    Shield,
    AlertTriangle,
    AlertCircle,
    CheckCircle,
    Download,
    RefreshCw,
    Search,
    Filter,
    ChevronDown,
    ChevronUp,
    Clock,
    User,
    Cpu,
    DollarSign,
    X
} from 'lucide-react';
import { Button } from '../Button';
import api from '../../services/api';

interface AuditLogEntry {
    id: string;
    timestamp: string;
    user_id: string;
    organization_id: string;
    action: string;
    resource_type: string;
    resource_id?: string;
    request_summary?: string;
    response_summary?: string;
    model_used?: string;
    tokens_used: number;
    cost_usd: number;
    ip_address?: string;
    user_agent?: string;
    risk_level: 'LOW' | 'MEDIUM' | 'HIGH';
    flagged: boolean;
    flag_reason?: string;
}

interface Filters {
    search: string;
    riskLevel: string;
    action: string;
    flaggedOnly: boolean;
    dateFrom: string;
    dateTo: string;
}

const RISK_COLORS = {
    LOW: 'bg-green-100 text-green-800 border-green-200',
    MEDIUM: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    HIGH: 'bg-red-100 text-red-800 border-red-200'
};

const RISK_ICONS = {
    LOW: CheckCircle,
    MEDIUM: AlertCircle,
    HIGH: AlertTriangle
};

export function AuditLogViewer() {
    const [logs, setLogs] = useState<AuditLogEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null);
    const [showFilters, setShowFilters] = useState(false);
    const [pagination, setPagination] = useState({ offset: 0, limit: 50, total: 0 });
    
    const [filters, setFilters] = useState<Filters>({
        search: '',
        riskLevel: '',
        action: '',
        flaggedOnly: false,
        dateFrom: '',
        dateTo: ''
    });

    const fetchLogs = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            const params = new URLSearchParams();
            params.append('limit', pagination.limit.toString());
            params.append('offset', pagination.offset.toString());
            
            if (filters.riskLevel) params.append('riskLevel', filters.riskLevel);
            if (filters.action) params.append('action', filters.action);
            if (filters.flaggedOnly) params.append('flagged', 'true');
            if (filters.search) params.append('userId', filters.search);

            const response = await api.get(`/ai-security/audit-log?${params.toString()}`);
            
            if (response.data.success) {
                setLogs(response.data.data || []);
                setPagination(prev => ({ ...prev, total: response.data.count || 0 }));
            } else {
                setError(response.data.error || 'Failed to fetch logs');
            }
        } catch (err: any) {
            setError(err.message || 'Failed to fetch audit logs');
        } finally {
            setLoading(false);
        }
    }, [pagination.offset, pagination.limit, filters]);

    useEffect(() => {
        fetchLogs();
    }, [fetchLogs]);

    const handleExportCSV = () => {
        if (logs.length === 0) return;

        const headers = ['Timestamp', 'User ID', 'Action', 'Resource', 'Model', 'Tokens', 'Cost (USD)', 'Risk', 'Flagged'];
        const rows = logs.map(log => [
            log.timestamp,
            log.user_id,
            log.action,
            log.resource_type,
            log.model_used || '',
            log.tokens_used.toString(),
            log.cost_usd.toFixed(4),
            log.risk_level,
            log.flagged ? 'Yes' : 'No'
        ]);

        const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `audit-log-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleString('pl-PL', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const RiskIcon = ({ level }: { level: 'LOW' | 'MEDIUM' | 'HIGH' }) => {
        const Icon = RISK_ICONS[level];
        return <Icon className="w-4 h-4" />;
    };

    return (
        <div className="p-6 space-y-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <Shield className="w-8 h-8 text-indigo-600" />
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                            AI Audit Log
                        </h1>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            Enterprise security monitoring
                        </p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => setShowFilters(!showFilters)}
                    >
                        <Filter className="w-4 h-4 mr-2" />
                        Filtry
                    </Button>
                    <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={handleExportCSV}
                        disabled={logs.length === 0}
                    >
                        <Download className="w-4 h-4 mr-2" />
                        Export CSV
                    </Button>
                    <Button 
                        variant="primary" 
                        size="sm" 
                        onClick={fetchLogs}
                    >
                        <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                        Odśwież
                    </Button>
                </div>
            </div>

            {/* Filters Panel */}
            {showFilters && (
                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Szukaj (User ID)
                            </label>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                    type="text"
                                    value={filters.search}
                                    onChange={(e) => setFilters(f => ({ ...f, search: e.target.value }))}
                                    placeholder="ID użytkownika..."
                                    className="w-full pl-10 pr-4 py-2 border rounded-lg bg-gray-50 dark:bg-gray-700 dark:border-gray-600"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Poziom ryzyka
                            </label>
                            <select
                                value={filters.riskLevel}
                                onChange={(e) => setFilters(f => ({ ...f, riskLevel: e.target.value }))}
                                className="w-full px-4 py-2 border rounded-lg bg-gray-50 dark:bg-gray-700 dark:border-gray-600"
                            >
                                <option value="">Wszystkie</option>
                                <option value="LOW">Niski</option>
                                <option value="MEDIUM">Średni</option>
                                <option value="HIGH">Wysoki</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Akcja
                            </label>
                            <select
                                value={filters.action}
                                onChange={(e) => setFilters(f => ({ ...f, action: e.target.value }))}
                                className="w-full px-4 py-2 border rounded-lg bg-gray-50 dark:bg-gray-700 dark:border-gray-600"
                            >
                                <option value="">Wszystkie</option>
                                <option value="ai_request">AI Request</option>
                                <option value="ai_request_error">AI Error</option>
                                <option value="tool_use">Tool Use</option>
                            </select>
                        </div>

                        <div className="flex items-end">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={filters.flaggedOnly}
                                    onChange={(e) => setFilters(f => ({ ...f, flaggedOnly: e.target.checked }))}
                                    className="w-4 h-4 rounded border-gray-300"
                                />
                                <span className="text-sm text-gray-700 dark:text-gray-300">
                                    Tylko oflagowane
                                </span>
                            </label>
                        </div>
                    </div>
                </div>
            )}

            {/* Stats Summary */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-500">Wszystkie logi</span>
                        <Clock className="w-5 h-5 text-gray-400" />
                    </div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                        {pagination.total || logs.length}
                    </p>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-500">Wysokie ryzyko</span>
                        <AlertTriangle className="w-5 h-5 text-red-500" />
                    </div>
                    <p className="text-2xl font-bold text-red-600 mt-1">
                        {logs.filter(l => l.risk_level === 'HIGH').length}
                    </p>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-500">Oflagowane</span>
                        <AlertCircle className="w-5 h-5 text-yellow-500" />
                    </div>
                    <p className="text-2xl font-bold text-yellow-600 mt-1">
                        {logs.filter(l => l.flagged).length}
                    </p>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-500">Łączny koszt</span>
                        <DollarSign className="w-5 h-5 text-green-500" />
                    </div>
                    <p className="text-2xl font-bold text-green-600 mt-1">
                        ${logs.reduce((sum, l) => sum + l.cost_usd, 0).toFixed(2)}
                    </p>
                </div>
            </div>

            {/* Error State */}
            {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700">
                    {error}
                </div>
            )}

            {/* Logs Table */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50 dark:bg-gray-700">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Timestamp
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    User
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Action
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Model
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Tokens
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Cost
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Risk
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                            {loading ? (
                                <tr>
                                    <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                                        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
                                        Ładowanie...
                                    </td>
                                </tr>
                            ) : logs.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                                        Brak logów do wyświetlenia
                                    </td>
                                </tr>
                            ) : (
                                logs.map((log) => (
                                    <tr 
                                        key={log.id}
                                        className={`hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer ${
                                            log.flagged ? 'bg-red-50 dark:bg-red-900/20' : ''
                                        }`}
                                        onClick={() => setSelectedLog(log)}
                                    >
                                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                                            {formatDate(log.timestamp)}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300 font-mono">
                                            {log.user_id?.substring(0, 8)}...
                                        </td>
                                        <td className="px-4 py-3 text-sm">
                                            <span className="px-2 py-1 bg-indigo-100 text-indigo-800 rounded-full text-xs">
                                                {log.action}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                                            {log.model_used || '-'}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                                            {log.tokens_used.toLocaleString()}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                                            ${log.cost_usd.toFixed(4)}
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs border ${RISK_COLORS[log.risk_level]}`}>
                                                <RiskIcon level={log.risk_level} />
                                                {log.risk_level}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setSelectedLog(log);
                                                }}
                                            >
                                                Szczegóły
                                            </Button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center">
                    <span className="text-sm text-gray-500">
                        Pokazuję {pagination.offset + 1} - {Math.min(pagination.offset + pagination.limit, pagination.total || logs.length)} z {pagination.total || logs.length}
                    </span>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={pagination.offset === 0}
                            onClick={() => setPagination(p => ({ ...p, offset: Math.max(0, p.offset - p.limit) }))}
                        >
                            Poprzednie
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={pagination.offset + pagination.limit >= (pagination.total || logs.length)}
                            onClick={() => setPagination(p => ({ ...p, offset: p.offset + p.limit }))}
                        >
                            Następne
                        </Button>
                    </div>
                </div>
            </div>

            {/* Detail Modal */}
            {selectedLog && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-start">
                            <div>
                                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                                    Szczegóły logu
                                </h2>
                                <p className="text-sm text-gray-500">
                                    {formatDate(selectedLog.timestamp)}
                                </p>
                            </div>
                            <button
                                onClick={() => setSelectedLog(null)}
                                className="text-gray-400 hover:text-gray-600"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            {selectedLog.flagged && (
                                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                                    <div className="flex items-center gap-2 text-red-700">
                                        <AlertTriangle className="w-5 h-5" />
                                        <span className="font-medium">Oflagowane</span>
                                    </div>
                                    <p className="text-sm text-red-600 mt-1">
                                        {selectedLog.flag_reason || 'Brak powodu'}
                                    </p>
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs text-gray-500 uppercase">User ID</label>
                                    <p className="font-mono text-sm">{selectedLog.user_id}</p>
                                </div>
                                <div>
                                    <label className="text-xs text-gray-500 uppercase">Organization ID</label>
                                    <p className="font-mono text-sm">{selectedLog.organization_id}</p>
                                </div>
                                <div>
                                    <label className="text-xs text-gray-500 uppercase">Action</label>
                                    <p className="text-sm">{selectedLog.action}</p>
                                </div>
                                <div>
                                    <label className="text-xs text-gray-500 uppercase">Resource Type</label>
                                    <p className="text-sm">{selectedLog.resource_type}</p>
                                </div>
                                <div>
                                    <label className="text-xs text-gray-500 uppercase">Model</label>
                                    <p className="text-sm">{selectedLog.model_used || '-'}</p>
                                </div>
                                <div>
                                    <label className="text-xs text-gray-500 uppercase">Tokens</label>
                                    <p className="text-sm">{selectedLog.tokens_used.toLocaleString()}</p>
                                </div>
                                <div>
                                    <label className="text-xs text-gray-500 uppercase">Cost</label>
                                    <p className="text-sm">${selectedLog.cost_usd.toFixed(4)}</p>
                                </div>
                                <div>
                                    <label className="text-xs text-gray-500 uppercase">Risk Level</label>
                                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs border ${RISK_COLORS[selectedLog.risk_level]}`}>
                                        <RiskIcon level={selectedLog.risk_level} />
                                        {selectedLog.risk_level}
                                    </span>
                                </div>
                            </div>

                            {selectedLog.request_summary && (
                                <div>
                                    <label className="text-xs text-gray-500 uppercase">Request Summary</label>
                                    <p className="text-sm bg-gray-50 dark:bg-gray-700 p-3 rounded-lg mt-1">
                                        {selectedLog.request_summary}
                                    </p>
                                </div>
                            )}

                            {selectedLog.response_summary && (
                                <div>
                                    <label className="text-xs text-gray-500 uppercase">Response Summary</label>
                                    <p className="text-sm bg-gray-50 dark:bg-gray-700 p-3 rounded-lg mt-1">
                                        {selectedLog.response_summary}
                                    </p>
                                </div>
                            )}

                            {selectedLog.ip_address && (
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs text-gray-500 uppercase">IP Address</label>
                                        <p className="font-mono text-sm">{selectedLog.ip_address}</p>
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-500 uppercase">User Agent</label>
                                        <p className="text-sm truncate">{selectedLog.user_agent}</p>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end">
                            <Button variant="outline" onClick={() => setSelectedLog(null)}>
                                Zamknij
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default AuditLogViewer;

