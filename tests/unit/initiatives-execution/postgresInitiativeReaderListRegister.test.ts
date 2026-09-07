/**
 * [ODMROZENIE 05_INITIATIVES DEC-421] P15 K4 — lista planów i lista analiz obciążenia
 * kłamały w trzech kolumnach (postgresInitiativeReader.ts:1238-1239, CapacityScenarioSurface.tsx
 * plan-name wiring). Ten plik pokrywa mapowanie wiersza z wyniku SQL na kontrakt API
 * (`listPlanScenarios`/`listCapacityScenarios`); zakłada, że SQL policzył już
 * `conflicts_count`/`updated_by_first_name`/`updated_by_last_name`/`plan_name` — to,
 * co robi zapytanie, jest zweryfikowane osobno na żywej bazie (evidence/p15-k4/).
 *
 * Każdy test ma udokumentowaną mutację, którą wykonano ręcznie na czas pomiaru:
 * przywrócono starą (zepsutą) linię, uruchomiono `vitest run` (czerwony), cofnięto.
 */
import { describe, expect, it, vi } from 'vitest';

import { PostgresInitiativeReader } from '../../../server/src/domain/initiatives-execution/postgresInitiativeReader';

function fakePool(rows: unknown[]) {
  return { query: vi.fn().mockResolvedValue({ rows }) } as any;
}

describe('P15 K4 — PostgresInitiativeReader.listPlanScenarios', () => {
  it('konflikty = liczba z najnowszej propozycji analizy planu (nie stała 0)', async () => {
    // MUTACJA (red): `conflicts: 0,` na sztywno (stan sprzed K4, postgresInitiativeReader.ts:1238)
    // → ten test failuje, bo oczekuje 3, a dostałby 0. Przywrócono naprawę po pomiarze.
    const pool = fakePool([
      {
        aggregate_id: 'plan-1',
        payload_json: {
          name: 'Plan modernizacji',
          status: 'PUBLISHED',
          scenarioVersion: 2,
          windows: [{}, {}],
          updatedBy: 'user-1',
          portfolioScenarioId: 'portfolio-1',
          portfolioScenarioVersion: 1,
          windowUnit: 'WEEK',
          timezone: 'Europe/Warsaw',
          periods: [],
        },
        updated_at: new Date('2026-09-01T00:00:00.000Z'),
        conflicts_count: 3,
        updated_by_first_name: 'Anna',
        updated_by_last_name: 'Kowalska',
      },
    ]);
    const reader = new PostgresInitiativeReader(pool);
    const rows = await reader.listPlanScenarios('org-1');
    expect(rows[0].conflicts).toBe(3);
  });

  it('brak propozycji dla planu → 0 (front pokazuje etykietę „Brak")', async () => {
    const pool = fakePool([
      {
        aggregate_id: 'plan-1',
        payload_json: {
          status: 'DRAFT',
          scenarioVersion: 1,
          windows: [],
          updatedBy: 'user-1',
          portfolioScenarioId: 'portfolio-1',
          portfolioScenarioVersion: 1,
          windowUnit: 'WEEK',
          timezone: 'Europe/Warsaw',
          periods: [],
        },
        updated_at: new Date('2026-09-01T00:00:00.000Z'),
        conflicts_count: null,
        updated_by_first_name: null,
        updated_by_last_name: null,
      },
    ]);
    const reader = new PostgresInitiativeReader(pool);
    const rows = await reader.listPlanScenarios('org-1');
    expect(rows[0].conflicts).toBe(0);
  });

  it('autor = imię i nazwisko z users, NIE surowe UUID', async () => {
    // MUTACJA (red): `author: r.payload_json.updatedBy,` (stan sprzed K4) zwraca
    // '76015d70-9117-444f-97a6-4f5eda9d7ad5' zamiast 'Anna Kowalska' → test failuje.
    const pool = fakePool([
      {
        aggregate_id: 'plan-1',
        payload_json: {
          status: 'PUBLISHED',
          scenarioVersion: 1,
          windows: [],
          updatedBy: '76015d70-9117-444f-97a6-4f5eda9d7ad5',
          portfolioScenarioId: 'portfolio-1',
          portfolioScenarioVersion: 1,
          windowUnit: 'WEEK',
          timezone: 'Europe/Warsaw',
          periods: [],
        },
        updated_at: new Date('2026-09-01T00:00:00.000Z'),
        conflicts_count: 0,
        updated_by_first_name: 'Anna',
        updated_by_last_name: 'Kowalska',
      },
    ]);
    const reader = new PostgresInitiativeReader(pool);
    const rows = await reader.listPlanScenarios('org-1');
    expect(rows[0].author).toBe('Anna Kowalska');
    expect(rows[0].author).not.toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-/i);
  });

  it('brak dopasowania w users → „Nieznany użytkownik", nie UUID', async () => {
    const pool = fakePool([
      {
        aggregate_id: 'plan-1',
        payload_json: {
          status: 'PUBLISHED',
          scenarioVersion: 1,
          windows: [],
          updatedBy: 'ghost-user-id',
          portfolioScenarioId: 'portfolio-1',
          portfolioScenarioVersion: 1,
          windowUnit: 'WEEK',
          timezone: 'Europe/Warsaw',
          periods: [],
        },
        updated_at: new Date('2026-09-01T00:00:00.000Z'),
        conflicts_count: 0,
        updated_by_first_name: null,
        updated_by_last_name: null,
      },
    ]);
    const reader = new PostgresInitiativeReader(pool);
    const rows = await reader.listPlanScenarios('org-1');
    expect(rows[0].author).toBe('Nieznany użytkownik');
  });
});

describe('P15 K4 — PostgresInitiativeReader.listCapacityScenarios', () => {
  it('planRef.name = nazwa agregatu plan_scenario (nie literał)', async () => {
    // MUTACJA (red): bez `plan_name`/`planRef.name` front konstruował literał
    // stały „Plan źródłowy" niezależnie od realnej nazwy planu
    // (CapacityScenarioSurface.tsx sprzed K4 przekazywało displayName=ID).
    const pool = fakePool([
      {
        aggregate_id: 'cap-1',
        payload_json: {
          status: 'PUBLISHED',
          scenarioVersion: 1,
          planScenarioId: 'plan-1',
          planScenarioVersion: 3,
          windowUnit: 'WEEK',
          timezone: 'Europe/Warsaw',
          periods: [],
          constraints: [],
          proposedAssignments: [],
        },
        updated_at: new Date('2026-09-01T00:00:00.000Z'),
        plan_name: 'Plan modernizacji zakładu',
      },
    ]);
    const reader = new PostgresInitiativeReader(pool);
    const rows = await reader.listCapacityScenarios('org-1');
    expect(rows[0].planRef.name).toBe('Plan modernizacji zakładu');
  });

  it('brak powiązanego planu → planRef.name = null (front pokazuje „Plan bez nazwy")', async () => {
    const pool = fakePool([
      {
        aggregate_id: 'cap-1',
        payload_json: {
          status: 'DRAFT',
          scenarioVersion: 1,
          planScenarioId: 'plan-ghost',
          planScenarioVersion: 1,
          windowUnit: 'WEEK',
          timezone: 'Europe/Warsaw',
          periods: [],
          constraints: [],
          proposedAssignments: [],
        },
        updated_at: new Date('2026-09-01T00:00:00.000Z'),
        plan_name: null,
      },
    ]);
    const reader = new PostgresInitiativeReader(pool);
    const rows = await reader.listCapacityScenarios('org-1');
    expect(rows[0].planRef.name).toBeNull();
  });
});
