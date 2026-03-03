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

