/**
 * AgentHubShell — powłoka zakładki "Run agent" z dwiema pod-zakładkami (AGT-010).
 *
 * Piotr 2026-07-24 (zrzut demo): wejście w Run agent pokazywało od razu
 * launcher 31 gotowych agentów (AgentPlanWorkspace → AgentManifestLauncher).
 * Brakowało warstwy pośredniej — user ma WIELE uruchomionych/zapisanych
 * procesów, potrzebna tabela pozycji jak w Decisions, nie od razu kreator.
 *
 * Ta powłoka wchodzi PRZED AgentPlanWorkspace:
 *   "Moje procesy" — StandardTable nad `listAgentPlans` (GET /api/ai/agent-plan).
 *     Klik w wiersz otwiera PREVIEW (StandardPreview); "Otwórz" w preview albo
 *     w kebabie otwiera AgentPlanWorkspace jako KARTĘ w Menu 3 (dynamiczny tab
 *     z ×) — patrz niżej, poprawka odbioru triady 2026-07-24.
 *   "Szablony" (AGT-011) — StandardTable łącząca dwa źródła:
 *     - bibliotekę PROCESÓW (`listAgentProcesses`, ProcessLibrary — classic-5
 *       domyślny + wariant drd),
 *     - katalog GOTOWYCH ANALIZ (`listAgentManifests({status:'built'})` — 19
 *       wykonalnych z 31 manifestów Discovery Tools).
 *     Kolumna "Typ" (chip) rozróżnia Proces/Gotowa analiza; klik w wiersz
 *     otwiera preview, "Użyj szablonu" tworzy nowy plan i otwiera go jako
 *     kartę — patrz `handleSelectTemplate`.
 *
 * "Nowy proces" (Moje procesy) i "Użyj szablonu" (Szablony) dzielą JEDEN
 * handler tworzenia (`handleCreatePlan`) — patrz komentarz przy nim.
 * Ścieżka procesu (`processId`) zawsze `draft: true`: backend kładzie
 * schemat i zostawia plan w statusie 'planning' (NIE dispatchuje wykonania —
 * patrz agent-plan.routes.ts `effectiveDraft`), user przestawia klocki na
 * canvasie i dopiero jawne "Uruchom" startuje wykonanie. Ścieżka manifestu
 * (`manifestId`) zostaje wstecznie zgodna z katalogiem sprzed AGT-010 —
 * dispatch od razu (canvas otwiera się na już wystartowanym planie).
 *
 * ★ POPRAWKA ODBIORU TRIADY (2026-07-24, zrzuty demo Piotra):
 * 1. Pigułki "Moje procesy"/"Szablony" przeniesione z lewej strony Menu 2
 *    (`tabs`) na PRAWĄ, obok CTA (`filterControls` + `Segmented` — jedyny
 *    gotowy segmented-switcher w repo, `TemplateBuilder/templateBuilderFields`,
 *    dotąd używany tylko w formularzach, tu pierwszy raz w Menu 2 — zgodnie
 *    z życzeniem właściciela "jako przełącznik widoku").
 * 2. Klik w wiersz = PREVIEW (StandardPreview: status, postęp, kroki z
 *    czytelnymi nazwami, bramki akceptu) — nie od razu pełny ekran.
 * 3. Kebab uzupełniony do kontraktu `rowMenu` (StandardTable dokłada SAMO
 *    "Otwórz podgląd/Edytuj/Archiwizuj" + destrukcyjne na końcu) — "Anuluj"
 *    JEST "Zatrzymaj" (jeden dom akcji, nie dublujemy — gestosc §"jedna akcja
 *    = jeden dom"). "Duplikuj"/"Uruchom ponownie" pominięte: brak backendu
 *    (AgentPlan nie niesie processId/manifestId źródłowego, `runAgentPlan`
 *    działa tylko na planie w statusie 'planning') — zgłoszone w raporcie.
 * 4. "Otwórz" (preview/kebab) NIE podmienia całego ekranu — dokłada kartę do
 *    Menu 3 (`openItems`/`activeItemId`/`onSelectItem`/`onCloseItem`,
 *    mechanizm już wpięty w `StandardModuleBar`→`ModuleNavBar`→`DynamicTabs`,
 *    dotąd nieużywany przez żaden hub — pierwszy realny konsument).
 *    Treść karty: `AgentPlanWorkspace` (ArtifactRightPanel — z NATURY wąski
 *    prawy dok, doktryna "panel-Teresy-zawsze-po-prawej") dostaje TOWARZYSZA
 *    z lewej — `PlanSummaryCard` (też reużywana w preview) — bo bez niego
 *    ekran renderował wąski panel przy lewej krawędzi i pustkę z prawej
 *    (zgłoszony defekt). To NIE jest pełna migracja do `StandardArtifactShell`
 *    (SPEC-A/Karta-N) — ten kontrakt wymaga sections+aiContract+rightPanel o
 *    stałych kluczach, czyli osobnego, większego zadania; zgłoszone w raporcie
 *    z oszacowaniem zamiast robić połowicznie.
 *
 * Kanon: consultify-triada (StandardModuleBar Menu2/3 + StandardTable +
 * StandardPreview — zero własnej tabeli/menu/preview) + consultify-gestosc
 * (hub 2 zakładki ≤ 6; "Nowy proces" ma jeden dom — Menu2 primary CTA; NIE ma
 * globalnego "+ New" w topbarze aplikacji — sprawdzone w `MainLayout.tsx`,
 * każdy hub ma WŁASNY primaryCta w Menu2, identycznie jak AssessmentHub/
 * DiscoveryToolsHub — więc "Nowy proces" zostaje, nie jest duplikatem).
 */
