/**
 * Scheduler Service Tests
 * Tests for task scheduling with cron-like patterns
 * 
 * @module tests/scheduler/scheduler-service.test.js
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Scheduler implementation
const createScheduler = () => {
    const jobs = new Map();
    const history = [];
    let isRunning = false;

    return {
        schedule: (name, pattern, handler, options = {}) => {
            const job = {
                id: `job-${jobs.size + 1}`,
                name,
                pattern,
                handler,
                enabled: options.enabled !== false,
                immediate: options.immediate || false,
                lastRun: null,
                nextRun: null,
                runCount: 0,
                errorCount: 0,
            };
            jobs.set(job.id, job);

            if (job.immediate && isRunning) {
                executeJob(job);
            }

            return job.id;
        },

        unschedule: (id) => {
            return jobs.delete(id);
        },

        getJob: (id) => {
            const job = jobs.get(id);
            return job ? { ...job } : null;
        },

        getJobs: () => [...jobs.values()].map(j => ({ ...j })),

        enable: (id) => {
            const job = jobs.get(id);
            if (job) {
                job.enabled = true;
                return true;
            }
            return false;
        },

        disable: (id) => {
            const job = jobs.get(id);
            if (job) {
                job.enabled = false;
                return true;
            }
            return false;
        },

        run: (id) => {
            const job = jobs.get(id);
            if (!job) throw new Error(`Job ${id} not found`);
            return executeJob(job);
        },

        start: () => {
            isRunning = true;
        },

        stop: () => {
            isRunning = false;
        },

        isRunning: () => isRunning,

        getHistory: (limit = 100) => history.slice(-limit),

        clearHistory: () => {
            history.length = 0;
        },

        getStats: () => ({
            totalJobs: jobs.size,
            enabledJobs: [...jobs.values()].filter(j => j.enabled).length,
            totalRuns: history.length,
            errorCount: [...jobs.values()].reduce((sum, j) => sum + j.errorCount, 0),
        }),
    };

    async function executeJob(job) {
        const startTime = Date.now();
        let success = true;
        let error = null;

        try {
            await job.handler();
            job.runCount++;
        } catch (e) {
            success = false;
            error = e.message;
            job.errorCount++;
        }

        job.lastRun = new Date().toISOString();

        history.push({
            jobId: job.id,
            jobName: job.name,
            timestamp: job.lastRun,
            duration: Date.now() - startTime,
            success,
            error,
        });

        return { success, error };
    }
};

describe('Scheduler Service Tests', () => {
    let scheduler;

    beforeEach(() => {
        scheduler = createScheduler();
    });

    // ═══════════════════════════════════════════════════════════════════
    // SCHEDULE JOBS
    // ═══════════════════════════════════════════════════════════════════

    describe('Schedule Jobs', () => {
        it('should schedule a job', () => {
            const handler = vi.fn();
            const id = scheduler.schedule('test', '*/5 * * * *', handler);

            expect(id).toBeDefined();
            expect(scheduler.getJobs().length).toBe(1);
        });

        it('should assign unique IDs', () => {
            const id1 = scheduler.schedule('job1', '* * * * *', vi.fn());
            const id2 = scheduler.schedule('job2', '* * * * *', vi.fn());

            expect(id1).not.toBe(id2);
        });

        it('should set default enabled to true', () => {
            const id = scheduler.schedule('test', '* * * * *', vi.fn());
            const job = scheduler.getJob(id);

            expect(job.enabled).toBe(true);
        });

        it('should allow disabled creation', () => {
            const id = scheduler.schedule('test', '* * * * *', vi.fn(), { enabled: false });
            const job = scheduler.getJob(id);

            expect(job.enabled).toBe(false);
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // UNSCHEDULE
    // ═══════════════════════════════════════════════════════════════════

    describe('Unschedule', () => {
        it('should remove job', () => {
            const id = scheduler.schedule('test', '* * * * *', vi.fn());

            const result = scheduler.unschedule(id);

            expect(result).toBe(true);
            expect(scheduler.getJobs().length).toBe(0);
        });

        it('should return false for unknown job', () => {
            expect(scheduler.unschedule('unknown')).toBe(false);
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // ENABLE / DISABLE
    // ═══════════════════════════════════════════════════════════════════

    describe('Enable / Disable', () => {
        it('should enable job', () => {
            const id = scheduler.schedule('test', '* * * * *', vi.fn(), { enabled: false });

            scheduler.enable(id);

            expect(scheduler.getJob(id).enabled).toBe(true);
        });

        it('should disable job', () => {
            const id = scheduler.schedule('test', '* * * * *', vi.fn());

            scheduler.disable(id);

            expect(scheduler.getJob(id).enabled).toBe(false);
        });

        it('should return false for unknown job', () => {
            expect(scheduler.enable('unknown')).toBe(false);
            expect(scheduler.disable('unknown')).toBe(false);
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // MANUAL RUN
    // ═══════════════════════════════════════════════════════════════════

    describe('Manual Run', () => {
        it('should run job manually', async () => {
            const handler = vi.fn();
            const id = scheduler.schedule('test', '* * * * *', handler);

            await scheduler.run(id);

            expect(handler).toHaveBeenCalled();
        });

        it('should update run count', async () => {
            const id = scheduler.schedule('test', '* * * * *', vi.fn());

            await scheduler.run(id);

            expect(scheduler.getJob(id).runCount).toBe(1);
        });

        it('should update lastRun', async () => {
            const id = scheduler.schedule('test', '* * * * *', vi.fn());

            await scheduler.run(id);

            expect(scheduler.getJob(id).lastRun).toBeDefined();
        });

        it('should throw for unknown job', async () => {
            await expect(scheduler.run('unknown')).rejects.toThrow();
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // ERROR HANDLING
    // ═══════════════════════════════════════════════════════════════════

    describe('Error Handling', () => {
        it('should track error count', async () => {
            const id = scheduler.schedule('test', '* * * * *', () => {
                throw new Error('Job failed');
            });

            await scheduler.run(id);

            expect(scheduler.getJob(id).errorCount).toBe(1);
        });

        it('should return error in result', async () => {
            const id = scheduler.schedule('test', '* * * * *', () => {
                throw new Error('Job failed');
            });

            const result = await scheduler.run(id);

            expect(result.success).toBe(false);
            expect(result.error).toBe('Job failed');
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // START / STOP
    // ═══════════════════════════════════════════════════════════════════

    describe('Start / Stop', () => {
        it('should start scheduler', () => {
            scheduler.start();
            expect(scheduler.isRunning()).toBe(true);
        });

        it('should stop scheduler', () => {
            scheduler.start();
            scheduler.stop();
            expect(scheduler.isRunning()).toBe(false);
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // HISTORY
    // ═══════════════════════════════════════════════════════════════════

    describe('History', () => {
        it('should record run history', async () => {
            const id = scheduler.schedule('test', '* * * * *', vi.fn());

            await scheduler.run(id);

            const history = scheduler.getHistory();
            expect(history.length).toBe(1);
            expect(history[0].jobId).toBe(id);
        });

        it('should include duration', async () => {
            const id = scheduler.schedule('test', '* * * * *', async () => {
                await new Promise(r => setTimeout(r, 10));
            });

            await scheduler.run(id);

            expect(scheduler.getHistory()[0].duration).toBeGreaterThan(0);
        });

        it('should clear history', async () => {
            const id = scheduler.schedule('test', '* * * * *', vi.fn());
            await scheduler.run(id);

            scheduler.clearHistory();

            expect(scheduler.getHistory().length).toBe(0);
        });

        it('should limit history', async () => {
            const id = scheduler.schedule('test', '* * * * *', vi.fn());

            for (let i = 0; i < 5; i++) {
                await scheduler.run(id);
            }

            expect(scheduler.getHistory(3).length).toBe(3);
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // STATS
    // ═══════════════════════════════════════════════════════════════════

    describe('Stats', () => {
        it('should return stats', async () => {
            scheduler.schedule('job1', '* * * * *', vi.fn());
            scheduler.schedule('job2', '* * * * *', vi.fn(), { enabled: false });

            const stats = scheduler.getStats();

            expect(stats.totalJobs).toBe(2);
            expect(stats.enabledJobs).toBe(1);
        });

        it('should count total runs', async () => {
            const id = scheduler.schedule('test', '* * * * *', vi.fn());
            await scheduler.run(id);
            await scheduler.run(id);

            expect(scheduler.getStats().totalRuns).toBe(2);
        });

        it('should count errors', async () => {
            const id = scheduler.schedule('test', '* * * * *', () => {
                throw new Error('Fail');
            });
            await scheduler.run(id);

            expect(scheduler.getStats().errorCount).toBe(1);
        });
    });
});
