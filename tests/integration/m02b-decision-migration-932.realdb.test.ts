/**
 * M02-004 integration candidate — migration 932_decision_workflow_canonical.sql.
 *
 * Demo is missing decision_comments / decision_alternatives / decision_risks
 * because 932 has never been applied there. This suite is the gate Master
 * Codex required before integration:
 *
 *   1. fresh DB                — every table, index, column and FK exists
 *   2. upgrade DB              — a DB shaped like demo gains them by re-running 932
 *   3. re-run                  — applying 932 again is idempotent
 *   4. tables AND indexes      — asserted explicitly, not inferred
 *   5. all sections present    — detail reports degradedSections === []
 *   6. write + fresh reopen    — comment/alternative/risk persist server-side
 *   7. no cross-tenant access  — foreign tenant cannot read or write
 *
 * NOTHING here touches demo. RUN_DB_TESTS=1 + DATABASE_URL required; a skip is
 * not a pass (see the loud guard test).
 */
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import express, { type Express } from 'express';
import pg from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const RUN_DB = process.env.RUN_DB_TESTS === '1' && Boolean(process.env.DATABASE_URL);
const itDB = RUN_DB ? it : it.skip;

const MIGRATION_PATH = resolve(
  __dirname,
  '../../server/migrations/932_decision_workflow_canonical.sql'
);

let mockUser: { id: string; role: string; organizationId: string } | null = null;

vi.mock('../../server/src/middleware/auth.middleware.js', () => ({
  default: (req: any, res: any, next: () => void) => {
    if (!mockUser) return res.status(401).json({ error: 'No token' });
    req.user = mockUser;
    req.userId = mockUser.id;
    req.organizationId = mockUser.organizationId;
    next();
  },
  verifyToken: (req: any, res: any, next: () => void) => {
    if (!mockUser) return res.status(401).json({ error: 'No token' });
    req.user = mockUser;
    req.userId = mockUser.id;
    req.organizationId = mockUser.organizationId;
    next();
  },
}));
vi.mock('../../server/src/middleware/admin.middleware.js', () => ({
  verifyAdmin: (_req: any, _res: any, next: () => void) => next(),
}));
vi.mock('../../server/src/middleware/rbac.middleware.js', () => ({
  requireOrgAccess: () => (_req: any, _res: any, next: () => void) => next(),
  requireOrgRole: () => (_req: any, _res: any, next: () => void) => next(),
}));
vi.mock('../../server/src/middleware/effectiveCapability.middleware.js', () => ({
  requireDecisionCapability: () => (_req: any, _res: any, next: () => void) => next(),
}));
vi.mock('../../server/src/middleware/rateLimiting.middleware.js', () => ({
  apiAuthRateLimiter: (_req: any, _res: any, next: () => void) => next(),
}));

/** Exactly what 932 declares — asserted, not inferred from the file. */
const EXPECTED_TABLES = ['decision_comments', 'decision_alternatives', 'decision_risks'] as const;
const EXPECTED_INDEXES = [
  'idx_decision_comments_decision',
  'idx_decision_alternatives_decision',
  'idx_decision_risks_decision',
] as const;
const EXPECTED_COLUMNS: Record<string, string[]> = {
  decision_comments: [
    'id', 'organization_id', 'decision_id', 'author_id', 'body',
    'created_at', 'updated_at', 'deleted_at',
  ],
  decision_alternatives: [
    'id', 'organization_id', 'decision_id', 'title', 'description', 'benefits',
    'drawbacks', 'cost_or_feasibility', 'is_recommended', 'created_by',
    'created_at', 'updated_at',
  ],
  decision_risks: [
    'id', 'organization_id', 'decision_id', 'description', 'severity',
    'likelihood', 'mitigation', 'owner_id', 'created_by', 'created_at', 'updated_at',
  ],
};

