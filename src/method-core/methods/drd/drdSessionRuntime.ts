/**
 * DRD vertical-slice session runtime (A6, 2026-08-13).
 *
 * ★ WHAT THIS IS AND IS NOT — read before trusting a screenshot:
 * This is a BROWSER-LOCAL (localStorage-backed) implementation of the same
 * kernel rules that live server-side in `server/src/method-core/` — it
 * imports the REAL, frozen kernel contracts (`canTransition`,
 * `TRANSITION_AUTHORITY`, `METHOD_EVENT_TYPES`) and the REAL client-side
 * Outputs factories (`createAssessmentOutput`, `buildReportSnapshot`,
 * `createInitiativeProposalDraft`, `markRecordSuperseded` — all pure,
 * deep-frozen, immutable) from `src/method-core/outputs/`. It does NOT talk
 * HTTP to `server/src/method-core/*Service` — that server-side mechanism is
 * proven independently by
 * `server/src/method-core/outputs/__tests__/EventDerivedOutputBridge.test.ts`
 * (real `MethodSessionService` + `MethodEventStore` + `MethodOutputService`,
 * real Postgres-shaped mock DB). Wiring THIS runtime to that HTTP layer is
 * explicitly NOT done in this slice — see the final report's NOT VERIFIED
 * list. Reusing the exact same pure kernel logic in both places (rather than
 * inventing a third, UI-only state machine) is what keeps this an honest
 * proof of the mechanism rather than a mocked-looking demo.
 *
 * ★ DEMO BYPASS OF PACK READINESS: `compileDrdPack().pack.manifest.readiness`
 * is `'methodology_review'`, so `canStartSession()` is `false` — see
 * `compileDrdPack.ts`'s `readinessRationale`. This runtime explicitly
 * bypasses that gate to let a demo session exist (`DRD_DEMO_SESSION_NOTICE`
 * below), and the UI is required to show that notice (never a silent
 * override) — see `DrdMethodWorkspaceScreen`'s `degradedMessage`. The pack's
 * `readiness` field itself is never touched.
 */

import {
  canTransition,
  METHOD_PROCESS_ROLES,
  TRANSITION_AUTHORITY,
  type MethodActorKind,
  type MethodEvent,
  type MethodEventType,
  type MethodProcessRole,
  type MethodSession,
  type MethodSessionState,
  type TeresaCommitRequest,
  type TeresaCommitResult,
  type TeresaIntent,
  type TeresaPreview,
  type TeresaProposedChange,
  type TeresaQualityVerdict,
  type TeresaStatement,
  type TransitionResult,
} from '@/method-core/contracts';
import {
  createAssessmentOutput,
  createInitiativeProposalDraft,
  deepFreeze,
  groupFindingsForInitiativeDrafts,
  buildReportSnapshot,
  markRecordSuperseded,
  wrapAsCurrent,
  type AssessmentOutput,
  type DeliverableRecord,
  type EvidenceLocator,
  type Finding,
  type InitiativeProposalDraft,
  type ReportSnapshot,
} from '@/method-core/outputs';

import { compileDrdPack, DRD_METHOD_PACK_ID } from './compileDrdPack';
import { DRD_STRUCTURE } from '@/services/drdStructure';

/**
 * `unitId -> nazwa`. ★ Findingi trafiają wprost do raportu i prezentacji dla
 * klienta, więc `unitName: unitId` (czyli „1A") było widoczne na slajdzie.
 * Zasada projektu: dane demo to twarz produktu.
 */
const DRD_UNIT_NAMES: Readonly<Record<string, string>> = Object.freeze(
  Object.fromEntries(
    DRD_STRUCTURE.flatMap((axis) => axis.areas.map((area) => [area.id, area.namePL || area.name]))
  )
);
const unitLabel = (unitId: string): string => DRD_UNIT_NAMES[unitId] ?? unitId;

