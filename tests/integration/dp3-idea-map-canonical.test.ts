/**
 * DP-3 T2 — data-migration tests for
 * server/scripts/migrate-dp3-canonical-maps.ts
 *
 * Covers the scenarios from the plan (§1 data migration):
 *   - 3 copies from 3 different users → 1 canonical (owner) + 2 snapshots +
 *     the two non-owner rows demoted to is_canonical=FALSE.
 *   - owner has NO copy → the freshest copy (updated_at DESC, tie-break version
 *     DESC) is promoted, archived_from_user_id stamped.
 *   - idempotency: running twice = the same end state (second run is a no-op).
 *   - empty DB → no-op.
 *   - guard: is_canonical column missing → throws (T1 must run first).
 *   - version bump: canonical row version = old + 1.
 *   - errors on one idea don't abort the rest (per-idea transaction isolation).
 *
 * Uses an in-memory IDatabase stub that understands exactly the SQL this script
 * issues (the LEFT JOIN load query + BEGIN/UPDATE/INSERT/COMMIT/ROLLBACK). This
 * lets us re-run the migration against the SAME in-memory state to prove
 * idempotency, which a pure-function test could not.
 */
import { describe, expect, it } from 'vitest';

import {
  planIdea,
  runMigration,
  coerceVersion,
  isCanonicalFlag,
  buildSnapshotDataJson,
  type IdeaGroup,
  type MapRow,
} from '../../server/scripts/migrate-dp3-canonical-maps.js';
import type { IDatabase } from '../../server/src/database/IDatabase.js';

// ── In-memory store ─────────────────────────────────────────────────────────────

interface MapRowStore {
  id: string;
  idea_id: string;
  user_id: string;
  organization_id: string;
  nodes_json: string;
  edges_json: string;
  extensions_json: string;
  version: number;
  updated_at: string;
  is_canonical: boolean;
  last_editor_user_id: string | null;
  archived_from_user_id: string | null;
}

interface IdeaRow {
  id: string;
  user_id: string; // owner
  organization_id: string;
}

interface SnapshotRow {
  id: string;
  idea_id: string;
  user_id: string;
  organization_id: string;
  label: string;
  node_count: number;
  edge_count: number;
  data_json: string;
}

interface Store {
  maps: MapRowStore[];
  ideas: IdeaRow[];
  snapshots: SnapshotRow[];
}

/**
 * Minimal IDatabase over an in-memory Store. Only implements the exact query
 * shapes migrate-dp3-canonical-maps.ts uses. `failIdeaId` optionally makes the
 * INSERT for that idea throw, to exercise per-idea error isolation.
 */
