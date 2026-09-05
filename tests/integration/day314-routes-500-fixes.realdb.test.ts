/**
 * Day 314 — eight routes answered 500 to an ordinary logged-in user (measured
 * 2026-09-04, duty 312 acceptance). This is the mounted, real-PostgreSQL proof
 * for the ones whose cause was in this repository's own code or schema.
 *
 * Two tenant shapes are exercised on purpose, because five of the eight failures
 * only appear for one of them:
 *   - a UUID organization id  (what a freshly created tenant looks like)
 *   - a legacy TEXT id        (what the failing demo tenant actually looked like:
 *                              `invalid input syntax for type uuid: "..."`)
 *
 * Requires a disposable, fully migrated database whose name starts with
 * `ag_trasy_500`. Run with RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres.
 */
import { randomUUID } from 'node:crypto';

import express, { type Express } from 'express';
import jwt from 'jsonwebtoken';
import pg from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import config from '../../server/src/config/Config.js';

const databaseUrl = process.env.DATABASE_URL ?? '';
const databaseName = (() => {
  try {
    return new URL(databaseUrl).pathname.replace(/^\//, '');
  } catch {
    return '';
  }
})();
const enabled =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  databaseUrl.startsWith('postgres') &&
  databaseName.startsWith('ag_trasy_500');

describe.skipIf(!enabled).sequential('Day 314 — the eight 500 routes on real PostgreSQL', () => {
  const suffix = randomUUID();
  const orgUuid = randomUUID();
  const orgLegacy = `d314-legacy-${suffix}`;
  const ownerUuid = randomUUID();
  const ownerLegacy = `d314-owner-legacy-${suffix}`;
  const viewerUuid = randomUUID();

  let pool: pg.Pool;
  let billingApp: Express;
  let reportBuilderApp: Express;
  let tablePlatformApp: Express;
  let adminServiceAccountsApp: Express;
  let knowledgeGraphApp: Express;

  const token = (id: string, organizationId: string, role: string) =>
    jwt.sign(
      {
        id,
        userId: id,
        email: `${id}@test.invalid`,
        organizationId,
        organization_id: organizationId,
        role,
      },
      config.JWT_SECRET,
      { algorithm: 'HS256', expiresIn: '15m' }
    );

  const mount = (path: string, router: unknown): Express => {
    const app = express();
    app.use(express.json());
    app.use(path, router as express.Router);
    // Same terminal handler the server installs, so a leaked stack would show.
    app.use(
      (
        err: Error,
        _req: express.Request,
        res: express.Response,
        _next: express.NextFunction
      ) => {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        res.status(500).json({ error: { message: err.message, stack: err.stack } });
      }
    );
    return app;
  };

  beforeAll(async () => {
    process.env.DB_TYPE = 'postgres';
    process.env.MOCK_DB = 'false';
    pool = new pg.Pool({ connectionString: databaseUrl });

    for (const [org, name] of [
      [orgUuid, 'Day314 UUID org'],
      [orgLegacy, 'Day314 legacy org'],
    ] as const) {
      await pool.query(`INSERT INTO organizations(id,name) VALUES($1,$2)`, [org, name]);
    }
    for (const [id, org, role] of [
      [ownerUuid, orgUuid, 'OWNER'],
      [ownerLegacy, orgLegacy, 'OWNER'],
      [viewerUuid, orgUuid, 'USER'],
    ] as const) {
      await pool.query(
        `INSERT INTO users(id,organization_id,email,password,role,status,first_name,last_name,created_at)
         VALUES($1,$2,$3,'x',$4,'active','Day','314',now())`,
        [id, org, `${id}@test.invalid`, role]
      );
      await pool.query(
        `INSERT INTO organization_members(id,organization_id,user_id,role,status,created_at)
         VALUES($1,$2,$3,$4,'ACTIVE',now())`,
        [randomUUID(), org, id, role === 'USER' ? 'MEMBER' : role]
      );
    }

    // One webhook event per tenant, so tenant isolation is observable and not
    // merely "both lists are empty".
    for (const [id, org, status] of [
      [`d314-ev-uuid-${suffix}`, orgUuid, 'delivered'],
      [`d314-ev-legacy-${suffix}`, orgLegacy, 'pending'],
    ] as const) {
      await pool.query(
        `INSERT INTO billing_webhook_events(id,organization_id,event_type,payload,status,created_at)
         VALUES($1,$2,'invoice.paid','{}',$3,to_char(now() at time zone 'utc','YYYY-MM-DD HH24:MI:SS'))`,
        [id, org, status]
      );
    }

    // Two knowledge-graph entities that collapse into one duplicate group, so
    // the GROUP_CONCAT -> STRING_AGG rewrite is proven to AGGREGATE, not merely
    // to parse against an empty table.
    for (const name of ['Acme Sp. z o.o.', 'ACME sp. z o.o.']) {
      await pool.query(
        `INSERT INTO knowledge_graph_entities(id,organization_id,type,name,canonical_name,first_seen,last_seen)
         VALUES($1,$2,'vendor',$3,'acme',now()::text,now()::text)`,
        [randomUUID(), orgUuid, name]
      );
    }

    billingApp = mount('/api/billing', (await import('../../server/src/routes/billing/billing.routes.js')).default);
    reportBuilderApp = mount('/api/report-builder', (await import('../../server/src/routes/report-builder.routes.js')).default);
    tablePlatformApp = mount('/api/table-platform', (await import('../../server/src/routes/table-platform.routes.js')).default);
    adminServiceAccountsApp = mount('/api/admin/service-accounts', (await import('../../server/src/routes/admin/service-accounts.routes.js')).default);
    knowledgeGraphApp = mount('/api/knowledge-graph', (await import('../../server/src/routes/knowledge-graph.routes.js')).default);
  }, 60_000);

  afterAll(async () => {
    await pool?.query(`DELETE FROM imported_reports WHERE organization_id IN ($1,$2)`, [orgUuid, orgLegacy]);
    await pool?.query(`DELETE FROM billing_webhook_events WHERE organization_id IN ($1,$2)`, [orgUuid, orgLegacy]);
    await pool?.query(`DELETE FROM knowledge_graph_entities WHERE organization_id IN ($1,$2)`, [orgUuid, orgLegacy]);
    await pool?.query(`DELETE FROM organization_members WHERE organization_id IN ($1,$2)`, [orgUuid, orgLegacy]);
    await pool?.query(`DELETE FROM users WHERE organization_id IN ($1,$2)`, [orgUuid, orgLegacy]);
    await pool?.query(`DELETE FROM organizations WHERE id IN ($1,$2)`, [orgUuid, orgLegacy]);
    await pool?.end();
  });

  // ---- billing_webhook_events: the table had no tenant column at all --------
  it('GET /api/billing/webhook-events returns only the calling tenant rows', async () => {
    const a = await request(billingApp)
      .get('/api/billing/webhook-events')
      .set('Authorization', `Bearer ${token(ownerUuid, orgUuid, 'OWNER')}`);
    expect(a.status).toBe(200);
    const idsA = (a.body.events ?? []).map((e: { id: string }) => e.id);
    expect(idsA).toContain(`d314-ev-uuid-${suffix}`);
    expect(idsA).not.toContain(`d314-ev-legacy-${suffix}`);

    const b = await request(billingApp)
      .get('/api/billing/webhook-events')
      .set('Authorization', `Bearer ${token(ownerLegacy, orgLegacy, 'OWNER')}`);
    expect(b.status).toBe(200);
    const idsB = (b.body.events ?? []).map((e: { id: string }) => e.id);
    expect(idsB).toContain(`d314-ev-legacy-${suffix}`);
    expect(idsB).not.toContain(`d314-ev-uuid-${suffix}`);
  });

  it('GET /api/billing/webhook-events/stats aggregates instead of failing on text >= timestamptz', async () => {
    const res = await request(billingApp)
      .get('/api/billing/webhook-events/stats')
      .set('Authorization', `Bearer ${token(ownerUuid, orgUuid, 'OWNER')}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.stats)).toBe(true);
    expect(res.body.stats.some((r: { event_type: string }) => r.event_type === 'invoice.paid')).toBe(true);
  });

  it('GET /webhook-events/stats treats an injected period as an unusable window, not as SQL', async () => {
    const res = await request(billingApp)
      .get("/api/billing/webhook-events/stats?period=1 days') OR 1=1 --")
      .set('Authorization', `Bearer ${token(ownerUuid, orgUuid, 'OWNER')}`);
    expect(res.status).toBe(200);
    // Falls back to the 30-day default and stays tenant-scoped.
    expect(Array.isArray(res.body.stats)).toBe(true);
  });

  // ---- uuid-typed tenant columns vs a legacy TEXT organization id -----------
  it('GET /api/report-builder/definitions serves the system catalog to a non-UUID tenant', async () => {
    for (const [user, org] of [
      [ownerUuid, orgUuid],
      [ownerLegacy, orgLegacy],
    ] as const) {
      const res = await request(reportBuilderApp)
        .get('/api/report-builder/definitions')
        .set('Authorization', `Bearer ${token(user, org, 'OWNER')}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.definitions)).toBe(true);
      expect(res.body.definitions.length).toBeGreaterThan(0);
    }
  });

  it('GET /api/table-platform/admin/service-accounts answers an empty list, not 500, for a non-UUID tenant', async () => {
    const res = await request(tablePlatformApp)
      .get('/api/table-platform/admin/service-accounts')
      .set('Authorization', `Bearer ${token(ownerLegacy, orgLegacy, 'OWNER')}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('GET /api/table-platform/admin/sso answers "not configured", not 500, for a non-UUID tenant', async () => {
    const res = await request(tablePlatformApp)
      .get('/api/table-platform/admin/sso')
      .set('Authorization', `Bearer ${token(ownerLegacy, orgLegacy, 'OWNER')}`);
    expect(res.status).toBe(404);
    expect(JSON.stringify(res.body)).not.toMatch(/uuid|syntax|SELECT/i);
  });

  it('a write for a non-UUID tenant says so in Polish with 400, instead of 500', async () => {
    const res = await request(tablePlatformApp)
      .post('/api/table-platform/admin/service-accounts')
      .set('Authorization', `Bearer ${token(ownerLegacy, orgLegacy, 'OWNER')}`)
      .send({ name: 'day314', scopes: ['read'] });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_ORGANIZATION_IDENTIFIER');
    expect(res.body.error).toMatch(/UUID/);
  });

  // ---- role gate: a VIEWER could mint a live service-account token ----------
  it('a non-admin member cannot read or mint table-platform service accounts', async () => {
    const viewer = token(viewerUuid, orgUuid, 'USER');
    const read = await request(tablePlatformApp)
      .get('/api/table-platform/admin/service-accounts')
      .set('Authorization', `Bearer ${viewer}`);
    expect(read.status).toBe(403);

    const mint = await request(tablePlatformApp)
      .post('/api/table-platform/admin/service-accounts')
      .set('Authorization', `Bearer ${viewer}`)
      .send({ name: 'escalation', scopes: ['read', 'write'] });
    expect(mint.status).toBe(403);
    expect(JSON.stringify(mint.body)).not.toMatch(/token/i);
  });

  it('the owner of the same organization is unaffected by that gate', async () => {
    const res = await request(tablePlatformApp)
      .get('/api/table-platform/admin/service-accounts')
      .set('Authorization', `Bearer ${token(ownerUuid, orgUuid, 'OWNER')}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  // ---- GROUP_CONCAT -> STRING_AGG must aggregate, not merely parse ----------
  it('GET /api/knowledge-graph/freshness/duplicates groups duplicates on Postgres', async () => {
    const res = await request(knowledgeGraphApp)
      .get('/api/knowledge-graph/freshness/duplicates')
      .set('Authorization', `Bearer ${token(ownerUuid, orgUuid, 'OWNER')}`);
    expect(res.status).toBe(200);
    const group = (res.body.duplicates ?? []).find(
      (d: { canonicalName: string }) => d.canonicalName === 'acme'
    );
    expect(group).toBeTruthy();
    expect(group.ids.length).toBe(2);
    expect(group.names.length).toBe(2);
  });

  // ---- coverage_percent had to exist on a database built from migrations ----
  it('GET /api/report-builder/sources/upload_bundle reads coverage_percent on a migrated database', async () => {
    const res = await request(reportBuilderApp)
      .get('/api/report-builder/sources/upload_bundle')
      .set('Authorization', `Bearer ${token(ownerUuid, orgUuid, 'OWNER')}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.sources)).toBe(true);
  });

  // Day 313 closed `coverage_percent`; the same divergence between
  // DatabaseInitializer's runtime DDL and the migration set left
  // canonical_markdown / auto_summary behind, and the sibling by-id route reads
  // both. On a database built from migrations it answered 500.
  it('GET /api/report-builder/sources/upload_bundle/:sourceId reads the canonical columns', async () => {
    const importId = `d314-import-${suffix}`;
    await pool.query(
      `INSERT INTO imported_reports(id,organization_id,source_file_name,source_format,detected_framework,
                                    status,canonical_markdown,auto_summary,coverage_percent,created_at,updated_at)
       VALUES($1,$2,'day314.pdf','pdf','UPLOAD','ready_for_review','# Day 314','Streszczenie',42,now(),now())`,
      [importId, orgUuid]
    );

    const res = await request(reportBuilderApp)
      .get(`/api/report-builder/sources/upload_bundle/${importId}`)
      .set('Authorization', `Bearer ${token(ownerUuid, orgUuid, 'OWNER')}`);
    expect(res.status).toBe(200);
    expect(res.body.canonicalMarkdown).toBe('# Day 314');
    expect(res.body.summary).toBe('Streszczenie');
    expect(res.body.coveragePercent).toBe(42);

    // And the list route sees the same row.
    const list = await request(reportBuilderApp)
      .get('/api/report-builder/sources/upload_bundle')
      .set('Authorization', `Bearer ${token(ownerUuid, orgUuid, 'OWNER')}`);
    expect(list.status).toBe(200);
    expect(list.body.sources.map((x: { id: string }) => x.id)).toContain(importId);
  });

  it('GET /api/admin/service-accounts answers without a driver error for both tenant shapes', async () => {
    for (const [user, org] of [
      [ownerUuid, orgUuid],
      [ownerLegacy, orgLegacy],
    ] as const) {
      const res = await request(adminServiceAccountsApp)
        .get('/api/admin/service-accounts')
        .set('Authorization', `Bearer ${token(user, org, 'OWNER')}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(JSON.stringify(res.body)).not.toMatch(/invalid input syntax|stack/i);
    }
  });
});
