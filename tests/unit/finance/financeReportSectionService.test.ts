/**
 * financeReportSectionService — unit tests for the PURE composer
 * (composeFinanceReportSection / renderFinanceReportMarkdown).
 *
 * No DB, nothing mocked: every input is a hand-built fixture representing
 * what the DB orchestration layer (loadFinanceReportSectionData) would have
 * already fetched from the three existing engines:
 *   - financeRatioFamilyCatalog (Z111 wskaźniki)
 *   - reconciliationService (R1-R8, read as already-persisted shadow rows)
 *   - valuationBasketService (EV koszyk, via a real synthesizeBasket() call)
 *
 * Contracts under test:
 *   1. no pack → empty state (no numbers guessed, verdict='NA')
 *   2. complete inputs → ratios computed across all 5 families + benchmark
 *      attached only where financeRatioFamilyCatalog codes overlap
 *      ratioAnalysisService's CATALOG_TO_BENCHMARK_CODE
 *   3. reconcile validations parsed from the persisted-row shape (summary +
 *      individual checks), RECONCILE_SUMMARY excluded from `checks`
 *   4. reconcile validations === null (pack never recomputed) → available:false
 *   5. verdict is worst-of(reconcile status, EV consistency flag)
 *   6. renderFinanceReportMarkdown produces all five sections, degrading
 *      gracefully when reconcile/valuation are unavailable
 */
import { describe, expect, it } from 'vitest';

import {
  composeFinanceReportSection,
  evaluateReconcileEnforcement,
  FinanceReportReconcileBlockedError,
  renderFinanceReportMarkdown,
  type FinanceReconcileSummary,
  type RawFinanceReportInputs,
} from '../../../server/src/services/financeReportSectionService.js';
import { FINANCE_RATIO_FAMILY_CATALOG } from '../../../server/src/services/financeRatioFamilyCatalog.js';
import { synthesizeBasket, type MethodRange } from '../../../server/src/services/valuationBasketService.js';

// Same reference company as financeRatioFamilyCatalog.test.ts (hand-computed
// there) — reused here only to exercise the compose layer, not re-verify
// individual ratio formulas (that is the other file's job).
const COMPLETE_LINES = {
  REVENUE: 1000,
  COGS: 600,
  GROSS_PROFIT: 400,
  EBITDA: 220,
  EBIT: 180,
  EBT: 120,
  TAX_EXPENSE: 30,
  NET_INCOME: 90,
  CURRENT_ASSETS: 500,
  CURRENT_LIABILITIES: 250,
  INVENTORY: 150,
  CASH: 80,
  AR: 120,
  AP: 90,
  TOTAL_ASSETS: 1200,
  TOTAL_EQUITY: 600,
  TOTAL_DEBT: 400,
  NET_DEBT: 320,
  INTEREST_EXPENSE: 40,
  CAPEX: -60,
  FREE_CASH_FLOW: 100,
};

const BASE_PACK = {
  packId: 'pack-1',
  entityName: 'DBR77 Sp. z o.o.',
  periodLabel: 'FY2025',
  periodEnd: '2025-12-31',
  currency: 'PLN',
  statementTypesPresent: ['P&L', 'BS', 'CF'],
  missingStatementTypes: [],
};

function baseInput(overrides: Partial<RawFinanceReportInputs> = {}): RawFinanceReportInputs {
  return {
    organizationId: 'org-1',
    pack: BASE_PACK,
    lineValues: COMPLETE_LINES,
    orgBenchmarkRows: [],
    reconcileValidations: null,
    valuation: null,
    ...overrides,
  };
}

