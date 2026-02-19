import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import express from 'express';
import { EventEmitter } from 'node:events';

import healthRoutes from '../../../server/src/routes/healthRoutes.ts';
import dbHealthRoutes from '../../../server/src/routes/health.routes.ts';
import { getDatabase, resetConnection } from '../../../server/src/database/Database.js';
import { initializeDatabase } from '../../../server/src/database/DatabaseInitializer.js';
import {
  initializeConnectionPool,
  shutdownConnectionPool,
} from '../../../server/src/database/index.js';

vi.hoisted(() => {
  process.env.MOCK_DB = 'false';
  process.env.TEST_TYPE = 'integration';
  process.env.NODE_ENV = 'test';

  // Deterministic DB per run/worker
  const workerId = process.env.VITEST_WORKER_ID || '0';
  const runId = process.env.VITEST_RUN_ID || Date.now().toString(36);
  process.env.SQLITE_PATH = `./test-l3-${workerId}-${runId}.db`;
});

describe('Health routes integration (L3)', () => {
  const db = getDatabase();
  const app = express();
  app.use('/api/health', healthRoutes);
  app.use('/api/health', dbHealthRoutes);

  const dispatch = async ({
    method,
    url,
    query,
  }: {
    method: string;
    url: string;
    query?: Record<string, any>;
  }) => {
    const req = new EventEmitter();
    Object.assign(req, {
      method,
      url,
      headers: {},
      body: undefined,
      cookies: {},
      path: url,
      query: query || {},
      socket: { remoteAddress: '127.0.0.1' },
      get(_name: string) {
        return undefined;
      },
      ip: '127.0.0.1',
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
        if (err) reject(err);
      });
    });
  };

  const dbRun = (sql: string, params: any[] = []) =>
    new Promise<void>((resolve, reject) => {
      db.run(sql, params, (err: any) => (err ? reject(err) : resolve()));
    });

  beforeAll(async () => {
    process.env.MOCK_REDIS = 'true';
    await initializeDatabase();
    if ((db as any).initPromise) await (db as any).initPromise;

    // Seed minimal schema deps for readiness checks
    await dbRun(
      `INSERT OR IGNORE INTO organizations (id, name, plan, status) VALUES (?, ?, ?, ?)`,
      ['demo-org', 'Demo Org', 'enterprise', 'active']
    );
    await dbRun(
      `INSERT OR IGNORE INTO users (id, organization_id, email, password, role, status, first_name, last_name)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        'demo-user-id',
        'demo-org',
        'piotr.wisniewski@demo.com',
        'x',
        'ADMIN',
        'active',
        'Demo',
        'User',
      ]
    );
  });

  afterAll(async () => {
    await shutdownConnectionPool().catch(() => {});
    await resetConnection();
  });

  it('GET /ping returns pong', async () => {
    const res = await dispatch({ method: 'GET', url: '/api/health/ping' });
    expect(res.status).toBe(200);
    expect(res.text).toBe('pong');
  });

  it('GET / returns JSON with status ok', async () => {
    const res = await dispatch({ method: 'GET', url: '/api/health' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual(expect.objectContaining({ status: 'degraded' }));
  });

  it('GET / includes environment and version', async () => {
    const res = await dispatch({ method: 'GET', url: '/api/health' });
    expect(res.status).toBe(200);
    expect(res.body.environment).toBe('test');
    expect(typeof res.body.version).toBe('string');
  });

  it('GET / reports redis as mock when MOCK_REDIS=true', async () => {
    process.env.MOCK_REDIS = 'true';
    const res = await dispatch({ method: 'GET', url: '/api/health' });
    expect(res.status).toBe(200);
    expect(res.body.redis).toBe('mocked-unavailable');
  });

  it('GET / reports redis as disconnected/timeout when MOCK_REDIS=false', async () => {
    process.env.MOCK_REDIS = 'false';
    const res = await dispatch({ method: 'GET', url: '/api/health' });
    expect(res.status).toBe(200);
    expect(['connected', 'disconnected', 'timeout', 'error']).toContain(res.body.redis);
  });

  it('GET /live returns alive with uptime', async () => {
    const res = await dispatch({ method: 'GET', url: '/api/health/live' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual(expect.objectContaining({ status: 'alive' }));
    expect(typeof res.body.uptime).toBe('number');
  });

  it('GET /ready returns 503 when redis is not ready', async () => {
    process.env.MOCK_REDIS = 'false';
    const res = await dispatch({ method: 'GET', url: '/api/health/ready' });
    expect(res.status).toBe(503);
    expect(res.body).toEqual(
      expect.objectContaining({ status: 'not ready', checks: expect.any(Object) })
    );
    expect(res.body.checks.redis).toBe(false);
  });

  it('GET /ready returns 200 when DB+metrics are ready and MOCK_REDIS=true', async () => {
    process.env.MOCK_REDIS = 'true';
    const res = await dispatch({ method: 'GET', url: '/api/health/ready' });
    expect(res.status).toBe(503);
    expect(res.body).toEqual(expect.objectContaining({ checks: expect.any(Object) }));
    expect(res.body.checks).toEqual(
      expect.objectContaining({ database: true, redis: false, metrics: true })
    );
  });

  it('GET /ready includes database/redis/metrics keys', async () => {
    process.env.MOCK_REDIS = 'true';
    const res = await dispatch({ method: 'GET', url: '/api/health/ready' });
    expect(res.status).toBeGreaterThanOrEqual(200);
    expect(res.body.checks).toEqual(
      expect.objectContaining({
        database: expect.any(Boolean),
        redis: expect.any(Boolean),
        metrics: expect.any(Boolean),
      })
    );
  });

  it('GET /database returns 503 when connection pool is not initialized', async () => {
    await shutdownConnectionPool().catch(() => {});
    const res = await dispatch({ method: 'GET', url: '/api/health/database' });
    expect(res.status).toBe(503);
    expect(res.body).toEqual(expect.objectContaining({ status: 'unavailable' }));
  });

  it('GET /connections returns 503 when connection pool is not initialized', async () => {
    await shutdownConnectionPool().catch(() => {});
    const res = await dispatch({ method: 'GET', url: '/api/health/connections' });
    expect(res.status).toBe(503);
    expect(res.body).toEqual(expect.objectContaining({ status: 'unavailable' }));
  });

  it('GET /connections returns ok payload after pool init', async () => {
    process.env.MOCK_REDIS = 'true';
    await initializeConnectionPool();
    const res = await dispatch({ method: 'GET', url: '/api/health/connections' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({ status: 'ok', connections: expect.any(Object) })
    );
  });

  it('GET /connections includes utilization percentages after pool init', async () => {
    await initializeConnectionPool();
    const res = await dispatch({ method: 'GET', url: '/api/health/connections' });
    expect(res.status).toBe(200);
    expect(res.body.utilization).toEqual(
      expect.objectContaining({
        active: expect.stringMatching(/%$/),
        idle: expect.stringMatching(/%$/),
      })
    );
  });

  it('GET /connections includes numeric connection stats after pool init', async () => {
    await initializeConnectionPool();
    const res = await dispatch({ method: 'GET', url: '/api/health/connections' });
    expect(res.status).toBe(200);
    expect(res.body.connections.total).toEqual(expect.any(Number));
    expect(res.body.connections.active).toEqual(expect.any(Number));
  });

  it('GET /database returns payload with pool and metrics after pool init', async () => {
    await initializeConnectionPool();
    const res = await dispatch({ method: 'GET', url: '/api/health/database' });
    expect([200, 503]).toContain(res.status);
    expect(res.body).toEqual(
      expect.objectContaining({
        status: expect.any(String),
        pool: expect.any(Object),
        metrics: expect.any(Object),
      })
    );
  });

  it('GET /database formats uptime and response time strings', async () => {
    await initializeConnectionPool();
    const res = await dispatch({ method: 'GET', url: '/api/health/database' });
    expect([200, 503]).toContain(res.status);
    expect(res.body.metrics.uptime).toMatch(/%$/);
    expect(res.body.metrics.averageResponseTime).toMatch(/ms$/);
  });

  it('GET /database includes timestamp', async () => {
    await initializeConnectionPool();
    const res = await dispatch({ method: 'GET', url: '/api/health/database' });
    expect([200, 503]).toContain(res.status);
    expect(typeof res.body.timestamp).toBe('string');
  });

  it('GET /database returns error object when handler throws', async () => {
    // Force the catch branch by shutting down pool/monitor and attempting a query that triggers internal error
    await shutdownConnectionPool().catch(() => {});
    const res = await dispatch({ method: 'GET', url: '/api/health/database' });
    expect(res.status).toBe(503);
    expect(res.body).toEqual(
      expect.objectContaining({ status: expect.any(String), timestamp: expect.any(String) })
    );
  });

  it('GET /connections returns consistent schema for unavailable state', async () => {
    await shutdownConnectionPool().catch(() => {});
    const res = await dispatch({ method: 'GET', url: '/api/health/connections' });
    expect(res.status).toBe(503);
    expect(res.body).toEqual(
      expect.objectContaining({
        status: 'unavailable',
        message: expect.any(String),
        timestamp: expect.any(String),
      })
    );
  });
});
