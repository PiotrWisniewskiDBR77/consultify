/**
 * R3 — hydracja kart do kolumn typowanych.
 *
 * L1: pure mapper `buildTypedColumnUpdates` — kształty kart → kolumny,
 *     non-destrukcyjność, brak kolumny = pominięcie, formaty JSON-array.
 * L2: wiring `hydrateTypedColumns` (Teresa persist) → mock-DB asercja na UPDATE
 *     (czyta istniejący wiersz, zapisuje tylko puste kolumny typowane).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── L2 mock-DB seam: capture queryRun SQL + control queryOne row ─────────────
const mockQueryRun = vi.fn();
const mockQueryOne = vi.fn();
vi.mock('../../../server/src/utils/queryHelpers.js', () => ({
  queryRun: (...a: any[]) => mockQueryRun(...a),
  queryOne: (...a: any[]) => mockQueryOne(...a),
  queryAll: vi.fn(),
  getTableColumns: vi.fn(),
}));

import {
  buildTypedColumnUpdates,
  toUpdateSql,
} from '../../../server/src/services/initiative/cardColumnHydration.js';
import { hydrateTypedColumns } from '../../../server/src/services/ai/tools/generateInitiative.js';

const ALL_COLS = new Set([
  'problem_statement',
  'target_state',
  'scope_in',
  'scope_out',
  'kill_criteria',
  'success_criteria',
  'deliverables',
  'key_risks',
  'business_value',
  'cost_capex',
  'cost_opex',
  'expected_roi',
  'estimated_budget',
]);

// ── L1: pure mapper ──────────────────────────────────────────────────────────

describe('buildTypedColumnUpdates (R3 mapper)', () => {
  it('problemDefinition JSON → problem_statement (symptom as headline)', () => {
    const ups = buildTypedColumnUpdates(
      { problemDefinition: JSON.stringify({ symptom: 'Spadek 12%', rootCause: 'x' }) },
      ALL_COLS,
    );
    expect(ups).toEqual([{ column: 'problem_statement', value: 'Spadek 12%' }]);
  });

  it('problemDefinition free-text → problem_statement (raw text fallback)', () => {
    const ups = buildTypedColumnUpdates({ problemDefinition: 'Po prostu opis problemu.' }, ALL_COLS);
    expect(ups).toEqual([{ column: 'problem_statement', value: 'Po prostu opis problemu.' }]);
  });

  it('scope JSON → scope_in/scope_out/kill_criteria as JSON arrays', () => {
    const ups = buildTypedColumnUpdates(
      {
        scope: JSON.stringify({
          inScope: ['Moduł zamówień', 'ERP'],
          outOfScope: ['Migracja historyczna'],
          killCriteria: ['ROI < 0'],
        }),
      },
      ALL_COLS,
    );
    const byCol = Object.fromEntries(ups.map((u) => [u.column, u.value]));
    expect(JSON.parse(byCol.scope_in)).toEqual(['Moduł zamówień', 'ERP']);
    expect(JSON.parse(byCol.scope_out)).toEqual(['Migracja historyczna']);
    expect(JSON.parse(byCol.kill_criteria)).toEqual(['ROI < 0']);
  });

  it('targetState JSON → success_criteria + deliverables + target_state OBJECT', () => {
    const ups = buildTypedColumnUpdates(
      {
        targetState: JSON.stringify({
          targetDescription: 'Cel: skrócić cykl o 30% do Q4',
          successCriteria: ['NPS > 50'],
          deliverables: ['Kreator'],
        }),
      },
      ALL_COLS,
    );
    const byCol = Object.fromEntries(ups.map((u) => [u.column, u.value]));
    expect(JSON.parse(byCol.success_criteria)).toEqual(['NPS > 50']);
    expect(JSON.parse(byCol.deliverables)).toEqual(['Kreator']);
    // target_state jest OBIEKTEM (nie tablicą) — parytet z tym co czyta FE.
    const parsedTs = JSON.parse(byCol.target_state);
    expect(parsedTs).toEqual({
      description: 'Cel: skrócić cykl o 30% do Q4',
      successCriteria: ['NPS > 50'],
      deliverables: ['Kreator'],
    });
  });

  it('raid JSON → key_risks (płaskie linie „ryzyko — mitygacja: …")', () => {
    const ups = buildTypedColumnUpdates(
      {
        raid: JSON.stringify({
          risks: [
            { type: 'risk', risk: 'Opóźnienie integracji ERP', mitigation: 'Bufor 2 tyg.' },
            { type: 'assumption', title: 'Zespół dostępny w Q3' }, // NIE ryzyko → pominięte
            { type: 'risk', title: 'Brak akceptacji użytkowników' }, // bez mitygacji
          ],
        }),
      },
      ALL_COLS,
    );
    const byCol = Object.fromEntries(ups.map((u) => [u.column, u.value]));
    expect(JSON.parse(byCol.key_risks)).toEqual([
      'Opóźnienie integracji ERP — mitygacja: Bufor 2 tyg.',
      'Brak akceptacji użytkowników',
    ]);
  });

  it('financialImpact → estimated_budget = suma capex+opex gdy oba liczbowe', () => {
    const ups = buildTypedColumnUpdates(
      {
        financialImpact: JSON.stringify({
          businessValue: 'Wartość X',
          costCapex: '1,2 mln zł',
          costOpex: '300 tys. zł/rok',
        }),
      },
      ALL_COLS,
    );
    const byCol = Object.fromEntries(ups.map((u) => [u.column, u.value]));
    // 1,2 mln = 1_200_000 ; 300 tys = 300_000 → 1_500_000
    expect(byCol.estimated_budget).toBe('1500000');
  });

  it('financialImpact → estimated_budget: jawne pole wygrywa nad sumą', () => {
    const ups = buildTypedColumnUpdates(
      {
        financialImpact: JSON.stringify({
          businessValue: 'v',
          estimatedBudget: 2_000_000,
          costCapex: 100,
          costOpex: 50,
        }),
      },
      ALL_COLS,
    );
    const byCol = Object.fromEntries(ups.map((u) => [u.column, u.value]));
    expect(byCol.estimated_budget).toBe('2000000');
  });

  it('financialImpact JSON → financial scalar columns (number coerced to string)', () => {
    const ups = buildTypedColumnUpdates(
      { financialImpact: JSON.stringify({ businessValue: 'Skraca cykl o 30%', costCapex: 500000, expectedRoi: '37%' }) },
      ALL_COLS,
    );
    const byCol = Object.fromEntries(ups.map((u) => [u.column, u.value]));
    expect(byCol.business_value).toBe('Skraca cykl o 30%');
    expect(byCol.cost_capex).toBe('500000');
    expect(byCol.expected_roi).toBe('37%');
  });

  it('financialImpact premium narrative shape → business_value composed (revenueImpact/costSavings/benefitsRealization)', () => {
    // Real shape emitted by the live section prompt (verified on demo 2026-06-28):
    // no `businessValue` field at all → composed from the narrative parts.
    const ups = buildTypedColumnUpdates(
      {
        financialImpact: JSON.stringify({
          revenueImpact: 'Brak bezpośredniego wzrostu przychodu.',
          costSavings: 'Oszczędności ~150K PLN/rok (10% OPEX).',
          benefitsRealization: 'Korzyści w 12 mies.',
        }),
      },
      ALL_COLS,
    );
    const byCol = Object.fromEntries(ups.map((u) => [u.column, u.value]));
    // costSavings first (most value-relevant), then revenue, then realization.
    expect(byCol.business_value).toBe(
      'Oszczędności ~150K PLN/rok (10% OPEX). Brak bezpośredniego wzrostu przychodu. Korzyści w 12 mies.',
    );
  });

  it('explicit businessValue still wins over the narrative fallback', () => {
    const ups = buildTypedColumnUpdates(
      { financialImpact: JSON.stringify({ businessValue: 'Wartość X', costSavings: 'Oszczędności Y' }) },
      ALL_COLS,
    );
    const byCol = Object.fromEntries(ups.map((u) => [u.column, u.value]));
    expect(byCol.business_value).toBe('Wartość X');
  });

  it('is NON-DESTRUCTIVE: skips columns that already have a value', () => {
    const ups = buildTypedColumnUpdates(
      { problemDefinition: JSON.stringify({ symptom: 'nowy' }), scope: JSON.stringify({ inScope: ['a'] }) },
      ALL_COLS,
      { problem_statement: 'EDYTOWANE RĘCZNIE', scope_in: '[]' }, // problem filled, scope_in empty
    );
    const cols = ups.map((u) => u.column);
    expect(cols).not.toContain('problem_statement'); // already filled → skipped
    expect(cols).toContain('scope_in'); // '[]' counts as empty → filled
  });

  it('skips columns absent from schema', () => {
    const ups = buildTypedColumnUpdates(
      { scope: JSON.stringify({ inScope: ['a'], outOfScope: ['b'] }) },
      new Set(['scope_in']), // only scope_in exists
    );
    expect(ups.map((u) => u.column)).toEqual(['scope_in']);
  });

  it('ignores unparseable / empty cards (no garbage written)', () => {
    expect(buildTypedColumnUpdates({ scope: 'totalnie nie json' }, ALL_COLS)).toEqual([]);
    expect(buildTypedColumnUpdates({}, ALL_COLS)).toEqual([]);
    expect(buildTypedColumnUpdates(null, ALL_COLS)).toEqual([]);
  });
});

describe('toUpdateSql', () => {
  it('produces a SET clause + ordered params', () => {
    const { setClause, params } = toUpdateSql([
      { column: 'problem_statement', value: 'p' },
      { column: 'scope_in', value: '["a"]' },
    ]);
    expect(setClause).toBe('problem_statement = ?, scope_in = ?');
    expect(params).toEqual(['p', '["a"]']);
  });
});

// ── L2: hydrateTypedColumns wiring (mock-DB UPDATE assertion) ─────────────────

describe('hydrateTypedColumns (Teresa persist → UPDATE)', () => {
  beforeEach(() => {
    mockQueryRun.mockReset().mockResolvedValue({ changes: 1 });
    mockQueryOne.mockReset();
  });

  it('reads the row then UPDATEs only empty typed columns with mapped values', async () => {
    // Existing row: problem_statement already set (human), rest empty.
    mockQueryOne.mockResolvedValue({
      problem_statement: 'RĘCZNY PROBLEM',
      scope_in: null,
      scope_out: null,
      kill_criteria: null,
      success_criteria: null,
      deliverables: null,
      business_value: null,
      cost_capex: null,
      cost_opex: null,
      expected_roi: null,
    });

    await hydrateTypedColumns(
      'init-1',
      'org-1',
      {
        problemDefinition: JSON.stringify({ symptom: 'AI symptom' }),
        scope: JSON.stringify({ inScope: ['Zakres A'], outOfScope: ['Poza B'] }),
      },
      ALL_COLS,
    );

    // One SELECT (queryOne) + one UPDATE (queryRun).
    expect(mockQueryOne).toHaveBeenCalledTimes(1);
    expect(mockQueryRun).toHaveBeenCalledTimes(1);

    const [sql, params] = mockQueryRun.mock.calls[0];
    // problem_statement must NOT be overwritten (already filled).
    expect(sql).not.toContain('problem_statement =');
    expect(sql).toContain('scope_in = ?');
    expect(sql).toContain('scope_out = ?');
    // last two params are the WHERE bind (id, org).
    expect(params.slice(-2)).toEqual(['init-1', 'org-1']);
    // scope_in value is a JSON array string.
    const scopeInParam = params[sql.split('?').findIndex((_: string, i: number) => sql.split(',')[i]?.includes('scope_in'))];
    expect(params.some((p: string) => p === JSON.stringify(['Zakres A']))).toBe(true);
    expect(params.some((p: string) => p === JSON.stringify(['Poza B']))).toBe(true);
    void scopeInParam;
  });

  it('no UPDATE when nothing maps (all columns already filled)', async () => {
    mockQueryOne.mockResolvedValue({
      problem_statement: 'X', scope_in: '["a"]', scope_out: '["b"]', kill_criteria: '["c"]',
      success_criteria: '["d"]', deliverables: '["e"]', business_value: 'v',
      cost_capex: '1', cost_opex: '2', expected_roi: '3',
    });
    await hydrateTypedColumns('i', 'o', { scope: JSON.stringify({ inScope: ['z'] }) }, ALL_COLS);
    expect(mockQueryRun).not.toHaveBeenCalled();
  });

  it('fail-soft: a DB error never throws out of hydration', async () => {
    mockQueryOne.mockRejectedValue(new Error('db down'));
    mockQueryRun.mockResolvedValue({ changes: 1 });
    await expect(
      hydrateTypedColumns('i', 'o', { problemDefinition: JSON.stringify({ symptom: 's' }) }, ALL_COLS),
    ).resolves.toBeUndefined();
    // queryOne failed → treats row as empty → still attempts the UPDATE.
    expect(mockQueryRun).toHaveBeenCalledTimes(1);
  });
});
