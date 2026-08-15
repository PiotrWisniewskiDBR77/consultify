import crypto from 'node:crypto';
import { v4 as uuidv4 } from 'uuid';

import { getPoolClientForPinnedTransaction } from '../database/PostgresDatabase.js';

const RAW_TOKEN_BYTES = 32;
const RAW_TOKEN_PATTERN = /^[a-f0-9]{64}$/i;
const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export class InterviewInvitationError extends Error {
  constructor(
    public readonly code:
      | 'INVITATION_INVALID'
      | 'INVITATION_EXPIRED'
      | 'INVITATION_REVOKED'
      | 'INVITATION_CONSUMED'
      | 'ASSIGNMENT_STALE'
      | 'ASSIGNMENT_UNAVAILABLE',
    public readonly status: number
  ) {
    super(code);
  }
}

const hashToken = (rawToken: string): string =>
  crypto.createHash('sha256').update(rawToken, 'utf8').digest('hex');

const normalizeToken = (rawToken: unknown): string => {
  const token = typeof rawToken === 'string' ? rawToken.trim() : '';
  if (!RAW_TOKEN_PATTERN.test(token)) throw new InterviewInvitationError('INVITATION_INVALID', 404);
  return token.toLowerCase();
};

export interface InterviewInvitationAuthority {
  invitationId: string;
  assignmentId: string;
  organizationId: string;
  assigneeUserId: string;
  rowVersion: number;
  status: string;
  templateName: string;
  templateVersion: number;
  sessionId: string | null;
}

function assertUsable(row: any, now: Date): void {
  if (!row) throw new InterviewInvitationError('INVITATION_INVALID', 404);
  if (row.revoked_at) throw new InterviewInvitationError('INVITATION_REVOKED', 410);
  if (row.consumed_at) throw new InterviewInvitationError('INVITATION_CONSUMED', 409);
  if (new Date(row.expires_at).getTime() <= now.getTime()) {
    throw new InterviewInvitationError('INVITATION_EXPIRED', 410);
  }
  // Lost-ack reconciliation: if the canonical assignment reached submitted
  // but the process died before stamping consumed_at, the business state is
  // authoritative and the bearer still fails closed as already consumed.
  if (String(row.status) === 'submitted') {
    throw new InterviewInvitationError('INVITATION_CONSUMED', 409);
  }
  if (
    row.archived_at ||
    row.is_active === 0 ||
    ['approved', 'completed'].includes(String(row.status))
  ) {
    throw new InterviewInvitationError('ASSIGNMENT_UNAVAILABLE', 409);
  }
}

