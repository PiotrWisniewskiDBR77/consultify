/**
 * P15-K3 (DEC-421) — SOLVER MÓWI KODEM, EKRAN MÓWI PO POLSKU.
 *
 * POMIAR 07.09: `planSolver.ts:159` sklejał uzasadnienie po angielsku i ZAPISYWAŁ
 * je do `windows[].rationale`, więc polska karta planu pokazywała „Deterministic
 * solver selected Tydzień 2: no scheduled predecessor…", a tłumaczenie po fakcie
 * było niemożliwe (napis siedział w bazie).
 *
 * Ten plik pilnuje TRZECH rzeczy naraz:
 *  1. solver nie zwraca ANI JEDNEGO angielskiego zdania — same kody;
 *  2. lustro frontu (`src/components/Initiatives/planSolverReason.ts`) rozumie
 *     dokładnie to, co koder serwera zapisuje (para koder/dekoder, nie kopia);
 *  3. każdy kod ma polski napis — brak tłumaczenia zwróciłby sam kod.
 *
 * MUTACJA (d): `formatPlanSolverReason` zwraca `value` bez dekodowania →
 * test „po polsku" pada, bo na ekranie zostaje `SOLVER-1:{…}`.
 */
import { describe, expect, it } from 'vitest';

import {
  encodePlanSolverReason,
  PLAN_SOLVER_REASON_PREFIX as PREFIX_SERWERA,
} from '../../../server/src/domain/initiatives-execution/planSolverReason';
import { solvePlanScenario } from '../../../server/src/domain/initiatives-execution/planSolver';
import type { PlanScenario } from '../../../server/src/domain/initiatives-execution/planScenario';
import {
  decodePlanSolverReason,
  formatPlanSolverReason,
  PLAN_SOLVER_REASON_PREFIX as PREFIX_FRONTU,
} from '../../../src/components/Initiatives/planSolverReason';
import katalogPl from '../../../public/locales/pl/translation.json';
import katalogEn from '../../../public/locales/en/translation.json';

const zKatalogu = (katalog: unknown, key: string) =>
  key
    .split('.')
    .reduce<unknown>(
      (node, part) =>
        node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined,
      katalog
    );

const tlumacz = (katalog: unknown) => (key: string, options: Record<string, unknown>) => {
  const zasob = zKatalogu(katalog, key);
  const wzorzec =
    typeof zasob === 'string'
      ? zasob
      : typeof options.defaultValue === 'string'
        ? options.defaultValue
        : key;
  return wzorzec.replace(/\{\{(\w+)\}\}/g, (_match, name: string) =>
    options[name] !== undefined ? String(options[name]) : `{{${name}}}`
  );
};

const period = (index: number) => ({
  periodId: `Tydzień ${index}`,
  start: `2026-09-${String(6 + (index - 1) * 7).padStart(2, '0')}T00:00:00.000Z`,
  end: `2026-09-${String(13 + (index - 1) * 7).padStart(2, '0')}T00:00:00.000Z`,
});

const window = (initiativeId: string, dependencySnapshot: string[] = []) => ({
  initiativeId,
  initiativeVersion: 1,
  earliest: '2026-09-06T00:00:00.000Z',
  target: '2026-09-06T00:00:00.000Z',
  latest: '2026-09-27T00:00:00.000Z',
  confidence: 'UNKNOWN' as const,
  rationale: 'Szkic okna wymaga weryfikacji',
  dependencySnapshot,
  constraintSnapshot: [],
});

const scenario = (windows: ReturnType<typeof window>[]): PlanScenario => ({
  scenarioId: 'plan-k3',
  scenarioVersion: 1,
  status: 'DRAFT',
  portfolioScenarioId: 'portfel',
  portfolioScenarioVersion: 1,
  windowUnit: 'WEEK',
  timezone: 'Europe/Warsaw',
  periods: [period(1), period(2), period(3)],
  windows,
  assumptions: [],
  createdBy: 'a',
  updatedBy: 'a',
  publishedBy: null,
  publishedAt: null,
});

