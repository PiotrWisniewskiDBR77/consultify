/**
 * Web Worker Tests
 * Tests for worker communication patterns
 *
 * @module tests/worker/web-worker.test.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Worker message handler
const createWorkerHandler = () => {
  const handlers = new Map();
  const pending = new Map();
  let messageId = 0;

  return {
    register: (type, handler) => {
      handlers.set(type, handler);
    },

    handleMessage: async (event) => {
      const { type, id, payload } = event.data;

      // Check if it's a response
      if (pending.has(id)) {
        const { resolve, reject } = pending.get(id);
        pending.delete(id);

        if (event.data.error) {
          reject(new Error(event.data.error));
        } else {
          resolve(event.data.result);
        }
        return;
      }

      // Handle request
      const handler = handlers.get(type);
      if (handler) {
        try {
          const result = await handler(payload);
          return { id, result };
        } catch (error) {
          return { id, error: error.message };
        }
      }

      return { id, error: 'Unknown message type' };
    },

    send: (worker, type, payload) => {
      const id = ++messageId;

      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        worker.postMessage({ type, id, payload });
      });
    },

    getPendingCount: () => pending.size,
  };
};

// Worker pool
const createWorkerPool = (createWorker, poolSize = 4) => {
  const workers = [];
  const queue = [];
  const busy = new Set();

  // Initialize workers
  for (let i = 0; i < poolSize; i++) {
    workers.push({
      id: i,
      worker: createWorker(),
    });
  }

  const getAvailable = () => {
    for (const w of workers) {
      if (!busy.has(w.id)) return w;
    }
    return null;
  };

  const processQueue = () => {
    if (queue.length === 0) return;

    const available = getAvailable();
    if (!available) return;

    const { task, resolve, reject } = queue.shift();
    busy.add(available.id);

    task(available.worker)
      .then(resolve)
      .catch(reject)
      .finally(() => {
        busy.delete(available.id);
        processQueue();
      });
  };

  return {
    execute: (task) => {
      return new Promise((resolve, reject) => {
        queue.push({ task, resolve, reject });
        processQueue();
      });
    },

    getActiveCount: () => busy.size,

    getQueueLength: () => queue.length,

    getPoolSize: () => poolSize,

    terminate: () => {
      for (const { worker } of workers) {
        worker.terminate?.();
      }
    },
  };
};

// Shared worker coordinator
const createSharedWorkerCoordinator = () => {
  const ports = new Set();
  const state = {};
  const subscribers = new Map();

  return {
    connect: (port) => {
      ports.add(port);
      return () => ports.delete(port);
    },

    broadcast: (message) => {
      for (const port of ports) {
        port.postMessage(message);
      }
    },

    setState: (key, value) => {
      state[key] = value;

      const subs = subscribers.get(key) || [];
      for (const callback of subs) {
        callback(value);
      }
    },

    getState: (key) => state[key],

    subscribe: (key, callback) => {
      if (!subscribers.has(key)) {
        subscribers.set(key, []);
      }
      subscribers.get(key).push(callback);

      return () => {
        const subs = subscribers.get(key);
        const idx = subs.indexOf(callback);
        if (idx !== -1) subs.splice(idx, 1);
      };
    },

    getPortCount: () => ports.size,
  };
};

// Transferable helper
const createTransferableBuilder = () => {
  const buffers = [];

  return {
    addArrayBuffer: (data) => {
      const buffer = new ArrayBuffer(data.length);
      const view = new Uint8Array(buffer);
      for (let i = 0; i < data.length; i++) {
        view[i] = data[i];
      }
      buffers.push(buffer);
      return buffer;
    },

    addImageData: (width, height) => {
      const buffer = new ArrayBuffer(width * height * 4);
      buffers.push(buffer);
      return buffer;
    },

    getTransferables: () => [...buffers],

    clear: () => {
      buffers.length = 0;
    },
  };
};

describe('Worker Handler Tests', () => {
  let handler;

  beforeEach(() => {
    handler = createWorkerHandler();
  });

  it('should register and handle message', async () => {
    handler.register('greet', (name) => `Hello, ${name}!`);

    const result = await handler.handleMessage({
      data: { type: 'greet', id: 1, payload: 'World' },
    });

    expect(result.result).toBe('Hello, World!');
  });

  it('should handle errors', async () => {
    handler.register('fail', () => {
      throw new Error('Oops');
    });

    const result = await handler.handleMessage({
      data: { type: 'fail', id: 1, payload: {} },
    });

    expect(result.error).toBe('Oops');
  });

  it('should handle unknown type', async () => {
    const result = await handler.handleMessage({
      data: { type: 'unknown', id: 1, payload: {} },
    });

    expect(result.error).toBe('Unknown message type');
  });
});

describe('Worker Pool Tests', () => {
  let pool;
  let mockWorker;

  beforeEach(() => {
    mockWorker = {
      postMessage: vi.fn(),
      terminate: vi.fn(),
    };

    pool = createWorkerPool(() => mockWorker, 2);
  });

  it('should execute tasks', async () => {
    const task = vi.fn().mockResolvedValue('result');

    const result = await pool.execute(task);

    expect(result).toBe('result');
  });

  it('should track active workers', async () => {
    let resolveTask;
    const task = () =>
      new Promise((r) => {
        resolveTask = r;
      });

    const promise = pool.execute(task);

    expect(pool.getActiveCount()).toBe(1);

    resolveTask('done');
    await promise;

    // Wait for .finally() to execute
    await new Promise((r) => setTimeout(r, 0));

    expect(pool.getActiveCount()).toBe(0);
  });

  it('should queue when pool is busy', async () => {
    const task1 = () => new Promise((r) => setTimeout(() => r(1), 50));
    const task2 = () => new Promise((r) => setTimeout(() => r(2), 50));
    const task3 = () => new Promise((r) => setTimeout(() => r(3), 50));

    pool.execute(task1);
    pool.execute(task2);
    pool.execute(task3);

    expect(pool.getQueueLength()).toBeGreaterThanOrEqual(1);
  });

  it('should terminate all workers', () => {
    pool.terminate();

    expect(mockWorker.terminate).toHaveBeenCalled();
  });
});

describe('Shared Worker Coordinator Tests', () => {
  let coordinator;

  beforeEach(() => {
    coordinator = createSharedWorkerCoordinator();
  });

  it('should connect ports', () => {
    const port = { postMessage: vi.fn() };

    coordinator.connect(port);

    expect(coordinator.getPortCount()).toBe(1);
  });

  it('should broadcast to all ports', () => {
    const port1 = { postMessage: vi.fn() };
    const port2 = { postMessage: vi.fn() };

    coordinator.connect(port1);
    coordinator.connect(port2);

    coordinator.broadcast({ type: 'update' });

    expect(port1.postMessage).toHaveBeenCalledWith({ type: 'update' });
    expect(port2.postMessage).toHaveBeenCalledWith({ type: 'update' });
  });

  it('should manage shared state', () => {
    coordinator.setState('count', 1);

    expect(coordinator.getState('count')).toBe(1);
  });

  it('should notify subscribers', () => {
    const callback = vi.fn();
    coordinator.subscribe('count', callback);

    coordinator.setState('count', 5);

    expect(callback).toHaveBeenCalledWith(5);
  });
});

describe('Transferable Builder Tests', () => {
  let builder;

  beforeEach(() => {
    builder = createTransferableBuilder();
  });

  it('should create ArrayBuffer', () => {
    const buffer = builder.addArrayBuffer([1, 2, 3, 4]);

    expect(buffer.byteLength).toBe(4);
  });

  it('should track transferables', () => {
    builder.addArrayBuffer([1, 2]);
    builder.addArrayBuffer([3, 4]);

    expect(builder.getTransferables()).toHaveLength(2);
  });
});
