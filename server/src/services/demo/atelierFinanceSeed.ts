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
 * - **ATOMIC.** All five promotions (3 statements + analysis + pack) happen in
 *   ONE pinned PostgreSQL transaction — `atelierFinancePromotionTransaction.ts`
 *   holds a single `pg` client for `BEGIN`, `SELECT … FOR UPDATE` on the
 *   canonical rows, the re-run of the production verdict over those locked rows,
 *   the five UPDATEs, a pre-COMMIT read-back and `COMMIT`. Any failure, up to
 *   and including the backend being killed, rolls the whole thing back; there is
 *   no half-promoted state to repair. Where a pinned connection cannot exist
 *   (mocked in-memory database in tests, non-pg driver) the seed falls back to
 *   verify-then-promote plus a compensating rollback and SAYS SO in the log —
 *   at `error` level in production. That fallback is reachable ONLY when the
 *   live database itself fails to answer a PostgreSQL probe: no environment
 *   variable (`MOCK_DB`, `DB_TYPE`, `NODE_ENV`) can open it. Phase 0 (self-heal
 *   of a crash-damaged fixture) and the compensating rollback both stay in place
 *   as defence-in-depth under either path.
 * - **AN IN-DOUBT COMMIT STOPS THE LINE.** When a COMMIT's answer is lost and
 *   reconciliation cannot classify the outcome, the verdict is written to disk
 *   as an OPERATOR HOLD and every later run for that tenant REFUSES — no heal,
 *   no rewrite, no promotion — until a human acknowledges it. See the OPERATOR
 *   HOLD section. Without that, phase 0 of the next run would demote the
 *   residue, re-promote and report `complete`, erasing the only evidence there
 *   was.
 * - **A LOST COMMIT ACK IS CLASSIFIED ON WHOLE ROWS.** The pre-transaction state
 *   of all five rows is snapshotted inside the pinned transaction, under the
 *   `FOR UPDATE` locks; the reconciliation reports `committed` only on an exact
 *   match to the state the writes intended, `not-committed` only on an exact
 *   match to that snapshot, and INDETERMINATE for anything else. See the
 *   PRE-STATE / POST-STATE section.
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

import crypto from 'crypto';

import * as DbPromise from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';
import { ensureCanonicalRegistryInDatabase } from '../financeCanonicalRegistrySyncService.js';
import { appraiseComputeResult, type ModelAppraisal } from '../financialModelAppraisalAdapter.js';
import { computeModel, getModel } from '../financialModelingService.js';
import {
  evaluateStatementReadiness,
  validateStatement,
  type ValidationMessage,
} from '../financialStatementService.js';
import {
  acknowledgementInstruction,
  atelierFinanceOperatorHoldDir,
  atelierFinanceOperatorHoldPath,
  type AtelierFinancePromotionMarker,
  atelierFinancePromotionMarkerPath,
  digestPromotionState,
  promotionMarkerBlocks,
  proveDurableStorage,
  readAtelierFinanceOperatorHold,
  readAtelierFinancePromotionMarker,
  removeOwnPromotionMarker,
  writeAtelierFinanceOperatorHold,
  writeAtelierFinancePromotionMarker,
} from './atelierFinanceOperatorHold.js';
import {
  type DecisiveReadSession,
  openDecisiveReadSession,
  runPinnedPromotionTransaction,
} from './atelierFinancePromotionTransaction.js';
import type { DemoLocale } from './demoLocale.js';

// The operator-record surface moved to `atelierFinanceOperatorHold.ts` when it
// grew the durability proof and the promotion marker (FIN-005 P1-B). Re-exported
// here because runbooks, scripts and suites reach for it through the seed.
export {
  acknowledgeAtelierFinanceCommitIndeterminate,
  atelierFinanceAcknowledgementPath,
  type AtelierFinanceOperatorHold,
  atelierFinanceOperatorHoldDir,
  atelierFinanceOperatorHoldPath,
  type AtelierFinancePromotionMarker,
  atelierFinancePromotionMarkerPath,
  type DurabilityProof,
  type DurableStorageVerdict,
  type OperatorAcknowledgement,
  promotionMarkerBlocks,
  type PromotionMarkerState,
  proveDurableStorage,
  readAtelierFinanceOperatorHold,
  readAtelierFinancePromotionMarker,
  requireDurableOperatorHoldStorage,
} from './atelierFinanceOperatorHold.js';

// ---------------------------------------------------------------------------
// Canonical identity of the Atelier Finance fixture
// ---------------------------------------------------------------------------

export const ATELIER_FINANCE_ENTITY_NAME = 'Atelier Toys';
export const ATELIER_FINANCE_CURRENCY = 'EUR';
/**
 * FIN-005 round 8: matches the `discount_rate` value already seeded into the
 * legacy `analysis_financials` row for this same initiative
 * (`upsertAtelierRoiFinancialModel`, demoSeedService.ts) — reused, not
 * invented. `investmentAppraisalService`'s own invariant ("never hardcoded")
 * still holds: this constant is a CALLER's choice of parameter for the
 * Atelier fixture specifically, not a default baked into the appraisal
 * engine or its route.
 *
 * FIN-005 round 9: this constant is now only the SEED value. The canonical,
 * explicit, testable RUNTIME source is `financial_models.assumptions_json`
 * (`{ discountRatePct, hurdleRatePct }`), written from this constant by
 * `upsertAtelierRoiFinancialModel()` and read back by
 * `resolveAtelierAppraisalRates()` below — not this constant directly.
 *
 * FIN-005 round 10 (Codex fix): round 9 also used this constant as a
 * fallback INSIDE the golden-flow acceptance path, which let
 * `verifyAtelierFinanceGoldenFlowComplete()` return `goldenFlowComplete: true`
 * even when `assumptions_json` carried no genuine explicit rate — silently
 * defeating the "never hardcoded" invariant at the one place it matters most,
 * the completeness verdict. `resolveAtelierAppraisalRates()` no longer falls
 * back to this constant at all: a missing/invalid rate is now a refusal
 * (`goldenFlowComplete: false`), matching `GET /models/:modelId/appraisal`'s
 * own "explicit rate or 400" contract. This constant is ONLY the value the
 * seed writes into `assumptions_json` the first time — it has no role in
 * acceptance anymore.
 */
export const ATELIER_CANONICAL_DISCOUNT_RATE_PCT = 10;
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
  {
    statementType: 'P&L' as const,
    slug: ATELIER_FINANCE_SLUGS.statementPl,
    lines: ATELIER_FY2014_PL,
  },
  {
    statementType: 'BS' as const,
    slug: ATELIER_FINANCE_SLUGS.statementBs,
    lines: ATELIER_FY2014_BS,
  },
  {
    statementType: 'CF' as const,
    slug: ATELIER_FINANCE_SLUGS.statementCf,
    lines: ATELIER_FY2014_CF,
  },
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

/**
 * FIN-005 P1-A. Both introspection reads take the DECISIVE reader, not
 * `DbPromise`. They are not idle curiosity: `probeAtelierFinanceSchema` decides
 * whether the run is `incomplete`, and the column sets it returns decide which
 * columns every later upsert, promotion, demotion and read-back names. A schema
 * read served by a lagging replica — a replica that has not yet replayed a
 * migration is the ordinary case, not an exotic one — silently narrows the
 * fixture the seed writes and the fixture it verifies.
 */
async function tableExists(read: SqlReader, tableName: string): Promise<boolean> {
  try {
    const rows = await read(
      `SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = ?
      ) AS exists`,
      [tableName]
    );
    return Boolean(rows[0]?.exists);
  } catch {
    return false;
  }
}

