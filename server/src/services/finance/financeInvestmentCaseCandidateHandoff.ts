/**
 * FIN-06 — Finance Investment Case (`financial_models`) -> canonical
 * Candidate handoff. Phase-2 adapter #1 of 3 over the shared
 * `financeCandidateHandoffCore.ts` foundation (Statement Pack / Valuation
 * Recommendation are separate, later adapters — not this file's concern).
 *
 * "Investment Case" here IS a `financial_models` row (T054 — Financial
 * Modeling of Initiatives): the eligibility gate is exactly the same
 * lifecycle guard `financialModelingService.updateModel()` already enforces
 * elsewhere — a model only reaches `status = 'approved'` via
 * `approveModel()`, which recomputes + validates first and stamps
 * `approved_by`/`approved_at`/`approved_snapshot`/`version` atomically. This
 * module never writes to `financial_models`; it only reads the already-
 * validated row.
 *
 * This module never inserts into `initiative_candidates` or
 * `finance_candidate_handoffs` directly — all locking/idempotency/writing is
 * delegated to `financeCandidateHandoffCore.ts` (`previewFinanceCandidateHandoff`
 * / `confirmFinanceCandidateHandoff` / `getFinanceCandidateHandoff`), exactly
 * as that module's own header mandates for every Phase-2 adapter.
 *
 * `resolveEligibleSource` takes NO arguments in both the preview and confirm
 * core signatures (see `financeCandidateHandoffCore.ts`) — the confirm path
 * still gets its TOCTOU defense "inside the lock" because
 * `confirmFinanceCandidateHandoff` calls `lockSourceRow(tx)` (a
 * `SELECT ... FOR UPDATE` on THIS module's pinned connection) BEFORE calling
 * `resolveEligibleSource()`. Any concurrent transaction attempting to change
 * this model's `status` blocks on that row lock until our transaction
 * commits or rolls back, so a plain (non-pinned) read for the eligibility
 * re-check is safe: nothing can change the row out from under us in the
 * window between the lock and the read, even though the re-check itself
 * runs on a different physical connection than the lock.
 *
 * Candidate `rationale` is built ONLY from columns that actually exist on
 * `financial_models` (see `server/migrations/571_financial_modeling_t054.sql`):
 * name, scenario, currency, horizon_months, approved_at, approved_by,
 * version, and (best-effort, defensively parsed) the `computedAt` timestamp
 * and period count persisted inside `approved_snapshot` at approval time.
 * There is no NPV/IRR/payback column or computed field anywhere in
 * `financialModelingService.ts` (confirmed by reading the whole file) — this
 * module does NOT fabricate any such metric. `fitScore` is deliberately
 * omitted for the same reason: no principled scoring signal exists yet for
 * this source type.
 */
import type { PinnedTransactionClient } from '../../database/PostgresDatabase.js';
import * as queryHelpers from '../../utils/queryHelpers.js';
import type {
  ConfirmFinanceCandidateHandoffResult,
  FinanceCandidateFields,
  FinanceCandidatePreviewResult,
  FinanceCandidateSourceSnapshot,
  FinanceSourceResolution,
} from './financeCandidateHandoffCore.js';
import {
  computeSourceFingerprint,
  confirmFinanceCandidateHandoff,
  emptySourceSnapshot,
  getFinanceCandidateHandoff,
  previewFinanceCandidateHandoff,
  unknownIfMissing,
} from './financeCandidateHandoffCore.js';

export const FINANCE_INVESTMENT_CASE_SOURCE_TYPE = 'finance_investment_case' as const;

interface FinancialModelRow {
  id: string;
  organization_id: string;
  name: string;
  currency: string | null;
  scenario: string | null;
  horizon_months: number | null;
  status: string | null;
  version: number | null;
  approved_by: string | null;
  approved_at: string | Date | null;
  approved_snapshot: string | null;
}

function toIsoString(value: string | Date | null): string | null {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : String(value);
}

interface ApprovedSnapshotValidation {
  checkName?: unknown;
  status?: unknown;
  message?: unknown;
}

