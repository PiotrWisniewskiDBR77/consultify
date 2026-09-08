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
import { LiveMatrix } from '@/components/method-workspace/LiveMatrix';
import { DrdOwnerMatrixPanel } from '@/components/assessment/drd/DrdOwnerMatrixPanel';
import { useFeatureFlagsContext } from '@/contexts/FeatureFlagsContext';
import { StandardTable } from '@/components/standard/StandardTable';
import type {
  InterviewFocusQuestion,
  MethodWorkspaceViewMode,
  ResolutionAction,
} from '@/components/method-workspace/types';
import { useMethodWorkspaceSave } from '@/components/method-workspace/useMethodWorkspaceSave';
import { formatSkipJustification, type DrdSkipReasonCode } from '@/components/method-workspace/skipReasonCodes';
import type {
  AssessmentOutput,
  DeliverableRecord,
  InitiativeProposalDraft,
  ReportSnapshot,
} from '@/method-core/outputs';
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
import { useTranslation } from 'react-i18next';

import { nazwaWJezyku } from './drdNazwa';

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
  const { t, i18n } = useTranslation();
  const isPolish = (i18n.language || '').toLowerCase().startsWith('pl');
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
  const evidenceStrengthForUnit = evidenceStrengthFor(events, activeArea.id);

  const interviewQuestions: InterviewFocusQuestion[] = focusQuestions.map((q) => {
    const { state, text } = questionAnswerState(events, q.questionId);
    return {
      question: q,
      answerState: state,
      answerText: text,
      evidenceState: evidenceStateFor(events, activeArea.id, activeProgression.blockedAtLevel),
      evidenceCount: evidenceCountForUnit,
      evidenceStrength: evidenceStrengthForUnit,
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
    if (answeredUnits === 0)
      freezeBlockers.push(
        t(
          'assessment.drd.http.blockers.noConfirmedUnits',
          'No confirmed units — the interview has not started yet.'
        )
      );
    if (answeredUnitsMissingEvidence > 0)
      freezeBlockers.push(
        t('assessment.drd.http.blockers.unitsWithoutEvidence', '{{count}} answered units without evidence', {
          count: answeredUnitsMissingEvidence,
        })
      );
    if (pendingPreviews.length > 0)
      freezeBlockers.push(
        t('assessment.drd.http.blockers.pendingProposals', '{{count}} Teresa proposals awaiting a decision', {
          count: pendingPreviews.length,
        })
      );
    return {
      answeredUnits,
      totalUnits,
      unitsMissingEvidence,
      openDiscrepancies: 0,
      pendingProposals: pendingPreviews.length,
      freezeBlockers: session.state === 'frozen' || session.state === 'closed' ? [] : freezeBlockers,
    };
  }, [events, pendingPreviews.length, session.state]);

  const { state: saveState, lastSavedAt, errorMessage, markDirty, saveNow, acknowledgeFailure } = useMethodWorkspaceSave({
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
            ? {
                kind: 'confirmed_fact' as const,
                text: t(
                  'assessment.drd.legacy.evidenceCollected',
                  '{{count}} piece(s) of evidence collected for this unit.',
                  { count: evidence.length }
                ),
                sourceRefs: evidence.map((e) => e.id),
              }
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

  const handleUnitNav = useCallback(
    (direction: 1 | -1) => {
      const idx = activeAxis.areas.findIndex((a) => a.id === activeArea.id);
      const target = activeAxis.areas[idx + direction];
      if (target) setActiveUnitId(target.id);
    },
    [activeAxis.areas, activeArea.id]
  );

  const handleBack = useCallback(() => handleUnitNav(-1), [handleUnitNav]);

  // DEC-2026-08-25-55: skip requires one of the 4 dictionary codes (enforced
  // by InterviewFocusPanel's select) — recorded as a real `recordAnswer` call
  // (same event path as every other answer) so it is never a decorative
  // no-op, then the workspace advances like `onNext`.
  const handleSkip = useCallback(
    (reasonCode: DrdSkipReasonCode) => {
      const questionId = focusQuestions[0]?.questionId;
      if (questionId) {
        runtime.recordAnswer({
          unitId: activeArea.id,
          level: focusLevel,
          questionId,
          answerState: 'no_evidence',
          text: draftAnswerText[questionId],
          justification: formatSkipJustification(reasonCode),
          actorUserId,
        });
      }
      handleUnitNav(1);
      refresh();
    },
    [runtime, activeArea.id, focusLevel, focusQuestions, draftAnswerText, actorUserId, handleUnitNav, refresh]
  );

  // Only `ask_teresa` has a real backend today (Teresa preview pipeline,
  // already wired above). `request_evidence`/`return_later` are logged as a
  // real, persisted `recordAnswer` note on the SAME question (honest audit
  // trail, no new mechanism invented). `assign_question` has no per-question
  // assignee anywhere in the app — ResolutionCard renders it disabled
  // ("Planowane") instead of pretending it does something.
  const handleResolutionAction = useCallback(
    (questionId: string, action: ResolutionAction) => {
      if (action === 'ask_teresa') {
        handleAskTeresa(questionId);
        return;
      }
      if (action === 'assign_question') return;
      const note =
        action === 'request_evidence'
          ? t(
              'assessment.drd.http.resolution.requestEvidence',
              'Evidence requested from the process owner.'
            )
          : t(
              'assessment.drd.http.resolution.returnLater',
              'Deferred — come back to this question later.'
            );
      runtime.recordAnswer({
        unitId: activeArea.id,
        level: focusLevel,
        questionId,
        answerState: 'dont_know',
        text: draftAnswerText[questionId],
        justification: note,
        draft: true,
        actorUserId,
      });
      if (action === 'return_later') handleUnitNav(1);
      refresh();
    },
    [runtime, activeArea.id, focusLevel, draftAnswerText, actorUserId, handleAskTeresa, handleUnitNav, refresh]
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
              text: t(
                'assessment.drd.http.teresa.confirmedAfterAccept',
                'Confirmed after accepting Teresa’s proposal (a human decision).'
              ),
              actorUserId,
            });
          }
        }
      }
      refresh();
    },
    [runtime, actorUserId, activeArea.id, refresh]
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
    whereAreWe: t(
      'assessment.drd.http.teresa.whereAreWe',
      'DRD session, unit {{unit}}, level {{level}}. {{answered}}/{{total}} units touched.',
      {
        unit: nazwaWJezyku(activeArea.namePL, activeArea.name, isPolish),
        level: focusLevel,
        answered: readiness.answeredUnits,
        total: readiness.totalUnits,
      }
    ),
    whatMattersNow:
      focusQuestions[0]?.canonicalWording ??
      t('assessment.drd.http.teresa.noQuestions', 'No questions at this level.'),
    why: activeAxis.namePL
      ? t(
          'assessment.drd.http.teresa.why',
          'Axis “{{axis}}” needs this unit confirmed to unlock the next levels.',
          { axis: nazwaWJezyku(activeAxis.namePL, activeAxis.name, isPolish) }
        )
      : '',
    whatIsMissing:
      evidenceCountForUnit === 0
        ? t('assessment.drd.http.teresa.noEvidence', 'No evidence for this unit.')
        : t('assessment.drd.http.teresa.evidenceCollected', '{{count}} piece(s) of evidence collected.', {
            count: evidenceCountForUnit,
          }),
    nextSafeAction:
      pendingPreviews.length > 0
        ? t('assessment.drd.http.teresa.decidePending', 'Decide on Teresa’s pending proposals.')
        : t(
            'assessment.drd.http.teresa.answerOrAttach',
            'Answer the current question or attach evidence.'
          ),
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
            executiveSummary: t(
              'assessment.drd.http.generated.reportSummary',
              'DRD session — partial result.'
            ),
            participants: ['Piotr (Owner)', 'Anna (Approver)'],
            strengths: [
              t(
                'assessment.drd.http.generated.reportStrength',
                'The sales process has basic documentation.'
              ),
            ],
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
      {/* 1.1-Z4 D3 (d) — REGRESJA (checkpoint af75a84e37, 23.08): ta notatka
          i jej import zostały usunięte razem z bespoke actor-selectem i
          osobnym paskiem osi (oba słusznie superseded przez
          `MethodWorkspaceShell`'s Navigator/Settings), ale
          `DRD_DEMO_SESSION_NOTICE` poleciało w tym samym cięciu jako
          collateral damage — cichy bypass bramki gotowości (`canStartSession()
          === false` dla `methodology_review`) bez ostrzeżenia. Doc-comment
          `drdSessionRuntime.ts` jest wprost: "the UI is required to show
          that notice (never a silent override)". Przywrócone jako stały
          banner (nie warunkowy jak `lastRefusal`) — bypass obowiązuje przez
          całą sesję demonstracyjną, nie tylko przy błędzie. */}
      <div
        role="status"
        className="flex items-center gap-2 border-b border-c-warning/30 bg-c-warning/10 px-4 py-1.5 text-[11px] text-c-warning"
      >
        <AlertTriangle size={12} className="shrink-0" />
        <span>{DRD_DEMO_SESSION_NOTICE}</span>
      </div>
      {lastRefusal && (
        <div role="alert" className="flex items-center gap-2 border-b border-c-danger/30 bg-c-danger/10 px-4 py-1.5 text-xs text-c-danger">
          <AlertTriangle size={12} />
          {lastRefusal}
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
          saveErrorMessage={errorMessage}
          onSaveNow={() => void saveNow()}
          onSaveRetry={() => void saveNow()}
          onSaveStay={acknowledgeFailure}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          // 2026-08-26 night-fixes-a (NIGHT_SWEEP_A_REPORT_20260826.md #5,
          // ASM-OWN-013's "no unexplained global status legend" principle):
          // the `Status: ${session.state}` fallback duplicated the header's
          // own `statusLabel` pill (e.g. both showed "Szkic"/draft at once)
          // — MethodWorkspaceShell's header ALWAYS renders that pill, so a
          // second banner repeating the same fact added noise, not
          // information. The revision message stays: it says something the
          // header pill does NOT (which prior session this one supersedes).
          degradedMessage={
            session.revisionOfSessionId
              ? t(
                  'assessment.drd.legacy.revisionNotice',
                  'Revision of session {{id}} (created by a reopen — the previous Output stays untouched and is marked superseded after the next freeze).',
                  { id: session.revisionOfSessionId.slice(0, 8) }
                )
              : null
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
              whatIsUnknown: t(
                'assessment.drd.http.resolution.whatIsUnknown',
                'Whether unit {{unit}} meets the criteria of level {{level}}.',
                { unit: activeArea.id, level: focusLevel }
              ),
              likelyOwnerLabel: t('assessment.drd.http.resolution.likelyOwner', 'Process owner'),
              resolvingArtifactHint: t(
                'assessment.drd.http.resolution.artifactHint',
                'A procedure document or a screenshot from the system.'
              ),
              dueDate: null,
              blocksFreeze: true,
            },
            onAnswerChange: handleAnswerChange,
            onAnswerStateChange: handleAnswerStateChange,
            onResolutionAction: handleResolutionAction,
            onEvidenceDrop: handleEvidenceDrop,
            onBack: handleBack,
            onSave: () => void saveNow(),
            onNext: () => handleUnitNav(1),
            onSkip: handleSkip,
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
          // ★ MACIERZ WŁAŚCICIELA, NIE `LiveMatrix` (2026-09-05). Powód i dowód
          // pomiarowy w nagłówku `DrdOwnerMatrixPanel`. Selekcja, panel
          // szczegółów i Esc zostają te same — zmienia się rysunek, nie mechanika.
          matrixContent={
            <DrdOwnerMatrixPanel
              axisNumber={activeAxis.id}
              rows={matrixRows}
              selection={matrixSelection}
              onSelect={(sel) => {
                setMatrixSelection(sel);
                setActiveUnitId(sel.unitId);
              }}
              onCloseSideSheet={() => setMatrixSelection(null)}
              renderSideSheet={(selection, cell) => (
                <div className="text-xs text-c-text-secondary">
                  <p>
                    {selection.unitId} · poziom {selection.level} —{' '}
                    {cell?.blocker
                      ? t('assessment.drd.http.cell.blocker', 'BLOCKER (first unmet level)')
                      : cell?.reviewRequired
                        ? t('assessment.drd.http.cell.reviewRequired', 'above-gap: needs review')
                        : cell?.achieved
                          ? t('assessment.drd.http.cell.achieved', 'achieved')
                          : t('assessment.drd.http.cell.notAchieved', 'not achieved')}
                  </p>
                </div>
              )}
            />
          }
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
                  {cell?.blocker
                    ? t('assessment.drd.http.cell.blocker', 'BLOCKER (first unmet level)')
                    : cell?.reviewRequired
                      ? t(
                          'assessment.drd.legacy.cell.reviewRequiredLong',
                          'above-gap: confirmed out of order, needs review'
                        )
                      : cell?.achieved
                        ? t('assessment.drd.http.cell.achieved', 'achieved')
                        : t('assessment.drd.http.cell.notAchieved', 'not achieved')}
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
                  {t(
                    'assessment.drd.legacy.workingChapter',
                    'The working report chapter uses the same state of answers, evidence and targets as Interview and Matrix.'
                  )}
                </p>
              </div>
              <div className="rounded-xl border border-c-border bg-c-surface p-4">
                <h3 className="mb-3 text-sm font-semibold text-c-text">Macierz osi</h3>
                <LiveMatrix
                  rows={matrixRows}
                  levels={matrixLevels}
                  selection={matrixSelection}
                  onSelect={(selection) => {
                    setMatrixSelection(selection);
                    setActiveUnitId(selection.unitId);
                  }}
                  onCloseSideSheet={() => setMatrixSelection(null)}
                  renderSideSheet={(selection, cell) => (
                    <div className="text-xs text-c-text-secondary">
                      <p>
                        {selection.unitId} · poziom {selection.level} —{' '}
                        {cell?.blocker
                          ? t('assessment.drd.http.cell.blocker', 'BLOCKER (first unmet level)')
                          : cell?.reviewRequired
                            ? t('assessment.drd.http.cell.reviewRequired', 'above-gap: needs review')
                            : cell?.achieved
                              ? t('assessment.drd.http.cell.achieved', 'achieved')
                              : t('assessment.drd.http.cell.notAchieved', 'not achieved')}
                      </p>
                    </div>
                  )}
                  methodName={pack.manifest.name}
                />
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {activeAxis.areas.map((area) => (
                  <article key={area.id} className="rounded-xl border border-c-border bg-c-surface p-4">
                    <p className="text-[11px] font-semibold text-c-text-muted">{area.id}</p>
                    <h3 className="text-sm font-semibold text-c-text">{area.namePL || area.name}</h3>
                    <p className="mt-2 text-xs text-c-text-secondary">
                      {confirmedLevelsFor(events, area.id).length > 0
                        ? `Potwierdzone poziomy: ${confirmedLevelsFor(events, area.id).join(', ')}. Komentarz ekspercki pozostaje roboczy do zatwierdzenia.`
                        : t(
                            'assessment.drd.http.report.noConfirmedLevel',
                            'No confirmed assessment — the report must not pretend to draw a conclusion for this area.'
                          )}
                    </p>
                  </article>
                ))}
              </div>
            </div>
          )}
          documentSourceLabel="DEMO_LOCAL"
          documentSourceIndicator={<DrdSourceIndicator source="DEMO_LOCAL" />}
          settingsContent={(
            <label className="inline-flex items-center gap-2 font-medium text-c-text-secondary">
              Aktor testowy
              <select
                data-testid="actor-select"
                value={actorUserId}
                onChange={(event) => setActorUserId(event.target.value)}
                className="rounded border border-c-border bg-c-surface px-2 py-1 text-xs text-c-text"
              >
                <option value={OWNER_ACTOR}>Piotr (owner/lead assessor/assessor)</option>
                <option value={APPROVER_ACTOR}>Anna (approver)</option>
              </select>
            </label>
          )}
          governanceActions={(
            <>
              <button
                type="button"
                onClick={() => handleFreezeTransition('in_review')}
                disabled={session.state !== 'active'}
                className="rounded-md border border-c-border px-2.5 py-1 font-medium text-c-text-secondary disabled:opacity-40 hover:bg-c-surface-raised"
              >
                {t('assessment.drd.http.governance.sendToReview', 'Send for review')}
              </button>
              <button
                type="button"
                onClick={() => handleFreezeTransition('frozen')}
                disabled={session.state !== 'in_review'}
                data-testid="freeze-button"
                className="inline-flex items-center gap-1.5 rounded-md border border-c-border bg-c-surface-raised px-2.5 py-1 font-semibold text-c-text disabled:opacity-40 hover:bg-c-border-subtle"
              >
                <Lock size={12} />
                {t('assessment.drd.http.governance.freeze', 'Freeze')}
              </button>
            </>
          )}
        />
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
  const { t } = useTranslation();
  const output = outputRecord?.content ?? null;
  const currentReport = reports.find((r) => r.status === 'current')?.content ?? null;

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-c-bg p-6" data-testid="drd-frozen-output-view">
      <div className="mb-4 flex items-center gap-3">
        <button type="button" onClick={onExit} className="inline-flex items-center gap-1.5 rounded-lg border border-c-border px-2.5 py-1.5 text-xs text-c-text-secondary hover:bg-c-surface-raised">
          <ArrowLeft size={13} /> {t('assessment.drd.http.frozen.exit', 'Leave')}
        </button>
        <h1 className="text-sm font-semibold text-c-text">
          {t('assessment.drd.http.frozen.heading', 'Session {{id}} — {{state}}', {
            id: session.id.slice(0, 8),
            state:
              session.state === 'closed'
                ? t('assessment.drd.http.frozen.stateClosed', 'Closed')
                : t('assessment.drd.http.frozen.stateFrozen', 'Frozen'),
          })}
          {session.revisionOfSessionId && <span className="ml-2 text-[11px] font-normal text-c-text-muted">(rewizja sesji {session.revisionOfSessionId.slice(0, 8)})</span>}
        </h1>
        <DrdSourceIndicator
          source="DEMO_LOCAL"
          title={t(
            'assessment.drd.legacy.demoLocalTitle',
            'Legacy runtime — localStorage is the only store (flag drdHttpSourceOfTruthV1 = OFF).'
          )}
        />
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
          <p className="text-xs text-c-text-muted">
            {t('assessment.drd.legacy.frozen.noOutput', 'No Output.')}
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
                <p className="text-c-text-muted">
                  {t('assessment.drd.legacy.frozen.evidence', 'Evidence: {{list}}', {
                    list: f.supportingEvidence.map((e) => e.evidenceId).join(', '),
                  })}
                </p>
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
            {t('assessment.drd.http.frozen.generateReport', 'Generate a report from the Output')}
          </button>
        </div>
        {!currentReport ? (
          <p className="text-xs text-c-text-muted">
            {t('assessment.drd.legacy.frozen.noReport', 'No report has been generated.')}
          </p>
        ) : (
          <div className="space-y-1 text-xs text-c-text-secondary">
            <p className="text-c-text">{currentReport.executiveSummary}</p>
            <p>
              {t('assessment.drd.legacy.frozen.overallResult', 'Overall result: {{value}}', {
                value: currentReport.overallResult ?? '—',
              })}
            </p>
            <p>
              {t('assessment.drd.legacy.frozen.participants', 'Participants: {{list}}', {
                list: currentReport.participants.join(', '),
              })}
            </p>
            <p>
              {t('assessment.drd.legacy.frozen.recommendations', 'Recommendations: {{list}}', {
                list: currentReport.recommendations.join(' · ') || '—',
              })}
            </p>
            <p className="text-c-text-muted">
              {t(
                'assessment.drd.legacy.frozen.snapshotNote',
                'Rendered from the snapshot of Output v{{version}} — changing the session after the freeze will not change this report.',
                { version: currentReport.outputVersion }
              )}
            </p>
          </div>
        )}
      </section>

      {/* Initiative Draft */}
      <section data-testid="initiative-panel" className="mb-6 rounded-xl border border-c-border bg-c-surface p-4">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Lightbulb size={14} className="text-c-text-secondary" />
            <h2 className="text-sm font-semibold text-c-text">
              {t(
                'assessment.drd.http.frozen.initiativeDraftTitle',
                'Initiative Proposal Draft (local, NOT a Registered Initiative)'
              )}
            </h2>
          </div>
          <button type="button" onClick={onGenerateInitiative} className="rounded-md border border-c-border px-2 py-1 text-[11px] font-medium text-c-text-secondary hover:bg-c-surface-raised">
            {t('assessment.drd.http.frozen.generateInitiative', 'Generate from findings')}
          </button>
        </div>
        {initiatives.filter((i) => i.status === 'current').length === 0 ? (
          <p className="text-xs text-c-text-muted">
            {t('assessment.drd.legacy.frozen.noDrafts', 'No drafts.')}
          </p>
        ) : (
          initiatives
            .filter((i) => i.status === 'current')
            .map((rec) => (
              <div key={rec.content.id} className="mb-2 rounded-lg border border-c-border-subtle p-2 text-xs">
                <p className="font-medium text-c-text">{rec.content.title}</p>
                <p className="text-c-text-secondary">{rec.content.summary}</p>
                <p className="text-c-text-muted">Findings: {rec.content.findingIds.join(', ')} · confidence: {rec.content.confidence}</p>
                <p className="mt-1 text-[10px] uppercase tracking-wide text-c-warning">
                  {t(
                    'assessment.drd.http.frozen.draftNotice',
                    'Draft — the “Register as Initiative” decision belongs to a human, outside this module.'
                  )}
                </p>
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
          {t(
            'assessment.drd.legacy.frozen.reopenNote',
            'frozen → active creates a NEW session (a revision); this Output stays untouched and gets the “superseded” status after the next freeze.'
          )}
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
  const { isEnabled } = useFeatureFlagsContext();
  const httpSourceOfTruth = forceHttpSourceOfTruth ?? isEnabled('drdHttpSourceOfTruthV1');
  if (httpSourceOfTruth) {
    return <DrdHttpMethodWorkspaceScreen {...props} forceState={forceState} />;
  }
  return <DrdMethodWorkspaceScreenLegacy {...props} />;
};

export default DrdMethodWorkspaceScreen;
