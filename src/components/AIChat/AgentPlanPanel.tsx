/**
 * AgentPlanPanel — szkielet paneli planu agenta (HP-4 fundament).
 *
 * SSOT koncepcyjne: Harvard/wdrozenie-100/_KONCEPT_HP4_AGENT_W_TERESIE.md
 * §2 "UI — panel planu PO PRAWEJ" + §4 zadanie F4. Doktryna
 * panel-Teresy-zawsze-po-prawej (#56) — reużywa powłokę wspólną
 * `ArtifactRightPanel` (accordion, tokeny c-*, fokus c-focus) zamiast
 * budować nowy kontener od zera.
 *
 * Za flagą `ff_agentPlan` (src/utils/agentPlanFlag.ts, default OFF — reguła
 * #7 CLAUDE.md: brak jeszcze akceptu Piotra na zrzutach). Ten komponent NIE
 * jest jeszcze zamontowany w żadnym realnym wejściu (czat/kebab/toolbar) —
 * to celowe: integracja czat→plan to osobne zadanie konceptu (§2 "Minimalna
 * zmiana w czacie", 1 miejsce w ai.routes.ts + UnifiedChatPanel.tsx). Ten
 * plik jest wywoływalny z osobnego testowego wejścia (dev harness / Storybook
 * / przyszły trigger) przekazując `planId`.
 *
 * Sekcje (kolejność z konceptu): Plan (kroki) · Postęp (pasek + status) ·
 * Aprobaty (checkpointy awaiting_approval) · Raport (podsumowanie/błąd).
 *
 * Serwis: server/src/routes/ai/agent-plan.routes.ts (cienki router) ->
 * agentPlannerService (kręgosłup istniejący, migracja 672). Ten panel NIE
 * zawiera żadnej logiki wykonania — tylko odczyt stanu + approve/cancel.
 *
 * ★ AGT-007 (2026-07-23) — sekcja "Plan" przestała być tylko-do-odczytu:
 * dopóki plan jest w statusie `planning` (backend nie zdążył/nie zdołał
 * jeszcze zlecić wykonania w tle — patrz komentarz w agent-plan.routes.ts
 * "background dispatch best-effort"), user może DODAĆ/USUNĄĆ/PRZESTAWIĆ
 * klocek schematu (`AgentPlanCanvas.tsx`, strzałki góra/dół — prostsze i
 * solidniejsze niż drag&drop dla v1 liniowego, DEC-002). Po opuszczeniu
 * `planning` (executing/completed/…) sekcja wraca do READ-ONLY listy kroków
 * z prawdziwym statusem wykonania — edycja już wykonanego/trwającego kroku
 * nie ma sensu operacyjnego.
 *
 * ★ AGT-009 (2026-07-23) — zapis + uruchomienie realne. Backend dostał dwa
 * endpointy (agent-plan.routes.ts): `PATCH /:id/steps` (zapis przestawionego
 * schematu na planie w 'planning') i `POST /:id/run` (jawne "Uruchom": opc.
 * zapis steps + dispatch w tle). Kliknięcie "Uruchom" (`handleRunSchema`)
 * konwertuje klocki na kroki (`blocksToSteps` — odzyskuje `toolInput`
 * oryginalnych kroków po id, żeby przestawienie nie gubiło argumentów) i woła
 * `runAgentPlan(planId, steps)` — plan przechodzi z 'planning' do wykonania.
 * `localStorage` zostaje jako pamięć edycji między odświeżeniami PRZED
 * uruchomieniem; opcjonalny `onRunEditedSchema` jest teraz tylko notyfikacją
 * po udanym dispatchu (nie jest już jedyną ścieżką zapisu).
 */
