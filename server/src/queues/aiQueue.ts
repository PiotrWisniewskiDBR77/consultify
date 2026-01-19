// @ts-nocheck
import { Queue } from 'bullmq';
import path from 'path';
import { fileURLToPath } from 'url';

import redisConfig from '../config/QueueConfig.js';
import { aiLogger } from '../services/ai/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let aiQueue;

// Create mock queue
const createMockQueue = () => ({
  add: async () => ({ id: 'mock-job-id', name: 'mock-job' }),
  getJob: async () => null,
  defaultJobOptions: {},
  on: () => {},
  close: async () => {},
});

if (process.env.MOCK_REDIS === 'true') {
  aiLogger.info('[Queue] Using Mock Queue for ai-tasks');
  aiQueue = createMockQueue();
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
