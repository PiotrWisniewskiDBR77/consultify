/**
 * S1.4 (2026-09-13) — ocena BEZ ANI JEDNEJ policzalnej luki.
 *
 * ★ CO TO ZŁAPAŁO. Obszar zapisany z poziomem obecnym, ale bez docelowego, ma
 * `gap === null`. Gdy TAKIE są wszystkie obszary osi (realny kształt 2 z 3 ocen
 * DBR77 na stagingu, zmierzone 13.09), `Math.max(...[])` dawało `-Infinity`,
 * lista liderów luki wychodziła pusta i `leaders[0].unitId` rzucało
 * `TypeError: Cannot read properties of undefined (reading 'unitId')`.
 * Skutkiem był HTTP 500 na trasach `GET /api/assessment-reports/assessment/
 * :id/export/report.docx` i `.../deck.pptx` — właściciel nie dostawał PLIKU,
 * tylko błąd (4 z 6 pobrań).
 *
 * Wariant programowy (`composeProgramAggregateNarrative`) nie wywracał się, ale
 * drukował klientowi w streszczeniu zarządczym „Luki mieszczą się od Infinity
 * do -Infinity" oraz „z luką null" / „docelowe 1A: null".
 *
 * MUTACJA: przywrócenie `Math.max(...gaps)` bez strażnika `gaps.length > 0`
 * wywraca pierwszy test (TypeError) i zapala trzeci (Infinity w treści).
 */
import { describe, expect, it } from 'vitest';

import {
  composeChapterAggregateNarrative,
  composeProgramAggregateNarrative,
} from '../assessmentNarrativeComposer.js';

/** Obszar zmierzony, ale bez poziomu docelowego — więc bez policzalnej luki. */
const bezLuki = (unitId: string) => ({
  unitId,
  unitNamePL: `Obszar ${unitId}`,
  currentLevel: 3,
  targetLevel: null,
  gap: null,
  confidence: 'high' as const,
  evidenceCount: 1,
  recommendation: '',
  expectedOutcome: null,
});

describe('S1.4 — narracja dla oceny bez policzalnej luki', () => {
  it('oś z findingami, ale bez ani jednej luki, NIE rzuca i oddaje uczciwy brak treści', () => {
    const narracja = composeChapterAggregateNarrative({
      axisId: 1,
      axisNamePL: 'Procesy Cyfrowe',
      maxLevel: 6,
      totalAreas: 9,
      skippedCount: 0,
      findings: [bezLuki('1A'), bezLuki('1D')],
      frozenDate: '2026-09-13',
      sourceKind: 'legacy',
    });

    expect(narracja.introduction).toBeNull();
    expect(narracja.conclusion).toBeNull();
    expect(narracja.decisionLine.direction).toBeNull();
    expect(narracja.decisionLine.priority).toBeNull();
    // Podpis matrycy zostaje — tabela poziomów ma sens także bez luk.
    expect(narracja.matrixCaption).toContain('9 obszarów');
  });

  it('program bez ani jednej luki nie wypisuje kierunku ani priorytetu z -Infinity', () => {
    const narracja = composeProgramAggregateNarrative({
      axisCount: 7,
      totalAreas: 39,
      findings: [bezLuki('1A'), bezLuki('3A'), bezLuki('4A')],
      limitations: [],
      sourceKind: 'legacy',
    });

    expect(narracja.decisionLine.direction).toBeNull();
    expect(narracja.decisionLine.priority).toBeNull();
  });

  it('żadna sekcja programu nie przemyca do klienta null, Infinity ani NaN', () => {
    const narracja = composeProgramAggregateNarrative({
      axisCount: 7,
      totalAreas: 39,
      findings: [bezLuki('1A'), bezLuki('3A'), bezLuki('4A')],
      limitations: [],
      sourceKind: 'legacy',
    });

    const caleWyjscie = [
      narracja.executiveSummary,
      narracja.criticalGaps,
      narracja.finalConclusions,
      narracja.decisionLine.direction,
      narracja.decisionLine.priority,
      narracja.decisionLine.horizon,
      narracja.decisionLine.successCondition,
    ]
      .filter((fragment): fragment is string => typeof fragment === 'string')
      .join('\n');

    expect(caleWyjscie).not.toMatch(/Infinity/);
    expect(caleWyjscie).not.toMatch(/\bnull\b/);
    expect(caleWyjscie).not.toMatch(/\bNaN\b/);
  });

  it('ocena Z lukami dalej dostaje kierunek i priorytet (brak regresji)', () => {
    const zLuka = { ...bezLuki('2A'), targetLevel: 5, gap: 2 };
    const narracja = composeProgramAggregateNarrative({
      axisCount: 7,
      totalAreas: 39,
      findings: [zLuka, bezLuki('1A')],
      limitations: [],
      sourceKind: 'legacy',
    });

    expect(narracja.decisionLine.direction).toContain('2A');
    expect(narracja.decisionLine.priority).toBeTruthy();
  });
});
