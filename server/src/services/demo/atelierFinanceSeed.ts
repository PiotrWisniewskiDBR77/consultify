/**
 * Atelier Toys — canonical Finance golden flow seed (FIN-005).
 *
 * WHY
 * ---
 * The 2026-08-01 staging probe of `demo.consultify.ai` found Finance telling
 * somebody else's story: the only approved statement was `DBR77 Manufacturing`,
 * the only analysis was `DBR77 Staging Financial Analysis`, and Models mixed
 * DBR77, Apator and four identical `(kopia)` duplicates. The Atelier Toys demo
 * tenant had a ROI *model* (`upsertAtelierRoiFinancialModel`) but **no statement
 * and no analysis at all** — nothing for the model to be grounded on. The demo
 * run-sheet nevertheless promises the model is "grounded on a confirmed FY2014
 * P&L".
 *
 * This module materializes that missing grounding, so Finance can tell one
 * chain end to end:
 *
 *   statement (FY2014 pack: P&L + BS + CF)
 *     -> analysis (approved, seeded from the pack)
 *       -> model (`Atelier Toys — Transformation 2015 ROI`, bound to the pack)
 *         -> investment case / baseline -> plan vs actual
 *
 * CONTRACT
 * --------
 * - **Idempotent.** Every write is `INSERT ... ON CONFLICT(id) DO UPDATE` on an
 *   id built by `makeId(orgId, entity, slug)`. Running the seed twice converges;
 *   it never duplicates. This is the same guarantee proved by
 *   `__tests__/atelierSeedIdempotency.test.ts`.
 * - **Tenant-scoped.** Every row carries the caller's `organizationId`. The seed
 *   never reads or writes another tenant's data and never deletes anything.
 * - **READY is EARNED, never asserted.** The seed writes in TWO PHASES. Phase 1
 *   writes the pack and the statements in a NOT-ready state (statement
 *   `status='imported'`, `validation_status='pending'`, `readiness_status='pending'`,
 *   `readiness_score=0`; pack `pack_status='draft'`, `pack_readiness_status='pending'`)
 *   together with the values. Phase 2 READS THE ROWS BACK out of the database and
 *   only then promotes them: per statement it checks the exact expected canonical
 *   value count (`getAtelierExpectedValueCounts()`), 100% non-null
 *   `canonical_line_id`, a single resolved currency and correct lineage
 *   (`statement_pack_id` = the canonical pack, `organization_id` = the caller's
 *   org), and it recomputes the verdict with the PRODUCTION functions
 *   `validateStatement` / `evaluateStatementReadiness` against those read-back
 *   rows. A statement is promoted to confirmed/pass/ready only if production
 *   agrees it is ready; the pack is promoted only once all three statements are
 *   promoted AND the approved analysis exists and points at the pack.
 *   Consequence: if anything downstream fails, the fixture stays visibly
 *   not-ready instead of lying.
 * - **Arithmetically true.** The three statements reconcile with each other and
 *   pass `validateStatement` with zero warnings. `assertAtelierFy2014Coherent()`
 *   states those invariants in code so a future edit to a number cannot quietly
 *   break the balance sheet.
 *
 * CURRENCY — see NEEDS_PRODUCT_DECISION in the FIN-005 handoff.
 * The Atelier narrative is euro-denominated everywhere else (`Digital ARR is
 * ~EUR 6.2M against an EUR 8M target` in the interview facts, KPI unit `EUR M`,
 * initiative budgets in the same order of magnitude). The pre-existing ROI model
 * was seeded in PLN, which is the app-wide default currency rather than a
 * deliberate choice for a French toy maker. This seed standardises the Finance
 * golden flow on **EUR** and leaves the model's economics (EUR 2.4M annual
 * uplift, EUR 0.8M capex, EUR 0.4M opex reduction) numerically unchanged.
 */

import * as DbPromise from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';
import { ensureCanonicalRegistryInDatabase } from '../financeCanonicalRegistrySyncService.js';
import {
  evaluateStatementReadiness,
  validateStatement,
  type ValidationMessage,
} from '../financialStatementService.js';
import type { DemoLocale } from './demoLocale.js';

// ---------------------------------------------------------------------------
// Canonical identity of the Atelier Finance fixture
// ---------------------------------------------------------------------------

export const ATELIER_FINANCE_ENTITY_NAME = 'Atelier Toys';
export const ATELIER_FINANCE_CURRENCY = 'EUR';
export const ATELIER_FINANCE_SCALING = 'units';
export const ATELIER_FINANCE_PERIOD_LABEL = 'FY2014';
export const ATELIER_FINANCE_PERIOD_START = '2014-01-01';
export const ATELIER_FINANCE_PERIOD_END = '2014-12-31';

/** Canonical model name required by FIN-005; must stay byte-identical. */
export const ATELIER_CANONICAL_MODEL_NAME_EN = 'Atelier Toys — Transformation 2015 ROI';
export const ATELIER_CANONICAL_MODEL_NAME_PL = 'Atelier Toys — Transformacja 2015 (ROI)';

export const ATELIER_ANALYSIS_TITLE_EN = 'Atelier Toys — FY2014 Baseline Financial Analysis';
export const ATELIER_ANALYSIS_TITLE_PL = 'Atelier Toys — analiza finansowa bazowa FY2014';

/** Slugs of every row this seed owns — the cleanup script uses them to tell
 *  canonical Atelier rows apart from foreign ones. */
export const ATELIER_FINANCE_SLUGS = {
  pack: 'atelier-fy2014',
  statementPl: 'atelier-fy2014-pl',
  statementBs: 'atelier-fy2014-bs',
  statementCf: 'atelier-fy2014-cf',
  analysis: 'atelier-fy2014-baseline',
} as const;

// ---------------------------------------------------------------------------
// FY2014 baseline — one source of truth for statement, analysis and read-back
// ---------------------------------------------------------------------------

export interface AtelierStatementLine {
  /** Canonical registry id — the FK written to `financial_statement_values`. */
  lineId: string;
  /** Canonical code — what the analysis `statement_data` is keyed on. */
  code: string;
  /** Label as it would have appeared on the source document. */
  label: string;
  /**
   * Value in whole EUR. Lines whose canonical `signConvention` is
   * `display_absolute` (COGS, OPEX, D&A, interest, tax, payables, liabilities,
   * capex) are stored as positive magnitudes, exactly as the ingest pipeline
   * stores them; `positive_normal` lines carry their true sign.
   */
  value: number;
}

/**
 * Atelier Toys FY2014 P&L — the pre-transformation baseline year. The program
 * ("Atelier Forward") starts 2015-01-01, which is why the grounding statement is
 * FY2014 and the model's `start_date` is 2015-01-01.
 */
export const ATELIER_FY2014_PL: AtelierStatementLine[] = [
  { lineId: 'fsl-pl-revenue', code: 'REVENUE', label: 'Net sales', value: 118_400_000 },
  { lineId: 'fsl-pl-cogs', code: 'COGS', label: 'Cost of goods sold', value: 71_040_000 },
  { lineId: 'fsl-pl-gross', code: 'GROSS_PROFIT', label: 'Gross profit', value: 47_360_000 },
  {
    lineId: 'fsl-pl-opex',
    code: 'OPEX',
    label: 'Selling, general & administrative',
    value: 34_820_000,
  },
  { lineId: 'fsl-pl-ebitda', code: 'EBITDA', label: 'EBITDA', value: 12_540_000 },
  {
    lineId: 'fsl-pl-depreciation',
    code: 'DEPRECIATION',
    label: 'Depreciation & amortisation',
    value: 4_180_000,
  },
  { lineId: 'fsl-pl-ebit', code: 'EBIT', label: 'Operating profit (EBIT)', value: 8_360_000 },
  {
    lineId: 'fsl-pl-interest',
    code: 'INTEREST_EXPENSE',
    label: 'Interest expense',
    value: 1_120_000,
  },
  { lineId: 'fsl-pl-ebt', code: 'EBT', label: 'Profit before tax', value: 7_240_000 },
  { lineId: 'fsl-pl-tax', code: 'TAX_EXPENSE', label: 'Income tax', value: 1_810_000 },
  { lineId: 'fsl-pl-net', code: 'NET_INCOME', label: 'Net profit for the year', value: 5_430_000 },
];

