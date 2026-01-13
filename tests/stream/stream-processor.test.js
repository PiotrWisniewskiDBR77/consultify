/**
 * Stream Processing Tests
 * Tests for stream-based data processing
 *
 * @module tests/stream/stream-processor.test.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Stream processor implementation
const createStreamProcessor = () => {
  const transforms = [];
  const listeners = {
    data: [],
    end: [],
    error: [],
  };

  return {
    use: (transform) => {
      transforms.push(transform);
      return this;
    },

    on: (event, handler) => {
      if (listeners[event]) {
        listeners[event].push(handler);
      }
      return this;
    },

    off: (event, handler) => {
      if (listeners[event]) {
        const index = listeners[event].indexOf(handler);
        if (index !== -1) listeners[event].splice(index, 1);
      }
      return this;
    },

    emit: (event, data) => {
      if (listeners[event]) {
        listeners[event].forEach((handler) => handler(data));
      }
    },

    process: async function* (source) {
      try {
        for await (const item of source) {
          let result = item;

          for (const transform of transforms) {
            result = await transform(result);
            if (result === null || result === undefined) break;
          }

          if (result !== null && result !== undefined) {
            this.emit('data', result);
            yield result;
          }
        }
        this.emit('end');
      } catch (error) {
        this.emit('error', error);
        throw error;
      }
    },

    collect: async (source) => {
      const results = [];
      for await (const item of this.process(source)) {
        results.push(item);
      }
      return results;
    },

    reduce: async (source, reducer, initial) => {
      let acc = initial;
      for await (const item of this.process(source)) {
        acc = reducer(acc, item);
      }
      return acc;
    },

    first: async (source) => {
      for await (const item of this.process(source)) {
        return item;
      }
      return null;
    },

    take: async (source, n) => {
      const results = [];
      let count = 0;
      for await (const item of this.process(source)) {
        results.push(item);
        if (++count >= n) break;
      }
      return results;
    },

    skip: async function* (source, n) {
      let count = 0;
      for await (const item of this.process(source)) {
        if (count++ >= n) {
          yield item;
        }
      }
    },

    clear: () => {
      transforms.length = 0;
      Object.values(listeners).forEach((arr) => (arr.length = 0));
    },
  };
};

// Async generator helper
async function* arrayToAsyncGenerator(array) {
  for (const item of array) {
    yield item;
  }
}

// Batch processor
const createBatchProcessor = (batchSize = 10) => {
  return {
    batch: async function* (source) {
      let batch = [];

      for await (const item of source) {
        batch.push(item);

        if (batch.length >= batchSize) {
          yield batch;
          batch = [];
        }
      }

      if (batch.length > 0) {
        yield batch;
      }
    },

    processBatches: async (source, processor) => {
      const results = [];

      for await (const batch of this.batch(source)) {
        const processed = await processor(batch);
        results.push(...processed);
      }

      return results;
    },
  };
};

describe('Stream Processor Tests', () => {
  let processor;

  beforeEach(() => {
    processor = createStreamProcessor();
  });

  // ═══════════════════════════════════════════════════════════════════
  // USE
  // ═══════════════════════════════════════════════════════════════════

  describe('use', () => {
    it('should add transform', async () => {
      processor.use((x) => x * 2);

      const source = arrayToAsyncGenerator([1, 2, 3]);
      const result = await processor.collect(source);

      expect(result).toEqual([2, 4, 6]);
    });

    it('should chain transforms', async () => {
      processor.use((x) => x * 2).use((x) => x + 1);

      const source = arrayToAsyncGenerator([1, 2, 3]);
      const result = await processor.collect(source);

      expect(result).toEqual([3, 5, 7]);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // FILTERING
  // ═══════════════════════════════════════════════════════════════════

  describe('Filtering', () => {
    it('should filter out null results', async () => {
      processor.use((x) => (x > 2 ? x : null));

      const source = arrayToAsyncGenerator([1, 2, 3, 4]);
      const result = await processor.collect(source);

      expect(result).toEqual([3, 4]);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // EVENTS
  // ═══════════════════════════════════════════════════════════════════

  describe('Events', () => {
    it('should emit data events', async () => {
      const dataHandler = vi.fn();
      processor.on('data', dataHandler);

      const source = arrayToAsyncGenerator([1, 2, 3]);
      await processor.collect(source);

      expect(dataHandler).toHaveBeenCalledTimes(3);
    });

    it('should emit end event', async () => {
      const endHandler = vi.fn();
      processor.on('end', endHandler);

      const source = arrayToAsyncGenerator([1]);
      await processor.collect(source);

      expect(endHandler).toHaveBeenCalled();
    });

    it('should emit error event', async () => {
      const errorHandler = vi.fn();
      processor
        .use(() => {
          throw new Error('Transform error');
        })
        .on('error', errorHandler);

      const source = arrayToAsyncGenerator([1]);

      await expect(processor.collect(source)).rejects.toThrow();
      expect(errorHandler).toHaveBeenCalled();
    });

    it('should remove listener with off', async () => {
      const handler = vi.fn();
      processor.on('data', handler);
      processor.off('data', handler);

      const source = arrayToAsyncGenerator([1]);
      await processor.collect(source);

      expect(handler).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // REDUCE
  // ═══════════════════════════════════════════════════════════════════

  describe('reduce', () => {
    it('should reduce stream', async () => {
      const source = arrayToAsyncGenerator([1, 2, 3, 4]);
      const result = await processor.reduce(source, (acc, x) => acc + x, 0);

      expect(result).toBe(10);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // FIRST
  // ═══════════════════════════════════════════════════════════════════

  describe('first', () => {
    it('should get first item', async () => {
      const source = arrayToAsyncGenerator([1, 2, 3]);
      const result = await processor.first(source);

      expect(result).toBe(1);
    });

    it('should return null for empty stream', async () => {
      const source = arrayToAsyncGenerator([]);
      const result = await processor.first(source);

      expect(result).toBeNull();
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // TAKE
  // ═══════════════════════════════════════════════════════════════════

  describe('take', () => {
    it('should take n items', async () => {
      const source = arrayToAsyncGenerator([1, 2, 3, 4, 5]);
      const result = await processor.take(source, 3);

      expect(result).toEqual([1, 2, 3]);
    });

    it('should take all if n > length', async () => {
      const source = arrayToAsyncGenerator([1, 2]);
      const result = await processor.take(source, 5);

      expect(result).toEqual([1, 2]);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // SKIP
  // ═══════════════════════════════════════════════════════════════════

  describe('skip', () => {
    it('should skip n items', async () => {
      const source = arrayToAsyncGenerator([1, 2, 3, 4, 5]);
      const results = [];

      for await (const item of processor.skip(source, 2)) {
        results.push(item);
      }

      expect(results).toEqual([3, 4, 5]);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // ASYNC TRANSFORMS
  // ═══════════════════════════════════════════════════════════════════

  describe('Async Transforms', () => {
    it('should handle async transforms', async () => {
      processor.use(async (x) => {
        await new Promise((r) => setTimeout(r, 10));
        return x * 2;
      });

      const source = arrayToAsyncGenerator([1, 2, 3]);
      const result = await processor.collect(source);

      expect(result).toEqual([2, 4, 6]);
    });
  });
});

describe('Batch Processor Tests', () => {
  let batchProcessor;

  beforeEach(() => {
    batchProcessor = createBatchProcessor(3);
  });

  // ═══════════════════════════════════════════════════════════════════
  // BATCH
  // ═══════════════════════════════════════════════════════════════════

  describe('batch', () => {
    it('should batch items', async () => {
      const source = arrayToAsyncGenerator([1, 2, 3, 4, 5, 6, 7]);
      const batches = [];

      for await (const batch of batchProcessor.batch(source)) {
        batches.push(batch);
      }

      expect(batches).toEqual([[1, 2, 3], [4, 5, 6], [7]]);
    });

    it('should handle empty source', async () => {
      const source = arrayToAsyncGenerator([]);
      const batches = [];

      for await (const batch of batchProcessor.batch(source)) {
        batches.push(batch);
      }

      expect(batches).toEqual([]);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // PROCESS BATCHES
  // ═══════════════════════════════════════════════════════════════════

  describe('processBatches', () => {
    it('should process batches', async () => {
      const source = arrayToAsyncGenerator([1, 2, 3, 4, 5]);

      const result = await batchProcessor.processBatches(source, (batch) =>
        batch.map((x) => x * 2)
      );

      expect(result).toEqual([2, 4, 6, 8, 10]);
    });

    it('should handle async processor', async () => {
      const source = arrayToAsyncGenerator([1, 2, 3]);

      const result = await batchProcessor.processBatches(source, async (batch) => {
        await new Promise((r) => setTimeout(r, 10));
        return batch.map((x) => x + 1);
      });

      expect(result).toEqual([2, 3, 4]);
    });
  });
});
