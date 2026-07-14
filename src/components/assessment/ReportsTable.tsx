/**
 * ReportsTable
 *
 * Global reports table for Assessment module:
 * - Shows only reports that have reached IN_REVIEW status or higher
 * - All assessment reports across all assessments
 * - Uses Report Builder API
 *
 * Reports created from approved assessments first appear in the assessment's
 * Manager → Reports panel. Once they reach IN_REVIEW status, they also
 * appear here in this global view.
 */

import {
  ArrowRight,
  CheckCircle2,
  Clock,
  Edit3,
  Eye,
  FileOutput,
  FileText,
  Lightbulb,
  Link2,
  Loader2,
  RefreshCw,
  Search,
  Send,
  Settings2,
  Sparkles,
  Upload,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import {
  type StandardRowMenu,
  StandardTable,
  type TableColumn as StandardTableColumn,
} from '@/components/standard';

import { Api } from '../../services/api';
import { ImportReportModal } from '../Reports/ImportReportModal';
import { LoadingState } from '../ui/primitives';

// ============================================
// Types
// ============================================

type ReportStatus =
  | 'DRAFT'
  | 'CONFIGURING'
  | 'GENERATING'
  | 'GENERATED'
  | 'IN_REVIEW'
  | 'APPROVED'
  | 'SENT_INTERNAL'
  | 'SENT_EXTERNAL'
  | 'UTILIZED';

interface Report {
  id: string;
  name: string;
  sourceType: string;
  sourceId: string;
  sourceName: string;
  status: ReportStatus;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  createdByName?: string;
  canGenerateInitiatives: boolean;
  initiativesGenerated: boolean;
  initiativesCount: number;
}

// Statuses visible in this global table (IN_REVIEW and above)
const VISIBLE_STATUSES: ReportStatus[] = [
  'IN_REVIEW',
  'APPROVED',
  'SENT_INTERNAL',
  'SENT_EXTERNAL',
  'UTILIZED',
];

type FilterStatus = 'all' | 'draft' | 'generated' | 'in_review' | 'approved' | 'sent';

type AssessmentFramework = 'DRD' | 'SIRI' | 'ADMA' | 'CMMI' | 'LEAN';

interface ReportsTableProps {
  projectId: string;
  framework?: AssessmentFramework;
  onCreateInitiatives: (reportId: string) => void;
  pendingAssessmentId?: string | null;
  onOpenReport?: (reportId: string, reportName: string, status?: string) => void;
  /** When true, show all reports across source types and statuses (Admin “Kreator raportów”). */
  showAllStatuses?: boolean;
  /** Callback to open the template editor (ReportEditor in template mode). */
  onCreateTemplate?: () => void;
}

// ============================================
// Status Config
// ============================================

const STATUS_CONFIG: Record<
  ReportStatus,
  {
    label: string;
    color: string;
    bgColor: string;
    borderColor: string;
    icon: React.FC<{ size?: number; className?: string }>;
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
    // Pułapka #1 (kanon): `primary`=crimson; status informacyjny → indygo, nie crimson.
    color: 'text-indigo-700 dark:text-indigo-300',
    bgColor: 'bg-indigo-50 dark:bg-indigo-500/10',
    borderColor: 'border-indigo-200 dark:border-indigo-500/30',
    icon: FileText,
  },
  IN_REVIEW: {
    label: 'In Review',
    // Pułapka #1 (kanon): `primary`=crimson; „w przeglądzie" to nie stan krytyczny → niebieski.
    color: 'text-blue-700 dark:text-blue-300',
    bgColor: 'bg-blue-50 dark:bg-blue-500/10',
    borderColor: 'border-blue-200 dark:border-blue-500/30',
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
    label: 'Sent Internal',
    color: 'text-blue-700 dark:text-blue-300',
    bgColor: 'bg-blue-50 dark:bg-blue-500/10',
    borderColor: 'border-blue-200 dark:border-blue-500/30',
    icon: Send,
  },
  SENT_EXTERNAL: {
    label: 'Sent External',
    color: 'text-blue-700 dark:text-blue-300',
    bgColor: 'bg-blue-50 dark:bg-blue-500/10',
    borderColor: 'border-blue-200 dark:border-blue-500/30',
    icon: ArrowRight,
  },
  UTILIZED: {
    label: 'Utilized',
    color: 'text-indigo-700 dark:text-indigo-300',
    bgColor: 'bg-indigo-50 dark:bg-indigo-500/10',
    borderColor: 'border-indigo-200 dark:border-indigo-500/30',
    icon: Sparkles,
  },
};

