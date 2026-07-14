/**
 * Project Finance Rollup (Zwornik Delta B).
 *
 * SSOT: Harvard/wdrozenie-100/_KONCEPT_ZWORNIK_2026-07-10.md, §4. ZERO new
 * ledger tables — `budgets.project_id` already exists (migration 570) and
 * initiative-level financials already exist and are already project-scoped
 * where it matters (`executionBudgetService.getPortfolioBudgetSummary`
 * accepts a `projectId` filter). This is purely the missing READ LAYER: one
 * aggregation across the tables that are each already canonical for their
 * slice (budgets/budget_lines = project container; budget_entries +
 * initiative_budget_items = initiative actual/planned via executionBudgetService;
 * value_baselines/value_ledger_entries = KPI value per initiative, kanon M16;
 * initiative_benefits/roi_assumptions = benefits/ROI per initiative).
 *
 * Contract (§4.2 point 1):
 *   budget            — the project's OWN budget container(s) (`budgets` rows).
 *   initiativesBudget  — Σ budgets/expenses of the project's initiatives
 *                        (delegates to the existing, already project-scoped
 *                        `getPortfolioBudgetSummary`).
 *   value              — Σ (active baseline.frozen_value + Σ ledger.value_delta)
 *                        per initiative, summed across the project's initiatives —
 *                        the exact formula from `valueLedgerService.ts` / the
 *                        `20260624_value_ledger.sql` header (kanon M16), applied
 *                        per-initiative here because the ledger is initiative-
 *                        scoped (not per-KPI) while baselines are per-KPI.
 *   benefits/roi       — rollup of `initiative_benefits` + `roi_assumptions`
 *                        across the project's initiatives.
 *   variance           — container budget vs Σ initiative planned budgets; a
 *                        SOFT warning only (`overCommitted`), never a hard
 *                        block (CTO default decision, _REKONCYLIACJA_FINAL §6:
 *                        "Budżet projektu vs inicjatywy = soft-warning").
 *
 * Quality of the rollup is conditional on Delta C anchoring: initiatives
 * without a project_id are invisible to every query here (this is by design —
 * §4.2's closing note: "rollup liczy PO initiatives.project_id, więc Delta C
 * jest warunkiem jakości Delty B").
 */
import logger from '../utils/Logger.js';
import * as queryHelpers from '../utils/queryHelpers.js';
import {
  getPortfolioBudgetSummary,
  type PortfolioBudgetSummary,
} from './executionBudgetService.js';

export interface ProjectBudgetContainer {
  id: string;
  title: string;
  status: string;
  periodStart: string | null;
  periodEnd: string | null;
  currency: string;
  plannedTotal: number;
}

export interface ProjectInitiativeValueRow {
  initiativeId: string;
  baselineTotal: number;
  ledgerDelta: number;
  current: number;
}

export interface ProjectBenefitsRollup {
  count: number;
  targetTotal: number;
  currentTotal: number;
  byStatus: Record<string, number>;
}

export interface ProjectRoiRollup {
  capexTotal: number;
  opexAnnualTotal: number;
  avgExpectedRoiPercent: number | null;
  npvTotal: number;
  initiativeCount: number;
}

export interface ProjectFinanceRollup {
  projectId: string;
  currency: string;
  initiativeCount: number;
  budget: {
    containers: ProjectBudgetContainer[];
    containerTotal: number;
  };
  initiativesBudget: PortfolioBudgetSummary;
  value: {
    perInitiative: ProjectInitiativeValueRow[];
    total: number;
  };
  benefits: ProjectBenefitsRollup;
  roi: ProjectRoiRollup;
  variance: {
    containerBudget: number;
    initiativesPlanned: number;
    delta: number;
    /** Σ initiative planned budgets exceeds the project's own container budget.
     *  SOFT signal only — never blocks a save (see module docblock). */
    overCommitted: boolean;
  };
}

