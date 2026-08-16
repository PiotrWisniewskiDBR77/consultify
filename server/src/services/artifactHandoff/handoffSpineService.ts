/**
 * Lane C (closure) — governed handoff spine.
 *
 * ONE service every Lane C producer (Idea, Chat, Meeting, Organization) uses
 * to propose an artifact -> get a HUMAN to approve/reject it -> materialize
 * EXACTLY ONE object, plus a hash-bound export receipt for the separate
 * "turn an existing artifact into downloadable bytes" concern.
 *
 * WHY THIS FILE EXISTS: see the header of
 * `server/migrations/20260912_claude_c_handoff_spine.sql` — the four Lane C
 * producers each independently reinvented (or omitted) this exact spine, with
 * the same three gaps every time: no idempotency key, no human-approval
 * invariant, no exactly-one-receipt guarantee. This service is the single
 * place that gap gets closed, generalizing the ALREADY-PROVEN shape from
 * `944_canvas_idea_materialization_receipts.sql` / `canvasMaterialize.ts`
 * (partial unique index on `(organization_id, idempotency_key)` as both dedup
 * ledger and concurrent-winner arbiter) rather than inventing a new one.
 *
 * ── WHY EVERY WRITE HERE GOES THROUGH `withPgTransaction`, NOT `queryHelpers`
 * `queryHelpers.queryRun`/`queryOne` each check out a connection from the
 * shared pool independently per call — fine for a single autocommit
 * statement, but every mutation in this file needs one of:
 *   (a) a `SELECT ... FOR UPDATE` row lock immediately followed by a
 *       dependent write (the CAS approve/reject and exactly-once materialize
 *       guarantees), or
 *   (b) a `SAVEPOINT` around an INSERT that may hit a unique-index race, so
 *       the loser can recover on the SAME connection instead of aborting the
 *       whole transaction (the createProposal / materializeProposal /
 *       recordExportReceipt idempotency races).
 * Both require ONE pinned connection for the whole sequence — exactly what
 * `withPgTransaction` gives (see its doc comment in `PostgresDatabase.ts` and
 * the M01-P07C rationale in `canvasMaterialize.ts`, which hit this exact bug
 * using two independent pooled calls). `queryOne`/`queryAll`/`queryRun` would
 * silently be wrong here, not just less convenient.
 */

import { createHash, randomUUID } from 'crypto';

import { withPgTransaction } from '../../database/PostgresDatabase.js';
import logger from '../../utils/Logger.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export const PRODUCER_KINDS = ['idea', 'chat', 'meeting', 'organization'] as const;
export type ProducerKind = (typeof PRODUCER_KINDS)[number];

export const TARGET_KINDS = ['document', 'presentation', 'workbook', 'material'] as const;
export type TargetKind = (typeof TARGET_KINDS)[number];

export const PROPOSAL_STATES = ['pending', 'approved', 'rejected', 'materialized', 'failed'] as const;
export type ProposalState = (typeof PROPOSAL_STATES)[number];

export const EXPORT_ARTIFACT_KINDS = ['document', 'workbook', 'presentation'] as const;
export type ExportArtifactKind = (typeof EXPORT_ARTIFACT_KINDS)[number];

export const EXPORT_STATUSES = ['pending', 'succeeded', 'failed', 'unavailable'] as const;
export type ExportStatus = (typeof EXPORT_STATUSES)[number];

export interface HandoffProposal {
  proposalId: string;
  organizationId: string;
  producerKind: ProducerKind;
  producerRecordId: string;
  sourceContentHash: string;
  sourceVersion: number;
  contractVersion: string;
  targetKind: TargetKind;
  payload: unknown;
  state: ProposalState;
  createdBy: string;
  createdAt: string;
  decidedBy: string | null;
  decidedAt: string | null;
  decisionReason: string | null;
  selfApproved: boolean;
  idempotencyKey: string | null;
  updatedAt: string;
}

export interface HandoffReceipt {
  receiptId: string;
  organizationId: string;
  proposalId: string;
  targetKind: TargetKind;
  targetRecordId: string;
  outputContentHash: string | null;
  materializedBy: string;
  materializedAt: string;
}

export interface ExportReceipt {
  exportReceiptId: string;
  organizationId: string;
  artifactKind: ExportArtifactKind;
  sourceRecordId: string;
  sourceVersion: number;
  sourceContentHash: string;
  outputFormat: string;
  providerKey: string;
  providerJobId: string | null;
  status: ExportStatus;
  failureCode: string | null;
  outputByteSize: number | null;
  outputContentHash: string | null;
  idempotencyKey: string | null;
  createdBy: string;
  createdAt: string;
  completedAt: string | null;
}

