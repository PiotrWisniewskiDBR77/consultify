/**
 * DrdHttpMethodWorkspaceScreen — HTTP-source-of-truth path for the DRD
 * workspace (P0C, 2026-08-13).
 *
 * Rendered by `DrdMethodWorkspaceScreen.tsx` ONLY when `drdHttpSourceOfTruthV1`
 * is ON (default OFF). Mirrors `DrdMethodWorkspaceScreenLegacy`'s use of
 * `MethodWorkspaceShell`, reusing the SAME pure event->view-model derivation
 * (`drdWorkspaceViewModel.ts`) — the only thing that changes is where the
 * session/events/Output come from: `DrdHttpSessionRuntime`
 * (src/method-core/methods/drd/drdHttpSessionRuntime.ts) over
 * `/api/method/...`, never `localStorage` as an answer to "what is the
 * current state".
 *
 * ★ localStorage's role here is EXACTLY the two things
 * `DrdHttpSessionRuntime`'s header promises — a read cache and an offline
 * write-recovery queue — never the source of truth. See
 * `DrdSourceIndicator` for the visible proof of which one backed the last
 * paint.
 *
 * ★ Known gaps (server routes are P0A/P0B territory, out of this file's
 * reach — see the `drdHttpSourceOfTruthV1` flag description for the full
 * rationale):
 *  - role assignment is governed by the method-core role endpoints; this
 *    workspace consumes effective process roles but does not administer them.
 *  - no HTTP endpoint reopens a frozen session into a new revision — the
 *    Reopen action is disabled with an explicit message instead of faked.
 *  - persisted Output/Report/Initiative Draft state is rehydrated through
 *    the canonical method-core list endpoints.
 */
import { AlertTriangle, ArrowLeft, CloudOff, FileText, Lightbulb, Lock, RefreshCw, RotateCcw } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { MethodWorkspaceShell } from '@/components/method-workspace/MethodWorkspaceShell';
import { LiveMatrix } from '@/components/method-workspace/LiveMatrix';
import { StandardTable } from '@/components/standard/StandardTable';
import type { InterviewFocusQuestion, MethodWorkspaceViewMode } from '@/components/method-workspace/types';
import { useMethodWorkspaceSave } from '@/components/method-workspace/useMethodWorkspaceSave';
import { useAssessmentSaveIndicator } from '@/hooks/useAssessmentSaveIndicator';
import { DRD_METHOD_PACK_ID } from '@/method-core/methods/drd/compileDrdPack';
import { drdAdapter } from '@/method-core/methods/drd/drdAdapter';
import {
  DrdHttpSessionRuntime,
  type DrdHttpRuntimeState,
} from '@/method-core/methods/drd/drdHttpSessionRuntime';
import type { MethodReadiness, TeresaCommitRequest } from '@/method-core/contracts';
import { DRD_STRUCTURE } from '@/services/drdStructure';

import {
  buildMatrixRowsForAxis,
  buildNavigatorNodes,
  confirmedLevelsFor,
  evidenceEventsFor,
  evidenceStateFor,
  evidenceStrengthFor,
  OUTPUT_UNIT_COLUMNS,
  pack,
  questionAnswerState,
} from './drdWorkspaceViewModel';
import { AssessmentSaveStateIndicator } from './AssessmentSaveStateIndicator';
import { DrdSourceIndicator } from './DrdSourceIndicator';
import type { DrdMethodWorkspaceScreenProps } from './DrdMethodWorkspaceScreen';

type HttpScreenProps = Omit<DrdMethodWorkspaceScreenProps, 'forceHttpSourceOfTruth' | 'initialActorUserId' | 'forceState'>;

// ---------------------------------------------------------------------------
// Dev-render / test only — reach offline/conflict/recovery deterministically
// without depending on a genuinely flaky network. See this component's own
// `forceState` prop and `DrdHttpSessionRuntime`'s (absence of a) production
// code path that would ever call this — only the harness/tests do.
// ---------------------------------------------------------------------------
export type DrdHttpDebugForcedState = 'offline' | 'conflict' | 'recovery' | 'loading';

