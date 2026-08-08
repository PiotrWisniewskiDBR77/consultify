import { createHash } from 'node:crypto';

import { v4 as uuidv4 } from 'uuid';

import type { PgTransactionClient } from '../../utils/queryHelpers.js';

export const INITIATIVE_LIFECYCLE_GATE_DOMAINS = [
  'SCHEDULE_MILESTONES',
  'GOVERNANCE_DECISION_MAKING',
  'CLOSURE',
] as const;

export type InitiativeLifecycleGateDomain = (typeof INITIATIVE_LIFECYCLE_GATE_DOMAINS)[number];
export type InitiativeLifecycleGateDecisionStatus = 'approved' | 'rejected';

export class InitiativeLifecycleGateDecisionError extends Error {
  constructor(
    public readonly code: string,
    public readonly statusCode: number,
    message: string
  ) {
    super(message);
    this.name = 'InitiativeLifecycleGateDecisionError';
  }
}

interface GateDecisionRow {
  decision_id: string;
  organization_id: string;
  initiative_id: string;
  transformation_case_id: string;
  pmo_domain: InitiativeLifecycleGateDomain;
  version: number;
  decision_status: InitiativeLifecycleGateDecisionStatus;
  source_digest: string;
  source_case_version: number;
  baseline_refs_json: unknown;
  a05_proposal_version_id: string;
  a05_approval_receipt_ref: string;
  human_actor_user_id: string;
  human_authority_ref: string;
  rationale: string;
  deadline_at: string;
  idempotency_key: string;
  input_digest: string;
  supersedes_decision_id: string | null;
  decided_at: string;
}

export interface InitiativeLifecycleGateDecision {
  decisionId: string;
  organizationId: string;
  initiativeId: string;
  transformationCaseId: string;
  pmoDomain: InitiativeLifecycleGateDomain;
  version: number;
  decisionStatus: InitiativeLifecycleGateDecisionStatus;
  sourceDigest: string;
  sourceCaseVersion: number;
  baselineRefs: string[];
  a05ProposalVersionId: string;
  a05ApprovalReceiptRef: string;
  humanActorUserId: string;
  humanAuthorityRef: string;
  rationale: string;
  deadlineAt: string;
  idempotencyKey: string;
  inputDigest: string;
  supersedesDecisionId: string | null;
  decidedAt: string;
}

export interface RecordInitiativeLifecycleGateDecisionInput {
  organizationId: string;
  initiativeId: string;
  transformationCaseId: string;
  pmoDomain: InitiativeLifecycleGateDomain;
  decisionStatus: InitiativeLifecycleGateDecisionStatus;
  sourceDigest: string;
  sourceCaseVersion: number;
  baselineRefs: string[];
  a05ProposalVersionId: string;
  /** Durable A05 scope-review row which approved this exact gate payload. */
  a05ApprovalReceiptRef: string;
  humanActorUserId: string;
  /** Exact A05 scope key under which this actor had reviewer authority. */
  humanAuthorityRef: string;
  rationale: string;
  deadlineAt: string;
  idempotencyKey: string;
}

export interface AssertCurrentApprovedGateDecisionInput {
  organizationId: string;
  initiativeId: string;
  pmoDomain: InitiativeLifecycleGateDomain;
  expectedDecisionId?: string;
  expectedTransformationCaseId?: string;
  expectedSourceDigest?: string;
  expectedSourceCaseVersion?: number;
  expectedBaselineRefs?: string[];
  expectedA05ApprovalReceiptRef?: string;
  now?: Date;
}

function required(value: unknown, field: string): string {
  const normalized = String(value ?? '').trim();
  if (!normalized) {
    throw new InitiativeLifecycleGateDecisionError(
      'INITIATIVE_GATE_DECISION_INVALID_INPUT',
      400,
      `${field} is required`
    );
  }
  return normalized;
}

function normalizeDomain(value: unknown): InitiativeLifecycleGateDomain {
  const domain = required(value, 'pmoDomain').toUpperCase();
  if (!(INITIATIVE_LIFECYCLE_GATE_DOMAINS as readonly string[]).includes(domain)) {
    throw new InitiativeLifecycleGateDecisionError(
      'INITIATIVE_GATE_DECISION_DOMAIN_INVALID',
      400,
      `Unsupported Initiative lifecycle gate domain: ${domain}`
    );
  }
  return domain as InitiativeLifecycleGateDomain;
}

