// @ts-nocheck
import { Queue } from 'bullmq';
import path from 'path';
import { fileURLToPath } from 'url';

import { aiLogger } from '../services/ai/logger.js';
import { AppError } from '../utils/ErrorHandler.js';

let redisConfig;
try {
  redisConfig = (await import('../config/QueueConfig.js')).default;
} catch {
  redisConfig = (await import('../config/QueueConfig.ts')).default;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let aiQueue;

const createUnavailableQueue = (reason) => ({
  isUnavailable: true,
  add: async () => {
    throw new AppError(`AI queue unavailable: ${reason}`, 503, 'FEATURE_UNAVAILABLE', { reason });
  },
  getJob: async () => {
    throw new AppError(`AI queue unavailable: ${reason}`, 503, 'FEATURE_UNAVAILABLE', { reason });
  },
  defaultJobOptions: {},
  on: () => {},
  close: async () => {},
});

if (process.env.MOCK_REDIS === 'true') {
  aiLogger.warn('[Queue] Mock queue disabled; AI tasks will be unavailable');
  aiQueue = createUnavailableQueue('MOCK_REDIS=true');
} else {
  // Add default job options to redisConfig
  const queueConfig = {
    ...redisConfig,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
      removeOnComplete: true, // Keep DB clean
      removeOnFail: false, // Keep for debugging
    },
  };

  aiQueue = new Queue('ai-tasks', queueConfig);
}

export default aiQueue;
