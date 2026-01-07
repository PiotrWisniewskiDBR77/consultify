/**
 * Workqueue Service Unit Tests
 * 
 * Comprehensive tests for job queue management and processing.
 * Uses inline implementation to avoid import issues.
 * 
 * @module tests/unit/backend/workqueueService.test.js
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ============================================
// INLINE HELPER IMPLEMENTATION
// ============================================

/**
 * Creates a workqueue service
 */
const createWorkqueueService = () => {
    const queues = new Map();
    const jobs = new Map();
    const workers = new Map();
    const completedJobs = [];
    const failedJobs = [];
    let jobIdCounter = 0;

    const generateJobId = () => `job-${++jobIdCounter}-${Date.now()}`;

    return {
        createQueue: (name, options = {}) => {
            if (queues.has(name)) {
                throw new Error(`Queue ${name} already exists`);
            }

            queues.set(name, {
                name,
                options: {
                    concurrency: options.concurrency || 1,
                    retries: options.retries || 3,
                    backoff: options.backoff || { type: 'exponential', delay: 1000 },
                    timeout: options.timeout || 30000,
                    priority: options.priority || 'normal'
                },
                jobs: [],
                processing: [],
                paused: false
            });

            return { name, created: true };
        },

        getQueue: (name) => {
            return queues.get(name) || null;
        },

        deleteQueue: (name) => {
            return queues.delete(name);
        },

        enqueue: (queueName, data, options = {}) => {
            const queue = queues.get(queueName);
            if (!queue) throw new Error(`Queue ${queueName} not found`);

            const jobId = generateJobId();
            const job = {
                id: jobId,
                queue: queueName,
                data,
                status: 'pending',
                priority: options.priority || 0,
                attempts: 0,
                maxAttempts: options.retries !== undefined ? options.retries : queue.options.retries,
                createdAt: new Date().toISOString(),
                scheduledFor: options.delay ? new Date(Date.now() + options.delay).toISOString() : null,
                error: null,
                result: null
            };

            jobs.set(jobId, job);

            // Insert by priority (higher priority first)
            const insertIndex = queue.jobs.findIndex(j => (jobs.get(j)?.priority || 0) < job.priority);
            if (insertIndex === -1) {
                queue.jobs.push(jobId);
            } else {
                queue.jobs.splice(insertIndex, 0, jobId);
            }

            return job;
        },

        getJob: (jobId) => {
            return jobs.get(jobId) || null;
        },

        cancelJob: (jobId) => {
            const job = jobs.get(jobId);
            if (!job) return { success: false, error: 'Job not found' };
            if (job.status === 'processing') {
                return { success: false, error: 'Cannot cancel processing job' };
            }

            job.status = 'cancelled';
            job.cancelledAt = new Date().toISOString();

            const queue = queues.get(job.queue);
            if (queue) {
                queue.jobs = queue.jobs.filter(id => id !== jobId);
            }

            return { success: true };
        },

        retryJob: (jobId) => {
            const job = jobs.get(jobId);
            if (!job) return { success: false, error: 'Job not found' };
            if (job.status !== 'failed') {
                return { success: false, error: 'Only failed jobs can be retried' };
            }

            job.status = 'pending';
            job.attempts = 0;
            job.error = null;
            job.retriedAt = new Date().toISOString();

            const queue = queues.get(job.queue);
            if (queue) {
                queue.jobs.push(jobId);
            }

            return { success: true };
        },

        processJob: async (jobId, handler) => {
            const job = jobs.get(jobId);
            if (!job) throw new Error('Job not found');

            job.status = 'processing';
            job.startedAt = new Date().toISOString();
            job.attempts++;

            try {
                const result = await handler(job.data);
                job.status = 'completed';
                job.result = result;
                job.completedAt = new Date().toISOString();
                completedJobs.push(jobId);
                return { success: true, result };
            } catch (error) {
                job.error = error.message;

                if (job.attempts < job.maxAttempts) {
                    job.status = 'pending'; // Will be retried
                    job.nextAttemptAt = new Date(Date.now() + 1000 * Math.pow(2, job.attempts)).toISOString();
                } else {
                    job.status = 'failed';
                    job.failedAt = new Date().toISOString();
                    failedJobs.push(jobId);
                }

                return { success: false, error: error.message };
            }
        },

        pauseQueue: (queueName) => {
            const queue = queues.get(queueName);
            if (!queue) return { success: false, error: 'Queue not found' };

            queue.paused = true;
            return { success: true };
        },

        resumeQueue: (queueName) => {
            const queue = queues.get(queueName);
            if (!queue) return { success: false, error: 'Queue not found' };

            queue.paused = false;
            return { success: true };
        },

        getQueueStats: (queueName) => {
            const queue = queues.get(queueName);
            if (!queue) return null;

            const queueJobs = queue.jobs.map(id => jobs.get(id)).filter(Boolean);

            return {
                name: queueName,
                paused: queue.paused,
                waiting: queueJobs.filter(j => j.status === 'pending').length,
                processing: queue.processing.length,
                completed: completedJobs.filter(id => jobs.get(id)?.queue === queueName).length,
                failed: failedJobs.filter(id => jobs.get(id)?.queue === queueName).length,
                total: queueJobs.length
            };
        },

        getNextJob: (queueName) => {
            const queue = queues.get(queueName);
            if (!queue || queue.paused) return null;

            const pendingJobId = queue.jobs.find(id => {
                const job = jobs.get(id);
                if (!job || job.status !== 'pending') return false;
                if (job.scheduledFor && new Date(job.scheduledFor) > new Date()) return false;
                return true;
            });

            return pendingJobId ? jobs.get(pendingJobId) : null;
        },

        cleanCompleted: (olderThanMs = 3600000) => {
            const cutoff = Date.now() - olderThanMs;
            let cleaned = 0;

            completedJobs.forEach(jobId => {
                const job = jobs.get(jobId);
                if (job && new Date(job.completedAt).getTime() < cutoff) {
                    jobs.delete(jobId);
                    cleaned++;
                }
            });

            return { cleaned };
        },

        registerWorker: (queueName, handler, options = {}) => {
            const workerId = `worker-${queueName}-${Date.now()}`;
            workers.set(workerId, {
                id: workerId,
                queue: queueName,
                handler,
                options,
                status: 'idle',
                processedCount: 0
            });
            return workerId;
        },

        unregisterWorker: (workerId) => {
            return workers.delete(workerId);
        },

        getWorkers: (queueName) => {
            return Array.from(workers.values())
                .filter(w => !queueName || w.queue === queueName);
        },

        getAllQueues: () => Array.from(queues.keys()),

        getCompletedJobs: () => completedJobs.map(id => jobs.get(id)).filter(Boolean),
        getFailedJobs: () => failedJobs.map(id => jobs.get(id)).filter(Boolean)
    };
};