/** Polska odmiana: „1 dowód", „2 dowody", „5 dowodów". */
function dowodyLabel(n: number): string {
  if (n === 1) return '1 dowód';
  const l2 = n % 100;
  const l = n % 10;
  return l >= 2 && l <= 4 && (l2 < 10 || l2 >= 20) ? `${n} dowody` : `${n} dowodów`;
}

export const DRD_DEMO_SESSION_NOTICE =
  'Metodyka DRD jest w statusie „w przeglądzie" (methodology_review) — canStartSession() ' +
  'zwraca false. To jest SESJA DEMONSTRACYJNA (vertical slice), nie produkcyjny start metody; ' +
  'ten runtime jawnie omija bramkę gotowości packa wyłącznie do celów pokazu mechanizmu.';

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

function storagePrefix(sessionId: string): string {
  return `drd-method-workspace:${sessionId}`;
}

const INDEX_KEY = 'drd-method-workspace:index';

interface PreviewRecord {
  readonly preview: TeresaPreview;
  consumedAt: string | null;
  consumedBy: string | null;
}

interface RuntimeState {
  session: MethodSession;
  events: MethodEvent[];
  roles: Record<string, MethodProcessRole[]>;
  previews: PreviewRecord[];
  outputs: DeliverableRecord<AssessmentOutput>[];
  reports: DeliverableRecord<ReportSnapshot>[];
  initiatives: DeliverableRecord<InitiativeProposalDraft>[];
}