function normalizeDigest(value: unknown, field: string): string {
  const digest = required(value, field).toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(digest)) {
    throw new InitiativeLifecycleGateDecisionError(
      'INITIATIVE_GATE_DECISION_DIGEST_INVALID',
      400,
      `${field} must be a SHA-256 hex digest`
    );
  }
  return digest;
}

function normalizeCaseVersion(value: unknown): number {
  const version = Number(value);
  if (!Number.isInteger(version) || version < 1) {
    throw new InitiativeLifecycleGateDecisionError(
      'INITIATIVE_GATE_DECISION_CASE_VERSION_INVALID',
      400,
      'sourceCaseVersion must be a positive integer'
    );
  }
  return version;
}

function normalizeBaselineRefs(value: unknown): string[] {
  if (!Array.isArray(value)) {
    throw new InitiativeLifecycleGateDecisionError(
      'INITIATIVE_GATE_DECISION_BASELINE_REFS_REQUIRED',
      400,
      'baselineRefs must contain at least one immutable baseline reference'
    );
  }
  const refs = Array.from(
    new Set(value.map((item) => String(item ?? '').trim()).filter(Boolean))
  ).sort();
  if (refs.length === 0) {
    throw new InitiativeLifecycleGateDecisionError(
      'INITIATIVE_GATE_DECISION_BASELINE_REFS_REQUIRED',
      400,
      'baselineRefs must contain at least one immutable baseline reference'
    );
  }
  return refs;
}

function normalizeDeadline(value: unknown): string {
  const parsed = new Date(required(value, 'deadlineAt'));
  if (!Number.isFinite(parsed.getTime())) {
    throw new InitiativeLifecycleGateDecisionError(
      'INITIATIVE_GATE_DECISION_DEADLINE_INVALID',
      400,
      'deadlineAt must be a valid timestamp'
    );
  }
  return parsed.toISOString();
}

function normalizeInput(input: RecordInitiativeLifecycleGateDecisionInput) {
  const decisionStatus = required(input.decisionStatus, 'decisionStatus').toLowerCase();
  if (decisionStatus !== 'approved' && decisionStatus !== 'rejected') {
    throw new InitiativeLifecycleGateDecisionError(
      'INITIATIVE_GATE_DECISION_STATUS_INVALID',
      400,
      'decisionStatus must be approved or rejected'
    );
  }
  return {
    organizationId: required(input.organizationId, 'organizationId'),
    initiativeId: required(input.initiativeId, 'initiativeId'),
    transformationCaseId: required(input.transformationCaseId, 'transformationCaseId'),
    pmoDomain: normalizeDomain(input.pmoDomain),
    decisionStatus: decisionStatus as InitiativeLifecycleGateDecisionStatus,
    sourceDigest: normalizeDigest(input.sourceDigest, 'sourceDigest'),
    sourceCaseVersion: normalizeCaseVersion(input.sourceCaseVersion),
    baselineRefs: normalizeBaselineRefs(input.baselineRefs),
    a05ProposalVersionId: required(input.a05ProposalVersionId, 'a05ProposalVersionId'),
    a05ApprovalReceiptRef: required(input.a05ApprovalReceiptRef, 'a05ApprovalReceiptRef'),
    humanActorUserId: required(input.humanActorUserId, 'humanActorUserId'),
    humanAuthorityRef: required(input.humanAuthorityRef, 'humanAuthorityRef'),
    rationale: required(input.rationale, 'rationale'),
    deadlineAt: normalizeDeadline(input.deadlineAt),
    idempotencyKey: required(input.idempotencyKey, 'idempotencyKey'),
  };
}

function parseJsonArray(value: unknown): string[] {
  const parsed = typeof value === 'string' ? JSON.parse(value) : value;
  return Array.isArray(parsed) ? parsed.map(String) : [];
}

