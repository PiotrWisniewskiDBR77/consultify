/**
 * FIN-06 — Statement Pack (Finance) -> canonical Candidate handoff adapter.
 *
 * Thin Phase-2 adapter over the shared FIN-06 core
 * (`financeCandidateHandoffCore.ts`), which owns ALL lock/idempotency/
 * transaction discipline. This file supplies only the three source-specific
 * closures the core asks for:
 *   - `resolveEligibleSource` — is this pack found, and is it `ready`?
 *   - `buildCandidateFields`  — a real-data-only {title, rationale, fitScore}
 *     for the pack.
 *   - `lockSourceRow`         — `SELECT ... FOR UPDATE` on the pack row,
 *     using the core's pinned transaction client, so two concurrent confirm
 *     calls for the SAME pack serialize.
 *
 * Eligibility gate: `pack_readiness_status === 'ready'`
 * (`financialStatementPackService.ts`'s `StatementPackReadinessStatus`,
 * computed by `computePackAggregate()` / written by `recomputeStatementPack`).
 * A pack that is `pending`, `recoverable`, or `rejected` is NOT_READY.
 *
 * Reuses `getStatementPackDetail` (the existing org-scoped pack+statements
 * read) rather than hand-rolling a new query — this module never inserts
 * into `financial_statement_packs` and never mutates pack readiness itself.
 *
 * `resolveEligibleSource` is deliberately the SAME function for both the
 * read-only preview and confirm's TOCTOU re-check inside the lock (per the
 * core's contract) — a plain, non-locking read is sufficient because the
 * ONLY thing serializing concurrent confirms is `lockSourceRow`'s
 * `FOR UPDATE`: by the time confirm's re-resolution runs, any state change
 * that raced with an earlier preview has already committed (or this call is
 * itself waiting behind another confirm's lock), so a fresh read always
 * observes the latest committed readiness value.
 */
import type { PinnedTransactionClient } from '../../database/PostgresDatabase.js';
import { getStatementPackDetail } from '../financialStatementPackService.js';
import {
  computeSourceFingerprint,
  confirmFinanceCandidateHandoff,
  type ConfirmFinanceCandidateHandoffResult,
  emptySourceSnapshot,
  type FinanceCandidateFields,
  type FinanceCandidatePreviewResult,
  type FinanceCandidateSourceSnapshot,
  type FinanceSourceResolution,
  previewFinanceCandidateHandoff,
  unknownIfMissing,
} from './financeCandidateHandoffCore.js';

export type { ConfirmFinanceCandidateHandoffResult } from './financeCandidateHandoffCore.js';
export {
  FinanceCandidateHandoffError,
  getFinanceCandidateHandoff,
} from './financeCandidateHandoffCore.js';

const SOURCE_TYPE = 'finance_statement_pack' as const;

interface StatementPackStatementSummary {
  statement_type?: string | null;
}

/** Minimal shape this adapter reads off `getStatementPackDetail`'s result. */
export interface StatementPackCandidateSource {
  id: string;
  organization_id: string;
  entity_name?: string | null;
  period_start?: string | null;
  period_end?: string | null;
  period_label?: string | null;
  currency?: string | null;
  pack_readiness_status?: string | null;
  pack_readiness_score?: number | string | null;
  pack_quality_summary?: string | null;
  pack_quality_reason_codes?: string | null;
  statements?: StatementPackStatementSummary[] | null;
}

function normalizeText(value: unknown): string {
  return String(value ?? '').trim();
}

function normalizeReadiness(value: unknown): string {
  return normalizeText(value).toLowerCase();
}

function formatPeriod(pack: StatementPackCandidateSource): string {
  const label = normalizeText(pack.period_label);
  if (label) return label;
  const start = normalizeText(pack.period_start);
  const end = normalizeText(pack.period_end);
  if (start && end) return `${start} – ${end}`;
  return start || end || '';
}