function makeDb(
  store: Store,
  opts: { failIdeaId?: string } = {}
): { db: IDatabase; store: Store } {
  let inTx = false;
  let txBackup: Store | null = null;

  const snapshot = (): Store => JSON.parse(JSON.stringify(store));
  const restore = (s: Store) => {
    store.maps = s.maps;
    store.ideas = s.ideas;
    store.snapshots = s.snapshots;
  };

  const all = async (sql: string, params: unknown[] = []): Promise<unknown[]> => {
    if (/FROM my_idea_maps m/i.test(sql)) {
      const orgFilter = /WHERE m\.organization_id = \?/i.test(sql)
        ? (params[0] as string)
        : null;
      const rows = store.maps
        .filter((m) => (orgFilter ? m.organization_id === orgFilter : true))
        .map((m) => {
          const owner = store.ideas.find((i) => i.id === m.idea_id);
          return {
            id: m.id,
            idea_id: m.idea_id,
            user_id: m.user_id,
            organization_id: m.organization_id,
            nodes_json: m.nodes_json,
            edges_json: m.edges_json,
            extensions_json: m.extensions_json,
            version: m.version,
            updated_at: m.updated_at,
            is_canonical: m.is_canonical,
            owner_user_id: owner ? owner.user_id : null,
          };
        })
        .sort((a, b) => a.idea_id.localeCompare(b.idea_id));
      return rows;
    }
    throw new Error(`unexpected all() SQL: ${sql}`);
  };

  const run = async (sql: string, params: unknown[] = []) => {
    const s = sql.trim();

    if (/^BEGIN/i.test(s)) {
      inTx = true;
      txBackup = snapshot();
      return { changes: 0 };
    }
    if (/^COMMIT/i.test(s)) {
      inTx = false;
      txBackup = null;
      return { changes: 0 };
    }
    if (/^ROLLBACK/i.test(s)) {
      if (txBackup) restore(txBackup);
      inTx = false;
      txBackup = null;
      return { changes: 0 };
    }

    if (/UPDATE my_idea_maps SET is_canonical = FALSE WHERE id = \?/i.test(s)) {
      const [id] = params as [string];
      const row = store.maps.find((m) => m.id === id);
      if (row) row.is_canonical = false;
      return { changes: row ? 1 : 0 };
    }

    if (/INSERT INTO my_idea_map_snapshots/i.test(s)) {
      const [id, idea_id, user_id, organization_id, label, node_count, edge_count, data_json] =
        params as [string, string, string, string, string, number, number, string];
      if (opts.failIdeaId && idea_id === opts.failIdeaId) {
        throw new Error(`injected failure for idea ${idea_id}`);
      }
      store.snapshots.push({
        id,
        idea_id,
        user_id,
        organization_id,
        label,
        node_count,
        edge_count,
        data_json,
      });
      return { changes: 1 };
    }

    if (/UPDATE my_idea_maps\s+SET is_canonical = TRUE/i.test(s)) {
      const withArchived = /archived_from_user_id = \?/i.test(s);
      let last_editor: string, archived: string | null, version: number, id: string;
      if (withArchived) {
        [last_editor, archived, version, id] = params as [string, string, number, string];
      } else {
        [last_editor, version, id] = params as [string, number, string];
        archived = null;
      }
      const row = store.maps.find((m) => m.id === id);
      if (row) {
        row.is_canonical = true;
        row.last_editor_user_id = last_editor;
        if (withArchived) row.archived_from_user_id = archived;
        row.version = version;
      }
      return { changes: row ? 1 : 0 };
    }

    throw new Error(`unexpected run() SQL: ${sql}`);
  };

  const db = {
    all: all as unknown,
    run: run as unknown,
    get: (async () => null) as unknown,
    query: (async () => ({ rows: [], rowCount: 0 })) as unknown,
  } as unknown as IDatabase;

  return { db, store };
}

// ── Fixtures ────────────────────────────────────────────────────────────────────

const ORG = 'org-1';

function mapRow(over: Partial<MapRowStore>): MapRowStore {
  return {
    id: `map-${Math.random().toString(36).slice(2)}`,
    idea_id: 'idea-1',
    user_id: 'user-x',
    organization_id: ORG,
    nodes_json: '[]',
    edges_json: '[]',
    extensions_json: '{}',
    version: 1,
    updated_at: '2026-01-01T00:00:00.000Z',
    is_canonical: true, // legacy default: every per-user row is canonical
    last_editor_user_id: null,
    archived_from_user_id: null,
    ...over,
  };
}

const helpers = {
  hasColumn: async (_t: string, c: string) => c === 'is_canonical' || c === 'extensions_json',
  isPostgres: true,
};

const helpersNoCanonical = {
  hasColumn: async () => false,
  isPostgres: true,
};

// ── Tests: pure planning ─────────────────────────────────────────────────────────

