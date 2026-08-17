/**
 * P28 Assessment workbench — definition/run separation, no silent scoring,
 * explicit proposals + review + promotion payload (FINAL_IMPLEMENTATION_PLAN_28).
 */

import { v4 as uuidv4 } from 'uuid';

import { getTableColumns } from '../../utils/dbSchema.js';
import logger from '../../utils/Logger.js';
import * as queryHelpers from '../../utils/queryHelpers.js';
import { createInitiative as funnelCreateInitiative } from '../initiative/createInitiativeService.js';
import { checkSimilarInitiatives } from '../initiativeSimilarityService.js';
import * as artifactRegistryService from '../v8/artifactRegistryService.js';
import { addFinding } from '../v8/interviewInsightFindingsService.js';
import AssessmentDefinitionService from './AssessmentDefinitionService.js';

export const P28_WORKBENCH_CONTRACT_VERSION = 'p28_workbench_v1' as const;

export type P28RunState =
  | 'draft'
  | 'running'
  | 'awaiting_evidence'
  | 'score_proposed'
  | 'score_reviewed'
  | 'interpretation_proposed'
  | 'interpretation_reviewed'
  | 'completed'
  | 'failed';

export interface EvidencePointer {
  id: string;
  kind: 'survey_response' | 'document' | 'interview_note' | 'external_url' | 'artifact';
  ref: string;
  label?: string;
  availability?: 'ok' | 'unavailable';
}

export interface ScoreProposal {
  id: string;
  status: 'proposal';
  scoreValues: Record<string, number>;
  scoringRationale: string;
  evidencePointerIds: string[];
  assumptions: string[];
  confidence: number;
  proposedAt: string;
  proposedBy: string;
}

export interface InterpretationProposal {
  id: string;
  status: 'proposal';
  summary: string;
  keyFindings: string[];
  limits: string;
  nextActions: string[];
  linksToScoreProposalId: string;
  proposedAt: string;
  proposedBy: string;
}

export interface PromotionTrace {
  id: string;
  fromAssessmentRunId: string;
  targetKind: 'outputs_artifact' | 'interview_insight';
  targetRef: string;
  createdAt: string;
  actorId: string;
  payloadSummary?: string;
}

export interface P28WorkbenchState {
  contractVersion: typeof P28_WORKBENCH_CONTRACT_VERSION;
  assessmentDefinitionRef: {
    definitionId: string;
    methodologyId: string;
    version: string;
    status: 'published';
    readOnly: true;
    publishedAt?: string | null;
  };
  /** assessment row id acts as assessment_run_id in P28 payloads */
  assessmentRunId: string;
  orgId: string;
  runState: P28RunState;
  startedBy: string;
  startedAt: string;
  evidencePointers: EvidencePointer[];
  requiredEvidenceKinds?: string[];
  scoreProposal: ScoreProposal | null;
  scoreReview: {
    status: 'pending' | 'accepted' | 'rejected' | 'overridden';
    decidedAt?: string;
    decidedBy?: string;
    reason?: string;
    overrideScoreValues?: Record<string, number>;
  } | null;
  interpretationProposal: InterpretationProposal | null;
  interpretationReview: {
    status: 'pending' | 'accepted' | 'rejected' | 'overridden';
    decidedAt?: string;
    decidedBy?: string;
    reason?: string;
    overrideSummary?: string;
  } | null;
  promotionTraces: PromotionTrace[];
  audit: Array<{ at: string; actorId: string; action: string; detail: string }>;
  degraded?: {
    code: string;
    message: string;
    missingEvidenceKinds?: string[];
    acceptedForCompletion?: boolean;
  };
  pendingPromotion?: {
    targetKind: PromotionTrace['targetKind'];
    targetRef: string;
    payload: Record<string, unknown>;
    failedAt: string;
    error: string;
  } | null;
  completedAt?: string;
}

function nowIso() {
  return new Date().toISOString();
}

/** Bounded preset for P28-B “one methodology” closure (DRD = document + interview artefakty jako evidence). */
export const P28_METHODOLOGY_PRESETS: Record<
  string,
  { requiredEvidenceKinds: EvidencePointer['kind'][]; label: string }
> = {
  DRD: {
    label: 'DRD maturity assessment (P28-B default)',
    requiredEvidenceKinds: ['document', 'interview_note'],
  },
};

/**
 * Jawne kroki „what next” dla degraded / każdego runState (FINAL 28 §5.2, §2.3.7).
 */
export function buildWhatNextGuidance(state: P28WorkbenchState): string[] {
  const lines: string[] = [];
  const push = (s: string) => lines.push(s);

  switch (state.runState) {
    case 'draft':
      push(
        'Call POST .../workbench/transition with { toState: "running" } to start evidence capture.'
      );
      break;
    case 'running':
      if (state.requiredEvidenceKinds?.length) {
        push(
          `Attach at least one evidence pointer per required kind: ${state.requiredEvidenceKinds.join(', ')} (POST .../workbench/evidence).`
        );
      }
      push(
        'When requirements are met, call POST .../workbench/score-proposal with scoringRationale, scoreValues, and linked evidencePointerIds.'
      );
      break;
    case 'awaiting_evidence':
      push(
        'Add evidence for every missing kind (see degraded.missingEvidenceKinds), then POST .../workbench/transition with { toState: "running" } before retrying score-proposal.'
      );
      if (state.degraded?.missingEvidenceKinds?.length) {
        push(`Still required kinds: ${state.degraded.missingEvidenceKinds.join(', ')}`);
      }
      break;
    case 'score_proposed':
      push(
        'Review the score proposal: POST .../workbench/score-review with action accept, reject, or override.'
      );
      break;
    case 'score_reviewed':
      push(
        'Create an interpretation proposal: POST .../workbench/interpretation-proposal (must include limits — no overclaim).'
      );
      push(
        'Or, for bounded degraded closure only: POST .../workbench/transition with { toState: "completed", reason: "..." } from score_reviewed.'
      );
      break;
    case 'interpretation_proposed':
      push('POST .../workbench/interpretation-review with action accept, reject, or override.');
      break;
    case 'interpretation_reviewed':
      push('Finalize: POST .../workbench/transition with { toState: "completed" }.');
      break;
    case 'completed':
      push(
        'GET .../workbench/promotion-payload, then POST .../workbench/promotion with targetKind and targetRef for Outputs/Interview handoff.'
      );
      break;
    case 'failed':
      push(
        'Resume: POST .../workbench/transition with { toState: "running" } after resolving the failure.'
      );
      break;
    default:
      break;
  }

  const broken = state.evidencePointers.filter((e) => e.availability === 'unavailable');
  if (broken.length) {
    push(
      `Unavailable evidence (restore access or add replacement pointers): ${broken.map((b) => `${b.kind}:${b.ref}`).join('; ')}`
    );
  }

  if (state.pendingPromotion) {
    push(
      `Retry denied promotion for ${state.pendingPromotion.targetKind}:${state.pendingPromotion.targetRef} after resolving downstream error.`
    );
  }

  return lines;
}

