#!/usr/bin/env tsx
/**
 * Finance seed (opt-in, DB-backed)
 *
 * Creates a small, coherent Finance dataset in the DB for manual testing:
 * - Financial Model (T054) + 2 events + compute persisted outputs
 * - Budget (T053) with default lines/scenarios
 * - Financial Analysis (T052) backed by statementData JSON
 * - Valuation (T055) from manual source + compute
 *
 * Usage:
 *   # From repo root:
 *   DB_TYPE=postgres DATABASE_URL="postgresql://..." tsx server/scripts/seed-finance.ts
 *
 * Options (env):
 *   ORG_ID=<organization id>   (optional; auto-picks first org)
 *   USER_ID=<user id>          (optional; auto-picks first user in org)
 *   SEED_PREFIX="Seed: Finance" (optional)
 */
import { all as dbAll, get as dbGet } from '../src/utils/DbPromise.js';
import logger from '../src/utils/Logger.js';
import {
  addEvent,
  computeModel,
  createModel,
  persistComputeResult,
} from '../src/services/financialModelingService.js';
import { createBudget, generateScenarioProjections } from '../src/services/budgetingService.js';
import { createAnalysis, runFullAnalysis } from '../src/services/financialAnalysisService.js';
import { computeValuation, createValuation } from '../src/services/valuationService.js';

function env(name: string, fb?: string): string | undefined {
  const v = process.env[name];
  const s = v != null ? String(v).trim() : '';
  return s.length ? s : fb;
}

function isoDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

async function pickOrgId(): Promise<string | undefined> {
  const fromEnv = env('ORG_ID');
  if (fromEnv) return fromEnv;
  const row = await dbGet<{ id: string }>(`SELECT id FROM organizations LIMIT 1`, []);
  return row?.id ? String(row.id) : undefined;
}

async function pickUserId(orgId: string): Promise<string | undefined> {
  const fromEnv = env('USER_ID');
  if (fromEnv) return fromEnv;
  const row = await dbGet<{ id: string }>(
    `SELECT id FROM users WHERE organization_id = ? LIMIT 1`,
    [orgId]
  );
  return row?.id ? String(row.id) : undefined;
}

async function alreadySeeded(orgId: string, prefix: string): Promise<boolean> {
  try {
    const rows = await dbAll<{ id: string }>(
      `SELECT id FROM financial_models WHERE organization_id = ? AND name LIKE ? LIMIT 1`,
      [orgId, `${prefix}%`]
    );
    return Array.isArray(rows) && rows.length > 0;
  } catch {
    // If the finance tables aren't present yet, seeding is impossible anyway.
    return false;
  }
}

