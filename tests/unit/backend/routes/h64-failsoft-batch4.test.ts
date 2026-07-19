/**
 * H6.4 batch 4 — high-volume routers: settings.routes.ts / metrics.routes.ts /
 * documents.routes.ts — standard fail-soft/fail-closed cleanup.
 *
 * Continuation of h64-failsoft.test.ts (W4) / batch2 / batch3. This batch closes
 * out the remaining bare `res.status(500).json({ error: err.message })` handlers
 * in the three routers with the highest gołe-500 volume, per
 * docs/standards/ERROR_HANDLING_STANDARD.md:
 *   - enrichment/preference reads (settings inbox-ai/DND/notification panels,
 *     signatures list, metrics dashboards/funnels/attribution/org overview)
 *     degrade to 200 + `degraded: true` with a safe default payload — never a
 *     bare 500.
 *   - writes (settings PUT/POST/DELETE preference & signature endpoints) and
 *     primary document content reads (documents list/get/download/move/delete —
 *     not side enrichment) stay fail-closed: real 5xx with a stable `code`,
 *     WITHOUT leaking `err.message`/`error.message`.
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
      role: 'MEMBER',
    };
    next();
  },
}));

vi.mock('../../../../server/src/middleware/rateLimiting.middleware.js', () => ({
  apiAuthRateLimiter: (_req: any, _res: any, next: any) => next(),
  aiRateLimiter: (_req: any, _res: any, next: any) => next(),
  defaultRateLimiter: (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../../../../server/src/utils/Logger.js', () => ({
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

afterEach(() => {
  vi.clearAllMocks();
});

// ============================================================================
// 1. settings.routes.ts — preference/signature panels
// ============================================================================
describe('/api/settings/* — fail-soft reads + fail-closed writes (H6.4 batch4)', () => {
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
    const router = (await import('../../../../server/src/routes/settings.routes.ts')).default;
    const app = express();
    app.use(express.json());
    app.use('/api/settings', router);
    return app;
  }

  it('GET /preferences/inbox-ai degrades to 200 + safe default when DB subsystem throws', async () => {
    dbRun.mockRejectedValue(new Error('ECONNREFUSED 127.0.0.1:5432'));
    dbGet.mockRejectedValue(new Error('ECONNREFUSED 127.0.0.1:5432'));
    const app = await loadApp();

    const res = await request(app).get('/api/settings/preferences/inbox-ai');

    expect(res.status).toBe(200);
    expect(res.body.degraded).toBe(true);
    expect(res.body.preferences).toEqual({ threshold: 0.85 });
    expect(JSON.stringify(res.body)).not.toContain('ECONNREFUSED');
  });

  it('PUT /preferences/inbox-ai stays fail-closed: 500 + code, no err.message leak', async () => {
    dbRun.mockRejectedValue(new Error('duplicate key value violates unique constraint xyz'));
    const app = await loadApp();

    const res = await request(app)
      .put('/api/settings/preferences/inbox-ai')
      .send({ preferences: { threshold: 0.5 } });

    expect(res.status).toBe(500);
    expect(res.body.code).toBe('SETTINGS_INBOX_AI_UPDATE_FAILED');
    expect(JSON.stringify(res.body)).not.toContain('duplicate key');
  });

  it('GET /notifications/dnd degrades to 200 + safe default when DB subsystem throws', async () => {
    dbGet.mockRejectedValue(new Error('relation "user_preferences" does not exist'));
    const app = await loadApp();

    const res = await request(app).get('/api/settings/notifications/dnd');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ enabled: false, until: null, degraded: true });
    expect(JSON.stringify(res.body)).not.toContain('does not exist');
  });

  it('PUT /notifications/dnd stays fail-closed: 500 + code, no err.message leak', async () => {
    dbRun.mockRejectedValue(new Error('db unreachable at 10.0.0.5'));
    const app = await loadApp();

    const res = await request(app).put('/api/settings/notifications/dnd').send({ enabled: true });

    expect(res.status).toBe(500);
    expect(res.body.code).toBe('SETTINGS_DND_UPDATE_FAILED');
    expect(JSON.stringify(res.body)).not.toContain('10.0.0.5');
  });

  it('GET /signatures degrades to 200 + empty list when DB subsystem throws', async () => {
    dbRun.mockRejectedValue(new Error('ECONNREFUSED 127.0.0.1:5432'));
    dbAll.mockRejectedValue(new Error('ECONNREFUSED 127.0.0.1:5432'));
    const app = await loadApp();

    const res = await request(app).get('/api/settings/signatures');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ signatures: [], degraded: true });
    expect(JSON.stringify(res.body)).not.toContain('ECONNREFUSED');
  });

  it('DELETE /signatures/:id stays fail-closed: 500 + code, no err.message leak', async () => {
    dbRun.mockRejectedValue(new Error('foreign key constraint fails on email_signatures'));
    const app = await loadApp();

    const res = await request(app).delete('/api/settings/signatures/sig-1');

    expect(res.status).toBe(500);
    expect(res.body.code).toBe('SETTINGS_SIGNATURE_DELETE_FAILED');
    expect(JSON.stringify(res.body)).not.toContain('foreign key constraint fails');
  });

  it('GET /preferences/inbox-ai happy path unchanged (no degraded flag)', async () => {
    dbGet.mockResolvedValue(undefined);
    const app = await loadApp();

    const res = await request(app).get('/api/settings/preferences/inbox-ai');

    expect(res.status).toBe(200);
    expect(res.body.degraded).toBeUndefined();
    expect(res.body.preferences).toEqual({ threshold: 0.85 });
  });
});

// ============================================================================
// 2. metrics.routes.ts — business/org dashboards (all fail-soft reads)
// ============================================================================
describe('/api/metrics/* — dashboards degrade instead of 500 (H6.4 batch4)', () => {
  afterEach(() => vi.resetModules());

  async function loadApp() {
    const router = (await import('../../../../server/src/routes/metrics.routes.ts')).default;
    const app = express();
    app.use(express.json());
    app.use('/api/metrics', router);
    return app;
  }

  it('GET /funnels degrades to 200 + degraded:true when the DB subsystem module fails to load', async () => {
    // Per-query reads inside the handler are already locally fail-soft (safeGet);
    // the outer catch — the one this batch fixed — is hit when the DbPromise
    // module itself is unavailable (e.g. import/init failure).
    vi.doMock('../../../../server/src/utils/DbPromise.js', () => {
      throw new Error('ECONNREFUSED 127.0.0.1:5432');
    });
    const app = await loadApp();

    const res = await request(app).get('/api/metrics/funnels');

    expect(res.status).toBe(200);
    expect(res.body.degraded).toBe(true);
    expect(JSON.stringify(res.body)).not.toContain('ECONNREFUSED');
  });

  it('GET /org/overview degrades to 200 + degraded:true when the metrics service throws', async () => {
    vi.doMock('../../../../server/src/services/organizationMetricsService.js', () => ({
      getOrganizationMetricsService: () => ({
        getOverview: vi.fn().mockRejectedValue(new Error('relation "org_metrics" does not exist')),
      }),
    }));
    const app = await loadApp();

    const res = await request(app).get('/api/metrics/org/overview');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ degraded: true });
    expect(JSON.stringify(res.body)).not.toContain('does not exist');
  });

  it('GET /org/events degrades to 200 + empty events array when the metrics service throws', async () => {
    vi.doMock('../../../../server/src/services/organizationMetricsService.js', () => ({
      getOrganizationMetricsService: () => ({
        getMetricEvents: vi.fn().mockRejectedValue(new Error('db unreachable at 10.0.0.5')),
      }),
    }));
    const app = await loadApp();

    const res = await request(app).get('/api/metrics/org/events');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ events: [], degraded: true });
    expect(JSON.stringify(res.body)).not.toContain('10.0.0.5');
  });
});

// ============================================================================
// 3. documents.routes.ts — primary content list/get/delete (fail-closed)
// ============================================================================
describe('/api/documents/* — primary content stays fail-closed (H6.4 batch4)', () => {
  afterEach(() => vi.resetModules());

  async function loadApp() {
    const router = (await import('../../../../server/src/routes/documents.routes.ts')).default;
    const app = express();
    app.use(express.json());
    app.use('/api/documents', router);
    return app;
  }

  it('GET /user stays fail-closed: 500 + code, no error.message leak', async () => {
    vi.doMock('../../../../server/src/services/organizationContext/ContextDocumentService.js', () => ({
      default: {
        listAccessibleDocuments: vi
          .fn()
          .mockRejectedValue(new Error('relation "context_documents" does not exist')),
      },
    }));
    const app = await loadApp();

    const res = await request(app).get('/api/documents/user');

    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('DOCUMENTS_USER_LIST_FAILED');
    expect(JSON.stringify(res.body)).not.toContain('does not exist');
  });

  it('DELETE /:id stays fail-closed: 500 + code, no error.message leak', async () => {
    vi.doMock('../../../../server/src/services/organizationContext/ContextDocumentService.js', () => ({
      default: {
        softDelete: vi.fn().mockRejectedValue(new Error('foreign key constraint fails on documents')),
      },
    }));
    const app = await loadApp();

    const res = await request(app).delete('/api/documents/doc-1');

    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('DOCUMENTS_DELETE_FAILED');
    expect(JSON.stringify(res.body)).not.toContain('foreign key constraint fails');
  });

  it('GET /project/:projectId stays fail-closed: 500 + code, no error.message leak', async () => {
    vi.doMock('../../../../server/src/services/organizationContext/ContextDocumentService.js', () => ({
      default: {
        listAccessibleDocuments: vi.fn().mockRejectedValue(new Error('ECONNREFUSED 127.0.0.1:5432')),
      },
    }));
    const app = await loadApp();

    const res = await request(app).get('/api/documents/project/proj-1');

    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('DOCUMENTS_PROJECT_LIST_FAILED');
    expect(JSON.stringify(res.body)).not.toContain('ECONNREFUSED');
  });

  it('GET /user happy path unchanged', async () => {
    vi.doMock('../../../../server/src/services/organizationContext/ContextDocumentService.js', () => ({
      default: {
        listAccessibleDocuments: vi.fn().mockResolvedValue([{ id: 'doc-1', name: 'Report.pdf' }]),
      },
    }));
    const app = await loadApp();

    const res = await request(app).get('/api/documents/user');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ id: 'doc-1', name: 'Report.pdf' }]);
  });
});
