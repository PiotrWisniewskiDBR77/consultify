import { ChevronRight, ExternalLink, FileText, MessageCircle, Sparkles, X } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import {
  type ActionRow,
  type MetaPill,
  PreviewActionBar,
  PreviewDetailsSection,
  PreviewMetaCard,
  PreviewRelations,
  type RelationItem,
} from '@/components/shared/PreviewPane';
import { useDialogA11y } from '@/components/ui/primitives/useDialogA11y';
import { useOpenChatWithContext } from '@/hooks/useOpenChatWithContext';
import { Api } from '@/services/api';
import { shouldFallbackToLegacyResults, V8ResultsApi } from '@/services/api/v8/results';

import type { FilterChip } from '../shared/ModuleHub/ActiveFilters';
import {
  FilterableTable,
  type TableColumn,
  type TableRow,
} from '../shared/ModuleHub/FilterableTable';
import { type RowAction } from '../shared/RowActionsMenu';
import { type PreviewableItem, TableWithPreviewLayout } from '../shared/TableWithPreviewLayout';
import type { ResultsKPI, ResultsLifecycleFilter, ResultsTrackedInitiative } from './kpiDomain';
import { buildKpiQueueGroups } from './kpiDomain';
import { loadResultsKpis } from './kpiRuntime';
import { createResultsShowcaseReports, shouldUseResultsShowcaseData } from './resultsShowcaseData';

export interface ResultsKpiReportsViewProps {
  activeFilters: FilterChip[];
  onFilterChange: (filters: FilterChip[]) => void;
  createNonce?: number;
  selectedLifecycleFilter?: ResultsLifecycleFilter;
  selectedInitiatives?: ResultsTrackedInitiative[];
  selectedKpis?: ResultsKPI[];
}