describe('DP-3 T2 — planIdea (pure)', () => {
  it('3 copies, owner present → owner canonical, other two snapshotted, version+1', () => {
    const group: IdeaGroup = {
      ideaId: 'idea-1',
      organizationId: ORG,
      ownerUserId: 'owner',
      rows: [
        { id: 'm-owner', idea_id: 'idea-1', user_id: 'owner', organization_id: ORG, nodes_json: '[{"id":"n1"}]', edges_json: '[]', version: 4, updated_at: '2026-01-01', is_canonical: true } as MapRow,
        { id: 'm-a', idea_id: 'idea-1', user_id: 'alice', organization_id: ORG, nodes_json: '[{"id":"n1"},{"id":"n2"}]', edges_json: '[{"id":"e1"}]', version: 2, updated_at: '2026-02-01', is_canonical: true } as MapRow,
        { id: 'm-b', idea_id: 'idea-1', user_id: 'bob', organization_id: ORG, nodes_json: '[]', edges_json: '[]', version: 1, updated_at: '2026-03-01', is_canonical: true } as MapRow,
      ],
    };

    const action = planIdea(group);
    expect(action.kind).toBe('migrate');
    if (action.kind !== 'migrate') return;
    expect(action.canonicalRowId).toBe('m-owner');
    expect(action.canonicalUserId).toBe('owner');
    expect(action.promotedOwner).toBe(true);
    expect(action.newVersion).toBe(5); // 4 + 1
    expect(action.snapshots.map((s) => s.rowId).sort()).toEqual(['m-a', 'm-b']);
    const alice = action.snapshots.find((s) => s.userId === 'alice')!;
    expect(alice.nodeCount).toBe(2);
    expect(alice.edgeCount).toBe(1);
  });

  it('owner has NO copy → freshest (updated_at DESC) promoted, non-owner', () => {
    const group: IdeaGroup = {
      ideaId: 'idea-2',
      organizationId: ORG,
      ownerUserId: 'owner-without-copy',
      rows: [
        { id: 'm-old', idea_id: 'idea-2', user_id: 'alice', organization_id: ORG, nodes_json: '[]', edges_json: '[]', version: 9, updated_at: '2026-01-01', is_canonical: true } as MapRow,
        { id: 'm-new', idea_id: 'idea-2', user_id: 'bob', organization_id: ORG, nodes_json: '[]', edges_json: '[]', version: 1, updated_at: '2026-05-01', is_canonical: true } as MapRow,
      ],
    };

    const action = planIdea(group);
    expect(action.kind).toBe('migrate');
    if (action.kind !== 'migrate') return;
    expect(action.canonicalRowId).toBe('m-new'); // newest updated_at wins over higher version
    expect(action.promotedOwner).toBe(false);
    expect(action.newVersion).toBe(2);
  });

  it('owner has NO copy, equal updated_at → higher version wins (tie-break)', () => {
    const group: IdeaGroup = {
      ideaId: 'idea-3',
      organizationId: ORG,
      ownerUserId: 'ghost',
      rows: [
        { id: 'm-lo', idea_id: 'idea-3', user_id: 'alice', organization_id: ORG, nodes_json: '[]', edges_json: '[]', version: 2, updated_at: '2026-04-01', is_canonical: true } as MapRow,
        { id: 'm-hi', idea_id: 'idea-3', user_id: 'bob', organization_id: ORG, nodes_json: '[]', edges_json: '[]', version: 7, updated_at: '2026-04-01', is_canonical: true } as MapRow,
      ],
    };
    const action = planIdea(group);
    if (action.kind !== 'migrate') throw new Error('expected migrate');
    expect(action.canonicalRowId).toBe('m-hi');
  });

  it('exactly one canonical row already → skip (idempotent)', () => {
    const group: IdeaGroup = {
      ideaId: 'idea-done',
      organizationId: ORG,
      ownerUserId: 'owner',
      rows: [
        { id: 'm1', idea_id: 'idea-done', user_id: 'owner', organization_id: ORG, nodes_json: '[]', edges_json: '[]', version: 5, updated_at: '2026-01-01', is_canonical: true } as MapRow,
        { id: 'm2', idea_id: 'idea-done', user_id: 'alice', organization_id: ORG, nodes_json: '[]', edges_json: '[]', version: 1, updated_at: '2026-01-01', is_canonical: false } as MapRow,
      ],
    };
    expect(planIdea(group).kind).toBe('skip-already-canonical');
  });

  it('no rows → skip-no-rows', () => {
    const group: IdeaGroup = { ideaId: 'x', organizationId: ORG, ownerUserId: null, rows: [] };
    expect(planIdea(group).kind).toBe('skip-no-rows');
  });
});

