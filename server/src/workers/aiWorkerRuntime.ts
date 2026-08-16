import type { Worker } from 'bullmq';

import logger from '../utils/Logger.js';

export const AI_TASKS_WORKER_FLAG = 'ENABLE_AI_TASKS_WORKER';

let activeWorker: Worker | null = null;

export async function startAiTasksWorker(
  env: NodeJS.ProcessEnv = process.env
): Promise<Worker | null> {
  if (env[AI_TASKS_WORKER_FLAG] !== 'true') {
    logger.info(
      `[BullMQ] ai-tasks worker disabled; set ${AI_TASKS_WORKER_FLAG}=true after owner approval`
    );
    return null;
  }
  if (env.MOCK_REDIS === 'true') throw new Error('AI_TASKS_WORKER_REQUIRES_REAL_REDIS');
  if (activeWorker) return activeWorker;
  const { initWorker } = await import('./aiWorker.js');
  const worker = initWorker();
  if (!worker) throw new Error('AI_TASKS_WORKER_INITIALIZATION_FAILED');
  activeWorker = worker;
  logger.info('[BullMQ] ai-tasks worker runtime started', { queue: 'ai-tasks' });
  return activeWorker;
}

export async function stopAiTasksWorker(): Promise<void> {
  const worker = activeWorker;
  activeWorker = null;
  if (!worker) return;
  await worker.close();
  logger.info('[BullMQ] ai-tasks worker runtime stopped', { queue: 'ai-tasks' });
}

export function isAiTasksWorkerRunning(): boolean {
  return activeWorker !== null;
}