export class HandoffSpineError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = 'HandoffSpineError';
  }
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

export function isProducerKind(value: unknown): value is ProducerKind {
  return typeof value === 'string' && (PRODUCER_KINDS as readonly string[]).includes(value);
}

export function isTargetKind(value: unknown): value is TargetKind {
  return typeof value === 'string' && (TARGET_KINDS as readonly string[]).includes(value);
}

export function isExportArtifactKind(value: unknown): value is ExportArtifactKind {
  return typeof value === 'string' && (EXPORT_ARTIFACT_KINDS as readonly string[]).includes(value);
}

function requireNonEmpty(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new HandoffSpineError(`${field} is required`, 'INVALID_ARGUMENT');
  }
  return value;
}

/**
 * The human-approval invariant is DB-enforced (`decided_by IS NOT NULL` for
 * any non-pending/failed state), but the DB cannot tell a real human actor id
 * apart from the literal string 'system' — the established non-human-actor
 * sentinel used throughout this codebase (see e.g. `userId || 'system'` in
 * `notebookService.ts`, `actorType: 'system'` in `dunningService.ts`). This
 * function closes that gap at the application layer: a caller cannot record
 * an "approval" attributed to an automated actor.
 */
function requireHumanActor(value: unknown, field: string): string {
  const actor = requireNonEmpty(value, field);
  const normalized = actor.trim().toLowerCase();
  if (normalized === 'system' || normalized === 'null' || normalized === 'undefined') {
    throw new HandoffSpineError(
      `${field} must be a real human actor id, not a system/automated actor ('${actor}')`,
      'NOT_A_HUMAN_ACTOR'
    );
  }
  return actor;
}

function normalizeOptionalKey(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}

/** Postgres error shape carrying a `code`/`constraint` (from the `pg` driver). */
interface PgDriverError {
  code?: string;
  constraint?: string;
}

/**
 * Same idiom as `canvasMaterialize.ts`'s `isUniqueViolationOn`: distinguishes
 * "a concurrent winner already claimed this idempotency key" (23505 on the
 * NAMED index) from any other constraint violation, which must always
 * rethrow rather than being silently swallowed as a false replay.
 */
function isUniqueViolationOn(err: unknown, constraintName: string): boolean {
  if (!err || typeof err !== 'object') return false;
  const pgErr = err as PgDriverError;
  return pgErr.code === '23505' && pgErr.constraint === constraintName;
}

// ---------------------------------------------------------------------------
// (1) canonicalSourceHash — deterministic hash of the payload a human approves
// ---------------------------------------------------------------------------

/**
 * Recursively sorts object keys (arrays keep their order — order is
 * semantically meaningful for arrays, not for object key order) so that two
 * logically identical payloads always canonicalize to the same JSON text
 * regardless of how their keys were originally ordered.
 */
function canonicalizeForHash(value: unknown): unknown {
  if (value === undefined) return null;
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(canonicalizeForHash);
  const source = value as Record<string, unknown>;
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(source).sort()) {
    if (source[key] === undefined) continue;
    sorted[key] = canonicalizeForHash(source[key]);
  }
  return sorted;
}

/**
 * sha256 hex of the CANONICALIZED source payload. Load-bearing: this is the
 * hash pinned into `artifact_handoff_proposals.source_content_hash` at
 * proposal time, so a later edit to the source cannot silently change what a
 * human already signed off on. Must be deterministic under key reordering —
 * that is the entire point of `canonicalizeForHash`.
 */
export function canonicalSourceHash(payload: unknown): string {
  const canonicalJson = JSON.stringify(canonicalizeForHash(payload));
  return createHash('sha256').update(canonicalJson).digest('hex');
}

// ---------------------------------------------------------------------------
// Row mapping (snake_case DB columns -> camelCase service types)
// ---------------------------------------------------------------------------

interface ProposalRow {
  proposal_id: string;
  organization_id: string;
  producer_kind: string;
  producer_record_id: string;
  source_content_hash: string;
  source_version: number;
  contract_version: string;
  target_kind: string;
  payload_json: string;
  state: string;
  created_by: string;
  created_at: Date | string;
  decided_by: string | null;
  decided_at: Date | string | null;
  decision_reason: string | null;
  self_approved: boolean;
  idempotency_key: string | null;
  updated_at: Date | string;
}

