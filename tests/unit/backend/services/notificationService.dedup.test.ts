/**
 * NotificationService — idempotency / dedup layer (HARVARD H6.3, task #44).
 *
 * Pins the behaviour: two logically-identical notifications (same type +
 * recipient + entity reference) fired inside the dedup window collapse into a
 * SINGLE real send (one INSERT into `notifications`, one channel dispatch),
 * while a distinct notification, a different recipient, or an expired window
 * each still send. Fail-open: if the dedup table cannot be created, sends
 * always go through.
 *
 * The DB is fully mocked; the mock reproduces the (dedupe_key, user_id) PRIMARY
 * KEY collision that the real table relies on, so the test exercises the actual
 * claim/skip logic rather than a reimplementation.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ------------------------------------------------------------------
// Mock DB: an in-memory stand-in for the two tables the dedup path and
// the notification insert touch. Only the SQL shapes issued by
// notificationService are handled.
// ------------------------------------------------------------------
interface DedupRow {
  dedupe_key: string;
  user_id: string;
  notification_id: string;
  expires_at: string;
}

class MockDb {
  dedupTableExists = true; // flip to false to exercise fail-open
  dedup: DedupRow[] = [];
  notificationInserts: string[] = []; // ids inserted into `notifications`
  deliveryLog: string[] = [];

  reset() {
    this.dedup = [];
    this.notificationInserts = [];
    this.deliveryLog = [];
  }

  async get<T = any>(sql: string, params: any[] = []): Promise<T | null> {
    if (/FROM notification_dedup/i.test(sql)) {
      const [key, userId] = params;
      const row = this.dedup.find((r) => r.dedupe_key === key && r.user_id === userId);
      return (row ? { notification_id: row.notification_id } : null) as T | null;
    }
    // notification_types config / preferences / users email / slack lookups → none
    return null;
  }

  async all<T = any>(): Promise<T[]> {
    return [] as T[];
  }

  async run(sql: string, params: any[] = []): Promise<{ changes: number }> {
    if (/CREATE TABLE IF NOT EXISTS notification_dedup/i.test(sql)) {
      if (!this.dedupTableExists) throw new Error('read-only replica: cannot create table');
      return { changes: 0 };
    }
    if (/CREATE (UNIQUE )?INDEX/i.test(sql)) return { changes: 0 };

    if (/DELETE FROM notification_dedup/i.test(sql)) {
      const [key, userId, nowIso] = params;
      const before = this.dedup.length;
      this.dedup = this.dedup.filter(
        (r) => !(r.dedupe_key === key && r.user_id === userId && r.expires_at <= nowIso)
      );
      return { changes: before - this.dedup.length };
    }

    if (/INSERT INTO notification_dedup/i.test(sql)) {
      const [dedupe_key, user_id, notification_id, , , , expires_at] = params;
      const clash = this.dedup.find((r) => r.dedupe_key === dedupe_key && r.user_id === user_id);
      if (clash) {
        // Reproduce the PRIMARY KEY (dedupe_key, user_id) violation.
        throw new Error('UNIQUE constraint failed: notification_dedup.dedupe_key, user_id');
      }
      this.dedup.push({ dedupe_key, user_id, notification_id, expires_at });
      return { changes: 1 };
    }

    if (/INSERT INTO notifications\b/i.test(sql)) {
      // First bound param is the notification id.
      this.notificationInserts.push(String(params[0]));
      return { changes: 1 };
    }

    if (/INSERT INTO notification_delivery_log/i.test(sql)) {
      this.deliveryLog.push(String(params[0]));
      return { changes: 1 };
    }

    return { changes: 0 };
  }
}

const mockDb = new MockDb();

vi.mock('../../../../server/src/database/Database.js', () => ({
  getDatabase: vi.fn(async () => mockDb),
}));

// notifications table has the columns send() writes (subset is fine).
vi.mock('../../../../server/src/utils/dbSchema.js', () => ({
  getTableColumns: vi.fn(
    async () =>
      new Set([
        'id',
        'user_id',
        'organization_id',
        'type',
        'title',
        'body',
        'message',
        'severity',
        'priority',
        'entity_type',
        'entity_id',
        'related_object_type',
        'related_object_id',
        'data',
        'metadata',
        'channels_sent',
        'created_at',
        'read',
        'is_read',
      ])
  ),
}));

// Channel side-effects are irrelevant here — stub them out so send() is pure DB.
vi.mock('../../../../server/src/services/emailService.js', () => ({ send: vi.fn() }));
vi.mock('../../../../server/src/services/slack/progressFeed.js', () => ({
  enqueueProgressEvent: vi.fn(),
}));
vi.mock('../../../../server/src/services/slackService.js', () => ({
  SlackServiceClass: class {
    sendSystemAlert = vi.fn();
    sendNewFeedbackAlert = vi.fn();
  },
}));

// The global tests/setup.ts stubs notificationService with a fake
// { sendNotification, createNotification, create } shape (aliased from the
// legacy `server/services/...` specifier). Undo that here so we exercise the
// REAL dedup logic. `vi.unmock` on the same specifier the setup used, plus a
// dynamic import of the actual module, restores the singleton.
vi.unmock('../server/services/notificationService.js');

const { default: notificationService } = await vi.importActual<
  typeof import('../../../../server/src/services/notificationService.js')
>('../../../../server/src/services/notificationService.js');

const baseInput = () => ({
  userId: 'user-1',
  organizationId: 'org-1',
  type: 'TASK_ASSIGNED',
  title: 'Task assigned',
  body: 'You have a new task',
  relatedObjectType: 'task',
  relatedObjectId: 'task-42',
  channels: ['in_app'],
  bypassPreferences: true,
});

describe('NotificationService dedup / idempotency', () => {
  beforeEach(() => {
    mockDb.reset();
    mockDb.dedupTableExists = true;
    // Reset the module-level dedup-table-ready cache between tests.
    (notificationService as any).dedupTableReady = null;
    vi.useRealTimers();
  });

  it('collapses an identical duplicate into ONE real send', async () => {
    const id1 = await notificationService.send(baseInput() as any);
    const id2 = await notificationService.send(baseInput() as any);

    // Only one row was actually inserted into `notifications`.
    expect(mockDb.notificationInserts).toHaveLength(1);
    // The duplicate returns the id of the first (surviving) notification.
    expect(id2).toBe(id1);
    // One live dedup slot.
    expect(mockDb.dedup).toHaveLength(1);
  });

  it('sends both when entity references differ', async () => {
    await notificationService.send(baseInput() as any);
    await notificationService.send({ ...baseInput(), relatedObjectId: 'task-99' } as any);
    expect(mockDb.notificationInserts).toHaveLength(2);
  });

  it('sends both when the type differs', async () => {
    await notificationService.send(baseInput() as any);
    await notificationService.send({ ...baseInput(), type: 'TASK_OVERDUE' } as any);
    expect(mockDb.notificationInserts).toHaveLength(2);
  });

  it('sends both for the same event to different recipients', async () => {
    await notificationService.send(baseInput() as any);
    await notificationService.send({ ...baseInput(), userId: 'user-2' } as any);
    expect(mockDb.notificationInserts).toHaveLength(2);
  });

  it('always sends when dedupe is explicitly disabled', async () => {
    await notificationService.send({ ...baseInput(), dedupe: false } as any);
    await notificationService.send({ ...baseInput(), dedupe: false } as any);
    expect(mockDb.notificationInserts).toHaveLength(2);
  });

  it('sends again after the dedup window has expired', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-03T10:00:00.000Z'));
    await notificationService.send({ ...baseInput(), dedupeWindowSeconds: 30 } as any);
    expect(mockDb.notificationInserts).toHaveLength(1);

    // Advance beyond the 30s window → prior slot is expired and reclaimed.
    vi.setSystemTime(new Date('2026-07-03T10:01:00.000Z'));
    await notificationService.send({ ...baseInput(), dedupeWindowSeconds: 30 } as any);
    expect(mockDb.notificationInserts).toHaveLength(2);
  });

  it('dedups distinct content only when explicit key matches (entity-less)', async () => {
    const noEntity = {
      userId: 'user-1',
      organizationId: 'org-1',
      type: 'SYSTEM_ALERT',
      title: 'A',
      body: 'B',
      channels: ['in_app'],
      bypassPreferences: true,
      dedupeKey: 'shared-key',
    };
    await notificationService.send({ ...noEntity, title: 'A' } as any);
    // Same explicit key, different title → still a duplicate (key wins).
    await notificationService.send({ ...noEntity, title: 'Z' } as any);
    expect(mockDb.notificationInserts).toHaveLength(1);
  });

  it('fails open (always sends) when the dedup table cannot be created', async () => {
    mockDb.dedupTableExists = false;
    await notificationService.send(baseInput() as any);
    await notificationService.send(baseInput() as any);
    // No dedup possible → both sends land.
    expect(mockDb.notificationInserts).toHaveLength(2);
  });
});
