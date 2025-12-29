/**
 * ComplianceCenterView - Super Admin Compliance Management
 * 
 * Enterprise compliance dashboard:
 * - SOC 2 Type II compliance
 * - GDPR Article 30 records
 * - HIPAA compliance tracking
 * - ISO 27001 controls
 * - Audit management
 * - DSAR handling
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
    FileCheck,
    Shield,
    AlertTriangle,
    CheckCircle2,
    XCircle,
    Clock,
    Building2,
    Users,
    FileText,
    RefreshCw,
    Loader2,
    ChevronRight,
    Download,
    Plus,
    Search,
    Filter,
    Calendar,
    Target,
    TrendingUp,
    AlertCircle,
    Eye,
    Edit,
    BarChart3,
    PieChart
} from 'lucide-react';
import { Api } from '../../services/api';
import { InfoButton } from '../../components/shared/InfoButton';

interface ComplianceFramework {
    id: string;
    name: string;
    displayName: string;
    description: string;
    version: string;
    requirements: {
        id: string;
        category: string;
        title: string;
        description: string;
    }[];
}

interface ComplianceStatus {
    frameworkId: string;
    frameworkName: string;
    total: number;
    compliant: number;
    inProgress: number;
    pending: number;
    nonCompliant: number;
    score: number;
}

interface DSAR {
    id: string;
    requesterEmail: string;
    requestType: string;
    status: string;
    receivedAt: string;
    dueDate: string;
    assignedTo?: string;
}

interface Audit {
    id: string;
    name: string;
    frameworkId: string;
    auditType: string;
    status: string;
    plannedStart: string;
    plannedEnd: string;
    findingsCount: number;
}

type TabType = 'overview' | 'frameworks' | 'dsar' | 'audits' | 'records';

const STATUS_COLORS = {
    compliant: 'bg-emerald-500',
    in_progress: 'bg-blue-500',
    pending: 'bg-slate-400',
    non_compliant: 'bg-red-500',
    not_applicable: 'bg-slate-300',
};

const DSAR_TYPE_LABELS = {
    access: 'Data Access',
    rectification: 'Rectification',
    erasure: 'Erasure',
    restriction: 'Restriction',
    portability: 'Data Portability',
    objection: 'Objection',
};

export const ComplianceCenterView: React.FC = () => {
    const [activeTab, setActiveTab] = useState<TabType>('overview');
    const [loading, setLoading] = useState(true);
    const [frameworks, setFrameworks] = useState<ComplianceFramework[]>([]);
    const [complianceStatus, setComplianceStatus] = useState<ComplianceStatus[]>([]);
    const [dsarRequests, setDsarRequests] = useState<DSAR[]>([]);
    const [audits, setAudits] = useState<Audit[]>([]);
    const [selectedFramework, setSelectedFramework] = useState<string | null>(null);
    const [selectedOrg, setSelectedOrg] = useState<string>('all');
    const [organizations, setOrganizations] = useState<{ id: string; name: string }[]>([]);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [frameworksResult, orgsResult] = await Promise.all([
                Api.get('/api/superadmin/compliance/frameworks'),
                Api.getOrganizations(),
            ]);
            setFrameworks(frameworksResult.frameworks || []);
            setOrganizations(orgsResult);

            // Fetch compliance status for each framework
            const statusPromises = (frameworksResult.frameworks || []).map(async (fw: ComplianceFramework) => {
                try {
                    const result = await Api.get(`/api/superadmin/compliance/status/${fw.id}${selectedOrg !== 'all' ? `?orgId=${selectedOrg}` : ''}`);
                    return result.status;
                } catch {
                    return {
                        frameworkId: fw.id,
                        frameworkName: fw.displayName,
                        total: fw.requirements.length,
                        compliant: 0,
                        inProgress: 0,
                        pending: fw.requirements.length,
                        nonCompliant: 0,
                        score: 0,
                    };
                }
            });
            const statusResults = await Promise.all(statusPromises);
            setComplianceStatus(statusResults);

            // Fetch DSARs
            const dsarResult = await Api.get('/api/superadmin/compliance/dsar');
            setDsarRequests(dsarResult.requests || []);

            // Fetch audits
            const auditsResult = await Api.get('/api/superadmin/compliance/audits');
            setAudits(auditsResult.audits || []);
        } catch (error) {
            console.error('Failed to fetch compliance data:', error);
        } finally {
            setLoading(false);
        }
    }, [selectedOrg]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const overallScore = complianceStatus.length > 0
        ? Math.round(complianceStatus.reduce((sum, s) => sum + s.score, 0) / complianceStatus.length)
        : 0;

    const pendingDsars = dsarRequests.filter(d => d.status === 'pending' || d.status === 'in_progress').length;
    const overdueDoars = dsarRequests.filter(d => new Date(d.dueDate) < new Date() && d.status !== 'completed').length;
    const activeAudits = audits.filter(a => a.status === 'in_progress').length;

    const renderOverviewTab = () => (
        <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-navy-800 rounded-xl p-5 border border-slate-200 dark:border-white/10">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-sm text-slate-500">Overall Compliance</span>
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                            overallScore >= 80 ? 'bg-emerald-500/10' :
                            overallScore >= 50 ? 'bg-amber-500/10' : 'bg-red-500/10'
                        }`}>
                            <Target className={
                                overallScore >= 80 ? 'text-emerald-500' :
                                overallScore >= 50 ? 'text-amber-500' : 'text-red-500'
                            } size={20} />
                        </div>
                    </div>
                    <div className="text-3xl font-bold text-slate-900 dark:text-white">{overallScore}%</div>
                    <div className="mt-2 h-2 bg-slate-100 dark:bg-navy-700 rounded-full overflow-hidden">
                        <div 
                            className={`h-full transition-all ${
                                overallScore >= 80 ? 'bg-emerald-500' :
                                overallScore >= 50 ? 'bg-amber-500' : 'bg-red-500'
                            }`}
                            style={{ width: `${overallScore}%` }}
                        />
                    </div>
                </div>

                <div className="bg-white dark:bg-navy-800 rounded-xl p-5 border border-slate-200 dark:border-white/10">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-sm text-slate-500">Pending DSARs</span>
                        <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                            <Users className="text-blue-500" size={20} />
                        </div>
                    </div>
                    <div className="text-3xl font-bold text-slate-900 dark:text-white">{pendingDsars}</div>
                    {overdueDoars > 0 && (
                        <div className="mt-1 text-sm text-red-500 flex items-center gap-1">
                            <AlertCircle size={14} />
                            {overdueDoars} overdue
                        </div>
                    )}
                </div>

                <div className="bg-white dark:bg-navy-800 rounded-xl p-5 border border-slate-200 dark:border-white/10">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-sm text-slate-500">Active Audits</span>
                        <div className="w-10 h-10 rounded-lg bg-violet-500/10 flex items-center justify-center">
                            <FileCheck className="text-violet-500" size={20} />
                        </div>
                    </div>
                    <div className="text-3xl font-bold text-slate-900 dark:text-white">{activeAudits}</div>
                    <div className="mt-1 text-sm text-slate-500">{audits.length} total</div>
                </div>

                <div className="bg-white dark:bg-navy-800 rounded-xl p-5 border border-slate-200 dark:border-white/10">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-sm text-slate-500">Frameworks</span>
                        <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                            <Shield className="text-emerald-500" size={20} />
                        </div>
                    </div>
                    <div className="text-3xl font-bold text-slate-900 dark:text-white">{frameworks.length}</div>
                    <div className="mt-1 text-sm text-slate-500">Active</div>
                </div>
            </div>

            {/* Framework Status */}
            <div className="bg-white dark:bg-navy-800 rounded-xl p-6 border border-slate-200 dark:border-white/10">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-6">Compliance by Framework</h3>
                <div className="space-y-4">
                    {complianceStatus.map((status) => (
                        <div key={status.frameworkId} className="p-4 bg-slate-50 dark:bg-navy-900 rounded-xl">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white font-bold">
                                        {status.frameworkName.charAt(0)}
                                    </div>
                                    <div>
                                        <h4 className="font-medium text-slate-900 dark:text-white">{status.frameworkName}</h4>
                                        <p className="text-sm text-slate-500">{status.total} controls</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className={`text-2xl font-bold ${
                                        status.score >= 80 ? 'text-emerald-600' :
                                        status.score >= 50 ? 'text-amber-600' : 'text-red-600'
                                    }`}>
                                        {status.score}%
                                    </div>
                                    <button
                                        onClick={() => { setSelectedFramework(status.frameworkId); setActiveTab('frameworks'); }}
                                        className="text-sm text-violet-600 hover:text-violet-700 flex items-center gap-1"
                                    >
                                        View Details <ChevronRight size={14} />
                                    </button>
                                </div>
                            </div>
                            <div className="flex gap-1 h-2">
                                <div className="bg-emerald-500 rounded-l" style={{ width: `${(status.compliant / status.total) * 100}%` }} />
                                <div className="bg-blue-500" style={{ width: `${(status.inProgress / status.total) * 100}%` }} />
                                <div className="bg-slate-300" style={{ width: `${(status.pending / status.total) * 100}%` }} />
                                <div className="bg-red-500 rounded-r" style={{ width: `${(status.nonCompliant / status.total) * 100}%` }} />
                            </div>
                            <div className="flex justify-between mt-2 text-xs text-slate-500">
                                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> {status.compliant} Compliant</span>
                                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" /> {status.inProgress} In Progress</span>
                                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-300" /> {status.pending} Pending</span>
                                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" /> {status.nonCompliant} Non-Compliant</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Recent DSARs */}
            <div className="bg-white dark:bg-navy-800 rounded-xl p-6 border border-slate-200 dark:border-white/10">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Recent Data Subject Requests</h3>
                    <button
                        onClick={() => setActiveTab('dsar')}
                        className="text-sm text-violet-600 hover:text-violet-700 flex items-center gap-1"
                    >
                        View All <ChevronRight size={14} />
                    </button>
                </div>
                <div className="space-y-3">
                    {dsarRequests.slice(0, 5).map((dsar) => (
                        <div key={dsar.id} className="flex items-center justify-between py-3 border-b border-slate-100 dark:border-white/5 last:border-0">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center">
                                    <Users size={16} className="text-blue-500" />
                                </div>
                                <div>
                                    <div className="font-medium text-slate-900 dark:text-white">{dsar.requesterEmail}</div>
                                    <div className="text-sm text-slate-500">
                                        {DSAR_TYPE_LABELS[dsar.requestType as keyof typeof DSAR_TYPE_LABELS] || dsar.requestType}
                                    </div>
                                </div>
                            </div>
                            <div className="text-right">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                    dsar.status === 'completed' ? 'bg-emerald-500/10 text-emerald-600' :
                                    dsar.status === 'in_progress' ? 'bg-blue-500/10 text-blue-600' :
                                    dsar.status === 'pending' ? 'bg-amber-500/10 text-amber-600' :
                                    'bg-red-500/10 text-red-600'
                                }`}>
                                    {dsar.status.replace('_', ' ')}
                                </span>
                                <div className="text-xs text-slate-500 mt-1">
                                    Due: {new Date(dsar.dueDate).toLocaleDateString()}
                                </div>
                            </div>
                        </div>
                    ))}
                    {dsarRequests.length === 0 && (
                        <div className="text-center py-8 text-slate-500">
                            <Users size={32} className="mx-auto mb-2 opacity-30" />
                            <p>No data subject requests</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );

    const renderFrameworksTab = () => {
        const framework = selectedFramework 
            ? frameworks.find(f => f.id === selectedFramework)
            : null;

        if (framework) {
            return (
                <div className="space-y-6">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setSelectedFramework(null)}
                            className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg"
                        >
                            <ChevronRight size={20} className="rotate-180 text-slate-400" />
                        </button>
                        <div>
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white">{framework.displayName}</h2>
                            <p className="text-slate-500">{framework.description} - Version {framework.version}</p>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-white/10 overflow-hidden">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-slate-200 dark:border-white/10">
                                    <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase">ID</th>
                                    <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Control</th>
                                    <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Category</th>
                                    <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Status</th>
                                    <th className="text-right px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 dark:divide-white/10">
                                {framework.requirements.map((req) => (
                                    <tr key={req.id} className="hover:bg-slate-50 dark:hover:bg-white/5">
                                        <td className="px-6 py-4">
                                            <span className="font-mono text-sm text-slate-700 dark:text-slate-300">{req.id}</span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="font-medium text-slate-900 dark:text-white">{req.title}</div>
                                            <div className="text-sm text-slate-500">{req.description}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-slate-100 dark:bg-navy-700 text-slate-600 dark:text-slate-400">
                                                {req.category}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-500/10 text-slate-600">
                                                <Clock size={12} />
                                                Pending
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg">
                                                <Edit size={16} className="text-slate-400" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            );
        }

        return (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {frameworks.map((fw) => {
                    const status = complianceStatus.find(s => s.frameworkId === fw.id);
                    return (
                        <button
                            key={fw.id}
                            onClick={() => setSelectedFramework(fw.id)}
                            className="p-6 bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-white/10 text-left hover:border-violet-300 dark:hover:border-violet-500/30 transition-all"
                        >
                            <div className="flex items-start justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white font-bold text-xl">
                                        {fw.name.charAt(0)}
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-slate-900 dark:text-white">{fw.displayName}</h3>
                                        <p className="text-sm text-slate-500">Version {fw.version}</p>
                                    </div>
                                </div>
                                <ChevronRight size={20} className="text-slate-400" />
                            </div>
                            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">{fw.description}</p>
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-slate-500">{fw.requirements.length} controls</span>
                                {status && (
                                    <span className={`text-lg font-bold ${
                                        status.score >= 80 ? 'text-emerald-600' :
                                        status.score >= 50 ? 'text-amber-600' : 'text-red-600'
                                    }`}>
                                        {status.score}%
                                    </span>
                                )}
                            </div>
                        </button>
                    );
                })}
            </div>
        );
    };

    const renderDsarTab = () => (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                        type="text"
                        placeholder="Search requests..."
                        className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-navy-800 border border-slate-200 dark:border-white/10 rounded-lg"
                    />
                </div>
                <button className="px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg font-medium flex items-center gap-2">
                    <Plus size={18} />
                    New Request
                </button>
            </div>

            <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-white/10 overflow-hidden">
                <table className="w-full">
                    <thead>
                        <tr className="border-b border-slate-200 dark:border-white/10">
                            <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Requester</th>
                            <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Type</th>
                            <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Status</th>
                            <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Received</th>
                            <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Due Date</th>
                            <th className="text-right px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-white/10">
                        {dsarRequests.map((dsar) => (
                            <tr key={dsar.id} className="hover:bg-slate-50 dark:hover:bg-white/5">
                                <td className="px-6 py-4">
                                    <span className="font-medium text-slate-900 dark:text-white">{dsar.requesterEmail}</span>
                                </td>
                                <td className="px-6 py-4">
                                    <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-500/10 text-blue-600">
                                        {DSAR_TYPE_LABELS[dsar.requestType as keyof typeof DSAR_TYPE_LABELS] || dsar.requestType}
                                    </span>
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                        dsar.status === 'completed' ? 'bg-emerald-500/10 text-emerald-600' :
                                        dsar.status === 'in_progress' ? 'bg-blue-500/10 text-blue-600' :
                                        dsar.status === 'pending' ? 'bg-amber-500/10 text-amber-600' :
                                        'bg-red-500/10 text-red-600'
                                    }`}>
                                        {dsar.status.replace('_', ' ')}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-sm text-slate-500">
                                    {new Date(dsar.receivedAt).toLocaleDateString()}
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`text-sm ${
                                        new Date(dsar.dueDate) < new Date() && dsar.status !== 'completed'
                                            ? 'text-red-600 font-medium'
                                            : 'text-slate-500'
                                    }`}>
                                        {new Date(dsar.dueDate).toLocaleDateString()}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <button className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg">
                                        <Eye size={16} className="text-slate-400" />
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {dsarRequests.length === 0 && (
                            <tr>
                                <td colSpan={6} className="px-6 py-12 text-center">
                                    <Users size={40} className="mx-auto mb-3 text-slate-300" />
                                    <p className="text-slate-500 font-medium">No data subject requests</p>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );

    const renderAuditsTab = () => (
        <div className="space-y-6">
            <div className="flex items-center justify-end">
                <button className="px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg font-medium flex items-center gap-2">
                    <Plus size={18} />
                    Schedule Audit
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {audits.map((audit) => (
                    <div key={audit.id} className="bg-white dark:bg-navy-800 rounded-xl p-6 border border-slate-200 dark:border-white/10">
                        <div className="flex items-start justify-between mb-4">
                            <div>
                                <h4 className="font-semibold text-slate-900 dark:text-white">{audit.name}</h4>
                                <p className="text-sm text-slate-500">{audit.auditType} audit</p>
                            </div>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                audit.status === 'completed' ? 'bg-emerald-500/10 text-emerald-600' :
                                audit.status === 'in_progress' ? 'bg-blue-500/10 text-blue-600' :
                                'bg-slate-500/10 text-slate-600'
                            }`}>
                                {audit.status.replace('_', ' ')}
                            </span>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-slate-500 mb-4">
                            <span className="flex items-center gap-1">
                                <Calendar size={14} />
                                {new Date(audit.plannedStart).toLocaleDateString()} - {new Date(audit.plannedEnd).toLocaleDateString()}
                            </span>
                        </div>
                        {audit.findingsCount > 0 && (
                            <div className="p-3 bg-red-50 dark:bg-red-500/10 rounded-lg flex items-center gap-2">
                                <AlertTriangle size={16} className="text-red-500" />
                                <span className="text-sm text-red-700 dark:text-red-400">
                                    {audit.findingsCount} findings
                                </span>
                            </div>
                        )}
                    </div>
                ))}
                {audits.length === 0 && (
                    <div className="col-span-2 text-center py-12 bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-white/10">
                        <FileCheck size={40} className="mx-auto mb-3 text-slate-300" />
                        <p className="text-slate-500 font-medium">No audits scheduled</p>
                        <p className="text-sm text-slate-400">Schedule your first compliance audit</p>
                    </div>
                )}
            </div>
        </div>
    );

    const renderRecordsTab = () => (
        <div className="space-y-6">
            <div className="bg-blue-50 dark:bg-blue-500/10 rounded-xl p-4 border border-blue-200 dark:border-blue-500/20">
                <div className="flex items-start gap-3">
                    <FileText size={20} className="text-blue-600 dark:text-blue-400 mt-0.5" />
                    <div>
                        <h4 className="font-medium text-blue-900 dark:text-blue-300">GDPR Article 30 - Records of Processing Activities</h4>
                        <p className="text-sm text-blue-800 dark:text-blue-400 mt-1">
                            Document all data processing activities as required by GDPR Article 30.
                        </p>
                    </div>
                </div>
            </div>

            <div className="flex justify-end">
                <button className="px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg font-medium flex items-center gap-2">
                    <Plus size={18} />
                    Add Processing Record
                </button>
            </div>

            <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-white/10 overflow-hidden">
                <div className="p-12 text-center">
                    <FileText size={40} className="mx-auto mb-3 text-slate-300" />
                    <p className="text-slate-500 font-medium">No processing records</p>
                    <p className="text-sm text-slate-400">Document your data processing activities</p>
                </div>
            </div>
        </div>
    );

    return (
        <div className="space-y-6 relative">
            <InfoButton cardId="superadmin-compliance" position="top-right" />
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Compliance Center</h1>
                    <p className="text-slate-500 mt-1">Manage regulatory compliance and audits</p>
                </div>
                <div className="flex items-center gap-3">
                    <select
                        value={selectedOrg}
                        onChange={(e) => setSelectedOrg(e.target.value)}
                        className="px-4 py-2 bg-white dark:bg-navy-800 border border-slate-200 dark:border-white/10 rounded-lg text-slate-900 dark:text-white"
                    >
                        <option value="all">All Organizations</option>
                        {organizations.map((org) => (
                            <option key={org.id} value={org.id}>{org.name}</option>
                        ))}
                    </select>
                    <button
                        onClick={fetchData}
                        className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg"
                    >
                        <RefreshCw size={18} className={`text-slate-400 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                    <button className="px-4 py-2 border border-slate-200 dark:border-white/10 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 flex items-center gap-2">
                        <Download size={16} />
                        Export Report
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-navy-900 p-1 rounded-lg w-fit">
                {[
                    { id: 'overview', label: 'Overview', icon: <PieChart size={16} /> },
                    { id: 'frameworks', label: 'Frameworks', icon: <Shield size={16} /> },
                    { id: 'dsar', label: 'DSAR', icon: <Users size={16} /> },
                    { id: 'audits', label: 'Audits', icon: <FileCheck size={16} /> },
                    { id: 'records', label: 'Processing Records', icon: <FileText size={16} /> },
                ].map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as TabType)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                            activeTab === tab.id
                                ? 'bg-white dark:bg-navy-800 text-violet-600 dark:text-violet-400 shadow-sm'
                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                        }`}
                    >
                        {tab.icon}
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <Loader2 size={32} className="animate-spin text-violet-500" />
                </div>
            ) : (
                <>
                    {activeTab === 'overview' && renderOverviewTab()}
                    {activeTab === 'frameworks' && renderFrameworksTab()}
                    {activeTab === 'dsar' && renderDsarTab()}
                    {activeTab === 'audits' && renderAuditsTab()}
                    {activeTab === 'records' && renderRecordsTab()}
                </>
            )}
        </div>
    );
};

export default ComplianceCenterView;

