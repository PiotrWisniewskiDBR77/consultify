/**
 * Graceful Shutdown Tests
 * Tests for graceful shutdown handling
 *
 * @module tests/shutdown/graceful-shutdown.test.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Graceful shutdown implementation
const createShutdownManager = (options = {}) => {
  const { timeout = 30000, signals = ['SIGTERM', 'SIGINT'] } = options;

  const handlers = [];
  const connections = new Set();
  let isShuttingDown = false;
  let shutdownPromise = null;
  let forceExitTimeout = null;

  return {
    isShuttingDown: () => isShuttingDown,

    register: (name, handler, options = {}) => {
      const { priority = 0, timeout: handlerTimeout = timeout } = options;

      handlers.push({
        name,
        handler,
        priority,
        timeout: handlerTimeout,
      });

      // Sort by priority (higher first)
      handlers.sort((a, b) => b.priority - a.priority);
    },

    unregister: (name) => {
      const index = handlers.findIndex((h) => h.name === name);
      if (index !== -1) {
        handlers.splice(index, 1);
        return true;
      }
      return false;
    },

    trackConnection: (connection) => {
      connections.add(connection);

      return () => {
        connections.delete(connection);
      };
    },

    getActiveConnections: () => connections.size,

    shutdown: async (reason = 'unknown') => {
      if (isShuttingDown) {
        return shutdownPromise;
      }

      isShuttingDown = true;

      shutdownPromise = (async () => {
        const results = [];

        // Stop accepting new connections
        results.push({ phase: 'stop_accepting', status: 'complete' });

        // Wait for active connections to drain
        const drainStart = Date.now();
        while (connections.size > 0 && Date.now() - drainStart < timeout / 2) {
          await new Promise((r) => setTimeout(r, 100));
        }

        if (connections.size > 0) {
          results.push({
            phase: 'drain_connections',
            status: 'timeout',
            remaining: connections.size,
          });
          // Force close remaining connections
          for (const conn of connections) {
            if (conn.destroy) conn.destroy();
            connections.delete(conn);
          }
        } else {
          results.push({ phase: 'drain_connections', status: 'complete' });
        }

        // Run shutdown handlers in priority order
        for (const { name, handler, timeout: handlerTimeout } of handlers) {
          try {
            const timeoutPromise = new Promise((_, reject) => {
              setTimeout(() => reject(new Error('Handler timeout')), handlerTimeout);
            });

            await Promise.race([handler(reason), timeoutPromise]);
            results.push({ phase: name, status: 'complete' });
          } catch (error) {
            results.push({
              phase: name,
              status: 'error',
              error: error.message,
            });
          }
        }

        return {
          reason,
          results,
          duration: Date.now() - drainStart,
        };
      })();

      return shutdownPromise;
    },

    forceShutdown: (exitCode = 1) => {
      // Clear any pending timeout
      if (forceExitTimeout) {
        clearTimeout(forceExitTimeout);
      }

      // Force close all connections
      for (const conn of connections) {
        if (conn.destroy) conn.destroy();
      }
      connections.clear();

      return { forced: true, exitCode };
    },

    reset: () => {
      isShuttingDown = false;
      shutdownPromise = null;
      connections.clear();
      handlers.length = 0;
      if (forceExitTimeout) {
        clearTimeout(forceExitTimeout);
        forceExitTimeout = null;
      }
    },
  };
};

describe('Graceful Shutdown Tests', () => {
  let shutdownManager;

  beforeEach(() => {
    shutdownManager = createShutdownManager({ timeout: 1000 });
  });

  // ═══════════════════════════════════════════════════════════════════
  // REGISTER HANDLERS
  // ═══════════════════════════════════════════════════════════════════

  describe('Register Handlers', () => {
    it('should register shutdown handler', async () => {
      const handler = vi.fn();
      shutdownManager.register('test', handler);

      await shutdownManager.shutdown('test');

      expect(handler).toHaveBeenCalled();
    });

    it('should pass reason to handler', async () => {
      const handler = vi.fn();
      shutdownManager.register('test', handler);

      await shutdownManager.shutdown('SIGTERM');

      expect(handler).toHaveBeenCalledWith('SIGTERM');
    });

    it('should unregister handler', async () => {
      const handler = vi.fn();
      shutdownManager.register('test', handler);
      shutdownManager.unregister('test');

      await shutdownManager.shutdown();

      expect(handler).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // PRIORITY
  // ═══════════════════════════════════════════════════════════════════

  describe('Priority', () => {
    it('should run handlers by priority', async () => {
      const order = [];

      shutdownManager.register('low', () => order.push('low'), { priority: 1 });
      shutdownManager.register('high', () => order.push('high'), { priority: 10 });
      shutdownManager.register('medium', () => order.push('medium'), { priority: 5 });

      await shutdownManager.shutdown();

      expect(order).toEqual(['high', 'medium', 'low']);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // CONNECTION TRACKING
  // ═══════════════════════════════════════════════════════════════════

  describe('Connection Tracking', () => {
    it('should track connection', () => {
      const conn = {};
      shutdownManager.trackConnection(conn);

      expect(shutdownManager.getActiveConnections()).toBe(1);
    });

    it('should untrack connection', () => {
      const conn = {};
      const release = shutdownManager.trackConnection(conn);

      release();

      expect(shutdownManager.getActiveConnections()).toBe(0);
    });

    it('should wait for connections to drain', async () => {
      const conn = {};
      const release = shutdownManager.trackConnection(conn);

      // Release after a delay
      setTimeout(release, 100);

      const result = await shutdownManager.shutdown();

      expect(result.results.find((r) => r.phase === 'drain_connections').status).toBe('complete');
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // SHUTDOWN STATE
  // ═══════════════════════════════════════════════════════════════════

  describe('Shutdown State', () => {
    it('should report shutting down', async () => {
      expect(shutdownManager.isShuttingDown()).toBe(false);

      const promise = shutdownManager.shutdown();

      expect(shutdownManager.isShuttingDown()).toBe(true);
      await promise;
    });

    it('should only shutdown once', async () => {
      const handler = vi.fn();
      shutdownManager.register('test', handler);

      await Promise.all([
        shutdownManager.shutdown(),
        shutdownManager.shutdown(),
        shutdownManager.shutdown(),
      ]);

      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // TIMEOUT HANDLING
  // ═══════════════════════════════════════════════════════════════════

  describe('Timeout Handling', () => {
    it('should timeout slow handlers', async () => {
      shutdownManager.register(
        'slow',
        async () => {
          await new Promise((r) => setTimeout(r, 5000));
        },
        { timeout: 100 }
      );

      const result = await shutdownManager.shutdown();

      const handlerResult = result.results.find((r) => r.phase === 'slow');
      expect(handlerResult.status).toBe('error');
      expect(handlerResult.error).toContain('timeout');
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // ERROR HANDLING
  // ═══════════════════════════════════════════════════════════════════

  describe('Error Handling', () => {
    it('should continue after handler error', async () => {
      const handler2 = vi.fn();

      shutdownManager.register(
        'error',
        () => {
          throw new Error('Handler failed');
        },
        { priority: 10 }
      );
      shutdownManager.register('ok', handler2, { priority: 1 });

      const result = await shutdownManager.shutdown();

      expect(handler2).toHaveBeenCalled();
      expect(result.results.find((r) => r.phase === 'error').status).toBe('error');
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // FORCE SHUTDOWN
  // ═══════════════════════════════════════════════════════════════════

  describe('Force Shutdown', () => {
    it('should force close connections', () => {
      const conn = { destroy: vi.fn() };
      shutdownManager.trackConnection(conn);

      shutdownManager.forceShutdown();

      expect(conn.destroy).toHaveBeenCalled();
      expect(shutdownManager.getActiveConnections()).toBe(0);
    });

    it('should return exit code', () => {
      const result = shutdownManager.forceShutdown(2);

      expect(result.forced).toBe(true);
      expect(result.exitCode).toBe(2);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // RESET
  // ═══════════════════════════════════════════════════════════════════

  describe('Reset', () => {
    it('should reset state', async () => {
      shutdownManager.register('test', vi.fn());
      await shutdownManager.shutdown();

      shutdownManager.reset();

      expect(shutdownManager.isShuttingDown()).toBe(false);
    });
  });
});