import {
  CheckCircle2,
  Circle,
  Loader2,
  OctagonX,
  PlayCircle,
  SkipForward,
  XCircle,
} from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { PreviewActionButton } from '@/components/shared/PreviewPane';
import { ArtifactRightPanel } from '@/components/standard/ArtifactRightPanel';
import {
  type AgentPlan,
  type AgentPlanStep,
  approveAgentPlanStep,
  cancelAgentPlan,
  getAgentPlan,
  runAgentPlan,
} from '@/services/api/agentPlan.api';

import { AgentPlanCanvas, type PlanBlockKind, type PlanSchemaBlock } from './AgentPlanCanvas';

export interface AgentPlanPanelProps {
  planId: string;
  /**
   * Odświeżanie w tle (ms) dopóki plan nie osiągnie stanu końcowego. Default
   * 2000 — koncept §1/§4 zadanie F4: "jeśli SSE za trudne, polling co 2s"
   * (Piotr decision 07-16: wykonanie w tle + panel po prawej, niekoniecznie
   * na żywo przez SSE — 2s polling jest wystarczające dla tego trybu).
   */
  pollIntervalMs?: number;
  onClose?: () => void;
  /**
   * Wołane PO udanym zapisie+dispatchu (AGT-009: `handleRunSchema` już
   * wysłał `POST /:id/run` i backend przyjął plan) — czysta notyfikacja dla
   * wołającego, nie jest już jedyną ścieżką zapisu (patrz nagłówek pliku).
   * Gdy nieustawione, panel po prostu zamraża canvas lokalnie po kliknięciu.
   */
  onRunEditedSchema?: (blocks: PlanSchemaBlock[]) => void;
}

const CANVAS_STORAGE_PREFIX = 'consultify:agentPlanCanvas:';

/** Best-effort — brak localStorage (SSR/prywatny tryb bez pamięci) nie wysadza panelu. */
function loadStoredBlocks(planId: string): PlanSchemaBlock[] | null {
  try {
    const raw = window.localStorage.getItem(CANVAS_STORAGE_PREFIX + planId);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as PlanSchemaBlock[]) : null;
  } catch {
    return null;
  }
}

function saveStoredBlocks(planId: string, blocks: PlanSchemaBlock[]): void {
  try {
    window.localStorage.setItem(CANVAS_STORAGE_PREFIX + planId, JSON.stringify(blocks));
  } catch {
    // best-effort only — brak persystencji nie blokuje edycji w sesji
  }
}

/** Konwersja realnych kroków planu (`AgentPlanStep`, backend) na edytowalne klocki schematu. */
function stepsToBlocks(steps: AgentPlanStep[]): PlanSchemaBlock[] {
  return steps.map((step) => {
    const rawKind = step.toolInput?.blockKind;
    const kind: PlanBlockKind =
      rawKind === 'ai-teresa' || rawKind === 'vault-kontekst' || rawKind === 'brama-akceptu'
        ? rawKind
        : 'etap-modul';
    const rawModule = step.toolInput?.module;
    return {
      id: step.id,
      kind,
      name: step.toolName,
      moduleType: typeof rawModule === 'string' ? rawModule : undefined,
    };
  });
}

/**
 * AGT-009: konwersja edytowalnych klocków (`PlanSchemaBlock`) z powrotem na
 * kroki wykonawcze `{toolName, toolInput}` do zapisu/uruchomienia. Klocek jest
 * lossy (niesie tylko id/kind/name/moduleType — patrz `stepsToBlocks`), więc
 * dla klocków POCHODZĄCYCH z realnego kroku odzyskujemy oryginalny `toolInput`
 * po `id` (blok.id === step.id), zachowując argumenty narzędzia (query,
 * calculation_type, …). Do tego dopisujemy metadane schematu (`blockKind`,
 * `module`, `phase`) tak, by round-trip step→block→step był stabilny.
 *
 * Nowo DODANE klocki (brak dopasowania po id) dostają bezpieczny, wykonywalny
 * `toolName` = `search_knowledge_base` (read-only, ten sam rejestr narzędzi co
 * czat Teresy) z zapytaniem z nazwy klocka — plan pozostaje uruchamialny, a
 * bramka akceptu i tak zadziała dla klocków side-effect wg SIDE_EFFECT_TOOLS.
 */
