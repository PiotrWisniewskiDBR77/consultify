/**
 * FIN-06 — shared Finance-approved-source -> canonical Candidate handoff core.
 *
 * FOUNDATION ONLY. This module is deliberately source-type-agnostic: it owns
 * the ONE place the lock+idempotency+transaction contract lives, so it can
 * never drift between the three Finance source types (Investment Case /
 * Statement Pack / Valuation Recommendation) that a later wave will wire up
 * as three thin adapters, each supplying its own `resolveEligibleSource`,
 * `buildCandidateFields`, and `lockSourceRow`. No source-specific eligibility
 * logic lives here — that is explicitly out of scope for this file.
 *
 * Mirrors the ASM-08 / INT-08 pattern exactly (see
 * `server/src/services/assessment/drdCandidateHandoff.ts` and
 * `server/src/services/interview/interviewCandidateHandoff.ts`):
 *   - a read-only PREVIEW that resolves eligibility and builds candidate
 *     fields WITHOUT taking a lock or writing anything;
 *   - a mutating CONFIRM that opens one pinned Postgres transaction, locks
 *     the source row (via the caller-supplied `lockSourceRow`, since each
 *     source type's row/table differs), checks `finance_candidate_handoffs`
 *     for an existing idempotent receipt first (retry-safe short-circuit,
 *     no re-resolution needed), and — only for a genuinely fresh handoff —
 *     re-resolves eligibility INSIDE the lock. That re-resolution is a
 *     deliberate defense against a TOCTOU race: the source could have
 *     become ineligible in the window between a caller's preview call and
 *     its confirm call, and the lock only starts protecting once confirm
 *     opens its transaction.
 *
 * Idempotency/lineage receipt: `finance_candidate_handoffs` (migration
 * `server/migrations/20260802_fin006_candidate_handoff.sql`). The unique
 * index on `(organization_id, source_type, source_id)` is the hard
 * idempotency key — one handoff per Finance source object, ever, per org. A
 * retry for a source that already has a receipt returns the SAME
 * candidateId instead of creating a duplicate candidate (and, notably,
 * without re-running `resolveEligibleSource`/`buildCandidateFields` at all —
 * an existing receipt is authoritative on its own).
 *
 * Candidate creation itself is delegated to the single canonical writer,
 * `createCandidateFromSource` (`initiativeCandidateService.ts`) — this
 * module never inserts into `initiative_candidates` directly.
 */
import { createHash } from 'crypto';

import { v4 as uuidv4 } from 'uuid';

import type { PinnedTransactionClient } from '../../database/PostgresDatabase.js';
import { withPinnedPostgresTransaction } from '../../database/PostgresDatabase.js';
import * as queryHelpers from '../../utils/queryHelpers.js';
import type { CandidateDb, DiscoverySourceType } from '../initiative/initiativeCandidateService.js';
import { createCandidateFromSource } from '../initiative/initiativeCandidateService.js';

// ---------------------------------------------------------------------------
// Source value snapshot — Codex correction (2026-08-02)
// ---------------------------------------------------------------------------
//
// FIN-06 must NEVER recompute a financial figure and must NEVER silently
// substitute 0/null for a value the source does not have. `sourceSnapshot`
// is the structured, source-type-agnostic carrier for that invariant: every
// field is either a real value read straight off the source (row column or
// JSONB blob key), or the literal string 'unknown' — never a fabricated or
// estimated number. All three adapters populate this via `unknownIfMissing`
// (or, for list-shaped fields where the concept doesn't exist AT ALL on that
// source type, the literal `UNKNOWN` constant written explicitly) so the
// invariant can't drift between adapters.

/** The literal sentinel for "this field genuinely has no value in the source." */
export const UNKNOWN = 'unknown' as const;
export type FinanceUnknown = typeof UNKNOWN;

/**
 * Structured, source-type-agnostic snapshot of the real values a Finance
 * source carries. Every one of these is either read verbatim from the
 * source (never derived/summed/estimated by this module) or `'unknown'`
 * when the source genuinely has no such field/value.
 */
