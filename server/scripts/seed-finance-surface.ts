#!/usr/bin/env tsx

import { logSelectedDatabaseTarget, resolveScriptDatabaseTarget } from './lib/scriptDatabaseTarget.js';
import { addEvent, createModel } from '../src/services/financialModelingService.js';
import {
  approveAnalysis,
  createAnalysis,
  runFullAnalysis,
  updateAnalysis,
  type StatementData,
} from '../src/services/financialAnalysisService.js';
import {
  createBudget,
  generateScenarioProjections,
  getScenarios,
  updateScenarioAdjustments,
} from '../src/services/budgetingService.js';
import {
  createValuation,
  updateAssumptions,
  updatePeers,
} from '../src/services/valuationService.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../src/utils/DbPromise.js';

type PackSeed = {
  id: string;
  entityName: string;
  periodLabel: string;
  currency: string;
  scaling: string;
  statementIds: string[];
};

type ModelSeed = {
  title: string;
  description: string;
  packId: string;
  currency: string;
  scenario: 'base' | 'optimistic' | 'conservative';
  status: 'draft' | 'review' | 'approved';
  startDate: string;
  horizonMonths: number;
  events: Array<{
    eventType:
      | 'revenue'
      | 'cogs'
      | 'opex'
      | 'capex_purchase'
      | 'debt_drawdown'
      | 'debt_repayment';
    name: string;
    amount: number;
    recurrence: 'one_time' | 'monthly' | 'quarterly' | 'annual';
    growthRate?: number;
    cfClassification: 'operating' | 'investing' | 'financing' | 'none';
    postingRules: Record<string, unknown>;
  }>;
};

type BudgetSeed = {
  title: string;
  description: string;
  currency: string;
  periodStart: string;
  periodEnd: string;
  baselineSource: string;
  status: 'draft' | 'approved';
  assumptions: Array<{ key: string; value: string; note?: string }>;
  lineValues: Record<string, number>;
  scenarioAdjustments: Record<
    'base' | 'optimistic' | 'conservative',
    { revenueGrowth?: number; costReduction?: number }
  >;
};

type AnalysisSeed = {
  title: string;
  description: string;
  analysisType: string;
  currency: string;
  status: 'draft' | 'review' | 'approved';
  packId: string;
  statementData: StatementData;
};

type ValuationSeed = {
  title: string;
  description: string;
  sourceType: 'financial_model' | 'budget';
  sourceKey: string;
  currency: string;
  horizonYears: number;
  status: 'review' | 'approved';
  assumptions: Record<string, unknown>;
  peers: Record<string, unknown>;
  resultSeed: {
    enterpriseValue: number;
    equityValue: number;
    discountRatePercent: number;
    terminalGrowthPercent: number;
    pvExplicit: number;
    pvTerminal: number;
  };
};

const ORG_ID = 'dbr77';
const DEFAULT_USER_ID = 'bf0f01a2-9ada-4cb8-a331-4dce1930e4f3';
const NAME_PREFIX = 'DBR77 |';
const PACK_IDS = [
  '127ea773-001e-4e73-9e01-6a1fbf98fc05',
  '53e8022c-a562-49d1-ad8f-847baec2f45e',
  'f0d13ab0-3cd1-4394-bd8d-13c58340ece4',
];

function stampNow(): string {
  return new Date().toISOString();
}

async function resolveUserId(orgId: string): Promise<string> {
  const explicit = String(process.env.USER_ID || '').trim();
  if (explicit) return explicit;

  const preferred = await dbGet<{ id: string }>(
    `SELECT id FROM users WHERE id = ? AND organization_id = ? LIMIT 1`,
    [DEFAULT_USER_ID, orgId]
  );
  if (preferred?.id) return String(preferred.id);

  const fallback = await dbGet<{ id: string }>(
    `SELECT id FROM users WHERE organization_id = ? ORDER BY created_at ASC NULLS LAST LIMIT 1`,
    [orgId]
  );
  if (!fallback?.id) {
    throw new Error(`[seed-finance-surface] No user found for organization "${orgId}".`);
  }
  return String(fallback.id);
}

