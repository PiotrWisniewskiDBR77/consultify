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
  className?: string;
}

const reportTypeLabels = {
  TEAM_MEETING: {
    label: 'Team Meeting',
    color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  },
  STEERING_COMMITTEE: {
    label: 'Steering Committee',
    color: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
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

const statusLabels = {
  DRAFT: {
    label: 'Draft',
    color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  },
  FINAL: {
    label: 'Final',
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
      className={`bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 overflow-hidden ${className}`}
    >
      {/* Header with filters */}
      <div className="px-4 py-3 border-b border-slate-100 dark:border-navy-700 flex flex-wrap items-center justify-between gap-4">
        <h3 className="font-semibold text-navy-900 dark:text-white flex items-center gap-2">
          <FileText size={18} />
          Report History
          <span className="px-2 py-0.5 text-xs font-medium bg-slate-100 dark:bg-navy-800/40 dark:bg-white/10 rounded-full">
            {total || reports.length}
          </span>
        </h3>

        {onFilterChange && (
          <div className="flex items-center gap-2">
            <Filter size={14} className="text-slate-400 dark:text-slate-500" />

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
                className="appearance-none pl-3 pr-8 py-1.5 text-sm bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
              >
                <option value="">All Types</option>
                <option value="TEAM_MEETING">Team Meeting</option>
                <option value="STEERING_COMMITTEE">Steering Committee</option>
              </select>
              <ChevronDown
                size={14}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none"
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
                className="appearance-none pl-3 pr-8 py-1.5 text-sm bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
              >
                <option value="">All Scopes</option>
                <option value="PROJECT">Project</option>
                <option value="PORTFOLIO">Portfolio</option>
              </select>
              <ChevronDown
                size={14}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none"
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
                className="appearance-none pl-3 pr-8 py-1.5 text-sm bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
              >
                <option value="">All Status</option>
                <option value="DRAFT">Draft</option>
                <option value="FINAL">Final</option>
                <option value="ARCHIVED">Archived</option>
              </select>
              <ChevronDown
                size={14}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none"
              />
            </div>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        {loading ? (
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 dark:bg-navy-800/50">
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Title
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Scope
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Generated
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {[1, 2, 3, 4, 5].map((i) => (
                <ReportHistoryRowSkeleton key={i} />
              ))}
            </tbody>
          </table>
        ) : reports.length === 0 ? (
          <div className="p-8 text-center">
            <FileText size={48} className="mx-auto text-slate-300 dark:text-slate-600 mb-3" />
            <p className="text-slate-500 dark:text-slate-400">No reports found.</p>
            <p className="text-sm text-slate-400 dark:text-slate-500">
              Generate your first report to see it here.
            </p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 dark:bg-navy-800/50">
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Title
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Scope
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Generated
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {reports.map((report) => (
                <tr
                  key={report.id}
                  className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                >
                  <td className="px-4 py-3">
                    <div>
                      <div className="font-medium text-navy-900 dark:text-white">
                        {report.title}
                      </div>
                      {report.projectName && (
                        <div className="text-sm text-slate-500 dark:text-slate-400">
                          {report.projectName}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded ${reportTypeLabels[report.reportType]?.color}`}
                    >
                      {reportTypeLabels[report.reportType]?.label}
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
                    <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                      <Calendar size={14} className="text-slate-400 dark:text-slate-500" />
                      {new Date(report.createdAt).toLocaleDateString()}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-1">
                      <User size={12} />
                      {report.generatedByName}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      {onViewReport && (
                        <button
                          onClick={() => onViewReport(report.id)}
                          className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors"
                          title="View report"
                        >
                          <Eye size={16} className="text-slate-500 dark:text-slate-400" />
                        </button>
                      )}
                      {onDownloadPDF && report.pdfPath && (
                        <button
                          onClick={() => onDownloadPDF(report.id)}
                          className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                          title="Download PDF"
                        >
                          <FileText size={16} className="text-red-500" />
                        </button>
                      )}
                      {onDownloadPPTX && report.pptxPath && (
                        <button
                          onClick={() => onDownloadPPTX(report.id)}
                          className="p-2 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded-lg transition-colors"
                          title="Download PPTX"
                        >
                          <Download size={16} className="text-orange-500" />
                        </button>
                      )}
                      {onShare && (
                        <button
                          onClick={() => onShare(report.id)}
                          className="p-2 hover:bg-violet-50 dark:hover:bg-violet-900/20 rounded-lg transition-colors"
                          title="Share"
                        >
                          <Share2 size={16} className="text-violet-500" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination Footer */}
      {totalPages > 1 && !loading && (
        <div className="px-4 py-3 border-t border-slate-100 dark:border-navy-700 flex items-center justify-between">
          <div className="text-sm text-slate-500 dark:text-slate-400">
            Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, total)} of {total}{' '}
            reports
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => handlePageChange(1)}
              disabled={!canGoPrev}
              className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              title="First page"
            >
              <ChevronsLeft size={16} className="text-slate-500 dark:text-slate-400" />
            </button>
            <button
              onClick={() => handlePageChange(page - 1)}
              disabled={!canGoPrev}
              className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              title="Previous page"
            >
              <ChevronLeft size={16} className="text-slate-500 dark:text-slate-400" />
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
                        ? 'bg-violet-500 text-white'
                        : 'hover:bg-slate-100 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300'
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
              className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              title="Next page"
            >
              <ChevronRight size={16} className="text-slate-500 dark:text-slate-400" />
            </button>
            <button
              onClick={() => handlePageChange(totalPages)}
              disabled={!canGoNext}
              className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              title="Last page"
            >
              <ChevronsRight size={16} className="text-slate-500 dark:text-slate-400" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReportHistoryTable;