// `blocksReady` mirrors reconciliationService's own formula: true only when at least one
// error-severity check has status='fail' (R1 here). A 'warning'-only package (R2) never sets
// it, matching `checks.some(c => c.severity==='error' && c.status==='fail')`.
function reconcileRows(overallStatus: 'pass' | 'warning' | 'fail') {
  const blocksReady = overallStatus === 'fail';
  return [
    {
      check_code: 'R1_BS_BALANCES',
      check_name: 'Balance sheet balances',
      severity: 'error',
      status: overallStatus === 'fail' ? 'fail' : 'pass',
      message: overallStatus === 'fail' ? 'Assets != Liabilities+Equity' : 'OK',
      difference: overallStatus === 'fail' ? 12.5 : 0,
      tolerance: 1,
      details_json: {},
      computed_at: '2026-07-11T10:00:00.000Z',
    },
    {
      check_code: 'R2_CF_TIES',
      check_name: 'CF ties to BS cash movement',
      severity: 'warning',
      status: overallStatus === 'warning' ? 'warning' : 'pass',
      message: overallStatus === 'warning' ? 'Minor drift' : 'OK',
      difference: overallStatus === 'warning' ? 3 : 0,
      tolerance: 1,
      details_json: {},
      computed_at: '2026-07-11T10:00:00.000Z',
    },
    {
      check_code: 'RECONCILE_SUMMARY',
      check_name: 'Reconcile R1-R8 (shadow)',
      severity: 'info',
      status: 'pass',
      message: `Reconcile shadow: summary`,
      difference: 0,
      tolerance: 0,
      details_json: {
        shadow: true,
        enforce: false,
        overallStatus,
        summary: { passed: overallStatus === 'pass' ? 8 : 6, warnings: overallStatus === 'warning' ? 1 : 0, failed: overallStatus === 'fail' ? 1 : 0, skipped: 0 },
        blocksReady,
        wouldBlockReady: false,
      },
      computed_at: '2026-07-11T10:00:00.000Z',
    },
  ];
}

function realBasket(divergent: boolean) {
  const methods: MethodRange[] = divergent
    ? [
        { key: 'M1', label: 'DCF/FCFF', low: 800, mid: 1000, high: 1200 },
        { key: 'M2', label: 'Mnożniki rynkowe', low: 1600, mid: 1800, high: 2000 },
      ]
    : [
        { key: 'M1', label: 'DCF/FCFF', low: 900, mid: 1000, high: 1100 },
        { key: 'M2', label: 'Mnożniki rynkowe', low: 950, mid: 1050, high: 1150 },
      ];
  return synthesizeBasket(methods);
}

