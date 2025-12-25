/**
 * MyAssessmentsList
 * List of all user's assessments with filters, search, and actions
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
    FileText,
    Search,
    Filter,
    ChevronDown,
    Eye,
    Edit,
    Trash2,
    Download,
    Copy,
    MoreVertical,
    Clock,
    CheckCircle2,
    AlertCircle,
    FileCheck,
    ArrowUpDown,
    Loader2,
    RefreshCw,
    Plus,
    Calendar
} from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { AppView, WorkflowState } from '../../types';

interface AssessmentListItem {
    id: string;
    projectId: string;
    projectName: string;
    name: string;
    type: 'DRD' | 'LEAN' | 'SIRI' | 'ADMA' | 'CMMI';
    status: WorkflowState;
    completedAxes: number;
    totalAxes: number;
    overallScore?: number;
    createdAt: string;
    updatedAt: string;
    createdBy: string;
    createdByName?: string;
}

interface MyAssessmentsListProps {
    onViewAssessment?: (assessmentId: string, projectId: string) => void;
    onEditAssessment?: (assessmentId: string, projectId: string) => void;
    onDeleteAssessment?: (assessmentId: string) => void;
    onExportAssessment?: (assessmentId: string, format: 'pdf' | 'excel') => void;
    onDuplicateAssessment?: (assessmentId: string) => void;
    onCreateNew?: () => void;
}

type SortField = 'name' | 'status' | 'updatedAt' | 'score';
type SortOrder = 'asc' | 'desc';

const STATUS_CONFIG: Record<WorkflowState, { label: string; color: string; icon: React.ReactNode }> = {
    DRAFT: { 
        label: 'Szkic', 
        color: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
        icon: <Edit className="w-3.5 h-3.5" />
    },
    IN_REVIEW: { 
        label: 'W recenzji', 
        color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
        icon: <Clock className="w-3.5 h-3.5" />
    },
    AWAITING_APPROVAL: { 
        label: 'Oczekuje na zatwierdzenie', 
        color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
        icon: <FileCheck className="w-3.5 h-3.5" />
    },
    APPROVED: { 
        label: 'Zatwierdzony', 
        color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
        icon: <CheckCircle2 className="w-3.5 h-3.5" />
    },
    REJECTED: { 
        label: 'Odrzucony', 
        color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
        icon: <AlertCircle className="w-3.5 h-3.5" />
    },
    ARCHIVED: { 
        label: 'Zarchiwizowany', 
        color: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-500',
        icon: <FileText className="w-3.5 h-3.5" />
    }
};

export const MyAssessmentsList: React.FC<MyAssessmentsListProps> = ({
    onViewAssessment,
    onEditAssessment,
    onDeleteAssessment,
    onExportAssessment,
    onDuplicateAssessment,
    onCreateNew
}) => {
    const { currentUser, setCurrentView } = useAppStore();

    // State
    const [assessments, setAssessments] = useState<AssessmentListItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<WorkflowState | 'ALL'>('ALL');
    const [typeFilter, setTypeFilter] = useState<string>('ALL');
    const [sortField, setSortField] = useState<SortField>('updatedAt');
    const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
    const [showFilters, setShowFilters] = useState(false);
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

    // Fetch assessments
    const fetchAssessments = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            const response = await fetch('/api/assessments/my-assessments', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (!response.ok) {
                throw new Error('Nie udało się pobrać ocen');
            }

            const data = await response.json();
            setAssessments(data.assessments || []);
        } catch (err: any) {
            console.error('[MyAssessmentsList] Error:', err);
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchAssessments();
    }, [fetchAssessments]);

    // Filter and sort assessments
    const filteredAssessments = assessments
        .filter(a => {
            // Search filter
            if (searchQuery) {
                const query = searchQuery.toLowerCase();
                if (!a.name.toLowerCase().includes(query) && 
                    !a.projectName.toLowerCase().includes(query)) {
                    return false;
                }
            }
            // Status filter
            if (statusFilter !== 'ALL' && a.status !== statusFilter) {
                return false;
            }
            // Type filter
            if (typeFilter !== 'ALL' && a.type !== typeFilter) {
                return false;
            }
            return true;
        })
        .sort((a, b) => {
            let comparison = 0;
            switch (sortField) {
                case 'name':
                    comparison = a.name.localeCompare(b.name);
                    break;
                case 'status':
                    comparison = a.status.localeCompare(b.status);
                    break;
                case 'updatedAt':
                    comparison = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
                    break;
                case 'score':
                    comparison = (a.overallScore || 0) - (b.overallScore || 0);
                    break;
            }
            return sortOrder === 'asc' ? comparison : -comparison;
        });

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortOrder('desc');
        }
    };

    const handleDelete = async (id: string) => {
        if (onDeleteAssessment) {
            onDeleteAssessment(id);
        }
        setDeleteConfirmId(null);
        setOpenMenuId(null);
        // Refresh list
        await fetchAssessments();
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('pl-PL', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    const getTimeAgo = (dateStr: string) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
        
        if (diffDays === 0) return 'Dzisiaj';
        if (diffDays === 1) return 'Wczoraj';
        if (diffDays < 7) return `${diffDays} dni temu`;
        if (diffDays < 30) return `${Math.floor(diffDays / 7)} tyg. temu`;
        return formatDate(dateStr);
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-xl">
                        <FileText className="w-8 h-8 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-navy-900 dark:text-white">
                            Moje Oceny
                        </h1>
                        <p className="text-slate-500 dark:text-slate-400">
                            {assessments.length} ocen łącznie
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={fetchAssessments}
                        className="p-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors"
                    >
                        <RefreshCw className="w-5 h-5" />
                    </button>
                    {onCreateNew && (
                        <button
                            onClick={onCreateNew}
                            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-medium rounded-lg transition-colors"
                        >
                            <Plus className="w-4 h-4" />
                            Nowa ocena
                        </button>
                    )}
                </div>
            </div>

            {/* Search and Filters */}
            <div className="flex flex-wrap items-center gap-4">
                {/* Search */}
                <div className="relative flex-1 min-w-[300px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Szukaj ocen..."
                        className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-lg text-navy-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                </div>

                {/* Filter Toggle */}
                <button
                    onClick={() => setShowFilters(!showFilters)}
                    className={`flex items-center gap-2 px-4 py-2.5 border rounded-lg transition-colors ${
                        showFilters || statusFilter !== 'ALL' || typeFilter !== 'ALL'
                            ? 'bg-purple-50 border-purple-200 text-purple-700 dark:bg-purple-900/30 dark:border-purple-500/30 dark:text-purple-400'
                            : 'bg-white border-slate-200 text-slate-700 dark:bg-navy-900 dark:border-white/10 dark:text-slate-300'
                    }`}
                >
                    <Filter className="w-4 h-4" />
                    Filtry
                    <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
                </button>
            </div>

            {/* Filter Panel */}
            {showFilters && (
                <div className="p-4 bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-xl">
                    <div className="flex flex-wrap gap-4">
                        {/* Status Filter */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                Status
                            </label>
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value as WorkflowState | 'ALL')}
                                className="px-3 py-2 bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-white/10 rounded-lg text-navy-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                            >
                                <option value="ALL">Wszystkie</option>
                                <option value="DRAFT">Szkic</option>
                                <option value="IN_REVIEW">W recenzji</option>
                                <option value="AWAITING_APPROVAL">Oczekuje</option>
                                <option value="APPROVED">Zatwierdzony</option>
                                <option value="REJECTED">Odrzucony</option>
                                <option value="ARCHIVED">Zarchiwizowany</option>
                            </select>
                        </div>

                        {/* Type Filter */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                Typ
                            </label>
                            <select
                                value={typeFilter}
                                onChange={(e) => setTypeFilter(e.target.value)}
                                className="px-3 py-2 bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-white/10 rounded-lg text-navy-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                            >
                                <option value="ALL">Wszystkie</option>
                                <option value="DRD">DRD</option>
                                <option value="LEAN">RapidLean</option>
                                <option value="SIRI">SIRI</option>
                                <option value="ADMA">ADMA</option>
                                <option value="CMMI">CMMI</option>
                            </select>
                        </div>

                        {/* Clear Filters */}
                        {(statusFilter !== 'ALL' || typeFilter !== 'ALL') && (
                            <button
                                onClick={() => {
                                    setStatusFilter('ALL');
                                    setTypeFilter('ALL');
                                }}
                                className="self-end px-4 py-2 text-sm text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/30 rounded-lg transition-colors"
                            >
                                Wyczyść filtry
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* Error */}
            {error && (
                <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-500/30 rounded-lg text-red-700 dark:text-red-300">
                    <AlertCircle className="w-5 h-5" />
                    <span>{error}</span>
                </div>
            )}

            {/* Assessments List */}
            {filteredAssessments.length === 0 ? (
                <div className="text-center py-12">
                    <FileText className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
                    <p className="text-slate-500 dark:text-slate-400">
                        {searchQuery || statusFilter !== 'ALL' || typeFilter !== 'ALL'
                            ? 'Brak ocen spełniających kryteria'
                            : 'Nie masz jeszcze żadnych ocen'}
                    </p>
                    {onCreateNew && !searchQuery && statusFilter === 'ALL' && typeFilter === 'ALL' && (
                        <button
                            onClick={onCreateNew}
                            className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-medium rounded-lg transition-colors"
                        >
                            <Plus className="w-4 h-4" />
                            Utwórz pierwszą ocenę
                        </button>
                    )}
                </div>
            ) : (
                <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-white/10 overflow-hidden">
                    {/* Table Header */}
                    <div className="grid grid-cols-12 gap-4 px-6 py-3 bg-slate-50 dark:bg-navy-950/50 border-b border-slate-200 dark:border-white/10 text-sm font-medium text-slate-500 dark:text-slate-400">
                        <div className="col-span-4 flex items-center gap-1 cursor-pointer hover:text-slate-700 dark:hover:text-slate-200" onClick={() => handleSort('name')}>
                            Nazwa
                            <ArrowUpDown className="w-4 h-4" />
                        </div>
                        <div className="col-span-2 flex items-center gap-1 cursor-pointer hover:text-slate-700 dark:hover:text-slate-200" onClick={() => handleSort('status')}>
                            Status
                            <ArrowUpDown className="w-4 h-4" />
                        </div>
                        <div className="col-span-2">Postęp</div>
                        <div className="col-span-2 flex items-center gap-1 cursor-pointer hover:text-slate-700 dark:hover:text-slate-200" onClick={() => handleSort('updatedAt')}>
                            Aktualizacja
                            <ArrowUpDown className="w-4 h-4" />
                        </div>
                        <div className="col-span-2 text-right">Akcje</div>
                    </div>

                    {/* Table Body */}
                    <div className="divide-y divide-slate-200 dark:divide-white/10">
                        {filteredAssessments.map(assessment => {
                            const statusConfig = STATUS_CONFIG[assessment.status];
                            const progress = Math.round((assessment.completedAxes / assessment.totalAxes) * 100);

                            return (
                                <div 
                                    key={assessment.id}
                                    className="grid grid-cols-12 gap-4 px-6 py-4 items-center hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                                >
                                    {/* Name */}
                                    <div className="col-span-4">
                                        <p className="font-medium text-navy-900 dark:text-white">
                                            {assessment.name}
                                        </p>
                                        <p className="text-sm text-slate-500 dark:text-slate-400">
                                            {assessment.projectName} • {assessment.type}
                                        </p>
                                    </div>

                                    {/* Status */}
                                    <div className="col-span-2">
                                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full ${statusConfig.color}`}>
                                            {statusConfig.icon}
                                            {statusConfig.label}
                                        </span>
                                    </div>

                                    {/* Progress */}
                                    <div className="col-span-2">
                                        <div className="flex items-center gap-2">
                                            <div className="flex-1 h-2 bg-slate-200 dark:bg-navy-800 rounded-full overflow-hidden">
                                                <div 
                                                    className="h-full bg-purple-500 rounded-full"
                                                    style={{ width: `${progress}%` }}
                                                />
                                            </div>
                                            <span className="text-sm text-slate-500 dark:text-slate-400 tabular-nums">
                                                {progress}%
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                            {assessment.completedAxes}/{assessment.totalAxes} osi
                                        </p>
                                    </div>

                                    {/* Updated */}
                                    <div className="col-span-2">
                                        <p className="text-sm text-navy-900 dark:text-white">
                                            {getTimeAgo(assessment.updatedAt)}
                                        </p>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">
                                            {formatDate(assessment.createdAt)}
                                        </p>
                                    </div>

                                    {/* Actions */}
                                    <div className="col-span-2 flex items-center justify-end gap-2">
                                        <button
                                            onClick={() => onViewAssessment?.(assessment.id, assessment.projectId)}
                                            className="p-2 text-slate-500 hover:text-purple-600 dark:text-slate-400 dark:hover:text-purple-400 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors"
                                            title="Podgląd"
                                        >
                                            <Eye className="w-4 h-4" />
                                        </button>

                                        {assessment.status === 'DRAFT' && (
                                            <button
                                                onClick={() => onEditAssessment?.(assessment.id, assessment.projectId)}
                                                className="p-2 text-slate-500 hover:text-purple-600 dark:text-slate-400 dark:hover:text-purple-400 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors"
                                                title="Edytuj"
                                            >
                                                <Edit className="w-4 h-4" />
                                            </button>
                                        )}

                                        {/* More Menu */}
                                        <div className="relative">
                                            <button
                                                onClick={() => setOpenMenuId(openMenuId === assessment.id ? null : assessment.id)}
                                                className="p-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors"
                                            >
                                                <MoreVertical className="w-4 h-4" />
                                            </button>

                                            {openMenuId === assessment.id && (
                                                <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-lg shadow-lg z-10 py-1">
                                                    <button
                                                        onClick={() => {
                                                            onExportAssessment?.(assessment.id, 'pdf');
                                                            setOpenMenuId(null);
                                                        }}
                                                        className="w-full px-4 py-2 text-left text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 flex items-center gap-2"
                                                    >
                                                        <Download className="w-4 h-4" />
                                                        Eksportuj PDF
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            onExportAssessment?.(assessment.id, 'excel');
                                                            setOpenMenuId(null);
                                                        }}
                                                        className="w-full px-4 py-2 text-left text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 flex items-center gap-2"
                                                    >
                                                        <Download className="w-4 h-4" />
                                                        Eksportuj Excel
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            onDuplicateAssessment?.(assessment.id);
                                                            setOpenMenuId(null);
                                                        }}
                                                        className="w-full px-4 py-2 text-left text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 flex items-center gap-2"
                                                    >
                                                        <Copy className="w-4 h-4" />
                                                        Duplikuj
                                                    </button>
                                                    <div className="border-t border-slate-200 dark:border-white/10 my-1" />
                                                    <button
                                                        onClick={() => {
                                                            setDeleteConfirmId(assessment.id);
                                                            setOpenMenuId(null);
                                                        }}
                                                        className="w-full px-4 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                        Usuń
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {deleteConfirmId && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-navy-900 rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                                <AlertCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
                            </div>
                            <h3 className="text-lg font-bold text-navy-900 dark:text-white">
                                Potwierdź usunięcie
                            </h3>
                        </div>
                        <p className="text-slate-600 dark:text-slate-300 mb-6">
                            Czy na pewno chcesz usunąć tę ocenę? Ta operacja jest nieodwracalna.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setDeleteConfirmId(null)}
                                className="flex-1 py-2.5 bg-slate-100 dark:bg-navy-800 hover:bg-slate-200 dark:hover:bg-navy-700 text-slate-700 dark:text-slate-300 font-medium rounded-lg transition-colors"
                            >
                                Anuluj
                            </button>
                            <button
                                onClick={() => handleDelete(deleteConfirmId)}
                                className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white font-medium rounded-lg transition-colors"
                            >
                                Usuń
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MyAssessmentsList;

