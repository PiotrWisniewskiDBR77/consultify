/**
 * Plan zasobow (osoba x tydzien) — POPYT vs PODAZ vs OBLOZENIE vs LUKA.
 *
 * ZMIERZONY DEFEKT (1.12-R2, 2026-09-06, baza stanowiska, org DBR77):
 * jedyne zrodlo podazy w module — `getCapacityTimeline()` — liczy ja jako
 * `COUNT(DISTINCT user_id) FROM initiative_resources * 40 h`. W DBR77 ta
 * tabela ma 0 wierszy (i `project_members` tez 0), wiec `capacityHours = 0`
 * we WSZYSTKICH 12 tygodniach, a oblozenie wychodzi 0 % przy 84 realnych
 * zadaniach z godzinami. Kafel „Obłozenie" pokazywal „—".
 *
 * KONTRAKT (decyzja wlasciciela, plan 1.12 C5 pyt. 2): podaz = etat z PROFILU
 * OSOBY (`users.weekly_capacity_hours` x `availability_percent`), a brak
 * ustawienia = polityka 40 h x 100 % — NIE zero.
 *
 * DOWOD MUTACYJNY: zamiana podstawienia domyslnego na 0 (czyli powrot do
 * „podaz z pustego rejestru") -> testy „domyslna podaz…" i „oblozenie…" RED.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { dbAll } = vi.hoisted(() => ({ dbAll: vi.fn() }));

vi.mock('../../utils/DbPromise.js', () => ({
  default: { all: dbAll, get: vi.fn() },
  isSilenceableMissingRelationError: () => true,
}));

import {
  getExecutionResourcePlan,
  spreadTaskHoursByWeek,
  weeklySupplyHours,
  workingDaysBetween,
} from '../workloadCapacityService.js';

const ORG = 'org-1';
const poniedzialek = (offsetTygodni: number) => {
  const teraz = new Date();
  const dzien = teraz.getDay();
  const monday = new Date(teraz);
  monday.setDate(teraz.getDate() - dzien + (dzien === 0 ? -6 : 1));
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() + offsetTygodni * 7);
  return monday;
};
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const zadania = (
  rows: Array<{
    user_id: string;
    due_date: string | null;
    hours: number;
    task_id?: string;
    title?: string;
    status?: string;
    start_at?: string | null;
    actual_hours?: number;
  }>
) =>
  rows.map((row, index) => ({
    task_id: row.task_id ?? `t${index + 1}`,
    title: row.title ?? `Zadanie ${index + 1}`,
    status: row.status ?? 'todo',
    start_at: row.start_at ?? null,
    actual_hours: row.actual_hours ?? 0,
    ...row,
  }));
const dzienRoboczy = (od: Date, ile: number) => {
  const d = new Date(od);
  d.setDate(d.getDate() + ile);
  return d;
};

beforeEach(() => {
  vi.clearAllMocks();
});

const podstaw = (
  taskRows: unknown[],
  personRows: Array<Record<string, unknown>>
) => {
  dbAll.mockImplementation(async (sql: string) => {
    if (sql.includes('FROM tasks')) return taskRows;
    return personRows;
  });
};

describe('getExecutionResourcePlan', () => {
  it('domyslna podaz to 40 h x 100 %, gdy profil osoby nic nie mowi (a NIE 0)', async () => {
    podstaw(
      zadania([{ user_id: 'u1', due_date: iso(poniedzialek(0)), hours: 20 }]),
      [{ user_id: 'u1', name: 'Anna Kowalska', role: null, weekly_capacity_hours: null, availability_percent: null }]
    );

    const plan = await getExecutionResourcePlan(ORG, { weeks: 2 });

    const pierwszy = plan.rows.find((r) => r.weekStart === iso(poniedzialek(0)));
    expect(pierwszy?.supplyHours).toBe(40);
    expect(pierwszy?.supplySource).toBe('DOMYSLNA');
    expect(plan.people[0].weeklyCapacityHours).toBe(40);
  });

  it('oblozenie i luka licza sie z realnego popytu, a przeciazenie wychodzi na wierzch', async () => {
    podstaw(
      zadania([
        { user_id: 'u1', due_date: iso(poniedzialek(0)), hours: 60 },
        { user_id: 'u1', due_date: iso(poniedzialek(1)), hours: 10 },
      ]),
      [{ user_id: 'u1', name: 'Anna Kowalska', role: null, weekly_capacity_hours: null, availability_percent: null }]
    );

    const plan = await getExecutionResourcePlan(ORG, { weeks: 2 });

    const t0 = plan.rows.find((r) => r.weekStart === iso(poniedzialek(0)))!;
    expect(t0.demandHours).toBe(60);
    expect(t0.utilizationPercent).toBe(150);
    expect(t0.gapHours).toBe(-20);
    const t1 = plan.rows.find((r) => r.weekStart === iso(poniedzialek(1)))!;
    expect(t1.utilizationPercent).toBe(25);
    expect(t1.gapHours).toBe(30);
  });

  it('etat z profilu przelicza podaz przez dostepnosc (40 h x 50 % = 20 h)', async () => {
    podstaw(
      zadania([{ user_id: 'u2', due_date: iso(poniedzialek(0)), hours: 20 }]),
      [{ user_id: 'u2', name: 'Marta Kamińska', role: 'Konsultant', weekly_capacity_hours: 40, availability_percent: 50 }]
    );

    const plan = await getExecutionResourcePlan(ORG, { weeks: 1 });

    expect(plan.rows[0].supplyHours).toBe(20);
    expect(plan.rows[0].supplySource).toBe('PROFIL');
    expect(plan.rows[0].utilizationPercent).toBe(100);
  });

  /*
   * [ODMROZENIE 06_EXECUTION DEC-453] P16-R1 (§6 b) — ODWROCONY KONTRAKT.
   * Do 07.09 ten test brzmial „zadania PO TERMINIE wchodza do biezacego
   * tygodnia" i pilnowal defektu, ktory dawal 310 % w Zasobach (ten sam
   * mechanizm, co udokumentowany u Planview AdaptiveWork). Rynek liczy
   * obłozenie tygodnia wylacznie z pracy zaplanowanej na TEN tydzien, a
   * zaleglosc trzyma osobno — i to jest nowy kontrakt.
   *
   * DOWOD MUTACYJNY (wykonany recznie 07.09): przywrocenie starej galezi
   * `const bucket = isOverdue ? weeks[0] : …` w `getExecutionResourcePlan`
   * -> ten test RED (`demandHours` 8 -> 20, `backlogHours` 12 -> 0).
   */
  it('zadanie PO TERMINIE nie wchodzi do popytu tygodnia — idzie do zaleglosci', async () => {
    podstaw(
      zadania([
        { user_id: 'u1', due_date: iso(poniedzialek(-3)), hours: 12 },
        { user_id: 'u1', due_date: iso(poniedzialek(0)), hours: 8 },
      ]),
      [{ user_id: 'u1', name: 'Anna Kowalska', role: null, weekly_capacity_hours: null, availability_percent: null }]
    );

    const plan = await getExecutionResourcePlan(ORG, { weeks: 2 });

    const t0 = plan.rows.find((r) => r.weekStart === iso(poniedzialek(0)))!;
    expect(t0.demandHours).toBe(8);
    expect(t0.overdueHours).toBe(0);
    expect(t0.backlogHours).toBe(12);
    expect(plan.people[0].backlogHours).toBe(12);
    expect(plan.rows.every((r) => r.demandHours <= 8)).toBe(true);
  });

  it('zaleglosc to JEDNA liczba na osobe — tylko w wierszu biezacego tygodnia', async () => {
    podstaw(
      zadania([
        { user_id: 'u1', due_date: iso(poniedzialek(-2)), hours: 10, task_id: 'z1', title: 'Zalegle A' },
        { user_id: 'u1', due_date: iso(poniedzialek(-1)), hours: 6, actual_hours: 2, task_id: 'z2', title: 'Zalegle B' },
      ]),
      [{ user_id: 'u1', name: 'Anna Kowalska', role: null, weekly_capacity_hours: null, availability_percent: null }]
    );

    const plan = await getExecutionResourcePlan(ORG, { weeks: 3 });

    // 10 h + (6 h - 2 h zrobione) = 14 h, raz.
    expect(plan.people[0].backlogHours).toBe(14);
    expect(plan.people[0].backlogTaskIds).toEqual(['z1', 'z2']);
    expect(plan.people[0].backlogTasks[0].daysOverdue).toBe(14);
    const zZalegloscia = plan.rows.filter((r) => r.backlogHours > 0);
    expect(zZalegloscia).toHaveLength(1);
    expect(zZalegloscia[0].weekStart).toBe(iso(poniedzialek(0)));
    expect(plan.rows.reduce((sum, r) => sum + r.backlogHours, 0)).toBe(14);
  });

  it('zadanie BEZ terminu nie jest zgadywane na tydzien i NIE jest zalegloscia', async () => {
    podstaw(
      zadania([{ user_id: 'u1', due_date: null, hours: 6 }]),
      [{ user_id: 'u1', name: 'Anna Kowalska', role: null, weekly_capacity_hours: null, availability_percent: null }]
    );

    const plan = await getExecutionResourcePlan(ORG, { weeks: 2 });

    expect(plan.rows.every((r) => r.demandHours === 0)).toBe(true);
    expect(plan.people[0].unscheduledHours).toBe(6);
    expect(plan.people[0].backlogHours).toBe(0);
  });

  /*
   * P16-R1 (§6 c) — ROZKLAD ROWNY start -> termin (wzorzec Asana/Teamwork:
   * „Total hours are spread evenly across the date range").
   * DOWOD MUTACYJNY (recznie): `perDay = total / workingDays` -> `perDay = total`
   * (cala pracochlonnosc w kazdym dniu) -> oba te testy RED.
   */
  it('rozklad rowny: 10 h na oknie pon-pt to 2 h dziennie i caly tydzien', () => {
    const pon = poniedzialek(0);
    const udzialy = spreadTaskHoursByWeek(pon, dzienRoboczy(pon, 4), 10);
    expect(udzialy.size).toBe(1);
    expect(udzialy.get(iso(pon))).toBeCloseTo(10, 6);
    expect(workingDaysBetween(pon, dzienRoboczy(pon, 4))).toBe(5);
  });

  it('rozklad rowny: zadanie przez dwa tygodnie dzieli sie proporcjonalnie', () => {
    const pon = poniedzialek(0);
    const udzialy = spreadTaskHoursByWeek(pon, dzienRoboczy(pon, 11), 20);
    // 10 dni roboczych: 5 w tygodniu pierwszym, 5 w drugim -> po 10 h.
    expect(udzialy.get(iso(pon))).toBeCloseTo(10, 6);
    expect(udzialy.get(iso(poniedzialek(1)))).toBeCloseTo(10, 6);
  });

  it('popyt tygodnia bierze UDZIAL zadania, nie cale zadanie w tygodniu terminu', async () => {
    const pon = poniedzialek(0);
    podstaw(
      zadania([
        {
          user_id: 'u1',
          start_at: iso(pon),
          due_date: iso(dzienRoboczy(pon, 11)),
          hours: 20,
        },
      ]),
      [{ user_id: 'u1', name: 'Anna Kowalska', role: null, weekly_capacity_hours: null, availability_percent: null }]
    );

    const plan = await getExecutionResourcePlan(ORG, { weeks: 3 });

    expect(plan.rows.find((r) => r.weekStart === iso(pon))!.demandHours).toBe(10);
    expect(plan.rows.find((r) => r.weekStart === iso(poniedzialek(1)))!.demandHours).toBe(10);
    expect(plan.rows.find((r) => r.weekStart === iso(poniedzialek(2)))!.demandHours).toBe(0);
  });

  /*
   * P16-R1 (§6 d) — PODAZ per dzien roboczy, nie stale 40 h.
   * DOWOD MUTACYJNY (recznie): `weeklySupplyHours` -> `return 40` -> ten test
   * RED dla profilu 20 h (podaz 20 -> 40, obłozenie 100 % -> 50 %).
   */
  it('podaz = dni robocze tygodnia x godziny dzienne osoby (profil 20 h -> 20 h)', async () => {
    podstaw(
      zadania([{ user_id: 'u3', due_date: iso(poniedzialek(0)), hours: 20 }]),
      [{ user_id: 'u3', name: 'Jan Zieliński', role: null, weekly_capacity_hours: 20, availability_percent: 100 }]
    );

    const plan = await getExecutionResourcePlan(ORG, { weeks: 1 });

    expect(weeklySupplyHours(iso(poniedzialek(0)), 20, 100)).toBe(20);
    expect(plan.rows[0].supplyHours).toBe(20);
    expect(plan.rows[0].utilizationPercent).toBe(100);
    // 5 dni roboczych x 4 h/dzien; polowa etatu = polowa podazy.
    expect(weeklySupplyHours(iso(poniedzialek(0)), 20, 50)).toBe(10);
  });
});