describe('financeReportSectionService — composeFinanceReportSection', () => {
  it('returns the empty state when there is no pack (no numbers guessed)', () => {
    const section = composeFinanceReportSection(
      baseInput({ pack: null, lineValues: {}, orgBenchmarkRows: [] })
    );
    expect(section.packId).toBeNull();
    expect(section.verdict).toBe('NA');
    expect(section.ratios.total).toBe(0);
    expect(section.reconcile.available).toBe(false);
    expect(section.valuation.available).toBe(false);
    expect(section.dataQuality.missingStatementTypes).toEqual(['P&L', 'BS', 'CF']);
  });

  it('computes every ratio in the catalog and groups them by family', () => {
    const section = composeFinanceReportSection(baseInput());
    expect(section.ratios.total).toBe(FINANCE_RATIO_FAMILY_CATALOG.length);
    expect(section.ratios.total).toBeGreaterThanOrEqual(20);
    // All 5 families are present as keys, in catalog order per group.
    expect(Object.keys(section.ratios.byFamily).sort()).toEqual(
      ['efficiency', 'leverage', 'liquidity', 'profitability', 'value'].sort()
    );
    const flat = Object.values(section.ratios.byFamily).flat();
    expect(flat.length).toBe(FINANCE_RATIO_FAMILY_CATALOG.length);
    // With a fully populated line map, most ratios compute (DuPont-eligible core lines present).
    expect(section.ratios.computed).toBeGreaterThan(15);
    expect(section.ratios.dupont.status).toBe('computed');
  });

  it('attaches a benchmark only for codes ratioAnalysisService maps (e.g. GROSS_MARGIN), not for unmapped codes (e.g. CCC)', () => {
    const section = composeFinanceReportSection(baseInput());
    const flat = Object.values(section.ratios.byFamily).flat();
    const grossMargin = flat.find((r) => r.code === 'GROSS_MARGIN');
    const ccc = flat.find((r) => r.code === 'CCC');
    expect(grossMargin?.benchmark).toBeDefined();
    expect(ccc?.benchmark).toBeUndefined();
  });

  it('prefers an organization-entered benchmark row over the industry fallback', () => {
    const section = composeFinanceReportSection(
      baseInput({
        orgBenchmarkRows: [
          { ratio_code: 'CURRENT_RATIO', p25: 1.1, median: 1.5, p75: 2.0, source_label: 'DBR77 wewnętrzny' },
        ],
      })
    );
    const flat = Object.values(section.ratios.byFamily).flat();
    const currentRatio = flat.find((r) => r.code === 'CURRENT_RATIO');
    expect(currentRatio?.benchmark?.origin).toBe('org');
    expect(currentRatio?.benchmark?.median).toBe(1.5);
    expect(currentRatio?.benchmark?.source).toBe('DBR77 wewnętrzny');
  });

  it('parses persisted reconcile validations: excludes RECONCILE_SUMMARY from checks, reads overallStatus/summary from its details_json', () => {
    const section = composeFinanceReportSection(
      baseInput({ reconcileValidations: reconcileRows('fail') })
    );
    expect(section.reconcile.available).toBe(true);
    expect(section.reconcile.overallStatus).toBe('fail');
    expect(section.reconcile.checks).toHaveLength(2);
    expect(section.reconcile.checks.some((c) => c.checkCode === 'RECONCILE_SUMMARY')).toBe(false);
    expect(section.reconcile.summary).toEqual({ passed: 6, warnings: 0, failed: 1, skipped: 0 });
    expect(section.reconcile.enforceMode).toBe(false);
    // A 'fail' overallStatus in this fixture is driven by an error+fail check (R1) →
    // blocksReady=true, persisted verbatim from RECONCILE_SUMMARY.details_json.
    expect(section.reconcile.blocksReady).toBe(true);
  });

  it('blocksReady stays false for a warning-only package (no error+fail check)', () => {
    const section = composeFinanceReportSection(
      baseInput({ reconcileValidations: reconcileRows('warning') })
    );
    expect(section.reconcile.overallStatus).toBe('warning');
    expect(section.reconcile.blocksReady).toBe(false);
  });

  it('marks reconcile unavailable (not "0 checks") when the pack never recomputed', () => {
    const section = composeFinanceReportSection(baseInput({ reconcileValidations: null }));
    expect(section.reconcile.available).toBe(false);
    expect(section.reconcile.overallStatus).toBe('na');
    expect(section.reconcile.checks).toEqual([]);
    expect(section.reconcile.blocksReady).toBe(false);
  });

  it('carries the EV basket through untouched and reflects consistency in the verdict', () => {
    const consistent = composeFinanceReportSection(
      baseInput({
        reconcileValidations: reconcileRows('pass'),
        valuation: { id: 'val-1', title: 'DCF vs comps', basket: realBasket(false) },
      })
    );
    expect(consistent.valuation.available).toBe(true);
    expect(consistent.valuation.basket?.consistencyFlag.triggered).toBe(false);
    expect(consistent.verdict).toBe('GREEN');

    const divergent = composeFinanceReportSection(
      baseInput({
        reconcileValidations: reconcileRows('pass'),
        valuation: { id: 'val-1', title: 'DCF vs comps', basket: realBasket(true) },
      })
    );
    expect(divergent.valuation.basket?.consistencyFlag.triggered).toBe(true);
    expect(divergent.verdict).toBe('AMBER');
  });

  it('verdict is worst-of: a failing reconcile outranks a consistent EV basket', () => {
    const section = composeFinanceReportSection(
      baseInput({
        reconcileValidations: reconcileRows('fail'),
        valuation: { id: 'val-1', title: 'DCF vs comps', basket: realBasket(false) },
      })
    );
    expect(section.verdict).toBe('RED');
  });
});

describe('financeReportSectionService — renderFinanceReportMarkdown', () => {
  it('renders all five sections, degrading gracefully when reconcile/valuation are unavailable', () => {
    const section = composeFinanceReportSection(baseInput());
    const md = renderFinanceReportMarkdown(section);
    expect(Object.keys(md).sort()).toEqual(
      ['ev_football_field', 'header', 'narrative', 'ratio_table', 'reconcile_result'].sort()
    );
    expect(md.header).toContain('FY2025');
    expect(md.ratio_table).toContain('Wskaźniki');
    expect(md.reconcile_result).toContain('nie przeszedł jeszcze przeliczenia');
    expect(md.ev_football_field).toContain('Brak wyceny');
  });

  it('renders the reconcile findings and football-field table when data is available', () => {
    const section = composeFinanceReportSection(
      baseInput({
        reconcileValidations: reconcileRows('warning'),
        valuation: { id: 'val-1', title: 'DCF vs comps', basket: realBasket(true) },
      })
    );
    const md = renderFinanceReportMarkdown(section);
    expect(md.reconcile_result).toContain('R2_CF_TIES');
    expect(md.ev_football_field).toContain('DCF/FCFF');
    expect(md.ev_football_field).toContain('rozjeżdżają się');
  });
});