export async function issueInterviewAssignmentInvitation(input: {
  organizationId: string;
  assignmentId: string;
  createdBy: string;
  expectedVersion: number;
  expiresAt?: string;
}): Promise<{ token: string; expiresAt: string; rowVersion: number }> {
  const expiresAt = input.expiresAt || new Date(Date.now() + DEFAULT_TTL_MS).toISOString();
  if (!Number.isInteger(input.expectedVersion) || input.expectedVersion < 1) {
    throw new InterviewInvitationError('ASSIGNMENT_STALE', 409);
  }
  if (new Date(expiresAt).getTime() <= Date.now()) {
    throw new InterviewInvitationError('INVITATION_EXPIRED', 400);
  }

  const rawToken = crypto.randomBytes(RAW_TOKEN_BYTES).toString('hex');
  const tokenHash = hashToken(rawToken);
  const client = await getPoolClientForPinnedTransaction();
  try {
    await client.query('BEGIN');
    const assignmentResult = await client.query(
      `SELECT id, row_version, status, archived_at, is_active
         FROM interview_assignments
        WHERE id = $1 AND organization_id = $2
        FOR UPDATE`,
      [input.assignmentId, input.organizationId]
    );
    const assignment = assignmentResult.rows[0];
    if (!assignment || assignment.archived_at || assignment.is_active === 0) {
      throw new InterviewInvitationError('ASSIGNMENT_UNAVAILABLE', 404);
    }
    if (Number(assignment.row_version) !== input.expectedVersion) {
      throw new InterviewInvitationError('ASSIGNMENT_STALE', 409);
    }
    if (['submitted', 'approved', 'completed'].includes(String(assignment.status))) {
      throw new InterviewInvitationError('ASSIGNMENT_UNAVAILABLE', 409);
    }

    await client.query(
      `UPDATE interview_assignment_invitations
          SET revoked_at = CURRENT_TIMESTAMP, revoked_by = $3
        WHERE assignment_id = $1 AND organization_id = $2
          AND revoked_at IS NULL AND consumed_at IS NULL`,
      [input.assignmentId, input.organizationId, input.createdBy]
    );
    await client.query(
      `INSERT INTO interview_assignment_invitations
         (id, organization_id, assignment_id, token_hash, expires_at, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [uuidv4(), input.organizationId, input.assignmentId, tokenHash, expiresAt, input.createdBy]
    );
    const next = await client.query(
      `UPDATE interview_assignments
          SET row_version = row_version + 1, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND organization_id = $2 AND row_version = $3
        RETURNING row_version`,
      [input.assignmentId, input.organizationId, input.expectedVersion]
    );
    if (next.rowCount !== 1) throw new InterviewInvitationError('ASSIGNMENT_STALE', 409);
    await client.query('COMMIT');
    return { token: rawToken, expiresAt, rowVersion: Number(next.rows[0].row_version) };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function authorizeInterviewAssignmentInvitation(
  rawToken: unknown,
  now = new Date()
): Promise<InterviewInvitationAuthority> {
  const tokenHash = hashToken(normalizeToken(rawToken));
  const client = await getPoolClientForPinnedTransaction();
  try {
    const result = await client.query(
      `SELECT i.id AS invitation_id, i.organization_id, i.assignment_id,
              i.expires_at, i.revoked_at, i.consumed_at,
              a.assignee_user_id, a.row_version, a.status, a.session_id,
              a.archived_at, a.is_active, a.template_version,
              COALESCE(t.name, '') AS template_name
         FROM interview_assignment_invitations i
         JOIN interview_assignments a
           ON a.id = i.assignment_id AND a.organization_id = i.organization_id
         LEFT JOIN interview_library_templates t ON t.id = a.template_id
        WHERE i.token_hash = $1`,
      [tokenHash]
    );
    const row = result.rows[0];
    assertUsable(row, now);
    return {
      invitationId: row.invitation_id,
      assignmentId: row.assignment_id,
      organizationId: row.organization_id,
      assigneeUserId: row.assignee_user_id,
      rowVersion: Number(row.row_version),
      status: String(row.status),
      templateName: String(row.template_name || ''),
      templateVersion: Number(row.template_version || 1),
      sessionId: row.session_id || null,
    };
  } finally {
    client.release();
  }
}

export async function consumeInterviewAssignmentInvitation(input: {
  invitationId: string;
  assignmentId: string;
  expectedVersion: number;
}): Promise<void> {
  const client = await getPoolClientForPinnedTransaction();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      `UPDATE interview_assignment_invitations i
          SET consumed_at = CURRENT_TIMESTAMP
         FROM interview_assignments a
        WHERE i.id = $1 AND i.assignment_id = $2
          AND a.id = i.assignment_id AND a.organization_id = i.organization_id
          AND a.row_version = $3
          AND i.revoked_at IS NULL AND i.consumed_at IS NULL
          AND i.expires_at > CURRENT_TIMESTAMP
        RETURNING i.id`,
      [input.invitationId, input.assignmentId, input.expectedVersion]
    );
    if (result.rowCount !== 1) throw new InterviewInvitationError('ASSIGNMENT_STALE', 409);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function revokeInterviewAssignmentInvitation(input: {
  organizationId: string;
  assignmentId: string;
  revokedBy: string;
  expectedVersion: number;
}): Promise<{ rowVersion: number }> {
  const client = await getPoolClientForPinnedTransaction();
  try {
    await client.query('BEGIN');
    const locked = await client.query(
      `SELECT row_version FROM interview_assignments
        WHERE id = $1 AND organization_id = $2 FOR UPDATE`,
      [input.assignmentId, input.organizationId]
    );
    if (Number(locked.rows[0]?.row_version) !== input.expectedVersion) {
      throw new InterviewInvitationError('ASSIGNMENT_STALE', 409);
    }
    await client.query(
      `UPDATE interview_assignment_invitations
          SET revoked_at = CURRENT_TIMESTAMP, revoked_by = $3
        WHERE assignment_id = $1 AND organization_id = $2
          AND revoked_at IS NULL AND consumed_at IS NULL`,
      [input.assignmentId, input.organizationId, input.revokedBy]
    );
    const next = await client.query(
      `UPDATE interview_assignments SET row_version = row_version + 1, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND organization_id = $2 AND row_version = $3 RETURNING row_version`,
      [input.assignmentId, input.organizationId, input.expectedVersion]
    );
    if (next.rowCount !== 1) throw new InterviewInvitationError('ASSIGNMENT_STALE', 409);
    await client.query('COMMIT');
    return { rowVersion: Number(next.rows[0].row_version) };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
