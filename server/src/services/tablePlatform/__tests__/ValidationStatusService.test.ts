/**
 * Unit tests for ValidationStatusService (Block B · EPIC-T9 · Sprint 3).
 *
 * Coverage:
 *   - getAllowedTransitions matrix
 *   - isAdminOnlyTransition policy
 *   - setStatus:
 *       * happy paths for each allowed transition
 *       * no-op when current === next
 *       * RECORD_NOT_FOUND when SELECT empty
 *       * INVALID_VALIDATION_TRANSITION on disallowed pair
 *       * TRANSITION_REQUIRES_SUPER_ADMIN on admin-only without isSuperAdmin
 *       * audit emit shape
 *       * confidence recompute is invoked best-effort and never blocks state mutation
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockQuery = vi.fn();
const mockLogEvent = vi.fn();
const mockRecompute = vi.fn();

vi.mock('../../../database/Database.js', () => ({
  getDatabase: () => ({ query: mockQuery }),
}));

vi.mock('../../../utils/Logger.js', () => ({
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

vi.mock('../AuditService.js', () => ({
  default: {
    logEvent: (...args: unknown[]) => mockLogEvent(...args),
  },
}));

vi.mock('../ConfidenceScoringService.js', () => ({
  default: {
    recompute: (...args: unknown[]) => mockRecompute(...args),
  },
}));

import validationStatusService from '../ValidationStatusService.js';

const RECORD_ID = 'rec-uuid-1';
const ACTOR = 'user-actor-1';

describe('ValidationStatusService.getAllowedTransitions', () => {
  it('exposes the documented state machine', () => {
    expect(validationStatusService.getAllowedTransitions('unverified')).toEqual([
      'verified',
      'flagged',
    ]);
    expect(validationStatusService.getAllowedTransitions('verified')).toEqual([
      'flagged',
      'unverified',
    ]);
    expect(validationStatusService.getAllowedTransitions('flagged')).toEqual([
      'verified',
      'unverified',
    ]);
  });

  it('returns a fresh array (caller cannot mutate the policy)', () => {
    const a = validationStatusService.getAllowedTransitions('unverified');
    a.push('flagged'); // mutate the copy
    expect(validationStatusService.getAllowedTransitions('unverified')).toEqual([
      'verified',
      'flagged',
    ]);
  });
});

describe('ValidationStatusService.isAdminOnlyTransition', () => {
  it('only the *→unverified transitions require super-admin', () => {
    expect(validationStatusService.isAdminOnlyTransition('verified', 'unverified')).toBe(true);
    expect(validationStatusService.isAdminOnlyTransition('flagged', 'unverified')).toBe(true);
    expect(validationStatusService.isAdminOnlyTransition('unverified', 'verified')).toBe(false);
    expect(validationStatusService.isAdminOnlyTransition('unverified', 'flagged')).toBe(false);
    expect(validationStatusService.isAdminOnlyTransition('verified', 'flagged')).toBe(false);
    expect(validationStatusService.isAdminOnlyTransition('flagged', 'verified')).toBe(false);
  });
});

describe('ValidationStatusService.setStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLogEvent.mockResolvedValue(undefined);
    mockRecompute.mockResolvedValue({ applied: true });
  });

  it('rejects empty recordId', async () => {
    await expect(
      validationStatusService.setStatus('', 'verified', { actorUserId: ACTOR })
    ).rejects.toMatchObject({ code: 'INVALID_INPUT' });
  });

  it('rejects invalid status', async () => {
    await expect(
      validationStatusService.setStatus(RECORD_ID, 'bogus' as 'verified', {
        actorUserId: ACTOR,
      })
    ).rejects.toMatchObject({ code: 'INVALID_INPUT' });
  });

  it('rejects missing actorUserId', async () => {
    await expect(
      validationStatusService.setStatus(RECORD_ID, 'verified', {
        actorUserId: '',
      })
    ).rejects.toMatchObject({ code: 'INVALID_INPUT' });
  });

  it('returns RECORD_NOT_FOUND when SELECT is empty', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await expect(
      validationStatusService.setStatus(RECORD_ID, 'verified', { actorUserId: ACTOR })
    ).rejects.toMatchObject({ code: 'RECORD_NOT_FOUND' });
  });

  it('returns no-op when current === next (changed=false)', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ validation_status: 'verified' }] });
    const result = await validationStatusService.setStatus(RECORD_ID, 'verified', {
      actorUserId: ACTOR,
    });
    expect(result).toEqual({
      recordId: RECORD_ID,
      previous: 'verified',
      next: 'verified',
      changed: false,
    });
    // No UPDATE, no audit, no recompute on no-op.
    expect(mockQuery).toHaveBeenCalledTimes(1);
    expect(mockLogEvent).not.toHaveBeenCalled();
    expect(mockRecompute).not.toHaveBeenCalled();
  });

  it('rejects transition not in matrix', async () => {
    // verified → verified is allowed (no-op), so we test verified → "frozen"
    // is INVALID_INPUT (caught earlier). The actual disallowed transition we
    // can construct is to mock current = verified and ask for verified — that
    // is no-op. There is no disallowed pair within the 3 valid statuses, so
    // we exercise the path by mocking a pseudo current outside the matrix.
    mockQuery.mockResolvedValueOnce({ rows: [{ validation_status: 'unknown' }] });
    await expect(
      validationStatusService.setStatus(RECORD_ID, 'verified', { actorUserId: ACTOR })
    ).rejects.toMatchObject({ code: 'INVALID_VALIDATION_TRANSITION' });
  });

  it('rejects admin-only transition without super-admin', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ validation_status: 'verified' }] });
    await expect(
      validationStatusService.setStatus(RECORD_ID, 'unverified', { actorUserId: ACTOR })
    ).rejects.toMatchObject({ code: 'TRANSITION_REQUIRES_SUPER_ADMIN' });
  });

  it('allows admin-only transition for super-admin and recomputes confidence', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ validation_status: 'flagged' }] }) // SELECT
      .mockResolvedValueOnce({ rows: [{ id: RECORD_ID }] }); // UPDATE

    const result = await validationStatusService.setStatus(RECORD_ID, 'unverified', {
      actorUserId: ACTOR,
      isSuperAdmin: true,
      note: 'reset after triage',
    });

    expect(result).toEqual({
      recordId: RECORD_ID,
      previous: 'flagged',
      next: 'unverified',
      changed: true,
    });
    expect(mockQuery).toHaveBeenCalledTimes(2);
    expect(mockLogEvent).toHaveBeenCalledTimes(1);
    const auditArgs = mockLogEvent.mock.calls[0];
    expect(auditArgs[0]).toBe('record_validation_status_changed');
    expect(auditArgs[1]).toBe('record_validation');
    expect(auditArgs[2]).toBe(RECORD_ID);
    expect(auditArgs[3]).toBe(ACTOR);
    expect(auditArgs[4]).toEqual({ validation_status: 'flagged' });
    expect(auditArgs[5]).toEqual({ validation_status: 'unverified' });
    expect(auditArgs[6]).toEqual({ note: 'reset after triage', is_super_admin: true });

    expect(mockRecompute).toHaveBeenCalledWith(RECORD_ID);
  });

  it('happy path unverified → verified for non-admin actor', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ validation_status: 'unverified' }] })
      .mockResolvedValueOnce({ rows: [{ id: RECORD_ID }] });

    const result = await validationStatusService.setStatus(RECORD_ID, 'verified', {
      actorUserId: ACTOR,
    });
    expect(result.changed).toBe(true);
    expect(result.next).toBe('verified');
    expect(mockLogEvent).toHaveBeenCalledTimes(1);
    expect(mockRecompute).toHaveBeenCalledWith(RECORD_ID);
  });

  it('survives audit emit failure (state mutation already committed)', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ validation_status: 'unverified' }] })
      .mockResolvedValueOnce({ rows: [{ id: RECORD_ID }] });
    mockLogEvent.mockRejectedValueOnce(new Error('audit down'));

    const result = await validationStatusService.setStatus(RECORD_ID, 'flagged', {
      actorUserId: ACTOR,
    });
    expect(result.changed).toBe(true);
    expect(mockRecompute).toHaveBeenCalled();
  });

  it('survives confidence recompute failure (state and audit already committed)', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ validation_status: 'unverified' }] })
      .mockResolvedValueOnce({ rows: [{ id: RECORD_ID }] });
    mockRecompute.mockRejectedValueOnce(new Error('recompute down'));

    const result = await validationStatusService.setStatus(RECORD_ID, 'flagged', {
      actorUserId: ACTOR,
    });
    expect(result.changed).toBe(true);
    expect(mockLogEvent).toHaveBeenCalledTimes(1);
  });

  it('throws RECORD_NOT_FOUND if record disappears between SELECT and UPDATE', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ validation_status: 'unverified' }] })
      .mockResolvedValueOnce({ rows: [] });
    await expect(
      validationStatusService.setStatus(RECORD_ID, 'verified', { actorUserId: ACTOR })
    ).rejects.toMatchObject({ code: 'RECORD_NOT_FOUND' });
  });
});

describe('ValidationStatusService.getStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null for missing record', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const result = await validationStatusService.getStatus(RECORD_ID);
    expect(result).toBeNull();
  });

  it("defaults null status to 'unverified'", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ validation_status: null }] });
    const result = await validationStatusService.getStatus(RECORD_ID);
    expect(result).toBe('unverified');
  });

  it('returns the actual status when set', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ validation_status: 'flagged' }] });
    const result = await validationStatusService.getStatus(RECORD_ID);
    expect(result).toBe('flagged');
  });
});