interface ReceiptRow {
  receipt_id: string;
  organization_id: string;
  proposal_id: string;
  target_kind: string;
  target_record_id: string;
  output_content_hash: string | null;
  materialized_by: string;
  materialized_at: Date | string;
}

interface ExportReceiptRow {
  export_receipt_id: string;
  organization_id: string;
  artifact_kind: string;
  source_record_id: string;
  source_version: number;
  source_content_hash: string;
  output_format: string;
  provider_key: string;
  provider_job_id: string | null;
  status: string;
  failure_code: string | null;
  output_byte_size: number | null;
  output_content_hash: string | null;
  idempotency_key: string | null;
  created_by: string;
  created_at: Date | string;
  completed_at: Date | string | null;
}

/** All timestamp columns in this spine are TIMESTAMPTZ, so a plain
 * `.toISOString()` is correct — unlike the naive-TIMESTAMP "local midnight"
 * trap documented in `artifactLineageService.ts`'s `pgTimestampToUtcIso`,
 * which does not apply here because these columns carry a real offset. */
function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

function toIsoOrNull(value: Date | string | null): string | null {
  return value === null ? null : toIso(value);
}

function parseJsonOrNull(value: string): unknown {
  if (typeof value !== 'string' || value === '') return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function mapProposalRow(row: ProposalRow): HandoffProposal {
  return {
    proposalId: row.proposal_id,
    organizationId: row.organization_id,
    producerKind: row.producer_kind as ProducerKind,
    producerRecordId: row.producer_record_id,
    sourceContentHash: row.source_content_hash,
    sourceVersion: Number(row.source_version),
    contractVersion: row.contract_version,
    targetKind: row.target_kind as TargetKind,
    payload: parseJsonOrNull(row.payload_json),
    state: row.state as ProposalState,
    createdBy: row.created_by,
    createdAt: toIso(row.created_at),
    decidedBy: row.decided_by,
    decidedAt: toIsoOrNull(row.decided_at),
    decisionReason: row.decision_reason,
    selfApproved: Boolean(row.self_approved),
    idempotencyKey: row.idempotency_key,
    updatedAt: toIso(row.updated_at),
  };
}

function mapReceiptRow(row: ReceiptRow): HandoffReceipt {
  return {
    receiptId: row.receipt_id,
    organizationId: row.organization_id,
    proposalId: row.proposal_id,
    targetKind: row.target_kind as TargetKind,
    targetRecordId: row.target_record_id,
    outputContentHash: row.output_content_hash,
    materializedBy: row.materialized_by,
    materializedAt: toIso(row.materialized_at),
  };
}

function mapExportReceiptRow(row: ExportReceiptRow): ExportReceipt {
  return {
    exportReceiptId: row.export_receipt_id,
    organizationId: row.organization_id,
    artifactKind: row.artifact_kind as ExportArtifactKind,
    sourceRecordId: row.source_record_id,
    sourceVersion: Number(row.source_version),
    sourceContentHash: row.source_content_hash,
    outputFormat: row.output_format,
    providerKey: row.provider_key,
    providerJobId: row.provider_job_id,
    status: row.status as ExportStatus,
    failureCode: row.failure_code,
    outputByteSize: row.output_byte_size === null ? null : Number(row.output_byte_size),
    outputContentHash: row.output_content_hash,
    idempotencyKey: row.idempotency_key,
    createdBy: row.created_by,
    createdAt: toIso(row.created_at),
    completedAt: toIsoOrNull(row.completed_at),
  };
}

// ---------------------------------------------------------------------------
// (2) createProposal
// ---------------------------------------------------------------------------

const PROPOSAL_IDEM_INDEX = 'idx_handoff_proposal_org_idem';

/**
 * `server/migrations/20260912_claude_c_handoff_spine_version_unique.sql` —
 * closes the race `SELECT ... FOR UPDATE` cannot by itself: Postgres cannot
 * lock rows that do not exist yet, so two concurrent FIRST-TIME proposals
 * for a brand-new `(organizationId, producerKind, producerRecordId)` triple
 * (no idempotency key — that path is already deduplicated separately) could
 * both observe zero existing rows and both compute the same "next version".
 * `createProposal` catches a violation on THIS index by name and retries
 * once with a freshly recomputed version — see the migration header and the
 * `RETRY_ON_VERSION_COLLISION` loop below.
 */
const PROPOSAL_VERSION_UNIQUE_INDEX = 'idx_handoff_proposal_version_unique';

export interface CreateProposalInput {
  organizationId: string;
  producerKind: ProducerKind;
  producerRecordId: string;
  targetKind: TargetKind;
  payload: unknown;
  createdBy: string;
  idempotencyKey?: string | null;
  contractVersion?: string;
}

export interface CreateProposalResult {
  proposal: HandoffProposal;
  replayed: boolean;
}

/**
 * Proposes a new handoff. `source_content_hash` pins the exact bytes a human
 * will later approve; `source_version` is the next monotonic version for the
 * same (organizationId, producerKind, producerRecordId) triple.
 *
 * Idempotency: when `idempotencyKey` is supplied and a concurrent/earlier
 * call already committed a row for the SAME (organizationId, idempotencyKey)
 * pair, this returns THAT row with `replayed: true` instead of creating a
 * second proposal — detected by name against `idx_handoff_proposal_org_idem`
 * (see the migration header — the index name and this check must stay in
 * sync). Any OTHER constraint violation (e.g. the producer/target check
 * constraints) rethrows untouched.
 */
export async function createProposal(input: CreateProposalInput): Promise<CreateProposalResult> {
  const organizationId = requireNonEmpty(input.organizationId, 'organizationId');
  const producerRecordId = requireNonEmpty(input.producerRecordId, 'producerRecordId');
  const createdBy = requireNonEmpty(input.createdBy, 'createdBy');
  if (!isProducerKind(input.producerKind)) {
    throw new HandoffSpineError('producerKind is invalid', 'INVALID_ARGUMENT');
  }
  if (!isTargetKind(input.targetKind)) {
    throw new HandoffSpineError('targetKind is invalid', 'INVALID_ARGUMENT');
  }

  const sourceContentHash = canonicalSourceHash(input.payload);
  const idempotencyKey = normalizeOptionalKey(input.idempotencyKey);
  const contractVersion =
    typeof input.contractVersion === 'string' && input.contractVersion.trim() !== ''
      ? input.contractVersion
      : 'v1';
  const payloadJson = JSON.stringify(input.payload ?? null);
  const producerKind = input.producerKind;
  const targetKind = input.targetKind;

  return withPgTransaction(async (query) => {
    const proposalId = randomUUID();

    // RETRY_ON_VERSION_COLLISION: at most one retry. Attempt 1 covers the
    // common case (including "another proposal already exists for this
    // producer", which the FOR UPDATE lock below fully serializes). Attempt
    // 2 exists ONLY for the first-proposal race described at
    // `PROPOSAL_VERSION_UNIQUE_INDEX` above, where nothing existed to lock
    // on attempt 1. If attempt 2 ALSO collides (a third concurrent racer),
    // this rethrows rather than looping forever — a caller can retry the
    // whole `createProposal` call, same as any other transient conflict.
    const MAX_ATTEMPTS = 2;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      // Lock every existing row for this producer triple so concurrent
      // createProposal calls for the SAME producer serialize their version
      // allocation instead of both computing the same "next" version.
      // (Cannot lock rows that don't exist yet — that's exactly the gap
      // `idx_handoff_proposal_version_unique` + this retry loop close.)
      const existing = await query<{ source_version: number }>(
        `SELECT source_version FROM artifact_handoff_proposals
          WHERE organization_id = $1 AND producer_kind = $2 AND producer_record_id = $3
          FOR UPDATE`,
        [organizationId, producerKind, producerRecordId]
      );
      const nextVersion =
        existing.rows.reduce((max, row) => Math.max(max, Number(row.source_version) || 0), 0) + 1;

      // SAVEPOINT so a unique-violation (idempotency-key race OR
      // version race) can be undone WITHOUT aborting the whole transaction —
      // same idiom as `canvasMaterialize.ts`'s `SAVEPOINT idea_materialize`.
      await query('SAVEPOINT handoff_proposal_insert');
      try {
        await query(
          `INSERT INTO artifact_handoff_proposals (
             proposal_id, organization_id, producer_kind, producer_record_id,
             source_content_hash, source_version, contract_version, target_kind,
             payload_json, state, created_by, created_at, updated_at, idempotency_key
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending', $10, NOW(), NOW(), $11)`,
          [
            proposalId,
            organizationId,
            producerKind,
            producerRecordId,
            sourceContentHash,
            nextVersion,
            contractVersion,
            targetKind,
            payloadJson,
            createdBy,
            idempotencyKey,
          ]
        );
      } catch (err) {
        if (idempotencyKey && isUniqueViolationOn(err, PROPOSAL_IDEM_INDEX)) {
          await query('ROLLBACK TO SAVEPOINT handoff_proposal_insert');
          const winner = await query<ProposalRow>(
            `SELECT * FROM artifact_handoff_proposals
              WHERE organization_id = $1 AND idempotency_key = $2`,
            [organizationId, idempotencyKey]
          );
          if (!winner.rows[0]) {
            // Should be unreachable — the unique-violation proves a row
            // exists. Fail closed rather than fabricate a result.
            throw err;
          }
          return { proposal: mapProposalRow(winner.rows[0]), replayed: true };
        }
        if (isUniqueViolationOn(err, PROPOSAL_VERSION_UNIQUE_INDEX) && attempt < MAX_ATTEMPTS) {
          // Lost the version race. The conflicting row MUST now be
          // committed (Postgres only raises this once the other session's
          // transaction has resolved), so rolling back to the savepoint and
          // re-running the FOR UPDATE select on the next loop iteration will
          // see it and compute the correct next version.
          await query('ROLLBACK TO SAVEPOINT handoff_proposal_insert');
          continue;
        }
        throw err;
      }

      // Genuine read-back, not a fabricated status object.
      const inserted = await query<ProposalRow>(
        `SELECT * FROM artifact_handoff_proposals WHERE proposal_id = $1 AND organization_id = $2`,
        [proposalId, organizationId]
      );
      if (!inserted.rows[0]) {
        throw new HandoffSpineError('proposal not found after insert', 'INSERT_READBACK_FAILED');
      }
      return { proposal: mapProposalRow(inserted.rows[0]), replayed: false };
    }

    // Unreachable: the loop above always either returns or throws.
    throw new HandoffSpineError('createProposal exhausted retries unexpectedly', 'UNREACHABLE');
  });
}

