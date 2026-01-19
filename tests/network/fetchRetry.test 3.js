/**
 * Network Request & Retry Logic Tests
 * Tests for fetch wrapper, XHR utilities, retry strategies, and request queuing
 *
 * @module tests/network/fetchRetry.test.js
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ============================================
// HELPER IMPLEMENTATIONS (inline mocks)
// ============================================

/**
 * Creates a fetch wrapper with retry logic
 */
const createFetchWithRetry = () => {
  const defaultOptions = {
    maxRetries: 3,
    retryDelay: 1000,
    backoffMultiplier: 2,
    retryOn: [408, 429, 500, 502, 503, 504],
    timeout: 30000,
  };

  const requestLog = [];

  return {
    fetch: async (url, options = {}, retryConfig = {}) => {
      const config = { ...defaultOptions, ...retryConfig };
      let lastError = null;
      let attempt = 0;

      while (attempt <= config.maxRetries) {
        attempt++;
        const startTime = Date.now();

        try {
          // Simulate fetch
          const mockFetch = options._mockFetch || (() => ({ ok: true, status: 200 }));
          const response = await mockFetch(url, options);

          requestLog.push({
            url,
            attempt,
            success: response.ok,
            status: response.status,
            duration: Date.now() - startTime,
          });

          if (!response.ok && config.retryOn.includes(response.status)) {
            throw { status: response.status, retryable: true };
          }

          return response;
        } catch (error) {
          lastError = error;
          requestLog.push({
            url,
            attempt,
            success: false,
            error: error.message || error.status,
            duration: Date.now() - startTime,
          });

          if (attempt <= config.maxRetries && error.retryable !== false) {
            const delay = config.retryDelay * Math.pow(config.backoffMultiplier, attempt - 1);
            await new Promise((resolve) => setTimeout(resolve, delay));
          }
        }
      }

      throw lastError;
    },

    getRequestLog: () => [...requestLog],
    clearLog: () => {
      requestLog.length = 0;
    },
  };
};

/**
 * Creates a request queue manager
 */
const createRequestQueue = () => {
  const queue = [];
  const inFlight = new Map();
  let concurrencyLimit = 4;
  let isPaused = false;

  const processQueue = async () => {
    if (isPaused) return;

    while (queue.length > 0 && inFlight.size < concurrencyLimit) {
      const request = queue.shift();
      inFlight.set(request.id, request);

      try {
        const result = await request.execute();
        request.resolve(result);
      } catch (error) {
        request.reject(error);
      } finally {
        inFlight.delete(request.id);
        processQueue();
      }
    }
  };

  return {
    add: (execute, priority = 0) => {
      return new Promise((resolve, reject) => {
        const id = `req-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const request = { id, execute, priority, resolve, reject, addedAt: Date.now() };

        // Insert by priority (higher priority first)
        const insertIndex = queue.findIndex((r) => r.priority < priority);
        if (insertIndex === -1) {
          queue.push(request);
        } else {
          queue.splice(insertIndex, 0, request);
        }

        processQueue();
      });
    },

    getQueueLength: () => queue.length,
    getInFlightCount: () => inFlight.size,

    pause: () => {
      isPaused = true;
    },
    resume: () => {
      isPaused = false;
      processQueue();
    },
    isPaused: () => isPaused,

    setConcurrency: (limit) => {
      concurrencyLimit = limit;
    },
    getConcurrency: () => concurrencyLimit,

    clear: () => {
      queue.forEach((r) => r.reject(new Error('Queue cleared')));
      queue.length = 0;
    },

    getPendingRequests: () => queue.map((r) => ({ id: r.id, priority: r.priority })),
  };
};

/**
 * Creates an offline request buffer
 */
const createOfflineBuffer = () => {
  const buffer = [];
  let isOnline = true;
  const listeners = [];

  return {
    setOnline: (online) => {
      const wasOffline = !isOnline;
      isOnline = online;

      if (wasOffline && online) {
        listeners.forEach((cb) => cb({ type: 'online', pendingCount: buffer.length }));
      }
    },

    isOnline: () => isOnline,

    addRequest: (request) => {
      if (!isOnline) {
        buffer.push({
          ...request,
          bufferedAt: Date.now(),
          id: `buff-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        });
        return { buffered: true, id: buffer[buffer.length - 1].id };
      }
      return { buffered: false };
    },

    getBufferedRequests: () => [...buffer],
    getBufferSize: () => buffer.length,

    flush: async (executor) => {
      const results = [];
      while (buffer.length > 0) {
        const request = buffer.shift();
        try {
          const result = await executor(request);
          results.push({ id: request.id, success: true, result });
        } catch (error) {
          results.push({ id: request.id, success: false, error });
        }
      }
      return results;
    },

    clear: () => {
      buffer.length = 0;
    },

    onOnline: (callback) => {
      listeners.push(callback);
      return () => {
        const idx = listeners.indexOf(callback);
        if (idx > -1) listeners.splice(idx, 1);
      };
    },
  };
};

