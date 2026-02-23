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

describe('HealthCheckController (L3)', () => {
  it('ping responds with pong', async () => {
    vi.resetModules();
    vi.doMock('../../../server/src/database/Database.js', () => ({
      getDatabase: () => ({
        query: async () => ({ rows: [{ ok: 1 }] }),
      }),
    }));
    const { HealthCheckController } = await import(
      '../../../server/src/controllers/HealthCheckController.ts'
    );

    const req = makeReq();
    const { res, done } = makeRes();
    HealthCheckController.ping(req, res);
    const result = await done;
    expect(result.status).toBe(200);
    expect(result.text).toBe('pong');

    vi.doUnmock('../../../server/src/database/Database.js');
  });

  it('checkLiveness returns alive with uptime', async () => {
    vi.resetModules();
    vi.doMock('../../../server/src/database/Database.js', () => ({
      getDatabase: () => ({
        query: async () => ({ rows: [{ ok: 1 }] }),
      }),
    }));
    const { HealthCheckController } = await import(
      '../../../server/src/controllers/HealthCheckController.ts'
    );

    const req = makeReq();
    const { res, done } = makeRes();
    await HealthCheckController.checkLiveness(req, res);
    const result = await done;
    expect(result.status).toBe(200);
    expect(result.body).toEqual(
      expect.objectContaining({
        status: 'alive',
        uptime: expect.any(Number),
        timestamp: expect.any(String),
      })
    );

    vi.doUnmock('../../../server/src/database/Database.js');
  });

  it('checkHealth returns degraded and redis=mocked-unavailable when MOCK_REDIS=true', async () => {
    vi.resetModules();
    process.env.NODE_ENV = 'test';
    process.env.MOCK_REDIS = 'true';
    vi.doMock('../../../server/src/database/Database.js', () => ({
      getDatabase: () => ({
        query: async () => ({ rows: [{ ok: 1 }] }),
      }),
    }));

    const { HealthCheckController } = await import(
      '../../../server/src/controllers/HealthCheckController.ts'
    );

    const req = makeReq();
    const { res, done } = makeRes();
    await HealthCheckController.checkHealth(req, res);
    const result = await done;

    expect(result.status).toBe(200);
    expect(result.body).toEqual(
      expect.objectContaining({
        status: 'degraded',
        database: 'connected',
        redis: 'mocked-unavailable',
        environment: 'test',
        timestamp: expect.any(String),
        version: expect.any(String),
      })
    );

    vi.doUnmock('../../../server/src/database/Database.js');
  });

  it('checkHealth reports redis=connected when redis bridge reports connected', async () => {
    vi.resetModules();
    process.env.NODE_ENV = 'test';
    process.env.MOCK_REDIS = 'false';

    vi.doMock('../../../server/src/database/Database.js', () => ({
      getDatabase: () => ({
        query: async () => ({ rows: [{ ok: 1 }] }),
      }),
    }));
    vi.doMock('../../../server/src/services/ai/redisClient.js', () => ({
      isRedisConnected: () => true,
    }));
    vi.doMock('../../../server/src/utils/RedisClient.js', () => ({
      default: { isReady: false },
    }));

    const { HealthCheckController } = await import(
      '../../../server/src/controllers/HealthCheckController.ts'
    );

    const req = makeReq();
    const { res, done } = makeRes();
    await HealthCheckController.checkHealth(req, res);
    const result = await done;

    expect(result.status).toBe(200);
    expect(result.body.redis).toBe('connected');

    vi.doUnmock('../../../server/src/services/ai/redisClient.js');
    vi.doUnmock('../../../server/src/utils/RedisClient.js');
    vi.doUnmock('../../../server/src/database/Database.js');
  });

  it('checkHealth reports redis=disconnected when both redis clients are not ready', async () => {
    vi.resetModules();
    process.env.NODE_ENV = 'test';
    process.env.MOCK_REDIS = 'false';

    vi.doMock('../../../server/src/database/Database.js', () => ({
      getDatabase: () => ({
        query: async () => ({ rows: [{ ok: 1 }] }),
      }),
    }));
    vi.doMock('../../../server/src/services/ai/redisClient.js', () => ({
      isRedisConnected: () => false,
    }));
    vi.doMock('../../../server/src/utils/RedisClient.js', () => ({
      default: { isReady: false, isOpen: false },
    }));

    const { HealthCheckController } = await import(
      '../../../server/src/controllers/HealthCheckController.ts'
    );

    const req = makeReq();
    const { res, done } = makeRes();
    await HealthCheckController.checkHealth(req, res);
    const result = await done;

    expect(result.status).toBe(200);
    expect(['disconnected', 'timeout', 'error']).toContain(result.body.redis);

    vi.doUnmock('../../../server/src/services/ai/redisClient.js');
    vi.doUnmock('../../../server/src/utils/RedisClient.js');
    vi.doUnmock('../../../server/src/database/Database.js');
  });

  it('checkReadiness returns 200 when db, redis, and metrics are ready', async () => {
    vi.resetModules();
    process.env.NODE_ENV = 'test';
    process.env.MOCK_REDIS = 'false';

    vi.doMock('../../../server/src/database/Database.js', () => ({
      getDatabase: () => ({
        query: async () => ({ rows: [{ ok: 1 }] }),
      }),
    }));
    vi.doMock('../../../server/src/services/ai/redisClient.js', () => ({
      isRedisConnected: () => true,
    }));
    vi.doMock('../../../server/src/utils/RedisClient.js', () => ({
      default: { isReady: false, isOpen: false },
    }));
    vi.doMock('../../../server/src/services/metricsService.js', () => ({
      getMetricsService: () => ({
        getMetrics: async () => '# ok\n',
      }),
    }));

    const { HealthCheckController } = await import(
      '../../../server/src/controllers/HealthCheckController.ts'
    );

    const req = makeReq();
    const { res, done } = makeRes();
    await HealthCheckController.checkReadiness(req, res);
    const result = await done;

    expect(result.status).toBe(200);
    expect(result.body).toEqual(
      expect.objectContaining({
        status: 'ready',
        checks: { database: true, redis: true, metrics: true },
        timestamp: expect.any(String),
      })
    );

    vi.doUnmock('../../../server/src/services/metricsService.js');
    vi.doUnmock('../../../server/src/utils/RedisClient.js');
    vi.doUnmock('../../../server/src/services/ai/redisClient.js');
    vi.doUnmock('../../../server/src/database/Database.js');
  });

  it('checkReadiness returns 503 when redis is not ready', async () => {
    vi.resetModules();
    process.env.NODE_ENV = 'test';
    process.env.MOCK_REDIS = 'false';

    vi.doMock('../../../server/src/database/Database.js', () => ({
      getDatabase: () => ({
        query: async () => ({ rows: [{ ok: 1 }] }),
      }),
    }));
    vi.doMock('../../../server/src/services/metricsService.js', () => ({
      getMetricsService: () => ({
        getMetrics: async () => '# ok\n',
      }),
    }));
    vi.doMock('../../../server/src/services/ai/redisClient.js', () => ({
      isRedisConnected: () => false,
    }));
    vi.doMock('../../../server/src/utils/RedisClient.js', () => ({
      default: { isReady: false, isOpen: false },
    }));

    const { HealthCheckController } = await import(
      '../../../server/src/controllers/HealthCheckController.ts'
    );

    const req = makeReq();
    const { res, done } = makeRes();
    await HealthCheckController.checkReadiness(req, res);
    const result = await done;

    expect(result.status).toBe(503);
    expect(result.body.status).toBe('not ready');
    expect(result.body.checks.redis).toBe(false);

    vi.doUnmock('../../../server/src/utils/RedisClient.js');
    vi.doUnmock('../../../server/src/services/ai/redisClient.js');
    vi.doUnmock('../../../server/src/services/metricsService.js');
    vi.doUnmock('../../../server/src/database/Database.js');
  });

  it('aggregatedHealth returns 200 healthy when all components are healthy', async () => {
    vi.resetModules();
    vi.doMock('../../../server/src/database/Database.js', () => ({
      getDatabase: () => ({
        query: async () => ({ rows: [{ ok: 1 }] }),
      }),
    }));
    vi.doMock('../../../server/src/services/ai/redisClient.js', () => ({
      isRedisConnected: () => true,
    }));
    vi.doMock('../../../server/src/middleware/alertWatchdog.middleware.js', () => ({
      getWatchdogStats: () => ({ totalRequests: 100, totalFiveXx: 0, windowFiveXx: 0, p95Ms: 120 }),
    }));
    vi.doMock('../../../server/src/middleware/metrics.middleware.js', () => ({
      getRequestMetrics: () => ({
        requests: 10,
        errors: 0,
        rateLimitHits: 0,
        aiTimeouts: 0,
      }),
    }));

    const { HealthCheckController } = await import(
      '../../../server/src/controllers/HealthCheckController.ts'
    );

    const req = makeReq();
    const { res, done } = makeRes();
    await HealthCheckController.aggregatedHealth(req, res);
    const result = await done;

    expect(result.status).toBe(200);
    expect(result.body.status).toBe('healthy');
    expect(result.body.components.database.status).toBe('healthy');
    expect(result.body.components.redis.status).toBe('healthy');
    expect(result.body.components.api.status).toBe('healthy');
    expect(result.body.components.metrics.status).toBe('healthy');

    vi.doUnmock('../../../server/src/middleware/metrics.middleware.js');
    vi.doUnmock('../../../server/src/middleware/alertWatchdog.middleware.js');
    vi.doUnmock('../../../server/src/services/ai/redisClient.js');
    vi.doUnmock('../../../server/src/database/Database.js');
  });

  it('aggregatedHealth treats missing watchdog module as healthy API component', async () => {
    vi.resetModules();
    vi.doMock('../../../server/src/database/Database.js', () => ({
      getDatabase: () => ({
        query: async () => ({ rows: [{ ok: 1 }] }),
      }),
    }));
    vi.doMock('../../../server/src/services/ai/redisClient.js', () => ({
      isRedisConnected: () => true,
    }));
    vi.doMock('../../../server/src/middleware/alertWatchdog.middleware.js', () => {
      throw new Error('watchdog missing');
    });

    const { HealthCheckController } = await import(
      '../../../server/src/controllers/HealthCheckController.ts'
    );

    const req = makeReq();
    const { res, done } = makeRes();
    await HealthCheckController.aggregatedHealth(req, res);
    const result = await done;

    expect(result.status).toBe(200);
    expect(result.body.components.api.status).toBe('healthy');

    vi.doUnmock('../../../server/src/middleware/alertWatchdog.middleware.js');
    vi.doUnmock('../../../server/src/services/ai/redisClient.js');
    vi.doUnmock('../../../server/src/database/Database.js');
  });

  it('aggregatedHealth treats missing metrics module as healthy metrics component', async () => {
    vi.resetModules();
    vi.doMock('../../../server/src/database/Database.js', () => ({
      getDatabase: () => ({
        query: async () => ({ rows: [{ ok: 1 }] }),
      }),
    }));
    vi.doMock('../../../server/src/services/ai/redisClient.js', () => ({
      isRedisConnected: () => true,
    }));
    vi.doMock('../../../server/src/middleware/metrics.middleware.js', () => {
      throw new Error('metrics missing');
    });

    const { HealthCheckController } = await import(
      '../../../server/src/controllers/HealthCheckController.ts'
    );

    const req = makeReq();
    const { res, done } = makeRes();
    await HealthCheckController.aggregatedHealth(req, res);
    const result = await done;

    expect(result.status).toBe(200);
    expect(result.body.components.metrics.status).toBe('healthy');

    vi.doUnmock('../../../server/src/middleware/metrics.middleware.js');
    vi.doUnmock('../../../server/src/services/ai/redisClient.js');
    vi.doUnmock('../../../server/src/database/Database.js');
  });

  it('aggregatedHealth returns 200 degraded when redis disconnected or API errors spike', async () => {
    vi.resetModules();
    vi.doMock('../../../server/src/database/Database.js', () => ({
      getDatabase: () => ({
        query: async () => ({ rows: [{ ok: 1 }] }),
      }),
    }));
    vi.doMock('../../../server/src/services/ai/redisClient.js', () => ({
      isRedisConnected: () => false,
    }));
    vi.doMock('../../../server/src/middleware/alertWatchdog.middleware.js', () => ({
      getWatchdogStats: () => ({ totalRequests: 500, totalFiveXx: 25, windowFiveXx: 11, p95Ms: 450 }),
    }));
    vi.doMock('../../../server/src/middleware/metrics.middleware.js', () => ({
      getRequestMetrics: () => ({
        requests: 10,
        errors: 1,
        rateLimitHits: 0,
        aiTimeouts: 0,
      }),
    }));

    const { HealthCheckController } = await import(
      '../../../server/src/controllers/HealthCheckController.ts'
    );

    const req = makeReq();
    const { res, done } = makeRes();
    await HealthCheckController.aggregatedHealth(req, res);
    const result = await done;

    expect(result.status).toBe(200);
    expect(result.body.status).toBe('degraded');
    expect(result.body.components.redis.status).toBe('degraded');
    expect(result.body.components.api.status).toBe('degraded');

    vi.doUnmock('../../../server/src/middleware/metrics.middleware.js');
    vi.doUnmock('../../../server/src/middleware/alertWatchdog.middleware.js');
    vi.doUnmock('../../../server/src/services/ai/redisClient.js');
    vi.doUnmock('../../../server/src/database/Database.js');
  });

  it('aggregatedHealth returns 503 down when database is down', async () => {
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

    const req = makeReq();
    const { res, done } = makeRes();
    await HealthCheckController.aggregatedHealth(req, res);
    const result = await done;

    expect(result.status).toBe(503);
    expect(result.body.status).toBe('down');
    expect(result.body.components.database.status).toBe('down');

    vi.doUnmock('../../../server/src/database/Database.js');
  });
});
