/**
 * [ODMROZENIE 05_INITIATIVES DEC-421] P15-K5 — arkusz okres x rola.
 * Testy (e) (f) (g) (h) (i) z §6 paczki P15; kazdy ma opisana MUTACJE, ktora
 * musi go zapalic na czerwono.
 */
import { describe, expect, it } from 'vitest';

import {
  buildRoleSheet,
  periodWeeks,
  roleSlug,
  windowCoversPeriod,
  UNASSIGNED_ROLE_ID,
} from '../capacityRoleSheet.js';
import { findRoleGaps, NoCapacityPressureError, proposeCapacityOptions } from '../capacityOptionsAdvisor.js';
import {
  sumRoleLines,
  validateCapacityScenario,
  type CapacityScenario,
} from '../capacityScenario.js';
import { validatePlanScenario, type PlanScenario } from '../planScenario.js';
import { solvePlanScenario } from '../planSolver.js';

const period = (id: string, start: string, end: string) => ({ periodId: id, start, end });

const plan = (roleDemand?: Array<{ roleId: string; roleLabel: string; fte: number }>): PlanScenario => ({
  scenarioId: 'plan-k5',
  name: 'Plan K5',
  scenarioVersion: 2,
  status: 'PUBLISHED',
  portfolioScenarioId: 'portfolio-k5',
  portfolioScenarioVersion: 1,
  windowUnit: 'WEEK',
  timezone: 'Europe/Warsaw',
  periods: [
    period('Tydzień 1', '2026-09-07T00:00:00.000Z', '2026-09-14T00:00:00.000Z'),
    period('Tydzień 2', '2026-09-14T00:00:00.000Z', '2026-09-21T00:00:00.000Z'),
  ],
  windows: [
    {
      initiativeId: 'ini-1',
      initiativeVersion: 1,
      earliest: '2026-09-07T00:00:00.000Z',
      target: '2026-09-09T00:00:00.000Z',
      latest: '2026-09-13T00:00:00.000Z',
      confidence: 'HIGH',
      rationale: 'Okno z planu',
      dependencySnapshot: [],
      constraintSnapshot: [],
      ...(roleDemand ? { roleDemand } : {}),
    },
  ],
  assumptions: [],
  createdBy: 'pmo',
  updatedBy: 'pmo',
  publishedBy: 'pmo',
  publishedAt: '2026-09-07T00:00:00.000Z',
});

const supply = [
  { roleId: 'controls-engineer', roleLabel: 'Controls Engineer', fteWeekly: 2, headcount: 2 },
];

