/**
 * Table Platform notification inbox — ROUTE-level user-scoping / IDOR suite (P7).
 *
 * Asserts that the /notifications endpoints derive the recipient identity
 * (userId + organizationId) EXCLUSIVELY from the auth token, never from the
 * request body/query. A caller can therefore never read or mutate another
 * user's notifications by spoofing ids in the payload.
 *
 * Mounts the REAL table-platform router with mocked auth (injects the caller's
 * token identity), mocked Database (schema-ready + pass-through), and a mocked
 * NotificationInboxService so we can assert the exact (orgId, userId) passed in.
 */
import express, { type Express } from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const CALLER_USER = 'user-caller-1';
const CALLER_ORG = 'org-caller-1';

// Identity injected by the mocked auth middleware (simulates a decoded JWT).
const mockList = vi.fn();
const mockMarkRead = vi.fn();
const mockMarkAllRead = vi.fn();
const mockUnreadCount = vi.fn();

vi.mock('../../utils/Logger.js', () => ({
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

// Database: schema-ready (SELECT 1 FROM tp_bases succeeds) + generic pass-through.
vi.mock('../../database/Database.js', () => ({
  getDatabase: () => ({ query: vi.fn(async () => ({ rows: [] })) }),
}));

// Auth: inject the caller's token identity; body/query cannot override this.
vi.mock('../../middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, _res: any, next: () => void) => {
    req.userId = CALLER_USER;
    req.organizationId = CALLER_ORG;
    next();
  },
  requireSuperAdmin: (_req: any, _res: any, next: () => void) => next(),
}));

vi.mock('../../middleware/serviceAccountAuth.middleware.js', () => ({
  serviceAccountAuth: (_req: any, _res: any, next: () => void) => next(),
  requireServiceAccountScope: (_req: any, _res: any, next: () => void) => next(),
}));

vi.mock('../../middleware/requireAudit.middleware.js', () => ({
  requireAudit: () => (_req: any, _res: any, next: () => void) => next(),
}));

vi.mock('../../services/tablePlatform/NotificationInboxService.js', () => ({
  default: {
    listForUser: (...a: unknown[]) => mockList(...a),
    markRead: (...a: unknown[]) => mockMarkRead(...a),
    markAllRead: (...a: unknown[]) => mockMarkAllRead(...a),
    getUnreadCount: (...a: unknown[]) => mockUnreadCount(...a),
  },
}));

let app: Express;

beforeEach(async () => {
  vi.clearAllMocks();
  vi.resetModules();
  const mod = await import('../table-platform.routes.js');
  app = express();
  app.use(express.json());
  app.use('/api/table-platform', mod.default);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Table Platform notifications — route user-scoping / IDOR', () => {
  it('GET /notifications lists ONLY the token user, ignoring a spoofed userId in the query', async () => {
    mockList.mockResolvedValueOnce({ notifications: [], total: 0, unreadCount: 0 });

    const res = await request(app)
      .get('/api/table-platform/notifications')
      .query({ userId: 'victim-user', orgId: 'victim-org', unreadOnly: 'true' });

    expect(res.status).toBe(200);
    expect(mockList).toHaveBeenCalledTimes(1);
    const [orgArg, userArg] = mockList.mock.calls[0];
    // Identity comes from the token, NOT the spoofed query params.
    expect(orgArg).toBe(CALLER_ORG);
    expect(userArg).toBe(CALLER_USER);
    expect(orgArg).not.toBe('victim-org');
    expect(userArg).not.toBe('victim-user');
  });

  it('POST /notifications/:id/read marks read scoped to the token user, ignoring a spoofed body', async () => {
    mockMarkRead.mockResolvedValueOnce(true);
    mockUnreadCount.mockResolvedValueOnce(0);

    const res = await request(app)
      .post('/api/table-platform/notifications/notif-xyz/read')
      .send({ userId: 'victim-user', orgId: 'victim-org' });

    expect(res.status).toBe(200);
    expect(mockMarkRead).toHaveBeenCalledTimes(1);
    const [idArg, orgArg, userArg] = mockMarkRead.mock.calls[0];
    expect(idArg).toBe('notif-xyz');
    expect(orgArg).toBe(CALLER_ORG);
    expect(userArg).toBe(CALLER_USER);
  });

  it("POST /notifications/:id/read returns 404 when the row is not the caller's (service returns false)", async () => {
    mockMarkRead.mockResolvedValueOnce(false);

    const res = await request(app)
      .post('/api/table-platform/notifications/someone-elses-id/read')
      .send({});

    expect(res.status).toBe(404);
    // Never leaked into unread-count path.
    expect(mockUnreadCount).not.toHaveBeenCalled();
  });

  it('POST /notifications/read-all is scoped to the token user, ignoring a spoofed body', async () => {
    mockMarkAllRead.mockResolvedValueOnce(4);

    const res = await request(app)
      .post('/api/table-platform/notifications/read-all')
      .send({ userId: 'victim-user', orgId: 'victim-org' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ok: true, updated: 4, unreadCount: 0 });
    const [orgArg, userArg] = mockMarkAllRead.mock.calls[0];
    expect(orgArg).toBe(CALLER_ORG);
    expect(userArg).toBe(CALLER_USER);
  });
});
