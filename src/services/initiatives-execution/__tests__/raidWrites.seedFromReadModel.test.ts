import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  __resetRaidVersionCache,
  seedRaidVersions,
  updateRaidItem,
  deleteRaidItem,
} from '../raidWrites';

/**
 * N3 (odbiór adwersaryjny 20260910, WAŻNY) — zmierzone na stanowisku (kopia
 * `consultify_kopia_e1a`, org DBR77): edycja/usunięcie pozycji RAID Z KARTY
 * inicjatywy szło ZAWSZE z `expectedVersion: 0` na pierwszym żądaniu →
 * `409 VERSION_OR_IDEMPOTENCY_CONFLICT (expectedVersion 0, currentVersion N)`,
 * dopiero automatyczny retry dawał 200. Powtarzalne 2/2.
 *
 * Przyczyna: `seedRaidVersions()` (mechanizm już istniejący i używany przez
 * Execution — `ExecutionControlSurface.tsx`) nigdy nie był wołany przez kartę
 * inicjatywy (`InitiativeDocumentView.tsx`), bo oba czytniki RAID, których
 * karta używa (`GET /api/v8/planning/initiatives/:id/raid` i fallback
 * `GET /api/initiatives/:id/raid`), nie zwracały w ogóle `aggregateVersion`
 * — naprawione w `planningPortfolioReadService.ts`/`InitiativeController.ts`
 * (LEFT JOIN na `ie_aggregate_state`, tak jak `raid.routes.ts` już robił).
 *
 * Ten test dowodzi WYŁĄCZNIE połączenia: gdy model odczytu niesie
 * `aggregateVersion`, `seedRaidVersions` + `updateRaidItem`/`deleteRaidItem`
 * wysyłają PIERWSZE żądanie z właściwą wersją — zero 409.
 */
describe('raidWrites — seeding aggregate version from the read model (N3)', () => {
  const initiativeId = 'init-1';
  const raidItemId = 'raid-item-1';

  beforeEach(() => {
    __resetRaidVersionCache();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends expectedVersion:0 on the very first write when nothing was seeded (documents the pre-fix defect)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ aggregateVersion: 1 }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await updateRaidItem(initiativeId, raidItemId, { title: 'Updated title' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(String(fetchMock.mock.calls[0][1].body));
    expect(body.expectedVersion).toBe(0);
  });

  it(
    'sends the SEEDED version (not 0) on the first write after the read model carried ' +
      'aggregateVersion — zero 409s, exactly one request',
    async () => {
      seedRaidVersions([{ id: raidItemId, aggregateVersion: 4 }]);

      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ aggregateVersion: 5 }),
      });
      vi.stubGlobal('fetch', fetchMock);

      await updateRaidItem(initiativeId, raidItemId, { title: 'Updated title' });

      // MUTATION GUARD: exactly one request — no 409 → retry round trip.
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const body = JSON.parse(String(fetchMock.mock.calls[0][1].body));
      expect(body.expectedVersion).toBe(4);
      expect(fetchMock.mock.calls.every(([, init]: any) => init.method !== undefined)).toBe(true);
    }
  );

  it('ignores items with a null/non-numeric aggregateVersion (pre-26A rows) — stays adopted at 0', async () => {
    seedRaidVersions([{ id: raidItemId, aggregateVersion: null }]);

    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ aggregateVersion: 1 }) });
    vi.stubGlobal('fetch', fetchMock);

    await deleteRaidItem(initiativeId, raidItemId);

    const body = JSON.parse(String(fetchMock.mock.calls[0][1].body));
    expect(body.expectedVersion).toBe(0);
  });

  it('after a successful write, the NEXT write uses the version the server returned (no reseed needed)', async () => {
    seedRaidVersions([{ id: raidItemId, aggregateVersion: 4 }]);

    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ aggregateVersion: 5 }) });
    vi.stubGlobal('fetch', fetchMock);

    await updateRaidItem(initiativeId, raidItemId, { title: 'First edit' });
    await updateRaidItem(initiativeId, raidItemId, { title: 'Second edit' });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const secondBody = JSON.parse(String(fetchMock.mock.calls[1][1].body));
    expect(secondBody.expectedVersion).toBe(5);
  });
});
