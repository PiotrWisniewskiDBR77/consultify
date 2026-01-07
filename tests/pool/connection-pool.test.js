/**
 * Connection Pool Tests
 * Tests for connection pool management
 * 
 * @module tests/pool/connection-pool.test.js
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Connection pool implementation
const createConnectionPool = (options = {}) => {
    const {
        create,
        destroy = () => { },
        validate = () => true,
        min = 0,
        max = 10,
        acquireTimeout = 5000,
        idleTimeout = 30000,
        maxWaitingClients = 100,
    } = options;

    const pool = [];
    const inUse = new Set();
    const waitQueue = [];
    let closed = false;

    const createConnection = async () => {
        const conn = await create();
        conn._poolCreatedAt = Date.now();
        conn._poolLastUsedAt = Date.now();
        return conn;
    };

    const destroyConnection = async (conn) => {
        const index = pool.indexOf(conn);
        if (index !== -1) pool.splice(index, 1);
        inUse.delete(conn);
        await destroy(conn);
    };

    return {
        acquire: async () => {
            if (closed) {
                throw new Error('Pool is closed');
            }

            // Try to get from pool
            while (pool.length > 0) {
                const conn = pool.pop();

                // Validate connection
                if (await validate(conn)) {
                    conn._poolLastUsedAt = Date.now();
                    inUse.add(conn);
                    return conn;
                } else {
                    await destroyConnection(conn);
                }
            }

            // Create new if under max
            if (inUse.size < max) {
                const conn = await createConnection();
                inUse.add(conn);
                return conn;
            }

            // Wait for available connection
            if (waitQueue.length >= maxWaitingClients) {
                throw new Error('Max waiting clients exceeded');
            }

            return new Promise((resolve, reject) => {
                const timer = setTimeout(() => {
                    const index = waitQueue.findIndex(w => w.resolve === resolve);
                    if (index !== -1) waitQueue.splice(index, 1);
                    reject(new Error('Acquire timeout'));
                }, acquireTimeout);

                waitQueue.push({ resolve, reject, timer });
            });
        },

        release: (conn) => {
            if (!inUse.has(conn)) {
                return false;
            }

            inUse.delete(conn);
            conn._poolLastUsedAt = Date.now();

            // Check waiting clients
            if (waitQueue.length > 0) {
                const { resolve, timer } = waitQueue.shift();
                clearTimeout(timer);
                inUse.add(conn);
                resolve(conn);
                return true;
            }

            // Return to pool
            pool.push(conn);
            return true;
        },

        destroy: async (conn) => {
            await destroyConnection(conn);
        },

        getStats: () => ({
            total: pool.length + inUse.size,
            available: pool.length,
            inUse: inUse.size,
            waiting: waitQueue.length,
            min,
            max,
        }),

        drain: async () => {
            // Wait for all in use to be released
            while (inUse.size > 0) {
                await new Promise(r => setTimeout(r, 100));
            }

            // Destroy all pooled connections
            while (pool.length > 0) {
                await destroyConnection(pool[0]);
            }
        },

        close: async () => {
            closed = true;

            // Reject all waiting
            for (const { reject, timer } of waitQueue) {
                clearTimeout(timer);
                reject(new Error('Pool is closing'));
            }
            waitQueue.length = 0;

            await this.drain();
        },

        isClosed: () => closed,

        size: () => pool.length + inUse.size,
    };
};

describe('Connection Pool Tests', () => {
    let pool;
    let connectionCounter;

    beforeEach(() => {
        connectionCounter = 0;
        pool = createConnectionPool({
            create: async () => ({ id: ++connectionCounter, connected: true }),
            destroy: async (conn) => { conn.connected = false; },
            validate: (conn) => conn.connected,
            min: 0,
            max: 3,
            acquireTimeout: 1000,
        });
    });

    afterEach(async () => {
        if (!pool.isClosed()) {
            await pool.close();
        }
    });

    // ═══════════════════════════════════════════════════════════════════
    // ACQUIRE
    // ═══════════════════════════════════════════════════════════════════

    describe('acquire', () => {
        it('should acquire new connection', async () => {
            const conn = await pool.acquire();

            expect(conn.id).toBe(1);
            expect(conn.connected).toBe(true);
        });

        it('should reuse released connection', async () => {
            const conn1 = await pool.acquire();
            pool.release(conn1);

            const conn2 = await pool.acquire();

            expect(conn2.id).toBe(conn1.id);
        });

        it('should respect max connections', async () => {
            const conn1 = await pool.acquire();
            const conn2 = await pool.acquire();
            const conn3 = await pool.acquire();

            expect(pool.getStats().inUse).toBe(3);

            // This should timeout
            const acquirePromise = pool.acquire();

            await expect(acquirePromise).rejects.toThrow('timeout');
        });

        it('should throw when pool closed', async () => {
            await pool.close();

            await expect(pool.acquire()).rejects.toThrow('closed');
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // RELEASE
    // ═══════════════════════════════════════════════════════════════════

    describe('release', () => {
        it('should release connection', async () => {
            const conn = await pool.acquire();

            expect(pool.getStats().inUse).toBe(1);

            pool.release(conn);

            expect(pool.getStats().inUse).toBe(0);
            expect(pool.getStats().available).toBe(1);
        });

        it('should give to waiting client', async () => {
            const conn1 = await pool.acquire();
            const conn2 = await pool.acquire();
            await pool.acquire();

            // Start waiting
            const waitPromise = pool.acquire();

            // Release one
            pool.release(conn1);

            const conn = await waitPromise;
            expect(conn.id).toBe(conn1.id);
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // DESTROY
    // ═══════════════════════════════════════════════════════════════════

    describe('destroy', () => {
        it('should destroy connection', async () => {
            const conn = await pool.acquire();

            await pool.destroy(conn);

            expect(conn.connected).toBe(false);
            expect(pool.size()).toBe(0);
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // GET STATS
    // ═══════════════════════════════════════════════════════════════════

    describe('getStats', () => {
        it('should return pool stats', async () => {
            const conn1 = await pool.acquire();
            const conn2 = await pool.acquire();
            pool.release(conn1);

            const stats = pool.getStats();

            expect(stats.total).toBe(2);
            expect(stats.available).toBe(1);
            expect(stats.inUse).toBe(1);
            expect(stats.max).toBe(3);
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // DRAIN
    // ═══════════════════════════════════════════════════════════════════

    describe('drain', () => {
        it('should drain all connections', async () => {
            const conn1 = await pool.acquire();
            const conn2 = await pool.acquire();

            pool.release(conn1);
            pool.release(conn2);

            await pool.drain();

            expect(pool.size()).toBe(0);
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // CLOSE
    // ═══════════════════════════════════════════════════════════════════

    describe('close', () => {
        it('should close pool', async () => {
            await pool.close();

            expect(pool.isClosed()).toBe(true);
        });

        it('should reject waiting clients on close', async () => {
            const conn1 = await pool.acquire();
            const conn2 = await pool.acquire();
            await pool.acquire();

            const waitPromise = pool.acquire();

            pool.release(conn1);
            pool.release(conn2);
            await pool.close();

            await expect(waitPromise).rejects.toThrow('closing');
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // VALIDATION
    // ═══════════════════════════════════════════════════════════════════

    describe('Validation', () => {
        it('should validate connection before reuse', async () => {
            const conn = await pool.acquire();
            conn.connected = false; // Invalidate
            pool.release(conn);

            const newConn = await pool.acquire();

            expect(newConn.id).not.toBe(conn.id); // Should be new connection
        });
    });
});
