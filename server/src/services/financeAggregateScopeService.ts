/**
 * Finance aggregate scope — A1 firma / A2 inicjatywa / A3 portfel-scenariusz.
 *
 * SSOT: Harvard/wdrozenie-100/_KONCEPT_FINANCE_2026-07-10.md §2.1.
 *
 * Additive service, does NOT duplicate the statement pack engine
 * (financialStatementPackService.ts) or the reconcile engine
 * (reconciliationService.ts) — it reuses `loadPackValueMaps` for reading A1
 * values and produces `AggregateStatements` in the exact same
 * `{ pnl, bs, cf }` shape as `reconciliationService.ts`'s `PeriodStatements`
 * so a computed A2/A3 result can be fed straight into `reconcileStatements()`
 * by a caller if/when it is materialized as a real pack.
 *
 * Three agregaty (poziomy konsolidacji):
 * - A1 FIRMA (klient)   — an existing, imported/entered statement pack.
 *                         Nothing to compute here; `aggregate_scope='company'`
 *                         is just a classification (see migration 915).
 * - A2 INICJATYWA       — pro-forma delta-P&L/BS/CF for ONE initiative,
 *                         computed from `budget_initiative_links`
 *                         (revenue_uplift/cost_savings/capex_required — the
 *                         structured source) with a fallback to
 *                         `initiative_benefits.estimated_annual_value` (the
 *                         legacy, less structured source) when no budget
 *                         link exists. Finance↔Results bridge.
 * - A3 PORTFEL/SCENARIUSZ — A1 + Σ(selected A2) = "firma po transformacji".
 *
 * Design split (deterministic-TS discipline, mirrors
 * realizedValueReconciliationService.ts's `reconcile`/`reconcilePortfolio`):
 * the arithmetic (`computeInitiativeDeltaStatements`,
 * `sumAggregateStatements`, `computePortfolioAggregateStatements`) is PURE —
 * no I/O — so it is unit-testable without a database. Thin async wrappers
 * (`computeInitiativeDeltaForOrg`, `computePortfolioAggregateForPack`,
 * `getPackAggregateScope`) load DB rows and hand them to the pure functions.
 *
 * "Brak danych → skip, nie 0": when neither budget_initiative_links nor
 * initiative_benefits has a nonzero signal for an initiative, the delta is
 * `null` (the initiative is reported in `skippedInitiativeIds`, not folded
 * into the sum as a phantom zero).
 */

import { all as dbAll, get as dbGet } from '../utils/DbPromise.js';

import { loadPackValueMaps } from './financialStatementPackService.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AggregateScope = 'company' | 'initiative' | 'portfolio';

/** {CANONICAL_LINE_CODE: value} — same shape as reconciliationService's PeriodStatements.pnl/bs/cf. */
export type StatementLineMap = Record<string, number>;

export interface AggregateStatements {
  pnl: StatementLineMap;
  bs: StatementLineMap;
  cf: StatementLineMap;
}

export type InitiativeDeltaSourceType = 'budget_initiative_links' | 'initiative_benefits' | 'none';

export interface BudgetInitiativeLinkTotals {
  revenueUpliftSum: number;
  costSavingsSum: number;
  capexRequiredSum: number;
  linkCount: number;
}

export interface InitiativeBenefitTotals {
  estimatedAnnualValueSum: number;
  benefitCount: number;
}

export interface InitiativeDeltaInputs {
  initiativeId: string;
  budgetLinks: BudgetInitiativeLinkTotals | null;
  benefits: InitiativeBenefitTotals | null;
}

export interface InitiativeDeltaResult {
  scope: 'initiative';
  initiativeId: string;
  sourceType: InitiativeDeltaSourceType;
  statements: AggregateStatements;
}

export interface PortfolioAggregateResult {
  scope: 'portfolio';
  basePackId: string;
  includedInitiativeIds: string[];
  skippedInitiativeIds: string[];
  statements: AggregateStatements;
}

// ---------------------------------------------------------------------------
// Pure arithmetic — deterministic TS, zero I/O, zero LLM (unit-testable)
// ---------------------------------------------------------------------------

function emptyStatements(): AggregateStatements {
  return { pnl: {}, bs: {}, cf: {} };
}

function addLineMaps(...maps: StatementLineMap[]): StatementLineMap {
  const out: StatementLineMap = {};
  for (const map of maps) {
    for (const [code, rawValue] of Object.entries(map || {})) {
      const value = Number(rawValue);
      if (!Number.isFinite(value)) continue;
      out[code] = (out[code] || 0) + value;
    }
  }
  return out;
}

/**
 * A1 + Σ(deltas), line-code-wise. Union of all codes present in any input —
 * a line only present in a delta (e.g. an initiative introduces a brand-new
 * cost line) still surfaces in the result.
 */
