#!/usr/bin/env tsx
/**
 * GoldCo Manufacturing Group — INDEPENDENT workbook-oracle (Gate D / Fala 3,
 * gold vertical slice, per FINANCE_COMPLETE_PROGRAM_CLAUDE_HANDOFF_2026-08-09.md
 * section 13).
 *
 * THIS FILE IS THE ORACLE, NOT THE SYSTEM UNDER TEST. It does its own
 * arithmetic by hand (plain +/-/* on plain numbers), with every formula
 * spelled out in a comment next to it. It does NOT import, call, or in any
 * way depend on `statementMappingService.ts` / `statementReconciliationService.ts`
 * / any `finance_stmt_*` SQL trigger. `goldco_pipeline.ts` (the system under
 * test) is run separately and its output is compared against the JSON this
 * file writes, in `goldco_compare.ts`. This separation is the entire point
 * of a "gold vertical slice with independent oracle" per the master plan
 * section 13 and addendum point 16 ("Known-answer evidence... niezależne
 * workbooki").
 *
 * GoldCo Manufacturing Group — company narrative:
 *  - GoldCo Manufacturing S.A. ("PARENT"), Warsaw, Poland, functional/
 *    presentation currency PLN. Mid-size industrial manufacturer (metal
 *    components for automotive/machinery OEMs).
 *  - GoldCo Deutschland GmbH ("SUB"), Germany, functional currency EUR.
 *    80%-owned subsidiary (20% non-controlling interest / NCI), full
 *    consolidation method, acquired at the start of FY2023 (so FY2023 is
 *    the first year both entities are on record and the first year the
 *    group's historical-rate equity translation baseline is set).
 *  - FY2023, FY2024 (original THEN restated — inventory valuation error
 *    discovered post-close, corrected as an ERROR_CORRECTION restatement),
 *    FY2025 (built on the RESTATED FY2024 closing position, as a real
 *    close would be), plus FY2025 monthly P&L detail for PARENT.
 *  - One FY2025 intercompany elimination: a PLN 3,320,000 loan from PARENT
 *    to SUB (SUB's matching liability, translated at the FY2025 closing
 *    rate, is EUR 800,000 exactly by construction), eliminated in the
 *    FY2025 consolidated pack.
 *
 * Units: PLN for the parent and all consolidated/translated figures, EUR
 * for the subsidiary's own standalone figures. Unit=UNITS (no scaling) —
 * chosen over THOUSANDS/MILLIONS so every number in this file and in the
 * pipeline output is a literal, directly comparable integer with no
 * rounding-of-rounding ambiguity.
 *
 * Simplifying, EXPLICITLY documented scope decisions (see the report's
 * "Scope decisions" section for the full list, not hidden here):
 *  1. The FY2024 restatement correction is modeled as pretax-neutral on tax
 *     (TAX_EXPENSE unchanged between original/restated) — avoids needing a
 *     deferred-tax/tax-payable BS line the canonical taxonomy does not yet
 *     have. Net effect: the entire PLN 3,000,000 inventory write-down flows
 *     straight through to NET_INCOME and RETAINED_EARNINGS with no residual
 *     tax plug.
 *  2. No intercompany P&L (revenue/COGS) elimination is modeled, only ONE
 *     intercompany BALANCE SHEET elimination (the intercompany loan). The
 *     schema's elimination-balance trigger (WP-D01 section 5.4 / migration
 *     `20260809_finance_v3_d01_statements_02_integrity.sql` section 8.5)
 *     nets ELIMINATION-scope rows PER canonical_line_id — a revenue/COGS
 *     elimination would need both legs booked under one shared canonical
 *     line to net to zero under that design, which would be a contrived
 *     construction for a demonstration slice. One clean, realistic BS
 *     elimination is sufficient to exercise the mechanism end-to-end.
 *  3. Sub does not pay a dividend in FY2024/FY2025 (kept 0) — avoids needing
 *     to model an intercompany-dividend elimination against an
 *     investment-in-subsidiary equity-method balance, out of scope for a
 *     Statements-layer (Fala 3) slice.
 *  4. The consolidated pack is built for FY2025 only (not FY2023/FY2024) —
 *     the mechanism (translation + elimination + NCI) is proven once, at
 *     full depth, rather than shallowly repeated three times.
 *  5. FY2025 monthly detail is P&L-only for PARENT (not full BS/CF per
 *     month) — matches the master plan's "monthly detail for at least one
 *     year" literally without requiring twelve balanced monthly balance
 *     sheets, which is not what the brief's `flow/stock` distinction
 *     requires for a flow-only account like revenue.
 */