describe('P15-K3 — uzasadnienie solvera jako kod', () => {
  it('prefiks kodu jest wspólny dla serwera i frontu (jedno lustro, nie dwa formaty)', () => {
    expect(PREFIX_FRONTU).toBe(PREFIX_SERWERA);
  });

  it('solver zwraca WYŁĄCZNIE kody — zero angielskich zdań w uzasadnieniach i konfliktach', () => {
    const wynik = solvePlanScenario(scenario([window('a'), window('b', ['a']), window('c', ['brak'])]));
    for (const przypisanie of wynik.assignments) {
      expect(przypisanie.rationale.startsWith(PREFIX_SERWERA)).toBe(true);
      expect(przypisanie.rationale).not.toContain('Deterministic solver selected');
    }
    expect(wynik.conflicts.length).toBeGreaterThan(0);
    for (const konflikt of wynik.conflicts) {
      expect(konflikt.startsWith(PREFIX_SERWERA)).toBe(true);
    }
  });

  it('front dekoduje kod solvera i pokazuje go PO POLSKU z katalogu', () => {
    const wynik = solvePlanScenario(scenario([window('a'), window('b', ['a'])]));
    const drugie = wynik.assignments.find((item) => item.window.initiativeId === 'b');
    expect(drugie).toBeDefined();
    const napis = formatPlanSolverReason(drugie!.rationale, tlumacz(katalogPl), (id) =>
      id === 'a' ? 'Predictive Maintenance' : id
    );
    expect(napis).toContain('Solver wybrał');
    expect(napis).toContain('po okresie poprzednika');
    expect(napis).not.toContain(PREFIX_SERWERA);
  });

  it('ten sam kod po angielsku bierze angielski napis z katalogu en', () => {
    const kod = encodePlanSolverReason({
      code: 'SELECTED',
      period: 'Week 2',
      dependency: { code: 'NO_PREDECESSOR' },
      capacity: { code: 'CAPACITY_KNOWN', used: 2, supply: 3 },
      humanReviewRequired: true,
    });
    const napis = formatPlanSolverReason(kod, tlumacz(katalogEn));
    expect(napis).toContain('The solver picked Week 2');
    expect(napis).toContain('known capacity 2/3');
  });

  it('KAŻDY kod solvera ma polski napis — żaden nie wypada jako goły klucz', () => {
    const kody = [
      { code: 'NO_PERIODS' as const },
      { code: 'DEPENDENCY_CYCLE' as const, path: ['a', 'b', 'a'] },
      { code: 'MISSING_DEPENDENCY' as const, initiativeId: 'a', dependencyId: 'b' },
      { code: 'NO_FEASIBLE_PERIOD' as const, initiativeId: 'a' },
      { code: 'NO_FEASIBLE_PERIOD_CYCLE' as const, initiativeId: 'a' },
      { code: 'DEPENDENCIES_PRECEDE' as const },
      { code: 'ONE_FEASIBLE_PERIOD' as const },
      { code: 'CAPACITY_UNKNOWN_FOR_PERIOD' as const, period: 'Tydzień 1' },
      { code: 'DEMAND_UNKNOWN_FOR_INITIATIVE' as const, initiativeId: 'a', period: 'Tydzień 1' },
    ];
    for (const kod of kody) {
      const napis = formatPlanSolverReason(encodePlanSolverReason(kod), tlumacz(katalogPl));
      expect(napis.startsWith('initiatives.')).toBe(false);
      expect(napis).not.toContain('{{');
      expect(napis.length).toBeGreaterThan(5);
    }
  });

  it('kod NIE zawiera znaku, ktory sanitizer zamienia — inaczej ekran pokazuje surowy napis', () => {
    // ZMIERZONE 07.09 (evidence/p15-k3/przeplyw, pierwszy przebieg): sanitizer
    // żądań zamieniał `"` na `&quot;` i w bazie lądowało
    // `SOLVER-1:{&quot;code&quot;:…}`, czego `JSON.parse` nie odczytał.
    const kody = [
      encodePlanSolverReason({
        code: 'SELECTED',
        period: 'Tydzień 4',
        dependency: { code: 'AFTER_DEPENDENCY', period: 2 },
        capacity: { code: 'CAPACITY_KNOWN', used: 2, supply: 3 },
        humanReviewRequired: true,
      }),
      encodePlanSolverReason({ code: 'DEPENDENCY_CYCLE', path: ['a', 'b', 'a'] }),
      encodePlanSolverReason({ code: 'MISSING_DEPENDENCY', initiativeId: 'a', dependencyId: 'b' }),
    ];
    for (const kod of kody) {
      expect(kod).not.toMatch(/["'<>&]/);
      expect(decodePlanSolverReason(kod)).not.toBeNull();
    }
    expect(decodePlanSolverReason(kody[0])).toEqual({
      code: 'SELECTED',
      period: 'Tydzień 4',
      dependency: { code: 'AFTER_DEPENDENCY', period: 2 },
      capacity: { code: 'CAPACITY_KNOWN', used: 2, supply: 3 },
      humanReviewRequired: true,
    });
  });

  it('rozumie PIERWSZĄ postać kodu (JSON) także po ucieczce sanitizera', () => {
    const zSanitizera =
      'SOLVER-1:{&quot;code&quot;:&quot;NO_FEASIBLE_PERIOD&quot;,&quot;initiativeId&quot;:&quot;a&quot;}';
    expect(decodePlanSolverReason(zSanitizera)).toEqual({
      code: 'NO_FEASIBLE_PERIOD',
      initiativeId: 'a',
    });
    expect(formatPlanSolverReason(zSanitizera, tlumacz(katalogPl))).toContain(
      'Brak możliwego okresu'
    );
  });

  it('uzasadnienie napisane przez CZŁOWIEKA zostaje dosłownie (plany sprzed paczki)', () => {
    expect(decodePlanSolverReason('Zakres zatwierdzony w przepływie P11.')).toBeNull();
    expect(
      formatPlanSolverReason('Zakres zatwierdzony w przepływie P11.', tlumacz(katalogPl))
    ).toBe('Zakres zatwierdzony w przepływie P11.');
  });
});