export function sumAggregateStatements(
  base: AggregateStatements,
  deltas: AggregateStatements[]
): AggregateStatements {
  return {
    pnl: addLineMaps(base.pnl, ...deltas.map((d) => d.pnl)),
    bs: addLineMaps(base.bs, ...deltas.map((d) => d.bs)),
    cf: addLineMaps(base.cf, ...deltas.map((d) => d.cf)),
  };
}

/**
 * Pure: build the A2 pro-forma delta for ONE initiative from pre-aggregated
 * DB totals. Deterministic — no I/O, no LLM.
 *
 * Precedence: `budget_initiative_links` (structured revenue/cost/capex split,
 * `financeCanonicalRegistry` sign convention: REVENUE positive_normal, OPEX &
 * CAPEX display_absolute magnitudes) wins whenever it carries at least one
 * nonzero field. Otherwise falls back to `initiative_benefits` —
 * `estimated_annual_value` is mapped to REVENUE as a documented
 * simplification (the benefits register does not reliably distinguish
 * revenue-growth vs cost-reduction via `benefit_type` today; see
 * `_KONCEPT_FINANCE_2026-07-10.md` §2.1). Returns `null` — skip, not zero —
 * when neither source has a usable signal.
 */
export function computeInitiativeDeltaStatements(
  inputs: InitiativeDeltaInputs
): InitiativeDeltaResult | null {
  const links = inputs.budgetLinks;
  const hasLinkSignal =
    !!links &&
    (links.revenueUpliftSum !== 0 || links.costSavingsSum !== 0 || links.capexRequiredSum !== 0);

  if (hasLinkSignal && links) {
    const pnl: StatementLineMap = {};
    const cf: StatementLineMap = {};
    if (links.revenueUpliftSum !== 0) pnl.REVENUE = links.revenueUpliftSum;
    // OPEX is a display_absolute magnitude; savings REDUCE that magnitude.
    if (links.costSavingsSum !== 0) pnl.OPEX = -links.costSavingsSum;
    // CAPEX is a display_absolute magnitude; incremental spend ADDS to it.
    if (links.capexRequiredSum !== 0) cf.CAPEX = links.capexRequiredSum;
    return {
      scope: 'initiative',
      initiativeId: inputs.initiativeId,
      sourceType: 'budget_initiative_links',
      statements: { pnl, bs: {}, cf },
    };
  }

  const benefits = inputs.benefits;
  if (benefits && benefits.estimatedAnnualValueSum !== 0) {
    return {
      scope: 'initiative',
      initiativeId: inputs.initiativeId,
      sourceType: 'initiative_benefits',
      statements: { pnl: { REVENUE: benefits.estimatedAnnualValueSum }, bs: {}, cf: {} },
    };
  }

  return null;
}

/**
 * Pure: A3 = A1 (base) + Σ(A2 for included initiatives). Initiatives whose
 * delta computed to `null` (no data) are reported in `skippedInitiativeIds`
 * and excluded from the sum — they never contribute an implicit zero.
 */
export function computePortfolioAggregateStatements(params: {
  basePackId: string;
  base: AggregateStatements;
  initiativeDeltas: Array<{ initiativeId: string; result: InitiativeDeltaResult | null }>;
}): PortfolioAggregateResult {
  const includedInitiativeIds: string[] = [];
  const skippedInitiativeIds: string[] = [];
  const deltaStatements: AggregateStatements[] = [];

  for (const { initiativeId, result } of params.initiativeDeltas) {
    if (!result) {
      skippedInitiativeIds.push(initiativeId);
      continue;
    }
    includedInitiativeIds.push(initiativeId);
    deltaStatements.push(result.statements);
  }

  return {
    scope: 'portfolio',
    basePackId: params.basePackId,
    includedInitiativeIds,
    skippedInitiativeIds,
    statements: sumAggregateStatements(params.base, deltaStatements),
  };
}

// ---------------------------------------------------------------------------
// DB-touching wrappers — load rows, delegate arithmetic to the pure functions
// above. Not unit-tested directly (no DB in worker tests); covered by the
// pure functions + reused, already-tested primitives (loadPackValueMaps).
// ---------------------------------------------------------------------------

function isSchemaCompatError(error: unknown): boolean {
  const message = String((error as Error)?.message || error || '').toLowerCase();
  return (
    message.includes('does not exist') ||
    message.includes('no such column') ||
    message.includes('no such table') ||
    message.includes('undefined column')
  );
}

