import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import express from 'express';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { assertRealPostgresTestEnvironment } from '../../../../tests/integration/_helpers/assertRealPostgres.js';

const databaseUrl = process.env.DATABASE_URL || '';
const expectedDatabase = process.env.C6_EXPORT_TEST_DATABASE || '';
const pool = new Pool({ connectionString: databaseUrl, max: 6 });
const orgIds: string[] = [];
const userIds: string[] = [];
let server: Server;
let secret: string;
const origin = 'http://127.0.0.1:4216';
const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
};
async function account(superadmin = false) {
  const orgId = randomUUID(),
    userId = randomUUID();
  orgIds.push(orgId);
  userIds.push(userId);
  await pool.query('INSERT INTO organizations(id,name) VALUES ($1,$2)', [
    orgId,
    `Gateway export ${orgId}`,
  ]);
  await pool.query(
    "INSERT INTO users(id,organization_id,email,password,role,status) VALUES ($1,$2,$3,'local-fixture-not-login',$4,'active')",
    [userId, orgId, `${userId}@test.invalid`, superadmin ? 'SUPERADMIN' : 'ADMIN']
  );
  await pool.query(
    "INSERT INTO organization_members(id,organization_id,user_id,role,status) VALUES ($1,$2,$3,'ADMIN','ACTIVE')",
    [randomUUID(), orgId, userId]
  );
  const token = jwt.sign(
    {
      id: userId,
      organizationId: orgId,
      role: superadmin ? 'SUPERADMIN' : 'ADMIN',
      email: `${userId}@test.invalid`,
    },
    secret,
    { expiresIn: '15m' }
  );
  return { orgId, userId, token };
}
beforeAll(async () => {
  expect(expectedDatabase.startsWith('cx6_')).toBe(true);
  expect(process.env.ENABLE_TEST_AUTH_BYPASS).not.toBe('true');
  expect(process.env.ENABLE_V8_GLOBAL).toBe('true');
  expect(process.env.RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE).toBe('enforce');
  const identity = await assertRealPostgresTestEnvironment({ expectedDatabase });
  expect(identity.host).toBe('127.0.0.1');
  expect(identity.port).toBe('6457');
  const config = (await import('../../config/Config.js')).default;
  secret = config.JWT_SECRET;
  const { ApiGateway } = await import('../../Gateway.js');
  const app = express();
  app.use(express.json());
  ApiGateway.getInstance().initializeRoutes(app);
  server = await new Promise<Server>((resolve, reject) => {
    const listening = app.listen(4216, '127.0.0.1', () => resolve(listening));
    listening.once('error', reject);
  });
}, 60000);
afterAll(async () => {
  if (server)
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve()))
    );
  for (const table of [
    'interview_insight_evidence_pointers',
    'interview_insight_findings',
    'interview_insight_handoffs',
    'interview_insight_audit_log',
    'interview_insights',
    'decisions',
    'canonical_inbox_items',
  ])
    await pool.query(`DELETE FROM ${table} WHERE organization_id=ANY($1::text[])`, [orgIds]);
  await pool.query('DELETE FROM org_policies WHERE organization_id=ANY($1::text[])', [orgIds]);
  await pool.query(
    'DELETE FROM project_members WHERE project_id IN (SELECT id FROM projects WHERE organization_id=ANY($1::text[]))',
    [orgIds]
  );
  await pool.query('DELETE FROM projects WHERE organization_id=ANY($1::text[])', [orgIds]);
  await pool.query('DELETE FROM organization_members WHERE organization_id=ANY($1::text[])', [
    orgIds,
  ]);
  await pool.query('DELETE FROM users WHERE id=ANY($1::text[])', [userIds]);
  await pool.query('DELETE FROM organizations WHERE id=ANY($1::text[])', [orgIds]);
  await pool.end();
  const db = await import('../../database/PostgresDatabase.js');
  await db.default.close();
});

