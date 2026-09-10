/**
 * E1b/R3 (2026-09-10) — `getInitiativeTaskDependenciesRead` (Realizacja →
 * karta inicjatywy → zaleznosci zadan) logowal `[QueryHelper] Error in
 * queryAll: column td.predecessor_id does not exist` (42703) PRZY KAZDYM
 * wywolaniu na prawdziwym schemacie.
 *
 * POMIAR na kopii `consultify_kopia_e1b` (schemat identyczny jak
 * staging/demo): `information_schema.columns` dla `task_dependencies` ma
 * `from_task_id`/`to_task_id` — NIE MA `predecessor_id`/`successor_id`.
 * Stara wersja probowala `predecessor_id`/`successor_id` NAJPIERW (bledny
 * strzal na kazdym wywolaniu), lapala blad w `catch`, dopiero potem
 * uzywala prawdziwych kolumn — funkcjonalnie dzialalo, ale logowalo ERROR
 * za kazdym razem (4x w sesji odbioru).
 *
 * Naprawa: `resolveTaskDependenciesColumns()` rozpoznaje schemat RAZ przez
 * `getTableColumns` (jak `TaskController.getTaskDepsSchema`) i buduje
 * zapytanie z prawidlowymi kolumnami od razu — jedno wywolanie `queryAll`,
 * zero prob skazanych na blad.
 *
 * MUTACJA (weryfikacja reczna): przywrocenie starego kodu (najpierw
 * predecessor_id, catch + fallback) -> test (a) czerwony, bo `queryAll`
 * jest wolane raz z `from_task_id` zamiast probowac `predecessor_id`.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getTableColumnsMock, queryAllMock, queryOneMock } = vi.hoisted(() => ({
  getTableColumnsMock: vi.fn(),
  queryAllMock: vi.fn(),
  queryOneMock: vi.fn(),
}));

vi.mock('../../../utils/queryHelpers.js', () => ({
  queryAll: queryAllMock,
  queryOne: queryOneMock,
}));

vi.mock('../../../utils/dbSchema.js', () => ({
  getTableColumns: getTableColumnsMock,
}));

describe('planningPortfolioReadService — getInitiativeTaskDependenciesRead (R3)', () => {
  beforeEach(() => {
    vi.resetModules();
    getTableColumnsMock.mockReset();
    queryAllMock.mockReset();
    queryOneMock.mockReset();
  });

  it('(a) schemat realny (from_task_id/to_task_id): JEDNO wywolanie queryAll, bez proby predecessor_id', async () => {
    queryOneMock.mockResolvedValue({ id: 'init-1' });
    getTableColumnsMock.mockResolvedValue(new Set(['id', 'from_task_id', 'to_task_id']));
    queryAllMock.mockResolvedValue([]);

    const { getInitiativeTaskDependenciesRead } = await import('../planningPortfolioReadService.js');
    await getInitiativeTaskDependenciesRead('init-1', 'org-1');

    expect(queryAllMock).toHaveBeenCalledTimes(1);
    const [sql] = queryAllMock.mock.calls[0];
    expect(sql).toContain('from_task_id');
    expect(sql).toContain('to_task_id');
    expect(sql).not.toContain('predecessor_id');
    expect(sql).not.toContain('successor_id');
  });

  it('(b) schemat rezerwowy (predecessor_id/successor_id): nadal dziala, JEDNO wywolanie queryAll', async () => {
    queryOneMock.mockResolvedValue({ id: 'init-1' });
    getTableColumnsMock.mockResolvedValue(new Set(['id', 'predecessor_id', 'successor_id']));
    queryAllMock.mockResolvedValue([]);

    const { getInitiativeTaskDependenciesRead } = await import('../planningPortfolioReadService.js');
    await getInitiativeTaskDependenciesRead('init-1', 'org-1');

    expect(queryAllMock).toHaveBeenCalledTimes(1);
    const [sql] = queryAllMock.mock.calls[0];
    expect(sql).toContain('predecessor_id');
    expect(sql).toContain('successor_id');
  });

  it('(c) getTableColumns pada -> domyslnie realny schemat (from_task_id/to_task_id), bez wyjatku', async () => {
    queryOneMock.mockResolvedValue({ id: 'init-1' });
    getTableColumnsMock.mockRejectedValue(new Error('boom'));
    queryAllMock.mockResolvedValue([]);

    const { getInitiativeTaskDependenciesRead } = await import('../planningPortfolioReadService.js');
    const result = await getInitiativeTaskDependenciesRead('init-1', 'org-1');

    expect(result).toEqual([]);
    const [sql] = queryAllMock.mock.calls[0];
    expect(sql).toContain('from_task_id');
  });

  it('(d) mapuje wiersze na pary predecessor/successor z realnymi kolumnami', async () => {
    queryOneMock.mockResolvedValue({ id: 'init-1' });
    getTableColumnsMock.mockResolvedValue(new Set(['id', 'from_task_id', 'to_task_id']));
    queryAllMock.mockResolvedValue([
      {
        id: 'dep-1',
        fromTaskId: 'task-a',
        toTaskId: 'task-b',
        dependencyType: 'finish_to_start',
        lagDays: 2,
        notes: null,
        createdAt: '2026-09-01T00:00:00.000Z',
        fromTitle: 'A',
        fromStatus: 'todo',
        fromPriority: 'medium',
        toTitle: 'B',
        toStatus: 'todo',
        toPriority: 'high',
      },
    ]);

    const { getInitiativeTaskDependenciesRead } = await import('../planningPortfolioReadService.js');
    const result = await getInitiativeTaskDependenciesRead('init-1', 'org-1');

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ taskId: 'task-a', sourceTaskId: 'task-b', direction: 'predecessor' });
    expect(result[1]).toMatchObject({ taskId: 'task-b', sourceTaskId: 'task-a', direction: 'successor' });
  });
});