import fs from 'node:fs';
import path from 'node:path';

// ---------------------------------------------------------------------------
// FX rates (EUR -> PLN). AVERAGE for flow (P&L) lines, CLOSING for BS stock
// lines, HISTORICAL (rate at acquisition, start of FY2023) for BS equity
// components — standard IAS 21 current-rate method for a foreign subsidiary.
// ---------------------------------------------------------------------------
const FX = {
  FY2023: { average: 4.5, closing: 4.55 },
  FY2024: { average: 4.3, closing: 4.25 },
  FY2025: { average: 4.2, closing: 4.15 },
  historical: 4.5, // rate at acquisition (start of FY2023), used for translating equity in every year
};

const OWNERSHIP_PCT = 80; // PARENT's ownership of SUB
const NCI_PCT = 20; // 100 - 80

// ---------------------------------------------------------------------------
// PARENT (GoldCo Manufacturing S.A.), PLN, standalone figures as reported.
// ---------------------------------------------------------------------------
const parent = {
  FY2023: {
    revenue: 150_000_000,
    cogs: 95_000_000,
    opex: 30_000_000,
    depreciation: 6_000_000,
    interest: 2_000_000,
    taxExpense: 3_230_000,
    cash: 8_000_000,
    ar: 22_000_000,
    inventory: 18_000_000,
    fixedAssets: 92_000_000,
    ap: 15_000_000,
    longTermDebt: 40_000_000,
    dividendsDeclared: 5_000_000,
    openingRetainedEarnings: null as number | null, // first period on record -> roll-forward check is skipped (no previous_period_id)
    cfo: 20_000_000,
    cfi: -14_000_000,
    cff: -6_000_000,
  },
  FY2024_original: {
    revenue: 165_000_000,
    cogs: 106_000_000,
    opex: 32_000_000,
    depreciation: 6_500_000,
    interest: 2_200_000,
    taxExpense: 3_477_000,
    cash: 9_500_000,
    ar: 24_000_000,
    inventory: 21_000_000, // BEFORE the write-down is discovered
    fixedAssets: 96_500_000,
    ap: 16_500_000,
    longTermDebt: 42_000_000,
    dividendsDeclared: 6_000_000,
    cfo: 12_000_000,
    cfi: -8_000_000,
    cff: -2_500_000,
  },
  // Restatement: an inventory valuation error is discovered after the FY2024
  // original pack was APPROVED — obsolete/slow-moving stock was carried at
  // cost instead of net realizable value. Correction: -3,000,000 PLN to
  // inventory, +3,000,000 PLN to COGS (ERROR_CORRECTION restatement class).
  // Cash is UNCHANGED (non-cash correction) -> CFO/CFI/CFF/NET_CHANGE_CASH
  // identical to the original. TAX_EXPENSE held constant (see scope decision
  // #1 above), so the full pretax delta flows straight to NET_INCOME.
  restatement: {
    reason: 'Inventory valuation error discovered during FY2025 Q1 close: obsolete/slow-moving finished-goods stock at the Radom plant was carried at cost instead of net realizable value in the FY2024 audited pack.',
    restatementClass: 'ERROR_CORRECTION' as const,
    inventoryWriteDown: 3_000_000,
  },
  FY2025: {
    revenue: 182_000_000,
    cogs: 118_000_000,
    opex: 34_000_000,
    depreciation: 7_000_000,
    interest: 2_000_000,
    taxExpense: 3_990_000,
    cash: 11_000_000,
    ar: 26_000_000,
    inventory: 19_500_000,
    fixedAssets: 101_500_000,
    ap: 17_500_000,
    longTermDebt: 40_500_000,
    dividendsDeclared: 7_000_000,
    cfo: 15_000_000,
    cfi: -9_000_000,
    cff: -4_500_000,
  },
  // FY2025 monthly REVENUE seasonality weights (manufacturer: soft Jan/Aug,
  // Q4 peak before year-end OEM stock-builds), sum of weights = 12 exactly
  // so monthlyRevenue.reduce(sum) === FY2025.revenue after the residual fix
  // applied in computeMonthly() below. COGS/OPEX use the SAME weight per
  // month (constant gross-margin-ratio and opex-ratio assumption across the
  // year, an explicit simplification — real seasonality of margin is out of
  // scope for this slice).
  monthlyWeights: [0.75, 0.78, 0.85, 0.88, 0.95, 1.0, 0.92, 0.7, 1.02, 1.15, 1.2, 1.8],
};

