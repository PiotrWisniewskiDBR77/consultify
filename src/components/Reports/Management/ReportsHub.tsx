/**
 * ReportsHub
 * Unified Management Reports module with 3 tabs (Reports, Templates, Schedules)
 * Uses shared ModuleHub components for consistent UX
 * PMO Standards: ISO 21500, PMBOK 7, PRINCE2
 */

import {
  AlertTriangle,
  Archive,
  Briefcase,
  Building2,
  Calendar,
  CalendarClock,
  ChevronRight,
  Download,
  Eye,
  FileBarChart2,
  FileText,
  Lock,
  MessageSquare,
  Pencil,
  Share2,
  Sparkles,
  Users,
  Wand2,
  Zap,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';

import { useOpenChatWithContext } from '../../../hooks/useOpenChatWithContext';
import { Api } from '../../../services/api';
import {
  ManagementReport,
  ManagementReportScope,
  ManagementReportStatus,
  ManagementReportType,
} from '../../../types';
import {
  FilterableTable,
  FilterChip,
  ModuleTab,
  OpenDocument,
  TableColumn,
  ViewMode,
} from '../../shared/ModuleHub';
import { useModuleOpenDocuments } from '../../shared/ModuleHub/useModuleOpenDocuments';
import { type RowAction } from '../../shared/RowActionsMenu';
import { EmptyState, LoadingState } from '../../shared/states';
import { TableWithPreviewLayout } from '../../shared/TableWithPreviewLayout';
import { StandardModuleBar } from '../../standard/StandardModuleBar';
import { EntityStatusChip, MetaChip } from '../../ui/primitives/chips';
import { ErrorState } from '../../ui/primitives/ErrorState';
import { PortfolioHealthReport } from './PortfolioHealthReport';
import { RaidReport } from './RaidReport';
import { ReportGeneratorDrawer } from './ReportGeneratorDrawer';
import { ReportingAutomationWorkspace } from './ReportingAutomationWorkspace';
import { SteeringCommitteeReport } from './SteeringCommitteeReport';
import { TeamMeetingReport } from './TeamMeetingReport';

// Report type metadata. Identity (type) is carried by a muted icon + short
// label — color is NOT a status signal here (canon §4.0a), so we keep the icon
// monochrome (text-slate-500) and let EntityStatusChip own the colored signals.
const REPORT_TYPE_META: Record<
  ManagementReportType,
  { label: string; shortLabel: string; icon: React.ReactNode }
> = {
  TEAM_MEETING: { label: 'Team Meeting', shortLabel: 'TM', icon: <Users size={14} /> },
  TEAM_WEEKLY: { label: 'Team Weekly', shortLabel: 'TW', icon: <Users size={14} /> },
  STEERING_COMMITTEE: {
    label: 'Steering Committee',
    shortLabel: 'SC',
    icon: <Building2 size={14} />,
  },
  PORTFOLIO_HEALTH: {
    label: 'Portfolio Health',
    shortLabel: 'PH',
    icon: <Briefcase size={14} />,
  },
  RAID: { label: 'RAID', shortLabel: 'RAID', icon: <AlertTriangle size={14} /> },
};

const SCOPE_META: Record<ManagementReportScope, { label: string }> = {
  PROJECT: { label: 'Project' },
  PORTFOLIO: { label: 'Portfolio' },
};

const STATUS_META: Record<ManagementReportStatus, { label: string }> = {
  DRAFT: { label: 'Draft' },
  FINAL: { label: 'Final' },
  APPROVED: { label: 'Approved' },
  ARCHIVED: { label: 'Archived' },
};

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
  periodStart?: string;
  periodEnd?: string;
  pdfPath?: string;
  pptxPath?: string;
  versionNumber?: number;
  versionLabel?: string;
}

interface ReportTemplate {
  id: string;
  name: string;
  description?: string;
  reportType: ManagementReportType;
  sections: string[];
  createdAt: string;
  createdByName?: string;
}

