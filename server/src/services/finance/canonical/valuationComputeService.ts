/**
 * Finance v3 canonical — Enterprise Valuation compute orchestration (Gate D / Fala 7, WP-D10).
 *
 * Program: `docs/validation/finance-v3/FINANCE_COMPLETE_PROGRAM_CLAUDE_HANDOFF_2026-08-09.md`
 * section 9. Schema: `WP-D09_valuation_schema_ADR.md` (`finance_valuation_methods` section 7 —
 * flagship N/A!=zero + basket weight=100 mechanism; section 13 — `job_type='VALUATION_COMPUTE'`,
 * documented rather than the reserved `valuation_compute`, same precedent WP-D06/`BASELINE_COMPUTE`
 * and WP-D07/`PREDICTION_COMPUTE` already established).
 *
 * Ties together, in one place, the layers this WP's other five files each own independently:
 *   `valuationFcffService`      → FCFF per projection year (lineage-resolved, unit-normalized)
 *   `valuationWaccService`      → WACC (CAPM + Hamada relever), consistency-gated
 *   `valuationTerminalService`  → Gordon/exit-multiple terminal value, g<WACC-gated
 *   `valuationDiscountService`  → PV of FCFF + terminal → Enterprise Value
 *   `valuationBridgeService`    → EV → Equity (optional per run)
 *   `valuationSensitivityService` → 5×5 grid (optional per run)
 *
 * closing exactly the `compute_jobs`/`finance_valuation_methods` gap `WP-D09_valuation_schema_ADR.md`
 * section 5/13 explicitly deferred ("kontraktowana, nie egzekwowana schematem... zakres przyszłego
 * Valuation Compute WP").
 */

import { createHash, randomUUID as uuidv4 } from 'node:crypto';

import { withPinnedPostgresTransaction } from '../../../database/PostgresDatabase.js';
import { stampWorkingRevisionComputeIdentity } from './artifactVersionService.js';
import { canonicalPayloadHash } from './contentHash.js';
import * as computeJobService from './computeJobService.js';
import type { ComputeJobRow } from './computeJobService.js';
import { computeFcffSeries, type FcffYearInput, type FcffYearResult } from './valuationFcffService.js';
import { computeWacc, loadWaccInputs, persistComputedWacc, type WaccBreakdown } from './valuationWaccService.js';
import { computeGordonTerminalValue, writeTerminalRow } from './valuationTerminalService.js';
import { discountCashFlows, type DiscountCashFlowsResult } from './valuationDiscountService.js';

// ---------------------------------------------------------------------------
// finance_valuation_methods — find-or-create, result read/write
// ---------------------------------------------------------------------------

export type MethodType =
  | 'DCF_FCFF'
  | 'DCF_FCFE'
  | 'DIVIDEND_DISCOUNT'
  | 'TRADING_COMPS'
  | 'PRECEDENT_TRANSACTIONS'
  | 'ASSET_BASED'
  | 'OTHER_WITH_POLICY';

export type MethodReadiness = 'NOT_CONFIGURED' | 'DATA_INCOMPLETE' | 'READY' | 'COMPUTE_FAILED';
export type MethodResultValueStatus = 'PRESENT_ZERO' | 'PRESENT_NONZERO' | 'MISSING' | 'NA' | 'NOT_APPLICABLE';

export interface MethodRow {
  id: string;
  organization_id: string;
  business_version_id: string;
  method_type: MethodType;
  readiness: MethodReadiness;
  result_value_status: MethodResultValueStatus;
  result_ev_decimal: string | null;
  is_in_recommendation_basket: boolean;
  weight_pct: string | null;
}

export type FindOrCreateMethodResult =
  | { ok: true; method: MethodRow }
  | { ok: false; code: 'BUSINESS_VERSION_NOT_FOUND'; message: string };

/**
 * W9-C-3 fix. Previously selected by `business_version_id + method_type` alone
 * (no `organization_id` predicate) — org A calling with org B's
 * `businessVersionId` got B's method row back, `organization_id` included,
 * which was then the vector into W9-C-4 (`writeSensitivityGrid` trusting a
 * cross-tenant `methodId`). Now verifies the business version itself belongs
 * to `organizationId` FIRST and refuses typed — `BUSINESS_VERSION_NOT_FOUND`,
 * never a raw Postgres FK violation from the INSERT branch below (the
 * business_versions/organization_id pair not existing would otherwise surface
 * as an unhandled 23503 from `fk_finance_valuation_methods_bv_org`).
 */