/** Atelier Toys FY2014 balance sheet at 31 December 2014. */
export const ATELIER_FY2014_BS: AtelierStatementLine[] = [
  { lineId: 'fsl-bs-cash', code: 'CASH', label: 'Cash & cash equivalents', value: 9_600_000 },
  { lineId: 'fsl-bs-ar', code: 'AR', label: 'Trade receivables', value: 18_300_000 },
  { lineId: 'fsl-bs-inventory', code: 'INVENTORY', label: 'Inventories', value: 21_700_000 },
  {
    lineId: 'fsl-bs-current-assets',
    code: 'CURRENT_ASSETS',
    label: 'Total current assets',
    value: 49_600_000,
  },
  {
    lineId: 'fsl-bs-fixed',
    code: 'FIXED_ASSETS',
    label: 'Property, plant & equipment and intangibles',
    value: 42_900_000,
  },
  { lineId: 'fsl-bs-total-assets', code: 'TOTAL_ASSETS', label: 'Total assets', value: 92_500_000 },
  { lineId: 'fsl-bs-ap', code: 'AP', label: 'Trade payables', value: 16_400_000 },
  {
    lineId: 'fsl-bs-current-liabilities',
    code: 'CURRENT_LIABILITIES',
    label: 'Total current liabilities',
    value: 24_800_000,
  },
  {
    lineId: 'fsl-bs-long-term-debt',
    code: 'LONG_TERM_DEBT',
    label: 'Long-term borrowings',
    value: 22_700_000,
  },
  {
    lineId: 'fsl-bs-total-liabilities',
    code: 'TOTAL_LIABILITIES',
    label: 'Total liabilities',
    value: 47_500_000,
  },
  { lineId: 'fsl-bs-equity', code: 'TOTAL_EQUITY', label: 'Total equity', value: 45_000_000 },
];

/** Atelier Toys FY2014 cash flow statement. */
export const ATELIER_FY2014_CF: AtelierStatementLine[] = [
  {
    lineId: 'fsl-cf-operating',
    code: 'OPERATING_CF',
    label: 'Net cash from operating activities',
    value: 11_240_000,
  },
  {
    lineId: 'fsl-cf-capex',
    code: 'CAPEX',
    label: 'Purchases of property, plant & equipment',
    value: 6_900_000,
  },
  {
    lineId: 'fsl-cf-investing',
    code: 'INVESTING_CF',
    label: 'Net cash used in investing activities',
    value: -7_300_000,
  },
  {
    lineId: 'fsl-cf-financing',
    code: 'FINANCING_CF',
    label: 'Net cash used in financing activities',
    value: -2_860_000,
  },
  {
    lineId: 'fsl-cf-net-change-cash',
    code: 'NET_CHANGE_CASH',
    label: 'Net increase in cash',
    value: 1_080_000,
  },
];

export const ATELIER_FY2014_STATEMENTS = [
  { statementType: 'P&L' as const, slug: ATELIER_FINANCE_SLUGS.statementPl, lines: ATELIER_FY2014_PL },
  { statementType: 'BS' as const, slug: ATELIER_FINANCE_SLUGS.statementBs, lines: ATELIER_FY2014_BS },
  { statementType: 'CF' as const, slug: ATELIER_FINANCE_SLUGS.statementCf, lines: ATELIER_FY2014_CF },
];

function valueOf(lines: AtelierStatementLine[], code: string): number {
  const line = lines.find((item) => item.code === code);
  if (!line) throw new Error(`[atelier-finance-seed] missing canonical line ${code}`);
  return line.value;
}

/**
 * Assert the fixture's internal arithmetic.
 *
 * These are the exact relationships `validateStatement()` checks (plus the
 * subtotal identities a reader would check by eye). Stating them here means a
 * future edit to a single number fails loudly in the unit test instead of
 * shipping a balance sheet that does not balance onto a client demo.
 */
export function assertAtelierFy2014Coherent(): void {
  const fail = (message: string): never => {
    throw new Error(`[atelier-finance-seed] ${message}`);
  };

  // P&L — every subtotal is the arithmetic result of the lines above it.
  const revenue = valueOf(ATELIER_FY2014_PL, 'REVENUE');
  const cogs = valueOf(ATELIER_FY2014_PL, 'COGS');
  const gross = valueOf(ATELIER_FY2014_PL, 'GROSS_PROFIT');
  const opex = valueOf(ATELIER_FY2014_PL, 'OPEX');
  const ebitda = valueOf(ATELIER_FY2014_PL, 'EBITDA');
  const depreciation = valueOf(ATELIER_FY2014_PL, 'DEPRECIATION');
  const ebit = valueOf(ATELIER_FY2014_PL, 'EBIT');
  const interest = valueOf(ATELIER_FY2014_PL, 'INTEREST_EXPENSE');
  const ebt = valueOf(ATELIER_FY2014_PL, 'EBT');
  const tax = valueOf(ATELIER_FY2014_PL, 'TAX_EXPENSE');
  const net = valueOf(ATELIER_FY2014_PL, 'NET_INCOME');

  if (revenue <= 0) fail('revenue must be positive');
  if (gross !== revenue - cogs) fail('GROSS_PROFIT != REVENUE - COGS');
  if (ebitda !== gross - opex) fail('EBITDA != GROSS_PROFIT - OPEX');
  if (ebit !== ebitda - depreciation) fail('EBIT != EBITDA - DEPRECIATION');
  // EBITDA below EBIT trips PL_EBITDA_BELOW_EBIT in validateStatement.
  if (ebitda < ebit) fail('EBITDA must not be below EBIT');
  if (ebt !== ebit - interest) fail('EBT != EBIT - INTEREST_EXPENSE');
  if (net !== ebt - tax) fail('NET_INCOME != EBT - TAX_EXPENSE');

  // BS — the equation validateStatement enforces as a hard error.
  const cash = valueOf(ATELIER_FY2014_BS, 'CASH');
  const ar = valueOf(ATELIER_FY2014_BS, 'AR');
  const inventory = valueOf(ATELIER_FY2014_BS, 'INVENTORY');
  const currentAssets = valueOf(ATELIER_FY2014_BS, 'CURRENT_ASSETS');
  const fixedAssets = valueOf(ATELIER_FY2014_BS, 'FIXED_ASSETS');
  const totalAssets = valueOf(ATELIER_FY2014_BS, 'TOTAL_ASSETS');
  const ap = valueOf(ATELIER_FY2014_BS, 'AP');
  const currentLiabilities = valueOf(ATELIER_FY2014_BS, 'CURRENT_LIABILITIES');
  const longTermDebt = valueOf(ATELIER_FY2014_BS, 'LONG_TERM_DEBT');
  const totalLiabilities = valueOf(ATELIER_FY2014_BS, 'TOTAL_LIABILITIES');
  const equity = valueOf(ATELIER_FY2014_BS, 'TOTAL_EQUITY');

  if (cash < 0) fail('cash must not be negative');
  if (currentAssets !== cash + ar + inventory) fail('CURRENT_ASSETS != CASH + AR + INVENTORY');
  if (totalAssets !== currentAssets + fixedAssets) fail('TOTAL_ASSETS != CURRENT + FIXED');
  if (totalLiabilities !== currentLiabilities + longTermDebt)
    fail('TOTAL_LIABILITIES != CURRENT + LONG_TERM_DEBT');
  if (totalAssets !== totalLiabilities + equity) fail('assets != liabilities + equity');
  if (ap > currentLiabilities) fail('AP must not exceed CURRENT_LIABILITIES');
  if (currentAssets > totalAssets * 1.05) fail('current assets exceed total assets');
  if (currentLiabilities > totalLiabilities * 1.1) fail('current liabilities exceed total');

  // CF — the net change reconciles the three activity blocks, and operating
  // cash flow reconciles to the P&L it is derived from.
  const operating = valueOf(ATELIER_FY2014_CF, 'OPERATING_CF');
  const investing = valueOf(ATELIER_FY2014_CF, 'INVESTING_CF');
  const financing = valueOf(ATELIER_FY2014_CF, 'FINANCING_CF');
  const netChange = valueOf(ATELIER_FY2014_CF, 'NET_CHANGE_CASH');
  const capex = valueOf(ATELIER_FY2014_CF, 'CAPEX');

  if (netChange !== operating + investing + financing)
    fail('NET_CHANGE_CASH != OPERATING + INVESTING + FINANCING');
  if (capex <= 0) fail('CAPEX is stored as a positive magnitude');
  if (Math.abs(investing) < capex) fail('investing outflow must at least cover capex');
  // Operating cash flow = net income + D&A + working-capital release.
  if (operating <= net) fail('operating cash flow must exceed net income (D&A add-back)');
}

