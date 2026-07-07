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

// ── FIX 1b: ROI / budżet wyłuskane z NARRACJI karty finansowej ────────────────

describe('buildTypedColumnUpdates — FIX 1b (ROI/budget z narracji)', () => {
  it('expected_roi z "ROI 285%" w benefitsRealization (brak jawnego pola)', () => {
    const ups = buildTypedColumnUpdates(
      {
        financialImpact: JSON.stringify({
          revenueImpact: 'Wzrost przychodu ~2 mln zł/rok.',
          costSavings: 'Oszczędności OPEX 400 tys. zł.',
          benefitsRealization: 'Oczekiwane ROI 285% w horyzoncie 24 mies.',
        }),
      },
      ALL_COLS,
    );
    const byCol = Object.fromEntries(ups.map((u) => [u.column, u.value]));
    expect(byCol.expected_roi).toBe('ROI 285%');
  });

  it('expected_roi z "payback 14 miesięcy" gdy brak ROI %', () => {
    const ups = buildTypedColumnUpdates(
      {
        financialImpact: JSON.stringify({
          revenueImpact: 'Brak bezpośredniego wzrostu.',
          costSavings: 'Redukcja kosztów.',
          benefitsRealization: 'Payback 14 miesięcy przy pełnym wdrożeniu.',
        }),
      },
      ALL_COLS,
    );
    const byCol = Object.fromEntries(ups.map((u) => [u.column, u.value]));
    expect(byCol.expected_roi).toBe('payback 14 mies.');
  });

  it('expected_roi z krotności "zwrot 3,2x"', () => {
    const ups = buildTypedColumnUpdates(
      {
        financialImpact: JSON.stringify({
          costSavings: 'Inwestycja daje zwrot 3,2x w 3 lata.',
        }),
      },
      ALL_COLS,
    );
    const byCol = Object.fromEntries(ups.map((u) => [u.column, u.value]));
    expect(byCol.expected_roi).toBe('ROI 3,2x');
  });

  it('jawne expectedRoi wygrywa nad ekstrakcją z narracji', () => {
    const ups = buildTypedColumnUpdates(
      {
        financialImpact: JSON.stringify({
          expectedRoi: '150%',
          benefitsRealization: 'gdzieś tu ROI 285%',
        }),
      },
      ALL_COLS,
    );
    const byCol = Object.fromEntries(ups.map((u) => [u.column, u.value]));
    expect(byCol.expected_roi).toBe('150%');
  });

  it('estimated_budget z "budżet 1,2 mln zł" w narracji (brak capex/opex/jawnego pola)', () => {
    const ups = buildTypedColumnUpdates(
      {
        financialImpact: JSON.stringify({
          revenueImpact: 'Szacowany budżet 1,2 mln zł na wdrożenie w 2026.',
          costSavings: 'Oszczędności do ustalenia.',
        }),
      },
      ALL_COLS,
    );
    const byCol = Object.fromEntries(ups.map((u) => [u.column, u.value]));
    expect(byCol.estimated_budget).toBe('1200000');
  });

  it('estimated_budget z "€500k" (waluta + skrót rzędu)', () => {
    const ups = buildTypedColumnUpdates(
      {
        financialImpact: JSON.stringify({
          benefitsRealization: 'Total investment of €500k over two years.',
        }),
      },
      ALL_COLS,
    );
    const byCol = Object.fromEntries(ups.map((u) => [u.column, u.value]));
    expect(byCol.estimated_budget).toBe('500000');
  });

  it('brak liczb w narracji → expected_roi/estimated_budget zostają puste (nie zmyśla)', () => {
    const ups = buildTypedColumnUpdates(
      {
        financialImpact: JSON.stringify({
          revenueImpact: 'Trudne do oszacowania na tym etapie.',
          costSavings: 'Do ustalenia po pilotażu.',
          benefitsRealization: 'Korzyści jakościowe, bez twardych liczb.',
        }),
      },
      ALL_COLS,
    );
    const byCol = Object.fromEntries(ups.map((u) => [u.column, u.value]));
    expect(byCol.expected_roi).toBeUndefined();
    expect(byCol.estimated_budget).toBeUndefined();
  });

  it('capex+opex mają pierwszeństwo nad ekstrakcją budżetu z narracji', () => {
    const ups = buildTypedColumnUpdates(
      {
        financialImpact: JSON.stringify({
          costCapex: '800 tys. zł',
          costOpex: '200 tys. zł',
          revenueImpact: 'gdzieś tu budżet 5 mln zł',
        }),
      },
      ALL_COLS,
    );
    const byCol = Object.fromEntries(ups.map((u) => [u.column, u.value]));
    expect(byCol.estimated_budget).toBe('1000000'); // 800k + 200k, nie 5 mln z narracji
  });
});

