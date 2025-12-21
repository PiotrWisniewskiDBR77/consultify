// Try to load BullMQ, fallback to mock if not available
let Queue;
let bullmqAvailable = false;

try {
    ({ Queue } = require('bullmq'));
    bullmqAvailable = true;
} catch (err) {
    console.log('[Queue] BullMQ not available, using mock queue');
    bullmqAvailable = false;
}

const redisConfig = require('../config/queue.config');

let aiQueue;

// Create mock queue
const createMockQueue = () => ({
    add: async () => ({ id: 'mock-job-id', name: 'mock-job' }),
    getJob: async () => null,
    defaultJobOptions: {},
    on: () => { },
    close: async () => { },
});

if (process.env.MOCK_REDIS === 'true' || !bullmqAvailable) {
    console.log('[Queue] Using Mock Queue for ai-tasks');
    aiQueue = createMockQueue();
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