function fromRow(row: GateDecisionRow): InitiativeLifecycleGateDecision {
  return {
    decisionId: row.decision_id,
    organizationId: row.organization_id,
    initiativeId: row.initiative_id,
    transformationCaseId: row.transformation_case_id,
    pmoDomain: row.pmo_domain,
    version: Number(row.version),
    decisionStatus: row.decision_status,
    sourceDigest: row.source_digest,
    sourceCaseVersion: Number(row.source_case_version),
    baselineRefs: parseJsonArray(row.baseline_refs_json),
    a05ProposalVersionId: row.a05_proposal_version_id,
    a05ApprovalReceiptRef: row.a05_approval_receipt_ref,
    humanActorUserId: row.human_actor_user_id,
    humanAuthorityRef: row.human_authority_ref,
    rationale: row.rationale,
    deadlineAt: row.deadline_at,
    idempotencyKey: row.idempotency_key,
    inputDigest: row.input_digest,
    supersedesDecisionId: row.supersedes_decision_id,
    decidedAt: row.decided_at,
  };
}

export function buildInitiativeLifecycleGateDecisionInputDigest(
  input: RecordInitiativeLifecycleGateDecisionInput
): string {
  const normalized = normalizeInput(input);
  return createHash('sha256')
    .update(
      JSON.stringify({
        organizationId: normalized.organizationId,
        initiativeId: normalized.initiativeId,
        transformationCaseId: normalized.transformationCaseId,
        pmoDomain: normalized.pmoDomain,
        decisionStatus: normalized.decisionStatus,
        sourceDigest: normalized.sourceDigest,
        sourceCaseVersion: normalized.sourceCaseVersion,
        baselineRefs: normalized.baselineRefs,
        a05ProposalVersionId: normalized.a05ProposalVersionId,
        a05ApprovalReceiptRef: normalized.a05ApprovalReceiptRef,
        humanActorUserId: normalized.humanActorUserId,
        humanAuthorityRef: normalized.humanAuthorityRef,
        rationale: normalized.rationale,
        deadlineAt: normalized.deadlineAt,
      })
    )
    .digest('hex');
}

/**
 * Shared lock contract for both the gate-decision owner and the Initiative
 * transition engine.  It must be acquired on the caller's pinned transaction
 * client before either appends a decision or evaluates the current version.
 */
export async function acquireInitiativeLifecycleGateAdvisoryLock(
  client: PgTransactionClient,
  input: {
    organizationId: string;
    initiativeId: string;
    pmoDomain: InitiativeLifecycleGateDomain;
  }
): Promise<void> {
  await client.query(
    `SELECT pg_advisory_xact_lock(hashtextextended(? || ':' || ? || ':' || ?, 0))`,
    [
      required(input.organizationId, 'organizationId'),
      required(input.initiativeId, 'initiativeId'),
      normalizeDomain(input.pmoDomain),
    ]
  );
}

async function readCurrentUnlocked(
  client: PgTransactionClient,
  input: {
    organizationId: string;
    initiativeId: string;
    pmoDomain: InitiativeLifecycleGateDomain;
  }
): Promise<InitiativeLifecycleGateDecision | null> {
  const result = await client.query<GateDecisionRow>(
    `SELECT * FROM initiative_lifecycle_gate_decisions
      WHERE organization_id=? AND initiative_id=? AND pmo_domain=?
      ORDER BY version DESC
      LIMIT 1`,
    [input.organizationId, input.initiativeId, input.pmoDomain]
  );
  return result.rows[0] ? fromRow(result.rows[0]) : null;
}

export async function readCurrentInitiativeLifecycleGateDecision(
  client: PgTransactionClient,
  input: {
    organizationId: string;
    initiativeId: string;
    pmoDomain: InitiativeLifecycleGateDomain;
  }
): Promise<InitiativeLifecycleGateDecision | null> {
  const normalized = {
    organizationId: required(input.organizationId, 'organizationId'),
    initiativeId: required(input.initiativeId, 'initiativeId'),
    pmoDomain: normalizeDomain(input.pmoDomain),
  };
  await acquireInitiativeLifecycleGateAdvisoryLock(client, normalized);
  return readCurrentUnlocked(client, normalized);
}

