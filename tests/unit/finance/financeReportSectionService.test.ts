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
 *   6. renderFinanceReportMarkdown produces all six sections, degrading
 *      gracefully when reconcile/valuation/trend are unavailable
 *   7. O4.6 trend wiring: honest-empty with <2 periods per line (no series /
 *      single pack), real CAGR+forecast when a ≥3-period series is supplied
 */
import { describe, expect, it } from 'vitest';

import {
  composeFinanceReportSection,
  evaluateReconcileEnforcement,
  FinanceReportReconcileBlockedError,
  lineageToEvidenceInputs,
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

describe('financeReportSectionService — lineage (#82g jawny ślad źródeł)', () => {
  it('empty state (no pack) → empty lineage, no numbers guessed', () => {
    const section = composeFinanceReportSection(baseInput({ pack: null, lineValues: {}, orgBenchmarkRows: [] }));
    expect(section.lineage.packId).toBeNull();
    expect(section.lineage.sourcePack).toBeNull();
    expect(section.lineage.entries).toEqual([]);
  });

  it('carries SKĄD (pakiet/okres) on every ratio entry, and PRZEZ CO (formula) + required line codes', () => {
    const section = composeFinanceReportSection(baseInput());
    const grossMargin = section.lineage.entries.find((e) => e.id === 'GROSS_MARGIN');
    expect(grossMargin).toBeDefined();
    expect(grossMargin?.category).toBe('ratio');
    expect(grossMargin?.sourcePack).toEqual({
      packId: 'pack-1',
      entityName: 'DBR77 Sp. z o.o.',
      periodLabel: 'FY2025',
      periodEnd: '2025-12-31',
      currency: 'PLN',
    });
    expect(grossMargin?.method).toBe('GROSS_PROFIT / REVENUE × 100');
    expect(grossMargin?.requiredLineCodes).toEqual(['GROSS_PROFIT', 'REVENUE']);
    expect(grossMargin?.value).toContain('%');
  });

  it('a skipped ratio (missing lines) still appears in lineage with value:null (not silently dropped)', () => {
    const section = composeFinanceReportSection(baseInput()); // no waccPct → ROIC_WACC_SPREAD skipped
    const spread = section.lineage.entries.find((e) => e.id === 'ROIC_WACC_SPREAD');
    expect(spread).toBeDefined();
    expect(spread?.value).toBeNull();
  });

  it('attaches the WACC assumption only to ROIC_WACC_SPREAD when waccPct is provided', () => {
    const section = composeFinanceReportSection(baseInput({ waccPct: 9.5 }));
    const spread = section.lineage.entries.find((e) => e.id === 'ROIC_WACC_SPREAD');
    const grossMargin = section.lineage.entries.find((e) => e.id === 'GROSS_MARGIN');
    expect(spread?.assumptions).toEqual([
      expect.objectContaining({ key: 'wacc_pct', value: 9.5, sourceType: 'imported' }),
    ]);
    expect(grossMargin?.assumptions).toEqual([]);
    // Section-level assumptions also carry the WACC value once (engine-level provenance).
    expect(section.lineage.assumptions.some((a) => a.key === 'wacc_pct' && a.value === 9.5)).toBe(true);
  });

  it('reconcile checks appear as lineage entries with reconcileStatus/severity and SKĄD=pack', () => {
    const section = composeFinanceReportSection(baseInput({ reconcileValidations: reconcileRows('fail') }));
    const r1 = section.lineage.entries.find((e) => e.id === 'R1_BS_BALANCES');
    expect(r1).toBeDefined();
    expect(r1?.category).toBe('reconcile');
    expect(r1?.reconcileStatus).toBe('fail');
    expect(r1?.severity).toBe('error');
    expect(r1?.sourcePack?.packId).toBe('pack-1');
  });

  it('EV basket methods appear as lineage entries (valuation category, weight in method)', () => {
    const section = composeFinanceReportSection(
      baseInput({ valuation: { id: 'val-1', title: 'DCF vs comps', basket: realBasket(false) } })
    );
    const m1 = section.lineage.entries.find((e) => e.id === 'M1');
    expect(m1).toBeDefined();
    expect(m1?.category).toBe('valuation');
    expect(m1?.value).toContain('900');
    expect(m1?.method).toContain('waga');
  });

  it('lineageToEvidenceInputs maps entries→sources (skipped ratios excluded) and assumptions 1:1', () => {
    const section = composeFinanceReportSection(
      baseInput({ waccPct: 9.5, reconcileValidations: reconcileRows('pass'), valuation: { id: 'val-1', title: 'DCF', basket: realBasket(false) } })
    );
    const { sources, assumptions } = lineageToEvidenceInputs(section.lineage);
    // No source for a skipped ratio (value:null) — nothing to cite.
    expect(sources.some((s) => s.ref === 'ROIC_WACC_SPREAD' && section.lineage.entries.find((e) => e.id === 'ROIC_WACC_SPREAD')?.value === null)).toBe(false);
    const grossMarginSource = sources.find((s) => s.ref === 'GROSS_MARGIN');
    expect(grossMarginSource).toBeDefined();
    expect(grossMarginSource?.type).toBe('statement_pack');
    expect(grossMarginSource?.snippet).toContain('pack-1');
    const valuationSource = sources.find((s) => s.ref === 'M1');
    expect(valuationSource?.type).toBe('kpi_series');
    expect(assumptions.some((a) => a.key === 'wacc_pct' && a.value === 9.5 && a.source_type === 'imported')).toBe(true);
  });
});

describe('financeReportSectionService — renderFinanceReportMarkdown', () => {
  it('renders all nine sections, degrading gracefully when reconcile/valuation/trend are unavailable', () => {
    const section = composeFinanceReportSection(baseInput());
    const md = renderFinanceReportMarkdown(section);
    expect(Object.keys(md).sort()).toEqual(
      [
        'ev_football_field',
        'header',
        'narrative',
        'portfolio_advisory',
        'ratio_table',
        'reconcile_result',
        'scenario_levers',
        'trend_analysis',
        'value_tree',
      ].sort()
    );
    expect(md.header).toContain('FY2025');
    expect(md.ratio_table).toContain('Wskaźniki');
    expect(md.reconcile_result).toContain('nie przeszedł jeszcze przeliczenia');
    expect(md.ev_football_field).toContain('Brak wyceny');
    // O4.2/O4.3 — COMPLETE_LINES carries REVENUE+NET_INCOME, so scenarios/value tree compute.
    expect(md.scenario_levers).toContain('Scenariusze-dźwignie');
    expect(md.value_tree).toContain('Drzewo wartości korzyści');
    // O4.4 — no portfolioItems supplied in this fixture → honest empty state.
    expect(md.portfolio_advisory).toContain('Brak inicjatyw organizacji');
    // Single pack, no trendSeries supplied → honest-empty, never a fabricated trend.
    expect(md.trend_analysis).toContain('Brak wystarczającej historii pakietów');
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

describe('financeReportSectionService — O4.2/O4.3/O4.4 advisory wiring', () => {
  it('O4.2 scenarios: computes a risk-adjusted lever recommendation from REVENUE/NET_INCOME', () => {
    const section = composeFinanceReportSection(baseInput());
    expect(section.scenarios.available).toBe(true);
    expect(section.scenarios.outcomes).toHaveLength(5); // status_quo + 4 named levers
    const statusQuo = section.scenarios.outcomes.find((o) => o.leverId === 'status_quo');
    expect(statusQuo?.metric).toBe(COMPLETE_LINES.NET_INCOME); // 1.0/1.0 multiplier = unchanged
    expect(statusQuo?.deltaVsStatusQuo).toBe(0);
    expect(section.scenarios.recommendation).not.toBeNull();
    expect(section.scenarios.recommendation?.chosenId).toBeTruthy();
  });

  it('O4.2 scenarios: honestly unavailable when REVENUE/NET_INCOME are missing (no guessing)', () => {
    const section = composeFinanceReportSection(baseInput({ lineValues: { REVENUE: 1000 } }));
    expect(section.scenarios.available).toBe(false);
    expect(section.scenarios.outcomes).toEqual([]);
    expect(section.scenarios.recommendation).toBeNull();
  });

  it('O4.3 value tree: decomposes the recommended lever into real growth/savings components', () => {
    const section = composeFinanceReportSection(baseInput());
    expect(section.scenarios.recommendation).not.toBeNull();
    const chosenId = section.scenarios.recommendation!.chosenId;
    // aggressive_automation/growth_bet/defensive_cost all imply a real (non-status-quo) swing;
    // only status_quo itself produces zero components — assert consistency with whichever lever
    // the deterministic risk-adjusted ranking actually chose.
    if (chosenId === 'status_quo') {
      expect(section.valueTree.available).toBe(false);
    } else {
      expect(section.valueTree.available).toBe(true);
      expect(section.valueTree.forLeverId).toBe(chosenId);
      expect(section.valueTree.tree).not.toBeNull();
      expect(section.valueTree.tree!.gross).toBeGreaterThan(0);
      expect(section.valueTree.narrative).toContain('do zaksięgowania');
    }
  });

  it('O4.3 value tree: honestly unavailable when scenarios are unavailable', () => {
    const section = composeFinanceReportSection(baseInput({ lineValues: { REVENUE: 1000 } }));
    expect(section.valueTree.available).toBe(false);
    expect(section.valueTree.tree).toBeNull();
    expect(section.valueTree.narrative).toBeNull();
  });

  it('O4.4 portfolio advisory: empty path is honest (no fabricated sequence) when no items supplied', () => {
    const section = composeFinanceReportSection(baseInput());
    expect(section.portfolioAdvisory.available).toBe(false);
    expect(section.portfolioAdvisory.itemCount).toBe(0);
    expect(section.portfolioAdvisory.advisory).toBeNull();
  });

  it('O4.4 portfolio advisory: sequences real initiative items when supplied by the caller', () => {
    const section = composeFinanceReportSection(
      baseInput({
        portfolioItems: [
          { id: 'a', name: 'Wspólny model danych', npv: 400_000, capex: 200_000, effort: 2, risk: 0.2 },
          {
            id: 'b',
            name: 'Automatyzacja raportów',
            npv: 600_000,
            capex: 150_000,
            effort: 2,
            risk: 0.3,
            dependsOn: ['a'],
          },
        ],
      })
    );
    expect(section.portfolioAdvisory.available).toBe(true);
    expect(section.portfolioAdvisory.itemCount).toBe(2);
    const order = section.portfolioAdvisory.advisory!.sequence.map((s) => s.id);
    expect(order.indexOf('a')).toBeLessThan(order.indexOf('b'));
  });

  it('renderFinanceScenarioMarkdown / renderFinanceValueTreeMarkdown degrade honestly for the empty section fixture', () => {
    const md = renderFinanceReportMarkdown(composeFinanceReportSection({ organizationId: 'org-1', pack: null } as unknown as RawFinanceReportInputs));
    expect(md.scenario_levers).toContain('no guessing');
    expect(md.value_tree).toContain('Brak rekomendowanej dźwigni');
    expect(md.portfolio_advisory).toContain('Brak inicjatyw organizacji');
  });
});

/**
 * O4.6 wiring — financeStatementTrendService.analyseStatementLine consumed via
 * `composeFinanceReportTrend` (internal to financeReportSectionService, exercised
 * indirectly through `composeFinanceReportSection`'s public `trend` field + the
 * `trend_analysis` markdown block). Proves the honest-empty contract: a single
 * pack (no `trendSeries`, or a 1-point series) never fabricates a trend; a real
 * ≥2/≥3-period series produces the same CAGR/direction/forecast the pure engine
 * computes (re-verified here only at the wiring boundary, not re-testing the
 * engine's own math — see tests/unit/finance/financeStatementTrendService.test.ts).
 */
describe('financeReportSectionService — O4.6 trend wiring', () => {
  it('no trendSeries supplied → trend.available=false, honest note, no fabricated numbers', () => {
    const section = composeFinanceReportSection(baseInput());
    expect(section.trend.available).toBe(false);
    expect(section.trend.lines).toHaveLength(3); // REVENUE, EBITDA, NET_INCOME — always present
    expect(section.trend.lines.every((l) => l.trend.periods === 0)).toBe(true);
    expect(section.trend.lines.every((l) => l.trend.cagrPct === null)).toBe(true);
    expect(section.trend.lines.every((l) => l.forecast.method === 'none')).toBe(true);
    expect(section.trend.note).toContain('Brak wystarczającej historii pakietów');
  });

  it('a single-point series (1 pack) stays honest-empty — periods=1 is not a trend', () => {
    const section = composeFinanceReportSection(
      baseInput({
        trendSeries: {
          REVENUE: [{ periodLabel: 'FY2025', periodIndex: 0, value: 1000 }],
        },
      })
    );
    const revenue = section.trend.lines.find((l) => l.lineCode === 'REVENUE')!;
    expect(revenue.trend.periods).toBe(1);
    expect(revenue.trend.cagrPct).toBeNull();
    expect(section.trend.available).toBe(false);
  });

  it('a real multi-period series → CAGR/direction computed + forecast when ≥3 points', () => {
    const section = composeFinanceReportSection(
      baseInput({
        trendSeries: {
          REVENUE: [
            { periodLabel: 'FY2023', periodIndex: 0, value: 800 },
            { periodLabel: 'FY2024', periodIndex: 1, value: 900 },
            { periodLabel: 'FY2025', periodIndex: 2, value: 1000 },
          ],
          EBITDA: [
            { periodLabel: 'FY2024', periodIndex: 0, value: 200 },
            { periodLabel: 'FY2025', periodIndex: 1, value: 220 },
          ],
          // NET_INCOME left without a series → stays honest-empty alongside the other two.
        },
      })
    );
    expect(section.trend.available).toBe(true);

    const revenue = section.trend.lines.find((l) => l.lineCode === 'REVENUE')!;
    expect(revenue.trend.periods).toBe(3);
    expect(revenue.trend.direction).toBe('rising');
    expect(revenue.trend.cagrPct).toBeCloseTo(11.8, 1); // (1000/800)^(1/2)-1 ≈ 11.8%
    expect(revenue.forecast.method).toBe('cagr-extrapolation');
    expect(revenue.forecast.confidence).toBe('computed');
    expect(revenue.forecast.projected).toHaveLength(1);

    const ebitda = section.trend.lines.find((l) => l.lineCode === 'EBITDA')!;
    expect(ebitda.trend.periods).toBe(2);
    expect(ebitda.trend.direction).toBe('rising');
    // Only 2 points → forecast stays honest-empty (needs ≥3 to extrapolate).
    expect(ebitda.forecast.method).toBe('none');
    expect(ebitda.forecast.confidence).toBe('insufficient-data');

    const netIncome = section.trend.lines.find((l) => l.lineCode === 'NET_INCOME')!;
    expect(netIncome.trend.periods).toBe(0);

    const md = renderFinanceReportMarkdown(section);
    expect(md.trend_analysis).toContain('Przychody');
    expect(md.trend_analysis).toContain('rosnący');
    expect(md.trend_analysis).toContain('Prognoza');
    // EBITDA has periods>=2 so it is listed, but with the honest "too short" forecast line.
    expect(md.trend_analysis).toContain('EBITDA');
    expect(md.trend_analysis).toContain('za krótka seria');
    // NET_INCOME has periods<2 → excluded from the rendered per-line list.
    expect(md.trend_analysis).not.toContain('**Wynik netto**');
  });
});
