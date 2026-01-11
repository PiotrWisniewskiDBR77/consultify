/**
 * Batch Processing Pattern Tests
 * Tests for batching and debouncing operations
 *
 * @module tests/processing/batch-processing.test.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Batch processor
const createBatchProcessor = (options = {}) => {
  const { maxBatchSize = 10, maxWaitMs = 100 } = options;

  let batch = [];
  let timer = null;
  let processCallback = null;

  const flush = () => {
    if (batch.length === 0) return;

    const items = [...batch];
    batch = [];

    if (timer) {
      clearTimeout(timer);
      timer = null;
    }

    if (processCallback) {
      processCallback(items);
    }
  };

  return {
    add: (item) => {
      batch.push(item);

      if (batch.length >= maxBatchSize) {
        flush();
      } else if (!timer) {
        timer = setTimeout(flush, maxWaitMs);
      }
    },

    addAll: (items) => {
      for (const item of items) {
        this.add(item);
      }
    },

    flush,

    onProcess: (callback) => {
      processCallback = callback;
    },

    getPending: () => batch.length,

    clear: () => {
      batch = [];
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    },
  };
};

// Debounce
const createDebouncer = (fn, waitMs) => {
  let timer = null;

  const debounced = (...args) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      fn(...args);
      timer = null;
    }, waitMs);
  };

  debounced.cancel = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  };

  debounced.flush = () => {
    if (timer) {
      clearTimeout(timer);
      // Cannot flush without last args, just cancel
      timer = null;
    }
  };

  debounced.pending = () => timer !== null;

  return debounced;
};

// Throttle
const createThrottler = (fn, limitMs) => {
  let lastRun = 0;
  let timer = null;
  let lastArgs = null;

  const throttled = (...args) => {
    const now = Date.now();
    const remaining = limitMs - (now - lastRun);

    lastArgs = args;

    if (remaining <= 0) {
      lastRun = now;
      fn(...args);
    } else if (!timer) {
      timer = setTimeout(() => {
        lastRun = Date.now();
        timer = null;
        fn(...lastArgs);
      }, remaining);
    }
  };

  throttled.cancel = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  };

  return throttled;
};

// Request coalescor
const createRequestCoalescer = (processFn, keyFn = (x) => x) => {
  const pending = new Map();

  return {
    request: async (item) => {
      const key = keyFn(item);

      if (pending.has(key)) {
        return pending.get(key);
      }

      const promise = processFn(item).finally(() => {
        pending.delete(key);
      });

      pending.set(key, promise);
      return promise;
    },

    getPendingCount: () => pending.size,

    hasPending: (item) => pending.has(keyFn(item)),
  };
};

// Micro-task batcher
const createMicroBatcher = (processFn) => {
  let batch = [];
  let scheduled = false;

  return {
    add: (item) => {
      batch.push(item);

      if (!scheduled) {
        scheduled = true;
        queueMicrotask(() => {
          const items = [...batch];
          batch = [];
          scheduled = false;
          processFn(items);
        });
      }
    },

    addAsync: (item) => {
      return new Promise((resolve) => {
        const wrappedItem = { item, resolve };
        batch.push(wrappedItem);

        if (!scheduled) {
          scheduled = true;
          queueMicrotask(async () => {
            const items = [...batch];
            batch = [];
            scheduled = false;

            const results = await processFn(items.map((i) => i.item));
            items.forEach((i, idx) => i.resolve(results[idx]));
          });
        }
      });
    },
  };
};

describe('Batch Processor Tests', () => {
  let processor;
  let handler;

  beforeEach(() => {
    vi.useFakeTimers();
    handler = vi.fn();
    processor = createBatchProcessor({ maxBatchSize: 3, maxWaitMs: 100 });
    processor.onProcess(handler);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should batch by size', () => {
    processor.add(1);
    processor.add(2);
    processor.add(3);

    expect(handler).toHaveBeenCalledWith([1, 2, 3]);
  });

  it('should batch by time', () => {
    processor.add(1);
    processor.add(2);

    expect(handler).not.toHaveBeenCalled();

    vi.advanceTimersByTime(100);

    expect(handler).toHaveBeenCalledWith([1, 2]);
  });

  it('should flush manually', () => {
    processor.add(1);
    processor.flush();

    expect(handler).toHaveBeenCalledWith([1]);
  });

  it('should track pending', () => {
    processor.add(1);

    expect(processor.getPending()).toBe(1);
  });
});

describe('Debounce Tests', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should debounce calls', () => {
    const fn = vi.fn();
    const debounced = createDebouncer(fn, 100);

    debounced('a');
    debounced('b');
    debounced('c');

    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(100);

    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('c');
  });

  it('should cancel', () => {
    const fn = vi.fn();
    const debounced = createDebouncer(fn, 100);

    debounced();
    debounced.cancel();

    vi.advanceTimersByTime(100);

    expect(fn).not.toHaveBeenCalled();
  });

  it('should track pending', () => {
    const debounced = createDebouncer(() => {}, 100);

    debounced();
    expect(debounced.pending()).toBe(true);

    vi.advanceTimersByTime(100);
    expect(debounced.pending()).toBe(false);
  });
});

describe('Throttle Tests', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should throttle calls', () => {
    const fn = vi.fn();
    const throttled = createThrottler(fn, 100);

    throttled('a');
    throttled('b');
    throttled('c');

    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('a');

    vi.advanceTimersByTime(100);

    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenLastCalledWith('c');
  });
});

describe('Request Coalescer Tests', () => {
  it('should coalesce duplicate requests', async () => {
    const processFn = vi.fn(async (id) => `result-${id}`);
    const coalescer = createRequestCoalescer(processFn);

    const p1 = coalescer.request('id-1');
    const p2 = coalescer.request('id-1');

    const [r1, r2] = await Promise.all([p1, p2]);

    expect(r1).toBe(r2);
    expect(processFn).toHaveBeenCalledTimes(1);
  });

  it('should process different keys separately', async () => {
    const processFn = vi.fn(async (id) => `result-${id}`);
    const coalescer = createRequestCoalescer(processFn);

    await Promise.all([coalescer.request('id-1'), coalescer.request('id-2')]);

    expect(processFn).toHaveBeenCalledTimes(2);
  });
});