// ---------------------------------------------------------------------------
// SUB (GoldCo Deutschland GmbH), EUR, standalone figures as reported.
// ---------------------------------------------------------------------------
const sub = {
  FY2023: {
    revenue: 9_000_000,
    cogs: 5_800_000,
    opex: 1_900_000,
    depreciation: 400_000,
    interest: 100_000,
    taxExpense: 200_000,
    cash: 600_000,
    ar: 1_400_000,
    inventory: 1_000_000,
    fixedAssets: 5_500_000,
    ap: 900_000,
    longTermDebt: 2_600_000,
    dividendsDeclared: 0,
  },
  FY2024: {
    revenue: 9_800_000,
    cogs: 6_300_000,
    opex: 2_050_000,
    depreciation: 420_000,
    interest: 110_000,
    taxExpense: 230_000,
    cash: 750_000,
    ar: 1_550_000,
    inventory: 1_100_000,
    fixedAssets: 5_800_000,
    ap: 950_000,
    longTermDebt: 2_650_000,
    dividendsDeclared: 0,
  },
  FY2025: {
    revenue: 10_700_000,
    cogs: 6_900_000,
    opex: 2_200_000,
    depreciation: 440_000,
    interest: 100_000,
    taxExpense: 265_000,
    cash: 900_000,
    ar: 1_700_000,
    inventory: 1_200_000,
    fixedAssets: 6_100_000,
    ap: 1_000_000,
    longTermDebt: 2_700_000,
    dividendsDeclared: 0,
    // SUB's book of the intercompany loan liability: EUR 800,000 exactly
    // (translated at the FY2025 closing rate, that is PLN 3,320,000 — the
    // same amount PARENT records as an intercompany loan RECEIVABLE).
    intercompanyLoanPayableEur: 800_000,
  },
};

const INTERCOMPANY_LOAN_PLN = 3_320_000; // PARENT's receivable, PLN, FY2025 only
// Sanity check at module load: 800,000 EUR * 4.15 closing rate must equal
// the PLN amount above EXACTLY, by construction (documented, not a coincidence).
if (Math.abs(sub.FY2025.intercompanyLoanPayableEur * FX.FY2025.closing - INTERCOMPANY_LOAN_PLN) > 1e-9) {
  throw new Error('oracle internal inconsistency: intercompany loan legs do not translate to the same PLN amount');
}

// ---------------------------------------------------------------------------
// Derived P&L / BS values, per entity per year (oracle formulas, verbatim).
// ---------------------------------------------------------------------------
type PLInputs = { revenue: number; cogs: number; opex: number; depreciation: number; interest: number; taxExpense: number };
type BSInputs = { cash: number; ar: number; inventory: number; fixedAssets: number; ap: number; longTermDebt: number };

function derivePL(x: PLInputs) {
  const grossMargin = x.revenue - x.cogs; // GROSS_MARGIN = REVENUE - COGS
  const ebitda = grossMargin - x.opex; // EBITDA = GROSS_MARGIN - OPEX
  const ebit = ebitda - x.depreciation; // EBIT = EBITDA - DEPRECIATION
  const pretax = ebit - x.interest; // pretax income = EBIT - INTEREST_EXPENSE
  const netIncome = pretax - x.taxExpense; // NET_INCOME = pretax - TAX_EXPENSE
  return { ...x, grossMargin, ebitda, ebit, pretax, netIncome };
}

function deriveBS(x: BSInputs) {
  const currentAssets = x.cash + x.ar + x.inventory; // CURRENT_ASSETS = CASH + AR + INVENTORY
  const totalAssets = currentAssets + x.fixedAssets; // TOTAL_ASSETS = CURRENT_ASSETS + FIXED_ASSETS
  const currentLiabilities = x.ap; // CURRENT_LIABILITIES = AP (no other current-liability line modeled)
  const totalLiabilities = currentLiabilities + x.longTermDebt; // TOTAL_LIABILITIES = CURRENT_LIABILITIES + LONG_TERM_DEBT
  return { ...x, currentAssets, totalAssets, currentLiabilities, totalLiabilities };
}

