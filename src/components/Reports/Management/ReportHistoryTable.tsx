/**
 * Report History Table Component
 * Shows archive of generated reports with filters
 */

import {
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Download,
  Eye,
  FileText,
  Filter,
  Share2,
  User,
} from 'lucide-react';
import React from 'react';

import {
  ManagementReportScope,
  ManagementReportStatus,
  ManagementReportType,
} from '../../../types';
import { ReportHistoryRowSkeleton } from './shared/ReportSkeleton';

interface ReportHistoryItem {
  id: string;
  title: string;
  reportType: ManagementReportType;
  scope: ManagementReportScope;
  status: ManagementReportStatus;
  generatedBy: string;
  generatedByName: string;
  projectName?: string;
  createdAt: string;
  pdfPath?: string;
  pptxPath?: string;
  versionNumber?: number;
  versionLabel?: string;
}

interface ReportHistoryTableProps {
  reports: ReportHistoryItem[];
  loading?: boolean;
  filters?: {
    reportType?: ManagementReportType;
    scope?: ManagementReportScope;
    status?: ManagementReportStatus;
  };
  onFilterChange?: (filters: {
    reportType?: ManagementReportType;
    scope?: ManagementReportScope;
    status?: ManagementReportStatus;
  }) => void;
  // Pagination props
  page?: number;
  pageSize?: number;
  total?: number;
  onPageChange?: (page: number) => void;
  // Action handlers
  onViewReport?: (reportId: string) => void;
  onDownloadPDF?: (reportId: string) => void;
  onDownloadPPTX?: (reportId: string) => void;
  onShare?: (reportId: string) => void;
  /** B5.4: Rename report callback */
  onRenameReport?: (reportId: string, newTitle: string) => void;
  className?: string;
}

const reportTypeLabels = {
  TEAM_MEETING: {
    label: 'Team Meeting',
    color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  },
  TEAM_WEEKLY: {
    label: 'Team Weekly',
    color: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
  },
  STEERING_COMMITTEE: {
    label: 'Steering Committee',
    color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
  },
  PORTFOLIO_HEALTH: {
    label: 'Portfolio Health',
    color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  },
  RAID: {
    label: 'Risk/Assumption/Issue/Dependency',
    color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  },
};

const scopeLabels = {
  PROJECT: {
    label: 'Project',
    color: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
  },
  PORTFOLIO: {
    label: 'Portfolio',
    color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  },
};

const statusLabels: Record<ManagementReportStatus, { label: string; color: string }> = {
  DRAFT: {
    label: 'Draft',
    color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  },
  FINAL: {
    label: 'Final',
    color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  },
  APPROVED: {
    label: 'Approved',
    color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  },
  ARCHIVED: {
    label: 'Archived',
    color: 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400',
  },
};

