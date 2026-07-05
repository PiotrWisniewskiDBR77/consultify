/**
 * ReportBuilderHub — Unified Reports Hub (Phase 10)
 *
 * Consolidates fragmented report surfaces into 4 tabs:
 *   1. My Reports — user-created reports via Report Builder
 *   2. R1-R4 Reports — canonical management report types
 *   3. Templates — report templates library
 *   4. Schedules — scheduled/cyclic report generation
 *
 * Uses ModuleHub + FilterableTable + standard Tailwind dark-mode styling.
 */

import {
  Archive,
  Calendar,
  ChevronDown,
  ChevronRight,
  Clock,
  ExternalLink,
  FileText,
  Layout,
  Pause,
  Play,
  Plus,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { LoadingState } from '@/components/shared/states';
import { EntityStatusChip } from '@/components/ui/primitives';

import { Api } from '../../services/api';
import {
  FilterableTable,
  type FilterChip,
  ModuleHub,
  type ModuleTab,
  type TableColumn,
  type ViewMode,
} from '../shared/ModuleHub';
import { useModuleOpenDocuments } from '../shared/ModuleHub/useModuleOpenDocuments';
import { type RowAction } from '../shared/RowActionsMenu';
import { TableWithPreviewLayout } from '../shared/TableWithPreviewLayout';
import { ScheduleReportModal } from './ScheduleReportModal';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BuilderReport {
  id: string;
  title: string;
  report_type_v3?: string;
  status: string;
  created_at: string;
  updated_at: string;
  created_by?: string;
  [key: string]: unknown;
}

interface BuilderTemplate {
  id: string;
  name: string;
  description?: string;
  report_type_v3?: string;
  sections?: string[];
  created_at?: string;
  [key: string]: unknown;
}

interface ScheduleItem {
  id: string;
  name: string;
  frequency: string;
  nextRunAt?: string | null;
  isActive: boolean;
  reportType?: string;
  templateId?: string;
  [key: string]: unknown;
}

type HubTab = 'my_reports' | 'r1_r4' | 'templates' | 'schedules';

const R1_R4_TYPES = ['R1', 'R2', 'R3', 'R4'] as const;

const R_TYPE_META: Record<
  string,
  { label: string; labelPl: string; color: string; dotColor: string }
> = {
  R1: {
    label: 'Weekly Execution',
    labelPl: 'Raport tygodniowy',
    color: 'text-blue-400',
    dotColor: 'bg-blue-400',
  },
  R2: {
    label: 'Steering Committee',
    labelPl: 'Komitet sterujący',
    color: 'text-c-accent',
    dotColor: 'bg-c-accent-soft',
  },
  R3: {
    label: 'Benefits Tracking',
    labelPl: 'Śledzenie korzyści',
    color: 'text-emerald-400',
    dotColor: 'bg-emerald-400',
  },
  R4: {
    label: 'Portfolio Overview',
    labelPl: 'Przegląd portfela',
    color: 'text-amber-400',
    dotColor: 'bg-amber-400',
  },
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ReportBuilderHubProps {
  onCreateReport?: () => void;
  onOpenReport?: (reportId: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const ReportBuilderHub: React.FC<ReportBuilderHubProps> = ({
  onCreateReport,
  onOpenReport,
}) => {
  const { t, i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');

  const [activeTab, setActiveTab] = useState<HubTab>('my_reports');
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilters, setActiveFilters] = useState<FilterChip[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { openDocuments, setOpenDocuments, activeDocumentId, setActiveDocumentId } =
    useModuleOpenDocuments('report_builder_hub', { maxOpenDocuments: 6 });

  // Data
  const [reports, setReports] = useState<BuilderReport[]>([]);
  const [templates, setTemplates] = useState<BuilderTemplate[]>([]);
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Schedule modal
  const [scheduleModal, setScheduleModal] = useState<{
    open: boolean;
    templateId: string;
    templateName: string;
  }>({ open: false, templateId: '', templateName: '' });

  // R1-R4 collapsible state
  const [expandedTypes, setExpandedTypes] = useState<Set<string>>(new Set(R1_R4_TYPES));

  // -----------------------------------------------------------------------
  // Data fetching
  // -----------------------------------------------------------------------

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      try {
        const [reportsRes, templatesRes, schedulesRes, sessionsRes] = await Promise.allSettled([
          Api.get('/api/report-builder'),
          Api.get('/api/report-builder/templates'),
          Api.get('/api/scheduled-reports'),
          Api.get('/api/report-builder/sessions'),
        ]);

        if (reportsRes.status === 'fulfilled') {
          const data = reportsRes.value?.data;
          setReports(Array.isArray(data) ? data : data?.reports || []);
        }
        if (templatesRes.status === 'fulfilled') {
          const data = templatesRes.value?.data;
          setTemplates(Array.isArray(data) ? data : data?.templates || []);
        }
        if (schedulesRes.status === 'fulfilled') {
          const data = schedulesRes.value?.data;
          setSchedules(Array.isArray(data) ? data : data?.schedules || data?.data || []);
        }

        if (sessionsRes.status === 'fulfilled') {
          const data = sessionsRes.value?.data;
          const sessions = Array.isArray(data?.sessions) ? data.sessions : [];
          if (sessions.length > 0) {
            const mapped = sessions
              .map((s: any) => {
                const rpt = s.report || {};
                return {
                  id: String(s.reportId || rpt.id || ''),
                  type: 'report' as const,
                  subType: String(
                    rpt.reportTypeV3 || rpt.report_type_v3 || rpt.sourceFramework || 'report'
                  ),
                  name: String(rpt.title || 'Report'),
                  status: String(rpt.status || 'DRAFT') as any,
                };
              })
              .filter((d: any) => d.id);
            if (mapped.length > 0) {
              setOpenDocuments(mapped.slice(0, 6));
              if (!activeDocumentId) setActiveDocumentId(mapped[0].id);
            }
          }
        }
      } catch (err) {
        console.error('[ReportBuilderHub] Failed to load data:', err);
        toast.error(t('rbHub.loadError', 'Nie udało się załadować danych'));
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [t, activeDocumentId, setActiveDocumentId, setOpenDocuments]);

  // -----------------------------------------------------------------------
  // Filtered data
  // -----------------------------------------------------------------------

  const filteredReports = useMemo(() => {
    let data = reports;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      data = data.filter(
        (r) =>
          r.title?.toLowerCase().includes(q) ||
          r.report_type_v3?.toLowerCase().includes(q) ||
          r.status?.toLowerCase().includes(q)
      );
    }
    for (const f of activeFilters) {
      if (f.column === 'status') data = data.filter((r) => (r.status || '') === f.value);
      if (f.column === 'report_type_v3')
        data = data.filter((r) => (r.report_type_v3 || '') === f.value);
    }
    return data;
  }, [reports, searchQuery, activeFilters]);

  const r1r4Reports = useMemo(
    () => reports.filter((r) => R1_R4_TYPES.includes(r.report_type_v3 as any)),
    [reports]
  );

  const filteredTemplates = useMemo(() => {
    if (!searchQuery) return templates;
    const q = searchQuery.toLowerCase();
    return templates.filter(
      (t) =>
        t.name?.toLowerCase().includes(q) ||
        t.description?.toLowerCase().includes(q) ||
        t.report_type_v3?.toLowerCase().includes(q)
    );
  }, [templates, searchQuery]);

  const filteredSchedules = useMemo(() => {
    if (!searchQuery) return schedules;
    const q = searchQuery.toLowerCase();
    return schedules.filter(
      (s) => s.name?.toLowerCase().includes(q) || s.frequency?.toLowerCase().includes(q)
    );
  }, [schedules, searchQuery]);

  // -----------------------------------------------------------------------
  // Tabs
  // -----------------------------------------------------------------------

  const tabs = useMemo(
    () => [
      {
        id: 'my_reports' as ModuleTab,
        label: t('rbHub.tabs.myReports', 'Moje raporty'),
        icon: <FileText size={16} />,
        count: filteredReports.length,
      },
      {
        id: 'r1_r4' as ModuleTab,
        label: t('rbHub.tabs.r1r4', 'R1–R4'),
        icon: <Layout size={16} />,
        count: r1r4Reports.length,
      },
      {
        id: 'templates' as ModuleTab,
        label: t('rbHub.tabs.templates', 'Szablony'),
        icon: <FileText size={16} />,
        count: filteredTemplates.length,
      },
      {
        id: 'schedules' as ModuleTab,
        label: t('rbHub.tabs.schedules', 'Harmonogramy'),
        icon: <Clock size={16} />,
        count: filteredSchedules.length,
      },
    ],
    [
      t,
      filteredReports.length,
      r1r4Reports.length,
      filteredTemplates.length,
      filteredSchedules.length,
    ]
  );

  // -----------------------------------------------------------------------
  // Handlers
  // -----------------------------------------------------------------------

  const handleRowClick = useCallback(
    (row: BuilderReport) => {
      // Track open report in backend sessions (best-effort, do not block navigation)
      Api.post(`/api/report-builder/${row.id}/session/open`, {
        navigationState: { from: 'hub' },
      }).catch(() => null);

      // Open in UI dynamic menu (local)
      setOpenDocuments((prev) => {
        const next = [
          {
            id: row.id,
            type: 'report' as const,
            subType: String(row.report_type_v3 || 'report'),
            name: row.title,
            status: row.status as any,
          },
          ...prev.filter((d) => d.id !== row.id),
        ];
        return next.slice(0, 6);
      });
      setActiveDocumentId(row.id);
      onOpenReport?.(row.id);
    },
    [onOpenReport, setActiveDocumentId, setOpenDocuments]
  );

  const handleNewItem = useCallback(() => {
    onCreateReport?.();
  }, [onCreateReport]);

  const handleRemoveFilter = useCallback((id: string) => {
    setActiveFilters((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const handleClearFilters = useCallback(() => setActiveFilters([]), []);

  const handleShowList = useCallback(() => setActiveDocumentId(null), [setActiveDocumentId]);

  const handleCloseDocument = useCallback(
    (id: string) => {
      // Best-effort close in backend sessions
      Api.post(`/api/report-builder/${id}/session/close`, {}).catch(() => null);
      setOpenDocuments((prev) => prev.filter((d) => d.id !== id));
      if (activeDocumentId === id) setActiveDocumentId(null);
    },
    [activeDocumentId, setActiveDocumentId, setOpenDocuments]
  );

  const toggleType = useCallback((type: string) => {
    setExpandedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }, []);

  const handleToggleSchedule = useCallback(
    async (scheduleId: string, currentlyActive: boolean) => {
      try {
        await Api.patch(`/api/scheduled-reports/${scheduleId}`, {
          isActive: !currentlyActive,
        });
        setSchedules((prev) =>
          prev.map((s) => (s.id === scheduleId ? { ...s, isActive: !currentlyActive } : s))
        );
        toast.success(
          !currentlyActive
            ? t('rbHub.scheduleActivated', 'Harmonogram aktywowany')
            : t('rbHub.schedulePaused', 'Harmonogram wstrzymany')
        );
      } catch {
        toast.error(t('rbHub.scheduleToggleError', 'Nie udało się zmienić statusu'));
      }
    },
    [t]
  );

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------

  const formatDate = (iso?: string | null) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString(isPl ? 'pl-PL' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const statusBadge = (status: string) => <EntityStatusChip status={status} />;

  // -----------------------------------------------------------------------
  // Tab: My Reports
  // -----------------------------------------------------------------------

  const renderMyReports = () => {
    if (filteredReports.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-full py-20 text-center">
          <FileText className="w-14 h-14 text-c-text-secondary mb-4" />
          <h3 className="text-lg font-semibold text-c-text mb-2">
            {t('rbHub.emptyReports.title', 'Brak raportów')}
          </h3>
          <p className="text-sm text-c-text-secondary mb-6 max-w-sm">
            {t('rbHub.emptyReports.description', 'Utwórz swój pierwszy raport za pomocą kreatora.')}
          </p>
          {onCreateReport && (
            <button
              onClick={onCreateReport}
              className="flex items-center gap-2 px-5 py-2.5 bg-c-text text-c-bg hover:opacity-90 rounded-xl text-sm font-medium transition-colors"
            >
              <Plus size={16} />
              {t('rbHub.newReport', 'Nowy raport')}
            </button>
          )}
        </div>
      );
    }

    const typeOptions = Array.from(
      new Set(filteredReports.map((r) => r.report_type_v3).filter(Boolean) as string[])
    ).map((v) => ({ value: v, label: v }));
    const statusOptions = Array.from(
      new Set(filteredReports.map((r) => r.status).filter(Boolean) as string[])
    ).map((v) => ({ value: v, label: v.charAt(0).toUpperCase() + v.slice(1).replace(/_/g, ' ') }));

    const columns: TableColumn[] = [
      {
        id: 'title',
        label: t('rbHub.col.title', 'Tytuł'),
        render: (row) => (
          <span className="text-sm font-medium text-c-text">
            {String(row.title ?? '—')}
          </span>
        ),
      },
      {
        id: 'report_type_v3',
        label: t('rbHub.col.type', 'Typ'),
        width: '120px',
        filterable: true,
        filterOptions: typeOptions,
        render: (row) => (
          <span className="text-xs font-mono font-bold text-c-text-secondary">
            {String(row.report_type_v3 || '—')}
          </span>
        ),
      },
      {
        id: 'status',
        label: t('rbHub.col.status', 'Status'),
        width: '130px',
        filterable: true,
        filterOptions: statusOptions,
        render: (row) => <EntityStatusChip status={String(row.status ?? 'draft')} />,
      },
      {
        id: 'created_at',
        label: t('rbHub.col.created', 'Utworzono'),
        width: '130px',
        sortable: true,
        render: (row) => (
          <span className="text-xs text-c-text-secondary">
            {formatDate(row.created_at as string)}
          </span>
        ),
      },
      {
        id: 'updated_at',
        label: t('rbHub.col.updated', 'Zaktualizowano'),
        width: '130px',
        sortable: true,
        render: (row) => (
          <span className="text-xs text-c-text-secondary">
            {formatDate(row.updated_at as string)}
          </span>
        ),
      },
    ];

    const getRowActions = (report: BuilderReport): RowAction[] => [
      // GÓRA — kontekst
      {
        id: 'open',
        label: t('common.open', 'Otwórz'),
        icon: ExternalLink,
        variant: 'primary',
        onClick: () => handleRowClick(report),
      },
      // DÓŁ — FIXED BOTTOM MANIFEST (reports have no due date → no Delay)
      {
        id: 'open_preview',
        label: t('rap.actions.openPreview', 'Otwórz podgląd'),
        icon: ChevronRight,
        divider: true,
        onClick: () => setSelectedId(report.id),
      },
      {
        id: 'edit',
        label: t('common.edit', 'Edytuj'),
        icon: ExternalLink,
        onClick: () => handleRowClick(report),
      },
      {
        // canon §14 + §9.2: Archive slot — soft-delete (backend TBD)
        id: 'archive',
        label: t('rap.actions.archive', 'Archiwizuj'),
        icon: Archive,
        disabled: true,
        description: t('common.comingSoon', 'Wkrótce'),
        onClick: () => {},
      },
    ];

    const selectedReport = selectedId
      ? (filteredReports.find((r) => r.id === selectedId) ?? null)
      : null;

    return (
      <div className="h-full overflow-hidden">
        <TableWithPreviewLayout<BuilderReport & { title: string }>
          selectedId={selectedId}
          selectedItem={selectedReport as (BuilderReport & { title: string }) | null}
          onSelect={setSelectedId}
          onOpenFull={(id) => {
            const row = filteredReports.find((x) => x.id === id);
            if (row) handleRowClick(row);
          }}
          itemIds={filteredReports.map((r) => r.id)}
          getItemById={(id) =>
            (filteredReports.find((x) => x.id === id) as BuilderReport & { title: string }) ?? null
          }
          renderPreview={(item) => (
            <div className="space-y-3">
              <div className="rounded-lg bg-c-surface-raised/[0.03] p-4 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <EntityStatusChip status={String(item.status ?? 'draft')} />
                  {item.report_type_v3 && (
                    <span className="text-xs font-mono font-bold text-c-text-secondary">
                      {item.report_type_v3}
                    </span>
                  )}
                </div>
                <dl className="text-sm space-y-1.5">
                  <div className="flex justify-between gap-3">
                    <dt className="text-c-text-secondary">
                      {t('rbHub.col.created', 'Utworzono')}
                    </dt>
                    <dd className="text-c-text">
                      {formatDate(item.created_at)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-c-text-secondary">
                      {t('rbHub.col.updated', 'Zaktualizowano')}
                    </dt>
                    <dd className="text-c-text">
                      {formatDate(item.updated_at)}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
          )}
        >
          <FilterableTable
            columns={columns}
            data={filteredReports}
            selectedRowId={selectedId}
            onRowClick={(row) => setSelectedId(row.id)}
            onRowDoubleClick={(row) => handleRowClick(row as unknown as BuilderReport)}
            getRowActions={(row) => getRowActions(row as unknown as BuilderReport)}
            activeFilters={activeFilters}
            onFilterChange={setActiveFilters}
            emptyMessage={t('rbHub.emptyReports.title', 'Brak raportów')}
          />
        </TableWithPreviewLayout>
      </div>
    );
  };

  // -----------------------------------------------------------------------
  // Tab: R1-R4 Reports
  // -----------------------------------------------------------------------

  const renderR1R4 = () => {
    if (r1r4Reports.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-full py-20 text-center">
          <Layout className="w-14 h-14 text-c-text-secondary mb-4" />
          <h3 className="text-lg font-semibold text-c-text mb-2">
            {t('rbHub.emptyR1R4.title', 'Brak raportów R1–R4')}
          </h3>
          <p className="text-sm text-c-text-secondary max-w-sm">
            {t('rbHub.emptyR1R4.description', 'Wygeneruj standardowy raport zarządczy.')}
          </p>
        </div>
      );
    }

    return (
      <div className="overflow-auto h-full p-4 space-y-3">
        {R1_R4_TYPES.map((rType) => {
          const grouped = r1r4Reports.filter((r) => r.report_type_v3 === rType);
          if (grouped.length === 0) return null;
          const meta = R_TYPE_META[rType];
          const isExpanded = expandedTypes.has(rType);
          const latest = grouped[0];

          return (
            <div
              key={rType}
              className="border border-c-border-subtle rounded-xl bg-c-surface"
            >
              <button
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:opacity-90/[0.03] transition-colors rounded-xl"
                onClick={() => toggleType(rType)}
              >
                {isExpanded ? (
                  <ChevronDown size={16} className="text-c-text-secondary" />
                ) : (
                  <ChevronRight size={16} className="text-c-text-secondary" />
                )}
                <span className={`font-mono text-sm font-bold ${meta.color}`}>{rType}</span>
                <span className="text-sm text-c-text font-medium">
                  {isPl ? meta.labelPl : meta.label}
                </span>
                <span className="ml-auto text-xs text-c-text-secondary">
                  {grouped.length} {t('rbHub.reports', 'raportów')}
                </span>
                <span className={`w-2 h-2 rounded-full ${meta.dotColor}`} />
              </button>

              {isExpanded && (
                <div className="border-t border-c-border-subtle">
                  {/* Latest report summary */}
                  <div className="px-4 py-3 bg-c-surface-raised/[0.02] flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-c-text truncate">
                        {latest.title}
                      </p>
                      <p className="text-xs text-c-text-secondary mt-0.5">
                        {t('rbHub.latestReport', 'Najnowszy')}: {formatDate(latest.created_at)}
                      </p>
                    </div>
                    {statusBadge(latest.status)}
                    <button
                      onClick={() => onOpenReport?.(latest.id)}
                      className="px-3 py-1.5 text-xs font-medium bg-c-text text-c-bg hover:opacity-90 rounded-lg transition-colors"
                    >
                      {t('common.open', 'Otwórz')}
                    </button>
                    <button
                      onClick={() => onCreateReport?.()}
                      className="px-3 py-1.5 text-xs font-medium border border-c-accent text-c-accent hover:bg-c-accent-soft0 rounded-lg transition-colors"
                    >
                      <Plus size={12} className="inline mr-1" />
                      {t('rbHub.generateNew', 'Generuj nowy')}
                    </button>
                  </div>

                  {grouped.length > 1 && (
                    <div className="divide-y divide-c-border-subtle">
                      {grouped.slice(1).map((report) => (
                        <div
                          key={report.id}
                          className="px-4 py-2.5 flex items-center gap-3 hover:opacity-90/[0.02] cursor-pointer transition-colors"
                          onClick={() => onOpenReport?.(report.id)}
                        >
                          <span className="text-sm text-c-text flex-1 truncate">
                            {report.title}
                          </span>
                          {statusBadge(report.status)}
                          <span className="text-xs text-c-text-secondary">
                            {formatDate(report.created_at)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  // -----------------------------------------------------------------------
  // Tab: Templates
  // -----------------------------------------------------------------------

  const renderTemplates = () => {
    if (filteredTemplates.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-full py-20 text-center">
          <FileText className="w-14 h-14 text-c-text-secondary mb-4" />
          <h3 className="text-lg font-semibold text-c-text mb-2">
            {t('rbHub.emptyTemplates.title', 'Brak szablonów')}
          </h3>
          <p className="text-sm text-c-text-secondary max-w-sm">
            {t('rbHub.emptyTemplates.description', 'Szablony raportów pojawią się tutaj.')}
          </p>
        </div>
      );
    }

    return (
      <div className="overflow-auto h-full p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredTemplates.map((tpl) => (
          <div
            key={tpl.id}
            className="border border-c-border-subtle rounded-xl bg-c-surface p-4 flex flex-col gap-3 hover:border-c-accent transition-colors"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-semibold text-c-text truncate">
                  {tpl.name}
                </h4>
                {tpl.description && (
                  <p className="text-xs text-c-text-secondary mt-1 line-clamp-2">
                    {tpl.description}
                  </p>
                )}
              </div>
              {tpl.report_type_v3 && (
                <span className="ml-2 px-2 py-0.5 text-[10px] font-bold font-mono rounded bg-c-surface-raised text-c-text-secondary">
                  {tpl.report_type_v3}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 mt-auto">
              <button
                onClick={() => onCreateReport?.()}
                className="flex-1 px-3 py-1.5 text-xs font-medium bg-c-text text-c-bg hover:opacity-90 rounded-lg transition-colors text-center"
              >
                {t('rbHub.useTemplate', 'Użyj szablonu')}
              </button>
              <button
                onClick={() =>
                  setScheduleModal({ open: true, templateId: tpl.id, templateName: tpl.name })
                }
                className="px-3 py-1.5 text-xs font-medium border border-c-border text-c-text-secondary hover:opacity-90 rounded-lg transition-colors"
                title={t('rbHub.scheduleFromTemplate', 'Zaplanuj raport z szablonu')}
              >
                <Calendar size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
    );
  };

  // -----------------------------------------------------------------------
  // Tab: Schedules
  // -----------------------------------------------------------------------

  const renderSchedules = () => {
    if (filteredSchedules.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-full py-20 text-center">
          <Clock className="w-14 h-14 text-c-text-secondary mb-4" />
          <h3 className="text-lg font-semibold text-c-text mb-2">
            {t('rbHub.emptySchedules.title', 'Brak harmonogramów')}
          </h3>
          <p className="text-sm text-c-text-secondary max-w-sm">
            {t(
              'rbHub.emptySchedules.description',
              'Utwórz harmonogram, aby automatycznie generować raporty.'
            )}
          </p>
        </div>
      );
    }

    return (
      <div className="overflow-auto h-full">
        <table /* §27-exempt: render danych nie-listowy, nie spelnia definicji 1 (przegladana kolekcja encji z akcjami) */  className="w-full text-left">
          <thead className="sticky top-0 bg-c-surface-raised border-b border-c-border-subtle">
            <tr>
              <th className="px-4 py-3 text-xs font-semibold text-c-text-secondary uppercase tracking-wide">
                {t('rbHub.col.name', 'Nazwa')}
              </th>
              <th className="px-4 py-3 text-xs font-semibold text-c-text-secondary uppercase tracking-wide w-28">
                {t('rbHub.col.frequency', 'Częstotliwość')}
              </th>
              <th className="px-4 py-3 text-xs font-semibold text-c-text-secondary uppercase tracking-wide w-32">
                {t('rbHub.col.nextRun', 'Następne uruchomienie')}
              </th>
              <th className="px-4 py-3 text-xs font-semibold text-c-text-secondary uppercase tracking-wide w-24">
                {t('rbHub.col.status', 'Status')}
              </th>
              <th className="px-4 py-3 w-20" />
            </tr>
          </thead>
          <tbody className="divide-y divide-c-border-subtle">
            {filteredSchedules.map((s) => (
              <tr
                key={s.id}
                className="hover:opacity-90/[0.03] transition-colors"
              >
                <td className="px-4 py-3">
                  <span className="text-sm font-medium text-c-text">
                    {s.name}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-c-text-secondary capitalize">
                  {s.frequency}
                </td>
                <td className="px-4 py-3 text-xs text-c-text-secondary">
                  {s.nextRunAt ? formatDate(s.nextRunAt) : '—'}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium rounded-full ${
                      s.isActive
                        ? 'bg-emerald-500/10 text-emerald-500'
                        : 'bg-c-text-muted text-c-text-secondary'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${s.isActive ? 'bg-emerald-500' : 'bg-c-text-muted'}`}
                    />
                    {s.isActive ? t('rbHub.active', 'Aktywny') : t('rbHub.paused', 'Wstrzymany')}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => handleToggleSchedule(s.id, s.isActive)}
                    className="p-1.5 rounded-lg hover:bg-c-text text-c-bg-secondary hover:text-c-text transition-colors"
                    title={
                      s.isActive
                        ? t('rbHub.pauseSchedule', 'Wstrzymaj')
                        : t('rbHub.activateSchedule', 'Aktywuj')
                    }
                  >
                    {s.isActive ? <Pause size={14} /> : <Play size={14} />}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  // -----------------------------------------------------------------------
  // Content router
  // -----------------------------------------------------------------------

  const renderTabContent = () => {
    if (isLoading) {
      return (
        <div className="h-full p-6">
          <LoadingState template="list" rows={6} />
        </div>
      );
    }

    switch (activeTab) {
      case 'my_reports':
        return renderMyReports();
      case 'r1_r4':
        return renderR1R4();
      case 'templates':
        return renderTemplates();
      case 'schedules':
        return renderSchedules();
      default:
        return null;
    }
  };

  const ctaLabel = useMemo(() => {
    if (activeTab === 'schedules') return undefined;
    return `+ ${t('rbHub.newReport', 'Nowy raport')}`;
  }, [activeTab, t]);

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <>
      <div className="h-full" data-testid="report-builder-hub">
        <ModuleHub
          persistViewModeKey="report_builder_hub"
          tabs={tabs}
          activeTab={activeTab as ModuleTab}
          onTabChange={(tab) => {
            setActiveTab(tab as HubTab);
            setActiveFilters([]);
          }}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          onSearch={setSearchQuery}
          openDocuments={openDocuments}
          activeDocumentId={activeDocumentId}
          onSelectDocument={setActiveDocumentId}
          onCloseDocument={handleCloseDocument}
          onShowList={handleShowList}
          activeFilters={activeFilters}
          onRemoveFilter={handleRemoveFilter}
          onClearFilters={handleClearFilters}
          onNewItem={ctaLabel ? handleNewItem : undefined}
          newItemLabel={ctaLabel}
          availableViewModes={['table']}
        >
          <div className="h-full min-h-0 overflow-hidden">{renderTabContent()}</div>
        </ModuleHub>
      </div>

      <ScheduleReportModal
        isOpen={scheduleModal.open}
        onClose={() => setScheduleModal({ open: false, templateId: '', templateName: '' })}
        templateId={scheduleModal.templateId}
        templateName={scheduleModal.templateName}
        isPl={!!isPl}
        onScheduleCreated={(schedule) => {
          setSchedules((prev) => [...prev, schedule as ScheduleItem]);
        }}
      />
    </>
  );
};

export default ReportBuilderHub;