// Equity is solved as a PLUG so standalone statements balance exactly
// (TOTAL_EQUITY = TOTAL_ASSETS - TOTAL_LIABILITIES); this is standard
// oracle construction for a synthetic dataset (real filings work the other
// direction: equity movements are booked first and assets/liabilities are
// what they are) and is explicitly NOT how the pipeline is allowed to
// derive equity — the pipeline receives this same TOTAL_EQUITY number as an
// already-computed "parsed" input line, per the mapping service's documented
// scope boundary (no derivation logic in statementMappingService.ts).
function withEquityPlug(bs: ReturnType<typeof deriveBS>) {
  const totalEquity = bs.totalAssets - bs.totalLiabilities;
  const totalLiabilitiesEquity = bs.totalLiabilities + totalEquity;
  return { ...bs, totalEquity, totalLiabilitiesEquity };
}

// Retained-earnings roll-forward: closing = opening + NET_INCOME - DIVIDENDS_DECLARED.
function rollForwardRE(openingRE: number, netIncome: number, dividendsDeclared: number) {
  return openingRE + netIncome - dividendsDeclared;
}

// ---------------------------------------------------------------------------
// Build PARENT standalone oracle rows, FY2023 -> FY2024(orig) -> FY2024(restated) -> FY2025.
// ---------------------------------------------------------------------------
const parentFY2023PL = derivePL(parent.FY2023);
const parentFY2023BS = withEquityPlug(deriveBS(parent.FY2023));
const PARENT_FY2023_OPENING_RE = 60_000_000; // FY2023 is the first period on record: this is an assumed opening balance carried in from before the group's tracked history, NOT rolled forward from an earlier tracked period (previous_period_id is NULL for FY2023 -> the DB roll-forward trigger is a documented no-op for this period, see report).
const parentFY2023ClosingRE = rollForwardRE(PARENT_FY2023_OPENING_RE, parentFY2023PL.netIncome, parent.FY2023.dividendsDeclared);

const parentFY2024OrigPL = derivePL(parent.FY2024_original);
const parentFY2024OrigBS = withEquityPlug(deriveBS(parent.FY2024_original));
const parentFY2024OrigClosingRE = rollForwardRE(parentFY2023ClosingRE, parentFY2024OrigPL.netIncome, parent.FY2024_original.dividendsDeclared);

// Restated FY2024 = original with the write-down applied to COGS/inventory,
// TAX_EXPENSE held constant (scope decision #1).
const parentFY2024RestatedInputs: PLInputs = {
  ...parent.FY2024_original,
  cogs: parent.FY2024_original.cogs + parent.restatement.inventoryWriteDown,
};
const parentFY2024RestatedPL = derivePL(parentFY2024RestatedInputs);
const parentFY2024RestatedBSInputs: BSInputs = {
  ...parent.FY2024_original,
  inventory: parent.FY2024_original.inventory - parent.restatement.inventoryWriteDown,
};
const parentFY2024RestatedBS = withEquityPlug(deriveBS(parentFY2024RestatedBSInputs));
const parentFY2024RestatedClosingRE = rollForwardRE(parentFY2023ClosingRE, parentFY2024RestatedPL.netIncome, parent.FY2024_original.dividendsDeclared);

// Cross-check (must hold EXACTLY by construction; asserted, not just hoped):
// restated NET_INCOME = original NET_INCOME - inventoryWriteDown (tax held constant).
if (parentFY2024OrigPL.netIncome - parentFY2024RestatedPL.netIncome !== parent.restatement.inventoryWriteDown) {
  throw new Error('oracle internal inconsistency: restatement net-income delta does not equal the write-down amount');
}
// restated TOTAL_ASSETS = original TOTAL_ASSETS - inventoryWriteDown; restated
// TOTAL_EQUITY = original TOTAL_EQUITY - inventoryWriteDown (plug absorbs it
// identically on both sides -> balance sheet stays balanced after restatement).
if (parentFY2024OrigBS.totalAssets - parentFY2024RestatedBS.totalAssets !== parent.restatement.inventoryWriteDown) {
  throw new Error('oracle internal inconsistency: restated total assets delta wrong');
}
if (parentFY2024OrigBS.totalEquity - parentFY2024RestatedBS.totalEquity !== parent.restatement.inventoryWriteDown) {
  throw new Error('oracle internal inconsistency: restated total equity delta wrong');
}

// FY2025 continues from the RESTATED FY2024 closing position (a real close
// always builds on the corrected history, never the superseded original).
const parentFY2025PL = derivePL(parent.FY2025);
const parentFY2025BS = withEquityPlug(deriveBS(parent.FY2025));
const parentFY2025ClosingRE = rollForwardRE(parentFY2024RestatedClosingRE, parentFY2025PL.netIncome, parent.FY2025.dividendsDeclared);