function blocksToSteps(
  blocks: PlanSchemaBlock[],
  planSteps: AgentPlanStep[]
): Array<{ toolName: string; toolInput: Record<string, unknown> }> {
  const byId = new Map(planSteps.map((s) => [s.id, s]));
  return blocks.map((block) => {
    const matched = byId.get(block.id);
    const baseInput: Record<string, unknown> = matched ? { ...matched.toolInput } : {};
    const toolName = matched?.toolName ?? 'search_knowledge_base';
    if (!matched) {
      baseInput.query = block.name;
    }
    return {
      toolName,
      toolInput: {
        ...baseInput,
        blockKind: block.kind,
        module: block.moduleType ?? baseInput.module,
        phase: block.name,
      },
    };
  });
}

const TERMINAL_STATUSES = new Set(['completed', 'completed_with_errors', 'failed', 'cancelled']);

const STEP_ICON: Record<AgentPlanStep['status'], React.ReactNode> = {
  pending: <Circle size={14} className="text-c-text-muted" />,
  awaiting_approval: <PlayCircle size={14} className="text-c-warning" />,
  running: <Loader2 size={14} className="text-c-info animate-spin" />,
  completed: <CheckCircle2 size={14} className="text-c-success" />,
  failed: <XCircle size={14} className="text-c-danger" />,
  skipped: <SkipForward size={14} className="text-c-text-muted" />,
};

const STATUS_LABEL_KEY: Record<AgentPlan['status'], string> = {
  planning: 'agentPlan.status.planning',
  awaiting_approval: 'agentPlan.status.awaitingApproval',
  executing: 'agentPlan.status.executing',
  paused: 'agentPlan.status.paused',
  completed: 'agentPlan.status.completed',
  completed_with_errors: 'agentPlan.status.completedWithErrors',
  failed: 'agentPlan.status.failed',
  cancelled: 'agentPlan.status.cancelled',
};

const STATUS_FALLBACK: Record<AgentPlan['status'], string> = {
  planning: 'Planning…',
  awaiting_approval: 'Awaiting approval',
  executing: 'Executing…',
  paused: 'Paused',
  completed: 'Completed',
  completed_with_errors: 'Completed with errors',
  failed: 'Failed',
  cancelled: 'Cancelled',
};

