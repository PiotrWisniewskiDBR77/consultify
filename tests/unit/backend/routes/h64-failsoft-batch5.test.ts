/**
 * H6.4 batch 5 — superadmin.routes.ts (customer lifecycle/playbooks/contracts) +
 * notifications/notifications.routes.ts + notifications.routes.ts (legacy
 * top-level duplicate router) — standard fail-soft/fail-closed cleanup.
 *
 * Continuation of h64-failsoft.test.ts (W4) / batch2 / batch3 / batch4. This
 * batch closes out the remaining bare `res.status(500).json({ error: err.message })`
 * handlers in three routers, per docs/standards/ERROR_HANDLING_STANDARD.md:
 *   - dashboard/list enrichment reads (superadmin platform-stats/contracts/
 *     playbooks/lifecycle-transitions panels, notifications list/counts,
 *     notification comments/activity-log side panels, project escalations
 *     panel) degrade to 200 + a safe default (with `degraded: true` where the
 *     happy-path shape is an object) instead of a bare 500.
 *   - writes (lifecycle stage/transition/playbook/contract CRUD, notification
 *     mark-read/dismiss/delete/snooze/checklist/worksheet/comment mutations,
 *     escalation run) and primary-content single-record reads (GET a specific
 *     notification, GET its linked source entity) stay fail-closed: real 5xx
 *     with a stable `code`, WITHOUT leaking `err.message`.
 *
 * Services/DB are mocked (subsystem-down simulation) — fast unit tests, not the
 * tests/acceptance/ real-DB parity harness.
 */
import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../../server/src/middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, _res: any, next: any) => {
    req.userId = 'test-user-id';
    req.organizationId = 'test-org-id';
    req.user = {
      id: 'test-user-id',
      organizationId: 'test-org-id',
      organization_id: 'test-org-id',
      role: 'SUPERADMIN',
    };
    next();
  },
}));

