import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ statements: [] as string[], rows: [] as string[], receipts: [] as string[] }));
const mocks = vi.hoisted(() => ({
  locate: vi.fn(),
  create: vi.fn(),
  dbRun: vi.fn(),
  recomputePack: vi.fn(),
}));

vi.mock('fs/promises', () => ({
  default: {
    readFile: vi.fn(async () => Buffer.from('source')),
    stat: vi.fn(async () => ({ size: 6 })),
  },
}));

vi.mock('../../utils/queryHelpers.js', () => ({
  withPgTransaction: async (work: () => Promise<unknown>) => {
    const snapshot = structuredClone(state);
    try {
      return await work();
    } catch (error) {
      state.statements.splice(0, state.statements.length, ...snapshot.statements);
      state.rows.splice(0, state.rows.length, ...snapshot.rows);
      state.receipts.splice(0, state.receipts.length, ...snapshot.receipts);
      throw error;
    }
  },
}));

vi.mock('../../utils/DbPromise.js', () => ({
  run: (...args: unknown[]) => mocks.dbRun(...args),
}));
vi.mock('../financialStatementPackService.js', () => ({
  recomputeStatementPack: (...args: unknown[]) => mocks.recomputePack(...args),
}));
vi.mock('../financialStatementService.js', () => ({
  assertAtomicStatementImportSchema: vi.fn(async () => undefined),
  locateStatementSections: (...args: unknown[]) => mocks.locate(...args),
  resolveStatementColumnSelection: vi.fn(() => ({
    selectedPeriodLabel: '2025',
    comparisonPeriodLabel: '2024',
  })),
  extractFinancialLines: vi.fn(() => ({
    lines: [
      {
        originalLabel: 'Revenue',
        value: 100,
        rawValue: '100',
        comparisonValue: 90,
        comparisonRawValue: '90',
      },
    ],
  })),
  createStatement: (...args: unknown[]) => mocks.create(...args),
  updateStatementMetadata: vi.fn(async () => undefined),
  updateStatementStatus: vi.fn(async () => undefined),
  startStatementIngestRun: vi.fn(async () => 'run-1'),
  persistStatementExtractedSections: vi.fn(async () => [{ sectionKey: 'P&L_1', sectionId: 's-1' }]),
  persistStatementCandidateRows: vi.fn(async ({ statementId }: { statementId: string }) => {
    state.rows.push(statementId);
  }),
  autoMapLines: vi.fn(async (lines: unknown[]) => lines),
  updateStatementIngestRun: vi.fn(async () => undefined),
  sha256Hex: vi.fn(() => 'a'.repeat(64)),
}));
vi.mock('../finance/canonical/statementSourceReceiptService.js', () => ({
  registerStatementSourceReceipt: vi.fn(async ({ statementId }: { statementId: string }) => {
    state.receipts.push(statementId);
    return { receipt_id: `receipt-${statementId}` };
  }),
}));

import { stageSelectedStatementSections } from '../statementMultiSectionImportService.js';