async function loadPackSeeds(orgId: string): Promise<Record<string, PackSeed>> {
  const placeholders = PACK_IDS.map(() => '?').join(',');
  const packs = await dbAll<{
    id: string;
    entity_name: string;
    period_label: string;
    currency: string;
    scaling: string;
  }>(
    `SELECT id, entity_name, period_label, currency, scaling
     FROM financial_statement_packs
     WHERE organization_id = ? AND id IN (${placeholders})`,
    [orgId, ...PACK_IDS]
  );

  const statements = await dbAll<{ id: string; statement_pack_id: string }>(
    `SELECT id, statement_pack_id
     FROM financial_statements
     WHERE organization_id = ? AND statement_pack_id IN (${placeholders})
     ORDER BY statement_type ASC, created_at ASC`,
    [orgId, ...PACK_IDS]
  );

  const byPackId = new Map<string, string[]>();
  for (const row of statements || []) {
    const list = byPackId.get(String(row.statement_pack_id)) || [];
    list.push(String(row.id));
    byPackId.set(String(row.statement_pack_id), list);
  }

  const result: Record<string, PackSeed> = {};
  for (const row of packs || []) {
    result[String(row.id)] = {
      id: String(row.id),
      entityName: String(row.entity_name || 'Statement Pack'),
      periodLabel: String(row.period_label || ''),
      currency: String(row.currency || 'PLN'),
      scaling: String(row.scaling || 'units'),
      statementIds: byPackId.get(String(row.id)) || [],
    };
  }

  for (const requiredId of PACK_IDS) {
    if (!result[requiredId]) {
      throw new Error(`[seed-finance-surface] Missing required statement pack "${requiredId}" in ${orgId}.`);
    }
  }

  return result;
}

async function cleanupExistingSeed(orgId: string): Promise<void> {
  const titleLike = `${NAME_PREFIX}%`;

  const valuations = await dbAll<{ id: string }>(
    `SELECT id FROM valuations WHERE organization_id = ? AND title LIKE ?`,
    [orgId, titleLike]
  );
  for (const row of valuations || []) {
    await dbRun(`DELETE FROM valuation_snapshots WHERE valuation_id = ?`, [row.id]);
  }
  await dbRun(`DELETE FROM valuations WHERE organization_id = ? AND title LIKE ?`, [orgId, titleLike]);

  const analyses = await dbAll<{ id: string }>(
    `SELECT id FROM financial_analyses WHERE organization_id = ? AND title LIKE ?`,
    [orgId, titleLike]
  );
  for (const row of analyses || []) {
    await dbRun(`DELETE FROM financial_analysis_ratios WHERE analysis_id = ?`, [row.id]);
    await dbRun(`DELETE FROM financial_analysis_insights WHERE analysis_id = ?`, [row.id]);
  }
  await dbRun(`DELETE FROM financial_analyses WHERE organization_id = ? AND title LIKE ?`, [orgId, titleLike]);

  const budgets = await dbAll<{ id: string }>(
    `SELECT id FROM budgets WHERE organization_id = ? AND title LIKE ?`,
    [orgId, titleLike]
  );
  for (const row of budgets || []) {
    await dbRun(`DELETE FROM budget_snapshots WHERE budget_id = ?`, [row.id]);
    await dbRun(`DELETE FROM budget_scenarios WHERE budget_id = ?`, [row.id]);
    await dbRun(`DELETE FROM budget_lines WHERE budget_id = ?`, [row.id]);
  }
  await dbRun(`DELETE FROM budgets WHERE organization_id = ? AND title LIKE ?`, [orgId, titleLike]);

  const models = await dbAll<{ id: string }>(
    `SELECT id FROM financial_models WHERE organization_id = ? AND name LIKE ?`,
    [orgId, titleLike]
  );
  for (const row of models || []) {
    await dbRun(`DELETE FROM financial_model_outputs WHERE model_id = ?`, [row.id]);
    await dbRun(`DELETE FROM financial_model_validations WHERE model_id = ?`, [row.id]);
    await dbRun(`DELETE FROM financial_model_events WHERE model_id = ?`, [row.id]);
  }
  await dbRun(`DELETE FROM financial_models WHERE organization_id = ? AND name LIKE ?`, [orgId, titleLike]);
}

async function setBudgetLineValues(budgetId: string, values: Record<string, number>): Promise<void> {
  for (const [lineCode, baselineValue] of Object.entries(values)) {
    await dbRun(
      `UPDATE budget_lines SET baseline_value = ? WHERE budget_id = ? AND line_code = ?`,
      [baselineValue, budgetId, lineCode]
    );
  }
}

async function updateModelLinkage(params: {
  modelId: string;
  orgId: string;
  userId: string;
  packId: string;
  statementId?: string;
  status: 'draft' | 'review' | 'approved';
}): Promise<void> {
  const now = stampNow();
  await dbRun(
    `UPDATE financial_models
     SET source_statement_pack_id = ?, source_statement_id = ?, status = ?, approved_by = ?, approved_at = ?, updated_at = ?
     WHERE id = ? AND organization_id = ?`,
    [
      params.packId,
      params.statementId || null,
      params.status,
      params.status === 'approved' ? params.userId : null,
      params.status === 'approved' ? now : null,
      now,
      params.modelId,
      params.orgId,
    ]
  );
}

