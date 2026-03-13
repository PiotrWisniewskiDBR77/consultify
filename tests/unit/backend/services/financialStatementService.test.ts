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

describe('financialStatementService canonical layer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.run.mockResolvedValue({ success: true });
  });

  it('keeps statement recoverable when required canonical lines are missing', async () => {
    const { validateStatement, evaluateStatementReadiness } = await import(
      '../../../../server/src/services/financialStatementService.js'
    );

    const validation = validateStatement(
      [
        { canonicalLineId: 'fsl-pl-revenue', value: 1000 },
        { canonicalLineId: 'fsl-pl-cogs', value: 400 },
      ],
      'P&L'
    );

    expect(validation.messages.some((message) => message.code === 'REQUIRED_LINES_MISSING')).toBe(true);

    const readiness = evaluateStatementReadiness({
      rawStatus: 'mapped',
      statementType: 'P&L',
      validationStatus: validation.status,
      currency: 'PLN',
      scaling: 'units',
      validationMessages: validation.messages,
      values: [
        { canonicalLineId: 'fsl-pl-revenue', value: 1000 },
        { canonicalLineId: 'fsl-pl-cogs', value: 400 },
      ],
    });

    expect(readiness.readinessStatus).toBe('recoverable');
    expect(readiness.reasonCodes).toContain('MISSING_REQUIRED_CANONICAL_LINES');
  });

  it('stores canonical snapshot rows with line metadata', async () => {
    const {
      snapshotCanonicalStatementVersion,
      loadLatestStatementVersionSnapshot,
    } = await import('../../../../server/src/services/financialStatementService.js');

    mockDb.get
      .mockResolvedValueOnce({ next_version: 1 })
      .mockResolvedValueOnce({
        version_no: 1,
        snapshot_json: JSON.stringify({
          values: [
            {
              canonicalLineId: 'fsl-pl-revenue',
              lineCode: 'REVENUE',
              lineName: 'Revenue',
              value: 1200,
            },
          ],
        }),
      });

    const versionNo = await snapshotCanonicalStatementVersion({
      statementId: 'stmt-1',
      versionKind: 'validated',
      readinessStatus: 'ready',
      values: [{ canonicalLineId: 'fsl-pl-revenue', value: 1200 }],
      validations: [],
      createdBy: 'user-1',
      summary: 'Validated snapshot',
    });

    expect(versionNo).toBe(1);
    expect(mockDb.run).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO financial_statement_versions'),
      expect.arrayContaining([
        expect.any(String),
        'stmt-1',
        1,
        'validated',
        'ready',
        expect.stringContaining('"lineCode":"REVENUE"'),
        'Validated snapshot',
        'user-1',
      ]),
      { fallback: false }
    );

    const snapshot = await loadLatestStatementVersionSnapshot('stmt-1');
    expect(snapshot?.versionNo).toBe(1);
    expect(snapshot?.snapshot?.values?.[0]?.lineCode).toBe('REVENUE');
  });
});
