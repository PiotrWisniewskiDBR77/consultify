import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockDb = vi.hoisted(() => ({
  get: vi.fn(),
  all: vi.fn(),
  run: vi.fn(),
}));

const mockPackService = vi.hoisted(() => ({
  getVerifiedPackSeed: vi.fn(),
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

vi.mock('../../../../server/src/services/financialStatementPackService.js', async () => {
  const actual = await vi.importActual<any>(
    '../../../../server/src/services/financialStatementPackService.js'
  );
  return {
    ...actual,
    getVerifiedPackSeed: mockPackService.getVerifiedPackSeed,
  };
});

describe('finance downstream pack seeding', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPackService.getVerifiedPackSeed.mockResolvedValue({
      statementIds: ['pl-1', 'bs-1', 'cf-1'],
      currency: 'PLN',
      periodLabel: 'FY 2025',
    });
    mockDb.run.mockResolvedValue({ success: true });
  });

  it('creates a financial model from a verified statement pack', async () => {
    const { createModel } = await import(
      '../../../../server/src/services/financialModelingService.js'
    );

    mockDb.all.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM financial_statements')) {
        return [
          {
            id: 'pl-1',
            statement_type: 'P&L',
            period_label: 'FY 2025',
            period_start: '2025-01-01',
            period_end: '2025-12-31',
            currency: 'PLN',
            scaling: 'units',
            source_file_name: 'pl.pdf',
            status: 'confirmed',
            readiness_status: 'ready',
          },
          {
            id: 'bs-1',
            statement_type: 'BS',
            period_label: 'FY 2025',
            period_start: '2025-01-01',
            period_end: '2025-12-31',
            currency: 'PLN',
            scaling: 'units',
            source_file_name: 'bs.pdf',
            status: 'confirmed',
            readiness_status: 'ready',
          },
          {
            id: 'cf-1',
            statement_type: 'CF',
            period_label: 'FY 2025',
            period_start: '2025-01-01',
            period_end: '2025-12-31',
            currency: 'PLN',
            scaling: 'units',
            source_file_name: 'cf.pdf',
            status: 'confirmed',
            readiness_status: 'ready',
          },
        ];
      }
      if (sql.includes('FROM financial_statement_values')) {
        return [
          { line_code: 'CASH', value: 100 },
          { line_code: 'TOTAL_ASSETS', value: 500 },
          { line_code: 'TOTAL_EQUITY', value: 300 },
          { line_code: 'LONG_TERM_DEBT', value: 200 },
          { line_code: 'REVENUE', value: 1000 },
          { line_code: 'COGS', value: 400 },
          { line_code: 'OPEX', value: 300 },
          { line_code: 'DEPRECIATION', value: 50 },
          { line_code: 'INTEREST_EXPENSE', value: 10 },
          { line_code: 'TAX', value: 40 },
          { line_code: 'CFI', value: -80 },
        ];
      }
      return [];
    });

    await createModel({
      organizationId: 'org-1',
      name: 'Pack model',
      startDate: '2026-01-01',
      createdBy: 'user-1',
      sourceStatementPackId: 'pack-1',
    });

    const modelInsert = mockDb.run.mock.calls.find(([sql]) =>
      String(sql).includes('INSERT INTO financial_models')
    );
    expect(modelInsert).toBeTruthy();
    expect(modelInsert?.[1]).toEqual(expect.arrayContaining(['pack-1']));
    const assumptions = JSON.parse(String(modelInsert?.[1]?.[11] || '{}'));
    expect(assumptions.seedSource.type).toBe('statement_pack');
  });

  it('creates a financial analysis from a verified statement pack', async () => {
    const { createAnalysis } = await import(
      '../../../../server/src/services/financialAnalysisService.js'
    );

    mockDb.all.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM financial_statements')) {
        return [
          { id: 'cf-1', statement_type: 'CF', period_label: 'FY 2025', period_end: '2025-12-31', currency: 'PLN' },
          { id: 'pl-1', statement_type: 'P&L', period_label: 'FY 2025', period_end: '2025-12-31', currency: 'PLN' },
          { id: 'bs-1', statement_type: 'BS', period_label: 'FY 2025', period_end: '2025-12-31', currency: 'PLN' },
        ];
      }
      if (sql.includes('FROM financial_statement_values')) {
        return [
          { statement_id: 'pl-1', value: 1000, line_code: 'REVENUE', line_name: 'Revenue', statement_type: 'P&L' },
          { statement_id: 'bs-1', value: 500, line_code: 'TOTAL_ASSETS', line_name: 'Total Assets', statement_type: 'BS' },
          { statement_id: 'cf-1', value: 120, line_code: 'FINANCING_CF', line_name: 'Financing CF', statement_type: 'CF' },
        ];
      }
      return [];
    });

    const analysis = await createAnalysis(
      'org-1',
      {
        title: 'Pack analysis',
        sourceStatementPackId: 'pack-1',
      },
      'user-1'
    );

    expect(analysis.sourceStatementPackId).toBe('pack-1');
    expect(analysis.sourceStatementIds).toEqual(['pl-1', 'bs-1', 'cf-1']);
    const analysisInsert = mockDb.run.mock.calls.find(([sql]) =>
      String(sql).includes('INSERT INTO financial_analyses')
    );
    expect(String(analysisInsert?.[0] || '')).toContain('source_statement_pack_id');
  });
});
