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
    vi.resetModules();
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

  it('selects the numeric token bound to the chosen period without concatenating year digits', async () => {
    const { extractFinancialLines } = await import(
      '../../../../server/src/services/financialStatementService.js'
    );

    const extraction = extractFinancialLines(
      [
        'Balance Sheet',
        'For the year ended 2025',
        'Current Assets 2025 450 2024 420',
        'Cash and cash equivalents 2025 210 2024 180',
      ].join('\n'),
      'BS',
      {
        selectedPeriodLabel: '2025',
      }
    );

    expect(extraction.lines).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          originalLabel: 'Current Assets 2025',
          value: 450,
          rawValue: '450',
          selectedPeriodLabel: '2025',
          selectedNumericToken: expect.objectContaining({
            raw: '450',
            selectionReason: 'matched_selected_period',
          }),
        }),
        expect.objectContaining({
          originalLabel: 'Cash and cash equivalents 2025',
          value: 210,
          rawValue: '210',
        }),
      ])
    );
  });

  it('maps cash-flow rows using deterministic operating/investing/financing scope signals', async () => {
    mockDb.all.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM financial_statement_lines')) {
        return [
          {
            id: 'fsl-cf-operating',
            statement_type: 'CF',
            line_code: 'OPERATING_CASH_FLOW',
            line_name: 'Operating cash flow',
            line_name_pl: 'Przepływy operacyjne',
          },
          {
            id: 'fsl-cf-investing',
            statement_type: 'CF',
            line_code: 'INVESTING_CASH_FLOW',
            line_name: 'Investing cash flow',
            line_name_pl: 'Przepływy inwestycyjne',
          },
          {
            id: 'fsl-cf-financing',
            statement_type: 'CF',
            line_code: 'FINANCING_CASH_FLOW',
            line_name: 'Financing cash flow',
            line_name_pl: 'Przepływy finansowe',
          },
        ];
      }
      if (sql.includes('information_schema.columns')) {
        return [];
      }
      return [];
    });

    const { autoMapLines, resolveDuplicateSuggestedMappings } = await import(
      '../../../../server/src/services/financialStatementService.js'
    );

    const mapped = resolveDuplicateSuggestedMappings(
      await autoMapLines(
        [
          {
            originalLabel: 'Przepływy pieniężne netto z działalności operacyjnej 2025',
            value: 880,
            confidence: 0.6,
          },
          {
            originalLabel: 'Przepływy pieniężne netto z działalności inwestycyjnej 2025',
            value: -310,
            confidence: 0.6,
          },
          {
            originalLabel: 'Przepływy pieniężne netto z działalności finansowej 2025',
            value: -180,
            confidence: 0.6,
          },
        ],
        'CF',
        { organizationId: '', templateFamily: null }
      )
    );

    expect(mapped.map((line) => line.suggestedCanonicalId)).toEqual([
      'fsl-cf-operating',
      'fsl-cf-investing',
      'fsl-cf-financing',
    ]);
    expect(mapped.every((line) => line.mappingReason === 'cash_flow_scope_match')).toBe(true);
  });

  it('detects BS equation mismatch when Assets ≠ Liabilities + Equity', async () => {
    const { validateStatement } = await import(
      '../../../../server/src/services/financialStatementService.js'
    );

    const result = validateStatement(
      [
        { canonicalLineId: 'fsl-bs-total-assets', value: 1000 },
        { canonicalLineId: 'fsl-bs-total-liabilities', value: 400 },
        { canonicalLineId: 'fsl-bs-equity', value: 500 },
        { canonicalLineId: 'fsl-bs-current-assets', value: 300 },
        { canonicalLineId: 'fsl-bs-noncurrent-assets', value: 700 },
      ],
      'BS'
    );

    expect(result.messages.some((m) => m.code === 'BS_EQUATION_MISMATCH')).toBe(true);
  });

  it('passes BS equation check when Assets = Liabilities + Equity', async () => {
    const { validateStatement } = await import(
      '../../../../server/src/services/financialStatementService.js'
    );

    const result = validateStatement(
      [
        { canonicalLineId: 'fsl-bs-total-assets', value: 1000 },
        { canonicalLineId: 'fsl-bs-total-liabilities', value: 400 },
        { canonicalLineId: 'fsl-bs-equity', value: 600 },
        { canonicalLineId: 'fsl-bs-current-assets', value: 300 },
        { canonicalLineId: 'fsl-bs-noncurrent-assets', value: 700 },
      ],
      'BS'
    );

    expect(result.messages.some((m) => m.code === 'BS_EQUATION_OK')).toBe(true);
    expect(result.messages.some((m) => m.code === 'BS_EQUATION_MISMATCH')).toBe(false);
  });

  it('detects asset sub-component mismatch', async () => {
    const { validateStatement } = await import(
      '../../../../server/src/services/financialStatementService.js'
    );

    const result = validateStatement(
      [
        { canonicalLineId: 'fsl-bs-total-assets', value: 1000 },
        { canonicalLineId: 'fsl-bs-total-liabilities', value: 400 },
        { canonicalLineId: 'fsl-bs-equity', value: 600 },
        { canonicalLineId: 'fsl-bs-current-assets', value: 200 },
        { canonicalLineId: 'fsl-bs-noncurrent-assets', value: 500 },
      ],
      'BS'
    );

    expect(result.messages.some((m) => m.code === 'BS_ASSETS_SUBCOMPONENT_MISMATCH')).toBe(true);
  });

  it('persists learned aliases via learnStatementAliases', async () => {
    mockDb.all.mockImplementation(async (sql: string) => {
      if (sql.includes('PRAGMA table_info')) {
        return [
          { name: 'id' },
          { name: 'organization_id' },
          { name: 'statement_line_id' },
          { name: 'statement_type' },
          { name: 'alias_text' },
          { name: 'normalized_alias' },
          { name: 'template_family' },
          { name: 'source' },
          { name: 'usage_count' },
          { name: 'created_by' },
        ];
      }
      return [];
    });
    mockDb.run.mockResolvedValue({ success: true });

    const { learnStatementAliases } = await import(
      '../../../../server/src/services/financialStatementService.js'
    );

    await learnStatementAliases({
      organizationId: 'org-test',
      statementType: 'BS',
      templateFamily: 'apator',
      values: [
        { canonicalLineId: 'fsl-bs-total-assets', originalLabel: 'Aktywa razem' },
        { canonicalLineId: 'fsl-bs-equity', originalLabel: 'Kapitał własny ogółem' },
      ],
      createdBy: 'test-user',
    });

    const insertCalls = mockDb.run.mock.calls.filter((call) =>
      String(call[0]).includes('INSERT INTO financial_statement_line_aliases')
    );
    expect(insertCalls.length).toBe(2);

    const firstInsert = insertCalls[0];
    const params = firstInsert[1];
    expect(params).toEqual(
      expect.arrayContaining([
        'org-test',
        'fsl-bs-total-assets',
        'BS',
      ])
    );

    const secondInsert = insertCalls[1];
    expect(secondInsert[1]).toEqual(
      expect.arrayContaining([
        'fsl-bs-equity',
      ])
    );
  });

  it('learned aliases boost heuristic score on next mapping', async () => {
    const learnedAliases = [
      {
        statement_line_id: 'fsl-bs-total-assets',
        normalized_alias: 'sumaaktywow',
        template_family: '',
      },
    ];

    mockDb.all.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM financial_statement_lines')) {
        return [
          {
            id: 'fsl-bs-total-assets',
            statement_type: 'BS',
            line_code: 'TOTAL_ASSETS',
            line_name: 'Total assets',
            line_name_pl: 'Aktywa razem',
          },
          {
            id: 'fsl-bs-equity',
            statement_type: 'BS',
            line_code: 'EQUITY',
            line_name: 'Equity',
            line_name_pl: 'Kapitał własny',
          },
        ];
      }
      if (sql.includes('financial_statement_line_aliases')) {
        return learnedAliases;
      }
      if (sql.includes('information_schema.columns')) {
        return [];
      }
      if (sql.includes('PRAGMA table_info')) {
        return [
          { name: 'id' },
          { name: 'organization_id' },
          { name: 'statement_line_id' },
          { name: 'normalized_alias' },
          { name: 'template_family' },
        ];
      }
      return [];
    });

    const { autoMapLines } = await import(
      '../../../../server/src/services/financialStatementService.js'
    );

    const mapped = await autoMapLines(
      [{ originalLabel: 'Suma aktywów', value: 5000, confidence: 0.5 }],
      'BS',
      { organizationId: 'org-test', templateFamily: '' }
    );

    expect(mapped[0].suggestedCanonicalId).toBe('fsl-bs-total-assets');
  });
});