/** Best-effort, defensive read of the approved snapshot — never throws. */
function readApprovedSnapshotFacts(snapshotJson: string | null): {
  computedAt: string | null;
  periodsCount: number | null;
  /**
   * Real, stored validation-check messages for checks that did NOT pass
   * (`status` = 'warning' | 'fail') — the closest genuine "risk" signal
   * `financial_models` carries (see `financialModelingService.ts`'s
   * `ValidationResult`/`ComputeResult`). `null` when the snapshot has no
   * `validations` array at all (distinct from a real, empty array, which
   * means the compute genuinely flagged nothing).
   */
  validationRisks: string[] | null;
} {
  if (!snapshotJson) return { computedAt: null, periodsCount: null, validationRisks: null };
  try {
    const parsed = JSON.parse(snapshotJson) as {
      computedAt?: unknown;
      periods?: unknown;
      validations?: unknown;
    };
    const computedAt = typeof parsed.computedAt === 'string' ? parsed.computedAt : null;
    const periodsCount = Array.isArray(parsed.periods) ? parsed.periods.length : null;
    let validationRisks: string[] | null = null;
    if (Array.isArray(parsed.validations)) {
      validationRisks = (parsed.validations as ApprovedSnapshotValidation[])
        .filter((v) => v && (v.status === 'warning' || v.status === 'fail'))
        .map((v) => String(v.message ?? v.checkName ?? 'validation flagged'))
        .filter(Boolean);
    }
    return { computedAt, periodsCount, validationRisks };
  } catch {
    return { computedAt: null, periodsCount: null, validationRisks: null };
  }
}

/**
 * Shared eligibility read for both the read-only preview and the mutating
 * confirm's TOCTOU re-check. Deliberately a PLAIN (non-tx) read — see file
 * header for why that is safe to call after `lockSourceRow` inside confirm.
 */
async function resolveEligibleInvestmentCase(
  organizationId: string,
  modelId: string
): Promise<FinanceSourceResolution<FinancialModelRow>> {
  const model = await queryHelpers.queryOne<FinancialModelRow>(
    `SELECT id, organization_id, name, currency, scenario, horizon_months, status, version,
            approved_by, approved_at, approved_snapshot
     FROM financial_models
     WHERE id = ? AND organization_id = ?`,
    [modelId, organizationId]
  );
  if (!model) {
    return { ok: false, reason: 'NOT_FOUND' };
  }
  if (model.status !== 'approved') {
    return { ok: false, reason: 'NOT_APPROVED' };
  }
  return { ok: true, data: model };
}

/**
 * Builds the structured, real-values-only `sourceSnapshot` for an approved
 * `financial_models` row (Codex correction, 2026-08-02 — see
 * `financeCandidateHandoffCore.ts`'s module header). Confirmed by reading
 * `financialModelingService.ts` in full: `financial_models` has NO npv/irr/
 * roi/payback column, and no computed-on-read function anywhere in that
 * service (or `investmentAppraisalService.ts` / `livingBusinessCaseService.ts`,
 * both pure math functions callers must feed cashflows/rates into — NOT
 * read-only accessors keyed by `modelId` — so using them here would mean
 * THIS module reimplementing the math, exactly what is forbidden). Those
 * four fields are honestly 'unknown'.
 *
 * capex/opex are ALSO 'unknown': `approved_snapshot.periods[]` (see
 * `computeModel`'s `PeriodOutput`) has per-period `pl.OPEX`/`cf.CAPEX_CF`
 * breakdowns, but no single aggregate figure — summing those periods would
 * be this module deriving a new number, not carrying one over verbatim.
 */
function buildInvestmentCaseSourceSnapshot(
  model: FinancialModelRow
): FinanceCandidateSourceSnapshot {
  const { validationRisks } = readApprovedSnapshotFacts(model.approved_snapshot);
  return {
    ...emptySourceSnapshot(),
    currency: unknownIfMissing(model.currency),
    // No aggregate CAPEX/OPEX column on financial_models and no stored
    // total in approved_snapshot (only per-period breakdowns) — see header.
    capex: 'unknown',
    opex: 'unknown',
    // No NPV/IRR/ROI/payback anywhere reachable by modelId — see header.
    npv: 'unknown',
    irr: 'unknown',
    roi: 'unknown',
    payback: 'unknown',
    // `scenario` is a real column, directly named for exactly this purpose.
    baselineOrScenario: unknownIfMissing(model.scenario),
    // No assumptions text/JSON field on financial_models (model events are
    // computation inputs, not a stored "assumptions" list) — honestly unknown.
    assumptions: 'unknown',
    // Real, stored validation-check messages from the approved compute run;
    // `[]` when the snapshot has a validations array but nothing failed/
    // warned (a genuine computed result), 'unknown' only when the snapshot
    // itself has no validations array at all.
    risks: validationRisks ?? 'unknown',
    sourceVersion: unknownIfMissing(
      typeof model.version === 'number' ? String(model.version) : null
    ),
    sourceFingerprint: computeSourceFingerprint({
      id: model.id,
      version: model.version,
      approvedAt: toIsoString(model.approved_at),
      approvedBy: model.approved_by,
      currency: model.currency,
      scenario: model.scenario,
      horizonMonths: model.horizon_months,
    }),
  };
}