// ── FIX R5 — próbki 1:1 z ŻYWEGO demo (2026-07-07) ────────────────────────────
// financialImpact skopiowany dosłownie z GET /api/initiatives/{INI-1,INI-2} na
// demo.consultify.ai. Chroni przed regresją dwóch defektów zmierzonych na żywo:
//   (a) expected_roi = NULL mimo „ROI 2.5-3.5x" (zakres z myślnikiem gubiony),
//   (b) estimated_budget = 40 (śmieć z „redukcję kosztów o 40%").
describe('buildTypedColumnUpdates — FIX R5 (próbki z żywego demo 2026-07-07)', () => {
  // INI-2 (DACH) — GET /api/initiatives/cb9fc880-047b-4576-a4c8-2e97593e14f6
  const INI2_FINANCIAL = {
    revenueImpact:
      'Dodatkowy przychód 2.1-4.2M PLN rocznie od roku 3 (szacunek; zakładając zdobycie 0.5-1% udziału w niemieckim segmencie Industry 4.0 wartym €3.2B, przy średniej wartości kontraktu 150-300K PLN/rok dla firm Mittelstand). Stanowi to 62-124% wzrost względem obecnego przychodu 3.4M PLN.',
    costSavings:
      'Oszczędności operacyjne 200-350K PLN rocznie od roku 2 (szacunek; zakładając redukcję kosztów akwizycji klienta o 40% dzięki efektowi skali i referencjom, plus optymalizację kosztów wsparcia przez lokalizację). Równowartość ~6-10% obecnych kosztów operacyjnych organizacji.',
    benefitsRealization:
      'Faza 1 (miesiące 1-12): koszty inwestycyjne 800K-1.2M PLN bez zwrotu. Faza 2 (rok 2): pierwsze kontrakty pilotażowe 300-500K PLN przychodu. Faza 3 (lata 3-5): pełna materializacja - ROI 2.5-3.5x przy założeniu utrzymania 15-25 klientów niemieckich średniej wielkości. Próg rentowności w miesiącu 18-24.',
  };

  // INI-1 — GET /api/initiatives/836e4f12-2f55-4580-9caa-5318797d9948
  const INI1_FINANCIAL = {
    revenueImpact:
      '~2.1M PLN rocznie od Q3 2027 (szacunek; zakładając 10 klientów × 17.5K PLN ARR średnio), co stanowi ~62% wzrost przychodów względem bazy FY2025 3.4M PLN. Potencjał skalowania do 5-7M PLN w roku 2028 przy 30+ klientach.',
    costSavings:
      '~180K PLN rocznie od Q4 2027 z redukcji kosztów delivery (szacunek; zakładając eliminację 60% custom development per klient dzięki self-serve SaaS vs obecny bespoke model). Dodatkowe oszczędności ~120K PLN z optymalizacji support przy skalowaniu.',
    benefitsRealization:
      'Przychody: pierwsze płatności Q3 2027 (3 miesiące po GA), pełny ARR od Q4 2027. Oszczędności delivery: stopniowo od Q2 2027 wraz z migracją klientów na SaaS. Break-even produktu: Q1 2028. Pełna rentowność inicjatywy: Q2 2028 z accumulated revenue ~3.2M PLN vs szacowane nakłady development+marketing ~1.8M PLN.',
  };

  it('INI-2: expected_roi wyłuskuje ZAKRES "ROI 2.5-3.5x" (regresja: myślnik gubił match)', () => {
    const ups = buildTypedColumnUpdates(
      { financialImpact: JSON.stringify(INI2_FINANCIAL) },
      ALL_COLS,
    );
    const byCol = Object.fromEntries(ups.map((u) => [u.column, u.value]));
    expect(byCol.expected_roi).toBe('ROI 2.5-3.5x');
  });

  it('INI-2: estimated_budget = "koszty inwestycyjne 800K-1.2M PLN" → 800000 (NIE śmieciowe 40 z "o 40%")', () => {
    const ups = buildTypedColumnUpdates(
      { financialImpact: JSON.stringify(INI2_FINANCIAL) },
      ALL_COLS,
    );
    const byCol = Object.fromEntries(ups.map((u) => [u.column, u.value]));
    expect(byCol.estimated_budget).toBe('800000');
    expect(byCol.estimated_budget).not.toBe('40');
  });

  it('INI-1: expected_roi z break-even/rentowności "Q1 2028" gdy brak jawnego ROI/krotności', () => {
    const ups = buildTypedColumnUpdates(
      { financialImpact: JSON.stringify(INI1_FINANCIAL) },
      ALL_COLS,
    );
    const byCol = Object.fromEntries(ups.map((u) => [u.column, u.value]));
    expect(byCol.expected_roi).toBe('rentowność Q1 2028');
  });

  it('INI-1: estimated_budget bierze "nakłady … ~1.8M PLN" (priorytet nad "kosztów delivery … 2.1M")', () => {
    const ups = buildTypedColumnUpdates(
      { financialImpact: JSON.stringify(INI1_FINANCIAL) },
      ALL_COLS,
    );
    const byCol = Object.fromEntries(ups.map((u) => [u.column, u.value]));
    expect(byCol.estimated_budget).toBe('1800000');
  });

  it('ANTY-TEST śmieć: gole "o 40%" przy słowie "koszt" → estimated_budget PUSTY (nie 40)', () => {
    const ups = buildTypedColumnUpdates(
      {
        financialImpact: JSON.stringify({
          costSavings: 'Redukcja kosztów akwizycji klienta o 40% dzięki efektowi skali.',
          benefitsRealization: 'Korzyści jakościowe, marża wzrasta o 15%.',
        }),
      },
      ALL_COLS,
    );
    const byCol = Object.fromEntries(ups.map((u) => [u.column, u.value]));
    expect(byCol.estimated_budget).toBeUndefined();
  });

  it('ANTY-TEST: gola liczba bez markera "40 jednostek" nie jest budżetem', () => {
    const ups = buildTypedColumnUpdates(
      {
        financialImpact: JSON.stringify({
          revenueImpact: 'Koszt operacyjny wynosi 40 jednostek miesięcznie.',
        }),
      },
      ALL_COLS,
    );
    const byCol = Object.fromEntries(ups.map((u) => [u.column, u.value]));
    expect(byCol.estimated_budget).toBeUndefined();
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