describe('DP-3 T2 — helpers', () => {
  it('coerceVersion handles number, bigint-string, junk', () => {
    expect(coerceVersion(3)).toBe(3);
    expect(coerceVersion('7')).toBe(7);
    expect(coerceVersion(null)).toBe(1);
    expect(coerceVersion('abc')).toBe(1);
  });

  it('isCanonicalFlag across driver representations', () => {
    expect(isCanonicalFlag(true)).toBe(true);
    expect(isCanonicalFlag('t')).toBe(true);
    expect(isCanonicalFlag(1)).toBe(true);
    expect(isCanonicalFlag('true')).toBe(true);
    expect(isCanonicalFlag(false)).toBe(false);
    expect(isCanonicalFlag('f')).toBe(false);
    expect(isCanonicalFlag(0)).toBe(false);
    expect(isCanonicalFlag(null)).toBe(false);
  });

  it('buildSnapshotDataJson produces {nodes,edges,extensions}', () => {
    const row = {
      nodes_json: '[{"id":"n1"}]',
      edges_json: '[{"id":"e1"}]',
      extensions_json: '{"table":{"x":1}}',
    } as unknown as MapRow;
    const parsed = JSON.parse(buildSnapshotDataJson(row));
    expect(parsed.nodes).toHaveLength(1);
    expect(parsed.edges).toHaveLength(1);
    expect(parsed.extensions).toEqual({ table: { x: 1 } });
  });

  it('buildSnapshotDataJson tolerates already-parsed JSONB objects', () => {
    const row = {
      nodes_json: [{ id: 'n1' }, { id: 'n2' }],
      edges_json: [],
      extensions_json: { note: 'obj' },
    } as unknown as MapRow;
    const parsed = JSON.parse(buildSnapshotDataJson(row));
    expect(parsed.nodes).toHaveLength(2);
    expect(parsed.extensions).toEqual({ note: 'obj' });
  });
});

// ── Tests: end-to-end runMigration against in-memory DB ──────────────────────────

