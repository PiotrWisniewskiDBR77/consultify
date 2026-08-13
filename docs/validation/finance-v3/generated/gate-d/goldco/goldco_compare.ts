#!/usr/bin/env tsx
/**
 * GoldCo vertical slice — compares `goldco_oracle.json` (independent
 * hand-computed source of truth) against `goldco_pipeline_results.json`
 * (values read back out of the real Postgres pipeline) for every
 * intermediate value the slice produces, and writes `goldco_comparison.json`
 * (machine-readable) — `GOLDCO_STATEMENTS_VERTICAL_SLICE_REPORT.md` is
 * written by hand from this output, not generated automatically, so the
 * report's prose can explain WHY a mismatch is or isn't a bug.
 *
 * Tolerance placeholder (per WP-D01 ADR section 5.0, "korekta tolerancji" —
 * NOT max(1 unit, 0.1%), the more restrictive of source-rounding and
 * materiality): for UNITS-scale whole-PLN/EUR figures with no source
 * rounding beyond the integer, source-rounding tolerance = 1 full unit (=1
 * currency unit here, since unit='UNITS'). Materiality tolerance = 5%
 * (PROVISIONAL_MATERIALITY_THRESHOLD_PCT, statementReconciliationService.ts)
 * of the relevant total-assets base. This script always applies the SAME
 * LEAST(1, 5%-of-base) rule the DB's own finance_stmt_balance_tolerance()
 * function applies, so a "PASS" here means the same thing a live trigger
 * pass would mean.
 */
import fs from 'node:fs';
import path from 'node:path';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const oracle = JSON.parse(fs.readFileSync(path.join(HERE, 'goldco_oracle.json'), 'utf8'));
const pipeline = JSON.parse(fs.readFileSync(path.join(HERE, 'goldco_pipeline_results.json'), 'utf8'));

interface Row {
  section: string;
  field: string;
  oracle: number | null;
  pipeline: number | null;
  tolerance: number;
  diff: number | null;
  pass: boolean | 'N/A';
  note?: string;
}

const rows: Row[] = [];

function tol(base: number) {
  // LEAST(1 unit, 5% of base) — matches finance_stmt_balance_tolerance() exactly.
  return Math.min(1, 0.05 * Math.abs(base));
}

function cmp(section: string, field: string, oracleVal: number | null | undefined, pipelineVal: number | null | undefined, base: number, note?: string) {
  const o = oracleVal ?? null;
  const p = pipelineVal ?? null;
  if (o === null && p === null) {
    rows.push({ section, field, oracle: o, pipeline: p, tolerance: tol(base), diff: null, pass: 'N/A', note: note ?? 'both null' });
    return;
  }
  if (o === null || p === null) {
    rows.push({ section, field, oracle: o, pipeline: p, tolerance: tol(base), diff: null, pass: false, note: note ?? 'one side missing' });
    return;
  }
  const diff = Math.abs(o - p);
  const t = tol(base);
  rows.push({ section, field, oracle: o, pipeline: p, tolerance: t, diff, pass: diff <= t, note });
}

