/**
 * Dane modułu jako źródło — test kontraktowy naprawy `degraded: no_sources`.
 *
 * Zapytania są wstrzykiwane (`queryFn`), więc test nie potrzebuje bazy, ale
 * SPRAWDZA to, co się psuło naprawdę: (a) czy powstają cytaty, (b) czy każde
 * zapytanie ma `organization_id` w warunku, (c) czy pusty moduł NIE produkuje
 * zmyślonych źródeł.
 */

import { describe, expect, it, vi } from 'vitest';

import {
  buildModuleContextGrounding,
  detectModuleKey,
} from '../moduleContextGrounding.js';

const ORG = 'cc9db573-260f-4a19-927f-f3cc1fbaea38';
const USER = '76015d70-9117-444f-97a6-4f5eda9d7ad5';

function recordingQuery(rowsBySqlFragment: Array<[string, any[]]>) {
  const calls: Array<{ sql: string; params: unknown[] }> = [];
  const fn = vi.fn(async (sql: string, params: unknown[]) => {
    calls.push({ sql, params });
    for (const [fragment, rows] of rowsBySqlFragment) {
      if (sql.includes(fragment)) return rows;
    }
    return [];
  });
  return { fn, calls };
}

describe('detectModuleKey', () => {
  it('rozpoznaje moduł z różnych kształtów screenContext', () => {
    expect(detectModuleKey({ currentScreen: '/initiatives' })).toBe('initiatives');
    expect(detectModuleKey({ moduleId: 'inicjatywy' })).toBe('initiatives');
    expect(detectModuleKey({ pathname: '/my-work/tasks' })).toBe('my_work');
    expect(detectModuleKey({ page: { route: '/execution/rollout' } })).toBe('execution');
    expect(detectModuleKey({ currentScreen: '/assessment' })).toBe('assessment');
  });

  it('brak screenContext → przegląd organizacji (czat ogólny), nie pustka', () => {
    // MUTACJA: `return 'org_overview'` → `return null` sprawia, że czat ogólny
    // przestaje dostawać jakikolwiek kontekst i wraca `no_sources`.
    expect(detectModuleKey(null)).toBe('org_overview');
    expect(detectModuleKey({})).toBe('org_overview');
  });
});

describe('buildModuleContextGrounding — /initiatives', () => {
  it('produkuje cytaty i blok promptu z realnych inicjatyw', async () => {
    const { fn } = recordingQuery([
      [
        'FROM initiatives',
        [
          { id: 'i1', name: 'Supply Chain Optimization', status: 'EXECUTING', summary: 'Skrócenie lead time' },
          { id: 'i2', name: 'Vendor Consolidation', status: 'EXECUTING', summary: null },
        ],
      ],
    ]);

    const out = await buildModuleContextGrounding({
      organizationId: ORG,
      userId: USER,
      screenContext: { currentScreen: '/initiatives' },
      queryFn: fn,
    });

    expect(out).not.toBeNull();
    // MUTACJA: usunięcie `pushCitation(...)` z gałęzi inicjatyw → 0 cytatów →
    // `used_sources` puste → `degraded: no_sources` wraca. Ta asercja pada.
    expect(out!.citations.length).toBe(2);
    expect(out!.citations[0].type).toBe('module_data');
    expect(out!.citations[0].title).toContain('Supply Chain Optimization');
    expect(out!.systemInstructionAddon).toContain('DANE MODUŁU W ZASIĘGU');
    expect(out!.systemInstructionAddon).toContain('Supply Chain Optimization');
    expect(out!.systemInstructionAddon).toContain('[M1]');
  });

  it('dokłada otwartą kartę, gdy screenContext niesie jej id', async () => {
    const openId = 'fa87dc75-d838-4fa0-8263-590969aa8621';
    const fn = vi.fn(async (sql: string, params: unknown[]) => {
      if (sql.includes('WHERE id = ?')) {
        return [{ id: openId, name: 'Supply Chain Optimization', status: 'EXECUTING', hypothesis: 'H1' }];
      }
      if (sql.includes('FROM initiatives')) return [{ id: 'i9', name: 'Inna', status: 'DRAFT' }];
      return [];
    });

    const out = await buildModuleContextGrounding({
      organizationId: ORG,
      userId: USER,
      screenContext: { currentScreen: '/initiatives', selectedObjectId: openId },
      queryFn: fn,
    });

    expect(out!.counts.openRecord).toBe(1);
    expect(out!.systemInstructionAddon).toContain('Karta otwarta przez użytkownika');
    expect(out!.citations.some((c) => c.title.startsWith('Otwarta karta:'))).toBe(true);
  });
});