async function updateBudgetMetadata(params: {
  budgetId: string;
  orgId: string;
  baselineSource: string;
  assumptions: Array<{ key: string; value: string; note?: string }>;
  status: 'draft' | 'approved';
  userId: string;
}): Promise<void> {
  await dbRun(
    `UPDATE budgets
     SET baseline_source = ?, assumptions = ?, status = ?, approved_by = ?, approved_at = ?, updated_at = ?
     WHERE id = ? AND organization_id = ?`,
    [
      params.baselineSource,
      JSON.stringify(params.assumptions),
      params.status === 'approved' ? 'APPROVED' : 'DRAFT',
      params.status === 'approved' ? params.userId : null,
      params.status === 'approved' ? stampNow() : null,
      stampNow(),
      params.budgetId,
      params.orgId,
    ]
  );
}

async function setAnalysisStatus(
  orgId: string,
  analysisId: string,
  status: 'draft' | 'review' | 'approved'
): Promise<void> {
  await dbRun(`UPDATE financial_analyses SET status = ?, updated_at = ? WHERE id = ? AND organization_id = ?`, [
    status.toUpperCase(),
    stampNow(),
    analysisId,
    orgId,
  ]);
}

async function setValuationStatus(params: {
  orgId: string;
  valuationId: string;
  status: 'review' | 'approved';
  userId: string;
}): Promise<void> {
  if (params.status === 'approved') return;
  await dbRun(
    `UPDATE valuations
     SET status = 'REVIEW', approved_by = NULL, approved_at = NULL, updated_at = NOW()
     WHERE id = ? AND organization_id = ?`,
    [params.valuationId, params.orgId]
  );
}

async function writeValuationArtifacts(params: {
  orgId: string;
  valuationId: string;
  userId: string;
  status: 'review' | 'approved';
  currency: string;
  sourceType: 'financial_model' | 'budget';
  sourceId: string;
  horizonYears: number;
  resultSeed: ValuationSeed['resultSeed'];
}): Promise<void> {
  const now = stampNow();
  const results = {
    computedAt: now,
    currency: params.currency,
    source: { type: params.sourceType, id: params.sourceId, quality: 'seeded-surface' },
    forecast: {
      horizonYears: params.horizonYears,
      years: Array.from({ length: params.horizonYears }, (_, index) => ({
        year: 2025 + index,
        fcff: Math.round(params.resultSeed.equityValue / Math.max(params.horizonYears, 1) / 2 + index * 12000),
        revenue: Math.round(params.resultSeed.enterpriseValue / 5 + index * 18000),
        ebitda: Math.round(params.resultSeed.enterpriseValue / 18 + index * 6000),
      })),
    },
    dcf: {
      enterpriseValue: params.resultSeed.enterpriseValue,
      equityValue: params.resultSeed.equityValue,
      discountRatePercent: params.resultSeed.discountRatePercent,
      terminalMethod: 'gordon',
      terminalGrowthPercent: params.resultSeed.terminalGrowthPercent,
      pvExplicit: params.resultSeed.pvExplicit,
      pvTerminal: params.resultSeed.pvTerminal,
    },
    comps: {
      impliedEnterpriseValue: {
        min: Math.round(params.resultSeed.enterpriseValue * 0.91),
        median: Math.round(params.resultSeed.enterpriseValue * 1.03),
        max: Math.round(params.resultSeed.enterpriseValue * 1.14),
      },
    },
    sensitivity: { kind: 'wacc_vs_g' },
    tornado: [
      { driver: 'Revenue growth', delta: 0.14 },
      { driver: 'EBITDA margin', delta: 0.11 },
      { driver: 'WACC', delta: -0.13 },
    ],
    disclaimers: [
      'Seeded valuation for realistic Finance surface testing.',
      'Assumptions should be refreshed before any business decision.',
    ],
  };

  const advisory =
    params.status === 'approved'
      ? {
          generatedAt: now,
          valuationId: params.valuationId,
          recommendations: [
            {
              id: `rec-${params.valuationId.slice(0, 8)}`,
              category: 'risk_reduction',
              title: 'Tighten execution reporting around the approved case',
              expectedDirection: 'Lower perceived risk / better valuation defense',
            },
          ],
        }
      : null;

  const negotiationPack =
    params.status === 'approved'
      ? {
          generatedAt: now,
          valuationId: params.valuationId,
          proPoints: [
            {
              title: 'DCF grounded in operating assumptions',
              oneLiner: 'Management can walk from budget/model drivers to EV transparently.',
            },
          ],
          contraPoints: [
            {
              title: 'Terminal assumptions remain sensitive',
              objection: 'Exit assumptions and growth require disciplined narrative.',
            },
          ],
        }
      : null;

  await dbRun(
    `UPDATE valuations
     SET results = ?, advisory = ?, negotiation_pack = ?, status = ?, approved_by = ?, approved_at = ?, updated_at = NOW()
     WHERE id = ? AND organization_id = ?`,
    [
      JSON.stringify(results),
      advisory ? JSON.stringify(advisory) : null,
      negotiationPack ? JSON.stringify(negotiationPack) : null,
      params.status === 'approved' ? 'APPROVED' : 'REVIEW',
      params.status === 'approved' ? params.userId : null,
      params.status === 'approved' ? now : null,
      params.valuationId,
      params.orgId,
    ]
  );
}

