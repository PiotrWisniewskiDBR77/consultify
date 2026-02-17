import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import express from 'express';
import { EventEmitter } from 'node:events';

import { getDatabase, resetConnection } from '../../../server/src/database/Database.js';
import { initializeDatabase } from '../../../server/src/database/DatabaseInitializer.js';

vi.hoisted(() => {
  process.env.MOCK_DB = 'false';
  process.env.TEST_TYPE = 'integration';
  process.env.NODE_ENV = 'test';
  process.env.MOCK_REDIS = 'true';

  const workerId = process.env.VITEST_WORKER_ID || '0';
  const runId = process.env.VITEST_RUN_ID || Date.now().toString(36);
  process.env.SQLITE_PATH = `./test-l3-${workerId}-${runId}.db`;
});

describe('DB metrics routes integration (L3)', () => {
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
        if (err) reject(err);
      });
    });
  };

  const makeAppWithRouter = async () => {
    const app = express();
    app.use(express.json());
    app.use((err: any, _req: any, res: any, _next: any) => {
      res.status(500).json({ success: false, error: err?.message || 'Internal error' });
    });

    const router = (await import('../../../server/src/routes/db-metrics.routes.ts')).default;
    app.use('/api/metrics', router);
    return app;
  };

  beforeAll(async () => {
    await initializeDatabase();
    if ((db as any).initPromise) await (db as any).initPromise;
    await dbRun(
      `INSERT OR IGNORE INTO organizations (id, name, plan, status) VALUES (?, ?, ?, ?)`,
      ['test-org-id', 'Test Org', 'enterprise', 'active']
    );
  });

  afterAll(async () => {
    await resetConnection();
  });

  it('GET /slow-queries returns ok with statistics and timestamp', async () => {
    vi.resetModules();
    vi.doMock('../../../server/src/database/SlowQueryLogger.js', () => ({
      getSlowQueryLogger: () => ({
        getStatistics: () => ({ total: 3, avgMs: 12 }),
      }),
    }));

    const app = await makeAppWithRouter();
    const res = await dispatch(app, { method: 'GET', url: '/api/metrics/slow-queries' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({ status: 'ok', total: 3, avgMs: 12, timestamp: expect.any(String) })
    );

    vi.doUnmock('../../../server/src/database/SlowQueryLogger.js');
  });

  it('GET /slow-queries returns 500 when slow query logger throws', async () => {
    vi.resetModules();
    vi.doMock('../../../server/src/database/SlowQueryLogger.js', () => ({
      getSlowQueryLogger: () => {
        throw new Error('no logger');
      },
    }));

    const app = await makeAppWithRouter();
    const res = await dispatch(app, { method: 'GET', url: '/api/metrics/slow-queries' });
    expect(res.status).toBe(500);
    expect(res.body).toEqual(
      expect.objectContaining({ status: 'error', message: 'Failed to get slow query statistics' })
    );

    vi.doUnmock('../../../server/src/database/SlowQueryLogger.js');
  });

  it('GET /slow-queries/recent uses default limit=50 when limit is missing', async () => {
    vi.resetModules();
    vi.doMock('../../../server/src/database/SlowQueryLogger.js', () => ({
      getSlowQueryLogger: () => ({
        getRecentSlowQueries: (limit: number) => [{ id: 'q1', limit }],
      }),
    }));

    const app = await makeAppWithRouter();
    const res = await dispatch(app, { method: 'GET', url: '/api/metrics/slow-queries/recent' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        status: 'ok',
        count: 1,
        queries: [{ id: 'q1', limit: 50 }],
        timestamp: expect.any(String),
      })
    );

    vi.doUnmock('../../../server/src/database/SlowQueryLogger.js');
  });

  it('GET /slow-queries/recent uses parsed limit and falls back to 50 on NaN', async () => {
    vi.resetModules();
    vi.doMock('../../../server/src/database/SlowQueryLogger.js', () => ({
      getSlowQueryLogger: () => ({
        getRecentSlowQueries: (limit: number) => [{ limit }],
      }),
    }));

    const app = await makeAppWithRouter();
    const good = await dispatch(app, {
      method: 'GET',
      url: '/api/metrics/slow-queries/recent',
      query: { limit: '2' },
    });
    expect(good.body.queries[0].limit).toBe(2);

    const bad = await dispatch(app, {
      method: 'GET',
      url: '/api/metrics/slow-queries/recent',
      query: { limit: 'abc' },
    });
    expect(bad.body.queries[0].limit).toBe(50);

    vi.doUnmock('../../../server/src/database/SlowQueryLogger.js');
  });

  it('GET /slow-queries/top uses default limit=10 and respects parsed limit', async () => {
    vi.resetModules();
    vi.doMock('../../../server/src/database/SlowQueryLogger.js', () => ({
      getSlowQueryLogger: () => ({
        getTopSlowQueries: (limit: number) => [{ limit }],
      }),
    }));

    const app = await makeAppWithRouter();
    const def = await dispatch(app, { method: 'GET', url: '/api/metrics/slow-queries/top' });
    expect(def.body.queries[0].limit).toBe(10);

    const custom = await dispatch(app, {
      method: 'GET',
      url: '/api/metrics/slow-queries/top',
      query: { limit: '3' },
    });
    expect(custom.body.queries[0].limit).toBe(3);

    vi.doUnmock('../../../server/src/database/SlowQueryLogger.js');
  });

  it('GET /slow-queries/top returns 500 when getTopSlowQueries throws', async () => {
    vi.resetModules();
    vi.doMock('../../../server/src/database/SlowQueryLogger.js', () => ({
      getSlowQueryLogger: () => ({
        getTopSlowQueries: () => {
          throw new Error('boom');
        },
      }),
    }));

    const app = await makeAppWithRouter();
    const res = await dispatch(app, { method: 'GET', url: '/api/metrics/slow-queries/top' });
    expect(res.status).toBe(500);
    expect(res.body).toEqual(
      expect.objectContaining({ status: 'error', message: 'Failed to get top slow queries' })
    );

    vi.doUnmock('../../../server/src/database/SlowQueryLogger.js');
  });

  it('POST /slow-queries/export returns filepath and 500 on error', async () => {
    vi.resetModules();
    vi.doMock('../../../server/src/database/SlowQueryLogger.js', () => ({
      getSlowQueryLogger: () => ({
        exportToJson: async () => '/tmp/slow-queries.json',
      }),
    }));

    const app = await makeAppWithRouter();
    const ok = await dispatch(app, { method: 'POST', url: '/api/metrics/slow-queries/export' });
    expect(ok.status).toBe(200);
    expect(ok.body).toEqual(
      expect.objectContaining({
        status: 'ok',
        message: 'Slow queries exported successfully',
        filepath: '/tmp/slow-queries.json',
        timestamp: expect.any(String),
      })
    );

    vi.resetModules();
    vi.doMock('../../../server/src/database/SlowQueryLogger.js', () => ({
      getSlowQueryLogger: () => ({
        exportToJson: async () => {
          throw new Error('disk full');
        },
      }),
    }));
    const app2 = await makeAppWithRouter();
    const err = await dispatch(app2, { method: 'POST', url: '/api/metrics/slow-queries/export' });
    expect(err.status).toBe(500);
    expect(err.body).toEqual(expect.objectContaining({ status: 'error' }));

    vi.doUnmock('../../../server/src/database/SlowQueryLogger.js');
  });

  it('DELETE /slow-queries clears logs and returns 500 on error', async () => {
    vi.resetModules();
    const clear = vi.fn();
    vi.doMock('../../../server/src/database/SlowQueryLogger.js', () => ({
      getSlowQueryLogger: () => ({
        clear,
      }),
    }));

    const app = await makeAppWithRouter();
    const ok = await dispatch(app, { method: 'DELETE', url: '/api/metrics/slow-queries' });
    expect(ok.status).toBe(200);
    expect(clear).toHaveBeenCalledTimes(1);

    vi.resetModules();
    vi.doMock('../../../server/src/database/SlowQueryLogger.js', () => ({
      getSlowQueryLogger: () => ({
        clear: () => {
          throw new Error('nope');
        },
      }),
    }));
    const app2 = await makeAppWithRouter();
    const err = await dispatch(app2, { method: 'DELETE', url: '/api/metrics/slow-queries' });
    expect(err.status).toBe(500);
    expect(err.body).toEqual(expect.objectContaining({ status: 'error' }));

    vi.doUnmock('../../../server/src/database/SlowQueryLogger.js');
  });

  it('GET /database returns metrics and 500 on error', async () => {
    vi.resetModules();
    vi.doMock('../../../server/src/database/DatabaseMetrics.js', () => ({
      getDatabaseMetrics: () => ({
        getAllMetrics: async (_db: any) => ({ connections: 1 }),
      }),
    }));
    vi.doMock('../../../server/src/database/index.js', () => ({
      getDatabase: () => ({ ok: true }),
    }));

    const app = await makeAppWithRouter();
    const ok = await dispatch(app, { method: 'GET', url: '/api/metrics/database' });
    expect(ok.status).toBe(200);
    expect(ok.body).toEqual(
      expect.objectContaining({ status: 'ok', metrics: { connections: 1 }, timestamp: expect.any(String) })
    );

    vi.resetModules();
    vi.doMock('../../../server/src/database/DatabaseMetrics.js', () => ({
      getDatabaseMetrics: () => {
        throw new Error('bad metrics');
      },
    }));
    vi.doMock('../../../server/src/database/index.js', () => ({
      getDatabase: () => ({ ok: true }),
    }));
    const app2 = await makeAppWithRouter();
    const err = await dispatch(app2, { method: 'GET', url: '/api/metrics/database' });
    expect(err.status).toBe(500);
    expect(err.body).toEqual(expect.objectContaining({ status: 'error', message: 'Failed to get database metrics' }));

    vi.doUnmock('../../../server/src/database/DatabaseMetrics.js');
    vi.doUnmock('../../../server/src/database/index.js');
  });

  it('GET /performance returns performance metrics and 500 on error', async () => {
    vi.resetModules();
    vi.doMock('../../../server/src/database/DatabaseMetrics.js', () => ({
      getDatabaseMetrics: () => ({
        getQueryMetrics: () => ({ p95: 123 }),
      }),
    }));

    const app = await makeAppWithRouter();
    const ok = await dispatch(app, { method: 'GET', url: '/api/metrics/performance' });
    expect(ok.status).toBe(200);
    expect(ok.body).toEqual(
      expect.objectContaining({ status: 'ok', performance: { p95: 123 }, timestamp: expect.any(String) })
    );

    vi.resetModules();
    vi.doMock('../../../server/src/database/DatabaseMetrics.js', () => ({
      getDatabaseMetrics: () => ({
        getQueryMetrics: () => {
          throw new Error('perf fail');
        },
      }),
    }));
    const app2 = await makeAppWithRouter();
    const err = await dispatch(app2, { method: 'GET', url: '/api/metrics/performance' });
    expect(err.status).toBe(500);
    expect(err.body).toEqual(expect.objectContaining({ status: 'error', message: 'Failed to get performance metrics' }));

    vi.doUnmock('../../../server/src/database/DatabaseMetrics.js');
  });
});