function readStorage(storage: Storage, sessionId: string): RuntimeState | null {
  const raw = storage.getItem(storagePrefix(sessionId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as RuntimeState;
  } catch {
    return null;
  }
}

function writeStorage(storage: Storage, sessionId: string, state: RuntimeState): void {
  storage.setItem(storagePrefix(sessionId), JSON.stringify(state));
  const indexRaw = storage.getItem(INDEX_KEY);
  const index: string[] = indexRaw ? JSON.parse(indexRaw) : [];
  if (!index.includes(sessionId)) {
    index.push(sessionId);
    storage.setItem(INDEX_KEY, JSON.stringify(index));
  }
}

export function listDemoSessionIds(storage: Storage = window.localStorage): string[] {
  const raw = storage.getItem(INDEX_KEY);
  return raw ? (JSON.parse(raw) as string[]) : [];
}

function genId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

// ---------------------------------------------------------------------------
// Creation
// ---------------------------------------------------------------------------

export interface CreateDrdDemoSessionInput {
  readonly organizationId: string;
  readonly projectId: string | null;
  readonly ownerUserId: string;
  readonly mode?: MethodSession['mode'];
  readonly storage?: Storage;
  /** Set when this session is produced by reopening a frozen one. */
  readonly revisionOfSessionId?: string | null;
}

export function createDrdDemoSession(input: CreateDrdDemoSessionInput): DrdSessionRuntime {
  const { pack } = compileDrdPack();
  const storage = input.storage ?? window.localStorage;
  const now = nowIso();
  const session: MethodSession = {
    id: genId(),
    organizationId: input.organizationId,
    projectId: input.projectId,
    module: 'assessment',
    methodPackId: DRD_METHOD_PACK_ID,
    methodPackVersion: pack.manifest.version,
    state: 'draft',
    domainStage: null,
    mode: input.mode ?? 'guided_manual',
    ownerUserId: input.ownerUserId,
    createdAt: now,
    updatedAt: now,
    version: 1,
    frozenSnapshotId: null,
    revisionOfSessionId: input.revisionOfSessionId ?? null,
  };
  const state: RuntimeState = {
    session,
    events: [],
    roles: {},
    previews: [],
    outputs: [],
    reports: [],
    initiatives: [],
  };
  writeStorage(storage, session.id, state);
  return new DrdSessionRuntime(session.id, storage);
}

// ---------------------------------------------------------------------------
// Runtime
// ---------------------------------------------------------------------------

export interface RecordAnswerInput {
  readonly unitId: string;
  readonly level: number;
  readonly questionId: string;
  readonly answerState: 'confirmed' | 'partial' | 'no' | 'dont_know' | 'no_evidence' | 'not_applicable';
  readonly text?: string;
  readonly justification?: string;
  readonly actorUserId: string;
  readonly draft?: boolean;
}

export interface RecordEvidenceInput {
  readonly unitId: string;
  readonly level?: number;
  readonly evidenceId: string;
  readonly evidenceType: EvidenceLocator['evidenceType'];
  readonly strength: EvidenceLocator['strength'];
  readonly actorUserId: string;
  readonly linkedQuestionIds?: readonly string[];
}

export interface RecordTargetDecisionInput {
  readonly unitId: string;
  readonly level: number;
  readonly rationale: string;
  readonly actorUserId: string;
}

/**
 * A LOCAL, PER-BROWSER instance. Every method re-reads from `storage` first
 * and writes back immediately — nothing is cached across calls in JS memory
 * — so a fresh `new DrdSessionRuntime(sessionId, storage)` after a real page
 * reload sees EXACTLY what the previous instance last wrote. This is the
 * mechanism the "reload restores state" test/screenshot relies on.
 */
export class DrdSessionRuntime {
  constructor(
    public readonly sessionId: string,
    private readonly storage: Storage = window.localStorage
  ) {}

  private read(): RuntimeState {
    const state = readStorage(this.storage, this.sessionId);
    if (!state) throw new Error(`drd-session-runtime: no stored session ${this.sessionId}`);
    // ★ Object.freeze does NOT survive a JSON.stringify/parse round trip —
    // `readStorage` above just deserialized plain, unfrozen objects. The
    // pure factories (createAssessmentOutput etc.) deep-freeze at
    // construction time specifically so mutation THROWS rather than
    // silently no-opping; re-applying it here on every read is what keeps
    // that guarantee real across this runtime's localStorage persistence,
    // not just at the moment of construction.
    for (const record of state.outputs) deepFreeze(record.content);
    for (const record of state.reports) deepFreeze(record.content);
    for (const record of state.initiatives) deepFreeze(record.content);
    return state;
  }

  private write(state: RuntimeState): void {
    writeStorage(this.storage, this.sessionId, state);
  }

  getSession(): MethodSession {
    return this.read().session;
  }

  // -- roles ----------------------------------------------------------------

  assignRole(userId: string, role: MethodProcessRole): void {
    const state = this.read();
    const roles = state.roles[userId] ?? [];
    if (!roles.includes(role)) state.roles[userId] = [...roles, role];
    this.write(state);
  }

  getRoles(userId: string): MethodProcessRole[] {
    return this.read().roles[userId] ?? [];
  }

  // -- events -----------------------------------------------------------------

  listEvents(): MethodEvent[] {
    return [...this.read().events].sort((a, b) => {
      const byTime = new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime();
      return byTime !== 0 ? byTime : a.id.localeCompare(b.id);
    });
  }

  /** Mirrors `MethodEventStore.append`: same (type-agnostic) idempotency-key
   * dedupe — replaying the same key resolves to the SAME stored event. */
  appendEvent(input: {
    type: MethodEventType;
    unitId?: string;
    level?: number;
    actorKind: MethodActorKind;
    actorUserId: string | null;
    idempotencyKey?: string;
    payload: unknown;
  }): MethodEvent {
    const state = this.read();
    if (input.idempotencyKey) {
      const existing = state.events.find((e) => e.idempotencyKey === input.idempotencyKey);
      if (existing) return existing;
    }
    const event: MethodEvent = {
      id: genId(),
      type: input.type,
      organizationId: state.session.organizationId,
      sessionId: state.session.id,
      unitId: input.unitId,
      level: input.level,
      actorKind: input.actorKind,
      actorUserId: input.actorUserId,
      methodPackVersion: state.session.methodPackVersion,
      occurredAt: nowIso(),
      idempotencyKey: input.idempotencyKey,
      payload: input.payload,
    };
    state.events.push(event);
    this.write(state);
    return event;
  }

  recordAnswer(input: RecordAnswerInput): MethodEvent {
    return this.appendEvent({
      type: input.draft ? 'ANSWER_DRAFTED' : 'ANSWER_CONFIRMED',
      unitId: input.unitId,
      level: input.level,
      actorKind: 'human',
      actorUserId: input.actorUserId,
      idempotencyKey: `answer:${input.questionId}:${input.draft ? 'draft' : 'confirmed'}:${nowIso()}:${genId()}`,
      payload: {
        questionId: input.questionId,
        answerState: input.answerState,
        text: input.text,
        justification: input.justification,
      },
    });
  }

  recordEvidence(input: RecordEvidenceInput): MethodEvent {
    return this.appendEvent({
      type: 'EVIDENCE_ATTACHED',
      unitId: input.unitId,
      level: input.level,
      actorKind: 'human',
      actorUserId: input.actorUserId,
      idempotencyKey: `evidence:${input.evidenceId}`,
      payload: {
        evidenceId: input.evidenceId,
        evidenceType: input.evidenceType,
        strength: input.strength,
        linkedQuestionIds: input.linkedQuestionIds ?? [],
      },
    });
  }

  recordTargetDecision(input: RecordTargetDecisionInput): MethodEvent {
    return this.appendEvent({
      type: 'DECISION_APPROVED',
      unitId: input.unitId,
      level: input.level,
      actorKind: 'human',
      actorUserId: input.actorUserId,
      idempotencyKey: `target-decision:${input.unitId}:${input.level}:${genId()}`,
      payload: {
        decisionId: genId(),
        subject: 'target_level',
        decidedValue: input.level,
        rationale: input.rationale,
      },
    });
  }

  // -- Teresa: Intent -> Preview -> Commit -----------------------------------

  createTeresaPreview(input: {
    intent: TeresaIntent;
    statements: readonly TeresaStatement[];
    proposedChanges: readonly TeresaProposedChange[];
    quality: TeresaQualityVerdict;
    ttlMs?: number;
  }): TeresaPreview {
    const state = this.read();
    const createdAt = nowIso();
    const expiresAt = new Date(Date.now() + (input.ttlMs ?? 15 * 60 * 1000)).toISOString();
    const preview: TeresaPreview = {
      previewId: genId(),
      intent: input.intent,
      statements: input.statements,
      proposedChanges: input.proposedChanges,
      quality: input.quality,
      createdAt,
      expiresAt,
    };
    state.previews.push({ preview, consumedAt: null, consumedBy: null });
    this.write(state);
    this.appendEvent({
      type: 'TERESA_PROPOSAL_CREATED',
      unitId: input.intent.unitId,
      level: input.intent.level,
      actorKind: 'teresa',
      actorUserId: input.intent.actorUserId,
      idempotencyKey: `teresa-preview:${preview.previewId}`,
      payload: {
        proposalId: preview.previewId,
        capabilityId: input.intent.capabilityId,
        previewRef: preview.previewId,
        qualityVerdict: input.quality.verdict,
      },
    });
    return preview;
  }

  getTeresaPreview(previewId: string): TeresaPreview | null {
    return this.read().previews.find((p) => p.preview.previewId === previewId)?.preview ?? null;
  }

  listPendingTeresaPreviews(): TeresaPreview[] {
    const state = this.read();
    const now = Date.now();
    return state.previews
      .filter((p) => p.consumedAt === null && new Date(p.preview.expiresAt).getTime() > now)
      .map((p) => p.preview);
  }

  /**
   * Mirrors `TeresaProposalService.commit` refusal ladder exactly:
   * preview_not_found -> preview_already_consumed -> preview_expired ->
   * quality_invalid -> session_frozen -> success. A commit request is
   * unrepresentable without a `previewId` at the TYPE level
   * (`TeresaCommitRequest`); this is the additional RUNTIME half of "commit
   * without a preview is refused".
   */
  commitTeresaPreview(request: TeresaCommitRequest): TeresaCommitResult {
    const state = this.read();
    const record = state.previews.find((p) => p.preview.previewId === request.previewId);
    if (!record) return { ok: false, refusal: { kind: 'preview_not_found' } };
    if (record.consumedAt) return { ok: false, refusal: { kind: 'preview_already_consumed' } };
    if (new Date(record.preview.expiresAt).getTime() <= Date.now()) {
      return { ok: false, refusal: { kind: 'preview_expired', expiredAt: record.preview.expiresAt } };
    }
    if (record.preview.quality.verdict === 'invalid') {
      return {
        ok: false,
        refusal: { kind: 'quality_invalid', failedChecks: record.preview.quality.failedChecks },
      };
    }
    if (state.session.state === 'frozen') {
      return { ok: false, refusal: { kind: 'session_frozen' } };
    }

    record.consumedAt = nowIso();
    record.consumedBy = request.actorUserId;
    this.write(state);

    const eventType = request.decision === 'reject' ? 'TERESA_PROPOSAL_REJECTED' : 'TERESA_PROPOSAL_ACCEPTED';
    const event = this.appendEvent({
      type: eventType,
      unitId: record.preview.intent.unitId,
      level: record.preview.intent.level,
      actorKind: 'human',
      actorUserId: request.actorUserId,
      idempotencyKey: request.idempotencyKey,
      payload: {
        proposalId: record.preview.previewId,
        capabilityId: record.preview.intent.capabilityId,
        previewRef: record.preview.previewId,
        qualityVerdict: record.preview.quality.verdict,
        decision: request.decision,
      },
    });

    return { ok: true, eventIds: [event.id] };
  }

  // -- lifecycle transitions --------------------------------------------------

  /**
   * Mirrors `MethodSessionService.transition`: illegal_transition ->
   * missing_permission -> (frozen -> active reopen creates a NEW revision,
   * never mutates this row) -> ok. `to === 'frozen'` also builds the
   * AssessmentOutput (the same bridge role `EventDerivedOutputBridge` plays
   * server-side) — see `freezeToOutput` below, called from here so "freeze
   * creates an Output" is structural, not an extra step the caller must
   * remember.
   */
  transition(to: MethodSessionState, actorUserId: string): TransitionResult {
    const state = this.read();
    const from = state.session.state;

    if (!canTransition(from, to)) {
      return { ok: false, refusal: { kind: 'illegal_transition', from, to } };
    }

    const requiredRoles = TRANSITION_AUTHORITY[to];
    if (requiredRoles && requiredRoles.length > 0) {
      const actorRoles = state.roles[actorUserId] ?? [];
      const authorized = requiredRoles.some((role) => actorRoles.includes(role));
      if (!authorized) {
        return { ok: false, refusal: { kind: 'missing_permission', requiredRole: requiredRoles[0] } };
      }
    }

    if (from === 'frozen' && to === 'active') {
      // Reopen -> new revision. This row is NEVER mutated; a sibling runtime
      // is created and returned via `reopen()` (richer return type than
      // TransitionResult allows) — this bare transition() call still reports
      // ok:true per the kernel contract, matching MethodSessionService.
      return { ok: true };
    }

    state.session = { ...state.session, state: to, updatedAt: nowIso(), version: state.session.version + 1 };
    this.write(state);

    if (to === 'frozen') {
      this.freezeToOutput(actorUserId);
    }

    return { ok: true };
  }

  // -- freeze -> Output bridge (client mirror of EventDerivedOutputBridge) ----

  private freezeToOutput(actorUserId: string): AssessmentOutput {
    const state = this.read();
    const events = this.listEvents();

    interface UnitAcc {
      currentLevel: number | null;
      targetLevel: number | null;
      evidence: EvidenceLocator[];
      answerEventIds: string[];
    }
    const byUnit = new Map<string, UnitAcc>();
    const bucket = (unitId: string): UnitAcc => {
      let b = byUnit.get(unitId);
      if (!b) {
        b = { currentLevel: null, targetLevel: null, evidence: [], answerEventIds: [] };
        byUnit.set(unitId, b);
      }
      return b;
    };
    for (const event of events) {
      if (!event.unitId) continue;
      const b = bucket(event.unitId);
      if (event.type === 'ANSWER_CONFIRMED' && typeof event.level === 'number') {
        b.currentLevel = event.level;
        b.answerEventIds.push(event.id);
      }
      if (event.type === 'EVIDENCE_ATTACHED') {
        const payload = event.payload as { evidenceId?: string; evidenceType?: string; strength?: string };
        if (payload?.evidenceId) {
          b.evidence.push({
            evidenceId: payload.evidenceId,
            evidenceType: (payload.evidenceType as EvidenceLocator['evidenceType']) ?? 'observation',
            strength: (payload.strength as EvidenceLocator['strength']) ?? 'E1',
            locator: `method-event://${event.id}`,
          });
        }
      }
      if (
        event.type === 'DECISION_APPROVED' &&
        typeof event.level === 'number' &&
        (event.payload as { subject?: string })?.subject === 'target_level'
      ) {
        b.targetLevel = event.level;
      }
    }

    const current: Record<string, number | null> = {};
    const target: Record<string, number | null> = {};
    const gap: Record<string, number | null> = {};
    const findings: Finding[] = [];
    const units = [...byUnit.entries()].sort(([a], [b]) => a.localeCompare(b));
    for (const [unitId, acc] of units) {
      current[unitId] = acc.currentLevel;
      target[unitId] = acc.targetLevel;
      gap[unitId] = acc.currentLevel !== null && acc.targetLevel !== null ? acc.targetLevel - acc.currentLevel : null;
      if (acc.evidence.length === 0) continue;
      findings.push({
        id: genId(),
        unitId,
        unitName: unitLabel(unitId),
        currentLevel: acc.currentLevel,
        targetLevel: acc.targetLevel,
        gap: gap[unitId],
        supportingEvidence: acc.evidence,
        contradictingEvidence: [],
        businessMeaning:
          acc.currentLevel !== null
            ? `${unitLabel(unitId)}: potwierdzony poziom ${acc.currentLevel}, oparty o ${dowodyLabel(acc.evidence.length)}.`
            : `${unitLabel(unitId)}: dowody zebrane, poziom nie został jeszcze potwierdzony.`,
        rootCauseHypothesis: '',
        riskOrOpportunity:
          gap[unitId] !== null && (gap[unitId] as number) > 0
            ? `Do celu brakuje ${gap[unitId]} ${(gap[unitId] as number) === 1 ? 'poziomu' : 'poziomów'} — ${unitLabel(unitId)}.`
            : '',
        recommendation:
          gap[unitId] !== null && (gap[unitId] as number) > 0
            ? `Zaplanuj działania podnoszące ${unitLabel(unitId)} z poziomu ${acc.currentLevel} do ${acc.targetLevel}.`
            : `Utrzymaj obecny poziom jednostki ${unitId}.`,
        prerequisite: null,
        expectedOutcome:
          gap[unitId] !== null && (gap[unitId] as number) > 0
            ? `Zamknięcie luki na jednostce ${unitId}.`
            : `Stabilizacja jednostki ${unitId}.`,
        kpiProposal: null,
        confidence: 'medium',
        priorityRationale: gap[unitId] !== null ? `Sortowanie wg wielkości luki (${gap[unitId]}).` : 'Brak wyliczonej luki.',
        sourceLocators: [...acc.answerEventIds, ...acc.evidence.map((e) => e.locator)],
      });
    }

    const totalUnits = Object.keys(current).length;
    const unitsWithAcceptedEvidence = findings.length;
    const priorOutput = this.currentOutputRecord();

    const output = createAssessmentOutput({
      id: genId(),
      organizationId: state.session.organizationId,
      module: state.session.module,
      methodology: { methodPackId: state.session.methodPackId, version: state.session.methodPackVersion },
      scope: `Sesja ${state.session.id} — ${state.session.methodPackId}@${state.session.methodPackVersion} (vertical slice demo).`,
      snapshotId: `local-snapshot:${state.session.id}:${nowIso()}`,
      current,
      target,
      gap,
      aggregation: { byGroup: {}, mappingVersion: 'event-derived-v1', rule: 'client mirror of EventDerivedOutputBridge — per-axis grouping not computed here.', excluded: {} },
      visualModel: { kind: 'matrix', dataRef: current },
      evidenceCompleteness: {
        totalUnits,
        unitsWithAcceptedEvidence,
        unitsMissingEvidence: totalUnits - unitsWithAcceptedEvidence,
        completenessRatio: totalUnits > 0 ? unitsWithAcceptedEvidence / totalUnits : 0,
      },
      limitations: [
        'Output wygenerowany automatycznie z lokalnego event-store (vertical-slice demo, przeglądarka) — ' +
          'businessMeaning/recommendation to deterministyczne szablony, NIE analiza LLM ani recenzja metodyka.',
        'aggregation.byGroup jest pusta — agregacja per-oś (drdAdapter.aggregate) liczona jest osobno do wyświetlenia.',
      ],
      findings,
      prioritisationResult: null,
      lineage: {
        sourceSessionId: state.session.id,
        sourceRevisionOfSessionId: state.session.revisionOfSessionId,
        revisionOfOutputId: priorOutput?.content.id ?? null,
        supersededByOutputId: null,
      },
      version: priorOutput ? priorOutput.content.version + 1 : 1,
      createdAt: nowIso(),
      frozenAt: nowIso(),
    });

    // Supersede the prior current Output (bit-for-bit content untouched —
    // `markRecordSuperseded` only swaps the wrapper's status/pointer fields).
    const stateAfter = this.read();
    const nextOutputs = stateAfter.outputs.map((record) =>
      record.status === 'current'
        ? markRecordSuperseded(record, 'superseded', output.id, output.frozenAt)
        : record
    );
    nextOutputs.push(wrapAsCurrent(output));
    stateAfter.outputs = nextOutputs;
    this.write(stateAfter);

    this.appendEvent({
      type: 'OUTPUT_CREATED',
      actorKind: 'system',
      actorUserId: null,
      idempotencyKey: `output-created:${output.id}`,
      payload: { outputId: output.id, outputVersion: output.version, contentHash: output.contentHash },
    });

    return output;
  }

  listOutputs(): DeliverableRecord<AssessmentOutput>[] {
    return this.read().outputs;
  }

  currentOutputRecord(): DeliverableRecord<AssessmentOutput> | null {
    const outputs = this.read().outputs;
    return outputs.find((r) => r.status === 'current') ?? outputs[outputs.length - 1] ?? null;
  }

  // -- Report / Initiative Draft ----------------------------------------------

  generateReport(input: {
    executiveSummary: string;
    participants: readonly string[];
    strengths: readonly string[];
    appendices: readonly string[];
    actorUserId: string;
  }): ReportSnapshot {
    const record = this.currentOutputRecord();
    if (!record) throw new Error('drd-session-runtime: cannot generate a report before a freeze');
    const report = buildReportSnapshot(record.content, {
      id: genId(),
      executiveSummary: input.executiveSummary,
      participants: input.participants,
      strengths: input.strengths,
      initiativeCandidates: [],
      appendices: input.appendices,
      createdAt: nowIso(),
    });
    const state = this.read();
    state.reports = [
      ...state.reports.map((r) => (r.status === 'current' ? markRecordSuperseded(r, 'source_updated', record.content.id, nowIso()) : r)),
      wrapAsCurrent(report),
    ];
    this.write(state);
    this.appendEvent({
      type: 'REPORT_REQUESTED',
      actorKind: 'human',
      actorUserId: input.actorUserId,
      idempotencyKey: `report:${report.id}`,
      payload: { reportId: report.id, outputId: record.content.id, outputVersion: record.content.version },
    });
    return report;
  }

  listReports(): DeliverableRecord<ReportSnapshot>[] {
    return this.read().reports;
  }

  generateInitiativeDraft(input: { actorUserId: string }): InitiativeProposalDraft[] {
    const record = this.currentOutputRecord();
    if (!record) throw new Error('drd-session-runtime: cannot draft initiatives before a freeze');
    const groups = groupFindingsForInitiativeDrafts(record.content.findings, { onlyWithGap: true });
    const created: InitiativeProposalDraft[] = [];
    const state = this.read();
    for (const group of groups) {
      const draft = createInitiativeProposalDraft({
        id: genId(),
        organizationId: record.content.organizationId,
        outputId: record.content.id,
        outputVersion: record.content.version,
        title: `Domknięcie luki: ${group.map((f) => f.unitId).join(', ')}`,
        summary: `Grupa ${group.length} finding(ów) z niedomkniętą luką celu.`,
        findings: group,
        rationale: 'Zgrupowane wg luki (target - current > 0) z realnych findingów Outputu.',
        expectedOutcome: 'Zamknięcie zidentyfikowanej luki dojrzałości dla tej grupy jednostek.',
        kpiProposal: null,
        dependencies: [],
        risks: [],
        confidence: 'medium',
        createdAt: nowIso(),
      });
      created.push(draft);
      state.initiatives.push(wrapAsCurrent(draft));
    }
    this.write(state);
    for (const draft of created) {
      this.appendEvent({
        type: 'INITIATIVE_PROPOSED',
        actorKind: 'teresa',
        actorUserId: input.actorUserId,
        idempotencyKey: `initiative-draft:${draft.id}`,
        payload: { draftId: draft.id, outputId: record.content.id, findingIds: draft.findingIds },
      });
    }
    return created;
  }

  listInitiativeDrafts(): DeliverableRecord<InitiativeProposalDraft>[] {
    return this.read().initiatives;
  }

  // -- Reopen -------------------------------------------------------------

  /**
   * `frozen -> active`: creates a brand new session (NEW id,
   * `revisionOfSessionId` pointing back at this one) — mirrors
   * `MethodSessionService.transition`'s frozen->active branch exactly. THIS
   * session's row, its events, and its Output are never mutated; only a new
   * sibling runtime is created and returned.
   */
  reopen(actorUserId: string): DrdSessionRuntime {
    const state = this.read();
    if (state.session.state !== 'frozen') {
      throw new Error('drd-session-runtime: reopen is only legal from frozen');
    }
    const authority = TRANSITION_AUTHORITY.active ?? [];
    const roles = state.roles[actorUserId] ?? [];
    if (authority.length > 0 && !authority.some((r) => roles.includes(r))) {
      throw new Error(`drd-session-runtime: reopen requires one of [${authority.join(', ')}]`);
    }
    const revision = createDrdDemoSession({
      organizationId: state.session.organizationId,
      projectId: state.session.projectId,
      ownerUserId: state.session.ownerUserId,
      mode: state.session.mode,
      storage: this.storage,
      revisionOfSessionId: state.session.id,
    });
    const revState = revision.read();
    revState.session = { ...revState.session, state: 'active' };
    // A reopen is the SAME case, same team — role assignments carry over to
    // the revision (a fresh, empty roles map would silently strip everyone's
    // authority and make e.g. the very next in_review/frozen transition fail
    // for people who legitimately hold those roles on this case).
    revState.roles = { ...state.roles };
    revision.write(revState);
    return revision;
  }
}

export { METHOD_PROCESS_ROLES };