export interface FinanceCandidateSourceSnapshot {
  currency: string | FinanceUnknown;
  capex: number | FinanceUnknown;
  opex: number | FinanceUnknown;
  npv: number | FinanceUnknown;
  irr: number | FinanceUnknown;
  roi: number | FinanceUnknown;
  payback: number | FinanceUnknown;
  baselineOrScenario: string | FinanceUnknown;
  assumptions: string[] | FinanceUnknown;
  risks: string[] | FinanceUnknown;
  sourceVersion: string | FinanceUnknown;
  sourceFingerprint: string | FinanceUnknown;
}

/**
 * A snapshot with every field defaulted to `'unknown'` — adapters spread
 * this and only override the fields they can genuinely ground in real
 * source data, so a field an adapter forgets to set is honestly 'unknown'
 * rather than silently `undefined` (which would serialize away and violate
 * the "never missing" test invariant).
 */
export function emptySourceSnapshot(): FinanceCandidateSourceSnapshot {
  return {
    currency: UNKNOWN,
    capex: UNKNOWN,
    opex: UNKNOWN,
    npv: UNKNOWN,
    irr: UNKNOWN,
    roi: UNKNOWN,
    payback: UNKNOWN,
    baselineOrScenario: UNKNOWN,
    assumptions: UNKNOWN,
    risks: UNKNOWN,
    sourceVersion: UNKNOWN,
    sourceFingerprint: UNKNOWN,
  };
}

/**
 * Scalar carry-over helper: `null`/`undefined`/blank-string/non-finite-number
 * -> `'unknown'`, otherwise the real value verbatim. This is the ONE place
 * "is this value actually there" is decided for scalar fields, so the three
 * adapters can't independently drift on what counts as "missing" (e.g. one
 * treating `''` as a real currency, another not).
 *
 * Deliberately NOT used for list fields (`assumptions`/`risks`): an empty
 * array can be a genuine, meaningful computed result (e.g. a statement
 * pack's quality-reason-codes really is `[]` when nothing is flagged) rather
 * than "missing", so each adapter decides that distinction explicitly at the
 * call site instead of this helper silently collapsing `[]` to 'unknown'.
 */
export function unknownIfMissing(value: number | null | undefined): number | FinanceUnknown;
export function unknownIfMissing(value: string | null | undefined): string | FinanceUnknown;
export function unknownIfMissing<T extends number | string>(
  value: T | null | undefined
): T | FinanceUnknown {
  if (value === null || value === undefined) return UNKNOWN;
  if (typeof value === 'number') return Number.isFinite(value) ? value : UNKNOWN;
  if (typeof value === 'string') return value.trim().length > 0 ? value : UNKNOWN;
  return UNKNOWN;
}

/**
 * Deterministic content fingerprint (sha256, truncated to 16 hex chars) of
 * whatever real, already-resolved source data is passed in. This is a
 * lineage/idempotency-integrity identifier, NOT a financial figure — it
 * never estimates or invents a business number, it only hashes bytes that
 * are already real. Always computable (never 'unknown') for any resolved
 * source, since a source that resolved at all has SOME identifying content.
 */
export function computeSourceFingerprint(payload: unknown): string {
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex').slice(0, 16);
}

/**
 * Error shape for this module. Callers (Phase 2 route layers) should catch
 * this and map `.status` -> HTTP status, `.code` -> the `code` field in the
 * JSON error body, and may include `.details` for machine-readable context.
 *
 * Verbatim code/status pairs used by this module:
 *   - SOURCE_NOT_ELIGIBLE   409  (resolveEligibleSource returned ok:false —
 *                                 either on the first resolution, or on the
 *                                 TOCTOU re-check inside the lock; details:
 *                                 { sourceType, sourceId, reason })
 *   - HANDOFF_INCONSISTENT  500  (the receipt insert did not return a row
 *                                 and none could be re-read after — a
 *                                 data-integrity anomaly, never silently
 *                                 retried further)
 */