// ---------------------------------------------------------------------------
// FY2025 monthly detail (PARENT, P&L only). Weighted allocation of the
// FY2025 annual REVENUE/COGS/OPEX totals across 12 months, with the last
// month absorbing the rounding residual so the 12 months sum EXACTLY to the
// annual figure (an explicit, auditable reconciliation the report checks).
// ---------------------------------------------------------------------------
function allocateMonthly(annualTotal: number, weights: number[]): number[] {
  const weightSum = weights.reduce((a, b) => a + b, 0);
  const raw = weights.map((w) => Math.round((annualTotal * w) / weightSum));
  const residual = annualTotal - raw.reduce((a, b) => a + b, 0);
  raw[raw.length - 1] += residual; // December absorbs the rounding residual
  return raw;
}

const monthlyRevenue = allocateMonthly(parent.FY2025.revenue, parent.monthlyWeights);
const monthlyCogs = allocateMonthly(parent.FY2025.cogs, parent.monthlyWeights);
const monthlyOpex = allocateMonthly(parent.FY2025.opex, parent.monthlyWeights);
const monthlyDepreciation = allocateMonthly(parent.FY2025.depreciation, parent.monthlyWeights);
const monthlyInterest = allocateMonthly(parent.FY2025.interest, parent.monthlyWeights);
const monthlyTax = allocateMonthly(parent.FY2025.taxExpense, parent.monthlyWeights);
const monthlyPL = monthlyRevenue.map((revenue, i) =>
  derivePL({
    revenue,
    cogs: monthlyCogs[i],
    opex: monthlyOpex[i],
    depreciation: monthlyDepreciation[i],
    interest: monthlyInterest[i],
    taxExpense: monthlyTax[i],
  })
);

// Monthly CASH (BS) + NET_CHANGE_CASH (CF), same seasonality weights as
// revenue (simplifying assumption: monthly cash generation tracks monthly
// revenue seasonality) — included specifically so the pipeline can exercise
// `finance_stmt_check_cash_rollforward()` LIVE across 11 consecutive
// same-business-version month pairs (M1 is the first period on record for
// this pack -> its own roll-forward check is a documented no-op, same rule
// as FY2023's annual pack). Opening cash for January 2025 = PARENT's
// RESTATED FY2024 closing cash (9,500,000, unaffected by the non-cash
// inventory write-down) -- continuing the SAME restated history FY2025
// itself is built on.
const monthlyNetChangeCash = allocateMonthly(parent.FY2025.cfo + parent.FY2025.cfi + parent.FY2025.cff, parent.monthlyWeights);
{
  const sum = monthlyNetChangeCash.reduce((a: number, b: number) => a + b, 0);
  const annual = parent.FY2025.cfo + parent.FY2025.cfi + parent.FY2025.cff;
  if (sum !== annual) throw new Error(`oracle internal inconsistency: monthly netChangeCash sums to ${sum}, expected ${annual}`);
}
const monthlyOpeningCashJan = parent.FY2024_original.cash; // restated cash == original cash (non-cash correction)
const monthlyClosingCash: number[] = [];
{
  let running = monthlyOpeningCashJan;
  for (const nc of monthlyNetChangeCash) {
    running += nc;
    monthlyClosingCash.push(running);
  }
}
// Assert December's cumulative closing cash ties EXACTLY to the FY2025 annual closing cash.
if (monthlyClosingCash[11] !== parent.FY2025.cash) {
  throw new Error(`oracle internal inconsistency: monthly cumulative closing cash (${monthlyClosingCash[11]}) != FY2025 annual cash (${parent.FY2025.cash})`);
}

// Assert monthly sums tie EXACTLY to the annual FY2025 figures.
for (const [label, monthly, annual] of [
  ['revenue', monthlyRevenue, parent.FY2025.revenue],
  ['cogs', monthlyCogs, parent.FY2025.cogs],
  ['opex', monthlyOpex, parent.FY2025.opex],
] as const) {
  const sum = monthly.reduce((a: number, b: number) => a + b, 0);
  if (sum !== annual) throw new Error(`oracle internal inconsistency: monthly ${label} sums to ${sum}, expected ${annual}`);
}