// ---------------------------------------------------------------------------
// (3) approveProposal / rejectProposal
// ---------------------------------------------------------------------------

export interface DecideProposalInput {
  organizationId: string;
  proposalId: string;
  decidedBy: string;
  reason?: string | null;
}

/**
 * Shared CAS-guarded decision path. `UPDATE ... WHERE state = 'pending'`
 * means only ONE of two concurrent decisions can ever actually flip the row:
 * under Postgres's normal row-locking, the second UPDATE blocks until the
 * first commits, then re-evaluates `state = 'pending'` against the NEW
 * (already-decided) row and matches zero rows. The loser then re-reads the
 * row: if it already carries the state THIS call wanted, that is an
 * idempotent replay (same outcome, no error); any other state is a genuine
 * conflict (e.g. rejecting an already-approved proposal).
 */
async function decideProposal(
  input: DecideProposalInput,
  targetState: 'approved' | 'rejected'
): Promise<HandoffProposal> {
  const organizationId = requireNonEmpty(input.organizationId, 'organizationId');
  const proposalId = requireNonEmpty(input.proposalId, 'proposalId');
  const decidedBy = requireHumanActor(input.decidedBy, 'decidedBy');
  const reason = typeof input.reason === 'string' && input.reason.trim() !== '' ? input.reason : null;

  return withPgTransaction(async (query) => {
    const updated = await query<ProposalRow>(
      `UPDATE artifact_handoff_proposals
          SET state = $1,
              decided_by = $2,
              decided_at = NOW(),
              decision_reason = $3,
              self_approved = (created_by = $2),
              updated_at = NOW()
        WHERE proposal_id = $4 AND organization_id = $5 AND state = 'pending'
        RETURNING *`,
      [targetState, decidedBy, reason, proposalId, organizationId]
    );
    if (updated.rows[0]) {
      return mapProposalRow(updated.rows[0]);
    }

    // Not pending anymore (or never existed) — tenant-scoped re-read decides
    // between "not found", "idempotent replay", and "invalid transition".
    const current = await query<ProposalRow>(
      `SELECT * FROM artifact_handoff_proposals WHERE proposal_id = $1 AND organization_id = $2`,
      [proposalId, organizationId]
    );
    const row = current.rows[0];
    if (!row) {
      // A cross-tenant caller and a genuinely missing proposal are
      // indistinguishable here on purpose — same reasoning as
      // `artifactLineageService.ts`'s tenant-isolation doc comment.
      throw new HandoffSpineError('proposal not found', 'NOT_FOUND');
    }
    if (row.state === targetState) {
      return mapProposalRow(row);
    }
    throw new HandoffSpineError(
      `cannot ${targetState === 'approved' ? 'approve' : 'reject'} a proposal in state '${row.state}'`,
      'INVALID_STATE_TRANSITION'
    );
  });
}