describe('statementMultiSectionImportService atomic staging', () => {
  beforeEach(() => {
    state.statements.length = 0;
    state.rows.length = 0;
    state.receipts.length = 0;
    mocks.dbRun.mockReset().mockResolvedValue({ changes: 1 });
    mocks.recomputePack.mockReset().mockResolvedValue('pack-1');
    mocks.create.mockReset().mockImplementation(async () => {
      const id = `statement-${state.statements.length + 1}`;
      state.statements.push(id);
      return id;
    });
    mocks.locate.mockReset().mockImplementation((_text: string, type: string) =>
      type === 'P&L'
        ? [
            {
              sectionKey: 'P&L_1',
              statementType: 'P&L',
              confidence: 0.98,
              lineStart: 1,
              lineEnd: 5,
              text: 'Revenue 100 90',
            },
          ]
        : []
    );
  });

  it('fails closed before staging when the tenant-scoped primary pack identity is absent', async () => {
    await expect(
      stageSelectedStatementSections({
        primaryStatementId: 'primary-1',
        organizationId: 'org-1',
        userId: 'user-1',
        statement: {
          source_file_path: '/tmp/source.pdf',
          source_file_name: 'source.pdf',
          parse_method: 'pdf-parse',
          document_class: 'mixed_report',
        },
        text: 'P&L 2025 2024',
        statementTypes: ['P&L'],
        periodLabel: '2025',
        currency: 'PLN',
        scaling: 'thousands',
        entityName: 'Entity',
      })
    ).rejects.toMatchObject({ code: 'STATEMENT_PACK_REQUIRED' });
    expect(state.rows).toEqual([]);
    expect(state.receipts).toEqual([]);
    expect(mocks.recomputePack).not.toHaveBeenCalled();
  });

  it('rolls back earlier type and period staging when a later selected section is missing', async () => {
    mocks.locate.mockImplementation((_text: string, type: string) => {
      if (type === 'BS') {
        // P&L current+comparison writes must have happened inside the same
        // transaction before the later BS-specific failure is raised.
        expect(state.rows.length).toBe(2);
        expect(state.receipts.length).toBe(2);
        return [];
      }
      return [
        {
          sectionKey: 'P&L_1',
          statementType: 'P&L',
          confidence: 0.98,
          lineStart: 1,
          lineEnd: 5,
          text: 'Revenue 100 90',
        },
      ];
    });
    await expect(
      stageSelectedStatementSections({
        primaryStatementId: 'primary-1',
        organizationId: 'org-1',
        userId: 'user-1',
        statement: {
          source_file_path: '/tmp/source.pdf',
          source_file_name: 'source.pdf',
          parse_method: 'pdf-parse',
          document_class: 'mixed_report',
          statement_pack_id: 'pack-1',
        },
        text: 'P&L then no balance sheet',
        statementTypes: ['P&L', 'BS'],
        periodLabel: '2025',
        currency: 'PLN',
        scaling: 'thousands',
        entityName: 'Entity',
      })
    ).rejects.toMatchObject({ code: 'STATEMENT_SECTION_NOT_FOUND', statementType: 'BS' });

    expect(state.statements).toEqual([]);
    expect(state.rows).toEqual([]);
    expect(state.receipts).toEqual([]);
  });

  it('stages P&L, BS and CF for both detected periods with distinct sibling identities and receipts', async () => {
    mocks.locate.mockImplementation((_text: string, type: string) => [
      {
        sectionKey: `${type}_1`,
        statementType: type,
        confidence: 0.98,
        lineStart: 1,
        lineEnd: 5,
        text: `${type} 2025 2024\nRevenue 100 90`,
      },
    ]);

    const result = await stageSelectedStatementSections({
      primaryStatementId: 'primary-1',
      organizationId: 'org-1',
      userId: 'user-1',
      statement: {
        source_file_path: '/tmp/CD_PROJEKT_FY2025.pdf',
        source_file_name: 'CD_PROJEKT_Skonsolidowane_Sprawozdanie_FY2025.pdf',
        parse_method: 'pdf-parse',
        document_class: 'mixed_report',
        statement_pack_id: 'pack-1',
      },
      text: 'P&L, balance sheet and cash flow with comparative columns',
      statementTypes: ['P&L', 'BS', 'CF'],
      periodLabel: '2025',
      currency: 'PLN',
      scaling: 'thousands',
      entityName: 'CD PROJEKT S.A.',
    });

    expect(result.selectedTypes).toEqual(['P&L', 'BS', 'CF']);
    expect(result.statements).toHaveLength(6);
    expect(result.statements.map(({ statementType, periodLabel }) => `${statementType}:${periodLabel}`)).toEqual([
      'P&L:2025',
      'P&L:2024',
      'BS:2025',
      'BS:2024',
      'CF:2025',
      'CF:2024',
    ]);
    expect(new Set(result.statements.map(({ statementId }) => statementId)).size).toBe(6);
    expect(new Set(result.statements.map(({ sourceReceiptId }) => sourceReceiptId)).size).toBe(6);
    expect(result.statements.filter(({ comparisonOfStatementId }) => comparisonOfStatementId)).toHaveLength(3);
    expect(result.statements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          entityName: 'CD PROJEKT S.A.',
          sourceFileName: 'CD_PROJEKT_Skonsolidowane_Sprawozdanie_FY2025.pdf',
          sourceSha256: 'a'.repeat(64),
          currency: 'PLN',
          scaling: 'thousands',
        }),
      ])
    );
    const membershipUpdates = mocks.dbRun.mock.calls.filter(([sql]) =>
      String(sql).includes('statement_pack_id=?')
    );
    expect(membershipUpdates).toHaveLength(6);
    expect(membershipUpdates.every(([, params]) => params[3] === 'pack-1')).toBe(true);
    expect(mocks.recomputePack).toHaveBeenCalledTimes(1);
    expect(mocks.recomputePack).toHaveBeenCalledWith('pack-1', { deferShadow: true });
  });

  it('canonicalizes permutations and duplicates so P&L always owns the primary upload row', async () => {
    mocks.locate.mockImplementation((_text: string, type: string) => [
      {
        sectionKey: `${type}_1`,
        statementType: type,
        confidence: 0.98,
        lineStart: 1,
        lineEnd: 5,
        text: `${type} 2025 2024\nRevenue 100 90`,
      },
    ]);

    const result = await stageSelectedStatementSections({
      primaryStatementId: 'primary-1',
      organizationId: 'org-1',
      userId: 'user-1',
      statement: {
        source_file_path: '/tmp/source.pdf',
        source_file_name: 'source.pdf',
        parse_method: 'pdf-parse',
        document_class: 'mixed_report',
        statement_pack_id: 'pack-1',
      },
      text: 'all sections',
      statementTypes: ['CF', 'BS', 'P&L', 'CF', 'PL'],
      periodLabel: '2025',
      currency: 'PLN',
      scaling: 'thousands',
      entityName: 'Entity',
    });

    expect(result.selectedTypes).toEqual(['P&L', 'BS', 'CF']);
    expect(result.statements.map(({ statementType, periodLabel }) => `${statementType}:${periodLabel}`)).toEqual([
      'P&L:2025',
      'P&L:2024',
      'BS:2025',
      'BS:2024',
      'CF:2025',
      'CF:2024',
    ]);
    expect(result.statements[0]).toMatchObject({
      statementId: 'primary-1',
      statementType: 'P&L',
      periodLabel: '2025',
    });
  });
});