export async function findOrCreateMethod(params: {
  organizationId: string;
  businessVersionId: string;
  methodType: MethodType;
  createdBy: string;
  applicabilityPolicyRef?: string | null;
}): Promise<FindOrCreateMethodResult> {
  return withPinnedPostgresTransaction(async (tx) => {
    const bv = await tx.queryOne<{ business_version_id: string }>(
      `SELECT business_version_id FROM finance_business_versions WHERE business_version_id = ? AND organization_id = ?`,
      [params.businessVersionId, params.organizationId]
    );
    if (!bv) {
      return {
        ok: false,
        code: 'BUSINESS_VERSION_NOT_FOUND',
        message: `business_version ${params.businessVersionId} not found for organization ${params.organizationId}`,
      };
    }

    const existing = await tx.queryOne<MethodRow>(
      `SELECT * FROM finance_valuation_methods WHERE business_version_id = ? AND organization_id = ? AND method_type = ?`,
      [params.businessVersionId, params.organizationId, params.methodType]
    );
    if (existing) return { ok: true, method: existing };
    const inserted = await tx.queryOne<MethodRow>(
      `INSERT INTO finance_valuation_methods (id, organization_id, business_version_id, method_type, applicability_policy_ref, created_by)
       VALUES (?, ?, ?, ?, ?, ?) RETURNING *`,
      [uuidv4(), params.organizationId, params.businessVersionId, params.methodType, params.applicabilityPolicyRef ?? null, params.createdBy]
    );
    if (!inserted) throw new Error('finance_valuation_methods insert returned no row');
    return { ok: true, method: inserted };
  });
}

export type SetMethodResultErrorCode = 'RESULT_READINESS_MISMATCH';
export type SetMethodResultResult = { ok: true } | { ok: false; code: SetMethodResultErrorCode; message: string };

/**
 * Mirrors `chk_finance_methods_result_matches_readiness` (WP-D09 section 7.2, Layer 2 of N/A!=zero)
 * client-side, BEFORE attempting the UPDATE the DB CHECK would also reject — same "friendly error
 * first, DB constraint is still authoritative" discipline as `valuationTerminalService.assertGBelowWacc()`.
 * A method can never be written `READY` with no result, nor `NOT_CONFIGURED`/`DATA_INCOMPLETE`/
 * `COMPUTE_FAILED` with a present (non-N/A) result — this is the exact rule this WP's Apator-scale
 * and N/A-comps regression tests both exercise through this function.
 */
export function assertResultReadinessConsistency(
  readiness: MethodReadiness,
  resultValueStatus: MethodResultValueStatus
): SetMethodResultResult {
  const readyLike = readiness === 'READY';
  const resultPresent = resultValueStatus === 'PRESENT_ZERO' || resultValueStatus === 'PRESENT_NONZERO';
  if (readyLike && !resultPresent) {
    return { ok: false, code: 'RESULT_READINESS_MISMATCH', message: `readiness='READY' requires a PRESENT_ZERO/PRESENT_NONZERO result, got '${resultValueStatus}'` };
  }
  if (!readyLike && resultPresent) {
    return { ok: false, code: 'RESULT_READINESS_MISMATCH', message: `readiness='${readiness}' requires a MISSING/NA/NOT_APPLICABLE result, got '${resultValueStatus}' (N/A can never be a silent zero)` };
  }
  return { ok: true };
}

export async function setMethodResult(params: {
  methodId: string;
  readiness: MethodReadiness;
  resultValueStatus: MethodResultValueStatus;
  resultEvDecimal: number | null;
}): Promise<SetMethodResultResult> {
  const gate = assertResultReadinessConsistency(params.readiness, params.resultValueStatus);
  if (!gate.ok) return gate;
  await withPinnedPostgresTransaction((tx) =>
    tx.queryRun(
      `UPDATE finance_valuation_methods SET readiness = ?, result_value_status = ?, result_ev_decimal = ?, updated_at = now() WHERE id = ?`,
      [params.readiness, params.resultValueStatus, params.resultEvDecimal, params.methodId]
    )
  );
  return { ok: true };
}

export async function setMethodBasket(params: { methodId: string; isInRecommendationBasket: boolean; weightPct: number | null }): Promise<void> {
  await withPinnedPostgresTransaction((tx) =>
    tx.queryRun(
      `UPDATE finance_valuation_methods SET is_in_recommendation_basket = ?, weight_pct = ?, updated_at = now() WHERE id = ?`,
      [params.isInRecommendationBasket, params.weightPct, params.methodId]
    )
  );
}

