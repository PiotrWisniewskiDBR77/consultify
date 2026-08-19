import crypto from 'node:crypto';
import { v4 as uuidv4 } from 'uuid';

import { withPinnedPostgresTransaction } from '../database/PostgresDatabase.js';
import { get as dbGet, run as dbRun } from '../utils/DbPromise.js';
import { InvitationSendingService } from './invitation/InvitationSendingService.js';

type CommandType = 'CREATE' | 'RESEND' | 'REVOKE';
type DeliveryState = 'SENT' | 'FAILED' | 'NOT_ATTEMPTED';
export type AdminInvitation = {
  id: string;
  email: string;
  role: string;
  status: string;
  expiresAt: string | null;
  resendCount: number;
  lastResentAt: string | null;
  delivery: DeliveryState;
};

const sender = new InvitationSendingService();
const digest = (value: unknown) =>
  crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const token = () => crypto.randomBytes(32).toString('hex');
const tokenHash = (raw: string) => crypto.createHash('sha256').update(raw).digest('hex');

async function assertActor(tx: any, organizationId: string, actorId: string) {
  const actor = await tx.queryOne(
    `SELECT role FROM organization_members
      WHERE organization_id = ? AND user_id = ? AND UPPER(status) = 'ACTIVE' FOR UPDATE`,
    [organizationId, actorId]
  );
  if (!actor || !['OWNER', 'ADMIN'].includes(String(actor.role).toUpperCase()))
    throw Object.assign(new Error('Tenant admin membership required'), {
      code: 'ADMIN_ACCESS_REQUIRED',
      status: 403,
    });
}

function map(row: any): AdminInvitation {
  return {
    id: String(row.id),
    email: String(row.email),
    role: String(row.role_to_assign || row.role).toUpperCase(),
    status: String(row.status).toLowerCase(),
    expiresAt: row.expires_at ? String(row.expires_at) : null,
    resendCount: Number(row.resend_count || 0),
    lastResentAt: row.last_resent_at ? String(row.last_resent_at) : null,
    delivery: (row.delivery_state || 'NOT_ATTEMPTED') as DeliveryState,
  };
}

export async function listAdminInvitations(
  org: string,
  actorId: string
): Promise<AdminInvitation[]> {
  return withPinnedPostgresTransaction(
    async (tx) => {
      await assertActor(tx, org, actorId);
      const rows = await tx.queryAll<any>(
        `SELECT i.*, d.delivery_state FROM invitations i
       LEFT JOIN LATERAL (SELECT delivery_state FROM admin_iam_invitation_delivery_attempts
         WHERE organization_id = i.organization_id AND invitation_id = i.id ORDER BY created_at DESC LIMIT 1) d ON TRUE
       WHERE i.organization_id = ? AND COALESCE(i.invitation_type, 'ORG') = 'ORG'
       ORDER BY i.created_at DESC`,
        [org]
      );
      return rows.map(map);
    },
    { organizationId: org }
  );
}

async function delivery(params: {
  org: string;
  invitationId: string;
  commandId: string;
  raw: string;
  email: string;
  resend: boolean;
}) {
  const dispatched = await sender.dispatchAdminIamInvitation(
    params.email,
    params.raw,
    params.resend
  );
  const state = dispatched.state;
  const failure = dispatched.code;
  await dbRun(
    `INSERT INTO admin_iam_invitation_delivery_attempts
    (id, organization_id, invitation_id, command_id, delivery_state, failure_code) VALUES (?, ?, ?, ?, ?, ?)`,
    [uuidv4(), params.org, params.invitationId, params.commandId, state, failure],
    { fallback: false }
  );
  return state;
}

