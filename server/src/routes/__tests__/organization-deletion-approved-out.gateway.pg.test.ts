/** @vitest-environment node */

import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';

import express from 'express';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { assertRealPostgresTestEnvironment } from '../../../../tests/integration/_helpers/assertRealPostgres.js';

const databaseUrl = process.env.DATABASE_URL || '';
const expectedDatabase = process.env.C6_EXPORT_TEST_DATABASE || '';
const pool = new Pool({ connectionString: databaseUrl, max: 4 });
const organizationIds: string[] = [];
const userIds: string[] = [];
const membershipIds: string[] = [];
const proof: Record<string, unknown>[] = [];

let app: express.Express;
let superadminToken: string;
let adminToken: string;
let superadminId: string;
let targetOrganizationId: string;
let missingOrganizationId: string;

const snapshotTarget = async () => ({
  organization: (
    await pool.query(
      'SELECT id, name, organization_type, is_active FROM organizations WHERE id = $1',
      [targetOrganizationId]
    )
  ).rows,
  users: (
    await pool.query(
      'SELECT id, organization_id, email, role, status FROM users WHERE organization_id = $1 OR id = ANY($2::text[]) ORDER BY id',
      [targetOrganizationId, userIds]
    )
  ).rows,
  memberships: (
    await pool.query(
      'SELECT id, organization_id, user_id, role, status FROM organization_members WHERE organization_id = $1 ORDER BY id',
      [targetOrganizationId]
    )
  ).rows,
  policy: (
    await pool.query(
      'SELECT id, organization_id, retention_days, legal_hold_enabled, residency_region FROM org_policies WHERE organization_id = $1',
      [targetOrganizationId]
    )
  ).rows,
});

const readDeletionConfirmations = async () => {
  const catalogPresent = Boolean(
    (await pool.query("SELECT to_regclass('public.superadmin_confirmed_actions') AS relation"))
      .rows[0]?.relation
  );
  if (!catalogPresent) return { catalogPresent, rows: [] };
  const rows = (
    await pool.query(
      "SELECT id, admin_id, action_type, target_id FROM superadmin_confirmed_actions WHERE admin_id = $1 AND action_type = 'delete_organization'",
      [superadminId]
    )
  ).rows;
  return { catalogPresent, rows };
};

beforeAll(async () => {
  expect(expectedDatabase).toBe('cx6_export_contract');
  expect(process.env.ENABLE_TEST_AUTH_BYPASS).not.toBe('true');
  const identity = await assertRealPostgresTestEnvironment({ expectedDatabase });
  expect(identity.host).toBe('127.0.0.1');
  expect(identity.port).toBe('6457');

  const createOrganization = async (label: string) => {
    const id = randomUUID();
    organizationIds.push(id);
    await pool.query('INSERT INTO organizations(id, name) VALUES ($1, $2)', [
      id,
      `C6 deletion approved-out ${label} ${id}`,
    ]);
    return id;
  };
  const createUser = async (organizationId: string, role: 'SUPERADMIN' | 'ADMIN') => {
    const id = randomUUID();
    const membershipId = randomUUID();
    userIds.push(id);
    membershipIds.push(membershipId);
    await pool.query(
      "INSERT INTO users(id, organization_id, email, password, role, status) VALUES ($1, $2, $3, 'local-fixture-not-login', $4, 'active')",
      [id, organizationId, `${id}@test.invalid`, role]
    );
    await pool.query(
      "INSERT INTO organization_members(id, organization_id, user_id, role, status) VALUES ($1, $2, $3, 'ADMIN', 'ACTIVE')",
      [membershipId, organizationId, id]
    );
    return id;
  };

  const superadminOrganizationId = await createOrganization('superadmin-home');
  const adminOrganizationId = await createOrganization('admin-home');
  targetOrganizationId = await createOrganization('governed-target');
  missingOrganizationId = randomUUID();

  superadminId = await createUser(superadminOrganizationId, 'SUPERADMIN');
  const adminId = await createUser(adminOrganizationId, 'ADMIN');
  await createUser(targetOrganizationId, 'ADMIN');

  const sharedUserId = randomUUID();
  const sharedMembershipId = randomUUID();
  userIds.push(sharedUserId);
  membershipIds.push(sharedMembershipId);
  await pool.query(
    "INSERT INTO users(id, organization_id, email, password, role, status) VALUES ($1, $2, $3, 'local-fixture-not-login', 'ADMIN', 'active')",
    [sharedUserId, adminOrganizationId, `${sharedUserId}@test.invalid`]
  );
  await pool.query(
    "INSERT INTO organization_members(id, organization_id, user_id, role, status) VALUES ($1, $2, $3, 'MEMBER', 'ACTIVE')",
    [sharedMembershipId, targetOrganizationId, sharedUserId]
  );
  await pool.query(
    'INSERT INTO org_policies(id, organization_id, retention_days, legal_hold_enabled, residency_region) VALUES ($1, $2, 365, 1, $3)',
    [randomUUID(), targetOrganizationId, 'EU']
  );

  const config = (await import('../../config/Config.js')).default;
  const sign = (id: string, organizationId: string, role: 'SUPERADMIN' | 'ADMIN') =>
    jwt.sign(
      {
        id,
        organizationId,
        role,
        email: `${id}@test.invalid`,
      },
      config.JWT_SECRET,
      {
        expiresIn: '15m',
        ...(config.JWT_ISSUER ? { issuer: config.JWT_ISSUER } : {}),
        ...(config.JWT_AUDIENCE ? { audience: config.JWT_AUDIENCE } : {}),
      }
    );
  superadminToken = sign(superadminId, superadminOrganizationId, 'SUPERADMIN');
  adminToken = sign(adminId, adminOrganizationId, 'ADMIN');

  const { ApiGateway } = await import('../../Gateway.js');
  app = express();
  app.use(express.json());
  ApiGateway.getInstance().initializeRoutes(app);

  proof.push({ environment: identity, fixture: await snapshotTarget() });
}, 60_000);