describe('P15-K5 — arkusz okres x rola', () => {
  it('(g) popyt bierze sie z roleDemand okna planu, per rola i per okres', () => {
    const periods = buildRoleSheet({
      plan: plan([{ roleId: 'controls-engineer', roleLabel: 'Controls Engineer', fte: 3 }]),
      supply,
      ownerId: 'pmo',
      asOf: '2026-09-07T00:00:00.000Z',
    });
    const week1 = periods[0].roles?.find((role) => role.roleId === 'controls-engineer');
    const week2 = periods[1].roles?.find((role) => role.roleId === 'controls-engineer');
    // MUTACJA: zignoruj `window.roleDemand` przy liczeniu popytu -> 0 zamiast 3 -> RED.
    expect(week1?.demand).toBe(3);
    expect(week1?.demandSource).toBe('PLAN');
    // Okno konczy sie 13.09, wiec drugi tydzien nie jest nim objety.
    expect(week2?.demand).toBe(0);
  });

  it('(f) podaz roli pochodzi z podazy organizacji (stanowiska), nie ze stalej', () => {
    const periods = buildRoleSheet({
      plan: plan([{ roleId: 'controls-engineer', roleLabel: 'Controls Engineer', fte: 3 }]),
      supply,
      ownerId: 'pmo',
    });
    const line = periods[0].roles?.find((role) => role.roleId === 'controls-engineer');
    // MUTACJA: `supply: 1` na sztywno -> 1 zamiast 2 -> RED.
    expect(line?.supply).toBe(2);
    expect(line?.supplySource).toBe('RESOURCE_PLAN');
  });

  it('(h) rola bez ani jednej osoby ma podaz „Nieznane", nie zero', () => {
    const periods = buildRoleSheet({
      plan: plan([{ roleId: 'analityk', roleLabel: 'Analityk', fte: 1 }]),
      supply: [],
      ownerId: 'pmo',
    });
    const line = periods[0].roles?.find((role) => role.roleId === 'analityk');
    expect(line?.supply).toBeNull();
    expect(line?.supplySource).toBe('UNKNOWN');
    expect(periods[0].supply.knowledgeState).toBe('UNKNOWN');
    expect(periods[0].supply.base).toBeNull();
  });

  it('(i) skalary okresu sa suma linii rol i przechodza walidacje domeny', () => {
    const periods = buildRoleSheet({
      plan: plan([
        { roleId: 'controls-engineer', roleLabel: 'Controls Engineer', fte: 3 },
        { roleId: 'analityk', roleLabel: 'Analityk', fte: 1 },
      ]),
      supply: [
        ...supply,
        { roleId: 'analityk', roleLabel: 'Analityk', fteWeekly: 4, headcount: 4 },
      ],
      ownerId: 'pmo',
    });
    // MUTACJA: skalar `demand.base` na stale 0 -> walidacja rzuca -> RED.
    expect(periods[0].demand.base).toBe(4);
    expect(periods[0].supply.base).toBe(6);
    expect(sumRoleLines(periods[0].roles, 'demand').total).toBe(periods[0].demand.base);
    const scenario: CapacityScenario = {
      scenarioId: 'cap-k5',
      scenarioVersion: 0,
      status: 'DRAFT',
      planScenarioId: 'plan-k5',
      planScenarioVersion: 2,
      windowUnit: 'WEEK',
      timezone: 'Europe/Warsaw',
      periods,
      constraints: [],
      proposedAssignments: [],
      createdBy: 'pmo',
      updatedBy: 'pmo',
      publishedBy: null,
      publishedAt: null,
    };
    expect(() => validateCapacityScenario(scenario)).not.toThrow();
    // Skalar rozjechany z suma linii = bledny stan (solver i doradca czytaja skalar).
    const broken = structuredClone(scenario);
    broken.periods[0].demand.base = 99;
    broken.periods[0].demand.low = 99;
    broken.periods[0].demand.high = 99;
    expect(() => validateCapacityScenario(broken)).toThrow(/sum of role lines/);
  });

  it('popyt awaryjny z required_capacity_fte ladnie ląduje w „Bez stanowiska" jako UNKNOWN', () => {
    const periods = buildRoleSheet({
      plan: plan(),
      supply,
      fallbackDemandFte: { 'ini-1': 1.5 },
      ownerId: 'pmo',
    });
    const line = periods[0].roles?.find((role) => role.roleId === UNASSIGNED_ROLE_ID);
    expect(line?.demand).toBe(1.5);
    expect(line?.demandSource).toBe('UNKNOWN');
  });

  it('reczna korekta podazy przetrwa przeliczenie', () => {
    const first = buildRoleSheet({
      plan: plan([{ roleId: 'controls-engineer', roleLabel: 'Controls Engineer', fte: 3 }]),
      supply,
      ownerId: 'pmo',
    });
    const manual = structuredClone(first);
    const line = manual[0].roles?.find((role) => role.roleId === 'controls-engineer');
    if (line) {
      line.supply = 5;
      line.supplySource = 'MANUAL';
    }
    const recomputed = buildRoleSheet({
      plan: plan([{ roleId: 'controls-engineer', roleLabel: 'Controls Engineer', fte: 3 }]),
      supply,
      ownerId: 'pmo',
      previous: { periods: manual } as unknown as CapacityScenario,
    });
    const after = recomputed[0].roles?.find((role) => role.roleId === 'controls-engineer');
    expect(after?.supply).toBe(5);
    expect(after?.supplySource).toBe('MANUAL');
  });

  it('slug stanowiska sprowadza polskie znaki do ASCII', () => {
    expect(roleSlug('Główny Inżynier')).toBe('glowny-inzynier');
    expect(roleSlug('   ')).toBe(UNASSIGNED_ROLE_ID);
  });

  it('okres tygodniowy liczy sie jako jeden tydzien, dwutygodniowy jako dwa', () => {
    expect(periodWeeks(period('a', '2026-09-07T00:00:00.000Z', '2026-09-14T00:00:00.000Z'))).toBe(1);
    expect(periodWeeks(period('b', '2026-09-07T00:00:00.000Z', '2026-09-21T00:00:00.000Z'))).toBe(2);
  });

  it('okres styczny z koncem okna NIE liczy popytu (przedzial polotwarty)', () => {
    // Okresy planu sa styczne: `Tydzien 1`.end === `Tydzien 2`.start. Okno konczace
    // sie 14.09 nalezy WYLACZNIE do tygodnia 1. MUTACJA: `period.start <= latest`
    // (regula solvera) -> tydzien 2 dostaje 3 FTE zamiast 0 -> RED.
    const scoped = plan([{ roleId: 'controls-engineer', roleLabel: 'Controls Engineer', fte: 3 }]);
    scoped.windows[0].latest = '2026-09-14T00:00:00.000Z';
    scoped.windows[0].target = '2026-09-10T00:00:00.000Z';
    const periods = buildRoleSheet({ plan: scoped, supply, ownerId: 'pmo' });
    expect(periods[0].roles?.find((r) => r.roleId === 'controls-engineer')?.demand).toBe(3);
    expect(periods[1].roles?.find((r) => r.roleId === 'controls-engineer')?.demand).toBe(0);
  });

  it('okno bez zadnej daty nie obejmuje zadnego okresu', () => {
    expect(
      windowCoversPeriod(
        { earliest: null, target: null, latest: null },
        period('a', '2026-09-07T00:00:00.000Z', '2026-09-14T00:00:00.000Z')
      )
    ).toBe(false);
  });
});

