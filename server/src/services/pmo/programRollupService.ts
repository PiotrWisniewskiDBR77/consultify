/**
 * Program Rollup (Zwornik D3 — hierarchia programów: program → projekty → inicjatywy).
 *
 * KONTEKST: Piotr — "Programy = PEŁNE UI TERAZ, klienci wieloprojektowi". PM
 * Portfolio/Candidates ma operować na poziomie PROGRAMU, nie tylko inicjatywy.
 *
 * AUDYT PRZED BUDOWĄ (zero duplikacji — patrz też migracja 916):
 *   - `programs` (639_v4_programs_hierarchy.sql) — ISTNIEJE: id, org_id, name,
 *     status, parent_program_id (nested programs), owner/dates.
 *   - `initiatives.program_id` (625/730) — ISTNIEJE, już czytane przez
 *     InitiativeController.getPortfolioRollups i przez PMO CRUD
 *     (server/src/routes/pmo/initiatives.routes.ts, /api/initiatives/programs...).
 *   - Project-level finance rollup (budżet kontenera + Σ inicjatyw: budżet/
 *     value/benefits/roi) — ISTNIEJE w `projectFinanceRollupService.ts`
 *     (Zwornik Delta B). Ten moduł REUŻYWA `getProjectFinanceRollup` w całości
 *     (zero przepisywania formuł) oraz eksportuje `getValueRollup`/
 *     `getBenefitsRollup`/`getRoiRollup` dla "root" inicjatyw (program_id
 *     ustawiony bezpośrednio, bez projektu) — żeby nie liczyć tych samych
 *     formuł dwa razy w dwóch miejscach.
 *   - BRAKOWAŁO: `projects.program_id` (dodane w migracji 916, additive,
 *     NIE aplikowana) i warstwy agregującej PROJEKTY→program (istniejący
 *     rollup w InitiativeController/pmo routes leci płasko initiatives→program,
 *     pomijając warstwę projektów całkowicie).
 *
 * Ten serwis domyka WYŁĄCZNIE tę brakującą warstwę: program → { projekty (i ich
 * inicjatywy, przez getProjectFinanceRollup) } ∪ { inicjatywy bezpośrednio pod
 * programem (bez projektu) }.
 *
 * FALLBACK (jak `financeAggregateScopeService`/aggregate_scope): każde zapytanie
 * dotykające `projects.program_id` jest w try/catch — dopóki migracja 916 nie
 * jest zaaplikowana, `getProgramProjectIds` degraduje się do pustej listy
 * (program widzi tylko "root" inicjatywy — dokładnie dzisiejsze zachowanie),
 * zamiast wywalić cały rollup błędem 500.
 */
import logger from '../../utils/Logger.js';
import * as queryHelpers from '../../utils/queryHelpers.js';
import {
  getBenefitsRollup,
  getProjectFinanceRollup,
  getRoiRollup,
  getValueRollup,
  type ProjectFinanceRollup,
  toNumber,
} from '../projectFinanceRollupService.js';

export interface ProgramSummary {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  parentProgramId: string | null;
  status: string;
  ownerUserId: string | null;
  startDate: string | null;
  endDate: string | null;
}

export interface ProgramHealthBuckets {
  green: number;
  amber: number;
  red: number;
}

export interface ProgramProjectBreakdown {
  projectId: string;
  projectName: string;
  initiativeCount: number;
  budgetContainerTotal: number;
  initiativesBudgetPlanned: number;
  valueTotal: number;
  currency: string;
}

export interface ProgramChildSummary {
  id: string;
  name: string;
  status: string;
  initiativeCount: number;
}

export interface ProgramRollup {
  program: ProgramSummary;
  projectCount: number;
  initiativeCount: number;
  currency: string;
  budget: {
    containerTotal: number;
    initiativesPlanned: number;
  };
  value: { total: number };
  benefits: { count: number; targetTotal: number; currentTotal: number };
  roi: { capexTotal: number; opexAnnualTotal: number; npvTotal: number };
  health: ProgramHealthBuckets;
  projects: ProgramProjectBreakdown[];
  childPrograms: ProgramChildSummary[];
}

// ============================================================================
// Pure functions (no DB) — unit-testable in isolation.
// ============================================================================

