import { beforeEach, describe, expect, it, vi } from 'vitest';

const query = vi.fn();
const release = vi.fn();
vi.mock('../../database/PostgresDatabase.js', () => ({
  getPoolClientForPinnedTransaction: vi.fn(async () => ({ query, release })),
}));

import {
  authorizeInterviewAssignmentInvitation,
  InterviewInvitationError,
  issueInterviewAssignmentInvitation,
  revokeInterviewAssignmentInvitation,
} from '../interviewAssignmentInvitationService.js';

describe('interviewAssignmentInvitationService security contract', () => {
  beforeEach(() => {
    query.mockReset();
    release.mockReset();
  });

  it('stores only a SHA-256 token digest and advances assignment CAS atomically', async () => {
    query
      .mockResolvedValueOnce({}) // BEGIN
      .mockResolvedValueOnce({ rows: [{ row_version: 4, status: 'assigned' }] })
      .mockResolvedValueOnce({ rowCount: 1 }) // revoke old
      .mockResolvedValueOnce({ rowCount: 1 }) // insert
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ row_version: 5 }] })
      .mockResolvedValueOnce({}); // COMMIT

    const result = await issueInterviewAssignmentInvitation({
      organizationId: 'org-a',
      assignmentId: 'asg-a',
      createdBy: 'manager-a',
      expectedVersion: 4,
      expiresAt: '2099-01-01T00:00:00.000Z',
    });

    expect(result.token).toMatch(/^[a-f0-9]{64}$/);
    expect(result.rowVersion).toBe(5);
    const insertParams = query.mock.calls[3][1] as unknown[];
    expect(insertParams).not.toContain(result.token);
    expect(insertParams[3]).toMatch(/^[a-f0-9]{64}$/);
    expect(insertParams[3]).not.toBe(result.token);
    expect(query.mock.calls.map(([sql]) => String(sql))).toEqual(
      expect.arrayContaining([
        expect.stringContaining('FOR UPDATE'),
        expect.stringContaining('row_version = $3'),
      ])
    );
    expect(release).toHaveBeenCalledOnce();
  });

  it('fails closed on a stale issuance version and rolls back', async () => {
    query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [{ row_version: 8, status: 'assigned' }] })
      .mockResolvedValueOnce({});

    await expect(
      issueInterviewAssignmentInvitation({
        organizationId: 'org-a',
        assignmentId: 'asg-a',
        createdBy: 'manager-a',
        expectedVersion: 7,
      })
    ).rejects.toMatchObject({ code: 'ASSIGNMENT_STALE', status: 409 });
    expect(query.mock.calls.at(-1)?.[0]).toBe('ROLLBACK');
  });

  it.each([
    ['revoked', { revoked_at: '2026-08-15T00:00:00.000Z' }, 'INVITATION_REVOKED'],
    ['consumed replay', { consumed_at: '2026-08-15T00:00:00.000Z' }, 'INVITATION_CONSUMED'],
    ['expired', { expires_at: '2020-01-01T00:00:00.000Z' }, 'INVITATION_EXPIRED'],
    ['lost consume acknowledgement', { status: 'submitted' }, 'INVITATION_CONSUMED'],
  ])('rejects %s tokens without exposing tenant data', async (_label, override, code) => {
    query.mockResolvedValueOnce({
      rows: [
        {
          invitation_id: 'inv-a',
          organization_id: 'org-secret',
          assignment_id: 'asg-secret',
          assignee_user_id: 'user-secret',
          row_version: 2,
          status: 'assigned',
          expires_at: '2099-01-01T00:00:00.000Z',
          revoked_at: null,
          consumed_at: null,
          archived_at: null,
          is_active: 1,
          template_version: 1,
          template_name: 'Safe template',
          ...override,
        },
      ],
    });

    await expect(authorizeInterviewAssignmentInvitation('a'.repeat(64))).rejects.toMatchObject({
      code,
    });
  });

  it('rejects malformed tokens before touching the database', async () => {
    await expect(authorizeInterviewAssignmentInvitation('not-a-token')).rejects.toBeInstanceOf(
      InterviewInvitationError
    );
    expect(query).not.toHaveBeenCalled();
  });

  it('tenant-scopes revoke and increments CAS on one pinned transaction', async () => {
    query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [{ row_version: 9 }] })
      .mockResolvedValueOnce({ rowCount: 1 })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ row_version: 10 }] })
      .mockResolvedValueOnce({});

    const result = await revokeInterviewAssignmentInvitation({
      organizationId: 'org-a',
      assignmentId: 'asg-a',
      revokedBy: 'manager-a',
      expectedVersion: 9,
    });
    expect(result).toEqual({ rowVersion: 10 });
    expect(query.mock.calls[1][1]).toEqual(['asg-a', 'org-a']);
    expect(query.mock.calls[2][1]).toEqual(['asg-a', 'org-a', 'manager-a']);
  });
});
