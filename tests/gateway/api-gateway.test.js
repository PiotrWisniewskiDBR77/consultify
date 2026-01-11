/**
 * API Gateway and Routing Tests
 * Tests for API gateway patterns
 *
 * @module tests/gateway/api-gateway.test.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Request router
const createRouter = () => {
  const routes = [];
  const middleware = [];

  const match = (method, path) => {
    for (const route of routes) {
      if (route.method !== method && route.method !== 'ALL') continue;

      // Simple pattern matching
      const pattern = route.path.replace(/:[^/]+/g, '([^/]+)').replace(/\*/g, '.*');
      const regex = new RegExp(`^${pattern}$`);
      const match = path.match(regex);

      if (match) {
        const params = {};
        const paramNames = route.path.match(/:[^/]+/g) || [];
        paramNames.forEach((name, i) => {
          params[name.slice(1)] = match[i + 1];
        });
        return { route, params };
      }
    }
    return null;
  };

  return {
    use: (fn) => {
      middleware.push(fn);
    },

    get: (path, handler) => {
      routes.push({ method: 'GET', path, handler });
    },

    post: (path, handler) => {
      routes.push({ method: 'POST', path, handler });
    },

    put: (path, handler) => {
      routes.push({ method: 'PUT', path, handler });
    },

    delete: (path, handler) => {
      routes.push({ method: 'DELETE', path, handler });
    },

    all: (path, handler) => {
      routes.push({ method: 'ALL', path, handler });
    },

    handle: async (req) => {
      const result = match(req.method, req.path);

      if (!result) {
        return { status: 404, body: { error: 'Not found' } };
      }

      req.params = result.params;

      // Run middleware
      for (const mw of middleware) {
        const shouldContinue = await mw(req);
        if (shouldContinue === false) {
          return { status: 403, body: { error: 'Forbidden' } };
        }
      }

      return result.route.handler(req);
    },

    getRoutes: () => routes.map((r) => ({ method: r.method, path: r.path })),
  };
};

// API Gateway
const createAPIGateway = () => {
  const services = new Map();
  const rateLimiters = new Map();
  const cache = new Map();

  return {
    registerService: (name, config) => {
      services.set(name, {
        name,
        baseUrl: config.baseUrl,
        timeout: config.timeout || 30000,
        retries: config.retries || 3,
        circuitBreaker: { failures: 0, lastFailure: null, open: false },
      });
    },

    setRateLimit: (serviceOrPath, limit, window = 60000) => {
      rateLimiters.set(serviceOrPath, {
        limit,
        window,
        requests: [],
      });
    },

    checkRateLimit: (key) => {
      const limiter = rateLimiters.get(key);
      if (!limiter) return true;

      const now = Date.now();
      limiter.requests = limiter.requests.filter((t) => now - t < limiter.window);

      if (limiter.requests.length >= limiter.limit) {
        return false;
      }

      limiter.requests.push(now);
      return true;
    },

    proxy: async (serviceName, path, options = {}) => {
      const service = services.get(serviceName);
      if (!service) throw new Error(`Service not found: ${serviceName}`);

      if (service.circuitBreaker.open) {
        const cooldown = 30000;
        if (Date.now() - service.circuitBreaker.lastFailure < cooldown) {
          throw new Error('Circuit open');
        }
        service.circuitBreaker.open = false;
      }

      // Check cache
      const cacheKey = `${serviceName}:${path}`;
      if (options.cache && cache.has(cacheKey)) {
        const cached = cache.get(cacheKey);
        if (Date.now() - cached.timestamp < options.cacheTTL) {
          return cached.data;
        }
      }

      try {
        // Simulate request
        const response = { data: { service: serviceName, path }, status: 200 };

        if (options.cache) {
          cache.set(cacheKey, { data: response, timestamp: Date.now() });
        }

        service.circuitBreaker.failures = 0;
        return response;
      } catch (error) {
        service.circuitBreaker.failures++;
        service.circuitBreaker.lastFailure = Date.now();

        if (service.circuitBreaker.failures >= 5) {
          service.circuitBreaker.open = true;
        }

        throw error;
      }
    },

    getServiceHealth: (serviceName) => {
      const service = services.get(serviceName);
      if (!service) return null;

      return {
        name: serviceName,
        healthy: !service.circuitBreaker.open,
        failures: service.circuitBreaker.failures,
      };
    },

    clearCache: () => cache.clear(),
  };
};

// Request transformer
const createRequestTransformer = () => {
  const transformers = [];

  return {
    add: (name, transform) => {
      transformers.push({ name, transform });
    },

    transform: async (request) => {
      let result = { ...request };

      for (const { transform } of transformers) {
        result = await transform(result);
      }

      return result;
    },

    addHeader: (header, value) => {
      this.add(`header:${header}`, (req) => ({
        ...req,
        headers: { ...req.headers, [header]: value },
      }));
    },

    clear: () => {
      transformers.length = 0;
    },
  };
};

