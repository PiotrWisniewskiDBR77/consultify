/**
 * #82f — financialModelToAssumptions (assumptionsFinancialModelDrivers.ts): mapper z
 * financial_models.assumptions_json na Z114 rejestr, klasyfikacja czytana z REALNYCH
 * sygnałów backendu (seedSource/missingBaselineLines), nie zgadywana.
 */
import { describe, expect, it } from 'vitest';

import {
  FINANCIAL_MODEL_DRIVERS,
  financialModelToAssumptions,
} from '../assumptionsFinancialModelDrivers.js';
import { auditCoverage, listAssumptions } from '../assumptionsRegistry.js';

describe('financialModelToAssumptions (#82f)', () => {
  it('grounded model: seeded baseline lines → imported, missing lines → ai_assumed', () => {
    const assumptions = financialModelToAssumptions({
      assumptions: {
        baseline: { revenue: 1_000_000, cogs: 400_000, opex: 0 },
        initialCash: 50_000,
        initialEquity: 200_000,
      },
      isGrounded: true,
      missingBaselineLines: ['opex'],
      seedSource: { type: 'statement_pack', periodLabel: 'FY2025' },
    });

    const revenue = assumptions.find((a) => a.key === 'baseline.revenue')!;
    expect(revenue.provenance.source_type).toBe('imported');
    expect(revenue.provenance.source_ref).toBe('FY2025');

    const opex = assumptions.find((a) => a.key === 'baseline.opex')!;
    expect(opex.provenance.source_type).toBe('ai_assumed');
    expect(opex.provenance.rationale).toMatch(/pakiecie\/sprawozdaniu źródłowym/);

    const cash = assumptions.find((a) => a.key === 'initialCash')!;
    expect(cash.provenance.source_type).toBe('imported');
  });

  it('non-grounded (manual/zero-seeded) model: everything present is ai_assumed, absent is missing', () => {
    const assumptions = financialModelToAssumptions({
      assumptions: { baseline: { revenue: 500_000 } },
      isGrounded: false,
      missingBaselineLines: [],
      seedSource: null,
    });

    const revenue = assumptions.find((a) => a.key === 'baseline.revenue')!;
    expect(revenue.value).toBe(500_000);
    expect(revenue.provenance.source_type).toBe('ai_assumed');

    const capex = assumptions.find((a) => a.key === 'baseline.capex')!;
    expect(capex.value).toBeNull();
  });

  it('listAssumptions/auditCoverage classify the built assumptions consistently (real registry call)', () => {
    const assumptions = financialModelToAssumptions({
      assumptions: { baseline: { revenue: 1_000_000, cogs: 400_000, opex: 300_000 } },
      isGrounded: true,
      missingBaselineLines: [],
      seedSource: { type: 'statement', periodLabel: 'FY2025' },
    });

    const listed = listAssumptions(assumptions);
    const revenueRow = listed.find((a) => a.key === 'baseline.revenue')!;
    expect(revenueRow.status).toBe('sourced');
    expect(revenueRow.needsReview).toBe(false);

    const missingRow = listed.find((a) => a.key === 'initialCash')!;
    expect(missingRow.status).toBe('missing');
    expect(missingRow.needsReview).toBe(true);

    const coverage = auditCoverage('financial_model.3stmt', FINANCIAL_MODEL_DRIVERS, assumptions);
    expect(coverage.requiredCount).toBeGreaterThan(0);
    expect(coverage.missing.length).toBeGreaterThan(0);
    expect(coverage.complete).toBe(false);
  });
});