describe('buildModuleContextGrounding — /my-work', () => {
  it('cytuje zadania przypisane do użytkownika', async () => {
    const { fn, calls } = recordingQuery([
      [
        'FROM tasks',
        [
          { id: 't1', title: 'Zamknąć wywiad z Elkomtech', status: 'in_progress', due_date: '2026-09-10' },
          { id: 't2', title: 'Przegląd KPI', status: 'todo', priority: 'HIGH' },
        ],
      ],
    ]);

    const out = await buildModuleContextGrounding({
      organizationId: ORG,
      userId: USER,
      screenContext: { currentScreen: '/my-work' },
      queryFn: fn,
    });

    expect(out!.citations.length).toBe(2);
    expect(out!.citations[0].reference).toBe('tasks/t1');
    const taskCall = calls.find((c) => c.sql.includes('FROM tasks'))!;
    expect(taskCall.params).toEqual([ORG, USER]);
  });
});

describe('buildModuleContextGrounding — izolacja tenanta', () => {
  it('KAŻDE zapytanie filtruje po organization_id i dostaje org z żądania', async () => {
    const { fn, calls } = recordingQuery([
      ['FROM initiatives', [{ id: 'i1', name: 'A', status: 'X' }]],
      ['FROM tasks', [{ id: 't1', title: 'B', status: 'todo' }]],
      ['FROM decisions', [{ id: 'd1', title: 'C', status: 'decided' }]],
    ]);

    for (const screen of ['/initiatives', '/my-work', '/execution', null]) {
      calls.length = 0;
      await buildModuleContextGrounding({
        organizationId: ORG,
        userId: USER,
        screenContext: screen ? { currentScreen: screen } : null,
        queryFn: fn,
      });
      expect(calls.length).toBeGreaterThan(0);
      for (const call of calls) {
        // MUTACJA: skasowanie `WHERE organization_id = ?` z któregokolwiek zapytania
        // → wyciek międzytenantowy; ta asercja pada.
        expect(call.sql).toMatch(/organization_id = \?/);
        expect(call.params).toContain(ORG);
      }
    }
  });
});

describe('buildModuleContextGrounding — uczciwe no_sources', () => {
  it('pusty moduł → null (nie wymyślamy źródeł)', async () => {
    const fn = vi.fn(async () => []);
    const out = await buildModuleContextGrounding({
      organizationId: ORG,
      userId: USER,
      screenContext: { currentScreen: '/initiatives' },
      queryFn: fn,
    });
    // MUTACJA: zwrócenie tu pustego obiektu zamiast `null` sprawiłoby, że
    // `used_sources` byłoby niepuste bez ani jednego realnego rekordu — fałsz.
    expect(out).toBeNull();
  });

  it('brak organizationId → null (żadnego czytania danych)', async () => {
    const fn = vi.fn(async () => [{ id: 'x' }]);
    expect(
      await buildModuleContextGrounding({ organizationId: '', userId: USER, queryFn: fn })
    ).toBeNull();
    expect(fn).not.toHaveBeenCalled();
  });

  it('allowOrganizationData=false (privateMode / wyłączone dane org) → null', async () => {
    const fn = vi.fn(async () => [{ id: 'x', name: 'Tajne', status: 'X' }]);
    expect(
      await buildModuleContextGrounding({
        organizationId: ORG,
        userId: USER,
        screenContext: { currentScreen: '/initiatives' },
        allowOrganizationData: false,
        queryFn: fn,
      })
    ).toBeNull();
    // MUTACJA: usunięcie warunku `allowOrganizationData === false` → w trybie
    // prywatnym Teresa czyta dane organizacji; ta asercja pada.
    expect(fn).not.toHaveBeenCalled();
  });

  it('błąd zapytania nie wywraca czatu — pozostałe źródła nadal działają', async () => {
    const fn = vi.fn(async (sql: string) => {
      if (sql.includes('FROM initiatives')) throw new Error('relation does not exist');
      if (sql.includes('FROM decisions')) return [{ id: 'd1', title: 'Decyzja X', status: 'decided' }];
      return [];
    });
    const out = await buildModuleContextGrounding({
      organizationId: ORG,
      userId: USER,
      screenContext: null,
      queryFn: fn,
    });
    expect(out).not.toBeNull();
    expect(out!.citations.map((c) => c.title)).toContain('Decyzja: Decyzja X');
  });
});