export function createInitialWorkbench(params: {
  assessmentId: string;
  orgId: string;
  methodologyId: string;
  startedBy: string;
  methodologyVersion?: string;
  definitionId?: string;
  publishedAt?: string | null;
}): P28WorkbenchState {
  const t = nowIso();
  const version = params.methodologyVersion || '1.0';
  return {
    contractVersion: P28_WORKBENCH_CONTRACT_VERSION,
    assessmentDefinitionRef: {
      definitionId: params.definitionId || `asdef_${params.methodologyId}_${version}`.toLowerCase(),
      methodologyId: params.methodologyId,
      version,
      status: 'published',
      readOnly: true,
      publishedAt: params.publishedAt || null,
    },
    assessmentRunId: params.assessmentId,
    orgId: params.orgId,
    runState: 'draft',
    startedBy: params.startedBy,
    startedAt: t,
    evidencePointers: [],
    scoreProposal: null,
    scoreReview: null,
    interpretationProposal: null,
    interpretationReview: null,
    promotionTraces: [],
    pendingPromotion: null,
    audit: [{ at: t, actorId: params.startedBy, action: 'workbench_init', detail: 'draft' }],
  };
}

export function assertPromotionPayloadShape(state: P28WorkbenchState): {
  ok: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  if (state.runState !== 'completed') {
    errors.push('Promotion requires completed run');
  }
  if (!state.scoreProposal && !state.scoreReview?.overrideScoreValues) {
    errors.push('Missing score outcome');
  }
  if (!state.interpretationProposal && state.interpretationReview?.status !== 'overridden') {
    errors.push('Missing interpretation proposal');
  }
  return { ok: errors.length === 0, errors };
}

export function buildBoundedPromotionPayload(state: P28WorkbenchState): Record<string, unknown> {
  const scoreOutcome =
    state.scoreReview?.status === 'overridden' && state.scoreReview.overrideScoreValues
      ? { kind: 'override' as const, values: state.scoreReview.overrideScoreValues }
      : state.scoreProposal
        ? {
            kind: 'proposal_snapshot' as const,
            proposalId: state.scoreProposal.id,
            scoreValues: state.scoreProposal.scoreValues,
            rationale: state.scoreProposal.scoringRationale,
            confidence: state.scoreProposal.confidence,
          }
        : null;

  const interpretationOutcome =
    state.interpretationReview?.status === 'overridden' &&
    state.interpretationReview.overrideSummary
      ? { kind: 'override' as const, summary: state.interpretationReview.overrideSummary }
      : state.interpretationProposal
        ? {
            kind: 'proposal_snapshot' as const,
            proposalId: state.interpretationProposal.id,
            summary: state.interpretationProposal.summary,
            limits: state.interpretationProposal.limits,
            keyFindings: state.interpretationProposal.keyFindings,
            nextActions: state.interpretationProposal.nextActions,
          }
        : null;

  return {
    assessment_run_id: state.assessmentRunId,
    assessment_definition_id: state.assessmentDefinitionRef.definitionId,
    methodology_id: state.assessmentDefinitionRef.methodologyId,
    assessment_definition_version: state.assessmentDefinitionRef.version,
    org_id: state.orgId,
    run_state: state.runState,
    score_outcome: scoreOutcome,
    interpretation_outcome: interpretationOutcome,
    evidence_pointers: state.evidencePointers,
    limits: state.interpretationProposal?.limits ?? state.degraded?.message ?? '',
    promotion_traces: state.promotionTraces,
    degraded: state.degraded ?? null,
  };
}

function parseState(raw: string | null | undefined): P28WorkbenchState | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as P28WorkbenchState;
  } catch {
    return null;
  }
}

function persistState(assessmentId: string, organizationId: string, state: P28WorkbenchState) {
  return queryHelpers.queryRun(
    `UPDATE assessments
        SET p28_workbench_v1 = ?,
            assessment_definition_id = ?,
            assessment_definition_version = ?,
            updated_at = ?
      WHERE id = ? AND organization_id = ?`,
    [
      JSON.stringify(state),
      state.assessmentDefinitionRef.definitionId,
      state.assessmentDefinitionRef.version,
      nowIso(),
      assessmentId,
      organizationId,
    ]
  );
}

async function buildInitialWorkbench(
  assessmentId: string,
  organizationId: string,
  assessmentType: string,
  createdBy: string
): Promise<P28WorkbenchState> {
  const definition = await AssessmentDefinitionService.ensurePublishedDefinition({
    methodologyId: assessmentType,
    createdBy,
    organizationId,
  });
  return createInitialWorkbench({
    assessmentId,
    orgId: organizationId,
    methodologyId: definition.methodologyId,
    methodologyVersion: definition.version,
    definitionId: definition.id,
    publishedAt: definition.publishedAt,
    startedBy: createdBy,
  });
}

