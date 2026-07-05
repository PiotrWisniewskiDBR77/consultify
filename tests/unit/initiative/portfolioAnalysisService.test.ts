/**
 * Kręgosłup inicjatyw · F4 · Zdrowie portfela — PURE functions (no DB/LLM).
 *
 * Kontrakt testowany:
 *   findDuplicates:
 *     (1) podobne tytuły flagowane ze score 0..1,
 *     (2) rozłączne tytuły NIE flagowane,
 *     (3) próg / limit / exclude działają,
 *     (4) pusty kandydat ⇒ [].
 *   analyzePortfolioHealth:
 *     (5) byStatus zliczone (case-normalized),
 *     (6) MECE coverage nad stałą taksonomią — KAŻDY obszar obecny,
 *     (7) gaps = obszary bez pokrycia,
 *     (8) balance effort×impact: quickWins/bigBets/moneyPits + siatka 3×3,
 *     (9) duplicateClusters: wzajemnie-podobne grupowane (≥2),
 *    (10) pusty portfel ⇒ total 0, wszystkie obszary = gap, brak klastrów,
 *    (11) classifyArea PL/EN synonimy → taksonomia,
 *    (12) coerceLevel etykiety + liczby → low|medium|high.
 *  + getPortfolioHealth (thin adapter) na mocku queryAll.
 */
import { describe, expect, it } from 'vitest';

import {
  analyzePortfolioHealth,
  classifyArea,
  coerceLevel,
  findDuplicates,
  getPortfolioHealth,
  PORTFOLIO_AREA_TAXONOMY,
  type PortfolioInitiative,
} from '../../../server/src/services/initiative/portfolioAnalysisService.js';

// --------------------------------------------------------------------------
// findDuplicates
// --------------------------------------------------------------------------
describe('findDuplicates', () => {
  const existing: PortfolioInitiative[] = [
    { id: 'a', title: 'Automatyzacja raportowania finansowego', summary: 'raporty finansowe automatyzacja' },
    { id: 'b', title: 'Szkolenia bezpieczeństwa pracowników terenowych' },
    { id: 'c', title: 'Wdrożenie chmury obliczeniowej dla zespołów IT' },
  ];

  it('(1) flaguje podobny tytuł ze score 0..1', () => {
    const res = findDuplicates('Automatyzacja raportowania finansowego', existing);
    expect(res.length).toBeGreaterThan(0);
    expect(res[0].id).toBe('a');
    expect(res[0].score).toBeGreaterThan(0);
    expect(res[0].score).toBeLessThanOrEqual(1);
  });

  it('(2) NIE flaguje rozłącznego tytułu', () => {
    const res = findDuplicates('Kampania marketingowa w mediach społecznościowych', existing);
    expect(res).toEqual([]);
  });

  it('(3a) respektuje próg', () => {
    const low = findDuplicates('raportowania finansowego procesy', existing, { threshold: 0.1 });
    const high = findDuplicates('raportowania finansowego procesy', existing, { threshold: 0.95 });
    expect(low.length).toBeGreaterThanOrEqual(high.length);
    expect(high.length).toBe(0);
  });

  it('(3b) respektuje limit i excludeId', () => {
    const dup: PortfolioInitiative[] = [
      { id: 'x1', title: 'Migracja danych do hurtowni analitycznej' },
      { id: 'x2', title: 'Migracja danych do hurtowni analitycznej' },
      { id: 'x3', title: 'Migracja danych do hurtowni analitycznej' },
    ];
    const limited = findDuplicates('Migracja danych do hurtowni analitycznej', dup, { limit: 2 });
    expect(limited.length).toBe(2);

    const excluded = findDuplicates('Migracja danych do hurtowni analitycznej', dup, { excludeId: 'x1' });
    expect(excluded.map((m) => m.id)).not.toContain('x1');
  });

  it('(4) pusty / bezsensowny kandydat ⇒ []', () => {
    expect(findDuplicates('', existing)).toEqual([]);
    expect(findDuplicates('   ', existing)).toEqual([]);
  });

  it('(4b) sortuje malejąco po score', () => {
    const res = findDuplicates('Automatyzacja raportowania finansowego procesów', existing, {
      threshold: 0.01,
    });
    for (let i = 1; i < res.length; i++) {
      expect(res[i - 1].score).toBeGreaterThanOrEqual(res[i].score);
    }
  });
});

