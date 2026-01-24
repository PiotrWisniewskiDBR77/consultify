/**
 * Long Polling Tests
 * Tests for long polling client/server patterns
 *
 * @module tests/polling/long-polling.test.js
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Long polling client implementation
const createLongPollingClient = (url, options = {}) => {
  const { pollInterval = 0, timeout = 30000, retryDelay = 1000, maxRetries = 5 } = options;

  let isPolling = false;
  let abortController = null;
  let retryCount = 0;
  let lastEventId = null;

  const listeners = {
    message: [],
    error: [],
    connected: [],
    disconnected: [],
  };

  let mockFetch = vi.fn();

  const emit = (event, data) => {
    listeners[event]?.forEach((fn) => fn(data));
  };

  const poll = async () => {
    if (!isPolling) return;

    abortController = new AbortController();

    try {
      const response = await mockFetch(url, {
        method: 'GET',
        headers: {
          'X-Last-Event-Id': lastEventId || '',
        },
        signal: abortController.signal,
      });

      if (!isPolling) return;

      retryCount = 0;

      if (response.data) {
        if (response.data.id) {
          lastEventId = response.data.id;
        }
        emit('message', response.data);
      }

      // Continue polling
      if (pollInterval > 0) {
        setTimeout(poll, pollInterval);
      } else {
        poll();
      }
    } catch (error) {
      if (error.name === 'AbortError') return;

      emit('error', error);

      if (retryCount < maxRetries) {
        retryCount++;
        setTimeout(poll, retryDelay * retryCount);
      } else {
        emit('disconnected', { reason: 'Max retries exceeded' });
        isPolling = false;
      }
    }
  };

  return {
    start: () => {
      if (isPolling) return;

      isPolling = true;
      retryCount = 0;
      emit('connected', {});
      poll();
    },

    stop: () => {
      isPolling = false;
      abortController?.abort();
      emit('disconnected', { reason: 'Client stopped' });
    },

    on: (event, handler) => {
      if (listeners[event]) {
        listeners[event].push(handler);
      }
      return () => {
        const index = listeners[event]?.indexOf(handler);
        if (index !== -1) listeners[event].splice(index, 1);
      };
    },

    isActive: () => isPolling,

    getLastEventId: () => lastEventId,

    _setMockFetch: (fn) => {
      mockFetch = fn;
    },
  };
};

// Long polling server implementation
const createLongPollingServer = (options = {}) => {
  const { timeout = 30000 } = options;
  const pendingRequests = new Map();
  const messageQueue = [];
  let messageId = 0;

  return {
    handle: (request) => {
      const clientId = request.clientId || crypto.randomUUID();
      const lastEventId = request.headers?.['x-last-event-id'];

      return new Promise((resolve) => {
        // Check for pending messages
        const pendingMessages = messageQueue.filter(
          (m) => !lastEventId || m.id > parseInt(lastEventId)
        );

        if (pendingMessages.length > 0) {
          resolve({
            status: 200,
            data: pendingMessages[0],
          });
          return;
        }

        // Hold connection
        const timer = setTimeout(() => {
          pendingRequests.delete(clientId);
          resolve({ status: 204, data: null });
        }, timeout);

        pendingRequests.set(clientId, { resolve, timer });
      });
    },

    push: (message) => {
      const id = ++messageId;
      const envelope = { id, message, timestamp: Date.now() };

      messageQueue.push(envelope);

      // Notify waiting clients
      for (const [clientId, pending] of pendingRequests) {
        clearTimeout(pending.timer);
        pending.resolve({ status: 200, data: envelope });
        pendingRequests.delete(clientId);
      }

      return id;
    },

    broadcast: (message) => {
      return this.push(message);
    },

    getPendingCount: () => pendingRequests.size,

    getQueueLength: () => messageQueue.length,

    clearQueue: () => {
      messageQueue.length = 0;
    },
  };
};

// Polling strategy
const createPollingStrategy = () => {
  return {
    fixed: (interval) => ({
      getNextDelay: () => interval,
      reset: () => {},
    }),

    exponential: (baseDelay, maxDelay, factor = 2) => {
      let currentDelay = baseDelay;

      return {
        getNextDelay: () => {
          const delay = currentDelay;
          currentDelay = Math.min(currentDelay * factor, maxDelay);
          return delay;
        },
        reset: () => {
          currentDelay = baseDelay;
        },
      };
    },

    adaptive: (minDelay, maxDelay) => {
      let currentDelay = minDelay;
      let lastHadData = false;

      return {
        getNextDelay: (hadData) => {
          if (hadData) {
            lastHadData = true;
            currentDelay = Math.max(minDelay, currentDelay / 2);
          } else if (!lastHadData) {
            currentDelay = Math.min(maxDelay, currentDelay * 1.5);
          }
          lastHadData = hadData;
          return currentDelay;
        },
        reset: () => {
          currentDelay = minDelay;
          lastHadData = false;
        },
      };
    },
  };
};

describe('Long Polling Client Tests', () => {
  let client;
  let mockFetch;

  beforeEach(() => {
    vi.useFakeTimers();
    client = createLongPollingClient('https://api.example.com/poll', {
      pollInterval: 100,
      retryDelay: 100,
      maxRetries: 3,
    });
    mockFetch = vi.fn().mockResolvedValue({ data: null });
    client._setMockFetch(mockFetch);
  });

  afterEach(() => {
    client.stop();
    vi.useRealTimers();
  });

  // ═══════════════════════════════════════════════════════════════════
  // START / STOP
  // ═══════════════════════════════════════════════════════════════════

  describe('start / stop', () => {
    it('should start polling', () => {
      client.start();

      expect(client.isActive()).toBe(true);
    });

    it('should emit connected event', () => {
      const handler = vi.fn();
      client.on('connected', handler);

      client.start();

      expect(handler).toHaveBeenCalled();
    });

    it('should stop polling', () => {
      client.start();
      client.stop();

      expect(client.isActive()).toBe(false);
    });

    it('should emit disconnected event', () => {
      const handler = vi.fn();
      client.on('disconnected', handler);

      client.start();
      client.stop();

      expect(handler).toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // MESSAGES
  // ═══════════════════════════════════════════════════════════════════

  describe('messages', () => {
    it('should receive messages', async () => {
      const handler = vi.fn();
      client.on('message', handler);

      mockFetch.mockResolvedValue({ data: { id: 1, text: 'Hello' } });

      client.start();
      await vi.advanceTimersByTimeAsync(10);

      expect(handler).toHaveBeenCalledWith({ id: 1, text: 'Hello' });
    });

    it('should track last event ID', async () => {
      mockFetch.mockResolvedValue({ data: { id: 123 } });

      client.start();
      await vi.advanceTimersByTimeAsync(10);

      expect(client.getLastEventId()).toBe(123);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // ERROR HANDLING
  // ═══════════════════════════════════════════════════════════════════

  describe('error handling', () => {
    it('should emit error event', async () => {
      const handler = vi.fn();
      client.on('error', handler);

      mockFetch.mockRejectedValue(new Error('Network error'));

      client.start();
      await vi.advanceTimersByTimeAsync(10);

      expect(handler).toHaveBeenCalled();
    });

    it('should retry on error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Error')).mockResolvedValue({ data: null });

      client.start();
      await vi.advanceTimersByTimeAsync(200);

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });
});

describe('Long Polling Server Tests', () => {
  let server;

  beforeEach(() => {
    vi.useFakeTimers();
    server = createLongPollingServer({ timeout: 1000 });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ═══════════════════════════════════════════════════════════════════
  // HANDLE
  // ═══════════════════════════════════════════════════════════════════

  describe('handle', () => {
    it('should hold connection when no messages', async () => {
      const promise = server.handle({ clientId: 'client-1', headers: {} });

      // Should be pending
      expect(server.getPendingCount()).toBe(1);

      // Timeout
      await vi.advanceTimersByTimeAsync(1000);
      const response = await promise;

      expect(response.status).toBe(204);
    });

    it('should return immediately with pending message', async () => {
      server.push({ text: 'Hello' });

      const response = await server.handle({ clientId: 'client-1', headers: {} });

      expect(response.status).toBe(200);
      expect(response.data.message.text).toBe('Hello');
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // PUSH
  // ═══════════════════════════════════════════════════════════════════

  describe('push', () => {
    it('should push message and notify clients', async () => {
      const promise = server.handle({ clientId: 'client-1', headers: {} });

      server.push({ text: 'New message' });

      const response = await promise;
      expect(response.data.message.text).toBe('New message');
    });

    it('should return message ID', () => {
      const id1 = server.push({ text: 'First' });
      const id2 = server.push({ text: 'Second' });

      expect(id1).toBe(1);
      expect(id2).toBe(2);
    });
  });
});

describe('Polling Strategy Tests', () => {
  let strategy;

  beforeEach(() => {
    strategy = createPollingStrategy();
  });

  describe('fixed', () => {
    it('should return fixed interval', () => {
      const fixed = strategy.fixed(1000);

      expect(fixed.getNextDelay()).toBe(1000);
      expect(fixed.getNextDelay()).toBe(1000);
    });
  });

  describe('exponential', () => {
    it('should increase delay exponentially', () => {
      const exp = strategy.exponential(100, 5000, 2);

      expect(exp.getNextDelay()).toBe(100);
      expect(exp.getNextDelay()).toBe(200);
      expect(exp.getNextDelay()).toBe(400);
    });

    it('should cap at max delay', () => {
      const exp = strategy.exponential(100, 300, 2);

      exp.getNextDelay(); // 100
      exp.getNextDelay(); // 200
      expect(exp.getNextDelay()).toBe(300);
      expect(exp.getNextDelay()).toBe(300);
    });

    it('should reset', () => {
      const exp = strategy.exponential(100, 5000, 2);

      exp.getNextDelay();
      exp.getNextDelay();
      exp.reset();

      expect(exp.getNextDelay()).toBe(100);
    });
  });

  describe('adaptive', () => {
    it('should decrease delay when data received', () => {
      const adaptive = strategy.adaptive(100, 5000);

      adaptive.getNextDelay(false); // 100
      adaptive.getNextDelay(false); // 150
      const afterData = adaptive.getNextDelay(true); // Should decrease

      expect(afterData).toBeLessThan(150);
    });

    it('should increase delay when no data', () => {
      const adaptive = strategy.adaptive(100, 5000);

      const first = adaptive.getNextDelay(false);
      const second = adaptive.getNextDelay(false);

      expect(second).toBeGreaterThan(first);
    });
  });
});