vi.mock('../../../../server/src/middleware/rateLimiting.middleware.js', () => ({
  apiAuthRateLimiter: (_req: any, _res: any, next: any) => next(),
  aiRateLimiter: (_req: any, _res: any, next: any) => next(),
  defaultRateLimiter: (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../../../../server/src/middleware/superAdmin.middleware.js', () => ({
  verifySuperAdmin: (_req: any, _res: any, next: any) => next(),
  requireSuperAdminCapability:
    () =>
    (_req: any, _res: any, next: any) =>
      next(),
}));

vi.mock('../../../../server/src/middleware/requireAudit.middleware.js', () => ({
  requireAudit: (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../../../../server/src/middleware/superadminAuditMonitor.middleware.js', () => ({
  superadminAuditMonitor: (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../../../../server/src/utils/Logger.js', () => ({
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

afterEach(() => {
  vi.clearAllMocks();
});

// ============================================================================
// 1. superadmin.routes.ts — customer lifecycle / playbooks / contracts
// ============================================================================
describe('/api/superadmin/* — dashboard reads degrade, CRUD writes fail-closed (H6.4 batch5)', () => {
  const dbGet = vi.fn();
  const dbAll = vi.fn();
  const dbRun = vi.fn();

  beforeEach(() => {
    dbGet.mockReset();
    dbAll.mockReset();
    dbRun.mockReset();
    vi.doMock('../../../../server/src/utils/DbPromise.js', () => ({
      get: dbGet,
      all: dbAll,
      run: dbRun,
    }));
  });

  afterEach(() => vi.resetModules());

  async function loadApp() {
    const router = (await import('../../../../server/src/routes/superadmin.routes.ts')).default;
    const app = express();
    app.use(express.json());
    app.use('/api/superadmin', router);
    return app;
  }

  it('GET /platform-stats stays 200 + non-degraded (every inner query is already locally fail-soft via safeQuery)', async () => {
    // Note: this handler's per-query safeQuery/safeQueryAll wrappers already swallow
    // individual DB failures and return safe defaults — the outer catch this batch
    // hardened (no err.message leak, degraded:true) is a last-resort guard that
    // legitimately can't be reached by a plain DB-throw here; this test documents
    // that the happy path is unaffected by the outer-catch hardening.
    dbGet.mockRejectedValue(new Error('ECONNREFUSED 127.0.0.1:5432'));
    dbAll.mockRejectedValue(new Error('ECONNREFUSED 127.0.0.1:5432'));
    const app = await loadApp();

    const res = await request(app).get('/api/superadmin/platform-stats');

    expect(res.status).toBe(200);
    expect(res.body.users.totalUsers).toBe(0);
    expect(JSON.stringify(res.body)).not.toContain('ECONNREFUSED');
  });

  it('GET /lifecycle/stats degrades to 200 + degraded:true when the DB subsystem throws', async () => {
    dbAll.mockRejectedValue(new Error('relation "customer_lifecycle_stages" does not exist'));
    dbGet.mockRejectedValue(new Error('relation "customer_lifecycle_stages" does not exist'));
    const app = await loadApp();

    const res = await request(app).get('/api/superadmin/lifecycle/stats');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ stageStats: [], totalTransitions: 0, degraded: true });
    expect(JSON.stringify(res.body)).not.toContain('does not exist');
  });

  it('PUT /lifecycle/stages/:id stays fail-closed: 500 + code, no err.message leak', async () => {
    dbRun.mockRejectedValue(new Error('duplicate key value violates unique constraint xyz'));
    const app = await loadApp();

    const res = await request(app)
      .put('/api/superadmin/lifecycle/stages/stage-1')
      .send({ name: 'Renewal' });

    expect(res.status).toBe(500);
    expect(res.body.code).toBe('SUPERADMIN_LIFECYCLE_STAGE_UPDATE_FAILED');
    expect(JSON.stringify(res.body)).not.toContain('duplicate key');
  });

  it('GET /contracts degrades to 200 + empty array when the DB subsystem throws', async () => {
    dbAll.mockRejectedValue(new Error('relation "customer_contracts" does not exist'));
    const app = await loadApp();

    const res = await request(app).get('/api/superadmin/contracts');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
    expect(JSON.stringify(res.body)).not.toContain('does not exist');
  });

  it('POST /contracts (write) stays fail-closed: 500 + code, no err.message leak', async () => {
    dbGet.mockResolvedValue({ id: 'org-1' });
    dbRun.mockRejectedValue(new Error('db unreachable at 10.0.0.5'));
    const app = await loadApp();

    const res = await request(app)
      .post('/api/superadmin/contracts')
      .send({ organizationId: 'org-1', startDate: '2026-01-01', value: 1000 });

    expect(res.status).toBe(500);
    expect(res.body.code).toBe('SUPERADMIN_CONTRACT_CREATE_FAILED');
    expect(JSON.stringify(res.body)).not.toContain('10.0.0.5');
  });

  it('GET /contracts/stats happy path unchanged (no degraded flag)', async () => {
    dbGet.mockResolvedValue({
      total_contracts: 3,
      active_contracts: 2,
      total_value: 5000,
      renewals_30d: 1,
    });
    const app = await loadApp();

    const res = await request(app).get('/api/superadmin/contracts/stats');

    expect(res.status).toBe(200);
    expect(res.body.degraded).toBeUndefined();
    expect(res.body.total_contracts).toBe(3);
  });
});

// ============================================================================
// 2. notifications/notifications.routes.ts — nested router (primary router)
// ============================================================================
describe('/api/notifications/* (nested router) — reads degrade/fail-closed by kind (H6.4 batch5)', () => {
  const service = {
    getNotifications: vi.fn(),
    getCounts: vi.fn(),
    getPreferences: vi.fn(),
    updatePreferences: vi.fn(),
    markAsRead: vi.fn(),
    dismiss: vi.fn(),
    markAllAsRead: vi.fn(),
    delete: vi.fn(),
    getById: vi.fn(),
    getComments: vi.fn(),
    addComment: vi.fn(),
    deleteComment: vi.fn(),
    getActivityLog: vi.fn(),
    snoozeNotification: vi.fn(),
    updateChecklist: vi.fn(),
    updateWorksheetDraft: vi.fn(),
    getSourceEntity: vi.fn(),
  };
  const escalationService = {
    getEscalations: vi.fn(),
    runAutoEscalation: vi.fn(),
  };

  beforeEach(() => {
    Object.values(service).forEach((fn) => fn.mockReset());
    Object.values(escalationService).forEach((fn) => fn.mockReset());
    vi.doMock('../../../../server/src/services/notificationService.js', () => ({
      default: service,
    }));
    vi.doMock('../../../../server/src/services/escalationService.js', () => ({
      EscalationService: escalationService,
      default: escalationService,
    }));
  });

  afterEach(() => vi.resetModules());

  async function loadApp() {
    const router = (await import('../../../../server/src/routes/notifications/notifications.routes.ts'))
      .default;
    const app = express();
    app.use(express.json());
    app.use('/api/notifications', router);
    return app;
  }

  it('PATCH /preferences (write) stays fail-closed: 500 + code, no err.message leak', async () => {
    service.updatePreferences.mockRejectedValue(new Error('constraint violation xyz'));
    const app = await loadApp();

    const res = await request(app).patch('/api/notifications/preferences').send({ email: true });

    expect(res.status).toBe(500);
    expect(res.body.code).toBe('NOTIFICATIONS_PREFERENCES_UPDATE_FAILED');
    expect(JSON.stringify(res.body)).not.toContain('constraint violation');
  });

  it('GET /escalations/:projectId degrades to 200 + empty array when the service throws', async () => {
    escalationService.getEscalations.mockRejectedValue(new Error('ECONNREFUSED 127.0.0.1:5432'));
    const app = await loadApp();

    const res = await request(app).get('/api/notifications/escalations/proj-1');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
    expect(JSON.stringify(res.body)).not.toContain('ECONNREFUSED');
  });

  it('DELETE /:id (write) stays fail-closed: 500 + code, no err.message leak', async () => {
    service.delete.mockRejectedValue(new Error('foreign key constraint fails on notifications'));
    const app = await loadApp();

    const res = await request(app).delete('/api/notifications/notif-1');

    expect(res.status).toBe(500);
    expect(res.body.code).toBe('NOTIFICATIONS_DELETE_FAILED');
    expect(JSON.stringify(res.body)).not.toContain('foreign key constraint fails');
  });

  it('GET /:id (primary content, not enrichment) stays fail-closed: 500 + code', async () => {
    service.getById.mockRejectedValue(new Error('relation "notifications" does not exist'));
    const app = await loadApp();

    const res = await request(app).get('/api/notifications/notif-1');

    expect(res.status).toBe(500);
    expect(res.body.code).toBe('NOTIFICATIONS_GET_FAILED');
    expect(JSON.stringify(res.body)).not.toContain('does not exist');
  });

  it('GET /:id/comments degrades to 200 + empty array when the service throws', async () => {
    service.getComments.mockRejectedValue(new Error('db unreachable at 10.0.0.5'));
    const app = await loadApp();

    const res = await request(app).get('/api/notifications/notif-1/comments');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
    expect(JSON.stringify(res.body)).not.toContain('10.0.0.5');
  });

  it('GET /:id happy path unchanged (no error leaked, real payload returned)', async () => {
    service.getById.mockResolvedValue({ id: 'notif-1', title: 'Test' });
    const app = await loadApp();

    const res = await request(app).get('/api/notifications/notif-1');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: 'notif-1', title: 'Test' });
  });
});

// ============================================================================
// 3. notifications.routes.ts — legacy top-level duplicate router
// ============================================================================
describe('/api/notifications/* (legacy top-level router) — reads degrade, writes fail-closed (H6.4 batch5)', () => {
  const service = {
    getNotifications: vi.fn(),
    getCounts: vi.fn(),
    markAsRead: vi.fn(),
    markAllAsRead: vi.fn(),
    delete: vi.fn(),
  };
  const escalationService = {
    getEscalations: vi.fn(),
    runAutoEscalation: vi.fn(),
  };

  beforeEach(() => {
    Object.values(service).forEach((fn) => fn.mockReset());
    Object.values(escalationService).forEach((fn) => fn.mockReset());
    vi.doMock('../../../../server/src/services/notificationService.js', () => ({
      default: service,
    }));
    vi.doMock('../../../../server/src/services/escalationService.js', () => ({
      default: escalationService,
      EscalationService: escalationService,
    }));
  });

  afterEach(() => vi.resetModules());

  async function loadApp() {
    const router = (await import('../../../../server/src/routes/notifications.routes.ts')).default;
    const app = express();
    app.use(express.json());
    app.use('/api/notifications', router);
    return app;
  }

  it('GET / degrades to 200 + empty array when the service throws', async () => {
    service.getNotifications.mockRejectedValue(new Error('ECONNREFUSED 127.0.0.1:5432'));
    const app = await loadApp();

    const res = await request(app).get('/api/notifications/');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
    expect(JSON.stringify(res.body)).not.toContain('ECONNREFUSED');
  });

  it('GET /counts degrades to 200 + zeroed counts when the service throws', async () => {
    service.getCounts.mockRejectedValue(new Error('relation "notifications" does not exist'));
    const app = await loadApp();

    const res = await request(app).get('/api/notifications/counts');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ unread: 0, degraded: true });
    expect(JSON.stringify(res.body)).not.toContain('does not exist');
  });

  it('PATCH /:id/read (write) stays fail-closed: 500 + code, no err.message leak', async () => {
    service.markAsRead.mockRejectedValue(new Error('db unreachable at 10.0.0.5'));
    const app = await loadApp();

    const res = await request(app).patch('/api/notifications/notif-1/read');

    expect(res.status).toBe(500);
    expect(res.body.code).toBe('NOTIFICATIONS_MARK_READ_FAILED');
    expect(JSON.stringify(res.body)).not.toContain('10.0.0.5');
  });

  it('DELETE /:id (write) stays fail-closed: 500 + code, no err.message leak', async () => {
    service.delete.mockRejectedValue(new Error('foreign key constraint fails on notifications'));
    const app = await loadApp();

    const res = await request(app).delete('/api/notifications/notif-1');

    expect(res.status).toBe(500);
    expect(res.body.code).toBe('NOTIFICATIONS_DELETE_FAILED');
    expect(JSON.stringify(res.body)).not.toContain('foreign key constraint fails');
  });

  it('GET /counts happy path unchanged (no degraded flag)', async () => {
    service.getCounts.mockResolvedValue({ unread: 4 });
    const app = await loadApp();

    const res = await request(app).get('/api/notifications/counts');

    expect(res.status).toBe(200);
    expect(res.body.degraded).toBeUndefined();
    expect(res.body.unread).toBe(4);
  });
});