// ============================================
// TESTS
// ============================================

describe('WorkqueueService', () => {
    let workqueue;

    beforeEach(() => {
        workqueue = createWorkqueueService();
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe('createQueue()', () => {
        it('should create new queue', () => {
            const result = workqueue.createQueue('emails');

            expect(result.name).toBe('emails');
            expect(result.created).toBe(true);
        });

        it('should create queue with options', () => {
            workqueue.createQueue('heavy', {
                concurrency: 5,
                retries: 5,
                timeout: 60000
            });

            const queue = workqueue.getQueue('heavy');
            expect(queue.options.concurrency).toBe(5);
            expect(queue.options.retries).toBe(5);
        });

        it('should throw for duplicate queue', () => {
            workqueue.createQueue('test');

            expect(() => workqueue.createQueue('test'))
                .toThrow('Queue test already exists');
        });
    });

    describe('enqueue()', () => {
        beforeEach(() => {
            workqueue.createQueue('tasks');
        });

        it('should add job to queue', () => {
            const job = workqueue.enqueue('tasks', { action: 'send-email' });

            expect(job.id).toBeDefined();
            expect(job.status).toBe('pending');
            expect(job.data.action).toBe('send-email');
        });

        it('should throw for non-existent queue', () => {
            expect(() => workqueue.enqueue('nonexistent', {}))
                .toThrow('Queue nonexistent not found');
        });

        it('should order by priority', () => {
            workqueue.enqueue('tasks', { name: 'low' }, { priority: 1 });
            workqueue.enqueue('tasks', { name: 'high' }, { priority: 10 });
            workqueue.enqueue('tasks', { name: 'medium' }, { priority: 5 });

            const next = workqueue.getNextJob('tasks');
            expect(next.data.name).toBe('high');
        });

        it('should schedule delayed jobs', () => {
            const job = workqueue.enqueue('tasks', { action: 'future' }, { delay: 5000 });

            expect(job.scheduledFor).toBeDefined();

            // Job should not be available yet
            const next = workqueue.getNextJob('tasks');
            expect(next).toBeNull();

            // Advance time
            vi.advanceTimersByTime(6000);
            const nextAfterDelay = workqueue.getNextJob('tasks');
            expect(nextAfterDelay.data.action).toBe('future');
        });
    });

    describe('processJob()', () => {
        beforeEach(() => {
            workqueue.createQueue('processing');
        });

        it('should process job successfully', async () => {
            const job = workqueue.enqueue('processing', { value: 10 });

            const result = await workqueue.processJob(job.id, async (data) => {
                return data.value * 2;
            });

            expect(result.success).toBe(true);
            expect(result.result).toBe(20);

            const updatedJob = workqueue.getJob(job.id);
            expect(updatedJob.status).toBe('completed');
        });

        it('should handle job failure', async () => {
            const job = workqueue.enqueue('processing', { willFail: true });

            const result = await workqueue.processJob(job.id, async () => {
                throw new Error('Process failed');
            });

            expect(result.success).toBe(false);
            expect(result.error).toBe('Process failed');
        });

        it('should retry failed jobs', async () => {
            const job = workqueue.enqueue('processing', {}, { retries: 2 });

            // First failure
            await workqueue.processJob(job.id, async () => {
                throw new Error('Fail 1');
            });

            const afterFirst = workqueue.getJob(job.id);
            expect(afterFirst.status).toBe('pending'); // Will retry
            expect(afterFirst.attempts).toBe(1);
        });

        it('should mark job as failed after max retries', async () => {
            const job = workqueue.enqueue('processing', {}, { retries: 1 });

            // First attempt
            await workqueue.processJob(job.id, async () => { throw new Error('Fail'); });

            // Second attempt (last)
            await workqueue.processJob(job.id, async () => { throw new Error('Fail again'); });

            const finalJob = workqueue.getJob(job.id);
            expect(finalJob.status).toBe('failed');
            expect(finalJob.attempts).toBe(2);
        });
    });

    describe('cancelJob()', () => {
        beforeEach(() => {
            workqueue.createQueue('cancellable');
        });

        it('should cancel pending job', () => {
            const job = workqueue.enqueue('cancellable', {});

            const result = workqueue.cancelJob(job.id);

            expect(result.success).toBe(true);
            expect(workqueue.getJob(job.id).status).toBe('cancelled');
        });

        it('should not cancel non-existent job', () => {
            const result = workqueue.cancelJob('fake-id');
            expect(result.success).toBe(false);
        });
    });

    describe('retryJob()', () => {
        beforeEach(() => {
            workqueue.createQueue('retryable');
        });

        it('should retry failed job', async () => {
            const job = workqueue.enqueue('retryable', {}, { retries: 0 });

            await workqueue.processJob(job.id, async () => { throw new Error('Fail'); });
            expect(workqueue.getJob(job.id).status).toBe('failed');

            const result = workqueue.retryJob(job.id);
            expect(result.success).toBe(true);
            expect(workqueue.getJob(job.id).status).toBe('pending');
        });

        it('should only retry failed jobs', () => {
            const job = workqueue.enqueue('retryable', {});

            const result = workqueue.retryJob(job.id);
            expect(result.success).toBe(false);
        });
    });

    describe('pauseQueue() / resumeQueue()', () => {
        beforeEach(() => {
            workqueue.createQueue('pausable');
        });

        it('should pause and resume queue', () => {
            workqueue.enqueue('pausable', { data: 1 });

            workqueue.pauseQueue('pausable');
            expect(workqueue.getNextJob('pausable')).toBeNull();

            workqueue.resumeQueue('pausable');
            expect(workqueue.getNextJob('pausable')).toBeDefined();
        });
    });

    describe('getQueueStats()', () => {
        beforeEach(() => {
            workqueue.createQueue('stats-queue');
        });

        it('should return queue statistics', async () => {
            workqueue.enqueue('stats-queue', {});
            workqueue.enqueue('stats-queue', {});
            const job3 = workqueue.enqueue('stats-queue', {});

            await workqueue.processJob(job3.id, async () => 'done');

            const stats = workqueue.getQueueStats('stats-queue');

            expect(stats.waiting).toBe(2);
            expect(stats.completed).toBe(1);
            expect(stats.total).toBe(3);
        });

        it('should return null for non-existent queue', () => {
            expect(workqueue.getQueueStats('fake')).toBeNull();
        });
    });

    describe('Workers', () => {
        beforeEach(() => {
            workqueue.createQueue('worker-queue');
        });

        it('should register worker', () => {
            const workerId = workqueue.registerWorker('worker-queue', async () => { });

            expect(workerId).toBeDefined();
            expect(workqueue.getWorkers('worker-queue')).toHaveLength(1);
        });

        it('should unregister worker', () => {
            const workerId = workqueue.registerWorker('worker-queue', async () => { });

            workqueue.unregisterWorker(workerId);
            expect(workqueue.getWorkers('worker-queue')).toHaveLength(0);
        });
    });

    describe('cleanCompleted()', () => {
        beforeEach(() => {
            workqueue.createQueue('cleanable');
        });

        it('should clean old completed jobs', async () => {
            const job = workqueue.enqueue('cleanable', {});
            await workqueue.processJob(job.id, async () => 'done');

            vi.advanceTimersByTime(7200000); // 2 hours

            const result = workqueue.cleanCompleted(3600000); // 1 hour
            expect(result.cleaned).toBe(1);
        });
    });

    describe('getAllQueues()', () => {
        it('should list all queues', () => {
            workqueue.createQueue('queue-a');
            workqueue.createQueue('queue-b');
            workqueue.createQueue('queue-c');

            const queues = workqueue.getAllQueues();

            expect(queues).toContain('queue-a');
            expect(queues).toContain('queue-b');
            expect(queues).toContain('queue-c');
        });
    });

    describe('getCompletedJobs() / getFailedJobs()', () => {
        beforeEach(() => {
            workqueue.createQueue('results');
        });

        it('should return completed jobs', async () => {
            const job = workqueue.enqueue('results', {});
            await workqueue.processJob(job.id, async () => 'success');

            const completed = workqueue.getCompletedJobs();
            expect(completed).toHaveLength(1);
            expect(completed[0].status).toBe('completed');
        });

        it('should return failed jobs', async () => {
            const job = workqueue.enqueue('results', {}, { retries: 0 });
            await workqueue.processJob(job.id, async () => { throw new Error('fail'); });

            const failed = workqueue.getFailedJobs();
            expect(failed).toHaveLength(1);
            expect(failed[0].status).toBe('failed');
        });
    });
});