type Actor = Awaited<ReturnType<typeof account>>;
const base = '/api/v8/interview/insights';
async function findingFixture(actor: Actor, confirmed = true) {
  const insightId = randomUUID();
  // The parent Insight is a fixture; this test does not invoke an LLM or claim
  // complete Interview generation. Finding and client readback use real routes.
  await pool.query(
    "INSERT INTO interview_insights(id,organization_id,title,created_by,status,content) VALUES($1,$2,$3,$4,'completed','fixture parent')",
    [insightId, actor.orgId, 'Provenance fixture', actor.userId]
  );
  const finding = await request(origin)
    .post(`${base}/${insightId}/findings`)
    .set('Authorization', `Bearer ${actor.token}`)
    .send({
      finding_statement: 'PRIVATE_FINDING_BODY',
      confidence_level: 'high',
      limits: 'Fixture evidence only',
      next_action: 'Verify operational response',
      evidence_pointers: [
        {
          type: 'operator_note',
          sourceRef: `local-fixture:${randomUUID()}`,
          sourceFingerprint: randomUUID(),
          capturedExcerpt: 'PRIVATE_EVIDENCE_EXCERPT',
        },
      ],
    });
  expect(finding.status, finding.text).toBe(201);
  const findingId = finding.body.data.finding.id;
  if (confirmed) {
    const readback = await request(origin)
      .patch(`${base}/${insightId}/findings/${findingId}/readback`)
      .set('Authorization', `Bearer ${actor.token}`)
      .send({ readback_status: 'confirmed_by_client', readback_summary: 'Confirmed test fixture' });
    expect(readback.status, readback.text).toBe(200);
  }
  return { insightId, findingId, url: `${base}/${insightId}/findings/${findingId}/handoff` };
}
async function project(actor: Actor) {
  const r = await request(origin)
    .post('/api/projects')
    .set('Authorization', `Bearer ${actor.token}`)
    .send({ name: 'Source-stamp fixture' });
  expect(r.status, r.text).toBe(201);
  return r.body.id as string;
}
describe('real Interview finding Decision atomic provenance', () => {
  it('persists source and content in one INSERT when a later source-tag UPDATE is rejected', async () => {
    const a = await account(),
      f = await findingFixture(a),
      projectId = await project(a);
    const suffix = randomUUID().replaceAll('-', '');
    const trigger = `cx6_provenance_${suffix}`;
    const fn = `cx6_provenance_fault_${suffix}`;
    const before = (
      await pool.query(
        "SELECT tgname,pg_get_triggerdef(oid) AS definition FROM pg_trigger WHERE tgrelid='public.decisions'::regclass ORDER BY tgname"
      )
    ).rows;
    const sourceBefore = (
      await pool.query('SELECT to_jsonb(f) AS row FROM interview_insight_findings f WHERE id=$1', [
        f.findingId,
      ])
    ).rows;
    try {
      await pool.query(
        `CREATE FUNCTION public.${fn}() RETURNS trigger LANGUAGE plpgsql AS $body$ BEGIN IF NEW.organization_id=TG_ARGV[0] THEN RAISE EXCEPTION 'C6_OWN_SOURCE_TAG_UPDATE_REJECTED'; END IF; RETURN NEW; END $body$`
      );
      await pool.query(
        `CREATE TRIGGER ${trigger} BEFORE UPDATE OF source_type,source_id ON public.decisions FOR EACH ROW EXECUTE FUNCTION public.${fn}('${a.orgId}')`
      );
      const handoff = await request(origin)
        .post(f.url)
        .set('Authorization', `Bearer ${a.token}`)
        .send({ target_type: 'decision', project_id: projectId });
      expect(handoff.status, handoff.text).toBe(200);
      const decisionId = handoff.body.data.initiative.id;
      const row = (
        await pool.query(
          'SELECT organization_id,title,description,source_type,source_id FROM decisions WHERE id=$1',
          [decisionId]
        )
      ).rows[0];
      expect(
        row,
        JSON.stringify({ source_type: row.source_type, source_id: row.source_id })
      ).toMatchObject({
        organization_id: a.orgId,
        title: 'PRIVATE_FINDING_BODY',
        source_type: 'interview_insight',
        source_id: f.findingId,
      });
      expect(row.description).toContain('PRIVATE_EVIDENCE_EXCERPT');
      expect(
        (
          await pool.query(
            'SELECT target_id,status FROM interview_insight_handoffs WHERE finding_id=$1',
            [f.findingId]
          )
        ).rows
      ).toContainEqual({ target_id: decisionId, status: 'linked' });
      expect(
        (
          await pool.query(
            'SELECT to_jsonb(f) AS row FROM interview_insight_findings f WHERE id=$1',
            [f.findingId]
          )
        ).rows
      ).toEqual(sourceBefore);
      // Reject the complete INSERT as well: no success or untagged fallback
      // row may appear when the content/source write cannot be committed.
      await pool.query(
        `CREATE TRIGGER ${trigger}_insert BEFORE INSERT ON public.decisions FOR EACH ROW EXECUTE FUNCTION public.${fn}('${a.orgId}')`
      );
      const rejected = await request(origin)
        .post(f.url)
        .set('Authorization', `Bearer ${a.token}`)
        .send({ target_type: 'decision', project_id: projectId });
      expect(rejected.status, rejected.text).toBe(500);
      expect(rejected.body.code).toBe('P10_HANDOFF_CREATE_FAILED');
      expect(
        (await pool.query('SELECT id FROM decisions WHERE organization_id=$1', [a.orgId])).rows
      ).toEqual([{ id: decisionId }]);
    } finally {
      await pool.query(`DROP TRIGGER IF EXISTS ${trigger}_insert ON public.decisions`);
      await pool.query(`DROP TRIGGER IF EXISTS ${trigger} ON public.decisions`);
      await pool.query(`DROP FUNCTION IF EXISTS public.${fn}()`);
      expect(
        (
          await pool.query(
            "SELECT tgname,pg_get_triggerdef(oid) AS definition FROM pg_trigger WHERE tgrelid='public.decisions'::regclass ORDER BY tgname"
          )
        ).rows
      ).toEqual(before);
      expect(
        (await pool.query('SELECT oid FROM pg_proc WHERE proname=$1', [fn])).rows
      ).toHaveLength(0);
    }
  });
  it('denies foreign insight and foreign project without creating a Decision', async () => {
    const a = await account(),
      b = await account(),
      f = await findingFixture(a),
      foreign = await findingFixture(b),
      foreignProject = await project(b);
    const before = (
      await pool.query(
        'SELECT id FROM decisions WHERE organization_id=ANY($1::text[]) ORDER BY id',
        [[a.orgId, b.orgId]]
      )
    ).rows;
    const foreignSource = await request(origin)
      .post(foreign.url)
      .set('Authorization', `Bearer ${a.token}`)
      .send({ target_type: 'decision' });
    expect(foreignSource.status, foreignSource.text).toBe(404);
    const foreignTarget = await request(origin)
      .post(f.url)
      .set('Authorization', `Bearer ${a.token}`)
      .send({ target_type: 'decision', project_id: foreignProject });
    expect(foreignTarget.status, foreignTarget.text).toBe(404);
    expect(
      (
        await pool.query(
          'SELECT id FROM decisions WHERE organization_id=ANY($1::text[]) ORDER BY id',
          [[a.orgId, b.orgId]]
        )
      ).rows
    ).toEqual(before);
  });
  it('keeps the client readback gate before source-stamped Decision creation', async () => {
    const a = await account(),
      f = await findingFixture(a, false);
    const r = await request(origin)
      .post(f.url)
      .set('Authorization', `Bearer ${a.token}`)
      .send({ target_type: 'decision' });
    expect(r.status, r.text).toBe(422);
    expect(r.body.code).toBe('P10_READBACK_REQUIRED');
    expect(
      (await pool.query('SELECT id FROM decisions WHERE organization_id=$1', [a.orgId])).rows
    ).toHaveLength(0);
  });
});
