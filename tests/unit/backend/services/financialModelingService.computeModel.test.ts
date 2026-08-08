import { describe, it, expect, vi } from 'vitest';

// Hoisted DbPromise mocks (financialModelingService imports DbPromise.js directly)
const mockDb = vi.hoisted(() => ({
  get: vi.fn(),
  all: vi.fn(),
  run: vi.fn(),
}));

vi.mock('../../../../server/src/utils/DbPromise.js', async () => {
  const actual = await vi.importActual<any>('../../../../server/src/utils/DbPromise.js');
  return {
    ...actual,
    get: mockDb.get,
    all: mockDb.all,
    run: mockDb.run,
  };
});

vi.mock('../../../../server/src/services/financialStatementService.js', () => ({
  loadLatestStatementVersionSnapshot: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../../../server/src/services/financeCanonicalResolver.js', () => ({
  normalizeCanonicalLineCode: (code: string) => String(code || '').toUpperCase(),
}));

describe('financialModelingService.computeModel (T054)', () => {
  it('computes P&L/BS/CF outputs and produces passing hard validations for a simple scenario', async () => {
    const { computeModel } = await import(
      '../../../../server/src/services/financialModelingService.js'
    );

    mockDb.get.mockResolvedValueOnce({
      id: 'm1',
      start_date: '2026-01-01',
      horizon_months: 3,
      granularity: 'monthly',
      assumptions_json: JSON.stringify({
        initialCash: 1000,
        initialEquity: 1000,
        initialDebt: 0,
        initialPPE: 0,
        initialAR: 0,
        initialInventory: 0,
        initialAP: 0,
      }),
      scenario: 'base',
    });

    mockDb.all.mockResolvedValueOnce([
      {
        id: 'e1',
        model_id: 'm1',
        event_type: 'revenue',
        name: 'Rev',
        amount: 100,
        period_start: '2026-01-01',
        period_end: null,
        recurrence: 'monthly',
        growth_rate: 0,
        cf_classification: 'operating',
        posting_rules: '{}',
        parameters: '{}',
        sort_order: 0,
        is_active: true,
        created_at: '2026-01-01T00:00:00Z',
      },
      {
        id: 'e2',
        model_id: 'm1',
        event_type: 'cogs',
        name: 'COGS',
        amount: 40,
        period_start: '2026-01-01',
        period_end: null,
        recurrence: 'monthly',
        growth_rate: 0,
        cf_classification: 'operating',
        posting_rules: '{}',
        parameters: '{}',
        sort_order: 1,
        is_active: true,
        created_at: '2026-01-01T00:00:00Z',
      },
    ]);

    const result = await computeModel('m1');

    expect(result.periods).toHaveLength(3);
    expect(result.validations.length).toBeGreaterThan(0);

    // First period sanity
    const p0 = result.periods[0]!;
    expect(p0.pl.REVENUE).toBe(100);
    expect(p0.pl.COGS).toBe(-40);
    expect(p0.pl.GROSS_PROFIT).toBe(60);

    // Hard validations must pass for this basic scenario
    const bsEq = result.validations.filter((v) => v.checkCode === 'BS_EQUATION');
    const cashTie = result.validations.filter((v) => v.checkCode === 'CASH_TIEOUT');
    expect(bsEq).toHaveLength(3);
    expect(cashTie).toHaveLength(3);
    expect(bsEq.every((v) => v.status === 'pass')).toBe(true);
    expect(cashTie.every((v) => v.status === 'pass')).toBe(true);
    expect(result.overallStatus).toBe('pass');
  });

  it('treats one_time recurrence as applying only once (start period)', async () => {
    const { computeModel } = await import(
      '../../../../server/src/services/financialModelingService.js'
    );

    mockDb.get.mockResolvedValueOnce({
      id: 'm2',
      start_date: '2026-01-01',
      horizon_months: 3,
      granularity: 'monthly',
      assumptions_json: JSON.stringify({
        initialCash: 0,
        initialEquity: 0,
        initialDebt: 0,
        initialPPE: 0,
        initialAR: 0,
        initialInventory: 0,
        initialAP: 0,
      }),
      scenario: 'base',
    });

    mockDb.all.mockResolvedValueOnce([
      {
        id: 'e1',
        model_id: 'm2',
        event_type: 'equity_injection',
        name: 'Seed',
        amount: 500,
        period_start: '2026-01-15',
        period_end: null,
        recurrence: 'one_time',
        growth_rate: 0,
        cf_classification: 'financing',
        posting_rules: '{}',
        parameters: '{}',
        sort_order: 0,
        is_active: true,
        created_at: '2026-01-01T00:00:00Z',
      },
    ]);

    const result = await computeModel('m2');
    expect(result.periods).toHaveLength(3);

    const [jan, feb, mar] = result.periods;
    // Periods are anchored to the 1st of each month; event starts mid-month,
    // so the first applicable period is the first period_date >= start date.
    expect(jan?.cf.EQUITY_CF).toBe(0);
    expect(feb?.cf.EQUITY_CF).toBe(500);
    expect(mar?.cf.EQUITY_CF).toBe(0);
  });
});

describe('financialModelingService model seed periods', () => {
  it('seeds only the latest period when period labels live in JSON evidence', async () => {
    const { createModel } = await import(
      '../../../../server/src/services/financialModelingService.js'
    );
    mockDb.get.mockResolvedValueOnce({
      id: 'stmt-1',
      period_label: 'FY2025',
      period_start: '2025-01-01',
      period_end: '2025-12-31',
      currency: 'USD',
      scaling: 'millions',
      source_file_name: 'annual-report.pdf',
      status: 'confirmed',
      readiness_status: 'ready',
    });
    const latestRows = [
      { line_code: 'CASH', value: 500 },
      { line_code: 'TOTAL_ASSETS', value: 2000 },
      { line_code: 'TOTAL_EQUITY', value: 1200 },
      { line_code: 'REVENUE', value: 3000 },
      { line_code: 'COGS', value: 1800 },
      { line_code: 'OPEX', value: 600 },
    ];
    mockDb.all.mockResolvedValueOnce([
      ...latestRows.map((row) => ({
        ...row,
        value: row.value / 2,
        period_label: null,
        evidence_json: JSON.stringify({ periodLabel: '2024' }),
      })),
      ...latestRows.map((row) => ({
        ...row,
        period_label: null,
        evidence_json: JSON.stringify({ periodLabel: '2025' }),
      })),
    ]);
    mockDb.run.mockResolvedValue(undefined);

    await createModel({
      organizationId: 'org-1',
      name: 'latest-period forecast',
      startDate: '2026-01-01',
      createdBy: 'user-1',
      sourceStatementId: 'stmt-1',
    });

    const insertCall = mockDb.run.mock.calls.find((call) =>
      String(call[0]).includes('INSERT INTO financial_models')
    );
    const assumptionsJson = (insertCall![1] as any[]).find(
      (parameter) => typeof parameter === 'string' && parameter.includes('seedSource')
    );
    const assumptions = JSON.parse(assumptionsJson);
    expect(assumptions.initialCash).toBe(500);
    expect(assumptions.initialEquity).toBe(1200);
    expect(assumptions.baseline.revenue).toBe(3000);
  });
});
