import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ statements: [] as string[], rows: [] as string[], receipts: [] as string[] }));
const mocks = vi.hoisted(() => ({
  locate: vi.fn(),
  create: vi.fn(),
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

vi.mock('../../utils/DbPromise.js', () => ({ run: vi.fn(async () => ({ changes: 1 })) }));
vi.mock('../financialStatementService.js', () => ({
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

  it('rolls back earlier type and period staging when a later selected section is missing', async () => {
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
});