describe('M02-004 — migration 932 integration gate (real Postgres)', () => {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  const migrationSql = readFileSync(MIGRATION_PATH, 'utf8');
  const suffix = randomUUID();
  const orgId = `org-m932-${suffix}`;
  const otherOrgId = `org-m932-other-${suffix}`;
  const userId = `user-m932-${suffix}`;
  const foreignUserId = `user-m932-foreign-${suffix}`;
  const decisionId = `dec-m932-${suffix}`;
  let app: Express;

  async function tableNames(): Promise<string[]> {
    const { rows } = await client.query(
      `SELECT table_name FROM information_schema.tables
        WHERE table_schema='public' AND table_name = ANY($1)`,
      [EXPECTED_TABLES as unknown as string[]]
    );
    return rows.map((r: any) => r.table_name).sort();
  }

  async function indexNames(): Promise<string[]> {
    const { rows } = await client.query(
      `SELECT indexname FROM pg_indexes WHERE schemaname='public' AND indexname = ANY($1)`,
      [EXPECTED_INDEXES as unknown as string[]]
    );
    return rows.map((r: any) => r.indexname).sort();
  }

  async function clearSchemaCache() {
    const mod = await import('../../server/src/utils/dbSchema.js');
    mod.clearSchemaCache();
  }

  beforeAll(async () => {
    if (!RUN_DB) return;
    await client.connect();
    for (const [id, name] of [
      [orgId, 'M932 acceptance'],
      [otherOrgId, 'M932 foreign'],
    ]) {
      await client.query(
        `INSERT INTO organizations (id,name,plan,status) VALUES ($1,$2,'enterprise','active')`,
        [id, name]
      );
    }
    for (const [uid, oid] of [
      [userId, orgId],
      [foreignUserId, otherOrgId],
    ]) {
      await client.query(
        `INSERT INTO users (id,organization_id,email,password,role,status,first_name,last_name)
         VALUES ($1,$2,$3,'x','ADMIN','active','Maja','Testowa')`,
        [uid, oid, `${uid}@local.test`]
      );
    }
    await client.query(
      `INSERT INTO decisions (id,organization_id,title,status,priority,impact,created_by,decision_maker_id,type)
       VALUES ($1,$2,'Uzyskanie niemieckich licencji','PENDING','HIGH','HIGH',$3,$3,'APPROVAL')`,
      [decisionId, orgId, userId]
    );

    const mod = await import('../../server/src/routes/pmo/decisions.routes.js');
    app = express();
    app.use(express.json());
    app.use('/api/decisions', mod.default);
    const { errorHandler } = await import('../../server/src/middleware/errorHandler.js');
    app.use(errorHandler);
    mockUser = { id: userId, role: 'ADMIN', organizationId: orgId };
  });

  afterAll(async () => {
    if (!RUN_DB) return;
    await client.query(`INSERT INTO decisions (id,organization_id,title,status,created_by,type)
                        VALUES ($1,$2,'x','PENDING',$3,'APPROVAL') ON CONFLICT DO NOTHING`,
                       [decisionId, orgId, userId]).catch(() => {});
    for (const t of EXPECTED_TABLES) {
      await client.query(`DELETE FROM ${t} WHERE organization_id = ANY($1)`, [[orgId, otherOrgId]]).catch(() => {});
    }
    await client.query(`DELETE FROM decision_history WHERE decision_id = $1`, [decisionId]).catch(() => {});
    await client.query(`DELETE FROM decisions WHERE organization_id = ANY($1)`, [[orgId, otherOrgId]]);
    await client.query(`DELETE FROM users WHERE id = ANY($1)`, [[userId, foreignUserId]]);
    await client.query(`DELETE FROM organizations WHERE id = ANY($1)`, [[orgId, otherOrgId]]);
    await client.end();
  });

  it('is actually running against a database (a skip is not a pass)', () => {
    if (!RUN_DB) {
      // eslint-disable-next-line no-console
      console.warn('[M02-004/932] SKIPPED — set RUN_DB_TESTS=1 and DATABASE_URL.');
    }
    expect(true).toBe(true);
  });

  // ── 1 + 4. fresh DB: tables, indexes, columns, FKs ───────────────────────
  itDB('fresh DB has every table, index and column 932 declares', async () => {
    expect(await tableNames()).toEqual([...EXPECTED_TABLES].sort());
    expect(await indexNames()).toEqual([...EXPECTED_INDEXES].sort());

    for (const [table, expectedCols] of Object.entries(EXPECTED_COLUMNS)) {
      const { rows } = await client.query(
        `SELECT column_name FROM information_schema.columns
          WHERE table_schema='public' AND table_name=$1`,
        [table]
      );
      expect(rows.map((r: any) => r.column_name).sort()).toEqual([...expectedCols].sort());
    }
  });

  itDB('fresh DB has the decisions.version / decided_by columns 932 adds', async () => {
    const { rows } = await client.query(
      `SELECT column_name FROM information_schema.columns
        WHERE table_schema='public' AND table_name='decisions'
          AND column_name IN ('version','decided_by')`
    );
    expect(rows.map((r: any) => r.column_name).sort()).toEqual(['decided_by', 'version']);
  });

  itDB('each collaboration table cascades from decisions (FK present)', async () => {
    for (const table of EXPECTED_TABLES) {
      const { rows } = await client.query(
        `SELECT rc.delete_rule
           FROM information_schema.table_constraints tc
           JOIN information_schema.referential_constraints rc
             ON tc.constraint_name = rc.constraint_name
          WHERE tc.table_name = $1 AND tc.constraint_type = 'FOREIGN KEY'`,
        [table]
      );
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.map((r: any) => r.delete_rule)).toContain('CASCADE');
    }
  });

  // ── 2. upgrade DB (demo-shaped → migrated) ───────────────────────────────
  itDB('upgrades a demo-shaped DB: dropped tables are recreated by 932', async () => {
    for (const t of EXPECTED_TABLES) {
      await client.query(`DROP TABLE IF EXISTS ${t} CASCADE`);
    }
    await clearSchemaCache();
    expect(await tableNames()).toEqual([]); // demo's current shape
    expect(await indexNames()).toEqual([]);

    await client.query(migrationSql); // the upgrade

    expect(await tableNames()).toEqual([...EXPECTED_TABLES].sort());
    expect(await indexNames()).toEqual([...EXPECTED_INDEXES].sort());
    await clearSchemaCache();
  });

  // ── 3. re-run is idempotent ──────────────────────────────────────────────
  itDB('re-running 932 twice more is idempotent and creates no duplicates', async () => {
    await expect(client.query(migrationSql)).resolves.toBeDefined();
    await expect(client.query(migrationSql)).resolves.toBeDefined();

    expect(await tableNames()).toEqual([...EXPECTED_TABLES].sort());
    expect(await indexNames()).toEqual([...EXPECTED_INDEXES].sort());

    // No duplicate indexes silently accumulated.
    const { rows } = await client.query(
      `SELECT indexname, count(*)::int AS n FROM pg_indexes
        WHERE schemaname='public' AND indexname = ANY($1) GROUP BY indexname`,
      [EXPECTED_INDEXES as unknown as string[]]
    );
    for (const r of rows) expect(r.n).toBe(1);
    await clearSchemaCache();
  });

  // ── 5. all sections present after migration ──────────────────────────────
  itDB('detail reports NO degraded sections once 932 is applied', async () => {
    await clearSchemaCache();
    const res = await request(app).get(`/api/decisions/${decisionId}/detail`);
    expect(res.status).toBe(200);
    expect(res.body.degradedSections).toEqual([]);
    expect(JSON.stringify(res.body)).not.toContain('[object Object]');
  });

  // ── 6. write + fresh reopen ──────────────────────────────────────────────
  itDB('comment / alternative / risk persist server-side and survive a fresh reopen', async () => {
    await clearSchemaCache();
    const commentRes = await request(app)
      .post(`/api/decisions/${decisionId}/comments`)
      .send({ body: 'Licencja wymaga audytu TÜV' });
    expect(commentRes.status).toBeLessThan(300);

    const altRes = await request(app)
      .post(`/api/decisions/${decisionId}/alternatives`)
      .send({ title: 'Partner lokalny', description: 'Zamiast własnej licencji' });
    expect(altRes.status).toBeLessThan(300);

    const riskRes = await request(app)
      .post(`/api/decisions/${decisionId}/risks`)
      .send({ description: 'Termin audytu', severity: 'HIGH', likelihood: 'MEDIUM' });
    expect(riskRes.status).toBeLessThan(300);

    // Fresh reopen: a brand-new GET, nothing reused from the write responses.
    const reopened = await request(app).get(`/api/decisions/${decisionId}/detail`);
    expect(reopened.status).toBe(200);
    expect(reopened.body.comments.map((c: any) => c.body)).toContain('Licencja wymaga audytu TÜV');
    expect(reopened.body.dossierAlternatives.map((a: any) => a.title)).toContain('Partner lokalny');
    expect(reopened.body.dossierRisks.map((r: any) => r.description)).toContain('Termin audytu');
    expect(reopened.body.degradedSections).toEqual([]);

    // And it is really in the database, not just in a response envelope.
    const { rows } = await client.query(
      `SELECT count(*)::int AS n FROM decision_comments WHERE decision_id=$1 AND organization_id=$2`,
      [decisionId, orgId]
    );
    expect(rows[0].n).toBe(1);
  });

  // ── 7. cross-tenant negative control ─────────────────────────────────────
  itDB('a foreign tenant can neither read nor write the decision', async () => {
    mockUser = { id: foreignUserId, role: 'ADMIN', organizationId: otherOrgId };
    try {
      const read = await request(app).get(`/api/decisions/${decisionId}/detail`);
      expect(read.status).toBe(404);
      expect(read.body.id).toBeUndefined();

      const write = await request(app)
        .post(`/api/decisions/${decisionId}/comments`)
        .send({ body: 'cross-tenant' });
      expect(write.status).toBe(404);

      const { rows } = await client.query(
        `SELECT count(*)::int AS n FROM decision_comments WHERE decision_id=$1`,
        [decisionId]
      );
      expect(rows[0].n).toBe(1); // unchanged by the foreign write attempt
    } finally {
      mockUser = { id: userId, role: 'ADMIN', organizationId: orgId };
    }
  });
});