function buildModelSeeds(packs: Record<string, PackSeed>): ModelSeed[] {
  return [
    {
      title: `${NAME_PREFIX} Apator SA FY25-FY27 3Y Forecast`,
      description: `Three-year forecast statement seeded from ${packs['127ea773-001e-4e73-9e01-6a1fbf98fc05'].entityName} (${packs['127ea773-001e-4e73-9e01-6a1fbf98fc05'].periodLabel}) with base, optimistic and conservative variants.`,
      packId: '127ea773-001e-4e73-9e01-6a1fbf98fc05',
      currency: 'PLN',
      scenario: 'base',
      status: 'approved',
      startDate: '2025-01-01',
      horizonMonths: 36,
      events: [
        {
          eventType: 'revenue',
          name: 'Core industrial sales',
          amount: 920000,
          recurrence: 'monthly',
          growthRate: 0.012,
          cfClassification: 'operating',
          postingRules: { pl: { line: 'REVENUE' } },
        },
        {
          eventType: 'cogs',
          name: 'Production and delivery cost',
          amount: 548000,
          recurrence: 'monthly',
          growthRate: 0.009,
          cfClassification: 'operating',
          postingRules: { pl: { line: 'COGS' } },
        },
        {
          eventType: 'opex',
          name: 'Commercial and SG&A platform cost',
          amount: 211000,
          recurrence: 'monthly',
          growthRate: 0.006,
          cfClassification: 'operating',
          postingRules: { pl: { line: 'OPEX' } },
        },
      ],
    },
    {
      title: `${NAME_PREFIX} Grupa Apator FY25-FY27 3Y Forecast`,
      description: `Three-year forecast statement seeded from ${packs['53e8022c-a562-49d1-ad8f-847baec2f45e'].entityName} (${packs['53e8022c-a562-49d1-ad8f-847baec2f45e'].periodLabel}) with three operating variants.`,
      packId: '53e8022c-a562-49d1-ad8f-847baec2f45e',
      currency: 'PLN',
      scenario: 'base',
      status: 'review',
      startDate: '2025-01-01',
      horizonMonths: 36,
      events: [
        {
          eventType: 'revenue',
          name: 'AMI and grid automation revenue',
          amount: 1380000,
          recurrence: 'monthly',
          growthRate: 0.017,
          cfClassification: 'operating',
          postingRules: { pl: { line: 'REVENUE' } },
        },
        {
          eventType: 'cogs',
          name: 'Hardware and implementation cost',
          amount: 812000,
          recurrence: 'monthly',
          growthRate: 0.011,
          cfClassification: 'operating',
          postingRules: { pl: { line: 'COGS' } },
        },
        {
          eventType: 'capex_purchase',
          name: 'Automation line modernization',
          amount: 185000,
          recurrence: 'annual',
          cfClassification: 'investing',
          postingRules: { cf: { line: 'CAPEX' } },
        },
      ],
    },
    {
      title: `${NAME_PREFIX} KGHM FY25-FY27 3Y Forecast`,
      description: `Three-year forecast statement anchored in ${packs['f0d13ab0-3cd1-4394-bd8d-13c58340ece4'].entityName} (${packs['f0d13ab0-3cd1-4394-bd8d-13c58340ece4'].periodLabel}) with downside resilience assumptions and alternative variants.`,
      packId: 'f0d13ab0-3cd1-4394-bd8d-13c58340ece4',
      currency: 'PLN',
      scenario: 'base',
      status: 'approved',
      startDate: '2025-01-01',
      horizonMonths: 36,
      events: [
        {
          eventType: 'revenue',
          name: 'Copper production revenue',
          amount: 24600,
          recurrence: 'monthly',
          growthRate: 0.004,
          cfClassification: 'operating',
          postingRules: { pl: { line: 'REVENUE' } },
        },
        {
          eventType: 'opex',
          name: 'Energy and labor cost envelope',
          amount: 18950,
          recurrence: 'monthly',
          growthRate: 0.006,
          cfClassification: 'operating',
          postingRules: { pl: { line: 'OPEX' } },
        },
        {
          eventType: 'debt_repayment',
          name: 'Working capital discipline paydown',
          amount: 1200,
          recurrence: 'quarterly',
          cfClassification: 'financing',
          postingRules: { cf: { line: 'FINANCING_CF' } },
        },
      ],
    },
  ];
}

