/**
 * NIEZALEŻNA WERYFIKACJA (nie autor pakietu) — gate-e, PKG-G Prediction.
 *
 * Własny przypadek dla twierdzenia 5 z briefu weryfikatora: "dwie inicjatywy uderzające w tę samą
 * linię kosztową — sprawdź, czy system je wykrywa, czy po cichu sumuje." Ten plik NIE jest kopią
 * testów autora — buduje od zera dwie inicjatywy (`Redukcja kosztów magazynu`, `Program
 * automatyzacji zakupów`), każda z własnym `DraftImpact`, obie celujące w tę samą linię kosztową
 * (`COGS`) tej samej jednostki (`entity-warehouse`) w tym samym okresie (`2026-Q3`), i sprawdza
 * `detectClientSideOverlaps` (jedyna funkcja kliencka odpowiedzialna za ten podgląd,
 * `predictionScenarioModel.ts:301`).
 */
import { describe, expect, it } from 'vitest';

import {
  createEmptyScenarioDraft,
  detectClientSideOverlaps,
  type DraftImpact,
  type DraftInitiative,
} from '../predictionScenarioModel';

function makeInitiative(overrides: Partial<DraftInitiative> & Pick<DraftInitiative, 'id' | 'initiativeCode' | 'name'>): DraftInitiative {
  return {
    description: null,
    source: null,
    owner: null,
    confidencePct: null,
    defaultStartPeriodId: '2026-Q3',
    defaultRampMonths: null,
    defaultDurationMonths: null,
    implementationCostDecimal: null,
    status: 'CONFIRMED',
    ...overrides,
  };
}

function makeImpact(overrides: Partial<DraftImpact> & Pick<DraftImpact, 'id' | 'initiativeId' | 'amountDecimal'>): DraftImpact {
  return {
    assumptionLabel: 'test',
    driverScheduleType: null,
    driverCode: null,
    kpiCatalogId: null,
    statementLineCode: 'COGS',
    entityId: 'entity-warehouse',
    amountKind: 'ABSOLUTE_AMOUNT',
    amountUnit: 'PLN',
    sign: 'NEGATIVE',
    startPeriodId: null,
    rampMonths: null,
    durationMonths: null,
    decayPctPerPeriod: null,
    implementationCostDecimal: null,
    confidencePct: null,
    probabilityPct: null,
    cannibalizesImpactId: null,
    ...overrides,
  };
}