export function toNumber(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** Distinct initiative ids belonging to the project (org-scoped). Empty array is valid (no initiatives yet). */
async function getProjectInitiativeIds(orgId: string, projectId: string): Promise<string[]> {
  try {
    const rows = await queryHelpers.queryAll<{ id: string }>(
      `SELECT id FROM initiatives WHERE organization_id = ? AND project_id = ?`,
      [orgId, projectId]
    );
    return (rows || []).map((r) => String(r.id));
  } catch (err) {
    logger.warn(
      `[projectFinanceRollupService] failed to load initiative ids for project ${projectId} (degrading to empty): ${
        (err as Error)?.message || err
      }`
    );
    return [];
  }
}

/** The project's own budget container(s) — `budgets` rows with project_id = :id, each summed from budget_lines. */
async function getBudgetContainers(
  orgId: string,
  projectId: string
): Promise<{ containers: ProjectBudgetContainer[]; containerTotal: number; currency: string }> {
  try {
    const budgets = await queryHelpers.queryAll<{
      id: string;
      title: string;
      status: string;
      period_start: string | null;
      period_end: string | null;
      currency: string;
    }>(
      `SELECT id, title, status, period_start, period_end, currency
         FROM budgets WHERE organization_id = ? AND project_id = ?
        ORDER BY created_at DESC`,
      [orgId, projectId]
    );

    if (!budgets || budgets.length === 0) {
      return { containers: [], containerTotal: 0, currency: 'PLN' };
    }

    const budgetIds = budgets.map((b) => b.id);
    const placeholders = queryHelpers.buildInPlaceholders(budgetIds);
    const lineSums = await queryHelpers.queryAll<{ budget_id: string; total: number }>(
      `SELECT budget_id, SUM(baseline_value) AS total FROM budget_lines
        WHERE budget_id IN (${placeholders}) GROUP BY budget_id`,
      budgetIds
    );
    const totalByBudget = new Map<string, number>();
    for (const row of lineSums || []) totalByBudget.set(String(row.budget_id), toNumber(row.total));

    const containers: ProjectBudgetContainer[] = budgets.map((b) => ({
      id: b.id,
      title: b.title,
      status: b.status,
      periodStart: b.period_start ?? null,
      periodEnd: b.period_end ?? null,
      currency: b.currency || 'PLN',
      plannedTotal: totalByBudget.get(b.id) ?? 0,
    }));

    return {
      containers,
      containerTotal: containers.reduce((s, c) => s + c.plannedTotal, 0),
      currency: containers[0]?.currency || 'PLN',
    };
  } catch (err) {
    logger.warn(
      `[projectFinanceRollupService] budget container rollup failed for project ${projectId} (degrading to empty): ${
        (err as Error)?.message || err
      }`
    );
    return { containers: [], containerTotal: 0, currency: 'PLN' };
  }
}

/**
 * Σ (active baseline.frozen_value + Σ ledger.value_delta) per initiative — the
 * value_ledger kanon formula (M16). Baselines are per (initiative, kpi); the
 * ledger is per-initiative only (no kpi_id column), so per initiative we sum
 * ALL of its active KPI baselines and add its ledger delta once, matching the
 * literal SSOT formula "Σ po inicjatywach" rather than double-counting deltas
 * per KPI.
 */
export async function getValueRollup(
  orgId: string,
  initiativeIds: string[]
): Promise<{ perInitiative: ProjectInitiativeValueRow[]; total: number }> {
  if (initiativeIds.length === 0) return { perInitiative: [], total: 0 };
  try {
    const placeholders = queryHelpers.buildInPlaceholders(initiativeIds);
    const [baselineRows, ledgerRows] = await Promise.all([
      queryHelpers.queryAll<{ initiative_id: string; total: number }>(
        `SELECT initiative_id, SUM(frozen_value) AS total FROM value_baselines
          WHERE organization_id = ? AND is_active = 1 AND initiative_id IN (${placeholders})
          GROUP BY initiative_id`,
        [orgId, ...initiativeIds]
      ),
      queryHelpers.queryAll<{ initiative_id: string; total: number }>(
        `SELECT initiative_id, SUM(value_delta) AS total FROM value_ledger_entries
          WHERE organization_id = ? AND initiative_id IN (${placeholders})
          GROUP BY initiative_id`,
        [orgId, ...initiativeIds]
      ),
    ]);

    const baselineByInit = new Map<string, number>();
    for (const row of baselineRows || [])
      baselineByInit.set(String(row.initiative_id), toNumber(row.total));
    const ledgerByInit = new Map<string, number>();
    for (const row of ledgerRows || [])
      ledgerByInit.set(String(row.initiative_id), toNumber(row.total));

    const perInitiative: ProjectInitiativeValueRow[] = initiativeIds
      .filter((id) => baselineByInit.has(id) || ledgerByInit.has(id))
      .map((id) => {
        const baselineTotal = baselineByInit.get(id) ?? 0;
        const ledgerDelta = ledgerByInit.get(id) ?? 0;
        return {
          initiativeId: id,
          baselineTotal,
          ledgerDelta,
          current: baselineTotal + ledgerDelta,
        };
      });

    return { perInitiative, total: perInitiative.reduce((s, r) => s + r.current, 0) };
  } catch (err) {
    logger.warn(
      `[projectFinanceRollupService] value rollup failed (degrading to empty): ${
        (err as Error)?.message || err
      }`
    );
    return { perInitiative: [], total: 0 };
  }
}

export async function getBenefitsRollup(
  orgId: string,
  initiativeIds: string[]
): Promise<ProjectBenefitsRollup> {
  const empty: ProjectBenefitsRollup = { count: 0, targetTotal: 0, currentTotal: 0, byStatus: {} };
  if (initiativeIds.length === 0) return empty;
  try {
    const placeholders = queryHelpers.buildInPlaceholders(initiativeIds);
    const rows = await queryHelpers.queryAll<{
      status: string;
      cnt: number;
      target_sum: number;
      current_sum: number;
    }>(
      `SELECT COALESCE(status, 'unknown') AS status, COUNT(*) AS cnt,
              SUM(COALESCE(target_value, 0)) AS target_sum,
              SUM(COALESCE(current_value, 0)) AS current_sum
         FROM initiative_benefits
        WHERE organization_id = ? AND initiative_id IN (${placeholders})
        GROUP BY COALESCE(status, 'unknown')`,
      [orgId, ...initiativeIds]
    );

    const byStatus: Record<string, number> = {};
    let count = 0;
    let targetTotal = 0;
    let currentTotal = 0;
    for (const row of rows || []) {
      const n = toNumber(row.cnt);
      byStatus[row.status] = n;
      count += n;
      targetTotal += toNumber(row.target_sum);
      currentTotal += toNumber(row.current_sum);
    }
    return { count, targetTotal, currentTotal, byStatus };
  } catch (err) {
    logger.warn(
      `[projectFinanceRollupService] benefits rollup failed (degrading to empty): ${
        (err as Error)?.message || err
      }`
    );
    return empty;
  }
}

export async function getRoiRollup(
  orgId: string,
  initiativeIds: string[]
): Promise<ProjectRoiRollup> {
  const empty: ProjectRoiRollup = {
    capexTotal: 0,
    opexAnnualTotal: 0,
    avgExpectedRoiPercent: null,
    npvTotal: 0,
    initiativeCount: 0,
  };
  if (initiativeIds.length === 0) return empty;
  try {
    const placeholders = queryHelpers.buildInPlaceholders(initiativeIds);
    const row = await queryHelpers.queryOne<{
      capex_total: number;
      opex_total: number;
      avg_roi: number | null;
      npv_total: number;
      cnt: number;
    }>(
      `SELECT SUM(COALESCE(capex, 0)) AS capex_total,
              SUM(COALESCE(opex_annual, 0)) AS opex_total,
              AVG(expected_roi_percent) AS avg_roi,
              SUM(COALESCE(expected_npv, 0)) AS npv_total,
              COUNT(*) AS cnt
         FROM roi_assumptions
        WHERE organization_id = ? AND initiative_id IN (${placeholders})`,
      [orgId, ...initiativeIds]
    );
    if (!row) return empty;
    return {
      capexTotal: toNumber(row.capex_total),
      opexAnnualTotal: toNumber(row.opex_total),
      avgExpectedRoiPercent: row.avg_roi != null ? toNumber(row.avg_roi) : null,
      npvTotal: toNumber(row.npv_total),
      initiativeCount: toNumber(row.cnt),
    };
  } catch (err) {
    logger.warn(
      `[projectFinanceRollupService] ROI rollup failed (degrading to empty): ${
        (err as Error)?.message || err
      }`
    );
    return empty;
  }
}

/**
 * Build the full project finance rollup (§4.2). Every sub-rollup is
 * independently fail-soft (degrades to zeros on error) so a problem in one
 * table (e.g. missing roi_assumptions on an older schema) never 500s the
 * whole endpoint — mirrors the fail-soft posture used throughout initiative
 * finance code (`executionBudgetService.ts`, `valueLedgerService.ts`).
 */
export async function getProjectFinanceRollup(
  orgId: string,
  projectId: string
): Promise<ProjectFinanceRollup> {
  const initiativeIds = await getProjectInitiativeIds(orgId, projectId);

  const [budget, initiativesBudget, value, benefits, roi] = await Promise.all([
    getBudgetContainers(orgId, projectId),
    getPortfolioBudgetSummary(orgId, projectId),
    getValueRollup(orgId, initiativeIds),
    getBenefitsRollup(orgId, initiativeIds),
    getRoiRollup(orgId, initiativeIds),
  ]);

  const containerBudget = budget.containerTotal;
  const initiativesPlanned = initiativesBudget.totalPlanned;

  return {
    projectId,
    currency: budget.currency || initiativesBudget.currency || 'PLN',
    initiativeCount: initiativeIds.length,
    budget: { containers: budget.containers, containerTotal: budget.containerTotal },
    initiativesBudget,
    value,
    benefits,
    roi,
    variance: {
      containerBudget,
      initiativesPlanned,
      delta: containerBudget - initiativesPlanned,
      // §4.2 point 3 / _REKONCYLIACJA_FINAL §6: soft warning only when the
      // project actually declared a container budget (containerBudget > 0) —
      // a project with no budget yet is not "over-committed", it's unbudgeted.
      overCommitted: containerBudget > 0 && initiativesPlanned > containerBudget,
    },
  };
}

export default { getProjectFinanceRollup };
