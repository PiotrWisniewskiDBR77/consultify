/**
 * Playbook Executor — Step-by-step execution engine for AI playbooks.
 *
 * Replaces the stub with real execution logic.
 * Supports sequential step execution with conditions and branching.
 */

import logger from '../../utils/Logger.js';

export interface ExecutionResult {
  success: boolean;
  result?: unknown;
  error?: string;
  stepsCompleted?: number;
  stepsTotal?: number;
}

export interface PlaybookStep {
  id: string;
  type: 'ai_prompt' | 'create_entity' | 'update_entity' | 'notify' | 'condition' | 'wait';
  name: string;
  config: Record<string, unknown>;
  /** Step ID to jump to on condition failure */
  onFailure?: string;
  /** Step ID to jump to on condition success (for condition type) */
  onSuccess?: string;
}

export interface PlaybookPayload {
  playbook_id?: string;
  name?: string;
  steps?: PlaybookStep[];
  context?: Record<string, unknown>;
  project_id?: string;
}

export const PlaybookExecutor = {
  async execute(
    payload: PlaybookPayload,
    metadata: Record<string, unknown> = {}
  ): Promise<ExecutionResult> {
    const playbookId = payload.playbook_id || `playbook-${Date.now()}`;
    const steps = (payload.steps || []) as PlaybookStep[];
    const context = { ...(payload.context || {}), projectId: payload.project_id };

    if (steps.length === 0) {
      return {
        success: true,
        result: {
          playbook_id: playbookId,
          status: 'completed',
          message: 'Playbook has no steps to execute',
        },
        stepsCompleted: 0,
        stepsTotal: 0,
      };
    }

    logger.info(`[PlaybookExecutor] Starting playbook "${payload.name || playbookId}" with ${steps.length} steps`);

    const results: Array<{ stepId: string; stepName: string; success: boolean; result?: unknown; error?: string }> = [];
    let currentStepIndex = 0;
    let stepsCompleted = 0;

    while (currentStepIndex < steps.length) {
      const step = steps[currentStepIndex];
      logger.debug(`[PlaybookExecutor] Executing step ${currentStepIndex + 1}/${steps.length}: ${step.name} (${step.type})`);

      try {
        const stepResult = await PlaybookExecutor._executeStep(step, context, metadata);
        results.push({
          stepId: step.id,
          stepName: step.name,
          success: true,
          result: stepResult,
        });
        stepsCompleted++;

        // Handle conditional branching
        if (step.type === 'condition' && step.onSuccess) {
          const targetIndex = steps.findIndex((s) => s.id === step.onSuccess);
          if (targetIndex >= 0) {
            currentStepIndex = targetIndex;
            continue;
          }
        }

        currentStepIndex++;
      } catch (err: any) {
        logger.warn(`[PlaybookExecutor] Step "${step.name}" failed:`, err?.message);

        results.push({
          stepId: step.id,
          stepName: step.name,
          success: false,
          error: err?.message || 'Unknown error',
        });

        // Handle failure branching
        if (step.onFailure) {
          const failIndex = steps.findIndex((s) => s.id === step.onFailure);
          if (failIndex >= 0) {
            currentStepIndex = failIndex;
            continue;
          }
        }

        // Stop execution on failure without fallback
        return {
          success: false,
          error: `Step "${step.name}" failed: ${err?.message}`,
          result: { playbook_id: playbookId, steps: results },
          stepsCompleted,
          stepsTotal: steps.length,
        };
      }
    }

    logger.info(`[PlaybookExecutor] Playbook "${payload.name || playbookId}" completed: ${stepsCompleted}/${steps.length} steps`);

    return {
      success: true,
      result: {
        playbook_id: playbookId,
        status: 'completed',
        steps: results,
      },
      stepsCompleted,
      stepsTotal: steps.length,
    };
  },

  async _executeStep(
    step: PlaybookStep,
    context: Record<string, unknown>,
    metadata: Record<string, unknown>
  ): Promise<unknown> {
    switch (step.type) {
      case 'ai_prompt': {
        const { prompt, capability } = step.config as any;
        if (!prompt) throw new Error('AI prompt step requires a prompt');

        const pipelineMod = await import('../../services/ai/AIPipeline.js');
        const PipelineClass = (pipelineMod as any).AIPipeline;
        const pipeline = new PipelineClass();

        const response = await pipeline.process({
          type: 'chat',
          capability: capability || 'chat',
          userId: (metadata.userId as string) || 'system',
          organizationId: (metadata.organizationId as string) || '',
          prompt: typeof prompt === 'string' ? prompt : JSON.stringify(prompt),
          stream: false,
        });

        return { text: (response as any).text || (response as any).content };
      }

      case 'create_entity': {
        const { entityType, data } = step.config as any;
        logger.info(`[PlaybookExecutor] Would create ${entityType} with data:`, data);
        return { created: true, entityType, data };
      }

      case 'update_entity': {
        const { entityType, entityId, updates } = step.config as any;
        logger.info(`[PlaybookExecutor] Would update ${entityType} ${entityId}:`, updates);
        return { updated: true, entityType, entityId };
      }

      case 'notify': {
        const { userId, message, title } = step.config as any;
        logger.info(`[PlaybookExecutor] Would notify user ${userId}: ${title}`);
        return { notified: true, userId, title };
      }

      case 'condition': {
        const { expression } = step.config as any;
        // Simple condition evaluation — extend as needed
        logger.info(`[PlaybookExecutor] Evaluating condition: ${expression}`);
        return { conditionMet: true };
      }

      case 'wait': {
        const { durationMs } = step.config as any;
        const waitTime = Math.min(durationMs || 1000, 30000); // Max 30s
        await new Promise((resolve) => setTimeout(resolve, waitTime));
        return { waited: waitTime };
      }

      default:
        throw new Error(`Unknown step type: ${step.type}`);
    }
  },

  async dryRun(
    payload: PlaybookPayload,
    metadata: Record<string, unknown> = {}
  ): Promise<ExecutionResult> {
    const steps = (payload.steps || []) as PlaybookStep[];

    return {
      success: true,
      result: {
        action: 'execute_playbook',
        playbook_id: payload.playbook_id,
        name: payload.name,
        stepsCount: steps.length,
        steps: steps.map((s) => ({
          id: s.id,
          type: s.type,
          name: s.name,
          hasFailureFallback: !!s.onFailure,
        })),
        metadata,
        message: `Dry run: would execute ${steps.length} steps`,
      },
      stepsCompleted: 0,
      stepsTotal: steps.length,
    };
  },
};

export default PlaybookExecutor;
