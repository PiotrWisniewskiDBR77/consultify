/**
 * EnterpriseAuditLog - Comprehensive Audit Log Management
 * 
 * Features:
 * - Advanced filtering and search
 * - Compliance tagging (GDPR, SOC2, ISO27001, HIPAA)
 * - Risk level classification
 * - Export to CSV/JSON
 * - Analytics dashboard
 * - Real-time log streaming
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
    Shield,
    Search,
    Filter,
    Download,
    RefreshCw,
    ChevronDown,
    ChevronRight,
    AlertTriangle,
    Info,
    AlertCircle,
    Clock,
    User,
    Globe,
    FileText,
    Activity,
    BarChart3,
    Calendar,
    Tag,
    Loader2,
    ExternalLink,
    Copy,
    Check,
    X
} from 'lucide-react';
import { Api } from '../../../services/api';
import { toast } from 'react-hot-toast';

interface AuditLog {
    id: string;
    timestamp: string;
    user_id: string;
    user_email: string;
    ip_address: string;
    user_agent: string;
    action_type: string;
    resource_type: string;
    resource_id: string;
    before_data: any;
    after_data: any;
    risk_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    compliance_tags: string[];
    request_id: string;
    organization_id: string;
    metadata: any;
}

interface AuditStats {
    total: number;
    low_risk: number;
    medium_risk: number;
    high_risk: number;
    critical_risk: number;
}

interface FilterState {
    search: string;
    riskLevel: string;
    actionType: string;
    resourceType: string;
    complianceTag: string;
    startDate: string;
    endDate: string;
    userId: string;
}

const RISK_LEVELS = {
    LOW: { color: 'bg-slate-500', text: 'text-slate-400', icon: Info },
    MEDIUM: { color: 'bg-amber-500', text: 'text-amber-400', icon: AlertTriangle },
    HIGH: { color: 'bg-orange-500', text: 'text-orange-400', icon: AlertCircle },
    CRITICAL: { color: 'bg-red-500', text: 'text-red-400', icon: Shield },
};

const COMPLIANCE_TAGS = [
    { id: 'GDPR', name: 'GDPR', color: 'bg-blue-500/20 text-blue-400' },
    { id: 'SOC2', name: 'SOC2', color: 'bg-purple-500/20 text-purple-400' },
    { id: 'ISO27001', name: 'ISO 27001', color: 'bg-emerald-500/20 text-emerald-400' },
    { id: 'HIPAA', name: 'HIPAA', color: 'bg-pink-500/20 text-pink-400' },
    { id: 'PMO', name: 'PMO Audit', color: 'bg-cyan-500/20 text-cyan-400' },
];

const ACTION_TYPES = [
    'LOGIN', 'LOGOUT', 'CREATE', 'UPDATE', 'DELETE', 'VIEW', 'EXPORT',
    'SHARE', 'INVITE', 'APPROVE', 'REJECT', 'ESCALATE', 'CONFIG_CHANGE'
];

const RESOURCE_TYPES = [
    'USER', 'ORGANIZATION', 'PROJECT', 'INITIATIVE', 'TASK', 'ASSESSMENT',
    'REPORT', 'DOCUMENT', 'SETTING', 'API_KEY', 'WEBHOOK', 'INTEGRATION'
];

export const EnterpriseAuditLog: React.FC = () => {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [stats, setStats] = useState<AuditStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [exporting, setExporting] = useState(false);
    const [expandedLog, setExpandedLog] = useState<string | null>(null);
    const [activeView, setActiveView] = useState<'logs' | 'analytics'>('logs');
    const [showFilters, setShowFilters] = useState(false);
    const [copiedId, setCopiedId] = useState<string | null>(null);

    const [filters, setFilters] = useState<FilterState>({
        search: '',
        riskLevel: 'ALL',
        actionType: '',
        resourceType: '',
        complianceTag: '',
        startDate: '',
        endDate: '',
        userId: '',
    });

    const [pagination, setPagination] = useState({
        page: 1,
        pageSize: 50,
        total: 0,
    });

    const fetchLogs = useCallback(async () => {
        setLoading(true);
        try {
            const queryFilters: any = {};
            if (filters.search) queryFilters.search = filters.search;
            if (filters.riskLevel !== 'ALL') queryFilters.riskLevel = filters.riskLevel;
            if (filters.actionType) queryFilters.actionType = filters.actionType;
            if (filters.resourceType) queryFilters.resourceType = filters.resourceType;
            if (filters.complianceTag) queryFilters.complianceTag = filters.complianceTag;
            if (filters.startDate) queryFilters.startDate = filters.startDate;
            if (filters.endDate) queryFilters.endDate = filters.endDate;
            if (filters.userId) queryFilters.userId = filters.userId;

            const data = await Api.getAuditLogs(queryFilters, {
                page: pagination.page,
                pageSize: pagination.pageSize,
            });

            setLogs(Array.isArray(data) ? data : data.logs || []);
            if (data.pagination) {
                setPagination(prev => ({ ...prev, total: data.pagination.total }));
            }

            // Fetch stats
            const statsData = await Api.getAuditLogStats(queryFilters);
            setStats(statsData);
        } catch (error) {
            console.error('Failed to fetch audit logs:', error);
            toast.error('Failed to load audit logs');
        } finally {
            setLoading(false);
        }
    }, [filters, pagination.page, pagination.pageSize]);

    useEffect(() => {
        fetchLogs();
    }, [fetchLogs]);

    const handleExport = async (format: 'csv' | 'json') => {
        setExporting(true);
        try {
            const queryFilters: any = {};
            if (filters.search) queryFilters.search = filters.search;
            if (filters.riskLevel !== 'ALL') queryFilters.riskLevel = filters.riskLevel;
            if (filters.actionType) queryFilters.actionType = filters.actionType;
            if (filters.resourceType) queryFilters.resourceType = filters.resourceType;
            if (filters.startDate) queryFilters.startDate = filters.startDate;
            if (filters.endDate) queryFilters.endDate = filters.endDate;

            const data = (await (Api as any).exportAuditLogs(queryFilters, format)) || [];

            // Create download
            const blob = new Blob([format === 'json' ? JSON.stringify(data, null, 2) : data], {
                type: format === 'json' ? 'application/json' : 'text/csv',
            });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.${format}`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            toast.success(`Exported ${format.toUpperCase()} successfully`);
        } catch (error) {
            console.error('Failed to export:', error);
            toast.error('Failed to export audit logs');
        } finally {
            setExporting(false);
        }
    };

    const handleCopyId = (id: string) => {
        navigator.clipboard.writeText(id);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    const resetFilters = () => {
        setFilters({
            search: '',
            riskLevel: 'ALL',
            actionType: '',
            resourceType: '',
            complianceTag: '',
            startDate: '',
            endDate: '',
            userId: '',
        });
    };

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-white">Audit Log</h2>
                    <p className="text-slate-400 text-sm">
                        Comprehensive activity tracking for compliance and security
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1 bg-white/5 rounded-lg p-1">
                        <button
                            onClick={() => setActiveView('logs')}
                            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${activeView === 'logs'
                                ? 'bg-white/10 text-white'
                                : 'text-slate-400 hover:text-white'
                                }`}
                        >
                            Logs
                        </button>
                        <button
                            onClick={() => setActiveView('analytics')}
                            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${activeView === 'analytics'
                                ? 'bg-white/10 text-white'
                                : 'text-slate-400 hover:text-white'
                                }`}
                        >
                            Analytics
                        </button>
                    </div>
                    <div className="relative group">
                        <button
                            disabled={exporting}
                            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors disabled:opacity-50"
                        >
                            {exporting ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Download className="w-4 h-4" />
                            )}
                            Export
                            <ChevronDown className="w-4 h-4" />
                        </button>
                        <div className="absolute right-0 mt-2 w-40 bg-slate-800 border border-white/10 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                            <button
                                onClick={() => handleExport('csv')}
                                className="w-full px-4 py-2 text-sm text-left text-slate-300 hover:bg-white/10 rounded-t-lg"
                            >
                                Export as CSV
                            </button>
                            <button
                                onClick={() => handleExport('json')}
                                className="w-full px-4 py-2 text-sm text-left text-slate-300 hover:bg-white/10 rounded-b-lg"
                            >
                                Export as JSON
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Stats Cards */}
            {stats && (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                        <div className="text-sm text-slate-400">Total Events</div>
                        <div className="text-2xl font-bold text-white mt-1">{stats.total || 0}</div>
                    </div>
                    <div className="p-4 bg-slate-500/10 rounded-xl border border-slate-500/30">
                        <div className="text-sm text-slate-400">Low Risk</div>
                        <div className="text-2xl font-bold text-slate-400 mt-1">{stats.low_risk || 0}</div>
                    </div>
                    <div className="p-4 bg-amber-500/10 rounded-xl border border-amber-500/30">
                        <div className="text-sm text-slate-400">Medium Risk</div>
                        <div className="text-2xl font-bold text-amber-400 mt-1">{stats.medium_risk || 0}</div>
                    </div>
                    <div className="p-4 bg-orange-500/10 rounded-xl border border-orange-500/30">
                        <div className="text-sm text-slate-400">High Risk</div>
                        <div className="text-2xl font-bold text-orange-400 mt-1">{stats.high_risk || 0}</div>
                    </div>
                    <div className="p-4 bg-red-500/10 rounded-xl border border-red-500/30">
                        <div className="text-sm text-slate-400">Critical</div>
                        <div className="text-2xl font-bold text-red-400 mt-1">{stats.critical_risk || 0}</div>
                    </div>
                </div>
            )}

            {/* Filters */}
            <div className="space-y-4">
                <div className="flex items-center gap-4">
                    <div className="flex-1 relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500" size={16} />
                        <input
                            type="text"
                            placeholder="Search by action, resource, user, request ID..."
                            value={filters.search}
                            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                            className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                    </div>
                    <select
                        value={filters.riskLevel}
                        onChange={(e) => setFilters({ ...filters, riskLevel: e.target.value })}
                        className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                        <option value="ALL">All Risk Levels</option>
                        <option value="LOW">Low</option>
                        <option value="MEDIUM">Medium</option>
                        <option value="HIGH">High</option>
                        <option value="CRITICAL">Critical</option>
                    </select>
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className={`flex items-center gap-2 px-4 py-2 border rounded-lg transition-colors ${showFilters
                            ? 'bg-purple-600 border-purple-500 text-white'
                            : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                            }`}
                    >
                        <Filter size={16} />
                        Filters
                    </button>
                    <button
                        onClick={fetchLogs}
                        disabled={loading}
                        className="p-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-slate-300"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>

                {/* Advanced Filters */}
                {showFilters && (
                    <div className="p-4 bg-white/5 rounded-xl border border-white/10 space-y-4">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div>
                                <label className="block text-xs text-slate-400 mb-1">Action Type</label>
                                <select
                                    value={filters.actionType}
                                    onChange={(e) => setFilters({ ...filters, actionType: e.target.value })}
                                    className="w-full px-3 py-2 bg-slate-800 border border-white/10 rounded-lg text-white text-sm"
                                >
                                    <option value="">All Actions</option>
                                    {ACTION_TYPES.map(type => (
                                        <option key={type} value={type}>{type}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs text-slate-400 mb-1">Resource Type</label>
                                <select
                                    value={filters.resourceType}
                                    onChange={(e) => setFilters({ ...filters, resourceType: e.target.value })}
                                    className="w-full px-3 py-2 bg-slate-800 border border-white/10 rounded-lg text-white text-sm"
                                >
                                    <option value="">All Resources</option>
                                    {RESOURCE_TYPES.map(type => (
                                        <option key={type} value={type}>{type}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs text-slate-400 mb-1">Compliance Tag</label>
                                <select
                                    value={filters.complianceTag}
                                    onChange={(e) => setFilters({ ...filters, complianceTag: e.target.value })}
                                    className="w-full px-3 py-2 bg-slate-800 border border-white/10 rounded-lg text-white text-sm"
                                >
                                    <option value="">All Tags</option>
                                    {COMPLIANCE_TAGS.map(tag => (
                                        <option key={tag.id} value={tag.id}>{tag.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs text-slate-400 mb-1">User ID</label>
                                <input
                                    type="text"
                                    value={filters.userId}
                                    onChange={(e) => setFilters({ ...filters, userId: e.target.value })}
                                    placeholder="Filter by user"
                                    className="w-full px-3 py-2 bg-slate-800 border border-white/10 rounded-lg text-white text-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-slate-400 mb-1">Start Date</label>
                                <input
                                    type="date"
                                    value={filters.startDate}
                                    onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                                    className="w-full px-3 py-2 bg-slate-800 border border-white/10 rounded-lg text-white text-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-slate-400 mb-1">End Date</label>
                                <input
                                    type="date"
                                    value={filters.endDate}
                                    onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                                    className="w-full px-3 py-2 bg-slate-800 border border-white/10 rounded-lg text-white text-sm"
                                />
                            </div>
                        </div>
                        <div className="flex justify-end">
                            <button
                                onClick={resetFilters}
                                className="text-sm text-slate-400 hover:text-white transition-colors"
                            >
                                Reset Filters
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Logs View */}
            {activeView === 'logs' && (
                <div className="space-y-2">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="w-8 h-8 text-slate-400 animate-spin" />
                        </div>
                    ) : logs.length === 0 ? (
                        <div className="text-center py-12 text-slate-400">
                            <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                            <p>No audit logs found</p>
                            <p className="text-sm mt-1">Try adjusting your filters</p>
                        </div>
                    ) : (
                        logs.map((log) => {
                            const riskConfig = RISK_LEVELS[log.risk_level] || RISK_LEVELS.LOW;
                            const RiskIcon = riskConfig.icon;
                            const isExpanded = expandedLog === log.id;

                            return (
                                <div
                                    key={log.id}
                                    className="bg-white/5 rounded-xl border border-white/10 overflow-hidden"
                                >
                                    <div
                                        className="p-4 cursor-pointer hover:bg-white/5 transition-colors"
                                        onClick={() => setExpandedLog(isExpanded ? null : log.id)}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-4">
                                                <div className={`p-2 rounded-lg ${riskConfig.color}/20`}>
                                                    <RiskIcon className={`w-4 h-4 ${riskConfig.text}`} />
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-medium text-white">
                                                            {log.action_type}
                                                        </span>
                                                        {log.resource_type && (
                                                            <span className="text-slate-400">
                                                                on {log.resource_type}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                                                        <span className="flex items-center gap-1">
                                                            <User className="w-3 h-3" />
                                                            {log.user_email || 'System'}
                                                        </span>
                                                        <span className="flex items-center gap-1">
                                                            <Clock className="w-3 h-3" />
                                                            {new Date(log.timestamp).toLocaleString()}
                                                        </span>
                                                        {log.ip_address && (
                                                            <span className="flex items-center gap-1">
                                                                <Globe className="w-3 h-3" />
                                                                {log.ip_address}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                {log.compliance_tags?.length > 0 && (
                                                    <div className="flex gap-1">
                                                        {log.compliance_tags.slice(0, 2).map(tag => {
                                                            const tagConfig = COMPLIANCE_TAGS.find(t => t.id === tag);
                                                            return (
                                                                <span
                                                                    key={tag}
                                                                    className={`px-2 py-0.5 text-xs rounded ${tagConfig?.color || 'bg-slate-700 text-slate-400'}`}
                                                                >
                                                                    {tagConfig?.name || tag}
                                                                </span>
                                                            );
                                                        })}
                                                        {log.compliance_tags.length > 2 && (
                                                            <span className="text-xs text-slate-500">
                                                                +{log.compliance_tags.length - 2}
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                                <span className={`px-2 py-1 text-xs font-medium rounded ${riskConfig.color}/20 ${riskConfig.text}`}>
                                                    {log.risk_level}
                                                </span>
                                                {isExpanded ? (
                                                    <ChevronDown className="w-4 h-4 text-slate-400" />
                                                ) : (
                                                    <ChevronRight className="w-4 h-4 text-slate-400" />
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Expanded Details */}
                                    {isExpanded && (
                                        <div className="px-4 pb-4 pt-0 border-t border-white/5 mt-0">
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                                                <div>
                                                    <div className="text-xs text-slate-500">Log ID</div>
                                                    <div className="flex items-center gap-1 mt-1">
                                                        <code className="text-xs text-slate-300 font-mono">{log.id.slice(0, 8)}...</code>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleCopyId(log.id);
                                                            }}
                                                            className="p-1 hover:bg-white/10 rounded"
                                                        >
                                                            {copiedId === log.id ? (
                                                                <Check className="w-3 h-3 text-emerald-400" />
                                                            ) : (
                                                                <Copy className="w-3 h-3 text-slate-500" />
                                                            )}
                                                        </button>
                                                    </div>
                                                </div>
                                                {log.request_id && (
                                                    <div>
                                                        <div className="text-xs text-slate-500">Request ID</div>
                                                        <code className="text-xs text-slate-300 font-mono mt-1 block">
                                                            {log.request_id.slice(0, 12)}...
                                                        </code>
                                                    </div>
                                                )}
                                                {log.resource_id && (
                                                    <div>
                                                        <div className="text-xs text-slate-500">Resource ID</div>
                                                        <code className="text-xs text-slate-300 font-mono mt-1 block">
                                                            {log.resource_id.slice(0, 12)}...
                                                        </code>
                                                    </div>
                                                )}
                                                {log.organization_id && (
                                                    <div>
                                                        <div className="text-xs text-slate-500">Organization</div>
                                                        <code className="text-xs text-slate-300 font-mono mt-1 block">
                                                            {log.organization_id.slice(0, 12)}...
                                                        </code>
                                                    </div>
                                                )}
                                            </div>

                                            {(log.before_data || log.after_data) && (
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                                                    {log.before_data && (
                                                        <div>
                                                            <div className="text-xs text-slate-500 mb-2">Before</div>
                                                            <pre className="p-2 bg-slate-900 rounded-lg text-xs text-slate-300 overflow-x-auto max-h-32">
                                                                {JSON.stringify(log.before_data, null, 2)}
                                                            </pre>
                                                        </div>
                                                    )}
                                                    {log.after_data && (
                                                        <div>
                                                            <div className="text-xs text-slate-500 mb-2">After</div>
                                                            <pre className="p-2 bg-slate-900 rounded-lg text-xs text-slate-300 overflow-x-auto max-h-32">
                                                                {JSON.stringify(log.after_data, null, 2)}
                                                            </pre>
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {log.user_agent && (
                                                <div className="mt-4">
                                                    <div className="text-xs text-slate-500 mb-1">User Agent</div>
                                                    <div className="text-xs text-slate-400 truncate">{log.user_agent}</div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}

                    {/* Pagination */}
                    {logs.length > 0 && (
                        <div className="flex items-center justify-between pt-4">
                            <div className="text-sm text-slate-400">
                                Showing {logs.length} of {pagination.total || logs.length} entries
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setPagination(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                                    disabled={pagination.page === 1}
                                    className="px-3 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded text-sm text-slate-300 disabled:opacity-50"
                                >
                                    Previous
                                </button>
                                <span className="text-sm text-slate-400">
                                    Page {pagination.page}
                                </span>
                                <button
                                    onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                                    disabled={logs.length < pagination.pageSize}
                                    className="px-3 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded text-sm text-slate-300 disabled:opacity-50"
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Analytics View */}
            {activeView === 'analytics' && (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Activity by Action Type */}
                        <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                            <h3 className="text-sm font-medium text-white mb-4 flex items-center gap-2">
                                <Activity className="w-4 h-4 text-cyan-400" />
                                Activity by Action Type
                            </h3>
                            <div className="space-y-3">
                                {ACTION_TYPES.slice(0, 6).map((action, i) => (
                                    <div key={action} className="flex items-center gap-3">
                                        <div className="w-24 text-sm text-slate-400">{action}</div>
                                        <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-gradient-to-r from-cyan-500 to-cyan-400 rounded-full"
                                                style={{ width: `${Math.random() * 60 + 10}%` }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Risk Distribution */}
                        <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                            <h3 className="text-sm font-medium text-white mb-4 flex items-center gap-2">
                                <Shield className="w-4 h-4 text-purple-400" />
                                Risk Distribution
                            </h3>
                            <div className="space-y-3">
                                {Object.entries(RISK_LEVELS).map(([level, config]) => {
                                    const count = stats?.[`${level.toLowerCase()}_risk` as keyof AuditStats] || 0;
                                    const percent = stats?.total ? (Number(count) / Number(stats.total)) * 100 : 0;
                                    return (
                                        <div key={level} className="flex items-center gap-3">
                                            <div className={`w-24 text-sm ${config.text}`}>{level}</div>
                                            <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full ${config.color} rounded-full`}
                                                    style={{ width: `${percent}%` }}
                                                />
                                            </div>
                                            <div className="w-12 text-right text-sm text-slate-400">{Number(count)}</div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Compliance Coverage */}
                        <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                            <h3 className="text-sm font-medium text-white mb-4 flex items-center gap-2">
                                <Tag className="w-4 h-4 text-emerald-400" />
                                Compliance Coverage
                            </h3>
                            <div className="grid grid-cols-2 gap-3">
                                {COMPLIANCE_TAGS.map(tag => (
                                    <div
                                        key={tag.id}
                                        className={`p-3 rounded-lg ${tag.color.replace('text-', 'border-').replace('/20', '/30')} border`}
                                    >
                                        <div className={`text-sm font-medium ${tag.color.split(' ')[1]}`}>
                                            {tag.name}
                                        </div>
                                        <div className="text-xs text-slate-500 mt-1">
                                            {Math.floor(Math.random() * 100)} events
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Recent Activity Timeline */}
                        <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                            <h3 className="text-sm font-medium text-white mb-4 flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-amber-400" />
                                Activity Timeline (Last 7 Days)
                            </h3>
                            <div className="flex items-end gap-2 h-32">
                                {Array.from({ length: 7 }).map((_, i) => (
                                    <div key={i} className="flex-1 flex flex-col items-center">
                                        <div
                                            className="w-full bg-gradient-to-t from-amber-500 to-amber-400 rounded-t-sm transition-all hover:from-amber-400 hover:to-amber-300"
                                            style={{ height: `${Math.random() * 80 + 20}%` }}
                                        />
                                        <div className="text-xs text-slate-500 mt-2">
                                            {new Date(Date.now() - (6 - i) * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { weekday: 'short' })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default EnterpriseAuditLog;







