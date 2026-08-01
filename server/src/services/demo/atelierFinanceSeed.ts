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
 * - **Readiness-real.** The statements satisfy the production readiness contract
 *   in `financialStatementService.evaluateStatementReadiness` (status
 *   `confirmed`, validation `pass`, 100% canonical mapping coverage, every
 *   required canonical line present, resolved currency and scaling), so the pack
 *   shows as READY through the same code path a real import would take — not by
 *   a special demo branch.
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
import { ensureCanonicalRegistryInDatabase } from '../financeCanonicalRegistrySyncService.js';
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

type ColumnValue = [column: string, value: unknown];

/**
 * Build an upsert against only the columns that actually exist in the target
 * database.
 *
 * WHY THIS IS NOT OVER-ENGINEERING — found by running this seed against a real
 * Postgres rather than a mocked one. The Finance tables have accumulated
 * columns across several migrations (`document_class`, `extraction_strategy`,
 * `template_family`, `readiness_status`, `readiness_score`, `quality_summary`,
 * `quality_reason_codes`, `values_version` all arrived later than the base
 * table), and migration `20260628_finance_seed_readiness_fix.sql` exists
 * precisely because the demo environment had drifted on exactly these columns.
 *
 * A fixed column list with `{ fallback: false }` therefore risks throwing on a
 * tenant whose schema is one migration behind — and because this seed runs
 * inside `seedAtelierToysDemoDataset`, that single throw would abort the WHOLE
 * Atelier demo dataset, not just Finance. Every neighbouring seeder in
 * `demoSeedService` guards the same way (`columnExists` before adding
 * `initiative_id`); this matches that convention.
 *
 * `required` columns are the ones the row is meaningless without: if any is
 * missing the caller skips the write instead of inserting a half-row.
 */
function projectUpsert(
  columns: Set<string>,
  pairs: ColumnValue[],
  options: { required: string[]; updatable: string[] }
): { columns: string[]; values: unknown[]; updateSet: string[]; missingRequired: string[] } | null {
  // An empty column set means the schema probe failed (or a mocked DB answered
  // nothing). Fall back to writing every column so behaviour is unchanged where
  // introspection is unavailable.
  const known = columns.size > 0 ? columns : null;
  const missingRequired = known
    ? options.required.filter((column) => !known.has(column.toLowerCase()))
    : [];
  if (missingRequired.length > 0) return null;

  const selected = pairs.filter(([column]) => !known || known.has(column.toLowerCase()));
  const selectedNames = new Set(selected.map(([column]) => column.toLowerCase()));
  const updateSet = options.updatable
    .filter((column) => selectedNames.has(column.toLowerCase()))
    .map((column) => `${column}=excluded.${column}`);

  return {
    columns: selected.map(([column]) => column),
    values: selected.map(([, value]) => value),
    updateSet,
    missingRequired,
  };
}

export interface AtelierFinanceSeedInput {
  organizationId: string;
  /** Owner recorded on every row (CFO persona when available). */
  createdBy?: string | null;
  projectId?: string | null;
  locale?: DemoLocale;
}

export interface AtelierFinanceSeedResult {
  /** Null when the Finance statement tables are absent in this environment. */
  packId: string | null;
  statementIds: string[];
  analysisId: string | null;
}

const SOURCE_FILE_NAME = 'Atelier-Toys-FY2014-Financial-Statements.xlsx';

/**
 * Materialize the Atelier Toys FY2014 statement pack and the approved analysis
 * grounded on it. Returns the pack id so the caller can bind the canonical ROI
 * model to the same source (`financial_models.source_statement_pack_id`).
 *
 * Safe to call on a tenant that already has the fixture: every write is an
 * upsert on a stable id.
 */
