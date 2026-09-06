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

import { getExecutionResourcePlan } from '../workloadCapacityService.js';

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

const zadania = (rows: Array<{ user_id: string; due_date: string | null; hours: number }>) => rows;

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

  it('zadania PO TERMINIE wchodza do biezacego tygodnia, a nie znikaja', async () => {
    podstaw(
      zadania([
        { user_id: 'u1', due_date: iso(poniedzialek(-3)), hours: 12 },
        { user_id: 'u1', due_date: iso(poniedzialek(0)), hours: 8 },
      ]),
      [{ user_id: 'u1', name: 'Anna Kowalska', role: null, weekly_capacity_hours: null, availability_percent: null }]
    );

    const plan = await getExecutionResourcePlan(ORG, { weeks: 2 });

    const t0 = plan.rows.find((r) => r.weekStart === iso(poniedzialek(0)))!;
    expect(t0.demandHours).toBe(20);
    expect(t0.overdueHours).toBe(12);
  });

  it('zadanie BEZ terminu nie jest zgadywane na tydzien — idzie do zaleglosci osoby', async () => {
    podstaw(
      zadania([{ user_id: 'u1', due_date: null, hours: 6 }]),
      [{ user_id: 'u1', name: 'Anna Kowalska', role: null, weekly_capacity_hours: null, availability_percent: null }]
    );

    const plan = await getExecutionResourcePlan(ORG, { weeks: 2 });

    expect(plan.rows.every((r) => r.demandHours === 0)).toBe(true);
    expect(plan.people[0].backlogHours).toBe(6);
  });
});
