/**
 * Uspójnienie F3.7 — Portfolio MECE check (pure, deterministic, no DB/LLM).
 *
 * Kontrakt testowany:
 *   (a) OVERLAP wykryty — kandydat dubluje istniejącą inicjatywę
 *       (ten sam goalKey i/lub podobny tytuł/treść),
 *   (b) GAP wykryty — istniejący goalKey, którego żaden kandydat nie pokrywa,
 *   (c) COVERAGE policzone (0..100) jako udział pokrytych goalKeyów,
 *   (d) brak istniejących goalKeyów ⇒ coverage 100 / brak gapów,
 *   (e) rozłączny portfel ⇒ brak overlapów.
 */
import { describe, expect, it } from 'vitest';

import { checkPortfolioMece } from '../../../server/src/services/initiative/portfolioMeceService.js';

describe('checkPortfolioMece', () => {
  it('(a) wykrywa OVERLAP po tym samym goalKey', () => {
    const existing = [
      { id: 'e1', title: 'Automatyzacja raportów finansowych', goalKey: 'reduce_cost' },
    ];
    const candidates = [
      { title: 'Cyfryzacja procesu raportowania', goalKey: 'reduce_cost' },
    ];

    const res = checkPortfolioMece(existing, candidates);

    expect(res.overlaps.length).toBeGreaterThan(0);
    expect(res.overlaps[0].existingId).toBe('e1');
    expect(res.overlaps[0].candidateTitle).toBe('Cyfryzacja procesu raportowania');
    expect(res.overlaps[0].reason).toMatch(/goalKey/i);
  });

  it('(a2) wykrywa OVERLAP po podobnej treści (Jaccard)', () => {
    const existing = [
      {
        id: 'e2',
        title: 'Wdrożenie systemu zarządzania magazynem',
        summary: 'system zarzadzania magazynem wms logistyka',
      },
    ];
    const candidates = [
      {
        title: 'Wdrożenie systemu zarządzania magazynem',
        description: 'system zarzadzania magazynem wms logistyka',
      },
    ];

    const res = checkPortfolioMece(existing, candidates);

    expect(res.overlaps.length).toBeGreaterThan(0);
    expect(res.overlaps[0].existingId).toBe('e2');
  });

  it('(b) wykrywa GAP — istniejący goalKey bez kandydata', () => {
    const existing = [
      { id: 'e1', title: 'Redukcja kosztów', goalKey: 'reduce_cost' },
      { id: 'e2', title: 'Wzrost przychodów', goalKey: 'grow_revenue' },
    ];
    const candidates = [{ title: 'Nowy projekt oszczędności', goalKey: 'reduce_cost' }];

    const res = checkPortfolioMece(existing, candidates);

    // grow_revenue nie jest pokryte przez żadnego kandydata.
    expect(res.gaps).toContain('grow_revenue');
    expect(res.gaps).not.toContain('reduce_cost');
  });

  it('(c) liczy COVERAGE jako udział pokrytych goalKeyów', () => {
    const existing = [
      { id: 'e1', title: 'A', goalKey: 'g1' },
      { id: 'e2', title: 'B', goalKey: 'g2' },
      { id: 'e3', title: 'C', goalKey: 'g3' },
      { id: 'e4', title: 'D', goalKey: 'g4' },
    ];
    const candidates = [
      { title: 'X', goalKey: 'g1' },
      { title: 'Y', goalKey: 'g2' },
      { title: 'Z', goalKey: 'g3' },
    ];

    const res = checkPortfolioMece(existing, candidates);

    // 3 z 4 goalKeyów pokryte => 75%.
    expect(res.coveragePct).toBe(75);
    expect(res.gaps).toEqual(['g4']);
  });

  it('(d) brak istniejących goalKeyów ⇒ coverage 100, brak gapów', () => {
    const existing = [{ id: 'e1', title: 'Coś tam bez celu' }];
    const candidates = [{ title: 'Zupełnie nowa inicjatywa wdrożeniowa' }];

    const res = checkPortfolioMece(existing, candidates);

    expect(res.coveragePct).toBe(100);
    expect(res.gaps).toEqual([]);
  });

  it('(e) rozłączny portfel ⇒ brak overlapów', () => {
    const existing = [
      { id: 'e1', title: 'Automatyzacja księgowości', goalKey: 'finance' },
    ];
    const candidates = [
      { title: 'Szkolenia bezpieczeństwa pracowników terenowych', goalKey: 'hr_safety' },
    ];

    const res = checkPortfolioMece(existing, candidates);

    expect(res.overlaps).toEqual([]);
    // finance istnieje, żaden kandydat go nie pokrywa => gap.
    expect(res.gaps).toContain('finance');
    expect(res.coveragePct).toBe(0);
  });
});