async function getTableColumns(read: SqlReader, tableName: string): Promise<Set<string>> {
  try {
    const rows = await read(
      `SELECT LOWER(column_name) AS column_name
       FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = ?`,
      [tableName]
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
  financial_analyses: ['id', 'organization_id', 'title', 'status', 'source_statement_pack_id'],
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

async function probeAtelierFinanceSchema(read: SqlReader): Promise<SchemaProbe> {
  const columns: Record<string, Set<string>> = {};
  const missing: string[] = [];
  const unverified: string[] = [];

  for (const [table, required] of Object.entries(REQUIRED_SCHEMA)) {
    if (!(await tableExists(read, table))) {
      columns[table] = new Set<string>();
      missing.push(table);
      continue;
    }
    const tableColumns = await getTableColumns(read, table);
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

interface PromotionRowSpec {
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
}

/**
 * Build the phase-2 promotion write: an UPDATE that only fires when at least
 * one target column really differs, so a second run is a no-op here too.
 *
 * SPLIT OUT FROM `promoteRow` so the SAME statement can be executed either
 * through `DbPromise` (the compensating fallback path) or on the pinned
 * transaction client (`atelierFinancePromotionTransaction.ts`). One builder =
 * the two paths cannot drift apart.
 */
function buildPromotionUpdate(params: PromotionRowSpec): { sql: string; params: unknown[] } {
  const known = params.columns.size > 0 ? params.columns : null;
  const applicable = params.assignments.filter(
    ([column]) => !known || known.has(column.toLowerCase())
  );
  // FAIL LOUDLY. Returning here would report a promotion (or a demotion) that
  // was never written — the ledger would record success and the seed could
  // return `complete` over a row nothing ever touched. `REQUIRED_SCHEMA`
  // mandates every load-bearing column, so this is unreachable today; it stays
  // as a throw so a future schema change cannot turn it into a silent lie.
  if (applicable.length === 0) {
    throw new Error(
      `no writable column on ${params.table} for [${params.assignments
        .map(([column]) => column)
        .join(', ')}] — refusing to report a write that cannot happen`
    );
  }
  const applicableLiterals = (params.literals ?? []).filter(
    ([column]) => !known || known.has(column.toLowerCase())
  );

  const hasUpdatedAt = !known || known.has('updated_at');
  const setClause = [
    ...applicable.map(([column]) => `${column}=?`),
    ...applicableLiterals.map(([column, literal]) => `${column}=${literal}`),
    ...(hasUpdatedAt ? ['updated_at=CURRENT_TIMESTAMP'] : []),
  ].join(', ');
  const guard = applicable.map(([column]) => `${column} IS DISTINCT FROM ?`).join(' OR ');

  return {
    sql: `UPDATE ${params.table}
        SET ${setClause}
      WHERE id = ?
        AND (${guard})`,
    params: [
      ...applicable.map(([, value]) => value),
      params.id,
      ...applicable.map(([, value]) => value),
    ],
  };
}

/** Execute a promotion write through `DbPromise` (autocommit, no transaction). */
async function promoteRow(spec: PromotionRowSpec): Promise<void> {
  const update = buildPromotionUpdate(spec);
  await DbPromise.run(update.sql, update.params, { fallback: false });
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
  /**
   * The operator run id, recorded in the PROMOTION_IN_PROGRESS marker so a
   * marker found by a LATER run can be traced back to the run that wrote it —
   * and so that later run is structurally unable to remove it (FIN-005 P1-B).
   * The CLI passes its own; anything else gets a generated one.
   */
  runId?: string;
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
  /**
   * What the promotion phase actually did. On `incomplete` this is the evidence
   * behind the log line; on `complete` it records the three-plus-two promotions
   * that landed. Optional so older callers keep compiling.
   */
  promotion?: AtelierPromotionLedger;
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

/** Phase-1 quality payloads, shared by the phase-1 write and the rollback, so a
 *  demoted row is byte-identical to a freshly written one. */
const PHASE1_QUALITY_REASON_CODES = JSON.stringify(['READ_BACK_PENDING']);
const PHASE1_MISSING_STATEMENT_TYPES = JSON.stringify(
  ATELIER_FY2014_STATEMENTS.map((statement) => statement.statementType)
);

function phase1StatementQualitySummary(isPl: boolean): string {
  return isPl
    ? 'Sprawozdanie zapisane — gotowość ustalana przez odczyt zwrotny.'
    : 'Statement written — readiness is decided by the read-back gate.';
}

function phase1PackQualitySummary(isPl: boolean): string {
  return isPl
    ? 'Import FY2014 zapisany — oczekuje na weryfikację odczytem.'
    : 'FY2014 import written — awaiting read-back verification.';
}

/**
 * Exactly what the promotion phase DID — never what we hope it did.
 *
 * Every field is set from an operation that actually returned, so the log line
 * built from this ledger asserts nothing that was not observed. `rolledBack`
 * plus an empty `rollbackErrors`/`rowsStillClaimingReady` is only ever reported
 * after the demoted rows were RE-READ out of the database.
 */
export interface AtelierPromotionLedger {
  /**
   * Statement promotion UPDATEs that completed without throwing.
   *
   * A LOWER BOUND on what reached the database, never an upper one: a write can
   * land and still reject (connection reset after the UPDATE applied). Never
   * use these counters to decide which rows need undoing — the rollback treats
   * every planned row as in doubt for exactly this reason.
   */
  statementPromotionsIssued: number;
  analysisPromotionIssued: boolean;
  packPromotionIssued: boolean;
  /** True once a compensating rollback was attempted. */
  rolledBack: boolean;
  /** Errors thrown by the compensating rollback itself. */
  rollbackErrors: string[];
  /** Ids that STILL claim ready/confirmed/pass/APPROVED after the rollback. */
  rowsStillClaimingReady: string[];
}

function newPromotionLedger(): AtelierPromotionLedger {
  return {
    statementPromotionsIssued: 0,
    analysisPromotionIssued: false,
    packPromotionIssued: false,
    rolledBack: false,
    rollbackErrors: [],
    rowsStillClaimingReady: [],
  };
}

/**
 * The one-line truth about the promotion phase.
 *
 * FIN-005 defect #2: the old logger hard-coded "nothing promoted to READY",
 * which was a lie whenever promotion had already started. This states the
 * counts it observed and distinguishes the three real cases: nothing issued /
 * issued-and-reverted / issued-and-rollback-did-not-complete.
 */
function describePromotionLedger(ledger: AtelierPromotionLedger): string {
  const issued =
    `issued ${ledger.statementPromotionsIssued}/${ATELIER_FY2014_STATEMENTS.length} statement promotion(s), ` +
    `analysis=${ledger.analysisPromotionIssued ? 'promoted' : 'not promoted'}, ` +
    `pack=${ledger.packPromotionIssued ? 'promoted' : 'not promoted'}`;

  if (!ledger.rolledBack) {
    // The run never reached the promotion phase, so there is nothing to undo.
    return `${issued}; promotion never started, nothing to roll back`;
  }
  if (ledger.rollbackErrors.length > 0 || ledger.rowsStillClaimingReady.length > 0) {
    return (
      `${issued}; COMPENSATING ROLLBACK DID NOT COMPLETE — errors: [${ledger.rollbackErrors.join(' | ') || 'none'}], ` +
      `rows still claiming READY: [${ledger.rowsStillClaimingReady.join(', ') || 'none'}]`
    );
  }
  // Note the wording: EVERY planned row was demoted and re-read, not just the
  // ones the counters above recorded — see `rollbackAtelierPromotions`.
  return `${issued}; every planned row was demoted and re-read as not-ready`;
}

function incomplete(
  reason: string,
  partial: Partial<AtelierFinanceSeedResult> = {},
  ledger: AtelierPromotionLedger = newPromotionLedger()
): AtelierFinanceSeedResult {
  const result: AtelierFinanceSeedResult = {
    status: 'incomplete',
    reason,
    packId: null,
    statementIds: [],
    unpromotedStatementIds: [],
    analysisId: null,
    ...partial,
    promotion: ledger,
  };
  const message = `[atelier-finance-seed] Finance golden flow INCOMPLETE — ${describePromotionLedger(ledger)}; reason: ${reason}`;
  const payload = {
    reason,
    missing: result.missing,
    packId: result.packId,
    promotedStatements: result.statementIds,
    unpromotedStatements: result.unpromotedStatementIds,
    promotion: ledger,
  };
  // A rollback that did not complete is not a warning — the fixture may be
  // holding promoted rows and a human has to look.
  if (ledger.rollbackErrors.length > 0 || ledger.rowsStillClaimingReady.length > 0) {
    logger.error(message, payload);
  } else {
    logger.warn(message, payload);
  }
  return result;
}

// ---------------------------------------------------------------------------
// The OPERATOR RECORD — an in-doubt COMMIT that outlives the process
// ---------------------------------------------------------------------------

/**
 * Is this tenant blocked, and by what?
 *
 * Returns the refusal verbatim, or `null` when the tenant is free to run. The
 * two records are reported with the same severity and the same instruction on
 * purpose (FIN-005 P1-B #9): a `PROMOTION_IN_PROGRESS` marker means a process
 * died between `BEGIN` and the confirmed outcome, which is exactly as
 * unresolved as a lost COMMIT ack — the transaction may have committed, and
 * nothing in this process observed it.
 */
function describeBlockingOperatorRecord(organizationId: string): {
  reason: string;
  partial: Partial<AtelierFinanceSeedResult>;
} | null {
  const hold = readAtelierFinanceOperatorHold(organizationId);
  if (hold) {
    return {
      reason:
        `NEEDS_OPERATOR — refusing to run: a previous run left a COMMIT IN DOUBT for this tenant and the hold has not been acknowledged. ` +
        `Recorded ${hold.recordedAt}: ${hold.reason}. Reconciliation said: ${hold.reconciliation}. ` +
        `Rows claiming READY at that moment: [${hold.rowsClaimingReady.join(', ') || 'none'}]. ` +
        `Hold file: ${atelierFinanceOperatorHoldPath(organizationId)}. ${hold.acknowledgement}`,
      partial: {
        packId: hold.packId,
        statementIds: [],
        unpromotedStatementIds: hold.statementIds,
        analysisId: hold.analysisId,
      },
    };
  }

  const marker = readAtelierFinancePromotionMarker(organizationId);
  if (promotionMarkerBlocks(marker) && marker) {
    const died = marker.state === 'PROMOTION_IN_PROGRESS';
    return {
      reason:
        `NEEDS_OPERATOR — refusing to run: a ${marker.state} promotion marker stands for this tenant. ` +
        (died
          ? `Run "${marker.runId}" recorded the marker at ${marker.startedAt} and NEVER recorded an outcome, ` +
            `which means the process died between BEGIN and the confirmed result — the promotion transaction ` +
            `MAY HAVE COMMITTED and nothing observed it. `
          : `Run "${marker.runId}" recorded ${marker.state} at ${marker.finishedAt ?? marker.startedAt}: ${marker.outcomeDetail ?? 'no detail'}. `) +
        `Rows in scope: [${marker.rowIds.join(', ') || 'unknown'}]. ` +
        `Pre-state digest ${marker.preStateDigest}, intended post-state digest ${marker.intendedPostStateDigest}, ` +
        `target ${marker.target.serverAddr}:${marker.target.serverPort}/${marker.target.database} ` +
        `(oid ${marker.target.databaseOid}, system_identifier ${marker.target.systemIdentifier ?? '<unreadable>'}). ` +
        `Marker file: ${atelierFinancePromotionMarkerPath(organizationId)}. ` +
        `This run will NOT clear it. ${marker.acknowledgement ?? acknowledgementInstruction(organizationId)}`,
      partial: {
        packId: null,
        statementIds: [],
        unpromotedStatementIds: marker.rowIds,
        analysisId: null,
      },
    };
  }

  return null;
}
//
// The hold, the PROMOTION_IN_PROGRESS marker, the durability proof and the
// attributed acknowledgement all live in `atelierFinanceOperatorHold.ts` and are
// re-exported at the top of this file. They moved out when the hold grew from
// "write a JSON file" into a durability contract (FIN-005 P1-B): the hold used
// to land under `process.cwd()` whenever no storage directory was configured,
// so on a Railway service without a mounted volume NEEDS_OPERATOR evaporated on
// the next redeploy — exactly when it mattered.
//
// WHAT THIS FILE STILL OWNS is the LIFECYCLE, because it is inseparable from the
// promotion:
//   - phase 0 refuses while a hold OR a blocking marker stands;
//   - the marker is written durably BEFORE the pinned transaction BEGINs, and a
//     failure to write it ends the run with ZERO promotion writes;
//   - the marker is updated with the CONFIRMED outcome and only then removed,
//     and only by the run that wrote it.

// ---------------------------------------------------------------------------
// Phase 2 — read-back verification
// ---------------------------------------------------------------------------

/**
 * How the read-back gate reaches the database.
 *
 * WHY IT IS INJECTED. The verdict that decides READY must be computed over the
 * rows the promotion will actually write to. On the pinned-transaction path
 * that means reading through the transaction's own connection, over rows this
 * transaction has locked; everywhere else it means the DECISIVE READ SESSION —
 * a client from the exactly-authorised WRITE pool. Passing the reader in means
 * every path runs the identical verification code; the alternative (a second
 * copy of the gate for the transaction) is exactly how a "verified" path quietly
 * stops matching the one under test.
 *
 * THERE IS NO DEFAULT READER ANY MORE (FIN-005 P1-A). There used to be —
 * `dbPromiseReader`, a thin wrapper over `DbPromise.all`, which routes to
 * `getReadPool()` and therefore to the READ REPLICA whenever one is configured.
 * A replica lags. Every function that took `read` optionally and fell back to it
 * could, on a perfectly healthy deployment, read the PRE-write rows after a
 * successful write and conclude the write had failed — and this module's answer
 * to "the write failed" is to demote the fixture. So the parameter is now
 * REQUIRED everywhere, and this module no longer calls `DbPromise.get` or
 * `DbPromise.all` at all: the only `DbPromise` entry point left in the file is
 * `run`, which goes to the primary pool. `atelierFinancePrimaryReads.test.ts`
 * asserts that structurally, by scanning this source.
 */
type SqlReader = (sql: string, params?: unknown[]) => Promise<Array<Record<string, unknown>>>;

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
  read: SqlReader;
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
    statementRows = (await params.read(
      `SELECT id, organization_id, statement_pack_id, statement_type, currency, scaling, status
         FROM financial_statements
        WHERE id = ?`,
      [params.statementId]
    )) as StatementReadBackRow[];
    valueRows = (await params.read(
      `SELECT ${valueColumnNames.join(', ')}
         FROM financial_statement_values
        WHERE statement_id = ?`,
      [params.statementId]
    )) as StatementValueRow[];
  } catch (error) {
    return { ok: false, reason: `read-back query failed: ${(error as Error).message}` };
  }

  if (statementRows.length !== 1) {
    return {
      ok: false,
      reason: `read-back returned ${statementRows.length} statement rows, expected 1`,
    };
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
  const currency = String(row.currency ?? '')
    .trim()
    .toUpperCase();
  if (currency !== ATELIER_FINANCE_CURRENCY) {
    return {
      ok: false,
      reason: `currency mismatch: ${currency || 'null'} != ${ATELIER_FINANCE_CURRENCY}`,
    };
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
    return {
      ok: false,
      reason: `${unmapped.length} persisted value(s) carry a null canonical_line_id`,
    };
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

  // ---- Phase 0 gate A: an UNACKNOWLEDGED operator record blocks everything --
  // Consulted before the schema probe, before the heal, before the first write,
  // and before a single connection is opened. TWO records can block:
  //
  //   the HOLD    — a previous run's COMMIT is in doubt. Healing over it would
  //                 destroy the only evidence a human has, and re-promoting
  //                 would report `complete` over a fixture nobody looked at.
  //   the MARKER  — a previous run wrote `PROMOTION_IN_PROGRESS` before BEGIN
  //                 and never wrote an outcome, which means the process DIED
  //                 somewhere between BEGIN and the confirmed result. The
  //                 transaction may have committed. FIN-005 P1-B #9 requires
  //                 this to be treated EXACTLY like NEEDS_OPERATOR, and it is:
  //                 same refusal, same acknowledgement, and this run cannot
  //                 clear it (see `removeOwnPromotionMarker`).
  const blocked = describeBlockingOperatorRecord(organizationId);
  if (blocked) return incomplete(blocked.reason, blocked.partial);

  // ---- Phase 0 gate B: the hold has somewhere durable to land ---------------
  // Proved by doing the whole fsync/rename sequence, BEFORE the first mutation.
  // If a NEEDS_OPERATOR record could not be written, the run must not create the
  // state that would need one.
  const durability = proveDurableStorage(atelierFinanceOperatorHoldDir());
  if (!durability.durable) {
    return incomplete(
      `refusing to run: the operator-hold directory is not durable — ${durability.reason}. ` +
        `A run that cannot record NEEDS_OPERATOR must not create a fixture that might need it. ` +
        `Completed steps: [${durability.steps.join(' -> ') || 'none'}].`
    );
  }

  // ---- Phase 0 gate C: decisive reads must come from the PRIMARY ------------
  // `DbPromise.get`/`all` route to the READ pool, which is the replica whenever
  // one is configured, and a replica lags. Every verdict below — the schema
  // gate, the residue heal, the promotion plan, the rollback verification, the
  // complete/incomplete answer — is computed from `session.read`, which is a
  // client checked out of the exactly-authorised WRITE pool and proved not to be
  // in recovery. A refusal here has issued ZERO statements.
  const opened = await openDecisiveReadSession();
  if (opened.ok === false) {
    return incomplete(
      `refusing to run: ${opened.reason} (fail-closed, zero statements issued). Evidence: ${opened.evidence}`
    );
  }

  try {
    return await seedAtelierFinanceOnPrimary(input, opened.session);
  } finally {
    await opened.session.close();
  }
}

/**
 * The seed proper. Every read it performs goes through `session.read`.
 *
 * Split out from the entry point so the decisive session has exactly one
 * lifetime and exactly one `close()`, in a `finally` that no early return can
 * skip — and so that a reviewer can see, in one signature, that this function
 * has no other way to reach the database for a read.
 */
async function seedAtelierFinanceOnPrimary(
  input: AtelierFinanceSeedInput,
  session: DecisiveReadSession
): Promise<AtelierFinanceSeedResult> {
  const { organizationId } = input;
  const isPl = input.locale === 'pl';
  const createdBy = input.createdBy || null;
  const runId = (input.runId ?? '').trim() || `seed-${crypto.randomUUID()}`;
  const read = session.read;

  // ---- Schema gate -------------------------------------------------------
  const schema = await probeAtelierFinanceSchema(read);
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
    logger.warn(
      '[atelier-finance-seed] schema introspection unavailable; relying on write+read-back gates',
      {
        tables: schema.unverified,
      }
    );
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
  const allStatementIds = ATELIER_FY2014_STATEMENTS.map((statement) =>
    makeId(organizationId, 'statement', statement.slug)
  );

  // ---- Phase 0: heal what a CRASH left behind ------------------------------
  // Phase 2's compensating rollback handles a promotion write that fails; it
  // cannot handle the process being killed between two promotion UPDATEs. If
  // the fixture is sitting in a mixed state, demote all of it before rewriting.
  await healResidualAtelierPromotion({
    read,
    organizationId,
    packId,
    analysisId: makeId(organizationId, 'analysis', ATELIER_FINANCE_SLUGS.analysis),
    statementIds: allStatementIds,
    statementColumns,
    analysisColumns,
    packColumns,
    isPl,
  });

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
      ['pack_quality_summary', phase1PackQualitySummary(isPl)],
      ['pack_quality_reason_codes', PHASE1_QUALITY_REASON_CODES],
      ['source_statement_count', 0],
      ['missing_statement_types', PHASE1_MISSING_STATEMENT_TYPES],
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
    await DbPromise.run(
      buildUpsertSql('financial_statement_packs', packUpsert),
      packUpsert.values,
      {
        fallback: false,
      }
    );
  } catch (error) {
    return incomplete(`pack write failed: ${(error as Error).message}`);
  }

  const hasIngestRuns = await tableExists(read, 'financial_statement_ingest_runs');
  const ingestRunColumns = hasIngestRuns
    ? await getTableColumns(read, 'financial_statement_ingest_runs')
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
        ['quality_summary', phase1StatementQualitySummary(isPl)],
        ['quality_reason_codes', PHASE1_QUALITY_REASON_CODES],
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
      await DbPromise.run(
        buildUpsertSql('financial_statements', statementUpsert),
        statementUpsert.values,
        {
          fallback: false,
        }
      );
    } catch (error) {
      return incomplete(
        `statement ${statement.statementType} write failed: ${(error as Error).message}`,
        {
          packId,
          unpromotedStatementIds: [...writtenStatementIds, statementId],
        }
      );
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
            makeId(
              organizationId,
              'statement-value',
              `${statement.slug}--${line.code.toLowerCase()}`
            ),
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

  // ---- Phase 2: verify EVERYTHING, then promote — ATOMICALLY --------------
  //
  // TWO PATHS, ONE CONTRACT. Whichever runs, `complete` means all five rows are
  // promoted and `incomplete` means NONE of them is.
  //
  // ON POSTGRESQL THERE IS EXACTLY ONE PATH: (A). (FIN-005 P1-1 / P1-2.)
  // `runPinnedPromotionTransaction` only ever returns `unavailable` when it has
  // POSITIVELY IDENTIFIED a non-PostgreSQL seam; anything else that goes wrong —
  // probe failure, checkout timeout, pool exhaustion, connection failure,
  // database mismatch — comes back as `refused`, with zero promotion UPDATEs
  // issued, and ends this function as `incomplete`. Railway `demo` can therefore
  // never degrade to non-atomic promotion.
  //
  // (A) PINNED TRANSACTION — the correct primitive, used whenever the process is
  //     really talking to PostgreSQL. `atelierFinancePromotionTransaction.ts`
  //     checks out one `pg` client, BEGINs, takes `FOR UPDATE` locks on the
  //     pack, the three statements and the analysis, RE-RUNS the whole
  //     production verdict over those locked rows, issues all five promotions on
  //     that same client, reads them back on it and only then COMMITs. Any
  //     failure ROLLBACKs; a process killed mid-transaction is rolled back by
  //     the server when the connection drops. There is no half-promoted state to
  //     repair. A COMMIT whose answer is lost is reconciled on a fresh
  //     connection and reported as committed / rolled-back / INDETERMINATE —
  //     never guessed.
  //
  // (B) FALLBACK: verify everything, then promote, and compensate on error —
  //     REACHABLE ONLY IN A RECOGNISED TEST / NON-PG SEAM: the mocked in-memory
  //     database in tests, `MOCK_DB=true`, a database instance that declares
  //     `isMock`, or a configured driver that is not postgres. It is NOT an
  //     option on a real PostgreSQL, because a `DbPromise` timeout settles the
  //     JS promise without cancelling the query: the UPDATE can land AFTER the
  //     compensation ran and resurrect READY (and the compensating demote,
  //     guarded by `IS DISTINCT FROM`, matches zero rows while the promotion is
  //     still in flight, so it "succeeds" without doing anything). A JS timeout
  //     is not a transaction boundary.
  //
  //     Within that seam `DbPromise` still cannot give us a transaction (its
  //     `transaction()` takes a fixed list of SQL strings and never yields a
  //     connection handle, and every `run()` goes through `pool.query()`, so
  //     BEGIN/COMMIT need not even land on the same pooled connection), hence:
  //
  //       (1) every read-back and every production verdict — all three
  //           statements, the analysis AND the pack — runs BEFORE the first
  //           promotion write. A single refusal returns INCOMPLETE with ZERO
  //           promotions issued.
  //       (2) (1) cannot cover a failure OF the promotion writes themselves (the
  //           2nd of 3 UPDATEs throwing), so ANY error mid-promotion triggers a
  //           COMPENSATING ROLLBACK that demotes EVERY PLANNED ROW back to its
  //           phase-1 state and then RE-READS those rows to confirm it landed.
  //           "Every planned row", not "every row the ledger says was promoted":
  //           a rejected promise does not prove the row was not written (a
  //           connection reset after the UPDATE applied looks exactly like a
  //           write that never happened). See `rollbackAtelierPromotions`.
  //
  //     Path (B) keeps TWO named exceptions, both tolerable ONLY because it can
  //     no longer run on a real database. The first is the late-write hole
  //     above. The second is the process DYING between two
  //     promotion UPDATEs (SIGTERM on a Railway redeploy, OOM kill,
  //     `process.exit`). No catch block runs, so neither the rollback nor any
  //     result object exists, and the fixture is left half-promoted. That
  //     residue is repaired by PHASE 0 of the NEXT run
  //     (`healResidualAtelierPromotion`). Path (A) does not have this hole.
  //
  // PHASE 0 AND THE COMPENSATING ROLLBACK STAY IN PLACE UNDER BOTH PATHS. They
  // are defence-in-depth, and they are what repairs residue left by an older
  // build, by a fallback run, or by a crash between phase 1 and phase 2.
  const ledger = newPromotionLedger();

  const planContext: PromotionPlanContext = {
    organizationId,
    packId,
    analysisId,
    statementColumns,
    valueColumns,
    packColumns,
    analysisColumns,
    createdBy,
    isPl,
  };

  // -- 2a. PINNED PATH -------------------------------------------------------
  /** Set by `reconcile` (lost COMMIT ack only) so the ledger can report it. */
  let reconciledRowsClaimingReady: string[] = [];
  /**
   * The two states a lost COMMIT ack is classified against — see the PRE-STATE /
   * POST-STATE section. Both are captured inside `plan`, where the five rows are
   * held under `FOR UPDATE`: the snapshot is therefore the exact state the writes
   * would apply to, not a state something else could have moved in between.
   */
  let preTransactionState: PromotionStateSnapshot | null = null;
  let intendedState: PromotionStateSnapshot | null = null;

  // -- 2a-pre. THE PROMOTION MARKER, DURABLE BEFORE `BEGIN` (FIN-005 P1-B) ----
  //
  // WHAT IT CLOSES. The pinned transaction survives a process death BETWEEN two
  // UPDATEs — the server aborts an uncommitted transaction when the connection
  // drops. It does not survive a process death INSIDE the COMMIT round-trip: no
  // catch block runs, no reconciliation happens, no hold is written. The
  // transaction may have committed, and the next run would find a fully
  // promoted fixture and call it healthy.
  //
  // So the intent is written down first, on disk, fsync'd, with everything a
  // human needs to resolve it by hand: which run, which tenant, which five rows,
  // what they looked like before, what this run meant to make them look like,
  // and which server it was pointed at. A marker still reading
  // PROMOTION_IN_PROGRESS on the next run BLOCKS it (phase 0 gate A).
  //
  // THE DIGESTS ARE COMPUTED ON THE PRIMARY, NOT INSIDE THE TRANSACTION. They
  // have to be: the marker must be durable BEFORE `BEGIN`. The authoritative
  // snapshot is still the one `plan(read)` takes under the `FOR UPDATE` locks —
  // that is what reconciliation classifies against. These two digests are
  // EVIDENCE for a human, and they are read from the same primary the
  // transaction will run on, so on an unchanged fixture they are the same
  // bytes.
  let markerPreDigest = 'unavailable';
  let markerIntendedDigest = 'unavailable';
  try {
    const preOnPrimary = await readPromotionState({
      read,
      packId,
      analysisId,
      statementIds: allStatementIds,
      statementColumns,
      analysisColumns,
      packColumns,
    });
    markerPreDigest = digestPromotionState(preOnPrimary);
    const previewPlan = await planAtelierPromotion(read, planContext);
    markerIntendedDigest =
      previewPlan.ok === true
        ? digestPromotionState(intendedPromotionState(previewPlan.writes))
        : `no-plan: ${previewPlan.reason}`;
  } catch (error) {
    markerPreDigest = `unreadable: ${(error as Error).message}`;
  }

  const markerRowIds = [packId, ...allStatementIds, analysisId];
  const marker: AtelierFinancePromotionMarker = {
    state: 'PROMOTION_IN_PROGRESS',
    runId,
    organizationId,
    rowIds: markerRowIds,
    preStateDigest: markerPreDigest,
    intendedPostStateDigest: markerIntendedDigest,
    target: {
      database: session.identity?.database ?? `<${session.seam}>`,
      databaseOid: session.identity?.databaseOid ?? '<none>',
      serverAddr: session.identity?.serverAddr ?? '<none>',
      serverPort: session.identity?.serverPort ?? '<none>',
      backendPid: session.identity?.backendPid ?? '<none>',
      systemIdentifier: session.identity?.systemIdentifier ?? null,
    },
    startedAt: new Date().toISOString(),
  };

  const markerError = writeAtelierFinancePromotionMarker(marker);
  if (markerError) {
    // ZERO promotion writes have been issued. A promotion whose intent could not
    // be recorded is a promotion whose death nobody could detect, so it does not
    // start. Phase 1 wrote the fixture in its NOT-ready state, which is exactly
    // where an `incomplete` leaves it.
    return incomplete(
      `refusing to promote: the PROMOTION_IN_PROGRESS marker could not be written durably at ` +
        `${atelierFinancePromotionMarkerPath(organizationId)} (${markerError}). Without it a process death ` +
        `during COMMIT would leave an in-doubt promotion that no later run could detect. ` +
        `Zero promotion UPDATEs were issued.`,
      { packId, statementIds: [], unpromotedStatementIds: allStatementIds, analysisId },
      ledger
    );
  }

  /**
   * Record the CONFIRMED outcome on the marker, durably, and only then let it be
   * removed (FIN-005 P1-B #7). The order is the guarantee: a crash between the
   * database outcome and this write leaves PROMOTION_IN_PROGRESS, which blocks;
   * a crash between this write and the removal leaves a terminal marker, which
   * does not. Never the other way round.
   */
  const settleMarker = (
    state: 'COMMITTED' | 'ROLLED_BACK' | 'NEEDS_OPERATOR',
    outcomeDetail: string
  ): string | null => {
    const finalError = writeAtelierFinancePromotionMarker({
      ...marker,
      state,
      finishedAt: new Date().toISOString(),
      outcomeDetail,
      ...(state === 'NEEDS_OPERATOR'
        ? { acknowledgement: acknowledgementInstruction(organizationId) }
        : {}),
    });
    if (finalError) {
      logger.error(
        `[atelier-finance-seed] the promotion marker at ${atelierFinancePromotionMarkerPath(organizationId)} ` +
          `could not be updated to ${state} (${finalError}). It still reads PROMOTION_IN_PROGRESS and will ` +
          `BLOCK the next run for "${organizationId}" — which is the safe direction, but a human must ` +
          `acknowledge it.`
      );
      return finalError;
    }
    if (state === 'NEEDS_OPERATOR') return null;
    const removal = removeOwnPromotionMarker({ organizationId, runId });
    if (!removal.removed) {
      logger.warn(
        `[atelier-finance-seed] the ${state} promotion marker was not removed: ${removal.reason}`
      );
    }
    return null;
  };

  const pinned = await runPinnedPromotionTransaction({
    // The pinned client is validated against the PRIMARY this run's decisive
    // reads are bound to — never against the read pool. See P1-A.
    expectPrimaryDatabase: session.identity?.database ?? null,
    lock: [
      { table: 'financial_statement_packs', ids: [packId] },
      { table: 'financial_statements', ids: allStatementIds },
      { table: 'financial_analyses', ids: [analysisId] },
    ],
    plan: async (read) => {
      // FIRST, under the locks. A read failure here throws and aborts the
      // transaction on purpose: without a pre-state there is nothing a lost
      // COMMIT ack could be classified against, so it must not be allowed to
      // commit at all.
      preTransactionState = await readPromotionState({
        read,
        packId,
        analysisId,
        statementIds: allStatementIds,
        statementColumns,
        analysisColumns,
        packColumns,
      });

      const plan = await planAtelierPromotion(read, planContext);
      if (plan.ok === false) return { ok: false, reason: plan.reason };
      intendedState = intendedPromotionState(plan.writes);
      return {
        ok: true,
        writes: plan.writes.map((write) => {
          const update = buildPromotionUpdate(write.spec);
          return { label: write.label, sql: update.sql, params: update.params };
        }),
      };
    },
    verify: async (read) => {
      // Final read-back on the SAME client, before COMMIT: every one of the five
      // rows must now claim READY. Same predicate the compensating rollback uses
      // in the opposite direction, so the two cannot disagree.
      const errors: string[] = [];
      const claims = await readPromotionClaims({
        read,
        packId,
        analysisId,
        statementIds: allStatementIds,
        onError: (message) => errors.push(message),
      });
      if (errors.length > 0) {
        return { ok: false, reason: `pre-commit read-back failed: ${errors.join(' | ')}` };
      }
      const expected = allStatementIds.length + 2;
      if (claims.length !== expected) {
        return { ok: false, reason: `pre-commit read-back saw ${claims.length}/${expected} rows` };
      }
      const notReady = claims.filter((claim) => !claim.exists || !claim.claimsReady);
      if (notReady.length > 0) {
        return {
          ok: false,
          reason: `${notReady.length} row(s) did not read back as promoted: ${notReady
            .map((claim) => claim.id)
            .join(', ')}`,
        };
      }
      return { ok: true };
    },
    // Runs on a FRESH connection (inside its own READ ONLY transaction), and
    // ONLY after a COMMIT whose answer was lost.
    //
    // IT CLASSIFIES ON WHOLE ROWS, NOT ON FLAGS. Two exactly-known states are
    // available: `preTransactionState`, captured under the row locks, and
    // `intendedState`, derived from the very write specs that were executed.
    // Every promotion-owned column of all five rows must match one of them,
    // ALL of them the same one. A row a concurrent actor moved somewhere else,
    // a row whose `pack_readiness_score` disagrees with its `pack_status` — none
    // of that can be reported as "pre-state" or "committed" any more.
    reconcile: async (read) => {
      const expected = allStatementIds.length + 2;
      const ids = [...allStatementIds, analysisId, packId];
      const pre = preTransactionState;
      const post = intendedState;
      if (!pre || !post || ids.some((id) => !(id in pre) || !(id in post))) {
        return {
          verdict: 'indeterminate',
          detail:
            'no complete pre-transaction snapshot was captured under the row locks, so the outcome cannot be classified against one',
        };
      }

      // The claim read still runs: `rowsStillClaimingReady` is what the ledger
      // and the operator's log line report, and it is also the cheapest proof
      // that all five rows are still present.
      const errors: string[] = [];
      const claims = await readPromotionClaims({
        read,
        packId,
        analysisId,
        statementIds: allStatementIds,
        onError: (message) => errors.push(message),
      });
      if (errors.length > 0) {
        return {
          verdict: 'indeterminate',
          detail: `the post-COMMIT read failed: ${errors.join(' | ')}`,
        };
      }
      if (claims.length !== expected) {
        return {
          verdict: 'indeterminate',
          detail: `the post-COMMIT read saw ${claims.length}/${expected} rows`,
        };
      }
      reconciledRowsClaimingReady = claims
        .filter((claim) => claim.claimsReady)
        .map((claim) => claim.id);
      const missing = claims.filter((claim) => !claim.exists).map((claim) => claim.id);
      if (missing.length > 0) {
        return {
          verdict: 'indeterminate',
          detail: `${missing.length} promoted record(s) no longer exist: ${missing.join(', ')}`,
        };
      }

      let actual: PromotionStateSnapshot;
      try {
        actual = await readPromotionState({
          read,
          packId,
          analysisId,
          statementIds: allStatementIds,
          statementColumns,
          analysisColumns,
          packColumns,
        });
      } catch (error) {
        return {
          verdict: 'indeterminate',
          detail: `the post-COMMIT state read failed: ${(error as Error).message}`,
        };
      }

      // INDEPENDENT membership, not a priority order. A row whose pre-state
      // already equalled the intended state belongs to BOTH buckets, and
      // charging it to only the first would starve the other — a genuinely
      // rolled-back transaction over a fixture that was already partly promoted
      // would then land in `indeterminate` for no reason.
      const matchedPost: string[] = [];
      const matchedPre: string[] = [];
      const matchedNeither: string[] = [];
      for (const id of ids) {
        const row = actual[id] ?? null;
        const isPost = stateMatches(post[id], row);
        const isPre = stateMatches(pre[id], row);
        if (isPost) matchedPost.push(id);
        if (isPre) matchedPre.push(id);
        if (!isPost && !isPre) matchedNeither.push(`${id} (${describeStateDiff(post[id], row)})`);
      }

      if (matchedPost.length === expected) {
        // The intended state is on disk. Coherence on top of identity: re-run
        // the PRODUCTION verdict over the committed rows — it reads the pack,
        // the statements, their VALUES and the analysis, which no column
        // comparison can stand in for.
        const coherence = await planAtelierPromotion(read, planContext);
        if (coherence.ok === false) {
          return {
            verdict: 'indeterminate',
            detail: `all ${expected} records match the intended post-promotion state but the production verdict refuses the fixture: ${coherence.reason}`,
          };
        }
        // Honest footnote: when the pre-state ALREADY equalled the intended
        // state, the five UPDATEs were no-ops (they are guarded by
        // `IS DISTINCT FROM`), so committed and rolled back are the same
        // outcome and no read could ever tell them apart. Say so rather than
        // imply the wire was observed.
        const wroteNothing = ids.every((id) => stateMatches(post[id], pre[id]));
        return {
          verdict: 'committed',
          detail: wroteNothing
            ? `all ${expected} promoted records match the intended post-promotion state on a fresh connection AND already matched it before the transaction — the five guarded UPDATEs were no-ops, so committed and rolled back are materially the same outcome here`
            : `all ${expected} promoted records match the intended post-promotion state EXACTLY, on every promotion-owned column, and the fixture is coherent (read on a fresh connection)`,
        };
      }

      if (matchedPre.length === expected) {
        return {
          verdict: 'not-committed',
          detail: `all ${expected} promoted records read back in their pre-promotion state on a fresh connection — every promotion-owned column matches the snapshot taken under the FOR UPDATE locks`,
        };
      }

      return {
        verdict: 'indeterminate',
        detail:
          `MIXED state after a lost COMMIT ack: ${matchedPost.length}/${expected} records match the intended post-promotion state, ` +
          `${matchedPre.length}/${expected} match the pre-transaction snapshot` +
          (matchedNeither.length > 0
            ? `, and ${matchedNeither.length} match NEITHER: ${matchedNeither.join('; ')}`
            : '') +
          ` (claiming READY: ${reconciledRowsClaimingReady.join(', ') || 'none'})`,
      };
    },
  });

  // -- 2a-bis. REFUSED — fail closed. ---------------------------------------
  // A real (or unproven) PostgreSQL that could not host the pinned transaction.
  // Every refusal branch in the adapter is upstream of the first write, so ZERO
  // promotion UPDATEs were issued and there is nothing to compensate: the ledger
  // stays at "promotion never started, nothing to roll back", which is literally
  // true. There is no fallback promotion on PostgreSQL.
  if (pinned.mode === 'refused') {
    // Every refusal branch in the adapter is upstream of `BEGIN`, so the marker
    // describes an intent that was never acted on. Recording that outcome and
    // then removing the marker is the honest bookkeeping: leaving
    // PROMOTION_IN_PROGRESS behind would block the next run over a transaction
    // that provably never started.
    settleMarker(
      'ROLLED_BACK',
      `refused before BEGIN, zero promotion UPDATEs issued: ${pinned.reason}`
    );
    return incomplete(
      `pinned promotion transaction REFUSED (fail-closed, zero promotion UPDATEs issued): ${pinned.reason}`,
      { packId, statementIds: [], unpromotedStatementIds: allStatementIds, analysisId },
      ledger
    );
  }

  if (pinned.mode === 'pinned') {
    // The ledger reports what the transaction issued. On a rollback these are
    // writes Postgres itself undid, which is why `rowsStillClaimingReady` is
    // still verified below rather than assumed.
    ledger.statementPromotionsIssued = pinned.applied.filter((label) =>
      allStatementIds.includes(label)
    ).length;
    ledger.analysisPromotionIssued = pinned.applied.includes(analysisId);
    ledger.packPromotionIssued = pinned.applied.includes(packId);

    if (pinned.status === 'committed') {
      settleMarker(
        'COMMITTED',
        `commit ack ${pinned.commitAck}; applied [${pinned.applied.join(', ')}]` +
          (pinned.reconciliation ? `; reconciliation: ${pinned.reconciliation.detail}` : '')
      );
      logger.info(
        `[atelier-finance-seed] Finance golden flow COMPLETE via the PINNED transaction path (backend pid ${pinned.backendPid ?? 'unknown'}, commit ack ${pinned.commitAck})`,
        {
          packId,
          analysisId,
          statementIds: allStatementIds,
          reconciliation: pinned.reconciliation?.detail,
        }
      );
      return {
        status: 'complete',
        packId,
        statementIds: allStatementIds,
        unpromotedStatementIds: [],
        analysisId,
        promotion: ledger,
      };
    }

    // IN DOUBT. The COMMIT answer was lost AND reconciliation on a fresh
    // connection could not classify the outcome. This is neither `complete` nor
    // an honest "rolled back": no compensating demotion is attempted, because
    // guessing at a possibly-committed transaction is how a half-promoted
    // fixture gets made. A human decides.
    if (pinned.status === 'commit-indeterminate') {
      ledger.statementPromotionsIssued = pinned.applied.filter((label) =>
        allStatementIds.includes(label)
      ).length;
      ledger.rowsStillClaimingReady = reconciledRowsClaimingReady;

      // PERSIST THE VERDICT. Without this the next run's phase 0 would see the
      // residue, demote it, re-promote and return `complete` — erasing the only
      // evidence of an in-doubt COMMIT, silently, in the flow the runbook itself
      // documents. The hold blocks every subsequent run for this tenant until a
      // human acknowledges it. See the OPERATOR HOLD section.
      const holdPath = atelierFinanceOperatorHoldPath(organizationId);
      const acknowledgement = acknowledgementInstruction(organizationId);
      const holdError = writeAtelierFinanceOperatorHold({
        organizationId,
        recordedAt: new Date().toISOString(),
        packId,
        analysisId,
        statementIds: allStatementIds,
        reason: pinned.reason,
        reconciliation: pinned.reconciliation.detail,
        applied: pinned.applied,
        backendPid: pinned.backendPid,
        rowsClaimingReady: reconciledRowsClaimingReady,
        acknowledgement,
      });

      // The marker becomes NEEDS_OPERATOR too (FIN-005 P1-B #8) and is NOT
      // removed. Two records now block this tenant, written by two different
      // code paths from the same evidence — if either survives, the seed stops.
      const markerHoldError = settleMarker(
        'NEEDS_OPERATOR',
        `COMMIT INDETERMINATE: ${pinned.reason}; reconciliation: ${pinned.reconciliation.detail}`
      );
      if (markerHoldError) {
        logger.error(
          `[atelier-finance-seed] the promotion marker could not be moved to NEEDS_OPERATOR (${markerHoldError}); it still reads PROMOTION_IN_PROGRESS, which blocks the next run for the right reason but with the wrong words.`
        );
      }

      if (holdError) {
        // The one case that is WORSE than the in-doubt COMMIT itself: nothing
        // stops the next run from healing over it. Say so in the reason, not
        // only in a log line.
        logger.error(
          `[atelier-finance-seed] COULD NOT PERSIST the NEEDS_OPERATOR hold at ${holdPath}: ${holdError}. The NEXT seed run for "${organizationId}" will NOT be blocked and may erase this residue — block it by other means immediately.`
        );
      }

      return incomplete(
        `pinned promotion transaction COMMIT INDETERMINATE — NEEDS_OPERATOR: ${pinned.reason}. ` +
          (holdError
            ? `THE HOLD COULD NOT BE PERSISTED (${holdPath}: ${holdError}) — the next run is NOT blocked and may erase this residue. ${acknowledgement}`
            : `A hold has been recorded at ${holdPath}; this seed will REFUSE to run for this tenant until it is acknowledged. ${acknowledgement}`),
        { packId, statementIds: [], unpromotedStatementIds: allStatementIds, analysisId },
        ledger
      );
    }

    // ROLLED BACK. Postgres guarantees nothing survived — but this module's
    // rule is to verify, not to assert, so read the five rows back.
    settleMarker('ROLLED_BACK', pinned.reason);
    ledger.rolledBack = true;
    ledger.rowsStillClaimingReady = await findRowsStillClaimingReady({
      read,
      packId,
      analysisId,
      statementIds: allStatementIds,
      onError: (message) => ledger.rollbackErrors.push(message),
    });
    return incomplete(
      `pinned promotion transaction rolled back: ${pinned.reason}`,
      { packId, statementIds: [], unpromotedStatementIds: allStatementIds, analysisId },
      ledger
    );
  }

  // -- 2b. FALLBACK PATH -----------------------------------------------------
  // ONE DOOR, WRITTEN EXPLICITLY rather than reached by falling through, so that
  // `grep "mode === 'unavailable'"` finds every place the non-atomic path can be
  // entered — and there is exactly one, here.
  if (pinned.mode !== 'unavailable') {
    // Unreachable: 'refused' and 'pinned' both returned above. Kept so a future
    // outcome added to the union fails closed instead of falling into (B).
    settleMarker('ROLLED_BACK', `unexpected pinned promotion outcome; nothing was promoted`);
    return incomplete(
      `unexpected pinned promotion outcome: ${JSON.stringify(pinned)}`,
      { packId, statementIds: [], unpromotedStatementIds: allStatementIds, analysisId },
      ledger
    );
  }

  // THE ONLY WAY IN IS `mode === 'unavailable'`, and the adapter builds that
  // exactly once, in `reportUnavailable`, from a POSITIVELY IDENTIFIED non-PG
  // seam (`identifyNonPostgresSeam`). A checkout failure, a probe failure, a
  // pool that is exhausted or a database mismatch all come back as `refused`
  // and returned above. So this code cannot run against PostgreSQL — which is
  // what makes its late-write hole (a `DbPromise` timeout does not cancel the
  // query) survivable. The reason has already been logged by the adapter — at
  // `error` level in production.
  logger.warn(
    '[atelier-finance-seed] promoting WITHOUT a pinned transaction (verify-then-promote + compensating rollback)',
    { seam: pinned.seam }
  );

  const plan = await planAtelierPromotion(read, planContext);
  if (plan.ok === false) {
    settleMarker('ROLLED_BACK', `the promotion plan refused before any write: ${plan.reason}`);
    return incomplete(
      plan.reason,
      { packId, statementIds: [], unpromotedStatementIds: allStatementIds, analysisId },
      ledger
    );
  }

  // -- 2c. Promote. Everything above has already agreed. --------------------
  const promoted: string[] = [];
  try {
    for (const write of plan.writes) {
      await promoteRow(write.spec);
      if (write.kind === 'statement') {
        promoted.push(write.label);
        ledger.statementPromotionsIssued = promoted.length;
      } else if (write.kind === 'analysis') {
        ledger.analysisPromotionIssued = true;
      } else {
        ledger.packPromotionIssued = true;
      }
    }
  } catch (error) {
    // A promotion write threw. Everything promoted before it is committed, so
    // undo it by hand — there is no transaction to roll back on this path.
    //
    // NO SHORT-CIRCUIT. The rollback runs even when the ledger recorded zero
    // promotions, and it targets EVERY PLANNED ROW rather than the recorded
    // ones: a rejected promise does not prove the row was not written (see
    // `rollbackAtelierPromotions`). Skipping the rollback on
    // "nothing issued" would also skip its verification RE-READ, which is the
    // only thing that can catch exactly that case.
    await rollbackAtelierPromotions({
      read,
      packId,
      analysisId,
      plannedStatementIds: allStatementIds,
      statementColumns,
      analysisColumns,
      packColumns,
      isPl,
      ledger,
    });

    // The compensating rollback demoted every planned row and re-read them on
    // the PRIMARY. That is a confirmed outcome, so the marker records it and is
    // cleared; a row that still claims READY is carried in the ledger and turns
    // the log line into an `error`, which is the escalation path.
    settleMarker(
      'ROLLED_BACK',
      `non-atomic seam promotion failed and was compensated: ${(error as Error).message}; ` +
        `rows still claiming READY: [${ledger.rowsStillClaimingReady.join(', ') || 'none'}]`
    );
    return incomplete(
      `promotion write failed: ${(error as Error).message}`,
      { packId, statementIds: [], unpromotedStatementIds: allStatementIds, analysisId },
      ledger
    );
  }

  settleMarker('COMMITTED', `non-atomic seam promotion applied [${promoted.join(', ')}]`);
  return {
    status: 'complete',
    packId,
    statementIds: promoted,
    unpromotedStatementIds: [],
    analysisId,
    promotion: ledger,
  };
}

// ---------------------------------------------------------------------------
// The promotion plan — one verdict, shared by both phase-2 paths
// ---------------------------------------------------------------------------

interface PromotionPlanContext {
  organizationId: string;
  packId: string;
  analysisId: string;
  statementColumns: Set<string>;
  valueColumns: Set<string>;
  packColumns: Set<string>;
  analysisColumns: Set<string>;
  createdBy: string | null;
  isPl: boolean;
}

interface PlannedPromotionWrite {
  kind: 'statement' | 'analysis' | 'pack';
  /** The row id — also the label the pinned adapter reports back. */
  label: string;
  spec: PromotionRowSpec;
}

type PromotionPlan = { ok: false; reason: string } | { ok: true; writes: PlannedPromotionWrite[] };

/**
 * Read every row back, run the PRODUCTION verdict over it, and return the five
 * promotion writes — or the reason none of them may be issued.
 *
 * Pure with respect to the database: it reads through the injected `read` and
 * writes nothing. That is what lets the pinned transaction run this exact code
 * over rows it has locked, while the fallback path runs it over ordinary
 * `DbPromise` reads. `verifyPackReadBack` deliberately checks membership of the
 * just-verified statement set rather than the persisted `readiness_status`,
 * because nothing has been promoted yet at this point.
 */
async function planAtelierPromotion(
  read: SqlReader,
  context: PromotionPlanContext
): Promise<PromotionPlan> {
  const expectedCounts = getAtelierExpectedValueCounts();
  const writes: PlannedPromotionWrite[] = [];
  const refused: string[] = [];
  const verifiedStatementIds = new Set<string>();

  for (const statement of ATELIER_FY2014_STATEMENTS) {
    const statementId = makeId(context.organizationId, 'statement', statement.slug);
    const verdict = await verifyStatementReadBack({
      read,
      organizationId: context.organizationId,
      packId: context.packId,
      statementId,
      statementType: statement.statementType,
      expectedValueCount: expectedCounts[statement.statementType] ?? statement.lines.length,
      statementColumns: context.statementColumns,
      valueColumns: context.valueColumns,
    });

    if (verdict.ok === false) {
      refused.push(`${statement.statementType}: ${verdict.reason}`);
      continue;
    }

    verifiedStatementIds.add(statementId);
    writes.push({
      kind: 'statement',
      label: statementId,
      spec: {
        table: 'financial_statements',
        id: statementId,
        columns: context.statementColumns,
        assignments: [
          ['status', 'confirmed'],
          ['validation_status', verdict.validationStatus as string],
          ['validation_messages', JSON.stringify(verdict.validationMessages ?? [])],
          ['readiness_status', verdict.readinessStatus as string],
          ['readiness_score', verdict.readinessScore as number],
          [
            'quality_summary',
            context.isPl
              ? 'Sprawozdanie spełnia kontrakt gotowości (zweryfikowane odczytem zwrotnym).'
              : 'Statement passed the readiness contract (verified by read-back).',
          ],
          ['quality_reason_codes', JSON.stringify(verdict.reasonCodes ?? [])],
          ['confirmed_by', context.createdBy],
        ],
      },
    });
  }

  // ALL-OR-NOTHING. One refused statement means none is promoted — a fixture
  // with two READY statements and one pending is neither honest nor complete.
  if (refused.length > 0) {
    return {
      ok: false,
      reason: `only ${writes.length}/${ATELIER_FY2014_STATEMENTS.length} statements passed the READY gate, so NONE was promoted: ${refused.join(' | ')}`,
    };
  }

  // The analysis must exist AND point at this pack before either it or the pack
  // may be called approved/ready.
  const analysisVerdict = await verifyAnalysisReadBack({
    read,
    organizationId: context.organizationId,
    packId: context.packId,
    analysisId: context.analysisId,
    analysisColumns: context.analysisColumns,
  });
  if (analysisVerdict.ok === false) {
    return { ok: false, reason: `analysis read-back failed: ${analysisVerdict.reason}` };
  }

  // The pack: exactly the three expected statement types, every one of them in
  // the set production just judged READY, one currency across all of them.
  const packVerdict = await verifyPackReadBack({
    read,
    organizationId: context.organizationId,
    packId: context.packId,
    packColumns: context.packColumns,
    verifiedStatementIds,
  });
  if (packVerdict.ok === false) {
    return { ok: false, reason: `pack read-back failed: ${packVerdict.reason}` };
  }

  writes.push({
    kind: 'analysis',
    label: context.analysisId,
    spec: {
      table: 'financial_analyses',
      id: context.analysisId,
      columns: context.analysisColumns,
      assignments: [
        ['status', 'APPROVED'],
        ['approved_by', context.createdBy],
      ],
      literals: [['approved_at', 'CURRENT_TIMESTAMP']],
    },
  });

  writes.push({
    kind: 'pack',
    label: context.packId,
    spec: {
      table: 'financial_statement_packs',
      id: context.packId,
      columns: context.packColumns,
      assignments: [
        ['pack_status', 'confirmed'],
        ['pack_readiness_status', 'ready'],
        ['pack_readiness_score', 100],
        [
          'pack_quality_summary',
          context.isPl
            ? 'Komplet sprawozdań FY2014 (RZiS, bilans, przepływy) — baza dla modelu ROI.'
            : 'Complete FY2014 statement set (P&L, BS, CF) — the baseline the ROI model is grounded on.',
        ],
        ['pack_quality_reason_codes', JSON.stringify([])],
        ['source_statement_count', verifiedStatementIds.size],
        ['missing_statement_types', JSON.stringify([])],
      ],
    },
  });

  return { ok: true, writes };
}

/**
 * Compensating rollback for a promotion that failed part-way.
 *
 * TREATS EVERY PLANNED ROW AS IN DOUBT — all three statements, the analysis and
 * the pack — regardless of what the ledger recorded, and regardless of which
 * write threw.
 *
 * WHY, and why the older "only demote what `ledger.*Issued` recorded" was
 * wrong. A rejected `DbPromise.run()` promise does NOT prove the row was left
 * alone. `promoteRow` → `DbPromise.run` → `PostgresDatabase.run` →
 * `pool.query`: Postgres applies the UPDATE and only then sends the result. A
 * connection reset, a `pg_terminate_backend`, a pool timeout or a proxy hiccup
 * AFTER the row was updated but BEFORE the client saw the response surfaces
 * here as a rejection over an already-promoted row. Statement atomicity in the
 * server says nothing about delivery to the caller. Demoting a row that really
 * was never promoted costs nothing: `promoteRow`'s `IS DISTINCT FROM` guard
 * makes it a zero-row no-op.
 *
 * It then RE-READS all five rows and records any that still claim
 * ready/confirmed/pass/APPROVED. Failures of the rollback itself are recorded,
 * never swallowed: the caller escalates the log line to `error` and says the
 * fixture may still hold promoted rows.
 */
async function rollbackAtelierPromotions(params: {
  /** The PRIMARY-bound reader. The verification re-read is a decisive read. */
  read: SqlReader;
  packId: string;
  analysisId: string;
  /** EVERY statement the promotion phase planned to touch — not just the recorded ones. */
  plannedStatementIds: string[];
  statementColumns: Set<string>;
  analysisColumns: Set<string>;
  packColumns: Set<string>;
  isPl: boolean;
  ledger: AtelierPromotionLedger;
}): Promise<void> {
  const { ledger } = params;
  ledger.rolledBack = true;

  ledger.rollbackErrors.push(
    ...(await demoteAtelierRows({
      packId: params.packId,
      analysisId: params.analysisId,
      statementIds: params.plannedStatementIds,
      statementColumns: params.statementColumns,
      analysisColumns: params.analysisColumns,
      packColumns: params.packColumns,
      isPl: params.isPl,
    }))
  );

  // Do not TAKE the rollback's word for it — read the rows back. Same scope as
  // the demotion: a row whose promotion "failed" may still be sitting there.
  ledger.rowsStillClaimingReady = await findRowsStillClaimingReady({
    read: params.read,
    packId: params.packId,
    analysisId: params.analysisId,
    statementIds: params.plannedStatementIds,
    onError: (message) => ledger.rollbackErrors.push(message),
  });
}

/**
 * Write the phase-1 (not-ready) payload back over the pack, the analysis and the
 * given statements, in reverse order of promotion. Returns one message per
 * failed demotion; never throws.
 *
 * Shared by the compensating rollback (phase 2) and the residual-state heal
 * (phase 0), so a demoted row is byte-identical to a freshly written one in
 * both paths.
 */
async function demoteAtelierRows(params: {
  packId: string;
  analysisId: string;
  statementIds: string[];
  statementColumns: Set<string>;
  analysisColumns: Set<string>;
  packColumns: Set<string>;
  isPl: boolean;
}): Promise<string[]> {
  const errors: string[] = [];

  try {
    await promoteRow({
      table: 'financial_statement_packs',
      id: params.packId,
      columns: params.packColumns,
      assignments: [
        ['pack_status', PHASE1_PACK_STATUS],
        ['pack_readiness_status', PHASE1_PACK_READINESS_STATUS],
        ['pack_readiness_score', PHASE1_PACK_READINESS_SCORE],
        ['pack_quality_summary', phase1PackQualitySummary(params.isPl)],
        ['pack_quality_reason_codes', PHASE1_QUALITY_REASON_CODES],
        ['source_statement_count', 0],
        ['missing_statement_types', PHASE1_MISSING_STATEMENT_TYPES],
      ],
    });
  } catch (error) {
    errors.push(`pack: ${(error as Error).message}`);
  }

  try {
    await promoteRow({
      table: 'financial_analyses',
      id: params.analysisId,
      columns: params.analysisColumns,
      assignments: [
        ['status', 'DRAFT'],
        ['approved_by', null],
        ['approved_at', null],
      ],
    });
  } catch (error) {
    errors.push(`analysis: ${(error as Error).message}`);
  }

  for (const statementId of [...params.statementIds].reverse()) {
    try {
      await promoteRow({
        table: 'financial_statements',
        id: statementId,
        columns: params.statementColumns,
        assignments: [
          ['status', PHASE1_STATEMENT_STATUS],
          ['validation_status', PHASE1_VALIDATION_STATUS],
          ['validation_messages', '[]'],
          ['readiness_status', PHASE1_READINESS_STATUS],
          ['readiness_score', PHASE1_READINESS_SCORE],
          ['quality_summary', phase1StatementQualitySummary(params.isPl)],
          ['quality_reason_codes', PHASE1_QUALITY_REASON_CODES],
          ['confirmed_by', null],
        ],
      });
    } catch (error) {
      errors.push(`statement ${statementId}: ${(error as Error).message}`);
    }
  }

  return errors;
}

/**
 * Phase 0 — heal a fixture a CRASH left half-promoted.
 *
 * The compensating rollback in phase 2 covers a promotion write that FAILS.
 * It cannot cover the process DYING between two promotion UPDATEs — a Railway
 * redeploy SIGTERM, an OOM kill, a `process.exit`. No catch block runs, no
 * result object is ever returned, and the fixture is left with (say) the P&L
 * confirmed/pass/ready while the balance sheet is still pending.
 *
 * So the NEXT run repairs it: if the five promotion-owned rows are in a MIXED
 * state (some claim ready, some do not), every one of them is demoted to the
 * phase-1 payload before phase 1 rewrites the fixture and phase 2 re-earns
 * READY. Without this, a crash followed by a run whose read-back gate refuses
 * would leave a READY statement inside a fixture reported as INCOMPLETE —
 * exactly the state the rest of this module exists to make impossible.
 *
 * MIXED, precisely: at least one but not all five rows claim
 * ready/confirmed/pass/APPROVED. All five = a healthy, fully promoted fixture,
 * left untouched so a second run stays byte-identical. None = a fresh or
 * honestly not-ready fixture, also untouched. A row that does not exist yet
 * counts as not promoted.
 */
async function healResidualAtelierPromotion(params: {
  /** The PRIMARY-bound reader. Compensation is never decided from a replica. */
  read: SqlReader;
  organizationId: string;
  packId: string;
  analysisId: string;
  statementIds: string[];
  statementColumns: Set<string>;
  analysisColumns: Set<string>;
  packColumns: Set<string>;
  isPl: boolean;
}): Promise<void> {
  // Belt and braces. The seed entry point already refuses outright while a hold
  // stands; this second check means the heal cannot be reached from any future
  // caller without the acknowledgement, because the heal is precisely the thing
  // that destroys an in-doubt COMMIT's evidence.
  if (readAtelierFinanceOperatorHold(params.organizationId)) {
    logger.error(
      `[atelier-finance-seed] residual-state heal REFUSED — an unacknowledged NEEDS_OPERATOR hold stands for organization "${params.organizationId}"`
    );
    return;
  }

  const readErrors: string[] = [];
  const stillPromoted = await findRowsStillClaimingReady({
    read: params.read,
    packId: params.packId,
    analysisId: params.analysisId,
    statementIds: params.statementIds,
    onError: (message) => readErrors.push(message),
  });

  const total = params.statementIds.length + 2; // + analysis + pack
  if (readErrors.length > 0) {
    // Reading the current state failed (table absent in this environment, or a
    // transport error). Not fatal: phase 1 + phase 2 still fail closed.
    logger.warn('[atelier-finance-seed] could not inspect residual promotion state on entry', {
      errors: readErrors,
    });
  }
  if (stillPromoted.length === 0 || stillPromoted.length === total) return;

  logger.warn(
    `[atelier-finance-seed] residual MIXED promotion state found on entry (${stillPromoted.length}/${total} rows claim READY) — ` +
      'demoting the whole fixture before re-seeding; a previous run was almost certainly killed mid-promotion',
    { rowsClaimingReady: stillPromoted }
  );

  const errors = await demoteAtelierRows(params);
  if (errors.length > 0) {
    logger.warn('[atelier-finance-seed] residual-state heal did not fully complete', { errors });
  }
}

/**
 * Re-read the five rows the promotion phase can touch and return the ids of any
 * that still claim a READY-flavoured state. Used to VERIFY a rollback instead of
 * asserting it worked.
 */
async function findRowsStillClaimingReady(params: {
  /**
   * REQUIRED, and required on purpose (FIN-005 P1-A). This used to default to
   * `dbPromiseReader`, i.e. the READ pool. Every caller of this function is
   * deciding whether to COMPENSATE — phase 0's heal demotes the fixture on what
   * it reads here, and the rollback verification reports "rows still claiming
   * READY" from it. Reading a lagging replica turns a healthy fixture into a
   * mixed one and a completed rollback into an operator escalation. There is no
   * default any more, so no future caller can acquire one by omission.
   */
  read: SqlReader;
  packId: string;
  analysisId: string;
  statementIds: string[];
  onError: (message: string) => void;
}): Promise<string[]> {
  const claims = await readPromotionClaims({
    read: params.read,
    packId: params.packId,
    analysisId: params.analysisId,
    statementIds: params.statementIds,
    onError: (message) => params.onError(`rollback verification ${message}`),
  });
  return claims.filter((claim) => claim.claimsReady).map((claim) => claim.id);
}

// ---------------------------------------------------------------------------
// PRE-STATE / POST-STATE — how a lost COMMIT ack is classified (FIN-005 P1-3b)
// ---------------------------------------------------------------------------
//
// WHAT WAS WRONG WITH FLAGS. The reconciliation used to answer `not-committed`
// whenever no row "claimed READY", and `committed` whenever they all did.
// `claimsReady` is an OR over three columns, and no snapshot of the rows was
// ever taken, so:
//   - a row a concurrent actor had moved to some THIRD state was reported as
//     "in its pre-promotion state" — a claim nothing had checked;
//   - on a fixture whose rows were ALREADY confirmed/pass/ready from an earlier
//     run, a transaction that genuinely rolled back reconciled to
//     `lost-then-confirmed`, because the coherence re-run never reads
//     `pack_readiness_score`, `source_statement_count` or
//     `missing_statement_types` either.
//
// So the classification now compares FULL ROWS against two exactly-known states:
// the snapshot taken inside `plan(read)` while the rows are held under
// `FOR UPDATE`, and the state the planned writes intended. Neither is a guess,
// and anything matching neither is INDETERMINATE.

/** Every promotion-owned column, per table. Read together, compared together. */
const PROMOTION_STATE_COLUMNS = {
  statement: [
    'status',
    'validation_status',
    'validation_messages',
    'readiness_status',
    'readiness_score',
    'quality_summary',
    'quality_reason_codes',
    'confirmed_by',
  ],
  analysis: ['status', 'approved_by', 'approved_at'],
  pack: [
    'pack_status',
    'pack_readiness_status',
    'pack_readiness_score',
    'pack_quality_summary',
    'pack_quality_reason_codes',
    'source_statement_count',
    'missing_statement_types',
  ],
} as const;

/**
 * Marker for a column the promotion sets to a SQL literal whose value cannot be
 * predicted (`approved_at = CURRENT_TIMESTAMP`). The post-state requires it to
 * be present; it cannot require WHICH timestamp.
 */
const EXPECT_NOT_NULL = '~~expect:not-null';
const CANONICAL_NULL = '~~null';

/**
 * One comparable string per cell, so a value that came back from the driver as
 * a number, a `Date` or a JSON-ish string compares equal to the JS value the
 * write intended. `real`/`integer` columns arrive as numbers, the JSON columns
 * on these tables are `text`, and both sides have to land on the same token.
 */
function canonicalCell(value: unknown): string {
  if (value === null || value === undefined) return CANONICAL_NULL;
  if (value instanceof Date) return `~~date:${value.toISOString()}`;
  if (typeof value === 'boolean') return `~~bool:${value}`;
  if (typeof value === 'object') return JSON.stringify(value);

  const text = String(value);
  const trimmed = text.trim();

  // NUMBERS FIRST, TO SIX SIGNIFICANT DIGITS. `readiness_score` and
  // `pack_readiness_score` are `real` (float4): a JS double written as 92.3 reads
  // back as 92.30000305175781, and comparing raw representations would report a
  // perfectly committed row as "matches neither state" — a spurious
  // NEEDS_OPERATOR. Six digits is inside float4's guaranteed precision. It also
  // makes `numeric` columns (which arrive as strings) and `integer` columns
  // (which arrive as numbers) land on the same token.
  if (trimmed !== '' && Number.isFinite(Number(trimmed))) {
    return `~~num:${Number(Number(trimmed).toPrecision(6))}`;
  }

  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    try {
      return JSON.stringify(JSON.parse(trimmed));
    } catch {
      /* not JSON after all — compare the raw text */
    }
  }
  return text;
}

/** rowId -> canonical column map, or `null` when the row was absent. */
type PromotionRowState = Record<string, string> | null;
type PromotionStateSnapshot = Record<string, PromotionRowState>;

function selectableColumns(wanted: readonly string[], known: Set<string>): string[] {
  if (known.size === 0) return [...wanted];
  return wanted.filter((column) => known.has(column.toLowerCase()));
}

/**
 * Read the promotion-owned columns of all five rows.
 *
 * THROWS on a read failure, deliberately. Called from inside `plan(read)`, where
 * a throw aborts the pinned transaction — if the pre-state cannot be
 * established, the transaction must not be allowed to commit, because a lost
 * COMMIT ack would then have nothing to be classified against.
 */
async function readPromotionState(params: {
  read: SqlReader;
  packId: string;
  analysisId: string;
  statementIds: string[];
  statementColumns: Set<string>;
  analysisColumns: Set<string>;
  packColumns: Set<string>;
}): Promise<PromotionStateSnapshot> {
  const snapshot: PromotionStateSnapshot = {};

  const capture = async (table: string, id: string, columns: string[]): Promise<void> => {
    if (columns.length === 0) {
      throw new Error(`no promotion-owned column is readable on ${table}`);
    }
    const rows = await params.read(`SELECT ${columns.join(', ')} FROM ${table} WHERE id = ?`, [id]);
    if (rows.length === 0) {
      snapshot[id] = null;
      return;
    }
    const state: Record<string, string> = {};
    for (const column of columns) state[column] = canonicalCell(rows[0][column]);
    snapshot[id] = state;
  };

  for (const statementId of params.statementIds) {
    await capture(
      'financial_statements',
      statementId,
      selectableColumns(PROMOTION_STATE_COLUMNS.statement, params.statementColumns)
    );
  }
  await capture(
    'financial_analyses',
    params.analysisId,
    selectableColumns(PROMOTION_STATE_COLUMNS.analysis, params.analysisColumns)
  );
  await capture(
    'financial_statement_packs',
    params.packId,
    selectableColumns(PROMOTION_STATE_COLUMNS.pack, params.packColumns)
  );

  return snapshot;
}

/**
 * The state the planned writes INTEND, derived from the very specs that are
 * executed — same filter on `columns` as `buildPromotionUpdate`, so the two
 * cannot describe different rows.
 */
function intendedPromotionState(writes: PlannedPromotionWrite[]): PromotionStateSnapshot {
  const intended: PromotionStateSnapshot = {};
  for (const write of writes) {
    const known = write.spec.columns.size > 0 ? write.spec.columns : null;
    const state: Record<string, string> = {};
    for (const [column, value] of write.spec.assignments) {
      if (known && !known.has(column.toLowerCase())) continue;
      state[column] = canonicalCell(value);
    }
    for (const [column] of write.spec.literals ?? []) {
      if (known && !known.has(column.toLowerCase())) continue;
      // `CURRENT_TIMESTAMP` — the value is unknowable, its presence is not.
      state[column] = EXPECT_NOT_NULL;
    }
    intended[write.label] = state;
  }
  return intended;
}

/** Does `actual` satisfy every column `expected` names? */
function stateMatches(expected: PromotionRowState, actual: PromotionRowState): boolean {
  if (expected === null || actual === null) return expected === actual;
  for (const [column, want] of Object.entries(expected)) {
    const got = actual[column];
    if (want === EXPECT_NOT_NULL) {
      if (got === undefined || got === CANONICAL_NULL) return false;
      continue;
    }
    if (got !== want) return false;
  }
  return true;
}

/** First disagreement, for the operator's log line. */
function describeStateDiff(expected: PromotionRowState, actual: PromotionRowState): string {
  if (expected === null) return actual === null ? 'identical' : 'expected the row to be absent';
  if (actual === null) return 'the row is absent';
  for (const [column, want] of Object.entries(expected)) {
    const got = actual[column];
    if (want === EXPECT_NOT_NULL) {
      if (got === undefined || got === CANONICAL_NULL) return `${column} is null, expected a value`;
      continue;
    }
    if (got !== want) return `${column}=${JSON.stringify(got)} expected ${JSON.stringify(want)}`;
  }
  return 'identical';
}

interface PromotionClaim {
  id: string;
  kind: 'statement' | 'analysis' | 'pack';
  /** True when the persisted row asserts a READY-flavoured state. */
  claimsReady: boolean;
  /** False when the row is absent entirely. */
  exists: boolean;
}

/**
 * The single place that decides "does this persisted row CLAIM to be ready?".
 *
 * Both directions of the FIN-005 contract read it: the compensating rollback
 * wants the answer to be NO for all five rows, the pinned transaction's
 * pre-COMMIT read-back wants it to be YES for all five. One predicate means the
 * two can never disagree about what READY looks like on disk.
 */
async function readPromotionClaims(params: {
  read: SqlReader;
  packId: string;
  analysisId: string;
  statementIds: string[];
  onError: (message: string) => void;
}): Promise<PromotionClaim[]> {
  const claims: PromotionClaim[] = [];

  for (const statementId of params.statementIds) {
    try {
      const rows = await params.read(
        `SELECT id, status, validation_status, readiness_status
           FROM financial_statements
          WHERE id = ?`,
        [statementId]
      );
      claims.push({
        id: statementId,
        kind: 'statement',
        exists: rows.length > 0,
        claimsReady: rows.some(
          (row) =>
            String(row.status ?? '') === 'confirmed' ||
            String(row.validation_status ?? '') === 'pass' ||
            String(row.readiness_status ?? '') === 'ready'
        ),
      });
    } catch (error) {
      params.onError(`of ${statementId} failed: ${(error as Error).message}`);
    }
  }

  try {
    const rows = await params.read(`SELECT id, status FROM financial_analyses WHERE id = ?`, [
      params.analysisId,
    ]);
    claims.push({
      id: params.analysisId,
      kind: 'analysis',
      exists: rows.length > 0,
      claimsReady: rows.some((row) => String(row.status ?? '') === 'APPROVED'),
    });
  } catch (error) {
    params.onError(`of the analysis failed: ${(error as Error).message}`);
  }

  try {
    const rows = await params.read(
      `SELECT id, pack_status, pack_readiness_status FROM financial_statement_packs WHERE id = ?`,
      [params.packId]
    );
    claims.push({
      id: params.packId,
      kind: 'pack',
      exists: rows.length > 0,
      claimsReady: rows.some(
        (row) =>
          String(row.pack_status ?? '') === 'confirmed' ||
          String(row.pack_readiness_status ?? '') === 'ready'
      ),
    });
  } catch (error) {
    params.onError(`of the pack failed: ${(error as Error).message}`);
  }

  return claims;
}

async function verifyAnalysisReadBack(params: {
  read: SqlReader;
  organizationId: string;
  packId: string;
  analysisId: string;
  analysisColumns: Set<string>;
}): Promise<{ ok: boolean; reason?: string }> {
  let rows: Array<Record<string, unknown>>;
  try {
    rows = await params.read(
      `SELECT id, organization_id, source_statement_pack_id, currency
         FROM financial_analyses
        WHERE id = ?`,
      [params.analysisId]
    );
  } catch (error) {
    return { ok: false, reason: `query failed: ${(error as Error).message}` };
  }

  if (rows.length !== 1)
    return { ok: false, reason: `expected 1 analysis row, got ${rows.length}` };
  const row = rows[0];
  if (String(row.organization_id ?? '') !== params.organizationId) {
    return {
      ok: false,
      reason: `organization_id mismatch: ${String(row.organization_id ?? 'null')}`,
    };
  }
  if (String(row.source_statement_pack_id ?? '') !== params.packId) {
    return {
      ok: false,
      reason: `source_statement_pack_id mismatch: ${String(row.source_statement_pack_id ?? 'null')}`,
    };
  }
  const currency = String(row.currency ?? '')
    .trim()
    .toUpperCase();
  if (currency && currency !== ATELIER_FINANCE_CURRENCY) {
    return { ok: false, reason: `currency mismatch: ${currency} != ${ATELIER_FINANCE_CURRENCY}` };
  }
  return { ok: true };
}

async function verifyPackReadBack(params: {
  read: SqlReader;
  organizationId: string;
  packId: string;
  packColumns: Set<string>;
  /**
   * The statements production has just judged READY. The pack gate checks
   * membership of THIS set rather than the persisted `readiness_status`, because
   * the atomic phase 2 verifies the pack BEFORE issuing any promotion — the
   * stored status is still `pending` at that moment, by design. Membership is
   * the stronger check anyway: it also rejects a foreign statement that has been
   * attached to the canonical pack.
   */
  verifiedStatementIds: Set<string>;
}): Promise<{ ok: boolean; reason?: string }> {
  let packRows: Array<Record<string, unknown>>;
  let statementRows: Array<Record<string, unknown>>;
  try {
    packRows = await params.read(
      `SELECT id, organization_id, entity_name, currency, period_label
         FROM financial_statement_packs
        WHERE id = ?`,
      [params.packId]
    );
    statementRows = await params.read(
      `SELECT id, statement_type, currency
         FROM financial_statements
        WHERE statement_pack_id = ?`,
      [params.packId]
    );
  } catch (error) {
    return { ok: false, reason: `query failed: ${(error as Error).message}` };
  }

  if (packRows.length !== 1)
    return { ok: false, reason: `expected 1 pack row, got ${packRows.length}` };
  const pack = packRows[0];
  if (String(pack.organization_id ?? '') !== params.organizationId) {
    return {
      ok: false,
      reason: `organization_id mismatch: ${String(pack.organization_id ?? 'null')}`,
    };
  }

  const expectedTypes = ATELIER_FY2014_STATEMENTS.map(
    (statement) => statement.statementType
  ).sort();
  const actualTypes = statementRows.map((row) => String(row.statement_type ?? '')).sort();
  if (actualTypes.join('|') !== expectedTypes.join('|')) {
    return {
      ok: false,
      reason: `pack holds [${actualTypes.join(', ')}], expected [${expectedTypes.join(', ')}]`,
    };
  }

  const unverified = statementRows.filter(
    (row) => !params.verifiedStatementIds.has(String(row.id ?? ''))
  );
  if (unverified.length > 0) {
    return {
      ok: false,
      reason: `${unverified.length} statement(s) under the pack were not judged READY by production: ${unverified
        .map((row) => String(row.id ?? 'null'))
        .join(', ')}`,
    };
  }

  // One single currency across the pack and every statement under it.
  const currencies = new Set(
    [pack, ...statementRows].map((row) =>
      String(row.currency ?? '')
        .trim()
        .toUpperCase()
    )
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
    logger.warn('[atelier-finance-seed] analysis write failed', {
      error: (error as Error).message,
    });
    return null;
  }

  return analysisId;
}

// ---------------------------------------------------------------------------
// FIN-005 round 8 — financeFixtureComplete vs financeGoldenFlowComplete
// ---------------------------------------------------------------------------

/**
 * `AtelierFinanceSeedResult.status === 'complete'` (above) has ALWAYS meant
 * only "the statement pack + 3 statements + approved analysis exist, are
 * grounded and were promoted" — it never asserted anything about the model's
 * investment case, because the model is seeded by a SEPARATE function
 * (`upsertAtelierRoiFinancialModel`, demoSeedService.ts) that this file does
 * not call. The field name `financeGoldenFlow` on the overall demo-seed
 * result (demoSeedService.ts's return value) invites exactly the wrong
 * reading: that `.status === 'complete'` certifies the WHOLE golden flow,
 * NPV/ROI/payback included. Before round 8 nothing computed those at all —
 * `financial_model_outputs` stayed empty and the UI showed "compute not run
 * yet" regardless of what this field said.
 *
 * This type names the two claims separately so a caller cannot read one and
 * assume the other:
 *   - `fixtureComplete` — the canonical inputs exist: statement pack,
 *     analysis, model, and its forecast events, with lineage. Equivalent to
 *     `AtelierFinanceSeedResult.status === 'complete'`.
 *   - `goldenFlowComplete` — a user can open the model and get a REAL,
 *     non-hardcoded NPV/IRR/payback, computed by the canonical engines
 *     (`computeModel` + `investmentAppraisalService.appraise`, composed by
 *     `financialModelAppraisalAdapter`), and reopening produces the same
 *     result from the same stored events. `fixtureComplete` alone can never
 *     make this `true` — it is only set after actually invoking both engines
 *     and getting a finite result back.
 */
export interface AtelierFinanceGoldenFlowCompleteness {
  fixtureComplete: boolean;
  goldenFlowComplete: boolean;
  /** Present when `goldenFlowComplete` is false — never silently omitted. */
  reason?: string;
  /** The appraisal actually computed, when `goldenFlowComplete` is true — evidence, not a claim. */
  appraisal?: ModelAppraisal;
}

/**
 * FIN-005 round 10 (Codex fix) — resolve the discount/hurdle rate STRICTLY
 * from the model's own `assumptions_json`. This is the golden-flow
 * ACCEPTANCE path: unlike round 9's version, there is NO fallback to
 * `ATELIER_CANONICAL_DISCOUNT_RATE_PCT` here anymore. A model read failure,
 * a missing `assumptions_json`, or a non-numeric `discountRatePct` are all
 * refusals (`{ ok: false }`), never silently patched over — a golden flow
 * cannot be "complete" on a rate nobody can point to in the data. This
 * mirrors `GET /models/:modelId/appraisal`'s own contract (finance.routes.ts):
 * an explicit rate or nothing — the route and this checker must agree on
 * what "no rate" means, so a demo that would 400 at the API can never
 * silently read as `goldenFlowComplete: true` here.
 *
 * `assumptions_json.discountRatePct` / `.hurdleRatePct` are written by
 * `upsertAtelierRoiFinancialModel()` (demoSeedService.ts), seeded FROM
 * `ATELIER_CANONICAL_DISCOUNT_RATE_PCT` — that constant's only remaining job
 * is supplying that one seed write, not accepting a completeness verdict.
 *
 * Read-only: `getModel()` (`financialModelingService.ts`) only SELECTs
 * `financial_models`; nothing is written here. Deliberately calls the
 * already-exported `getModel()` rather than `DbPromise.get`/`.all` directly —
 * `atelierFinancePrimaryReadStructure.test.ts` asserts this file never calls
 * those two functions itself.
 */
type AtelierAppraisalRateResolution =
  | { ok: true; discountRatePct: number; hurdleRatePct: number }
  | { ok: false; reason: string };

async function resolveAtelierAppraisalRates(
  modelId: string,
  organizationId: string
): Promise<AtelierAppraisalRateResolution> {
  let model: Awaited<ReturnType<typeof getModel>>;
  try {
    model = await getModel(modelId, organizationId);
  } catch (error) {
    return {
      ok: false,
      reason: `could not read model "${modelId}" to resolve its appraisal rate: ${(error as Error).message}`,
    };
  }

  const raw = model?.assumptions_json;
  const assumptions: Record<string, unknown> =
    raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};

  const discountRatePct = assumptions.discountRatePct;
  if (typeof discountRatePct !== 'number' || !Number.isFinite(discountRatePct)) {
    return {
      ok: false,
      reason: `assumptions_json.discountRatePct is missing or not a finite number on model "${modelId}" — the golden flow requires an explicit, data-carried rate, never a hardcoded acceptance default`,
    };
  }

  const hurdleRatePctRaw = assumptions.hurdleRatePct;
  const hurdleRatePct =
    typeof hurdleRatePctRaw === 'number' && Number.isFinite(hurdleRatePctRaw)
      ? hurdleRatePctRaw
      : discountRatePct;

  return { ok: true, discountRatePct, hurdleRatePct };
}

/**
 * Verify golden-flow completeness for the canonical Atelier model. Read-only:
 * `computeModel()` only SELECTs the model and its events; nothing is written
 * or persisted to `financial_model_outputs` by this check.
 *
 * `fixtureStatus` is the caller's already-computed `AtelierFinanceSeedResult`
 * (or any equivalent) — passed in rather than re-derived, so this function
 * cannot silently disagree with the seed's own verdict about the statement/
 * analysis leg.
 */
export async function verifyAtelierFinanceGoldenFlowComplete(
  organizationId: string,
  fixtureStatus: 'complete' | 'incomplete'
): Promise<AtelierFinanceGoldenFlowCompleteness> {
  const fixtureComplete = fixtureStatus === 'complete';
  if (!fixtureComplete) {
    return {
      fixtureComplete: false,
      goldenFlowComplete: false,
      reason:
        'the statement/analysis fixture is not complete — golden flow cannot be evaluated on top of it',
    };
  }

  const modelId = atelierCanonicalModelId(organizationId);
  let computeResult;
  try {
    computeResult = await computeModel(modelId);
  } catch (error) {
    return {
      fixtureComplete: true,
      goldenFlowComplete: false,
      reason: `computeModel() failed for "${modelId}": ${(error as Error).message}`,
    };
  }

  // `computeModel()` always generates periods from `model.start_date` /
  // `horizon_months` — that happens with ZERO events too, all zeroed out. A
  // truly empty investment case (no events) must not read as "complete" just
  // because the shape of the result is well-formed; require at least one
  // period with real (non-zero) cash-flow activity.
  const hasComputedActivity = computeResult.periods.some(
    (period) =>
      (period.cf.OPERATING_CF ?? 0) !== 0 ||
      (period.cf.INVESTING_CF ?? 0) !== 0 ||
      (period.cf.FINANCING_CF ?? 0) !== 0
  );
  if (computeResult.periods.length === 0 || !hasComputedActivity) {
    return {
      fixtureComplete: true,
      goldenFlowComplete: false,
      reason: `computeModel() produced no cash-flow activity for "${modelId}" — no active forecast events, or the model horizon is empty`,
    };
  }

  const rates = await resolveAtelierAppraisalRates(modelId, organizationId);
  if (rates.ok === false) {
    return {
      fixtureComplete: true,
      goldenFlowComplete: false,
      reason: rates.reason,
    };
  }
  const appraisal = appraiseComputeResult(computeResult, {
    discountRatePct: rates.discountRatePct,
    hurdleRatePct: rates.hurdleRatePct,
  });

  if (!Number.isFinite(appraisal.result.npv)) {
    return {
      fixtureComplete: true,
      goldenFlowComplete: false,
      reason: `appraise() returned a non-finite NPV (${appraisal.result.npv}) for "${modelId}"`,
      appraisal,
    };
  }

  return { fixtureComplete: true, goldenFlowComplete: true, appraisal };
}
