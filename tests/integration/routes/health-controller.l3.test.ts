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

  it('checkReadiness returns 503 when MOCK_REDIS=true (redis check fails)', async () => {
    vi.resetModules();
    process.env.NODE_ENV = 'test';
    process.env.MOCK_REDIS = 'true';

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

    const { HealthCheckController } = await import(
      '../../../server/src/controllers/HealthCheckController.ts'
    );

    const req = makeReq();
    const { res, done } = makeRes();
    await HealthCheckController.checkReadiness(req, res);
    const result = await done;

    expect(result.status).toBe(503);
    expect(result.body).toEqual(
      expect.objectContaining({
        status: 'not ready',
        checks: { database: true, redis: false, metrics: true },
        timestamp: expect.any(String),
      })
    );

    vi.doUnmock('../../../server/src/services/metricsService.js');
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

  it('checkReadiness returns 200 when db, redis, and metrics are ready', async () => {
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
      isRedisConnected: () => true,
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

    vi.doUnmock('../../../server/src/services/ai/redisClient.js');
    vi.doUnmock('../../../server/src/services/metricsService.js');
    vi.doUnmock('../../../server/src/database/Database.js');
  });

  it('aggregatedHealth returns 200 and status=healthy when components are healthy', async () => {
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
      getWatchdogStats: () => ({
        totalRequests: 10,
        totalFiveXx: 0,
        p95Ms: 50,
        windowFiveXx: 0,
      }),
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
    expect(result.body).toEqual(
      expect.objectContaining({
        status: 'healthy',
        timestamp: expect.any(String),
        uptime: expect.any(Number),
        components: expect.objectContaining({
          database: expect.objectContaining({ status: 'healthy' }),
          redis: expect.objectContaining({ status: 'healthy' }),
          api: expect.objectContaining({ status: 'healthy' }),
          metrics: expect.objectContaining({ status: 'healthy' }),
        }),
      })
    );

    vi.doUnmock('../../../server/src/middleware/metrics.middleware.js');
    vi.doUnmock('../../../server/src/middleware/alertWatchdog.middleware.js');
    vi.doUnmock('../../../server/src/services/ai/redisClient.js');
    vi.doUnmock('../../../server/src/database/Database.js');
  });

  it('aggregatedHealth returns 200 and status=degraded when redis is disconnected', async () => {
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
      getWatchdogStats: () => ({
        totalRequests: 0,
        totalFiveXx: 0,
        p95Ms: 0,
        windowFiveXx: 0,
      }),
    }));
    vi.doMock('../../../server/src/middleware/metrics.middleware.js', () => ({
      getRequestMetrics: () => ({
        requests: 0,
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
    expect(result.body.status).toBe('degraded');
    expect(result.body.components.redis.status).toBe('degraded');

    vi.doUnmock('../../../server/src/middleware/metrics.middleware.js');
    vi.doUnmock('../../../server/src/middleware/alertWatchdog.middleware.js');
    vi.doUnmock('../../../server/src/services/ai/redisClient.js');
    vi.doUnmock('../../../server/src/database/Database.js');
  });

  it('aggregatedHealth sets api status=healthy when watchdog stats throws', async () => {
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
      getWatchdogStats: () => {
        throw new Error('watchdog boom');
      },
    }));
    vi.doMock('../../../server/src/middleware/metrics.middleware.js', () => ({
      getRequestMetrics: () => ({
        requests: 1,
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
    expect(result.body.components.api.status).toBe('healthy');

    vi.doUnmock('../../../server/src/middleware/metrics.middleware.js');
    vi.doUnmock('../../../server/src/middleware/alertWatchdog.middleware.js');
    vi.doUnmock('../../../server/src/services/ai/redisClient.js');
    vi.doUnmock('../../../server/src/database/Database.js');
  });

  it('aggregatedHealth covers redis outer catch when redis component assignment throws', async () => {
    vi.resetModules();

    const originalDescriptor = Object.getOwnPropertyDescriptor(Object.prototype, 'redis');
    let calls = 0;
    Object.defineProperty(Object.prototype, 'redis', {
      configurable: true,
      set(value) {
        calls += 1;
        if (calls === 1) throw new Error('redis setter boom');
        Object.defineProperty(this, 'redis', {
          value,
          writable: true,
          configurable: true,
          enumerable: true,
        });
      },
    });

    try {
      vi.doMock('../../../server/src/database/Database.js', () => ({
        getDatabase: () => ({
          query: async () => ({ rows: [{ ok: 1 }] }),
        }),
      }));
      vi.doMock('../../../server/src/services/ai/redisClient.js', () => ({
        isRedisConnected: () => true,
      }));
      vi.doMock('../../../server/src/middleware/alertWatchdog.middleware.js', () => ({
        getWatchdogStats: () => ({
          totalRequests: 0,
          totalFiveXx: 0,
          p95Ms: 0,
          windowFiveXx: 0,
        }),
      }));
      vi.doMock('../../../server/src/middleware/metrics.middleware.js', () => ({
        getRequestMetrics: () => ({
          requests: 0,
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
      expect(result.body.status).toBe('degraded');
      expect(result.body.components.redis.status).toBe('degraded');
    } finally {
      if (originalDescriptor) Object.defineProperty(Object.prototype, 'redis', originalDescriptor);
      else delete (Object.prototype as any).redis;
      vi.doUnmock('../../../server/src/middleware/metrics.middleware.js');
      vi.doUnmock('../../../server/src/middleware/alertWatchdog.middleware.js');
      vi.doUnmock('../../../server/src/services/ai/redisClient.js');
      vi.doUnmock('../../../server/src/database/Database.js');
    }
  });

  it('aggregatedHealth returns 503 and status=down when database check fails', async () => {
    vi.resetModules();

    vi.doMock('../../../server/src/database/Database.js', () => ({
      getDatabase: () => ({
        query: async () => {
          throw new Error('db down');
        },
      }),
    }));
    vi.doMock('../../../server/src/services/ai/redisClient.js', () => ({
      isRedisConnected: () => true,
    }));
    vi.doMock('../../../server/src/middleware/alertWatchdog.middleware.js', () => ({
      getWatchdogStats: () => ({
        totalRequests: 0,
        totalFiveXx: 0,
        p95Ms: 0,
        windowFiveXx: 11,
      }),
    }));
    // Ensure the metrics block's catch branch runs too.
    vi.doMock('../../../server/src/middleware/metrics.middleware.js', () => ({
      getRequestMetrics: () => {
        throw new Error('metrics boom');
      },
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
    expect(result.body.components.database).toEqual(
      expect.objectContaining({ status: 'down', details: expect.any(String) })
    );

    vi.doUnmock('../../../server/src/middleware/metrics.middleware.js');
    vi.doUnmock('../../../server/src/middleware/alertWatchdog.middleware.js');
    vi.doUnmock('../../../server/src/services/ai/redisClient.js');
    vi.doUnmock('../../../server/src/database/Database.js');
  });
});