import { FileStack, ListChecks, PlayCircle, XCircle } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { OpenDocument } from '@/components/shared/ModuleHub/types';
import { EmptyState, LoadingState } from '@/components/shared/states';
import { TableWithPreviewLayout } from '@/components/shared/TableWithPreviewLayout';
import { StandardModuleBar } from '@/components/standard/StandardModuleBar';
import { StandardPreview } from '@/components/standard/StandardPreview';
import {
  type StandardRowMenu,
  StandardTable,
  type TableColumn,
  type TableRow,
} from '@/components/standard/StandardTable';
import { Segmented } from '@/components/TemplateBuilder/templateBuilderFields';
import { EntityStatusChip, MetaChip, StatusChip } from '@/components/ui/primitives/chips';
import { listAgentManifests } from '@/services/api/agentManifests.api';
import {
  type AgentPlan,
  type AgentPlanStatus,
  cancelAgentPlan,
  createAgentPlan,
  getAgentPlan,
  listAgentPlans,
  listAgentProcesses,
} from '@/services/api/agentPlan.api';

import { readablePhaseName } from './AgentPlanPanel';
import { AgentPlanWorkspace } from './AgentPlanWorkspace';

type AgentHubTab = 'processes' | 'templates';

type TemplateKind = 'process' | 'manifest';

interface TemplateRow {
  id: string;
  kind: TemplateKind;
  name: string;
  description: string;
  stepCount: number;
  isDefault: boolean;
}

