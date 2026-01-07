/**
 * Concurrency Control Tests
 * Tests for locks, semaphores, and concurrent access
 * 
 * @module tests/concurrency/concurrency-control.test.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mutex (mutual exclusion)
const createMutex = () => {
    let locked = false;
    const queue = [];

    return {
        lock: () => {
            return new Promise((resolve) => {
                if (!locked) {
                    locked = true;
                    resolve();
                } else {
                    queue.push(resolve);
                }
            });
        },

        unlock: () => {
            if (queue.length > 0) {
                const next = queue.shift();
                next();
            } else {
                locked = false;
            }
        },

        isLocked: () => locked,

        getQueueLength: () => queue.length,

        withLock: async (fn) => {
            await this.lock();
            try {
                return await fn();
            } finally {
                this.unlock();
            }
        },
    };
};

// Semaphore
const createSemaphore = (permits) => {
    let available = permits;
    const queue = [];

    return {
        acquire: (count = 1) => {
            return new Promise((resolve) => {
                if (available >= count) {
                    available -= count;
                    resolve();
                } else {
                    queue.push({ count, resolve });
                }
            });
        },

        release: (count = 1) => {
            available += count;

            while (queue.length > 0 && queue[0].count <= available) {
                const next = queue.shift();
                available -= next.count;
                next.resolve();
            }
        },

        getAvailable: () => available,

        getWaiting: () => queue.length,

        tryAcquire: (count = 1) => {
            if (available >= count) {
                available -= count;
                return true;
            }
            return false;
        },
    };
};

// Read-Write Lock
const createReadWriteLock = () => {
    let readers = 0;
    let writer = false;
    const readQueue = [];
    const writeQueue = [];

    const processQueues = () => {
        if (!writer && writeQueue.length > 0 && readers === 0) {
            writer = true;
            const next = writeQueue.shift();
            next();
        } else if (!writer && readQueue.length > 0) {
            while (readQueue.length > 0) {
                readers++;
                const next = readQueue.shift();
                next();
            }
        }
    };

    return {
        readLock: () => {
            return new Promise((resolve) => {
                if (!writer && writeQueue.length === 0) {
                    readers++;
                    resolve();
                } else {
                    readQueue.push(resolve);
                }
            });
        },

        readUnlock: () => {
            readers--;
            if (readers === 0) {
                processQueues();
            }
        },

        writeLock: () => {
            return new Promise((resolve) => {
                if (!writer && readers === 0) {
                    writer = true;
                    resolve();
                } else {
                    writeQueue.push(resolve);
                }
            });
        },

        writeUnlock: () => {
            writer = false;
            processQueues();
        },

        getReaders: () => readers,

        hasWriter: () => writer,
    };
};

// Rate limiter (token bucket)
const createRateLimiter = (options = {}) => {
    const { tokensPerInterval = 10, interval = 1000, maxTokens = 10 } = options;

    let tokens = maxTokens;
    let lastRefill = Date.now();

    const refill = () => {
        const now = Date.now();
        const elapsed = now - lastRefill;
        const newTokens = Math.floor(elapsed / interval) * tokensPerInterval;

        if (newTokens > 0) {
            tokens = Math.min(maxTokens, tokens + newTokens);
            lastRefill = now;
        }
    };

    return {
        tryAcquire: (count = 1) => {
            refill();

            if (tokens >= count) {
                tokens -= count;
                return true;
            }
            return false;
        },

        acquire: async (count = 1) => {
            while (!this.tryAcquire(count)) {
                await new Promise(r => setTimeout(r, 10));
            }
        },

        getTokens: () => {
            refill();
            return tokens;
        },

        reset: () => {
            tokens = maxTokens;
            lastRefill = Date.now();
        },
    };
};

// Barrier (synchronization point)
const createBarrier = (parties) => {
    let waiting = 0;
    let generation = 0;
    const waiters = [];

    return {
        await: () => {
            const currentGen = generation;

            return new Promise((resolve) => {
                waiting++;

                if (waiting === parties) {
                    // All parties arrived
                    waiting = 0;
                    generation++;

                    // Release all
                    while (waiters.length > 0) {
                        waiters.shift()();
                    }
                    resolve();
                } else {
                    waiters.push(resolve);
                }
            });
        },

        getWaiting: () => waiting,

        getGeneration: () => generation,

        reset: () => {
            waiting = 0;
            generation++;
            waiters.length = 0;
        },
    };
};

describe('Mutex Tests', () => {
    let mutex;

    beforeEach(() => {
        mutex = createMutex();
    });

    it('should lock', async () => {
        await mutex.lock();

        expect(mutex.isLocked()).toBe(true);
    });

    it('should queue waiters', async () => {
        await mutex.lock();

        const waiting = mutex.lock();
        expect(mutex.getQueueLength()).toBe(1);

        mutex.unlock();
        await waiting;

        expect(mutex.isLocked()).toBe(true);
    });

    it('should withLock', async () => {
        let executed = false;

        await mutex.withLock(async () => {
            executed = true;
        });

        expect(executed).toBe(true);
        expect(mutex.isLocked()).toBe(false);
    });
});

describe('Semaphore Tests', () => {
    let semaphore;

    beforeEach(() => {
        semaphore = createSemaphore(3);
    });

    it('should acquire permits', async () => {
        await semaphore.acquire(2);

        expect(semaphore.getAvailable()).toBe(1);
    });

    it('should release permits', async () => {
        await semaphore.acquire(2);
        semaphore.release(1);

        expect(semaphore.getAvailable()).toBe(2);
    });

    it('should queue when no permits', async () => {
        await semaphore.acquire(3);

        let acquired = false;
        const waiting = semaphore.acquire().then(() => { acquired = true; });

        expect(semaphore.getWaiting()).toBe(1);

        semaphore.release();
        await waiting;

        expect(acquired).toBe(true);
    });

    it('should try acquire', () => {
        expect(semaphore.tryAcquire(2)).toBe(true);
        expect(semaphore.tryAcquire(2)).toBe(false);
    });
});

describe('ReadWriteLock Tests', () => {
    let rwLock;

    beforeEach(() => {
        rwLock = createReadWriteLock();
    });

    it('should allow multiple readers', async () => {
        await rwLock.readLock();
        await rwLock.readLock();

        expect(rwLock.getReaders()).toBe(2);
    });

    it('should block writers while reading', async () => {
        await rwLock.readLock();

        let writerAcquired = false;
        const writing = rwLock.writeLock().then(() => { writerAcquired = true; });

        await new Promise(r => setTimeout(r, 10));
        expect(writerAcquired).toBe(false);

        rwLock.readUnlock();
        await writing;

        expect(writerAcquired).toBe(true);
    });

    it('should block readers while writing', async () => {
        await rwLock.writeLock();

        expect(rwLock.hasWriter()).toBe(true);
    });
});

describe('Rate Limiter Tests', () => {
    let limiter;

    beforeEach(() => {
        limiter = createRateLimiter({ tokensPerInterval: 5, interval: 100, maxTokens: 5 });
    });

    it('should allow requests', () => {
        expect(limiter.tryAcquire()).toBe(true);
        expect(limiter.getTokens()).toBe(4);
    });

    it('should deny when exhausted', () => {
        for (let i = 0; i < 5; i++) {
            limiter.tryAcquire();
        }

        expect(limiter.tryAcquire()).toBe(false);
    });

    it('should refill tokens', async () => {
        for (let i = 0; i < 5; i++) {
            limiter.tryAcquire();
        }

        await new Promise(r => setTimeout(r, 120));

        expect(limiter.getTokens()).toBeGreaterThan(0);
    });
});

describe('Barrier Tests', () => {
    let barrier;

    beforeEach(() => {
        barrier = createBarrier(3);
    });

    it('should release all when parties meet', async () => {
        const results = [];

        const p1 = barrier.await().then(() => results.push(1));
        const p2 = barrier.await().then(() => results.push(2));
        const p3 = barrier.await().then(() => results.push(3));

        await Promise.all([p1, p2, p3]);

        expect(results).toHaveLength(3);
        expect(barrier.getGeneration()).toBe(1);
    });

    it('should track waiting', () => {
        barrier.await();
        barrier.await();

        expect(barrier.getWaiting()).toBe(2);
    });
});
