/**
 * Cross-tenant isolation regression test for the /my-work/signals feed.
 *
 * FIX (2026-08-25): the feed read at signals.routes.ts previously filtered
 * `notifications` by `user_id` only, even though the table carries
 * `organization_id` (migrations-v2/001_baseline). A user who belongs to more
 * than one organization saw signals generated in an org other than the one
 * active in their token — an isolation break (CHAT-OWN-004).
 *
 * This test proves, at the route-handler level (real Express router, real
 * request/response cycle via supertest — only the DB layer is mocked):
 *   1. GET /signals only returns rows whose organization_id matches the
 *      caller's active org, even when the same user_id also owns a
 *      notification row in a different org.
 *   2. POST /signals/:key/snooze and /dismiss on a key backed by a
 *      notification that belongs to a *different* org return 404 and do
 *      NOT write to my_work_signal_snoozes/dismissals, and dismiss does NOT
 *      call NotificationService.markAsRead for it.
 *   3. The same mutations succeed (200) for a same-org notification key.
 */
import express, { type Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetTableColumns = vi.fn();
const mockQueryAll = vi.fn();
const mockQueryOne = vi.fn();
const mockQueryRun = vi.fn();
const mockMarkAsRead = vi.fn();

vi.mock('../../../utils/dbSchema.js', () => ({
  getTableColumns: (...args: unknown[]) => mockGetTableColumns(...args),
}));
vi.mock('../../../utils/queryHelpers.js', () => ({
  queryAll: (...args: unknown[]) => mockQueryAll(...args),
  queryOne: (...args: unknown[]) => mockQueryOne(...args),
  queryRun: (...args: unknown[]) => mockQueryRun(...args),
}));
vi.mock('../../../services/notificationService.js', () => ({
  default: {
    markAsRead: (...args: unknown[]) => mockMarkAsRead(...args),
  },
}));

import signalsRoutes from '../signals.routes.js';

const USER = 'user-shared-across-orgs';
const ORG_A = 'org-a-active';
const ORG_B = 'org-b-other';

// The same user_id owns a notification in each org — this is the exact
// shape that lets a multi-org user hit the bug: same user, two orgs.
const NOTIF_ORG_A = {
  id: 'notif-in-org-a',
  type: 'AI_RECOMMENDATION',
  title: 'Org A signal',
  body: 'from org a',
  severity: 'INFO',
  entityType: null,
  entityId: null,
  projectId: null,
  projectName: null,
  createdAt: '2026-08-25T10:00:00.000Z',
  organization_id: ORG_A,
  user_id: USER,
};
const NOTIF_ORG_B = {
  id: 'notif-in-org-b',
  type: 'AI_RECOMMENDATION',
  title: 'Org B signal',
  body: 'from org b',
  severity: 'INFO',
  entityType: null,
  entityId: null,
  projectId: null,
  projectName: null,
  createdAt: '2026-08-25T11:00:00.000Z',
  organization_id: ORG_B,
  user_id: USER,
};

const NOTIF_TABLE_COLS = new Map(
  [
    'id',
    'user_id',
    'type',
    'title',
    'message',
    'read',
    'created_at',
    'severity',
    'entity_type',
    'entity_id',
    'project_id',
    'project_name',
    'body',
    'organization_id',
  ].map((c) => [c, { name: c }])
);

function createApp(activeOrgId: string): Express {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => {
    req.userId = USER;
    req.organizationId = activeOrgId;
    next();
  });
  app.use('/api/my-work', signalsRoutes);
  return app;
}

