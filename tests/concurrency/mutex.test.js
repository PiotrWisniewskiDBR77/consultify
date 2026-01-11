/**
 * Mutex / Lock Tests
 * Tests for mutual exclusion and resource locking
 *
 * @module tests/concurrency/mutex.test.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mutex implementation
const createMutex = () => {
  let locked = false;
  const queue = [];

  return {
    acquire: () => {
      return new Promise((resolve) => {
        const tryAcquire = () => {
          if (!locked) {
            locked = true;
            resolve();
          } else {
            queue.push(tryAcquire);
          }
        };
        tryAcquire();
      });
    },

    release: () => {
      locked = false;
      const next = queue.shift();
      if (next) {
        next();
      }
    },

    isLocked: () => locked,

    runExclusive: async (fn) => {
      await self.acquire();
      try {
        return await fn();
      } finally {
        self.release();
      }
    },
  };

  const self = {
    acquire: () => {
      return new Promise((resolve) => {
        const tryAcquire = () => {
          if (!locked) {
            locked = true;
            resolve();
          } else {
            queue.push(tryAcquire);
          }
        };
        tryAcquire();
      });
    },
    release: () => {
      locked = false;
      const next = queue.shift();
      if (next) next();
    },
    isLocked: () => locked,
    runExclusive: async (fn) => {
      await self.acquire();
      try {
        return await fn();
      } finally {
        self.release();
      }
    },
    getQueueLength: () => queue.length,
  };

  return self;
};

// Semaphore implementation
const createSemaphore = (permits = 1) => {
  let available = permits;
  const queue = [];

  const self = {
    acquire: (count = 1) => {
      return new Promise((resolve) => {
        const tryAcquire = () => {
          if (available >= count) {
            available -= count;
            resolve();
          } else {
            queue.push({ tryAcquire, count });
          }
        };
        tryAcquire();
      });
    },

    release: (count = 1) => {
      available += count;

      while (queue.length > 0 && queue[0].count <= available) {
        const { tryAcquire } = queue.shift();
        tryAcquire();
      }
    },

    getAvailable: () => available,
    getQueueLength: () => queue.length,
  };

  return self;
};

// Read-Write Lock
const createRWLock = () => {
  let readers = 0;
  let writer = false;
  const readQueue = [];
  const writeQueue = [];

  const self = {
    acquireRead: () => {
      return new Promise((resolve) => {
        if (!writer && writeQueue.length === 0) {
          readers++;
          resolve();
        } else {
          readQueue.push(resolve);
        }
      });
    },

    releaseRead: () => {
      readers--;
      if (readers === 0 && writeQueue.length > 0) {
        writer = true;
        writeQueue.shift()();
      }
    },

    acquireWrite: () => {
      return new Promise((resolve) => {
        if (!writer && readers === 0) {
          writer = true;
          resolve();
        } else {
          writeQueue.push(resolve);
        }
      });
    },

    releaseWrite: () => {
      writer = false;

      // Prefer waiting readers
      while (readQueue.length > 0 && writeQueue.length === 0) {
        readers++;
        readQueue.shift()();
      }

      // If no readers waiting, allow writer
      if (readers === 0 && writeQueue.length > 0) {
        writer = true;
        writeQueue.shift()();
      }
    },

    getReaderCount: () => readers,
    hasWriter: () => writer,
  };

  return self;
};

describe('Mutex / Lock Tests', () => {
  // ═══════════════════════════════════════════════════════════════════
  // MUTEX
  // ═══════════════════════════════════════════════════════════════════

  describe('Mutex', () => {
    let mutex;

    beforeEach(() => {
      mutex = createMutex();
    });

    it('should acquire lock', async () => {
      await mutex.acquire();
      expect(mutex.isLocked()).toBe(true);
    });

    it('should release lock', async () => {
      await mutex.acquire();
      mutex.release();
      expect(mutex.isLocked()).toBe(false);
    });

    it('should queue concurrent acquisitions', async () => {
      const order = [];

      const task1 = async () => {
        await mutex.acquire();
        order.push(1);
        await new Promise((r) => setTimeout(r, 10));
        mutex.release();
      };

      const task2 = async () => {
        await mutex.acquire();
        order.push(2);
        mutex.release();
      };

      await Promise.all([task1(), task2()]);

      expect(order).toEqual([1, 2]);
    });

    it('should run exclusive', async () => {
      let counter = 0;

      const increment = async () => {
        return mutex.runExclusive(async () => {
          const current = counter;
          await new Promise((r) => setTimeout(r, 1));
          counter = current + 1;
          return counter;
        });
      };

      await Promise.all([increment(), increment(), increment()]);

      expect(counter).toBe(3);
    });

    it('should track queue length', async () => {
      await mutex.acquire();

      mutex.acquire(); // Will queue
      mutex.acquire(); // Will queue

      expect(mutex.getQueueLength()).toBe(2);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // SEMAPHORE
  // ═══════════════════════════════════════════════════════════════════

  describe('Semaphore', () => {
    let semaphore;

    beforeEach(() => {
      semaphore = createSemaphore(3);
    });

    it('should allow up to permit count', async () => {
      await semaphore.acquire();
      await semaphore.acquire();
      await semaphore.acquire();

      expect(semaphore.getAvailable()).toBe(0);
    });

    it('should queue when no permits', async () => {
      await semaphore.acquire();
      await semaphore.acquire();
      await semaphore.acquire();

      semaphore.acquire(); // Will queue

      expect(semaphore.getQueueLength()).toBe(1);
    });

    it('should release permit', async () => {
      await semaphore.acquire();
      semaphore.release();

      expect(semaphore.getAvailable()).toBe(3);
    });

    it('should acquire multiple permits', async () => {
      await semaphore.acquire(2);

      expect(semaphore.getAvailable()).toBe(1);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // READ-WRITE LOCK
  // ═══════════════════════════════════════════════════════════════════

  describe('Read-Write Lock', () => {
    let rwLock;

    beforeEach(() => {
      rwLock = createRWLock();
    });

    it('should allow multiple readers', async () => {
      await rwLock.acquireRead();
      await rwLock.acquireRead();
      await rwLock.acquireRead();

      expect(rwLock.getReaderCount()).toBe(3);
    });

    it('should allow single writer', async () => {
      await rwLock.acquireWrite();

      expect(rwLock.hasWriter()).toBe(true);
    });

    it('should block writer while readers active', async () => {
      await rwLock.acquireRead();

      let writerAcquired = false;
      rwLock.acquireWrite().then(() => {
        writerAcquired = true;
      });

      await new Promise((r) => setTimeout(r, 10));
      expect(writerAcquired).toBe(false);

      rwLock.releaseRead();
      await new Promise((r) => setTimeout(r, 10));
      expect(writerAcquired).toBe(true);
    });

    it('should block readers while writer active', async () => {
      await rwLock.acquireWrite();

      let readerAcquired = false;
      rwLock.acquireRead().then(() => {
        readerAcquired = true;
      });

      await new Promise((r) => setTimeout(r, 10));
      expect(readerAcquired).toBe(false);

      rwLock.releaseWrite();
      await new Promise((r) => setTimeout(r, 10));
      expect(readerAcquired).toBe(true);
    });
  });
});
