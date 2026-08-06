/**
 * Source Pack persistence — real PostgreSQL regression.
 *
 * DEFECT THIS PINS: `markSourcePackReady` promoted a pack to `ready` in the
 * in-process registry and fired the write-through as an un-awaited promise
 * (`void persistSourcePack(next).catch(() => undefined)`). A draft → add-item
 * → mark-ready sequence therefore issued three concurrent upserts against the
 * SAME `pack_id` row, and an earlier one landing late overwrote a later one.
 * A pack the API had just reported as `ready` came back out of Postgres as
 * `draft`. The in-memory SQL mock resolved those promises on the microtask
 * queue in issue order, so the whole mocked suite stayed green and the defect
 * was only reachable against a real database.
 *
 * The tests below are written to go red if the fix is reverted:
 *   - the ordering test fails because the rehydrated status is `draft`;
 *   - the false-success test fails because the promotion resolves instead of
 *     rejecting when persistence is refused.
 *
 * Isolation: every test uses a freshly generated organization id, so this file
 * neither depends on nor disturbs rows written by any other test file, and it
 * never truncates shared tables.
 */
import { randomUUID } from 'node:crypto';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const REAL_DB = process.env.RUN_DB_TESTS === '1' && process.env.MOCK_DB === 'false';

const freshOrg = () => `org-sp-${randomUUID()}`;

const makeItem = () => ({
  itemType: 'text' as const,
  title: 'Discovery interview transcript',
  body: 'CFO: consolidate analytical capacity by Q4.',
  contentLength: 42,
  sourceRef: {
    sourceType: 'transcript',
    sourceId: `src-${randomUUID()}`,
    sourceTitle: 'Discovery interview transcript — CFO',
  },
  language: 'en' as const,
});

/** Import a COLD copy of the service: module-level registry Maps are empty. */
const loadColdService = async () => {
  vi.resetModules();
  return import('../documentSourcePackService.js');
};

describe.skipIf(!REAL_DB)('Source Pack persistence — real PostgreSQL', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('promotion to ready survives a cold service instance and rehydration', async () => {
    const ORG = freshOrg();
    const USER = `user-${randomUUID()}`;

    // --- process lifetime #1: create, fill, promote -------------------------
    const first = await loadColdService();
    const pack = await first.draftSourcePack({
      organizationId: ORG,
      userId: USER,
      name: 'Persisted pack',
      language: 'en',
    });
    await first.addSourcePackItem({
      organizationId: ORG,
      userId: USER,
      packId: pack.packId,
      item: makeItem(),
    });
    const promoted = await first.markSourcePackReady({
      organizationId: ORG,
      userId: USER,
      packId: pack.packId,
    });
    expect(promoted.status).toBe('ready');

    // --- process lifetime #2: nothing in memory, everything from Postgres ---
    const second = await loadColdService();
    expect(second.getSourcePack(pack.packId, ORG)).toBeNull();

    await second.ensureSourcePackRegistryHydrated(ORG);

    const rehydrated = second.getSourcePack(pack.packId, ORG);
    expect(rehydrated).not.toBeNull();
    expect(rehydrated?.status).toBe('ready');
    expect(rehydrated?.items).toHaveLength(1);
    expect(rehydrated?.totalContentLength).toBe(42);
  });

  it('the audit entry for the promotion lands with it, not separately', async () => {
    const ORG = freshOrg();
    const USER = `user-${randomUUID()}`;

    const first = await loadColdService();
    const pack = await first.draftSourcePack({
      organizationId: ORG,
      userId: USER,
      name: 'Audited pack',
      language: 'en',
    });
    await first.addSourcePackItem({
      organizationId: ORG,
      userId: USER,
      packId: pack.packId,
      item: makeItem(),
    });
    await first.markSourcePackReady({ organizationId: ORG, userId: USER, packId: pack.packId });

    const second = await loadColdService();
    await second.ensureSourcePackRegistryHydrated(ORG);

    const actions = second
      .listSourcePackAuditEntries(pack.packId, ORG)
      .map((e: { action: string }) => e.action);
    expect(actions).toContain('pack_drafted');
    expect(actions).toContain('pack_item_added');
    expect(actions).toContain('pack_marked_ready');
  });

  it('a refused write makes the promotion FAIL instead of reporting success', async () => {
    const ORG = freshOrg();
    const USER = `user-${randomUUID()}`;

    vi.resetModules();
    const dao = await import('../documentSourcePackRegistryDao.js');
    const service = await import('../documentSourcePackService.js');

    const pack = await service.draftSourcePack({
      organizationId: ORG,
      userId: USER,
      name: 'Refused promotion',
      language: 'en',
    });
    await service.addSourcePackItem({
      organizationId: ORG,
      userId: USER,
      packId: pack.packId,
      item: makeItem(),
    });

    // Persistence refuses from here on.
    const spy = vi
      .spyOn(dao, 'persistSourcePackWithAudit')
      .mockResolvedValue({ ok: false, error: 'simulated_write_failure' });

    await expect(
      service.markSourcePackReady({ organizationId: ORG, userId: USER, packId: pack.packId })
    ).rejects.toThrow(/source_pack_persist_failed/);

    expect(spy).toHaveBeenCalled();

    // No phantom promotion in memory…
    expect(service.getSourcePack(pack.packId, ORG)?.status).toBe('draft');

    // …and none in Postgres either, read back through a cold instance.
    spy.mockRestore();
    const cold = await loadColdService();
    await cold.ensureSourcePackRegistryHydrated(ORG);
    expect(cold.getSourcePack(pack.packId, ORG)?.status).toBe('draft');
  });

  it('rapid consecutive transitions persist in the order they were applied', async () => {
    const ORG = freshOrg();
    const USER = `user-${randomUUID()}`;

    const first = await loadColdService();
    const pack = await first.draftSourcePack({
      organizationId: ORG,
      userId: USER,
      name: 'Ordering',
      language: 'en',
    });
    await first.addSourcePackItem({
      organizationId: ORG,
      userId: USER,
      packId: pack.packId,
      item: makeItem(),
    });
    await first.markSourcePackReady({ organizationId: ORG, userId: USER, packId: pack.packId });
    // Adding an item to a ready pack reverts it to draft — the LAST write wins.
    await first.addSourcePackItem({
      organizationId: ORG,
      userId: USER,
      packId: pack.packId,
      item: makeItem(),
    });

    const second = await loadColdService();
    await second.ensureSourcePackRegistryHydrated(ORG);
    const rehydrated = second.getSourcePack(pack.packId, ORG);
    expect(rehydrated?.status).toBe('draft');
    expect(rehydrated?.items).toHaveLength(2);
  });
});