const formatPlanDate = (iso: string, isPolish: boolean): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(isPolish ? 'pl-PL' : 'en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const PLAN_STATUS_TONE: Record<
  AgentPlanStatus,
  'info' | 'warning' | 'success' | 'danger' | 'neutral'
> = {
  planning: 'info',
  awaiting_approval: 'warning',
  executing: 'info',
  paused: 'warning',
  completed: 'success',
  completed_with_errors: 'warning',
  failed: 'danger',
  cancelled: 'neutral',
};

// Menu 3 dynamiczny tab wymaga `ItemStatus` (unia zamknięta, inna niż
// `AgentPlanStatus`) wyłącznie do koloru kropki — najbliższe dopasowanie,
// nie krytyczne semantycznie (patrz DynamicTabs.tsx `STATUS_COLORS`).
const PLAN_STATUS_TO_ITEM_STATUS: Record<AgentPlanStatus, OpenDocument['status']> = {
  planning: 'PLANNING',
  awaiting_approval: 'PENDING_REVIEW',
  executing: 'EXECUTING',
  paused: 'BLOCKED',
  completed: 'DONE',
  completed_with_errors: 'DONE',
  failed: 'BLOCKED',
  cancelled: 'CANCELLED',
};

const CANCELLABLE_STATUSES: AgentPlanStatus[] = [
  'planning',
  'executing',
  'awaiting_approval',
  'paused',
];

function planStatusLabel(status: AgentPlanStatus, isPolish: boolean): string {
  const pl: Record<AgentPlanStatus, string> = {
    planning: 'Planowanie',
    awaiting_approval: 'Czeka na akceptację',
    executing: 'W toku',
    paused: 'Wstrzymany',
    completed: 'Zakończony',
    completed_with_errors: 'Zakończony z błędami',
    failed: 'Nieudany',
    cancelled: 'Anulowany',
  };
  const en: Record<AgentPlanStatus, string> = {
    planning: 'Planning',
    awaiting_approval: 'Awaiting approval',
    executing: 'Executing',
    paused: 'Paused',
    completed: 'Completed',
    completed_with_errors: 'Completed with errors',
    failed: 'Failed',
    cancelled: 'Cancelled',
  };
  return (isPolish ? pl : en)[status];
}

/**
 * Podgląd planu — reużywany w preview (StandardPreview.details/meta) I w
 * karcie towarzyszącej obok AgentPlanWorkspace (punkt 9). Jeden komponent,
 * dwa miejsca użycia (gestosc: reuse, nie duplikacja).
 */
const PlanSummaryCard: React.FC<{ plan: AgentPlan; isPolish: boolean; compact?: boolean }> = ({
  plan,
  isPolish,
  compact,
}) => (
  <div
    className={
      compact ? 'space-y-3' : 'space-y-4 rounded-xl border border-c-border-subtle bg-c-surface p-4'
    }
  >
    {!compact ? (
      <div>
        <div className="text-sm font-semibold text-c-text">{plan.title}</div>
        <div className="mt-1 text-xs text-c-text-secondary">
          {formatPlanDate(plan.createdAt, isPolish)}
        </div>
      </div>
    ) : null}
    <div className="flex flex-wrap items-center gap-2">
      <EntityStatusChip status={plan.status} />
      <MetaChip
        icon={ListChecks}
        label={`${plan.completedSteps}/${plan.totalSteps} ${isPolish ? 'kroków' : 'steps'}`}
      />
    </div>
    <div>
      <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-c-text-muted">
        {isPolish ? 'Kroki i bramki' : 'Steps and gates'}
      </div>
      <ol className="space-y-1 text-xs text-c-text-secondary">
        {plan.steps.map((step, idx) => (
          <li key={step.id} className="flex items-start gap-1.5">
            <span className="tabular-nums text-c-text-muted">{idx + 1}.</span>
            <span className="flex-1">
              {readablePhaseName(step.toolInput) ?? step.toolName}
              {step.requiresApproval ? (
                <span className="ml-1.5 text-[10px] text-[var(--c-warning)]">
                  · {isPolish ? 'wymaga akceptacji' : 'requires approval'}
                </span>
              ) : null}
            </span>
            <span className="shrink-0 text-c-text-muted">{step.status}</span>
          </li>
        ))}
      </ol>
    </div>
    {plan.resultSummary ? (
      <div>
        <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-c-text-muted">
          {isPolish ? 'Podsumowanie' : 'Summary'}
        </div>
        <p className="text-xs text-c-text-secondary">{plan.resultSummary}</p>
      </div>
    ) : null}
  </div>
);

export const AgentHubShell: React.FC = () => {
  const { t, i18n } = useTranslation();
  const isPolish = !!i18n.language?.startsWith('pl');

  const [tab, setTab] = useState<AgentHubTab>('processes');
  const [plans, setPlans] = useState<AgentPlan[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [previewPlanId, setPreviewPlanId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<TemplateRow[] | null>(null);
  const [templatesError, setTemplatesError] = useState<string | null>(null);
  const [previewTemplateId, setPreviewTemplateId] = useState<string | null>(null);

  // Menu 3 — karty otwarte (punkt 9: "Otwórz" dokłada tab, nie podmienia ekranu).
  const [openItems, setOpenItems] = useState<OpenDocument[]>([]);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [activePlanDetail, setActivePlanDetail] = useState<AgentPlan | null>(null);
  const [activePlanError, setActivePlanError] = useState<string | null>(null);

  const fetchPlans = useCallback(() => {
    setLoadError(null);
    listAgentPlans({ mine: true })
      .then(({ plans: fetched }) => setPlans(fetched))
      .catch((error) => {
        setLoadError(error instanceof Error ? error.message : 'Failed to load agent plans');
      });
  }, []);

  useEffect(() => {
    if (tab === 'processes' && !activeItemId) {
      fetchPlans();
    }
  }, [tab, activeItemId, fetchPlans]);

  const fetchTemplates = useCallback(() => {
    setTemplatesError(null);
    Promise.all([listAgentProcesses(), listAgentManifests({ status: 'built' })])
      .then(([processesRes, manifestsRes]) => {
        const processRows: TemplateRow[] = processesRes.processes.map((p) => ({
          id: p.id,
          kind: 'process',
          name: p.label,
          description: p.description,
          stepCount: p.phaseCount,
          isDefault: p.isDefault,
        }));
        const manifestRows: TemplateRow[] = manifestsRes.manifests.map((m) => ({
          id: m.id,
          kind: 'manifest',
          name: isPolish ? m.displayName.pl : m.displayName.en,
          description: isPolish
            ? 'Gotowa analiza z katalogu Discovery Tools'
            : 'Ready-made Discovery Tools analysis',
          stepCount: m.stepCount ?? 0,
          isDefault: false,
        }));
        setTemplates([...processRows, ...manifestRows]);
      })
      .catch((error) => {
        setTemplatesError(error instanceof Error ? error.message : 'Failed to load templates');
      });
  }, [isPolish]);

  useEffect(() => {
    if (tab === 'templates' && !activeItemId && templates === null) {
      fetchTemplates();
    }
  }, [tab, activeItemId, templates, fetchTemplates]);

  // ── Karta w Menu 3 (punkt 9) ──────────────────────────────────────────────
  const buildOpenDoc = useCallback(
    (plan: Pick<AgentPlan, 'id' | 'title' | 'status'>): OpenDocument => ({
      id: plan.id,
      type: 'tool',
      subType: 'agent-plan',
      name: plan.title,
      status: PLAN_STATUS_TO_ITEM_STATUS[plan.status],
    }),
    []
  );

  const openPlanTab = useCallback(
    (plan: Pick<AgentPlan, 'id' | 'title' | 'status'>) => {
      setOpenItems((prev) => {
        const doc = buildOpenDoc(plan);
        const exists = prev.some((d) => d.id === plan.id);
        return exists ? prev.map((d) => (d.id === plan.id ? doc : d)) : [...prev, doc];
      });
      setActiveItemId(plan.id);
      setPreviewPlanId(null);
      setPreviewTemplateId(null);
    },
    [buildOpenDoc]
  );

  const handleOpenPlan = useCallback(
    (planId: string) => {
      const existing = plans?.find((p) => p.id === planId);
      if (existing) {
        openPlanTab(existing);
        return;
      }
      openPlanTab({
        id: planId,
        title: t('agentPlan.hub.openingPlan', isPolish ? 'Proces' : 'Process'),
        status: 'planning',
      });
    },
    [plans, openPlanTab, t, isPolish]
  );

  const handleSelectItem = useCallback((id: string) => setActiveItemId(id), []);

  const handleCloseItem = useCallback(
    (id: string) => {
      setOpenItems((prev) => prev.filter((d) => d.id !== id));
      setActiveItemId((current) => (current === id ? null : current));
      fetchPlans();
    },
    [fetchPlans]
  );

  const handleShowList = useCallback(() => {
    setActiveItemId(null);
    fetchPlans();
  }, [fetchPlans]);

  // Dociąga pełny plan (kroki, resultSummary) dla karty-towarzysza obok
  // AgentPlanWorkspace — nie polega WYŁĄCZNIE na liście `plans` (świeżo
  // utworzony plan z "Nowy proces"/"Użyj szablonu" ma to od razu z odpowiedzi
  // create; reopens z tabeli/tabów dociągają tu).
  useEffect(() => {
    if (!activeItemId) {
      setActivePlanDetail(null);
      setActivePlanError(null);
      return;
    }
    let cancelled = false;
    setActivePlanError(null);
    getAgentPlan(activeItemId)
      .then(({ plan }) => {
        if (!cancelled) setActivePlanDetail(plan);
      })
      .catch((error) => {
        if (!cancelled) {
          setActivePlanError(error instanceof Error ? error.message : 'Failed to load plan');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [activeItemId]);

  /**
   * Jeden handler tworzenia planu — dzielony przez "Nowy proces" (Moje
   * procesy) i "Użyj szablonu" (Szablony, AGT-011). `processId` => draft:true
   * (canvas edytowalny); `manifestId` => brak draft (dispatch od razu).
   */
  const handleCreatePlan = useCallback(
    async (input: { title: string; processId?: string; manifestId?: string; draft?: boolean }) => {
      setCreating(true);
      setCreateError(null);
      try {
        const { plan } = await createAgentPlan({
          title: input.title,
          processId: input.processId,
          manifestId: input.manifestId,
          draft: input.draft,
        });
        openPlanTab(plan);
        setActivePlanDetail(plan);
      } catch (error) {
        setCreateError(error instanceof Error ? error.message : 'Failed to create process');
      } finally {
        setCreating(false);
      }
    },
    [openPlanTab]
  );

  const handleNewProcess = useCallback(
    () =>
      handleCreatePlan({
        title: t('agentPlan.hub.newProcessTitle', 'New consulting process'),
        processId: 'classic-5',
        draft: true,
      }),
    [handleCreatePlan, t]
  );

  const handleSelectTemplate = useCallback(
    (row: TemplateRow) => {
      if (row.kind === 'process') {
        void handleCreatePlan({ title: row.name, processId: row.id, draft: true });
      } else {
        void handleCreatePlan({ title: row.name, manifestId: row.id });
      }
    },
    [handleCreatePlan]
  );

  const handleCancelPlan = useCallback(
    async (planId: string) => {
      try {
        await cancelAgentPlan(planId);
        fetchPlans();
        setPreviewPlanId(null);
      } catch {
        /* best-effort — row stays until next refresh */
      }
    },
    [fetchPlans]
  );

  const columns: TableColumn[] = [
    {
      id: 'title',
      label: t('agentPlan.hub.columns.name', isPolish ? 'Nazwa' : 'Name'),
      width: '360px',
      render: (row: TableRow) => {
        const plan = row as unknown as AgentPlan;
        return <span className="text-sm font-semibold text-c-text">{plan.title}</span>;
      },
    },
    {
      id: 'status',
      label: t('agentPlan.hub.columns.status', isPolish ? 'Status' : 'Status'),
      width: '160px',
      render: (row: TableRow) => {
        const plan = row as unknown as AgentPlan;
        return <EntityStatusChip status={plan.status} />;
      },
    },
    {
      id: 'progress',
      label: t('agentPlan.hub.columns.progress', isPolish ? 'Postęp' : 'Progress'),
      width: '140px',
      render: (row: TableRow) => {
        const plan = row as unknown as AgentPlan;
        return (
          <MetaChip
            icon={ListChecks}
            label={`${plan.completedSteps}/${plan.totalSteps}`}
            title={t(
              'agentPlan.hub.columns.progressTitle',
              isPolish ? 'Ukończone kroki' : 'Steps completed'
            )}
          />
        );
      },
    },
    {
      id: 'date',
      label: t('agentPlan.hub.columns.created', isPolish ? 'Data' : 'Date'),
      width: '140px',
      render: (row: TableRow) => {
        const plan = row as unknown as AgentPlan;
        return (
          <span className="text-xs text-c-text-secondary">
            {formatPlanDate(plan.createdAt, isPolish)}
          </span>
        );
      },
    },
  ];

  const tableRows = (plans ?? []) as unknown as TableRow[];
  const previewPlan = useMemo(
    () => plans?.find((p) => p.id === previewPlanId) ?? null,
    [plans, previewPlanId]
  );

  const renderProcesses = () => {
    if (loadError) {
      return (
        <EmptyState
          variant="error"
          title={t(
            'agentPlan.hub.loadErrorTitle',
            isPolish ? 'Nie udało się wczytać procesów' : 'Failed to load processes'
          )}
          description={loadError}
          onRetry={fetchPlans}
          className="h-full"
        />
      );
    }
    if (plans === null) {
      return (
        <div className="p-4">
          <LoadingState template="list" rows={4} />
        </div>
      );
    }
    if (plans.length === 0) {
      return (
        <EmptyState
          variant="new"
          icon={PlayCircle}
          title={t('agentPlan.hub.emptyTitle', isPolish ? 'Brak procesów' : 'No processes yet')}
          description={t(
            'agentPlan.hub.emptyDescription',
            isPolish
              ? 'Uruchom klasyczny schemat konsultingowy albo wybierz gotowego agenta w Szablonach.'
              : 'Start the classic consulting process or pick a ready-made agent from Templates.'
          )}
          primaryAction={{
            label: t('agentPlan.hub.newProcess', isPolish ? 'Nowy proces' : 'New process'),
            onClick: () => void handleNewProcess(),
          }}
          className="h-full"
        />
      );
    }
    return (
      <div className="h-full min-h-0">
        {createError ? <p className="px-4 pt-3 text-xs text-c-danger">{createError}</p> : null}
        <TableWithPreviewLayout<{ id: string; title: string }>
          selectedId={previewPlanId}
          selectedItem={previewPlan ? { id: previewPlan.id, title: previewPlan.title } : null}
          onSelect={setPreviewPlanId}
          onOpenFull={(id) => handleOpenPlan(id)}
          itemIds={tableRows.map((r) => String(r.id))}
          renderPreview={() => {
            if (!previewPlan) return null;
            const cancellable = CANCELLABLE_STATUSES.includes(previewPlan.status);
            return (
              <StandardPreview
                title={previewPlan.title}
                onClose={() => setPreviewPlanId(null)}
                onOpenFull={() => handleOpenPlan(previewPlan.id)}
                openLabel={t('agentPlan.hub.rowOpen', isPolish ? 'Otwórz' : 'Open')}
                meta={{
                  pills: [
                    {
                      label: isPolish ? 'Status' : 'Status',
                      value: planStatusLabel(previewPlan.status, isPolish),
                      tone: PLAN_STATUS_TONE[previewPlan.status],
                    },
                    {
                      label: isPolish ? 'Postęp' : 'Progress',
                      value: `${previewPlan.completedSteps}/${previewPlan.totalSteps}`,
                    },
                  ],
                }}
                actions={
                  cancellable
                    ? {
                        resolutions: [
                          {
                            id: 'cancel',
                            variant: 'destructive',
                            label: t('agentPlan.hub.rowCancel', isPolish ? 'Anuluj' : 'Cancel'),
                            icon: XCircle,
                            onClick: () => void handleCancelPlan(previewPlan.id),
                          },
                        ],
                      }
                    : undefined
                }
              >
                <PlanSummaryCard plan={previewPlan} isPolish={isPolish} compact />
              </StandardPreview>
            );
          }}
        >
          <div className="p-4 pt-3">
            <StandardTable
              columns={columns}
              data={tableRows}
              selectedRowId={previewPlanId}
              onRowClick={(row) => setPreviewPlanId(String(row.id))}
              onRowDoubleClick={(row) => handleOpenPlan(String(row.id))}
              rowMenu={(row): StandardRowMenu => {
                const plan = row as unknown as AgentPlan;
                const cancellable = CANCELLABLE_STATUSES.includes(plan.status);
                return {
                  primary: [
                    {
                      id: 'open',
                      label: t('agentPlan.hub.rowOpen', isPolish ? 'Otwórz' : 'Open'),
                      onClick: () => handleOpenPlan(plan.id),
                    },
                  ],
                  universalHandlers: {
                    preview: () => setPreviewPlanId(plan.id),
                  },
                  destructive: {
                    label: t('agentPlan.hub.rowCancel', isPolish ? 'Anuluj' : 'Cancel'),
                    icon: XCircle,
                    onClick: cancellable ? () => void handleCancelPlan(plan.id) : undefined,
                    note: cancellable
                      ? undefined
                      : t(
                          'agentPlan.hub.rowCancelNote',
                          isPolish ? 'Plan już zakończony' : 'Plan already finished'
                        ),
                  },
                };
              }}
              persistKey="agent.myprocesses.list"
            />
          </div>
        </TableWithPreviewLayout>
      </div>
    );
  };

  const templateColumns: TableColumn[] = [
    {
      id: 'name',
      label: t('agentPlan.hub.templates.columns.name', isPolish ? 'Nazwa' : 'Name'),
      width: '320px',
      render: (row: TableRow) => {
        const tpl = row as unknown as TemplateRow;
        return (
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-c-text">{tpl.name}</span>
            {tpl.isDefault ? (
              <StatusChip
                label={t('agentPlan.hub.templates.default', isPolish ? 'Domyślny' : 'Default')}
                tone="info"
                hideDot
                size="sm"
              />
            ) : null}
          </div>
        );
      },
    },
    {
      id: 'type',
      label: t('agentPlan.hub.templates.columns.type', isPolish ? 'Typ' : 'Type'),
      width: '160px',
      render: (row: TableRow) => {
        const tpl = row as unknown as TemplateRow;
        return tpl.kind === 'process' ? (
          <StatusChip
            label={t('agentPlan.hub.templates.kindProcess', isPolish ? 'Proces' : 'Process')}
            tone="info"
          />
        ) : (
          <StatusChip
            label={t(
              'agentPlan.hub.templates.kindManifest',
              isPolish ? 'Gotowa analiza' : 'Ready-made analysis'
            )}
            tone="neutral"
          />
        );
      },
    },
    {
      id: 'description',
      label: t('agentPlan.hub.templates.columns.description', isPolish ? 'Opis' : 'Description'),
      render: (row: TableRow) => {
        const tpl = row as unknown as TemplateRow;
        return <span className="text-xs text-c-text-secondary">{tpl.description}</span>;
      },
    },
    {
      id: 'steps',
      label: t('agentPlan.hub.templates.columns.steps', isPolish ? 'Liczba kroków' : 'Steps'),
      width: '150px',
      render: (row: TableRow) => {
        const tpl = row as unknown as TemplateRow;
        return (
          <MetaChip
            icon={ListChecks}
            label={String(tpl.stepCount)}
            title={t(
              'agentPlan.hub.templates.columns.stepsTitle',
              isPolish ? 'Liczba kroków szablonu' : 'Template step count'
            )}
          />
        );
      },
    },
  ];

  const templateRows = (templates ?? []) as unknown as TableRow[];
  const previewTemplate = useMemo(
    () => templates?.find((t2) => t2.id === previewTemplateId) ?? null,
    [templates, previewTemplateId]
  );

  const renderTemplates = () => {
    if (templatesError) {
      return (
        <EmptyState
          variant="error"
          title={t(
            'agentPlan.hub.templates.loadErrorTitle',
            isPolish ? 'Nie udało się wczytać szablonów' : 'Failed to load templates'
          )}
          description={templatesError}
          onRetry={fetchTemplates}
          className="h-full"
        />
      );
    }
    if (templates === null) {
      return (
        <div className="p-4">
          <LoadingState template="list" rows={4} />
        </div>
      );
    }
    if (templates.length === 0) {
      return (
        <EmptyState
          icon={FileStack}
          title={t('agentPlan.hub.templatesTitle', isPolish ? 'Szablony' : 'Templates')}
          description={t(
            'agentPlan.hub.templates.emptyDescription',
            isPolish ? 'Brak dostępnych szablonów.' : 'No templates available.'
          )}
          className="h-full"
        />
      );
    }
    return (
      <div className="h-full min-h-0">
        {createError ? <p className="px-4 pt-3 text-xs text-c-danger">{createError}</p> : null}
        <TableWithPreviewLayout<{ id: string; title: string }>
          selectedId={previewTemplateId}
          selectedItem={
            previewTemplate ? { id: previewTemplate.id, title: previewTemplate.name } : null
          }
          onSelect={setPreviewTemplateId}
          onOpenFull={(id) => {
            const tpl = templates.find((x) => x.id === id);
            if (tpl) handleSelectTemplate(tpl);
          }}
          itemIds={templateRows.map((r) => String(r.id))}
          renderPreview={() => {
            if (!previewTemplate) return null;
            return (
              <StandardPreview
                title={previewTemplate.name}
                onClose={() => setPreviewTemplateId(null)}
                onOpenFull={() => handleSelectTemplate(previewTemplate)}
                openLabel={t(
                  'agentPlan.hub.templates.rowUse',
                  isPolish ? 'Użyj szablonu' : 'Use template'
                )}
                meta={{
                  pills: [
                    {
                      label: isPolish ? 'Typ' : 'Type',
                      value:
                        previewTemplate.kind === 'process'
                          ? isPolish
                            ? 'Proces'
                            : 'Process'
                          : isPolish
                            ? 'Gotowa analiza'
                            : 'Ready-made analysis',
                      tone: previewTemplate.kind === 'process' ? 'info' : 'neutral',
                    },
                    { label: isPolish ? 'Kroki' : 'Steps', value: previewTemplate.stepCount },
                  ],
                }}
                details={{ text: previewTemplate.description }}
                actions={{
                  resolutions: [
                    {
                      id: 'use',
                      variant: 'positive',
                      label: t(
                        'agentPlan.hub.templates.rowUse',
                        isPolish ? 'Użyj szablonu' : 'Use template'
                      ),
                      onClick: () => handleSelectTemplate(previewTemplate),
                    },
                  ],
                }}
              />
            );
          }}
        >
          <div className="p-4 pt-3">
            <StandardTable
              columns={templateColumns}
              data={templateRows}
              selectedRowId={previewTemplateId}
              onRowClick={(row) => setPreviewTemplateId(String(row.id))}
              onRowDoubleClick={(row) => {
                const tpl = row as unknown as TemplateRow;
                handleSelectTemplate(tpl);
              }}
              rowMenu={(row): StandardRowMenu => {
                const tpl = row as unknown as TemplateRow;
                return {
                  primary: [
                    {
                      id: 'use',
                      label: t(
                        'agentPlan.hub.templates.rowUse',
                        isPolish ? 'Użyj szablonu' : 'Use template'
                      ),
                      onClick: () => handleSelectTemplate(tpl),
                    },
                  ],
                  universalHandlers: {
                    preview: () => setPreviewTemplateId(tpl.id),
                  },
                };
              }}
              persistKey="agent.templates.list"
            />
          </div>
        </TableWithPreviewLayout>
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-c-bg">
      <StandardModuleBar
        filterControls={
          <Segmented<AgentHubTab>
            value={tab}
            options={[
              {
                value: 'processes',
                label: t(
                  'agentPlan.hub.tabs.processes',
                  isPolish ? 'Moje procesy' : 'My processes'
                ),
              },
              {
                value: 'templates',
                label: t('agentPlan.hub.tabs.templates', isPolish ? 'Szablony' : 'Templates'),
              },
            ]}
            onChange={(id) => setTab(id)}
            testId="agent-hub-mode-switch"
          />
        }
        primaryCta={
          tab === 'processes'
            ? {
                label: creating
                  ? t('agentPlan.hub.newProcessLoading', isPolish ? 'Tworzenie…' : 'Creating…')
                  : t('agentPlan.hub.newProcess', isPolish ? 'Nowy proces' : 'New process'),
                icon: PlayCircle,
                onClick: () => void handleNewProcess(),
              }
            : undefined
        }
        openItems={openItems}
        activeItemId={activeItemId}
        onSelectItem={handleSelectItem}
        onCloseItem={handleCloseItem}
        onShowList={handleShowList}
      />
      <div className="flex-1 min-h-0 overflow-y-auto">
        {activeItemId ? (
          <div className="flex h-full min-h-0 overflow-hidden">
            <div className="flex-1 min-w-0 overflow-y-auto p-4">
              {activePlanError ? (
                <EmptyState variant="error" title={activePlanError} className="h-full" />
              ) : activePlanDetail && activePlanDetail.id === activeItemId ? (
                <PlanSummaryCard plan={activePlanDetail} isPolish={isPolish} />
              ) : (
                <LoadingState template="list" rows={4} />
              )}
            </div>
            <AgentPlanWorkspace
              key={activeItemId}
              initialPlanId={activeItemId}
              onClose={() => handleCloseItem(activeItemId)}
            />
          </div>
        ) : tab === 'processes' ? (
          renderProcesses()
        ) : (
          renderTemplates()
        )}
      </div>
    </div>
  );
};

export default AgentHubShell;
