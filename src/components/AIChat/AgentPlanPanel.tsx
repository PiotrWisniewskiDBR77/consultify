/**
 * AgentPlanPanel — WARSZTAT AGENTA (3 kolumny).
 *
 * SSOT koncepcyjne: Harvard/wdrozenie-100/_KONCEPT_HP4_AGENT_W_TERESIE.md §2/§4
 * + _SPEC_AGENT_VAULT_2026-07-22.md §4 (generator procesu).
 *
 * ★ 2026-07-24 — PRZEBUDOWA Z PANELU NA WARSZTAT. Stan zastany: cały ekran
 * procesu to była JEDNA wąska kolumna (`ArtifactRightPanel` z sekcjami Plan /
 * Postęp / Aprobaty / Raport), a reszta ekranu po otwarciu procesu świeciła
 * pustką. Teraz:
 *
 *   ┌────────────┬──────────────────────────────┬────────────┐
 *   │ STEROWANIE │        SCHEMAT BLOKOWY       │  PALETA    │
 *   │ Uruchom/   │  karty klocków + połączenia  │  klocków   │
 *   │ Stop,      │  + wyróżniony etap „TERAZ"   │  z rejestru│
 *   │ postęp,    │  (AgentPlanCanvas.tsx)       │  narzędzi  │
 *   │ zgody, log │                              │  (+Wkrótce)│
 *   └────────────┴──────────────────────────────┴────────────┘
 *      AgentWorkshopControls        AgentWorkshopPalette
 *
 * Flow backendu NIE zmienia się: `draft` → `PATCH /:id/steps` → `POST /:id/run`
 * → polling `GET /:id` → `POST /:id/approve-step`. Warsztat go WYKORZYSTUJE,
 * nie zastępuje.
 *
 * ── KLOCEK „INFORMACJA" (notatka) ────────────────────────────────────────────
 * To jedyny typ klocka, który NIE jest krokiem wykonania — agent go nie odpala.
 * Żeby mimo to przeżył zapis i uruchomienie (a nie zniknął po odświeżeniu),
 * notatki są przenoszone w `toolInput.notesBefore` NASTĘPNEGO kroku (a notatki
 * na końcu schematu — w `toolInput.notesAfter` ostatniego kroku).
 * `stepsToBlocks` rozwija je z powrotem na klocki. Zero zmian w schemacie bazy,
 * zero fałszywego kroku, który padłby na `Unknown tool`.
 *
 * ── BRAMKA AKCEPTU ───────────────────────────────────────────────────────────
 * Klocki `brama-akceptu` i `automat` wysyłają JAWNY `requiresApproval: true`
 * (backend przyjmuje override — `PlanStepInputSchema`, DOROBKA C 2026-07-23).
 * Powód: pisarze My Work (`create_task`/`update_task`/`create_decision`) NIE są
 * w `SIDE_EFFECT_TOOLS`, więc bez tego override'u wykonałyby się bez pytania.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { ArtifactRightPanel } from '@/components/standard/ArtifactRightPanel';
import {
  type AgentPlan,
  type AgentPlanStep,
  approveAgentPlanStep,
  cancelAgentPlan,
  getAgentPlan,
  runAgentPlan,
  scheduleAgentPlan,
  updateAgentPlanSteps,
} from '@/services/api/agentPlan.api';

import {
  AgentPlanCanvas,
  type CanvasExecutionState,
  makeBlockId,
  type PlanSchemaBlock,
} from './AgentPlanCanvas';
import {
  AGENT_BLOCK_ENTRIES,
  DEFAULT_TOOL_NAME,
  forcesApproval,
  isAnnotationKind,
  isPlanBlockKind,
  type PlanBlockKind,
  toolLabel,
} from './agentWorkshopCatalog';
import { AgentWorkshopControls, readablePhaseName } from './AgentWorkshopControls';
import { AgentWorkshopPalette } from './AgentWorkshopPalette';

export interface AgentPlanPanelProps {
  planId: string;
  /** Odświeżanie w tle (ms) dopóki plan nie osiągnie stanu końcowego. */
  pollIntervalMs?: number;
  onClose?: () => void;
  /** Notyfikacja po udanym zapisie+dispatchu (`POST /:id/run` przyjęty). */
  onRunEditedSchema?: (blocks: PlanSchemaBlock[]) => void;
}