export async function recordInitiativeLifecycleGateDecision(
  client: PgTransactionClient,
  input: RecordInitiativeLifecycleGateDecisionInput
): Promise<{ decision: InitiativeLifecycleGateDecision; idempotentReplay: boolean }> {
  const normalized = normalizeInput(input);
  const inputDigest = buildInitiativeLifecycleGateDecisionInputDigest(input);

  await acquireInitiativeLifecycleGateAdvisoryLock(client, normalized);

  const replay = (
    await client.query<GateDecisionRow>(
      `SELECT * FROM initiative_lifecycle_gate_decisions
        WHERE organization_id=? AND idempotency_key=?
        FOR SHARE`,
      [normalized.organizationId, normalized.idempotencyKey]
    )
  ).rows[0];
  if (replay) {
    if (replay.input_digest !== inputDigest) {
      throw new InitiativeLifecycleGateDecisionError(
        'INITIATIVE_GATE_DECISION_IDEMPOTENCY_CONFLICT',
        409,
        'Idempotency-Key payload conflict'
      );
    }
    return { decision: fromRow(replay), idempotentReplay: true };
  }

  if (new Date(normalized.deadlineAt).getTime() <= Date.now()) {
    throw new InitiativeLifecycleGateDecisionError(
      'INITIATIVE_GATE_DECISION_DEADLINE_EXPIRED',
      409,
      'A new lifecycle gate decision must be recorded within its deadline'
    );
  }

  const humanActor = (
    await client.query<{ id: string }>(
      `SELECT id FROM users
        WHERE id=? AND organization_id=?
          AND LOWER(COALESCE(status,'active'))='active'
        FOR SHARE`,
      [normalized.humanActorUserId, normalized.organizationId]
    )
  ).rows[0];
  if (!humanActor) {
    throw new InitiativeLifecycleGateDecisionError(
      'INITIATIVE_GATE_DECISION_HUMAN_ACTOR_REQUIRED',
      403,
      'An active tenant human must own the lifecycle gate decision'
    );
  }

  const lineage = (
    await client.query<{ case_version: number }>(
      `SELECT c.version AS case_version
         FROM transformation_cases c
         JOIN transformation_case_artifact_links l
           ON l.transformation_case_id=c.transformation_case_id
          AND l.organization_id=c.organization_id
          AND l.artifact_type='initiative'
          AND l.artifact_id=?
         JOIN initiatives i
           ON i.id=l.artifact_id AND i.organization_id=l.organization_id
        WHERE c.transformation_case_id=? AND c.organization_id=?
        LIMIT 1
        FOR SHARE OF c,l,i`,
      [normalized.initiativeId, normalized.transformationCaseId, normalized.organizationId]
    )
  ).rows[0];
  if (!lineage) {
    throw new InitiativeLifecycleGateDecisionError(
      'INITIATIVE_GATE_DECISION_CASE_LINEAGE_INVALID',
      404,
      'Tenant-scoped Transformation Case to Initiative lineage was not found'
    );
  }
  if (Number(lineage.case_version) !== normalized.sourceCaseVersion) {
    throw new InitiativeLifecycleGateDecisionError(
      'INITIATIVE_GATE_DECISION_CASE_VERSION_CONFLICT',
      409,
      `Expected Case version ${normalized.sourceCaseVersion}, current version is ${lineage.case_version}`
    );
  }

  const a05Approval = (
    await client.query<{
      proposal_status: string;
      expires_at: string;
      review_id: string;
    }>(
      `SELECT p.status AS proposal_status,p.expires_at,r.review_id
         FROM v8_agent_proposal_versions p
         JOIN v8_agent_proposal_scope_reviews r
           ON r.proposal_version_id=p.proposal_version_id
         JOIN v8_agent_run_identities ri
           ON ri.canonical_run_id=p.canonical_run_id
          AND ri.organization_id=p.organization_id
        WHERE p.proposal_version_id=?
          AND p.organization_id=?
          AND ri.transformation_case_id=?
          AND r.review_id=?
          AND r.scope_key=?
          AND r.decision='approved'
          AND r.reviewed_by_user_id=?
        LIMIT 1
        FOR SHARE OF p,r,ri`,
      [
        normalized.a05ProposalVersionId,
        normalized.organizationId,
        normalized.transformationCaseId,
        normalized.a05ApprovalReceiptRef,
        normalized.humanAuthorityRef,
        normalized.humanActorUserId,
      ]
    )
  ).rows[0];
  if (
    !a05Approval ||
    a05Approval.proposal_status !== 'approved' ||
    new Date(a05Approval.expires_at).getTime() <= Date.now()
  ) {
    throw new InitiativeLifecycleGateDecisionError(
      'INITIATIVE_GATE_DECISION_A05_APPROVAL_REQUIRED',
      403,
      'A current exact-scope A05 approval by the human actor is required'
    );
  }

  const current = await readCurrentUnlocked(client, normalized);
  const version = (current?.version ?? 0) + 1;
  const decisionId = uuidv4();
  const decidedAt = new Date().toISOString();
  const inserted = (
    await client.query<GateDecisionRow>(
      `INSERT INTO initiative_lifecycle_gate_decisions (
         decision_id,organization_id,initiative_id,transformation_case_id,pmo_domain,
         version,decision_status,source_digest,source_case_version,baseline_refs_json,
         a05_proposal_version_id,a05_approval_receipt_ref,human_actor_user_id,
         human_authority_ref,rationale,deadline_at,idempotency_key,input_digest,
         supersedes_decision_id,decided_at
       ) VALUES (?,?,?,?,?,?,?,?,?,?::jsonb,?,?,?,?,?,?,?,?,?,?)
       RETURNING *`,
      [
        decisionId,
        normalized.organizationId,
        normalized.initiativeId,
        normalized.transformationCaseId,
        normalized.pmoDomain,
        version,
        normalized.decisionStatus,
        normalized.sourceDigest,
        normalized.sourceCaseVersion,
        JSON.stringify(normalized.baselineRefs),
        normalized.a05ProposalVersionId,
        normalized.a05ApprovalReceiptRef,
        normalized.humanActorUserId,
        normalized.humanAuthorityRef,
        normalized.rationale,
        normalized.deadlineAt,
        normalized.idempotencyKey,
        inputDigest,
        current?.decisionId ?? null,
        decidedAt,
      ]
    )
  ).rows[0];
  if (!inserted) {
    throw new InitiativeLifecycleGateDecisionError(
      'INITIATIVE_GATE_DECISION_WRITE_FAILED',
      500,
      'Lifecycle gate decision was not persisted'
    );
  }
  return { decision: fromRow(inserted), idempotentReplay: false };
}

