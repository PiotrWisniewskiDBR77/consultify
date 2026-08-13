/**
 * DrdMethodWorkspaceScreen — A6 vertical slice: DRD wired into the shared
 * A5 `MethodWorkspaceShell`. Library → Session → Output → Report →
 * Initiative, end to end.
 *
 * ★ ZAKAZ WŁASNEJ POWŁOKI: this file mounts `MethodWorkspaceShell` — it does
 * NOT reimplement Menu/Navigator/Matrix/Teresa chrome. Everything below the
 * shell's props is DRD content (compileDrdPack + drdAdapter), everything
 * above is `DrdSessionRuntime` (see that file's header for exactly what is
 * real kernel-shared logic vs. browser-local persistence).
 *
 * Post-freeze (Output / Report / Initiative / Reopen) is NOT part of the
 * shell's contract (interview/matrix/teresa only cover the pre-freeze
 * lifecycle) — those four panels below are small, token-compliant, additive
 * views, not a second shell.
 */
import { AlertTriangle, ArrowLeft, FileText, Lightbulb, Lock, RotateCcw } from 'lucide-react';
import React, { useCallback, useMemo, useState } from 'react';

import { MethodWorkspaceShell } from '@/components/method-workspace/MethodWorkspaceShell';
import { MethodReportView } from '@/components/method-workspace/MethodReportView';
import { MethodPresentationView } from '@/components/method-workspace/MethodPresentationView';
import { buildPresentationBlocksFromOutput } from '@/method-core/outputs';
import { StandardTable } from '@/components/standard/StandardTable';
import type {
  InterviewFocusQuestion,
  MethodWorkspaceViewMode,
} from '@/components/method-workspace/types';
import { useMethodWorkspaceSave } from '@/components/method-workspace/useMethodWorkspaceSave';
import type {
  AssessmentOutput,
  DeliverableRecord,
  InitiativeProposalDraft,
  ReportSnapshot,
} from '@/method-core/outputs';
import { DRD_STRUCTURE } from '@/services/drdStructure';

import { useFeatureFlags } from '@/hooks/useFeatureFlags';
import {
  buildMatrixRowsForAxis,
  buildNavigatorNodes,
  confirmedLevelsFor,
  evidenceEventsFor,
  evidenceStateFor,
  OUTPUT_UNIT_COLUMNS,
  pack,
  questionAnswerState,
} from './drdWorkspaceViewModel';
import { DrdHttpMethodWorkspaceScreen } from './DrdHttpMethodWorkspaceScreen';
import { DrdSourceIndicator } from './DrdSourceIndicator';
import { drdAdapter } from '@/method-core/methods/drd/drdAdapter';
import {
  createDrdDemoSession,
  DRD_DEMO_SESSION_NOTICE,
  DrdSessionRuntime,
  listDemoSessionIds,
} from '@/method-core/methods/drd/drdSessionRuntime';
import type { MethodReadiness } from '@/method-core/contracts';

const OWNER_ACTOR = 'demo-owner-piotr';
const APPROVER_ACTOR = 'demo-approver-anna';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export interface DrdMethodWorkspaceScreenProps {
  /** Injectable for the dev-render harness / tests — defaults to window.localStorage. */
  storage?: Storage;
  /** Resume an existing demo session; omit to create a fresh one. */
  demoSessionId?: string;
  onExit?: () => void;
  /** Seed data straight to a given lifecycle stage — dev-render harness only. */
  seedTo?: 'interview' | 'matrix' | 'teresa' | 'approval' | 'frozen' | 'reopened';
  /** dev-render harness only — jump straight to a view mode for a screenshot. */
  initialViewMode?: MethodWorkspaceViewMode;
  /** dev-render harness only — preselect which demo identity is "logged in". */
  initialActorUserId?: string;
  /**
   * dev-render harness / tests ONLY — overrides the `drdHttpSourceOfTruthV1`
   * flag read for this instance. Real navigation always goes through the
   * flag (default OFF); this exists because the dev-render harness mounts
   * this screen directly (bypassing the app's FeatureFlagsProvider/router),
   * exactly like `seedTo`/`initialViewMode` above.
   */
  forceHttpSourceOfTruth?: boolean;
  /**
   * dev-render harness / tests ONLY, and only meaningful when the HTTP path
   * is active — synthetically overlays offline/conflict/recovery/loading so
   * the screenshot harness can reach those states deterministically without
   * a genuinely flaky network. See `DrdHttpSessionRuntime.debugForceState`.
   */
  forceState?: 'offline' | 'conflict' | 'recovery' | 'loading';
}