const CANVAS_STORAGE_PREFIX = 'consultify:agentPlanCanvas:';

/** Best-effort — brak localStorage (SSR/prywatny tryb) nie wysadza warsztatu. */
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

export { readablePhaseName };

/** Odczyt listy notatek z `toolInput` (zapisanej przez `blocksToSteps`). */
function readNotes(toolInput: Record<string, unknown> | undefined, key: string): string[] {
  const raw = toolInput?.[key];
  if (!Array.isArray(raw)) return [];
  return raw.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

/**
 * Konwersja realnych kroków planu (`AgentPlanStep`, backend) na klocki schematu.
 *
 * Nazwa wyświetlana klocka, w kolejności pierwszeństwa:
 *  (1) `toolInput.phase` — czytelna nazwa fazy z generatora procesu
 *      (`processLibraryService.buildExecutableSteps` wstrzykuje `phase: p.name`,
 *      np. "Diagnoza", "Rekomendacje"),
 *  (2) `toolInput.name`,
 *  (3) czytelna etykieta narzędzia z katalogu warsztatu (`toolLabel`) — dzięki
 *      temu na karcie nigdy nie świeci `search_knowledge_base` jak nazwa etapu,
 *  (4) surowy `toolName` (narzędzie spoza katalogu).
 * Nazwa techniczna narzędzia NIE ginie — jest niesiona osobno w `block.toolName`
 * i pokazywana w podtytule karty oraz w select "Narzędzie".
 */
export function stepsToBlocks(steps: AgentPlanStep[]): PlanSchemaBlock[] {
  const out: PlanSchemaBlock[] = [];

  steps.forEach((step, stepIdx) => {
    readNotes(step.toolInput, 'notesBefore').forEach((text, i) => {
      out.push({ id: `${step.id}-note-b${i}`, kind: 'informacja', name: text });
    });

    const rawKind = step.toolInput?.blockKind;
    const kind: PlanBlockKind =
      isPlanBlockKind(rawKind) && !isAnnotationKind(rawKind) ? rawKind : 'etap-modul';
    const rawModule = step.toolInput?.module;

    // Notatki nie wracają do toolInput klocka — są osobnymi klockami.
    const cleanInput: Record<string, unknown> = { ...(step.toolInput ?? {}) };
    delete cleanInput.notesBefore;
    delete cleanInput.notesAfter;

    out.push({
      id: step.id,
      kind,
      name: readablePhaseName(step.toolInput) ?? toolLabel(step.toolName) ?? step.toolName,
      moduleType: typeof rawModule === 'string' ? rawModule : undefined,
      toolName: step.toolName,
      toolInput: cleanInput,
    });

    if (stepIdx === steps.length - 1) {
      readNotes(step.toolInput, 'notesAfter').forEach((text, i) => {
        out.push({ id: `${step.id}-note-a${i}`, kind: 'informacja', name: text });
      });
    }
  });

  return out;
}

export interface PlanStepPayload {
  toolName: string;
  toolInput: Record<string, unknown>;
  requiresApproval?: boolean;
}

/**
 * Konwersja klocków schematu z powrotem na kroki wykonawcze.
 *
 * Kolejność pierwszeństwa narzędzia: (1) realny krok dopasowany po `id`
 * (przestawienie/usunięcie NIE gubi argumentów: query, calculation_type,
 * vault_scope…), (2) wybór usera na klocku, (3) bezpieczny fallback read-only
 * (tylko dla klocków sprzed AGT-008, bez `toolName` w ogóle).
 *
 * Klocki `informacja` NIE stają się krokami — ich treść jedzie w
 * `notesBefore`/`notesAfter` sąsiedniego kroku (patrz nagłówek pliku).
 */
export function blocksToSteps(
  blocks: PlanSchemaBlock[],
  planSteps: AgentPlanStep[]
): PlanStepPayload[] {
  const byId = new Map(planSteps.map((s) => [s.id, s]));
  const out: PlanStepPayload[] = [];
  let pendingNotes: string[] = [];

  blocks.forEach((block) => {
    if (isAnnotationKind(block.kind)) {
      if (block.name.trim().length > 0) pendingNotes.push(block.name);
      return;
    }

    const matched = byId.get(block.id);
    const baseInput: Record<string, unknown> = matched
      ? { ...matched.toolInput }
      : { ...(block.toolInput ?? {}) };
    const toolName = matched?.toolName ?? block.toolName ?? DEFAULT_TOOL_NAME;
    if (!baseInput.query && toolName === DEFAULT_TOOL_NAME) {
      baseInput.query = block.name;
    }
    // Notatki zawsze przepisujemy od zera — inaczej skasowana notatka wróciłaby
    // z `matched.toolInput` przy najbliższym zapisie.
    delete baseInput.notesBefore;
    delete baseInput.notesAfter;

    const payload: PlanStepPayload = {
      toolName,
      toolInput: {
        ...baseInput,
        blockKind: block.kind,
        module: block.moduleType ?? baseInput.module,
        phase: block.name,
        ...(pendingNotes.length > 0 ? { notesBefore: pendingNotes } : {}),
      },
    };
    if (forcesApproval(block.kind)) payload.requiresApproval = true;
    pendingNotes = [];
    out.push(payload);
  });

  // Notatki na samym końcu schematu doklejamy do ostatniego kroku.
  if (pendingNotes.length > 0 && out.length > 0) {
    out[out.length - 1].toolInput.notesAfter = pendingNotes;
  }

  return out;
}

const TERMINAL_STATUSES = new Set(['completed', 'completed_with_errors', 'failed', 'cancelled']);

/** Klocek z pozycji palety — jedyne miejsce, gdzie paleta staje się schematem. */
function blockFromPaletteEntry(entryId: string): PlanSchemaBlock | null {
  const entry = AGENT_BLOCK_ENTRIES.find((e) => e.id === entryId);
  // Pozycja 'soon' nigdy nie wchodzi do schematu — nie ma narzędzia do wykonania.
  if (!entry || entry.status !== 'active') return null;
  return {
    id: makeBlockId(),
    kind: entry.kind,
    name: entry.label,
    moduleType: entry.module,
    toolName: isAnnotationKind(entry.kind) ? undefined : entry.toolName,
  };
}

export const AgentPlanPanel: React.FC<AgentPlanPanelProps> = ({
  planId,
  pollIntervalMs = 2000,
  onClose,
  onRunEditedSchema,
}) => {
  const [plan, setPlan] = useState<AgentPlan | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [canvasBlocks, setCanvasBlocks] = useState<PlanSchemaBlock[] | null>(null);
  const [schemaSubmitted, setSchemaSubmitted] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  /**
   * M02-P16b: client-side idempotency key lifecycle for `handleRunSchema`
   * submissions — mirrors the (key, fingerprint) contract used elsewhere in
   * the repo for create-submission idempotency (M02-P04 Tasks fix): the SAME
   * key is resent on a retry of an UNCHANGED payload (network drop, retrying
   * after an error before editing the schema again); a NEW key is minted
   * once the fingerprinted payload changes, or right after a successful run.
   * Inlined here (not imported) because the shared
   * `src/utils/createIdempotencyKey.ts` util lives on a sibling branch not
   * yet merged into this one.
   */
  const runSubmissionRef = useRef<{ key: string; fingerprint: string } | null>(null);

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

  // Seed edytowalny schemat raz, gdy plan jest w `planning` — localStorage
  // wygrywa nad krokami z serwera (user mógł już przestawić klocki przed
  // odświeżeniem, PRZED jawnym "Uruchom").
  useEffect(() => {
    if (plan && plan.status === 'planning' && canvasBlocks === null) {
      setCanvasBlocks(loadStoredBlocks(planId) ?? stepsToBlocks(plan.steps));
    }
    if (plan && plan.status !== 'planning' && canvasBlocks !== null) {
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

  const handleInsertEntry = useCallback(
    (entryId: string, index: number) => {
      const block = blockFromPaletteEntry(entryId);
      if (!block) return;
      setCanvasBlocks((prev) => {
        const base = prev ?? [];
        const next = base.slice();
        next.splice(Math.max(0, Math.min(index, base.length)), 0, block);
        saveStoredBlocks(planId, next);
        return next;
      });
    },
    [planId]
  );

  const handleAppendEntry = useCallback(
    (entryId: string) => {
      handleInsertEntry(entryId, canvasBlocks?.length ?? 0);
    },
    [handleInsertEntry, canvasBlocks]
  );

  const handleRunSchema = useCallback(async () => {
    const blocks = canvasBlocks ?? [];
    saveStoredBlocks(planId, blocks);
    const steps = blocksToSteps(blocks, plan?.steps ?? []);
    if (steps.length === 0) {
      setLoadError('Schemat nie ma ani jednego wykonywalnego kroku — sama notatka nie wystarczy.');
      return;
    }
    setSchemaSubmitted(true); // zamraża schemat natychmiast (optimistic)
    setBusy('run');
    // M02-P16b: reuse the same idempotency key across a retry of this exact
    // (planId, steps) submission; mint a fresh one if the schema changed
    // since the last attempt (a genuinely different run request must not
    // replay the old one's result).
    const fingerprint = `${planId}:${JSON.stringify(steps)}`;
    const previous = runSubmissionRef.current;
    const idempotencyKey =
      previous && previous.fingerprint === fingerprint
        ? previous.key
        : (() => {
            const fresh =
              typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
                ? crypto.randomUUID()
                : `run-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
            runSubmissionRef.current = { key: fresh, fingerprint };
            return fresh;
          })();
    try {
      const { plan: updated } = await runAgentPlan(planId, steps, idempotencyKey);
      runSubmissionRef.current = null; // success — a future run is a new intention, mint a new key
      setPlan(updated);
      setLoadError(null);
      onRunEditedSchema?.(blocks);
    } catch (error) {
      setSchemaSubmitted(false);
      setLoadError(error instanceof Error ? error.message : 'Failed to run plan');
    } finally {
      setBusy(null);
    }
  }, [planId, plan, canvasBlocks, onRunEditedSchema]);

  /**
   * Harmonogram (Fala 1, 2026-07-26): zapisuje przestawiony schemat (jak
   * `handleRunSchema`), ale zamiast dispatchu od razu woła `/schedule` —
   * dispatch robi cron, gdy `scheduledAt` minie.
   */
  const handleSchedule = useCallback(
    async (scheduledAt: string) => {
      const blocks = canvasBlocks ?? [];
      saveStoredBlocks(planId, blocks);
      const steps = blocksToSteps(blocks, plan?.steps ?? []);
      if (steps.length === 0) {
        setLoadError(
          'Schemat nie ma ani jednego wykonywalnego kroku — sama notatka nie wystarczy.'
        );
        return;
      }
      setSchemaSubmitted(true);
      setBusy('schedule');
      try {
        await updateAgentPlanSteps(planId, steps);
        const { plan: updated } = await scheduleAgentPlan(planId, scheduledAt);
        setPlan(updated);
        setLoadError(null);
      } catch (error) {
        setSchemaSubmitted(false);
        setLoadError(error instanceof Error ? error.message : 'Failed to schedule plan');
      } finally {
        setBusy(null);
      }
    },
    [planId, plan, canvasBlocks]
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

  /** Widok tylko-do-odczytu: klocki odtworzone z realnych kroków planu. */
  const readOnlyBlocks = useMemo(
    () => (plan && plan.status !== 'planning' ? stepsToBlocks(plan.steps) : []),
    [plan]
  );

  /**
   * Stan wykonania dla schematu. „TERAZ" = krok `running`; gdy żaden nie biegnie,
   * a plan czeka na zgodę — krok `awaiting_approval`; w ostateczności krok
   * wskazany przez `currentStepIndex` planu (dopóki plan nie jest zakończony).
   */
  const execution: CanvasExecutionState | undefined = useMemo(() => {
    // 'scheduled' (Fala 1, Harmonogram): nic jeszcze nie biegnie — nie
    // podświetlaj kroku 1 jako "TERAZ" zanim cron realnie wystartuje plan.
    if (!plan || plan.status === 'planning' || plan.status === 'scheduled') return undefined;
    const statusById: Record<string, CanvasExecutionState['statusById'][string]> = {};
    plan.steps.forEach((step) => {
      statusById[step.id] = step.status;
    });
    const running = plan.steps.find((s) => s.status === 'running');
    const awaiting = plan.steps.find((s) => s.status === 'awaiting_approval');
    const byIndex = TERMINAL_STATUSES.has(plan.status)
      ? undefined
      : plan.steps.find((s) => s.stepIndex === plan.currentStepIndex);
    return { statusById, currentBlockId: (running ?? awaiting ?? byIndex)?.id };
  }, [plan]);

  const currentStep = useMemo(() => {
    if (!plan || !execution?.currentBlockId) return undefined;
    return plan.steps.find((s) => s.id === execution.currentBlockId);
  }, [plan, execution]);

  if (!plan) {
    return (
      <div className="flex h-full w-full items-stretch">
        <ArtifactRightPanel
          ariaLabel="Agent plan"
          className="border-l-0 border-r border-c-border-subtle"
          sections={[
            {
              id: 'loading',
              label: 'Wczytywanie',
              collapsible: false,
              children: (
                <p className="py-1.5 text-xs text-c-text-muted">
                  {loadError ?? 'Wczytuję proces…'}
                </p>
              ),
            },
          ]}
        />
        <div className="flex-1" />
      </div>
    );
  }

  const editable = plan.status === 'planning' && canvasBlocks !== null && !schemaSubmitted;
  const blocks = plan.status === 'planning' ? (canvasBlocks ?? []) : readOnlyBlocks;
  const executableCount = blocks.filter((b) => !isAnnotationKind(b.kind)).length;

  return (
    <div className="flex h-full min-h-[560px] w-full items-stretch" data-testid="agent-workshop">
      <AgentWorkshopControls
        plan={plan}
        currentStep={currentStep}
        draftBlockCount={executableCount}
        canRun={plan.status === 'planning'}
        canCancel={!TERMINAL_STATUSES.has(plan.status) && plan.status !== 'planning'}
        busy={busy !== null}
        onRun={() => void handleRunSchema()}
        onSchedule={(scheduledAt) => void handleSchedule(scheduledAt)}
        onCancel={() => void handleCancel()}
        onApprove={(step) => void handleApprove(step)}
        onClose={onClose}
        errorMessage={loadError}
      />

      <div className="flex min-w-0 flex-1 flex-col bg-c-bg">
        <div className="flex h-11 shrink-0 items-center justify-between gap-3 border-b border-c-border-subtle px-6">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-c-text-muted">
            Schemat procesu
          </span>
          <span className="text-[11px] text-c-text-muted">
            {executableCount} {executableCount === 1 ? 'krok' : 'kroków'}
            {schemaSubmitted ? ' · schemat zatwierdzony' : ''}
          </span>
        </div>
        <AgentPlanCanvas
          blocks={blocks}
          onChange={handleCanvasChange}
          readOnly={!editable}
          onInsertEntry={handleInsertEntry}
          execution={execution}
        />
      </div>

      <AgentWorkshopPalette onAdd={(entry) => handleAppendEntry(entry.id)} disabled={!editable} />
    </div>
  );
};

export default AgentPlanPanel;