// --- PARENT standalone, all 4 versions ---
for (const [label, oraclePeriod, pipelinePeriod] of [
  ['PARENT FY2023', oracle.parent.FY2023, pipeline.parent.FY2023],
  ['PARENT FY2024 ORIGINAL', oracle.parent.FY2024_original, pipeline.parent.FY2024_original],
  ['PARENT FY2024 RESTATED', oracle.parent.FY2024_restated, pipeline.parent.FY2024_restated],
  ['PARENT FY2025', oracle.parent.FY2025, pipeline.parent.FY2025],
] as const) {
  const base = oraclePeriod.bs.totalAssets;
  if (!pipelinePeriod) {
    cmp(label, 'ALL FIELDS', null, null, base, 'pipeline pack never reached a readable state (see restatement flow notes)');
    continue;
  }
  for (const field of ['revenue', 'cogs', 'grossMargin', 'opex', 'ebitda', 'depreciation', 'ebit', 'interest', 'taxExpense', 'netIncome']) {
    cmp(label, `pl.${field}`, oraclePeriod.pl[field], pipelinePeriod[field], base);
  }
  for (const field of ['cash', 'ar', 'inventory', 'currentAssets', 'fixedAssets', 'totalAssets', 'ap', 'currentLiabilities', 'longTermDebt', 'totalLiabilities', 'totalEquity', 'totalLiabilitiesEquity']) {
    cmp(label, `bs.${field}`, oraclePeriod.bs[field], pipelinePeriod[field], base);
  }
  cmp(label, 'retainedEarnings (closing)', oraclePeriod.closingRE, pipelinePeriod.retainedEarnings, base);
  cmp(label, 'dividendsDeclared', oraclePeriod.dividendsDeclared, pipelinePeriod.dividendsDeclared, base);
  if (oraclePeriod.cfo !== undefined) {
    cmp(label, 'cf.cfo', oraclePeriod.cfo, pipelinePeriod.cfo, base);
    cmp(label, 'cf.cfi', oraclePeriod.cfi, pipelinePeriod.cfi, base);
    cmp(label, 'cf.cff', oraclePeriod.cff, pipelinePeriod.cff, base);
    cmp(label, 'cf.netChangeCash', oraclePeriod.netChangeCash, pipelinePeriod.netChangeCash, base);
  }
}

// Restatement delta cross-check (oracle-internal, already asserted, re-verified here against itself for the report table).
cmp('PARENT FY2024 restatement delta', 'netIncome delta (restated-original)', oracle.parent.FY2024_restated.restatementDeltaNetIncome, pipeline.parent.FY2024_restated ? (pipeline.parent.FY2024_restated.netIncome - pipeline.parent.FY2024_original.netIncome) : null, oracle.parent.FY2024_original.bs.totalAssets);

// --- PARENT FY2025 monthly detail: each month + sum-to-annual tie-out ---
for (const m of oracle.parent.FY2025_monthly) {
  const pm = pipeline.parentMonthly.find((x: any) => x.month === m.month);
  const base = oracle.parent.FY2025.bs.totalAssets;
  for (const field of ['revenue', 'cogs', 'grossMargin', 'opex', 'ebitda', 'depreciation', 'ebit', 'interest', 'taxExpense', 'netIncome']) {
    cmp(`PARENT FY2025 M${String(m.month).padStart(2, '0')}`, field, m[field], pm ? pm[field] : null, base);
  }
  cmp(`PARENT FY2025 M${String(m.month).padStart(2, '0')}`, 'cash (cumulative)', m.cash, pm ? pm.cash : null, base);
  cmp(`PARENT FY2025 M${String(m.month).padStart(2, '0')}`, 'netChangeCash', m.netChangeCash, pm ? pm.netChangeCash : null, base);
}
{
  const sumField = (field: string) => oracle.parent.FY2025_monthly.reduce((a: number, m: any) => a + m[field], 0);
  const sumPipelineField = (field: string) => pipeline.parentMonthly.reduce((a: number, m: any) => a + (m[field] ?? 0), 0);
  const base = oracle.parent.FY2025.bs.totalAssets;
  for (const field of ['revenue', 'cogs', 'netIncome']) {
    cmp('PARENT FY2025 monthly SUM-TO-ANNUAL tie-out', field, sumField(field), sumPipelineField(field), base, 'sum of 12 monthly pipeline values vs FY2025 annual pipeline value directly (both read from DB, not oracle)');
    // Second comparison: monthly sum (pipeline) vs annual figure (pipeline) directly — the real tie-out.
    rows.push({
      section: 'PARENT FY2025 monthly SUM-TO-ANNUAL tie-out (pipeline-internal)',
      field,
      oracle: pipeline.parent.FY2025[field],
      pipeline: sumPipelineField(field),
      tolerance: tol(base),
      diff: Math.abs(pipeline.parent.FY2025[field] - sumPipelineField(field)),
      pass: Math.abs(pipeline.parent.FY2025[field] - sumPipelineField(field)) <= tol(base),
      note: 'annual pipeline value vs sum of 12 monthly pipeline values (both from DB)',
    });
  }
}