afterAll(async () => {
  if (!pool) return;
  const confirmations = await readDeletionConfirmations();
  const deletionAuditRows = (
    await pool.query(
      "SELECT id, actor_id, action, resource_type, resource_id FROM audit_events WHERE actor_id = $1 AND action = 'delete' AND resource_type = 'organization'",
      [superadminId]
    )
  ).rows;
  proof.push({ confirmations, deletionAuditRows, finalFixture: await snapshotTarget() });

  await pool.query('DELETE FROM audit_events WHERE actor_id = ANY($1::text[])', [userIds]);
  if (confirmations.catalogPresent) {
    await pool.query('DELETE FROM superadmin_confirmed_actions WHERE admin_id = ANY($1::text[])', [
      userIds,
    ]);
  }
  await pool.query('DELETE FROM org_policies WHERE organization_id = ANY($1::text[])', [
    organizationIds,
  ]);
  await pool.query('DELETE FROM organization_members WHERE id = ANY($1::text[])', [membershipIds]);
  await pool.query('DELETE FROM users WHERE id = ANY($1::text[])', [userIds]);
  await pool.query('DELETE FROM organizations WHERE id = ANY($1::text[])', [organizationIds]);
  const cleanup = {
    organizations: Number(
      (
        await pool.query('SELECT COUNT(*) AS count FROM organizations WHERE id = ANY($1::text[])', [
          organizationIds,
        ])
      ).rows[0]?.count
    ),
    users: Number(
      (
        await pool.query('SELECT COUNT(*) AS count FROM users WHERE id = ANY($1::text[])', [
          userIds,
        ])
      ).rows[0]?.count
    ),
    memberships: Number(
      (
        await pool.query(
          'SELECT COUNT(*) AS count FROM organization_members WHERE id = ANY($1::text[])',
          [membershipIds]
        )
      ).rows[0]?.count
    ),
  };
  proof.push({ cleanup });
  expect(cleanup).toEqual({ organizations: 0, users: 0, memberships: 0 });

  if (process.env.C6_DELETE_OFF_PROOF_OUT) {
    writeFileSync(process.env.C6_DELETE_OFF_PROOF_OUT, JSON.stringify(proof, null, 2));
  }
  await pool.end();
  const db = await import('../../database/PostgresDatabase.js');
  await db.default.close();
});

describe('SET-MVP-DELETE-001 through ApiGateway, JWT, and real PostgreSQL', () => {
  it('returns the same 410 for populated, governed, and missing organization ids without confirmation, audit, or data mutation', async () => {
    const before = await snapshotTarget();
    const invoke = (organizationId: string) =>
      request(app)
        .delete(`/api/superadmin/organizations/${organizationId}`)
        .set('Authorization', `Bearer ${superadminToken}`)
        .send({
          confirmation: true,
          reason: 'must remain approved out',
          organizationName: before.organization[0]?.name,
        });

    const populatedFirst = await invoke(targetOrganizationId);
    const populatedSecond = await invoke(targetOrganizationId);
    const missing = await invoke(missingOrganizationId);

    for (const response of [populatedFirst, populatedSecond, missing]) {
      expect(response.status).toBe(410);
      expect(response.body).toEqual({
        success: false,
        code: 'SET_DELETE_APPROVED_OUT',
        destructiveExecution: false,
      });
    }
    expect(await snapshotTarget()).toEqual(before);
    const confirmations = await readDeletionConfirmations();
    expect(confirmations.rows).toEqual([]);
    expect(
      (
        await pool.query(
          "SELECT 1 FROM audit_events WHERE actor_id = $1 AND action = 'delete' AND resource_type = 'organization'",
          [superadminId]
        )
      ).rowCount
    ).toBe(0);
    proof.push({
      case: 'authenticated deterministic refusal',
      statuses: [populatedFirst.status, populatedSecond.status, missing.status],
      populatedBody: populatedFirst.body,
      missingBody: missing.body,
      readbackUnchanged: true,
      confirmations,
      deletionAuditRows: 0,
    });
  });

  it('keeps real persisted non-superadmin and unauthenticated authority denials before the approved-out response', async () => {
    const before = await snapshotTarget();
    const admin = await request(app)
      .delete(`/api/superadmin/organizations/${targetOrganizationId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ confirmation: true, reason: 'foreign tenant attempt' });
    const anonymous = await request(app)
      .delete(`/api/superadmin/organizations/${targetOrganizationId}`)
      .send({ confirmation: true, reason: 'anonymous attempt' });

    expect(admin.status).toBe(403);
    expect(admin.body.code).toBe('INSUFFICIENT_PLATFORM_ROLE');
    expect(anonymous.status).toBe(401);
    expect(await snapshotTarget()).toEqual(before);
    proof.push({
      case: 'authority before approved-out boundary',
      statuses: { persistedAdmin: admin.status, anonymous: anonymous.status },
      bodies: { persistedAdmin: admin.body, anonymous: anonymous.body },
      readbackUnchanged: true,
    });
  });
});