// ---------------------------------------------------------------------------
// SUB standalone (EUR) — same derivation, no equity plug complications since
// SUB's own standalone pack is reported in EUR only, no restatement.
// ---------------------------------------------------------------------------
const subFY2023PL = derivePL(sub.FY2023);
const subFY2023BS = withEquityPlug(deriveBS(sub.FY2023));
const SUB_FY2023_OPENING_RE_EUR = 3_000_000; // first period on record, same convention as PARENT
const subFY2023ClosingRE = rollForwardRE(SUB_FY2023_OPENING_RE_EUR, subFY2023PL.netIncome, sub.FY2023.dividendsDeclared);

const subFY2024PL = derivePL(sub.FY2024);
const subFY2024BS = withEquityPlug(deriveBS(sub.FY2024));
const subFY2024ClosingRE = rollForwardRE(subFY2023ClosingRE, subFY2024PL.netIncome, sub.FY2024.dividendsDeclared);

const subFY2025PL = derivePL(sub.FY2025);
const subFY2025BS = withEquityPlug(deriveBS(sub.FY2025));
const subFY2025ClosingRE = rollForwardRE(subFY2024ClosingRE, subFY2025PL.netIncome, sub.FY2025.dividendsDeclared);

// ---------------------------------------------------------------------------
// FY2025 consolidation: translate SUB into PLN, eliminate the intercompany
// loan, split NCI. All formulas below are the ENTIRE oracle for the
// consolidated pack — nothing here is computed by, or copied from, the
// pipeline / DB triggers.
// ---------------------------------------------------------------------------
const subFY2025TranslatedPL = {
  revenue: sub.FY2025.revenue * FX.FY2025.average,
  cogs: sub.FY2025.cogs * FX.FY2025.average,
  grossMargin: subFY2025PL.grossMargin * FX.FY2025.average,
  opex: sub.FY2025.opex * FX.FY2025.average,
  ebitda: subFY2025PL.ebitda * FX.FY2025.average,
  depreciation: sub.FY2025.depreciation * FX.FY2025.average,
  ebit: subFY2025PL.ebit * FX.FY2025.average,
  interest: sub.FY2025.interest * FX.FY2025.average,
  taxExpense: sub.FY2025.taxExpense * FX.FY2025.average,
  netIncome: subFY2025PL.netIncome * FX.FY2025.average,
};

const subFY2025TranslatedBSPreCTA = {
  cash: sub.FY2025.cash * FX.FY2025.closing,
  ar: sub.FY2025.ar * FX.FY2025.closing,
  inventory: sub.FY2025.inventory * FX.FY2025.closing,
  currentAssets: subFY2025BS.currentAssets * FX.FY2025.closing,
  fixedAssets: sub.FY2025.fixedAssets * FX.FY2025.closing,
  totalAssets: subFY2025BS.totalAssets * FX.FY2025.closing, // closing rate for ALL asset/liability (stock) lines
  ap: sub.FY2025.ap * FX.FY2025.closing,
  currentLiabilities: subFY2025BS.currentLiabilities * FX.FY2025.closing,
  longTermDebt: sub.FY2025.longTermDebt * FX.FY2025.closing,
  totalLiabilities: subFY2025BS.totalLiabilities * FX.FY2025.closing,
  totalEquityAtHistoricalRate: subFY2025BS.totalEquity * FX.historical, // equity translated at the HISTORICAL (acquisition-date) rate, per IAS 21 current-rate method
};

// CTA (cumulative translation adjustment) is the plug that makes SUB's
// translated balance sheet balance: assets/liabilities move with the
// closing rate, equity is frozen at the historical rate -> the difference
// between "assets - liabilities" (closing-rate) and "equity" (historical-rate)
// is the CTA, booked as an OCI/equity adjustment (WP-D01 ADR section 10.2 —
// CTA is an ordinary finance_stmt_lines row with is_adjustment=true, not a
// separate table).
const subFY2025CTA =
  subFY2025TranslatedBSPreCTA.totalAssets -
  subFY2025TranslatedBSPreCTA.totalLiabilities -
  subFY2025TranslatedBSPreCTA.totalEquityAtHistoricalRate;
const subFY2025TranslatedEquityPostCTA = subFY2025TranslatedBSPreCTA.totalEquityAtHistoricalRate + subFY2025CTA;
const subFY2025TranslatedTotalLiabEquity = subFY2025TranslatedBSPreCTA.totalLiabilities + subFY2025TranslatedEquityPostCTA;

