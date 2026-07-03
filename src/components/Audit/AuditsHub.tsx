/**
 * AuditsHub — lists audit programs and shows a simple per-program dashboard
 * (owner flagged direction ⭐⭐⭐, audit #19d / #19e). Mounted at /audits.
 *
 * What it does (works end-to-end):
 *  - Lists the org's audit programs from GET /api/audit/programs.
 *  - Client-side filter by name/objective + status filter.
 *  - "New audit program" + quick "ISO 27001" launcher open the wizard.
 *  - Selecting a program shows a dashboard panel: status, counts (templates,
 *    assignees), and a completion indicator derived from config.
 *  - Delete a program.
 *
 * Scale note (#19e): for the 400-assignee scale the owner targets, this list
 * would move to server-side pagination + saved views + batch-AI summaries. For
 * the MVP we use a clean client-side filtered list. The TODO markers below pin
 * exactly where those upgrades slot in.
 *
 * Completion (#19e): a true completion % requires joining to the underlying
 * interview sessions/assignments. The MVP shows the planned counts and a
 * "surveys generated" flag from config; the real rollup is a documented TODO.
 *
 * Self-contained page (rendered as a standalone route): includes its own
 * header/back affordance so it works whether or not it sits inside the app shell.
 * Bilingual (pl/en).
 */

import { AlertTriangle, ClipboardList, Loader2, RefreshCw, Send, ShieldCheck, Trash2, Users } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  FilterableTable,
  type FilterChip,
  ModuleHub,
  type TableColumn,
} from '@/components/shared/ModuleHub';
import type { ModuleTab, ViewMode } from '@/components/shared/ModuleHub/types';
import type { RowAction } from '@/components/shared/RowActionsMenu';
import { TableWithPreviewLayout } from '@/components/shared/TableWithPreviewLayout';
import { EntityStatusChip, MetaChip } from '@/components/ui/primitives/chips';

import {
  type AuditProgram,
  type AuditProgramStatus,
  deleteProgram,
  generateSurveys,
  getCompletion,
  listPrograms,
  type ProgramCompletion,
} from './auditApi';
import { AuditOrchestratorWizard } from './AuditOrchestratorWizard';
import { getPresetById } from './auditPresets';

const PAGE_SIZE = 50;

const STATUS_FILTERS: Array<AuditProgramStatus | 'all'> = [
  'all',
  'draft',
  'active',
  'completed',
  'archived',
];

// Map our domain status to a status string the canonical EntityStatusChip
// recognizes for tone purposes (it owns the color SSOT). All four tokens are
// recognized natively (active → success/emerald, preserving "ongoing"
// semantics); the visible text still comes from our bilingual statusLabel().
const STATUS_PILL_ALIAS: Record<AuditProgramStatus, string> = {
  draft: 'draft',
  active: 'active',
  completed: 'completed',
  archived: 'archived',
};

