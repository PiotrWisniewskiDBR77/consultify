/** @vitest-environment node */
import { randomUUID } from 'node:crypto';

import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { IDatabase } from '../../server/src/database/IDatabase.js';
import {
  acquireDurableIdeaNodeLock,
  applyGraphPatchToCanonical,
  listDurableIdeaNodeLocks,
  releaseDurableIdeaNodeLock,
} from '../../server/src/realtime/ideaMapAccess.js';
import {
  GovernedIdeaStageEnum,
  IdeaMaturityAttestationSchema,
} from '../../server/src/validators/ideaWorkspaceGraph.validators.js';

const connectionString = process.env.DATABASE_URL || '';
const enabled = process.env.RUN_DB_TESTS === '1' && process.env.MOCK_DB === 'false' && /^postgres/.test(connectionString);
const prefix = `idea-ws-${randomUUID().slice(0, 8)}`;
const orgA = `${prefix}-org-a`;
const orgB = `${prefix}-org-b`;
const userA = `${prefix}-user-a`;
const userB = `${prefix}-user-b`;
const ideaA = `${prefix}-idea-a`;
const mapA = `${prefix}-map-a`;

function translate(sql: string): string {
  let index = 0;
  return sql.replace(/\?/g, () => `$${++index}`);
}

function poolDatabase(pool: Pool): IDatabase {
  return {
    get: (async (sql: string, params: unknown[] = []) => {
      const result = await pool.query(translate(sql), params);
      return result.rows[0] ?? null;
    }) as IDatabase['get'],
    all: (async (sql: string, params: unknown[] = []) => {
      const result = await pool.query(translate(sql), params);
      return result.rows;
    }) as IDatabase['all'],
    run: (async (sql: string, params: unknown[] = []) => {
      const result = await pool.query(translate(sql), params);
      return { changes: result.rowCount ?? 0 };
    }) as IDatabase['run'],
    exec: (async (sql: string) => { await pool.query(sql); }) as IDatabase['exec'],
    query: (async <T>(sql: string, params: unknown[] = []) => {
      const result = await pool.query<T>(translate(sql), params);
      return { rows: result.rows, rowCount: result.rowCount ?? 0 };
    }) as IDatabase['query'],
    serialize: (callback: () => void) => callback(),
    close: async () => undefined,
  };
}