async function seedHttpSession(
  runtime: DrdHttpSessionRuntime,
  seedTo: HttpScreenProps['seedTo']
): Promise<void> {
  await runtime.transition('prepared');
  await runtime.transition('active');
  if (!seedTo) return;

  const area1A = DRD_STRUCTURE[0].areas[0];
  await runtime.recordAnswer({
    unitId: area1A.id,
    level: 1,
    questionId: `${area1A.id}-L1-Q1`,
    answerState: 'confirmed',
    text: 'Mamy podstawowy, spisany proces sprzedaży współdzielony w zespole.',
  });
  await runtime.recordEvidence({
    unitId: area1A.id,
    level: 1,
    evidenceId: 'demo-ev-1a-l1',
    evidenceType: 'document',
    strength: 'E2',
  });
  await runtime.recordAnswer({
    unitId: area1A.id,
    level: 2,
    questionId: `${area1A.id}-L2-Q1`,
    answerState: 'confirmed',
    text: 'Proces jest częściowo zautomatyzowany w CRM.',
  });
  await runtime.recordEvidence({
    unitId: area1A.id,
    level: 2,
    evidenceId: 'demo-ev-1a-l2',
    evidenceType: 'system_record',
    strength: 'E3',
  });
  await runtime.recordTargetDecision({ unitId: area1A.id, level: 4, rationale: 'Cel ustalony z zarządem na ten rok.' });

  if (seedTo === 'interview') return;

  const area1B = DRD_STRUCTURE[0].areas[1];
  await runtime.recordAnswer({
    unitId: area1B.id,
    level: 4,
    questionId: `${area1B.id}-L4-Q1`,
    answerState: 'confirmed',
    text: 'Zaawansowana praktyka zaobserwowana punktowo (poza kolejnością).',
  });
  await runtime.recordEvidence({ unitId: area1B.id, level: 4, evidenceId: 'demo-ev-1b-l4', evidenceType: 'observation', strength: 'E1' });

  if (seedTo === 'matrix') return;

  if (seedTo === 'teresa' || seedTo === 'approval' || seedTo === 'frozen' || seedTo === 'reopened') {
    await runtime.createTeresaPreview({
      capabilityId: 'draft_score_proposal',
      unitId: area1A.id,
      level: 3,
      invokedBy: 'local_action',
      statements: [
        { kind: 'respondent_declaration', text: 'Proces w CRM istnieje i jest używany przez cały zespół handlowy.', sourceRefs: [] },
        { kind: 'missing_evidence', text: 'Brak dowodu na regularny przegląd wskaźników procesu (poziom 3).', sourceRefs: [] },
        { kind: 'proposal', text: 'Proponowany poziom: 3 (zdefiniowany, mierzony proces).', sourceRefs: [] },
      ],
      proposedChanges: [{ target: 'score_proposal', targetId: area1A.id, before: 2, after: 3 }],
      quality: { verdict: 'needs_human_review', failedChecks: ['lists_missing_evidence'] },
    });
  }

  if (seedTo === 'approval' || seedTo === 'frozen' || seedTo === 'reopened') {
    await runtime.transition('in_review');
  }

  if (seedTo === 'frozen' || seedTo === 'reopened') {
    // Requires the 'approver' role — see this file's header on the known
    // role-assignment gap. In a browser where that role was NOT seeded
    // out-of-band this throws (403 missing_permission) and the screen
    // honestly shows the resulting error state rather than a faked freeze.
    await runtime.freeze();
    await runtime.generateReport({
      title: 'Raport demonstracyjny DRD',
      content: {
        executiveSummary: 'Sesja demonstracyjna DRD — wynik cząstkowy dla osi 1 (Procesy Cyfrowe).',
        participants: ['Piotr (Owner)', 'Anna (Approver)'],
        strengths: ['Proces sprzedaży ma podstawową dokumentację i częściową automatyzację w CRM.'],
      },
    });
    await runtime.generateInitiativeDraft({
      title: 'Domknij automatyzację procesu sprzedaży w CRM',
      summary: 'Initiative draft wygenerowany z findingów Outputu.',
      findingIds: (runtime.getState().output?.findings ?? []).map((f) => f.id),
      rationale: 'Znaleziska Outputu wskazują lukę między current a target dla jednostki 1A.',
      expectedOutcome: 'Podniesienie poziomu dojrzałości procesu sprzedaży do targetu.',
      confidence: 'medium',
    });
  }
  // 'reopened' has no HTTP path (see header) — intentionally stops at frozen.
}

// ---------------------------------------------------------------------------
// Small state-specific views
// ---------------------------------------------------------------------------

const BootstrapLoadingView: React.FC<{ label: string }> = ({ label }) => (
  <div data-testid="drd-http-bootstrap-loading" className="flex h-full flex-col items-center justify-center gap-3 text-sm text-c-text-muted">
    <DrdSourceIndicator source="RECOVERY_DRAFT" title="Jeszcze bez potwierdzonej odpowiedzi serwera." />
    {label}
  </div>
);

const ConflictView: React.FC<{
  state: DrdHttpRuntimeState;
  onLoadServerVersion: () => void;
  onExit: () => void;
}> = ({ state, onLoadServerVersion, onExit }) => (
  <div data-testid="drd-http-conflict-view" role="alert" className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
    <div className="flex items-center gap-2">
      <DrdSourceIndicator source="RECOVERY_DRAFT" title="Konflikt wersji — lokalny widok jest nieaktualny." />
      {/* CONFLICT requires a human decision but is NOT a failure — kanon UI
          (CLAUDE.md): not crimson, not c-danger. See AssessmentSaveStateIndicator.
          Status here is always 'conflict' by construction (this view only
          renders for `state.status === 'conflict'`), so the label is fixed
          rather than threaded through as another prop. */}
      <AssessmentSaveStateIndicator state="CONFLICT" />
    </div>
    <AlertTriangle size={28} className="text-c-info" />
    <h2 className="text-sm font-semibold text-c-text">Sesja zmieniła się na serwerze</h2>
    <p className="max-w-md text-xs text-c-text-secondary">
      Twoja przeglądarka miała wersję {state.session?.version ?? '—'}, serwer ma już wersję {state.serverVersion ?? '—'}.
      Nic nie zostało nadpisane automatycznie — wybierz, jak kontynuować.
    </p>
    <div className="flex items-center gap-2">
      <button
        type="button"
        data-testid="conflict-load-server"
        onClick={onLoadServerVersion}
        className="inline-flex items-center gap-1.5 rounded-md border border-c-border bg-c-surface-raised px-3 py-1.5 text-xs font-semibold text-c-text hover:bg-c-border-subtle"
      >
        <RefreshCw size={13} /> Wczytaj wersję serwera
      </button>
      <button type="button" onClick={onExit} className="rounded-md border border-c-border px-3 py-1.5 text-xs text-c-text-secondary hover:bg-c-surface-raised">
        Wyjdź bez zmian
      </button>
    </div>
  </div>
);

const RecoveryQueueView: React.FC<{
  state: DrdHttpRuntimeState;
  onApplyPending: () => void;
  onDiscardPending: () => void;
}> = ({ state, onApplyPending, onDiscardPending }) => (
  <div data-testid="drd-http-recovery-view" role="alert" className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
    <div className="flex items-center gap-2">
      <DrdSourceIndicator source="RECOVERY_DRAFT" title="Zmiany zapisane lokalnie, jeszcze nie potwierdzone przez serwer." />
      {/* Status here is always 'recovery' with pendingWriteCount > 0 by
          construction (this view only renders for `state.status === 'recovery'`),
          so RECOVERY_DRAFT is exactly what `deriveAssessmentSaveIndicator`
          would compute — fixed here rather than re-derived. */}
      <AssessmentSaveStateIndicator state="RECOVERY_DRAFT" />
    </div>
    <CloudOff size={28} className="text-c-warning" />
    <h2 className="text-sm font-semibold text-c-text">Połączenie wróciło — {state.pendingWriteCount} zaległych zmian czeka</h2>
    <p className="max-w-md text-xs text-c-text-secondary">
      Te zmiany zostały zapisane lokalnie, kiedy nie było połączenia z serwerem. Wybierz jawnie: zastosować je na serwerze, czy je odrzucić
      i wczytać bieżący stan serwera. Nic nie dzieje się automatycznie.
    </p>
    <div className="flex items-center gap-2">
      <button
        type="button"
        data-testid="recovery-apply-pending"
        onClick={onApplyPending}
        className="inline-flex items-center gap-1.5 rounded-md border border-c-border bg-c-surface-raised px-3 py-1.5 text-xs font-semibold text-c-text hover:bg-c-border-subtle"
      >
        <RefreshCw size={13} /> Zastosuj zaległe zmiany ({state.pendingWriteCount})
      </button>
      <button
        type="button"
        data-testid="recovery-discard-pending"
        onClick={onDiscardPending}
        className="rounded-md border border-c-border px-3 py-1.5 text-xs text-c-text-secondary hover:bg-c-surface-raised"
      >
        Odrzuć lokalne, wgraj serwer
      </button>
    </div>
  </div>
);