function countByType(pack: StatementPackCandidateSource, type: string): number {
  const statements = Array.isArray(pack.statements) ? pack.statements : [];
  return statements.filter(
    (statement) => normalizeText(statement?.statement_type).toUpperCase() === type
  ).length;
}

/**
 * Defensive parse of `pack_quality_reason_codes` (a JSON-string column, see
 * `financialStatementPackService.ts`'s `toJson(aggregate.packQualityReasonCodes)`)
 * back into a real string array. `null` (not `[]`) when the column is
 * missing/unparseable — distinct from a genuinely empty, real `[]`.
 */
function parseReasonCodes(raw: unknown): string[] | null {
  if (raw == null) return null;
  if (Array.isArray(raw)) return raw.map((v) => String(v));
  if (typeof raw !== 'string') return null;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map((v) => String(v)) : null;
  } catch {
    return null;
  }
}

/**
 * Builds the structured, real-values-only `sourceSnapshot` for a resolved
 * (eligible/`ready`) Statement Pack (Codex correction, 2026-08-02 — see
 * `financeCandidateHandoffCore.ts`'s module header). Confirmed by reading
 * `financial_statement_packs`' full column set
 * (`server/migrations/20260316_financial_statement_packs.sql`): the table
 * has NO capex/opex/npv/irr/roi/payback/scenario/assumptions/version column
 * — statement packs are raw financial statements, not an investment case or
 * valuation, so those are honestly 'unknown' rather than forced into a
 * shape this source doesn't have.
 */
function buildStatementPackSourceSnapshot(
  pack: StatementPackCandidateSource
): FinanceCandidateSourceSnapshot {
  // The closest genuine "risk" signal a pack carries: its own stored
  // quality/readiness reason codes (e.g. MISSING_PL, INCONSISTENT_CURRENCY)
  // — real data, whatever it happens to contain, not fabricated.
  const reasonCodes = parseReasonCodes(pack.pack_quality_reason_codes);
  return {
    ...emptySourceSnapshot(),
    currency: unknownIfMissing(normalizeText(pack.currency) || null),
    capex: 'unknown',
    opex: 'unknown',
    npv: 'unknown',
    irr: 'unknown',
    roi: 'unknown',
    payback: 'unknown',
    // Statement packs have no scenario/baseline concept.
    baselineOrScenario: 'unknown',
    // No assumptions field on this source type.
    assumptions: 'unknown',
    risks: reasonCodes ?? 'unknown',
    // No version column on financial_statement_packs.
    sourceVersion: 'unknown',
    sourceFingerprint: computeSourceFingerprint({
      id: pack.id,
      organizationId: pack.organization_id,
      currency: pack.currency,
      periodStart: pack.period_start,
      periodEnd: pack.period_end,
      periodLabel: pack.period_label,
      packReadinessStatus: pack.pack_readiness_status,
      packReadinessScore: pack.pack_readiness_score,
      reasonCodes,
    }),
  };
}

/**
 * Resolves eligibility for a Statement Pack: found + `pack_readiness_status
 * === 'ready'`. Used identically by the read-only preview and by confirm's
 * TOCTOU re-check inside the lock (see file header) — a plain org-scoped
 * read via the existing `getStatementPackDetail`, no hand-rolled query.
 */
async function resolveEligibleSource(
  organizationId: string,
  packId: string
): Promise<FinanceSourceResolution<StatementPackCandidateSource>> {
  const pack = (await getStatementPackDetail(
    organizationId,
    packId
  )) as StatementPackCandidateSource | null;
  if (!pack) {
    return { ok: false, reason: 'NOT_FOUND' };
  }
  const readiness = normalizeReadiness(pack.pack_readiness_status);
  if (readiness !== 'ready') {
    return { ok: false, reason: 'NOT_READY' };
  }
  return { ok: true, data: pack };
}