interface ReportSchedule {
  id: string;
  reportType: ManagementReportType;
  scope: ManagementReportScope;
  projectId?: string;
  projectName?: string;
  frequency: 'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY';
  dayOfWeek?: number;
  dayOfMonth?: number;
  timeOfDay: string;
  timezone: string;
  isActive: boolean;
  nextScheduledAt?: string;
  recipients?: string[];
}

interface ReportsHubProps {
  initialTab?: ModuleTab;
}

export const ReportsHub: React.FC<ReportsHubProps> = ({ initialTab = 'list' }) => {
  // B9.1: Chat about report
  const openChatWithContext = useOpenChatWithContext();
  const [searchParams, setSearchParams] = useSearchParams();
  const { t } = useTranslation();

  // State
  const [activeTab, setActiveTab] = useState<ModuleTab>(initialTab);
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilters, setActiveFilters] = useState<FilterChip[]>([]);
  const { openDocuments, setOpenDocuments, activeDocumentId, setActiveDocumentId, hydrated } =
    useModuleOpenDocuments('reports');

  // Data state
  const [reports, setReports] = useState<ReportHistoryItem[]>([]);
  const [templates, setTemplates] = useState<ReportTemplate[]>([]);
  const [schedules, setSchedules] = useState<ReportSchedule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showGeneratorDrawer, setShowGeneratorDrawer] = useState(false);
  const [currentReport, setCurrentReport] = useState<ManagementReport | null>(null);
  // Side preview pane selection (canon §7 — single-click selects + opens preview)
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Fetch data
  const loadData = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [reportsRes, templatesRes, schedulesRes] = await Promise.all([
        Api.get('/api/management-reports/history?limit=50'),
        Api.get('/api/management-reports/templates'),
        Api.get('/api/management-reports/schedules'),
      ]);

      setReports(reportsRes.data?.reports || []);
      setTemplates(templatesRes.data?.templates || []);
      setSchedules(schedulesRes.data?.schedules || []);
    } catch (err) {
      console.error('[ReportsHub] Failed to load:', err);
      const msg = t('reports.toast.loadError', 'Nie udało się załadować danych');
      toast.error(msg);
      setLoadError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Calculate stats
  const stats = useMemo(
    () => ({
      total: reports.length,
      draft: reports.filter((r) => r.status === 'DRAFT').length,
      final: reports.filter((r) => r.status === 'FINAL').length,
      thisWeek: reports.filter((r) => {
        const date = new Date(r.createdAt);
        const now = new Date();
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        return date >= weekAgo;
      }).length,
    }),
    [reports]
  );

  // Filter reports
  const filteredReports = useMemo(() => {
    let result = reports;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (r) =>
          r.title.toLowerCase().includes(query) ||
          (r.projectName || '').toLowerCase().includes(query)
      );
    }

    activeFilters.forEach((filter: FilterChip) => {
      if (filter.column === 'reportType') {
        result = result.filter((r) => r.reportType === filter.value);
      }
      if (filter.column === 'status') {
        result = result.filter((r) => r.status === filter.value);
      }
      if (filter.column === 'scope') {
        result = result.filter((r) => r.scope === filter.value);
      }
    });

    return result;
  }, [reports, searchQuery, activeFilters]);

  // Tab configuration
  const tabs = useMemo(
    () => [
      {
        id: 'list' as ModuleTab,
        label: 'Reports',
        icon: <FileBarChart2 size={16} />,
        count: filteredReports.length,
      },
      {
        id: 'reports' as ModuleTab,
        label: 'Templates',
        icon: <Wand2 size={16} />,
        count: templates.length,
      },
      {
        id: 'initiatives' as ModuleTab,
        label: 'Schedules',
        icon: <CalendarClock size={16} />,
        count: schedules.filter((s) => s.isActive).length,
      },
      {
        id: 'automation' as ModuleTab,
        label: 'Automation',
        icon: <Zap size={16} />,
      },
    ],
    [filteredReports.length, templates.length, schedules]
  );

  // Table columns for Reports (canon §3.3: title left · identity chips left ·
  // counts right · status chip left · actions right).
  const reportColumns: TableColumn[] = useMemo(
    () => [
      {
        id: 'type',
        label: t('reports.col.type', 'Type'),
        width: '110px',
        filterable: true,
        filterOptions: Object.entries(REPORT_TYPE_META).map(([value, meta]) => ({
          value,
          label: meta.label,
        })),
        render: (row: ReportHistoryItem) => {
          const meta = REPORT_TYPE_META[row.reportType];
          return (
            <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
              <span className="text-slate-400 dark:text-slate-500">{meta?.icon}</span>
              <span className="font-mono text-xs font-bold">{meta?.shortLabel ?? '—'}</span>
            </div>
          );
        },
      },
      {
        id: 'title',
        label: t('reports.col.title', 'Title'),
        render: (row: ReportHistoryItem) => (
          <div>
            <span className="text-sm text-slate-900 dark:text-white font-medium">{row.title}</span>
            {row.projectName && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{row.projectName}</p>
            )}
          </div>
        ),
      },
      {
        id: 'scope',
        label: t('reports.col.scope', 'Scope'),
        width: '120px',
        filterable: true,
        filterOptions: Object.entries(SCOPE_META).map(([value, meta]) => ({
          value,
          label: meta.label,
        })),
        render: (row: ReportHistoryItem) => (
          <MetaChip label={SCOPE_META[row.scope]?.label ?? '—'} />
        ),
      },
      {
        id: 'status',
        label: t('reports.col.status', 'Status'),
        width: '120px',
        filterable: true,
        filterOptions: Object.entries(STATUS_META).map(([value, meta]) => ({
          value,
          label: meta.label,
        })),
        render: (row: ReportHistoryItem) => <EntityStatusChip status={row.status} />,
      },
      {
        id: 'version',
        label: t('reports.col.version', 'Ver.'),
        width: '70px',
        render: (row: ReportHistoryItem) => (
          <span className="block text-right font-mono text-xs text-slate-500 dark:text-slate-400">
            v{row.versionLabel || row.versionNumber || '1.0'}
          </span>
        ),
      },
      {
        id: 'createdAt',
        label: t('reports.col.generated', 'Generated'),
        width: '150px',
        sortable: true,
        render: (row: ReportHistoryItem) => (
          <div>
            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
              <Calendar size={14} className="text-slate-400 dark:text-slate-500" />
              {new Date(row.createdAt).toLocaleDateString()}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {row.generatedByName || '—'}
            </p>
          </div>
        ),
      },
    ],
    [t]
  );

  // Row actions menu — canon §9 (context top → fixed-bottom manifest → danger).
  const getReportRowActions = useCallback(
    (row: ReportHistoryItem): RowAction[] => {
      const actions: RowAction[] = [
        // GÓRA — kontekst
        {
          id: 'open',
          label: t('common.open', 'Open'),
          icon: Eye,
          variant: 'primary',
          onClick: () => handleViewReport(row.id),
        },
      ];
      if (row.pdfPath) {
        actions.push({
          id: 'pdf',
          label: t('reports.actions.downloadPdf', 'Download PDF'),
          icon: FileText,
          onClick: () => handleDownloadPDF(row.id),
        });
      }
      actions.push({
        id: 'share',
        label: t('reports.actions.share', 'Share link'),
        icon: Share2,
        onClick: () => handleShare(row.id),
      });
      // DÓŁ — FIXED BOTTOM MANIFEST (reports have no due date → no Delay)
      actions.push(
        {
          id: 'open_preview',
          label: t('rap.actions.openPreview', 'Otwórz podgląd'),
          icon: ChevronRight,
          divider: true,
          onClick: () => setSelectedId(row.id),
        },
        {
          id: 'edit',
          label: t('common.edit', 'Edytuj'),
          icon: Pencil,
          onClick: () => handleViewReport(row.id),
        },
        {
          // canon §14 + §9.2: Archive slot (soft-delete backend TBD)
          id: 'archive',
          label: t('rap.actions.archive', 'Archiwizuj'),
          icon: Archive,
          disabled: true,
          description: t('common.comingSoon', 'Wkrótce'),
          onClick: () => {},
        }
      );
      return actions;
    },
    [t]
  );

  // Table columns for Templates
  const templateColumns: TableColumn[] = useMemo(
    () => [
      {
        id: 'type',
        label: t('reports.col.type', 'Type'),
        width: '110px',
        render: (row: ReportTemplate) => {
          const meta = REPORT_TYPE_META[row.reportType];
          return (
            <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
              <span className="text-slate-400 dark:text-slate-500">{meta?.icon}</span>
              <span className="font-mono text-xs font-bold">{meta?.shortLabel ?? '—'}</span>
            </div>
          );
        },
      },
      {
        id: 'name',
        label: t('reports.col.name', 'Name'),
        render: (row: ReportTemplate) => (
          <div>
            <span className="text-sm text-slate-900 dark:text-white font-medium">{row.name}</span>
            {row.description && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{row.description}</p>
            )}
          </div>
        ),
      },
      {
        id: 'sections',
        label: t('reports.col.sections', 'Sections'),
        width: '100px',
        render: (row: ReportTemplate) => (
          <span className="block text-right text-sm text-slate-600 dark:text-slate-300">
            {row.sections.length}
          </span>
        ),
      },
      {
        id: 'createdAt',
        label: t('reports.col.created', 'Created'),
        width: '150px',
        render: (row: ReportTemplate) => (
          <div>
            <div className="text-sm text-slate-600 dark:text-slate-300">
              {new Date(row.createdAt).toLocaleDateString()}
            </div>
            {row.createdByName && (
              <p className="text-xs text-slate-500 dark:text-slate-400">{row.createdByName}</p>
            )}
          </div>
        ),
      },
    ],
    []
  );

  // Table columns for Schedules
  const scheduleColumns: TableColumn[] = useMemo(
    () => [
      {
        id: 'type',
        label: t('reports.col.type', 'Type'),
        width: '110px',
        render: (row: ReportSchedule) => {
          const meta = REPORT_TYPE_META[row.reportType];
          return (
            <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
              <span className="text-slate-400 dark:text-slate-500">{meta?.icon}</span>
              <span className="font-mono text-xs font-bold">{meta?.shortLabel ?? '—'}</span>
            </div>
          );
        },
      },
      {
        id: 'scope',
        label: t('reports.col.scope', 'Scope'),
        render: (row: ReportSchedule) => (
          <div>
            <span className="text-sm text-slate-900 dark:text-white font-medium">
              {row.scope === 'PROJECT' ? row.projectName || 'Project' : 'Portfolio'}
            </span>
          </div>
        ),
      },
      {
        id: 'frequency',
        label: t('reports.col.frequency', 'Frequency'),
        width: '120px',
        render: (row: ReportSchedule) => (
          <span className="text-sm text-slate-600 dark:text-slate-300">{row.frequency}</span>
        ),
      },
      {
        id: 'schedule',
        label: t('reports.col.schedule', 'Schedule'),
        width: '150px',
        render: (row: ReportSchedule) => (
          <div className="text-sm text-slate-600 dark:text-slate-300">
            {row.timeOfDay} {row.timezone}
          </div>
        ),
      },
      {
        id: 'next',
        label: t('reports.col.nextRun', 'Next Run'),
        width: '150px',
        render: (row: ReportSchedule) =>
          row.nextScheduledAt ? (
            <div className="text-sm text-slate-600 dark:text-slate-300">
              {new Date(row.nextScheduledAt).toLocaleDateString()}
            </div>
          ) : (
            <span className="text-sm text-slate-400 dark:text-slate-500">—</span>
          ),
      },
      {
        id: 'status',
        label: t('reports.col.status', 'Status'),
        width: '110px',
        render: (row: ReportSchedule) => (
          <EntityStatusChip
            status={row.isActive ? 'active' : 'archived'}
            label={
              row.isActive
                ? t('reports.schedule.active', 'Active')
                : t('reports.schedule.paused', 'Paused')
            }
          />
        ),
      },
    ],
    []
  );

  // Handlers
  const handleViewReport = useCallback(async (reportId: string) => {
    try {
      const response = await Api.get(`/api/management-reports/${reportId}`);
      if (response.data?.report) {
        setCurrentReport(response.data.report);

        const report = response.data.report;
        const meta = REPORT_TYPE_META[report.reportType as ManagementReportType];

        const doc: OpenDocument = {
          id: report.id,
          type: 'report',
          subType: meta.shortLabel,
          name: report.title,
          status: report.status === 'FINAL' ? 'DONE' : 'DRAFT',
        };

        setOpenDocuments((prev) => {
          if (prev.find((d) => d.id === doc.id)) return prev;
          return [...prev, doc];
        });
        setActiveDocumentId(report.id);
      }
    } catch (error) {
      toast.error(t('reports.toast.loadReportError', 'Nie udało się załadować raportu'));
    }
  }, []);

  const handleDownloadPDF = useCallback(async (reportId: string) => {
    try {
      const response = await Api.get(`/api/management-reports/${reportId}/pdf`);
      if (response.data?.pdfUrl) {
        window.open(response.data.pdfUrl, '_blank');
        toast.success(t('reports.toast.pdfStarted', 'Pobieranie PDF rozpoczęte'));
      }
    } catch (error) {
      toast.error(t('reports.toast.pdfError', 'Nie udało się pobrać PDF'));
    }
  }, []);

  const handleShare = useCallback(async (reportId: string) => {
    try {
      const response = await Api.post(`/api/management-reports/${reportId}/share`, {
        expiresInDays: 7,
      });
      if (response.data?.shareUrl) {
        navigator.clipboard.writeText(window.location.origin + response.data.shareUrl);
        toast.success(t('reports.toast.shareLinkCopied', 'Link do udostępniania skopiowany'));
      }
    } catch (error) {
      toast.error(t('reports.toast.shareLinkError', 'Nie udało się utworzyć linku'));
    }
  }, []);

  const handleOpenDocument = useCallback(
    (row: ReportHistoryItem) => {
      handleViewReport(row.id);
    },
    [handleViewReport]
  );

  const openReportById = useCallback(
    async (id: string) => {
      const existing = openDocuments.find((d) => d.id === id);
      if (existing) {
        setActiveDocumentId(existing.id);
        const report = reports.find((r) => r.id === existing.id);
        if (report) {
          await handleViewReport(report.id);
        }
        return;
      }
      await handleViewReport(id);
    },
    [openDocuments, reports, setActiveDocumentId, handleViewReport]
  );

  const handleCloseDocument = useCallback(
    (id: string) => {
      setOpenDocuments((prev) => prev.filter((d) => d.id !== id));
      if (activeDocumentId === id) {
        setActiveDocumentId(null);
        setCurrentReport(null);
      }
    },
    [activeDocumentId]
  );

  const handleShowList = useCallback(() => {
    setActiveDocumentId(null);
    setCurrentReport(null);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const docId = String(searchParams.get('docId') || '').trim();
    if (!docId) return;
    void openReportById(docId).finally(() => {
      const next = new URLSearchParams(searchParams);
      next.delete('docId');
      setSearchParams(next, { replace: true });
    });
  }, [hydrated, openReportById, searchParams, setSearchParams]);

  const handleRemoveFilter = useCallback((id: string) => {
    setActiveFilters((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const handleClearFilters = useCallback(() => {
    setActiveFilters([]);
  }, []);

  const handleNewReport = useCallback(() => {
    setShowGeneratorDrawer(true);
  }, []);

  const handleReportGenerated = useCallback((report: ManagementReport) => {
    setReports((prev) => [
      {
        id: report.id,
        title: report.title,
        reportType: report.reportType as ManagementReportType,
        scope: report.scope as ManagementReportScope,
        status: report.status as ManagementReportStatus,
        generatedBy: report.generatedBy || '',
        generatedByName: report.generatedByName || '',
        projectName: '',
        createdAt: report.createdAt || new Date().toISOString(),
      },
      ...prev,
    ]);
    setShowGeneratorDrawer(false);
    setCurrentReport(report);

    const meta = REPORT_TYPE_META[report.reportType as ManagementReportType];
    const doc: OpenDocument = {
      id: report.id,
      type: 'report',
      subType: meta.shortLabel,
      name: report.title,
      status: 'DRAFT',
    };

    setOpenDocuments((prev) => [...prev, doc]);
    setActiveDocumentId(report.id);
    toast.success(t('reports.toast.reportGenerated', 'Raport wygenerowany pomyślnie!'));
  }, []);

  // Render report preview
  const renderReportPreview = () => {
    if (!currentReport) return null;

    const reportType = currentReport.reportType as ManagementReportType;

    switch (reportType) {
      case 'TEAM_MEETING':
      case 'TEAM_WEEKLY':
        return <TeamMeetingReport report={currentReport} />;
      case 'STEERING_COMMITTEE':
        return <SteeringCommitteeReport report={currentReport} />;
      case 'PORTFOLIO_HEALTH':
        return <PortfolioHealthReport report={currentReport} />;
      case 'RAID':
        return <RaidReport report={currentReport} />;
      default:
        return <div className="p-6 text-slate-600">Unknown report type</div>;
    }
  };

  // Render content
  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="p-6">
          <LoadingState template="list" rows={6} />
        </div>
      );
    }

    if (loadError) {
      return (
        <div className="flex items-center justify-center h-full">
          <ErrorState message={loadError} retry={loadData} />
        </div>
      );
    }

    // Show report preview if document is open
    if (activeDocumentId && currentReport) {
      return <div className="overflow-auto h-full p-6">{renderReportPreview()}</div>;
    }

    // Tab: Reports (default)
    if (activeTab === 'list') {
      if (filteredReports.length === 0) {
        return (
          <EmptyState
            variant="new"
            icon={FileBarChart2}
            title={t('reports.empty.noReports', 'No reports yet')}
            description={t(
              'reports.empty.noReportsDesc',
              'Generate your first management report to track project status, team progress, and portfolio health.'
            )}
            primaryAction={{
              label: t('reports.actions.generate', 'Generate Report'),
              onClick: handleNewReport,
              icon: Sparkles,
            }}
          />
        );
      }

      const selectedReport = selectedId
        ? (filteredReports.find((r) => r.id === selectedId) ?? null)
        : null;

      return (
        <TableWithPreviewLayout<ReportHistoryItem>
          selectedId={selectedId}
          selectedItem={selectedReport}
          onSelect={setSelectedId}
          onOpenFull={(id) => handleViewReport(id)}
          itemIds={filteredReports.map((r) => r.id)}
          getItemById={(id) => filteredReports.find((r) => r.id === id) ?? null}
          renderPreview={(item) => (
            <div className="space-y-3">
              {/* Meta bar — state, not content (canon §7.3-2) */}
              <div className="rounded-lg bg-slate-100/60 dark:bg-white/[0.03] p-4 space-y-2.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <EntityStatusChip status={item.status} />
                  <MetaChip label={SCOPE_META[item.scope]?.label ?? '—'} />
                  <span className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                    <span className="text-slate-400 dark:text-slate-500">
                      {REPORT_TYPE_META[item.reportType]?.icon}
                    </span>
                    {REPORT_TYPE_META[item.reportType]?.label ?? '—'}
                  </span>
                </div>
                <dl className="text-sm space-y-1.5">
                  {item.projectName && (
                    <div className="flex justify-between gap-3">
                      <dt className="text-slate-500 dark:text-slate-400">
                        {t('reports.preview.project', 'Project')}
                      </dt>
                      <dd className="text-slate-700 dark:text-slate-200 text-right">
                        {item.projectName}
                      </dd>
                    </div>
                  )}
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-500 dark:text-slate-400">
                      {t('reports.col.generated', 'Generated')}
                    </dt>
                    <dd className="text-slate-700 dark:text-slate-200 text-right">
                      {new Date(item.createdAt).toLocaleString()}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-500 dark:text-slate-400">
                      {t('reports.preview.author', 'Author')}
                    </dt>
                    <dd className="text-slate-700 dark:text-slate-200 text-right">
                      {item.generatedByName || '—'}
                    </dd>
                  </div>
                  {item.periodStart && item.periodEnd && (
                    <div className="flex justify-between gap-3">
                      <dt className="text-slate-500 dark:text-slate-400">
                        {t('reports.preview.period', 'Period')}
                      </dt>
                      <dd className="text-slate-700 dark:text-slate-200 text-right">
                        {item.periodStart} – {item.periodEnd}
                      </dd>
                    </div>
                  )}
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-500 dark:text-slate-400">
                      {t('reports.preview.version', 'Version')}
                    </dt>
                    <dd className="text-slate-700 dark:text-slate-200 text-right font-mono">
                      v{item.versionLabel || item.versionNumber || '1.0'}
                    </dd>
                  </div>
                </dl>
              </div>

              {/* Immutable version note */}
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-primary-500/10 border border-primary-500/20 rounded-lg">
                <Lock size={12} className="text-primary-500" />
                <span className="text-[11px] text-primary-600 dark:text-primary-300 font-medium">
                  {t('reports.preview.immutable', 'Immutable version')}
                </span>
              </div>
            </div>
          )}
          renderPreviewFooter={(item) => (
            <div className="space-y-2.5">
              {/* AI (canon §7.3.4-1) */}
              <button
                onClick={async () => {
                  try {
                    await openChatWithContext({
                      entityType: 'report',
                      entityId: item.id,
                      entityName: item.title,
                      contextData: {
                        reportType: item.reportType,
                        reportScope: item.scope,
                        reportStatus: item.status,
                        periodStart: item.periodStart,
                        periodEnd: item.periodEnd,
                      },
                    });
                    toast.success(t('reports.toast.chatOpened', 'Otwarto czat dla tego raportu'), {
                      duration: 1500,
                      icon: '💬',
                    });
                  } catch (err) {
                    console.error('[ReportsHub] Failed to open chat:', err);
                    toast.error(t('reports.toast.chatOpenError', 'Nie udało się otworzyć czatu'));
                  }
                }}
                className="w-full flex items-center justify-center gap-2 h-9 rounded-full border border-slate-200/70 dark:border-white/[0.06] text-slate-700 dark:text-slate-200 hover:bg-slate-100/70 dark:hover:bg-white/[0.06] text-xs font-medium transition-colors"
              >
                <MessageSquare size={14} />
                {t('reports.actions.chat', 'Chat about this report')}
              </button>

              {/* Actions (canon §7.3.4-4) — Open lives in the header, not here */}
              <div className="flex items-center gap-2">
                {item.pdfPath && (
                  <button
                    onClick={() => handleDownloadPDF(item.id)}
                    className="flex-1 flex items-center justify-center gap-2 h-9 rounded-full border border-slate-200/70 dark:border-white/[0.06] text-slate-700 dark:text-slate-200 hover:bg-slate-100/70 dark:hover:bg-white/[0.06] text-xs font-medium transition-colors"
                  >
                    <Download size={14} />
                    {t('reports.actions.downloadPdf', 'Download PDF')}
                  </button>
                )}
                <button
                  onClick={() => handleShare(item.id)}
                  className="flex-1 flex items-center justify-center gap-2 h-9 rounded-full border border-slate-200/70 dark:border-white/[0.06] text-slate-700 dark:text-slate-200 hover:bg-slate-100/70 dark:hover:bg-white/[0.06] text-xs font-medium transition-colors"
                >
                  <Share2 size={14} />
                  {t('reports.actions.share', 'Share link')}
                </button>
              </div>
            </div>
          )}
        >
          <FilterableTable
            columns={reportColumns}
            data={filteredReports}
            selectedRowId={selectedId}
            onRowClick={(row) => setSelectedId((row as ReportHistoryItem).id)}
            onRowDoubleClick={(row) => handleViewReport((row as ReportHistoryItem).id)}
            getRowActions={(row) => getReportRowActions(row as ReportHistoryItem)}
            activeFilters={activeFilters}
            onFilterChange={setActiveFilters}
            emptyMessage={t('reports.empty.noResults', 'No reports found.')}
            enableColumnSettings
            persistKey="reports.list"
          />
        </TableWithPreviewLayout>
      );
    }

    // Tab: Templates
    if (activeTab === 'reports') {
      if (templates.length === 0) {
        return (
          <EmptyState
            variant="new"
            icon={Wand2}
            title={t('reports.empty.noTemplates', 'No templates yet')}
            description={t(
              'reports.empty.noTemplatesDesc',
              'Create templates to quickly generate reports with predefined sections.'
            )}
          />
        );
      }

      return (
        <FilterableTable
          columns={templateColumns}
          data={templates}
          onRowClick={() => {}}
          activeFilters={[]}
          onFilterChange={() => {}}
          emptyMessage="No templates found."
        />
      );
    }

    // Tab: Schedules
    if (activeTab === 'initiatives') {
      if (schedules.length === 0) {
        return (
          <EmptyState
            variant="new"
            icon={CalendarClock}
            title={t('reports.empty.noSchedules', 'No schedules yet')}
            description={t(
              'reports.empty.noSchedulesDesc',
              'Set up recurring schedules to automatically generate reports.'
            )}
          />
        );
      }

      return (
        <FilterableTable
          columns={scheduleColumns}
          data={schedules}
          onRowClick={() => {}}
          activeFilters={[]}
          onFilterChange={() => {}}
          emptyMessage="No schedules found."
        />
      );
    }

    // Tab: Automation (T062)
    if (activeTab === ('automation' as ModuleTab)) {
      return <ReportingAutomationWorkspace />;
    }

    return null;
  };

  return (
    <>
      <StandardModuleBar
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onSearch={setSearchQuery}
        openItems={openDocuments}
        activeItemId={activeDocumentId}
        onSelectItem={(id) => {
          setActiveDocumentId(id);
          const report = reports.find((r) => r.id === id);
          if (report) {
            handleViewReport(report.id);
          }
        }}
        onCloseItem={handleCloseDocument}
        onShowList={handleShowList}
        activeFilters={activeFilters}
        onRemoveFilter={handleRemoveFilter}
        onClearFilters={handleClearFilters}
        onNewItem={handleNewReport}
        newItemLabel="New Report"
        viewModes={['table']}
      >
        {renderContent()}
      </StandardModuleBar>

      {/* Report Generator Drawer */}
      {showGeneratorDrawer && (
        <ReportGeneratorDrawer
          isOpen={showGeneratorDrawer}
          onClose={() => setShowGeneratorDrawer(false)}
          onReportGenerated={handleReportGenerated}
        />
      )}
    </>
  );
};

export default ReportsHub;
