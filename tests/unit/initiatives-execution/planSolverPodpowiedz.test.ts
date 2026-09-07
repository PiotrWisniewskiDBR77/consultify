/**
 * [ODMROZENIE 05_INITIATIVES DEC-421] P15-K6 — PODPOWIEDŹ PRZESUNIĘCIA w solverze.
 *
 * POMIAR 07.09 (własne API 4163, kopia bazy `consultify_p15k67`): wybór wariantu
 * „Przesuń kolejność" tworzył kontrolowany wniosek i NIC WIĘCEJ — plan zostawał
 * na swoim miejscu. Solver nie miał wejścia, którym można mu powiedzieć „ta
 * inicjatywa ma pójść o N okresów dalej", a jego własny bilans mocy liczy
 * SKALAR okresu (suma ról), więc przeciążenia jednej roli w ogóle nie widzi.
 *
 * MUTACJE (dowód RED — zakładane ręcznie i cofane, `evidence/p15-k67/mutacje.txt`):
 *  (a) `solvePlanScenario(plan, capacity)` bez trzeciego argumentu w
 *      `planAnalysisProposal.ts` → test „podpowiedź przesuwa okno" pada;
 *  (a') `hintFloor` przybity na 0 → to samo.
 */
import { describe, expect, it } from 'vitest';

import { decodePlanSolverReason } from '../../../server/src/domain/initiatives-execution/planSolverReason';
import { solvePlanScenario } from '../../../server/src/domain/initiatives-execution/planSolver';
import type { PlanScenario } from '../../../server/src/domain/initiatives-execution/planScenario';

const period = (index: number) => ({
  periodId: `Tydzień ${index}`,
  start: `2026-09-${String(7 + (index - 1) * 7).padStart(2, '0')}T00:00:00.000Z`,
  end: `2026-09-${String(14 + (index - 1) * 7).padStart(2, '0')}T00:00:00.000Z`,
});

const plan: PlanScenario = {
  scenarioId: 'plan-k6',
  scenarioVersion: 1,
  status: 'DRAFT',
  portfolioScenarioId: 'portfolio-1',
  portfolioScenarioVersion: 1,
  windowUnit: 'WEEK',
  timezone: 'Europe/Warsaw',
  periods: [period(1), period(2), period(3)],
  windows: [
    {
      initiativeId: 'ini-1',
      initiativeVersion: 1,
      earliest: period(1).start,
      target: period(1).start,
      // Własna górna granica okna KOŃCZY się w tygodniu 1 — przesunięcie z
      // wariantu doradcy ma ją rozsunąć, bo o to prosi człowiek.
      latest: period(1).end,
      confidence: 'MEDIUM',
      rationale: 'Okno wyjściowe.',
      dependencySnapshot: [],
      constraintSnapshot: [],
    },
  ],
  assumptions: [],
  createdBy: 'a',
  updatedBy: 'a',
  publishedBy: null,
  publishedAt: null,
};

describe('P15-K6 — podpowiedź przesunięcia z wariantu doradcy', () => {
  it('bez podpowiedzi solver zostaje w tygodniu 1 (stan sprzed paczki)', () => {
    const solved = solvePlanScenario(plan);
    expect(solved.assignments[0].periodId).toBe('Tydzień 1');
  });

  it('(a) podpowiedź o 2 okresy przesuwa okno na Tydzień 3 i zapisuje to w założeniach', () => {
    const solved = solvePlanScenario(plan, undefined, [
      { initiativeId: 'ini-1', shiftPeriods: 2 },
    ]);
    expect(solved.assignments[0].periodId).toBe('Tydzień 3');
    expect(solved.conflicts).toEqual([]);
    const shift = solved.assumptions
      .map((item) => decodePlanSolverReason(item))
      .find((item) => item?.code === 'ADVISOR_SHIFT');
    expect(shift).toEqual({ code: 'ADVISOR_SHIFT', initiativeId: 'ini-1', periods: 2 });
  });

  it('podpowiedź nie dotyczy inicjatyw spoza wariantu', () => {
    const solved = solvePlanScenario(plan, undefined, [
      { initiativeId: 'inna-inicjatywa', shiftPeriods: 2 },
    ]);
    expect(solved.assignments[0].periodId).toBe('Tydzień 1');
    expect(
      solved.assumptions.some((item) => decodePlanSolverReason(item)?.code === 'ADVISOR_SHIFT')
    ).toBe(false);
  });

  it('przesunięcie poza horyzont planu daje uczciwy konflikt, nie ciche zignorowanie', () => {
    const solved = solvePlanScenario(plan, undefined, [
      { initiativeId: 'ini-1', shiftPeriods: 9 },
    ]);
    expect(solved.assignments).toEqual([]);
    expect(
      solved.conflicts.some((item) => decodePlanSolverReason(item)?.code === 'NO_FEASIBLE_PERIOD')
    ).toBe(true);
  });
});