export const ResultsKpiReportsView: React.FC<ResultsKpiReportsViewProps> = ({
  activeFilters,
  onFilterChange,
  createNonce,
  selectedLifecycleFilter = 'all',
  selectedInitiatives = [],
  selectedKpis = [],
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const openChatWithContext = useOpenChatWithContext();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  type ActionItem = {
    key: string;
    title: string;
    kpiId: string;
    kpiName?: string;
    severity: 'AMBER' | 'RED';
    dueDate?: string | null;
    status?: string;
    selected: boolean;
    ownerUserId?: string | null;
  };

  const [rows, setRows] = useState<TableRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshingReportId, setRefreshingReportId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const createDialogRef = useRef<HTMLDivElement>(null);
  const closeCreateDialog = useCallback(() => {
    setCreateOpen(false);
    setAiNarrativeHint('');
  }, []);
  useDialogA11y({ open: createOpen, onClose: closeCreateDialog, containerRef: createDialogRef });

  const [availableKpis, setAvailableKpis] = useState<
    Array<{ id: string; name: string; initiativeName?: string | null }>
  >([]);
  const [availableInitiatives, setAvailableInitiatives] = useState<
    Array<{ id: string; name: string; status?: string | null }>
  >([]);
  const [kpisLoading, setKpisLoading] = useState(false);
  const [kpiSearch, setKpiSearch] = useState('');
  const [selectedKpiIds, setSelectedKpiIds] = useState<string[]>([]);
  const [selectedInitiativeIds, setSelectedInitiativeIds] = useState<string[]>([]);
  const [reviewContext, setReviewContext] = useState({
    requiresReview: 0,
    discrepancy: 0,
    needsEntry: 0,
  });

  const [tasksModalOpen, setTasksModalOpen] = useState(false);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [tasksCreating, setTasksCreating] = useState(false);
  const [tasksReportRow, setTasksReportRow] = useState<TableRow | null>(null);
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const tasksDialogRef = useRef<HTMLDivElement>(null);
  const closeTasksDialog = useCallback(() => {
    if (!tasksCreating) setTasksModalOpen(false);
  }, [tasksCreating]);
  useDialogA11y({
    open: tasksModalOpen,
    onClose: closeTasksDialog,
    containerRef: tasksDialogRef,
  });

  const [periodStart, setPeriodStart] = useState(() => {
    const d = new Date();
    const start = new Date(d.getFullYear(), d.getMonth(), 1);
    return start.toISOString().slice(0, 10);
  });
  const [periodEnd, setPeriodEnd] = useState(() => {
    const d = new Date();
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    return end.toISOString().slice(0, 10);
  });
  const [title, setTitle] = useState('');
  const [reportTemplate, setReportTemplate] = useState('benefits-review');
  const [aiNarrativeHint, setAiNarrativeHint] = useState('');
  const [aiDraftLoading, setAiDraftLoading] = useState(false);

  const formatTemplateLabel = useCallback(
    (templateKey?: string | null) => {
      switch (templateKey) {
        case 'control-pack':
          return t('results.kpiReports.templates.controlPack', 'Control pack');
        case 'portfolio-review':
          return t('results.kpiReports.templates.portfolio', 'Portfolio KPI review');
        case 'executive-monthly':
          return t('results.kpiReports.templates.executive', 'Executive monthly review');
        case 'custom':
          return t('common.custom', 'Custom');
        default:
          return t('results.kpiReports.templates.benefits', 'Benefits review');
      }
    },
    [t]
  );

  const columns: TableColumn[] = useMemo(
    () => [
      {
        id: 'type',
        label: t('common.type', 'Type'),
        width: '18%',
        render: (row) => (
          <div>
            <div className="text-sm font-medium text-c-text">{formatTemplateLabel(row.type)}</div>
            <div className="mt-1 text-xs text-c-text-muted dark:text-c-text-muted">
              KPI scorecard
            </div>
          </div>
        ),
      },
      {
        id: 'name',
        label: t('common.name', 'Name'),
        width: '44%',
        render: (row) => (
          <div>
            <div className="text-sm font-medium text-c-text">{row.name}</div>
            <div className="mt-1 flex flex-wrap gap-2 text-xs text-c-text-muted dark:text-c-text-muted">
              <span>{row.kpiCount ?? 0} KPI</span>
              <span>·</span>
              <span>
                {row.initiativeCount ?? 0} {t('results.tabs.initiatives', 'Initiatives')}
              </span>
              <span>·</span>
              <span>
                {row.openActionCount ?? 0} {t('results.kpiReports.openActions', 'open actions')}
              </span>
            </div>
          </div>
        ),
      },
      { id: 'period', label: t('common.period', 'Period'), width: '16%' },
      { id: 'status', label: t('common.status', 'Status'), width: '16%' },
      { id: 'updatedAt', label: t('common.updated', 'Updated'), width: '18%' },
    ],
    [formatTemplateLabel, t]
  );

  type PreviewReport = PreviewableItem &
    TableRow & {
      summaryText: string;
      relationItems: RelationItem[];
    };

  const previewItems = useMemo<PreviewReport[]>(
    () =>
      rows.map((row) => ({
        ...row,
        title: String(row.name || ''),
        summaryText: t(
          'results.kpiReports.preview.summary',
          '{{name}} packages KPI review for {{period}} with {{kpiCount}} KPI across {{initiativeCount}} initiatives. {{openActionCount}} open actions remain linked to this artifact.',
          {
            name: String(row.name || 'KPI report'),
            period: String(row.period || '—'),
            kpiCount: row.kpiCount ?? 0,
            initiativeCount: row.initiativeCount ?? 0,
            openActionCount: row.openActionCount ?? 0,
          }
        ),
        relationItems: [
          {
            label: t('results.kpiReports.relation.kpis', '{{count}} KPI in snapshot', {
              count: row.kpiCount ?? 0,
            }),
            type: 'kpi',
          },
          {
            label: t('results.kpiReports.relation.initiatives', '{{count}} initiatives in scope', {
              count: row.initiativeCount ?? 0,
            }),
            type: 'initiative',
          },
          {
            label: t('results.kpiReports.relation.actions', '{{count}} open actions', {
              count: row.openActionCount ?? 0,
            }),
            type: 'report',
          },
        ].filter((item) => !item.label.startsWith('0 ')),
      })),
    [rows, t]
  );

  const selectedItem = useMemo(
    () => (selectedId ? (previewItems.find((item) => item.id === selectedId) ?? null) : null),
    [previewItems, selectedId]
  );

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const res: any = await Api.get('/results/kpi-reports');
      const list = (res?.data || []) as any[];
      const reports =
        list.length === 0 && shouldUseResultsShowcaseData() ? createResultsShowcaseReports() : list;
      setRows(
        reports.map((r: any) => ({
          id: r.reportId || r.id,
          reportId: r.reportId || r.id,
          snapshotId: r.snapshotId,
          type: r.templateKey || 'benefits-review',
          name: r.title || r.name,
          period:
            r.periodStart && r.periodEnd
              ? `${r.periodStart} → ${r.periodEnd}`
              : r.periodStart || '—',
          status: r.status || 'DRAFT',
          updatedAt: r.updatedAt ? new Date(r.updatedAt).toLocaleDateString() : '—',
          aiNarrativeHint: r.aiNarrativeHint || '',
          initiativeCount: r.initiativeCount ?? null,
          kpiCount: r.kpiCount ?? null,
          openActionCount: r.openActionCount ?? null,
        }))
      );
    } catch {
      setRows(
        shouldUseResultsShowcaseData()
          ? createResultsShowcaseReports().map((r) => ({
              id: r.id,
              reportId: r.reportId,
              snapshotId: r.snapshotId,
              type: 'benefits-review',
              name: r.title,
              period: `${r.periodStart} → ${r.periodEnd}`,
              status: r.status,
              updatedAt: new Date(r.updatedAt).toLocaleDateString(),
            }))
          : []
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  useEffect(() => {
    if (!createNonce) return;
    setCreateOpen(true);
  }, [createNonce]);

  useEffect(() => {
    if (!createOpen) return;
    let cancelled = false;
    (async () => {
      setKpisLoading(true);
      try {
        const runtime = await loadResultsKpis();
        const items = runtime.kpis
          .map((k) => ({
            id: String(k.id || '').trim(),
            name: String(k.name || '').trim(),
            initiativeName: (k.initiativeName || null) as string | null,
          }))
          .filter((k) => k.id && k.name)
          .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
        const queue = buildKpiQueueGroups(runtime.kpis);
        if (cancelled) return;
        setAvailableKpis(items);
        setSelectedKpiIds(items.map((k) => k.id));
        const scopedInitiatives = (selectedInitiatives || []).map((initiative) => ({
          id: initiative.initiativeId,
          name: initiative.initiativeName,
          status: initiative.initiativeStatus,
        }));
        setAvailableInitiatives(scopedInitiatives);
        setSelectedInitiativeIds(scopedInitiatives.map((initiative) => initiative.id));
        setReviewContext({
          requiresReview: queue.requiresReview.length,
          discrepancy: queue.discrepancy.length,
          needsEntry: queue.needsEntry.length,
        });
      } catch {
        if (cancelled) return;
        setAvailableKpis([]);
        setSelectedKpiIds([]);
        setAvailableInitiatives([]);
        setSelectedInitiativeIds([]);
        setReviewContext({ requiresReview: 0, discrepancy: 0, needsEntry: 0 });
      } finally {
        if (!cancelled) setKpisLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [createOpen, selectedInitiatives]);

  const filteredKpis = useMemo(() => {
    const q = kpiSearch.trim().toLowerCase();
    if (!q) return availableKpis;
    return availableKpis.filter((k) => {
      const a = (k.name || '').toLowerCase();
      const b = (k.initiativeName || '').toLowerCase();
      return a.includes(q) || b.includes(q);
    });
  }, [availableKpis, kpiSearch]);

  const generateAiDraft = useCallback(async () => {
    setAiDraftLoading(true);
    try {
      const selectedInitiativesLabel = availableInitiatives
        .filter((initiative) => selectedInitiativeIds.includes(initiative.id))
        .map((initiative) => initiative.name)
        .slice(0, 12);
      const selectedKpisLabel = availableKpis
        .filter((kpi) => selectedKpiIds.includes(kpi.id))
        .map((kpi) => `${kpi.name}${kpi.initiativeName ? ` (${kpi.initiativeName})` : ''}`)
        .slice(0, 20);
      const contextText = [
        `Template: ${reportTemplate}`,
        `Period start: ${periodStart}`,
        `Period end: ${periodEnd || 'n/a'}`,
        `Lifecycle filter: ${selectedLifecycleFilter}`,
        `Initiatives: ${selectedInitiativesLabel.join(', ') || 'none'}`,
        `KPIs: ${selectedKpisLabel.join(', ') || 'none'}`,
        `Queue summary: requires review ${reviewContext.requiresReview}, discrepancy ${reviewContext.discrepancy}, needs entry ${reviewContext.needsEntry}`,
      ].join('\n');
      const systemInstruction = [
        'You are drafting a KPI performance review title and short reporting brief.',
        'Return ONLY valid JSON.',
        'Schema: {"title": string, "brief": string}',
        'The title must be concise and executive-friendly.',
        'The brief must be 1-2 sentences and mention scope, key risks, and intended report purpose.',
      ].join('\n');
      const aiRes: any = await Api.post('/ai/refine-text?timeoutMs=20000', {
        text: contextText,
        mode: 'generate',
        systemInstruction,
        fieldLabel: 'KPI report draft',
        language: 'en',
      });
      const raw = String(aiRes?.text || '').trim();
      const parsed = JSON.parse(raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)?.[1] || raw);
      if (parsed?.title) setTitle(String(parsed.title));
      if (parsed?.brief) setAiNarrativeHint(String(parsed.brief));
    } catch {
      toast.error(t('results.kpiReports.create.aiFailed', 'Failed to generate AI draft'));
    } finally {
      setAiDraftLoading(false);
    }
  }, [
    availableInitiatives,
    availableKpis,
    periodEnd,
    periodStart,
    reportTemplate,
    reviewContext.discrepancy,
    reviewContext.needsEntry,
    reviewContext.requiresReview,
    selectedInitiativeIds,
    selectedKpiIds,
    selectedLifecycleFilter,
    t,
  ]);

  const handleCreate = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!periodStart) return;
      setCreating(true);
      try {
        const filters = {
          lifecycleFilter: selectedLifecycleFilter,
          initiativeIds: selectedInitiativeIds,
          ...(reportTemplate !== 'benefits-review' ? { templateKey: reportTemplate } : {}),
          ...(aiNarrativeHint.trim() ? { aiNarrativeHint: aiNarrativeHint.trim() } : {}),
        };
        const payload = {
          periodStart,
          periodEnd: periodEnd || null,
          title: title.trim() || undefined,
          filters,
          initiativeIds: selectedInitiativeIds.length ? selectedInitiativeIds : undefined,
          kpiIds: selectedKpiIds.length ? selectedKpiIds : undefined,
        };
        let res: any;
        try {
          res = await V8ResultsApi.createKpiReport(payload);
        } catch (error) {
          if (!shouldFallbackToLegacyResults(error)) {
            throw error;
          }
          res = await Api.post('/results/kpi-reports', payload);
        }
        const reportId = res?.data?.reportId;
        const resolvedReportId = reportId || res?.reportId;
        setCreateOpen(false);
        setTitle('');
        setKpiSearch('');
        setAiNarrativeHint('');
        await fetchReports();
        if (resolvedReportId) navigate(`/reports/builder/${resolvedReportId}`);
      } finally {
        setCreating(false);
      }
    },
    [
      periodStart,
      periodEnd,
      title,
      reportTemplate,
      aiNarrativeHint,
      selectedInitiativeIds,
      selectedKpiIds,
      fetchReports,
      navigate,
      selectedLifecycleFilter,
    ]
  );

  const inputCls =
    'w-full h-9 px-3 text-sm rounded-lg border border-c-border-strong dark:border-c-border-strong bg-c-surface-raised text-c-text placeholder:text-c-text-muted focus:outline-none focus:ring-2 focus:ring-c-focus focus:border-c-focus-solid transition-colors';
  const labelCls = 'block text-xs font-medium text-c-text-muted dark:text-c-text-muted mb-1';

  const loadActionsForRow = useCallback(
    async (row: TableRow) => {
      if (!row?.snapshotId) {
        toast.error(
          t('results.kpiReports.tasks.noSnapshot', 'This report has no snapshot linked.')
        );
        return;
      }
      setTasksReportRow(row);
      setTasksModalOpen(true);
      setTasksLoading(true);
      try {
        const res: any = await Api.get(`/results/kpi-reports/${row.snapshotId}`);
        const snap = res?.data?.snapshot;
        const plan = (snap?.actionPlan || []) as any[];
        const items: ActionItem[] = plan.map((a: any): ActionItem => {
          const due = a.dueDate ? String(a.dueDate).slice(0, 10) : null;
          const done = String(a.status || '').toUpperCase() === 'DONE';
          const kpiId = String(a.kpiId || a.relatedObjectId || '');
          return {
            key: `${a.id || a.title}-${kpiId}`,
            title: String(a.title || '').trim() || '(untitled)',
            kpiId,
            kpiName: a.kpiName || undefined,
            severity: a.severity === 'RED' ? 'RED' : 'AMBER',
            dueDate: due,
            status: a.status,
            selected: !done,
            ownerUserId: a.ownerUserId ?? null,
          };
        });
        setActionItems(items);
      } catch {
        toast.error(t('common.loadFailed', 'Load failed'));
        setActionItems([]);
      } finally {
        setTasksLoading(false);
      }
    },
    [t]
  );

  const createTasksFromSelected = useCallback(async () => {
    const selected = actionItems.filter((a) => a.selected);
    if (selected.length === 0) return;
    setTasksCreating(true);
    try {
      for (const a of selected) {
        const dueIso = a.dueDate ? new Date(`${a.dueDate}T00:00:00.000Z`).toISOString() : undefined;
        await Api.post('/tasks', {
          title: `[KPI] ${a.title}`,
          description: tasksReportRow?.reportId
            ? `Created from KPI report: /reports/builder/${tasksReportRow.reportId}`
            : 'Created from KPI report',
          dueDate: dueIso,
          priority: a.severity === 'RED' ? 'high' : 'medium',
          taskType: 'execution',
          source: 'manual',
          assigneeId: a.ownerUserId || undefined,
          kpiId: a.kpiId || undefined,
          why: 'Deviation action plan materialization',
        });
      }
      toast.success(t('results.kpiReports.tasks.created', 'Tasks created'), { duration: 2500 });
      setTasksModalOpen(false);
      setActionItems([]);
      setTasksReportRow(null);
    } catch {
      toast.error(t('results.kpiReports.tasks.createFailed', 'Failed to create tasks'));
    } finally {
      setTasksCreating(false);
    }
  }, [actionItems, tasksReportRow, t]);

  const getRowActions = useCallback(
    (row: TableRow): RowAction[] => [
      {
        id: 'preview',
        label: t('common.preview', 'Open preview'),
        icon: ChevronRight,
        onClick: () => setSelectedId(String(row.id)),
      },
      {
        id: 'open',
        label: t('common.open', 'Open'),
        icon: ExternalLink,
        onClick: () => navigate(`/reports/builder/${row.reportId}`),
      },
      {
        id: 'refresh',
        label:
          refreshingReportId === row.reportId
            ? t('common.loading', 'Loading...')
            : t('results.kpiReports.refresh', 'Refresh snapshot'),
        onClick: async () => {
          if (!row.snapshotId || refreshingReportId === row.reportId) return;
          setRefreshingReportId(row.reportId);
          try {
            let res: any;
            try {
              res = await V8ResultsApi.refreshKpiReport(String(row.snapshotId));
            } catch (error) {
              if (!shouldFallbackToLegacyResults(error)) {
                throw error;
              }
              res = await Api.post(`/results/kpi-reports/${row.snapshotId}/refresh`, {});
            }
            toast.success(t('results.kpiReports.refreshDone', 'Snapshot refreshed'));
            await fetchReports();
            const nextReportId = res?.data?.reportId || res?.reportId;
            if (nextReportId) {
              navigate(`/reports/builder/${nextReportId}`);
            }
          } catch {
            toast.error(t('results.kpiReports.refreshFailed', 'Failed to refresh snapshot'));
          } finally {
            setRefreshingReportId(null);
          }
        },
      },
      {
        id: 'tasks',
        label: t('results.kpiReports.tasks.create', 'Create tasks from action plan'),
        onClick: () => void loadActionsForRow(row),
        divider: true,
      },
      {
        id: 'discuss',
        label: t('results.kpiReports.discuss', 'Discuss report'),
        onClick: async () => {
          try {
            const relatedInitiativeIds = Array.from(
              new Set(
                selectedInitiatives
                  .map((initiative) => String(initiative.initiativeId || '').trim())
                  .filter(Boolean)
              )
            );
            const relatedKpiIds = Array.from(
              new Set(selectedKpis.map((kpi) => String(kpi.id || '').trim()).filter(Boolean))
            );
            await openChatWithContext({
              entityType: 'kpi_report',
              entityId: String(row.reportId || row.id),
              entityName: String(row.title || 'KPI Report'),
              contextData: {
                ...(row as unknown as Record<string, unknown>),
                initiativeIds: relatedInitiativeIds,
                kpiIds: relatedKpiIds,
                p11Handoff: {
                  source: 'results_kpi_reports',
                  lane: 'kpi_reports',
                  reportId: String(row.reportId || row.id),
                  initiativeIds: relatedInitiativeIds,
                  kpiIds: relatedKpiIds,
                },
              },
              pmoContext: {
                reportId: String(row.reportId || row.id),
                initiativeIds: relatedInitiativeIds,
              },
            });
            toast.success(t('common.chatOpened', 'Chat opened'), { duration: 1500 });
          } catch {
            toast.error(t('common.chatOpenError', 'Failed to open chat'));
          }
        },
      },
    ],
    [
      navigate,
      t,
      loadActionsForRow,
      refreshingReportId,
      fetchReports,
      openChatWithContext,
      selectedInitiatives,
      selectedKpis,
    ]
  );

  return (
    <>
      <div className="p-4">
        <TableWithPreviewLayout<PreviewReport>
          selectedId={selectedId}
          selectedItem={selectedItem}
          onSelect={setSelectedId}
          onOpenFull={(id) => {
            const report = previewItems.find((item) => item.id === id);
            if (report?.reportId) {
              navigate(`/reports/builder/${report.reportId}`);
            }
          }}
          itemIds={previewItems.map((item) => item.id)}
          getItemById={(id) => previewItems.find((item) => item.id === id) ?? null}
          renderPreview={(item) => {
            const metaPills: MetaPill[] = [
              {
                label: formatTemplateLabel(String(item.type || 'benefits-review')),
                className: 'bg-blue-500/10 text-blue-500 dark:text-blue-300',
              },
              {
                label: String(item.status || 'DRAFT'),
                className:
                  'bg-c-surface-raised/10 text-c-text-secondary dark:text-c-text-secondary',
              },
              {
                label: t('results.kpiReports.relation.kpis', '{{count}} KPI', {
                  count: item.kpiCount ?? 0,
                }),
                className: 'bg-emerald-500/10 text-emerald-500 dark:text-emerald-300',
              },
              {
                label:
                  t('results.tabs.initiatives', 'Initiatives') + `: ${item.initiativeCount ?? 0}`,
                className: 'bg-amber-500/10 text-amber-600 dark:text-amber-300',
              },
            ];

            return (
              <div className="space-y-4">
                <PreviewMetaCard pills={metaPills}>
                  <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <div className="text-c-text-muted dark:text-c-text-muted">
                        {t('common.period', 'Period')}
                      </div>
                      <div className="text-c-text">{String(item.period || '—')}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-c-text-muted dark:text-c-text-muted">
                        {t('common.updated', 'Updated')}
                      </div>
                      <div className="text-c-text">{String(item.updatedAt || '—')}</div>
                    </div>
                  </div>
                </PreviewMetaCard>

                <PreviewDetailsSection
                  label={t('common.summary', 'Summary')}
                  text={item.summaryText}
                  compact
                >
                  <div className="mt-3 rounded-xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface p-3">
                    <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-c-text-muted dark:text-c-text-muted">
                      {t('results.kpiReports.scorecardFlow', 'Scorecard and reconciliation flow')}
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs text-c-text-muted dark:text-c-text-muted">
                      <div className="rounded-lg bg-c-surface-raised px-3 py-2">
                        {t('results.kpi.queue.requiresReview', 'Requires review')}:{' '}
                        {reviewContext.requiresReview}
                      </div>
                      <div className="rounded-lg bg-c-surface-raised px-3 py-2">
                        {t('results.kpi.queue.discrepancy', 'Discrepancy')}:{' '}
                        {reviewContext.discrepancy}
                      </div>
                      <div className="rounded-lg bg-c-surface-raised px-3 py-2">
                        {t('results.filters.needsEntry', 'Needs entry')}: {reviewContext.needsEntry}
                      </div>
                    </div>
                  </div>
                </PreviewDetailsSection>

                <div>
                  <div className="text-[11px] font-semibold text-c-text-muted dark:text-c-text-muted uppercase tracking-wider">
                    {t('common.relations', 'Relations')}
                  </div>
                  <PreviewRelations
                    items={item.relationItems}
                    emptyLabel={t('common.noRelations', 'No relations')}
                  />
                </div>
              </div>
            );
          }}
          renderPreviewFooter={(item) => {
            const rows: ActionRow[] = [
              {
                columns: 2,
                buttons: [
                  {
                    label: t('common.open', 'Open'),
                    icon: FileText,
                    colorScheme: 'primary',
                    onClick: () => navigate(`/reports/builder/${item.reportId}`),
                  },
                  {
                    label:
                      refreshingReportId === item.reportId
                        ? t('common.loading', 'Loading...')
                        : t('results.kpiReports.refresh', 'Refresh snapshot'),
                    icon: Sparkles,
                    colorScheme: 'neutral',
                    onClick: () =>
                      void getRowActions(item)
                        .find((action) => action.id === 'refresh')
                        ?.onClick(),
                    disabled: !item.snapshotId || refreshingReportId === item.reportId,
                  },
                ],
              },
              {
                buttons: [
                  {
                    label: t('results.kpiReports.tasks.create', 'Create tasks from action plan'),
                    colorScheme: 'neutral',
                    onClick: () => void loadActionsForRow(item),
                    flex: true,
                  },
                ],
              },
            ];

            return <PreviewActionBar rows={rows} />;
          }}
        >
          <FilterableTable
            columns={columns}
            data={rows}
            selectedRowId={selectedId}
            activeFilters={activeFilters}
            onFilterChange={onFilterChange}
            density="compact"
            canvasClassName="pl-4 pr-1.5 pt-3 pb-4"
            getRowActions={getRowActions}
            onRowClick={(row) => setSelectedId(String(row.id))}
            onRowDoubleClick={(row) => navigate(`/reports/builder/${row.reportId}`)}
            emptyMessage={
              loading
                ? t('common.loading', 'Loading...')
                : t(
                    'results.kpiReports.empty',
                    'No KPI reports yet. Create a report to review performance and corrective actions.'
                  )
            }
          />
        </TableWithPreviewLayout>
      </div>

      <div className="px-4 pb-4">
        <div className="rounded-2xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface p-4">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-c-text">
                {t('results.kpiReports.scorecardFlow', 'Scorecard and reconciliation flow')}
              </h3>
              <p className="mt-1 text-xs text-c-text-muted dark:text-c-text-muted">
                {t(
                  'results.kpiReports.scorecardFlowHint',
                  'Reports should package signal review, discrepancy evidence, and next actions into one artifact.'
                )}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="inline-flex items-center gap-2 rounded-full bg-c-surface-raised px-3 py-1 text-c-text-secondary">
                {t('results.kpi.queue.requiresReview', 'Requires review')}:{' '}
                {reviewContext.requiresReview}
              </span>
              <span className="inline-flex items-center gap-2 rounded-full bg-danger-500/10 px-3 py-1 text-danger-500">
                {t('results.kpi.queue.discrepancy', 'Discrepancy')}: {reviewContext.discrepancy}
              </span>
              <span className="inline-flex items-center gap-2 rounded-full bg-amber-500/10 px-3 py-1 text-amber-600 dark:text-amber-300">
                {t('results.filters.needsEntry', 'Needs entry')}: {reviewContext.needsEntry}
              </span>
            </div>
          </div>
        </div>
      </div>

      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-c-bg/60 backdrop-blur-sm"
            onClick={closeCreateDialog}
          />
          <div
            ref={createDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="kpi-report-create-heading"
            tabIndex={-1}
            className="relative w-full max-w-lg mx-4 bg-c-surface border border-slate-200/60 dark:border-white/[0.03] rounded-2xl shadow-2xl outline-none"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-c-border-subtle dark:border-c-border-subtle">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-c-info/10">
                  <FileText size={16} className="text-c-info" />
                </div>
                <h2 id="kpi-report-create-heading" className="text-lg font-semibold text-c-text">
                  {t('results.kpiReports.create.title', 'New KPI report')}
                </h2>
              </div>
              <button
                type="button"
                onClick={closeCreateDialog}
                aria-label={t('common.close', 'Close')}
                className="p-1.5 rounded-lg hover:bg-c-surface-raised dark:hover:bg-c-surface-raised text-c-text-muted transition-colors"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div>
                <label htmlFor="kpi-report-create-name" className={labelCls}>
                  {t('common.name', 'Name')}
                </label>
                <div className="flex gap-2">
                  <input
                    id="kpi-report-create-name"
                    className={inputCls}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder={t(
                      'results.kpiReports.create.titlePlaceholder',
                      'e.g. Monthly KPI Review'
                    )}
                  />
                  <button
                    type="button"
                    onClick={() => void generateAiDraft()}
                    disabled={aiDraftLoading || selectedKpiIds.length === 0}
                    className="inline-flex items-center gap-1 rounded-lg border border-c-info/30 bg-c-info/10 px-3 text-xs font-medium text-c-info dark:text-c-info disabled:opacity-50"
                  >
                    <Sparkles size={14} />
                    {aiDraftLoading
                      ? t('common.loading', 'Loading...')
                      : t('results.kpiReports.create.aiDraft', 'AI draft')}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <label htmlFor="kpi-report-create-template" className={labelCls}>
                    {t('results.kpiReports.create.template', 'Template')}
                  </label>
                  <select
                    id="kpi-report-create-template"
                    className={inputCls}
                    value={reportTemplate}
                    onChange={(e) => setReportTemplate(e.target.value)}
                  >
                    <option value="benefits-review">
                      {t('results.kpiReports.templates.benefits', 'Benefits review')}
                    </option>
                    <option value="control-pack">
                      {t('results.kpiReports.templates.controlPack', 'Control pack')}
                    </option>
                    <option value="portfolio-review">
                      {t('results.kpiReports.templates.portfolio', 'Portfolio KPI review')}
                    </option>
                    <option value="executive-monthly">
                      {t('results.kpiReports.templates.executive', 'Executive monthly review')}
                    </option>
                    <option value="custom">{t('common.custom', 'Custom')}</option>
                  </select>
                </div>
                <div className="rounded-xl border border-c-border-subtle bg-c-surface-raised p-3">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-c-text-muted dark:text-c-text-muted">
                    {t('results.kpiReports.create.scope', 'Snapshot scope')}
                  </div>
                  <div className="mt-2 text-xs text-c-text-secondary dark:text-c-text-secondary">
                    {selectedInitiativeIds.length} {t('results.tabs.initiatives', 'Initiatives')} ·{' '}
                    {selectedKpiIds.length} KPI
                  </div>
                  <div className="mt-1 text-xs text-c-text-muted dark:text-c-text-muted">
                    {t(
                      'results.kpiReports.create.snapshotHint',
                      'The report is created as a snapshot with optional refresh later.'
                    )}
                  </div>
                </div>
              </div>

              {aiNarrativeHint ? (
                <div className="rounded-xl border border-c-info/20 bg-c-info/5 p-3 text-sm text-c-text-secondary dark:text-c-text-secondary">
                  <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-c-info">
                    {t('results.kpiReports.create.aiBrief', 'AI brief')}
                  </div>
                  {aiNarrativeHint}
                </div>
              ) : null}

              <div className="rounded-xl border border-c-border-subtle bg-c-surface-raised p-3">
                <div className="text-xs font-semibold uppercase tracking-wider text-c-text-muted dark:text-c-text-muted">
                  {t('results.kpiReports.create.workflow', 'Closed-loop content')}
                </div>
                <div className="mt-2 grid grid-cols-1 gap-2 text-xs text-c-text-secondary dark:text-c-text-secondary md:grid-cols-3">
                  <div className="rounded-lg border border-c-border-subtle px-3 py-2">
                    {t(
                      'results.kpiReports.create.workflowSignal',
                      'Signal snapshot and KPI selection'
                    )}
                  </div>
                  <div className="rounded-lg border border-c-border-subtle px-3 py-2">
                    {t(
                      'results.kpiReports.create.workflowReconcile',
                      'Discrepancy and reconciliation evidence'
                    )}
                  </div>
                  <div className="rounded-lg border border-c-border-subtle px-3 py-2">
                    {t(
                      'results.kpiReports.create.workflowActions',
                      'Next actions ready for execution'
                    )}
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-c-border-subtle bg-c-surface-raised p-3">
                <div className="text-xs font-semibold uppercase tracking-wider text-c-text-muted dark:text-c-text-muted">
                  {t('results.kpiReports.create.initiatives', 'Observed initiatives')}
                </div>
                <div className="mt-2 max-h-32 overflow-auto rounded-lg border border-c-border-subtle dark:border-c-border-subtle bg-c-surface-raised/40 dark:bg-c-surface-raised/40">
                  {availableInitiatives.length === 0 ? (
                    <div className="p-3 text-sm text-c-text-muted">
                      {t('results.initiatives.empty', 'No tracked initiatives selected.')}
                    </div>
                  ) : (
                    <div className="divide-y divide-c-border-subtle dark:divide-c-border-subtle">
                      {availableInitiatives.map((initiative) => {
                        const checked = selectedInitiativeIds.includes(initiative.id);
                        return (
                          <label
                            key={initiative.id}
                            className="flex items-start gap-2 p-3 cursor-pointer hover:bg-c-surface-raised transition-colors"
                          >
                            <input
                              type="checkbox"
                              className="mt-0.5"
                              checked={checked}
                              onChange={(e) => {
                                const next = e.target.checked;
                                setSelectedInitiativeIds((prev) =>
                                  next
                                    ? Array.from(new Set([...prev, initiative.id]))
                                    : prev.filter((id) => id !== initiative.id)
                                );
                              }}
                            />
                            <div className="min-w-0">
                              <div className="text-sm font-medium text-c-text truncate">
                                {initiative.name}
                              </div>
                              {initiative.status ? (
                                <div className="text-xs text-c-text-muted truncate">
                                  {initiative.status}
                                </div>
                              ) : null}
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="kpi-report-create-period-start" className={labelCls}>
                    {t('common.periodStart', 'Period start')}
                  </label>
                  <input
                    id="kpi-report-create-period-start"
                    className={inputCls}
                    type="date"
                    value={periodStart}
                    onChange={(e) => setPeriodStart(e.target.value)}
                    required
                    aria-required="true"
                  />
                </div>
                <div>
                  <label htmlFor="kpi-report-create-period-end" className={labelCls}>
                    {t('common.periodEnd', 'Period end')}
                  </label>
                  <input
                    id="kpi-report-create-period-end"
                    className={inputCls}
                    type="date"
                    value={periodEnd}
                    onChange={(e) => setPeriodEnd(e.target.value)}
                  />
                </div>
              </div>

              <div className="pt-1">
                <div className="flex items-center justify-between mb-1">
                  <label className={labelCls}>{t('results.kpiReports.create.kpis', 'KPIs')}</label>
                  <div className="flex items-center gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => setSelectedKpiIds(availableKpis.map((k) => k.id))}
                      className="text-c-info hover:opacity-80 transition-colors"
                      disabled={kpisLoading || availableKpis.length === 0}
                    >
                      {t('common.selectAll', 'Select all')}
                    </button>
                    <span className="text-c-text-secondary dark:text-c-text-muted">|</span>
                    <button
                      type="button"
                      onClick={() => setSelectedKpiIds([])}
                      className="text-c-text-muted hover:text-c-text-secondary dark:hover:text-c-text-secondary transition-colors"
                      disabled={kpisLoading || availableKpis.length === 0}
                    >
                      {t('common.clear', 'Clear')}
                    </button>
                  </div>
                </div>

                <input
                  className={inputCls}
                  value={kpiSearch}
                  onChange={(e) => setKpiSearch(e.target.value)}
                  placeholder={t('common.search', 'Search')}
                  aria-label={t('results.kpiReports.create.searchKpis', 'Search KPIs')}
                />

                <div className="mt-2 max-h-56 overflow-auto rounded-lg border border-c-border-subtle dark:border-c-border-subtle bg-c-surface-raised/40 dark:bg-c-surface-raised/40">
                  {kpisLoading ? (
                    <div className="p-3 text-sm text-c-text-muted">
                      {t('common.loading', 'Loading...')}
                    </div>
                  ) : filteredKpis.length === 0 ? (
                    <div className="p-3 text-sm text-c-text-muted">
                      {t('results.kpiReports.create.noKpis', 'No KPIs found.')}
                    </div>
                  ) : (
                    <div className="divide-y divide-c-border-subtle dark:divide-c-border-subtle">
                      {filteredKpis.map((k) => {
                        const checked = selectedKpiIds.includes(k.id);
                        return (
                          <label
                            key={k.id}
                            className="flex items-start gap-2 p-3 cursor-pointer hover:bg-c-surface-raised transition-colors"
                          >
                            <input
                              type="checkbox"
                              className="mt-0.5"
                              checked={checked}
                              onChange={(e) => {
                                const next = e.target.checked;
                                setSelectedKpiIds((prev) =>
                                  next
                                    ? Array.from(new Set([...prev, k.id]))
                                    : prev.filter((id) => id !== k.id)
                                );
                              }}
                            />
                            <div className="min-w-0">
                              <div className="text-sm font-medium text-c-text truncate">
                                {k.name}
                              </div>
                              {k.initiativeName ? (
                                <div className="text-xs text-c-text-muted truncate">
                                  {k.initiativeName}
                                </div>
                              ) : null}
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="mt-1 text-xs text-c-text-muted">
                  {t('results.kpiReports.create.selectedCount', 'Selected')}:{' '}
                  {selectedKpiIds.length}/{availableKpis.length}
                </div>
              </div>

              <button
                type="submit"
                disabled={!periodStart || creating || selectedKpiIds.length === 0}
                className="w-full h-9 text-sm font-medium rounded-full bg-c-text text-c-bg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {creating ? t('common.creating', 'Creating...') : t('common.create', 'Create')}
              </button>
            </form>
          </div>
        </div>
      )}

      {tasksModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-c-bg/60 backdrop-blur-sm"
            onClick={closeTasksDialog}
          />
          <div
            ref={tasksDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="kpi-report-tasks-heading"
            tabIndex={-1}
            className="relative w-full max-w-2xl mx-4 bg-c-surface border border-slate-200/60 dark:border-white/[0.03] rounded-2xl shadow-2xl outline-none"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-c-border-subtle dark:border-c-border-subtle">
              <h2 id="kpi-report-tasks-heading" className="text-lg font-semibold text-c-text">
                {t('results.kpiReports.tasks.title', 'Create tasks from action plan')}
              </h2>
              <button
                type="button"
                onClick={closeTasksDialog}
                aria-label={t('common.close', 'Close')}
                className="p-1.5 rounded-lg hover:bg-c-surface-raised dark:hover:bg-c-surface-raised text-c-text-muted transition-colors"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {tasksLoading ? (
                <div className="text-sm text-c-text-muted">{t('common.loading', 'Loading...')}</div>
              ) : actionItems.length === 0 ? (
                <div className="text-sm text-c-text-muted">
                  {t('results.kpiReports.tasks.empty', 'No actions found in this report snapshot.')}
                </div>
              ) : (
                <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                  {actionItems.map((a) => (
                    <label
                      key={a.key}
                      className="flex items-start gap-3 p-3 rounded-xl border border-c-border-subtle bg-c-surface hover:bg-c-surface-raised cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={a.selected}
                        onChange={() =>
                          setActionItems((prev) =>
                            prev.map((x) => (x.key === a.key ? { ...x, selected: !x.selected } : x))
                          )
                        }
                        className="mt-1 rounded border-c-border-strong bg-c-surface-raised dark:bg-c-surface-raised text-c-focus-solid focus:ring-c-focus"
                      />
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-c-text truncate">{a.title}</div>
                        <div className="text-xs text-c-text-muted dark:text-c-text-muted mt-0.5">
                          {a.kpiName || a.kpiId}
                          {a.dueDate ? ` · ${t('common.due', 'Due')}: ${a.dueDate}` : ''}
                          {a.severity ? ` · ${a.severity}` : ''}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  disabled={tasksCreating}
                  onClick={() => setTasksModalOpen(false)}
                  className="h-9 px-4 rounded-full text-sm font-medium border border-slate-200/60 dark:border-white/[0.03] bg-transparent text-c-text-secondary hover:bg-c-surface-raised transition-colors disabled:opacity-60"
                >
                  {t('common.cancel', 'Cancel')}
                </button>
                <button
                  type="button"
                  disabled={tasksCreating || actionItems.filter((a) => a.selected).length === 0}
                  onClick={() => void createTasksFromSelected()}
                  className="h-9 px-4 rounded-full text-sm font-medium bg-c-text text-c-bg hover:opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {tasksCreating
                    ? t('common.creating', 'Creating...')
                    : t('results.kpiReports.tasks.createCta', 'Create tasks')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ResultsKpiReportsView;
