const { Queue } = require('bullmq');
const redisConfig = require('../config/queue.config');

let aiQueue;

if (process.env.MOCK_REDIS === 'true') {
    console.log('[Queue] Using Mock Queue for ai-tasks');
    aiQueue = {
        add: async () => ({ id: 'mock-job-id', name: 'mock-job' }),
        getJob: async () => null,
        defaultJobOptions: {},
        on: () => { },
        close: async () => { },
    };
} else {
    aiQueue = new Queue('ai-tasks', redisConfig);

    // Add default job options
    aiQueue.defaultJobOptions = {
        attempts: 3,
        backoff: {
            type: 'exponential',
            delay: 1000,
        },
        removeOnComplete: true, // Keep DB clean
        removeOnFail: false // Keep for debugging
    };
}

module.exports = aiQueue;