export async function upsertAtelierFinanceGoldenFlow(
  input: AtelierFinanceSeedInput
): Promise<AtelierFinanceSeedResult> {
  const { organizationId } = input;
  const isPl = input.locale === 'pl';
  const createdBy = input.createdBy || null;
  const empty: AtelierFinanceSeedResult = { packId: null, statementIds: [], analysisId: null };

  // Fail closed on an environment without the Finance schema rather than
  // half-seeding a pack with no statements under it.
  if (!(await tableExists('financial_statement_packs'))) return empty;
  if (!(await tableExists('financial_statements'))) return empty;
  if (!(await tableExists('financial_statement_values'))) return empty;

  // Guard the numbers before writing any of them.
  assertAtelierFy2014Coherent();

  // The canonical line rows are the FK target of every statement value. This is
  // the same idempotent sync the Finance routes run on entry.
  await ensureCanonicalRegistryInDatabase();

  const packId = makeId(organizationId, 'statement-pack', ATELIER_FINANCE_SLUGS.pack);

  // Every value is a bound parameter (no inline SQL literals) so that column
  // position and parameter position stay 1:1 — the demo test harnesses parse
  // captured INSERTs positionally, and an inline literal would silently
  // misalign the row they assert on.
  const packColumns = await getTableColumns('financial_statement_packs');
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
      ['pack_status', 'confirmed'],
      ['pack_readiness_status', 'ready'],
      ['pack_readiness_score', 100],
      [
        'pack_quality_summary',
        isPl
          ? 'Komplet sprawozdań FY2014 (RZiS, bilans, przepływy) — baza dla modelu ROI.'
          : 'Complete FY2014 statement set (P&L, BS, CF) — the baseline the ROI model is grounded on.',
      ],
      ['pack_quality_reason_codes', '[]'],
      ['source_statement_count', 3],
      ['missing_statement_types', '[]'],
      [
        'metadata_json',
        JSON.stringify({ canonicalFixture: 'atelier-toys-fy2014', seededBy: 'atelierFinanceSeed' }),
      ],
    ],
    {
      required: ['id', 'organization_id', 'period_start', 'period_end'],
      updatable: [
        'entity_name',
        'period_start',
        'period_end',
        'period_label',
        'currency',
        'scaling',
        'pack_status',
        'pack_readiness_status',
        'pack_readiness_score',
        'pack_quality_summary',
        'pack_quality_reason_codes',
        'source_statement_count',
        'missing_statement_types',
        'metadata_json',
      ],
    }
  );
  if (!packUpsert) return empty;

  await DbPromise.run(
    `INSERT INTO financial_statement_packs (${packUpsert.columns.join(', ')})
     VALUES (${packUpsert.columns.map(() => '?').join(', ')})
     ON CONFLICT(id) DO UPDATE SET
       ${[...packUpsert.updateSet, 'updated_at=CURRENT_TIMESTAMP'].join(',\n       ')}`,
    packUpsert.values,
    { fallback: false }
  );

  const statementIds: string[] = [];
  const hasIngestRuns = await tableExists('financial_statement_ingest_runs');
  const statementColumns = await getTableColumns('financial_statements');
  const valueColumns = await getTableColumns('financial_statement_values');
  const ingestRunColumns = hasIngestRuns
    ? await getTableColumns('financial_statement_ingest_runs')
    : new Set<string>();

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
        ['status', 'confirmed'],
        ['validation_status', 'pass'],
        ['validation_messages', '[]'],
        ['readiness_status', 'ready'],
        ['readiness_score', 100],
        [
          'quality_summary',
          isPl
            ? 'Sprawozdanie spełnia kontrakt gotowości i jest źródłem dla analizy oraz modelu.'
            : 'Statement passed the readiness contract and is the source for the analysis and the ROI model.',
        ],
        ['quality_reason_codes', '[]'],
        ['values_version', 1],
        [
          'notes',
          isPl
            ? 'Kanoniczne dane demo Atelier Toys (FY2014).'
            : 'Canonical Atelier Toys demo data (FY2014).',
        ],
        ['created_by', createdBy],
        ['confirmed_by', createdBy],
      ],
      {
        required: [
          'id',
          'organization_id',
          'statement_type',
          'period_start',
          'period_end',
          'status',
          'validation_status',
        ],
        updatable: [
          'statement_pack_id',
          'entity_name',
          'period_start',
          'period_end',
          'period_label',
          'currency',
          'scaling',
          'status',
          'validation_status',
          'readiness_status',
          'readiness_score',
          'quality_summary',
          'notes',
        ],
      }
    );
    // A schema without the core statement columns cannot carry the fixture at
    // all; skip rather than write a row the readiness contract would reject.
    if (!statementUpsert) continue;
    statementIds.push(statementId);

    await DbPromise.run(
      `INSERT INTO financial_statements (${statementUpsert.columns.join(', ')})
       VALUES (${statementUpsert.columns.map(() => '?').join(', ')})
       ON CONFLICT(id) DO UPDATE SET
         ${[...statementUpsert.updateSet, 'updated_at=CURRENT_TIMESTAMP'].join(',\n         ')}`,
      statementUpsert.values,
      { fallback: false }
    );

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
        {
          required: ['id', 'statement_id', 'organization_id'],
          updatable: ['run_status', 'current_stage', 'summary_json'],
        }
      );
      if (ingestUpsert) {
        await DbPromise.run(
          `INSERT INTO financial_statement_ingest_runs (${ingestUpsert.columns.join(', ')})
           VALUES (${ingestUpsert.columns.map(() => '?').join(', ')})
           ON CONFLICT(id) DO UPDATE SET
             ${[...ingestUpsert.updateSet, 'updated_at=CURRENT_TIMESTAMP'].join(',\n             ')}`,
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
          required: ['id', 'statement_id', 'canonical_line_id', 'value'],
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
      if (!valueUpsert) continue;

      await DbPromise.run(
        `INSERT INTO financial_statement_values (${valueUpsert.columns.join(', ')})
         VALUES (${valueUpsert.columns.map(() => '?').join(', ')})
         ON CONFLICT(id) DO UPDATE SET
           ${[
             ...valueUpsert.updateSet,
             ...(valueColumns.size === 0 || valueColumns.has('updated_at')
               ? ['updated_at=CURRENT_TIMESTAMP']
               : []),
           ].join(',\n           ')}`,
        valueUpsert.values,
        { fallback: false }
      );
    }
  }

  const analysisId = await upsertAtelierFinanceAnalysis({
    organizationId,
    packId,
    statementIds,
    projectId: input.projectId ?? null,
    createdBy,
    isPl,
  });

  return { packId, statementIds, analysisId };
}

