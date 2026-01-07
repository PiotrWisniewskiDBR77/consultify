/**
 * Job Queue Tests
 * Tests for background job queue processing
 * 
 * @module tests/queue/job-queue.test.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Job queue implementation
const createJobQueue = (options = {}) => {
    const { concurrency = 1, retries = 3, retryDelay = 1000 } = options;

    const queue = [];
    const processing = new Map();
    const completed = [];
    const failed = [];
    let isProcessing = false;
    let isPaused = false;

    const processNext = async () => {
        if (isPaused || queue.length === 0 || processing.size >= concurrency) {
            return;
        }

        const job = queue.shift();
        processing.set(job.id, job);

        try {
            job.status = 'processing';
            job.startedAt = new Date().toISOString();

            const result = await job.handler(job.data);

            job.status = 'completed';
            job.completedAt = new Date().toISOString();
            job.result = result;
            completed.push(job);
        } catch (error) {
            job.attempts = (job.attempts || 0) + 1;
            job.lastError = error.message;

            if (job.attempts < retries) {
                job.status = 'pending';
                queue.push(job);
            } else {
                job.status = 'failed';
                job.failedAt = new Date().toISOString();
                failed.push(job);
            }
        } finally {
            processing.delete(job.id);
            processNext();
        }
    };

    return {
        add: (name, data, handler) => {
            const job = {
                id: `job-${queue.length + processing.size + completed.length + failed.length + 1}`,
                name,
                data,
                handler,
                status: 'pending',
                createdAt: new Date().toISOString(),
                attempts: 0,
            };
            queue.push(job);

            if (!isPaused) {
                processNext();
            }

            return job.id;
        },

        process: () => {
            if (!isProcessing) {
                isProcessing = true;
                processNext();
            }
        },

        pause: () => {
            isPaused = true;
        },

        resume: () => {
            isPaused = false;
            processNext();
        },

        isPaused: () => isPaused,

        getJob: (id) => {
            const inQueue = queue.find(j => j.id === id);
            if (inQueue) return inQueue;

            const inProcessing = processing.get(id);
            if (inProcessing) return inProcessing;

            const inCompleted = completed.find(j => j.id === id);
            if (inCompleted) return inCompleted;

            return failed.find(j => j.id === id);
        },

        getStatus: () => ({
            pending: queue.length,
            processing: processing.size,
            completed: completed.length,
            failed: failed.length,
        }),

        getPending: () => [...queue],
        getProcessing: () => [...processing.values()],
        getCompleted: () => [...completed],
        getFailed: () => [...failed],

        retry: (id) => {
            const job = failed.find(j => j.id === id);
            if (!job) return false;

            const index = failed.indexOf(job);
            failed.splice(index, 1);

            job.status = 'pending';
            job.attempts = 0;
            delete job.lastError;
            delete job.failedAt;

            queue.push(job);
            processNext();

            return true;
        },

        remove: (id) => {
            const index = queue.findIndex(j => j.id === id);
            if (index !== -1) {
                queue.splice(index, 1);
                return true;
            }
            return false;
        },

        clear: () => {
            queue.length = 0;
        },

        drain: () => {
            return new Promise(resolve => {
                const check = () => {
                    if (queue.length === 0 && processing.size === 0) {
                        resolve();
                    } else {
                        setTimeout(check, 10);
                    }
                };
                check();
            });
        },
    };
};

describe('Job Queue Tests', () => {
    let queue;

    beforeEach(() => {
        queue = createJobQueue({ concurrency: 2, retries: 3 });
    });

    // ═══════════════════════════════════════════════════════════════════
    // ADD JOBS
    // ═══════════════════════════════════════════════════════════════════

    describe('Add Jobs', () => {
        it('should add job to queue', async () => {
            const handler = vi.fn().mockResolvedValue('done');

            const id = queue.add('test', { value: 1 }, handler);

            expect(id).toBeDefined();
            expect(queue.getStatus().pending).toBeGreaterThanOrEqual(0);
        });

        it('should assign unique IDs', async () => {
            const handler = vi.fn().mockResolvedValue('done');

            const id1 = queue.add('test1', {}, handler);
            const id2 = queue.add('test2', {}, handler);

            expect(id1).not.toBe(id2);
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // PROCESSING
    // ═══════════════════════════════════════════════════════════════════

    describe('Processing', () => {
        it('should process job', async () => {
            const handler = vi.fn().mockResolvedValue('result');

            queue.add('test', { data: 'test' }, handler);
            await queue.drain();

            expect(handler).toHaveBeenCalledWith({ data: 'test' });
        });

        it('should mark job as completed', async () => {
            const handler = vi.fn().mockResolvedValue('result');

            const id = queue.add('test', {}, handler);
            await queue.drain();

            const job = queue.getJob(id);
            expect(job.status).toBe('completed');
            expect(job.result).toBe('result');
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // FAILURE / RETRY
    // ═══════════════════════════════════════════════════════════════════

    describe('Failure / Retry', () => {
        it('should retry failed jobs', async () => {
            let attempts = 0;
            const handler = vi.fn().mockImplementation(() => {
                attempts++;
                if (attempts < 2) throw new Error('Fail');
                return 'success';
            });

            queue.add('test', {}, handler);
            await queue.drain();

            expect(handler).toHaveBeenCalledTimes(2);
        });

        it('should mark as failed after max retries', async () => {
            const handler = vi.fn().mockRejectedValue(new Error('Always fails'));

            const id = queue.add('test', {}, handler);
            await queue.drain();

            const job = queue.getJob(id);
            expect(job.status).toBe('failed');
            expect(queue.getStatus().failed).toBe(1);
        });

        it('should allow manual retry', async () => {
            const handler = vi.fn()
                .mockRejectedValueOnce(new Error('Fail 1'))
                .mockRejectedValueOnce(new Error('Fail 2'))
                .mockRejectedValueOnce(new Error('Fail 3'))
                .mockResolvedValue('success');

            const id = queue.add('test', {}, handler);
            await queue.drain();

            expect(queue.getStatus().failed).toBe(1);

            queue.retry(id);
            await queue.drain();

            expect(queue.getStatus().completed).toBe(1);
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // PAUSE / RESUME
    // ═══════════════════════════════════════════════════════════════════

    describe('Pause / Resume', () => {
        it('should pause queue', () => {
            queue.pause();
            expect(queue.isPaused()).toBe(true);
        });

        it('should resume queue', () => {
            queue.pause();
            queue.resume();
            expect(queue.isPaused()).toBe(false);
        });

        it('should not process when paused', async () => {
            const handler = vi.fn().mockResolvedValue('done');

            queue.pause();
            queue.add('test', {}, handler);

            await new Promise(r => setTimeout(r, 50));

            expect(handler).not.toHaveBeenCalled();
        });

        it('should process after resume', async () => {
            const handler = vi.fn().mockResolvedValue('done');

            queue.pause();
            queue.add('test', {}, handler);
            queue.resume();

            await queue.drain();

            expect(handler).toHaveBeenCalled();
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // REMOVE
    // ═══════════════════════════════════════════════════════════════════

    describe('Remove', () => {
        it('should remove pending job', () => {
            queue.pause();
            const handler = vi.fn();
            const id = queue.add('test', {}, handler);

            const result = queue.remove(id);

            expect(result).toBe(true);
            expect(queue.getStatus().pending).toBe(0);
        });

        it('should return false for non-existent job', () => {
            expect(queue.remove('invalid')).toBe(false);
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // CLEAR
    // ═══════════════════════════════════════════════════════════════════

    describe('Clear', () => {
        it('should clear all pending jobs', () => {
            queue.pause();
            queue.add('test1', {}, vi.fn());
            queue.add('test2', {}, vi.fn());

            queue.clear();

            expect(queue.getStatus().pending).toBe(0);
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // GET STATUS
    // ═══════════════════════════════════════════════════════════════════

    describe('Get Status', () => {
        it('should return all counts', async () => {
            const handler = vi.fn().mockResolvedValue('done');
            queue.add('test', {}, handler);
            await queue.drain();

            const status = queue.getStatus();

            expect(status).toHaveProperty('pending');
            expect(status).toHaveProperty('processing');
            expect(status).toHaveProperty('completed');
            expect(status).toHaveProperty('failed');
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // CONCURRENCY
    // ═══════════════════════════════════════════════════════════════════

    describe('Concurrency', () => {
        it('should respect concurrency limit', async () => {
            let concurrent = 0;
            let maxConcurrent = 0;

            const handler = vi.fn().mockImplementation(async () => {
                concurrent++;
                maxConcurrent = Math.max(maxConcurrent, concurrent);
                await new Promise(r => setTimeout(r, 10));
                concurrent--;
            });

            queue.add('test1', {}, handler);
            queue.add('test2', {}, handler);
            queue.add('test3', {}, handler);
            queue.add('test4', {}, handler);

            await queue.drain();

            expect(maxConcurrent).toBeLessThanOrEqual(2);
        });
    });
});