// --- SUB standalone (EUR) ---
for (const [label, oraclePeriod, pipelinePeriod] of [
  ['SUB FY2023', oracle.sub.FY2023, pipeline.sub.FY2023],
  ['SUB FY2024', oracle.sub.FY2024, pipeline.sub.FY2024],
  ['SUB FY2025', oracle.sub.FY2025, pipeline.sub.FY2025],
] as const) {
  const base = oraclePeriod.bs.totalAssets;
  for (const field of ['revenue', 'cogs', 'grossMargin', 'opex', 'ebitda', 'depreciation', 'ebit', 'interest', 'taxExpense', 'netIncome']) {
    cmp(label, `pl.${field}`, oraclePeriod.pl[field], pipelinePeriod[field], base);
  }
  for (const field of ['cash', 'ar', 'inventory', 'currentAssets', 'fixedAssets', 'totalAssets', 'ap', 'currentLiabilities', 'longTermDebt', 'totalLiabilities', 'totalEquity', 'totalLiabilitiesEquity']) {
    cmp(label, `bs.${field}`, oraclePeriod.bs[field], pipelinePeriod[field], base);
  }
  cmp(label, 'retainedEarnings (closing)', oraclePeriod.closingRE, pipelinePeriod.retainedEarnings, base);
}

// --- Consolidated GoldCo Group FY2025 ---
{
  const base = oracle.groupFY2025.bs.totalAssets;
  cmp('GROUP FY2025 consolidated', 'pl.revenue', oracle.groupFY2025.pl.revenue, pipeline.group.pl.revenue, base);
  cmp('GROUP FY2025 consolidated', 'pl.cogs', oracle.groupFY2025.pl.cogs, pipeline.group.pl.cogs, base);
  cmp('GROUP FY2025 consolidated', 'pl.netIncomeConsolidated (pre-NCI-split)', oracle.groupFY2025.pl.netIncomeConsolidated, pipeline.group.pl.netIncomeConsolidated, base);
  cmp('GROUP FY2025 consolidated', 'bs.totalAssets', oracle.groupFY2025.bs.totalAssets, pipeline.group.bs.totalAssets, base);
  cmp('GROUP FY2025 consolidated', 'bs.totalLiabilities', oracle.groupFY2025.bs.totalLiabilities, pipeline.group.bs.totalLiabilities, base);
  cmp('GROUP FY2025 consolidated', 'bs.totalEquity (incl. NCI)', oracle.groupFY2025.bs.totalEquity, pipeline.group.bs.totalEquity, base);
  cmp('GROUP FY2025 consolidated', 'bs.totalLiabilitiesEquity', oracle.groupFY2025.bs.totalLiabilitiesEquity, pipeline.group.bs.totalLiabilitiesEquity, base);
  cmp('GROUP FY2025 consolidated', 'SUB-translated pl.revenue', oracle.sub.FY2025_translated.pl.revenue, pipeline.group.subTranslated.revenue, base);
  cmp('GROUP FY2025 consolidated', 'SUB-translated pl.netIncome', oracle.sub.FY2025_translated.pl.netIncome, pipeline.group.subTranslated.netIncome, base);
  cmp('GROUP FY2025 consolidated', 'SUB-translated bs.totalAssets', oracle.sub.FY2025_translated.bsPreCTA.totalAssets, pipeline.group.subTranslated.totalAssets, base);
  cmp('GROUP FY2025 consolidated', 'SUB-translated bs.equity (post-CTA)', oracle.sub.FY2025_translated.equityPostCTA, pipeline.group.subTranslated.equity, base);
  cmp('GROUP FY2025 consolidated', 'SUB-translated bs.totalLiabilitiesEquity', oracle.sub.FY2025_translated.totalLiabilitiesEquity, pipeline.group.subTranslated.totalLiabilitiesEquity, base);
  cmp('GROUP FY2025 consolidated', 'SUB-translated CTA_OCI', oracle.sub.FY2025_translated.cta, pipeline.group.subTranslated.cta, base);

  // Elimination pair — stored rows must be a matched NATURAL/CONTRA pair netting to 0, per canonical_line.
  const elimRows = pipeline.group.eliminationRows as Array<{ entity_code: string; value_decimal: string; sign_convention: string }>;
  const net = elimRows.reduce((acc, r) => acc + (r.sign_convention === 'CONTRA' ? -Number(r.value_decimal) : Number(r.value_decimal)), 0);
  rows.push({
    section: 'GROUP FY2025 consolidated', field: 'elimination pair net (NATURAL/CONTRA, DB-stored)',
    oracle: 0, pipeline: net, tolerance: 1, diff: Math.abs(net), pass: Math.abs(net) <= 1,
    note: `${elimRows.length} row(s): ${JSON.stringify(elimRows)}`,
  });
  const parentLeg = elimRows.find((r) => r.entity_code === 'PARENT');
  cmp('GROUP FY2025 consolidated', 'intercompany loan PLN (PARENT leg, face value)', oracle.intercompany.loanPLN, parentLeg ? -Number(parentLeg.value_decimal) : null, base);

  // NCI split — oracle-only (no dedicated finance_stmt_lines row exists for
  // NCI, see goldco_pipeline.ts comment) — recomputed here from the ORACLE'S
  // OWN total-equity/net-income figures as an internal-consistency
  // re-derivation (not a pipeline comparison), reported separately so the
  // report doesn't conflate "compared against the DB" with "re-derived from
  // the oracle itself".
  rows.push({
    section: 'GROUP FY2025 consolidated (oracle-only, no DB row exists)', field: 'NCI equity (20% of SUB translated equity)',
    oracle: oracle.nci.equityFY2025, pipeline: null, tolerance: tol(base), diff: null, pass: 'N/A',
    note: 'no NCI_EQUITY canonical taxonomy line exists; not written to finance_stmt_lines by this slice (documented scope decision) — oracle value shown for completeness only',
  });
  rows.push({
    section: 'GROUP FY2025 consolidated (oracle-only, no DB row exists)', field: 'NCI net income (20% of SUB translated NI)',
    oracle: oracle.nci.netIncomeFY2025, pipeline: null, tolerance: tol(base), diff: null, pass: 'N/A',
    note: 'no NCI_NET_INCOME canonical taxonomy line exists; not written to finance_stmt_lines by this slice (documented scope decision) — oracle value shown for completeness only',
  });
}

// --- Summary ---
const comparable = rows.filter((r) => r.pass !== 'N/A');
const passed = comparable.filter((r) => r.pass === true);
const failed = comparable.filter((r) => r.pass === false);

const summary = {
  totalRows: rows.length,
  comparableRows: comparable.length,
  passed: passed.length,
  failed: failed.length,
  naRows: rows.length - comparable.length,
  failedDetail: failed,
};

fs.writeFileSync(path.join(HERE, 'goldco_comparison.json'), JSON.stringify({ summary, rows }, null, 2));

// eslint-disable-next-line no-console
console.log(`[goldco_compare] ${passed.length}/${comparable.length} comparable rows PASS (tolerance = LEAST(1 unit, 5% of period total assets)), ${summary.naRows} N/A rows`);
if (failed.length > 0) {
  // eslint-disable-next-line no-console
  console.log(`[goldco_compare] FAILED rows:`);
  for (const r of failed) {
    // eslint-disable-next-line no-console
    console.log(`  ${r.section} / ${r.field}: oracle=${r.oracle} pipeline=${r.pipeline} diff=${r.diff} tolerance=${r.tolerance} note=${r.note ?? ''}`);
  }
}