// --------------------------------------------------------------------------
// classifyArea / coerceLevel
// --------------------------------------------------------------------------
describe('classifyArea', () => {
  it('(11) mapuje synonimy PL/EN na taksonomię', () => {
    expect(classifyArea('Analityka danych')).toBe('data');
    expect(classifyArea('Process automation')).toBe('process');
    expect(classifyArea(null, 'HR / talent')).toBe('people');
    expect(classifyArea('Bezpieczeństwo i compliance')).toBe('governance');
    expect(classifyArea('Redukcja kosztów')).toBe('finance');
    expect(classifyArea('Obsługa klienta')).toBe('customer');
    expect(classifyArea('Infrastruktura chmurowa')).toBe('technology');
  });

  it('(11b) nieznany / pusty obszar ⇒ other', () => {
    expect(classifyArea('zupełnie losowy ciąg xyz')).toBe('other');
    expect(classifyArea('')).toBe('other');
    expect(classifyArea(null, null)).toBe('other');
  });
});

describe('coerceLevel', () => {
  it('(12) etykiety tekstowe → poziom', () => {
    expect(coerceLevel('high')).toBe('high');
    expect(coerceLevel('Wysoki')).toBe('high');
    expect(coerceLevel('low')).toBe('low');
    expect(coerceLevel('niski')).toBe('low');
    expect(coerceLevel('medium')).toBe('medium');
    expect(coerceLevel(undefined)).toBe('medium');
    expect(coerceLevel(null)).toBe('medium');
  });

  it('(12b) liczby → poziom', () => {
    expect(coerceLevel(2)).toBe('low');
    expect(coerceLevel(5)).toBe('medium');
    expect(coerceLevel(9)).toBe('high');
    expect(coerceLevel('8')).toBe('high');
  });
});