/** Same status→health mapping as InitiativeController.getPortfolioRollups (V4-INIT-02) — kept in sync deliberately. */
export function classifyStatus(status: string | null | undefined): 'green' | 'amber' | 'red' {
  const s = String(status || '').toUpperCase();
  if (['EXECUTING', 'DONE', 'TRACKING'].includes(s)) return 'green';
  if (['APPROVED', 'REVIEW', 'PROMOTED', 'SCHEDULED', 'PLANNING'].includes(s)) return 'amber';
  return 'red';
}

/** Deduplicated union of id arrays, order-stable, falsy ids dropped. */
export function dedupeIds(...groups: string[][]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const group of groups) {
    for (const id of group) {
      if (!id) continue;
      const key = String(id);
      if (!seen.has(key)) {
        seen.add(key);
        out.push(key);
      }
    }
  }
  return out;
}

export function bucketHealth(
  rows: Array<{ status: string | null | undefined }>
): ProgramHealthBuckets {
  const buckets: ProgramHealthBuckets = { green: 0, amber: 0, red: 0 };
  for (const row of rows) {
    buckets[classifyStatus(row.status)] += 1;
  }
  return buckets;
}

/**
 * Sums an array of already-computed `ProjectFinanceRollup` objects (Delta B,
 * reused wholesale) into program-level totals. Deterministic: empty input →
 * all zeros / default currency 'PLN' (never null/undefined leaks through).
 */
export function aggregateProjectRollups(rollups: ProjectFinanceRollup[]): {
  currency: string;
  containerTotal: number;
  initiativesPlanned: number;
  value: number;
  benefits: { count: number; targetTotal: number; currentTotal: number };
  roi: { capexTotal: number; opexAnnualTotal: number; npvTotal: number };
} {
  const currency = rollups.find((r) => r.currency)?.currency || 'PLN';
  let containerTotal = 0;
  let initiativesPlanned = 0;
  let value = 0;
  let benefitsCount = 0;
  let benefitsTarget = 0;
  let benefitsCurrent = 0;
  let capexTotal = 0;
  let opexAnnualTotal = 0;
  let npvTotal = 0;

  for (const r of rollups) {
    containerTotal += toNumber(r.budget?.containerTotal);
    initiativesPlanned += toNumber(r.initiativesBudget?.totalPlanned);
    value += toNumber(r.value?.total);
    benefitsCount += toNumber(r.benefits?.count);
    benefitsTarget += toNumber(r.benefits?.targetTotal);
    benefitsCurrent += toNumber(r.benefits?.currentTotal);
    capexTotal += toNumber(r.roi?.capexTotal);
    opexAnnualTotal += toNumber(r.roi?.opexAnnualTotal);
    npvTotal += toNumber(r.roi?.npvTotal);
  }

  return {
    currency,
    containerTotal,
    initiativesPlanned,
    value,
    benefits: { count: benefitsCount, targetTotal: benefitsTarget, currentTotal: benefitsCurrent },
    roi: { capexTotal, opexAnnualTotal, npvTotal },
  };
}

/**
 * Merges the project-layer totals (from `aggregateProjectRollups`) with the
 * root-initiative-layer totals (initiatives with program_id set directly, no
 * project) into the final program rollup shape. Pure — no DB.
 */
export function mergeProgramTotals(
  projectLayer: ReturnType<typeof aggregateProjectRollups>,
  rootLayer: {
    value: number;
    benefits: { count: number; targetTotal: number; currentTotal: number };
    roi: { capexTotal: number; opexAnnualTotal: number; npvTotal: number };
    initiativesPlanned: number;
  }
): {
  currency: string;
  budget: { containerTotal: number; initiativesPlanned: number };
  value: { total: number };
  benefits: { count: number; targetTotal: number; currentTotal: number };
  roi: { capexTotal: number; opexAnnualTotal: number; npvTotal: number };
} {
  return {
    currency: projectLayer.currency,
    budget: {
      containerTotal: projectLayer.containerTotal,
      initiativesPlanned: projectLayer.initiativesPlanned + toNumber(rootLayer.initiativesPlanned),
    },
    value: { total: projectLayer.value + toNumber(rootLayer.value) },
    benefits: {
      count: projectLayer.benefits.count + toNumber(rootLayer.benefits.count),
      targetTotal: projectLayer.benefits.targetTotal + toNumber(rootLayer.benefits.targetTotal),
      currentTotal: projectLayer.benefits.currentTotal + toNumber(rootLayer.benefits.currentTotal),
    },
    roi: {
      capexTotal: projectLayer.roi.capexTotal + toNumber(rootLayer.roi.capexTotal),
      opexAnnualTotal: projectLayer.roi.opexAnnualTotal + toNumber(rootLayer.roi.opexAnnualTotal),
      npvTotal: projectLayer.roi.npvTotal + toNumber(rootLayer.roi.npvTotal),
    },
  };
}