async function main() {
  const prefix = env('SEED_PREFIX', 'Seed: Finance')!;
  const orgId = await pickOrgId();
  if (!orgId) {
    throw new Error(
      'No organizations found. Create an organization first or pass ORG_ID=<id>.'
    );
  }
  const userId = await pickUserId(orgId);
  if (!userId) {
    throw new Error(
      `No users found for organization ${orgId}. Create a user first or pass USER_ID=<id>.`
    );
  }

  if (await alreadySeeded(orgId, prefix)) {
    logger.info(`[seed-finance] Seed already present for org=${orgId} (prefix="${prefix}").`);
    return;
  }

  logger.info(`[seed-finance] Seeding Finance data for org=${orgId}, user=${userId}...`);

  // Dates
  const start = new Date();
  start.setMonth(0, 1);
  start.setHours(0, 0, 0, 0);
  const startDate = isoDateOnly(start);

  // --------------------------
  // 1) Financial model + compute
  // --------------------------
  const modelId = await createModel({
    organizationId: orgId,
    name: `${prefix} — Financial Model`,
    description: 'Seeded model for Finance module manual testing.',
    currency: 'PLN',
    horizonMonths: 24,
    startDate,
    granularity: 'monthly',
    scenario: 'base',
    assumptions: { seed: true, notes: 'Created by seed-finance.ts' },
    createdBy: userId,
  });

  await addEvent({
    modelId,
    eventType: 'revenue',
    name: 'Recurring revenue',
    amount: 120_000,
    periodStart: startDate,
    recurrence: 'monthly',
    growthRate: 0.01,
    cfClassification: 'operating',
    postingRules: { pl: { line: 'REVENUE' } },
    createdBy: userId,
  });

  await addEvent({
    modelId,
    eventType: 'opex',
    name: 'Recurring opex',
    amount: 45_000,
    periodStart: startDate,
    recurrence: 'monthly',
    growthRate: 0.005,
    cfClassification: 'operating',
    postingRules: { pl: { line: 'OPEX' } },
    createdBy: userId,
  });

  const compute = await computeModel(modelId);
  await persistComputeResult(modelId, compute, 'base');

  // --------------------------
  // 2) Budget + generate projections for base scenario
  // --------------------------
  const budget = await createBudget(
    orgId,
    {
      title: `${prefix} — Budget`,
      description: 'Seeded budget for Finance module manual testing.',
      periodStart: `${start.getFullYear()}-01`,
      periodEnd: `${start.getFullYear()}-12`,
      granularity: 'monthly',
      currency: 'PLN',
    },
    userId
  );

  // Best-effort: generate projections for the active/base scenario.
  try {
    const scenarios = await dbAll<{ id: string; scenario_type: string }>(
      `SELECT id, scenario_type FROM budget_scenarios WHERE budget_id = ?`,
      [budget.id]
    );
    const base = (scenarios || []).find((s) => String(s.scenario_type) === 'base') || scenarios?.[0];
    if (base?.id) {
      await generateScenarioProjections(budget.id, String(base.id));
    }
  } catch {
    // projections are optional for listing/preview
  }

  // --------------------------
  // 3) Financial analysis (statementData JSON) + run analysis (ratios/insights persisted)
  // --------------------------
  const y0 = start.getFullYear();
  const periods = [`${y0}`, `${y0 + 1}`];
  const analysis = await createAnalysis(
    orgId,
    {
      title: `${prefix} — Financial Analysis`,
      description: 'Seeded analysis for Finance module manual testing.',
      analysisType: 'comprehensive',
      periods,
      currency: 'PLN',
      statementData: {
        pl: [
          { code: 'REVENUE', name: 'Revenue', values: { [periods[0]]: 1_440_000, [periods[1]]: 1_600_000 } },
          { code: 'COGS', name: 'COGS', values: { [periods[0]]: 520_000, [periods[1]]: 560_000 } },
          { code: 'OPEX', name: 'OPEX', values: { [periods[0]]: 540_000, [periods[1]]: 580_000 } },
          { code: 'NET_INCOME', name: 'Net Income', values: { [periods[0]]: 260_000, [periods[1]]: 300_000 } },
        ],
        bs: [
          { code: 'TOTAL_ASSETS', name: 'Total Assets', values: { [periods[0]]: 2_100_000, [periods[1]]: 2_300_000 } },
          { code: 'TOTAL_LIABILITIES', name: 'Total Liabilities', values: { [periods[0]]: 900_000, [periods[1]]: 980_000 } },
          { code: 'EQUITY', name: 'Equity', values: { [periods[0]]: 1_200_000, [periods[1]]: 1_320_000 } },
        ],
        cf: [
          { code: 'OCF', name: 'Operating Cash Flow', values: { [periods[0]]: 240_000, [periods[1]]: 280_000 } },
          { code: 'CFI', name: 'Investing Cash Flow', values: { [periods[0]]: -120_000, [periods[1]]: -140_000 } },
          { code: 'CFF', name: 'Financing Cash Flow', values: { [periods[0]]: -30_000, [periods[1]]: -20_000 } },
        ],
      },
    },
    userId
  );

  try {
    await runFullAnalysis(orgId, analysis.id);
  } catch {
    // analysis still exists even if ratio computation fails due to missing optional lines
  }

  // --------------------------
  // 4) Valuation (manual) + compute
  // --------------------------
  const val = await createValuation(
    orgId,
    {
      title: `${prefix} — Valuation (DCF)`,
      description: 'Seeded valuation for Finance module manual testing.',
      sourceType: 'manual',
      sourceId: null,
      horizonYears: 5,
      currency: 'PLN',
    },
    userId
  );

  try {
    await computeValuation(orgId, val.id);
  } catch {
    // valuation still exists even if compute fails due to missing optional inputs
  }

  logger.info(
    `[seed-finance] Done. Created: model=${modelId}, budget=${budget.id}, analysis=${analysis.id}, valuation=${val.id}`
  );
}

main().catch((e) => {
  logger.error('[seed-finance] Failed:', (e as any)?.message || e);
  process.exitCode = 1;
});

