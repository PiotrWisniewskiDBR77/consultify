// @ts-nocheck
import { Worker } from 'bullmq';

import redisConfig from '../config/QueueConfig.js';
import logger from '../utils/Logger.js';
import AsyncJobProcessor from './asyncJobProcessor.js';

const workerName = 'ai-tasks-worker';

// Lazy load AiService to avoid top-level await issues
let AiService: any = null;
const getAiService = async () => {
  if (!AiService) {
    try {
      AiService = await import('../services/aiService.js');
    } catch (error) {
      logger.error(`[${workerName}] Failed to load AiService:`, error);
      throw new Error(
        `Failed to load AiService: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
  return AiService;
};

const processor = async (job) => {
  logger.info(`[${workerName}] Processing job ${job.id} of type ${job.name}`);
  const { taskType, payload, userId } = job.data;

  try {
    const aiService = await getAiService();
    let result;
    switch (taskType) {
      case 'generate_initiatives':
        result = await aiService.generateInitiatives(payload.diagnosisReport, userId);
        break;
      case 'build_roadmap':
        result = await aiService.buildRoadmap(payload.initiatives, userId);
        break;
      case 'simulate_economics':
        result = await aiService.simulateEconomics(
          payload.initiatives,
          payload.revenueBase,
          userId
        );
        break;
      case 'suggest_tasks':
        result = await aiService.suggestTasks(payload.initiativeContext, userId);
        break;
      case 'validate_initiative':
        result = await aiService.validateInitiative(payload.initiativeContext, userId);
        break;
      // Step 11: Async Job Types
      case 'EXECUTE_DECISION':
        result = await AsyncJobProcessor.processDecisionExecution(job);
        break;
      case 'ADVANCE_PLAYBOOK_STEP':
        result = await AsyncJobProcessor.processPlaybookAdvance(job);
        break;
      case 'RUN_EVAL_SUITE': {
        const { runEvalHarness } = await import('../services/ai/evalHarnessService.js');
        const { organizationId, datasetId, evalTypes, purpose, regressionBaseline, runBy } =
          payload;
        result = await runEvalHarness(organizationId, {
          datasetId,
          evalTypes: evalTypes || [
            'response_quality',
            'citation_coverage',
            'policy_compliance',
            'latency',
          ],
          purpose: purpose || 'chat',
          regressionBaseline,
        }, runBy);
        break;
      }
      case 'AGENT_BACKGROUND_TASK': {
        const { agentPlannerService } = await import('../services/ai/agentPlannerService.js');
        result = await agentPlannerService.executeBackgroundPlan(payload);
        break;
      }
      default:
        throw new Error(`Unknown task type: ${taskType}`);
    }

    logger.info(`[${workerName}] Job ${job.id} completed`);
    return result;
  } catch (error) {
    logger.error(`[${workerName}] Job ${job.id} failed:`, error);
    throw error;
  }
};

const initWorker = () => {
  if (process.env.MOCK_REDIS === 'true') {
    logger.info(`[BullMQ] MOCK_REDIS=true, skipping worker initialization.`);
    return null;
  }

  try {
    const worker = new Worker('ai-tasks', processor, redisConfig);

    worker.on('completed', (job) => {
      // Optional: Notify user via WebSocket or update DB status
      logger.info(`[BullMQ] Job ${job.id} completed successfully.`);
    });

    worker.on('failed', (job, err) => {
      logger.info(`[BullMQ] Job ${job.id} failed: ${err.message}`);
    });

    logger.info(`[BullMQ] Worker initialized for 'ai-tasks'`);
    return worker;
  } catch (err) {
    logger.error('[BullMQ] Failed to initialize worker:', err.message);
    return null;
  }
};

export { initWorker };

export default { initWorker };