describe('NIEZALEŻNA WERYFIKACJA — double counting: dwie inicjatywy, ta sama linia kosztowa', () => {
  it('★ dwie NIEPOWIĄZANE inicjatywy uderzające w COGS tej samej jednostki/okresu SĄ wykryte jako nakładanie, nie sumowane po cichu', () => {
    const draft = createEmptyScenarioDraft({ name: 'Weryfikacja double counting', scenarioMode: 'FUNDAMENTAL_INITIATIVE' });

    const initiativeA = makeInitiative({ id: 'init-warehouse-lean', initiativeCode: 'INIT-01', name: 'Redukcja kosztów magazynu (lean)' });
    const initiativeB = makeInitiative({ id: 'init-procurement-auto', initiativeCode: 'INIT-02', name: 'Program automatyzacji zakupów' });
    draft.initiatives.push(initiativeA, initiativeB);

    // Obie inicjatywy niezależnie obniżają COGS tej samej jednostki w tym samym kwartale — realny
    // scenariusz "dwa zespoły policzyły ten sam efekt dwa razy", to jest dokładnie to, co
    // finance_prediction_detect_overlaps() na serwerze (i jej klientowy podgląd tutaj) ma łapać.
    const impactA = makeImpact({ id: 'impact-a', initiativeId: 'init-warehouse-lean', amountDecimal: 150000 });
    const impactB = makeImpact({ id: 'impact-b', initiativeId: 'init-procurement-auto', amountDecimal: 90000 });
    draft.impacts.push(impactA, impactB);

    const findings = detectClientSideOverlaps(draft);

    expect(findings).toHaveLength(1);
    const finding = findings[0];
    expect(finding.entityId).toBe('entity-warehouse');
    expect(finding.canonicalLineCode).toBe('COGS');
    expect(finding.periodId).toBe('2026-Q3');
    // ★ CORE: sourceCount MUSI być 2 — system wie, że są DWA źródła, nie scalił ich w jedno przed
    // policzeniem. Gdyby system "po cichu sumował", nie byłoby żadnego findingu w ogóle (funkcja
    // zwraca finding tylko dla bucket.sources.length > 1).
    expect(finding.sourceCount).toBe(2);
    expect(finding.sources.map((s) => s.sourceId).sort()).toEqual(['impact-a', 'impact-b']);
    // Naiwna suma jest RAPORTOWANA (widoczna dla użytkownika jako "combined"), ale jawnie oznaczona
    // jako nakładanie — nie jest to compute wynik autorytatywny (ten idzie z serwera, Layer 2).
    expect(finding.naiveCombinedDelta).toBe(-150000 + -90000);
  });

  it('KONTROLA NEGATYWNA: dwie inicjatywy na RÓŻNYCH liniach kosztowych tej samej jednostki/okresu NIE są flagowane', () => {
    const draft = createEmptyScenarioDraft({ name: 'Kontrola negatywna — różne linie', scenarioMode: 'FUNDAMENTAL_INITIATIVE' });
    draft.initiatives.push(
      makeInitiative({ id: 'init-a', initiativeCode: 'INIT-A', name: 'A' }),
      makeInitiative({ id: 'init-b', initiativeCode: 'INIT-B', name: 'B' })
    );
    draft.impacts.push(
      makeImpact({ id: 'impact-a', initiativeId: 'init-a', amountDecimal: 100, statementLineCode: 'COGS' }),
      makeImpact({ id: 'impact-b', initiativeId: 'init-b', amountDecimal: 100, statementLineCode: 'OPEX' })
    );
    expect(detectClientSideOverlaps(draft)).toHaveLength(0);
  });

  it('KONTROLA NEGATYWNA: dwie inicjatywy na tej samej linii ale RÓŻNYCH okresach (start periods) NIE są flagowane', () => {
    const draft = createEmptyScenarioDraft({ name: 'Kontrola negatywna — różne okresy', scenarioMode: 'FUNDAMENTAL_INITIATIVE' });
    draft.initiatives.push(
      makeInitiative({ id: 'init-a', initiativeCode: 'INIT-A', name: 'A', defaultStartPeriodId: '2026-Q1' }),
      makeInitiative({ id: 'init-b', initiativeCode: 'INIT-B', name: 'B', defaultStartPeriodId: '2026-Q3' })
    );
    draft.impacts.push(
      makeImpact({ id: 'impact-a', initiativeId: 'init-a', amountDecimal: 100 }),
      makeImpact({ id: 'impact-b', initiativeId: 'init-b', amountDecimal: 100 })
    );
    expect(detectClientSideOverlaps(draft)).toHaveLength(0);
  });

  it('★ trzecia niezależna inicjatywa na TĘ SAMĄ linię/okres podnosi sourceCount do 3 (nie tworzy drugiego findingu ani nie gubi żadnego źródła)', () => {
    const draft = createEmptyScenarioDraft({ name: 'Trzy źródła', scenarioMode: 'FUNDAMENTAL_INITIATIVE' });
    draft.initiatives.push(
      makeInitiative({ id: 'init-a', initiativeCode: 'A', name: 'A' }),
      makeInitiative({ id: 'init-b', initiativeCode: 'B', name: 'B' }),
      makeInitiative({ id: 'init-c', initiativeCode: 'C', name: 'C' })
    );
    draft.impacts.push(
      makeImpact({ id: 'impact-a', initiativeId: 'init-a', amountDecimal: 10 }),
      makeImpact({ id: 'impact-b', initiativeId: 'init-b', amountDecimal: 20 }),
      makeImpact({ id: 'impact-c', initiativeId: 'init-c', amountDecimal: 30 })
    );
    const findings = detectClientSideOverlaps(draft);
    expect(findings).toHaveLength(1);
    expect(findings[0].sourceCount).toBe(3);
    expect(findings[0].sources.map((s) => s.sourceId).sort()).toEqual(['impact-a', 'impact-b', 'impact-c']);
  });
});