/**
 * The approved FY2014 analysis, seeded from the pack above.
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
}): Promise<string | null> {
  if (!(await tableExists('financial_analyses'))) return null;

  const analysisId = makeId(params.organizationId, 'analysis', ATELIER_FINANCE_SLUGS.analysis);
  const { periods, statementData } = buildAtelierAnalysisStatementData();
  const analysisColumns = await getTableColumns('financial_analyses');

  const analysisUpsert = projectUpsert(
    analysisColumns,
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
      ['status', 'APPROVED'],
      ['analysis_type', 'comprehensive'],
      ['periods', JSON.stringify(periods)],
      ['statement_data', JSON.stringify(statementData)],
      ['currency', ATELIER_FINANCE_CURRENCY],
      ['source_statement_ids', JSON.stringify(params.statementIds)],
      ['source_statement_pack_id', params.packId],
      ['approved_by', params.createdBy],
      ['created_by', params.createdBy],
    ],
    {
      required: ['id', 'organization_id', 'title', 'status'],
      updatable: [
        'title',
        'description',
        'status',
        'analysis_type',
        'periods',
        'statement_data',
        'currency',
        'source_statement_ids',
        'source_statement_pack_id',
      ],
    }
  );
  if (!analysisUpsert) return null;

  const hasApprovedAt = analysisColumns.size === 0 || analysisColumns.has('approved_at');
  await DbPromise.run(
    `INSERT INTO financial_analyses (${analysisUpsert.columns.join(', ')}${
      hasApprovedAt ? ', approved_at' : ''
    })
     VALUES (${analysisUpsert.columns.map(() => '?').join(', ')}${
       hasApprovedAt ? ', CURRENT_TIMESTAMP' : ''
     })
     ON CONFLICT(id) DO UPDATE SET
       ${[...analysisUpsert.updateSet, 'updated_at=CURRENT_TIMESTAMP'].join(',\n       ')}`,
    analysisUpsert.values,
    // NOT `{ fallback: true }`. `DbPromise.run` swallows the error when fallback
    // is on, so a constraint or jsonb-cast failure here would leave the pack and
    // the model in place with NO analysis — two thirds of the golden flow — and
    // the seed would still report success. The approved analysis is one of the
    // three legs FIN-005 requires; if it cannot be written, the seed must say so.
    // Environments without the table are already handled by `tableExists` above.
    { fallback: false }
  );

  return analysisId;
}