export async function approveProposal(input: DecideProposalInput): Promise<HandoffProposal> {
  return decideProposal(input, 'approved');
}

export async function rejectProposal(input: DecideProposalInput): Promise<HandoffProposal> {
  return decideProposal(input, 'rejected');
}

// ---------------------------------------------------------------------------
// (4) materializeProposal
// ---------------------------------------------------------------------------

const RECEIPT_UNIQUE_INDEX = 'idx_handoff_receipt_proposal_unique';

export interface MaterializeProposalInput {
  organizationId: string;
  proposalId: string;
  targetRecordId: string;
  materializedBy: string;
  /** Optional materialized-object payload, hashed into the receipt for proof
   * of exactly what was produced. */
  outputPayload?: unknown;
}

export interface MaterializeProposalResult {
  receipt: HandoffReceipt;
  replayed: boolean;
}

/**
 * Turns an APPROVED proposal into exactly one receipt, atomically flipping
 * the proposal to 'materialized' in the SAME transaction.
 *
 * `SELECT ... FOR UPDATE` on the proposal row is the primary race guard: two
 * concurrent calls serialize on this lock, so the second one observes the
 * already-'materialized' state once it acquires the lock and takes the
 * replay branch below — never reaching the INSERT. The unique index on
 * `artifact_handoff_receipts(proposal_id)` (checked by name, same
 * SAVEPOINT-recovery idiom as `createProposal`) is defense-in-depth for any
 * path that reaches the INSERT without holding that lock.
 */
