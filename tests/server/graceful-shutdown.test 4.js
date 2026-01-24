/**
 * Server Graceful Shutdown Tests
 * Tests for graceful shutdown handling
 *
 * @module tests/server/graceful-shutdown.test.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock graceful shutdown handler
const createShutdownHandler = () => {
  let isShuttingDown = false;
  let shutdownReason = null;
  const activeConnections = new Set();
  const cleanupTasks = [];
  const shutdownListeners = [];
  let shutdownTimeout = 30000;

  return {
    isShuttingDown: () => isShuttingDown,
    getShutdownReason: () => shutdownReason,
    getActiveConnections: () => activeConnections.size,
    getTimeout: () => shutdownTimeout,

    setTimeout: (timeout) => {
      shutdownTimeout = timeout;
    },

    registerConnection: (id) => {
      if (isShuttingDown) return false;
      activeConnections.add(id);
      return true;
    },

    unregisterConnection: (id) => {
      activeConnections.delete(id);
    },

    addCleanupTask: (name, task) => {
      cleanupTasks.push({ name, task });
    },

    onShutdown: (listener) => {
      shutdownListeners.push(listener);
    },

    initiateShutdown: async (reason = 'manual') => {
      if (isShuttingDown) return false;

      isShuttingDown = true;
      shutdownReason = reason;

      // Notify listeners
      for (const listener of shutdownListeners) {
        try {
          await listener(reason);
        } catch (e) {
          // Log but continue
        }
      }

      // Wait for connections to close (with timeout)
      const waitStart = Date.now();
      while (activeConnections.size > 0) {
        if (Date.now() - waitStart > shutdownTimeout) {
          // Force close remaining connections
          activeConnections.clear();
          break;
        }
        await new Promise((r) => setTimeout(r, 10));
      }

      // Run cleanup tasks
      for (const { name, task } of cleanupTasks) {
        try {
          await task();
        } catch (e) {
          // Log but continue
        }
      }

      return true;
    },

    forceShutdown: () => {
      isShuttingDown = true;
      shutdownReason = 'forced';
      activeConnections.clear();
    },

    reset: () => {
      isShuttingDown = false;
      shutdownReason = null;
      activeConnections.clear();
      cleanupTasks.length = 0;
      shutdownListeners.length = 0;
    },
  };
};

describe('Graceful Shutdown Tests', () => {
  let handler;

  beforeEach(() => {
    handler = createShutdownHandler();
  });

  // ═══════════════════════════════════════════════════════════════════
  // INITIAL STATE
  // ═══════════════════════════════════════════════════════════════════

  describe('Initial State', () => {
    it('should not be shutting down initially', () => {
      expect(handler.isShuttingDown()).toBe(false);
    });

    it('should have no shutdown reason', () => {
      expect(handler.getShutdownReason()).toBeNull();
    });

    it('should have no active connections', () => {
      expect(handler.getActiveConnections()).toBe(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // CONNECTION MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════

  describe('Connection Management', () => {
    it('should register connection', () => {
      const result = handler.registerConnection('conn-1');

      expect(result).toBe(true);
      expect(handler.getActiveConnections()).toBe(1);
    });

    it('should unregister connection', () => {
      handler.registerConnection('conn-1');
      handler.unregisterConnection('conn-1');

      expect(handler.getActiveConnections()).toBe(0);
    });

    it('should reject new connections during shutdown', async () => {
      await handler.initiateShutdown();

      const result = handler.registerConnection('conn-new');

      expect(result).toBe(false);
    });

    it('should track multiple connections', () => {
      handler.registerConnection('conn-1');
      handler.registerConnection('conn-2');
      handler.registerConnection('conn-3');

      expect(handler.getActiveConnections()).toBe(3);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // SHUTDOWN INITIATION
  // ═══════════════════════════════════════════════════════════════════

  describe('Shutdown Initiation', () => {
    it('should initiate shutdown', async () => {
      const result = await handler.initiateShutdown('test');

      expect(result).toBe(true);
      expect(handler.isShuttingDown()).toBe(true);
      expect(handler.getShutdownReason()).toBe('test');
    });

    it('should prevent double shutdown', async () => {
      await handler.initiateShutdown('first');
      const result = await handler.initiateShutdown('second');

      expect(result).toBe(false);
      expect(handler.getShutdownReason()).toBe('first');
    });

    it('should use default reason', async () => {
      await handler.initiateShutdown();

      expect(handler.getShutdownReason()).toBe('manual');
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // WAIT FOR CONNECTIONS
  // ═══════════════════════════════════════════════════════════════════

  describe('Wait For Connections', () => {
    it('should wait for connections to close', async () => {
      handler.setTimeout(1000);
      handler.registerConnection('conn-1');

      // Simulate connection closing after delay
      setTimeout(() => handler.unregisterConnection('conn-1'), 50);

      await handler.initiateShutdown();

      expect(handler.getActiveConnections()).toBe(0);
    });

    it('should force close after timeout', async () => {
      handler.setTimeout(50); // Short timeout
      handler.registerConnection('conn-1');
      handler.registerConnection('conn-2');

      await handler.initiateShutdown();

      expect(handler.getActiveConnections()).toBe(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // CLEANUP TASKS
  // ═══════════════════════════════════════════════════════════════════

  describe('Cleanup Tasks', () => {
    it('should run cleanup tasks', async () => {
      const task = vi.fn();
      handler.addCleanupTask('test', task);

      await handler.initiateShutdown();

      expect(task).toHaveBeenCalled();
    });

    it('should run multiple cleanup tasks', async () => {
      const task1 = vi.fn();
      const task2 = vi.fn();
      handler.addCleanupTask('task1', task1);
      handler.addCleanupTask('task2', task2);

      await handler.initiateShutdown();

      expect(task1).toHaveBeenCalled();
      expect(task2).toHaveBeenCalled();
    });

    it('should continue if cleanup task fails', async () => {
      const failingTask = vi.fn().mockRejectedValue(new Error('Failed'));
      const successTask = vi.fn();
      handler.addCleanupTask('failing', failingTask);
      handler.addCleanupTask('success', successTask);

      await handler.initiateShutdown();

      expect(successTask).toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // SHUTDOWN LISTENERS
  // ═══════════════════════════════════════════════════════════════════

  describe('Shutdown Listeners', () => {
    it('should notify listeners', async () => {
      const listener = vi.fn();
      handler.onShutdown(listener);

      await handler.initiateShutdown('test');

      expect(listener).toHaveBeenCalledWith('test');
    });

    it('should continue if listener fails', async () => {
      const failingListener = vi.fn().mockRejectedValue(new Error('Failed'));
      const successListener = vi.fn();
      handler.onShutdown(failingListener);
      handler.onShutdown(successListener);

      await handler.initiateShutdown();

      expect(successListener).toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // FORCE SHUTDOWN
  // ═══════════════════════════════════════════════════════════════════

  describe('Force Shutdown', () => {
    it('should force shutdown immediately', () => {
      handler.registerConnection('conn-1');
      handler.registerConnection('conn-2');

      handler.forceShutdown();

      expect(handler.isShuttingDown()).toBe(true);
      expect(handler.getActiveConnections()).toBe(0);
      expect(handler.getShutdownReason()).toBe('forced');
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // RESET
  // ═══════════════════════════════════════════════════════════════════

  describe('Reset', () => {
    it('should reset all state', async () => {
      handler.registerConnection('conn-1');
      await handler.initiateShutdown();

      handler.reset();

      expect(handler.isShuttingDown()).toBe(false);
      expect(handler.getShutdownReason()).toBeNull();
      expect(handler.getActiveConnections()).toBe(0);
    });
  });
});
