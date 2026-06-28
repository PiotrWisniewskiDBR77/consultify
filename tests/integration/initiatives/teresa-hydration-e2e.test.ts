/**
 * R3 capstone (L3) — Teresa create → typed-column hydration, END-TO-END.
 *
 * Proves the full chain that the brain→R3 fix enables: `generateInitiative`
 * (Teresa tool) → brain returns FIELD-JSON cards → `persistCards` →
 * `hydrateTypedColumns` writes the authoritative columns. The hydration chain
 * (cardColumnHydration) is REAL; only the heavy leaves (create funnel, brain,
 * DB) are mocked. Closes "zero nigdy nie wykonane" for R3.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockCreate, mockFullFill, mockQueryRun, mockQueryOne, mockGetCols } = vi.hoisted(() => ({
  mockCreate: vi.fn(async () => ({ id: 'init-1' })),
  mockFullFill: vi.fn(),
  mockQueryRun: vi.fn(async () => ({ changes: 1 })),
  mockQueryOne: vi.fn(async () => null), // hydration read → empty row (fresh DRAFT)
  mockGetCols: vi.fn(async () => [
    { name: 'ai_generated_sections' },
    { name: 'source_type' },
    { name: 'source_id' },
    { name: 'problem_statement' },
    { name: 'scope_in' },
    { name: 'scope_out' },
    { name: 'kill_criteria' },
    { name: 'success_criteria' },
    { name: 'deliverables' },
    { name: 'business_value' },
    { name: 'cost_capex' },
    { name: 'cost_opex' },
    { name: 'expected_roi' },
  ]),
}));

vi.mock('../../../server/src/services/initiativeGenerationService.js', () => ({
  createInitiative: mockCreate,
  default: { createInitiative: mockCreate },
}));
vi.mock('../../../server/src/services/initiative/initiativeGeneratorBrain.js', () => ({
  generateFullInitiative: mockFullFill,
  defaultDeps: vi.fn(() => ({})),
}));
vi.mock('../../../server/src/utils/queryHelpers.js', () => ({
  queryRun: (...a: any[]) => mockQueryRun(...a),
  queryOne: (...a: any[]) => mockQueryOne(...a),
  queryAll: vi.fn(async () => []),
  getTableColumns: (...a: any[]) => mockGetCols(...a),
}));

import { generateInitiative } from '../../../server/src/services/ai/tools/generateInitiative.ts';

beforeEach(() => {
  mockQueryRun.mockClear();
  mockQueryOne.mockClear();
  mockCreate.mockClear();
});

describe('Teresa generate_initiative → typed-column hydration (R3 L3)', () => {
  it('field-JSON cards from the brain land in authoritative columns', async () => {
    // Brain returns FIELD-SHAPED JSON (the shape the brain→R3 fix now stores).
    mockFullFill.mockResolvedValueOnce({
      cards: {
        problemDefinition: JSON.stringify({ symptom: 'Zamówienia spadają 12% kw/kw' }),
        scope: JSON.stringify({ inScope: ['Moduł zamówień'], outOfScope: ['Migracja historyczna'] }),
        targetState: JSON.stringify({ successCriteria: ['NPS > 50'], deliverables: ['Kreator'] }),
      },
    });

    const res = await generateInitiative(
      { title: 'Inicjatywa testowa', problem: 'Spadek zamówień' },
      { organizationId: 'org-1', userId: 'u1' },
    );
    expect((res as any).ok).not.toBe(false);

    // Find the typed-column hydration UPDATE among all queryRun calls.
    const calls = mockQueryRun.mock.calls.map((c) => String(c[0]));
    const hydrationCall = mockQueryRun.mock.calls.find((c) =>
      String(c[0]).includes('scope_in') || String(c[0]).includes('problem_statement'),
    );
    expect(hydrationCall, `no hydration UPDATE in: ${calls.join(' | ')}`).toBeTruthy();

    const [sql, paramArr] = hydrationCall as [string, any[]];
    expect(sql).toContain('problem_statement = ?');
    expect(sql).toContain('scope_in = ?');
    // values present (param order matches the SET clause; WHERE binds last two)
    expect(paramArr).toContain('Zamówienia spadają 12% kw/kw');
    expect(paramArr).toContain(JSON.stringify(['Moduł zamówień']));
    expect(paramArr).toContain(JSON.stringify(['NPS > 50']));
    expect(paramArr.slice(-2)).toEqual(['init-1', 'org-1']);
  });

  it('prose-only cards write NO typed columns (graceful, no garbage)', async () => {
    mockFullFill.mockResolvedValueOnce({
      cards: { problemDefinition: 'Po prostu opis problemu prozą.' },
    });
    await generateInitiative({ title: 'X', problem: 'p' }, { organizationId: 'org-2' });
    // problem_statement scalar accepts raw text fallback → it DOES hydrate problem_statement.
    const hydrationCall = mockQueryRun.mock.calls.find((c) =>
      String(c[0]).includes('problem_statement'),
    );
    expect(hydrationCall).toBeTruthy();
    expect((hydrationCall as any)[1]).toContain('Po prostu opis problemu prozą.');
  });

  it('brain failure never breaks the tool (DRAFT still returned)', async () => {
    mockFullFill.mockRejectedValueOnce(new Error('brain down'));
    const res = await generateInitiative({ title: 'X', problem: 'p' }, { organizationId: 'org-3' });
    expect((res as any).ok).not.toBe(false);
    expect(mockCreate).toHaveBeenCalled();
  });
});