// --------------------------------------------------------------------------
// analyzePortfolioHealth
// --------------------------------------------------------------------------
describe('analyzePortfolioHealth', () => {
  const portfolio: PortfolioInitiative[] = [
    { id: '1', title: 'Hurtownia danych', area: 'Dane / analityka', status: 'draft', effort: 'low', impact: 'high' },
    { id: '2', title: 'Automatyzacja procesów', area: 'Proces', status: 'EXECUTING', effort: 'high', impact: 'high' },
    { id: '3', title: 'Szkolenia AI', category: 'HR', status: 'EXECUTING', effort: 'high', impact: 'low' },
    { id: '4', title: 'Polityka bezpieczeństwa danych', area: 'Governance', status: 'DRAFT', effort: 'low', impact: 'low' },
  ];

  it('(5) zlicza byStatus (case-normalized)', () => {
    const h = analyzePortfolioHealth(portfolio);
    expect(h.total).toBe(4);
    expect(h.byStatus.DRAFT).toBe(2);
    expect(h.byStatus.EXECUTING).toBe(2);
  });

  it('(6) coverage pokrywa KAŻDY obszar taksonomii (MECE)', () => {
    const h = analyzePortfolioHealth(portfolio);
    expect(h.coverage.map((c) => c.area).sort()).toEqual([...PORTFOLIO_AREA_TAXONOMY].sort());
    const data = h.coverage.find((c) => c.area === 'data');
    expect(data?.count).toBe(1);
    expect(data?.sharePct).toBe(25);
  });

  it('(7) gaps = obszary taksonomii bez pokrycia', () => {
    const h = analyzePortfolioHealth(portfolio);
    // product / customer / technology / finance NIE są pokryte tym portfelem.
    expect(h.gaps).toContain('product');
    expect(h.gaps).toContain('customer');
    expect(h.gaps).not.toContain('data');
    expect(h.gaps).not.toContain('process');
  });

  it('(8) balance effort×impact: siatka 3×3 + nagłówki', () => {
    const h = analyzePortfolioHealth(portfolio);
    expect(h.balance.grid.length).toBe(9);
    expect(h.balance.quickWins).toBe(1); // #1 low effort / high impact
    expect(h.balance.bigBets).toBe(1); // #2 high / high
    expect(h.balance.moneyPits).toBe(1); // #3 high / low
    expect(h.balance.fillIns).toBe(1); // #4 low / low
    const totalInGrid = h.balance.grid.reduce((a, c) => a + c.count, 0);
    expect(totalInGrid).toBe(4);
  });

  it('(9) duplicateClusters grupuje wzajemnie-podobne (≥2)', () => {
    const dupPortfolio: PortfolioInitiative[] = [
      { id: 'd1', title: 'Wdrożenie hurtowni danych analitycznych' },
      { id: 'd2', title: 'Wdrożenie hurtowni danych analitycznych' },
      { id: 'd3', title: 'Kampania marketingowa B2B w social media' },
    ];
    const h = analyzePortfolioHealth(dupPortfolio);
    expect(h.duplicateClusters.length).toBe(1);
    expect(h.duplicateClusters[0].ids.sort()).toEqual(['d1', 'd2']);
    expect(h.duplicateClusters[0].peakScore).toBeGreaterThan(0.45);
  });

  it('(9b) rozłączny portfel ⇒ brak klastrów', () => {
    const h = analyzePortfolioHealth([
      { id: 'u1', title: 'Hurtownia danych analitycznych' },
      { id: 'u2', title: 'Szkolenia bezpieczeństwa pracowników' },
      { id: 'u3', title: 'Kampania marketingowa social media' },
    ]);
    expect(h.duplicateClusters).toEqual([]);
  });

  it('(10) pusty portfel ⇒ total 0, wszystkie obszary = gap, brak klastrów', () => {
    const h = analyzePortfolioHealth([]);
    expect(h.total).toBe(0);
    expect(h.byStatus).toEqual({});
    expect(h.gaps.sort()).toEqual([...PORTFOLIO_AREA_TAXONOMY].sort());
    expect(h.duplicateClusters).toEqual([]);
    expect(h.balance.grid.length).toBe(9);
    expect(h.balance.quickWins).toBe(0);
  });

  it('(10b) odporne na null/śmieci w wejściu', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const h = analyzePortfolioHealth([null, undefined, { id: 'ok', title: 'X' }] as any);
    expect(h.total).toBe(1);
  });
});

// --------------------------------------------------------------------------
// getPortfolioHealth (thin DB adapter, mocked queryAll)
// --------------------------------------------------------------------------
describe('getPortfolioHealth (adapter)', () => {
  it('deleguje do pure fn na danych z db.queryAll', async () => {
    const db = {
      queryAll: async () => [
        { id: '1', title: 'Hurtownia danych', summary: '', status: 'DRAFT', area: 'Dane', category: null, effort: 'low', impact: 'high' },
        { id: '2', title: 'Automatyzacja procesów', summary: '', status: 'EXECUTING', area: 'Proces', category: null, effort: 'high', impact: 'high' },
      ],
    };
    const h = await getPortfolioHealth(db, 'org-1');
    expect(h.total).toBe(2);
    expect(h.byStatus.DRAFT).toBe(1);
    expect(h.coverage.find((c) => c.area === 'data')?.count).toBe(1);
  });

  it('pusty orgId ⇒ pusty portfel (bez query)', async () => {
    let called = false;
    const db = { queryAll: async () => { called = true; return []; } };
    const h = await getPortfolioHealth(db, '');
    expect(called).toBe(false);
    expect(h.total).toBe(0);
  });

  it('błąd query ⇒ pusty portfel (advisory, nie rzuca)', async () => {
    const db = { queryAll: async () => { throw new Error('schema drift'); } };
    const h = await getPortfolioHealth(db, 'org-1');
    expect(h.total).toBe(0);
  });
});