export async function assertCurrentApprovedInitiativeLifecycleGateDecision(
  client: PgTransactionClient,
  input: AssertCurrentApprovedGateDecisionInput
): Promise<InitiativeLifecycleGateDecision> {
  const current = await readCurrentInitiativeLifecycleGateDecision(client, input);
  if (!current) {
    throw new InitiativeLifecycleGateDecisionError(
      'INITIATIVE_GATE_DECISION_NOT_FOUND',
      409,
      `No current ${input.pmoDomain} lifecycle gate decision exists`
    );
  }
  if (current.decisionStatus !== 'approved') {
    throw new InitiativeLifecycleGateDecisionError(
      'INITIATIVE_GATE_DECISION_NOT_APPROVED',
      409,
      `Current ${input.pmoDomain} lifecycle gate decision is not approved`
    );
  }
  if (new Date(current.deadlineAt).getTime() <= (input.now ?? new Date()).getTime()) {
    throw new InitiativeLifecycleGateDecisionError(
      'INITIATIVE_GATE_DECISION_EXPIRED',
      409,
      `Current ${input.pmoDomain} lifecycle gate decision is expired`
    );
  }

  const drift =
    (input.expectedDecisionId !== undefined && current.decisionId !== input.expectedDecisionId) ||
    (input.expectedTransformationCaseId !== undefined &&
      current.transformationCaseId !== input.expectedTransformationCaseId) ||
    (input.expectedSourceDigest !== undefined &&
      current.sourceDigest !==
        normalizeDigest(input.expectedSourceDigest, 'expectedSourceDigest')) ||
    (input.expectedSourceCaseVersion !== undefined &&
      current.sourceCaseVersion !== normalizeCaseVersion(input.expectedSourceCaseVersion)) ||
    (input.expectedA05ApprovalReceiptRef !== undefined &&
      current.a05ApprovalReceiptRef !== input.expectedA05ApprovalReceiptRef) ||
    (input.expectedBaselineRefs !== undefined &&
      JSON.stringify(normalizeBaselineRefs(current.baselineRefs)) !==
        JSON.stringify(normalizeBaselineRefs(input.expectedBaselineRefs)));
  if (drift) {
    throw new InitiativeLifecycleGateDecisionError(
      'INITIATIVE_GATE_DECISION_SOURCE_DRIFT',
      409,
      'Current lifecycle gate decision does not match the pinned source contract'
    );
  }
  return current;
}
