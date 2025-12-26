/**
 * AssessmentTable
 * 
 * Table view for assessments with status filtering:
 * - Draft (in progress)
 * - In Review
 * - Approved (can create report)
 * - All
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
    Plus,
    Search,
    Filter,
    Edit,
    Eye,
    FileOutput,
    Clock,
    CheckCircle2,
    AlertCircle,
    MoreVertical,
    RefreshCw,
    Loader2,
    ChevronDown,
    Map
} from 'lucide-react';
import { WorkflowState } from '../../types';

interface Assessment {
    id: string;
    name: string;
    projectName: string;
    status: WorkflowState;
    progress: number;
    completedAxes: number;
    totalAxes: number;
    createdAt: string;
    updatedAt: string;
    createdBy: string;
    canCreateReport: boolean;
}

type FilterStatus = 'all' | 'draft' | 'in_review' | 'approved';

interface AssessmentTableProps {
    projectId: string;
    onOpenInMap: (assessmentId: string) => void;
    onNewAssessment: () => void;
    onCreateReport: (assessmentId: string) => void;
}

const STATUS_CONFIG: Record<WorkflowState, { label: string; color: string; icon: React.ReactNode }> = {
    'DRAFT': { 
        label: 'Draft', 
        color: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
        icon: <Edit size={14} />
    },
    'IN_REVIEW': { 
        label: 'In Review', 
        color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
        icon: <Clock size={14} />
    },
    'AWAITING_APPROVAL': { 
        label: 'Awaiting Approval', 
        color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
        icon: <AlertCircle size={14} />
    },
    'APPROVED': { 
        label: 'Approved', 
        color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
        icon: <CheckCircle2 size={14} />
    },
    'REJECTED': { 
        label: 'Rejected', 
        color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
        icon: <AlertCircle size={14} />
    },
    'ARCHIVED': { 
        label: 'Archived', 
        color: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-500',
        icon: <Clock size={14} />
    }
};

export const AssessmentTable: React.FC<AssessmentTableProps> = ({
    projectId,
    onOpenInMap,
    onNewAssessment,
    onCreateReport
}) => {
    // State
    const [assessments, setAssessments] = useState<Assessment[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
    const [showFilterMenu, setShowFilterMenu] = useState(false);
    const [activeRowMenu, setActiveRowMenu] = useState<string | null>(null);

    // Fetch assessments
    const fetchAssessments = useCallback(async () => {
        setIsLoading(true);
        try {
            const token = localStorage.getItem('token');
            // Build URL with optional projectId filter
            const url = projectId 
                ? `/api/assessments?projectId=${projectId}` 
                : '/api/assessments';
            const response = await fetch(url, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                const data = await response.json();
                setAssessments(data.assessments || []);
            }
        } catch (err) {
            console.error('[AssessmentTable] Error:', err);
        } finally {
            setIsLoading(false);
        }
    }, [projectId]);

    useEffect(() => {
        // Always fetch assessments, even without projectId (will return all user's assessments)
        fetchAssessments();
    }, [fetchAssessments]);

    // Filter assessments
    const filteredAssessments = assessments.filter(assessment => {
        // Status filter
        if (filterStatus !== 'all') {
            if (filterStatus === 'draft' && assessment.status !== 'DRAFT') return false;
            if (filterStatus === 'in_review' && !['IN_REVIEW', 'AWAITING_APPROVAL'].includes(assessment.status)) return false;
            if (filterStatus === 'approved' && assessment.status !== 'APPROVED') return false;
        }

        // Search filter
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            return (
                assessment.name.toLowerCase().includes(query) ||
                assessment.projectName.toLowerCase().includes(query)
            );
        }

        return true;
    });

    // Format date
    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric', 
            year: 'numeric' 
        });
    };

    // Stats
    const stats = {
        total: assessments.length,
        draft: assessments.filter(a => a.status === 'DRAFT').length,
        inReview: assessments.filter(a => ['IN_REVIEW', 'AWAITING_APPROVAL'].includes(a.status)).length,
        approved: assessments.filter(a => a.status === 'APPROVED').length
    };

    return (
        <div className="h-full flex flex-col">
            {/* Header */}
            <div className="shrink-0 px-6 py-4 border-b border-slate-200 dark:border-white/10">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-bold text-navy-900 dark:text-white">
                            Assessments
                        </h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            Manage your digital maturity assessments
                        </p>
                    </div>
                    <button
                        onClick={onNewAssessment}
                        className="flex items-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-medium rounded-lg transition-colors"
                    >
                        <Plus size={18} />
                        New Assessment
                    </button>
                </div>

                {/* Stats */}
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
                        onClick={() => setFilterStatus('in_review')}
                        className={`text-sm ${filterStatus === 'in_review' ? 'text-purple-600 dark:text-purple-400 font-medium' : 'text-slate-500'}`}
                    >
                        In Review ({stats.inReview})
                    </button>
                    <button
                        onClick={() => setFilterStatus('approved')}
                        className={`text-sm ${filterStatus === 'approved' ? 'text-purple-600 dark:text-purple-400 font-medium' : 'text-slate-500'}`}
                    >
                        Approved ({stats.approved})
                    </button>
                </div>

                {/* Search & Filter */}
                <div className="flex items-center gap-3 mt-4">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search assessments..."
                            className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-navy-950 text-navy-900 dark:text-white"
                        />
                    </div>
                    <button
                        onClick={fetchAssessments}
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
                ) : filteredAssessments.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-center">
                        <FileOutput className="w-12 h-12 text-slate-300 dark:text-slate-600 mb-3" />
                        <p className="text-slate-500 dark:text-slate-400 mb-4">
                            {searchQuery ? 'No assessments match your search' : 'No assessments yet'}
                        </p>
                        {!searchQuery && (
                            <button
                                onClick={onNewAssessment}
                                className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-medium rounded-lg"
                            >
                                <Plus size={16} />
                                Create First Assessment
                            </button>
                        )}
                    </div>
                ) : (
                    <table className="w-full">
                        <thead className="bg-slate-50 dark:bg-navy-950 sticky top-0">
                            <tr>
                                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                    Assessment
                                </th>
                                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                    Status
                                </th>
                                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                    Progress
                                </th>
                                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                    Updated
                                </th>
                                <th className="text-right px-6 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-white/10">
                            {filteredAssessments.map((assessment) => {
                                const statusConfig = STATUS_CONFIG[assessment.status] || STATUS_CONFIG.DRAFT;
                                
                                return (
                                    <tr 
                                        key={assessment.id}
                                        className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                                    >
                                        <td className="px-6 py-4">
                                            <div>
                                                <p className="font-medium text-navy-900 dark:text-white">
                                                    {assessment.name}
                                                </p>
                                                <p className="text-sm text-slate-500 dark:text-slate-400">
                                                    {assessment.projectName}
                                                </p>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusConfig.color}`}>
                                                {statusConfig.icon}
                                                {statusConfig.label}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="w-32">
                                                <div className="flex items-center justify-between text-xs mb-1">
                                                    <span className="text-slate-500 dark:text-slate-400">
                                                        {assessment.completedAxes}/{assessment.totalAxes} axes
                                                    </span>
                                                    <span className="font-medium text-navy-900 dark:text-white">
                                                        {assessment.progress}%
                                                    </span>
                                                </div>
                                                <div className="h-1.5 bg-slate-200 dark:bg-navy-800 rounded-full overflow-hidden">
                                                    <div 
                                                        className="h-full bg-purple-500 rounded-full"
                                                        style={{ width: `${assessment.progress}%` }}
                                                    />
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400">
                                            {formatDate(assessment.updatedAt)}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center justify-end gap-2">
                                                {/* Open in Map */}
                                                <button
                                                    onClick={() => onOpenInMap(assessment.id)}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg transition-colors"
                                                >
                                                    <Map size={14} />
                                                    {assessment.status === 'DRAFT' ? 'Edit' : 'View'}
                                                </button>

                                                {/* Create Report - only for approved */}
                                                {assessment.status === 'APPROVED' && (
                                                    <button
                                                        onClick={() => onCreateReport(assessment.id)}
                                                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors"
                                                    >
                                                        <FileOutput size={14} />
                                                        Create Report
                                                    </button>
                                                )}

                                                {/* More menu */}
                                                <div className="relative">
                                                    <button
                                                        onClick={() => setActiveRowMenu(activeRowMenu === assessment.id ? null : assessment.id)}
                                                        className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 rounded"
                                                    >
                                                        <MoreVertical size={16} />
                                                    </button>
                                                    
                                                    {activeRowMenu === assessment.id && (
                                                        <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-navy-900 rounded-lg shadow-lg border border-slate-200 dark:border-white/10 py-1 z-10">
                                                            <button 
                                                                onClick={() => {
                                                                    onOpenInMap(assessment.id);
                                                                    setActiveRowMenu(null);
                                                                }}
                                                                className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5"
                                                            >
                                                                Open in Map
                                                            </button>
                                                            <button className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5">
                                                                Duplicate
                                                            </button>
                                                            <button className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/10">
                                                                Delete
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
        </div>
    );
};