async function loadBudgetInitiativeLinkTotals(
  organizationId: string,
  initiativeId: string
): Promise<BudgetInitiativeLinkTotals | null> {
  const row = await dbGet<{
    revenue_uplift_sum?: number | string | null;
    cost_savings_sum?: number | string | null;
    capex_required_sum?: number | string | null;
    link_count?: number | string | null;
  }>(
    `SELECT COALESCE(SUM(revenue_uplift), 0) AS revenue_uplift_sum,
            COALESCE(SUM(cost_savings), 0) AS cost_savings_sum,
            COALESCE(SUM(capex_required), 0) AS capex_required_sum,
            COUNT(*) AS link_count
     FROM budget_initiative_links
     WHERE organization_id = ? AND initiative_id = ?`,
    [organizationId, initiativeId]
  );
  const linkCount = Number(row?.link_count || 0);
  if (linkCount === 0) return null;
  return {
    revenueUpliftSum: Number(row?.revenue_uplift_sum || 0),
    costSavingsSum: Number(row?.cost_savings_sum || 0),
    capexRequiredSum: Number(row?.capex_required_sum || 0),
    linkCount,
  };
}

async function loadInitiativeBenefitTotals(
  organizationId: string,
  initiativeId: string
): Promise<InitiativeBenefitTotals | null> {
  const row = await dbGet<{
    value_sum?: number | string | null;
    benefit_count?: number | string | null;
  }>(
    `SELECT COALESCE(SUM(estimated_annual_value), 0) AS value_sum, COUNT(*) AS benefit_count
     FROM initiative_benefits
     WHERE organization_id = ? AND initiative_id = ?`,
    [organizationId, initiativeId]
  );
  const benefitCount = Number(row?.benefit_count || 0);
  if (benefitCount === 0) return null;
  return {
    estimatedAnnualValueSum: Number(row?.value_sum || 0),
    benefitCount,
  };
}

/** Load DB totals for one initiative and compute its A2 delta (or null — skip). */
export async function computeInitiativeDeltaForOrg(
  organizationId: string,
  initiativeId: string
): Promise<InitiativeDeltaResult | null> {
  const [budgetLinks, benefits] = await Promise.all([
    loadBudgetInitiativeLinkTotals(organizationId, initiativeId),
    loadInitiativeBenefitTotals(organizationId, initiativeId),
  ]);
  return computeInitiativeDeltaStatements({ initiativeId, budgetLinks, benefits });
}

async function loadPackStatementRefs(
  packId: string
): Promise<Array<{ id: string; statement_type: string }>> {
  const rows = await dbAll<{ id: string; statement_type: string }>(
    `SELECT id, statement_type FROM financial_statements WHERE statement_pack_id = ?`,
    [packId]
  );
  return Array.isArray(rows) ? rows : [];
}

/** Load an A1 (company) pack's canonical values as AggregateStatements — reuses loadPackValueMaps. */
export async function loadPackAggregateStatements(packId: string): Promise<AggregateStatements> {
  const statementRefs = await loadPackStatementRefs(packId);
  if (statementRefs.length === 0) return emptyStatements();
  const maps = await loadPackValueMaps(statementRefs);
  return { pnl: maps.pnl, bs: maps.bs, cf: maps.cf };
}

/**
 * A3: load the A1 base pack + compute A2 for each candidate initiative, then
 * sum. Initiatives with no financial signal are skipped (reported, not
 * zeroed) per `computePortfolioAggregateStatements`.
 */
export async function computePortfolioAggregateForPack(params: {
  organizationId: string;
  basePackId: string;
  initiativeIds: string[];
}): Promise<PortfolioAggregateResult> {
  const base = await loadPackAggregateStatements(params.basePackId);
  const uniqueInitiativeIds = Array.from(new Set(params.initiativeIds.filter(Boolean)));
  const initiativeDeltas = await Promise.all(
    uniqueInitiativeIds.map(async (initiativeId) => ({
      initiativeId,
      result: await computeInitiativeDeltaForOrg(params.organizationId, initiativeId),
    }))
  );
  return computePortfolioAggregateStatements({
    basePackId: params.basePackId,
    base,
    initiativeDeltas,
  });
}

/**
 * Defensive read of `financial_statement_packs.aggregate_scope` (migration
 * 915). Degrades to 'company' if the column does not exist yet on this
 * environment (migration not applied — see migration 915 header) or the pack
 * is missing, so callers never hard-fail on a not-yet-migrated DB.
 */
export async function getPackAggregateScope(packId: string): Promise<AggregateScope> {
  try {
    const row = await dbGet<{ aggregate_scope?: string | null }>(
      `SELECT aggregate_scope FROM financial_statement_packs WHERE id = ?`,
      [packId]
    );
    const value = String(row?.aggregate_scope || '').toLowerCase();
    if (value === 'initiative' || value === 'portfolio') return value;
    return 'company';
  } catch (error) {
    if (isSchemaCompatError(error)) return 'company';
    throw error;
  }
}
