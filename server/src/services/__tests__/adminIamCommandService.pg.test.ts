/** @vitest-environment node */
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const enabled =
  process.env.RUN_DB_TESTS === '1' && process.env.MOCK_DB === 'false' && !!process.env.DATABASE_URL;
const suite = enabled ? describe : describe.skip;

suite('ADM-MVP-BVP canonical IAM commands real PostgreSQL', () => {
  const suffix = randomUUID().slice(0, 8);
  const org = `adm-cmd-org-${suffix}`;
  const other = `adm-cmd-other-${suffix}`;
  const owner = `adm-cmd-owner-${suffix}`;
  const foreign = `adm-cmd-foreign-${suffix}`;
  const email = `invite-${suffix}@example.test`;
  let pool: Pool;
  let commandInvitation: typeof import('../adminIamCommandService.js').commandInvitation;
  let listAdminInvitations: typeof import('../adminIamCommandService.js').listAdminInvitations;
  let acceptAdminIamInvitation: typeof import('../adminIamCommandService.js').acceptAdminIamInvitation;
  let acceptedUserId = '';

  beforeAll(async () => {
    process.env.DB_TYPE = 'postgres';
    process.env.MOCK_DB = 'false';
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    for (const [id, name] of [
      [org, 'ADM command'],
      [other, 'Other'],
    ] as const)
      await pool.query(
        `INSERT INTO organizations (id,name,status,is_active) VALUES ($1,$2,'active',1)`,
        [id, name]
      );
    for (const [id, organizationId, role] of [
      [owner, org, 'OWNER'],
      [foreign, other, 'ADMIN'],
    ] as const) {
      await pool.query(
        `INSERT INTO users (id,organization_id,email,role,status) VALUES ($1,$2,$3,$4,'active')`,
        [id, organizationId, `${id}@test.invalid`, role]
      );
      await pool.query(
        `INSERT INTO organization_members (id,organization_id,user_id,role,status) VALUES ($1,$2,$3,$4,'ACTIVE')`,
        [randomUUID(), organizationId, id, role]
      );
    }
    ({ commandInvitation, listAdminInvitations, acceptAdminIamInvitation } =
      await import('../adminIamCommandService.js'));
  });

  afterAll(async () => {
    if (!pool) return;
    await pool
      .query(`DROP TRIGGER IF EXISTS adm_cmd_reject_accept ON role_change_audit_events`)
      .catch(() => undefined);
    await pool.query(`DROP FUNCTION IF EXISTS adm_cmd_reject_accept()`).catch(() => undefined);
    await pool.query(
      `DELETE FROM admin_iam_invitation_delivery_attempts WHERE organization_id = ANY($1)`,
      [[org, other]]
    );
    await pool.query(`DELETE FROM admin_iam_invitation_commands WHERE organization_id = ANY($1)`, [
      [org, other],
    ]);
    await pool.query(`DELETE FROM admin_iam_member_commands WHERE organization_id = ANY($1)`, [
      [org, other],
    ]);
    await pool.query(
      `DELETE FROM invitation_events WHERE invitation_id IN (SELECT id FROM invitations WHERE organization_id = ANY($1))`,
      [[org, other]]
    );
    await pool.query(`DELETE FROM invitations WHERE organization_id = ANY($1)`, [[org, other]]);
    await pool.query(`DELETE FROM organization_members WHERE organization_id = ANY($1)`, [
      [org, other],
    ]);
    await pool.query(`DELETE FROM users WHERE organization_id = ANY($1)`, [[org, other]]);
    await pool.query(`DELETE FROM organizations WHERE id = ANY($1)`, [[org, other]]);
    await pool.end();
  });

  it('serializes create, replays the receipt, rejects intent drift and hides foreign tenants', async () => {
    const key = `create-${suffix}`;
    const [a, b] = await Promise.all([
      commandInvitation({ org, actorId: owner, type: 'CREATE', key, email, role: 'MEMBER' }),
      commandInvitation({ org, actorId: owner, type: 'CREATE', key, email, role: 'MEMBER' }),
    ]);
    expect(a.invitation.id).toBe(b.invitation.id);
    expect([a.replayed, b.replayed].sort()).toEqual([false, true]);
    const cold = (await listAdminInvitations(org, owner)).filter((x) => x.email === email);
    expect(cold).toHaveLength(1);
    expect(['SENT', 'FAILED']).toContain(cold[0].delivery);
    await expect(
      commandInvitation({
        org,
        actorId: owner,
        type: 'CREATE',
        key,
        email: `drift-${email}`,
        role: 'MEMBER',
      })
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_PAYLOAD_CONFLICT' });
    await expect(listAdminInvitations(org, foreign)).rejects.toMatchObject({
      code: 'ADMIN_ACCESS_REQUIRED',
    });

    const revokeKey = `revoke-${suffix}`;
    const revoked = await commandInvitation({
      org,
      actorId: owner,
      type: 'REVOKE',
      key: revokeKey,
      invitationId: a.invitation.id,
    });
    const replay = await commandInvitation({
      org,
      actorId: owner,
      type: 'REVOKE',
      key: revokeKey,
      invitationId: a.invitation.id,
    });
    expect(revoked.invitation.status).toBe('revoked');
    expect(replay).toMatchObject({ replayed: true, commandId: revoked.commandId });
  }, 30_000);

  it('atomically accepts once under concurrency and rolls back user/membership on audit failure', async () => {
    const raw = `raw-${randomUUID()}-abcdefghijklmnopqrstuvwxyz`;
    const target = `accept-${suffix}@example.test`;
    await commandInvitation({
      org,
      actorId: owner,
      type: 'CREATE',
      key: `accept-create-${suffix}`,
      email: target,
      role: 'MEMBER',
      rawTokenForTesting: raw,
    });
    const input = {
      organizationId: org,
      rawToken: raw,
      email: target,
      passwordHash: 'hash',
      firstName: 'A',
      lastName: 'User',
    };
    const [a, b] = await Promise.all([
      acceptAdminIamInvitation(input),
      acceptAdminIamInvitation(input),
    ]);
    acceptedUserId = a.userId;
    expect(a.userId).toBe(b.userId);
    expect([a.replayed, b.replayed].sort()).toEqual([false, true]);
    const state = await pool.query(
      `SELECT i.status, m.status FROM invitations i JOIN organization_members m ON m.user_id=i.accepted_by_user_id AND m.organization_id=i.organization_id WHERE i.email=$1`,
      [target]
    );
    expect(state.rows[0]).toMatchObject({ status: 'ACTIVE' });

    const rawFail = `raw-${randomUUID()}-abcdefghijklmnopqrstuvwxyz`;
    const failedEmail = `rollback-${suffix}@example.test`;
    await commandInvitation({
      org,
      actorId: owner,
      type: 'CREATE',
      key: `rollback-create-${suffix}`,
      email: failedEmail,
      role: 'MEMBER',
      rawTokenForTesting: rawFail,
    });
    await pool.query(
      `CREATE OR REPLACE FUNCTION adm_cmd_reject_accept() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='invitation_accepted' THEN RAISE EXCEPTION 'forced audit failure'; END IF; RETURN NEW; END $$`
    );
    await pool.query(
      `CREATE TRIGGER adm_cmd_reject_accept BEFORE INSERT ON role_change_audit_events FOR EACH ROW EXECUTE FUNCTION adm_cmd_reject_accept()`
    );
    await expect(
      acceptAdminIamInvitation({ ...input, rawToken: rawFail, email: failedEmail })
    ).rejects.toThrow('forced audit failure');
    await pool.query(`DROP TRIGGER adm_cmd_reject_accept ON role_change_audit_events`);
    await pool.query(`DROP FUNCTION adm_cmd_reject_accept()`);
    expect((await pool.query(`SELECT id FROM users WHERE email=$1`, [failedEmail])).rowCount).toBe(
      0
    );
    expect(
      (await pool.query(`SELECT status FROM invitations WHERE email=$1`, [failedEmail])).rows[0]
        .status
    ).toBe('pending');
  }, 30_000);

  it('replays role and revoke commands and persists a newest session marker', async () => {
    const {
      changeOrganizationMemberRoleAtomicallyViaIam,
      removeOrganizationMemberAtomicallyViaIam,
    } = await import('../orgPeopleIamService.js');
    const roleKey = `role-${suffix}`;
    const first = await changeOrganizationMemberRoleAtomicallyViaIam({
      actorId: owner,
      actorRole: 'OWNER',
      organizationId: org,
      targetMemberId: acceptedUserId,
      newRole: 'ADMIN',
      expectedRole: 'MEMBER',
      idempotencyKey: roleKey,
    });
    const replay = await changeOrganizationMemberRoleAtomicallyViaIam({
      actorId: owner,
      actorRole: 'OWNER',
      organizationId: org,
      targetMemberId: acceptedUserId,
      newRole: 'ADMIN',
      expectedRole: 'MEMBER',
      idempotencyKey: roleKey,
    });
    expect(first).toMatchObject({ denied: false });
    expect(replay).toMatchObject({ denied: false, replayed: true });
    await pool.query(
      `INSERT INTO revoked_tokens (jti,user_id,expires_at,revoked_at,reason) VALUES ($1,$2,NOW()+INTERVAL '7 days',NOW()-INTERVAL '1 hour','revoke-all')`,
      [`revoke-all-${acceptedUserId}-1`, acceptedUserId]
    );
    const revokeKey = `member-revoke-${suffix}`;
    const removed = await removeOrganizationMemberAtomicallyViaIam({
      actorId: owner,
      actorRole: 'OWNER',
      organizationId: org,
      targetMemberId: acceptedUserId,
      expectedRole: 'ADMIN',
      idempotencyKey: revokeKey,
    });
    const removedReplay = await removeOrganizationMemberAtomicallyViaIam({
      actorId: owner,
      actorRole: 'OWNER',
      organizationId: org,
      targetMemberId: acceptedUserId,
      expectedRole: 'ADMIN',
      idempotencyKey: revokeKey,
    });
    expect(removed).toMatchObject({ denied: false });
    expect(removedReplay).toMatchObject({ denied: false, replayed: true });
    const markers = await pool.query(
      `SELECT jti FROM revoked_tokens WHERE user_id=$1 AND reason='revoke-all' ORDER BY revoked_at DESC,jti DESC LIMIT 1`,
      [acceptedUserId]
    );
    expect(markers.rows[0].jti).not.toBe(`revoke-all-${acceptedUserId}-1`);
  }, 30_000);
});