export const AuditsHub: React.FC = () => {
  const { t, i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';

  const [programs, setPrograms] = useState<AuditProgram[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // L-02: search + status are applied SERVER-SIDE (the hub no longer filters the
  // already-fetched page). ModuleNavBar debounces the search box internally and
  // calls onSearch with the settled value.
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<AuditProgramStatus | 'all'>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [generatingId, setGeneratingId] = useState<string | null>(null);

  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardPresetId, setWizardPresetId] = useState<string | null>(null);
  // FilterableTable owns the (unused-here) column filter chips. Search + status
  // remain SERVER-SIDE via ModuleHub (load()); these stay empty by design.
  const [tableFilters, setTableFilters] = useState<FilterChip[]>([]);

  // Load the first page (resets the list). Used on mount, after mutations, and
  // whenever the server-side search/status filter changes.
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listPrograms({
        limit: PAGE_SIZE,
        offset: 0,
        search: query,
        status: statusFilter,
      });
      setPrograms(res.programs);
      setTotal(res.total);
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      setError(
        msg.toLowerCase().includes('transport safeguard') || msg.toLowerCase().includes('circuit')
          ? t('audit.temporarilyUnavailable', 'Service temporarily unavailable. Please try again in a moment.')
          : msg || t('audit.failedToLoadPrograms')
      );
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, statusFilter]);

  // Append the next page server-side (#19e pagination), preserving active filters.
  const loadMore = useCallback(async () => {
    setLoadingMore(true);
    setError(null);
    try {
      const res = await listPrograms({
        limit: PAGE_SIZE,
        offset: programs.length,
        search: query,
        status: statusFilter,
      });
      setPrograms((prev) => {
        const seen = new Set(prev.map((p) => p.id));
        return [...prev, ...res.programs.filter((p) => !seen.has(p.id))];
      });
      setTotal(res.total);
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      setError(
        msg.toLowerCase().includes('transport safeguard') || msg.toLowerCase().includes('circuit')
          ? t('audit.temporarilyUnavailable', 'Service temporarily unavailable. Please try again in a moment.')
          : msg || t('audit.failedToLoadPrograms')
      );
    } finally {
      setLoadingMore(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [programs.length, query, statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const statusLabel = (s: AuditProgramStatus | 'all'): string => {
    const map: Record<AuditProgramStatus | 'all', string> = {
      all: t('audit.all'),
      draft: t('audit.draft'),
      active: t('audit.active'),
      completed: t('audit.completed'),
      archived: t('audit.archived'),
    };
    return map[s];
  };

  // §27 — FilterableTable is the canonical list surface. The table consumes
  // PreviewableItem rows ({ id, title, ... }) so it also feeds the right-side
  // TableWithPreviewLayout. We keep the AuditProgram on the row so row actions
  // (generate / delete) and the preview dashboard can read the full record.
  type AuditRow = AuditProgram & {
    title: string;
    templateCount: number;
    assigneeCount: number;
    generatedCount: number;
    surveysGenerated: boolean;
  };

  const rows = useMemo<AuditRow[]>(
    () =>
      programs.map((p) => ({
        ...p,
        title: p.name,
        templateCount: p.config.templateIds?.length ?? 0,
        assigneeCount: p.config.assigneeIds?.length ?? 0,
        generatedCount: p.config.generation?.created ?? 0,
        surveysGenerated: p.config.surveysGenerated === true,
      })),
    [programs]
  );

  const handleDelete = async (id: string) => {
    if (!window.confirm(t('audit.deleteThisAuditProgram'))) return;
    try {
      await deleteProgram(id);
      if (selectedId === id) setSelectedId(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('audit.failedToDelete'));
    }
  };

  const handleGenerate = async (program: AuditProgram) => {
    const templateCount = program.config.templateIds?.length ?? 0;
    const assigneeCount = program.config.assigneeIds?.length ?? 0;
    const pairs = templateCount * assigneeCount;
    if (pairs === 0) {
      setError(t('audit.pickAtLeastOneTemplateAndAssignee'));
      return;
    }
    if (
      !window.confirm(
        t('audit.generateSurveyAssignmentsConfirm', {
          pairs,
          templateCount,
          assigneeCount,
        })
      )
    ) {
      return;
    }
    setGeneratingId(program.id);
    setError(null);
    try {
      const res = await generateSurveys(program.id);
      if (res.alreadyGenerated) {
        setError(t('audit.surveysWereAlreadyGenerated'));
      } else if (res.failed > 0) {
        setError(
          t('audit.generatedOfRequestedFailed', {
            created: res.created,
            requested: res.requested,
            failed: res.failed,
          })
        );
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('audit.failedToGenerateSurveys'));
    } finally {
      setGeneratingId(null);
    }
  };

  const openWizard = (presetId: string | null) => {
    setWizardPresetId(presetId);
    setWizardOpen(true);
  };

  // §27 columns: name (+status chip), objective, templates / assignees counts,
  // surveys-generated indicator. Counts are right-aligned per canon §3.3.
  const columns = useMemo<TableColumn[]>(
    () => [
      {
        id: 'name',
        label: t('audit.program'),
        render: (row: AuditRow) => (
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold text-c-text">{row.name}</span>
            <EntityStatusChip
              status={STATUS_PILL_ALIAS[row.status]}
              label={statusLabel(row.status)}
              hideDot
            />
          </div>
        ),
      },
      {
        id: 'objective',
        label: t('audit.objective'),
        render: (row: AuditRow) => (
          <span className="line-clamp-1 text-sm text-c-text-muted">{row.objective || '—'}</span>
        ),
      },
      {
        id: 'templates',
        label: t('audit.templates'),
        align: 'right',
        render: (row: AuditRow) => (
          <MetaChip icon={ClipboardList} label={String(row.templateCount)} />
        ),
      },
      {
        id: 'assignees',
        label: t('audit.assignees'),
        align: 'right',
        render: (row: AuditRow) => <MetaChip icon={Users} label={String(row.assigneeCount)} />,
      },
      {
        id: 'surveys',
        label: t('audit.surveys'),
        align: 'right',
        render: (row: AuditRow) =>
          row.surveysGenerated ? (
            <span className="inline-flex items-center gap-1 text-sm text-c-success">
              <Send className="h-3.5 w-3.5" />
              {row.generatedCount}
            </span>
          ) : (
            <span className="text-sm text-c-text-muted/60">—</span>
          ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isPolish]
  );

  // Row actions menu (canon §9): generate surveys + delete. Generate is disabled
  // once surveys exist (idempotency) or while a generation run is in flight.
  const buildRowActions = useCallback(
    (row: AuditRow): RowAction[] => {
      const isGenerating = generatingId === row.id;
      return [
        {
          id: 'generate',
          label: row.surveysGenerated ? t('audit.surveysGenerated') : t('audit.generateSurveys'),
          icon: Send,
          disabled: row.surveysGenerated || isGenerating,
          onClick: () => void handleGenerate(row),
        },
        {
          id: 'delete',
          label: t('audit.delete'),
          icon: Trash2,
          variant: 'danger',
          onClick: () => void handleDelete(row.id),
        },
      ];
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [generatingId, isPolish]
  );

  // L-05: adopt the canonical ModuleHub shell (standard header / search / tabs /
  // view-mode / primary CTA / filter controls), the same shell Results &
  // Initiatives use. The list + dashboard internals below are unchanged — this is
  // the structural shell only, NOT the §27 FilterableTable refactor (Faza 4).
  const tabs = useMemo(
    () => [
      {
        id: 'list' as ModuleTab,
        label: t('audit.auditPrograms'),
        icon: <ShieldCheck className="h-4 w-4" />,
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isPolish]
  );

  // Status filters drive the SERVER-SIDE status param (L-02): ModuleNavBar renders
  // them as the canonical left-side phase buttons.
  const statusFilters = useMemo(
    () =>
      STATUS_FILTERS.map((s) => ({
        id: s,
        label: statusLabel(s),
        color: 'bg-c-text-muted',
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isPolish]
  );

  return (
    <div className="h-full" data-testid="audits-hub">
      <ModuleHub
        persistViewModeKey="audits_hub"
        tabs={tabs}
        activeTab={'list' as ModuleTab}
        onTabChange={() => {}}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onSearch={setQuery}
        searchValue={query}
        openDocuments={[]}
        activeDocumentId={null}
        onSelectDocument={() => {}}
        onCloseDocument={() => {}}
        onShowList={() => setSelectedId(null)}
        activeFilters={[]}
        onRemoveFilter={() => {}}
        onClearFilters={() => {}}
        onNewItem={() => openWizard(null)}
        newItemLabel={t('audit.newAuditProgram')}
        statusFilters={statusFilters}
        activeStatusFilter={statusFilter === 'all' ? null : statusFilter}
        onStatusFilterChange={(s) => setStatusFilter((s as AuditProgramStatus | null) ?? 'all')}
        availableViewModes={['table']}
        rightControls={
          <button
            type="button"
            onClick={() => openWizard('iso27001')}
            className="inline-flex items-center gap-1.5 rounded-xl border border-c-border px-3 py-2 text-sm text-c-text-secondary hover:bg-c-surface-raised"
          >
            <ShieldCheck className="h-4 w-4" />
            {t('audit.iso27001')}
          </button>
        }
      >
        <div className="mx-auto max-w-6xl px-6 py-6">
          {error && (
            <div className="mb-4 flex items-start gap-3 rounded-xl border border-danger-200 bg-danger-50 p-4 dark:border-danger-500/20 dark:bg-danger-500/10">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger-600 dark:text-danger-400" />
              <div className="flex-1">
                <p className="text-sm text-danger-800 dark:text-danger-300">{error}</p>
              </div>
              <button
                onClick={load}
                className="flex items-center gap-1.5 rounded-lg border border-danger-200 bg-c-surface px-3 py-1.5 text-xs font-medium text-danger-700 transition-colors hover:bg-danger-50 dark:border-danger-500/30 dark:bg-transparent dark:text-danger-300 dark:hover:bg-danger-500/10"
              >
                <RefreshCw className="h-3 w-3" />
                {t('common.retry', 'Retry')}
              </button>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center gap-2 rounded-xl border border-c-border bg-c-surface py-12 text-sm text-c-text-muted">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t('audit.loading')}
            </div>
          ) : (
            <>
              {/* §27 — canonical FilterableTable + preview. Single click selects a
                  row and opens the per-program dashboard in the preview pane. Row
                  actions (⋮) carry Generate surveys / Delete. */}
              <div className="rounded-xl border border-c-border bg-c-surface">
                <TableWithPreviewLayout<AuditRow>
                  selectedId={selectedId}
                  selectedItem={rows.find((r) => r.id === selectedId) ?? null}
                  onSelect={setSelectedId}
                  itemIds={rows.map((r) => r.id)}
                  getItemById={(id) => rows.find((r) => r.id === id) ?? null}
                  renderPreview={(item) => <ProgramDashboard program={item} isPolish={isPolish} />}
                >
                  <FilterableTable
                    columns={columns}
                    data={rows}
                    selectedRowId={selectedId}
                    persistKey="audits-programs"
                    onRowClick={(row) => setSelectedId(String(row.id))}
                    getRowActions={(row) => {
                      const r = rows.find((x) => x.id === row.id);
                      return r ? buildRowActions(r) : [];
                    }}
                    activeFilters={tableFilters}
                    onFilterChange={setTableFilters}
                    emptyMessage={
                      query.trim() || statusFilter !== 'all'
                        ? t('audit.noProgramsMatchFilters')
                        : t('audit.noAuditProgramsYet')
                    }
                    canvasClassName="pl-4 pr-1.5 pt-3 pb-4"
                    density="compact"
                  />
                </TableWithPreviewLayout>
              </div>

              {/* Load more (#19e server-side pagination). Only when more rows exist
                AND the user isn't narrowing the current page via search/status. */}
              {programs.length < total && (
                <div className="mt-3 flex flex-col items-center gap-1">
                  <button
                    type="button"
                    onClick={() => void loadMore()}
                    disabled={loadingMore}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-c-border px-4 py-2 text-sm text-c-text-secondary hover:bg-c-surface-raised disabled:opacity-60"
                  >
                    {loadingMore && <Loader2 className="h-4 w-4 animate-spin" />}
                    {t('audit.loadMore')}
                  </button>
                  <span className="text-[11px] text-c-text-muted">
                    {t('audit.showingOfTotal', {
                      shown: programs.length,
                      total,
                    })}
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      </ModuleHub>

      <AuditOrchestratorWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        initialPresetId={wizardPresetId}
        onCreated={(program) => {
          setWizardOpen(false);
          setSelectedId(program.id);
          void load();
        }}
      />
    </div>
  );
};

// ---------------------------------------------------------------------------
// Per-program dashboard (#19d/#19e)
// ---------------------------------------------------------------------------

const ProgramDashboard: React.FC<{
  program: AuditProgram;
  isPolish: boolean;
}> = ({ program, isPolish }) => {
  const { t } = useTranslation();
  const templateCount = program.config.templateIds?.length ?? 0;
  const assigneeCount = program.config.assigneeIds?.length ?? 0;
  const surveysGenerated = program.config.surveysGenerated === true;
  const preset = getPresetById(program.preset);
  const plan = Array.isArray(program.config.plan) ? program.config.plan : [];

  // Real completion rollup (#19e): fetch when the program is generated.
  const [completion, setCompletion] = useState<ProgramCompletion | null>(null);
  const [completionLoading, setCompletionLoading] = useState(false);

  useEffect(() => {
    if (!surveysGenerated) {
      setCompletion(null);
      return;
    }
    let cancelled = false;
    setCompletionLoading(true);
    getCompletion(program.id)
      .then((c) => {
        if (!cancelled) setCompletion(c);
      })
      .catch(() => {
        if (!cancelled) setCompletion(null);
      })
      .finally(() => {
        if (!cancelled) setCompletionLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [program.id, surveysGenerated]);

  return (
    <div className="space-y-4 rounded-xl border border-c-border bg-c-surface p-5">
      <div>
        <h3 className="font-semibold text-c-text">{program.name}</h3>
        {preset && (
          <p className="text-xs text-c-text-muted">
            {isPolish ? preset.label.pl : preset.label.en}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Stat label={t('audit.templates')} value={templateCount} />
        <Stat label={t('audit.assignees')} value={assigneeCount} />
      </div>

      {/* Completion (#19e): real rollup over the program's generated interview
          assignments (submitted/approved/completed vs total). */}
      <div className="rounded-xl bg-c-surface-raised p-3">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-xs font-medium text-c-text-secondary">
            {t('audit.completion')}
          </span>
          {surveysGenerated && completion && (
            <span className="text-xs font-semibold text-c-text">
              {completion.percent}%
            </span>
          )}
        </div>
        {!surveysGenerated ? (
          <p className="text-xs text-c-text-muted">{t('audit.notGeneratedUseGenerateSurveys')}</p>
        ) : completionLoading ? (
          <div className="flex items-center gap-2 text-xs text-c-text-muted">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            {t('audit.loading')}
          </div>
        ) : completion ? (
          <div className="space-y-1.5">
            <div className="h-2 w-full overflow-hidden rounded-full bg-c-border-subtle">
              <div
                className="h-full rounded-full bg-c-success transition-all"
                style={{ width: `${completion.percent}%` }}
              />
            </div>
            <p className="text-xs text-c-text-muted">
              {t('audit.surveysCompletedOfTotal', {
                done: completion.done,
                total: completion.total,
              })}
            </p>
          </div>
        ) : (
          <p className="text-xs text-c-text-muted">{t('audit.completionUnavailable')}</p>
        )}
      </div>

      {plan.length > 0 && (
        <div>
          <div className="mb-1 text-xs font-medium text-c-text-secondary">
            {t('audit.suggestedPlan')}
          </div>
          <ul className="space-y-1">
            {plan.map((row, i) => (
              <li key={(row?.areaKey as string) ?? i} className="flex justify-between text-xs">
                <span className="text-c-text-secondary">
                  {String(row?.area ?? '') || '—'}
                </span>
                <span className="text-c-text-muted">{String(row?.suggestedRole ?? '') || '—'}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

const Stat: React.FC<{ label: string; value: number }> = ({ label, value }) => (
  <div className="rounded-xl bg-c-surface-raised p-3">
    <div className="text-2xl font-semibold text-c-text">{value}</div>
    <div className="text-xs text-c-text-muted">{label}</div>
  </div>
);

export default AuditsHub;