export async function commandInvitation(p: {
  org: string;
  actorId: string;
  type: CommandType;
  key: string;
  email?: string;
  role?: string;
  invitationId?: string;
  rawTokenForTesting?: string;
}) {
  const intent = {
    type: p.type,
    email: p.email?.trim().toLowerCase(),
    role: p.role?.toUpperCase(),
    invitationId: p.invitationId,
  };
  const intentDigest = digest(intent);
  const raw = p.rawTokenForTesting || token();
  const hashed = tokenHash(raw);
  const commandId = uuidv4();
  const outcome = await withPinnedPostgresTransaction(
    async (tx) => {
      await tx.queryOne(`SELECT pg_advisory_xact_lock(hashtext(?))`, [p.org]);
      await tx.queryOne(`SELECT pg_advisory_xact_lock(hashtext(?))`, [`${p.org}:${p.key}`]);
      const replay = await tx.queryOne<any>(
        `SELECT * FROM admin_iam_invitation_commands WHERE organization_id = ? AND idempotency_key = ?`,
        [p.org, p.key]
      );
      if (replay) {
        if (replay.intent_digest !== intentDigest)
          throw Object.assign(new Error('Idempotency key payload conflict'), {
            code: 'IDEMPOTENCY_PAYLOAD_CONFLICT',
            status: 409,
          });
        return {
          replayed: true,
          commandId: replay.id,
          invitationId: replay.invitation_id,
          raw: null as string | null,
          email: null as string | null,
        };
      }
      await assertActor(tx, p.org, p.actorId);
      let invitation: any;
      if (p.type === 'CREATE') {
        invitation = await tx.queryOne<any>(
          `SELECT * FROM invitations WHERE organization_id = ? AND LOWER(email) = ? AND status = 'pending' FOR UPDATE`,
          [p.org, intent.email]
        );
        if (invitation)
          throw Object.assign(new Error('Pending invitation already exists'), {
            code: 'INVITATION_EXISTS',
            status: 409,
          });
        const invitationId = uuidv4();
        await tx.queryRun(
          `INSERT INTO invitations
        (id, organization_id, email, role, role_to_assign, token, token_hash, status, invited_by, expires_at, invitation_type, metadata)
        VALUES (?, ?, ?, ?, ?, NULL, ?, 'pending', ?, CURRENT_TIMESTAMP + INTERVAL '7 days', 'ORG', ?)`,
          [
            invitationId,
            p.org,
            intent.email,
            intent.role || 'MEMBER',
            intent.role || 'MEMBER',
            hashed,
            p.actorId,
            JSON.stringify({ adminIamCommandId: commandId }),
          ]
        );
        invitation = await tx.queryOne<any>(
          `SELECT * FROM invitations WHERE id = ? AND organization_id = ?`,
          [invitationId, p.org]
        );
        await tx.queryRun(
          `INSERT INTO invitation_events (id, invitation_id, event_type, performed_by_user_id, metadata) VALUES (?, ?, 'created', ?, ?)`,
          [uuidv4(), invitationId, p.actorId, JSON.stringify({ commandId })]
        );
      } else {
        invitation = await tx.queryOne<any>(
          `SELECT * FROM invitations WHERE id = ? AND organization_id = ? FOR UPDATE`,
          [p.invitationId, p.org]
        );
        if (!invitation)
          throw Object.assign(new Error('Invitation not found'), {
            code: 'INVITATION_NOT_FOUND',
            status: 404,
          });
        if (p.type === 'RESEND') {
          if (invitation.status !== 'pending')
            throw Object.assign(new Error('Only pending invitations can be resent'), {
              code: 'INVITATION_NOT_PENDING',
              status: 409,
            });
          if (Number(invitation.resend_count || 0) >= 3)
            throw Object.assign(new Error('Invitation resend limit reached'), {
              code: 'RESEND_LIMIT',
              status: 409,
            });
          const recent =
            invitation.last_resent_at &&
            Date.now() - new Date(invitation.last_resent_at).getTime() < 300000;
          if (recent)
            throw Object.assign(new Error('Wait five minutes before resending'), {
              code: 'RESEND_COOLDOWN',
              status: 409,
            });
          await tx.queryRun(
            `UPDATE invitations SET token_hash = ?, expires_at = CURRENT_TIMESTAMP + INTERVAL '7 days', resend_count = COALESCE(resend_count,0)+1, last_resent_at = CURRENT_TIMESTAMP WHERE id = ? AND organization_id = ?`,
            [hashed, p.invitationId, p.org]
          );
          await tx.queryRun(
            `INSERT INTO invitation_events (id, invitation_id, event_type, performed_by_user_id, metadata) VALUES (?, ?, 'resent', ?, ?)`,
            [uuidv4(), p.invitationId, p.actorId, JSON.stringify({ commandId })]
          );
        } else {
          if (invitation.status !== 'pending')
            throw Object.assign(new Error('Only pending invitations can be revoked'), {
              code: 'INVITATION_NOT_PENDING',
              status: 409,
            });
          await tx.queryRun(
            `UPDATE invitations SET status = 'revoked' WHERE id = ? AND organization_id = ?`,
            [p.invitationId, p.org]
          );
          await tx.queryRun(
            `INSERT INTO invitation_events (id, invitation_id, event_type, performed_by_user_id, metadata) VALUES (?, ?, 'revoked', ?, ?)`,
            [uuidv4(), p.invitationId, p.actorId, JSON.stringify({ commandId })]
          );
        }
      }
      const invitationId = String(invitation.id);
      const receipt = { commandId, type: p.type, invitationId, organizationId: p.org };
      await tx.queryRun(
        `INSERT INTO admin_iam_invitation_commands
      (id, organization_id, actor_id, command_type, idempotency_key, intent_digest, invitation_id, receipt_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          commandId,
          p.org,
          p.actorId,
          p.type,
          p.key,
          intentDigest,
          invitationId,
          JSON.stringify(receipt),
        ]
      );
      return {
        replayed: false,
        commandId,
        invitationId,
        raw: p.type === 'REVOKE' ? null : raw,
        email: String(invitation.email),
      };
    },
    { organizationId: p.org }
  );
  if (outcome.raw && outcome.email)
    await delivery({
      org: p.org,
      invitationId: outcome.invitationId,
      commandId: outcome.commandId,
      raw: outcome.raw,
      email: outcome.email,
      resend: p.type === 'RESEND',
    });
  const view = (await listAdminInvitations(p.org, p.actorId)).find(
    (x) => x.id === outcome.invitationId
  );
  if (!view) throw new Error('Invitation receipt read-back failed');
  return { replayed: outcome.replayed, commandId: outcome.commandId, invitation: view };
}

export async function acceptAdminIamInvitation(p: {
  organizationId: string;
  rawToken: string;
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  jobTitle?: string;
  siteLocation?: string;
  department?: string;
}) {
  const hashed = tokenHash(p.rawToken);
  return withPinnedPostgresTransaction(
    async (tx) => {
      await tx.queryOne(`SELECT pg_advisory_xact_lock(hashtext(?))`, [p.organizationId]);
      const invitation = await tx.queryOne<any>(
        `SELECT * FROM invitations WHERE token_hash = ? AND organization_id = ? FOR UPDATE`,
        [hashed, p.organizationId]
      );
      if (!invitation) throw new Error('Invalid invitation token');
      const metadata = JSON.parse(String(invitation.metadata || '{}'));
      if (!metadata.adminIamCommandId || String(invitation.invitation_type || 'ORG') !== 'ORG')
        throw new Error('Invitation is not a canonical admin IAM invitation');
      if (String(invitation.email).toLowerCase() !== p.email.trim().toLowerCase())
        throw new Error('Email address does not match invitation');
      if (invitation.status === 'accepted' && invitation.accepted_by_user_id) {
        const acceptedUser = await tx.queryOne<any>(
          `SELECT id FROM users WHERE id = ? AND LOWER(email) = ?`,
          [invitation.accepted_by_user_id, p.email.trim().toLowerCase()]
        );
        if (acceptedUser)
          return {
            success: true,
            replayed: true,
            userId: String(acceptedUser.id),
            isNewUser: false,
            organizationId: String(invitation.organization_id),
            role: String(invitation.role_to_assign || invitation.role),
          };
      }
      if (invitation.status !== 'pending') throw new Error(`Invitation is ${invitation.status}`);
      if (new Date(invitation.expires_at).getTime() <= Date.now())
        throw new Error('Invitation has expired');
      const email = p.email.trim().toLowerCase();
      const role = String(invitation.role_to_assign || invitation.role || 'MEMBER').toUpperCase();
      let user = await tx.queryOne<any>(
        `SELECT id, organization_id, status, password FROM users WHERE LOWER(email) = ? FOR UPDATE`,
        [email]
      );
      let isNewUser = false;
      if (user && String(user.organization_id) !== String(invitation.organization_id))
        throw new Error('User with this email belongs to another organization');
      if (user && !(String(user.status).toLowerCase() === 'pending' && !user.password))
        throw new Error('User is already a member of this organization');
      if (!user) {
        const userId = uuidv4();
        isNewUser = true;
        await tx.queryRun(
          `INSERT INTO users
        (id, organization_id, email, password, first_name, last_name, role, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'active')`,
          [userId, invitation.organization_id, email, p.passwordHash, p.firstName, p.lastName, role]
        );
        user = { id: userId };
      } else {
        await tx.queryRun(
          `UPDATE users SET password = ?, first_name = ?, last_name = ?, role = ?, status = 'active' WHERE id = ?`,
          [p.passwordHash, p.firstName, p.lastName, role, user.id]
        );
      }
      await tx.queryRun(
        `INSERT INTO organization_members (id, organization_id, user_id, role, status)
      VALUES (?, ?, ?, ?, 'ACTIVE') ON CONFLICT (organization_id,user_id) DO UPDATE SET role = EXCLUDED.role, status = 'ACTIVE'`,
        [uuidv4(), invitation.organization_id, user.id, role]
      );
      const accepted = await tx.queryRun(
        `UPDATE invitations SET status = 'accepted', accepted_at = CURRENT_TIMESTAMP, accepted_by_user_id = ? WHERE id = ? AND status = 'pending'`,
        [user.id, invitation.id]
      );
      if (accepted.changes !== 1) throw new Error('Invitation accept lost concurrency race');
      await tx.queryRun(
        `INSERT INTO invitation_events (id, invitation_id, event_type, performed_by_user_id, metadata) VALUES (?, ?, 'accepted', ?, ?)`,
        [
          uuidv4(),
          invitation.id,
          user.id,
          JSON.stringify({ adminIamCommandId: metadata.adminIamCommandId }),
        ]
      );
      await tx.queryRun(
        `INSERT INTO role_change_audit_events
      (id,organization_id,actor_id,action,resource_type,resource_id,before_json,after_json,created_at)
      VALUES (?, ?, ?, 'invitation_accepted', 'organization_member', ?, NULL, ?, CURRENT_TIMESTAMP)`,
        [
          uuidv4(),
          invitation.organization_id,
          user.id,
          user.id,
          JSON.stringify({ role, invitationId: invitation.id }),
        ]
      );
      return {
        success: true,
        replayed: false,
        userId: String(user.id),
        isNewUser,
        organizationId: String(invitation.organization_id),
        role,
      };
    },
    { organizationId: p.organizationId }
  );
}