describe('GET /my-work/signals — organization isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetTableColumns.mockImplementation((table: string) =>
      Promise.resolve(table === 'notifications' ? NOTIF_TABLE_COLS : new Map([['x', {}]]))
    );
    mockQueryOne.mockResolvedValue(null); // no muted-types prefs row
    mockQueryAll.mockImplementation(async (sql: string, params: unknown[]) => {
      if (sql.includes('my_work_signal_snoozes')) return [];
      if (sql.includes('my_work_signal_dismissals')) return [];
      if (sql.includes('FROM notifications')) {
        // Assert the query is actually scoped by organization_id, not just
        // user_id — this is the crux of the fix.
        expect(sql).toContain('AND organization_id = ?');
        expect(params).toEqual([USER, ORG_A]);
        return [NOTIF_ORG_A, NOTIF_ORG_B].filter((n) => n.organization_id === params[1]);
      }
      return [];
    });
  });

  it('never returns a same-user notification created in a different organization', async () => {
    const res = await request(createApp(ORG_A)).get('/api/my-work/signals');
    expect(res.status).toBe(200);
    const keys = res.body.signals.map((s: any) => s.key);
    expect(keys).toContain('notification:notif-in-org-a');
    expect(keys).not.toContain('notification:notif-in-org-b');
    expect(res.body.signals.every((s: any) => s.title !== 'Org B signal')).toBe(true);
  });
});

describe('POST /my-work/signals/:key/snooze and /dismiss — cross-org mutation guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetTableColumns.mockImplementation((table: string) =>
      Promise.resolve(table === 'notifications' ? NOTIF_TABLE_COLS : new Map([['x', {}]]))
    );
  });

  it('snooze on a key backed by another org\'s notification returns 404 and does not write', async () => {
    // Ownership check queries `notifications` scoped to (id, user_id, organization_id).
    mockQueryOne.mockImplementation(async (sql: string, params: unknown[]) => {
      if (sql.includes('FROM notifications')) {
        expect(sql).toContain('organization_id = ?');
        expect(params).toEqual(['notif-in-org-b', USER, ORG_A]);
        return null; // not found for org A — it belongs to org B
      }
      return null;
    });

    const res = await request(createApp(ORG_A))
      .post('/api/my-work/signals/notification:notif-in-org-b/snooze')
      .send({ preset: 'tomorrow' });

    expect(res.status).toBe(404);
    expect(mockQueryRun).not.toHaveBeenCalled();
  });

  it('dismiss on a key backed by another org\'s notification returns 404, does not write, and does not mark it read', async () => {
    mockQueryOne.mockImplementation(async (sql: string, params: unknown[]) => {
      if (sql.includes('FROM notifications')) {
        expect(params).toEqual(['notif-in-org-b', USER, ORG_A]);
        return null;
      }
      return null;
    });

    const res = await request(createApp(ORG_A)).post(
      '/api/my-work/signals/notification:notif-in-org-b/dismiss'
    );

    expect(res.status).toBe(404);
    expect(mockQueryRun).not.toHaveBeenCalled();
    expect(mockMarkAsRead).not.toHaveBeenCalled();
  });

  it('dismiss on a same-org notification key succeeds and marks it read', async () => {
    mockQueryOne.mockImplementation(async (sql: string, params: unknown[]) => {
      if (sql.includes('FROM notifications')) {
        expect(params).toEqual(['notif-in-org-a', USER, ORG_A]);
        return { id: 'notif-in-org-a' };
      }
      return null;
    });
    mockQueryRun.mockResolvedValue({ changes: 1 });

    const res = await request(createApp(ORG_A)).post(
      '/api/my-work/signals/notification:notif-in-org-a/dismiss'
    );

    expect(res.status).toBe(200);
    expect(mockQueryRun).toHaveBeenCalled();
    expect(mockMarkAsRead).toHaveBeenCalledWith('notif-in-org-a', USER);
  });

  it('snooze on a non-notification (prediction) key skips the ownership check entirely', async () => {
    mockQueryOne.mockResolvedValue(null);
    mockQueryRun.mockResolvedValue({ changes: 1 });

    const res = await request(createApp(ORG_A))
      .post('/api/my-work/signals/predict_overdue_task-1/snooze')
      .send({ preset: '1h' });

    expect(res.status).toBe(200);
    expect(mockQueryRun).toHaveBeenCalled();
  });
});
