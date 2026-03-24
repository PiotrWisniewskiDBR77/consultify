import { beforeEach, describe, expect, it, vi } from 'vitest';

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

describe('financialStatementPackService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.run.mockResolvedValue({ success: true });
  });

  it('creates or assigns a statement to a pack and recomputes aggregate state', async () => {
    const { syncStatementToPack } = await import(
      '../../../../server/src/services/financialStatementPackService.js'
    );

    mockDb.get.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM financial_statements') && sql.includes('WHERE id = ?')) {
        return {
          id: 'stmt-1',
          organization_id: 'org-1',
          entity_name: 'Acme',
          statement_type: 'P&L',
          period_start: '2025-01-01',
          period_end: '2025-12-31',
          period_label: 'FY 2025',
          currency: 'PLN',
          scaling: 'units',
          status: 'mapped',
          readiness_status: 'recoverable',
          readiness_score: 72,
          statement_pack_id: null,
        };
      }
      if (sql.includes('FROM financial_statement_packs')) {
        return null;
      }
      return { total: 1 };
    });

    mockDb.all.mockResolvedValue([
      {
        id: 'stmt-1',
        organization_id: 'org-1',
        entity_name: 'Acme',
        statement_type: 'P&L',
        period_start: '2025-01-01',
        period_end: '2025-12-31',
        period_label: 'FY 2025',
        currency: 'PLN',
        scaling: 'units',
        status: 'mapped',
        readiness_status: 'recoverable',
        readiness_score: 72,
        statement_pack_id: 'generated-pack',
      },
    ]);

    const packId = await syncStatementToPack('stmt-1');

    expect(packId).toBeTruthy();
    expect(mockDb.run).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO financial_statement_packs'),
      expect.any(Array)
    );
    expect(mockDb.run).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE financial_statements'),
      expect.arrayContaining([expect.any(String), 'stmt-1'])
    );
  });

  it('returns an ordered verified seed from a ready pack', async () => {
    const { getVerifiedPackSeed } = await import(
      '../../../../server/src/services/financialStatementPackService.js'
    );

    mockDb.get.mockResolvedValue({
      id: 'pack-1',
      organization_id: 'org-1',
      period_label: 'FY 2025',
      currency: 'PLN',
      pack_readiness_status: 'ready',
    });
    mockDb.all.mockResolvedValue([
      { id: 'cf-1', statement_type: 'CF', readiness_status: 'ready' },
      { id: 'pl-1', statement_type: 'P&L', readiness_status: 'ready' },
      { id: 'bs-1', statement_type: 'BS', readiness_status: 'ready' },
    ]);

    const seed = await getVerifiedPackSeed({ organizationId: 'org-1', packId: 'pack-1' });

    expect(seed.statementIds).toEqual(['pl-1', 'bs-1', 'cf-1']);
    expect(seed.currency).toBe('PLN');
    expect(seed.periodLabel).toBe('FY 2025');
  });
});