function seedSession(runtime: DrdSessionRuntime, seedTo: DrdMethodWorkspaceScreenProps['seedTo']) {
  runtime.assignRole(OWNER_ACTOR, 'owner');
  runtime.assignRole(OWNER_ACTOR, 'lead_assessor');
  runtime.assignRole(OWNER_ACTOR, 'assessor');
  runtime.assignRole(APPROVER_ACTOR, 'approver');
  runtime.transition('prepared', OWNER_ACTOR);
  runtime.transition('active', OWNER_ACTOR);
  if (!seedTo) return;

  const area1A = DRD_STRUCTURE[0].areas[0];
  runtime.recordAnswer({
    unitId: area1A.id,
    level: 1,
    questionId: `${area1A.id}-L1-Q1`,
    answerState: 'confirmed',
    text: 'Mamy podstawowy, spisany proces sprzedaży współdzielony w zespole.',
    actorUserId: OWNER_ACTOR,
  });
  runtime.recordEvidence({
    unitId: area1A.id,
    level: 1,
    evidenceId: 'demo-ev-1a-l1',
    evidenceType: 'document',
    strength: 'E2',
    actorUserId: OWNER_ACTOR,
  });
  runtime.recordAnswer({
    unitId: area1A.id,
    level: 2,
    questionId: `${area1A.id}-L2-Q1`,
    answerState: 'confirmed',
    text: 'Proces jest częściowo zautomatyzowany w CRM.',
    actorUserId: OWNER_ACTOR,
  });
  runtime.recordEvidence({
    unitId: area1A.id,
    level: 2,
    evidenceId: 'demo-ev-1a-l2',
    evidenceType: 'system_record',
    strength: 'E3',
    actorUserId: OWNER_ACTOR,
  });
  runtime.recordTargetDecision({ unitId: area1A.id, level: 4, rationale: 'Cel ustalony z zarządem na ten rok.', actorUserId: OWNER_ACTOR });

  if (seedTo === 'interview') return;

  // aboveGap demo: 1B confirmed at level 4 while level 1 was never confirmed —
  // drdAdapter must report blockedAtLevel=1, aboveGapLevels=[4], currentLevel=null.
  const area1B = DRD_STRUCTURE[0].areas[1];
  runtime.recordAnswer({
    unitId: area1B.id,
    level: 4,
    questionId: `${area1B.id}-L4-Q1`,
    answerState: 'confirmed',
    text: 'Zaawansowana praktyka zaobserwowana punktowo (poza kolejnością).',
    actorUserId: OWNER_ACTOR,
  });
  runtime.recordEvidence({ unitId: area1B.id, level: 4, evidenceId: 'demo-ev-1b-l4', evidenceType: 'observation', strength: 'E1', actorUserId: OWNER_ACTOR });

  if (seedTo === 'matrix') return;

  if (seedTo === 'teresa' || seedTo === 'approval' || seedTo === 'frozen' || seedTo === 'reopened') {
    runtime.createTeresaPreview({
      intent: { capabilityId: 'draft_score_proposal', sessionId: runtime.sessionId, unitId: area1A.id, level: 3, invokedBy: 'local_action', actorUserId: OWNER_ACTOR },
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
    runtime.transition('in_review', OWNER_ACTOR);
  }

  if (seedTo === 'frozen' || seedTo === 'reopened') {
    runtime.transition('frozen', APPROVER_ACTOR);
    runtime.generateReport({
      executiveSummary: 'Sesja demonstracyjna DRD — wynik cząstkowy dla osi 1 (Procesy Cyfrowe).',
      participants: ['Piotr (Owner)', 'Anna (Approver)'],
      strengths: ['Proces sprzedaży ma podstawową dokumentację i częściową automatyzację w CRM.'],
      appendices: [],
      actorUserId: OWNER_ACTOR,
    });
    runtime.generateInitiativeDraft({ actorUserId: OWNER_ACTOR });
  }

  if (seedTo === 'reopened') {
    return runtime.reopen(OWNER_ACTOR);
  }
  return runtime;
}

/**
 * Legacy (pre-P0C) localStorage-backed implementation — UNCHANGED behavior.
 * Rendered whenever `drdHttpSourceOfTruthV1` is OFF (the default). See the
 * flag-gate default export at the bottom of this file.
 */
const DrdMethodWorkspaceScreenLegacy: React.FC<DrdMethodWorkspaceScreenProps> = ({
  storage: storageProp,
  demoSessionId,
  onExit,
  seedTo,
  initialViewMode,
  initialActorUserId,
}) => {
  const storage = storageProp ?? window.localStorage;
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((t) => t + 1), []);

  const [runtime] = useState<DrdSessionRuntime>(() => {
    if (demoSessionId && listDemoSessionIds(storage).includes(demoSessionId)) {
      return new DrdSessionRuntime(demoSessionId, storage);
    }
    const created = createDrdDemoSession({ organizationId: 'org-demo', projectId: 'project-demo', ownerUserId: OWNER_ACTOR, storage });
    const result = seedSession(created, seedTo);
    return result ?? created;
  });

  const [actorUserId, setActorUserId] = useState(initialActorUserId ?? OWNER_ACTOR);
  const [mode, setMode] = useState<'guided_manual' | 'teresa_led'>('guided_manual');
  const [viewMode, setViewMode] = useState<MethodWorkspaceViewMode>(initialViewMode ?? 'interview');
  const [activeAxisId, setActiveAxisId] = useState<number>(DRD_STRUCTURE[0].id);
  const [activeUnitId, setActiveUnitId] = useState<string>(DRD_STRUCTURE[0].areas[0].id);
  const [matrixSelection, setMatrixSelection] = useState<{ unitId: string; level: number } | null>(null);
  const [lastRefusal, setLastRefusal] = useState<string | null>(null);

  // tick is read here purely to force this memo to recompute after a runtime mutation.
  void tick;
  const session = runtime.getSession();
  const events = runtime.listEvents();
  const pendingPreviews = runtime.listPendingTeresaPreviews();
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
  const activeProgression = useMemo(
    () => drdAdapter.resolveOpenLevels({ unitId: activeArea.id, confirmedLevels: confirmedLevelsFor(events, activeArea.id), evidenceByLevel: {} }),
    [events, activeArea.id]
  );
  const focusLevel = activeProgression.blockedAtLevel ?? Math.min(...activeArea.levels.map((l) => l.level));
  const focusQuestions = pack.questions.filter((q) => q.unitId === activeArea.id && q.level === focusLevel);
  const evidenceCountForUnit = evidenceEventsFor(events, activeArea.id).length;

  const interviewQuestions: InterviewFocusQuestion[] = focusQuestions.map((q) => {
    const { state, text } = questionAnswerState(events, q.questionId);
    return {
      question: q,
      answerState: state,
      answerText: text,
      evidenceState: evidenceStateFor(events, activeArea.id, activeProgression.blockedAtLevel),
      evidenceCount: evidenceCountForUnit,
    };
  });

  const readiness: MethodReadiness = useMemo(() => {
    const totalUnits = pack.units.length;
    let answeredUnits = 0;
    // Feeds the shell's bottom-bar "Evidence: N/Total" (N = totalUnits -
    // unitsMissingEvidence) — counted across ALL units, not just answered
    // ones, so an untouched unit honestly reads as "missing", never as
    // silently "covered".
    let unitsMissingEvidence = 0;
    // Narrower: answered but no evidence at all — a real freeze-blocking
    // quality problem, distinct from "not started yet".
    let answeredUnitsMissingEvidence = 0;
    for (const unit of pack.units) {
      const confirmed = confirmedLevelsFor(events, unit.unitId);
      const hasEvidence = evidenceEventsFor(events, unit.unitId).length > 0;
      if (confirmed.length > 0) answeredUnits++;
      if (!hasEvidence) unitsMissingEvidence++;
      if (confirmed.length > 0 && !hasEvidence) answeredUnitsMissingEvidence++;
    }
    const freezeBlockers: string[] = [];
    if (answeredUnits === 0) freezeBlockers.push('Brak potwierdzonych jednostek — wywiad nie został jeszcze rozpoczęty.');
    if (answeredUnitsMissingEvidence > 0) freezeBlockers.push(`${answeredUnitsMissingEvidence} odpowiedzianych jednostek bez dowodu`);
    if (pendingPreviews.length > 0) freezeBlockers.push(`${pendingPreviews.length} propozycji Teresy oczekuje decyzji`);
    return {
      answeredUnits,
      totalUnits,
      unitsMissingEvidence,
      openDiscrepancies: 0,
      pendingProposals: pendingPreviews.length,
      freezeBlockers: session.state === 'frozen' || session.state === 'closed' ? [] : freezeBlockers,
    };
  }, [events, pendingPreviews.length, session.state]);

  const { state: saveState, lastSavedAt, errorMessage, markDirty, saveNow } = useMethodWorkspaceSave({
    save: async () => ({ ok: true }),
    debounceMs: 800,
  });

  const [draftAnswerText, setDraftAnswerText] = useState<Record<string, string>>({});

  const handleAnswerChange = useCallback((questionId: string, text: string) => {
    setDraftAnswerText((prev) => ({ ...prev, [questionId]: text }));
    markDirty();
  }, [markDirty]);

  const handleAnswerStateChange = useCallback(
    (questionId: string, state: InterviewFocusQuestion['answerState'], justification?: string) => {
      if (!state) return;
      runtime.recordAnswer({
        unitId: activeArea.id,
        level: focusLevel,
        questionId,
        answerState: state,
        text: draftAnswerText[questionId],
        justification,
        actorUserId,
      });
      refresh();
    },
    [runtime, activeArea.id, focusLevel, draftAnswerText, actorUserId, refresh]
  );

  const handleEvidenceDrop = useCallback(
    (questionId: string, files: FileList) => {
      const file = files[0];
      if (!file) return;
      runtime.recordEvidence({
        unitId: activeArea.id,
        level: focusLevel,
        evidenceId: `${questionId}:${file.name}:${Date.now()}`,
        evidenceType: 'document',
        strength: 'E2',
        actorUserId,
        linkedQuestionIds: [questionId],
      });
      refresh();
    },
    [runtime, activeArea.id, focusLevel, actorUserId, refresh]
  );

  const handleAskTeresa = useCallback(
    (questionId: string) => {
      const evidence = evidenceEventsFor(events, activeArea.id);
      runtime.createTeresaPreview({
        intent: {
          capabilityId: 'draft_score_proposal',
          sessionId: runtime.sessionId,
          unitId: activeArea.id,
          level: focusLevel,
          questionId,
          invokedBy: 'local_action',
          actorUserId,
        },
        statements: [
          evidence.length > 0
            ? { kind: 'confirmed_fact' as const, text: `Zebrano ${evidence.length} dowód/-ody dla tej jednostki.`, sourceRefs: evidence.map((e) => e.id) }
            : { kind: 'missing_evidence' as const, text: 'Brak dowodu dla tej jednostki na tym poziomie.', sourceRefs: [] },
          { kind: 'proposal' as const, text: `Proponowany poziom: ${focusLevel} na podstawie odpowiedzi respondenta.`, sourceRefs: [] },
        ],
        proposedChanges: [{ target: 'score_proposal', targetId: activeArea.id, before: activeProgression.currentLevel, after: focusLevel }],
        quality: { verdict: evidence.length > 0 ? 'valid' : 'needs_human_review', failedChecks: evidence.length > 0 ? [] : ['lists_supporting_evidence'] },
      });
      refresh();
    },
    [runtime, events, activeArea.id, focusLevel, actorUserId, activeProgression.currentLevel, refresh]
  );

  const handleCommit = useCallback(
    (request: Parameters<typeof runtime.commitTeresaPreview>[0]) => {
      const result = runtime.commitTeresaPreview(request);
      if (!result.ok) {
        setLastRefusal(`Teresa commit odrzucony: ${result.refusal.kind}`);
      } else {
        setLastRefusal(null);
        if (request.decision === 'accept' || request.decision === 'accept_with_edits') {
          const preview = runtime.getTeresaPreview(request.previewId);
          const change = preview?.proposedChanges.find((c) => c.target === 'score_proposal');
          if (preview && change && typeof change.after === 'number') {
            runtime.recordAnswer({
              unitId: preview.intent.unitId ?? activeArea.id,
              level: change.after,
              questionId: preview.intent.questionId ?? `${activeArea.id}-L${change.after}-Q1`,
              answerState: 'confirmed',
              text: 'Potwierdzone po akceptacji propozycji Teresy (decyzja człowieka).',
              actorUserId,
            });
          }
        }
      }
      refresh();
    },
    [runtime, actorUserId, activeArea.id, refresh]
  );

  // A10/D1 — czy AKTOR ma role 'approver'. Zrodlem prawdy jest runtime
  // (te same role, ktore egzekwuje TRANSITION_AUTHORITY), nie zgadywanie po nazwie.
  const actorIsApprover = React.useMemo(
    () => runtime.getRoles(actorUserId).includes('approver'),
    [runtime, actorUserId, events]
  );

  const handleFreezeTransition = useCallback(
    (to: 'prepared' | 'active' | 'in_review' | 'frozen') => {
      const result = runtime.transition(to, actorUserId);
      if (!result.ok) {
        setLastRefusal(
          result.refusal.kind === 'missing_permission'
            ? `Odrzucono: wymagana rola „${result.refusal.requiredRole}" (aktor: ${actorUserId}).`
            : `Odrzucono: ${result.refusal.kind}`
        );
      } else {
        setLastRefusal(null);
      }
      refresh();
    },
    [runtime, actorUserId, refresh]
  );

  const outputRecord = runtime.currentOutputRecord();
  const reports = runtime.listReports();
  const initiatives = runtime.listInitiativeDrafts();

  const teresaSixQuestions = {
    whereAreWe: `Sesja DRD, jednostka ${activeArea.namePL || activeArea.name}, poziom ${focusLevel}. ${readiness.answeredUnits}/${readiness.totalUnits} jednostek dotkniętych.`,
    whatMattersNow: focusQuestions[0]?.canonicalWording ?? 'Brak pytań na tym poziomie.',
    why: activeAxis.namePL ? `Oś „${activeAxis.namePL}" wymaga potwierdzenia tej jednostki, by odblokować dalsze poziomy.` : '',
    whatIsMissing: evidenceCountForUnit === 0 ? 'Brak dowodu dla tej jednostki.' : `${evidenceCountForUnit} dowód/-ody zebrane.`,
    nextSafeAction: pendingPreviews.length > 0 ? 'Zdecyduj o oczekujących propozycjach Teresy.' : 'Odpowiedz na bieżące pytanie lub dołącz dowód.',
  };

  if (session.state === 'frozen' || session.state === 'closed') {
    return (
      <FrozenOutputView
        session={session}
        outputRecord={outputRecord}
        reports={reports}
        initiatives={initiatives}
        actorUserId={actorUserId}
        setActorUserId={setActorUserId}
        lastRefusal={lastRefusal}
        onGenerateReport={() => {
          runtime.generateReport({
            executiveSummary: 'Sesja demonstracyjna DRD — wynik cząstkowy.',
            participants: ['Piotr (Owner)', 'Anna (Approver)'],
            strengths: ['Proces sprzedaży ma podstawową dokumentację.'],
            appendices: [],
            actorUserId,
          });
          refresh();
        }}
        onGenerateInitiative={() => {
          runtime.generateInitiativeDraft({ actorUserId });
          refresh();
        }}
        onReopen={() => {
          const result = runtime.transition('active', actorUserId);
          if (!result.ok) {
            setLastRefusal(
              result.refusal.kind === 'missing_permission'
                ? `Reopen odrzucony: wymagana rola „${result.refusal.requiredRole}".`
                : `Reopen odrzucony: ${result.refusal.kind}`
            );
            return;
          }
          runtime.reopen(actorUserId);
          refresh();
        }}
        onExit={onExit ?? (() => {})}
      />
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-c-border-subtle bg-c-warning/5 px-4 py-1.5 text-[11px] text-c-text-secondary">
        <AlertTriangle size={12} className="shrink-0 text-c-warning" />
        <span>{DRD_DEMO_SESSION_NOTICE}</span>
        <DrdSourceIndicator source="DEMO_LOCAL" title="Stary runtime — localStorage jest jedynym magazynem (flaga drdHttpSourceOfTruthV1 = OFF)." />
        <span className="ml-auto flex items-center gap-2 shrink-0">
          Aktor:
          <select
            data-testid="actor-select"
            value={actorUserId}
            onChange={(e) => setActorUserId(e.target.value)}
            className="rounded border border-c-border bg-c-surface px-1.5 py-0.5 text-[11px] text-c-text"
          >
            <option value={OWNER_ACTOR}>Piotr (owner/lead_assessor/assessor)</option>
            <option value={APPROVER_ACTOR}>Anna (approver)</option>
          </select>
        </span>
      </div>
      {lastRefusal && (
        <div role="alert" className="flex items-center gap-2 border-b border-c-danger/30 bg-c-danger/10 px-4 py-1.5 text-xs text-c-danger">
          <AlertTriangle size={12} />
          {lastRefusal}
        </div>
      )}
      <div className="flex items-center gap-2 border-b border-c-border-subtle px-4 py-1.5 text-[11px]">
        <span className="font-medium text-c-text-secondary">Oś:</span>
        {DRD_STRUCTURE.map((axis) => (
          <button
            key={axis.id}
            type="button"
            data-testid={`axis-tab-${axis.id}`}
            onClick={() => {
              setActiveAxisId(axis.id);
              setActiveUnitId(axis.areas[0].id);
            }}
            className={`rounded-md px-2 py-1 font-medium ${axis.id === activeAxisId ? 'bg-c-surface-raised text-c-text' : 'text-c-text-muted hover:text-c-text'}`}
          >
            {axis.id}. {axis.namePL || axis.name} ({axis.levelCount}L)
          </button>
        ))}
      </div>
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
          saveErrorMessage={errorMessage}
          onSaveNow={() => void saveNow()}
          onSaveRetry={() => void saveNow()}
          onSaveStay={() => {}}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          degradedMessage={
            session.revisionOfSessionId
              ? `Rewizja sesji ${session.revisionOfSessionId.slice(0, 8)} (utworzona przez reopen — poprzedni Output pozostaje nietknięty, oznaczony jako superseded po ponownym freeze).`
              : session.state === 'active'
                ? null
                : `Status: ${session.state}`
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
            breadcrumb: [activeAxis.namePL || activeAxis.name, activeArea.namePL || activeArea.name, `Poziom ${focusLevel}`],
            questions: interviewQuestions,
            questionIndex: focusLevel - 1,
            questionTotal: activeArea.levels.length,
            resolutionData: {
              questionId: focusQuestions[0]?.questionId ?? '',
              whatIsUnknown: `Czy jednostka ${activeArea.id} spełnia kryteria poziomu ${focusLevel}.`,
              likelyOwnerLabel: 'Właściciel procesu',
              resolvingArtifactHint: 'Dokument procedury lub zrzut z systemu.',
              dueDate: null,
              blocksFreeze: true,
            },
            onAnswerChange: handleAnswerChange,
            onAnswerStateChange: handleAnswerStateChange,
            onResolutionAction: () => {},
            // ★ A10/D3: ten ekran nie obsluguje zadnej akcji karty
            // rozstrzygniecia, wiec nie pokazuje ani jednego przycisku.
            // Martwy przycisk jest gorszy niz jego brak.
            resolutionActions: [],
            onEvidenceDrop: handleEvidenceDrop,
            onBack: () => {},
            onSave: () => void saveNow(),
            onNext: () => {
              const idx = activeAxis.areas.findIndex((a) => a.id === activeArea.id);
              const next = activeAxis.areas[idx + 1];
              if (next) setActiveUnitId(next.id);
            },
            onSkip: () => {},
            onAskTeresa: (questionId) => handleAskTeresa(questionId),
            canGoBack: true,
            canGoNext: true,
          }}
          teresaProps={{
            sixQuestions: teresaSixQuestions,
            proposalQueue: pendingPreviews,
            onCommit: handleCommit,
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
                  {cell?.blocker ? 'BLOKER (pierwszy niespełniony poziom)' : cell?.reviewRequired ? 'above-gap: potwierdzone poza kolejnością, wymaga przeglądu' : cell?.achieved ? 'osiągnięty' : 'nieosiągnięty'}
                </p>
              </div>
            ),
          }}
        />
      </div>
      <div className="flex shrink-0 items-center gap-2 border-t border-c-border-subtle px-4 py-2 text-xs">
        <button
          type="button"
          onClick={() => handleFreezeTransition('in_review')}
          disabled={session.state !== 'active'}
          className="rounded-md border border-c-border px-2.5 py-1 font-medium text-c-text-secondary disabled:opacity-40 hover:bg-c-surface-raised"
        >
          Wyślij do przeglądu
        </button>
        {/*
          A10/D1 — przycisk MUSI sprawdzać rolę aktora, nie tylko stan sesji.
          Wcześniej `disabled` patrzyło wyłącznie na `session.state`, więc etykieta
          obiecywała „tylko approver", a przycisk był aktywny także dla ownera —
          runtime odrzucał dopiero PO kliknięciu. UI nie może oferować akcji,
          która zawsze zakończy się odmową (`TRANSITION_AUTHORITY.frozen = ['approver']`).
        */}
        <button
          type="button"
          onClick={() => handleFreezeTransition('frozen')}
          disabled={session.state !== 'in_review' || !actorIsApprover}
          data-testid="freeze-button"
          title={
            !actorIsApprover
              ? `Zamrożenie wymaga roli „approver" — aktor ${actorUserId} jej nie ma.`
              : session.state !== 'in_review'
                ? 'Sesja musi być w stanie „in_review".'
                : undefined
          }
          className="inline-flex items-center gap-1.5 rounded-md border border-c-border bg-c-surface-raised px-2.5 py-1 font-semibold text-c-text disabled:opacity-40 hover:bg-c-border-subtle"
        >
          <Lock size={12} />
          Zamroź (tylko approver)
        </button>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Post-freeze views: Output / Report / Initiative / Reopen
// ---------------------------------------------------------------------------

const FrozenOutputView: React.FC<{
  session: ReturnType<DrdSessionRuntime['getSession']>;
  outputRecord: DeliverableRecord<AssessmentOutput> | null;
  reports: DeliverableRecord<ReportSnapshot>[];
  initiatives: DeliverableRecord<InitiativeProposalDraft>[];
  actorUserId: string;
  setActorUserId: (id: string) => void;
  lastRefusal: string | null;
  onGenerateReport: () => void;
  onGenerateInitiative: () => void;
  onReopen: () => void;
  onExit: () => void;
}> = ({ session, outputRecord, reports, initiatives, actorUserId, setActorUserId, lastRefusal, onGenerateReport, onGenerateInitiative, onReopen, onExit }) => {
  const output = outputRecord?.content ?? null;
  const currentReport = reports.find((r) => r.status === 'current')?.content ?? null;
  // Nazwy jednostek podaje warstwa DRD — `buildPresentationBlocksFromOutput`
  // jest metodyko-agnostyczny i nie zna struktury DRD.
  const drdUnitNames = React.useMemo(() => {
    const map: Record<string, string> = {};
    for (const axis of DRD_STRUCTURE) {
      for (const area of axis.areas) map[area.id] = area.namePL || area.name;
    }
    return map;
  }, []);
  const presentationBlocks = React.useMemo(
    () => (output ? buildPresentationBlocksFromOutput(output, { unitNames: drdUnitNames }) : []),
    [output, drdUnitNames]
  );

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-c-bg p-6" data-testid="drd-frozen-output-view">
      <div className="mb-4 flex items-center gap-3">
        <button type="button" onClick={onExit} className="inline-flex items-center gap-1.5 rounded-lg border border-c-border px-2.5 py-1.5 text-xs text-c-text-secondary hover:bg-c-surface-raised">
          <ArrowLeft size={13} /> Wyjdź
        </button>
        <h1 className="text-sm font-semibold text-c-text">
          Sesja {session.id.slice(0, 8)} — {session.state === 'closed' ? 'Zamknięta' : 'Zamrożona'}
          {session.revisionOfSessionId && <span className="ml-2 text-[11px] font-normal text-c-text-muted">(rewizja sesji {session.revisionOfSessionId.slice(0, 8)})</span>}
        </h1>
        <DrdSourceIndicator source="DEMO_LOCAL" title="Stary runtime — localStorage jest jedynym magazynem (flaga drdHttpSourceOfTruthV1 = OFF)." />
        <span className="ml-auto flex items-center gap-2 text-[11px] text-c-text-secondary">
          Aktor:
          <select value={actorUserId} onChange={(e) => setActorUserId(e.target.value)} className="rounded border border-c-border bg-c-surface px-1.5 py-0.5">
            <option value={OWNER_ACTOR}>Piotr (owner)</option>
            <option value={APPROVER_ACTOR}>Anna (approver)</option>
          </select>
        </span>
      </div>

      {lastRefusal && (
        <div role="alert" className="mb-4 flex items-center gap-2 rounded-lg border border-c-danger/30 bg-c-danger/10 px-3 py-2 text-xs text-c-danger">
          <AlertTriangle size={13} />
          {lastRefusal}
        </div>
      )}

      {/* Output */}
      <section data-testid="output-panel" className="mb-6 rounded-xl border border-c-border bg-c-surface p-4">
        <div className="mb-2 flex items-center gap-2">
          <Lock size={14} className="text-c-text-secondary" />
          <h2 className="text-sm font-semibold text-c-text">AssessmentOutput (immutable, v{output?.version ?? '—'})</h2>
        </div>
        {!output ? (
          <p className="text-xs text-c-text-muted">Brak Outputu.</p>
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
                <p className="text-c-text-muted">Dowody: {f.supportingEvidence.map((e) => e.evidenceId).join(', ')}</p>
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
          <button type="button" onClick={onGenerateReport} className="rounded-md border border-c-border px-2 py-1 text-[11px] font-medium text-c-text-secondary hover:bg-c-surface-raised">
            Generuj raport z Outputu
          </button>
        </div>
        {!currentReport ? (
          <p className="text-xs text-c-text-muted">Brak wygenerowanego raportu.</p>
        ) : (
          <>
            {/*
              ★ Do 2026-08-13 renderowały się tu cztery gołe <p> z tekstem, a
              gotowy, przetestowany `MethodReportView` był OSIEROCONY — zero
              callerów produkcyjnych, tylko barrel i testy. Niezależny audyt MPQ
              wycenił to, co widział klient, na 13/30 przy progu 29, podczas gdy
              nieużywany komponent dostawał 27-30/30. Klient oglądał panel
              debugowy zamiast dokumentu.
            */}
            <MethodReportView
              report={currentReport}
              findings={output?.findings ?? []}
              methodName="DRD"
            />
            <p className="mt-2 text-[11px] text-c-text-muted">
              Renderowane ze snapshotu Outputu v{currentReport.outputVersion} — zmiana sesji po freeze nie zmieni tego raportu.
            </p>
          </>
        )}
      </section>

      {/*
        Presentation — ★ ta sekcja NIE ISTNIAŁA w produkcji do 2026-08-13.
        Niezależny audyt MPQ zapisał ją jako NOT_IMPLEMENTED: ani ekranu, ani
        sekcji, ani linku. `MethodPresentationView` był gotowy i oceniony na
        30/30, ale osierocony. Bloki wyprowadza `buildPresentationBlocksFromOutput`
        — treść slajdów to słowa findingów, nic nie jest tu dopisywane.
      */}
      <section data-testid="presentation-panel" className="mb-6 rounded-xl border border-c-border bg-c-surface p-4">
        <div className="mb-2 flex items-center gap-2">
          <FileText size={14} className="text-c-text-secondary" />
          <h2 className="text-sm font-semibold text-c-text">Prezentacja dla klienta</h2>
        </div>
        {presentationBlocks.length === 0 ? (
          <p className="text-xs text-c-text-muted">
            Brak zatwierdzonych wniosków — prezentacja dla klienta powstaje wyłącznie
            z treści zaakceptowanej.
          </p>
        ) : (
          <MethodPresentationView blocks={presentationBlocks} methodName="DRD" />
        )}
      </section>

      {/* Initiative Draft */}
      <section data-testid="initiative-panel" className="mb-6 rounded-xl border border-c-border bg-c-surface p-4">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Lightbulb size={14} className="text-c-text-secondary" />
            <h2 className="text-sm font-semibold text-c-text">Initiative Proposal Draft (lokalny, NIE Registered Initiative)</h2>
          </div>
          <button type="button" onClick={onGenerateInitiative} className="rounded-md border border-c-border px-2 py-1 text-[11px] font-medium text-c-text-secondary hover:bg-c-surface-raised">
            Wygeneruj z findingów
          </button>
        </div>
        {initiatives.filter((i) => i.status === 'current').length === 0 ? (
          <p className="text-xs text-c-text-muted">Brak draftów.</p>
        ) : (
          initiatives
            .filter((i) => i.status === 'current')
            .map((rec) => (
              <div key={rec.content.id} className="mb-2 rounded-lg border border-c-border-subtle p-2 text-xs">
                <p className="font-medium text-c-text">{rec.content.title}</p>
                <p className="text-c-text-secondary">{rec.content.summary}</p>
                <p className="text-c-text-muted">Findings: {rec.content.findingIds.join(', ')} · confidence: {rec.content.confidence}</p>
                <p className="mt-1 text-[10px] uppercase tracking-wide text-c-warning">Draft — decyzja „Register as Initiative" należy do człowieka, poza tym modułem.</p>
              </div>
            ))
        )}
      </section>

      {/* Reopen */}
      <section data-testid="reopen-panel" className="rounded-xl border border-c-border bg-c-surface p-4">
        <div className="mb-2 flex items-center gap-2">
          <RotateCcw size={14} className="text-c-text-secondary" />
          <h2 className="text-sm font-semibold text-c-text">Reopen — nowa rewizja</h2>
        </div>
        <p className="mb-2 text-xs text-c-text-muted">
          frozen → active tworzy NOWĄ sesję (rewizję); ten Output pozostaje nietknięty i po ponownym freeze dostanie status „superseded".
        </p>
        <button
          type="button"
          onClick={onReopen}
          data-testid="reopen-button"
          className="rounded-md border border-c-border px-2.5 py-1.5 text-xs font-medium text-c-text-secondary hover:bg-c-surface-raised"
        >
          Reopen sesji (nowa rewizja)
        </button>
      </section>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Flag gate — `drdHttpSourceOfTruthV1` (P0C, 2026-08-13)
// ---------------------------------------------------------------------------
//
// OFF (default): renders `DrdMethodWorkspaceScreenLegacy` unchanged — zero
// change to today's behavior, zero HTTP calls made by this screen.
// ON: renders `DrdHttpMethodWorkspaceScreen` — `DrdHttpSessionRuntime` (HTTP)
// becomes the ONLY source of truth; localStorage is cache/recovery-draft
// only (see that file's header and CLAUDE.md rule #7/#9 — visual surfaces
// only change behind a default-OFF flag, one at a time, after an accepted
// dev-render screenshot).
export const DrdMethodWorkspaceScreen: React.FC<DrdMethodWorkspaceScreenProps> = ({
  forceHttpSourceOfTruth,
  forceState,
  ...props
}) => {
  const { isEnabled } = useFeatureFlags();
  const httpSourceOfTruth = forceHttpSourceOfTruth ?? isEnabled('drdHttpSourceOfTruthV1');
  if (httpSourceOfTruth) {
    return <DrdHttpMethodWorkspaceScreen {...props} forceState={forceState} />;
  }
  return <DrdMethodWorkspaceScreenLegacy {...props} />;
};

export default DrdMethodWorkspaceScreen;