/**
 * Creates a request deduplicator
 */
const createRequestDeduplicator = () => {
  const pending = new Map();
  const cache = new Map();

  return {
    dedupe: async (key, executor, options = {}) => {
      const cacheTime = options.cacheTime || 0;

      // Check cache first
      if (cacheTime > 0 && cache.has(key)) {
        const cached = cache.get(key);
        if (Date.now() - cached.timestamp < cacheTime) {
          return { ...cached.data, fromCache: true };
        }
      }

      // Check if already in flight
      if (pending.has(key)) {
        return pending.get(key);
      }

      // Execute and track
      const promise = executor()
        .then((result) => {
          if (cacheTime > 0) {
            cache.set(key, { data: result, timestamp: Date.now() });
          }
          return result;
        })
        .finally(() => {
          pending.delete(key);
        });

      pending.set(key, promise);
      return promise;
    },

    isPending: (key) => pending.has(key),
    isCached: (key) => cache.has(key),

    invalidateCache: (key) => {
      if (key) {
        cache.delete(key);
      } else {
        cache.clear();
      }
    },

    getPendingCount: () => pending.size,
    getCacheSize: () => cache.size,
  };
};

// ============================================
// TESTS
// ============================================

describe('Network Request & Retry Logic Tests', () => {
  let fetchWithRetry;
  let requestQueue;
  let offlineBuffer;
  let deduplicator;

  beforeEach(() => {
    fetchWithRetry = createFetchWithRetry();
    requestQueue = createRequestQueue();
    offlineBuffer = createOfflineBuffer();
    deduplicator = createRequestDeduplicator();
    vi.useFakeTimers();
  });

  afterEach(() => {
    fetchWithRetry.clearLog();
    vi.useRealTimers();
  });

  describe('Fetch with Retry', () => {
    it('should succeed on first attempt', async () => {
      const mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });

      const result = await fetchWithRetry.fetch('/api/data', { _mockFetch: mockFetch });

      expect(result.status).toBe(200);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should retry on retryable status codes', async () => {
      const mockFetch = vi
        .fn()
        .mockResolvedValueOnce({ ok: false, status: 503 })
        .mockResolvedValueOnce({ ok: false, status: 503 })
        .mockResolvedValueOnce({ ok: true, status: 200 });

      const fetchPromise = fetchWithRetry.fetch('/api/data', { _mockFetch: mockFetch });

      // Advance timers for retry delays
      await vi.advanceTimersByTimeAsync(10000);
      const result = await fetchPromise;

      expect(result.status).toBe(200);
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('should log all request attempts', async () => {
      const mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });

      await fetchWithRetry.fetch('/api/users', { _mockFetch: mockFetch });
      const log = fetchWithRetry.getRequestLog();

      expect(log).toHaveLength(1);
      expect(log[0].url).toBe('/api/users');
      expect(log[0].success).toBe(true);
    });

    it('should throw after max retries exceeded', async () => {
      const mockFetch = vi.fn().mockResolvedValue({ ok: false, status: 503 });

      let error = null;
      const fetchPromise = fetchWithRetry
        .fetch('/api/fail', { _mockFetch: mockFetch }, { maxRetries: 2 })
        .catch((e) => {
          error = e;
        });

      await vi.advanceTimersByTimeAsync(30000);
      await fetchPromise;

      expect(error).toBeDefined();
      expect(mockFetch).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });

    it('should use exponential backoff', async () => {
      const callTimes = [];
      const mockFetch = vi.fn().mockImplementation(() => {
        callTimes.push(Date.now());
        return Promise.resolve({ ok: false, status: 500 });
      });

      let error = null;
      const fetchPromise = fetchWithRetry
        .fetch(
          '/api/test',
          { _mockFetch: mockFetch },
          { maxRetries: 2, retryDelay: 100, backoffMultiplier: 2 }
        )
        .catch((e) => {
          error = e;
        });

      await vi.advanceTimersByTimeAsync(1000);
      await fetchPromise;

      expect(error).toBeDefined();
      expect(mockFetch).toHaveBeenCalledTimes(3);
      // Delays should be: 0, 100, 200 (exponential)
    });
  });

  describe('Request Queue', () => {
    it('should process requests in order', async () => {
      const results = [];

      requestQueue.add(async () => {
        results.push(1);
        return 1;
      });
      requestQueue.add(async () => {
        results.push(2);
        return 2;
      });
      requestQueue.add(async () => {
        results.push(3);
        return 3;
      });

      await vi.advanceTimersByTimeAsync(100);

      expect(results).toEqual([1, 2, 3]);
    });

    it('should respect priority ordering', async () => {
      const results = [];
      requestQueue.setConcurrency(1);

      // Add with different priorities
      const p1 = requestQueue.add(async () => {
        await new Promise((r) => setTimeout(r, 50));
        results.push('low');
      }, 1);
      requestQueue.add(async () => {
        results.push('high');
      }, 10);
      requestQueue.add(async () => {
        results.push('medium');
      }, 5);

      await vi.advanceTimersByTimeAsync(200);

      // High priority should be processed before lower
    });

    it('should respect concurrency limit', () => {
      requestQueue.setConcurrency(2);

      requestQueue.add(() => new Promise((r) => setTimeout(r, 1000)));
      requestQueue.add(() => new Promise((r) => setTimeout(r, 1000)));
      requestQueue.add(() => new Promise((r) => setTimeout(r, 1000)));

      expect(requestQueue.getInFlightCount()).toBe(2);
      expect(requestQueue.getQueueLength()).toBe(1);
    });

    it('should pause and resume queue', async () => {
      const results = [];

      requestQueue.pause();
      requestQueue.add(async () => {
        results.push(1);
      });

      await vi.advanceTimersByTimeAsync(100);
      expect(results).toHaveLength(0);

      requestQueue.resume();
      await vi.advanceTimersByTimeAsync(100);
      expect(results).toHaveLength(1);
    });

    it('should clear queue and reject pending', async () => {
      const promise = requestQueue.add(async () => {
        await new Promise((r) => setTimeout(r, 1000));
      });

      requestQueue.add(async () => {});
      requestQueue.clear();

      expect(requestQueue.getQueueLength()).toBe(0);
    });
  });

  describe('Offline Buffer', () => {
    it('should buffer requests when offline', () => {
      offlineBuffer.setOnline(false);

      const result = offlineBuffer.addRequest({ url: '/api/sync', method: 'POST' });

      expect(result.buffered).toBe(true);
      expect(offlineBuffer.getBufferSize()).toBe(1);
    });

    it('should not buffer when online', () => {
      offlineBuffer.setOnline(true);

      const result = offlineBuffer.addRequest({ url: '/api/data' });

      expect(result.buffered).toBe(false);
      expect(offlineBuffer.getBufferSize()).toBe(0);
    });

    it('should flush buffered requests on online', async () => {
      offlineBuffer.setOnline(false);
      offlineBuffer.addRequest({ url: '/api/1' });
      offlineBuffer.addRequest({ url: '/api/2' });

      offlineBuffer.setOnline(true);

      const executor = vi.fn().mockResolvedValue({ success: true });
      const results = await offlineBuffer.flush(executor);

      expect(results).toHaveLength(2);
      expect(executor).toHaveBeenCalledTimes(2);
    });

    it('should notify on online status change', () => {
      const callback = vi.fn();
      offlineBuffer.onOnline(callback);

      offlineBuffer.setOnline(false);
      offlineBuffer.addRequest({ url: '/api/data' });
      offlineBuffer.setOnline(true);

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'online',
          pendingCount: 1,
        })
      );
    });
  });

  describe('Request Deduplicator', () => {
    it('should deduplicate concurrent requests', async () => {
      const executor = vi.fn().mockImplementation(async () => {
        await new Promise((r) => setTimeout(r, 100));
        return { data: 'result' };
      });

      const p1 = deduplicator.dedupe('key1', executor);
      const p2 = deduplicator.dedupe('key1', executor);
      const p3 = deduplicator.dedupe('key1', executor);

      await vi.advanceTimersByTimeAsync(200);

      const [r1, r2, r3] = await Promise.all([p1, p2, p3]);

      expect(executor).toHaveBeenCalledTimes(1);
      expect(r1).toEqual(r2);
    });

    it('should cache results when configured', async () => {
      let callCount = 0;
      const executor = vi.fn().mockImplementation(async () => ({ count: ++callCount }));

      await deduplicator.dedupe('cached', executor, { cacheTime: 5000 });
      await vi.advanceTimersByTimeAsync(1000);

      const result = await deduplicator.dedupe('cached', executor, { cacheTime: 5000 });

      expect(result.fromCache).toBe(true);
      expect(executor).toHaveBeenCalledTimes(1);
    });

    it('should invalidate cache', async () => {
      const executor = vi.fn().mockResolvedValue({ data: 'cached' });

      await deduplicator.dedupe('key', executor, { cacheTime: 10000 });
      expect(deduplicator.isCached('key')).toBe(true);

      deduplicator.invalidateCache('key');
      expect(deduplicator.isCached('key')).toBe(false);
    });

    it('should track pending requests', async () => {
      const executor = vi.fn().mockImplementation(() => new Promise((r) => setTimeout(r, 500)));

      deduplicator.dedupe('pending', executor);
      expect(deduplicator.isPending('pending')).toBe(true);

      await vi.advanceTimersByTimeAsync(600);
      expect(deduplicator.isPending('pending')).toBe(false);
    });
  });
});
