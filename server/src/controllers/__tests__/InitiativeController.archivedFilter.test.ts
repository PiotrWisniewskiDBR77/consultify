import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * DEC-495 — `GET /api/initiatives` musi domyslnie CHOWAC zarchiwizowane
 * inicjatywy i przywolywac je na zadanie.
 *
 * Jedyna prawda o archiwum to KOLUMNA `initiatives.archived` (+ legacy
 * `archived_at`), nie status: migracja P12 (`20262103_p12_initiative_status_slownik.sql`)
 * skasowala status 'ARCHIVED' ze slownika i przepisala go do flagi, a
 * `executeInitiativeTransition({ flagOperation: 'ARCHIVE' })` robi
 * `UPDATE initiatives SET archived = TRUE, archived_at = ...` zostawiajac
 * status CLOSED/REJECTED.
 *
 * Kontrakt zapytania jest przepisany 1:1 z juz istniejacego wzoru w
 * `routes/report-builder.routes.ts:2020`:
 *   brak parametru        -> tylko aktualne (bez archiwalnych)
 *   ?archived=true        -> WYLACZNIE archiwalne
 *   ?archived=false       -> jawnie tylko aktualne
 *   ?includeArchived=true -> jedne i drugie (ma pierwszenstwo)
 */

const queryAll = vi.fn();
const getTableColumns = vi.fn();

vi.mock('../../utils/queryHelpers.js', () => ({
  queryAll: (...args: unknown[]) => queryAll(...args),
  getTableColumns: (...args: unknown[]) => getTableColumns(...args),
  queryOne: vi.fn(),
  queryRun: vi.fn(),
}));

vi.mock('../../services/initiative/initiativeTransitionService.js', () => ({
  executeInitiativeTransition: vi.fn(),
  getColumnNameSet: (columns: unknown[]) =>
    new Set((columns as Array<{ name?: string }>).map((c) => String(c?.name ?? ''))),
  getInitiativeNotificationRecipients: vi.fn(),
  normalizeStatus: (value: unknown) => String(value ?? '').toUpperCase(),
  pushOptionalColumnUpdate: vi.fn(),
}));

import { InitiativeController } from '../InitiativeController';

const response = () => ({ status: vi.fn().mockReturnThis(), json: vi.fn() }) as any;
const request = (query: Record<string, unknown> = {}) =>
  ({
    user: { organizationId: 'org-dec495', id: 'user-dec495', role: 'ADMIN' },
    headers: { 'accept-language': 'pl' },
    query,
  }) as any;

/** Zwraca SQL przekazany do warstwy bazy — to jedyny pomiar, ktory nie klamie. */
const runList = async (query: Record<string, unknown> = {}) => {
  queryAll.mockReset();
  queryAll.mockResolvedValue([]);
  const res = response();
  await (InitiativeController.getInitiatives as any)(request(query), res, vi.fn());
  expect(queryAll).toHaveBeenCalledTimes(1);
  return String(queryAll.mock.calls[0][0]).replace(/\s+/g, ' ');
};

describe('DEC-495 — GET /api/initiatives filtruje archiwalne', () => {
  beforeEach(() => {
    getTableColumns.mockReset();
    getTableColumns.mockResolvedValue([
      { name: 'id' },
      { name: 'organization_id' },
      { name: 'status' },
      { name: 'archived' },
      { name: 'archived_at' },
    ]);
  });

  it('bez parametru chowa zarchiwizowane (domyslnie „Aktualne”)', async () => {
    const sql = await runList();
    expect(sql).toContain('COALESCE(i.archived, FALSE) = FALSE');
    expect(sql).toContain('i.archived_at IS NULL');
  });

  it('?archived=false jawnie chowa zarchiwizowane', async () => {
    const sql = await runList({ archived: 'false' });
    expect(sql).toContain('COALESCE(i.archived, FALSE) = FALSE');
  });

  it('?archived=true pokazuje WYLACZNIE zarchiwizowane', async () => {
    const sql = await runList({ archived: 'true' });
    expect(sql).toContain('COALESCE(i.archived, FALSE) = TRUE');
    expect(sql).not.toContain('COALESCE(i.archived, FALSE) = FALSE');
  });

  it('?includeArchived=true przywoluje archiwalne obok aktualnych', async () => {
    const sql = await runList({ includeArchived: 'true' });
    expect(sql).not.toContain('COALESCE(i.archived, FALSE)');
  });

  it('?includeArchived=true ma pierwszenstwo nad ?archived=true', async () => {
    const sql = await runList({ includeArchived: 'true', archived: 'true' });
    expect(sql).not.toContain('COALESCE(i.archived, FALSE)');
  });

  it('nie dokleja warunku, gdy tabela nie ma kolumny `archived`', async () => {
    getTableColumns.mockResolvedValue([{ name: 'id' }, { name: 'status' }]);
    const sql = await runList();
    expect(sql).not.toContain('i.archived');
  });
});