// Response aggregator
const createResponseAggregator = () => {
  return {
    aggregate: async (requests) => {
      const results = await Promise.allSettled(requests);

      return results.map((result, index) => ({
        index,
        status: result.status,
        data: result.status === 'fulfilled' ? result.value : null,
        error: result.status === 'rejected' ? result.reason.message : null,
      }));
    },

    mergeResponses: (responses, strategy = 'combine') => {
      if (strategy === 'combine') {
        return responses.reduce((acc, r) => ({ ...acc, ...r.data }), {});
      }
      if (strategy === 'array') {
        return responses.map((r) => r.data);
      }
      return responses;
    },
  };
};

describe('Router Tests', () => {
  let router;

  beforeEach(() => {
    router = createRouter();
  });

  it('should route GET requests', async () => {
    router.get('/users', () => ({ status: 200, body: { users: [] } }));

    const response = await router.handle({ method: 'GET', path: '/users' });

    expect(response.status).toBe(200);
  });

  it('should extract path params', async () => {
    router.get('/users/:id', (req) => ({ status: 200, body: { id: req.params.id } }));

    const response = await router.handle({ method: 'GET', path: '/users/123' });

    expect(response.body.id).toBe('123');
  });

  it('should return 404 for unknown routes', async () => {
    const response = await router.handle({ method: 'GET', path: '/unknown' });

    expect(response.status).toBe(404);
  });

  it('should run middleware', async () => {
    const authMiddleware = vi.fn(() => true);
    router.use(authMiddleware);
    router.get('/protected', () => ({ status: 200 }));

    await router.handle({ method: 'GET', path: '/protected' });

    expect(authMiddleware).toHaveBeenCalled();
  });

  it('should block on middleware rejection', async () => {
    router.use(() => false);
    router.get('/blocked', () => ({ status: 200 }));

    const response = await router.handle({ method: 'GET', path: '/blocked' });

    expect(response.status).toBe(403);
  });
});

describe('API Gateway Tests', () => {
  let gateway;

  beforeEach(() => {
    gateway = createAPIGateway();
    gateway.registerService('users', { baseUrl: 'http://users-service' });
    gateway.registerService('orders', { baseUrl: 'http://orders-service' });
  });

  it('should proxy to service', async () => {
    const response = await gateway.proxy('users', '/api/users');

    expect(response.data.service).toBe('users');
  });

  it('should check rate limits', () => {
    gateway.setRateLimit('api', 3, 1000);

    expect(gateway.checkRateLimit('api')).toBe(true);
    expect(gateway.checkRateLimit('api')).toBe(true);
    expect(gateway.checkRateLimit('api')).toBe(true);
    expect(gateway.checkRateLimit('api')).toBe(false);
  });

  it('should cache responses', async () => {
    await gateway.proxy('users', '/cached', { cache: true, cacheTTL: 60000 });
    await gateway.proxy('users', '/cached', { cache: true, cacheTTL: 60000 });

    // Both should succeed (second from cache)
  });

  it('should get service health', () => {
    const health = gateway.getServiceHealth('users');

    expect(health.healthy).toBe(true);
    expect(health.failures).toBe(0);
  });
});

describe('Request Transformer Tests', () => {
  let transformer;

  beforeEach(() => {
    transformer = createRequestTransformer();
  });

  it('should transform request', async () => {
    transformer.add('uppercase', (req) => ({
      ...req,
      path: req.path.toUpperCase(),
    }));

    const result = await transformer.transform({ path: '/test' });

    expect(result.path).toBe('/TEST');
  });

  it('should chain transformers', async () => {
    transformer.add('a', (req) => ({ ...req, a: true }));
    transformer.add('b', (req) => ({ ...req, b: true }));

    const result = await transformer.transform({});

    expect(result.a).toBe(true);
    expect(result.b).toBe(true);
  });
});

describe('Response Aggregator Tests', () => {
  let aggregator;

  beforeEach(() => {
    aggregator = createResponseAggregator();
  });

  it('should aggregate responses', async () => {
    const requests = [Promise.resolve({ data: 'a' }), Promise.resolve({ data: 'b' })];

    const results = await aggregator.aggregate(requests);

    expect(results).toHaveLength(2);
    expect(results[0].status).toBe('fulfilled');
  });

  it('should handle failures', async () => {
    const requests = [Promise.resolve({ data: 'ok' }), Promise.reject(new Error('Failed'))];

    const results = await aggregator.aggregate(requests);

    expect(results[1].status).toBe('rejected');
    expect(results[1].error).toBe('Failed');
  });

  it('should merge responses', () => {
    const responses = [{ data: { a: 1 } }, { data: { b: 2 } }];

    const merged = aggregator.mergeResponses(responses, 'combine');

    expect(merged).toEqual({ a: 1, b: 2 });
  });
});