export async function materializeProposal(
  input: MaterializeProposalInput
): Promise<MaterializeProposalResult> {
  const organizationId = requireNonEmpty(input.organizationId, 'organizationId');
  const proposalId = requireNonEmpty(input.proposalId, 'proposalId');
  const targetRecordId = requireNonEmpty(input.targetRecordId, 'targetRecordId');
  const materializedBy = requireNonEmpty(input.materializedBy, 'materializedBy');
  const outputContentHash =
    input.outputPayload !== undefined ? canonicalSourceHash(input.outputPayload) : null;

  return withPgTransaction(async (query) => {
    const proposalRows = await query<ProposalRow>(
      `SELECT * FROM artifact_handoff_proposals
        WHERE proposal_id = $1 AND organization_id = $2
        FOR UPDATE`,
      [proposalId, organizationId]
    );
    const proposal = proposalRows.rows[0];
    if (!proposal) {
      throw new HandoffSpineError('proposal not found', 'NOT_FOUND');
    }

    if (proposal.state === 'materialized') {
      const existingReceipt = await query<ReceiptRow>(
        `SELECT * FROM artifact_handoff_receipts WHERE proposal_id = $1 AND organization_id = $2`,
        [proposalId, organizationId]
      );
      if (!existingReceipt.rows[0]) {
        // The exactly-one-receipt invariant says this cannot happen. Fail
        // closed rather than silently invent a receipt.
        throw new HandoffSpineError(
          'proposal is materialized but no receipt exists',
          'RECEIPT_MISSING'
        );
      }
      return { receipt: mapReceiptRow(existingReceipt.rows[0]), replayed: true };
    }

    if (proposal.state !== 'approved') {
      throw new HandoffSpineError(
        `cannot materialize a proposal in state '${proposal.state}' — it must be 'approved' first`,
        'NOT_APPROVED'
      );
    }

    const receiptId = randomUUID();
    await query('SAVEPOINT handoff_materialize_insert');
    try {
      await query(
        `INSERT INTO artifact_handoff_receipts (
           receipt_id, organization_id, proposal_id, target_kind, target_record_id,
           output_content_hash, materialized_by, materialized_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
        [
          receiptId,
          organizationId,
          proposalId,
          proposal.target_kind,
          targetRecordId,
          outputContentHash,
          materializedBy,
        ]
      );
      await query(
        `UPDATE artifact_handoff_proposals
            SET state = 'materialized', updated_at = NOW()
          WHERE proposal_id = $1 AND organization_id = $2`,
        [proposalId, organizationId]
      );
    } catch (err) {
      if (isUniqueViolationOn(err, RECEIPT_UNIQUE_INDEX)) {
        await query('ROLLBACK TO SAVEPOINT handoff_materialize_insert');
        const winner = await query<ReceiptRow>(
          `SELECT * FROM artifact_handoff_receipts WHERE proposal_id = $1 AND organization_id = $2`,
          [proposalId, organizationId]
        );
        if (!winner.rows[0]) throw err;
        return { receipt: mapReceiptRow(winner.rows[0]), replayed: true };
      }
      throw err;
    }

    const inserted = await query<ReceiptRow>(
      `SELECT * FROM artifact_handoff_receipts WHERE receipt_id = $1 AND organization_id = $2`,
      [receiptId, organizationId]
    );
    if (!inserted.rows[0]) {
      throw new HandoffSpineError('receipt not found after insert', 'INSERT_READBACK_FAILED');
    }
    return { receipt: mapReceiptRow(inserted.rows[0]), replayed: false };
  });
}

// ---------------------------------------------------------------------------
// (5) Export receipts — source -> provider job -> hashed output
// ---------------------------------------------------------------------------

const EXPORT_RECEIPT_IDEM_INDEX = 'idx_export_receipt_org_idem';

export interface RecordExportReceiptInput {
  organizationId: string;
  artifactKind: ExportArtifactKind;
  sourceRecordId: string;
  sourceVersion: number;
  sourceContentHash: string;
  outputFormat: string;
  /** Engine key, or the literal 'unavailable' when no approved provider
   * exists (MAT-POL-001). */
  providerKey: string;
  providerJobId?: string | null;
  createdBy: string;
  idempotencyKey?: string | null;
}

export interface RecordExportReceiptResult {
  receipt: ExportReceipt;
  replayed: boolean;
}

/** Creates a 'pending' export receipt row. Idempotent the same way
 * `createProposal` is: a retry with the same (organizationId, idempotencyKey)
 * pair replays the already-committed row instead of inserting a second. */
export async function recordExportReceipt(
  input: RecordExportReceiptInput
): Promise<RecordExportReceiptResult> {
  const organizationId = requireNonEmpty(input.organizationId, 'organizationId');
  const sourceRecordId = requireNonEmpty(input.sourceRecordId, 'sourceRecordId');
  const sourceContentHash = requireNonEmpty(input.sourceContentHash, 'sourceContentHash');
  const outputFormat = requireNonEmpty(input.outputFormat, 'outputFormat');
  const providerKey = requireNonEmpty(input.providerKey, 'providerKey');
  const createdBy = requireNonEmpty(input.createdBy, 'createdBy');
  if (!isExportArtifactKind(input.artifactKind)) {
    throw new HandoffSpineError('artifactKind is invalid', 'INVALID_ARGUMENT');
  }
  if (!Number.isInteger(input.sourceVersion) || input.sourceVersion < 1) {
    throw new HandoffSpineError('sourceVersion must be a positive integer', 'INVALID_ARGUMENT');
  }
  const idempotencyKey = normalizeOptionalKey(input.idempotencyKey);

  return withPgTransaction(async (query) => {
    const exportReceiptId = randomUUID();
    await query('SAVEPOINT export_receipt_insert');
    try {
      await query(
        `INSERT INTO artifact_export_receipts (
           export_receipt_id, organization_id, artifact_kind, source_record_id,
           source_version, source_content_hash, output_format, provider_key,
           provider_job_id, status, created_by, created_at, idempotency_key
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending', $10, NOW(), $11)`,
        [
          exportReceiptId,
          organizationId,
          input.artifactKind,
          sourceRecordId,
          input.sourceVersion,
          sourceContentHash,
          outputFormat,
          providerKey,
          input.providerJobId ?? null,
          createdBy,
          idempotencyKey,
        ]
      );
    } catch (err) {
      if (idempotencyKey && isUniqueViolationOn(err, EXPORT_RECEIPT_IDEM_INDEX)) {
        await query('ROLLBACK TO SAVEPOINT export_receipt_insert');
        const winner = await query<ExportReceiptRow>(
          `SELECT * FROM artifact_export_receipts
            WHERE organization_id = $1 AND idempotency_key = $2`,
          [organizationId, idempotencyKey]
        );
        if (!winner.rows[0]) throw err;
        return { receipt: mapExportReceiptRow(winner.rows[0]), replayed: true };
      }
      throw err;
    }

    const inserted = await query<ExportReceiptRow>(
      `SELECT * FROM artifact_export_receipts WHERE export_receipt_id = $1 AND organization_id = $2`,
      [exportReceiptId, organizationId]
    );
    if (!inserted.rows[0]) {
      throw new HandoffSpineError('export receipt not found after insert', 'INSERT_READBACK_FAILED');
    }
    return { receipt: mapExportReceiptRow(inserted.rows[0]), replayed: false };
  });
}

export interface CompleteExportReceiptInput {
  organizationId: string;
  exportReceiptId: string;
  outputContentHash: string;
  outputByteSize: number;
}

/**
 * Marks an export 'succeeded'. Requires real bytes' proof
 * (`outputContentHash` + `outputByteSize`) both at the application layer
 * (validated below) AND at the storage layer
 * (`artifact_export_receipts_success_check`) — belt and suspenders, so a
 * future caller that forgets the application check still cannot record a
 * false success.
 */
export async function completeExportReceipt(
  input: CompleteExportReceiptInput
): Promise<ExportReceipt> {
  const organizationId = requireNonEmpty(input.organizationId, 'organizationId');
  const exportReceiptId = requireNonEmpty(input.exportReceiptId, 'exportReceiptId');
  const outputContentHash = requireNonEmpty(input.outputContentHash, 'outputContentHash');
  if (!Number.isInteger(input.outputByteSize) || input.outputByteSize < 0) {
    throw new HandoffSpineError(
      'outputByteSize must be a non-negative integer',
      'INVALID_ARGUMENT'
    );
  }

  return withPgTransaction(async (query) => {
    const updated = await query<ExportReceiptRow>(
      `UPDATE artifact_export_receipts
          SET status = 'succeeded', output_content_hash = $1, output_byte_size = $2, completed_at = NOW()
        WHERE export_receipt_id = $3 AND organization_id = $4
        RETURNING *`,
      [outputContentHash, input.outputByteSize, exportReceiptId, organizationId]
    );
    if (!updated.rows[0]) {
      throw new HandoffSpineError('export receipt not found', 'NOT_FOUND');
    }
    return mapExportReceiptRow(updated.rows[0]);
  });
}

export interface FailExportReceiptInput {
  organizationId: string;
  exportReceiptId: string;
  failureCode: string;
}

export async function failExportReceipt(input: FailExportReceiptInput): Promise<ExportReceipt> {
  const organizationId = requireNonEmpty(input.organizationId, 'organizationId');
  const exportReceiptId = requireNonEmpty(input.exportReceiptId, 'exportReceiptId');
  const failureCode = requireNonEmpty(input.failureCode, 'failureCode');

  return withPgTransaction(async (query) => {
    const updated = await query<ExportReceiptRow>(
      `UPDATE artifact_export_receipts
          SET status = 'failed', failure_code = $1, completed_at = NOW()
        WHERE export_receipt_id = $2 AND organization_id = $3
        RETURNING *`,
      [failureCode, exportReceiptId, organizationId]
    );
    if (!updated.rows[0]) {
      throw new HandoffSpineError('export receipt not found', 'NOT_FOUND');
    }
    return mapExportReceiptRow(updated.rows[0]);
  });
}

export interface MarkExportUnavailableInput {
  organizationId: string;
  exportReceiptId: string;
  failureCode: string;
}

/**
 * MAT-POL-001 fail-closed path: a provider that is not (yet) an approved
 * engine returns an explicit 'unavailable' status, never a mock/silent
 * downgrade to something that reads as success. Combined with the DB check
 * constraint on 'succeeded', it is structurally impossible for a degraded
 * export to be recorded as having produced real bytes.
 */
export async function markExportUnavailable(
  input: MarkExportUnavailableInput
): Promise<ExportReceipt> {
  const organizationId = requireNonEmpty(input.organizationId, 'organizationId');
  const exportReceiptId = requireNonEmpty(input.exportReceiptId, 'exportReceiptId');
  const failureCode = requireNonEmpty(input.failureCode, 'failureCode');

  return withPgTransaction(async (query) => {
    const updated = await query<ExportReceiptRow>(
      `UPDATE artifact_export_receipts
          SET status = 'unavailable', failure_code = $1, completed_at = NOW()
        WHERE export_receipt_id = $2 AND organization_id = $3
        RETURNING *`,
      [failureCode, exportReceiptId, organizationId]
    );
    if (!updated.rows[0]) {
      throw new HandoffSpineError('export receipt not found', 'NOT_FOUND');
    }
    logger.warn('[handoffSpine] export marked unavailable (no approved provider)', {
      organizationId,
      exportReceiptId,
      failureCode,
    });
    return mapExportReceiptRow(updated.rows[0]);
  });
}
