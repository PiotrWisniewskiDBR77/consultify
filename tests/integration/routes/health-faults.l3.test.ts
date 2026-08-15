import { describe, expect, it, vi } from 'vitest';
import express from 'express';
import { EventEmitter } from 'node:events';

const dispatchFactory = (app: any) => {
  return async ({ method, url }: { method: string; url: string }) => {
    const req = new EventEmitter();
    Object.assign(req, {
      method,
      url,
      headers: {},
      body: undefined,
      cookies: {},
      path: url,
      query: {},
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
};

describe('Health routes fault injection (L3)', () => {
  it('healthRoutes uses no-op rate limiter when defaultRateLimiter is not a function', async () => {
    vi.resetModules();
    vi.doMock('../../../server/src/middleware/rateLimiting.middleware.js', () => ({
      defaultRateLimiter: null,
    }));

    const { default: healthRoutes } = await import('../../../server/src/routes/healthRoutes.ts');
    const app = express();
    app.use('/api/health', healthRoutes);
    const dispatch = dispatchFactory(app);

    const res = await dispatch({ method: 'GET', url: '/api/health/ping' });
    expect(res.status).toBe(200);
    expect(res.text).toBe('pong');

    vi.doUnmock('../../../server/src/middleware/rateLimiting.middleware.js');
  });

  it('db health /database returns 503 with error payload when database module throws', async () => {
    vi.resetModules();
    vi.doMock('../../../server/src/database/index.js', () => ({
      getConnectionPool: () => {
        throw new Error('boom');
      },
      getHealthMonitor: () => {
        throw new Error('boom');
      },
    }));

    const { default: dbHealthRoutes } = await import('../../../server/src/routes/health.routes.ts');
    const app = express();
    app.use('/api/health', dbHealthRoutes);
    const dispatch = dispatchFactory(app);

    const res = await dispatch({ method: 'GET', url: '/api/health/database' });
    expect(res.status).toBe(503);
    expect(res.body).toEqual(
      expect.objectContaining({
        status: 'error',
        message: 'Health check failed',
        code: 'HEALTH_DATABASE_PROBE_FAILED',
      })
    );

    vi.doUnmock('../../../server/src/database/index.js');
  });

  it('db health /connections returns 503 with a sanitized error payload when database module throws', async () => {
    vi.resetModules();
    vi.doMock('../../../server/src/database/index.js', () => ({
      getConnectionPool: () => {
        throw new Error('boom');
      },
      getHealthMonitor: () => null,
    }));

    const { default: dbHealthRoutes } = await import('../../../server/src/routes/health.routes.ts');
    const app = express();
    app.use('/api/health', dbHealthRoutes);
    const dispatch = dispatchFactory(app);

    const res = await dispatch({ method: 'GET', url: '/api/health/connections' });
    expect(res.status).toBe(503);
    expect(res.body).toEqual(
      expect.objectContaining({
        status: 'error',
        message: 'Connection status check failed',
        code: 'HEALTH_CONNECTION_POOL_STATUS_FAILED',
      })
    );

    vi.doUnmock('../../../server/src/database/index.js');
  });
});