// ============================================
// Main Component
// ============================================

export const ReportsTable: React.FC<ReportsTableProps> = ({
  projectId,
  onCreateInitiatives,
  onOpenReport,
  showAllStatuses = false,
  onCreateTemplate,
}) => {
  const { i18n, t } = useTranslation();
  const isPolish = i18n.language === 'pl';
  const navigate = useNavigate();

  // State
  const [reports, setReports] = useState<Report[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [showImportModal, setShowImportModal] = useState(false);

  // Fetch reports from Report Builder API
  const fetchReports = useCallback(async () => {
    setIsLoading(true);
    try {
      // Build query – when showAllStatuses is true, fetch all reports (all sources + statuses)
      const queryParts: string[] = [];
      if (!showAllStatuses) {
        queryParts.push(`sourceType=ASSESSMENT`);
        queryParts.push(`statusIn=${VISIBLE_STATUSES.join(',')}`);
      }
      const qs = queryParts.length > 0 ? `?${queryParts.join('&')}` : '';
      const response = await Api.get(`/report-builder${qs}`);
      const apiReports = response?.reports || [];

      // Map API response to component's expected format
      const mappedReports: Report[] = apiReports.map((r: any) => ({
        id: String(r.id),
        name: String(r.title || r.name || 'Report'),
        sourceType: String(r.sourceType || ''),
        sourceId: String(r.sourceId || ''),
        sourceName: String(r.sourceName || ''),
        status: r.status as ReportStatus,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
        createdBy: r.createdByName || r.createdBy || '',
        createdByName: r.createdByName,
        canGenerateInitiatives:
          r.status === 'APPROVED' || r.status === 'SENT_INTERNAL' || r.status === 'SENT_EXTERNAL',
        initiativesGenerated: Number(r.initiativesCount || 0) > 0,
        initiativesCount: Number(r.initiativesCount || 0),
      }));

      setReports(mappedReports);
    } catch (err) {
      console.error('[ReportsTable] Error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [showAllStatuses]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  // Approve report
  const handleApproveReport = async (reportId: string) => {
    try {
      await Api.post(`/report-builder/${reportId}/approve`, {});
      toast.success(isPolish ? 'Raport zatwierdzony' : 'Report approved');
      await fetchReports();
    } catch (err) {
      console.error('[ReportsTable] Approve error:', err);
      toast.error(isPolish ? 'Nie udało się zatwierdzić raportu' : 'Failed to approve report');
    }
  };

  // Mark as sent internally
  const handleMarkSentInternal = async (reportId: string) => {
    try {
      await Api.post(`/report-builder/${reportId}/mark-sent-internal`, {});
      toast.success(isPolish ? 'Oznaczono jako wysłany wewnętrznie' : 'Marked as sent internally');
      await fetchReports();
    } catch (err) {
      console.error('[ReportsTable] Mark sent internal error:', err);
      toast.error(
        isPolish ? 'Nie udało się oznaczyć jako wysłany' : 'Failed to mark as sent internally'
      );
    }
  };

  // Mark as sent externally
  const handleMarkSentExternal = async (reportId: string) => {
    try {
      await Api.post(`/report-builder/${reportId}/mark-sent-external`, {});
      toast.success(isPolish ? 'Oznaczono jako wysłany zewnętrznie' : 'Marked as sent externally');
      await fetchReports();
    } catch (err) {
      console.error('[ReportsTable] Mark sent external error:', err);
      toast.error(
        isPolish ? 'Nie udało się oznaczyć jako wysłany' : 'Failed to mark as sent externally'
      );
    }
  };

  // Send back to draft
  const handleSendBack = async (reportId: string) => {
    try {
      await Api.post(`/report-builder/${reportId}/send-back`, {});
      toast.success(isPolish ? 'Raport odesłany do edycji' : 'Report sent back for editing');
      await fetchReports();
    } catch (err) {
      console.error('[ReportsTable] Send back error:', err);
      toast.error(isPolish ? 'Nie udało się odesłać raportu' : 'Failed to send report back');
    }
  };

  const handleExport = async (
    reportId: string,
    reportName: string,
    format: 'pdf' | 'pptx' | 'doc'
  ) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/report-builder/${reportId}/export/${format}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const safe = reportName.replace(/[^\p{L}\p{N}_-]+/gu, '_');
        const ext = format === 'doc' ? 'doc' : format;
        a.download = `${safe}_Report.${ext}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        toast.success(
          isPolish
            ? `Eksport ${format.toUpperCase()} zakończony`
            : `${format.toUpperCase()} export completed`
        );
      } else {
        console.error('Export failed');
        toast.error(isPolish ? 'Nie udało się wyeksportować' : 'Failed to export');
      }
    } catch (err) {
      console.error('[ReportsTable] Export error:', err);
      toast.error(isPolish ? 'Błąd eksportu' : 'Export error');
    }
  };

  const handleExportPDF = (reportId: string, reportName: string) =>
    handleExport(reportId, reportName, 'pdf');
  const handleExportPPTX = (reportId: string, reportName: string) =>
    handleExport(reportId, reportName, 'pptx');
  const handleExportWord = (reportId: string, reportName: string) =>
    handleExport(reportId, reportName, 'doc');

  const handleCreateShareLink = async (reportId: string) => {
    try {
      const resp = await Api.post(`/report-builder/${reportId}/share`, {
        showCompanyLogo: true,
        showConsultifyBranding: true,
      });
      const link = resp?.link;
      const url = link?.url ? `${window.location.origin}${String(link.url)}` : '';
      if (url) {
        await navigator.clipboard.writeText(url);
        toast.success(isPolish ? 'Link skopiowany' : 'Link copied');
      } else {
        toast.success(isPolish ? 'Link utworzony' : 'Link created');
      }
    } catch (e: any) {
      toast.error(e?.message || (isPolish ? 'Błąd tworzenia linku' : 'Failed to create link'));
    }
  };

  // Filter reports
  const filteredReports = useMemo(() => {
    return reports.filter((report) => {
      // Status filter
      if (filterStatus !== 'all') {
        if (
          filterStatus === 'draft' &&
          !['DRAFT', 'CONFIGURING', 'GENERATING'].includes(report.status)
        )
          return false;
        if (filterStatus === 'generated' && report.status !== 'GENERATED') return false;
        if (filterStatus === 'in_review' && report.status !== 'IN_REVIEW') return false;
        if (filterStatus === 'approved' && report.status !== 'APPROVED') return false;
        if (filterStatus === 'sent' && !['SENT_INTERNAL', 'SENT_EXTERNAL'].includes(report.status))
          return false;
      }

      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          report.name.toLowerCase().includes(query) ||
          report.sourceName.toLowerCase().includes(query)
        );
      }

      return true;
    });
  }, [reports, filterStatus, searchQuery]);

  // Format date
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Stats
  const stats = useMemo(
    () => ({
      total: reports.length,
      draft: reports.filter((r) => ['DRAFT', 'CONFIGURING', 'GENERATING'].includes(r.status))
        .length,
      generated: reports.filter((r) => r.status === 'GENERATED').length,
      inReview: reports.filter((r) => r.status === 'IN_REVIEW').length,
      approved: reports.filter((r) => r.status === 'APPROVED').length,
      sent: reports.filter((r) => ['SENT_INTERNAL', 'SENT_EXTERNAL'].includes(r.status)).length,
    }),
    [reports]
  );

  // Handle open report
  const handleOpenReport = (reportId: string, reportName: string, status?: string) => {
    if (onOpenReport) {
      onOpenReport(reportId, reportName, status);
    } else {
      navigate(`/reports/builder/${reportId}`);
    }
  };

  // Triada standard (kanon §1, migracja bespoke tabeli #27-todo): kolumny
  // deklaratywne StandardTable — 1:1 z dawnymi komórkami <tr>. Ikony/kolor
  // Report+Author przeniesione na niebieski (Pułapka #1: primary=crimson).
  const columns: StandardTableColumn[] = useMemo(
    () => [
      {
        id: 'name',
        label: isPolish ? 'Raport' : 'Report',
        width: '260px',
        render: (row) => {
          const report = row as unknown as Report;
          return (
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg shrink-0">
                <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              </div>
              <button
                onClick={() => handleOpenReport(report.id, report.name, report.status)}
                className="font-medium text-navy-900 dark:text-white hover:underline transition-colors text-left truncate"
              >
                {report.name}
              </button>
            </div>
          );
        },
      },
      {
        id: 'author',
        label: isPolish ? 'Autor' : 'Author',
        width: '110px',
        render: (row) => {
          const report = row as unknown as Report;
          const name = report.createdByName || report.createdBy || '?';
          return (
            <div className="flex items-center gap-2 min-w-0" title={report.createdBy}>
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-xs font-medium text-white shrink-0">
                {name
                  .split(' ')
                  .map((n) => n[0])
                  .join('')
                  .slice(0, 2)
                  .toUpperCase()}
              </div>
              <span className="text-sm text-slate-600 dark:text-slate-400 truncate max-w-[60px]">
                {name.split(' ')[0]}
              </span>
            </div>
          );
        },
      },
      {
        id: 'context',
        label: isPolish ? 'Kontekst' : 'Context',
        width: '160px',
        render: (row) => {
          const report = row as unknown as Report;
          return (
            <div className="flex flex-col min-w-0">
              <span className="text-slate-600 dark:text-slate-300 truncate">
                {report.sourceName || '—'}
              </span>
              {report.sourceType && (
                <span className="text-xs text-slate-600 dark:text-slate-500">
                  {report.sourceType}
                </span>
              )}
            </div>
          );
        },
      },
      {
        id: 'status',
        label: 'Status',
        width: '150px',
        render: (row) => {
          const report = row as unknown as Report;
          const cfg = STATUS_CONFIG[report.status] || STATUS_CONFIG.IN_REVIEW;
          const StatusIcon = cfg.icon;
          return (
            <div
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border ${cfg.bgColor} ${cfg.color} ${cfg.borderColor}`}
            >
              <StatusIcon size={12} />
              {cfg.label}
            </div>
          );
        },
      },
      {
        id: 'updatedAt',
        label: isPolish ? 'Zaktualizowany' : 'Updated',
        width: '110px',
        sortable: true,
        render: (row) => {
          const report = row as unknown as Report;
          return (
            <span className="text-xs text-slate-600 dark:text-slate-500">
              {formatDate(report.updatedAt)}
            </span>
          );
        },
      },
    ],
    [isPolish]
  );

  // Triada standard (StandardTable rowMenu contract, ANEKS #4): moduł deklaruje
  // TYLKO bloki 1-3; StandardTable SAM dokłada bloki 4 (Open preview · Edit ·
  // Archive) i 5 (Delete — brak API kasowania raportu tutaj, disabled z notą).
  // Grupowanie primary/statusTransitions 1:1 odtwarza dawne sekcje "divider"
  // dawnego RowActionsMenu (view → workflow → export → share/initiatives).
  const buildRowMenu = useCallback(
    (row: Record<string, unknown>): StandardRowMenu => {
      const report = row as unknown as Report;
      const openReport = () => handleOpenReport(report.id, report.name, report.status);
      const exportable = [
        'GENERATED',
        'IN_REVIEW',
        'APPROVED',
        'SENT_INTERNAL',
        'SENT_EXTERNAL',
        'UTILIZED',
      ].includes(report.status);

      const primary: NonNullable<StandardRowMenu['primary']> = [
        {
          id: 'view',
          label: isPolish ? 'Podgląd raportu' : 'View Report',
          icon: Eye,
          onClick: openReport,
        },
      ];
      if (exportable) {
        primary.push(
          {
            id: 'export-pdf',
            label: isPolish ? 'Eksportuj PDF' : 'Export PDF',
            icon: FileText,
            onClick: () => handleExportPDF(report.id, report.name),
          },
          {
            id: 'export-pptx',
            label: isPolish ? 'Eksportuj PPTX' : 'Export PPTX',
            icon: FileOutput,
            onClick: () => handleExportPPTX(report.id, report.name),
          },
          {
            id: 'export-word',
            label: isPolish ? 'Eksportuj Word' : 'Export Word',
            icon: FileText,
            onClick: () => handleExportWord(report.id, report.name),
          }
        );
      }
      if (['GENERATED', 'IN_REVIEW', 'APPROVED', 'UTILIZED'].includes(report.status)) {
        primary.push({
          id: 'share',
          label: isPolish ? 'Utwórz link' : 'Share link',
          icon: Link2,
          onClick: () => handleCreateShareLink(report.id),
        });
      }
      if (report.canGenerateInitiatives && !report.initiativesGenerated) {
        primary.push({
          id: 'initiatives',
          label: isPolish ? 'Generuj inicjatywy' : 'Generate Initiatives',
          icon: Lightbulb,
          onClick: () => onCreateInitiatives(report.id),
        });
      }

      const statusTransitions: NonNullable<StandardRowMenu['statusTransitions']> = [];
      if (report.status === 'IN_REVIEW') {
        statusTransitions.push(
          {
            id: 'approve',
            label: isPolish ? 'Zatwierdź' : 'Approve',
            icon: CheckCircle2,
            onClick: () => handleApproveReport(report.id),
          },
          {
            id: 'send-back',
            label: isPolish ? 'Odeślij do edycji' : 'Send Back',
            icon: ArrowRight,
            onClick: () => handleSendBack(report.id),
          }
        );
      }
      if (report.status === 'APPROVED') {
        statusTransitions.push({
          id: 'send-int',
          label: isPolish ? 'Wyślij wewn.' : 'Send Internal',
          icon: Send,
          onClick: () => handleMarkSentInternal(report.id),
        });
      }
      if (report.status === 'SENT_INTERNAL') {
        statusTransitions.push({
          id: 'send-ext',
          label: isPolish ? 'Wyślij zewn.' : 'Send External',
          icon: ArrowRight,
          onClick: () => handleMarkSentExternal(report.id),
        });
      }

      return {
        primary,
        statusTransitions,
        universalHandlers: {
          preview: openReport,
          edit: openReport,
          // Brak API archiwizacji raportu z poziomu tego widoku — disabled z
          // notą (StandardTable dokłada ją sama, blok 4).
        },
        // Brak API kasowania raportu z poziomu tego globalnego widoku (jak w
        // oryginalnym RowActionsMenu) — disabled z notą (blok 5).
        destructive: {},
      };
    },
    [isPolish, onCreateInitiatives]
  );

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="shrink-0 px-6 py-4 border-b border-slate-200 dark:border-navy-700">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-navy-900 dark:text-white">
              {showAllStatuses
                ? isPolish
                  ? 'Kreator raportów'
                  : 'Report creator'
                : isPolish
                  ? 'Raporty'
                  : 'Reports'}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {showAllStatuses
                ? isPolish
                  ? 'Wszystkie raporty (wszystkie źródła i statusy) oraz szybki dostęp do edytora.'
                  : 'All reports (all sources and statuses) with quick access to the editor.'
                : isPolish
                  ? 'Raporty z ocen w statusie przeglądu i wyższych'
                  : 'Assessment reports in review status and above'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {showAllStatuses && (
              <button
                onClick={() => navigate('/reports/builder?tab=composer')}
                className="flex items-center gap-2 px-4 py-2.5 border border-slate-200 dark:border-navy-700 text-slate-600 dark:text-slate-400 font-medium rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
                title={
                  isPolish
                    ? 'Ustawienia kreatora (bloki/szablony/profile)'
                    : 'Creator settings (blocks/templates/profiles)'
                }
              >
                <Settings2 size={18} />
                {isPolish ? 'Ustawienia' : 'Settings'}
              </button>
            )}
            <button
              onClick={() => setShowImportModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 border border-slate-200 dark:border-navy-700 text-slate-600 dark:text-slate-400 font-medium rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
              title={isPolish ? 'Importuj raport zewnętrzny' : 'Import external report'}
            >
              <Upload size={18} />
              {isPolish ? 'Importuj' : 'Import'}
            </button>
            {showAllStatuses && onCreateTemplate && (
              <button
                onClick={onCreateTemplate}
                className="flex items-center gap-2 px-4 py-2.5 border border-slate-200 dark:border-navy-700 text-slate-700 dark:text-slate-200 font-medium rounded-lg hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                title={isPolish ? 'Utwórz nowy szablon raportu' : 'Create new report template'}
              >
                <FileText size={18} />
                {isPolish ? 'Nowy Szablon' : 'New Template'}
              </button>
            )}
            <button
              onClick={() => navigate('/reports/builder?new=true')}
              className="flex items-center gap-2 px-4 py-2.5 bg-navy-900 hover:bg-navy-800 dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] text-white font-medium rounded-lg transition-colors"
              title={isPolish ? 'Utwórz raport z pomocą AI' : 'Create AI-powered report'}
            >
              <Sparkles size={18} />
              {isPolish ? 'Nowy Raport' : 'New Report'}
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-6 mt-4">
          <button
            onClick={() => setFilterStatus('all')}
            className={`text-sm ${filterStatus === 'all' ? 'text-navy-900 dark:text-white font-semibold' : 'text-slate-500'}`}
          >
            {isPolish ? 'Wszystkie' : 'All'} ({stats.total})
          </button>
          {showAllStatuses && (
            <>
              <button
                onClick={() => setFilterStatus('draft')}
                className={`text-sm ${filterStatus === 'draft' ? 'text-navy-900 dark:text-white font-semibold' : 'text-slate-500'}`}
              >
                {isPolish ? 'Szkice' : 'Drafts'} ({stats.draft})
              </button>
              <button
                onClick={() => setFilterStatus('generated')}
                className={`text-sm ${filterStatus === 'generated' ? 'text-navy-900 dark:text-white font-semibold' : 'text-slate-500'}`}
              >
                {isPolish ? 'Wygenerowane' : 'Generated'} ({stats.generated})
              </button>
            </>
          )}
          <button
            onClick={() => setFilterStatus('in_review')}
            className={`text-sm ${filterStatus === 'in_review' ? 'text-navy-900 dark:text-white font-semibold' : 'text-slate-500'}`}
          >
            {isPolish ? 'W przeglądzie' : 'In Review'} ({stats.inReview})
          </button>
          <button
            onClick={() => setFilterStatus('approved')}
            className={`text-sm ${filterStatus === 'approved' ? 'text-navy-900 dark:text-white font-semibold' : 'text-slate-500'}`}
          >
            {isPolish ? 'Zatwierdzone' : 'Approved'} ({stats.approved})
          </button>
          <button
            onClick={() => setFilterStatus('sent')}
            className={`text-sm ${filterStatus === 'sent' ? 'text-navy-900 dark:text-white font-semibold' : 'text-slate-500'}`}
          >
            {isPolish ? 'Wysłane' : 'Sent'} ({stats.sent})
          </button>
        </div>

        {/* Search */}
        <div className="flex items-center gap-3 mt-4">
          <div className="relative flex-1 max-w-md">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 dark:text-slate-500"
              size={18}
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={isPolish ? 'Szukaj raportów...' : 'Search reports...'}
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-950 text-navy-900 dark:text-white"
            />
          </div>
          <button
            onClick={fetchReports}
            className="p-2 text-slate-600 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg"
          >
            <RefreshCw size={18} />
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto p-4">
        <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl overflow-hidden">
          <StandardTable
            columns={columns}
            data={filteredReports as unknown as Array<Record<string, unknown> & { id: string }>}
            loading={isLoading}
            empty={{
              title: searchQuery
                ? isPolish
                  ? 'Brak raportów pasujących do wyszukiwania'
                  : 'No reports match your search'
                : isPolish
                  ? showAllStatuses
                    ? 'Brak raportów'
                    : 'Brak raportów w przeglądzie'
                  : showAllStatuses
                    ? 'No reports yet'
                    : 'No reports in review yet',
              description: isPolish
                ? showAllStatuses
                  ? 'Utwórz nowy raport lub otwórz istniejący z listy.'
                  : 'Raporty pojawią się tutaj po przesłaniu do przeglądu'
                : showAllStatuses
                  ? 'Create a new report or open an existing one from the list.'
                  : 'Reports will appear here after being submitted for review',
              icon: FileOutput,
            }}
            onRowDoubleClick={(row) => {
              const report = row as unknown as Report;
              handleOpenReport(report.id, report.name, report.status);
            }}
            rowMenu={buildRowMenu}
            persistKey="assessment.reports-table.list"
            density="compact"
            canvasClassName="p-0"
          />
        </div>
      </div>

      {/* Import Report Modal */}
      {showImportModal && (
        <ImportReportModal
          projectId={projectId}
          onClose={() => setShowImportModal(false)}
          onImported={(reportId) => {
            fetchReports();
            setShowImportModal(false);
            toast.success(
              isPolish ? 'Raport zaimportowany pomyślnie' : 'Report imported successfully'
            );
          }}
        />
      )}
    </div>
  );
};