const OfflineBanner: React.FC<{ onRetry: () => void }> = ({ onRetry }) => (
  <div data-testid="drd-http-offline-banner" role="alert" className="flex items-center gap-3 border-b border-c-warning/30 bg-c-warning/10 px-4 py-1.5 text-[11px] text-c-warning">
    <CloudOff size={13} className="shrink-0" />
    <span>Brak połączenia z serwerem — zapisy są kolejkowane lokalnie i nigdy nie znikają, ale to NIE jest potwierdzony stan serwera.</span>
    <button type="button" onClick={onRetry} className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-md border border-c-warning/40 px-2 py-0.5 font-semibold hover:bg-c-warning/20">
      <RefreshCw size={11} /> Spróbuj połączyć ponownie
    </button>
  </div>
);

const ErrorRetryView: React.FC<{ message: string; onRetry: () => void; onExit: () => void }> = ({ message, onRetry, onExit }) => (
  <div data-testid="drd-http-error-view" role="alert" className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
    <DrdSourceIndicator source="RECOVERY_DRAFT" />
    <AlertTriangle size={24} className="text-c-danger" />
    <p className="max-w-md text-xs text-c-danger">{message}</p>
    <div className="flex items-center gap-2">
      <button type="button" data-testid="error-retry" onClick={onRetry} className="inline-flex items-center gap-1.5 rounded-md border border-c-border bg-c-surface-raised px-3 py-1.5 text-xs font-semibold text-c-text hover:bg-c-border-subtle">
        <RefreshCw size={13} /> Spróbuj ponownie
      </button>
      <button type="button" onClick={onExit} className="rounded-md border border-c-border px-3 py-1.5 text-xs text-c-text-secondary hover:bg-c-surface-raised">
        Wyjdź
      </button>
    </div>
  </div>
);

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const DrdHttpMethodWorkspaceScreen: React.FC<HttpScreenProps & { forceState?: DrdHttpDebugForcedState }> = ({
  storage: storageProp,
  demoSessionId,
  onExit,
  seedTo,
  initialViewMode,
  forceState,
}) => {
  const storage = storageProp ?? window.localStorage;
  const runtimeRef = useRef<DrdHttpSessionRuntime | null>(null);
  // React 18 StrictMode (dev only) double-invokes effects: mount -> cleanup
  // -> mount again, on the SAME component instance (hooks/refs persist).
  // Without these guards this effect would call `create()` twice (two real
  // sessions over HTTP) and replay `seedHttpSession`'s writes twice on
  // whichever runtime "won". Refs survive the synthetic remount, so the
  // second invocation reuses the first's in-flight promise / already-applied
  // seeding instead of repeating the side effect.
  const bootPromiseRef = useRef<Promise<DrdHttpSessionRuntime> | null>(null);
  const seedStartedRef = useRef(false);
  const forceStateAppliedRef = useRef(false);
  const [state, setState] = useState<DrdHttpRuntimeState | null>(null);
  const [bootError, setBootError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<MethodWorkspaceViewMode>(initialViewMode ?? 'interview');
  const [mode, setMode] = useState<'guided_manual' | 'teresa_led'>('guided_manual');
  const [activeAxisId, setActiveAxisId] = useState<number>(DRD_STRUCTURE[0].id);
  const [activeUnitId, setActiveUnitId] = useState<string>(DRD_STRUCTURE[0].areas[0].id);
  const [matrixSelection, setMatrixSelection] = useState<{ unitId: string; level: number } | null>(null);
  const [draftAnswerText, setDraftAnswerText] = useState<Record<string, string>>({});
  // True for the duration of an explicit reconciliation call (refresh() from
  // the offline banner / ErrorRetryView, or the Conflict/Recovery views'
  // "load server" / "apply pending" / "discard pending" actions) — feeds
  // `useAssessmentSaveIndicator`'s RECONNECTING/RECOVERED transient labels.
  // Never set by anything automatic; only by the explicit handlers below.
  const [isReconciling, setIsReconciling] = useState(false);
  const runReconciliation = useCallback(async (action: () => Promise<unknown>) => {
    setIsReconciling(true);
    try {
      await action();
    } finally {
      setIsReconciling(false);
    }
  }, []);

  // -- bootstrap: resume (demoSessionId) or create --------------------------
  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | null = null;

    async function boot() {
      if (!bootPromiseRef.current) {
        bootPromiseRef.current = demoSessionId
          ? Promise.resolve(new DrdHttpSessionRuntime(demoSessionId, storage))
          : DrdHttpSessionRuntime.create(
              {
                module: 'assessment',
                methodPackId: DRD_METHOD_PACK_ID,
                methodPackVersion: pack.manifest.version,
                mode: 'guided_manual',
                demoBypass: true,
              },
              storage
            );
      }
      let runtime: DrdHttpSessionRuntime;
      try {
        runtime = await bootPromiseRef.current;
      } catch (err) {
        if (!cancelled) setBootError(err instanceof Error ? err.message : 'Nie udało się utworzyć sesji.');
        return;
      }
      if (cancelled) return;
      runtimeRef.current = runtime;
      unsubscribe = runtime.onChange((next) => {
        if (!cancelled) setState(next);
      });
      setState(runtime.getState());

      if (demoSessionId) await runtime.refresh();
      if (seedTo && !seedStartedRef.current) {
        seedStartedRef.current = true;
        try {
          await seedHttpSession(runtime, seedTo);
        } catch {
          // Honest stop: seeding hit a real server refusal (e.g. missing
          // approver role — see this file's header). The screen shows
          // whatever state the runtime landed in, never a faked one.
        }
      }
      if (forceState && runtimeRef.current && !forceStateAppliedRef.current) {
        forceStateAppliedRef.current = true;
        const debugPatch: Partial<DrdHttpRuntimeState> =
          forceState === 'offline'
            ? { status: 'offline', error: 'Brak połączenia z serwerem.' }
            : forceState === 'conflict'
              ? { status: 'conflict', serverVersion: (runtimeRef.current.getState().session?.version ?? 1) + 1, error: 'Sesja zmieniła się na serwerze.' }
              : forceState === 'recovery'
                ? { status: 'recovery', pendingWriteCount: 2 }
                : { status: 'loading' };
        runtimeRef.current.debugForceState(debugPatch);
      }
    }
    void boot();
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runtime = runtimeRef.current;

  const events = state?.events ?? [];
  const pendingPreviews = state?.previews ?? [];
  const pendingPreviewUnitLevels = useMemo(() => {
    const set = new Set<string>();
    for (const p of pendingPreviews) {
      if (p.intent.unitId && typeof p.intent.level === 'number') set.add(`${p.intent.unitId}#${p.intent.level}`);
    }
    return set;
  }, [pendingPreviews]);

  const navigatorNodes = useMemo(() => buildNavigatorNodes(events), [events]);
  const activeAxis = DRD_STRUCTURE.find((a) => a.id === activeAxisId) ?? DRD_STRUCTURE[0];
  const matrixRows = useMemo(() => buildMatrixRowsForAxis(events, activeAxis, pendingPreviewUnitLevels), [events, activeAxis, pendingPreviewUnitLevels]);
  const matrixLevels = useMemo(() => {
    const first = activeAxis.areas[0];
    return first ? first.levels.map((l) => l.level).sort((a, b) => a - b) : [];
  }, [activeAxis]);

  const activeArea = activeAxis.areas.find((a) => a.id === activeUnitId) ?? activeAxis.areas[0];
  // Same rule as the legacy runtime: focus the first UNRESOLVED level (the
  // blocker), not always level 1 — otherwise the Interview Focus panel would
  // never advance past level 1 once it's confirmed, while the Matrix (which
  // reads the same events) correctly shows the real blocker level.
  const activeProgression = useMemo(
    () =>
      drdAdapter.resolveOpenLevels({
        unitId: activeArea.id,
        confirmedLevels: confirmedLevelsFor(events, activeArea.id),
        evidenceByLevel: {},
      }),
    [events, activeArea.id]
  );
  const focusLevelFallback = activeProgression.blockedAtLevel ?? Math.min(...activeArea.levels.map((l) => l.level));
  const focusQuestions = pack.questions.filter((q) => q.unitId === activeArea.id && q.level === focusLevelFallback);
  const evidenceCountForUnit = evidenceEventsFor(events, activeArea.id).length;
  const evidenceStrengthForUnit = evidenceStrengthFor(events, activeArea.id);

  const interviewQuestions: InterviewFocusQuestion[] = focusQuestions.map((q) => {
    const { state: answerState, text } = questionAnswerState(events, q.questionId);
    return {
      question: q,
      answerState,
      answerText: text,
      evidenceState: evidenceStateFor(events, activeArea.id, activeProgression.blockedAtLevel),
      evidenceCount: evidenceCountForUnit,
      evidenceStrength: evidenceStrengthForUnit,
    };
  });

  const isOnline = state?.status !== 'offline' && state?.status !== 'recovery';
  const canWrite = (state?.roles ?? []).some((role) =>
    ['owner', 'lead_assessor', 'assessor', 'respondent', 'evidence_owner'].includes(role)
  );

  const { state: saveState, lastSavedAt, errorMessage: saveErrorMessage, markDirty, saveNow } = useMethodWorkspaceSave({
    isOnline,
    debounceMs: 800,
    save: async () => {
      if (!runtime || !canWrite) return { ok: false, error: 'Sesja jest tylko do odczytu.' };
      const entry = Object.entries(draftAnswerText).find(([qid]) => focusQuestions.some((q) => q.questionId === qid));
      if (!entry) return { ok: true };
      const [questionId, text] = entry;
      try {
        await runtime.recordAnswer({ unitId: activeArea.id, level: focusLevelFallback, questionId, answerState: 'partial', text, draft: true });
        return { ok: true };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : 'Zapis nieudany.' };
      }
    },
  });

  // Single user-facing badge across the eight product states — a pure label
  // over `saveState` (kernel `MethodSaveState`, via `useMethodWorkspaceSave`
  // above) and the session runtime's connectivity status/pending-write queue.
  // See `useAssessmentSaveIndicator`'s header for the full mapping table.
  const { state: saveIndicatorState } = useAssessmentSaveIndicator({
    runtimeStatus: state?.status ?? 'loading',
    saveState,
    pendingWriteCount: state?.pendingWriteCount ?? 0,
    isReconciling,
  });

  const handleAnswerChange = useCallback((questionId: string, text: string) => {
    setDraftAnswerText((prev) => ({ ...prev, [questionId]: text }));
    markDirty();
  }, [markDirty]);

  const handleAnswerStateChange = useCallback(
    async (questionId: string, answerState: InterviewFocusQuestion['answerState'], justification?: string) => {
      if (!answerState || !runtime || !canWrite) return;
      await runtime.recordAnswer({
        unitId: activeArea.id,
        level: focusLevelFallback,
        questionId,
        answerState,
        text: draftAnswerText[questionId],
        justification,
      });
    },
    [runtime, canWrite, activeArea.id, focusLevelFallback, draftAnswerText]
  );

  const handleEvidenceDrop = useCallback(
    async (questionId: string, files: FileList) => {
      const file = files[0];
      if (!file || !runtime || !canWrite) return;
      await runtime.recordEvidence({
        unitId: activeArea.id,
        level: focusLevelFallback,
        evidenceId: `${questionId}:${file.name}:${Date.now()}`,
        evidenceType: 'document',
        strength: 'E2',
        linkedQuestionIds: [questionId],
      });
    },
    [runtime, canWrite, activeArea.id, focusLevelFallback]
  );

  const handleAskTeresa = useCallback(
    async (questionId: string) => {
      if (!runtime || !canWrite) return;
      const evidence = evidenceEventsFor(events, activeArea.id);
      await runtime.createTeresaPreview({
        capabilityId: 'draft_score_proposal',
        unitId: activeArea.id,
        level: focusLevelFallback,
        questionId,
        invokedBy: 'local_action',
        statements: [
          evidence.length > 0
            ? { kind: 'confirmed_fact' as const, text: `Zebrano ${evidence.length} dowód/-ody dla tej jednostki.`, sourceRefs: evidence.map((e) => e.id) }
            : { kind: 'missing_evidence' as const, text: 'Brak dowodu dla tej jednostki na tym poziomie.', sourceRefs: [] },
          { kind: 'proposal' as const, text: `Proponowany poziom: ${focusLevelFallback} na podstawie odpowiedzi respondenta.`, sourceRefs: [] },
        ],
        proposedChanges: [{ target: 'score_proposal', targetId: activeArea.id, before: null, after: focusLevelFallback }],
        quality: { verdict: evidence.length > 0 ? 'valid' : 'needs_human_review', failedChecks: evidence.length > 0 ? [] : ['lists_supporting_evidence'] },
      });
    },
    [runtime, canWrite, events, activeArea.id, focusLevelFallback]
  );

  const handleCommit = useCallback(
    async (request: TeresaCommitRequest) => {
      if (!runtime || !canWrite) return;
      const outcome = await runtime.commitTeresaPreview({ previewId: request.previewId, decision: request.decision, editedChanges: request.editedChanges });
      if (outcome.ok && (request.decision === 'accept' || request.decision === 'accept_with_edits')) {
        const preview = pendingPreviews.find((p) => p.previewId === request.previewId);
        const change = preview?.proposedChanges.find((c) => c.target === 'score_proposal');
        if (preview && change && typeof change.after === 'number') {
          await runtime.recordAnswer({
            unitId: preview.intent.unitId ?? activeArea.id,
            level: change.after,
            questionId: preview.intent.questionId ?? `${activeArea.id}-L${change.after}-Q1`,
            answerState: 'confirmed',
            text: 'Potwierdzone po akceptacji propozycji Teresy (decyzja człowieka).',
          });
        }
      }
    },
    [runtime, canWrite, pendingPreviews, activeArea.id]
  );

  const readiness: MethodReadiness = useMemo(() => {
    const totalUnits = pack.units.length;
    let answeredUnits = 0;
    let unitsMissingEvidence = 0;
    let answeredUnitsMissingEvidence = 0;
    for (const unit of pack.units) {
      const confirmed = events.filter((e) => e.type === 'ANSWER_CONFIRMED' && e.unitId === unit.unitId);
      const hasEvidence = evidenceEventsFor(events, unit.unitId).length > 0;
      if (confirmed.length > 0) answeredUnits++;
      if (!hasEvidence) unitsMissingEvidence++;
      if (confirmed.length > 0 && !hasEvidence) answeredUnitsMissingEvidence++;
    }
    const freezeBlockers: string[] = [];
    if (answeredUnits === 0) freezeBlockers.push('Brak potwierdzonych jednostek — wywiad nie został jeszcze rozpoczęty.');
    if (answeredUnitsMissingEvidence > 0) freezeBlockers.push(`${answeredUnitsMissingEvidence} odpowiedzianych jednostek bez dowodu`);
    if (pendingPreviews.length > 0) freezeBlockers.push(`${pendingPreviews.length} propozycji Teresy oczekuje decyzji`);
    const frozenAlready = state?.session?.state === 'frozen' || state?.session?.state === 'closed';
    return {
      answeredUnits,
      totalUnits,
      unitsMissingEvidence,
      openDiscrepancies: 0,
      pendingProposals: pendingPreviews.length,
      freezeBlockers: frozenAlready ? [] : freezeBlockers,
    };
  }, [events, pendingPreviews.length, state?.session?.state]);

  const teresaSixQuestions = {
    whereAreWe: `Sesja DRD, jednostka ${activeArea.namePL || activeArea.name}, poziom ${focusLevelFallback}. ${readiness.answeredUnits}/${readiness.totalUnits} jednostek dotkniętych.`,
    whatMattersNow: focusQuestions[0]?.canonicalWording ?? 'Brak pytań na tym poziomie.',
    why: activeAxis.namePL ? `Oś „${activeAxis.namePL}" wymaga potwierdzenia tej jednostki, by odblokować dalsze poziomy.` : '',
    whatIsMissing: evidenceCountForUnit === 0 ? 'Brak dowodu dla tej jednostki.' : `${evidenceCountForUnit} dowód/-ody zebrane.`,
    nextSafeAction: pendingPreviews.length > 0 ? 'Zdecyduj o oczekujących propozycjach Teresy.' : 'Odpowiedz na bieżące pytanie lub dołącz dowód.',
  };

  // -- render: bootstrap phases (no runtime state yet, or a hard boot error) --
  if (bootError) {
    return (
      <ErrorRetryView
        message={`Nie udało się utworzyć sesji: ${bootError}`}
        onRetry={() => window.location.reload()}
        onExit={onExit ?? (() => {})}
      />
    );
  }
  if (!state) {
    return <BootstrapLoadingView label="Tworzenie sesji…" />;
  }

  // -- render: runtime-level states that pre-empt the shell -------------------
  if (state.status === 'loading' && !state.session) {
    return <BootstrapLoadingView label="Wczytywanie sesji z serwera…" />;
  }
  if (state.status === 'conflict') {
    return (
      <ConflictView
        state={state}
        onExit={onExit ?? (() => {})}
        onLoadServerVersion={() => void runReconciliation(() => runtime?.refresh() ?? Promise.resolve())}
      />
    );
  }
  if (state.status === 'recovery') {
    return (
      <RecoveryQueueView
        state={state}
        onApplyPending={() => void runReconciliation(() => runtime?.retryPending() ?? Promise.resolve())}
        onDiscardPending={() => void runReconciliation(() => runtime?.discardPendingAndReloadServer() ?? Promise.resolve())}
      />
    );
  }
  // Mounted production DRD is fail-closed: a cached session may help explain
  // what the user was viewing, but it is never an editable fallback when the
  // API is unavailable.
  if (state.status === 'offline') {
    return <ErrorRetryView message="Brak połączenia z serwerem. Tryb DRD jest tylko do odczytu po potwierdzeniu serwera; żadna zmiana nie została zapisana." onRetry={() => void runReconciliation(() => runtime?.refresh() ?? Promise.resolve())} onExit={onExit ?? (() => {})} />;
  }
  if (state.status === 'error' && !state.session) {
    return <ErrorRetryView message={state.error ?? 'Nieznany błąd.'} onRetry={() => void runReconciliation(() => runtime?.refresh() ?? Promise.resolve())} onExit={onExit ?? (() => {})} />;
  }

  const session = state.session;
  if (!session) {
    return <BootstrapLoadingView label="Wczytywanie sesji…" />;
  }

  // status is 'ready' (with a possibly-error-decorated retry still showing
  // the last known session), 'offline' (queued writes, still show the last
  // known session so work is never blocked), or a transient 'loading' with a
  // session already known (handled by the shell's own `loading` prop below).
  const sourceKind = state.status === 'ready' ? 'SERVER' : 'RECOVERY_DRAFT';

  if (session.state === 'frozen' || session.state === 'closed') {
    return (
      <FrozenOutputHttpView
        state={state}
        sourceKind={sourceKind}
        onGenerateReport={() =>
          canWrite
            ? runtime?.generateReport({
                title: 'Raport DRD',
                content: {
                  executiveSummary: 'Sesja DRD — wynik cząstkowy.',
                  participants: ['Piotr (Owner)', 'Anna (Approver)'],
                  strengths: ['Proces sprzedaży ma podstawową dokumentację.'],
                },
              })
            : undefined
        }
        onGenerateInitiative={() =>
          canWrite
            ? runtime?.generateInitiativeDraft({
                title: 'Domknij automatyzację procesu sprzedaży w CRM',
                findingIds: (state.output?.findings ?? []).map((f) => f.id),
                rationale: 'Znaleziska Outputu wskazują lukę między current a target.',
                expectedOutcome: 'Podniesienie poziomu dojrzałości.',
                confidence: 'medium',
              })
            : undefined
        }
        readOnly={!canWrite}
        onExit={onExit ?? (() => {})}
      />
    );
  }

  const canSendToReview = canWrite && session.state === 'active';
  const canSendBack = canWrite && session.state === 'in_review';
  const canFreeze = session.state === 'in_review' && state.roles.includes('approver');

  return (
    <div className="flex h-full flex-col">
      {state.status === 'error' && state.error && (
        <div role="alert" className="flex items-center gap-2 border-b border-c-danger/30 bg-c-danger/10 px-4 py-1.5 text-xs text-c-danger">
          <AlertTriangle size={12} />
          {state.error}
          <button type="button" onClick={() => void runReconciliation(() => runtime?.refresh() ?? Promise.resolve())} className="ml-auto rounded border border-c-danger/40 px-2 py-0.5 font-semibold hover:bg-c-danger/20">
            Spróbuj ponownie
          </button>
        </div>
      )}
      <div className="min-h-0 flex-1">
        <MethodWorkspaceShell
          session={session}
          methodName={pack.manifest.name}
          packVersionLabel={pack.manifest.version}
          readiness={readiness}
          mode={mode}
          onModeChange={setMode}
          onExit={onExit ?? (() => {})}
          saveState={saveState}
          saveLastSavedAt={lastSavedAt}
          saveErrorMessage={saveErrorMessage}
          onSaveNow={() => void saveNow()}
          onSaveRetry={() => void saveNow()}
          onSaveStay={() => {}}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          loading={state.status === 'loading' && Boolean(state.session)}
          readOnly={!canWrite}
          degradedMessage={
            session.state === 'active' ? null : `Status: ${session.state}`
          }
          navigatorProps={{
            nodes: navigatorNodes,
            activeUnitId: activeArea.id,
            onSelect: (unitId) => {
              const axis = DRD_STRUCTURE.find((a) => a.areas.some((ar) => ar.id === unitId));
              if (axis) setActiveAxisId(axis.id);
              setActiveUnitId(unitId);
            },
          }}
          interviewProps={{
            breadcrumb: [activeAxis.namePL || activeAxis.name, activeArea.namePL || activeArea.name, `Poziom ${focusLevelFallback}`],
            questions: interviewQuestions,
            questionIndex: focusLevelFallback - 1,
            questionTotal: activeArea.levels.length,
            resolutionData: {
              questionId: focusQuestions[0]?.questionId ?? '',
              whatIsUnknown: `Czy jednostka ${activeArea.id} spełnia kryteria poziomu ${focusLevelFallback}.`,
              likelyOwnerLabel: 'Właściciel procesu',
              resolvingArtifactHint: 'Dokument procedury lub zrzut z systemu.',
              dueDate: null,
              blocksFreeze: true,
            },
            onAnswerChange: handleAnswerChange,
            onAnswerStateChange: (qid, s, j) => void handleAnswerStateChange(qid, s, j),
            onResolutionAction: () => {},
            onEvidenceDrop: (qid, files) => void handleEvidenceDrop(qid, files),
            onBack: () => {},
            onSave: () => void saveNow(),
            onNext: () => {
              const idx = activeAxis.areas.findIndex((a) => a.id === activeArea.id);
              const next = activeAxis.areas[idx + 1];
              if (next) setActiveUnitId(next.id);
            },
            onSkip: () => {},
            onAskTeresa: (questionId) => void handleAskTeresa(questionId),
            canGoBack: true,
            canGoNext: true,
          }}
          teresaProps={{
            sixQuestions: teresaSixQuestions,
            proposalQueue: pendingPreviews,
            onCommit: (r) => void handleCommit(r),
            onTakeLead: () => setMode('teresa_led'),
            onLetMeWorkManually: () => setMode('guided_manual'),
            mode,
          }}
          matrixProps={{
            rows: matrixRows,
            levels: matrixLevels,
            selection: matrixSelection,
            onSelect: (sel) => {
              setMatrixSelection(sel);
              setActiveUnitId(sel.unitId);
            },
            onCloseSideSheet: () => setMatrixSelection(null),
            renderSideSheet: (selection, cell) => (
              <div className="text-xs text-c-text-secondary">
                <p>
                  {selection.unitId} · poziom {selection.level} —{' '}
                  {cell?.blocker ? 'BLOKER (pierwszy niespełniony poziom)' : cell?.reviewRequired ? 'above-gap: wymaga przeglądu' : cell?.achieved ? 'osiągnięty' : 'nieosiągnięty'}
                </p>
              </div>
            ),
          }}
          reportContent={(
            <div className="space-y-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-c-text-muted">DRD report · axis {activeAxis.id}</p>
                <h2 className="text-lg font-semibold text-c-text">{activeAxis.namePL || activeAxis.name}</h2>
                <p className="mt-1 max-w-3xl text-sm text-c-text-secondary">
                  Roboczy rozdział raportu oparty na bieżących odpowiedziach, dowodach i targetach tej samej sesji.
                  Nie jest zatwierdzonym raportem, dopóki sesja nie zostanie zamrożona przez approvera.
                </p>
              </div>
              <div className="rounded-xl border border-c-border bg-c-surface p-4">
                <h3 className="mb-3 text-sm font-semibold text-c-text">Macierz osi</h3>
                <LiveMatrix {...{
                  rows: matrixRows,
                  levels: matrixLevels,
                  selection: matrixSelection,
                  onSelect: (selection) => {
                    setMatrixSelection(selection);
                    setActiveUnitId(selection.unitId);
                  },
                  onCloseSideSheet: () => setMatrixSelection(null),
                  renderSideSheet: (selection, cell) => (
                    <div className="text-xs text-c-text-secondary">
                      <p>
                        {selection.unitId} · poziom {selection.level} —{' '}
                        {cell?.blocker ? 'BLOKER (pierwszy niespełniony poziom)' : cell?.reviewRequired ? 'above-gap: wymaga przeglądu' : cell?.achieved ? 'osiągnięty' : 'nieosiągnięty'}
                      </p>
                    </div>
                  ),
                }} methodName={pack.manifest.name} />
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {activeAxis.areas.map((area) => (
                  <article key={area.id} className="rounded-xl border border-c-border bg-c-surface p-4">
                    <p className="text-[11px] font-semibold text-c-text-muted">{area.id}</p>
                    <h3 className="text-sm font-semibold text-c-text">{area.namePL || area.name}</h3>
                    <p className="mt-2 text-xs text-c-text-secondary">
                      {confirmedLevelsFor(events, area.id).length > 0
                        ? `Potwierdzone poziomy: ${confirmedLevelsFor(events, area.id).join(', ')}. Wymaga komentarza eksperckiego przed zatwierdzeniem.`
                        : 'Brak potwierdzonej oceny — raport nie może udawać wniosku dla tego obszaru.'}
                    </p>
                  </article>
                ))}
              </div>
            </div>
          )}
          documentSourceLabel={sourceKind}
          documentSourceIndicator={<DrdSourceIndicator source={sourceKind} />}
          governanceActions={(
            <>
              <button
                type="button"
                onClick={() => void runtime?.transition('in_review').catch(() => undefined)}
                disabled={!canSendToReview}
                className="rounded-md border border-c-border px-2.5 py-1 font-medium text-c-text-secondary disabled:opacity-40 hover:bg-c-surface-raised"
              >
                Wyślij do przeglądu
              </button>
              <button
                type="button"
                onClick={() => void runtime?.transition('active').catch(() => undefined)}
                disabled={!canSendBack}
                className="rounded-md border border-c-border px-2.5 py-1 font-medium text-c-text-secondary disabled:opacity-40 hover:bg-c-surface-raised"
              >
                Odeślij do pracy
              </button>
              <button
                type="button"
                onClick={() => void runtime?.freeze()}
                disabled={!canFreeze}
                data-testid="freeze-button"
                className="inline-flex items-center gap-1.5 rounded-md border border-c-border bg-c-surface-raised px-2.5 py-1 font-semibold text-c-text disabled:opacity-40 hover:bg-c-border-subtle"
              >
                <Lock size={12} />
                Zamroź
              </button>
            </>
          )}
        />
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Post-freeze view: Output / Report / Initiative — HTTP-shaped records
// ---------------------------------------------------------------------------

const FrozenOutputHttpView: React.FC<{
  state: DrdHttpRuntimeState;
  sourceKind: 'SERVER' | 'RECOVERY_DRAFT';
  onGenerateReport: () => void;
  onGenerateInitiative: () => void;
  onExit: () => void;
  readOnly?: boolean;
}> = ({ state, sourceKind, onGenerateReport, onGenerateInitiative, onExit, readOnly = false }) => {
  const session = state.session!;
  const output = state.output;

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-c-bg p-6" data-testid="drd-http-frozen-output-view">
      <div className="mb-4 flex items-center gap-3">
        <button type="button" onClick={onExit} className="inline-flex items-center gap-1.5 rounded-lg border border-c-border px-2.5 py-1.5 text-xs text-c-text-secondary hover:bg-c-surface-raised">
          <ArrowLeft size={13} /> Wyjdź
        </button>
        <h1 className="text-sm font-semibold text-c-text">
          Sesja {session.id.slice(0, 8)} — {session.state === 'closed' ? 'Zamknięta' : 'Zamrożona'}
        </h1>
        {/* ★ Frozen Output must NEVER be labeled SERVER unless `output` is a
            confirmed server response for THIS session's current freeze —
            `state.output` is only ever set from `freeze()`'s own response or
            a `getOutput()` re-fetch (see drdHttpSessionRuntime.ts refresh()). */}
        <DrdSourceIndicator source={output ? sourceKind : 'RECOVERY_DRAFT'} title="Frozen Output pochodzi wyłącznie z odpowiedzi serwera, nigdy z localStorage." />
      </div>

      {/* Output */}
      <section data-testid="output-panel" className="mb-6 rounded-xl border border-c-border bg-c-surface p-4">
        <div className="mb-2 flex items-center gap-2">
          <Lock size={14} className="text-c-text-secondary" />
          <h2 className="text-sm font-semibold text-c-text">AssessmentOutput (immutable, v{output?.outputVersion ?? '—'})</h2>
        </div>
        {!output ? (
          <p className="text-xs text-c-text-muted">
            Sesja jest zamrożona na serwerze, ale nie udało się odnaleźć jej bieżącego Outputu. Odśwież widok;
            ekran nie odtworzy treści z lokalnego cache.
          </p>
        ) : (
          <div className="space-y-2 text-xs text-c-text-secondary">
            <p>contentHash: <code className="text-c-text-muted">{output.contentHash.slice(0, 16)}…</code></p>
            <p>scope: {output.scope}</p>
            <p>limitations: {output.limitations.join(' · ')}</p>
            <div className="rounded-lg border border-c-border-subtle">
              <StandardTable
                columns={OUTPUT_UNIT_COLUMNS}
                data={Object.keys(output.current).map((unitId) => ({
                  id: unitId,
                  unitId,
                  current: output.current[unitId] ?? '—',
                  target: output.target[unitId] ?? '—',
                  gap: output.gap[unitId] ?? '—',
                }))}
              />
            </div>
            <p className="pt-1 font-medium text-c-text">Findings ({output.findings.length})</p>
            {output.findings.map((f) => (
              <div key={f.id} className="rounded-lg border border-c-border-subtle p-2">
                <p className="text-c-text">{f.businessMeaning}</p>
                <p className="text-c-text-muted">Rekomendacja: {f.recommendation}</p>
                <p className="text-c-text-muted">Jednostka: {f.unitName} · current {f.currentLevel ?? '—'} · target {f.targetLevel ?? '—'} · gap {f.gap ?? '—'}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Report */}
      <section data-testid="report-panel" className="mb-6 rounded-xl border border-c-border bg-c-surface p-4">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText size={14} className="text-c-text-secondary" />
            <h2 className="text-sm font-semibold text-c-text">Report Snapshot</h2>
          </div>
          <button type="button" onClick={onGenerateReport} disabled={!output || readOnly} className="rounded-md border border-c-border px-2 py-1 text-[11px] font-medium text-c-text-secondary disabled:opacity-40 hover:bg-c-surface-raised">
            Generuj raport z Outputu
          </button>
        </div>
        {state.reports.length === 0 ? (
          <p className="text-xs text-c-text-muted">Brak zapisanego raportu dla tego Outputu.</p>
        ) : (
          state.reports.map((r, i) => {
            const rec = r as { id?: string; title?: string; content?: { executiveSummary?: string } };
            return (
              <div key={rec.id ?? i} className="mb-2 rounded-lg border border-c-border-subtle p-2 text-xs text-c-text-secondary">
                <p className="text-c-text">{rec.title}</p>
                <p>{rec.content?.executiveSummary}</p>
              </div>
            );
          })
        )}
      </section>

      {/* Initiative Draft */}
      <section data-testid="initiative-panel" className="mb-6 rounded-xl border border-c-border bg-c-surface p-4">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Lightbulb size={14} className="text-c-text-secondary" />
            <h2 className="text-sm font-semibold text-c-text">Initiative Proposal Draft (lokalny, NIE Registered Initiative)</h2>
          </div>
          <button type="button" onClick={onGenerateInitiative} disabled={!output || readOnly} className="rounded-md border border-c-border px-2 py-1 text-[11px] font-medium text-c-text-secondary disabled:opacity-40 hover:bg-c-surface-raised">
            Wygeneruj z findingów
          </button>
        </div>
        {state.initiatives.length === 0 ? (
          <p className="text-xs text-c-text-muted">Brak zapisanego Initiative Proposal Draft dla tego Outputu.</p>
        ) : (
          state.initiatives.map((d, i) => {
            const rec = d as { id?: string; title?: string; summary?: string | null; confidence?: string };
            return (
              <div key={rec.id ?? i} className="mb-2 rounded-lg border border-c-border-subtle p-2 text-xs">
                <p className="font-medium text-c-text">{rec.title}</p>
                <p className="text-c-text-secondary">{rec.summary}</p>
                <p className="text-c-text-muted">confidence: {rec.confidence}</p>
                <p className="mt-1 text-[10px] uppercase tracking-wide text-c-warning">Draft — decyzja „Register as Initiative" należy do człowieka, poza tym modułem.</p>
              </div>
            );
          })
        )}
      </section>

      {/* Reopen — no HTTP path yet */}
      <section data-testid="reopen-panel" className="rounded-xl border border-c-border bg-c-surface p-4">
        <div className="mb-2 flex items-center gap-2">
          <RotateCcw size={14} className="text-c-text-secondary" />
          <h2 className="text-sm font-semibold text-c-text">Reopen — nowa rewizja</h2>
        </div>
        <p className="mb-2 text-xs text-c-text-muted">
          Brak endpointu HTTP do reopen (poza zakresem tego pliku — server/src/method-core/*, server/src/routes/method-core.routes.ts).
          Akcja wyłączona jawnie, nie udawana.
        </p>
        <button type="button" disabled data-testid="reopen-button" className="rounded-md border border-c-border px-2.5 py-1.5 text-xs font-medium text-c-text-secondary opacity-40">
          Reopen sesji (niedostępne przez HTTP)
        </button>
      </section>
    </div>
  );
};

export default DrdHttpMethodWorkspaceScreen;
