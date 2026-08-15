import fs from 'node:fs/promises';
import path from 'node:path';
import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import PostgresDatabase from '../../database/PostgresDatabase.js';
import {
  authorizeInterviewAssignmentInvitation,
  consumeInterviewAssignmentInvitation,
  issueInterviewAssignmentInvitation,
  revokeInterviewAssignmentInvitation,
} from '../interviewAssignmentInvitationService.js';

const REAL_PG =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  String(process.env.DATABASE_URL || '').startsWith('postgres');

const suite = REAL_PG ? describe : describe.skip;

suite('Interview assignment invitations — disposable PostgreSQL', () => {
  const admin = new Client({ connectionString: process.env.DATABASE_URL });

  beforeAll(async () => {
    await admin.connect();
    await admin.query(`
      CREATE TABLE interview_library_templates (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL
      );
      CREATE TABLE interview_assignments (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        assignee_user_id TEXT NOT NULL,
        template_id TEXT NOT NULL REFERENCES interview_library_templates(id),
        template_version INTEGER NOT NULL DEFAULT 1,
        status TEXT NOT NULL DEFAULT 'assigned',
        session_id TEXT,
        archived_at TIMESTAMPTZ,
        is_active INTEGER DEFAULT 1,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
      INSERT INTO interview_library_templates(id, name) VALUES ('tpl-a', 'External discovery');
      INSERT INTO interview_assignments
        (id, organization_id, assignee_user_id, template_id)
      VALUES
        ('asg-a', 'org-a', 'user-a', 'tpl-a'),
        ('asg-b', 'org-b', 'user-b', 'tpl-a'),
        ('asg-expired', 'org-a', 'user-a', 'tpl-a');
    `);
    const migration = await fs.readFile(
      path.resolve(
        process.cwd(),
        'server/migrations/20260901_interview_assignment_invitation_cas.sql'
      ),
      'utf8'
    );
    await admin.query(migration);
    await admin.query(migration); // idempotency proof on the same fresh schema
  });

  afterAll(async () => {
    await (PostgresDatabase as any).close?.();
    await admin.end();
  });

  it('allows exactly one concurrent issuer for the same observed assignment version', async () => {
    const attempts = await Promise.allSettled([
      issueInterviewAssignmentInvitation({
        organizationId: 'org-a',
        assignmentId: 'asg-a',
        createdBy: 'manager-a',
        expectedVersion: 1,
      }),
      issueInterviewAssignmentInvitation({
        organizationId: 'org-a',
        assignmentId: 'asg-a',
        createdBy: 'manager-a',
        expectedVersion: 1,
      }),
    ]);
    expect(attempts.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(attempts.filter((result) => result.status === 'rejected')).toHaveLength(1);
    const issued = attempts.find(
      (result) => result.status === 'fulfilled'
    ) as PromiseFulfilledResult<{
      token: string;
      expiresAt: string;
      rowVersion: number;
    }>;
    const authority = await authorizeInterviewAssignmentInvitation(issued.value.token);
    expect(authority).toMatchObject({ assignmentId: 'asg-a', rowVersion: 2 });

    const stored = await admin.query(
      `SELECT token_hash, char_length(token_hash) AS length
         FROM interview_assignment_invitations WHERE assignment_id = 'asg-a' AND revoked_at IS NULL`
    );
    expect(stored.rows).toHaveLength(1);
    expect(Number(stored.rows[0].length)).toBe(64);
    expect(stored.rows[0].token_hash).not.toBe(issued.value.token);
  });

  it('tenant-scopes revoke and makes the bearer unusable', async () => {
    const issued = await issueInterviewAssignmentInvitation({
      organizationId: 'org-b',
      assignmentId: 'asg-b',
      createdBy: 'manager-b',
      expectedVersion: 1,
    });
    await expect(
      revokeInterviewAssignmentInvitation({
        organizationId: 'org-a',
        assignmentId: 'asg-b',
        revokedBy: 'manager-a',
        expectedVersion: 2,
      })
    ).rejects.toMatchObject({ code: 'ASSIGNMENT_STALE' });
    await revokeInterviewAssignmentInvitation({
      organizationId: 'org-b',
      assignmentId: 'asg-b',
      revokedBy: 'manager-b',
      expectedVersion: 2,
    });
    await expect(authorizeInterviewAssignmentInvitation(issued.token)).rejects.toMatchObject({
      code: 'INVITATION_REVOKED',
    });
  });

  it('rejects expiry and atomically blocks consume replay/stale version', async () => {
    const expired = await issueInterviewAssignmentInvitation({
      organizationId: 'org-a',
      assignmentId: 'asg-expired',
      createdBy: 'manager-a',
      expectedVersion: 1,
      expiresAt: new Date(Date.now() + 150).toISOString(),
    });
    await new Promise((resolve) => setTimeout(resolve, 200));
    await expect(authorizeInterviewAssignmentInvitation(expired.token)).rejects.toMatchObject({
      code: 'INVITATION_EXPIRED',
    });

    const active = await admin.query(
      `SELECT id, assignment_id FROM interview_assignment_invitations
       WHERE assignment_id = 'asg-a' AND revoked_at IS NULL AND consumed_at IS NULL`
    );
    const invitation = active.rows[0];
    await expect(
      consumeInterviewAssignmentInvitation({
        invitationId: invitation.id,
        assignmentId: invitation.assignment_id,
        expectedVersion: 999,
      })
    ).rejects.toMatchObject({ code: 'ASSIGNMENT_STALE' });
    await consumeInterviewAssignmentInvitation({
      invitationId: invitation.id,
      assignmentId: invitation.assignment_id,
      expectedVersion: 2,
    });
    await expect(
      consumeInterviewAssignmentInvitation({
        invitationId: invitation.id,
        assignmentId: invitation.assignment_id,
        expectedVersion: 2,
      })
    ).rejects.toMatchObject({ code: 'ASSIGNMENT_STALE' });
  });
});