export const AgentPlanPanel: React.FC<AgentPlanPanelProps> = ({
  planId,
  pollIntervalMs = 2000,
  onClose,
  onRunEditedSchema,
}) => {
  const { t } = useTranslation();
  const [plan, setPlan] = useState<AgentPlan | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null); // stepId | 'cancel' | null
  const [canvasBlocks, setCanvasBlocks] = useState<PlanSchemaBlock[] | null>(null);
  const [schemaSubmitted, setSchemaSubmitted] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      const { plan: fetched } = await getAgentPlan(planId);
      setPlan(fetched);
      setLoadError(null);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Failed to load plan');
    }
  }, [planId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    if (!plan || TERMINAL_STATUSES.has(plan.status)) return;
    pollRef.current = setInterval(() => {
      void load();
    }, pollIntervalMs);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [plan, load, pollIntervalMs]);

  // Seed edytowalny canvas raz, gdy plan wejdzie w `planning` — localStorage
  // wygrywa nad świeżymi krokami z serwera (user mógł już przestawić schemat
  // przed odświeżeniem strony, PRZED jawnym "Uruchom"). Trwały zapis w
  // backendzie istnieje od AGT-009 (PATCH /:id/steps, POST /:id/run —
  // patrz nagłówek pliku); localStorage jest tylko buforem edycji między
  // odświeżeniami strony ZANIM user kliknie "Uruchom".
  useEffect(() => {
    if (plan && plan.status === 'planning' && canvasBlocks === null) {
      setCanvasBlocks(loadStoredBlocks(planId) ?? stepsToBlocks(plan.steps));
    }
    if (plan && plan.status !== 'planning' && canvasBlocks !== null) {
      // Plan opuścił planning (np. dispatch w tle jednak wystartował) —
      // wracamy do read-only widoku prawdziwych kroków wykonania.
      setCanvasBlocks(null);
      setSchemaSubmitted(false);
    }
  }, [plan, canvasBlocks, planId]);

  const handleCanvasChange = useCallback(
    (blocks: PlanSchemaBlock[]) => {
      setCanvasBlocks(blocks);
      saveStoredBlocks(planId, blocks);
    },
    [planId]
  );

  const handleRunSchema = useCallback(
    async (blocks: PlanSchemaBlock[]) => {
      saveStoredBlocks(planId, blocks);
      setSchemaSubmitted(true); // zamraża canvas natychmiast (optimistic)
      setBusy('run');
      try {
        // AGT-009: jawne "Uruchom" — zapis przestawionego schematu + dispatch
        // jednym żądaniem (POST /:id/run z ostatecznymi krokami). Odzyskujemy
        // toolInput oryginalnych kroków po id (blocksToSteps), żeby przestawienie
        // nie gubiło argumentów narzędzi.
        const steps = blocksToSteps(blocks, plan?.steps ?? []);
        const { plan: updated } = await runAgentPlan(planId, steps);
        setPlan(updated);
        setLoadError(null);
        onRunEditedSchema?.(blocks);
      } catch (error) {
        // Nieudany dispatch: odmroź canvas, żeby user mógł poprawić i spróbować ponownie.
        setSchemaSubmitted(false);
        setLoadError(error instanceof Error ? error.message : 'Failed to run plan');
      } finally {
        setBusy(null);
      }
    },
    [planId, plan, onRunEditedSchema]
  );

  const handleApprove = useCallback(
    async (step: AgentPlanStep) => {
      setBusy(step.id);
      try {
        const { plan: updated } = await approveAgentPlanStep(planId, step.stepIndex);
        setPlan(updated);
      } catch (error) {
        setLoadError(error instanceof Error ? error.message : 'Failed to approve step');
      } finally {
        setBusy(null);
      }
    },
    [planId]
  );

  const handleCancel = useCallback(async () => {
    setBusy('cancel');
    try {
      const { plan: updated } = await cancelAgentPlan(planId);
      setPlan(updated);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Failed to cancel plan');
    } finally {
      setBusy(null);
    }
  }, [planId]);

  if (!plan) {
    return (
      <ArtifactRightPanel
        ariaLabel="Agent plan"
        sections={[
          {
            id: 'loading',
            label: t('agentPlan.loading', 'Loading plan'),
            collapsible: false,
            children: (
              <p className="text-xs text-c-text-muted py-1.5">
                {loadError ?? t('agentPlan.loadingBody', 'Loading plan…')}
              </p>
            ),
          },
        ]}
      />
    );
  }

  const awaitingSteps = plan.steps.filter((s) => s.status === 'awaiting_approval');
  const canCancel = !TERMINAL_STATUSES.has(plan.status);
  const progressPct =
    plan.totalSteps > 0 ? Math.round((plan.completedSteps / plan.totalSteps) * 100) : 0;
  const isEditableSchema = plan.status === 'planning' && canvasBlocks !== null;

  return (
    <ArtifactRightPanel
      ariaLabel="Agent plan"
      sections={[
        {
          id: 'plan',
          label: t('agentPlan.section.plan', 'Plan'),
          badge: isEditableSchema ? (canvasBlocks?.length ?? 0) : plan.totalSteps,
          children: isEditableSchema ? (
            <div className="space-y-2">
              <AgentPlanCanvas
                blocks={canvasBlocks ?? []}
                onChange={handleCanvasChange}
                onRunSchema={handleRunSchema}
                readOnly={schemaSubmitted}
              />
              {!schemaSubmitted ? (
                <p className="text-[10px] text-c-text-muted pt-1">
                  {t(
                    'agentPlan.canvas.localOnlyNote',
                    'Zmiany zapisują się lokalnie w przeglądarce podczas edycji; „Uruchom" zapisuje schemat w backendzie i startuje wykonanie.'
                  )}
                </p>
              ) : (
                <p className="text-[10px] text-c-success pt-1">
                  {t('agentPlan.canvas.submittedNote', 'Schemat zatwierdzony do uruchomienia.')}
                </p>
              )}
            </div>
          ) : (
            <ol className="space-y-2">
              {plan.steps.map((step) => (
                <li key={step.id} className="flex items-start gap-2 text-xs">
                  <span className="mt-0.5 shrink-0">{STEP_ICON[step.status]}</span>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-c-text truncate">{step.toolName}</div>
                    {step.errorMessage ? (
                      <div className="text-c-danger mt-0.5">{step.errorMessage}</div>
                    ) : null}
                  </div>
                  {step.requiresApproval ? (
                    <span className="shrink-0 text-[10px] uppercase tracking-wide text-c-text-muted">
                      {t('agentPlan.step.requiresApproval', 'approval')}
                    </span>
                  ) : null}
                </li>
              ))}
            </ol>
          ),
        },
        {
          id: 'progress',
          label: t('agentPlan.section.progress', 'Postęp'),
          children: (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-c-text-muted">
                  {t(STATUS_LABEL_KEY[plan.status], STATUS_FALLBACK[plan.status])}
                </span>
                <span className="tabular-nums text-c-text-muted">
                  {plan.completedSteps}/{plan.totalSteps}
                </span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-c-border-subtle overflow-hidden">
                <div
                  className={`h-full rounded-full transition-[width] duration-300 ${
                    plan.status === 'completed_with_errors' ? 'bg-c-warning' : 'bg-c-success'
                  }`}
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              {canCancel ? (
                <PreviewActionButton
                  variant="destructive"
                  icon={OctagonX}
                  label={t('agentPlan.action.cancel', 'Stop')}
                  onClick={() => void handleCancel()}
                  disabled={busy !== null}
                />
              ) : null}
              {onClose ? (
                <PreviewActionButton
                  variant="neutral"
                  label={t('agentPlan.action.close', 'Close')}
                  onClick={onClose}
                  disabled={busy !== null}
                />
              ) : null}
            </div>
          ),
        },
        {
          id: 'approvals',
          label: t('agentPlan.section.approvals', 'Aprobaty'),
          badge: awaitingSteps.length,
          isEmpty: awaitingSteps.length === 0,
          emptyLabel: t('agentPlan.approvals.empty', 'No steps awaiting approval'),
          children: (
            <div className="space-y-2">
              {awaitingSteps.map((step) => (
                <div key={step.id} className="rounded-lg border border-c-border-subtle p-2">
                  <div className="text-xs font-medium text-c-text mb-1.5">{step.toolName}</div>
                  <PreviewActionButton
                    variant="positive"
                    icon={CheckCircle2}
                    label={t('agentPlan.action.approveStep', 'Approve step')}
                    onClick={() => void handleApprove(step)}
                    disabled={busy !== null}
                  />
                </div>
              ))}
            </div>
          ),
        },
        {
          id: 'report',
          label: t('agentPlan.section.report', 'Raport'),
          isEmpty: !plan.resultSummary && !plan.errorMessage,
          emptyLabel: t('agentPlan.report.empty', 'Report available after completion'),
          children: (
            <div className="text-xs text-c-text space-y-1">
              {plan.resultSummary ? <p>{plan.resultSummary}</p> : null}
              {plan.errorMessage ? <p className="text-c-danger">{plan.errorMessage}</p> : null}
            </div>
          ),
        },
      ]}
    />
  );
};

export default AgentPlanPanel;
