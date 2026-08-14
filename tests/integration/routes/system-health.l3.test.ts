import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import express from 'express';
import { EventEmitter } from 'node:events';
import jwt from 'jsonwebtoken';

import { getDatabase, resetConnection } from '../../../server/src/database/Database.js';
import { initializeDatabase } from '../../../server/src/database/DatabaseInitializer.js';

vi.hoisted(() => {
  process.env.MOCK_DB = 'false';
  process.env.TEST_TYPE = 'integration';
  process.env.NODE_ENV = 'test';
  process.env.MOCK_REDIS = 'true';

  process.env.JWT_SECRET = 'test-secret-key-for-testing-only-min-32-chars';

  const workerId = process.env.VITEST_WORKER_ID || '0';
  const runId = process.env.VITEST_RUN_ID || Date.now().toString(36);
  process.env.SQLITE_PATH = `./test-l3-${workerId}-${runId}.db`;
});

describe('System health routes integration (L3)', () => {
  const db = getDatabase();

  const dbRun = (sql: string, params: any[] = []) =>
    new Promise<void>((resolve, reject) => {
      db.run(sql, params, (err: any) => (err ? reject(err) : resolve()));
    });

  const dispatch = async (
    app: express.Express,
    {
      method,
      url,
      headers = {},
      body,
      query,
    }: {
      method: string;
      url: string;
      headers?: Record<string, string>;
      body?: any;
      query?: Record<string, any>;
    }
  ) => {
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
        if (err) {
          reject(err);
          return;
        }
        // Express calls the final callback without an error when no route
        // matched. The bespoke dispatcher must resolve that as a 404 instead
        // of waiting forever for a `finish` event that will never be emitted.
        response.status = 404;
        resolve(response);
      });
    });
  };

  const tokenFor = (payload: any) => {
    return jwt.sign(payload, process.env.JWT_SECRET as string, { expiresIn: '1h' });
  };

  const makeAppWithRouter = async () => {
    const app = express();
    app.use(express.json());
    app.use((err: any, _req: any, res: any, _next: any) => {
      res.status(500).json({ success: false, error: err?.message || 'Internal error' });
    });

    const router = (await import('../../../server/src/routes/systemHealth.routes.ts')).default;
    app.use('/api/system-health', router);
    return app;
  };

  beforeAll(async () => {
    await initializeDatabase();
    if ((db as any).initPromise) await (db as any).initPromise;

    await dbRun(
      `INSERT OR IGNORE INTO organizations (id, name, plan, status) VALUES (?, ?, ?, ?)`,
      ['test-org-id', 'Test Org', 'enterprise', 'active']
    );
    await dbRun(
      `INSERT OR IGNORE INTO users (id, organization_id, email, password, role, status, first_name, last_name)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ['sa-user', 'test-org-id', 'sa@example.com', 'x', 'SUPERADMIN', 'active', 'Super', 'Admin']
    );
    await dbRun(
      `INSERT OR IGNORE INTO users (id, organization_id, email, password, role, status, first_name, last_name)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ['admin-user', 'test-org-id', 'admin@example.com', 'x', 'ADMIN', 'active', 'Admin', 'User']
    );
  });

  afterAll(async () => {
    await resetConnection();
  });

  it('GET / is not exposed; detailed diagnostics live only on guarded routes', async () => {
    vi.resetModules();
    vi.doMock('../../../server/src/middleware/rateLimiting.middleware.js', () => ({
      defaultRateLimiter: (_req: any, _res: any, next: any) => next(),
    }));

    const app = await makeAppWithRouter();
    const res = await dispatch(app, { method: 'GET', url: '/api/system-health' });
    expect(res.status).toBe(404);
    expect(res.body).toBeUndefined();

    vi.doUnmock('../../../server/src/middleware/rateLimiting.middleware.js');
  });

  it('GET /detailed returns 401 when no token is provided', async () => {
    vi.resetModules();
    vi.doMock('../../../server/src/middleware/rateLimiting.middleware.js', () => ({
      defaultRateLimiter: (_req: any, _res: any, next: any) => next(),
    }));
    vi.doMock('../../../server/src/services/systemHealthService.js', () => ({
      default: { getDetailedHealth: async () => ({ ok: true }) },
    }));

    const app = await makeAppWithRouter();
    const res = await dispatch(app, { method: 'GET', url: '/api/system-health/detailed' });
    expect(res.status).toBe(401);
    expect(res.body).toEqual(
      expect.objectContaining({
        error: 'Authorization token required',
        code: 'UNAUTHORIZED',
      })
    );

    vi.doUnmock('../../../server/src/services/systemHealthService.js');
    vi.doUnmock('../../../server/src/middleware/rateLimiting.middleware.js');
  });

  it('GET /detailed returns 401 for invalid token', async () => {
    vi.resetModules();
    vi.doMock('../../../server/src/middleware/rateLimiting.middleware.js', () => ({
      defaultRateLimiter: (_req: any, _res: any, next: any) => next(),
    }));
    vi.doMock('../../../server/src/services/systemHealthService.js', () => ({
      default: { getDetailedHealth: async () => ({ ok: true }) },
    }));

    const app = await makeAppWithRouter();
    const res = await dispatch(app, {
      method: 'GET',
      url: '/api/system-health/detailed',
      headers: { authorization: 'Bearer not-a-real-jwt' },
    });
    expect(res.status).toBe(401);
    expect(res.body).toEqual(expect.objectContaining({ error: 'Unauthorized' }));

    vi.doUnmock('../../../server/src/services/systemHealthService.js');
    vi.doUnmock('../../../server/src/middleware/rateLimiting.middleware.js');
  });

  it('GET /detailed returns 403 when token role not superadmin and DB role not superadmin', async () => {
    vi.resetModules();
    vi.doMock('../../../server/src/middleware/rateLimiting.middleware.js', () => ({
      defaultRateLimiter: (_req: any, _res: any, next: any) => next(),
    }));
    vi.doMock('../../../server/src/services/systemHealthService.js', () => ({
      default: { getDetailedHealth: async () => ({ ok: true }) },
    }));

    const token = tokenFor({ id: 'admin-user', role: 'USER', organizationId: 'test-org-id' });
    const app = await makeAppWithRouter();
    const res = await dispatch(app, {
      method: 'GET',
      url: '/api/system-health/detailed',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(403);
    expect(res.body).toEqual(expect.objectContaining({ error: 'Requires Super Admin privileges' }));

    vi.doUnmock('../../../server/src/services/systemHealthService.js');
    vi.doUnmock('../../../server/src/middleware/rateLimiting.middleware.js');
  });

  it('GET /detailed returns 200 when token role not superadmin but DB role is SUPERADMIN', async () => {
    vi.resetModules();
    vi.doMock('../../../server/src/middleware/rateLimiting.middleware.js', () => ({
      defaultRateLimiter: (_req: any, _res: any, next: any) => next(),
    }));
    vi.doMock('../../../server/src/services/systemHealthService.js', () => ({
      default: { getDetailedHealth: async () => ({ ok: true }) },
    }));

    const token = tokenFor({ id: 'sa-user', role: 'USER', organizationId: 'test-org-id' });
    const app = await makeAppWithRouter();
    const res = await dispatch(app, {
      method: 'GET',
      url: '/api/system-health/detailed',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });

    vi.doUnmock('../../../server/src/services/systemHealthService.js');
    vi.doUnmock('../../../server/src/middleware/rateLimiting.middleware.js');
  });

  it('GET /metrics returns 503 when getMetrics is not available', async () => {
    vi.resetModules();
    vi.doMock('../../../server/src/middleware/rateLimiting.middleware.js', () => ({
      defaultRateLimiter: (_req: any, _res: any, next: any) => next(),
    }));
    vi.doMock('../../../server/src/services/systemHealthService.js', () => ({
      default: { getDetailedHealth: async () => ({ ok: true }) },
    }));

    const token = tokenFor({ id: 'sa-user', role: 'SUPERADMIN', organizationId: 'test-org-id' });
    const app = await makeAppWithRouter();
    const res = await dispatch(app, {
      method: 'GET',
      url: '/api/system-health/metrics',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(503);
    expect(res.body).toEqual(
      expect.objectContaining({
        error: 'System health service not available',
        code: 'SYSTEM_HEALTH_SERVICE_NOT_CONFIGURED',
      })
    );

    vi.doUnmock('../../../server/src/services/systemHealthService.js');
    vi.doUnmock('../../../server/src/middleware/rateLimiting.middleware.js');
  });

  it('GET /services returns 503 when getServiceStatus throws', async () => {
    vi.resetModules();
    vi.doMock('../../../server/src/middleware/rateLimiting.middleware.js', () => ({
      defaultRateLimiter: (_req: any, _res: any, next: any) => next(),
    }));
    vi.doMock('../../../server/src/services/systemHealthService.js', () => ({
      default: {
        getServiceStatus: async () => {
          throw new Error('svc boom');
        },
      },
    }));

    const token = tokenFor({ id: 'sa-user', role: 'SUPERADMIN', organizationId: 'test-org-id' });
    const app = await makeAppWithRouter();
    const res = await dispatch(app, {
      method: 'GET',
      url: '/api/system-health/services',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(503);
    expect(res.body).toEqual(
      expect.objectContaining({
        error: 'Failed to fetch service status',
        code: 'SYSTEM_HEALTH_SERVICES_READ_FAILED',
      })
    );

    vi.doUnmock('../../../server/src/services/systemHealthService.js');
    vi.doUnmock('../../../server/src/middleware/rateLimiting.middleware.js');
  });

  it('GET /encryption returns 200 when encryption health check succeeds', async () => {
    vi.resetModules();
    vi.doMock('../../../server/src/middleware/rateLimiting.middleware.js', () => ({
      defaultRateLimiter: (_req: any, _res: any, next: any) => next(),
    }));
    vi.doMock('../../../server/src/services/systemHealthService.js', () => ({
      default: {},
    }));
    vi.doMock('../../../server/src/services/encryption/index.js', () => ({
      KeyManagementService: {
        checkHealth: () => ({
          healthy: true,
          issues: [],
          recommendations: [],
        }),
        getKeyStatus: () => ({ active: 1 }),
      },
      getCurrentKeyVersion: () => 'v1',
    }));

    const token = tokenFor({ id: 'sa-user', role: 'SUPERADMIN', organizationId: 'test-org-id' });
    const app = await makeAppWithRouter();
    const res = await dispatch(app, {
      method: 'GET',
      url: '/api/system-health/encryption',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        healthy: true,
        currentKeyVersion: 'v1',
        keyStatus: { active: 1 },
        issues: [],
        recommendations: [],
        timestamp: expect.any(String),
      })
    );

    vi.doUnmock('../../../server/src/services/encryption/index.js');
    vi.doUnmock('../../../server/src/services/systemHealthService.js');
    vi.doUnmock('../../../server/src/middleware/rateLimiting.middleware.js');
  });

  it('GET /detailed and POST /refresh return 503 when getDetailedHealth is not available (auth ok)', async () => {
    vi.resetModules();
    vi.doMock('../../../server/src/middleware/rateLimiting.middleware.js', () => ({
      defaultRateLimiter: (_req: any, _res: any, next: any) => next(),
    }));
    vi.doMock('../../../server/src/services/systemHealthService.js', () => ({
      default: {},
    }));

    const token = tokenFor({ id: 'sa-user', role: 'SUPERADMIN', organizationId: 'test-org-id' });
    const app = await makeAppWithRouter();

    const detailed = await dispatch(app, {
      method: 'GET',
      url: '/api/system-health/detailed',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(detailed.status).toBe(503);
    expect(detailed.body.code).toBe('SYSTEM_HEALTH_SERVICE_NOT_CONFIGURED');

    const refresh = await dispatch(app, {
      method: 'POST',
      url: '/api/system-health/refresh',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(refresh.status).toBe(503);
    expect(refresh.body.code).toBe('SYSTEM_HEALTH_SERVICE_NOT_CONFIGURED');

    vi.doUnmock('../../../server/src/services/systemHealthService.js');
    vi.doUnmock('../../../server/src/middleware/rateLimiting.middleware.js');
  });

  it('GET /metrics and GET /services and POST /refresh return 200 on success paths', async () => {
    vi.resetModules();
    vi.doMock('../../../server/src/middleware/rateLimiting.middleware.js', () => ({
      defaultRateLimiter: (_req: any, _res: any, next: any) => next(),
    }));
    vi.doMock('../../../server/src/services/systemHealthService.js', () => ({
      default: {
        getMetrics: async () => ({ cpu: 1 }),
        getServiceStatus: async () => ({ api: 'ok' }),
        getDetailedHealth: async () => ({ status: 'ok' }),
      },
    }));

    const token = tokenFor({ id: 'sa-user', role: 'SUPERADMIN', organizationId: 'test-org-id' });
    const app = await makeAppWithRouter();

    const metrics = await dispatch(app, {
      method: 'GET',
      url: '/api/system-health/metrics',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(metrics.status).toBe(200);
    expect(metrics.body).toEqual({ cpu: 1 });

    const services = await dispatch(app, {
      method: 'GET',
      url: '/api/system-health/services',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(services.status).toBe(200);
    expect(services.body).toEqual({ api: 'ok' });

    const refresh = await dispatch(app, {
      method: 'POST',
      url: '/api/system-health/refresh',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(refresh.status).toBe(200);
    expect(refresh.body).toEqual({ status: 'ok' });

    vi.doUnmock('../../../server/src/services/systemHealthService.js');
    vi.doUnmock('../../../server/src/middleware/rateLimiting.middleware.js');
  });

  it('GET /metrics and GET /services and POST /refresh return 503 when service methods throw', async () => {
    vi.resetModules();
    vi.doMock('../../../server/src/middleware/rateLimiting.middleware.js', () => ({
      defaultRateLimiter: (_req: any, _res: any, next: any) => next(),
    }));
    vi.doMock('../../../server/src/services/systemHealthService.js', () => ({
      default: {
        getMetrics: async () => {
          throw new Error('metrics boom');
        },
        getServiceStatus: async () => {
          throw new Error('services boom');
        },
        getDetailedHealth: async () => {
          throw new Error('refresh boom');
        },
      },
    }));

    const token = tokenFor({ id: 'sa-user', role: 'SUPERADMIN', organizationId: 'test-org-id' });
    const app = await makeAppWithRouter();

    const metrics = await dispatch(app, {
      method: 'GET',
      url: '/api/system-health/metrics',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(metrics.status).toBe(503);
    expect(metrics.body).toEqual(
      expect.objectContaining({
        error: 'Failed to fetch system metrics',
        code: 'SYSTEM_HEALTH_METRICS_READ_FAILED',
      })
    );

    const services = await dispatch(app, {
      method: 'GET',
      url: '/api/system-health/services',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(services.status).toBe(503);
    expect(services.body).toEqual(
      expect.objectContaining({
        error: 'Failed to fetch service status',
        code: 'SYSTEM_HEALTH_SERVICES_READ_FAILED',
      })
    );

    const refresh = await dispatch(app, {
      method: 'POST',
      url: '/api/system-health/refresh',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(refresh.status).toBe(503);
    expect(refresh.body).toEqual(
      expect.objectContaining({
        error: 'Failed to refresh health data',
        code: 'SYSTEM_HEALTH_REFRESH_FAILED',
      })
    );

    vi.doUnmock('../../../server/src/services/systemHealthService.js');
    vi.doUnmock('../../../server/src/middleware/rateLimiting.middleware.js');
  });

  it('GET /encryption returns 500 when encryption module import fails', async () => {
    vi.resetModules();
    vi.doMock('../../../server/src/middleware/rateLimiting.middleware.js', () => ({
      defaultRateLimiter: (_req: any, _res: any, next: any) => next(),
    }));
    vi.doMock('../../../server/src/services/systemHealthService.js', () => ({
      default: {},
    }));
    vi.doMock('../../../server/src/services/encryption/index.js', () => {
      throw new Error('missing encryption');
    });

    const token = tokenFor({ id: 'sa-user', role: 'SUPERADMIN', organizationId: 'test-org-id' });
    const app = await makeAppWithRouter();
    const res = await dispatch(app, {
      method: 'GET',
      url: '/api/system-health/encryption',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(500);
    expect(res.body).toEqual(expect.objectContaining({ error: 'Encryption health check failed', healthy: false }));

    vi.doUnmock('../../../server/src/services/encryption/index.js');
    vi.doUnmock('../../../server/src/services/systemHealthService.js');
    vi.doUnmock('../../../server/src/middleware/rateLimiting.middleware.js');
  });

  it('GET /detailed returns 503 on service throw and GET /services returns 503 when service method missing', async () => {
    vi.resetModules();
    vi.doMock('../../../server/src/middleware/rateLimiting.middleware.js', () => ({
      defaultRateLimiter: (_req: any, _res: any, next: any) => next(),
    }));
    vi.doMock('../../../server/src/services/systemHealthService.js', () => ({
      default: {
        getDetailedHealth: async () => {
          throw new Error('boom');
        },
      },
    }));

    const token = tokenFor({ id: 'sa-user', role: 'SUPERADMIN', organizationId: 'test-org-id' });
    const app = await makeAppWithRouter();

    const detailed = await dispatch(app, {
      method: 'GET',
      url: '/api/system-health/detailed',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(detailed.status).toBe(503);
    expect(detailed.body).toEqual(
      expect.objectContaining({
        error: 'Health check failed',
        code: 'SYSTEM_HEALTH_DETAILED_READ_FAILED',
      })
    );

    const services = await dispatch(app, {
      method: 'GET',
      url: '/api/system-health/services',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(services.status).toBe(503);
    expect(services.body).toEqual(
      expect.objectContaining({
        error: 'System health service not available',
        code: 'SYSTEM_HEALTH_SERVICE_NOT_CONFIGURED',
      })
    );

    vi.doUnmock('../../../server/src/services/systemHealthService.js');
    vi.doUnmock('../../../server/src/middleware/rateLimiting.middleware.js');
  });
});