/**
 * `statement_data` payload for `financial_analyses`, in the shape
 * `financialAnalysisService` reads (`{ pl|bs|cf: [{code, name, values}] }`).
 * Built from the same arrays as the statements, so the analysis can never drift
 * from the statement it claims to be grounded on.
 */
export function buildAtelierAnalysisStatementData(): {
  periods: string[];
  statementData: {
    pl: Array<{ code: string; name: string; values: Record<string, number> }>;
    bs: Array<{ code: string; name: string; values: Record<string, number> }>;
    cf: Array<{ code: string; name: string; values: Record<string, number> }>;
  };
} {
  const toSection = (lines: AtelierStatementLine[]) =>
    lines.map((line) => ({
      code: line.code,
      name: line.label,
      values: { [ATELIER_FINANCE_PERIOD_LABEL]: line.value },
    }));

  return {
    periods: [ATELIER_FINANCE_PERIOD_LABEL],
    statementData: {
      pl: toSection(ATELIER_FY2014_PL),
      bs: toSection(ATELIER_FY2014_BS),
      cf: toSection(ATELIER_FY2014_CF),
    },
  };
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

/** Same id convention as `demoSeedService.makeId` — stable across re-runs. */
function makeId(orgId: string, entity: string, slug: string): string {
  return `${orgId}--${entity}--${slug}`;
}

/** Id of the canonical ROI model, owned by `demoSeedService`, listed here so the
 *  canonical-ID contract below is complete. */
export function atelierCanonicalModelId(organizationId: string): string {
  return makeId(organizationId, 'financial-model', 'transformation-2015-roi');
}

/**
 * THE canonical-ID contract for the FIN-005 Atelier Finance fixture.
 *
 * This is the single authority on which Finance rows the demo tenant is allowed
 * to contain. It is an EXACT SET, not a prefix rule.
 *
 * WHY EXACT, NOT `startsWith('<org>--')`: the demo tenant has accumulated rows
 * from older technical fixtures (M16 seeds, staging probes) that were ALSO
 * written with `makeId(orgId, …)` and therefore carry the same prefix. A prefix
 * rule silently blesses every one of them, which is exactly the failure FIN-005
 * is meant to end. Only the ids enumerated here are canonical; anything else in
 * the tenant is foreign, prefix or no prefix.
 *
 * Both the seed (what it writes) and the cleanup script (what it must never
 * quarantine) read this function, so the two can never drift apart.
 */
export interface AtelierCanonicalIds {
  packId: string;
  statementIds: string[];
  ingestRunIds: string[];
  statementValueIds: string[];
  analysisId: string;
  modelId: string;
  /** Every id above, flattened — the whitelist. */
  all: Set<string>;
  /** Canonical ids grouped by the table that holds them. */
  byTable: Record<string, string[]>;
}

export function getAtelierFinanceCanonicalIds(organizationId: string): AtelierCanonicalIds {
  const packId = makeId(organizationId, 'statement-pack', ATELIER_FINANCE_SLUGS.pack);
  const statementIds = ATELIER_FY2014_STATEMENTS.map((statement) =>
    makeId(organizationId, 'statement', statement.slug)
  );
  const ingestRunIds = ATELIER_FY2014_STATEMENTS.map((statement) =>
    makeId(organizationId, 'statement-ingest-run', statement.slug)
  );
  const statementValueIds = ATELIER_FY2014_STATEMENTS.flatMap((statement) =>
    statement.lines.map((line) =>
      makeId(organizationId, 'statement-value', `${statement.slug}--${line.code.toLowerCase()}`)
    )
  );
  const analysisId = makeId(organizationId, 'analysis', ATELIER_FINANCE_SLUGS.analysis);
  const modelId = atelierCanonicalModelId(organizationId);

  const byTable: Record<string, string[]> = {
    financial_statement_packs: [packId],
    financial_statements: statementIds,
    financial_statement_ingest_runs: ingestRunIds,
    financial_statement_values: statementValueIds,
    financial_analyses: [analysisId],
    financial_models: [modelId],
  };

  return {
    packId,
    statementIds,
    ingestRunIds,
    statementValueIds,
    analysisId,
    modelId,
    all: new Set(Object.values(byTable).flat()),
    byTable,
  };
}

/** Expected canonical value count per statement type — used by the READY gate. */
export function getAtelierExpectedValueCounts(): Record<string, number> {
  return Object.fromEntries(
    ATELIER_FY2014_STATEMENTS.map((statement) => [statement.statementType, statement.lines.length])
  );
}

async function tableExists(tableName: string): Promise<boolean> {
  try {
    const row = await DbPromise.get<{ exists: boolean }>(
      `SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = $1
      ) AS exists`,
      [tableName],
      { fallback: true }
    );
    return Boolean(row?.exists);
  } catch {
    return false;
  }
}

async function getTableColumns(tableName: string): Promise<Set<string>> {
  try {
    const rows = await DbPromise.all<{ column_name: string }>(
      `SELECT LOWER(column_name) AS column_name
       FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = $1`,
      [tableName],
      { fallback: true }
    );
    return new Set((rows || []).map((row) => String(row.column_name)));
  } catch {
    return new Set<string>();
  }
}

// ---------------------------------------------------------------------------
// Schema contract
// ---------------------------------------------------------------------------

/**
 * Columns without which this fixture cannot be BOTH written AND verified.
 *
 * DELIBERATE CHOICE — a missing table/column returns INCOMPLETE, it does not
 * throw. The FIN-005 packet allows either ("failure albo jawny INCOMPLETE").
 * This seed runs inside `seedAtelierToysDemoDataset`, so a throw would abort
 * every other module of the Atelier demo dataset (interviews, initiatives, KPIs,
 * deliverables) because of a Finance schema problem. Returning an explicit
 * `{ status: 'incomplete', missing: [...] }` keeps the blast radius at Finance
 * while making the degradation impossible to miss: it is logged as a warning AND
 * carried in the seed result, and — the point of the whole exercise — nothing is
 * ever promoted to READY.
 *
 * The only throw left in this module is `assertAtelierFy2014Coherent()`, which
 * fires on a fixture ARITHMETIC bug: a developer error the unit test gates, not
 * environment drift.
 */
const REQUIRED_SCHEMA: Record<string, readonly string[]> = {
  financial_statement_packs: [
    'id',
    'organization_id',
    'entity_name',
    'period_start',
    'period_end',
    'period_label',
    'currency',
    'scaling',
    'pack_status',
    'pack_readiness_status',
    'pack_readiness_score',
  ],
  financial_statements: [
    'id',
    'organization_id',
    'statement_pack_id',
    'entity_name',
    'statement_type',
    'period_start',
    'period_end',
    'period_label',
    'currency',
    'scaling',
    'status',
    'validation_status',
    'readiness_status',
    'readiness_score',
  ],
  financial_statement_values: ['id', 'statement_id', 'canonical_line_id', 'value'],
  financial_analyses: [
    'id',
    'organization_id',
    'title',
    'status',
    'source_statement_pack_id',
  ],
};

interface SchemaProbe {
  /** Column names (lower-case) per table; EMPTY set = introspection unavailable. */
  columns: Record<string, Set<string>>;
  /** `table` or `table.column` entries that are required and absent. */
  missing: string[];
  /**
   * Tables that exist but whose column list came back empty. In production that
   * cannot happen (a table always has columns), so it means the
   * `information_schema` probe itself was unavailable — the case the mocked test
   * harnesses reproduce. See `projectUpsert` for why this stays safe.
   */
  unverified: string[];
}

async function probeAtelierFinanceSchema(): Promise<SchemaProbe> {
  const columns: Record<string, Set<string>> = {};
  const missing: string[] = [];
  const unverified: string[] = [];

  for (const [table, required] of Object.entries(REQUIRED_SCHEMA)) {
    if (!(await tableExists(table))) {
      columns[table] = new Set<string>();
      missing.push(table);
      continue;
    }
    const tableColumns = await getTableColumns(table);
    columns[table] = tableColumns;
    if (tableColumns.size === 0) {
      unverified.push(table);
      continue;
    }
    for (const column of required) {
      if (!tableColumns.has(column.toLowerCase())) missing.push(`${table}.${column}`);
    }
  }

  return { columns, missing, unverified };
}

// ---------------------------------------------------------------------------
// Idempotent upserts
// ---------------------------------------------------------------------------

type ColumnValue = [column: string, value: unknown];

interface ProjectedUpsert {
  columns: string[];
  values: unknown[];
  /** `col=excluded.col` assignments for the columns that may be refreshed. */
  updateSet: string[];
  hasUpdatedAt: boolean;
}

/**
 * Build an upsert against only the columns that actually exist in the target
 * database.
 *
 * WHY THIS IS NOT OVER-ENGINEERING — found by running this seed against a real
 * Postgres rather than a mocked one. The Finance tables have accumulated columns
 * across several migrations (`document_class`, `extraction_strategy`,
 * `template_family`, `readiness_status`, `readiness_score`, `quality_summary`,
 * `quality_reason_codes`, `values_version` all arrived later than the base
 * table), and migration `20260628_finance_seed_readiness_fix.sql` exists
 * precisely because the demo environment had drifted on exactly these columns.
 *
 * WHY THE EMPTY-SET FALLBACK CANNOT MASK A REAL MISSING COLUMN. An empty column
 * set means the schema probe answered nothing, and we then write EVERY column.
 * In production that lands one of two ways, both safe:
 *   - the columns do exist -> the write is correct;
 *   - a column is genuinely absent -> the INSERT is issued with
 *     `{ fallback: false }` and Postgres rejects it, so the seed reports
 *     INCOMPLETE instead of quietly writing a half-row.
 * On top of that, phase 2 SELECTs the readiness columns back by name, so a
 * missing column also fails the read-back gate. Nothing reaches READY on a
 * schema we could not verify.
 */
function projectUpsert(
  columns: Set<string>,
  pairs: ColumnValue[],
  options: { updatable: string[] }
): ProjectedUpsert {
  const known = columns.size > 0 ? columns : null;
  const selected = pairs.filter(([column]) => !known || known.has(column.toLowerCase()));
  const selectedNames = new Set(selected.map(([column]) => column.toLowerCase()));
  const updateSet = options.updatable
    .filter((column) => selectedNames.has(column.toLowerCase()))
    .map((column) => `${column}=excluded.${column}`);

  return {
    columns: selected.map(([column]) => column),
    values: selected.map(([, value]) => value),
    updateSet,
    hasUpdatedAt: !known || known.has('updated_at'),
  };
}

/**
 * SQL for an upsert that is a TRUE no-op when nothing changed.
 *
 * FIN-005 P2: the previous version always ran `updated_at=CURRENT_TIMESTAMP`, so
 * a second seed run mutated every row even though every value was identical.
 * Guarding the whole `DO UPDATE` with
 * `<table>.col IS DISTINCT FROM excluded.col OR ...` means run #2 performs ZERO
 * row updates on an unchanged fixture. `updated_at` stays inside the SET, so a
 * row that really did change still gets a fresh timestamp.
 *
 * `IS DISTINCT FROM` (not `<>`) because NULL <> NULL is NULL, which would make
 * a nullable column look "changed" forever.
 */
function buildUpsertSql(table: string, upsert: ProjectedUpsert): string {
  const columnList = upsert.columns.join(', ');
  const valueList = upsert.columns.map(() => '?').join(', ');

  if (upsert.updateSet.length === 0) {
    // Nothing may ever be refreshed on this row, so a re-run must not touch it.
    return `INSERT INTO ${table} (${columnList}) VALUES (${valueList}) ON CONFLICT(id) DO NOTHING`;
  }

  const setClause = [
    ...upsert.updateSet,
    ...(upsert.hasUpdatedAt ? ['updated_at=CURRENT_TIMESTAMP'] : []),
  ].join(',\n       ');
  const guard = upsert.updateSet
    .map((assignment) => assignment.split('=')[0])
    .map((column) => `${table}.${column} IS DISTINCT FROM excluded.${column}`)
    .join('\n       OR ');

  return `INSERT INTO ${table} (${columnList})
     VALUES (${valueList})
     ON CONFLICT(id) DO UPDATE SET
       ${setClause}
     WHERE ${guard}`;
}

/**
 * Phase-2 promotion write: an UPDATE that only fires when at least one target
 * column really differs, so a second run is a no-op here too.
 */
async function promoteRow(params: {
  table: string;
  id: string;
  columns: Set<string>;
  assignments: ColumnValue[];
  /**
   * Columns set to a SQL literal (e.g. `approved_at=CURRENT_TIMESTAMP`). They
   * are NOT part of the guard, so they are stamped exactly once — on the run
   * that actually promotes the row — and never refreshed by a no-op re-run.
   */
  literals?: Array<[column: string, literal: string]>;
}): Promise<void> {
  const known = params.columns.size > 0 ? params.columns : null;
  const applicable = params.assignments.filter(
    ([column]) => !known || known.has(column.toLowerCase())
  );
  if (applicable.length === 0) return;
  const applicableLiterals = (params.literals ?? []).filter(
    ([column]) => !known || known.has(column.toLowerCase())
  );

  const hasUpdatedAt = !known || known.has('updated_at');
  const setClause = [
    ...applicable.map(([column]) => `${column}=?`),
    ...applicableLiterals.map(([column, literal]) => `${column}=${literal}`),
    ...(hasUpdatedAt ? ['updated_at=CURRENT_TIMESTAMP'] : []),
  ].join(', ');
  const guard = applicable
    .map(([column]) => `${column} IS DISTINCT FROM ?`)
    .join(' OR ');

  await DbPromise.run(
    `UPDATE ${params.table}
        SET ${setClause}
      WHERE id = ?
        AND (${guard})`,
    [...applicable.map(([, value]) => value), params.id, ...applicable.map(([, value]) => value)],
    { fallback: false }
  );
}

// ---------------------------------------------------------------------------
// Public contract
// ---------------------------------------------------------------------------

export interface AtelierFinanceSeedInput {
  organizationId: string;
  /** Owner recorded on every row (CFO persona when available). */
  createdBy?: string | null;
  projectId?: string | null;
  locale?: DemoLocale;
}

/**
 * Explicit, discriminated outcome — FIN-005 P1.
 *
 * `complete` means: pack + 3 statements + approved analysis exist, every
 * statement was read back and independently judged READY by the production
 * readiness code, and the pack was promoted. Anything less is `incomplete` and
 * says why. There is no third, silent state.
 */
export interface AtelierFinanceSeedResult {
  status: 'complete' | 'incomplete';
  /** Human-readable cause; present exactly when `status === 'incomplete'`. */
  reason?: string;
  /** Missing tables / `table.column` entries, when the cause is schema drift. */
  missing?: string[];
  /** Null when the Finance statement tables are absent in this environment. */
  packId: string | null;
  /** Statements that EARNED ready through the read-back gate. */
  statementIds: string[];
  /** Statements written but refused promotion (read-back or verdict failed). */
  unpromotedStatementIds: string[];
  analysisId: string | null;
}

const SOURCE_FILE_NAME = 'Atelier-Toys-FY2014-Financial-Statements.xlsx';

/** Phase-1 (not-ready) statement state — the honest state of a fresh import. */
const PHASE1_STATEMENT_STATUS = 'imported';
const PHASE1_VALIDATION_STATUS = 'pending';
const PHASE1_READINESS_STATUS = 'pending';
const PHASE1_READINESS_SCORE = 0;

/** Phase-1 (not-ready) pack state. */
const PHASE1_PACK_STATUS = 'draft';
const PHASE1_PACK_READINESS_STATUS = 'pending';
const PHASE1_PACK_READINESS_SCORE = 0;

function incomplete(
  reason: string,
  partial: Partial<AtelierFinanceSeedResult> = {}
): AtelierFinanceSeedResult {
  const result: AtelierFinanceSeedResult = {
    status: 'incomplete',
    reason,
    packId: null,
    statementIds: [],
    unpromotedStatementIds: [],
    analysisId: null,
    ...partial,
  };
  logger.warn('[atelier-finance-seed] Finance golden flow INCOMPLETE — nothing promoted to READY', {
    reason,
    missing: result.missing,
    packId: result.packId,
    promotedStatements: result.statementIds,
    unpromotedStatements: result.unpromotedStatementIds,
  });
  return result;
}

// ---------------------------------------------------------------------------
// Phase 2 — read-back verification
// ---------------------------------------------------------------------------

interface StatementReadBackRow {
  id?: unknown;
  organization_id?: unknown;
  statement_pack_id?: unknown;
  statement_type?: unknown;
  currency?: unknown;
  scaling?: unknown;
  status?: unknown;
}

interface StatementValueRow {
  id?: unknown;
  canonical_line_id?: unknown;
  value?: unknown;
  is_non_financial?: unknown;
}

interface StatementVerdict {
  ok: boolean;
  reason?: string;
  currency?: string;
  validationStatus?: 'pass' | 'warnings' | 'needs_review';
  validationMessages?: ValidationMessage[];
  readinessStatus?: string;
  readinessScore?: number;
  reasonCodes?: string[];
}

/**
 * Read one statement and its values back OUT of the database and decide, using
 * production code only, whether it may be called READY.
 *
 * Everything here is deliberately about the persisted rows, not the in-memory
 * fixture: a fixture that is perfect in memory and truncated on disk is exactly
 * the failure this gate exists to catch.
 */
async function verifyStatementReadBack(params: {
  organizationId: string;
  packId: string;
  statementId: string;
  statementType: string;
  expectedValueCount: number;
  statementColumns: Set<string>;
  valueColumns: Set<string>;
}): Promise<StatementVerdict> {
  const valueColumnNames = ['id', 'canonical_line_id', 'value', 'is_non_financial'].filter(
    (column) => params.valueColumns.size === 0 || params.valueColumns.has(column)
  );

  let statementRows: StatementReadBackRow[];
  let valueRows: StatementValueRow[];
  try {
    statementRows = await DbPromise.all<StatementReadBackRow>(
      `SELECT id, organization_id, statement_pack_id, statement_type, currency, scaling, status
         FROM financial_statements
        WHERE id = ?`,
      [params.statementId],
      { fallback: false }
    );
    valueRows = await DbPromise.all<StatementValueRow>(
      `SELECT ${valueColumnNames.join(', ')}
         FROM financial_statement_values
        WHERE statement_id = ?`,
      [params.statementId],
      { fallback: false }
    );
  } catch (error) {
    return { ok: false, reason: `read-back query failed: ${(error as Error).message}` };
  }

  if (statementRows.length !== 1) {
    return { ok: false, reason: `read-back returned ${statementRows.length} statement rows, expected 1` };
  }
  const row = statementRows[0];

  // Lineage — the row must belong to the caller's tenant and to THIS pack.
  if (String(row.organization_id ?? '') !== params.organizationId) {
    return {
      ok: false,
      reason: `organization_id mismatch: ${String(row.organization_id ?? 'null')} != ${params.organizationId}`,
    };
  }
  if (String(row.statement_pack_id ?? '') !== params.packId) {
    return {
      ok: false,
      reason: `statement_pack_id mismatch: ${String(row.statement_pack_id ?? 'null')} != ${params.packId}`,
    };
  }
  if (String(row.statement_type ?? '') !== params.statementType) {
    return {
      ok: false,
      reason: `statement_type mismatch: ${String(row.statement_type ?? 'null')} != ${params.statementType}`,
    };
  }

  // Single resolved currency, matching the canonical fixture.
  const currency = String(row.currency ?? '').trim().toUpperCase();
  if (currency !== ATELIER_FINANCE_CURRENCY) {
    return { ok: false, reason: `currency mismatch: ${currency || 'null'} != ${ATELIER_FINANCE_CURRENCY}` };
  }

  // Exact expected value count — a truncated write must never read as READY.
  if (valueRows.length !== params.expectedValueCount) {
    return {
      ok: false,
      reason: `read-back found ${valueRows.length} values, expected ${params.expectedValueCount}`,
    };
  }

  // 100% canonical mapping coverage, verified on the persisted rows.
  const unmapped = valueRows.filter((value) => !String(value.canonical_line_id ?? '').trim());
  if (unmapped.length > 0) {
    return { ok: false, reason: `${unmapped.length} persisted value(s) carry a null canonical_line_id` };
  }

  // Recompute the verdict with PRODUCTION code against the READ-BACK rows.
  const lines = valueRows.map((value) => ({
    canonicalLineId: String(value.canonical_line_id),
    value: Number(value.value ?? 0),
    isNonFinancial: Boolean(value.is_non_financial),
  }));
  const validation = validateStatement(lines, params.statementType);
  const readiness = evaluateStatementReadiness({
    // The status we are ABOUT to persist — the stored verdict must correspond to
    // the stored status, not to the intermediate one.
    rawStatus: 'confirmed',
    statementType: params.statementType,
    validationStatus: validation.status,
    currency,
    scaling: String(row.scaling ?? '').trim() || ATELIER_FINANCE_SCALING,
    validationMessages: validation.messages,
    values: lines,
  });

  if (validation.status !== 'pass') {
    return {
      ok: false,
      reason: `production validateStatement returned "${validation.status}": ${validation.messages
        .filter((message) => message.type !== 'info')
        .map((message) => message.code)
        .join(', ')}`,
    };
  }
  if (!readiness.isReady || readiness.readinessStatus !== 'ready') {
    return {
      ok: false,
      reason: `production evaluateStatementReadiness returned "${readiness.readinessStatus}" (${readiness.reasonCodes.join(', ') || 'no reason codes'})`,
    };
  }

  return {
    ok: true,
    currency,
    validationStatus: validation.status,
    validationMessages: validation.messages,
    readinessStatus: readiness.readinessStatus,
    readinessScore: readiness.readinessScore,
    reasonCodes: readiness.reasonCodes,
  };
}

// ---------------------------------------------------------------------------
// Seed entry point
// ---------------------------------------------------------------------------

/**
 * Materialize the Atelier Toys FY2014 statement pack, the three statements, the
 * values and the approved analysis grounded on them — in two phases, so READY is
 * earned by a real write plus a real read-back and never asserted up front.
 *
 * Returns the pack id so the caller can bind the canonical ROI model to the same
 * source (`financial_models.source_statement_pack_id`).
 *
 * Safe to call on a tenant that already has the fixture: every write is an
 * upsert on a stable id, guarded so an unchanged re-run updates zero rows.
 */
export async function upsertAtelierFinanceGoldenFlow(
  input: AtelierFinanceSeedInput
): Promise<AtelierFinanceSeedResult> {
  const { organizationId } = input;
  const isPl = input.locale === 'pl';
  const createdBy = input.createdBy || null;

  // ---- Schema gate -------------------------------------------------------
  const schema = await probeAtelierFinanceSchema();
  if (schema.missing.length > 0) {
    return incomplete(
      `Finance schema is missing required tables/columns: ${schema.missing.join(', ')}`,
      { missing: schema.missing }
    );
  }
  if (schema.unverified.length > 0) {
    // Not fatal (see projectUpsert): the write itself runs with fallback:false
    // and the phase-2 read-back names every readiness column, so an actually
    // missing column still fails closed instead of producing a false READY.
    logger.warn('[atelier-finance-seed] schema introspection unavailable; relying on write+read-back gates', {
      tables: schema.unverified,
    });
  }

  // Guard the numbers before writing any of them.
  assertAtelierFy2014Coherent();

  // The canonical line rows are the FK target of every statement value. This is
  // the same idempotent sync the Finance routes run on entry.
  await ensureCanonicalRegistryInDatabase();

  const packColumns = schema.columns.financial_statement_packs;
  const statementColumns = schema.columns.financial_statements;
  const valueColumns = schema.columns.financial_statement_values;
  const analysisColumns = schema.columns.financial_analyses;
  const packId = makeId(organizationId, 'statement-pack', ATELIER_FINANCE_SLUGS.pack);

  // ---- Phase 1: write the fixture in a NOT-ready state --------------------
  // Every value is a bound parameter (no inline SQL literals) so that column
  // position and parameter position stay 1:1 — the demo test harnesses parse
  // captured INSERTs positionally, and an inline literal would silently
  // misalign the row they assert on.
  const packUpsert = projectUpsert(
    packColumns,
    [
      ['id', packId],
      ['organization_id', organizationId],
      ['entity_name', ATELIER_FINANCE_ENTITY_NAME],
      ['period_start', ATELIER_FINANCE_PERIOD_START],
      ['period_end', ATELIER_FINANCE_PERIOD_END],
      ['period_label', ATELIER_FINANCE_PERIOD_LABEL],
      ['currency', ATELIER_FINANCE_CURRENCY],
      ['scaling', ATELIER_FINANCE_SCALING],
      ['pack_status', PHASE1_PACK_STATUS],
      ['pack_readiness_status', PHASE1_PACK_READINESS_STATUS],
      ['pack_readiness_score', PHASE1_PACK_READINESS_SCORE],
      [
        'pack_quality_summary',
        isPl
          ? 'Import FY2014 zapisany — oczekuje na weryfikację odczytem.'
          : 'FY2014 import written — awaiting read-back verification.',
      ],
      ['pack_quality_reason_codes', JSON.stringify(['READ_BACK_PENDING'])],
      ['source_statement_count', 0],
      ['missing_statement_types', JSON.stringify(['P&L', 'BS', 'CF'])],
      [
        'metadata_json',
        JSON.stringify({ canonicalFixture: 'atelier-toys-fy2014', seededBy: 'atelierFinanceSeed' }),
      ],
    ],
    {
      // NOTE the omissions: `pack_status`, `pack_readiness_*`, the quality
      // columns and the statement counters are NOT updatable here. They are
      // written once at INSERT time in their not-ready form and afterwards only
      // ever set by the phase-2 promotion. That is what stops a re-run from
      // first DOWNGRADING a healthy fixture and then re-promoting it.
      updatable: [
        'entity_name',
        'period_start',
        'period_end',
        'period_label',
        'currency',
        'scaling',
        'metadata_json',
      ],
    }
  );

  try {
    await DbPromise.run(buildUpsertSql('financial_statement_packs', packUpsert), packUpsert.values, {
      fallback: false,
    });
  } catch (error) {
    return incomplete(`pack write failed: ${(error as Error).message}`);
  }

  const hasIngestRuns = await tableExists('financial_statement_ingest_runs');
  const ingestRunColumns = hasIngestRuns
    ? await getTableColumns('financial_statement_ingest_runs')
    : new Set<string>();

  const writtenStatementIds: string[] = [];
  for (const statement of ATELIER_FY2014_STATEMENTS) {
    const statementId = makeId(organizationId, 'statement', statement.slug);

    const statementUpsert = projectUpsert(
      statementColumns,
      [
        ['id', statementId],
        ['organization_id', organizationId],
        ['statement_pack_id', packId],
        ['entity_name', ATELIER_FINANCE_ENTITY_NAME],
        ['statement_type', statement.statementType],
        ['period_start', ATELIER_FINANCE_PERIOD_START],
        ['period_end', ATELIER_FINANCE_PERIOD_END],
        ['period_label', ATELIER_FINANCE_PERIOD_LABEL],
        ['currency', ATELIER_FINANCE_CURRENCY],
        ['scaling', ATELIER_FINANCE_SCALING],
        ['source_file_name', SOURCE_FILE_NAME],
        ['source_file_path', `seed://atelier-toys/${SOURCE_FILE_NAME}`],
        ['parse_method', 'manual'],
        ['overall_confidence', 0.99],
        ['document_class', 'spreadsheet'],
        ['extraction_strategy', 'atelier_demo_seed'],
        ['template_family', 'atelier_fy2014'],
        ['status', PHASE1_STATEMENT_STATUS],
        ['validation_status', PHASE1_VALIDATION_STATUS],
        ['validation_messages', '[]'],
        ['readiness_status', PHASE1_READINESS_STATUS],
        ['readiness_score', PHASE1_READINESS_SCORE],
        [
          'quality_summary',
          isPl
            ? 'Sprawozdanie zapisane — gotowość ustalana przez odczyt zwrotny.'
            : 'Statement written — readiness is decided by the read-back gate.',
        ],
        ['quality_reason_codes', JSON.stringify(['READ_BACK_PENDING'])],
        ['values_version', 1],
        [
          'notes',
          isPl
            ? 'Kanoniczne dane demo Atelier Toys (FY2014).'
            : 'Canonical Atelier Toys demo data (FY2014).',
        ],
        ['created_by', createdBy],
      ],
      {
        // `status`, `validation_*`, `readiness_*`, `quality_*` and `confirmed_by`
        // are promotion-owned — see the pack note above.
        updatable: [
          'statement_pack_id',
          'entity_name',
          'period_start',
          'period_end',
          'period_label',
          'currency',
          'scaling',
          'source_file_name',
          'source_file_path',
          'notes',
        ],
      }
    );

    try {
      await DbPromise.run(buildUpsertSql('financial_statements', statementUpsert), statementUpsert.values, {
        fallback: false,
      });
    } catch (error) {
      return incomplete(`statement ${statement.statementType} write failed: ${(error as Error).message}`, {
        packId,
        unpromotedStatementIds: [...writtenStatementIds, statementId],
      });
    }
    writtenStatementIds.push(statementId);

    if (hasIngestRuns) {
      // Lineage: the pack shows a completed ingest run rather than a statement
      // that appeared from nowhere.
      const ingestUpsert = projectUpsert(
        ingestRunColumns,
        [
          ['id', makeId(organizationId, 'statement-ingest-run', statement.slug)],
          ['statement_id', statementId],
          ['organization_id', organizationId],
          ['run_status', 'completed'],
          ['current_stage', 'confirm'],
          ['source_file_name', SOURCE_FILE_NAME],
          ['source_file_path', `seed://atelier-toys/${SOURCE_FILE_NAME}`],
          ['parse_method', 'manual'],
          ['document_class', 'spreadsheet'],
          ['extraction_strategy', 'atelier_demo_seed'],
          ['template_family', 'atelier_fy2014'],
          ['raw_text_length', 0],
          [
            'summary_json',
            JSON.stringify({
              canonicalFixture: 'atelier-toys-fy2014',
              statementType: statement.statementType,
              lineCount: statement.lines.length,
            }),
          ],
          ['created_by', createdBy],
        ],
        { updatable: ['run_status', 'current_stage', 'summary_json'] }
      );
      if (ingestUpsert.columns.some((column) => column.toLowerCase() === 'statement_id')) {
        await DbPromise.run(
          buildUpsertSql('financial_statement_ingest_runs', ingestUpsert),
          ingestUpsert.values,
          { fallback: true }
        );
      }
    }

    for (const [index, line] of statement.lines.entries()) {
      const valueUpsert = projectUpsert(
        valueColumns,
        [
          [
            'id',
            makeId(organizationId, 'statement-value', `${statement.slug}--${line.code.toLowerCase()}`),
          ],
          ['statement_id', statementId],
          ['canonical_line_id', line.lineId],
          ['original_label', line.label],
          ['value', line.value],
          ['confidence', 0.99],
          ['source_page', 1],
          ['source_row', index + 1],
          ['mapping_status', 'auto'],
          ['is_non_financial', false],
          ['value_origin', 'mapped'],
          ['mapping_confidence', 0.99],
          ['period_granularity', 'annual'],
          [
            'evidence_json',
            JSON.stringify({
              canonicalFixture: 'atelier-toys-fy2014',
              canonicalCode: line.code,
              periodLabel: ATELIER_FINANCE_PERIOD_LABEL,
              sourceRow: index + 1,
              originalLabel: line.label,
            }),
          ],
        ],
        {
          updatable: [
            'canonical_line_id',
            'original_label',
            'value',
            'confidence',
            'source_row',
            'mapping_status',
            'is_non_financial',
            'value_origin',
            'evidence_json',
          ],
        }
      );

      try {
        await DbPromise.run(
          buildUpsertSql('financial_statement_values', valueUpsert),
          valueUpsert.values,
          { fallback: false }
        );
      } catch (error) {
        return incomplete(
          `value ${statement.statementType}/${line.code} write failed: ${(error as Error).message}`,
          { packId, unpromotedStatementIds: writtenStatementIds }
        );
      }
    }
  }

  // The approved analysis is written (as DRAFT) before promotion, because the
  // pack may only be promoted once the analysis exists AND points at it.
  const analysisId = await upsertAtelierFinanceAnalysis({
    organizationId,
    packId,
    statementIds: writtenStatementIds,
    projectId: input.projectId ?? null,
    createdBy,
    isPl,
    analysisColumns,
  });
  if (!analysisId) {
    return incomplete('approved analysis could not be written; pack stays not-ready', {
      packId,
      unpromotedStatementIds: writtenStatementIds,
    });
  }

  // ---- Phase 2: read back, judge with production code, then promote -------
  const expectedCounts = getAtelierExpectedValueCounts();
  const promoted: string[] = [];
  const refused: Array<{ id: string; reason: string }> = [];

  for (const statement of ATELIER_FY2014_STATEMENTS) {
    const statementId = makeId(organizationId, 'statement', statement.slug);
    const verdict = await verifyStatementReadBack({
      organizationId,
      packId,
      statementId,
      statementType: statement.statementType,
      expectedValueCount: expectedCounts[statement.statementType] ?? statement.lines.length,
      statementColumns,
      valueColumns,
    });

    if (!verdict.ok) {
      refused.push({ id: statementId, reason: `${statement.statementType}: ${verdict.reason}` });
      continue;
    }

    try {
      await promoteRow({
        table: 'financial_statements',
        id: statementId,
        columns: statementColumns,
        assignments: [
          ['status', 'confirmed'],
          ['validation_status', verdict.validationStatus as string],
          ['validation_messages', JSON.stringify(verdict.validationMessages ?? [])],
          ['readiness_status', verdict.readinessStatus as string],
          ['readiness_score', verdict.readinessScore as number],
          [
            'quality_summary',
            isPl
              ? 'Sprawozdanie spełnia kontrakt gotowości (zweryfikowane odczytem zwrotnym).'
              : 'Statement passed the readiness contract (verified by read-back).',
          ],
          ['quality_reason_codes', JSON.stringify(verdict.reasonCodes ?? [])],
          ['confirmed_by', createdBy],
        ],
      });
    } catch (error) {
      refused.push({
        id: statementId,
        reason: `${statement.statementType}: promotion write failed: ${(error as Error).message}`,
      });
      continue;
    }
    promoted.push(statementId);
  }

  if (promoted.length !== ATELIER_FY2014_STATEMENTS.length) {
    return incomplete(
      `only ${promoted.length}/${ATELIER_FY2014_STATEMENTS.length} statements earned READY: ${refused
        .map((entry) => entry.reason)
        .join(' | ')}`,
      {
        packId,
        statementIds: promoted,
        unpromotedStatementIds: refused.map((entry) => entry.id),
        analysisId,
      }
    );
  }

  // The analysis must exist AND point at this pack before either it or the pack
  // may be called approved/ready.
  const analysisVerdict = await verifyAnalysisReadBack({
    organizationId,
    packId,
    analysisId,
    analysisColumns,
  });
  if (!analysisVerdict.ok) {
    return incomplete(`analysis read-back failed: ${analysisVerdict.reason}`, {
      packId,
      statementIds: promoted,
      unpromotedStatementIds: [],
      analysisId,
    });
  }

  try {
    await promoteRow({
      table: 'financial_analyses',
      id: analysisId,
      columns: analysisColumns,
      assignments: [
        ['status', 'APPROVED'],
        ['approved_by', createdBy],
      ],
      literals: [['approved_at', 'CURRENT_TIMESTAMP']],
    });
  } catch (error) {
    return incomplete(`analysis promotion failed: ${(error as Error).message}`, {
      packId,
      statementIds: promoted,
      unpromotedStatementIds: [],
      analysisId,
    });
  }

  // Finally the pack: three promoted statements + one approved analysis bound to
  // it, all in one currency, verified against the persisted pack row.
  const packVerdict = await verifyPackReadBack({ organizationId, packId, packColumns });
  if (!packVerdict.ok) {
    return incomplete(`pack read-back failed: ${packVerdict.reason}`, {
      packId,
      statementIds: promoted,
      unpromotedStatementIds: [],
      analysisId,
    });
  }

  try {
    await promoteRow({
      table: 'financial_statement_packs',
      id: packId,
      columns: packColumns,
      assignments: [
        ['pack_status', 'confirmed'],
        ['pack_readiness_status', 'ready'],
        ['pack_readiness_score', 100],
        [
          'pack_quality_summary',
          isPl
            ? 'Komplet sprawozdań FY2014 (RZiS, bilans, przepływy) — baza dla modelu ROI.'
            : 'Complete FY2014 statement set (P&L, BS, CF) — the baseline the ROI model is grounded on.',
        ],
        ['pack_quality_reason_codes', JSON.stringify([])],
        ['source_statement_count', promoted.length],
        ['missing_statement_types', JSON.stringify([])],
      ],
    });
  } catch (error) {
    return incomplete(`pack promotion failed: ${(error as Error).message}`, {
      packId,
      statementIds: promoted,
      unpromotedStatementIds: [],
      analysisId,
    });
  }

  return {
    status: 'complete',
    packId,
    statementIds: promoted,
    unpromotedStatementIds: [],
    analysisId,
  };
}

async function verifyAnalysisReadBack(params: {
  organizationId: string;
  packId: string;
  analysisId: string;
  analysisColumns: Set<string>;
}): Promise<{ ok: boolean; reason?: string }> {
  let rows: Array<Record<string, unknown>>;
  try {
    rows = await DbPromise.all<Record<string, unknown>>(
      `SELECT id, organization_id, source_statement_pack_id, currency
         FROM financial_analyses
        WHERE id = ?`,
      [params.analysisId],
      { fallback: false }
    );
  } catch (error) {
    return { ok: false, reason: `query failed: ${(error as Error).message}` };
  }

  if (rows.length !== 1) return { ok: false, reason: `expected 1 analysis row, got ${rows.length}` };
  const row = rows[0];
  if (String(row.organization_id ?? '') !== params.organizationId) {
    return { ok: false, reason: `organization_id mismatch: ${String(row.organization_id ?? 'null')}` };
  }
  if (String(row.source_statement_pack_id ?? '') !== params.packId) {
    return {
      ok: false,
      reason: `source_statement_pack_id mismatch: ${String(row.source_statement_pack_id ?? 'null')}`,
    };
  }
  const currency = String(row.currency ?? '').trim().toUpperCase();
  if (currency && currency !== ATELIER_FINANCE_CURRENCY) {
    return { ok: false, reason: `currency mismatch: ${currency} != ${ATELIER_FINANCE_CURRENCY}` };
  }
  return { ok: true };
}

async function verifyPackReadBack(params: {
  organizationId: string;
  packId: string;
  packColumns: Set<string>;
}): Promise<{ ok: boolean; reason?: string }> {
  let packRows: Array<Record<string, unknown>>;
  let statementRows: Array<Record<string, unknown>>;
  try {
    packRows = await DbPromise.all<Record<string, unknown>>(
      `SELECT id, organization_id, entity_name, currency, period_label
         FROM financial_statement_packs
        WHERE id = ?`,
      [params.packId],
      { fallback: false }
    );
    statementRows = await DbPromise.all<Record<string, unknown>>(
      `SELECT id, statement_type, currency, readiness_status
         FROM financial_statements
        WHERE statement_pack_id = ?`,
      [params.packId],
      { fallback: false }
    );
  } catch (error) {
    return { ok: false, reason: `query failed: ${(error as Error).message}` };
  }

  if (packRows.length !== 1) return { ok: false, reason: `expected 1 pack row, got ${packRows.length}` };
  const pack = packRows[0];
  if (String(pack.organization_id ?? '') !== params.organizationId) {
    return { ok: false, reason: `organization_id mismatch: ${String(pack.organization_id ?? 'null')}` };
  }

  const expectedTypes = ATELIER_FY2014_STATEMENTS.map((statement) => statement.statementType).sort();
  const actualTypes = statementRows.map((row) => String(row.statement_type ?? '')).sort();
  if (actualTypes.join('|') !== expectedTypes.join('|')) {
    return { ok: false, reason: `pack holds [${actualTypes.join(', ')}], expected [${expectedTypes.join(', ')}]` };
  }

  const notReady = statementRows.filter((row) => String(row.readiness_status ?? '') !== 'ready');
  if (notReady.length > 0) {
    return { ok: false, reason: `${notReady.length} statement(s) under the pack are not READY` };
  }

  // One single currency across the pack and every statement under it.
  const currencies = new Set(
    [pack, ...statementRows].map((row) => String(row.currency ?? '').trim().toUpperCase())
  );
  if (currencies.size !== 1 || !currencies.has(ATELIER_FINANCE_CURRENCY)) {
    return { ok: false, reason: `pack currency set is [${[...currencies].join(', ')}]` };
  }

  return { ok: true };
}

/**
 * The FY2014 analysis, seeded from the pack above and promoted to APPROVED only
 * after phase 2 confirms it points at that pack.
 *
 * Written to `financial_analyses` — the table the Finance → Analysis tab reads
 * through `listAnalyses()`. (The legacy `digitization_analyses` row written by
 * `upsertAtelierRoiFinancialModel` is a different registry, used by the
 * Initiatives/Results spine for NPV handoff; both are kept, and both now point
 * at the same story.)
 */
async function upsertAtelierFinanceAnalysis(params: {
  organizationId: string;
  packId: string;
  statementIds: string[];
  projectId: string | null;
  createdBy: string | null;
  isPl: boolean;
  analysisColumns: Set<string>;
}): Promise<string | null> {
  const analysisId = makeId(params.organizationId, 'analysis', ATELIER_FINANCE_SLUGS.analysis);
  const { periods, statementData } = buildAtelierAnalysisStatementData();

  const analysisUpsert = projectUpsert(
    params.analysisColumns,
    [
      ['id', analysisId],
      ['organization_id', params.organizationId],
      ['project_id', params.projectId],
      ['title', params.isPl ? ATELIER_ANALYSIS_TITLE_PL : ATELIER_ANALYSIS_TITLE_EN],
      [
        'description',
        params.isPl
          ? 'Analiza bazowa FY2014: rentowność, struktura bilansu i przepływy przed startem programu Atelier Forward.'
          : 'FY2014 baseline: profitability, balance-sheet structure and cash generation before the Atelier Forward program starts.',
      ],
      // DRAFT, not APPROVED: approval is granted in phase 2, once the analysis
      // has been read back and proven to point at the canonical pack.
      ['status', 'DRAFT'],
      ['analysis_type', 'comprehensive'],
      ['periods', JSON.stringify(periods)],
      ['statement_data', JSON.stringify(statementData)],
      ['currency', ATELIER_FINANCE_CURRENCY],
      ['source_statement_ids', JSON.stringify(params.statementIds)],
      ['source_statement_pack_id', params.packId],
      ['created_by', params.createdBy],
    ],
    {
      // `status` and `approved_by` are promotion-owned.
      updatable: [
        'title',
        'description',
        'analysis_type',
        'periods',
        'statement_data',
        'currency',
        'source_statement_ids',
        'source_statement_pack_id',
      ],
    }
  );

  try {
    await DbPromise.run(
      buildUpsertSql('financial_analyses', analysisUpsert),
      analysisUpsert.values,
      // NOT `{ fallback: true }`. `DbPromise.run` swallows the error when fallback
      // is on, so a constraint or jsonb-cast failure here would leave the pack and
      // the model in place with NO analysis — two thirds of the golden flow — and
      // the seed would still report success. The approved analysis is one of the
      // three legs FIN-005 requires; if it cannot be written, the seed must say so.
      { fallback: false }
    );
  } catch (error) {
    logger.warn('[atelier-finance-seed] analysis write failed', { error: (error as Error).message });
    return null;
  }

  return analysisId;
}