// ============================================================================
// DB-backed reads — each independently fail-soft (mirrors
// projectFinanceRollupService's posture: a missing/older-schema table never
// 500s the whole rollup, it degrades to empty/zero).
// ============================================================================

async function getProgramRow(orgId: string, programId: string): Promise<ProgramSummary | null> {
  try {
    const row = await queryHelpers.queryOne<{
      id: string;
      organization_id: string;
      name: string;
      description: string | null;
      parent_program_id: string | null;
      status: string;
      owner_user_id: string | null;
      start_date: string | null;
      end_date: string | null;
    }>(`SELECT * FROM programs WHERE id = ? AND organization_id = ?`, [programId, orgId]);
    if (!row) return null;
    return {
      id: row.id,
      organizationId: row.organization_id,
      name: row.name,
      description: row.description ?? null,
      parentProgramId: row.parent_program_id ?? null,
      status: row.status,
      ownerUserId: row.owner_user_id ?? null,
      startDate: row.start_date ?? null,
      endDate: row.end_date ?? null,
    };
  } catch (err) {
    logger.warn(
      `[programRollupService] failed to load program ${programId}: ${(err as Error)?.message || err}`
    );
    return null;
  }
}

/**
 * Project ids belonging to the program via `projects.program_id` (migration
 * 916). Degrades to `[]` if the column doesn't exist yet — the program then
 * simply shows zero projects (today's behavior) instead of erroring.
 */
async function getProgramProjectIds(orgId: string, programId: string): Promise<string[]> {
  try {
    const rows = await queryHelpers.queryAll<{ id: string }>(
      `SELECT id FROM projects WHERE organization_id = ? AND program_id = ?`,
      [orgId, programId]
    );
    return (rows || []).map((r) => String(r.id));
  } catch (err) {
    logger.warn(
      `[programRollupService] projects.program_id not queryable yet (degrading to 0 projects) for program ${programId}: ${
        (err as Error)?.message || err
      }`
    );
    return [];
  }
}

async function getProjectNames(orgId: string, projectIds: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (projectIds.length === 0) return map;
  try {
    const placeholders = queryHelpers.buildInPlaceholders(projectIds);
    const rows = await queryHelpers.queryAll<{ id: string; name: string }>(
      `SELECT id, name FROM projects WHERE organization_id = ? AND id IN (${placeholders})`,
      [orgId, ...projectIds]
    );
    for (const r of rows || []) map.set(String(r.id), r.name);
  } catch (err) {
    logger.warn(
      `[programRollupService] failed to load project names (degrading to empty names): ${(err as Error)?.message || err}`
    );
  }
  return map;
}

async function getChildPrograms(orgId: string, programId: string): Promise<ProgramChildSummary[]> {
  try {
    const rows = await queryHelpers.queryAll<{
      id: string;
      name: string;
      status: string;
      initiative_count: number;
    }>(
      `SELECT p.id, p.name, p.status,
              (SELECT COUNT(*) FROM initiatives i WHERE i.program_id = p.id AND i.organization_id = p.organization_id) AS initiative_count
         FROM programs p
        WHERE p.organization_id = ? AND p.parent_program_id = ?
        ORDER BY p.name ASC`,
      [orgId, programId]
    );
    return (rows || []).map((r) => ({
      id: r.id,
      name: r.name,
      status: r.status,
      initiativeCount: toNumber(r.initiative_count),
    }));
  } catch (err) {
    logger.warn(
      `[programRollupService] failed to load child programs (degrading to empty): ${(err as Error)?.message || err}`
    );
    return [];
  }
}

/**
 * All initiatives visible under the program: directly tagged (program_id =
 * :programId) OR belonging to one of the program's projects (project_id IN
 * :projectIds). Returns {id, status, projectId} so callers can both bucket
 * health and split the "root" (no-project) subset for the finance rollup.
 */
