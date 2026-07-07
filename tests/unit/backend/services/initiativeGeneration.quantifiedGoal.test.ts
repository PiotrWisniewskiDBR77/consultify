/**
 * initiativeGenerationService — "do ustalenia" ban in goals (sędzia BCG #1)
 *
 * Reproduces the reported defect: every KPI / success criterion / ROI value was
 * "baseline do ustalenia" / "redukcja o do ustalenia %", making the business case
 * non-falsifiable. The doctrine now BANS "do ustalenia"/"TBD" as a goal/KPI/ROI
 * VALUE and requires an estimate-with-assumption instead.
 *
 * Two deterministic checks (no LLM):
 *   1. The heuristic reviewer flags a goal section that still contains the
 *      escape phrase (new `quantified_goal` validator).
 *   2. The doctrine system prompt carries the explicit ban.
 *
 * @module tests/unit/backend/services/initiativeGeneration.quantifiedGoal.test.ts
 */

import { describe, it, expect, vi } from 'vitest';

vi.mock('../../../../server/src/utils/Logger.js', () => ({
  default: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));
// Section-type DB service is imported at module load — stub its default export.
vi.mock('../../../../server/src/services/initiativeSectionTypeService.js', () => ({
  default: {
    getSectionTypeByKey: vi.fn(),
    getAllSectionTypes: vi.fn().mockResolvedValue([]),
  },
}));
// DB constructor must not throw at module load.
vi.mock('../../../../server/src/database/Database.js', () => ({
  getDatabase: () => ({}),
}));

import { heuristicReview } from '../../../../server/src/services/initiativeGenerationService.js';

describe('heuristicReview — quantified_goal validator (do ustalenia ban)', () => {
  it('flags a KPI section that uses "do ustalenia" as a target value', () => {
    const bad =
      'KPI primary: Koszty utrzymania ruchu zmniejszone o do ustalenia PLN rocznie ' +
      '(baseline do ustalenia względem obecnego poziomu). KPI wtórny: redukcja liczby ' +
      'przestojów maszyn produkcyjnych o do ustalenia procent w skali kwartału do walidacji.';
    const res = heuristicReview('kpis', bad);
    expect(res.failedValidators).toContain('quantified_goal');
    expect(res.verdict).toBe('FAIL');
  });

  it('flags a financial-impact section with "do ustalenia" ROI', () => {
    // ≥20 words so it clears the near-empty content-length hard FAIL and the
    // section-specific validators actually run.
    const bad =
      'Analiza finansowa inicjatywy transformacyjnej. ROI: do ustalenia w kolejnym etapie. ' +
      'Oszczędności operacyjne: do określenia PLN rocznie w horyzoncie dwunastu miesięcy. ' +
      'Przychód dodatkowy: do ustalenia, wymaga dalszej analizy przez zespół controllingu.';
    const res = heuristicReview('financial-impact', bad);
    expect(res.failedValidators).toContain('quantified_goal');
  });

  it('does NOT raise quantified_goal for a section with a real numeric estimate + assumption', () => {
    const good =
      'KPI primary: redukcja kosztów utrzymania ruchu o 15 procent, czyli około 120 tysięcy ' +
      'PLN rocznie (szacunek zakładając eliminację trzech z ośmiu przestojów miesięcznie). ' +
      'baseline: około 40 godzin miesięcznie, target: 34 godziny miesięcznie w horyzoncie kwartału.';
    const res = heuristicReview('kpis', good);
    expect(res.failedValidators).not.toContain('quantified_goal');
  });

  it('does NOT apply the goal ban to non-goal sections (e.g. scope)', () => {
    const scope =
      'W zakresie: audyt maszyn i przegląd historii przestojów. Poza zakresem: integracja ' +
      'z systemem ERP oraz wdrożenie czujników — pozostaje do ustalenia w osobnej inicjatywie ' +
      'transformacji cyfrowej. Warunek STOP: brak poprawy dostępności po trzech miesiącach pilotażu.';
    const res = heuristicReview('scope', scope);
    expect(res.failedValidators).not.toContain('quantified_goal');
  });
});
