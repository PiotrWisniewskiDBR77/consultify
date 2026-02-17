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
  process.env.ENABLE_TEST_AUTH_BYPASS = 'true';

  const workerId = process.env.VITEST_WORKER_ID || '0';
  const runId = process.env.VITEST_RUN_ID || Date.now().toString(36);
  process.env.SQLITE_PATH = `./test-l3-${workerId}-${runId}.db`;
});

describe('Security routes fallbacks integration (L3)', () => {
  const db = getDatabase();

  const makeApp = async () => {
    const app = express();
    app.use(express.json());
    const router = (await import('../../../server/src/routes/security.routes.ts')).default;
    app.use('/api/security', router);
    app.use((err: any, _req: any, res: any, _next: any) => {
      res.status(500).json({ success: false, error: err?.message || 'Internal error' });
    });
    return app;
  };

  const dispatch = async (
    app: express.Express,
    {
      method,
      url,
      body,
      headers = {},
      user,
    }: {
      method: string;
      url: string;
      body?: any;
      headers?: Record<string, string>;
      user?: any;
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

  const ownerUser = { id: 'u-owner', organizationId: 'org-1', role: 'owner' };

  beforeAll(async () => {
    await initializeDatabase();
    if ((db as any).initPromise) await (db as any).initPromise;
  });

  afterAll(async () => {
    await resetConnection();
  });

  it('GET /audit-logs returns empty response on DbPromise failure (catch path)', async () => {
    vi.resetModules();
    vi.doMock('../../../server/src/utils/DbPromise.js', () => ({
      all: async () => {
        throw new Error('boom');
      },
      get: async () => undefined,
      run: async () => ({ success: true }),
    }));

    const app = await makeApp();
    const res = await dispatch(app, { method: 'GET', url: '/api/security/audit-logs', user: ownerUser });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      logs: [],
      stats: { total: 0, high: 0, medium: 0, low: 0, unresolved: 0 },
    });

    vi.doUnmock('../../../server/src/utils/DbPromise.js');
    vi.resetModules();
  });

  it('GET /api-keys/usage returns [] on DbPromise failure (catch path)', async () => {
    vi.resetModules();
    vi.doMock('../../../server/src/utils/DbPromise.js', () => ({
      all: async () => {
        throw new Error('boom');
      },
      get: async () => undefined,
      run: async () => ({ success: true }),
    }));

    const app = await makeApp();
    const res = await dispatch(app, { method: 'GET', url: '/api/security/api-keys/usage', user: ownerUser });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ usage: [] });

    vi.doUnmock('../../../server/src/utils/DbPromise.js');
    vi.resetModules();
  });
});

