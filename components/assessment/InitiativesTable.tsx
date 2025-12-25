/**
 * InitiativesTable
 * 
 * Table view for transformation initiatives:
 * - Generated from approved reports
 * - Can be edited, approved, or deleted
 * - Each initiative can be opened for detailed editing
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
    Plus,
    Search,
    Lightbulb,
    Edit,
    Eye,
    Trash2,
    CheckCircle2,
    Clock,
    AlertTriangle,
    MoreVertical,
    RefreshCw,
    Loader2,
    Target,
    TrendingUp,
    DollarSign,
    ArrowRight,
    Sparkles
} from 'lucide-react';

interface Initiative {
    id: string;
    name: string;
    description: string;
    reportId: string;
    reportName: string;
    axis: string;
    status: 'DRAFT' | 'APPROVED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
    priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    estimatedROI: number;
    estimatedBudget: number;
    timeline: string;
    createdAt: string;
    updatedAt: string;
}

type FilterStatus = 'all' | 'draft' | 'approved' | 'in_progress';

type AssessmentFramework = 'DRD' | 'SIRI' | 'ADMA' | 'CMMI' | 'LEAN';

interface InitiativesTableProps {
    projectId: string;
    framework?: AssessmentFramework;
    pendingReportId?: string | null;
}

const STATUS_CONFIG = {
    'DRAFT': { 
        label: 'Draft', 
        color: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
        icon: <Edit size={14} />
    },
    'APPROVED': { 
        label: 'Approved', 
        color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
        icon: <CheckCircle2 size={14} />
    },
    'IN_PROGRESS': { 
        label: 'In Progress', 
        color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
        icon: <Clock size={14} />
    },
    'COMPLETED': { 
        label: 'Completed', 
        color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
        icon: <CheckCircle2 size={14} />
    },
    'CANCELLED': { 
        label: 'Cancelled', 
        color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
        icon: <AlertTriangle size={14} />
    }
};

const PRIORITY_CONFIG = {
    'LOW': 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
    'MEDIUM': 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    'HIGH': 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    'CRITICAL': 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
};

export const InitiativesTable: React.FC<InitiativesTableProps> = ({
    projectId,
    pendingReportId
}) => {
    // State
    const [initiatives, setInitiatives] = useState<Initiative[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
    const [activeRowMenu, setActiveRowMenu] = useState<string | null>(null);
    const [editingInitiative, setEditingInitiative] = useState<Initiative | null>(null);
    const [showGenerateModal, setShowGenerateModal] = useState(!!pendingReportId);

    // Fetch initiatives
    const fetchInitiatives = useCallback(async () => {
        setIsLoading(true);
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`/api/initiatives?projectId=${projectId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                const data = await response.json();
                setInitiatives(data.initiatives || []);
            }
        } catch (err) {
            console.error('[InitiativesTable] Error:', err);
        } finally {
            setIsLoading(false);
        }
    }, [projectId]);

    useEffect(() => {
        if (projectId) {
            fetchInitiatives();
        }
    }, [projectId, fetchInitiatives]);

    // Approve initiative
    const handleApprove = async (initiativeId: string) => {
        try {
            const token = localStorage.getItem('token');
            await fetch(`/api/initiatives/${initiativeId}/approve`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            await fetchInitiatives();
        } catch (err) {
            console.error('[InitiativesTable] Approve error:', err);
        }
    };

    // Delete initiative
    const handleDelete = async (initiativeId: string) => {
        if (!confirm('Are you sure you want to delete this initiative?')) return;
        
        try {
            const token = localStorage.getItem('token');
            await fetch(`/api/initiatives/${initiativeId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            await fetchInitiatives();
        } catch (err) {
            console.error('[InitiativesTable] Delete error:', err);
        }
    };

    // Filter initiatives
    const filteredInitiatives = initiatives.filter(initiative => {
        // Status filter
        if (filterStatus !== 'all') {
            if (filterStatus === 'draft' && initiative.status !== 'DRAFT') return false;
            if (filterStatus === 'approved' && initiative.status !== 'APPROVED') return false;
            if (filterStatus === 'in_progress' && initiative.status !== 'IN_PROGRESS') return false;
        }

        // Search filter
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            return (
                initiative.name.toLowerCase().includes(query) ||
                initiative.description.toLowerCase().includes(query)
            );
        }

        return true;
    });

    // Format currency
    const formatCurrency = (amount: number) => {
        if (amount >= 1000000) {
            return `${(amount / 1000000).toFixed(1)}M PLN`;
        }
        if (amount >= 1000) {
            return `${(amount / 1000).toFixed(0)}k PLN`;
        }
        return `${amount} PLN`;
    };

    // Format date
    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric' 
        });
    };

    // Stats
    const stats = {
        total: initiatives.length,
        draft: initiatives.filter(i => i.status === 'DRAFT').length,
        approved: initiatives.filter(i => i.status === 'APPROVED').length,
        inProgress: initiatives.filter(i => i.status === 'IN_PROGRESS').length
    };

    // Calculate totals
    const totals = initiatives.reduce((acc, i) => ({
        budget: acc.budget + i.estimatedBudget,
        avgROI: acc.avgROI + i.estimatedROI
    }), { budget: 0, avgROI: 0 });

    return (
        <div className="h-full flex flex-col">
            {/* Header */}
            <div className="shrink-0 px-6 py-4 border-b border-slate-200 dark:border-white/10">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-bold text-navy-900 dark:text-white">
                            Initiatives
                        </h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            Transformation initiatives from assessment reports
                        </p>
                    </div>
                    <button
                        onClick={() => setShowGenerateModal(true)}
                        className="flex items-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-medium rounded-lg transition-colors"
                    >
                        <Sparkles size={18} />
                        Generate from Report
                    </button>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-4 gap-4 mt-4">
                    <div className="p-3 bg-slate-50 dark:bg-navy-950 rounded-lg">
                        <p className="text-xs text-slate-500 dark:text-slate-400">Total Initiatives</p>
                        <p className="text-xl font-bold text-navy-900 dark:text-white">{stats.total}</p>
                    </div>
                    <div className="p-3 bg-slate-50 dark:bg-navy-950 rounded-lg">
                        <p className="text-xs text-slate-500 dark:text-slate-400">Total Budget</p>
                        <p className="text-xl font-bold text-navy-900 dark:text-white">{formatCurrency(totals.budget)}</p>
                    </div>
                    <div className="p-3 bg-slate-50 dark:bg-navy-950 rounded-lg">
                        <p className="text-xs text-slate-500 dark:text-slate-400">Avg. ROI</p>
                        <p className="text-xl font-bold text-green-600 dark:text-green-400">
                            {initiatives.length > 0 ? (totals.avgROI / initiatives.length).toFixed(1) : '0'}x
                        </p>
                    </div>
                    <div className="p-3 bg-slate-50 dark:bg-navy-950 rounded-lg">
                        <p className="text-xs text-slate-500 dark:text-slate-400">In Progress</p>
                        <p className="text-xl font-bold text-blue-600 dark:text-blue-400">{stats.inProgress}</p>
                    </div>
                </div>

                {/* Filters */}
                <div className="flex items-center gap-6 mt-4">
                    <button
                        onClick={() => setFilterStatus('all')}
                        className={`text-sm ${filterStatus === 'all' ? 'text-purple-600 dark:text-purple-400 font-medium' : 'text-slate-500'}`}
                    >
                        All ({stats.total})
                    </button>
                    <button
                        onClick={() => setFilterStatus('draft')}
                        className={`text-sm ${filterStatus === 'draft' ? 'text-purple-600 dark:text-purple-400 font-medium' : 'text-slate-500'}`}
                    >
                        Draft ({stats.draft})
                    </button>
                    <button
                        onClick={() => setFilterStatus('approved')}
                        className={`text-sm ${filterStatus === 'approved' ? 'text-purple-600 dark:text-purple-400 font-medium' : 'text-slate-500'}`}
                    >
                        Approved ({stats.approved})
                    </button>
                    <button
                        onClick={() => setFilterStatus('in_progress')}
                        className={`text-sm ${filterStatus === 'in_progress' ? 'text-purple-600 dark:text-purple-400 font-medium' : 'text-slate-500'}`}
                    >
                        In Progress ({stats.inProgress})
                    </button>
                </div>

                {/* Search */}
                <div className="flex items-center gap-3 mt-4">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search initiatives..."
                            className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-navy-950 text-navy-900 dark:text-white"
                        />
                    </div>
                    <button
                        onClick={fetchInitiatives}
                        className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg"
                    >
                        <RefreshCw size={18} />
                    </button>
                </div>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-auto">
                {isLoading ? (
                    <div className="flex items-center justify-center h-64">
                        <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
                    </div>
                ) : filteredInitiatives.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-center">
                        <Lightbulb className="w-12 h-12 text-slate-300 dark:text-slate-600 mb-3" />
                        <p className="text-slate-500 dark:text-slate-400 mb-2">
                            {searchQuery ? 'No initiatives match your search' : 'No initiatives yet'}
                        </p>
                        <p className="text-sm text-slate-400 dark:text-slate-500 mb-4">
                            Generate initiatives from a finalized report
                        </p>
                    </div>
                ) : (
                    <table className="w-full">
                        <thead className="bg-slate-50 dark:bg-navy-950 sticky top-0">
                            <tr>
                                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                    Initiative
                                </th>
                                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                    Status
                                </th>
                                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                    Priority
                                </th>
                                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                    ROI / Budget
                                </th>
                                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                    Timeline
                                </th>
                                <th className="text-right px-6 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-white/10">
                            {filteredInitiatives.map((initiative) => {
                                const statusConfig = STATUS_CONFIG[initiative.status] || STATUS_CONFIG.DRAFT;
                                
                                return (
                                    <tr 
                                        key={initiative.id}
                                        className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                                    >
                                        <td className="px-6 py-4">
                                            <div className="flex items-start gap-3">
                                                <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg shrink-0">
                                                    <Lightbulb className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                                                </div>
                                                <div>
                                                    <p className="font-medium text-navy-900 dark:text-white">
                                                        {initiative.name}
                                                    </p>
                                                    <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-1">
                                                        {initiative.description}
                                                    </p>
                                                    <p className="text-xs text-slate-400 mt-1">
                                                        {initiative.axis} • {initiative.reportName}
                                                    </p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusConfig.color}`}>
                                                {statusConfig.icon}
                                                {statusConfig.label}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${PRIORITY_CONFIG[initiative.priority]}`}>
                                                {initiative.priority}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
                                                    <TrendingUp size={14} />
                                                    <span className="text-sm font-medium">{initiative.estimatedROI}x</span>
                                                </div>
                                                <span className="text-slate-300 dark:text-slate-600">|</span>
                                                <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
                                                    <DollarSign size={14} />
                                                    <span className="text-sm">{formatCurrency(initiative.estimatedBudget)}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400">
                                            {initiative.timeline}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center justify-end gap-2">
                                                {/* Edit */}
                                                <button
                                                    onClick={() => setEditingInitiative(initiative)}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors"
                                                >
                                                    <Edit size={14} />
                                                    Edit
                                                </button>

                                                {/* Approve - only for draft */}
                                                {initiative.status === 'DRAFT' && (
                                                    <button
                                                        onClick={() => handleApprove(initiative.id)}
                                                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors"
                                                    >
                                                        <CheckCircle2 size={14} />
                                                        Approve
                                                    </button>
                                                )}

                                                {/* Delete - only for draft */}
                                                {initiative.status === 'DRAFT' && (
                                                    <button
                                                        onClick={() => handleDelete(initiative.id)}
                                                        className="p-1.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                )}

                                                {/* More menu */}
                                                <div className="relative">
                                                    <button
                                                        onClick={() => setActiveRowMenu(activeRowMenu === initiative.id ? null : initiative.id)}
                                                        className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 rounded"
                                                    >
                                                        <MoreVertical size={16} />
                                                    </button>
                                                    
                                                    {activeRowMenu === initiative.id && (
                                                        <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-navy-900 rounded-lg shadow-lg border border-slate-200 dark:border-white/10 py-1 z-10">
                                                            <button className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5">
                                                                View Details
                                                            </button>
                                                            <button className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5">
                                                                Duplicate
                                                            </button>
                                                            <button className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5">
                                                                Add to Roadmap
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Workflow hint */}
            <div className="shrink-0 px-6 py-3 border-t border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-navy-950">
                <p className="text-xs text-slate-500 dark:text-slate-400 text-center">
                    <span className="font-medium">Actions:</span> Draft → Approve → In Progress → Complete | Approved initiatives go to the Roadmap
                </p>
            </div>
        </div>
    );
};

export default InitiativesTable;

