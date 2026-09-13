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
    'ie_outbox_events',
    'ie_audit_events',
    'ie_command_receipts',
    'ie_aggregate_relations',
    'ie_aggregate_state',
    'initiative_candidates',
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
describe('real canonical manual initiative export', () => {
  it('Submit Register Amend writes canonical lineage and current content to tenant JSON CSV without a legacy mirror', async () => {
    const a = await account(),
      b = await account();
    const records = [];
    for (const [actor, title, privateReference] of [
      [a, 'OWN_MANUAL_CONTENT', false],
      [b, 'FOREIGN_MANUAL_CONTENT', false],
      [a, 'PRIVATE_REFERENCED_CONTENT', true],
    ] as const) {
      const project = await request(origin)
        .post('/api/projects')
        .set('Authorization', `Bearer ${actor.token}`)
        .send({ name: 'Canonical export project' });
      expect(project.status, project.text).toBe(201);
      const proposalId = `proposal-${randomUUID()}`,
        initiativeId = `initiative-${randomUUID()}`,
        sourceId = `manual-hub-${randomUUID()}`;
      const payload = {
        sourceType: 'MANUAL_HUB',
        sourceId,
        sourceVersion: 1,
        title,
        problem: title,
        proposedOutcome: null,
        priority: 'MEDIUM',
        projectId: project.body.id,
        initiativeOwnerId: actor.userId,
        visibility: 'PROJECT',
      };
      const submit = await request(origin)
        .post('/api/initiatives/runtime-v1/source-proposals')
        .set('Authorization', `Bearer ${actor.token}`)
        .send({
          ...payload,
          proposalId,
          expectedVersion: 0,
          clientRequestId: `submit-${randomUUID()}`,
          provenance: {
            system: 'consultify.initiatives-hub',
            recordType: 'manual-initiative-proposal',
            capturedAt: new Date().toISOString(),
            evidenceRefs: [
              `consultify://initiatives/source-proposals/${proposalId}`,
              ...(privateReference ? ['consultify://interview/private-source'] : []),
            ],
          },
        });
      expect(submit.status, submit.text).toBe(201);
      const registered = await request(origin)
        .post('/api/initiatives/runtime-v1/registrations')
        .set('Authorization', `Bearer ${actor.token}`)
        .send({
          ...payload,
          initiativeId,
          proposalId,
          proposalVersion: 1,
          expectedVersion: 0,
          clientRequestId: `register-${randomUUID()}`,
        });
      expect(registered.status, registered.text).toBe(201);
      const amended = await request(origin)
        .patch(`/api/initiatives/runtime-v1/initiatives/${initiativeId}/metadata`)
        .set('Authorization', `Bearer ${actor.token}`)
        .send({
          expectedVersion: 1,
          clientRequestId: `amend-${randomUUID()}`,
          title: `${title}_EDITED`,
        });
      expect(amended.status, amended.text).toBe(200);
      const read = await request(origin)
        .get(`/api/initiatives/runtime-v1/initiatives/${initiativeId}`)
        .set('Authorization', `Bearer ${actor.token}`);
      expect(read.status, read.text).toBe(200);
      expect(read.text).toContain(`${title}_EDITED`);
      records.push({ orgId: actor.orgId, proposalId, initiativeId, sourceId });
    }
    const snapshot = async () => {
      const stored: Record<string, unknown[]> = {};
      for (const table of [
        'ie_aggregate_state',
        'ie_audit_events',
        'ie_outbox_events',
        'ie_command_receipts',
        'ie_aggregate_relations',
        'initiative_candidates',
      ])
        stored[table] = (
          await pool.query(
            `SELECT to_jsonb(row) AS payload FROM ${table} row WHERE organization_id=ANY($1::text[]) ORDER BY to_jsonb(row)::text`,
            [[a.orgId, b.orgId]]
          )
        ).rows;
      return stored;
    };
    const storedBefore = await snapshot();
    const before = (
      await pool.query(
        'SELECT organization_id,aggregate_type,aggregate_id,version,payload_json FROM ie_aggregate_state WHERE organization_id=ANY($1::text[]) ORDER BY organization_id,aggregate_type,aggregate_id',
        [[a.orgId, b.orgId]]
      )
    ).rows;
    const own = records[0];
    for (const format of ['json', 'csv']) {
      const exported = await request(origin)
        .get(`/api/organizations/${a.orgId}/export?format=${format}`)
        .set('Authorization', `Bearer ${a.token}`);
      expect(exported.status, exported.text).toBe(200);
      expect(exported.text).toContain('OWN_MANUAL_CONTENT_EDITED');
      expect(exported.text).not.toContain('FOREIGN_MANUAL_CONTENT');
      expect(exported.text).not.toContain('PRIVATE_REFERENCED_CONTENT');
      expect(exported.text).not.toContain(records[1].initiativeId);
      if (format === 'json') {
        const data = JSON.parse(exported.text);
        const initiative = data.tables.ie_aggregate_state.find(
          (r: any) => r.aggregate_type === 'initiative' && r.aggregate_id === own.initiativeId
        );
        const proposal = data.tables.ie_aggregate_state.find(
          (r: any) => r.aggregate_type === 'source_proposal' && r.aggregate_id === own.proposalId
        );
        expect(initiative).toMatchObject({
          aggregate_id: own.initiativeId,
          version: 2,
          export_payload_scope: 'verified_manual_hub_content',
          payload_json: {
            title: 'OWN_MANUAL_CONTENT_EDITED',
            source: { sourceId: own.sourceId, sourceVersion: 1, proposalVersion: 2 },
          },
        });
        expect(proposal).toMatchObject({
          aggregate_id: own.proposalId,
          version: 1,
          payload_json: { proposalVersion: 1 },
        });
        expect(data.tables.ie_aggregate_relations).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              source_id: own.sourceId,
              source_version: 1,
              target_id: own.initiativeId,
            }),
          ])
        );
        expect(data.tables.ie_audit_events.map((r: any) => r.aggregate_version)).toEqual(
          expect.arrayContaining([1, 2])
        );
        expect(data.tables.ie_command_receipts).toHaveLength(6);
        expect(
          data.tables.ie_aggregate_state.find(
            (r: any) => r.aggregate_id === records[2].initiativeId
          ).export_payload_scope
        ).toBe('lineage_only_content_unresolved');
        expect(data.securityManifest.complete).toBe(false);
      }
    }
    expect(
      (
        await pool.query(
          'SELECT organization_id,aggregate_type,aggregate_id,version,payload_json FROM ie_aggregate_state WHERE organization_id=ANY($1::text[]) ORDER BY organization_id,aggregate_type,aggregate_id',
          [[a.orgId, b.orgId]]
        )
      ).rows
    ).toEqual(before);
    expect(await snapshot()).toEqual(storedBefore);
    const legacyTable = (await pool.query("SELECT to_regclass('public.initiatives') AS relation"))
      .rows[0].relation;
    if (legacyTable)
      expect(
        (
          await pool.query(
            'SELECT count(*)::int AS n FROM public.initiatives WHERE organization_id=$1 AND id=$2',
            [a.orgId, own.initiativeId]
          )
        ).rows[0].n
      ).toBe(0);
    const candidate = (
      await pool.query(
        'SELECT version,source_version,registered_initiative_id FROM initiative_candidates WHERE id=$1 AND organization_id=$2',
        [own.proposalId, a.orgId]
      )
    ).rows[0];
    expect(candidate).toMatchObject({
      version: 2,
      source_version: 1,
      registered_initiative_id: own.initiativeId,
    });
  }, 60000);
});