export const ReportHistoryTable: React.FC<ReportHistoryTableProps> = ({
  reports,
  loading = false,
  filters = {},
  onFilterChange,
  page = 1,
  pageSize = 10,
  total = 0,
  onPageChange,
  onViewReport,
  onDownloadPDF,
  onDownloadPPTX,
  onShare,
  onRenameReport,
  className = '',
}) => {
  const totalPages = Math.ceil(total / pageSize);
  const canGoPrev = page > 1;
  const canGoNext = page < totalPages;

  const handlePageChange = (newPage: number) => {
    if (onPageChange && newPage >= 1 && newPage <= totalPages) {
      onPageChange(newPage);
    }
  };
  return (
    <div
      className={`bg-c-surface rounded-xl border border-c-border-subtle overflow-hidden ${className}`}
    >
      {/* Header with filters */}
      <div className="px-4 py-3 border-b border-c-border-subtle flex flex-wrap items-center justify-between gap-4">
        <h3 className="font-semibold text-c-text flex items-center gap-2">
          <FileText size={18} />
          Report History
          <span className="px-2 py-0.5 text-xs font-medium bg-c-surface-raised rounded-full">
            {total || reports.length}
          </span>
        </h3>

        {onFilterChange && (
          <div className="flex items-center gap-2">
            <Filter size={14} className="text-c-text-muted" />

            {/* Type Filter */}
            <div className="relative">
              <select
                value={filters.reportType || ''}
                onChange={(e) =>
                  onFilterChange({
                    ...filters,
                    reportType: (e.target.value as ManagementReportType) || undefined,
                  })
                }
                className="appearance-none pl-3 pr-8 py-1.5 text-sm bg-c-surface border border-c-border rounded-lg focus:outline-none focus:ring-2 focus:ring-c-focus"
              >
                <option value="">All Types</option>
                <option value="TEAM_MEETING">Team Meeting</option>
                <option value="TEAM_WEEKLY">Team Weekly</option>
                <option value="STEERING_COMMITTEE">Steering Committee</option>
                <option value="PORTFOLIO_HEALTH">Portfolio Health</option>
                <option value="RAID">Risk/Assumption/Issue/Dependency</option>
              </select>
              <ChevronDown
                size={14}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-c-text-muted pointer-events-none"
              />
            </div>

            {/* Scope Filter */}
            <div className="relative">
              <select
                value={filters.scope || ''}
                onChange={(e) =>
                  onFilterChange({
                    ...filters,
                    scope: (e.target.value as ManagementReportScope) || undefined,
                  })
                }
                className="appearance-none pl-3 pr-8 py-1.5 text-sm bg-c-surface border border-c-border rounded-lg focus:outline-none focus:ring-2 focus:ring-c-focus"
              >
                <option value="">All Scopes</option>
                <option value="PROJECT">Project</option>
                <option value="PORTFOLIO">Portfolio</option>
              </select>
              <ChevronDown
                size={14}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-c-text-muted pointer-events-none"
              />
            </div>

            {/* Status Filter */}
            <div className="relative">
              <select
                value={filters.status || ''}
                onChange={(e) =>
                  onFilterChange({
                    ...filters,
                    status: (e.target.value as ManagementReportStatus) || undefined,
                  })
                }
                className="appearance-none pl-3 pr-8 py-1.5 text-sm bg-c-surface border border-c-border rounded-lg focus:outline-none focus:ring-2 focus:ring-c-focus"
              >
                <option value="">All Status</option>
                <option value="DRAFT">Draft</option>
                <option value="FINAL">Final</option>
                <option value="ARCHIVED">Archived</option>
              </select>
              <ChevronDown
                size={14}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-c-text-muted pointer-events-none"
              />
            </div>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        {loading ? (
          <table /* §27-exempt: tabela dokumentowa/raportowa read-only, do druku/eksportu */  className="w-full">
            <thead>
              <tr className="bg-c-surface-raised">
                <th className="px-4 py-3 text-left text-xs font-medium text-c-text-muted uppercase tracking-wider">
                  Title
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-c-text-muted uppercase tracking-wider w-16">
                  Ver.
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-c-text-muted uppercase tracking-wider">
                  Type
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-c-text-muted uppercase tracking-wider">
                  Scope
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-c-text-muted uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-c-text-muted uppercase tracking-wider">
                  Generated
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-c-text-muted uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-c-border-subtle">
              {[1, 2, 3, 4, 5].map((i) => (
                <ReportHistoryRowSkeleton key={i} />
              ))}
            </tbody>
          </table>
        ) : reports.length === 0 ? (
          <div className="p-8 text-center">
            <FileText size={48} className="mx-auto text-c-text-muted mb-3" />
            <p className="text-c-text-muted">No reports found.</p>
            <p className="text-sm text-c-text-muted">
              Generate your first report to see it here.
            </p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="bg-c-surface-raised">
                <th className="px-4 py-3 text-left text-xs font-medium text-c-text-muted uppercase tracking-wider">
                  Title
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-c-text-muted uppercase tracking-wider w-16">
                  Ver.
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-c-text-muted uppercase tracking-wider">
                  Type
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-c-text-muted uppercase tracking-wider">
                  Scope
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-c-text-muted uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-c-text-muted uppercase tracking-wider">
                  Generated
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-c-text-muted uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-c-border-subtle">
              {reports.map((report) => {
                const typeBadge =
                  reportTypeLabels[report.reportType] || reportTypeLabels.TEAM_MEETING;
                return (
                  <tr
                    key={report.id}
                    className="hover:bg-c-surface-raised transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div>
                        <div className="font-medium text-c-text">
                          {report.title}
                        </div>
                        {report.projectName && (
                          <div className="text-sm text-c-text-muted">
                            {report.projectName}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-mono font-medium bg-c-surface-raised text-c-text-secondary rounded">
                        v{report.versionLabel || report.versionNumber || '1.0'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-1 text-xs font-medium rounded ${typeBadge.color}`}>
                        {typeBadge.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded ${scopeLabels[report.scope]?.color}`}
                      >
                        {scopeLabels[report.scope]?.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded ${statusLabels[report.status]?.color}`}
                      >
                        {statusLabels[report.status]?.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 text-sm text-c-text-secondary">
                        <Calendar size={14} className="text-c-text-muted" />
                        {new Date(report.createdAt).toLocaleDateString()}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-c-text-muted mt-1">
                        <User size={12} />
                        {report.generatedByName}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        {onViewReport && (
                          <button
                            onClick={() => onViewReport(report.id)}
                            className="p-2 hover:bg-c-surface-raised rounded-lg transition-colors"
                            title="View report"
                          >
                            <Eye size={16} className="text-c-text-muted" />
                          </button>
                        )}
                        {onDownloadPDF && report.pdfPath && (
                          <button
                            onClick={() => onDownloadPDF(report.id)}
                            className="p-2 hover:bg-c-surface-raised rounded-lg transition-colors"
                            title="Download PDF"
                          >
                            <FileText size={16} className="text-c-text-muted" />
                          </button>
                        )}
                        {onDownloadPPTX && report.pptxPath && (
                          <button
                            onClick={() => onDownloadPPTX(report.id)}
                            className="p-2 hover:bg-c-surface-raised rounded-lg transition-colors"
                            title="Download PPTX"
                          >
                            <Download size={16} className="text-c-text-muted" />
                          </button>
                        )}
                        {onShare && (
                          <button
                            onClick={() => onShare(report.id)}
                            className="p-2 hover:bg-c-surface-raised rounded-lg transition-colors"
                            title="Share"
                          >
                            <Share2 size={16} className="text-c-text-muted" />
                          </button>
                        )}
                        {/* B5.4: Rename report */}
                        {onRenameReport && (
                          <button
                            onClick={() => {
                              const newTitle = window.prompt('Rename report:', report.title);
                              if (newTitle && newTitle.trim() && newTitle !== report.title) {
                                onRenameReport(report.id, newTitle.trim());
                              }
                            }}
                            className="p-2 hover:bg-c-surface-raised rounded-lg transition-colors"
                            title="Rename"
                          >
                            <FileText size={16} className="text-c-text-muted" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination Footer */}
      {totalPages > 1 && !loading && (
        <div className="px-4 py-3 border-t border-c-border-subtle flex items-center justify-between">
          <div className="text-sm text-c-text-muted">
            Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, total)} of {total}{' '}
            reports
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => handlePageChange(1)}
              disabled={!canGoPrev}
              className="p-2 hover:bg-c-surface-raised rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              title="First page"
            >
              <ChevronsLeft size={16} className="text-c-text-muted" />
            </button>
            <button
              onClick={() => handlePageChange(page - 1)}
              disabled={!canGoPrev}
              className="p-2 hover:bg-c-surface-raised rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              title="Previous page"
            >
              <ChevronLeft size={16} className="text-c-text-muted" />
            </button>

            {/* Page numbers */}
            <div className="flex items-center gap-1 px-2">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum: number;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (page <= 3) {
                  pageNum = i + 1;
                } else if (page >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = page - 2 + i;
                }
                return (
                  <button
                    key={pageNum}
                    onClick={() => handlePageChange(pageNum)}
                    className={`min-w-[32px] h-8 px-2 rounded-lg text-sm font-medium transition-colors ${
                      page === pageNum
                        ? 'bg-c-text text-c-surface'
                        : 'hover:bg-c-surface-raised text-c-text-secondary'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => handlePageChange(page + 1)}
              disabled={!canGoNext}
              className="p-2 hover:bg-c-surface-raised rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              title="Next page"
            >
              <ChevronRight size={16} className="text-c-text-muted" />
            </button>
            <button
              onClick={() => handlePageChange(totalPages)}
              disabled={!canGoNext}
              className="p-2 hover:bg-c-surface-raised rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              title="Last page"
            >
              <ChevronsRight size={16} className="text-c-text-muted" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReportHistoryTable;