function buildBudgetSeeds(modelIds: Record<string, string>): BudgetSeed[] {
  return [
    {
      title: `${NAME_PREFIX} Apator FY25 Operating Budget`,
      description: 'Operating budget aligned to the approved Apator base model.',
      currency: 'PLN',
      periodStart: '2025-01',
      periodEnd: '2025-12',
      baselineSource: `financial_model:${modelIds['DBR77 | Apator SA FY25-FY27 3Y Forecast']}`,
      status: 'approved',
      assumptions: [
        { key: 'pricing', value: '+3.5%', note: 'Metering and export mix repricing' },
        { key: 'opex_discipline', value: '+2.1%', note: 'Shared services efficiency program' },
        { key: 'capex_gate', value: '57m PLN', note: 'Only digitization projects with signed ROI case' },
      ],
      lineValues: {
        REVENUE: 948000,
        COGS: 566000,
        GROSS_PROFIT: 382000,
        OPEX: 214000,
        EBITDA: 168000,
        DEPRECIATION: 42000,
        EBIT: 126000,
        INTEREST_EXPENSE: 13000,
        TAX: 21500,
        NET_INCOME: 91500,
        OPERATING_CF: 143000,
        CAPEX: 57000,
        FCF: 86000,
        FINANCING_CF: -24000,
        NET_CF: 62000,
      },
      scenarioAdjustments: {
        base: { revenueGrowth: 0.035, costReduction: 0.012 },
        optimistic: { revenueGrowth: 0.065, costReduction: 0.02 },
        conservative: { revenueGrowth: 0.01, costReduction: -0.005 },
      },
    },
    {
      title: `${NAME_PREFIX} Grupa Apator FY25 Cash Guard Budget`,
      description: 'Draft cash-protection budget for the stretch scenario and rolling forecast work.',
      currency: 'PLN',
      periodStart: '2025-01',
      periodEnd: '2025-12',
      baselineSource: `financial_model:${modelIds['DBR77 | Grupa Apator FY25-FY27 3Y Forecast']}`,
      status: 'draft',
      assumptions: [
        { key: 'mix_shift', value: 'AMI + smart grid', note: 'Higher gross margin mix assumed in H2' },
        { key: 'inventory_release', value: '18m PLN', note: 'Working capital release program' },
      ],
      lineValues: {
        REVENUE: 1425000,
        COGS: 829000,
        GROSS_PROFIT: 596000,
        OPEX: 272000,
        EBITDA: 324000,
        DEPRECIATION: 69000,
        EBIT: 255000,
        INTEREST_EXPENSE: 17000,
        TAX: 44600,
        NET_INCOME: 193400,
        OPERATING_CF: 281000,
        CAPEX: 121000,
        FCF: 160000,
        FINANCING_CF: -58000,
        NET_CF: 102000,
      },
      scenarioAdjustments: {
        base: { revenueGrowth: 0.028, costReduction: 0.01 },
        optimistic: { revenueGrowth: 0.055, costReduction: 0.018 },
        conservative: { revenueGrowth: -0.01, costReduction: -0.006 },
      },
    },
  ];
}