describe.skipIf(!enabled)('IDEA-WORKSPACE-SUBPACKET durable collaboration (real PostgreSQL)', () => {
  let pool: Pool;
  let db: IDatabase;

  beforeAll(async () => {
    pool = new Pool({ connectionString, max: 12 });
    db = poolDatabase(pool);
    const database = await pool.query<{ current_database: string }>('SELECT current_database()');
    expect(database.rows[0]?.current_database).toMatch(/^idea_workspace_/);
    await pool.query('SELECT pg_advisory_lock(hashtext($1))', ['idea-workspace-subpacket-fixtures']);
    await pool.query(
      `INSERT INTO organizations(id,name,plan,status,is_active,created_at)
       VALUES ($1,$1,'enterprise','active',1,NOW()),($2,$2,'enterprise','active',1,NOW())`,
      [orgA, orgB]
    );
    await pool.query(
      `INSERT INTO users(id,organization_id,email,role,status)
       VALUES ($1,$3,$1 || '@example.test','ADMIN','active'),
              ($2,$4,$2 || '@example.test','ADMIN','active')`,
      [userA, userB, orgA, orgB]
    );
    await pool.query(
      `INSERT INTO organization_members(id,organization_id,user_id,role,status,created_at)
       VALUES ($1,$2,$3,'OWNER','ACTIVE',NOW())`,
      [`${prefix}-member-a`, orgA, userA]
    );
    await pool.query(
      `INSERT INTO my_ideas(id,user_id,organization_id,title,stage,created_at,updated_at)
       VALUES ($1,$2,$3,'Durable collaboration','spark',NOW(),NOW())`,
      [ideaA, userA, orgA]
    );
    await pool.query(
      `INSERT INTO my_idea_maps
         (id,idea_id,user_id,organization_id,nodes_json,edges_json,version,is_canonical,created_at,updated_at)
       VALUES ($1,$2,$3,$4,'[]','[]',1,TRUE,NOW(),NOW())`,
      [mapA, ideaA, userA, orgA]
    );
  }, 30_000);

  afterAll(async () => {
    if (!pool) return;
    try {
      await pool.query('DELETE FROM idea_workspace_node_locks WHERE organization_id = $1', [orgA]);
      await pool.query('ALTER TABLE idea_workspace_lock_events DISABLE TRIGGER trg_idea_workspace_lock_events_append_only');
      try {
        await pool.query('DELETE FROM idea_workspace_lock_events WHERE organization_id = $1', [orgA]);
      } finally {
        await pool.query('ALTER TABLE idea_workspace_lock_events ENABLE TRIGGER trg_idea_workspace_lock_events_append_only');
      }
      await pool.query('DELETE FROM my_idea_maps WHERE id = $1', [mapA]);
      await pool.query('DELETE FROM my_ideas WHERE id = $1', [ideaA]);
      await pool.query('DELETE FROM organization_members WHERE id = $1', [`${prefix}-member-a`]);
      await pool.query('DELETE FROM users WHERE id = ANY($1)', [[userA, userB]]);
      await pool.query('DELETE FROM organizations WHERE id = ANY($1)', [[orgA, orgB]]);
      const residue = await pool.query<{ n: number }>(
        `SELECT
          (SELECT count(*) FROM idea_workspace_node_locks WHERE organization_id = $1) +
          (SELECT count(*) FROM idea_workspace_lock_events WHERE organization_id = $1) +
          (SELECT count(*) FROM my_ideas WHERE id = $2) AS n`,
        [orgA, ideaA]
      );
      expect(Number(residue.rows[0]?.n || 0)).toBe(0);
    } finally {
      await pool.query('SELECT pg_advisory_unlock(hashtext($1))', ['idea-workspace-subpacket-fixtures']);
      await pool.end();
    }
  });

  it('acquires exactly one tenant-scoped lease, reclaims after expiry and fences the old owner', async () => {
    const first = await acquireDurableIdeaNodeLock(db, {
      organizationId: orgA, ideaId: ideaA, nodeId: 'node-1', userId: userA,
      leaseOwner: 'worker-old', correlationId: `${prefix}-acquire`, ttlSeconds: 30,
    });
    expect(first?.fencingToken).toBeGreaterThan(0);
    const denied = await acquireDurableIdeaNodeLock(db, {
      organizationId: orgA, ideaId: ideaA, nodeId: 'node-1', userId: userB,
      leaseOwner: 'worker-new', correlationId: `${prefix}-denied`, ttlSeconds: 30,
    });
    expect(denied).toBeNull();
    await pool.query(
      `UPDATE idea_workspace_node_locks
       SET acquired_at = NOW() - INTERVAL '60 seconds',
           expires_at = NOW() - INTERVAL '30 seconds'
       WHERE organization_id=$1 AND idea_id=$2 AND node_id='node-1'`,
      [orgA, ideaA]
    );
    const reclaimed = await acquireDurableIdeaNodeLock(db, {
      organizationId: orgA, ideaId: ideaA, nodeId: 'node-1', userId: userB,
      leaseOwner: 'worker-new', correlationId: `${prefix}-reclaim`, ttlSeconds: 30,
    });
    expect(reclaimed!.fencingToken).toBe(first!.fencingToken + 1);
    await expect(releaseDurableIdeaNodeLock(db, {
      organizationId: orgA, ideaId: ideaA, nodeId: 'node-1', userId: userA,
      leaseOwner: 'worker-old', fencingToken: first!.fencingToken, correlationId: `${prefix}-old-release`,
    })).resolves.toBe(false);
    await expect(releaseDurableIdeaNodeLock(db, {
      organizationId: orgA, ideaId: ideaA, nodeId: 'node-1', userId: userB,
      leaseOwner: 'worker-new', fencingToken: reclaimed!.fencingToken, correlationId: `${prefix}-release`,
    })).resolves.toBe(true);
  });

  it('rejects tenant collisions and keeps lock audit append-only', async () => {
    await expect(acquireDurableIdeaNodeLock(db, {
      organizationId: orgB, ideaId: ideaA, nodeId: 'tenant-leak', userId: userB,
      leaseOwner: 'foreign', correlationId: `${prefix}-foreign`, ttlSeconds: 30,
    })).rejects.toThrow();
    await expect(pool.query(
      `UPDATE idea_workspace_lock_events SET event_type='RELEASED' WHERE organization_id=$1`,
      [orgA]
    )).rejects.toMatchObject({ code: 'P0001' });
  });

  it('serializes 8 concurrent writers in PostgreSQL with no lost graph patches', async () => {
    const results = await Promise.all(
      Array.from({ length: 8 }, (_, index) => applyGraphPatchToCanonical(
        db, ideaA, orgA, userA, [{ op: 'add_node', data: { id: `concurrent-${index}` } }]
      ))
    );
    expect(results.map((result) => result.version).sort((a, b) => a - b)).toEqual([2,3,4,5,6,7,8,9]);
    const cold = new Pool({ connectionString, max: 1 });
    try {
      const row = await cold.query<{ version: number; nodes_json: string }>(
        'SELECT version,nodes_json FROM my_idea_maps WHERE id=$1', [mapA]
      );
      expect(row.rows[0]?.version).toBe(9);
      const ids = JSON.parse(row.rows[0]!.nodes_json).map((node: any) => node.id).sort();
      expect(ids).toEqual(Array.from({ length: 8 }, (_, index) => `concurrent-${index}`).sort());
    } finally {
      await cold.end();
    }
  });

  it('blocks a graph write protected by another live durable lease', async () => {
    const lock = await acquireDurableIdeaNodeLock(db, {
      organizationId: orgA, ideaId: ideaA, nodeId: 'concurrent-0', userId: userA,
      leaseOwner: 'lease-current', correlationId: `${prefix}-fence`, ttlSeconds: 30,
    });
    await expect(applyGraphPatchToCanonical(
      db, ideaA, orgA, userB,
      [{ op: 'update_node', data: { id: 'concurrent-0', label: 'stale overwrite' } }],
      { nodeId: 'concurrent-0', leaseOwner: 'lease-old', fencingToken: lock!.fencingToken - 1 }
    )).rejects.toThrow('IDEA_NODE_LOCK_FENCE_REJECTED');
    await releaseDurableIdeaNodeLock(db, {
      organizationId: orgA, ideaId: ideaA, nodeId: 'concurrent-0', userId: userA,
      leaseOwner: 'lease-current', fencingToken: lock!.fencingToken, correlationId: `${prefix}-fence-release`,
    });
  });

  it('validates governed wire shapes without inventing maturity thresholds', () => {
    expect(GovernedIdeaStageEnum.safeParse('ready_to_convert').success).toBe(true);
    expect(GovernedIdeaStageEnum.safeParse('owner-invented-stage').success).toBe(false);
    expect(IdeaMaturityAttestationSchema.safeParse({ criterionId: 'economics.initial', met: true }).success).toBe(true);
    expect(IdeaMaturityAttestationSchema.safeParse({ criterionId: '../unsafe', met: 'yes' }).success).toBe(false);
  });
});
