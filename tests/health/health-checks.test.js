/**
 * Health Check Tests
 * Tests for health monitoring patterns
 *
 * @module tests/health/health-checks.test.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Health check result
const createHealthResult = (name, status, options = {}) => {
  const { message, duration, metadata = {} } = options;

  return {
    name,
    status, // 'healthy', 'unhealthy', 'degraded'
    message,
    duration,
    metadata,
    timestamp: new Date().toISOString(),
  };
};

// Health check runner
const createHealthChecker = () => {
  const checks = new Map();

  return {
    register: (name, checkFn, options = {}) => {
      checks.set(name, {
        check: checkFn,
        timeout: options.timeout || 5000,
        critical: options.critical !== false,
      });
    },

    unregister: (name) => {
      checks.delete(name);
    },

    runCheck: async (name) => {
      const checkConfig = checks.get(name);
      if (!checkConfig) {
        return createHealthResult(name, 'unhealthy', {
          message: 'Check not found',
        });
      }

      const start = Date.now();

      try {
        const result = await Promise.race([
          checkConfig.check(),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Timeout')), checkConfig.timeout)
          ),
        ]);

        return createHealthResult(name, result.status || 'healthy', {
          message: result.message,
          duration: Date.now() - start,
          metadata: result.metadata,
        });
      } catch (error) {
        return createHealthResult(name, 'unhealthy', {
          message: error.message,
          duration: Date.now() - start,
        });
      }
    },

    runAll: async () => {
      const results = {};
      let overallStatus = 'healthy';

      for (const [name, config] of checks) {
        const result = await this.runCheck(name);
        results[name] = result;

        if (result.status === 'unhealthy' && config.critical) {
          overallStatus = 'unhealthy';
        } else if (result.status === 'degraded' && overallStatus === 'healthy') {
          overallStatus = 'degraded';
        }
      }

      return {
        status: overallStatus,
        timestamp: new Date().toISOString(),
        checks: results,
      };
    },

    getCheckNames: () => [...checks.keys()],
  };
};

// Liveness probe
const createLivenessProbe = () => {
  let isAlive = true;

  return {
    check: () => ({
      status: isAlive ? 'healthy' : 'unhealthy',
      message: isAlive ? 'Application is alive' : 'Application is not responding',
    }),

    setAlive: (alive) => {
      isAlive = alive;
    },

    isAlive: () => isAlive,
  };
};

// Readiness probe
const createReadinessProbe = (dependencies = []) => {
  const ready = new Map();

  for (const dep of dependencies) {
    ready.set(dep, false);
  }

  return {
    check: () => {
      const notReady = [];

      for (const [dep, isReady] of ready) {
        if (!isReady) notReady.push(dep);
      }

      if (notReady.length > 0) {
        return {
          status: 'unhealthy',
          message: `Not ready: ${notReady.join(', ')}`,
          metadata: { notReady },
        };
      }

      return {
        status: 'healthy',
        message: 'All dependencies ready',
      };
    },

    setReady: (dependency, isReady = true) => {
      ready.set(dependency, isReady);
    },

    isReady: () => {
      for (const isReady of ready.values()) {
        if (!isReady) return false;
      }
      return true;
    },

    getDependencies: () => [...ready.keys()],
  };
};

// Startup probe
const createStartupProbe = (options = {}) => {
  const { maxAttempts = 30, intervalMs = 1000 } = options;

  let attempts = 0;
  let started = false;
  let startupCheck = null;

  return {
    setCheck: (checkFn) => {
      startupCheck = checkFn;
    },

    run: async () => {
      while (attempts < maxAttempts && !started) {
        attempts++;

        if (startupCheck) {
          try {
            const result = await startupCheck();
            if (result.status === 'healthy') {
              started = true;
              return {
                status: 'healthy',
                message: 'Startup complete',
                attempts,
              };
            }
          } catch {
            // Retry
          }
        }

        if (!started) {
          await new Promise((r) => setTimeout(r, intervalMs));
        }
      }

      return {
        status: 'unhealthy',
        message: 'Startup failed',
        attempts,
      };
    },

    isStarted: () => started,

    getAttempts: () => attempts,

    reset: () => {
      attempts = 0;
      started = false;
    },
  };
};

// Health endpoint builder
const createHealthEndpoint = (checker) => {
  return {
    live: async () => {
      return { status: 'healthy', message: 'OK' };
    },

    ready: async () => {
      const result = await checker.runAll();
      return result;
    },

    detailed: async () => {
      const result = await checker.runAll();

      return {
        ...result,
        uptime: process.uptime?.() || 0,
        memory: process.memoryUsage?.() || {},
      };
    },

    toMiddleware: () => {
      return async (req, res, next) => {
        const path = req.path;

        if (path === '/health' || path === '/health/live') {
          const result = await this.live();
          return res.json(result);
        }

        if (path === '/health/ready') {
          const result = await this.ready();
          const status = result.status === 'healthy' ? 200 : 503;
          return res.status(status).json(result);
        }

        next?.();
      };
    },
  };
};

describe('Health Result Tests', () => {
  it('should create result', () => {
    const result = createHealthResult('database', 'healthy', {
      message: 'Connected',
      duration: 50,
    });

    expect(result.name).toBe('database');
    expect(result.status).toBe('healthy');
    expect(result.duration).toBe(50);
  });
});

describe('Health Checker Tests', () => {
  let checker;

  beforeEach(() => {
    checker = createHealthChecker();
  });

  it('should register check', () => {
    checker.register('db', async () => ({ status: 'healthy' }));

    expect(checker.getCheckNames()).toContain('db');
  });

  it('should run single check', async () => {
    checker.register('db', async () => ({ status: 'healthy', message: 'OK' }));

    const result = await checker.runCheck('db');

    expect(result.status).toBe('healthy');
  });

  it('should handle check failure', async () => {
    checker.register('db', async () => {
      throw new Error('Connection failed');
    });

    const result = await checker.runCheck('db');

    expect(result.status).toBe('unhealthy');
    expect(result.message).toBe('Connection failed');
  });

  it('should handle timeout', async () => {
    checker.register(
      'slow',
      async () => {
        await new Promise((r) => setTimeout(r, 10000));
      },
      { timeout: 100 }
    );

    const result = await checker.runCheck('slow');

    expect(result.status).toBe('unhealthy');
    expect(result.message).toBe('Timeout');
  });

  it('should run all checks', async () => {
    checker.register('db', async () => ({ status: 'healthy' }));
    checker.register('cache', async () => ({ status: 'healthy' }));

    const result = await checker.runAll();

    expect(result.status).toBe('healthy');
    expect(Object.keys(result.checks)).toHaveLength(2);
  });

  it('should mark unhealthy if critical fails', async () => {
    checker.register('db', async () => ({ status: 'unhealthy' }), { critical: true });
    checker.register('cache', async () => ({ status: 'healthy' }));

    const result = await checker.runAll();

    expect(result.status).toBe('unhealthy');
  });
});

describe('Liveness Probe Tests', () => {
  let probe;

  beforeEach(() => {
    probe = createLivenessProbe();
  });

  it('should be alive by default', () => {
    const result = probe.check();

    expect(result.status).toBe('healthy');
  });

  it('should reflect status change', () => {
    probe.setAlive(false);

    const result = probe.check();

    expect(result.status).toBe('unhealthy');
  });
});

describe('Readiness Probe Tests', () => {
  let probe;

  beforeEach(() => {
    probe = createReadinessProbe(['database', 'cache']);
  });

  it('should not be ready initially', () => {
    const result = probe.check();

    expect(result.status).toBe('unhealthy');
  });

  it('should be ready when all deps ready', () => {
    probe.setReady('database');
    probe.setReady('cache');

    const result = probe.check();

    expect(result.status).toBe('healthy');
  });

  it('should list not ready deps', () => {
    probe.setReady('database');

    const result = probe.check();

    expect(result.metadata.notReady).toContain('cache');
  });
});

describe('Startup Probe Tests', () => {
  let probe;

  beforeEach(() => {
    probe = createStartupProbe({ maxAttempts: 3, intervalMs: 10 });
  });

  it('should succeed on healthy check', async () => {
    probe.setCheck(async () => ({ status: 'healthy' }));

    const result = await probe.run();

    expect(result.status).toBe('healthy');
    expect(probe.isStarted()).toBe(true);
  });

  it('should fail after max attempts', async () => {
    probe.setCheck(async () => {
      throw new Error('Not ready');
    });

    const result = await probe.run();

    expect(result.status).toBe('unhealthy');
    expect(result.attempts).toBe(3);
  });
});