function buildAnalysisSeeds(): AnalysisSeed[] {
  return [
    {
      title: `${NAME_PREFIX} Apator FY24 Performance Review`,
      description: 'Historical ratio and margin review built around the 2024 standalone statement pack.',
      analysisType: 'comprehensive',
      currency: 'PLN',
      status: 'approved',
      packId: '127ea773-001e-4e73-9e01-6a1fbf98fc05',
      statementData: {
        pl: [
          { code: 'REVENUE', name: 'Revenue', values: { '2023': 836000, '2024': 912000 } },
          { code: 'COGS', name: 'COGS', values: { '2023': 514000, '2024': 569000 } },
          { code: 'OPEX', name: 'OPEX', values: { '2023': 191000, '2024': 207000 } },
          { code: 'EBITDA', name: 'EBITDA', values: { '2023': 131000, '2024': 136000 } },
          { code: 'NET_INCOME', name: 'Net Income', values: { '2023': 64000, '2024': 76000 } },
        ],
        bs: [
          { code: 'CASH', name: 'Cash', values: { '2023': 87000, '2024': 101000 } },
          { code: 'TOTAL_ASSETS', name: 'Total Assets', values: { '2023': 1145000, '2024': 1278000 } },
          { code: 'TOTAL_LIABILITIES', name: 'Total Liabilities', values: { '2023': 517000, '2024': 590000 } },
          { code: 'EQUITY', name: 'Equity', values: { '2023': 628000, '2024': 688000 } },
        ],
        cf: [
          { code: 'OPERATING_CF', name: 'Operating Cash Flow', values: { '2023': 91000, '2024': 109000 } },
          { code: 'CAPEX', name: 'Capex', values: { '2023': -36000, '2024': -57000 } },
          { code: 'FCF', name: 'Free Cash Flow', values: { '2023': 55000, '2024': 52000 } },
        ],
      },
    },
    {
      title: `${NAME_PREFIX} KGHM FY24 Margin Bridge`,
      description: 'Working review focused on margin pressure, energy cost and cash conversion.',
      analysisType: 'comprehensive',
      currency: 'PLN',
      status: 'review',
      packId: 'f0d13ab0-3cd1-4394-bd8d-13c58340ece4',
      statementData: {
        pl: [
          { code: 'REVENUE', name: 'Revenue', values: { '2023': 33850, '2024': 35200 } },
          { code: 'COGS', name: 'COGS', values: { '2023': 20510, '2024': 22140 } },
          { code: 'OPEX', name: 'OPEX', values: { '2023': 9570, '2024': 10180 } },
          { code: 'EBITDA', name: 'EBITDA', values: { '2023': 3770, '2024': 2880 } },
          { code: 'NET_INCOME', name: 'Net Income', values: { '2023': 1910, '2024': 1260 } },
        ],
        bs: [
          { code: 'CASH', name: 'Cash', values: { '2023': 6540, '2024': 6030 } },
          { code: 'TOTAL_ASSETS', name: 'Total Assets', values: { '2023': 50800, '2024': 51950 } },
          { code: 'TOTAL_LIABILITIES', name: 'Total Liabilities', values: { '2023': 20900, '2024': 22450 } },
          { code: 'EQUITY', name: 'Equity', values: { '2023': 29900, '2024': 29500 } },
        ],
        cf: [
          { code: 'OPERATING_CF', name: 'Operating Cash Flow', values: { '2023': 5120, '2024': 4210 } },
          { code: 'CAPEX', name: 'Capex', values: { '2023': -3380, '2024': -3910 } },
          { code: 'FCF', name: 'Free Cash Flow', values: { '2023': 1740, '2024': 300 } },
        ],
      },
    },
    {
      title: `${NAME_PREFIX} Apator Automation Cell CAPEX Case`,
      description: 'Investment case using the historical Apator baseline and forward capex cash flows.',
      analysisType: 'investment_case',
      currency: 'PLN',
      status: 'approved',
      packId: '53e8022c-a562-49d1-ad8f-847baec2f45e',
      statementData: {
        pl: [
          { code: 'REVENUE', name: 'Revenue', values: { '2025': 1410000, '2026': 1495000, '2027': 1588000, '2028': 1662000 } },
          { code: 'COGS', name: 'COGS', values: { '2025': 822000, '2026': 860000, '2027': 905000, '2028': 944000 } },
          { code: 'OPEX', name: 'OPEX', values: { '2025': 267000, '2026': 274000, '2027': 281000, '2028': 289000 } },
          { code: 'NET_INCOME', name: 'Net Income', values: { '2025': 182000, '2026': 206000, '2027': 226000, '2028': 241000 } },
        ],
        cf: [
          { code: 'CAPEX', name: 'Capex', values: { '2025': -145000, '2026': -18000, '2027': -12000, '2028': -12000 } },
          { code: 'OPERATING_CF', name: 'Operating Cash Flow', values: { '2025': 98000, '2026': 151000, '2027': 186000, '2028': 201000 } },
          { code: 'FCF', name: 'Free Cash Flow', values: { '2025': -47000, '2026': 133000, '2027': 174000, '2028': 189000 } },
        ],
      },
    },
    {
      title: `${NAME_PREFIX} KGHM Energy Recovery CAPEX Case`,
      description: 'Investment case for cost recovery and lower unit energy intensity.',
      analysisType: 'investment_case',
      currency: 'PLN',
      status: 'draft',
      packId: 'f0d13ab0-3cd1-4394-bd8d-13c58340ece4',
      statementData: {
        pl: [
          { code: 'REVENUE', name: 'Revenue', values: { '2025': 35600, '2026': 36250, '2027': 37100, '2028': 38050 } },
          { code: 'OPEX', name: 'OPEX', values: { '2025': 10050, '2026': 9920, '2027': 9840, '2028': 9790 } },
          { code: 'NET_INCOME', name: 'Net Income', values: { '2025': 1380, '2026': 1620, '2027': 1840, '2028': 2050 } },
        ],
        cf: [
          { code: 'CAPEX', name: 'Capex', values: { '2025': -2200, '2026': -300, '2027': -250, '2028': -250 } },
          { code: 'OPERATING_CF', name: 'Operating Cash Flow', values: { '2025': 960, '2026': 1310, '2027': 1580, '2028': 1760 } },
          { code: 'FCF', name: 'Free Cash Flow', values: { '2025': -1240, '2026': 1010, '2027': 1330, '2028': 1510 } },
        ],
      },
    },
  ];
}