// Sanity: SUB's own translated BS must independently balance (assets = liab+equity+CTA).
if (Math.abs(subFY2025TranslatedBSPreCTA.totalAssets - subFY2025TranslatedTotalLiabEquity) > 1e-6) {
  throw new Error('oracle internal inconsistency: SUB FY2025 translated balance sheet does not balance');
}

// NCI (20%) split of SUB's translated equity and translated net income.
const nciEquityFY2025 = (NCI_PCT / 100) * subFY2025TranslatedEquityPostCTA;
const nciNetIncomeFY2025 = (NCI_PCT / 100) * subFY2025TranslatedPL.netIncome;
const equityAttributableToParentFY2025 = subFY2025TranslatedEquityPostCTA - nciEquityFY2025; // SUB's equity net of NCI (PARENT's own equity is separate, added below)
const netIncomeAttributableToParentFY2025 = subFY2025TranslatedPL.netIncome - nciNetIncomeFY2025;

// Group consolidated totals = PARENT standalone (already PLN) + SUB
// translated (PLN) - intercompany elimination (assets/liabilities only, no
// P&L elimination per scope decision #2). Equity is NOT reduced by the
// elimination (it is a receivable/payable elimination, not an equity one).
const groupFY2025 = {
  pl: {
    revenue: parentFY2025PL.revenue + subFY2025TranslatedPL.revenue,
    cogs: parentFY2025PL.cogs + subFY2025TranslatedPL.cogs,
    grossMargin: parentFY2025PL.grossMargin + subFY2025TranslatedPL.grossMargin,
    opex: parentFY2025PL.opex + subFY2025TranslatedPL.opex,
    ebitda: parentFY2025PL.ebitda + subFY2025TranslatedPL.ebitda,
    depreciation: parentFY2025PL.depreciation + subFY2025TranslatedPL.depreciation,
    ebit: parentFY2025PL.ebit + subFY2025TranslatedPL.ebit,
    interest: parentFY2025PL.interest + subFY2025TranslatedPL.interest,
    taxExpense: parentFY2025PL.taxExpense + subFY2025TranslatedPL.taxExpense,
    netIncomeConsolidated: parentFY2025PL.netIncome + subFY2025TranslatedPL.netIncome, // BEFORE NCI split
    netIncomeAttributableToParent: parentFY2025PL.netIncome + netIncomeAttributableToParentFY2025,
    nciNetIncome: nciNetIncomeFY2025,
  },
  bs: {
    totalAssets: parentFY2025BS.totalAssets + subFY2025TranslatedBSPreCTA.totalAssets - INTERCOMPANY_LOAN_PLN,
    totalLiabilities: parentFY2025BS.totalLiabilities + subFY2025TranslatedBSPreCTA.totalLiabilities - INTERCOMPANY_LOAN_PLN,
    totalEquity: parentFY2025BS.totalEquity + subFY2025TranslatedEquityPostCTA, // unaffected by the loan elimination
    equityAttributableToParent: parentFY2025BS.totalEquity + equityAttributableToParentFY2025,
    nciEquity: nciEquityFY2025,
  },
};
groupFY2025.bs['totalLiabilitiesEquity' as const] = groupFY2025.bs.totalLiabilities + groupFY2025.bs.totalEquity;

// Sanity: group BS must balance.
if (Math.abs(groupFY2025.bs.totalAssets - (groupFY2025.bs as any).totalLiabilitiesEquity) > 1e-6) {
  throw new Error('oracle internal inconsistency: GoldCo Group FY2025 consolidated balance sheet does not balance');
}
// Sanity: equity split must sum back to total equity.
if (Math.abs(groupFY2025.bs.equityAttributableToParent + groupFY2025.bs.nciEquity - groupFY2025.bs.totalEquity) > 1e-6) {
  throw new Error('oracle internal inconsistency: NCI + parent-attributable equity does not sum to total equity');
}
if (Math.abs(groupFY2025.pl.netIncomeAttributableToParent + groupFY2025.pl.nciNetIncome - groupFY2025.pl.netIncomeConsolidated) > 1e-6) {
  throw new Error('oracle internal inconsistency: NCI + parent-attributable net income does not sum to consolidated net income');
}