export class FinanceCandidateHandoffError extends Error {
  code: string;
  status: number;
  details?: unknown;

  constructor(code: string, status: number, message: string, details?: unknown) {
    super(message);
    this.name = 'FinanceCandidateHandoffError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

/** What a caller-supplied eligibility resolver returns. */
export type FinanceSourceResolution<T> =
  | { ok: true; data: T }
  | { ok: false; reason: string };

/** Minimal candidate content a Phase-2 adapter derives from its resolved source. */
export interface FinanceCandidateFields {
  title: string;
  rationale: string;
  fitScore?: number;
  /**
   * Structured, real-values-only snapshot of the source (Codex correction,
   * 2026-08-02) — see the module-header comment above. Optional on the type
   * only so a not-yet-migrated caller doesn't hard-fail; every FIN-06
   * adapter in this codebase populates it, and `previewFinanceCandidateHandoff`
   * / `confirmFinanceCandidateHandoff` default a missing one to
   * `emptySourceSnapshot()` (all fields 'unknown') rather than omitting the
   * key.
   */
  sourceSnapshot?: FinanceCandidateSourceSnapshot;
}

export interface FinanceCandidatePreview extends FinanceCandidateFields {
  sourceType: DiscoverySourceType;
  sourceId: string;
  sourceSnapshot: FinanceCandidateSourceSnapshot;
}

export type FinanceCandidatePreviewResult =
  | { eligible: true; preview: FinanceCandidatePreview }
  | { eligible: false; reason: string };

interface FinanceHandoffRow {
  id: string;
  organization_id: string;
  source_type: string;
  source_id: string;
  candidate_id: string;
  created_by: string | null;
  created_at: string | Date;
  /** `jsonb` — the pg driver returns this already-parsed as a plain object. */
  source_snapshot?: unknown;
}

/**
 * Normalizes whatever came back out of the `source_snapshot jsonb` column
 * into a well-formed `FinanceCandidateSourceSnapshot` — defends against a
 * pre-migration row (column just added, existing rows default to `{}`) or a
 * driver returning the jsonb value as a JSON string rather than a
 * pre-parsed object, without ever inventing a value for a field that isn't
 * actually there (missing/mistyped fields fall back to 'unknown' via the
 * `emptySourceSnapshot()` spread, never to 0/null).
 */
function normalizeStoredSnapshot(raw: unknown): FinanceCandidateSourceSnapshot {
  const empty = emptySourceSnapshot();
  let parsed: unknown = raw;
  if (typeof parsed === 'string') {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return empty;
    }
  }
  if (!parsed || typeof parsed !== 'object') return empty;
  return { ...empty, ...(parsed as Partial<FinanceCandidateSourceSnapshot>) };
}

export interface PreviewFinanceCandidateHandoffParams<T> {
  organizationId: string;
  sourceType: DiscoverySourceType;
  sourceId: string;
  /** Read-only eligibility resolution — no lock, no tx. */
  resolveEligibleSource: () => Promise<FinanceSourceResolution<T>>;
  buildCandidateFields: (data: T) => FinanceCandidateFields;
}

/**
 * Read-only "Candidate preview" — computes what the Candidate would look
 * like WITHOUT persisting anything and without taking any lock. Callers
 * should pass a `resolveEligibleSource` closure backed by a plain
 * (non-locking) read, e.g. `queryHelpers` directly, mirroring
 * `previewInterviewCandidate`'s `{ forUpdate: false }` read.
 */
export async function previewFinanceCandidateHandoff<T>(
  params: PreviewFinanceCandidateHandoffParams<T>
): Promise<FinanceCandidatePreviewResult> {
  const resolved = await params.resolveEligibleSource();
  if (!resolved.ok) {
    return { eligible: false, reason: resolved.reason };
  }

  const fields = params.buildCandidateFields(resolved.data);
  return {
    eligible: true,
    preview: {
      sourceType: params.sourceType,
      sourceId: params.sourceId,
      title: fields.title,
      rationale: fields.rationale,
      fitScore: fields.fitScore,
      // Preview honestly shows what confirm will capture — same snapshot
      // shape, same 'unknown' defaulting, no lock/no write either way.
      sourceSnapshot: fields.sourceSnapshot ?? emptySourceSnapshot(),
    },
  };
}

export interface ConfirmFinanceCandidateHandoffParams<T> {
  organizationId: string;
  sourceType: DiscoverySourceType;
  sourceId: string;
  createdBy?: string | null;
  /**
   * Re-resolved INSIDE the transaction after the idempotency short-circuit
   * (i.e. only ever called for a genuinely fresh handoff) — the TOCTOU
   * defense against the source having become ineligible since a caller's
   * earlier preview call. Callers should pass a closure backed by the SAME
   * pinned tx used for `lockSourceRow`.
   */
  resolveEligibleSource: () => Promise<FinanceSourceResolution<T>>;
  buildCandidateFields: (data: T) => FinanceCandidateFields;
  /**
   * `SELECT ... FOR UPDATE` (or equivalent) on the source row, using the
   * pinned tx handed to it — serializes concurrent handoff attempts for the
   * same source, same discipline as `drdCandidateHandoff.ts` /
   * `interviewCandidateHandoff.ts`. Each Finance source type's row/table
   * differs, so this is entirely caller-supplied; this module never assumes
   * a table name.
   */
  lockSourceRow: (tx: PinnedTransactionClient) => Promise<void>;
}

export interface ConfirmFinanceCandidateHandoffResult {
  created: boolean;
  candidateId: string;
  /** Read back from the persisted `source_snapshot` column — never re-derived. */
  sourceSnapshot: FinanceCandidateSourceSnapshot;
}

/**
 * The mutating "confirm" path — creates the Candidate + receipt inside one
 * pinned Postgres transaction. Idempotent per (organizationId, sourceType,
 * sourceId): a retry for the SAME Finance source returns the existing
 * candidateId (created: false) instead of creating a duplicate, and does so
 * WITHOUT re-running eligibility resolution — an existing receipt is
 * authoritative on its own, exactly like ASM-08/INT-08.
 */
export async function confirmFinanceCandidateHandoff<T>(
  params: ConfirmFinanceCandidateHandoffParams<T>
): Promise<ConfirmFinanceCandidateHandoffResult> {
  const { organizationId, sourceType, sourceId, createdBy } = params;

  return withPinnedPostgresTransaction(async (tx) => {
    await params.lockSourceRow(tx);

    // Idempotency check FIRST — a retry for an already-handed-off source
    // short-circuits here without re-resolving eligibility at all.
    const existing = await tx.queryOne<FinanceHandoffRow>(
      `SELECT * FROM finance_candidate_handoffs
       WHERE organization_id = ? AND source_type = ? AND source_id = ?`,
      [organizationId, sourceType, sourceId]
    );
    if (existing) {
      // Retry-safe short-circuit: return the SAME snapshot captured at the
      // original confirm, read back from the row — never re-resolved,
      // never re-derived, matching the idempotency contract above.
      return {
        created: false,
        candidateId: existing.candidate_id,
        sourceSnapshot: normalizeStoredSnapshot(existing.source_snapshot),
      };
    }

    // Fresh handoff — re-resolve eligibility INSIDE the lock (TOCTOU
    // defense: the source could have become ineligible since an earlier
    // preview call, which ran with no lock at all).
    const resolved = await params.resolveEligibleSource();
    if (!resolved.ok) {
      throw new FinanceCandidateHandoffError(
        'SOURCE_NOT_ELIGIBLE',
        409,
        `Finance source is not eligible for candidate handoff: ${resolved.reason}`,
        { sourceType, sourceId, reason: resolved.reason }
      );
    }

    const fields = params.buildCandidateFields(resolved.data);
    // `PinnedTransactionClient`'s generic query methods (`T extends
    // QueryResultRow`) are not structurally assignable to `CandidateDb`'s
    // (`T = any`) under strict generic-method variance, even though every
    // concrete call shape is compatible at runtime — the same mismatch
    // already exists, uncast, at the identical call site in
    // `drdCandidateHandoff.ts` and `interviewCandidateHandoff.ts`. Cast here
    // (rather than leaving a 4th uncast instance) so this new file adds zero
    // net new tsc errors.
    const candidate = await createCandidateFromSource(tx as unknown as CandidateDb, {
      organizationId,
      sourceType,
      sourceId,
      title: fields.title,
      rationale: fields.rationale,
      fitScore: fields.fitScore ?? 1,
      createdBy: createdBy ?? null,
    });

    const handoffId = uuidv4();
    const now = new Date().toISOString();
    const snapshotToPersist = fields.sourceSnapshot ?? emptySourceSnapshot();
    const inserted = await tx.queryOne<FinanceHandoffRow>(
      `INSERT INTO finance_candidate_handoffs
         (id, organization_id, source_type, source_id, candidate_id, created_by, created_at, source_snapshot)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (organization_id, source_type, source_id) DO NOTHING
       RETURNING *`,
      [
        handoffId,
        organizationId,
        sourceType,
        sourceId,
        candidate.id,
        createdBy ?? null,
        now,
        JSON.stringify(snapshotToPersist),
      ]
    );

    // Extremely unlikely race: the ON CONFLICT actually fired (someone
    // else's transaction beat us despite `lockSourceRow`, e.g. two
    // different-but-colliding source rows). Re-select the now-authoritative
    // row instead of failing, matching the ASM-08/INT-08 pattern.
    const receiptRow =
      inserted ??
      (await tx.queryOne<FinanceHandoffRow>(
        `SELECT * FROM finance_candidate_handoffs
         WHERE organization_id = ? AND source_type = ? AND source_id = ?`,
        [organizationId, sourceType, sourceId]
      ));
    if (!receiptRow) {
      throw new FinanceCandidateHandoffError(
        'HANDOFF_INCONSISTENT',
        500,
        'Handoff receipt insert did not return a row and none could be re-read',
        { sourceType, sourceId, candidateId: candidate.id }
      );
    }

    return {
      created: true,
      candidateId: receiptRow.candidate_id,
      // Read back from the row actually persisted (matters for the rare
      // ON CONFLICT DO NOTHING race above: the winning transaction's
      // snapshot, not necessarily this call's `fields`).
      sourceSnapshot: normalizeStoredSnapshot(receiptRow.source_snapshot),
    };
  });
}

/**
 * Plain org-scoped read of the handoff receipt for a given Finance source,
 * if any. Returns null (not an error) when no handoff receipt exists yet —
 * that is a normal "not handed off yet" state, not a fault. Not part of the
 * preview/confirm pair above but kept here since it reads the same table and
 * every other sibling handoff module (ASM-08, INT-08) exposes the analogous
 * getter for its route layer.
 */
export async function getFinanceCandidateHandoff(params: {
  organizationId: string;
  sourceType: DiscoverySourceType;
  sourceId: string;
}): Promise<{
  id: string;
  organizationId: string;
  sourceType: string;
  sourceId: string;
  candidateId: string;
  createdBy: string | null;
  createdAt: string;
  /** Same snapshot captured at confirm time — reopen never re-derives it. */
  sourceSnapshot: FinanceCandidateSourceSnapshot;
} | null> {
  const { organizationId, sourceType, sourceId } = params;

  const row = await queryHelpers.queryOne<FinanceHandoffRow>(
    `SELECT * FROM finance_candidate_handoffs
     WHERE organization_id = ? AND source_type = ? AND source_id = ?`,
    [organizationId, sourceType, sourceId]
  );
  if (!row) return null;

  return {
    id: row.id,
    organizationId: row.organization_id,
    sourceType: row.source_type,
    sourceId: row.source_id,
    candidateId: row.candidate_id,
    createdBy: row.created_by ?? null,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    sourceSnapshot: normalizeStoredSnapshot(row.source_snapshot),
  };
}