function buildValuationSeeds(sourceIds: Record<string, string>): ValuationSeed[] {
  return [
    {
      title: `${NAME_PREFIX} Apator DCF 2025`,
      description: 'DCF valuation sourced from the approved Apator base model.',
      sourceType: 'financial_model',
      sourceKey: 'DBR77 | Apator SA FY25-FY27 3Y Forecast',
      currency: 'PLN',
      horizonYears: 5,
      status: 'approved',
      assumptions: {
        waccPercent: 11.2,
        terminalGrowthPercent: 2.5,
        netDebt: 118000,
        sharesOutstanding: 49800,
      },
      peers: {
        metric: 'EV/EBITDA',
        min: 6.8,
        median: 8.2,
        max: 9.6,
        peerSet: [
          { name: 'Landis+Gyr', notes: 'Smart metering' },
          { name: 'Aalberts', notes: 'Industrial technology' },
          { name: 'Hexing', notes: 'Grid devices' },
        ],
        confidenceNote: 'Peer set reflects industrial automation and grid technology names.',
      },
      resultSeed: {
        enterpriseValue: 1284000,
        equityValue: 1166000,
        discountRatePercent: 11.2,
        terminalGrowthPercent: 2.5,
        pvExplicit: 462000,
        pvTerminal: 822000,
      },
    },
    {
      title: `${NAME_PREFIX} Apator Budget Guardrail Valuation`,
      description: 'Board-level valuation envelope based on the approved Apator operating budget.',
      sourceType: 'budget',
      sourceKey: 'DBR77 | Apator FY25 Operating Budget',
      currency: 'PLN',
      horizonYears: 4,
      status: 'review',
      assumptions: {
        waccPercent: 11.8,
        terminalGrowthPercent: 2.2,
        netDebt: 126000,
      },
      peers: {
        metric: 'EV/EBITDA',
        min: 6.5,
        median: 7.7,
        max: 8.9,
        peerSet: [
          { name: 'Aptiv', notes: 'Electrical architecture' },
          { name: 'Schneider Electric', notes: 'Energy management' },
        ],
        confidenceNote: 'Budget-based range used for guardrail discussion, not a final deal view.',
      },
      resultSeed: {
        enterpriseValue: 1198000,
        equityValue: 1072000,
        discountRatePercent: 11.8,
        terminalGrowthPercent: 2.2,
        pvExplicit: 438000,
        pvTerminal: 760000,
      },
    },
  ];
}

