// @ts-nocheck
import { Worker } from 'bullmq';
import os from 'node:os';

import redisConfig from '../config/QueueConfig.js';
import logger from '../utils/Logger.js';

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

export const processAiTaskJob = async (job) => {
  logger.info(`[${workerName}] Processing job ${job.id} of type ${job.name}`);
  const { taskType, payload, userId } = job.data;

  try {
    let result;
    switch (taskType) {
      case 'generate_initiatives': {
        const aiService = await getAiService();
        result = await aiService.generateInitiatives(payload.diagnosisReport, userId);
        break;
      }
      case 'build_roadmap': {
        const aiService = await getAiService();
        result = await aiService.buildRoadmap(payload.initiatives, userId);
        break;
      }
      case 'simulate_economics': {
        const aiService = await getAiService();
        result = await aiService.simulateEconomics(
          payload.initiatives,
          payload.revenueBase,
          userId
        );
        break;
      }
      case 'suggest_tasks': {
        const aiService = await getAiService();
        result = await aiService.suggestTasks(payload.initiativeContext, userId);
        break;
      }
      case 'validate_initiative': {
        const aiService = await getAiService();
        result = await aiService.validateInitiative(payload.initiativeContext, userId);
        break;
      }
      // Step 11: Async Job Types
      case 'EXECUTE_DECISION': {
        const { default: AsyncJobProcessor } = await import('./asyncJobProcessor.js');
        result = await AsyncJobProcessor.processDecisionExecution(job);
        break;
      }
      case 'ADVANCE_PLAYBOOK_STEP': {
        const { default: AsyncJobProcessor } = await import('./asyncJobProcessor.js');
        result = await AsyncJobProcessor.processPlaybookAdvance(job);
        break;
      }
      case 'RUN_EVAL_SUITE': {
        const { runEvalHarness } = await import('../services/ai/evalHarnessService.js');
        const { organizationId, datasetId, evalTypes, purpose, regressionBaseline, runBy } =
          payload;
        result = await runEvalHarness(
          organizationId,
          {
            datasetId,
            evalTypes: evalTypes || [
              'response_quality',
              'citation_coverage',
              'policy_compliance',
              'latency',
            ],
            purpose: purpose || 'chat',
            regressionBaseline,
          },
          runBy
        );
        break;
      }
      case 'AGENT_BACKGROUND_TASK': {
        const organizationId = String(payload?.organizationId || '').trim();
        const payloadUserId = String(payload?.userId || '').trim();
        const receiptId = String(payload?.receiptId || '').trim();
        const payloadDigest = String(payload?.payloadDigest || '').trim();
        if (!organizationId || !payloadUserId || payloadUserId !== String(userId || '') || !receiptId || !payloadDigest) {
          throw new Error('AGENT_BACKGROUND_TASK_TENANT_CONTEXT_INVALID');
        }
        const workerId = `${os.hostname()}-${process.pid}`;
        const { claimAgentTask, finishAgentTask } = await import('../services/ai/agentTaskDispatchService.js');
        const claim = await claimAgentTask({ planId: String(payload.planId || ''), organizationId,
          userId: payloadUserId, dispatchKey: String(payload.dispatchKey || `route:${payload.planId}`),
          receiptId, payloadDigest, workerId });
        if (claim.replayed) return { replayed: true };
        const { agentPlannerService } = await import('../services/ai/agentPlannerService.js');
        try {
          result = await agentPlannerService.executeBackgroundPlan(payload);
          await finishAgentTask(receiptId, workerId, true);
        } catch (error) {
          await finishAgentTask(receiptId, workerId, false, error);
          throw error;
        }
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
    const worker = new Worker('ai-tasks', processAiTaskJob, redisConfig);

    worker.on('completed', (job) => {
      // Optional: Notify user via WebSocket or update DB status
      logger.info(`[BullMQ] Job ${job.id} completed successfully.`);
    });

    worker.on('failed', (job, err) => {
      const attempts = Number(job?.opts?.attempts || 1);
      const exhausted = Number(job?.attemptsMade || 0) >= attempts;
      logger[exhausted ? 'error' : 'warn'](`[BullMQ] Job ${job?.id} failed: ${err.message}`, {
        queue: 'ai-tasks',
        taskType: job?.data?.taskType,
        attemptsMade: job?.attemptsMade,
        attempts,
        deadLetter: exhausted,
      });
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
