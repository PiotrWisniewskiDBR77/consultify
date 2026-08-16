/** @vitest-environment node */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const REDIS_URL = process.env.REDIS_URL ?? '';
const REAL_REDIS = process.env.RUN_REDIS_TESTS === '1' && REDIS_URL.startsWith('redis://');

describe.skipIf(!REAL_REDIS)('AGT-OPS-001 real BullMQ worker lifecycle', () => {
  let queue: import('bullmq').Queue;
  let queueEvents: import('bullmq').QueueEvents;
  let stopWorker: () => Promise<void>;

  beforeAll(async () => {
    process.env.MOCK_REDIS = 'false';
    process.env.ENABLE_AI_TASKS_WORKER = 'true';
    const { Queue, QueueEvents } = await import('bullmq');
    const redisUrl = new URL(REDIS_URL);
    const connection = {
      host: redisUrl.hostname,
      port: Number(redisUrl.port || 6379),
      password: redisUrl.password || undefined,
      maxRetriesPerRequest: null,
    };
    queue = new Queue('ai-tasks', { connection });
    queueEvents = new QueueEvents('ai-tasks', { connection });
    await queueEvents.waitUntilReady();
    const runtime = await import('../aiWorkerRuntime.js');
    stopWorker = runtime.stopAiTasksWorker;
    await runtime.startAiTasksWorker(process.env);
  }, 30_000);

  afterAll(async () => {
    await stopWorker?.();
    await queueEvents?.close();
    await queue?.obliterate({ force: true });
    await queue?.close();
  });

  it('consumes, retries, exhausts and retains a tenant-invalid background job', async () => {
    const job = await queue.add(
      'agent-background-test',
      {
        taskType: 'AGENT_BACKGROUND_TASK',
        userId: 'queue-user',
        payload: { organizationId: '', userId: 'queue-user', planId: 'plan' },
      },
      { attempts: 2, backoff: { type: 'fixed', delay: 10 }, removeOnFail: false }
    );
    await expect(job.waitUntilFinished(queueEvents, 15_000)).rejects.toThrow(
      'AGENT_BACKGROUND_TASK_TENANT_CONTEXT_INVALID'
    );
    const retained = await queue.getJob(job.id!);
    expect(retained).not.toBeNull();
    expect(await retained!.getState()).toBe('failed');
    expect(retained!.attemptsMade).toBe(2);
    expect(retained!.failedReason).toContain('AGENT_BACKGROUND_TASK_TENANT_CONTEXT_INVALID');
  }, 20_000);
});
