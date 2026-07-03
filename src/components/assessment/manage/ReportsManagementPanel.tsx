/**
 * ReportsManagementPanel - Professional reports management for assessments
 * Displays reports table with status, actions, and export options
 * Design follows TeamManagementPanel patterns (ClickUp-style)
 */

import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Download,
  Edit3,
  Eye,
  FileOutput,
  FileText,
  Loader2,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { FC, useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

import { Api, getHeaders } from '../../../services/api';
import { LoadingState } from '../../ui/primitives';

// ============================================
// Types
// ============================================

export type ReportStatus =
  | 'DRAFT'
  | 'CONFIGURING'
  | 'GENERATING'
  | 'GENERATED'
  | 'IN_REVIEW'
  | 'APPROVED'
  | 'SENT_INTERNAL'
  | 'SENT_EXTERNAL'
  | 'UTILIZED'
  | 'FINAL'
  | 'ARCHIVED';

export interface Report {
  id: string;
  name: string;
  assessmentId: string;
  assessmentName: string;
  status: ReportStatus;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  createdByName?: string;
  canGenerateInitiatives: boolean;
  initiativesGenerated: boolean;
  initiativesCount: number;
  provenance?: {
    assessmentRunId?: string | null;
    assessmentDefinitionId?: string | null;
    assessmentDefinitionVersion?: string | null;
    workbenchRunState?: string | null;
    workbenchReviewState?: string | null;
  } | null;
}

export interface ReportsManagementPanelProps {
  assessmentId: string;
  assessmentName?: string;
  workflowStatus: string;
  canManage: boolean;
  onRefresh: () => Promise<void>;
  onOpenReport?: (reportId: string, reportName: string, status?: string) => void;
  onCreateReport?: () => void;
  onCreateInitiatives?: (reportId: string) => void;
}

// ============================================
// Constants
// ============================================

const STATUS_CONFIG: Record<
  ReportStatus,
  {
    label: string;
    color: string;
    bgColor: string;
    borderColor: string;
    icon: FC<{ size?: number; className?: string }>;
  }
> = {
  DRAFT: {
    label: 'Draft',
    color: 'text-slate-600 dark:text-slate-400',
    bgColor: 'bg-slate-50 dark:bg-slate-500/10',
    borderColor: 'border-slate-200 dark:border-slate-500/30',
    icon: Edit3,
  },
  CONFIGURING: {
    label: 'Configuring',
    color: 'text-slate-600 dark:text-slate-400',
    bgColor: 'bg-slate-50 dark:bg-slate-500/10',
    borderColor: 'border-slate-200 dark:border-slate-500/30',
    icon: Clock,
  },
  GENERATING: {
    label: 'Generating',
    color: 'text-amber-700 dark:text-amber-300',
    bgColor: 'bg-amber-50 dark:bg-amber-500/10',
    borderColor: 'border-amber-200 dark:border-amber-500/30',
    icon: Loader2,
  },
  GENERATED: {
    label: 'Generated',
    color: 'text-primary-700 dark:text-primary-300',
    bgColor: 'bg-primary-50 dark:bg-primary-500/10',
    borderColor: 'border-primary-200 dark:border-primary-500/30',
    icon: Sparkles,
  },
  IN_REVIEW: {
    label: 'In review',
    color: 'text-primary-700 dark:text-primary-300',
    bgColor: 'bg-primary-50 dark:bg-primary-500/10',
    borderColor: 'border-primary-200 dark:border-primary-500/30',
    icon: Eye,
  },
  APPROVED: {
    label: 'Approved',
    color: 'text-emerald-600 dark:text-emerald-400',
    bgColor: 'bg-emerald-50 dark:bg-emerald-500/10',
    borderColor: 'border-emerald-200 dark:border-emerald-500/30',
    icon: CheckCircle2,
  },
  SENT_INTERNAL: {
    label: 'Sent (internal)',
    color: 'text-blue-700 dark:text-blue-300',
    bgColor: 'bg-blue-50 dark:bg-blue-500/10',
    borderColor: 'border-blue-200 dark:border-blue-500/30',
    icon: Upload,
  },
  SENT_EXTERNAL: {
    label: 'Sent (external)',
    color: 'text-blue-700 dark:text-blue-300',
    bgColor: 'bg-blue-50 dark:bg-blue-500/10',
    borderColor: 'border-blue-200 dark:border-blue-500/30',
    icon: Upload,
  },
  UTILIZED: {
    label: 'Utilized',
    color: 'text-emerald-600 dark:text-emerald-400',
    bgColor: 'bg-emerald-50 dark:bg-emerald-500/10',
    borderColor: 'border-emerald-200 dark:border-emerald-500/30',
    icon: FileOutput,
  },
  FINAL: {
    label: 'Final',
    color: 'text-emerald-600 dark:text-emerald-400',
    bgColor: 'bg-emerald-50 dark:bg-emerald-500/10',
    borderColor: 'border-emerald-200 dark:border-emerald-500/30',
    icon: CheckCircle2,
  },
  ARCHIVED: {
    label: 'Archived',
    color: 'text-slate-500 dark:text-slate-400',
    bgColor: 'bg-slate-50 dark:bg-slate-500/10',
    borderColor: 'border-slate-200 dark:border-slate-500/30',
    icon: Clock,
  },
};

// ============================================
// Report Row Component
// ============================================

const ReportRow: FC<{
  report: Report;
  canManage: boolean;
  onOpen: (reportId: string, reportName: string, status?: string) => void;
  onFinalize: (reportId: string) => Promise<void>;
  onExportPDF: (reportId: string, reportName: string) => Promise<void>;
  onExportPPTX: (reportId: string, reportName: string) => Promise<void>;
  onExportWord: (reportId: string, reportName: string) => Promise<void>;
  onExportExcel: (reportId: string, reportName: string) => Promise<void>;
  onDelete: (reportId: string) => Promise<void>;
  onCreateInitiatives?: (reportId: string) => void;
}> = ({
  report,
  canManage,
  onOpen,
  onFinalize,
  onExportPDF,
  onExportPPTX,
  onExportWord,
  onExportExcel,
  onDelete,
  onCreateInitiatives,
}) => {
  const [busy, setBusy] = useState(false);
  const [showActions, setShowActions] = useState(false);

  const statusConfig = STATUS_CONFIG[report.status] || STATUS_CONFIG.DRAFT;
  const StatusIcon = statusConfig.icon;

  const handleFinalize = async () => {
    setBusy(true);
    try {
      await onFinalize(report.id);
      toast.success('Report finalized');
    } catch (err) {
      toast.error('Failed to finalize report');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Delete report "${report.name}"?`)) return;
    setBusy(true);
    try {
      await onDelete(report.id);
      toast.success('Report deleted');
    } catch (err) {
      toast.error('Failed to delete report');
    } finally {
      setBusy(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('pl-PL', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <motion.tr
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="group border-b border-slate-200 dark:border-navy-700/50 hover:bg-slate-50/50 dark:hover:bg-navy-800/30 transition-colors"
    >
      {/* Report Name */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary-100 dark:bg-primary-900/30 rounded-lg">
            <FileText className="w-4 h-4 text-primary-600 dark:text-primary-400" />
          </div>
          <div className="min-w-0">
            <button
              onClick={() => onOpen(report.id, report.name, report.status)}
              className="text-sm font-medium text-slate-900 dark:text-white hover:text-primary-600 dark:hover:text-primary-400 transition-colors text-left truncate block max-w-[200px]"
            >
              {report.name}
            </button>
            <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
              {report.assessmentName}
            </div>
            {report.provenance?.assessmentRunId ? (
              <div className="text-[10px] text-slate-600 dark:text-slate-500 truncate">
                run {report.provenance.assessmentRunId}
                {report.provenance.workbenchReviewState
                  ? ` • review ${String(report.provenance.workbenchReviewState).replace(/_/g, ' ')}`
                  : report.provenance.workbenchRunState
                    ? ` • ${String(report.provenance.workbenchRunState).replace(/_/g, ' ')}`
                    : ''}
              </div>
            ) : null}
          </div>
        </div>
      </td>

      {/* Author */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary-500 to-blue-600 flex items-center justify-center text-xs font-medium text-white">
            {(report.createdByName || report.createdBy || '?')
              .split(' ')
              .map((n) => n[0])
              .join('')
              .slice(0, 2)
              .toUpperCase()}
          </div>
          <span className="text-sm text-slate-600 dark:text-slate-400 truncate max-w-[80px]">
            {(report.createdByName || report.createdBy || '').split(' ')[0]}
          </span>
        </div>
      </td>

      {/* Status */}
      <td className="px-4 py-3">
        <div
          className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold ${statusConfig.bgColor} ${statusConfig.color} ${statusConfig.borderColor} border`}
        >
          <StatusIcon size={12} />
          {statusConfig.label}
        </div>
      </td>

      {/* Initiatives */}
      <td className="px-4 py-3">
        {report.initiativesGenerated ? (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
            <Sparkles size={12} />
            {report.initiativesCount} generated
          </span>
        ) : (
          <span className="text-xs text-slate-600 dark:text-slate-500">—</span>
        )}
      </td>

      {/* Updated */}
      <td className="px-4 py-3">
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {formatDate(report.updatedAt)}
        </span>
      </td>

      {/* Actions */}
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-1">
          {/* Primary Action based on workflow status */}
          {['DRAFT', 'CONFIGURING', 'GENERATING', 'GENERATED'].includes(report.status) &&
          canManage ? (
            report.status === 'GENERATED' ? (
              <button
                onClick={handleFinalize}
                disabled={busy}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-c-text hover:bg-c-text-secondary disabled:bg-c-border-strong text-c-bg rounded-lg transition-colors"
              >
                {busy ? <Loader2 size={12} className="animate-spin" /> : <ArrowRight size={12} />}
                Submit Review
              </button>
            ) : (
              <button
                onClick={() => onOpen(report.id, report.name, report.status)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition-colors"
              >
                <Edit3 size={12} />
                Edit
              </button>
            )
          ) : report.status === 'IN_REVIEW' ? (
            <button
              onClick={() => onOpen(report.id, report.name, report.status)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-c-text hover:bg-c-text-secondary text-c-bg rounded-lg transition-colors"
            >
              <Eye size={12} />
              Review
            </button>
          ) : ['APPROVED', 'SENT_INTERNAL', 'SENT_EXTERNAL', 'UTILIZED'].includes(report.status) ? (
            <button
              onClick={() => onOpen(report.id, report.name, report.status)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-colors"
            >
              <Eye size={12} />
              View
            </button>
          ) : (
            <button
              onClick={() => onOpen(report.id, report.name, report.status)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors"
            >
              <Eye size={12} />
              View
            </button>
          )}

          {/* Download PDF - available for approved+ reports */}
          {['APPROVED', 'SENT_INTERNAL', 'SENT_EXTERNAL', 'UTILIZED'].includes(report.status) && (
            <button
              onClick={() => onExportPDF(report.id, report.name)}
              className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-navy-700 rounded transition-colors"
              title="Download PDF"
            >
              <Download size={14} />
            </button>
          )}

          {/* More Actions */}
          <div className="relative">
            <button
              onClick={() => setShowActions(!showActions)}
              className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-navy-700 rounded transition-colors"
            >
              <MoreHorizontal size={14} />
            </button>

            {showActions && (
              <>
                <div className="fixed inset-0 z-dropdown" onClick={() => setShowActions(false)} />
                <div className="absolute right-0 top-full mt-1 z-overlay w-44 bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 rounded-lg shadow-xl overflow-hidden">
                  <button
                    onClick={() => {
                      onOpen(report.id, report.name, report.status);
                      setShowActions(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-700"
                  >
                    {['DRAFT', 'CONFIGURING', 'GENERATING', 'GENERATED'].includes(report.status) ? (
                      <Edit3 size={14} />
                    ) : (
                      <Eye size={14} />
                    )}
                    {['DRAFT', 'CONFIGURING', 'GENERATING', 'GENERATED'].includes(report.status)
                      ? 'Edit'
                      : 'View'}{' '}
                    Report
                  </button>
                  {['APPROVED', 'SENT_INTERNAL', 'SENT_EXTERNAL', 'UTILIZED'].includes(
                    report.status
                  ) && (
                    <>
                      <button
                        onClick={() => {
                          onExportPDF(report.id, report.name);
                          setShowActions(false);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-700"
                      >
                        <FileText size={14} />
                        Export PDF
                      </button>
                      <button
                        onClick={() => {
                          onExportPPTX(report.id, report.name);
                          setShowActions(false);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-700"
                      >
                        <FileOutput size={14} />
                        Export PPTX
                      </button>
                      <button
                        onClick={() => {
                          onExportWord(report.id, report.name);
                          setShowActions(false);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-700"
                      >
                        <FileText size={14} />
                        Export Word
                      </button>
                    </>
                  )}
                  {['DRAFT', 'CONFIGURING', 'GENERATED'].includes(report.status) && canManage && (
                    <>
                      <div className="border-t border-slate-200 dark:border-navy-600 my-1" />
                      <button
                        onClick={() => {
                          handleDelete();
                          setShowActions(false);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-danger-600 dark:text-danger-400 hover:bg-danger-50 dark:hover:bg-danger-900/10"
                      >
                        <Trash2 size={14} />
                        Delete
                      </button>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </td>
    </motion.tr>
  );
};

// ============================================
// Main Component
// ============================================

export const ReportsManagementPanel: FC<ReportsManagementPanelProps> = ({
  assessmentId,
  assessmentName,
  workflowStatus,
  canManage,
  onRefresh,
  onOpenReport,
  onCreateReport,
  onCreateInitiatives,
}) => {
  const navigate = useNavigate();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [creatingReport, setCreatingReport] = useState(false);

  const isApproved = workflowStatus === 'APPROVED';

  // Fetch reports for this assessment from Report Builder API
  const fetchReports = useCallback(async () => {
    try {
      const response = await Api.get(
        `/report-builder?sourceType=ASSESSMENT&sourceId=${encodeURIComponent(assessmentId)}`
      );
      const apiReports = response?.reports || [];
      const mapped: Report[] = apiReports.map((r: any) => ({
        id: String(r.id),
        name: String(r.title || r.name || 'Report'),
        assessmentId,
        assessmentName: String(r.sourceName || assessmentName || ''),
        status: (String(r.status || 'DRAFT').toUpperCase() as ReportStatus) || 'DRAFT',
        createdAt: String(r.createdAt || ''),
        updatedAt: String(r.updatedAt || ''),
        createdBy: String(r.createdByName || r.createdBy || 'system'),
        createdByName: r.createdByName,
        canGenerateInitiatives: ['APPROVED', 'SENT_INTERNAL', 'SENT_EXTERNAL'].includes(
          String(r.status || '').toUpperCase()
        ),
        initiativesGenerated: Number(r.initiativesCount || 0) > 0,
        initiativesCount: Number(r.initiativesCount || 0),
        provenance: r?.config
          ? {
              assessmentRunId: r.config.assessmentRunId || null,
              assessmentDefinitionId: r.config.assessmentDefinitionId || null,
              assessmentDefinitionVersion: r.config.assessmentDefinitionVersion || null,
              workbenchRunState: r.config.workbenchRunState || null,
              workbenchReviewState: r.config.workbenchReviewState || null,
            }
          : null,
      }));
      setReports(mapped);
    } catch (err) {
      console.error('[ReportsManagementPanel] Error fetching reports:', err);
    } finally {
      setLoading(false);
    }
  }, [assessmentId, assessmentName]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchReports();
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  };

  const handleCreateReport = useCallback(async () => {
    if (!onCreateReport) return;
    setCreatingReport(true);
    try {
      await Promise.resolve(onCreateReport());
    } finally {
      setCreatingReport(false);
    }
  }, [onCreateReport]);

  // Submit report to review (finalize)
  const handleFinalize = async (reportId: string) => {
    try {
      await Api.post(`/report-builder/${reportId}/finalize`, {});
      toast.success('Report finalized');
      await fetchReports();
    } catch (err) {
      toast.error('Failed to finalize report');
    }
  };

  /** Download a report export as a binary blob and trigger browser download. */
  const downloadExport = async (
    format: 'pdf' | 'pptx' | 'doc' | 'excel',
    reportId: string,
    reportName: string
  ) => {
    const headers = getHeaders();
    // Remove Content-Type for GET blob requests
    delete (headers as Record<string, string>)['Content-Type'];

    const response = await fetch(`/api/report-builder/${reportId}/export/${format}`, { headers });
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(text || `Export failed (${format})`);
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeTitle = (reportName || 'report').replace(/[^\p{L}\p{N}_-]+/gu, '_');
    const ext = format === 'doc' ? 'docx' : format;
    a.download = `${safeTitle}.${ext}`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  const handleExportPDF = async (reportId: string, reportName: string) => {
    try {
      await downloadExport('pdf', reportId, reportName);
      toast.success('PDF exported');
    } catch (err) {
      toast.error('Failed to export PDF');
    }
  };

  const handleExportPPTX = async (reportId: string, reportName: string) => {
    try {
      await downloadExport('pptx', reportId, reportName);
      toast.success('PPTX exported');
    } catch (err) {
      toast.error('Failed to export PPTX');
    }
  };

  const handleExportWord = async (reportId: string, reportName: string) => {
    try {
      await downloadExport('doc', reportId, reportName);
      toast.success('Word exported');
    } catch (err) {
      toast.error('Failed to export Word');
    }
  };

  const handleExportExcel = async (reportId: string, reportName: string) => {
    try {
      await downloadExport('excel', reportId, reportName);
      toast.success('Excel exported');
    } catch (err) {
      toast.error('Failed to export Excel');
    }
  };

  const handleDelete = async (reportId: string) => {
    try {
      await Api.delete(`/report-builder/${reportId}`);
      toast.success('Report deleted');
      await fetchReports();
    } catch (err: any) {
      toast.error(err?.error || 'Failed to delete report');
    }
  };

  const handleOpenReport = (reportId: string, reportName: string, status?: string) => {
    if (onOpenReport) {
      onOpenReport(reportId, reportName, status);
    } else {
      navigate(`/reports/builder/${reportId}`);
    }
  };

  // Filter reports
  const filteredReports = useMemo(() => {
    if (!searchQuery) return reports;
    const query = searchQuery.toLowerCase();
    return reports.filter(
      (r) => r.name.toLowerCase().includes(query) || r.assessmentName.toLowerCase().includes(query)
    );
  }, [reports, searchQuery]);

  // Stats
  const stats = useMemo(
    () => ({
      total: reports.length,
      draft: reports.filter((r) =>
        ['DRAFT', 'CONFIGURING', 'GENERATING', 'GENERATED'].includes(r.status)
      ).length,
      inReview: reports.filter((r) => r.status === 'IN_REVIEW').length,
      approved: reports.filter((r) => r.status === 'APPROVED').length,
    }),
    [reports]
  );

  const latestRunReadback = useMemo(() => {
    return reports.find((report) => report.provenance?.assessmentRunId)?.provenance || null;
  }, [reports]);

  return (
    <div className="space-y-4">
      {/* Header Card */}
      <div className="rounded-xl border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 dark:border-navy-800 bg-slate-50/50 dark:bg-navy-900/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-blue-500 to-primary-600 text-white rounded-lg">
                <FileText size={18} />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Reports</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {stats.total} report{stats.total !== 1 ? 's' : ''} • {stats.draft} in progress •{' '}
                  {stats.inReview} in review • {stats.approved} approved
                </p>
                {latestRunReadback?.assessmentRunId ? (
                  <p className="mt-1 text-[11px] text-slate-600 dark:text-slate-500">
                    Current report lane readback: run {latestRunReadback.assessmentRunId}
                    {latestRunReadback.workbenchReviewState
                      ? ` • review ${String(latestRunReadback.workbenchReviewState).replace(/_/g, ' ')}`
                      : latestRunReadback.workbenchRunState
                        ? ` • ${String(latestRunReadback.workbenchRunState).replace(/_/g, ' ')}`
                        : ''}
                  </p>
                ) : null}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-navy-800 text-slate-500 dark:text-slate-400 transition-colors"
              >
                <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
              </button>
              {canManage && (
                <button
                  onClick={() => onCreateReport?.()}
                  disabled={!onCreateReport}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                    onCreateReport
                      ? 'bg-c-text hover:bg-c-text-secondary text-c-bg'
                      : 'bg-slate-200 dark:bg-navy-700 text-slate-500 dark:text-slate-400 cursor-not-allowed'
                  }`}
                  title={!onCreateReport ? 'Report creation not available' : undefined}
                >
                  <Plus size={16} />
                  New Report
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Note */}
        {!isApproved && (
          <div className="px-4 py-3 bg-slate-50 dark:bg-navy-900/40 border-b border-slate-200 dark:border-navy-800">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-slate-500 dark:text-slate-400 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-slate-600 dark:text-slate-300">
                You can draft reports before approval. A report becomes visible in the global
                Reports tab after it is <strong>finalized</strong>.
              </div>
            </div>
          </div>
        )}

        {/* Stats Row */}
        <div className="px-4 py-3 border-b border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900">
          <div className="flex items-center gap-4 overflow-x-auto">
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-700">
              <FileText size={14} className="text-slate-500" />
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                {stats.total} Total
              </span>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30">
              <Edit3 size={14} className="text-amber-600 dark:text-amber-400" />
              <span className="text-sm font-medium text-amber-700 dark:text-amber-300">
                {stats.draft} In Progress
              </span>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary-50 dark:bg-primary-500/10 border border-primary-200 dark:border-primary-500/30">
              <Eye size={14} className="text-primary-600 dark:text-primary-400" />
              <span className="text-sm font-medium text-primary-700 dark:text-primary-300">
                {stats.inReview} In Review
              </span>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30">
              <CheckCircle2 size={14} className="text-emerald-600 dark:text-emerald-400" />
              <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                {stats.approved} Approved
              </span>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="px-4 py-3 border-b border-slate-200 dark:border-navy-800">
          <div className="relative max-w-md">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search reports..."
              className="w-full h-10 pl-10 pr-4 rounded-lg border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-800 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-[color:var(--c-focus)] focus:border-c-accent transition-colors"
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          {loading ? (
            <LoadingState variant="spinner" />
          ) : filteredReports.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="p-4 rounded-full bg-slate-100 dark:bg-navy-800 mb-3">
                <FileOutput size={24} className="text-slate-500 dark:text-slate-400" />
              </div>
              <p className="text-sm font-medium text-slate-900 dark:text-white">
                {searchQuery ? 'No reports match your search' : 'No reports yet'}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {isApproved
                  ? 'Create a report to get started'
                  : 'Approve the assessment to create reports'}
              </p>
              {isApproved && canManage && (
                <button
                  onClick={handleCreateReport}
                  disabled={creatingReport || !onCreateReport}
                  className="mt-4 flex items-center gap-2 px-4 py-2 rounded-lg bg-c-text hover:bg-c-text-secondary text-c-bg text-sm font-semibold transition-colors disabled:opacity-50"
                >
                  {creatingReport ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Plus size={16} />
                  )}
                  Create First Report
                </button>
              )}
            </div>
          ) : (
            <table /* §27-todo: lista encji → migracja do FilterableTable + Menu 1/2/3 (kanon §2); swiadomie oznaczona, nie przepisana w tej sesji */  className="w-full" style={{ minWidth: 700 }}>
              <thead>
                <tr className="border-b border-slate-200 dark:border-navy-700/50 bg-slate-50 dark:bg-navy-900/50">
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider min-w-[200px]">
                    Report
                  </th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider min-w-[100px]">
                    Author
                  </th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider min-w-[100px]">
                    Status
                  </th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider min-w-[120px]">
                    Initiatives
                  </th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider min-w-[100px]">
                    Updated
                  </th>
                  <th className="px-4 py-2.5 text-right text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-[140px]">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence>
                  {filteredReports.map((report) => (
                    <ReportRow
                      key={report.id}
                      report={report}
                      canManage={canManage}
                      onOpen={handleOpenReport}
                      onFinalize={handleFinalize}
                      onExportPDF={handleExportPDF}
                      onExportPPTX={handleExportPPTX}
                      onExportWord={handleExportWord}
                      onExportExcel={handleExportExcel}
                      onDelete={handleDelete}
                      onCreateInitiatives={onCreateInitiatives}
                    />
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-slate-200 dark:border-navy-800 bg-slate-50/50 dark:bg-navy-900/50">
          <div className="flex items-center gap-6 text-[11px] text-slate-500 dark:text-slate-400 flex-wrap">
            <div className="flex items-center gap-1.5">
              <Edit3 size={12} className="text-slate-500 dark:text-slate-400" />
              <span>Draft - Editable</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 size={12} className="text-emerald-500" />
              <span>Final - Visible globally</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportsManagementPanel;
