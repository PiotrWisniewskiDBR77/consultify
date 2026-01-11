/**
 * Health Check Service Tests
 * Tests for health check implementation
 *
 * @module tests/health/health-check.test.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Health check implementation
const createHealthChecker = () => {
  const checks = new Map();
  const history = [];
  const maxHistorySize = 100;

  return {
    register: (name, check, options = {}) => {
      const { critical = false, timeout = 5000, interval = 30000 } = options;

      checks.set(name, {
        name,
        check,
        critical,
        timeout,
        interval,
        lastResult: null,
        lastChecked: null,
      });
    },

    unregister: (name) => {
      return checks.delete(name);
    },

    runCheck: async (name) => {
      const checkConfig = checks.get(name);
      if (!checkConfig) {
        throw new Error(`Health check not found: ${name}`);
      }

      const startTime = Date.now();
      let result;

      try {
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Health check timeout')), checkConfig.timeout);
        });

        const checkResult = await Promise.race([checkConfig.check(), timeoutPromise]);

        result = {
          name,
          status: 'healthy',
          duration: Date.now() - startTime,
          details: checkResult,
          timestamp: new Date().toISOString(),
        };
      } catch (error) {
        result = {
          name,
          status: 'unhealthy',
          duration: Date.now() - startTime,
          error: error.message,
          timestamp: new Date().toISOString(),
        };
      }

      checkConfig.lastResult = result;
      checkConfig.lastChecked = result.timestamp;

      history.push(result);
      if (history.length > maxHistorySize) {
        history.shift();
      }

      return result;
    },

    runAll: async () => {
      const results = await Promise.all([...checks.keys()].map((name) => this.runCheck(name)));

      const overallStatus = results.every((r) => r.status === 'healthy')
        ? 'healthy'
        : results.some((r) => {
              const check = checks.get(r.name);
              return check.critical && r.status === 'unhealthy';
            })
          ? 'critical'
          : 'degraded';

      return {
        status: overallStatus,
        timestamp: new Date().toISOString(),
        checks: results,
      };
    },

    getStatus: () => {
      const results = [];

      for (const [name, config] of checks) {
        results.push({
          name,
          critical: config.critical,
          lastResult: config.lastResult,
          lastChecked: config.lastChecked,
        });
      }

      return results;
    },

    getHistory: (name, limit = 10) => {
      if (name) {
        return history.filter((h) => h.name === name).slice(-limit);
      }
      return history.slice(-limit);
    },

    isHealthy: () => {
      for (const config of checks.values()) {
        if (config.critical && config.lastResult?.status === 'unhealthy') {
          return false;
        }
      }
      return true;
    },

    getReadiness: async () => {
      const criticalChecks = [...checks.entries()]
        .filter(([_, config]) => config.critical)
        .map(([name]) => name);

      const results = await Promise.all(criticalChecks.map((name) => this.runCheck(name)));

      return {
        ready: results.every((r) => r.status === 'healthy'),
        checks: results,
      };
    },

    getLiveness: () => {
      return {
        alive: true,
        uptime: process.uptime ? process.uptime() : 0,
        timestamp: new Date().toISOString(),
      };
    },
  };
};

describe('Health Check Service Tests', () => {
  let healthChecker;

  beforeEach(() => {
    healthChecker = createHealthChecker();
  });

  // ═══════════════════════════════════════════════════════════════════
  // REGISTER
  // ═══════════════════════════════════════════════════════════════════

  describe('register', () => {
    it('should register health check', () => {
      healthChecker.register('database', async () => ({ connected: true }));

      const status = healthChecker.getStatus();
      expect(status.length).toBe(1);
      expect(status[0].name).toBe('database');
    });

    it('should register with options', () => {
      healthChecker.register('cache', async () => ({}), {
        critical: true,
        timeout: 1000,
      });

      const status = healthChecker.getStatus();
      expect(status[0].critical).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // UNREGISTER
  // ═══════════════════════════════════════════════════════════════════

  describe('unregister', () => {
    it('should unregister check', () => {
      healthChecker.register('temp', async () => ({}));
      healthChecker.unregister('temp');

      expect(healthChecker.getStatus().length).toBe(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // RUN CHECK
  // ═══════════════════════════════════════════════════════════════════

  describe('runCheck', () => {
    it('should run healthy check', async () => {
      healthChecker.register('test', async () => ({ status: 'ok' }));

      const result = await healthChecker.runCheck('test');

      expect(result.status).toBe('healthy');
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it('should run unhealthy check', async () => {
      healthChecker.register('test', async () => {
        throw new Error('Connection failed');
      });

      const result = await healthChecker.runCheck('test');

      expect(result.status).toBe('unhealthy');
      expect(result.error).toBe('Connection failed');
    });

    it('should timeout slow check', async () => {
      healthChecker.register(
        'slow',
        async () => {
          await new Promise((r) => setTimeout(r, 200));
        },
        { timeout: 100 }
      );

      const result = await healthChecker.runCheck('slow');

      expect(result.status).toBe('unhealthy');
      expect(result.error).toContain('timeout');
    });

    it('should throw for unknown check', async () => {
      await expect(healthChecker.runCheck('unknown')).rejects.toThrow('not found');
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // RUN ALL
  // ═══════════════════════════════════════════════════════════════════

  describe('runAll', () => {
    it('should run all checks', async () => {
      healthChecker.register('db', async () => ({ connected: true }));
      healthChecker.register('cache', async () => ({ connected: true }));

      const result = await healthChecker.runAll();

      expect(result.checks.length).toBe(2);
      expect(result.status).toBe('healthy');
    });

    it('should report degraded status', async () => {
      healthChecker.register('db', async () => ({ connected: true }));
      healthChecker.register(
        'cache',
        async () => {
          throw new Error('Cache down');
        },
        { critical: false }
      );

      const result = await healthChecker.runAll();

      expect(result.status).toBe('degraded');
    });

    it('should report critical status', async () => {
      healthChecker.register(
        'db',
        async () => {
          throw new Error('DB down');
        },
        { critical: true }
      );

      const result = await healthChecker.runAll();

      expect(result.status).toBe('critical');
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // GET STATUS
  // ═══════════════════════════════════════════════════════════════════

  describe('getStatus', () => {
    it('should return all checks status', async () => {
      healthChecker.register('db', async () => ({}));
      await healthChecker.runCheck('db');

      const status = healthChecker.getStatus();

      expect(status[0].lastResult).toBeDefined();
      expect(status[0].lastChecked).toBeDefined();
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // GET HISTORY
  // ═══════════════════════════════════════════════════════════════════

  describe('getHistory', () => {
    it('should track history', async () => {
      healthChecker.register('db', async () => ({}));

      await healthChecker.runCheck('db');
      await healthChecker.runCheck('db');
      await healthChecker.runCheck('db');

      const history = healthChecker.getHistory('db');
      expect(history.length).toBe(3);
    });

    it('should limit history', async () => {
      healthChecker.register('db', async () => ({}));

      for (let i = 0; i < 5; i++) {
        await healthChecker.runCheck('db');
      }

      const history = healthChecker.getHistory('db', 3);
      expect(history.length).toBe(3);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // IS HEALTHY
  // ═══════════════════════════════════════════════════════════════════

  describe('isHealthy', () => {
    it('should return true when all critical healthy', async () => {
      healthChecker.register('db', async () => ({}), { critical: true });
      await healthChecker.runCheck('db');

      expect(healthChecker.isHealthy()).toBe(true);
    });

    it('should return false when critical unhealthy', async () => {
      healthChecker.register(
        'db',
        async () => {
          throw new Error('Down');
        },
        { critical: true }
      );

      await healthChecker.runCheck('db');

      expect(healthChecker.isHealthy()).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // READINESS / LIVENESS
  // ═══════════════════════════════════════════════════════════════════

  describe('Readiness / Liveness', () => {
    it('should check readiness', async () => {
      healthChecker.register('db', async () => ({}), { critical: true });
      healthChecker.register('cache', async () => ({}), { critical: false });

      const readiness = await healthChecker.getReadiness();

      expect(readiness.ready).toBe(true);
      expect(readiness.checks.length).toBe(1); // Only critical
    });

    it('should check liveness', () => {
      const liveness = healthChecker.getLiveness();

      expect(liveness.alive).toBe(true);
      expect(liveness.timestamp).toBeDefined();
    });
  });
});
