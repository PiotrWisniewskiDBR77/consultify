/**
 * Unit tests for NotificationInboxService (Block P7 — notification inbox).
 *
 * Coverage:
 *   - create: happy path, missing required fields → null, DB error swallowed → null
 *   - listForUser: org+user scoping, unreadOnly filter, unreadCount independence,
 *     limit clamping, empty-arg guard
 *   - getUnreadCount: scoping + integer parse
 *   - markRead: IDOR scoping (id+org+user), already-read still-yours → true,
 *     not-yours/missing → false
 *   - markAllRead: scoping + rowCount return
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockQuery = vi.fn();

vi.mock('../../../database/Database.js', () => ({
  getDatabase: () => ({ query: mockQuery }),
}));

vi.mock('../../../utils/Logger.js', () => ({
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import notificationInboxService from '../NotificationInboxService.js';

const ORG_ID = 'org-tenant-1';
const OTHER_ORG_ID = 'org-tenant-2';
const USER_ID = 'user-recipient-1';
const OTHER_USER_ID = 'user-attacker-2';
const NOTIF_ID = 'notif-uuid-1';

function notifRow(overrides: Record<string, unknown> = {}) {
  return {
    id: NOTIF_ID,
    org_id: ORG_ID,
    user_id: USER_ID,
    base_id: 'base-1',
    table_id: 'table-1',
    record_id: 'rec-1',
    type: 'mention',
    payload: { actorId: 'user-author-9' },
    read_at: null,
    created_at: '2026-07-04T10:00:00.000Z',
    ...overrides,
  };
}

describe('NotificationInboxService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── create ─────────────────────────────────────────────────────────────────

  it('create inserts a row with org/user/type and returns the mapped notification', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [notifRow()] });

    const result = await notificationInboxService.create({
      orgId: ORG_ID,
      userId: USER_ID,
      type: 'mention',
      baseId: 'base-1',
      tableId: 'table-1',
      recordId: 'rec-1',
      payload: { actorId: 'user-author-9' },
    });

    expect(result).not.toBeNull();
    expect(result?.id).toBe(NOTIF_ID);
    expect(result?.payload).toEqual({ actorId: 'user-author-9' });
    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toMatch(/INSERT INTO tp_notifications/);
    expect(params[0]).toBe(ORG_ID);
    expect(params[1]).toBe(USER_ID);
    expect(params[5]).toBe('mention');
  });

  it('create returns null without touching the DB when org/user/type missing', async () => {
    const r1 = await notificationInboxService.create({
      orgId: '',
      userId: USER_ID,
      type: 'mention',
    });
    const r2 = await notificationInboxService.create({
      orgId: ORG_ID,
      userId: '',
      type: 'mention',
    });
    expect(r1).toBeNull();
    expect(r2).toBeNull();
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('create swallows DB errors and returns null (never breaks the parent mutation)', async () => {
    mockQuery.mockRejectedValueOnce(new Error('boom'));
    const result = await notificationInboxService.create({
      orgId: ORG_ID,
      userId: USER_ID,
      type: 'record_changed',
    });
    expect(result).toBeNull();
  });

  it('create parses a stringified jsonb payload from the DB', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [notifRow({ payload: JSON.stringify({ action: 'update' }) })],
    });
    const result = await notificationInboxService.create({
      orgId: ORG_ID,
      userId: USER_ID,
      type: 'record_changed',
    });
    expect(result?.payload).toEqual({ action: 'update' });
  });

  // ── listForUser ──────────────────────────────────────────────────────────────

  it('listForUser scopes on org_id + user_id and returns notifications/total/unreadCount', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [notifRow()] }) // list
      .mockResolvedValueOnce({ rows: [{ total: '1' }] }) // total
      .mockResolvedValueOnce({ rows: [{ cnt: '1' }] }); // unread

    const result = await notificationInboxService.listForUser(ORG_ID, USER_ID);

    expect(result.notifications).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.unreadCount).toBe(1);

    const [listSql, listParams] = mockQuery.mock.calls[0];
    expect(listSql).toContain('org_id = $1');
    expect(listSql).toContain('user_id = $2');
    expect(listParams[0]).toBe(ORG_ID);
    expect(listParams[1]).toBe(USER_ID);
  });

  it('listForUser unreadOnly=true adds a read_at IS NULL filter to list AND total', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ total: '0' }] })
      .mockResolvedValueOnce({ rows: [{ cnt: '0' }] });

    await notificationInboxService.listForUser(ORG_ID, USER_ID, { unreadOnly: true });

    const [listSql] = mockQuery.mock.calls[0];
    const [totalSql] = mockQuery.mock.calls[1];
    expect(listSql).toContain('read_at IS NULL');
    expect(totalSql).toContain('read_at IS NULL');
  });

  it('listForUser unreadCount is computed independently of the unreadOnly filter', async () => {
    // Even with unreadOnly=false, unreadCount query always filters read_at IS NULL.
    mockQuery
      .mockResolvedValueOnce({ rows: [notifRow(), notifRow({ id: 'n2', read_at: 'x' })] })
      .mockResolvedValueOnce({ rows: [{ total: '2' }] })
      .mockResolvedValueOnce({ rows: [{ cnt: '1' }] });

    const result = await notificationInboxService.listForUser(ORG_ID, USER_ID);
    expect(result.total).toBe(2);
    expect(result.unreadCount).toBe(1);
    const [unreadSql] = mockQuery.mock.calls[2];
    expect(unreadSql).toContain('read_at IS NULL');
  });

  it('listForUser clamps limit to the max and floors negative offset to 0', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ total: '0' }] })
      .mockResolvedValueOnce({ rows: [{ cnt: '0' }] });

    await notificationInboxService.listForUser(ORG_ID, USER_ID, { limit: 9999, offset: -5 });
    const [, listParams] = mockQuery.mock.calls[0];
    expect(listParams[2]).toBe(100); // MAX_LIMIT
    expect(listParams[3]).toBe(0);
  });

  it('listForUser returns empty result without querying when org or user missing', async () => {
    const r = await notificationInboxService.listForUser('', USER_ID);
    expect(r).toEqual({ notifications: [], total: 0, unreadCount: 0 });
    expect(mockQuery).not.toHaveBeenCalled();
  });

  // ── getUnreadCount ───────────────────────────────────────────────────────────

  it('getUnreadCount scopes on org+user and returns an integer', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ cnt: '7' }] });
    const n = await notificationInboxService.getUnreadCount(ORG_ID, USER_ID);
    expect(n).toBe(7);
    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toContain('org_id = $1');
    expect(sql).toContain('user_id = $2');
    expect(sql).toContain('read_at IS NULL');
    expect(params).toEqual([ORG_ID, USER_ID]);
  });

  // ── markRead (IDOR) ──────────────────────────────────────────────────────────

  it('markRead scopes the UPDATE on id + org + user (IDOR guard)', async () => {
    mockQuery.mockResolvedValueOnce({ rowCount: 1 });
    const ok = await notificationInboxService.markRead(NOTIF_ID, ORG_ID, USER_ID);
    expect(ok).toBe(true);
    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toMatch(/UPDATE tp_notifications/);
    expect(sql).toContain('id = $1');
    expect(sql).toContain('org_id = $2');
    expect(sql).toContain('user_id = $3');
    expect(params).toEqual([NOTIF_ID, ORG_ID, USER_ID]);
  });

  it('markRead returns false when the row is not addressed to the caller (cross-user IDOR attempt)', async () => {
    // UPDATE matches 0 rows, and the existence check (also scoped) finds nothing.
    mockQuery
      .mockResolvedValueOnce({ rowCount: 0 })
      .mockResolvedValueOnce({ rows: [] });
    const ok = await notificationInboxService.markRead(NOTIF_ID, ORG_ID, OTHER_USER_ID);
    expect(ok).toBe(false);
    // Existence check must also be user-scoped.
    const [existsSql, existsParams] = mockQuery.mock.calls[1];
    expect(existsSql).toContain('user_id = $3');
    expect(existsParams).toEqual([NOTIF_ID, ORG_ID, OTHER_USER_ID]);
  });

  it('markRead returns false when the row belongs to another org (cross-tenant IDOR attempt)', async () => {
    mockQuery
      .mockResolvedValueOnce({ rowCount: 0 })
      .mockResolvedValueOnce({ rows: [] });
    const ok = await notificationInboxService.markRead(NOTIF_ID, OTHER_ORG_ID, USER_ID);
    expect(ok).toBe(false);
  });

  it('markRead returns true when the row is already read but still belongs to the caller', async () => {
    // UPDATE ... AND read_at IS NULL matches 0 rows, but existence check confirms ownership.
    mockQuery
      .mockResolvedValueOnce({ rowCount: 0 })
      .mockResolvedValueOnce({ rows: [{ '?column?': 1 }] });
    const ok = await notificationInboxService.markRead(NOTIF_ID, ORG_ID, USER_ID);
    expect(ok).toBe(true);
  });

  it('markRead returns false without querying when args are missing', async () => {
    const ok = await notificationInboxService.markRead('', ORG_ID, USER_ID);
    expect(ok).toBe(false);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  // ── markAllRead ──────────────────────────────────────────────────────────────

  it('markAllRead scopes on org+user and returns the number of rows flipped', async () => {
    mockQuery.mockResolvedValueOnce({ rowCount: 3 });
    const n = await notificationInboxService.markAllRead(ORG_ID, USER_ID);
    expect(n).toBe(3);
    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toMatch(/UPDATE tp_notifications/);
    expect(sql).toContain('org_id = $1');
    expect(sql).toContain('user_id = $2');
    expect(sql).toContain('read_at IS NULL');
    expect(params).toEqual([ORG_ID, USER_ID]);
  });

  it('markAllRead returns 0 without querying when org or user missing', async () => {
    const n = await notificationInboxService.markAllRead(ORG_ID, '');
    expect(n).toBe(0);
    expect(mockQuery).not.toHaveBeenCalled();
  });
});
