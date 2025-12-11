const { Queue } = require('bullmq');
const redisConfig = require('../config/queue.config');

const aiQueue = new Queue('ai-tasks', redisConfig);

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

module.exports = aiQueue;
