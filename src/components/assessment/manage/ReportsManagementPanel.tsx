/**
 * ReportsManagementPanel - Professional reports management for assessments
 * Displays reports table with status, actions, and export options
 * Design follows TeamManagementPanel patterns (ClickUp-style)
 */

import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Edit3,
  Eye,
  FileOutput,
  FileText,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Upload,
} from 'lucide-react';
import { FC, useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import {
  type StandardRowMenu,
  StandardTable,
  type TableColumn as StandardTableColumn,
} from '@/components/standard';

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
    color: string;
    bgColor: string;
    borderColor: string;
    icon: FC<{ size?: number; className?: string }>;
  }
> = {
  DRAFT: {
    color: 'text-slate-600 dark:text-slate-400',
    bgColor: 'bg-slate-50 dark:bg-slate-500/10',
    borderColor: 'border-slate-200 dark:border-slate-500/30',
    icon: Edit3,
  },
  CONFIGURING: {
    color: 'text-slate-600 dark:text-slate-400',
    bgColor: 'bg-slate-50 dark:bg-slate-500/10',
    borderColor: 'border-slate-200 dark:border-slate-500/30',
    icon: Clock,
  },
  GENERATING: {
    color: 'text-amber-700 dark:text-amber-300',
    bgColor: 'bg-amber-50 dark:bg-amber-500/10',
    borderColor: 'border-amber-200 dark:border-amber-500/30',
    icon: Loader2,
  },
  GENERATED: {
    // Pułapka #1 (kanon): `primary`=crimson; status informacyjny → indygo, nie crimson.
    color: 'text-indigo-700 dark:text-indigo-300',
    bgColor: 'bg-indigo-50 dark:bg-indigo-500/10',
    borderColor: 'border-indigo-200 dark:border-indigo-500/30',
    icon: Sparkles,
  },
  IN_REVIEW: {
    color: 'text-blue-700 dark:text-blue-300',
    bgColor: 'bg-blue-50 dark:bg-blue-500/10',
    borderColor: 'border-blue-200 dark:border-blue-500/30',
    icon: Eye,
  },
  APPROVED: {
    color: 'text-emerald-600 dark:text-emerald-400',
    bgColor: 'bg-emerald-50 dark:bg-emerald-500/10',
    borderColor: 'border-emerald-200 dark:border-emerald-500/30',
    icon: CheckCircle2,
  },
  SENT_INTERNAL: {
    color: 'text-blue-700 dark:text-blue-300',
    bgColor: 'bg-blue-50 dark:bg-blue-500/10',
    borderColor: 'border-blue-200 dark:border-blue-500/30',
    icon: Upload,
  },
  SENT_EXTERNAL: {
    color: 'text-blue-700 dark:text-blue-300',
    bgColor: 'bg-blue-50 dark:bg-blue-500/10',
    borderColor: 'border-blue-200 dark:border-blue-500/30',
    icon: Upload,
  },
  UTILIZED: {
    color: 'text-emerald-600 dark:text-emerald-400',
    bgColor: 'bg-emerald-50 dark:bg-emerald-500/10',
    borderColor: 'border-emerald-200 dark:border-emerald-500/30',
    icon: FileOutput,
  },
  FINAL: {
    color: 'text-emerald-600 dark:text-emerald-400',
    bgColor: 'bg-emerald-50 dark:bg-emerald-500/10',
    borderColor: 'border-emerald-200 dark:border-emerald-500/30',
    icon: CheckCircle2,
  },
  ARCHIVED: {
    color: 'text-slate-500 dark:text-slate-400',
    bgColor: 'bg-slate-50 dark:bg-slate-500/10',
    borderColor: 'border-slate-200 dark:border-slate-500/30',
    icon: Clock,
  },
};

