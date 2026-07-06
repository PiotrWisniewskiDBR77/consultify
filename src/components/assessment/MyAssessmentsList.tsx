/**
 * MyAssessmentsList
 * List of all user's assessments with filters, search, and actions
 */

import {
  AlertCircle,
  ArrowUpDown,
  Calendar,
  CheckCircle2,
  ChevronDown,
  Clock,
  Copy,
  Download,
  Edit,
  Eye,
  FileCheck,
  FileText,
  Filter,
  MoreVertical,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';

import { LoadingState } from '@/components/ui/primitives';
import { Api } from '@/services/api';

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

const STATUS_CONFIG: Record<
  WorkflowState,
  { label: string; color: string; icon: React.ReactNode }
> = {
  DRAFT: {
    label: 'Draft',
    color: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
    icon: <Edit className="w-3.5 h-3.5" />,
  },
  IN_REVIEW: {
    label: 'In Review',
    color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    icon: <Clock className="w-3.5 h-3.5" />,
  },
  AWAITING_APPROVAL: {
    label: 'Awaiting Approval',
    color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    icon: <FileCheck className="w-3.5 h-3.5" />,
  },
  APPROVED: {
    label: 'Approved',
    color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    icon: <CheckCircle2 className="w-3.5 h-3.5" />,
  },
  REJECTED: {
    label: 'Rejected',
    color: 'bg-danger-100 text-danger-700 dark:bg-danger-900/30 dark:text-danger-400',
    icon: <AlertCircle className="w-3.5 h-3.5" />,
  },
  ARCHIVED: {
    label: 'Archived',
    color: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-500',
    icon: <FileText className="w-3.5 h-3.5" />,
  },
  COMPLETED: {
    label: 'Completed',
    color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    icon: <CheckCircle2 className="w-3.5 h-3.5" />,
  },
  IN_PROGRESS: {
    label: 'In Progress',
    color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    icon: <Clock className="w-3.5 h-3.5" />,
  },
};

export const MyAssessmentsList: React.FC<MyAssessmentsListProps> = ({
  onViewAssessment,
  onEditAssessment,
  onDeleteAssessment,
  onExportAssessment,
  onDuplicateAssessment,
  onCreateNew,
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
      const resp = await Api.listAssessments({ limit: 200, offset: 0 });
      const list = Array.isArray((resp as any)?.items)
        ? (resp as any).items
        : Array.isArray((resp as any)?.assessments)
          ? (resp as any).assessments
          : [];
      setAssessments(
        list.map((a: any) => ({
          id: String(a?.id || ''),
          projectId: String(a?.projectId || a?.project_id || ''),
          projectName: String(a?.projectName || a?.project_name || ''),
          name: String(a?.name || a?.title || ''),
          type: (String(
            a?.assessmentType || a?.assessment_type || a?.type || 'DRD'
          ).toUpperCase() || 'DRD') as any,
          status: (String(a?.backendStatus || a?.status || 'DRAFT').toUpperCase() ||
            'DRAFT') as any,
          completedAxes: Number(a?.completedAxes || 0),
          totalAxes: Number(a?.totalAxes || 0),
          overallScore: a?.overallScore ?? a?.overall_score ?? undefined,
          createdAt: String(a?.createdAt || a?.created_at || ''),
          updatedAt: String(a?.updatedAt || a?.updated_at || ''),
          createdBy: String(a?.createdBy || a?.created_by || ''),
          createdByName: a?.createdByName || a?.created_by_name,
        }))
      );
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
    .filter((a) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        if (!a.name.toLowerCase().includes(query) && !a.projectName.toLowerCase().includes(query)) {
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
      day: 'numeric',
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
    return <LoadingState variant="spinner" className="h-64" />;
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-primary-100 dark:bg-primary-900/30 rounded-xl">
            <FileText className="w-8 h-8 text-primary-600 dark:text-primary-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-c-text">My Assessments</h1>
            <p className="text-c-text-muted">
              {assessments.length} assessments total
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
              className="flex items-center gap-2 px-4 py-2 bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] font-medium rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              New Assessment
            </button>
          )}
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-wrap items-center gap-4">
        {/* Search */}
        <div className="relative flex-1 min-w-[300px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-600 dark:text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search assessments..."
            className="w-full pl-10 pr-4 py-2.5 bg-c-surface border border-slate-200/60 dark:border-white/[0.03] rounded-lg text-c-text placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-c-focus"
          />
        </div>

        {/* Filter Toggle */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-2 px-4 py-2.5 border rounded-lg transition-colors ${
            showFilters || statusFilter !== 'ALL' || typeFilter !== 'ALL'
              ? 'bg-slate-100 border-slate-300 text-slate-900 dark:bg-white/10 dark:border-white/20 dark:text-slate-100'
              : 'bg-white border-slate-200 text-slate-700 dark:bg-navy-900 dark:border-navy-700 dark:text-slate-300'
          }`}
        >
          <Filter className="w-4 h-4" />
          Filters
          <ChevronDown
            className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`}
          />
        </button>
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <div className="p-4 bg-c-surface border border-slate-200/60 dark:border-white/[0.03] rounded-xl">
          <div className="flex flex-wrap gap-4">
            {/* Status Filter */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as WorkflowState | 'ALL')}
                className="px-3 py-2 bg-c-bg border border-c-border-subtle rounded-lg text-c-text focus:outline-none focus:ring-2 focus:ring-c-focus"
              >
                <option value="ALL">All</option>
                <option value="DRAFT">Draft</option>
                <option value="IN_REVIEW">In Review</option>
                <option value="AWAITING_APPROVAL">Awaiting</option>
                <option value="APPROVED">Approved</option>
                <option value="REJECTED">Rejected</option>
                <option value="ARCHIVED">Archived</option>
              </select>
            </div>

            {/* Type Filter */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Type
              </label>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="px-3 py-2 bg-c-bg border border-c-border-subtle rounded-lg text-c-text focus:outline-none focus:ring-2 focus:ring-c-focus"
              >
                <option value="ALL">All</option>
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
                className="self-end px-4 py-2 text-sm text-c-text-secondary hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors"
              >
                Clear filters
              </button>
            )}
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 p-4 bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-500/30 rounded-lg text-danger-700 dark:text-danger-300">
          <AlertCircle className="w-5 h-5" />
          <span>{error}</span>
        </div>
      )}

      {/* Assessments List */}
      {filteredAssessments.length === 0 ? (
        <div className="text-center py-12">
          <FileText className="w-12 h-12 text-slate-600 dark:text-slate-400 mx-auto mb-4" />
          <p className="text-c-text-muted">
            {searchQuery || statusFilter !== 'ALL' || typeFilter !== 'ALL'
              ? 'No assessments match your criteria'
              : "You don't have any assessments yet"}
          </p>
          {onCreateNew && !searchQuery && statusFilter === 'ALL' && typeFilter === 'ALL' && (
            <button
              onClick={onCreateNew}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] font-medium rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create first assessment
            </button>
          )}
        </div>
      ) : (
        <div className="bg-c-surface rounded-xl border border-slate-200/60 dark:border-white/[0.03] overflow-hidden">
          {/* Table Header */}
          <div className="grid grid-cols-12 gap-4 px-6 py-3 bg-slate-50 dark:bg-navy-950/50 border-b border-c-border-subtle text-sm font-medium text-c-text-muted">
            <div
              className="col-span-4 flex items-center gap-1 cursor-pointer hover:text-slate-700 dark:text-slate-300 dark:hover:text-slate-200"
              onClick={() => handleSort('name')}
            >
              Name
              <ArrowUpDown className="w-4 h-4" />
            </div>
            <div
              className="col-span-2 flex items-center gap-1 cursor-pointer hover:text-slate-700 dark:text-slate-300 dark:hover:text-slate-200"
              onClick={() => handleSort('status')}
            >
              Status
              <ArrowUpDown className="w-4 h-4" />
            </div>
            <div className="col-span-2">Progress</div>
            <div
              className="col-span-2 flex items-center gap-1 cursor-pointer hover:text-slate-700 dark:text-slate-300 dark:hover:text-slate-200"
              onClick={() => handleSort('updatedAt')}
            >
              Updated
              <ArrowUpDown className="w-4 h-4" />
            </div>
            <div className="col-span-2 text-right">Actions</div>
          </div>

          {/* Table Body */}
          <div className="divide-y divide-slate-200 dark:divide-white/10">
            {filteredAssessments.map((assessment) => {
              const statusConfig = STATUS_CONFIG[assessment.status];
              const progress =
                assessment.totalAxes > 0
                  ? Math.round((assessment.completedAxes / assessment.totalAxes) * 100)
                  : (assessment as any).progress || 0;

              return (
                <div
                  key={assessment.id}
                  className="grid grid-cols-12 gap-4 px-6 py-4 items-center hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                >
                  {/* Name */}
                  <div className="col-span-4">
                    <p className="font-medium text-c-text">{assessment.name}</p>
                    <p className="text-sm text-c-text-muted">
                      {assessment.projectName} • {assessment.type}
                    </p>
                  </div>

                  {/* Status */}
                  <div className="col-span-2">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full ${statusConfig.color}`}
                    >
                      {statusConfig.icon}
                      {statusConfig.label}
                    </span>
                  </div>

                  {/* Progress */}
                  <div className="col-span-2">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-slate-200 dark:bg-navy-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-navy-900 rounded-full"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <span className="text-sm text-c-text-muted tabular-nums">
                        {progress}%
                      </span>
                    </div>
                    <p className="text-xs text-c-text-muted mt-1">
                      {assessment.completedAxes}/{assessment.totalAxes} axes
                    </p>
                  </div>

                  {/* Updated */}
                  <div className="col-span-2">
                    <p className="text-sm text-c-text">
                      {getTimeAgo(assessment.updatedAt)}
                    </p>
                    <p className="text-xs text-c-text-muted">
                      {formatDate(assessment.createdAt)}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="col-span-2 flex items-center justify-end gap-2">
                    <button
                      onClick={() => onViewAssessment?.(assessment.id, assessment.projectId)}
                      className="p-2 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors"
                      title="Preview"
                    >
                      <Eye className="w-4 h-4" />
                    </button>

                    {assessment.status === 'DRAFT' && (
                      <button
                        onClick={() => onEditAssessment?.(assessment.id, assessment.projectId)}
                        className="p-2 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors"
                        title="Edit"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                    )}

                    {/* More Menu */}
                    <div className="relative">
                      <button
                        onClick={() =>
                          setOpenMenuId(openMenuId === assessment.id ? null : assessment.id)
                        }
                        className="p-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>

                      {openMenuId === assessment.id && (
                        <div className="absolute right-0 top-full mt-1 w-48 bg-c-surface border border-slate-200/60 dark:border-white/[0.03] rounded-lg shadow-lg z-10 py-1">
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
                            Duplicate
                          </button>
                          <div className="border-t border-c-border-subtle my-1" />
                          <button
                            onClick={() => {
                              setDeleteConfirmId(assessment.id);
                              setOpenMenuId(null);
                            }}
                            className="w-full px-4 py-2 text-left text-sm text-danger-600 dark:text-danger-400 hover:bg-danger-50 dark:hover:bg-danger-900/20 flex items-center gap-2"
                          >
                            <Trash2 className="w-4 h-4" />
                            Delete
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
          <div className="bg-c-surface rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-danger-100 dark:bg-danger-900/30 rounded-lg">
                <AlertCircle className="w-6 h-6 text-danger-600 dark:text-danger-400" />
              </div>
              <h3 className="text-lg font-bold text-c-text">Confirm Deletion</h3>
            </div>
            <p className="text-slate-600 dark:text-slate-300 mb-6">
              Are you sure you want to delete this assessment? This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="flex-1 py-2.5 bg-slate-100 dark:bg-navy-800 hover:bg-slate-200 dark:hover:bg-navy-700 text-slate-700 dark:text-slate-300 font-medium rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirmId)}
                className="flex-1 py-2.5 bg-danger-600 hover:bg-danger-500 text-white font-medium rounded-lg transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