/**
 * Builds a real-data-only {title, rationale, fitScore} draft for the
 * Candidate. Never invents numbers — every figure in the rationale is read
 * straight off the resolved pack row (statement-type counts from the
 * pack's own `statements` array, currency/period/readiness as stored).
 */
function buildCandidateFields(pack: StatementPackCandidateSource): FinanceCandidateFields {
  const entityName = normalizeText(pack.entity_name) || 'Statement Pack';
  const period = formatPeriod(pack);
  const title = period ? `${entityName} — ${period}` : entityName;

  const currency = normalizeText(pack.currency) || 'PLN';
  const plCount = countByType(pack, 'P&L');
  const bsCount = countByType(pack, 'BS');
  const cfCount = countByType(pack, 'CF');
  const readinessScore = Number(pack.pack_readiness_score);
  const hasReadinessScore = Number.isFinite(readinessScore);
  const qualitySummary = normalizeText(pack.pack_quality_summary);

  const rationaleParts = [
    `Statement pack for ${entityName}`,
    period ? `period ${period}` : null,
    `currency ${currency}`,
    `statements on file: P&L x${plCount}, BS x${bsCount}, CF x${cfCount}`,
    hasReadinessScore ? `readiness score ${readinessScore}/100` : null,
    qualitySummary ? `quality summary: ${qualitySummary}` : null,
  ].filter((part): part is string => Boolean(part));

  const fields: FinanceCandidateFields = {
    title,
    rationale: `${rationaleParts.join('; ')}.`,
    sourceSnapshot: buildStatementPackSourceSnapshot(pack),
  };

  // Principled real value: the pack's own readiness score (0..100),
  // normalized to the 0..1 fitScore scale `createCandidateFromSource`
  // expects — never a fabricated number.
  if (hasReadinessScore) {
    fields.fitScore = Math.round((Math.max(0, Math.min(100, readinessScore)) / 100) * 100) / 100;
  }

  return fields;
}

/** `SELECT ... FOR UPDATE` on the pack row, via the pinned tx. */
async function lockSourceRow(
  tx: PinnedTransactionClient,
  organizationId: string,
  packId: string
): Promise<void> {
  await tx.queryOne(
    `SELECT id FROM financial_statement_packs WHERE id = ? AND organization_id = ? FOR UPDATE`,
    [packId, organizationId]
  );
}

/**
 * Read-only preview of what confirming this Statement Pack would produce as
 * a Candidate — no lock, no write.
 */
export async function previewStatementPackCandidate(params: {
  organizationId: string;
  packId: string;
}): Promise<FinanceCandidatePreviewResult> {
  const { organizationId, packId } = params;
  return previewFinanceCandidateHandoff<StatementPackCandidateSource>({
    organizationId,
    sourceType: SOURCE_TYPE,
    sourceId: packId,
    resolveEligibleSource: () => resolveEligibleSource(organizationId, packId),
    buildCandidateFields,
  });
}

/**
 * Confirms the handoff: creates the Candidate + `finance_candidate_handoffs`
 * receipt (idempotent per (organizationId, 'finance_statement_pack',
 * packId)), via the shared FIN-06 core. `createCandidateFromSource` remains
 * the sole writer of `initiative_candidates` — this adapter never inserts
 * there directly.
 */
export async function confirmStatementPackCandidateHandoff(params: {
  organizationId: string;
  packId: string;
  createdBy?: string | null;
}): Promise<ConfirmFinanceCandidateHandoffResult> {
  const { organizationId, packId, createdBy } = params;
  return confirmFinanceCandidateHandoff<StatementPackCandidateSource>({
    organizationId,
    sourceType: SOURCE_TYPE,
    sourceId: packId,
    createdBy: createdBy ?? null,
    resolveEligibleSource: () => resolveEligibleSource(organizationId, packId),
    buildCandidateFields,
    lockSourceRow: (tx) => lockSourceRow(tx, organizationId, packId),
  });
}

export type { FinanceCandidateFields };
