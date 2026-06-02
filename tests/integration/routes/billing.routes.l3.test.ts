import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import express from 'express';
import { EventEmitter } from 'node:events';

import router from '../../../server/src/routes/billing/billing.routes.ts';
import { resetConnection } from '../../../server/src/database/Database.js';
import { initializeDatabase } from '../../../server/src/database/DatabaseInitializer.js';

vi.hoisted(() => {
  process.env.MOCK_DB = 'false';
  process.env.TEST_TYPE = 'integration';
  process.env.NODE_ENV = 'test';
  process.env.DB_TYPE = 'sqlite';
  delete process.env.DATABASE_URL;
  process.env.MOCK_REDIS = 'true';
  process.env.ENABLE_TEST_AUTH_BYPASS = 'true';

  const workerId = process.env.VITEST_WORKER_ID || '0';
  const runId = process.env.VITEST_RUN_ID || Date.now().toString(36);
  process.env.SQLITE_PATH = `./test-l3-${workerId}-${runId}.db`;
});

describe('Billing routes integration (L3)', () => {
  const app = express();
  app.use(express.json());
  app.use('/api/billing', router);
  app.use((err: any, _req: any, res: any, _next: any) => {
    res.status(500).json({ success: false, error: err?.message || 'Internal error' });
  });

  const dispatch = async ({
    method,
    url,
    body,
    headers = {},
    user,
    query,
  }: {
    method: string;
    url: string;
    body?: any;
    headers?: Record<string, string>;
    user?: any;
    query?: Record<string, any>;
  }) => {
    const req = new EventEmitter();
    Object.assign(req, {
      method,
      url,
      headers,
      body,
      cookies: {},
      path: url,
      query: query || {},
      socket: { remoteAddress: '127.0.0.1' },
    });
    if (user) (req as any).user = user;

    const res = new EventEmitter();
    const chunks: Buffer[] = [];
    const response = {
      status: 200,
      headers: {} as Record<string, string>,
      body: undefined as any,
      text: '',
    };

    Object.assign(res, {
      statusCode: 200,
      setHeader(name: string, value: any) {
        response.headers[String(name).toLowerCase()] = String(value);
      },
      getHeader(name: string) {
        return response.headers[String(name).toLowerCase()];
      },
      writeHead(code: number, hdrs?: Record<string, any>) {
        (res as any).statusCode = code;
        response.status = code;
        if (hdrs) {
          for (const [k, v] of Object.entries(hdrs)) (res as any).setHeader(k, v);
        }
        return res;
      },
      write(chunk: any) {
        if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
        return true;
      },
      end(chunk: any) {
        if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
        response.status = (res as any).statusCode || 200;
        response.text = Buffer.concat(chunks).toString('utf8');
        try {
          response.body = response.text ? JSON.parse(response.text) : undefined;
        } catch {
          response.body = undefined;
        }
        res.emit('finish');
        return res;
      },
      json(obj: any) {
        (res as any).setHeader('content-type', 'application/json');
        (res as any).end(JSON.stringify(obj));
      },
      send(obj: any) {
        (res as any).end(obj);
      },
      status(code: number) {
        (res as any).statusCode = code;
        response.status = code;
        return res;
      },
      set(name: string, value: any) {
        (res as any).setHeader(name, value);
        return res;
      },
    });

    return await new Promise<typeof response>((resolve, reject) => {
      res.on('finish', () => resolve(response));
      app.handle(req as any, res as any, (err: any) => {
        if (err) reject(err);
      });
    });
  };

  const superAdminUser = {
    id: 'u-superadmin',
    organizationId: 'org-1',
    role: 'SUPERADMIN',
    isSuperAdmin: true,
  };

  beforeAll(async () => {
    await initializeDatabase();
  });

  afterAll(async () => {
    await resetConnection();
  });

  it('GET /admin/revenue returns admin dashboard mocks for super admin', async () => {
    const res = await dispatch({
      method: 'GET',
      url: '/api/billing/admin/revenue',
      user: superAdminUser,
    });
    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        mrr: 0,
        arr: 0,
        activeSubscriptions: 0,
        planDistribution: expect.any(Array),
      })
    );
  });

  it('GET /admin/usage returns admin usage mocks for super admin', async () => {
    const res = await dispatch({
      method: 'GET',
      url: '/api/billing/admin/usage',
      user: superAdminUser,
    });
    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        totalTokensThisMonth: 0,
        totalStorageGB: 0,
        activeOrganizations: 0,
      })
    );
  });

  it('GET /admin/operational-costs returns empty cost breakdown for super admin', async () => {
    const res = await dispatch({
      method: 'GET',
      url: '/api/billing/admin/operational-costs',
      user: superAdminUser,
    });
    expect(res.status).toBe(200);
    expect(res.body).toEqual(expect.objectContaining({ items: [], totalCost: 0 }));
  });

  it('GET /webhook-event-types returns the billing event type catalog', async () => {
    const res = await dispatch({
      method: 'GET',
      url: '/api/billing/webhook-event-types',
      user: superAdminUser,
    });
    expect(res.status).toBe(200);
    expect(res.body).toEqual(expect.objectContaining({ eventTypes: expect.any(Object) }));
    expect(Object.keys(res.body.eventTypes).length).toBeGreaterThan(10);
  });

  it('GET /admin/revenue returns 401 when auth bypass is disabled and no token is provided', async () => {
    const prev = process.env.ENABLE_TEST_AUTH_BYPASS;
    process.env.ENABLE_TEST_AUTH_BYPASS = 'false';
    try {
      const res = await dispatch({ method: 'GET', url: '/api/billing/admin/revenue' });
      expect(res.status).toBe(401);
      expect(res.body).toEqual(expect.objectContaining({ error: 'No token provided' }));
    } finally {
      process.env.ENABLE_TEST_AUTH_BYPASS = prev;
    }
  });

  it('GET /admin/revenue returns 403 when user is not super admin', async () => {
    const res = await dispatch({
      method: 'GET',
      url: '/api/billing/admin/revenue',
      user: { ...superAdminUser, isSuperAdmin: false },
    });
    expect(res.status).toBe(403);
    expect(res.body).toEqual(expect.objectContaining({ error: 'Super admin access required' }));
  });

  it('GET /analytics/mrr returns the current MRR breakdown', async () => {
    const res = await dispatch({
      method: 'GET',
      url: '/api/billing/analytics/mrr',
      user: superAdminUser,
    });
    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        mrr: expect.objectContaining({
          totalMRR: expect.any(Number),
          arr: expect.any(Number),
          activeSubscriptions: expect.any(Number),
          byPlan: expect.any(Array),
        }),
      })
    );
  });

  it('GET /analytics/mrr/trend returns 503 when billing analytics schema is missing', async () => {
    const res = await dispatch({
      method: 'GET',
      url: '/api/billing/analytics/mrr/trend',
      user: superAdminUser,
      query: { days: '7' },
    });
    expect(res.status).toBe(503);
    expect(res.body).toEqual(
      expect.objectContaining({
        message: expect.stringContaining('temporarily unavailable'),
        type: 'not_configured',
      })
    );
  });

  it('GET /admin/plans returns plans array with parsed JSON fields', async () => {
    const res = await dispatch({
      method: 'GET',
      url: '/api/billing/admin/plans',
      user: superAdminUser,
    });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    if (res.body.length > 0) {
      expect(res.body[0]).toEqual(
        expect.objectContaining({
          id: expect.any(String),
          name: expect.any(String),
          features: expect.any(Array),
          limits: expect.any(Object),
        })
      );
    }
  });

  it('GET /webhook-events returns 403 for guest role (billing access required)', async () => {
    const res = await dispatch({
      method: 'GET',
      url: '/api/billing/webhook-events',
      user: { ...superAdminUser, isSuperAdmin: false, role: 'guest' },
    });
    expect(res.status).toBe(403);
    expect(res.body).toEqual(expect.objectContaining({ error: 'Billing access required' }));
  });

  it('GET /webhook-events returns 500 when schema is missing (allowed role)', async () => {
    const res = await dispatch({
      method: 'GET',
      url: '/api/billing/webhook-events',
      user: { ...superAdminUser, isSuperAdmin: false, role: 'owner' },
    });
    expect(res.status).toBe(500);
    expect(res.body).toEqual(expect.objectContaining({ error: 'Failed to get webhook events' }));
  });

  it('GET /webhook-events/:id returns 400 for invalid uuid param', async () => {
    const res = await dispatch({
      method: 'GET',
      url: '/api/billing/webhook-events/not-a-uuid',
      user: { ...superAdminUser, isSuperAdmin: false, role: 'owner' },
    });
    expect(res.status).toBe(400);
  });
});