// ---------------------------------------------------------------------------
// Pakiet B3 (Valuation HTTP Surface) — thin readers + one atomic batch writer for the basket
// ---------------------------------------------------------------------------

export async function listMethods(organizationId: string, businessVersionId: string): Promise<MethodRow[]> {
  return withPinnedPostgresTransaction((tx) =>
    tx.queryAll<MethodRow>(
      `SELECT * FROM finance_valuation_methods WHERE organization_id = ? AND business_version_id = ? ORDER BY method_type`,
      [organizationId, businessVersionId]
    )
  );
}

export async function getMethod(organizationId: string, methodId: string): Promise<MethodRow | null> {
  return withPinnedPostgresTransaction((tx) =>
    tx.queryOne<MethodRow>(`SELECT * FROM finance_valuation_methods WHERE organization_id = ? AND id = ?`, [organizationId, methodId])
  );
}

export type SetBasketWeightsResult = { ok: true; methods: MethodRow[] } | { ok: false; code: 'METHOD_NOT_FOUND'; message: string };

/**
 * Writes ALL basket membership/weight changes for a variant in ONE call —
 * `withPinnedPostgresTransaction` is one physical BEGIN...COMMIT per call — deliberately, because
 * `trg_finance_valuation_methods_weight_sum` (WP-D09b migration 02) is a `DEFERRABLE INITIALLY
 * DEFERRED` constraint trigger: it only evaluates the basket's weight sum once, at COMMIT, across
 * every row touched inside that one transaction. A caller doing three separate one-method PATCH
 * calls (34/33/33) would fail on the very first UPDATE (sum=34≠100); batching them here is what
 * makes a legitimate multi-method rebalance possible at all — same "validate the whole transaction
 * at COMMIT, not the first intermediate row" idiom the basket weight-sum trigger itself documents
 * (WP-D09 section 7.3), and the same reason `writeSensitivityGrid()`/`upsertAssumptionsBatch()`
 * (Pakiet B2) write their whole batch in one transaction too. Cross-check methods (never in the
 * basket) simply pass `isInRecommendationBasket: false, weightPct: null` here — `weightPct` is
 * physically NULL for them (`chk_finance_methods_weight_basket_only`), never mechanically part of
 * the weighted sum (DEC-FIN-005 point 2 — "Cross-checki są NIEWAŻONE").
 */
export async function setBasketWeights(params: {
  organizationId: string;
  businessVersionId: string;
  updates: readonly { methodId: string; isInRecommendationBasket: boolean; weightPct: number | null }[];
}): Promise<SetBasketWeightsResult> {
  return withPinnedPostgresTransaction(async (tx) => {
    for (const u of params.updates) {
      const method = await tx.queryOne<{ id: string }>(
        `SELECT id FROM finance_valuation_methods WHERE id = ? AND organization_id = ? AND business_version_id = ?`,
        [u.methodId, params.organizationId, params.businessVersionId]
      );
      if (!method) {
        return {
          ok: false,
          code: 'METHOD_NOT_FOUND',
          message: `method ${u.methodId} not found for business_version ${params.businessVersionId} / organization ${params.organizationId}`,
        } as const;
      }
    }
    for (const u of params.updates) {
      await tx.queryRun(
        `UPDATE finance_valuation_methods SET is_in_recommendation_basket = ?, weight_pct = ?, updated_at = now() WHERE id = ?`,
        [u.isInRecommendationBasket, u.weightPct, u.methodId]
      );
    }
    const methods = await tx.queryAll<MethodRow>(
      `SELECT * FROM finance_valuation_methods WHERE organization_id = ? AND business_version_id = ? ORDER BY method_type`,
      [params.organizationId, params.businessVersionId]
    );
    return { ok: true, methods } as const;
  });
}

// ---------------------------------------------------------------------------
// Comps readiness — "0 comps configured" vs "READY with an empty peer set" (WP-D09 section 11)
// ---------------------------------------------------------------------------

/**
 * `usableComps` = count of `finance_valuation_comps` rows for the method with
 * `is_outlier_excluded=false AND metric_value_status IN ('PRESENT_ZERO','PRESENT_NONZERO')` — the
 * exact predicate `finance_valuation_methods_check_comps_readiness()` (WP-D09b migration file 2)
 * already enforces at the DB layer. This function is the service-layer mirror used to decide what
 * READINESS/RESULT to write in the first place, so the DB trigger is a backstop, not the only guard.
 */