/** Wspólny formatter daty — 1:1 z dawnym formatDate wiersza tabeli (przed migracją do StandardTable). */
const formatReportDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('pl-PL', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

const EDITABLE_STATUSES: ReportStatus[] = ['DRAFT', 'CONFIGURING', 'GENERATING', 'GENERATED'];
const EXPORTABLE_STATUSES: ReportStatus[] = [
  'APPROVED',
  'SENT_INTERNAL',
  'SENT_EXTERNAL',
  'UTILIZED',
];
const DELETABLE_STATUSES: ReportStatus[] = ['DRAFT', 'CONFIGURING', 'GENERATED'];

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
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [creatingReport, setCreatingReport] = useState(false);

  const isApproved = workflowStatus === 'APPROVED';

  /**
   * Stan przebiegu/przeglądu z workbencha ('in_progress', 'not_started', …)
   * na etykietę PL/EN. Nieznany stan → dawne zachowanie (podkreślenia na spacje),
   * żeby nowe stany silnika nie znikały z ekranu.
   */
  const workbenchStateLabel = useCallback(
    (state: string): string =>
      t(`assessment.reportsManagePanel.workbenchState.${state}`, {
        defaultValue: String(state).replace(/_/g, ' '),
      }),
    [t]
  );

  /** „przebieg X • przegląd: w toku" — wspólne dla wiersza i nagłówka. */
  const provenanceSuffix = useCallback(
    (reviewState?: string | null, runState?: string | null): string => {
      if (reviewState) {
        return ` • ${t('assessment.reportsManagePanel.provenance.review', {
          state: workbenchStateLabel(String(reviewState)),
        })}`;
      }
      if (runState) {
        return ` • ${workbenchStateLabel(String(runState))}`;
      }
      return '';
    },
    [t, workbenchStateLabel]
  );

  // Fetch reports for this assessment from Report Builder API
  const fetchReports = useCallback(async () => {
    try {
      const response = await Api.get(
        `/report-builder?sourceType=ASSESSMENT&sourceId=${encodeURIComponent(assessmentId)}`
      );
      const apiReports = response?.reports || [];
      const mapped: Report[] = apiReports.map((r: any) => ({
        id: String(r.id),
        name: String(r.title || r.name || t('assessment.reportsManagePanel.defaultReportName')),
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
  }, [assessmentId, assessmentName, t]);

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
      toast.success(t('assessment.reportsManagePanel.toast.finalized'));
      await fetchReports();
    } catch (err) {
      toast.error(t('assessment.reportsManagePanel.toast.finalizeFailed'));
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
      toast.success(t('assessment.reportsManagePanel.toast.pdfExported'));
    } catch (err) {
      toast.error(t('assessment.reportsManagePanel.toast.pdfExportFailed'));
    }
  };

  const handleExportPPTX = async (reportId: string, reportName: string) => {
    try {
      await downloadExport('pptx', reportId, reportName);
      toast.success(t('assessment.reportsManagePanel.toast.pptxExported'));
    } catch (err) {
      toast.error(t('assessment.reportsManagePanel.toast.pptxExportFailed'));
    }
  };

  const handleExportWord = async (reportId: string, reportName: string) => {
    try {
      await downloadExport('doc', reportId, reportName);
      toast.success(t('assessment.reportsManagePanel.toast.wordExported'));
    } catch (err) {
      toast.error(t('assessment.reportsManagePanel.toast.wordExportFailed'));
    }
  };

  const handleExportExcel = async (reportId: string, reportName: string) => {
    try {
      await downloadExport('excel', reportId, reportName);
      toast.success(t('assessment.reportsManagePanel.toast.excelExported'));
    } catch (err) {
      toast.error(t('assessment.reportsManagePanel.toast.excelExportFailed'));
    }
  };

  const handleDelete = async (reportId: string) => {
    try {
      await Api.delete(`/report-builder/${reportId}`);
      toast.success(t('assessment.reportsManagePanel.toast.deleted'));
      await fetchReports();
    } catch (err: any) {
      toast.error(err?.error || t('assessment.reportsManagePanel.toast.deleteFailed'));
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

  // Triada standard (migracja bespoke tabeli, kanon TRIADA reguła #1): kolumny
  // deklaratywne StandardTable — 1:1 z dawnymi komórkami <ReportRow>.
  const columns: StandardTableColumn[] = useMemo(
    () => [
      {
        id: 'name',
        label: t('assessment.reportsManagePanel.columns.report'),
        width: '260px',
        render: (row) => {
          const report = row as unknown as Report;
          return (
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg shrink-0">
                <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-medium text-c-text truncate">{report.name}</div>
                <div className="text-xs text-c-text-muted truncate">{report.assessmentName}</div>
                {report.provenance?.assessmentRunId ? (
                  <div className="text-[10px] text-c-text-muted truncate">
                    {t('assessment.reportsManagePanel.provenance.run', {
                      run: report.provenance.assessmentRunId,
                    })}
                    {provenanceSuffix(
                      report.provenance.workbenchReviewState,
                      report.provenance.workbenchRunState
                    )}
                  </div>
                ) : null}
              </div>
            </div>
          );
        },
      },
      {
        id: 'author',
        label: t('assessment.reportsManagePanel.columns.author'),
        width: '110px',
        render: (row) => {
          const report = row as unknown as Report;
          const name = report.createdByName || report.createdBy || '?';
          return (
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-xs font-medium text-white shrink-0">
                {name
                  .split(' ')
                  .map((n) => n[0])
                  .join('')
                  .slice(0, 2)
                  .toUpperCase()}
              </div>
              <span className="text-sm text-c-text-secondary truncate">{name.split(' ')[0]}</span>
            </div>
          );
        },
      },
      {
        id: 'status',
        label: t('assessment.reportsManagePanel.columns.status'),
        width: '130px',
        render: (row) => {
          const report = row as unknown as Report;
          const statusKey: ReportStatus = STATUS_CONFIG[report.status] ? report.status : 'DRAFT';
          const cfg = STATUS_CONFIG[statusKey];
          const StatusIcon = cfg.icon;
          return (
            <div
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold ${cfg.bgColor} ${cfg.color} ${cfg.borderColor} border`}
            >
              <StatusIcon size={12} />
              {t(`assessment.reportsManagePanel.status.${statusKey}`)}
            </div>
          );
        },
      },
      {
        id: 'initiatives',
        label: t('assessment.reportsManagePanel.columns.initiatives'),
        width: '130px',
        render: (row) => {
          const report = row as unknown as Report;
          if (!report.initiativesGenerated) {
            return <span className="text-xs text-c-text-muted">—</span>;
          }
          return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
              <Sparkles size={12} />
              {t('assessment.reportsManagePanel.initiativesGenerated', {
                count: report.initiativesCount,
              })}
            </span>
          );
        },
      },
      {
        id: 'updatedAt',
        label: t('assessment.reportsManagePanel.columns.updated'),
        width: '110px',
        sortable: true,
        render: (row) => {
          const report = row as unknown as Report;
          return (
            <span className="text-xs text-c-text-muted">{formatReportDate(report.updatedAt)}</span>
          );
        },
      },
    ],
    [t, provenanceSuffix]
  );

  // Triada standard (StandardTable rowMenu contract, ANEKS #4): moduł deklaruje
  // TYLKO bloki 1-3; StandardTable SAM dokłada bloki 4 (Open preview · Edit ·
  // Archive) i 5 (Delete). 1:1 z dawnym dropdownem "More Actions" wiersza.
  const buildRowMenu = useCallback(
    (report: Report): StandardRowMenu => {
      const editable = EDITABLE_STATUSES.includes(report.status);
      const exportable = EXPORTABLE_STATUSES.includes(report.status);
      const deletable = DELETABLE_STATUSES.includes(report.status) && canManage;
      const openReport = () => handleOpenReport(report.id, report.name, report.status);

      const primary: NonNullable<StandardRowMenu['primary']> = [];
      if (editable && canManage) {
        if (report.status === 'GENERATED') {
          primary.push({
            id: 'finalize',
            label: t('assessment.reportsManagePanel.menu.submitReview'),
            icon: ArrowRight,
            onClick: () => {
              void (async () => {
                try {
                  await handleFinalize(report.id);
                } catch {
                  /* toast already surfaced inside handleFinalize */
                }
              })();
            },
          });
        } else {
          primary.push({
            id: 'edit',
            label: t('assessment.reportsManagePanel.menu.editReport'),
            icon: Edit3,
            onClick: openReport,
          });
        }
      } else if (report.status === 'IN_REVIEW') {
        primary.push({
          id: 'review',
          label: t('assessment.reportsManagePanel.menu.review'),
          icon: Eye,
          onClick: openReport,
        });
      } else {
        primary.push({
          id: 'view',
          label: t('assessment.reportsManagePanel.menu.viewReport'),
          icon: Eye,
          onClick: openReport,
        });
      }

      if (exportable) {
        primary.push(
          {
            id: 'export-pdf',
            label: t('assessment.reportsManagePanel.menu.exportPdf'),
            icon: FileText,
            onClick: () => {
              void handleExportPDF(report.id, report.name);
            },
          },
          {
            id: 'export-pptx',
            label: t('assessment.reportsManagePanel.menu.exportPptx'),
            icon: FileOutput,
            onClick: () => {
              void handleExportPPTX(report.id, report.name);
            },
          },
          {
            id: 'export-word',
            label: t('assessment.reportsManagePanel.menu.exportWord'),
            icon: FileText,
            onClick: () => {
              void handleExportWord(report.id, report.name);
            },
          }
        );
      }

      return {
        primary,
        universalHandlers: {
          preview: openReport,
          edit: editable && canManage ? openReport : undefined,
          // Brak API archiwizacji raportu z poziomu tego panelu — disabled z
          // notą (StandardTable dokłada ją sama, blok 4).
        },
        destructive: deletable
          ? {
              onClick: () => {
                if (
                  !confirm(t('assessment.reportsManagePanel.confirmDelete', { name: report.name }))
                )
                  return;
                void (async () => {
                  try {
                    await handleDelete(report.id);
                  } catch {
                    /* toast already surfaced inside handleDelete */
                  }
                })();
              },
            }
          : {},
      };
    },
    [
      t,
      canManage,
      handleOpenReport,
      handleFinalize,
      handleExportPDF,
      handleExportPPTX,
      handleExportWord,
      handleDelete,
    ]
  );

  return (
    <div className="space-y-4">
      {/* Header Card */}
      <div className="rounded-xl border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 dark:border-navy-800 bg-slate-50/50 dark:bg-navy-900/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 text-white rounded-lg">
                <FileText size={18} />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  {t('assessment.reportsManagePanel.header.title')}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {t('assessment.reportsManagePanel.header.summary', {
                    total: stats.total,
                    draft: stats.draft,
                    inReview: stats.inReview,
                    approved: stats.approved,
                  })}
                </p>
                {latestRunReadback?.assessmentRunId ? (
                  <p className="mt-1 text-[11px] text-slate-600 dark:text-slate-500">
                    {t('assessment.reportsManagePanel.header.laneReadback', {
                      run: latestRunReadback.assessmentRunId,
                    })}
                    {provenanceSuffix(
                      latestRunReadback.workbenchReviewState,
                      latestRunReadback.workbenchRunState
                    )}
                  </p>
                ) : null}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                title={t('assessment.reportsManagePanel.header.refresh')}
                aria-label={t('assessment.reportsManagePanel.header.refresh')}
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
                      ? 'bg-navy-900 dark:bg-[#F4F7FB] hover:bg-navy-800 dark:hover:bg-[#DDE5EF] text-white dark:text-navy-950'
                      : 'bg-slate-200 dark:bg-navy-700 text-slate-500 dark:text-slate-400 cursor-not-allowed'
                  }`}
                  title={
                    !onCreateReport
                      ? t('assessment.reportsManagePanel.header.newReportUnavailable')
                      : undefined
                  }
                >
                  <Plus size={16} />
                  {t('assessment.reportsManagePanel.header.newReport')}
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
                {t('assessment.reportsManagePanel.note.text')}{' '}
                <strong>{t('assessment.reportsManagePanel.note.emphasis')}</strong>.
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
                {t('assessment.reportsManagePanel.stats.total', { count: stats.total })}
              </span>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30">
              <Edit3 size={14} className="text-amber-600 dark:text-amber-400" />
              <span className="text-sm font-medium text-amber-700 dark:text-amber-300">
                {t('assessment.reportsManagePanel.stats.inProgress', { count: stats.draft })}
              </span>
            </div>
            {/* Pułapka #1 (kanon): `primary`=crimson; stat informacyjny → niebieski, nie crimson. */}
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30">
              <Eye size={14} className="text-blue-600 dark:text-blue-400" />
              <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                {t('assessment.reportsManagePanel.stats.inReview', { count: stats.inReview })}
              </span>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30">
              <CheckCircle2 size={14} className="text-emerald-600 dark:text-emerald-400" />
              <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                {t('assessment.reportsManagePanel.stats.approved', { count: stats.approved })}
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
              placeholder={t('assessment.reportsManagePanel.search.placeholder')}
              className="w-full h-10 pl-10 pr-4 rounded-lg border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-800 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-c-focus/30 focus:border-c-focus transition-colors"
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
                {searchQuery
                  ? t('assessment.reportsManagePanel.empty.noMatchTitle')
                  : t('assessment.reportsManagePanel.empty.noneTitle')}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {isApproved
                  ? t('assessment.reportsManagePanel.empty.approvedDesc')
                  : t('assessment.reportsManagePanel.empty.notApprovedDesc')}
              </p>
              {isApproved && canManage && (
                <button
                  onClick={handleCreateReport}
                  disabled={creatingReport || !onCreateReport}
                  className="mt-4 flex items-center gap-2 px-4 py-2 rounded-lg bg-navy-900 dark:bg-[#F4F7FB] hover:bg-navy-800 dark:hover:bg-[#DDE5EF] text-white dark:text-navy-950 text-sm font-semibold transition-colors disabled:opacity-50"
                >
                  {creatingReport ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Plus size={16} />
                  )}
                  {t('assessment.reportsManagePanel.empty.createFirst')}
                </button>
              )}
            </div>
          ) : (
            <StandardTable
              columns={columns}
              data={filteredReports as unknown as Array<Record<string, unknown> & { id: string }>}
              onRowDoubleClick={(row) => {
                const report = row as unknown as Report;
                handleOpenReport(report.id, report.name, report.status);
              }}
              rowDescription={() => null}
              persistKey="assessment.manage.reports.list"
              density="compact"
              canvasClassName="p-0"
              rowMenu={(row) => buildRowMenu(row as unknown as Report)}
            />
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-slate-200 dark:border-navy-800 bg-slate-50/50 dark:bg-navy-900/50">
          <div className="flex items-center gap-6 text-[11px] text-slate-500 dark:text-slate-400 flex-wrap">
            <div className="flex items-center gap-1.5">
              <Edit3 size={12} className="text-slate-500 dark:text-slate-400" />
              <span>{t('assessment.reportsManagePanel.footer.draft')}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 size={12} className="text-emerald-500" />
              <span>{t('assessment.reportsManagePanel.footer.final')}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportsManagementPanel;