async function createInsightProposalFromAssessment(params: {
  assessmentId: string;
  organizationId: string;
  userId: string;
  state: P28WorkbenchState;
  requestedTargetRef?: string;
}): Promise<string> {
  const now = nowIso();
  const insightId = params.requestedTargetRef?.trim() || `ii_${uuidv4()}`;
  const payload = buildBoundedPromotionPayload(params.state);
  const activeEvidencePointers = params.state.evidencePointers.filter(
    (pointer) => pointer.availability !== 'unavailable'
  );
  const contentLines = [
    `Assessment proposal: ${params.state.assessmentDefinitionRef.methodologyId}`,
    '',
    `Summary: ${params.state.interpretationProposal?.summary || params.state.interpretationReview?.overrideSummary || 'No summary'}`,
    '',
    `Limits: ${String(payload.limits || 'None provided')}`,
    '',
    'Key findings:',
    ...(params.state.interpretationProposal?.keyFindings || []).map((item) => `- ${item}`),
    '',
    'Next actions:',
    ...(params.state.interpretationProposal?.nextActions || []).map((item) => `- ${item}`),
  ];

  await queryHelpers.queryRun(
    `INSERT INTO interview_insights
      (id, session_id, organization_id, category, title, prompt_type, source_session_ids, filters, content,
       status, source_session_count, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      insightId,
      null,
      params.organizationId,
      'assessment_proposal',
      `Assessment proposal — ${params.state.assessmentDefinitionRef.methodologyId}`,
      'summary',
      JSON.stringify([]),
      JSON.stringify({
        sourceType: 'assessment',
        assessmentRunId: params.assessmentId,
        assessmentDefinitionId: params.state.assessmentDefinitionRef.definitionId,
        assessmentDefinitionVersion: params.state.assessmentDefinitionRef.version,
        proposalKind: 'assessment_p28_handoff',
      }),
      contentLines.join('\n'),
      'draft',
      0,
      params.userId,
      now,
      now,
    ]
  );

  const findingStatement =
    params.state.interpretationProposal?.keyFindings?.[0] ||
    params.state.interpretationProposal?.summary ||
    params.state.interpretationReview?.overrideSummary ||
    'Assessment finding proposal';
  const scoreConfidence = params.state.scoreProposal?.confidence ?? 0;
  const confidenceLevel =
    scoreConfidence >= 0.8
      ? 'high'
      : scoreConfidence >= 0.55
        ? 'medium'
        : scoreConfidence > 0
          ? 'low'
          : 'insufficient';
  const pointerTypeForKind = (kind: string) => {
    switch (kind) {
      case 'survey_response':
        return 'survey_linkage';
      case 'interview_note':
        return 'transcript_excerpt';
      case 'artifact':
        return 'export_artifact';
      case 'document':
      case 'external_url':
      default:
        return 'attachment';
    }
  };

  await addFinding(
    insightId,
    {
      finding_statement: findingStatement,
      confidence_level: confidenceLevel,
      limits: String(payload.limits || 'Bounded assessment proposal'),
      next_action:
        params.state.interpretationProposal?.nextActions?.[0] ||
        'Review this assessment proposal before promoting it beyond P10.',
      evidence_pointers: activeEvidencePointers.map((pointer) => ({
        type: pointerTypeForKind(pointer.kind),
        sourceRef: pointer.ref,
        sourceFingerprint: `${pointer.kind}:${pointer.ref}`,
        capturedExcerpt: pointer.label || null,
      })),
    },
    {
      organizationId: params.organizationId,
      actorUserId: params.userId,
      sourceSectionType: 'assessment_promotion',
      auditAction: 'assessment_promotion_finding',
    }
  );

  return insightId;
}

export interface AssessmentInitiativeSeed {
  initiativeId: string;
  title: string;
}

export interface AssessmentInitiativeSeedResult {
  created: AssessmentInitiativeSeed[];
  skippedDuplicates: number;
  batchId: string | null;
}

/** Idempotency marker for the automatic assessment→initiatives batch (H1.3). */
const AUTO_INITIATIVE_BATCH_NAME = 'p28_workbench_auto';

/**
 * ASM-BVP-001 (part 2) — DB-level "at most one ACTIVE batch per assessment"
 * guarantee. Backed by the partial unique index created in
 * server/migrations/20260910_claude_a_assessment_initiative_batch_uniqueness.sql
 * (`uq_assessment_initiative_batches_one_active_per_assessment` on
 * `(assessment_id, COALESCE(organization_id, ''))` WHERE `status IS
 * DISTINCT FROM 'superseded'`).
 *
 * Column-aware INSERT ... ON CONFLICT ... DO NOTHING, mirroring the
 * established pattern in
 * server/src/services/tools/toolOutputSnapshotService.ts's
 * `persistSnapshot` (see server/migrations/947_tool_outputs_idempotency_guard.sql).
 * A second sequential OR concurrent attempt for the same
 * (assessment_id, organization_id) never inserts a duplicate row and never
 * throws on the unique-index conflict — it returns the EXISTING active
 * batch instead (`created: false`), so every call site (this file's H1.3
 * auto-batch AND assessment-workflow-v2.routes.ts's manual-initiative
 * batch) becomes idempotent/CAS-aware without duplicating the transaction
 * logic.
 *
 * Exported so both owning call sites share one implementation instead of
 * two independently-drifting copies of the same race-prone INSERT.
 */
export async function upsertActiveAssessmentInitiativeBatch(params: {
  batchId: string;
  assessmentId: string;
  organizationId: string;
  fields: Record<string, unknown>;
}): Promise<{ batchId: string; created: boolean }> {
  const { batchId, assessmentId, organizationId, fields } = params;
  const batchCols = await getTableColumns('assessment_initiative_batches');

  const cols: string[] = ['id', 'assessment_id'];
  const values: unknown[] = [batchId, assessmentId];
  const add = (col: string, val: unknown) => {
    if (!batchCols.has(col)) return;
    cols.push(col);
    values.push(val);
  };
  add('organization_id', organizationId);
  for (const [col, val] of Object.entries(fields)) add(col, val);

  // Some existing test harnesses mock queryHelpers.js wholesale, providing
  // only queryOne/queryRun/queryAll (e.g.
  // assessmentWorkbench.p28b-e2e.test.ts and its siblings, which predate
  // this CAS insert and exercise createInitiativesFromAssessmentRecommendations
  // via a full state-machine walk to 'completed'). Under those harnesses
  // `withRawPgTransaction` is not a function — attempting the real-Postgres
  // CAS path there does not throw fast, it tries a real connection using
  // whatever DATABASE_URL happens to be configured and hangs until timeout
  // (reproduced: this exact regression, fixed here before landing).
  // Mirrors the identical, pre-existing guard in
  // server/src/services/tools/toolOutputSnapshotService.ts's
  // ensureToolOutputSnapshot. Falls back to the pre-CAS best-effort INSERT
  // (queryRun, `?` placeholders — properly mocked by those tests) instead.
  let hasRawPgTransaction: boolean;
  try {
    hasRawPgTransaction = typeof queryHelpers.withRawPgTransaction === 'function';
  } catch {
    hasRawPgTransaction = false;
  }
  if (!hasRawPgTransaction) {
    await queryHelpers.queryRun(
      `INSERT INTO assessment_initiative_batches (${cols.join(', ')}) VALUES (${cols
        .map(() => '?')
        .join(', ')})`,
      values
    );
    return { batchId, created: true };
  }

  const placeholders = cols.map((_, i) => `$${i + 1}`);
  return queryHelpers.withRawPgTransaction(async (client) => {
    const insertResult = await client.query(
      `INSERT INTO assessment_initiative_batches (${cols.join(', ')})
       VALUES (${placeholders.join(', ')})
       ON CONFLICT (assessment_id, (COALESCE(organization_id, '')))
       WHERE status IS DISTINCT FROM 'superseded'
       DO NOTHING
       RETURNING id`,
      values
    );
    if (insertResult.rows.length > 0) {
      return { batchId: String((insertResult.rows[0] as { id: string }).id), created: true };
    }

    // Lost the race (or a batch from a different call site already exists
    // for this assessment) — never insert a second row; reuse the existing
    // active one instead.
    const existing = await client.query(
      `SELECT id FROM assessment_initiative_batches
        WHERE assessment_id = $1 AND COALESCE(organization_id, '') = COALESCE($2, '')
          AND status IS DISTINCT FROM 'superseded'
        ORDER BY created_at DESC NULLS LAST, id DESC
        LIMIT 1`,
      [assessmentId, organizationId]
    );
    if (existing.rows.length === 0) {
      // Should be unreachable (conflict implies a row exists), but never
      // silently return nothing — surface it loudly instead of a phantom.
      throw new Error(
        `upsertActiveAssessmentInitiativeBatch: insert conflicted but no active batch found for assessment ${assessmentId}`
      );
    }
    return { batchId: String((existing.rows[0] as { id: string }).id), created: false };
  });
}

/**
 * H1.3 — Assessment → Initiatives (automatic on approval/completion).
 *
 * Reuses the H1.2 handoffFinding idiom (interview-insights.routes.ts): a completed
 * assessment whose interpretation carries recommendations (nextActions, or
 * keyFindings as fallback) materializes REAL DRAFT initiatives instead of leaving
 * the user to run the manual `promoteWorkbench` step. Each initiative:
 *   - is deduped against the org/project's live portfolio (checkSimilarInitiatives,
 *     informational — only a hard `duplicate` verdict is skipped; never blocks),
 *   - carries a back-reference to its source (source_type='assessment',
 *     source_id=<assessmentId>, created_from='assessment' — the same lineage the
 *     manual endpoint and InitiativeController source-filter already recognise),
 *   - is linked through assessment_initiative_batches + assessment_initiative_links
 *     so the Assessment > Initiatives tab surfaces it (no orphan links).
 *
 * Column-aware (add() pattern) — robust to schema drift between the demo/parity
 * databases. Idempotent per assessment (skips when the auto-batch already exists),
 * so re-completing / retrying never double-creates. Fail-soft: the caller wraps
 * this in try/catch so completion never fails on a downstream initiative error.
 */
async function createInitiativesFromAssessmentRecommendations(params: {
  assessmentId: string;
  organizationId: string;
  userId: string;
  state: P28WorkbenchState;
}): Promise<AssessmentInitiativeSeedResult> {
  const { assessmentId, organizationId, userId, state } = params;

  const rawRecommendations = state.interpretationProposal?.nextActions?.length
    ? state.interpretationProposal.nextActions
    : state.interpretationProposal?.keyFindings || [];
  const recommendations = rawRecommendations
    .map((r) => String(r || '').trim())
    .filter(Boolean)
    .slice(0, 8);

  if (recommendations.length === 0) {
    return { created: [], skippedDuplicates: 0, batchId: null };
  }

  const initiativeCols = await getTableColumns('initiatives');
  // `name` is the one NOT NULL provenance column — if it is absent the table shape
  // is unknown and we refuse to guess (fail-soft: no initiatives created).
  if (!initiativeCols.has('name')) {
    return { created: [], skippedDuplicates: 0, batchId: null };
  }

  const batchCols = await getTableColumns('assessment_initiative_batches');
  const linkCols = await getTableColumns('assessment_initiative_links');

  // Idempotency: never double-create the auto-batch for the same assessment.
  const batchNameCol = batchCols.has('batch_name')
    ? 'batch_name'
    : batchCols.has('methodology_id')
      ? 'methodology_id'
      : null;
  if (batchNameCol) {
    const existingBatch = await queryHelpers.queryOne<{ id: string }>(
      `SELECT id FROM assessment_initiative_batches WHERE assessment_id = ? AND ${batchNameCol} = ? LIMIT 1`,
      [assessmentId, AUTO_INITIATIVE_BATCH_NAME]
    );
    if (existingBatch) {
      return { created: [], skippedDuplicates: 0, batchId: null };
    }
  }

  const assessmentRow = await queryHelpers.queryOne<{ project_id?: string | null }>(
    `SELECT project_id FROM assessments WHERE id = ? AND organization_id = ?`,
    [assessmentId, organizationId]
  );
  const projectId = assessmentRow?.project_id || null;

  const now = nowIso();
  const summaryBase = String(
    state.interpretationProposal?.summary || state.interpretationReview?.overrideSummary || ''
  ).trim();
  const limits = String(state.interpretationProposal?.limits || '').trim();
  const initiativeSummary =
    [summaryBase, limits ? `Limits: ${limits}` : '', `Source: assessment ${assessmentId}`]
      .filter(Boolean)
      .join('\n\n')
      .slice(0, 5000) || null;

  // Batch first so links never orphan. ASM-BVP-001 (part 2): CAS insert —
  // never a duplicate active batch, never an unhandled conflict; a race or
  // a batch already created for this assessment by a different call site
  // (e.g. the manual-initiative route) is detected and reused instead.
  const { batchId, created: batchCreated } = await upsertActiveAssessmentInitiativeBatch({
    batchId: uuidv4(),
    assessmentId,
    organizationId,
    fields: {
      batch_name: AUTO_INITIATIVE_BATCH_NAME,
      methodology_id: AUTO_INITIATIVE_BATCH_NAME,
      status: 'draft',
      initiatives_count: 0,
      include_chat_context: 0,
      generated_by: userId,
      created_by: userId,
      created_at: now,
      updated_at: now,
    },
  });
  if (!batchCreated) {
    logger.info(
      `[AssessmentWorkbench] reused existing active batch ${batchId} for assessment ${assessmentId} (H1.3 auto-generation lost the CAS race or a batch already existed)`
    );
  }

  const created: AssessmentInitiativeSeed[] = [];
  let skippedDuplicates = 0;

  for (const recommendation of recommendations) {
    const title = recommendation.slice(0, 200);

    // Dedup parity with the H1.2 handoff + AI wizard: informational only, never
    // blocks; only a hard `duplicate` verdict is skipped. Isolated try/catch so a
    // similarity-service outage never fails the auto-promotion.
    try {
      const similarity = await checkSimilarInitiatives({
        orgId: organizationId,
        projectId,
        candidates: [{ title, description: summaryBase }],
      });
      if (similarity.results[0]?.verdict === 'duplicate') {
        skippedDuplicates += 1;
        continue;
      }
    } catch (similarityError) {
      logger.warn(
        '[AssessmentWorkbench] similarity-check unavailable (non-blocking)',
        similarityError
      );
    }

    const initiative = await funnelCreateInitiative(
      organizationId,
      {
        title,
        projectId,
        summary: initiativeSummary,
        description: initiativeSummary,
        status: 'DRAFT',
        priority: 'medium',
        sourceType: 'assessment',
        sourceId: assessmentId,
      },
      { actor: { id: userId } }
    );
    const initiativeId = initiative.id;

    // Preserve workbench-specific metadata after the single canonical create.
    // These are enrichment-only updates; no second creation writer remains.
    const enrichment: Array<[string, unknown]> = [
      ['risk_level', 'medium'],
      ['source_assessment_id', assessmentId],
      ['created_from', 'assessment'],
      ['owner_id', userId],
    ];
    const assignments = enrichment.filter(([column]) => initiativeCols.has(column));
    if (assignments.length > 0) {
      await queryHelpers.queryRun(
        `UPDATE initiatives SET ${assignments.map(([column]) => `${column} = ?`).join(', ')}, updated_at = ?
          WHERE id = ? AND organization_id = ?`,
        [...assignments.map(([, value]) => value), now, initiativeId, organizationId]
      );
    }

    const linkId = uuidv4();
    const lcols: string[] = ['id', 'assessment_id', 'batch_id', 'initiative_id'];
    const lvals: string[] = ['?', '?', '?', '?'];
    const largs: unknown[] = [linkId, assessmentId, batchId, initiativeId];
    if (linkCols.has('created_at')) {
      lcols.push('created_at');
      lvals.push('?');
      largs.push(now);
    }
    await queryHelpers.queryRun(
      `INSERT INTO assessment_initiative_links (${lcols.join(', ')}) VALUES (${lvals.join(', ')})`,
      largs
    );

    created.push({ initiativeId, title });
  }

  // ASM-BVP-001 (part 2): additive, not an overwrite — when `batchCreated`
  // is false this row is a REUSED existing batch that may already carry a
  // non-zero count from an earlier writer/attempt; a bare `= created.length`
  // would silently erase that prior count instead of accumulating it.
  if (batchCols.has('initiatives_count') && created.length > 0) {
    await queryHelpers.queryRun(
      `UPDATE assessment_initiative_batches SET initiatives_count = COALESCE(initiatives_count, 0) + ? WHERE id = ?`,
      [created.length, batchId]
    );
  }

  return { created, skippedDuplicates, batchId };
}

export class AssessmentWorkbenchService {
  static async load(
    assessmentId: string,
    organizationId: string,
    assessmentType: string,
    createdBy: string
  ): Promise<P28WorkbenchState> {
    const row = (await queryHelpers.queryOne<{ p28?: string | null }>(
      `SELECT p28_workbench_v1 as p28 FROM assessments WHERE id = ? AND organization_id = ?`,
      [assessmentId, organizationId]
    )) as { p28?: string | null } | null;
    if (!row) {
      throw Object.assign(new Error('ASSESSMENT_NOT_FOUND'), { code: 'ASSESSMENT_NOT_FOUND' });
    }
    let state = parseState(row.p28 ?? undefined);
    if (!state) {
      state = await buildInitialWorkbench(assessmentId, organizationId, assessmentType, createdBy);
      await persistState(assessmentId, organizationId, state);
    }
    return state;
  }

  static async transition(
    assessmentId: string,
    organizationId: string,
    userId: string,
    to: P28RunState,
    meta?: { reason?: string }
  ): Promise<P28WorkbenchState> {
    const ass = (await queryHelpers.queryOne<{
      p28?: string | null;
      assessment_type?: string;
      created_by?: string;
    }>(
      `SELECT p28_workbench_v1 as p28, assessment_type, created_by FROM assessments WHERE id = ? AND organization_id = ?`,
      [assessmentId, organizationId]
    )) as {
      p28?: string | null;
      assessment_type?: string;
      created_by?: string;
    } | null;
    if (!ass) {
      throw Object.assign(new Error('ASSESSMENT_NOT_FOUND'), { code: 'ASSESSMENT_NOT_FOUND' });
    }
    const state =
      parseState(ass.p28 ?? undefined) ||
      (await buildInitialWorkbench(
        assessmentId,
        organizationId,
        String(ass.assessment_type || 'DRD'),
        String(ass.created_by || userId)
      ));

    if (state.runState === 'completed') {
      throw Object.assign(new Error('RUN_READ_ONLY'), { code: 'P28_RUN_READ_ONLY' });
    }

    const from = state.runState;
    /** Coarse transitions only — scoring / interpretation steps use dedicated APIs */
    const allowed: Record<P28RunState, P28RunState[]> = {
      draft: ['running', 'failed'],
      running: ['awaiting_evidence', 'failed'],
      awaiting_evidence: ['running', 'failed'],
      score_proposed: ['failed'],
      score_reviewed: ['completed', 'failed'],
      interpretation_proposed: ['failed'],
      interpretation_reviewed: ['completed', 'failed'],
      completed: [],
      failed: ['running'],
    };

    if (!allowed[from]?.includes(to)) {
      throw Object.assign(new Error(`Invalid transition ${from} -> ${to}`), {
        code: 'P28_INVALID_TRANSITION',
        from,
        to,
      });
    }

    if (to === 'awaiting_evidence' && from === 'running') {
      state.degraded = {
        code: 'awaiting_evidence',
        message: meta?.reason || 'Missing or incomplete evidence inputs',
      };
    }

    if (to === 'running' && from === 'awaiting_evidence') {
      state.degraded = undefined;
    }

    if (to === 'completed') {
      if (from === 'interpretation_reviewed') {
        state.degraded = state.degraded?.acceptedForCompletion ? state.degraded : undefined;
      } else if (from === 'score_reviewed' && meta?.reason) {
        state.degraded = {
          code: 'completion_with_missing_interpretation',
          message: meta.reason,
          acceptedForCompletion: true,
        };
        state.audit.push({
          at: nowIso(),
          actorId: userId,
          action: 'complete_degraded',
          detail: meta.reason,
        });
      } else {
        throw Object.assign(
          new Error(
            'Complete requires interpretation_reviewed or score_reviewed + reason (bounded degraded)'
          ),
          { code: 'P28_COMPLETE_GUARD' }
        );
      }
      state.completedAt = nowIso();
    }

    state.pendingPromotion = null;
    state.runState = to;
    state.audit.push({
      at: nowIso(),
      actorId: userId,
      action: 'transition',
      detail: `${from} -> ${to}`,
    });
    await persistState(assessmentId, organizationId, state);

    // H1.3 — completion is the approval gate: automatically materialize DRAFT
    // initiatives from the assessment recommendations (replaces the manual-only
    // promoteWorkbench step). Fully fail-soft — a downstream initiative error must
    // never roll back or fail the completion the user just performed.
    if (to === 'completed') {
      try {
        const seedResult = await createInitiativesFromAssessmentRecommendations({
          assessmentId,
          organizationId,
          userId,
          state,
        });
        if (seedResult.created.length > 0 || seedResult.skippedDuplicates > 0) {
          state.audit.push({
            at: nowIso(),
            actorId: userId,
            action: 'initiatives_auto_created',
            detail: `created=${seedResult.created.length} skipped_dup=${seedResult.skippedDuplicates} batch=${
              seedResult.batchId || 'none'
            }`,
          });
          await persistState(assessmentId, organizationId, state);
        }
      } catch (seedErr) {
        logger.warn(
          '[AssessmentWorkbench] auto initiative creation failed (non-blocking)',
          seedErr
        );
      }
    }

    return state;
  }

  static async addEvidence(
    assessmentId: string,
    organizationId: string,
    userId: string,
    pointers: Omit<EvidencePointer, 'id'>[]
  ): Promise<P28WorkbenchState> {
    const { state } = await this.getMutable(assessmentId, organizationId);
    if (state.runState === 'completed') {
      throw Object.assign(new Error('RUN_READ_ONLY'), { code: 'P28_RUN_READ_ONLY' });
    }
    for (const p of pointers) {
      state.evidencePointers.push({
        ...p,
        id: uuidv4(),
        availability: p.availability ?? 'ok',
      });
    }
    state.audit.push({
      at: nowIso(),
      actorId: userId,
      action: 'evidence_add',
      detail: String(pointers.length),
    });
    await persistState(assessmentId, organizationId, state);
    return state;
  }

  static async proposeScore(
    assessmentId: string,
    organizationId: string,
    userId: string,
    input: {
      scoreValues: Record<string, number>;
      scoringRationale: string;
      evidencePointerIds: string[];
      assumptions: string[];
      confidence: number;
    }
  ): Promise<P28WorkbenchState> {
    const { state } = await this.getMutable(assessmentId, organizationId);
    if (state.runState === 'completed') {
      throw Object.assign(new Error('RUN_READ_ONLY'), { code: 'P28_RUN_READ_ONLY' });
    }
    if (!input.scoringRationale?.trim()) {
      throw Object.assign(new Error('rationale required'), { code: 'P28_RATIONALE_REQUIRED' });
    }
    const missing = (state.requiredEvidenceKinds || []).filter(
      (k) => !state.evidencePointers.some((e) => e.kind === k && e.availability !== 'unavailable')
    );
    if (missing.length) {
      state.runState = 'awaiting_evidence';
      state.degraded = {
        code: 'missing_required_evidence',
        message: 'Add required evidence before scoring',
        missingEvidenceKinds: missing,
      };
      state.audit.push({
        at: nowIso(),
        actorId: userId,
        action: 'score_blocked',
        detail: missing.join(','),
      });
      await persistState(assessmentId, organizationId, state);
      throw Object.assign(new Error('Missing required evidence'), {
        code: 'P28_AWAITING_EVIDENCE',
        missingEvidenceKinds: missing,
        whatNext: buildWhatNextGuidance(state),
      });
    }

    if (!input.evidencePointerIds.length) {
      throw Object.assign(new Error('Linked evidence pointers required'), {
        code: 'P28_EVIDENCE_POINTERS_REQUIRED',
      });
    }

    const invalidPointers = input.evidencePointerIds.filter(
      (pointerId) =>
        !state.evidencePointers.some(
          (pointer) => pointer.id === pointerId && pointer.availability !== 'unavailable'
        )
    );
    if (invalidPointers.length) {
      throw Object.assign(new Error('Invalid evidence pointers supplied'), {
        code: 'P28_EVIDENCE_POINTER_INVALID',
        invalidEvidencePointerIds: invalidPointers,
      });
    }

    const proposal: ScoreProposal = {
      id: uuidv4(),
      status: 'proposal',
      scoreValues: input.scoreValues,
      scoringRationale: input.scoringRationale,
      evidencePointerIds: input.evidencePointerIds,
      assumptions: input.assumptions || [],
      confidence: Math.max(0, Math.min(1, input.confidence)),
      proposedAt: nowIso(),
      proposedBy: userId,
    };
    state.scoreProposal = proposal;
    state.scoreReview = { status: 'pending' };
    state.runState = 'score_proposed';
    state.degraded = undefined;
    state.audit.push({
      at: nowIso(),
      actorId: userId,
      action: 'score_propose',
      detail: proposal.id,
    });
    await persistState(assessmentId, organizationId, state);
    return state;
  }

  static async reviewScore(
    assessmentId: string,
    organizationId: string,
    userId: string,
    body: {
      action: 'accept' | 'reject' | 'override';
      reason?: string;
      overrideScoreValues?: Record<string, number>;
    }
  ): Promise<P28WorkbenchState> {
    const { state } = await this.getMutable(assessmentId, organizationId);
    if (!state.scoreProposal) {
      throw Object.assign(new Error('No score proposal'), { code: 'P28_NO_SCORE_PROPOSAL' });
    }
    if (state.runState === 'completed') {
      throw Object.assign(new Error('RUN_READ_ONLY'), { code: 'P28_RUN_READ_ONLY' });
    }
    const t = nowIso();
    if (body.action === 'accept') {
      state.scoreReview = {
        status: 'accepted',
        decidedAt: t,
        decidedBy: userId,
        reason: body.reason,
      };
      state.runState = 'score_reviewed';
    } else if (body.action === 'override') {
      if (!body.overrideScoreValues || !Object.keys(body.overrideScoreValues).length) {
        throw Object.assign(new Error('override values required'), {
          code: 'P28_OVERRIDE_REQUIRED',
        });
      }
      state.scoreReview = {
        status: 'overridden',
        decidedAt: t,
        decidedBy: userId,
        reason: body.reason,
        overrideScoreValues: body.overrideScoreValues,
      };
      state.runState = 'score_reviewed';
      state.audit.push({
        at: t,
        actorId: userId,
        action: 'score_override',
        detail: JSON.stringify(body.overrideScoreValues),
      });
    } else {
      state.scoreReview = {
        status: 'rejected',
        decidedAt: t,
        decidedBy: userId,
        reason: body.reason,
      };
      state.scoreProposal = null;
      state.runState = 'running';
      state.audit.push({
        at: t,
        actorId: userId,
        action: 'score_reject',
        detail: body.reason || '',
      });
    }
    await persistState(assessmentId, organizationId, state);
    return state;
  }

  static async proposeInterpretation(
    assessmentId: string,
    organizationId: string,
    userId: string,
    input: {
      summary: string;
      keyFindings: string[];
      limits: string;
      nextActions: string[];
    }
  ): Promise<P28WorkbenchState> {
    const { state } = await this.getMutable(assessmentId, organizationId);
    if (state.runState === 'completed') {
      throw Object.assign(new Error('RUN_READ_ONLY'), { code: 'P28_RUN_READ_ONLY' });
    }
    if (state.runState !== 'score_reviewed') {
      throw Object.assign(new Error('Score must be reviewed first'), {
        code: 'P28_SCORE_REVIEW_GATE',
      });
    }
    if (!state.scoreProposal?.id) {
      throw Object.assign(new Error('Score proposal missing'), {
        code: 'P28_SCORE_PROPOSAL_MISSING',
      });
    }
    if (!input.limits?.trim()) {
      throw Object.assign(new Error('limits required (no overclaim)'), {
        code: 'P28_LIMITS_REQUIRED',
      });
    }
    const proposal: InterpretationProposal = {
      id: uuidv4(),
      status: 'proposal',
      summary: input.summary,
      keyFindings: input.keyFindings || [],
      limits: input.limits,
      nextActions: input.nextActions || [],
      linksToScoreProposalId: state.scoreProposal.id,
      proposedAt: nowIso(),
      proposedBy: userId,
    };
    state.interpretationProposal = proposal;
    state.interpretationReview = { status: 'pending' };
    state.runState = 'interpretation_proposed';
    state.audit.push({
      at: nowIso(),
      actorId: userId,
      action: 'interpretation_propose',
      detail: proposal.id,
    });
    await persistState(assessmentId, organizationId, state);
    return state;
  }

  static async reviewInterpretation(
    assessmentId: string,
    organizationId: string,
    userId: string,
    body: {
      action: 'accept' | 'reject' | 'override';
      reason?: string;
      overrideSummary?: string;
    }
  ): Promise<P28WorkbenchState> {
    const { state } = await this.getMutable(assessmentId, organizationId);
    if (!state.interpretationProposal) {
      throw Object.assign(new Error('No interpretation proposal'), {
        code: 'P28_NO_INTERPRETATION_PROPOSAL',
      });
    }
    if (state.runState === 'completed') {
      throw Object.assign(new Error('RUN_READ_ONLY'), { code: 'P28_RUN_READ_ONLY' });
    }
    const t = nowIso();
    if (body.action === 'accept') {
      state.interpretationReview = {
        status: 'accepted',
        decidedAt: t,
        decidedBy: userId,
        reason: body.reason,
      };
      state.runState = 'interpretation_reviewed';
    } else if (body.action === 'override') {
      if (!body.overrideSummary?.trim()) {
        throw Object.assign(new Error('override summary required'), {
          code: 'P28_INTERPRETATION_OVERRIDE_REQUIRED',
        });
      }
      state.interpretationReview = {
        status: 'overridden',
        decidedAt: t,
        decidedBy: userId,
        reason: body.reason,
        overrideSummary: body.overrideSummary,
      };
      state.runState = 'interpretation_reviewed';
    } else {
      state.interpretationReview = {
        status: 'rejected',
        decidedAt: t,
        decidedBy: userId,
        reason: body.reason,
      };
      state.interpretationProposal = null;
      state.runState = 'score_reviewed';
    }
    state.audit.push({
      at: t,
      actorId: userId,
      action: 'interpretation_review',
      detail: body.action,
    });
    await persistState(assessmentId, organizationId, state);
    return state;
  }

  static async recordPromotion(
    assessmentId: string,
    organizationId: string,
    userId: string,
    input: {
      targetKind: 'outputs_artifact' | 'interview_insight';
      targetRef: string;
      payloadSummary?: string;
    }
  ): Promise<P28WorkbenchState> {
    const { state } = await this.getMutable(assessmentId, organizationId);
    if (state.runState !== 'completed') {
      throw Object.assign(new Error('Complete run before promotion'), {
        code: 'P28_PROMOTION_GUARD',
      });
    }
    const validation = assertPromotionPayloadShape(state);
    if (validation.ok === false) {
      throw Object.assign(new Error('Promotion payload invalid'), {
        code: 'P28_PROMOTION_PAYLOAD_INVALID',
        validationErrors: validation.errors,
        whatNext: buildWhatNextGuidance(state),
      });
    }

    let targetRef = String(input.targetRef || '').trim();
    if (input.targetKind === 'interview_insight' && !targetRef) {
      targetRef = await createInsightProposalFromAssessment({
        assessmentId,
        organizationId,
        userId,
        state,
        requestedTargetRef: targetRef,
      });
    }
    const trace: PromotionTrace = {
      id: uuidv4(),
      fromAssessmentRunId: assessmentId,
      targetKind: input.targetKind,
      targetRef,
      createdAt: nowIso(),
      actorId: userId,
      payloadSummary: input.payloadSummary,
    };
    state.promotionTraces.push(trace);
    state.audit.push({
      at: nowIso(),
      actorId: userId,
      action: 'promotion',
      detail: `${input.targetKind}:${targetRef}`,
    });
    await persistState(assessmentId, organizationId, state);

    if (input.targetKind === 'outputs_artifact') {
      try {
        const payload = buildBoundedPromotionPayload(state);
        await artifactRegistryService.registerArtifactOrigin({
          organizationId,
          outputType: 'report',
          artifactFamily: 'document',
          // HOTFIX task#63 (UI-M5): a promoted assessment does NOT materialize a
          // report_builder_reports row, so it must NOT claim originRuntime 'report'
          // (that routes /reports/builder/{assessmentId} → empty "Add first block"
          // builder = looks like data loss). Use a distinct runtime that routes back
          // to the assessment run instead. See artifacts.routes.ts buildActionTargetPayload.
          originRuntime: 'assessment_report',
          originRecordId: assessmentId,
          titleSnapshot: `Assessment ${state.assessmentDefinitionRef.methodologyId} — ${assessmentId}`,
          ownerUserId: userId,
          createdBy: userId,
          deliveryState: 'draft',
          visibilityScope: 'organization',
          originSummary: {
            sourceType: 'ASSESSMENT',
            sourceId: assessmentId,
            nativeStatus: 'completed',
            promotionTraceId: trace.id,
            assessmentDefinitionId: payload.assessment_definition_id,
            limits: payload.limits,
          },
        });
        state.audit.push({
          at: nowIso(),
          actorId: userId,
          action: 'promotion_artifact_registered',
          detail: `outputs_library:${assessmentId}`,
        });
        state.pendingPromotion = null;
        await persistState(assessmentId, organizationId, state);
      } catch (e) {
        const payload = buildBoundedPromotionPayload(state);
        state.pendingPromotion = {
          targetKind: input.targetKind,
          targetRef,
          payload,
          failedAt: nowIso(),
          error: e instanceof Error ? e.message : 'Unknown downstream error',
        };
        state.degraded = {
          code: 'promotion_failed',
          message: 'Outputs handoff failed; retry after resolving downstream issue',
        };
        await persistState(assessmentId, organizationId, state);
        logger.warn(
          '[AssessmentWorkbench] promotion artifact registration failed (non-blocking)',
          e
        );
      }
    }

    if (input.targetKind === 'interview_insight') {
      state.pendingPromotion = null;
      await persistState(assessmentId, organizationId, state);
    }

    return state;
  }

  /** P28-B: jedna domknięta metodologia — ustaw wymagane evidence z presetu (np. DRD). */
  static async applyMethodologyPreset(
    assessmentId: string,
    organizationId: string,
    userId: string,
    presetKey: string
  ): Promise<P28WorkbenchState> {
    const preset = P28_METHODOLOGY_PRESETS[presetKey];
    if (!preset) {
      throw Object.assign(new Error(`Unknown methodology preset: ${presetKey}`), {
        code: 'P28_PRESET_UNKNOWN',
        knownPresets: Object.keys(P28_METHODOLOGY_PRESETS),
      });
    }
    return this.setRequiredEvidenceKinds(
      assessmentId,
      organizationId,
      userId,
      preset.requiredEvidenceKinds as unknown as string[]
    );
  }

  static async setRequiredEvidenceKinds(
    assessmentId: string,
    organizationId: string,
    userId: string,
    kinds: string[]
  ): Promise<P28WorkbenchState> {
    const { state } = await this.getMutable(assessmentId, organizationId);
    if (state.runState === 'completed') {
      throw Object.assign(new Error('RUN_READ_ONLY'), { code: 'P28_RUN_READ_ONLY' });
    }
    state.requiredEvidenceKinds = kinds;
    state.audit.push({
      at: nowIso(),
      actorId: userId,
      action: 'required_evidence_set',
      detail: kinds.join(','),
    });
    await persistState(assessmentId, organizationId, state);
    return state;
  }

  private static async getMutable(
    assessmentId: string,
    organizationId: string
  ): Promise<{ state: P28WorkbenchState }> {
    const ass = (await queryHelpers.queryOne<{
      p28?: string | null;
      assessment_type?: string;
      created_by?: string;
    }>(
      `SELECT p28_workbench_v1 as p28, assessment_type, created_by FROM assessments WHERE id = ? AND organization_id = ?`,
      [assessmentId, organizationId]
    )) as {
      p28?: string | null;
      assessment_type?: string;
      created_by?: string;
    } | null;
    if (!ass) {
      throw Object.assign(new Error('ASSESSMENT_NOT_FOUND'), { code: 'ASSESSMENT_NOT_FOUND' });
    }
    const state =
      parseState(ass.p28 ?? undefined) ||
      (await buildInitialWorkbench(
        assessmentId,
        organizationId,
        String(ass.assessment_type || 'DRD'),
        String(ass.created_by || '')
      ));
    return { state };
  }
}

export default AssessmentWorkbenchService;