async function main() {
  const dbTarget = resolveScriptDatabaseTarget({
    label: 'seed-finance-surface',
    databaseUrl: process.env.DATABASE_URL,
    publicDatabaseUrl: process.env.DATABASE_PUBLIC_URL,
    requireExplicitTarget: true,
  });
  logSelectedDatabaseTarget('seed-finance-surface', dbTarget);

  const org = await dbGet<{ id: string; name: string }>(`SELECT id, name FROM organizations WHERE id = ? LIMIT 1`, [
    ORG_ID,
  ]);
  if (!org?.id) {
    throw new Error(`[seed-finance-surface] Organization "${ORG_ID}" not found.`);
  }

  const userId = await resolveUserId(ORG_ID);
  const packs = await loadPackSeeds(ORG_ID);

  await cleanupExistingSeed(ORG_ID);

  const modelIds: Record<string, string> = {};
  for (const seed of buildModelSeeds(packs)) {
    const pack = packs[seed.packId];
    const modelId = await createModel({
      organizationId: ORG_ID,
      name: seed.title,
      description: seed.description,
      currency: seed.currency,
      horizonMonths: seed.horizonMonths,
      startDate: seed.startDate,
      granularity: 'monthly',
      scenario: seed.scenario,
      assumptions: {
        seededForSurface: true,
        seedPackId: pack.id,
        seedPackEntity: pack.entityName,
        seedPackPeriod: pack.periodLabel,
        seedPackScaling: pack.scaling,
      },
      createdBy: userId,
    });

    for (const event of seed.events) {
      await addEvent({
        modelId,
        eventType: event.eventType,
        name: event.name,
        amount: event.amount,
        recurrence: event.recurrence,
        growthRate: event.growthRate || 0,
        periodStart: seed.startDate,
        cfClassification: event.cfClassification,
        postingRules: event.postingRules,
        createdBy: userId,
      });
    }

    await updateModelLinkage({
      modelId,
      orgId: ORG_ID,
      userId,
      packId: pack.id,
      statementId: pack.statementIds[0],
      status: seed.status,
    });

    modelIds[seed.title] = modelId;
  }

  const budgetIds: Record<string, string> = {};
  for (const seed of buildBudgetSeeds(modelIds)) {
    const budget = await createBudget(
      ORG_ID,
      {
        title: seed.title,
        description: seed.description,
        periodStart: seed.periodStart,
        periodEnd: seed.periodEnd,
        granularity: 'monthly',
        currency: seed.currency,
      },
      userId
    );

    await setBudgetLineValues(budget.id, seed.lineValues);
    await updateBudgetMetadata({
      budgetId: budget.id,
      orgId: ORG_ID,
      baselineSource: seed.baselineSource,
      assumptions: seed.assumptions,
      status: 'draft',
      userId,
    });

    const scenarios = await getScenarios(budget.id);
    for (const scenario of scenarios) {
      const key = String(scenario.scenarioType || 'base') as 'base' | 'optimistic' | 'conservative';
      const adjustments = seed.scenarioAdjustments[key] || {};
      await updateScenarioAdjustments(budget.id, scenario.id, adjustments);
      await generateScenarioProjections(ORG_ID, budget.id, scenario.id);
    }

    await updateBudgetMetadata({
      budgetId: budget.id,
      orgId: ORG_ID,
      baselineSource: seed.baselineSource,
      assumptions: seed.assumptions,
      status: seed.status,
      userId,
    });

    budgetIds[seed.title] = budget.id;
  }

  const analysisIds: Record<string, string> = {};
  for (const seed of buildAnalysisSeeds()) {
    const pack = packs[seed.packId];
    const periods = Array.from(
      new Set([
        ...Object.keys(seed.statementData.pl?.[0]?.values || {}),
        ...Object.keys(seed.statementData.bs?.[0]?.values || {}),
        ...Object.keys(seed.statementData.cf?.[0]?.values || {}),
      ])
    );
    const analysis = await createAnalysis(
      ORG_ID,
      {
        title: seed.title,
        description: seed.description,
        analysisType: seed.analysisType,
        periods,
        statementData: seed.statementData,
        currency: seed.currency,
      },
      userId
    );

    await updateAnalysis(ORG_ID, analysis.id, {
      sourceStatementPackId: pack.id,
      sourceStatementIds: pack.statementIds,
    });

    try {
      await runFullAnalysis(ORG_ID, analysis.id);
    } catch (error) {
      console.warn(
        `[seed-finance-surface] runFullAnalysis failed for "${seed.title}":`,
        (error as Error).message
      );
    }

    if (seed.status === 'approved') {
      await approveAnalysis(ORG_ID, analysis.id, userId);
    } else {
      await setAnalysisStatus(ORG_ID, analysis.id, seed.status);
    }

    analysisIds[seed.title] = analysis.id;
  }

  const sourceIds = { ...modelIds, ...budgetIds, ...analysisIds };
  for (const seed of buildValuationSeeds(sourceIds)) {
    const valuation = await createValuation(
      ORG_ID,
      {
        title: seed.title,
        description: seed.description,
        sourceType: seed.sourceType,
        sourceId: sourceIds[seed.sourceKey],
        horizonYears: seed.horizonYears,
        currency: seed.currency,
      },
      userId
    );

    await updateAssumptions(ORG_ID, valuation.id, seed.assumptions);
    await updatePeers(ORG_ID, valuation.id, seed.peers);
    await writeValuationArtifacts({
      orgId: ORG_ID,
      valuationId: valuation.id,
      userId,
      status: seed.status,
      currency: seed.currency,
      sourceType: seed.sourceType,
      sourceId: sourceIds[seed.sourceKey],
      horizonYears: seed.horizonYears,
      resultSeed: seed.resultSeed,
    });
    if (seed.status !== 'approved') {
      await setValuationStatus({ orgId: ORG_ID, valuationId: valuation.id, status: seed.status, userId });
    }
  }

  const summary = await dbGet<{
    models: number;
    analyses: number;
    budgets: number;
    valuations: number;
  }>(
    `SELECT
       (SELECT COUNT(*)::int FROM financial_models WHERE organization_id = ? AND name LIKE ?) AS models,
       (SELECT COUNT(*)::int FROM financial_analyses WHERE organization_id = ? AND title LIKE ?) AS analyses,
       (SELECT COUNT(*)::int FROM budgets WHERE organization_id = ? AND title LIKE ?) AS budgets,
       (SELECT COUNT(*)::int FROM valuations WHERE organization_id = ? AND title LIKE ?) AS valuations`,
    [ORG_ID, `${NAME_PREFIX}%`, ORG_ID, `${NAME_PREFIX}%`, ORG_ID, `${NAME_PREFIX}%`, ORG_ID, `${NAME_PREFIX}%`]
  );

  console.log('✅ Finance surface seed complete.');
  console.table([
    {
      organization: ORG_ID,
      userId,
      models: Number(summary?.models || 0),
      analyses: Number(summary?.analyses || 0),
      budgets: Number(summary?.budgets || 0),
      valuations: Number(summary?.valuations || 0),
    },
  ]);
}

main().catch((error) => {
  console.error('❌ seed-finance-surface failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