describe('DP-3 T2 — runMigration (in-memory)', () => {
  it('empty DB → no-op', async () => {
    const { db } = makeDb({ maps: [], ideas: [], snapshots: [] });
    const report = await runMigration(db, { dryRun: false }, helpers);
    expect(report).toMatchObject({
      ideasScanned: 0,
      ideasMigrated: 0,
      snapshotsCreated: 0,
      errors: [],
    });
  });

  it('missing is_canonical column → throws (T1 not run)', async () => {
    const { db } = makeDb({ maps: [], ideas: [], snapshots: [] });
    await expect(runMigration(db, { dryRun: false }, helpersNoCanonical)).rejects.toThrow(
      /is_canonical column missing/
    );
  });

  it('dry-run (default) writes nothing but reports the plan', async () => {
    const store: Store = {
      ideas: [{ id: 'idea-1', user_id: 'owner', organization_id: ORG }],
      maps: [
        mapRow({ id: 'm-owner', user_id: 'owner', version: 3 }),
        mapRow({ id: 'm-alice', user_id: 'alice', updated_at: '2026-02-01T00:00:00.000Z' }),
        mapRow({ id: 'm-bob', user_id: 'bob', updated_at: '2026-03-01T00:00:00.000Z' }),
      ],
      snapshots: [],
    };
    const { db } = makeDb(store);

    const report = await runMigration(db, { dryRun: true }, helpers);
    expect(report.ideasMigrated).toBe(1);
    expect(report.snapshotsCreated).toBe(2);
    // Nothing actually written:
    expect(store.snapshots).toHaveLength(0);
    expect(store.maps.every((m) => m.is_canonical)).toBe(true); // untouched
  });

  it('3 copies → 1 canonical (owner) + 2 snapshots + 2 demoted; version bumped', async () => {
    const store: Store = {
      ideas: [{ id: 'idea-1', user_id: 'owner', organization_id: ORG }],
      maps: [
        mapRow({ id: 'm-owner', user_id: 'owner', version: 3, nodes_json: '[{"id":"n1"}]' }),
        mapRow({ id: 'm-alice', user_id: 'alice', nodes_json: '[{"id":"n1"},{"id":"n2"}]', edges_json: '[{"id":"e1"}]', updated_at: '2026-02-01T00:00:00.000Z' }),
        mapRow({ id: 'm-bob', user_id: 'bob', updated_at: '2026-03-01T00:00:00.000Z' }),
      ],
      snapshots: [],
    };
    const { db } = makeDb(store);

    const report = await runMigration(db, { dryRun: false }, helpers);

    expect(report.errors).toEqual([]);
    expect(report.ideasMigrated).toBe(1);
    expect(report.snapshotsCreated).toBe(2);
    expect(report.rowsDemoted).toBe(2);

    // Exactly one canonical row, and it's the owner's.
    const canonical = store.maps.filter((m) => m.is_canonical);
    expect(canonical).toHaveLength(1);
    expect(canonical[0].id).toBe('m-owner');
    expect(canonical[0].last_editor_user_id).toBe('owner');
    expect(canonical[0].archived_from_user_id).toBeNull(); // owner promotion
    expect(canonical[0].version).toBe(4); // 3 + 1

    // Two snapshots with the pre-merge label.
    expect(store.snapshots).toHaveLength(2);
    const labels = store.snapshots.map((s) => s.label).sort();
    expect(labels).toEqual([
      'DP-3 pre-merge (autor: alice)',
      'DP-3 pre-merge (autor: bob)',
    ]);
    const aliceSnap = store.snapshots.find((s) => s.user_id === 'alice')!;
    expect(aliceSnap.node_count).toBe(2);
    expect(aliceSnap.edge_count).toBe(1);
    const aliceData = JSON.parse(aliceSnap.data_json);
    expect(aliceData.nodes).toHaveLength(2);
    expect(aliceData).toHaveProperty('extensions');
  });

  it('owner without a copy → freshest promoted, archived_from_user_id stamped', async () => {
    const store: Store = {
      ideas: [{ id: 'idea-2', user_id: 'owner-no-copy', organization_id: ORG }],
      maps: [
        mapRow({ id: 'm-old', idea_id: 'idea-2', user_id: 'alice', version: 9, updated_at: '2026-01-01T00:00:00.000Z' }),
        mapRow({ id: 'm-new', idea_id: 'idea-2', user_id: 'bob', version: 1, updated_at: '2026-06-01T00:00:00.000Z' }),
      ],
      snapshots: [],
    };
    const { db } = makeDb(store);

    const report = await runMigration(db, { dryRun: false }, helpers);
    expect(report.errors).toEqual([]);

    const canonical = store.maps.filter((m) => m.is_canonical);
    expect(canonical).toHaveLength(1);
    expect(canonical[0].id).toBe('m-new'); // freshest
    expect(canonical[0].last_editor_user_id).toBe('bob');
    expect(canonical[0].archived_from_user_id).toBe('bob'); // non-owner promotion
    expect(store.snapshots).toHaveLength(1);
    expect(store.snapshots[0].user_id).toBe('alice');
  });

  it('idempotency: second run is a no-op (same state)', async () => {
    const store: Store = {
      ideas: [{ id: 'idea-1', user_id: 'owner', organization_id: ORG }],
      maps: [
        mapRow({ id: 'm-owner', user_id: 'owner', version: 3 }),
        mapRow({ id: 'm-alice', user_id: 'alice', updated_at: '2026-02-01T00:00:00.000Z' }),
        mapRow({ id: 'm-bob', user_id: 'bob', updated_at: '2026-03-01T00:00:00.000Z' }),
      ],
      snapshots: [],
    };
    const { db } = makeDb(store);

    const first = await runMigration(db, { dryRun: false }, helpers);
    expect(first.ideasMigrated).toBe(1);
    const stateAfterFirst = JSON.stringify(store);

    const second = await runMigration(db, { dryRun: false }, helpers);
    expect(second.ideasMigrated).toBe(0);
    expect(second.ideasSkippedAlreadyCanonical).toBe(1);
    expect(second.snapshotsCreated).toBe(0);
    // State byte-for-byte identical: no new snapshots, no version re-bump.
    expect(JSON.stringify(store)).toBe(stateAfterFirst);
    expect(store.snapshots).toHaveLength(2); // not 4
    expect(store.maps.find((m) => m.id === 'm-owner')!.version).toBe(4); // not 5
  });

  it('per-idea error isolation: one idea fails, the rest still migrate + rollback', async () => {
    const store: Store = {
      ideas: [
        { id: 'idea-ok', user_id: 'owner-ok', organization_id: ORG },
        { id: 'idea-bad', user_id: 'owner-bad', organization_id: ORG },
      ],
      maps: [
        mapRow({ id: 'ok-owner', idea_id: 'idea-ok', user_id: 'owner-ok', version: 2 }),
        mapRow({ id: 'ok-alice', idea_id: 'idea-ok', user_id: 'alice', updated_at: '2026-02-01T00:00:00.000Z' }),
        mapRow({ id: 'bad-owner', idea_id: 'idea-bad', user_id: 'owner-bad', version: 2 }),
        mapRow({ id: 'bad-carol', idea_id: 'idea-bad', user_id: 'carol', updated_at: '2026-02-01T00:00:00.000Z' }),
      ],
      snapshots: [],
    };
    const { db } = makeDb(store, { failIdeaId: 'idea-bad' });

    const report = await runMigration(db, { dryRun: false }, helpers);

    expect(report.ideasMigrated).toBe(1); // only idea-ok
    expect(report.errors).toHaveLength(1);
    expect(report.errors[0].ideaId).toBe('idea-bad');

    // idea-ok fully migrated:
    const okCanonical = store.maps.filter((m) => m.idea_id === 'idea-ok' && m.is_canonical);
    expect(okCanonical).toHaveLength(1);
    expect(okCanonical[0].id).toBe('ok-owner');

    // idea-bad rolled back: both rows still canonical (legacy state), no snapshot.
    const badRows = store.maps.filter((m) => m.idea_id === 'idea-bad');
    expect(badRows.every((m) => m.is_canonical)).toBe(true);
    expect(store.snapshots.filter((s) => s.idea_id === 'idea-bad')).toHaveLength(0);
  });

  it('org filter restricts the migration to one organization', async () => {
    const store: Store = {
      ideas: [
        { id: 'idea-a', user_id: 'oa', organization_id: 'org-a' },
        { id: 'idea-b', user_id: 'ob', organization_id: 'org-b' },
      ],
      maps: [
        mapRow({ id: 'a1', idea_id: 'idea-a', organization_id: 'org-a', user_id: 'oa' }),
        mapRow({ id: 'a2', idea_id: 'idea-a', organization_id: 'org-a', user_id: 'ux', updated_at: '2026-02-01T00:00:00.000Z' }),
        mapRow({ id: 'b1', idea_id: 'idea-b', organization_id: 'org-b', user_id: 'ob' }),
        mapRow({ id: 'b2', idea_id: 'idea-b', organization_id: 'org-b', user_id: 'uy', updated_at: '2026-02-01T00:00:00.000Z' }),
      ],
      snapshots: [],
    };
    const { db } = makeDb(store);

    const report = await runMigration(db, { dryRun: false, orgId: 'org-a' }, helpers);
    expect(report.ideasScanned).toBe(1);
    expect(report.ideasMigrated).toBe(1);
    // org-b untouched: still two canonical rows.
    expect(store.maps.filter((m) => m.idea_id === 'idea-b' && m.is_canonical)).toHaveLength(2);
  });
});