describe('P15-K5 — luka liczona per rola', () => {
  const withRoles = (roles: NonNullable<CapacityScenario['periods'][number]['roles']>) => {
    const demandTotal = roles.reduce((sum, role) => sum + (role.demand ?? 0), 0);
    const supplyTotal = roles.reduce((sum, role) => sum + (role.supply ?? 0), 0);
    const range = (base: number) => ({
      knowledgeState: 'KNOWN' as const,
      low: base,
      base,
      high: base,
      sourceRef: 'plan-scenario:plan-k5',
      sourceVersion: 2,
      asOf: '2026-09-07T00:00:00.000Z',
      confidence: 'HIGH' as const,
      ownerId: 'pmo',
      reason: null,
    });
    const scenario: CapacityScenario = {
      scenarioId: 'cap-k5',
      scenarioVersion: 1,
      status: 'PUBLISHED',
      planScenarioId: 'plan-k5',
      planScenarioVersion: 2,
      windowUnit: 'WEEK',
      timezone: 'Europe/Warsaw',
      periods: [
        {
          periodId: 'Tydzień 1',
          start: '2026-09-07T00:00:00.000Z',
          end: '2026-09-14T00:00:00.000Z',
          demand: range(demandTotal),
          supply: range(supplyTotal),
          roles,
        },
      ],
      constraints: [],
      proposedAssignments: [],
      createdBy: 'pmo',
      updatedBy: 'pmo',
      publishedBy: 'pmo',
      publishedAt: '2026-09-07T00:00:00.000Z',
    };
    return scenario;
  };

  // Suma jest ROWNA (4 = 4), wiec porownanie skalarow milczy — a jedna rola jest
  // przeciazona dwukrotnie. To jest dokladnie defekt, ktory K5 naprawia.
  const offsetting = withRoles([
    {
      roleId: 'controls-engineer',
      roleLabel: 'Controls Engineer',
      demand: 3,
      supply: 1,
      supplySource: 'RESOURCE_PLAN',
      demandSource: 'PLAN',
    },
    {
      roleId: 'analityk',
      roleLabel: 'Analityk',
      demand: 1,
      supply: 3,
      supplySource: 'RESOURCE_PLAN',
      demandSource: 'PLAN',
    },
  ]);

  it('(e) doradca widzi luke roli mimo zbilansowanej sumy okresu', () => {
    expect(offsetting.periods[0].demand.base).toBe(offsetting.periods[0].supply.base);
    const gaps = findRoleGaps(offsetting);
    expect(gaps).toHaveLength(1);
    expect(gaps[0].roleId).toBe('controls-engineer');
    expect(gaps[0].gap).toBe(-2);
    // MUTACJA: porownuj SUMY rol zamiast linii -> `NoCapacityPressureError` -> RED.
    const options = proposeCapacityOptions(plan(), offsetting);
    expect(options).toHaveLength(3);
    expect(options[0].rationale).toContain('Controls Engineer');
    expect(options[0].affectedResources.map((item) => item.resourceRef)).toContain(
      'controls-engineer'
    );
  });

  it('brak luki w zadnej roli = brak presji do rozwiazania', () => {
    const balanced = withRoles([
      {
        roleId: 'controls-engineer',
        roleLabel: 'Controls Engineer',
        demand: 1,
        supply: 3,
        supplySource: 'RESOURCE_PLAN',
        demandSource: 'PLAN',
      },
    ]);
    expect(() => proposeCapacityOptions(plan(), balanced)).toThrow(NoCapacityPressureError);
  });

  it('(i) solver dalej czyta SKALARY okresu — zgodnosc wstecz', () => {
    const result = solvePlanScenario(plan(), offsetting);
    expect(result.conflicts).toHaveLength(0);
    expect(result.assignments).toHaveLength(1);
  });
});

describe('P15-K5 — roleDemand w planie', () => {
  it('plan bez roleDemand nadal sie waliduje (zgodnosc wstecz)', () => {
    expect(() => validatePlanScenario(plan())).not.toThrow();
  });
  it('ujemne FTE jest odrzucane', () => {
    expect(() =>
      validatePlanScenario(plan([{ roleId: 'a', roleLabel: 'A', fte: -1 }]))
    ).toThrow(/zero or greater/);
  });
  it('powtorzona rola w jednym oknie jest odrzucana', () => {
    expect(() =>
      validatePlanScenario(
        plan([
          { roleId: 'a', roleLabel: 'A', fte: 1 },
          { roleId: 'a', roleLabel: 'A', fte: 2 },
        ])
      )
    ).toThrow(/unique per role/);
  });
});
