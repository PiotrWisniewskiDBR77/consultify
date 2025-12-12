const { Worker } = require('bullmq');
const redisConfig = require('../config/queue.config');
const AiService = require('../services/aiService');

const workerName = 'ai-tasks-worker';

const processor = async (job) => {
    console.log(`[${workerName}] Processing job ${job.id} of type ${job.name}`);
    const { taskType, payload, userId } = job.data;

    try {
        let result;
        switch (taskType) {
            case 'generate_initiatives':
                result = await AiService.generateInitiatives(payload.diagnosisReport, userId);
                break;
            case 'build_roadmap':
                result = await AiService.buildRoadmap(payload.initiatives, userId);
                break;
            case 'simulate_economics':
                result = await AiService.simulateEconomics(payload.initiatives, payload.revenueBase, userId);
                break;
            case 'suggest_tasks':
                result = await AiService.suggestTasks(payload.initiativeContext, userId);
                break;
            case 'validate_initiative':
                result = await AiService.validateInitiative(payload.initiativeContext, userId);
                break;
            default:
                throw new Error(`Unknown task type: ${taskType}`);
        }

        console.log(`[${workerName}] Job ${job.id} completed`);
        return result;

    } catch (error) {
        console.error(`[${workerName}] Job ${job.id} failed:`, error);
        throw error;
    }
};

const initWorker = () => {
    if (process.env.MOCK_REDIS === 'true') {
        console.log(`[BullMQ] MOCK_REDIS=true, skipping worker initialization.`);
        return null;
    }

    try {
        const worker = new Worker('ai-tasks', processor, redisConfig);

        worker.on('completed', (job) => {
            // Optional: Notify user via WebSocket or update DB status
            console.log(`[BullMQ] Job ${job.id} completed successfully.`);
        });

        worker.on('failed', (job, err) => {
            console.log(`[BullMQ] Job ${job.id} failed: ${err.message}`);
        });

        console.log(`[BullMQ] Worker initialized for 'ai-tasks'`);
        return worker;
    } catch (err) {
        console.error('[BullMQ] Failed to initialize worker:', err.message);
        return null;
    }
};

module.exports = { initWorker };