export function assessCompsReadiness(usableComps: number): MethodReadiness {
  return usableComps > 0 ? 'READY' : 'NOT_CONFIGURED';
}

// ---------------------------------------------------------------------------
// Weighted recommendation basket (handoff section 9 / OWN-FIN-021)
// ---------------------------------------------------------------------------

export type WeightedRecommendationResult =
  | { status: 'NO_BASKET' }
  | { status: 'INCOMPLETE'; notReadyMethodTypes: MethodType[] }
  | { status: 'READY'; weightedEnterpriseValue: number; contributions: { methodType: MethodType; weightPct: number; resultEvDecimal: number; contribution: number }[] };

/**
 * Weighted average across `is_in_recommendation_basket=true` methods ONLY — a method excluded from
 * the basket (cross-check, or simply not yet ready) never contributes, silently or otherwise. A
 * basket member that is not `readiness='READY'` makes the WHOLE recommendation `INCOMPLETE` (never
 * drops that member's weight and silently re-normalizes the rest — that would be a different,
 * un-requested weighting scheme the analyst never approved).
 */
export function computeWeightedRecommendation(methods: readonly MethodRow[]): WeightedRecommendationResult {
  const basket = methods.filter((m) => m.is_in_recommendation_basket);
  if (basket.length === 0) return { status: 'NO_BASKET' };

  const notReady = basket.filter((m) => m.readiness !== 'READY' || m.result_ev_decimal === null);
  if (notReady.length > 0) {
    return { status: 'INCOMPLETE', notReadyMethodTypes: notReady.map((m) => m.method_type) };
  }

  const contributions = basket.map((m) => {
    const weightPct = Number(m.weight_pct);
    const resultEvDecimal = Number(m.result_ev_decimal);
    return { methodType: m.method_type, weightPct, resultEvDecimal, contribution: (weightPct / 100) * resultEvDecimal };
  });
  const weightedEnterpriseValue = contributions.reduce((sum, c) => sum + c.contribution, 0);
  return { status: 'READY', weightedEnterpriseValue, contributions };
}

// ---------------------------------------------------------------------------
// Full DCF/FCFF run — FCFF -> WACC -> terminal -> discount -> EV, wrapped as a compute_jobs row
// ---------------------------------------------------------------------------

export interface RunDcfFcffValuationParams {
  organizationId: string;
  valuationBusinessVersionId: string;
  entityId: string;
  requestedByUserId: string;
  engineManifestId: string;
  requestId?: string | null;
  projectionYears: readonly FcffYearInput[];
  openingWorkingCapital: number | null;
  terminal: { gPct: number };
}

export type RunDcfFcffValuationResult =
  | {
      ok: true;
      job: ComputeJobRow;
      methodId: string;
      fcffYears: FcffYearResult[];
      wacc: WaccBreakdown;
      terminalValue: number;
      discounted: DiscountCashFlowsResult;
      enterpriseValue: number;
    }
  | {
      ok: false;
      code:
        | 'NO_VALUATION_SOURCE_EDGE'
        | 'MULTIPLE_VALUATION_SOURCE_EDGES'
        | 'UNKNOWN_CANONICAL_LINE'
        | 'INCONSISTENT_CURRENCY'
        | 'NO_WACC_INPUTS'
        | 'WACC_COMPUTE_FAILED'
        | 'FCFF_NOT_FULLY_PRESENT'
        | 'TERMINAL_G_MUST_BE_LESS_THAN_WACC'
        | 'BUSINESS_VERSION_NOT_FOUND'
        // W9-B-2 fix: `completeJobSuccess()` reported `NOT_RUNNING` (job
        // cancelled/lease-expired/already terminal before we could commit its
        // output) — never report success for a run whose compute_job_outputs
        // commit did not happen. See W2_FALSE_SUCCESS_W9B2_report.md. Before
        // this fix, `completed.ok` was checked ONLY to pick `finalJob` — the
        // function still unconditionally returned `{ ok: true, ... }` even
        // when `completed.ok === false`. That was the canonical instance of
        // this defect.
        | 'JOB_NOT_RUNNING';
      message: string;
    };

