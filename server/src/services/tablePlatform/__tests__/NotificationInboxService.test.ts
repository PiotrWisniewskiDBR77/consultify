/**
 * Unit tests for NotificationInboxService — the read side for
 * tp_audit_events rows that RecordWatchService.notifyWatchers() and
 * RecordCommentService @mention delivery write with `notified_user_id` set.
 *
 * Coverage:
 *   - listForUser: SQL shape (WHERE notified_user_id = $1), pagination,
 *     unreadOnly filter, total/unread counts
 *   - getUnreadCount: SQL shape
 *   - markAsRead: happy path, wrong-owner rejection, idempotent re-read
 *   - markAllAsRead: rowCount passthrough
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

describe('NotificationInboxService', () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  describe('listForUser', () => {
    it('queries tp_audit_events filtered by notified_user_id, with pagination + counts', async () => {
      mockQuery
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'audit-1',
              event_type: 'watch_update',
              entity_type: 'record',
              entity_id: 'rec-1',
              actor_id: 'user-b',
              metadata: { table_id: 'tbl-1' },
              read_at: null,
              created_at: '2026-07-04T00:00:00.000Z',
            },
          ],
          rowCount: 1,
        })
        .mockResolvedValueOnce({ rows: [{ total: '3' }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [{ unread: '2' }], rowCount: 1 });

      const result = await notificationInboxService.listForUser('user-a', {
        limit: 10,
        offset: 0,
      });

      expect(result.total).toBe(3);
      expect(result.unread).toBe(2);
      expect(result.notifications).toHaveLength(1);
      expect(result.notifications[0].read).toBe(false);
      expect(result.notifications[0].metadata).toEqual({ table_id: 'tbl-1' });

      const listCall = mockQuery.mock.calls[0];
      expect(String(listCall[0])).toContain('WHERE notified_user_id = $1');
      expect(listCall[1]).toEqual(['user-a', 10, 0]);
    });

    it('unreadOnly=true adds the read_at IS NULL filter to list + total queries', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })
        .mockResolvedValueOnce({ rows: [{ total: '0' }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [{ unread: '0' }], rowCount: 1 });

      await notificationInboxService.listForUser('user-a', { unreadOnly: true });

      expect(String(mockQuery.mock.calls[0][0])).toContain('AND read_at IS NULL');
      expect(String(mockQuery.mock.calls[1][0])).toContain('AND read_at IS NULL');
    });

    it('maps read=true when read_at is set', async () => {
      mockQuery
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'audit-2',
              event_type: 'mention',
              entity_type: 'record',
              entity_id: 'rec-2',
              actor_id: 'user-a',
              metadata: {},
              read_at: '2026-07-04T01:00:00.000Z',
              created_at: '2026-07-04T00:00:00.000Z',
            },
          ],
          rowCount: 1,
        })
        .mockResolvedValueOnce({ rows: [{ total: '1' }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [{ unread: '0' }], rowCount: 1 });

      const result = await notificationInboxService.listForUser('user-c');
      expect(result.notifications[0].read).toBe(true);
      expect(result.notifications[0].readAt).toBe('2026-07-04T01:00:00.000Z');
    });
  });

  describe('getUnreadCount', () => {
    it('returns the parsed unread count scoped to the user', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ unread: '5' }], rowCount: 1 });
      const count = await notificationInboxService.getUnreadCount('user-a');
      expect(count).toBe(5);
      expect(mockQuery.mock.calls[0][1]).toEqual(['user-a']);
    });
  });

  describe('markAsRead', () => {
    it('updates read_at and returns true on success', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ id: 'audit-1' }], rowCount: 1 });
      const ok = await notificationInboxService.markAsRead('audit-1', 'user-a');
      expect(ok).toBe(true);
      expect(String(mockQuery.mock.calls[0][0])).toContain('notified_user_id = $2');
    });

    it('returns false when the row belongs to a different user (no fallback match)', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // UPDATE misses (already read or wrong owner)
        .mockResolvedValueOnce({ rows: [], rowCount: 0 }); // ownership check also misses
      const ok = await notificationInboxService.markAsRead('audit-1', 'user-x');
      expect(ok).toBe(false);
    });

    it('is idempotent: re-marking an already-read owned notification still returns true', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // UPDATE misses (read_at already set)
        .mockResolvedValueOnce({ rows: [{ id: 'audit-1' }], rowCount: 1 }); // but it IS owned
      const ok = await notificationInboxService.markAsRead('audit-1', 'user-a');
      expect(ok).toBe(true);
    });
  });

  describe('markAllAsRead', () => {
    it('returns the affected row count', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 4 });
      const count = await notificationInboxService.markAllAsRead('user-a');
      expect(count).toBe(4);
    });
  });
});