/**
 * evaluateReconcileEnforcement — the enforce GATE behind the "Piotr's switch"
 * (RECONCILE_ENFORCE), tested with an explicit `enforce` flag so it does not depend on
 * flipping the real module constant (which stays a hardcoded `false` until DBR77
 * calibration signs off — see reconciliationService.ts docblock).
 *
 * Contracts under test (per the task's hard requirements):
 *   1. enforce=false → report proceeds (nothing thrown) EVEN WITH violations present
 *      (today's default behavior — pure log/shadow, unchanged).
 *   2. enforce=true + violations present → blocked, with the violating checks attached.
 *   3. clean package (no violations) → proceeds in BOTH modes.
 */
describe('financeReportSectionService — evaluateReconcileEnforcement (RECONCILE_ENFORCE gate)', () => {
  function reconcileSummary(overrides: Partial<FinanceReconcileSummary>): FinanceReconcileSummary {
    return {
      available: true,
      enforceMode: false,
      overallStatus: 'pass',
      summary: { passed: 8, warnings: 0, failed: 0, skipped: 0 },
      checks: [],
      computedAt: '2026-07-11T10:00:00.000Z',
      blocksReady: false,
      ...overrides,
    };
  }

  const dirtySummary = reconcileSummary({
    overallStatus: 'fail',
    blocksReady: true,
    checks: [
      {
        checkCode: 'R1_BS_BALANCES',
        checkName: 'Balance sheet balances',
        severity: 'error',
        status: 'fail',
        message: 'Assets != Liabilities+Equity',
        difference: 12.5,
        tolerance: 1,
      },
      {
        checkCode: 'R2_CF_TIES',
        checkName: 'CF ties to BS cash movement',
        severity: 'warning',
        status: 'warning',
        message: 'Minor drift',
        difference: 3,
        tolerance: 1,
      },
    ],
  });

  const cleanSummary = reconcileSummary({});

  it('enforce=false: a dirty package is NEVER blocked (today\'s default — shadow/log only)', () => {
    expect(evaluateReconcileEnforcement('pack-1', dirtySummary, false)).toBeNull();
  });

  it('enforce=true: a dirty package IS blocked, with only the error+fail checks as violations', () => {
    const blocked = evaluateReconcileEnforcement('pack-1', dirtySummary, true);
    expect(blocked).toBeInstanceOf(FinanceReportReconcileBlockedError);
    expect(blocked?.code).toBe('RECONCILE_ENFORCE_BLOCKED');
    expect(blocked?.statusCode).toBe(409);
    expect(blocked?.packId).toBe('pack-1');
    expect(blocked?.violations).toHaveLength(1);
    expect(blocked?.violations[0]?.checkCode).toBe('R1_BS_BALANCES');
  });

  it('clean package: proceeds (null) in BOTH enforce=false and enforce=true', () => {
    expect(evaluateReconcileEnforcement('pack-1', cleanSummary, false)).toBeNull();
    expect(evaluateReconcileEnforcement('pack-1', cleanSummary, true)).toBeNull();
  });

  it('enforce=true but reconcile never ran (available=false) does not block (nothing to gate on)', () => {
    const neverRecomputed = reconcileSummary({ available: false, overallStatus: 'na', blocksReady: false });
    expect(evaluateReconcileEnforcement('pack-1', neverRecomputed, true)).toBeNull();
  });

  it('defaults to the real RECONCILE_ENFORCE module switch when no override is passed (today: false)', () => {
    // No third argument — exercises the exact call path publishFinanceReportSectionSnapshot
    // uses. Must be a no-op today: RECONCILE_ENFORCE is a hardcoded `false` until DBR77
    // calibration flips it (see reconciliationService.ts).
    expect(evaluateReconcileEnforcement('pack-1', dirtySummary)).toBeNull();
  });
});