// ---------------------------------------------------------------------------
// Write the oracle JSON — the single artifact `goldco_compare.ts` reads.
// ---------------------------------------------------------------------------
const oracle = {
  meta: {
    generatedBy: 'goldco_oracle.ts (independent, no pipeline/service code imported)',
    ownershipPct: OWNERSHIP_PCT,
    nciPct: NCI_PCT,
    fx: FX,
  },
  parent: {
    FY2023: { pl: parentFY2023PL, bs: parentFY2023BS, openingRE: PARENT_FY2023_OPENING_RE, closingRE: parentFY2023ClosingRE, dividendsDeclared: parent.FY2023.dividendsDeclared, cfo: parent.FY2023.cfo, cfi: parent.FY2023.cfi, cff: parent.FY2023.cff, netChangeCash: parent.FY2023.cfo + parent.FY2023.cfi + parent.FY2023.cff },
    FY2024_original: { pl: parentFY2024OrigPL, bs: parentFY2024OrigBS, openingRE: parentFY2023ClosingRE, closingRE: parentFY2024OrigClosingRE, dividendsDeclared: parent.FY2024_original.dividendsDeclared, cfo: parent.FY2024_original.cfo, cfi: parent.FY2024_original.cfi, cff: parent.FY2024_original.cff, netChangeCash: parent.FY2024_original.cfo + parent.FY2024_original.cfi + parent.FY2024_original.cff },
    FY2024_restated: { pl: parentFY2024RestatedPL, bs: parentFY2024RestatedBS, openingRE: parentFY2023ClosingRE, closingRE: parentFY2024RestatedClosingRE, dividendsDeclared: parent.FY2024_original.dividendsDeclared, cfo: parent.FY2024_original.cfo, cfi: parent.FY2024_original.cfi, cff: parent.FY2024_original.cff, netChangeCash: parent.FY2024_original.cfo + parent.FY2024_original.cfi + parent.FY2024_original.cff, restatementDeltaNetIncome: parentFY2024RestatedPL.netIncome - parentFY2024OrigPL.netIncome, restatementDeltaTotalAssets: parentFY2024RestatedBS.totalAssets - parentFY2024OrigBS.totalAssets },
    FY2025: { pl: parentFY2025PL, bs: parentFY2025BS, openingRE: parentFY2024RestatedClosingRE, closingRE: parentFY2025ClosingRE, dividendsDeclared: parent.FY2025.dividendsDeclared, cfo: parent.FY2025.cfo, cfi: parent.FY2025.cfi, cff: parent.FY2025.cff, netChangeCash: parent.FY2025.cfo + parent.FY2025.cfi + parent.FY2025.cff },
    FY2025_monthly: monthlyPL.map((m, i) => ({ month: i + 1, ...m, cash: monthlyClosingCash[i], netChangeCash: monthlyNetChangeCash[i] })),
    FY2025_monthlyOpeningCashJan: monthlyOpeningCashJan,
  },
  sub: {
    FY2023: { pl: subFY2023PL, bs: subFY2023BS, openingRE: SUB_FY2023_OPENING_RE_EUR, closingRE: subFY2023ClosingRE, dividendsDeclared: sub.FY2023.dividendsDeclared },
    FY2024: { pl: subFY2024PL, bs: subFY2024BS, openingRE: subFY2023ClosingRE, closingRE: subFY2024ClosingRE, dividendsDeclared: sub.FY2024.dividendsDeclared },
    FY2025: { pl: subFY2025PL, bs: subFY2025BS, openingRE: subFY2024ClosingRE, closingRE: subFY2025ClosingRE, dividendsDeclared: sub.FY2025.dividendsDeclared, intercompanyLoanPayableEur: sub.FY2025.intercompanyLoanPayableEur },
    FY2025_translated: { pl: subFY2025TranslatedPL, bsPreCTA: subFY2025TranslatedBSPreCTA, cta: subFY2025CTA, equityPostCTA: subFY2025TranslatedEquityPostCTA, totalLiabilitiesEquity: subFY2025TranslatedTotalLiabEquity },
  },
  intercompany: { loanPLN: INTERCOMPANY_LOAN_PLN, loanEUR: sub.FY2025.intercompanyLoanPayableEur },
  nci: { equityFY2025: nciEquityFY2025, netIncomeFY2025: nciNetIncomeFY2025 },
  groupFY2025,
};

const outPath = path.join(path.dirname(new URL(import.meta.url).pathname), 'goldco_oracle.json');
fs.writeFileSync(outPath, JSON.stringify(oracle, null, 2));
// eslint-disable-next-line no-console
console.log(`[goldco_oracle] wrote ${outPath}`);
// eslint-disable-next-line no-console
console.log(`[goldco_oracle] all internal consistency assertions passed (balance/roll-forward/monthly-sum checks embedded above)`);
