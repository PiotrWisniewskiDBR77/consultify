/**
 * Application Lifecycle Tests
 * Tests for application lifecycle management
 *
 * @module tests/lifecycle/app-lifecycle.test.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Lifecycle manager implementation
const createLifecycleManager = () => {
  const hooks = {
    beforeStart: [],
    afterStart: [],
    beforeStop: [],
    afterStop: [],
    onError: [],
  };

  let state = 'stopped';
  let startTime = null;
  const services = new Map();

  return {
    getState: () => state,

    hook: (event, callback) => {
      if (!hooks[event]) {
        throw new Error(`Unknown lifecycle event: ${event}`);
      }
      hooks[event].push(callback);

      return () => {
        const index = hooks[event].indexOf(callback);
        if (index !== -1) hooks[event].splice(index, 1);
      };
    },

    registerService: (name, service) => {
      services.set(name, service);
    },

    getService: (name) => services.get(name),

    start: async () => {
      if (state !== 'stopped') {
        throw new Error(`Cannot start from state: ${state}`);
      }

      try {
        state = 'starting';

        // Run beforeStart hooks
        for (const hook of hooks.beforeStart) {
          await hook();
        }

        // Start all services
        for (const [name, service] of services) {
          if (service.start) {
            await service.start();
          }
        }

        state = 'running';
        startTime = Date.now();

        // Run afterStart hooks
        for (const hook of hooks.afterStart) {
          await hook();
        }
      } catch (error) {
        state = 'error';
        for (const handler of hooks.onError) {
          await handler(error);
        }
        throw error;
      }
    },

    stop: async () => {
      if (state !== 'running' && state !== 'error') {
        throw new Error(`Cannot stop from state: ${state}`);
      }

      try {
        state = 'stopping';

        // Run beforeStop hooks
        for (const hook of hooks.beforeStop) {
          await hook();
        }

        // Stop all services in reverse order
        const serviceNames = [...services.keys()].reverse();
        for (const name of serviceNames) {
          const service = services.get(name);
          if (service.stop) {
            await service.stop();
          }
        }

        state = 'stopped';
        startTime = null;

        // Run afterStop hooks
        for (const hook of hooks.afterStop) {
          await hook();
        }
      } catch (error) {
        state = 'error';
        for (const handler of hooks.onError) {
          await handler(error);
        }
        throw error;
      }
    },

    restart: async () => {
      await this.stop();
      await this.start();
    },

    getUptime: () => {
      if (!startTime) return 0;
      return Date.now() - startTime;
    },

    isRunning: () => state === 'running',
    isStopped: () => state === 'stopped',
    isStarting: () => state === 'starting',
    isStopping: () => state === 'stopping',
    hasError: () => state === 'error',
  };
};

describe('Application Lifecycle Tests', () => {
  let lifecycle;

  beforeEach(() => {
    lifecycle = createLifecycleManager();
  });

  // ═══════════════════════════════════════════════════════════════════
  // STATE
  // ═══════════════════════════════════════════════════════════════════

  describe('State', () => {
    it('should start as stopped', () => {
      expect(lifecycle.getState()).toBe('stopped');
      expect(lifecycle.isStopped()).toBe(true);
    });

    it('should transition to running', async () => {
      await lifecycle.start();

      expect(lifecycle.getState()).toBe('running');
      expect(lifecycle.isRunning()).toBe(true);
    });

    it('should transition to stopped', async () => {
      await lifecycle.start();
      await lifecycle.stop();

      expect(lifecycle.getState()).toBe('stopped');
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // HOOKS
  // ═══════════════════════════════════════════════════════════════════

  describe('Hooks', () => {
    it('should call beforeStart hooks', async () => {
      const hook = vi.fn();
      lifecycle.hook('beforeStart', hook);

      await lifecycle.start();

      expect(hook).toHaveBeenCalled();
    });

    it('should call afterStart hooks', async () => {
      const hook = vi.fn();
      lifecycle.hook('afterStart', hook);

      await lifecycle.start();

      expect(hook).toHaveBeenCalled();
    });

    it('should call beforeStop hooks', async () => {
      const hook = vi.fn();
      lifecycle.hook('beforeStop', hook);

      await lifecycle.start();
      await lifecycle.stop();

      expect(hook).toHaveBeenCalled();
    });

    it('should call afterStop hooks', async () => {
      const hook = vi.fn();
      lifecycle.hook('afterStop', hook);

      await lifecycle.start();
      await lifecycle.stop();

      expect(hook).toHaveBeenCalled();
    });

    it('should call hooks in order', async () => {
      const order = [];

      lifecycle.hook('beforeStart', () => order.push(1));
      lifecycle.hook('beforeStart', () => order.push(2));
      lifecycle.hook('afterStart', () => order.push(3));

      await lifecycle.start();

      expect(order).toEqual([1, 2, 3]);
    });

    it('should return unsubscribe function', async () => {
      const hook = vi.fn();
      const unsubscribe = lifecycle.hook('beforeStart', hook);

      unsubscribe();
      await lifecycle.start();

      expect(hook).not.toHaveBeenCalled();
    });

    it('should throw for unknown event', () => {
      expect(() => lifecycle.hook('unknown', () => {})).toThrow('Unknown lifecycle event');
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // SERVICES
  // ═══════════════════════════════════════════════════════════════════

  describe('Services', () => {
    it('should start services', async () => {
      const service = { start: vi.fn(), stop: vi.fn() };
      lifecycle.registerService('test', service);

      await lifecycle.start();

      expect(service.start).toHaveBeenCalled();
    });

    it('should stop services', async () => {
      const service = { start: vi.fn(), stop: vi.fn() };
      lifecycle.registerService('test', service);

      await lifecycle.start();
      await lifecycle.stop();

      expect(service.stop).toHaveBeenCalled();
    });

    it('should stop services in reverse order', async () => {
      const order = [];

      lifecycle.registerService('first', {
        start: () => {},
        stop: () => order.push('first'),
      });
      lifecycle.registerService('second', {
        start: () => {},
        stop: () => order.push('second'),
      });

      await lifecycle.start();
      await lifecycle.stop();

      expect(order).toEqual(['second', 'first']);
    });

    it('should get registered service', () => {
      const service = { start: vi.fn() };
      lifecycle.registerService('test', service);

      expect(lifecycle.getService('test')).toBe(service);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // ERROR HANDLING
  // ═══════════════════════════════════════════════════════════════════

  describe('Error Handling', () => {
    it('should call onError hooks', async () => {
      const errorHandler = vi.fn();
      lifecycle.hook('onError', errorHandler);
      lifecycle.hook('beforeStart', () => {
        throw new Error('Start failed');
      });

      await expect(lifecycle.start()).rejects.toThrow('Start failed');
      expect(errorHandler).toHaveBeenCalled();
    });

    it('should set error state', async () => {
      lifecycle.hook('beforeStart', () => {
        throw new Error('Fail');
      });

      await expect(lifecycle.start()).rejects.toThrow();
      expect(lifecycle.hasError()).toBe(true);
    });

    it('should not start if already running', async () => {
      await lifecycle.start();

      await expect(lifecycle.start()).rejects.toThrow('Cannot start');
    });

    it('should not stop if already stopped', async () => {
      await expect(lifecycle.stop()).rejects.toThrow('Cannot stop');
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // RESTART
  // ═══════════════════════════════════════════════════════════════════

  describe('Restart', () => {
    it('should restart application', async () => {
      await lifecycle.start();
      await lifecycle.restart();

      expect(lifecycle.isRunning()).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // UPTIME
  // ═══════════════════════════════════════════════════════════════════

  describe('Uptime', () => {
    it('should return 0 when stopped', () => {
      expect(lifecycle.getUptime()).toBe(0);
    });

    it('should track uptime when running', async () => {
      await lifecycle.start();

      await new Promise((r) => setTimeout(r, 10));

      expect(lifecycle.getUptime()).toBeGreaterThan(0);
    });

    it('should reset uptime on stop', async () => {
      await lifecycle.start();
      await lifecycle.stop();

      expect(lifecycle.getUptime()).toBe(0);
    });
  });
});