/**
 * Builds the Candidate's draft title/rationale from a resolved (already
 * approved) `financial_models` row. Never invents a number: every fact
 * quoted here is read straight off the row (or its own `approved_snapshot`).
 */
function buildInvestmentCaseCandidateFields(model: FinancialModelRow): FinanceCandidateFields {
  const title = (model.name && model.name.trim()) || `Investment case ${model.id}`;

  const parts: string[] = [];
  parts.push(`Promoted from an approved Finance investment case (model ${model.id}).`);

  const scenario = model.scenario ? String(model.scenario) : null;
  const currency = model.currency ? String(model.currency) : null;
  if (scenario || currency || typeof model.horizon_months === 'number') {
    const bits = [
      scenario ? `scenario: ${scenario}` : null,
      currency ? `currency: ${currency}` : null,
      typeof model.horizon_months === 'number' ? `horizon: ${model.horizon_months} months` : null,
    ].filter(Boolean);
    parts.push(`Model parameters — ${bits.join(', ')}.`);
  }

  const approvedAt = toIsoString(model.approved_at);
  if (approvedAt) {
    const approver = model.approved_by ? ` by ${model.approved_by}` : '';
    const version = typeof model.version === 'number' ? ` (version ${model.version})` : '';
    parts.push(`Approved${approver} on ${approvedAt}${version}.`);
  }

  const { computedAt, periodsCount } = readApprovedSnapshotFacts(model.approved_snapshot);
  if (computedAt || typeof periodsCount === 'number') {
    const bits = [
      computedAt ? `computed ${computedAt}` : null,
      typeof periodsCount === 'number'
        ? `${periodsCount} period(s) in the approved snapshot`
        : null,
    ].filter(Boolean);
    parts.push(`Approved snapshot: ${bits.join(', ')}.`);
  }

  return {
    title,
    rationale: parts.join(' '),
    sourceSnapshot: buildInvestmentCaseSourceSnapshot(model),
  };
}

export async function previewInvestmentCaseCandidate(params: {
  organizationId: string;
  modelId: string;
}): Promise<FinanceCandidatePreviewResult> {
  const { organizationId, modelId } = params;
  return previewFinanceCandidateHandoff({
    organizationId,
    sourceType: FINANCE_INVESTMENT_CASE_SOURCE_TYPE,
    sourceId: modelId,
    resolveEligibleSource: () => resolveEligibleInvestmentCase(organizationId, modelId),
    buildCandidateFields: buildInvestmentCaseCandidateFields,
  });
}

export async function confirmInvestmentCaseCandidateHandoff(params: {
  organizationId: string;
  modelId: string;
  createdBy?: string | null;
}): Promise<ConfirmFinanceCandidateHandoffResult> {
  const { organizationId, modelId, createdBy } = params;
  return confirmFinanceCandidateHandoff({
    organizationId,
    sourceType: FINANCE_INVESTMENT_CASE_SOURCE_TYPE,
    sourceId: modelId,
    createdBy: createdBy ?? null,
    // Re-resolved INSIDE the pinned tx's lock window opened by
    // confirmFinanceCandidateHandoff — see file header for why a plain
    // (non-tx) read here is still race-safe.
    resolveEligibleSource: () => resolveEligibleInvestmentCase(organizationId, modelId),
    buildCandidateFields: buildInvestmentCaseCandidateFields,
    lockSourceRow: (tx) => lockInvestmentCaseRow(tx, organizationId, modelId),
  });
}

/**
 * `SELECT ... FOR UPDATE` on the `financial_models` row, using the pinned tx
 * — serializes concurrent handoff attempts for the same model, same
 * discipline as `drdCandidateHandoff.ts` / `interviewCandidateHandoff.ts`.
 */
async function lockInvestmentCaseRow(
  tx: PinnedTransactionClient,
  organizationId: string,
  modelId: string
): Promise<void> {
  await tx.queryOne<{ id: string }>(
    `SELECT id FROM financial_models WHERE id = ? AND organization_id = ? FOR UPDATE`,
    [modelId, organizationId]
  );
}

export async function getInvestmentCaseCandidateHandoff(params: {
  organizationId: string;
  modelId: string;
}) {
  return getFinanceCandidateHandoff({
    organizationId: params.organizationId,
    sourceType: FINANCE_INVESTMENT_CASE_SOURCE_TYPE,
    sourceId: params.modelId,
  });
}
