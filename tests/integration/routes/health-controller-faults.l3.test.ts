import { describe, expect, it, vi } from 'vitest';
import { EventEmitter } from 'node:events';

const makeRes = () => {
  const res = new EventEmitter() as any;
  const out = { status: 200, body: undefined as any, text: '' };

  const done = new Promise<typeof out>((resolve) => res.on('finish', () => resolve(out)));

  Object.assign(res, {
    statusCode: 200,
    status(code: number) {
      res.statusCode = code;
      out.status = code;
      return res;
    },
    json(obj: any) {
      out.body = obj;
      out.text = JSON.stringify(obj);
      res.emit('finish');
      return res;
    },
    send(payload: any) {
      out.text = String(payload ?? '');
      res.emit('finish');
      return res;
    },
  });

  return { res, out, done };
};

const makeReq = (overrides: any = {}) => {
  return {
    ip: '127.0.0.1',
    headers: {},
    get(_name: string) {
      return undefined;
    },
    query: {},
    ...overrides,
  } as any;
};

describe('HealthCheckController faults (L3)', () => {
  it('checkReadiness returns 503 when DB query throws', async () => {
    vi.resetModules();
    vi.doMock('../../../server/src/database/Database.js', () => ({
      getDatabase: () => ({
        query: async () => {
          throw new Error('db down');
        },
      }),
    }));

    const { HealthCheckController } = await import(
      '../../../server/src/controllers/HealthCheckController.ts'
    );

    process.env.NODE_ENV = 'test';
    process.env.MOCK_REDIS = 'true';

    const req = makeReq();
    const { res, done } = makeRes();
    await HealthCheckController.checkReadiness(req, res);
    const result = await done;
    expect(result.status).toBe(503);
    expect(result.body.checks.database).toBe(false);

    vi.doUnmock('../../../server/src/database/Database.js');
  });

  it('checkReadiness returns 503 when metrics service throws', async () => {
    vi.resetModules();
    vi.doMock('../../../server/src/database/Database.js', () => ({
      getDatabase: () => ({
        query: async () => ({ rows: [{ ok: 1 }] }),
      }),
    }));
    vi.doMock('../../../server/src/services/metricsService.js', () => ({
      getMetricsService: () => ({
        getMetrics: async () => {
          throw new Error('metrics down');
        },
      }),
    }));

    const { HealthCheckController } = await import(
      '../../../server/src/controllers/HealthCheckController.ts'
    );

    process.env.NODE_ENV = 'test';
    process.env.MOCK_REDIS = 'true';

    const req = makeReq();
    const { res, done } = makeRes();
    await HealthCheckController.checkReadiness(req, res);
    const result = await done;
    expect(result.status).toBe(503);
    expect(result.body.checks.metrics).toBe(false);

    vi.doUnmock('../../../server/src/services/metricsService.js');
    vi.doUnmock('../../../server/src/database/Database.js');
  });

  it('checkHealth reports redis=connected when redis bridge reports connected', async () => {
    vi.resetModules();
    vi.doMock('../../../server/src/services/ai/redisClient.js', () => ({
      isRedisConnected: () => true,
    }));
    vi.doMock('../../../server/src/utils/RedisClient.js', () => ({
      default: { isReady: false },
    }));

    const { HealthCheckController } = await import(
      '../../../server/src/controllers/HealthCheckController.ts'
    );

    process.env.NODE_ENV = 'test';
    process.env.MOCK_REDIS = 'false';

    const req = makeReq();
    const { res, done } = makeRes();
    await HealthCheckController.checkHealth(req, res);
    const result = await done;
    expect(result.status).toBe(200);
    expect(result.body.redis).toBe('connected');

    vi.doUnmock('../../../server/src/services/ai/redisClient.js');
    vi.doUnmock('../../../server/src/utils/RedisClient.js');
  });

  it('checkHealth reports redis=disconnected when both redis clients are not ready', async () => {
    vi.resetModules();
    vi.doMock('../../../server/src/services/ai/redisClient.js', () => ({
      isRedisConnected: () => false,
    }));
    vi.doMock('../../../server/src/utils/RedisClient.js', () => ({
      default: { isReady: false, isOpen: false },
    }));

    const { HealthCheckController } = await import(
      '../../../server/src/controllers/HealthCheckController.ts'
    );

    process.env.NODE_ENV = 'test';
    process.env.MOCK_REDIS = 'false';

    const req = makeReq();
    const { res, done } = makeRes();
    await HealthCheckController.checkHealth(req, res);
    const result = await done;
    expect(result.status).toBe(200);
    expect(['disconnected', 'timeout', 'error']).toContain(result.body.redis);

    vi.doUnmock('../../../server/src/services/ai/redisClient.js');
    vi.doUnmock('../../../server/src/utils/RedisClient.js');
  });

  it('checkHealth reports redis=error when timeout scheduler throws', async () => {
    vi.resetModules();
    vi.doMock('../../../server/src/services/ai/redisClient.js', () => ({
      isRedisConnected: () => false,
    }));
    vi.doMock('../../../server/src/utils/RedisClient.js', () => ({
      default: { isReady: false, isOpen: false },
    }));

    const { HealthCheckController } = await import(
      '../../../server/src/controllers/HealthCheckController.ts'
    );

    process.env.NODE_ENV = 'test';
    process.env.MOCK_REDIS = 'false';

    const realSetTimeout = globalThis.setTimeout;
    try {
      (globalThis as any).setTimeout = () => {
        throw new Error('timer boom');
      };

      const req = makeReq();
      const { res, done } = makeRes();
      await HealthCheckController.checkHealth(req, res);
      const result = await done;
      expect(result.status).toBe(200);
      expect(result.body.redis).toBe('error');
    } finally {
      globalThis.setTimeout = realSetTimeout;
      vi.doUnmock('../../../server/src/services/ai/redisClient.js');
      vi.doUnmock('../../../server/src/utils/RedisClient.js');
    }
  });

  it('checkReadiness sets checks.redis=false when env access throws (catch-all)', async () => {
    vi.resetModules();
    vi.doMock('../../../server/src/database/Database.js', () => ({
      getDatabase: () => ({
        query: async () => ({ rows: [{ ok: 1 }] }),
      }),
    }));
    vi.doMock('../../../server/src/services/metricsService.js', () => ({
      getMetricsService: () => ({
        getMetrics: async () => ({ ok: true }),
      }),
    }));

    const { HealthCheckController } = await import(
      '../../../server/src/controllers/HealthCheckController.ts'
    );

    const originalEnv = process.env;
    try {
      (process as any).env = new Proxy(originalEnv, {
        get(target, prop) {
          if (prop === 'MOCK_REDIS') throw new Error('env boom');
          return (target as any)[prop];
        },
      });

      const req = makeReq();
      const { res, done } = makeRes();
      await HealthCheckController.checkReadiness(req, res);
      const result = await done;
      expect(result.status).toBe(503);
      expect(result.body.checks.database).toBe(true);
      expect(result.body.checks.metrics).toBe(true);
      expect(result.body.checks.redis).toBe(false);
    } finally {
      (process as any).env = originalEnv;
      vi.doUnmock('../../../server/src/services/metricsService.js');
      vi.doUnmock('../../../server/src/database/Database.js');
    }
  });
});
