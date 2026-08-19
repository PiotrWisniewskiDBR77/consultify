/**
 * @vitest-environment node
 *
 * ADM-BVP-001 — real PostgreSQL business-value path.
 *
 * Proves invite -> accept -> role -> fresh session -> revoke -> fresh-session
 * denial together with locked last-owner, cross-org, stale-role/capability and
 * audit rollback controls. Nothing in this file runs against SQLite or a mock DB.
 */
import { randomUUID } from 'node:crypto';

import express, { type Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const DATABASE_URL = process.env.DATABASE_URL || '';
const REAL_DB =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  DATABASE_URL.startsWith('postgres');

if (REAL_DB) process.env.DB_TYPE = 'postgres';

describe.skipIf(!REAL_DB)('ADM-BVP-001 — Admin/IAM BVP on real PostgreSQL', () => {
  const suffix = randomUUID().slice(0, 8);
  const orgId = `adm-bvp-org-${suffix}`;
  const otherOrgId = `adm-bvp-other-${suffix}`;
  const ownerId = `adm-bvp-owner-${suffix}`;
  const owner2Id = `adm-bvp-owner2-${suffix}`;
  const memberId = `adm-bvp-member-${suffix}`;
  const otherUserId = `adm-bvp-other-user-${suffix}`;
  const invitedEmail = `adm-bvp-invited-${suffix}@example.test`;
  const password = `Adm-Bvp-${suffix}!Pass9`;

  let pool: import('pg').Pool;
  let app: Express;
  let invitationService: import('../invitationService.js').InvitationServiceClass;
  let invitedUserId = '';

  beforeAll(async () => {
    if (!REAL_DB) throw new Error('ADM-BVP-001 requires a real PostgreSQL DATABASE_URL');
    const { Pool } = await import('pg');
    pool = new Pool({ connectionString: DATABASE_URL });

    for (const [id, name] of [
      [orgId, 'ADM BVP tenant'],
      [otherOrgId, 'ADM BVP foreign tenant'],
    ] as const) {
      await pool.query(
        `INSERT INTO organizations
           (id, name, status, is_active, organization_type, plan, trial_expires_at)
         VALUES ($1, $2, 'active', 1, 'PAID', 'enterprise', NOW() + INTERVAL '30 days')`,
        [id, name]
      );
      await pool.query(
        `INSERT INTO organization_billing (id, organization_id, status)
         VALUES ($1, $2, 'ACTIVE') ON CONFLICT (organization_id) DO UPDATE SET status = 'ACTIVE'`,
        [randomUUID(), id]
      );
      await pool.query(
        `INSERT INTO organization_seats
           (id, organization_id, user_id, seat_type, status, base_seats_included,
            total_seats_available, seats_used)
         VALUES ($1, $2, NULL, 'configuration', 'active', 100, 100, 0)`,
        [randomUUID(), id]
      );
    }

    for (const [id, org, role] of [
      [ownerId, orgId, 'OWNER'],
      [owner2Id, orgId, 'OWNER'],
      [memberId, orgId, 'MEMBER'],
      [otherUserId, otherOrgId, 'ADMIN'],
    ] as const) {
      await pool.query(
        `INSERT INTO users (id, organization_id, email, role, status)
         VALUES ($1, $2, $3, $4, 'active')`,
        [id, org, `${id}@example.test`, role]
      );
      await pool.query(
        `INSERT INTO organization_members (id, organization_id, user_id, role, status)
         VALUES ($1, $2, $3, $4, 'ACTIVE')`,
        [randomUUID(), org, id, role]
      );
    }

    const { getDatabase } = await import('../../database/Database.js');
    const { InvitationServiceClass } = await import('../invitationService.js');
    invitationService = new InvitationServiceClass({
      db: getDatabase(),
      sendingService: {
        sendOrgInvitation: async (_email: string, token: string) => ({
          inviteLink: `test://invite/${token}`,
          deliveryStatus: 'SENT' as const,
        }),
        sendProjectInvitation: async (_email: string, _project: string, token: string) =>
          ({ inviteLink: `test://invite/${token}`, deliveryStatus: 'SENT' as const }),
        sendResentInvitation: async (_email: string, token: string) => ({
          inviteLink: `test://invite/${token}`,
          deliveryStatus: 'SENT' as const,
        }),
      } as any,
    });

    const { default: authRoutes } = await import('../../routes/auth.routes.js');
    app = express();
    app.use(express.json());
    app.use('/api/auth', authRoutes);
  }, 60_000);

  afterAll(async () => {
    if (!pool) return;
    await pool.query(`DROP TRIGGER IF EXISTS adm_bvp_reject_audit ON role_change_audit_events`);
    await pool.query(`DROP FUNCTION IF EXISTS adm_bvp_reject_audit()`);
    await pool.query(`DELETE FROM role_change_audit_events WHERE organization_id = ANY($1)`, [
      [orgId, otherOrgId],
    ]);
    await pool.query(
      `DELETE FROM invitation_events WHERE invitation_id IN
       (SELECT id FROM invitations WHERE organization_id = ANY($1))`,
      [[orgId, otherOrgId]]
    );
    await pool.query(`DELETE FROM invitations WHERE organization_id = ANY($1)`, [
      [orgId, otherOrgId],
    ]);
    await pool.query(`DELETE FROM organization_members WHERE organization_id = ANY($1)`, [
      [orgId, otherOrgId],
    ]);
    await pool
      .query(`DELETE FROM refresh_tokens WHERE user_id = ANY($1)`, [
        [[ownerId, owner2Id, memberId, otherUserId, invitedUserId].filter(Boolean)],
      ])
      .catch(() => undefined);
    await pool.query(`DELETE FROM users WHERE organization_id = ANY($1)`, [[orgId, otherOrgId]]);
    await pool.query(`DELETE FROM organization_seats WHERE organization_id = ANY($1)`, [
      [orgId, otherOrgId],
    ]);
    await pool.query(`DELETE FROM organization_billing WHERE organization_id = ANY($1)`, [
      [orgId, otherOrgId],
    ]);
    await pool.query(`DELETE FROM organizations WHERE id = ANY($1)`, [[orgId, otherOrgId]]);
    await pool.end();
  }, 30_000);

  it('denies invitation creation when the actor lacks invitation capability', async () => {
    await expect(
      invitationService.createOrgInvitation({
        organizationId: orgId,
        email: `denied-${invitedEmail}`,
        role: 'MEMBER',
        invitedByUserId: memberId,
      })
    ).rejects.toThrow('Missing required invitation capability');
    const rows = await pool.query(`SELECT id FROM invitations WHERE email = $1`, [
      `denied-${invitedEmail}`,
    ]);
    expect(rows.rowCount).toBe(0);
  });

  it('completes invite -> accept -> role -> new session -> revoke -> new-session denial with durable audit', async () => {
    const invitation = await invitationService.createOrgInvitation({
      organizationId: orgId,
      email: invitedEmail,
      role: 'MEMBER',
      invitedByUserId: ownerId,
    });
    const accepted = await invitationService.acceptInvitation({
      token: invitation.token,
      email: invitedEmail,
      firstName: 'ADM',
      lastName: 'Candidate',
      password,
    });
    invitedUserId = accepted.userId;

    const acceptedState = await pool.query(
      `SELECT i.status, m.role, m.status AS membership_status
         FROM invitations i
         JOIN organization_members m
           ON m.organization_id = i.organization_id AND m.user_id = i.accepted_by_user_id
        WHERE i.id = $1`,
      [invitation.id]
    );
    expect(acceptedState.rows[0]).toMatchObject({
      status: 'accepted',
      role: 'MEMBER',
      membership_status: 'ACTIVE',
    });

    const {
      changeOrganizationMemberRoleAtomicallyViaIam,
      removeOrganizationMemberAtomicallyViaIam,
    } = await import('../orgPeopleIamService.js');
    const promoted = await changeOrganizationMemberRoleAtomicallyViaIam({
      actorId: ownerId,
      actorRole: 'OWNER',
      organizationId: orgId,
      targetMemberId: invitedUserId,
      newRole: 'ADMIN',
    });
    expect(promoted.denied).toBe(false);

    const loginAfterPromotion = await request(app)
      .post('/api/auth/login')
      .send({ email: invitedEmail, password });
    expect(loginAfterPromotion.status).toBe(200);
    expect(loginAfterPromotion.body.user.role).toBe('ADMIN');

    const removed = await removeOrganizationMemberAtomicallyViaIam({
      actorId: ownerId,
      actorRole: 'OWNER',
      organizationId: orgId,
      targetMemberId: invitedUserId,
    });
    expect(removed.denied).toBe(false);

    const loginAfterRevocation = await request(app)
      .post('/api/auth/login')
      .send({ email: invitedEmail, password });
    expect(loginAfterRevocation.status).toBe(403);
    expect(loginAfterRevocation.body.code).toBe('ORG_MEMBERSHIP_REVOKED');

    const audit = await pool.query(
      `SELECT action, before_json, after_json
         FROM role_change_audit_events
        WHERE organization_id = $1 AND resource_id = $2
        ORDER BY created_at`,
      [orgId, invitedUserId]
    );
    expect(audit.rows.map((row) => row.action)).toEqual(['role_change', 'member_removed']);
    const parseAuditJson = (value: unknown) =>
      typeof value === 'string' ? JSON.parse(value) : value;
    expect(parseAuditJson(audit.rows[0].before_json)).toEqual({ role: 'MEMBER' });
    expect(parseAuditJson(audit.rows[0].after_json)).toEqual({ role: 'ADMIN' });

    const inviteEvents = await pool.query(
      `SELECT event_type FROM invitation_events WHERE invitation_id = $1 ORDER BY created_at`,
      [invitation.id]
    );
    expect(inviteEvents.rows.map((row) => row.event_type)).toEqual(
      expect.arrayContaining(['created', 'sent', 'accepted'])
    );
  }, 60_000);

  it('denies a stale claimed OWNER role when the stored membership lacks capability', async () => {
    const { changeOrganizationMemberRoleAtomicallyViaIam } =
      await import('../orgPeopleIamService.js');
    const result = await changeOrganizationMemberRoleAtomicallyViaIam({
      actorId: memberId,
      actorRole: 'OWNER',
      organizationId: orgId,
      targetMemberId: owner2Id,
      newRole: 'MEMBER',
    });
    expect(result).toMatchObject({ denied: true, code: 'CAPABILITY_REQUIRED' });
  });

  it('hides cross-organization targets and writes neither mutation nor audit', async () => {
    const { changeOrganizationMemberRoleAtomicallyViaIam } =
      await import('../orgPeopleIamService.js');
    const result = await changeOrganizationMemberRoleAtomicallyViaIam({
      actorId: ownerId,
      actorRole: 'OWNER',
      organizationId: orgId,
      targetMemberId: otherUserId,
      newRole: 'MEMBER',
    });
    expect(result).toMatchObject({ denied: true, code: 'MEMBER_NOT_FOUND' });
    const foreign = await pool.query(
      `SELECT role FROM organization_members WHERE organization_id = $1 AND user_id = $2`,
      [otherOrgId, otherUserId]
    );
    expect(foreign.rows[0].role).toBe('ADMIN');
    const audit = await pool.query(
      `SELECT id FROM role_change_audit_events WHERE organization_id = $1 AND resource_id = $2`,
      [orgId, otherUserId]
    );
    expect(audit.rowCount).toBe(0);
  });

  it('serializes concurrent owner demotions so one owner always remains', async () => {
    const { changeOrganizationMemberRoleAtomicallyViaIam } =
      await import('../orgPeopleIamService.js');
    const results = await Promise.all([
      changeOrganizationMemberRoleAtomicallyViaIam({
        actorId: ownerId,
        actorRole: 'OWNER',
        organizationId: orgId,
        targetMemberId: ownerId,
        newRole: 'ADMIN',
      }),
      changeOrganizationMemberRoleAtomicallyViaIam({
        actorId: owner2Id,
        actorRole: 'OWNER',
        organizationId: orgId,
        targetMemberId: owner2Id,
        newRole: 'ADMIN',
      }),
    ]);
    expect(results.filter((result) => !result.denied)).toHaveLength(1);
    expect(
      results.filter((result) => result.denied && result.code === 'LAST_OWNER_PROTECTED')
    ).toHaveLength(1);
    const owners = await pool.query(
      `SELECT user_id FROM organization_members WHERE organization_id = $1 AND role = 'OWNER'`,
      [orgId]
    );
    expect(owners.rowCount).toBe(1);
  });

  it('rolls the role mutation back when durable audit persistence fails', async () => {
    const remainingOwner = await pool.query(
      `SELECT user_id FROM organization_members WHERE organization_id = $1 AND role = 'OWNER'`,
      [orgId]
    );
    const actorId = remainingOwner.rows[0].user_id as string;
    await pool.query(`
      CREATE OR REPLACE FUNCTION adm_bvp_reject_audit() RETURNS trigger AS $$
      BEGIN
        IF NEW.resource_id = '${memberId}' THEN RAISE EXCEPTION 'ADM_BVP_AUDIT_FAULT'; END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);
    await pool.query(`
      CREATE TRIGGER adm_bvp_reject_audit
      BEFORE INSERT ON role_change_audit_events
      FOR EACH ROW EXECUTE FUNCTION adm_bvp_reject_audit()
    `);

    const { changeOrganizationMemberRoleAtomicallyViaIam } =
      await import('../orgPeopleIamService.js');
    await expect(
      changeOrganizationMemberRoleAtomicallyViaIam({
        actorId,
        actorRole: 'OWNER',
        organizationId: orgId,
        targetMemberId: memberId,
        newRole: 'ADMIN',
      })
    ).rejects.toThrow('ADM_BVP_AUDIT_FAULT');
    const row = await pool.query(
      `SELECT role FROM organization_members WHERE organization_id = $1 AND user_id = $2`,
      [orgId, memberId]
    );
    expect(row.rows[0].role).toBe('MEMBER');

    await pool.query(`DROP TRIGGER adm_bvp_reject_audit ON role_change_audit_events`);
    await pool.query(`DROP FUNCTION adm_bvp_reject_audit()`);
  });
});
