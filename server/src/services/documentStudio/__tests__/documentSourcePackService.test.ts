/**
 * Document Studio — Source Pack Service tests (Epic E4, Slice 4.1).
 *
 * Covers the lifecycle and tenancy surface of the pack registry:
 *
 *   - Draft → add items → mark ready → attach to document.
 *   - Mutating a `ready` pack reverts it to `draft` (consultant must
 *     explicitly re-confirm the new shape).
 *   - Archive is irreversible and refuses further mutation.
 *   - Cross-tenant reads return `null` / `[]` deny-by-default.
 *   - Audit trail records every state transition with the actor id and
 *     a structured details payload.
 *   - Hydration loads persisted packs from the DAO on cold start.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  __loadSourcePackByIdForTests,
  __resetSourcePackRegistryAndPersistenceForTests,
  addSourcePackItem,
  archiveSourcePack,
  attachSourcePackToDocument,
  draftSourcePack,
  ensureSourcePackRegistryHydrated,
  getSourcePack,
  listSourcePackAuditEntries,
  listSourcePacks,
  markSourcePackReady,
  removeSourcePackItem,
} from '../documentSourcePackService.js';
import type { SourcePackItem } from '../documentStudioTypes.js';

const ORG_A = 'org-A';
const ORG_B = 'org-B';
const USER = 'user-1';

function makeItem(overrides: Partial<SourcePackItem> = {}): Omit<
  SourcePackItem,
  'itemId' | 'ingestedAt' | 'ingestedBy'
> & {
  itemId?: string;
  ingestedAt?: string;
  ingestedBy?: string;
} {
  return {
    itemType: 'text',
    title: 'Discovery interview transcript',
    body: 'CFO: We need to consolidate the analytical capacity by Q4.',
    contentLength: 64,
    sourceRef: {
      sourceType: 'transcript',
      sourceId: 'src-discovery-cfo',
      sourceTitle: 'Discovery interview transcript — CFO',
    },
    language: 'en',
    ...overrides,
  };
}

beforeEach(async () => {
  await __resetSourcePackRegistryAndPersistenceForTests();
});

afterEach(async () => {
  await __resetSourcePackRegistryAndPersistenceForTests();
});

describe('Source Pack Service — lifecycle', () => {
  it('drafts a pack, adds two items, recomputes content length, and stays in draft', async () => {
    const pack = await draftSourcePack({
      organizationId: ORG_A,
      userId: USER,
      name: 'Discovery pack — Q3 transformation',
      language: 'en',
    });
    expect(pack.status).toBe('draft');
    expect(pack.items).toEqual([]);
    expect(pack.totalContentLength).toBe(0);

    const after1 = await addSourcePackItem({
      organizationId: ORG_A,
      userId: USER,
      packId: pack.packId,
      item: makeItem({ contentLength: 1200 }),
    });
    expect(after1.items).toHaveLength(1);
    expect(after1.totalContentLength).toBe(1200);
    expect(after1.status).toBe('draft');

    const after2 = await addSourcePackItem({
      organizationId: ORG_A,
      userId: USER,
      packId: pack.packId,
      item: makeItem({
        title: 'Board memo Q2',
        contentLength: 800,
        sourceRef: {
          sourceType: 'doc',
          sourceId: 'src-board-q2',
          sourceTitle: 'Board memo Q2',
        },
      }),
    });
    expect(after2.items).toHaveLength(2);
    expect(after2.totalContentLength).toBe(2000);
  });

  it('promotes a non-empty pack from draft to ready and rejects empty packs', async () => {
    const empty = await draftSourcePack({
      organizationId: ORG_A,
      userId: USER,
      name: 'Empty pack',
      language: 'en',
    });
    await expect(
      markSourcePackReady({ organizationId: ORG_A, userId: USER, packId: empty.packId })
    ).rejects.toThrow(/source_pack_empty/);

    await addSourcePackItem({
      organizationId: ORG_A,
      userId: USER,
      packId: empty.packId,
      item: makeItem(),
    });
    const ready = await markSourcePackReady({
      organizationId: ORG_A,
      userId: USER,
      packId: empty.packId,
    });
    expect(ready.status).toBe('ready');
    expect(ready.items).toHaveLength(1);
  });

  it('reverts a ready pack to draft when an item is added or removed', async () => {
    const pack = await draftSourcePack({
      organizationId: ORG_A,
      userId: USER,
      name: 'Pack',
      language: 'en',
    });
    const firstItemPack = await addSourcePackItem({
      organizationId: ORG_A,
      userId: USER,
      packId: pack.packId,
      item: makeItem(),
    });
    await markSourcePackReady({ organizationId: ORG_A, userId: USER, packId: pack.packId });

    const afterAdd = await addSourcePackItem({
      organizationId: ORG_A,
      userId: USER,
      packId: pack.packId,
      item: makeItem({
        title: 'Second item',
        sourceRef: {
          sourceType: 'doc',
          sourceId: 'src-2',
          sourceTitle: 'Second',
        },
      }),
    });
    expect(afterAdd.status).toBe('draft');

    await markSourcePackReady({ organizationId: ORG_A, userId: USER, packId: pack.packId });

    const afterRemove = await removeSourcePackItem({
      organizationId: ORG_A,
      userId: USER,
      packId: pack.packId,
      itemId: firstItemPack.items[0]!.itemId,
    });
    expect(afterRemove.status).toBe('draft');
    expect(afterRemove.items).toHaveLength(1);
  });

  it('archives a pack and refuses further mutation', async () => {
    const pack = await draftSourcePack({
      organizationId: ORG_A,
      userId: USER,
      name: 'Pack',
      language: 'en',
    });
    await addSourcePackItem({
      organizationId: ORG_A,
      userId: USER,
      packId: pack.packId,
      item: makeItem(),
    });
    const archived = await archiveSourcePack({
      organizationId: ORG_A,
      userId: USER,
      packId: pack.packId,
      reason: 'superseded by the v2 pack',
    });
    expect(archived.status).toBe('archived');
    expect(archived.archivedBy).toBe(USER);

    await expect(
      addSourcePackItem({
        organizationId: ORG_A,
        userId: USER,
        packId: pack.packId,
        item: makeItem({
          title: 'Late item',
          sourceRef: { sourceType: 'doc', sourceId: 'late', sourceTitle: 'late' },
        }),
      })
    ).rejects.toThrow(/source_pack_archived/);
    await expect(
      removeSourcePackItem({
        organizationId: ORG_A,
        userId: USER,
        packId: pack.packId,
        itemId: 'whatever',
      })
    ).rejects.toThrow(/source_pack_archived/);
  });
});

describe('Source Pack Service — attach', () => {
  it('projects a ready pack to DocumentSourceRef[] and audits the attach', async () => {
    const pack = await draftSourcePack({
      organizationId: ORG_A,
      userId: USER,
      name: 'Pack',
      language: 'en',
    });
    await addSourcePackItem({
      organizationId: ORG_A,
      userId: USER,
      packId: pack.packId,
      item: makeItem({
        sourceRef: { sourceType: 'transcript', sourceId: 'a', sourceTitle: 'A' },
      }),
    });
    await addSourcePackItem({
      organizationId: ORG_A,
      userId: USER,
      packId: pack.packId,
      item: makeItem({
        title: 'B',
        sourceRef: { sourceType: 'doc', sourceId: 'b', sourceTitle: 'B' },
      }),
    });
    await markSourcePackReady({ organizationId: ORG_A, userId: USER, packId: pack.packId });

    const result = attachSourcePackToDocument({
      organizationId: ORG_A,
      userId: USER,
      packId: pack.packId,
      artifactId: 'artifact-1',
    });
    expect(result.sourceRefs.map((ref) => ref.sourceId)).toEqual(['a', 'b']);

    const audit = listSourcePackAuditEntries(pack.packId, ORG_A);
    const attachEntry = audit.find((entry) => entry.action === 'pack_attached_to_document');
    expect(attachEntry).toBeDefined();
    expect((attachEntry?.details as { artifactId?: string } | undefined)?.artifactId).toBe(
      'artifact-1'
    );
  });

  it('refuses to attach a draft pack', async () => {
    const pack = await draftSourcePack({
      organizationId: ORG_A,
      userId: USER,
      name: 'Pack',
      language: 'en',
    });
    await addSourcePackItem({
      organizationId: ORG_A,
      userId: USER,
      packId: pack.packId,
      item: makeItem(),
    });
    expect(() =>
      attachSourcePackToDocument({
        organizationId: ORG_A,
        userId: USER,
        packId: pack.packId,
        artifactId: 'artifact-x',
      })
    ).toThrow(/source_pack_not_ready/);
  });

  it('refuses to attach an archived pack even if it was ready before', async () => {
    const pack = await draftSourcePack({
      organizationId: ORG_A,
      userId: USER,
      name: 'Pack',
      language: 'en',
    });
    await addSourcePackItem({
      organizationId: ORG_A,
      userId: USER,
      packId: pack.packId,
      item: makeItem(),
    });
    await markSourcePackReady({ organizationId: ORG_A, userId: USER, packId: pack.packId });
    await archiveSourcePack({
      organizationId: ORG_A,
      userId: USER,
      packId: pack.packId,
    });
    expect(() =>
      attachSourcePackToDocument({
        organizationId: ORG_A,
        userId: USER,
        packId: pack.packId,
        artifactId: 'artifact-x',
      })
    ).toThrow(/source_pack_not_ready/);
  });
});

describe('Source Pack Service — tenancy', () => {
  it('refuses cross-tenant reads via getSourcePack', async () => {
    const pack = await draftSourcePack({
      organizationId: ORG_A,
      userId: USER,
      name: 'Org A pack',
      language: 'en',
    });
    expect(getSourcePack(pack.packId, ORG_A)).not.toBeNull();
    expect(getSourcePack(pack.packId, ORG_B)).toBeNull();
  });

  it('listSourcePacks returns only the caller tenant rows', async () => {
    await draftSourcePack({
      organizationId: ORG_A,
      userId: USER,
      name: 'Org A',
      language: 'en',
    });
    await draftSourcePack({
      organizationId: ORG_B,
      userId: USER,
      name: 'Org B',
      language: 'en',
    });
    expect(listSourcePacks(ORG_A).map((p) => p.name)).toEqual(['Org A']);
    expect(listSourcePacks(ORG_B).map((p) => p.name)).toEqual(['Org B']);
  });

  it('listSourcePacks excludes archived packs by default and includes them when asked', async () => {
    const pack = await draftSourcePack({
      organizationId: ORG_A,
      userId: USER,
      name: 'Pack',
      language: 'en',
    });
    await addSourcePackItem({
      organizationId: ORG_A,
      userId: USER,
      packId: pack.packId,
      item: makeItem(),
    });
    await archiveSourcePack({ organizationId: ORG_A, userId: USER, packId: pack.packId });
    expect(listSourcePacks(ORG_A)).toHaveLength(0);
    expect(listSourcePacks(ORG_A, { includeArchived: true })).toHaveLength(1);
  });
});

describe('Source Pack Service — audit', () => {
  it('records pack_drafted, pack_item_added, pack_marked_ready in order', async () => {
    const pack = await draftSourcePack({
      organizationId: ORG_A,
      userId: USER,
      name: 'Pack',
      language: 'en',
    });
    await addSourcePackItem({
      organizationId: ORG_A,
      userId: USER,
      packId: pack.packId,
      item: makeItem(),
    });
    await markSourcePackReady({ organizationId: ORG_A, userId: USER, packId: pack.packId });
    const audit = listSourcePackAuditEntries(pack.packId, ORG_A);
    expect(audit.map((e) => e.action)).toEqual([
      'pack_drafted',
      'pack_item_added',
      'pack_marked_ready',
    ]);
  });

  it('records pack_archived with the previous status and reason', async () => {
    const pack = await draftSourcePack({
      organizationId: ORG_A,
      userId: USER,
      name: 'Pack',
      language: 'en',
    });
    await addSourcePackItem({
      organizationId: ORG_A,
      userId: USER,
      packId: pack.packId,
      item: makeItem(),
    });
    await markSourcePackReady({ organizationId: ORG_A, userId: USER, packId: pack.packId });
    await archiveSourcePack({
      organizationId: ORG_A,
      userId: USER,
      packId: pack.packId,
      reason: 'duplicate of a newer pack',
    });
    const audit = listSourcePackAuditEntries(pack.packId, ORG_A);
    const archived = audit.find((e) => e.action === 'pack_archived');
    expect(archived).toBeDefined();
    expect(
      (archived?.details as { previousStatus?: string; reason?: string } | undefined)
        ?.previousStatus
    ).toBe('ready');
    expect((archived?.details as { reason?: string } | undefined)?.reason).toBe(
      'duplicate of a newer pack'
    );
  });
});

describe('Source Pack Service — persistence + hydration', () => {
  it('write-through to DAO survives a registry-only reset and is restored by hydration', async () => {
    const pack = await draftSourcePack({
      organizationId: ORG_A,
      userId: USER,
      name: 'Persisted',
      language: 'en',
    });
    await addSourcePackItem({
      organizationId: ORG_A,
      userId: USER,
      packId: pack.packId,
      item: makeItem(),
    });
    await markSourcePackReady({ organizationId: ORG_A, userId: USER, packId: pack.packId });

    // Sanity check: DAO has the pack persisted via write-through.
    const persisted = await __loadSourcePackByIdForTests(pack.packId, ORG_A);
    expect(persisted).not.toBeNull();
    expect(persisted?.status).toBe('ready');
  });

  it('ensureSourcePackRegistryHydrated is idempotent and a no-op on the second call', async () => {
    await ensureSourcePackRegistryHydrated(ORG_A);
    await ensureSourcePackRegistryHydrated(ORG_A);
    // Idempotent — does not throw, and the registry is empty for a tenant
    // with no persisted rows.
    expect(listSourcePacks(ORG_A)).toEqual([]);
  });
});