export async function runDcfFcffValuation(params: RunDcfFcffValuationParams): Promise<RunDcfFcffValuationResult> {
  const fcffResult = await computeFcffSeries({
    organizationId: params.organizationId,
    valuationBusinessVersionId: params.valuationBusinessVersionId,
    entityId: params.entityId,
    // cashTaxRatePct is filled in once WACC inputs are loaded below; FCFF is recomputed with the
    // real tax rate before use. A first pass with 0 lets us read currency/lineage cheaply — see note below.
    cashTaxRatePct: 0,
    projectionYears: params.projectionYears,
    openingWorkingCapital: params.openingWorkingCapital,
  });
  if (!fcffResult.ok) return fcffResult;

  const waccInputs = await loadWaccInputs(params.organizationId, params.valuationBusinessVersionId);
  if (!waccInputs) {
    return { ok: false, code: 'NO_WACC_INPUTS', message: `No finance_valuation_wacc_inputs row for business_version_id ${params.valuationBusinessVersionId}` };
  }

  // Recompute FCFF with the REAL cash_tax_rate_pct from WACC inputs (the formula's own tax rate,
  // WP-D09 section 5 — never hardcoded, never assumed equal to the Baseline's statutory rate).
  const cashTaxRatePct = waccInputs.cash_tax_rate_pct === null ? 0 : Number(waccInputs.cash_tax_rate_pct);
  const fcff =
    cashTaxRatePct === 0
      ? fcffResult
      : await computeFcffSeries({
          organizationId: params.organizationId,
          valuationBusinessVersionId: params.valuationBusinessVersionId,
          entityId: params.entityId,
          cashTaxRatePct,
          projectionYears: params.projectionYears,
          openingWorkingCapital: params.openingWorkingCapital,
        });
  if (!fcff.ok) return fcff;

  const waccResult = computeWacc(waccInputs, fcff.currency);
  if (!waccResult.ok) {
    return { ok: false, code: 'WACC_COMPUTE_FAILED', message: `${waccResult.code}: ${waccResult.message}` };
  }
  await persistComputedWacc(params.organizationId, params.valuationBusinessVersionId, waccResult.breakdown);

  const methodResult = await findOrCreateMethod({
    organizationId: params.organizationId,
    businessVersionId: params.valuationBusinessVersionId,
    methodType: 'DCF_FCFF',
    createdBy: params.requestedByUserId,
  });
  if (!methodResult.ok) {
    return { ok: false, code: 'BUSINESS_VERSION_NOT_FOUND', message: methodResult.message };
  }
  const method = methodResult.method;

  const notPresent = fcff.years.filter((y) => y.status !== 'PRESENT');
  if (notPresent.length > 0) {
    await setMethodResult({ methodId: method.id, readiness: 'DATA_INCOMPLETE', resultValueStatus: 'MISSING', resultEvDecimal: null });
    return {
      ok: false,
      code: 'FCFF_NOT_FULLY_PRESENT',
      message: `FCFF is MISSING for fiscal year(s) ${notPresent.map((y) => y.fiscalYear).join(', ')}: ${notPresent.map((y) => y.missingReason).join('; ')}`,
    };
  }

  const terminalYearFcff = fcff.years[fcff.years.length - 1].fcff!;
  const terminal = computeGordonTerminalValue({ fcffTerminalYear: terminalYearFcff, gPct: params.terminal.gPct, waccPct: waccResult.breakdown.waccPct });
  if (!terminal.ok) {
    await setMethodResult({ methodId: method.id, readiness: 'COMPUTE_FAILED', resultValueStatus: 'MISSING', resultEvDecimal: null });
    return { ok: false, code: 'TERMINAL_G_MUST_BE_LESS_THAN_WACC', message: terminal.message };
  }

  const discounted = discountCashFlows({
    years: fcff.years.map((y) => ({ fiscalYear: y.fiscalYear, fcff: y.fcff! })),
    waccPct: waccResult.breakdown.waccPct,
    terminalValue: terminal.terminalValue,
  });

  await writeTerminalRow({
    organizationId: params.organizationId,
    methodId: method.id,
    convention: 'GORDON_GROWTH',
    gPct: params.terminal.gPct,
    terminalValueDecimal: terminal.terminalValue,
    terminalSharePct: discounted.terminalSharePct,
    isPrimary: true,
    createdBy: params.requestedByUserId,
  });

  const setResult = await setMethodResult({
    methodId: method.id,
    readiness: 'READY',
    resultValueStatus: discounted.enterpriseValue === 0 ? 'PRESENT_ZERO' : 'PRESENT_NONZERO',
    resultEvDecimal: discounted.enterpriseValue,
  });
  if (!setResult.ok) throw new Error(`runDcfFcffValuation: internal inconsistency writing method result: ${setResult.message}`);

  // --- compute_jobs bookkeeping (job_type='VALUATION_COMPUTE', ADR section 13) ---
  const bv = await withPinnedPostgresTransaction((tx) =>
    tx.queryOne<{ artifact_id: string; source_working_revision_id: string | null }>(
      `SELECT artifact_id, source_working_revision_id FROM finance_business_versions WHERE business_version_id = ?`,
      [params.valuationBusinessVersionId]
    )
  );
  if (!bv) throw new Error(`runDcfFcffValuation: no finance_business_versions row for ${params.valuationBusinessVersionId}`);
  if (!bv.source_working_revision_id) {
    throw new Error(`runDcfFcffValuation: finance_business_versions.source_working_revision_id is not set for ${params.valuationBusinessVersionId}`);
  }

  const inputRevisionHash = createHash('sha256')
    .update(JSON.stringify({ businessVersionId: params.valuationBusinessVersionId, entityId: params.entityId, projectionYears: params.projectionYears, terminal: params.terminal }))
    .digest('hex');
  const { job } = await computeJobService.enqueue({
    organizationId: params.organizationId,
    jobType: 'VALUATION_COMPUTE',
    inputArtifactId: bv.artifact_id,
    inputRevisionHash,
    engineManifestId: params.engineManifestId,
    idempotencyKey: `valuation-compute:${params.valuationBusinessVersionId}:${inputRevisionHash}`,
    requestedByUserId: params.requestedByUserId,
    requestId: params.requestId ?? null,
  });
  // NEW-3 fix: self-claim the EXACT row just enqueued (by id, org-scoped) —
  // never the globally-oldest queued VALUATION_COMPUTE job across every
  // organization (see computeJobService.claimById doc comment).
  const claimed = await computeJobService.claimById({
    organizationId: params.organizationId,
    jobId: job.id,
    workerId: `valuationComputeService:${uuidv4()}`,
  });
  if (!claimed) {
    throw new Error(
      `valuationComputeService: failed to self-claim just-enqueued job ${job.id} (organization ${params.organizationId}) — row is no longer 'queued' (concurrent claim or already terminal)`
    );
  }
  const runningJob = claimed;

  const contentSemanticHash = canonicalPayloadHash({ enterpriseValue: discounted.enterpriseValue, fcff: fcff.years });
  const completed = await computeJobService.completeJobSuccess({
    jobId: runningJob.id,
    organizationId: params.organizationId,
    outputArtifactId: bv.artifact_id,
    outputBusinessVersionId: params.valuationBusinessVersionId,
    outputWorkingRevisionId: bv.source_working_revision_id,
    contentSemanticHash,
  });
  // W9-B-2 fix: `completed.ok` used to be checked ONLY to decide `finalJob`
  // below — this function still unconditionally returned `{ ok: true, ... }`
  // even when completeJobSuccess() reported NOT_RUNNING (job cancelled/
  // lease-expired/already terminal), the canonical "false success" instance
  // of this defect. Now: NOT_RUNNING is propagated as a typed failure and we
  // stop here — never report success for a run whose compute_job_outputs
  // commit did not happen. OUTPUT_ALREADY_COMMITTED is treated as an
  // idempotent-safe outcome — see report §"NOT_RUNNING vs
  // OUTPUT_ALREADY_COMMITTED".
  if (!completed.ok && completed.code === 'NOT_RUNNING') {
    return {
      ok: false,
      code: 'JOB_NOT_RUNNING',
      message: `runDcfFcffValuation: completeJobSuccess reported NOT_RUNNING for job ${runningJob.id}: ${completed.message}`,
    };
  }
  // W10-D01 fix — see baselineComputeService.ts's identical call for the full rationale.
  await stampWorkingRevisionComputeIdentity({
    organizationId: params.organizationId,
    workingRevisionId: bv.source_working_revision_id,
    contentSemanticHash,
    computeRunId: runningJob.id,
  });
  const finalJob = completed.ok ? completed.job : ((await computeJobService.getJob(params.organizationId, job.id)) ?? runningJob);

  return {
    ok: true,
    job: finalJob,
    methodId: method.id,
    fcffYears: fcff.years,
    wacc: waccResult.breakdown,
    terminalValue: terminal.terminalValue,
    discounted,
    enterpriseValue: discounted.enterpriseValue,
  };
}
