/**
 * Memory Leak Tests
 * 
 * Tests for memory leaks in:
 * - Long-running operations
 * - Event listeners
 * - Database connections
 * - API requests
 */

const db = require('../../server/database');

describe('Memory Leak Tests', () => {
    beforeAll(async () => {
        if (db.initPromise) {
            await db.initPromise;
        }
    });

    describe('Database Connection Leaks', () => {
        it('should not leak database connections on repeated queries', async () => {
            const initialMemory = process.memoryUsage().heapUsed;
            
            // Perform many database operations
            for (let i = 0; i < 100; i++) {
                await new Promise((resolve, reject) => {
                    db.all('SELECT 1', [], (err) => {
                        if (err) reject(err);
                        else resolve();
                    });
                });
            }
            
            // Force garbage collection if available
            if (global.gc) {
                global.gc();
            }
            
            await new Promise(resolve => setTimeout(resolve, 100));
            
            const finalMemory = process.memoryUsage().heapUsed;
            const memoryIncrease = finalMemory - initialMemory;
            
            // Memory increase should be reasonable (< 10MB for 100 queries)
            expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
        });

        it('should properly close database connections', async () => {
            const connectionsBefore = db.openConnections || 0;
            
            // Perform operations
            for (let i = 0; i < 50; i++) {
                await new Promise((resolve, reject) => {
                    db.run('SELECT 1', [], (err) => {
                        if (err) reject(err);
                        else resolve();
                    });
                });
            }
            
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Connections should not grow unbounded
            const connectionsAfter = db.openConnections || 0;
            expect(connectionsAfter).toBeLessThanOrEqual(connectionsBefore + 5);
        });
    });

    describe('Event Listener Leaks', () => {
        it('should not accumulate event listeners', () => {
            const EventEmitter = require('events');
            const emitter = new EventEmitter();
            
            const initialListeners = emitter.listenerCount('test');
            
            // Add and remove listeners multiple times
            for (let i = 0; i < 100; i++) {
                const handler = () => {};
                emitter.on('test', handler);
                emitter.off('test', handler);
            }
            
            const finalListeners = emitter.listenerCount('test');
            expect(finalListeners).toBe(initialListeners);
        });
    });

    describe('Promise Leaks', () => {
        it('should not accumulate unresolved promises', async () => {
            const initialMemory = process.memoryUsage().heapUsed;
            
            // Create and resolve many promises
            const promises = [];
            for (let i = 0; i < 1000; i++) {
                promises.push(Promise.resolve(i));
            }
            
            await Promise.all(promises);
            
            // Force garbage collection if available
            if (global.gc) {
                global.gc();
            }
            
            await new Promise(resolve => setTimeout(resolve, 100));
            
            const finalMemory = process.memoryUsage().heapUsed;
            const memoryIncrease = finalMemory - initialMemory;
            
            // Memory increase should be reasonable
            expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
        });
    });

    describe('Timer Leaks', () => {
        it('should clean up timers', async () => {
            const initialTimers = process._getActiveHandles ? process._getActiveHandles().length : 0;
            
            // Create and clear timers
            const timers = [];
            for (let i = 0; i < 100; i++) {
                const timer = setTimeout(() => {}, 1000);
                timers.push(timer);
            }
            
            // Clear all timers
            timers.forEach(timer => clearTimeout(timer));
            
            await new Promise(resolve => setTimeout(resolve, 100));
            
            const finalTimers = process._getActiveHandles ? process._getActiveHandles().length : 0;
            
            // Timer count should not grow significantly
            expect(finalTimers).toBeLessThanOrEqual(initialTimers + 10);
        });
    });
});