async function getProgramInitiativeRows(
  orgId: string,
  programId: string,
  projectIds: string[]
): Promise<Array<{ id: string; status: string | null; projectId: string | null }>> {
  try {
    const params: unknown[] = [orgId, programId];
    let sql = `SELECT id, status, project_id FROM initiatives WHERE organization_id = ? AND program_id = ?`;
    if (projectIds.length > 0) {
      const placeholders = queryHelpers.buildInPlaceholders(projectIds);
      sql = `SELECT id, status, project_id FROM initiatives WHERE organization_id = ?
             AND (program_id = ? OR project_id IN (${placeholders}))`;
      params.push(...projectIds);
    }
    const rows = await queryHelpers.queryAll<{
      id: string;
      status: string | null;
      project_id: string | null;
    }>(sql, params);
    return (rows || []).map((r) => ({
      id: String(r.id),
      status: r.status,
      projectId: r.project_id ? String(r.project_id) : null,
    }));
  } catch (err) {
    logger.warn(
      `[programRollupService] failed to load program initiatives (degrading to empty): ${(err as Error)?.message || err}`
    );
    return [];
  }
}

/** Σ initiative_budget_items.amount for a set of "root" initiative ids (no project container). Same table as executionBudgetService.getPortfolioBudgetSummary, scoped by explicit id list instead of project_id. */
async function getRootInitiativesBudgetPlanned(
  orgId: string,
  initiativeIds: string[]
): Promise<number> {
  if (initiativeIds.length === 0) return 0;
  try {
    const placeholders = queryHelpers.buildInPlaceholders(initiativeIds);
    const row = await queryHelpers.queryOne<{ total: number }>(
      `SELECT COALESCE(SUM(bi.amount), 0) AS total
         FROM initiative_budget_items bi
        WHERE bi.organization_id = ? AND bi.initiative_id IN (${placeholders})`,
      [orgId, ...initiativeIds]
    );
    return toNumber(row?.total);
  } catch (err) {
    logger.warn(
      `[programRollupService] root-initiative budget rollup failed (degrading to 0): ${(err as Error)?.message || err}`
    );
    return 0;
  }
}

/**
 * Full program rollup: program → projects (each via the reused
 * `getProjectFinanceRollup`) → + root initiatives (program_id set directly,
 * no project). Returns `null` when the program doesn't exist for this org —
 * callers should treat that as 404, not 500.
 */
export async function getProgramRollup(
  orgId: string,
  programId: string
): Promise<ProgramRollup | null> {
  const program = await getProgramRow(orgId, programId);
  if (!program) return null;

  const projectIds = await getProgramProjectIds(orgId, programId);
  const [projectNames, childPrograms, initiativeRows] = await Promise.all([
    getProjectNames(orgId, projectIds),
    getChildPrograms(orgId, programId),
    getProgramInitiativeRows(orgId, programId, projectIds),
  ]);

  const rootInitiativeIds = initiativeRows
    .filter((r) => !r.projectId || !projectIds.includes(r.projectId))
    .map((r) => r.id);

  const [projectRollups, rootValue, rootBenefits, rootRoi, rootPlanned] = await Promise.all([
    Promise.all(projectIds.map((pid) => getProjectFinanceRollup(orgId, pid))),
    getValueRollup(orgId, rootInitiativeIds),
    getBenefitsRollup(orgId, rootInitiativeIds),
    getRoiRollup(orgId, rootInitiativeIds),
    getRootInitiativesBudgetPlanned(orgId, rootInitiativeIds),
  ]);

  const projectLayer = aggregateProjectRollups(projectRollups);
  const totals = mergeProgramTotals(projectLayer, {
    value: rootValue.total,
    benefits: rootBenefits,
    roi: rootRoi,
    initiativesPlanned: rootPlanned,
  });

  const projects: ProgramProjectBreakdown[] = projectRollups.map((r) => ({
    projectId: r.projectId,
    projectName: projectNames.get(r.projectId) || r.projectId,
    initiativeCount: r.initiativeCount,
    budgetContainerTotal: r.budget.containerTotal,
    initiativesBudgetPlanned: r.initiativesBudget.totalPlanned,
    valueTotal: r.value.total,
    currency: r.currency,
  }));

  return {
    program,
    projectCount: projectIds.length,
    initiativeCount: initiativeRows.length,
    currency: totals.currency,
    budget: totals.budget,
    value: totals.value,
    benefits: totals.benefits,
    roi: totals.roi,
    health: bucketHealth(initiativeRows),
    projects,
    childPrograms,
  };
}

export default { getProgramRollup };
