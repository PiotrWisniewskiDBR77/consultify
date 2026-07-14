import { v4 as uuidv4 } from 'uuid';

import logger from '../../../utils/Logger.js';
import type {
  AgentRuntimeBaseArgs,
  AgentRuntimeDefinition,
  AgentRuntimeEmit,
  AgentRuntimeResult,
} from './types.js';

/**
 * Generic agent runtime — HP-2 (Harvey-Parity Blok A).
 *
 * Executes the plan -> adapt -> interact -> validate -> aggregate pipeline for ANY
 * `AgentRuntimeDefinition`, in parallel across `args.agentIds`. This function has no
 * knowledge of "audit" — that domain lives entirely in the definition passed in
 * (see `agentAudit/orchestratorService.ts` for the audit adapter).
 */
export async function runAgentRuntime<TArgs extends AgentRuntimeBaseArgs, TReview, TVerdict>(
  definition: AgentRuntimeDefinition<TArgs, TReview, TVerdict>,
  args: TArgs
): Promise<AgentRuntimeResult<TReview, TVerdict>> {
  const orchestratorRunId = uuidv4();
  const logPrefix = definition.logPrefix || '[AgentRuntime]';
  const emit: AgentRuntimeEmit = (payload) => args.emit?.(payload);

  definition.onRunStart?.({ runArgs: args, orchestratorRunId });

  emit({
    type: definition.eventTypes.state,
    state: 'reviewing',
    orchestratorRunId,
    agentsTotal: Array.isArray(args.agentIds) ? args.agentIds.length : 0,
  });

  // Lazy import heavy AI modules (keeps unit tests + cold starts fast).
  const { modelRouter } = await import('../modelRouter.js');
  const { llmService } = await import('../llmService.js');

  const tier = (args.selectedTier || 'STANDARD') as any;
  const modelCfg = args.selectedModelId
    ? await modelRouter.getProviderConfig(args.selectedModelId, tier)
    : await modelRouter.select({
        capability: definition.capability || 'chat_simple',
        tier,
        organizationId: 'system',
        options: { tier },
      } as any);

  const reviews: TReview[] = [];

  await Promise.all(
    (args.agentIds || []).map(async (agentId) => {
      const agentMeta = definition.resolveAgent(agentId);
      if (!agentMeta) {
        logger.warn(`${logPrefix} Unknown agentId, skipping:`, agentId);
        return;
      }

      emit({
        type: definition.eventTypes.reviewProgress,
        orchestratorRunId,
        agentId,
        stage: 'start',
      });

      const { kb, web, allowedWebUrls } = await definition.gatherSources({
        runArgs: args,
        agentId,
        agentMeta,
        orchestratorRunId,
        emit,
      });

      const { system, user } = definition.buildPrompt({
        runArgs: args,
        agentId,
        agentMeta,
        kbSources: kb,
        webSources: web,
      });

      try {
        emit({
          type: definition.eventTypes.reviewProgress,
          orchestratorRunId,
          agentId,
          stage: 'llm_review',
        });

        const out = (await llmService.callStructured({
          type: 'chat',
          modelConfig: {
            provider: modelCfg.provider,
            id: modelCfg.id,
            endpoint: (modelCfg as any).endpoint,
            apiKey: (modelCfg as any).apiKey,
          },
          systemPrompt: system,
          messages: [{ role: 'user', content: user }],
          schema: definition.schema,
          temperature: 0.2,
        } as any)) as any;

        const review = definition.postProcess({
          raw: out.object,
          agentId,
          agentMeta,
          runArgs: args,
        });

        const results = definition.validators.map((validate) =>
          validate({ review, allowedWebUrls, runArgs: args })
        );
        const { review: finalReview, hard } = definition.applyValidation({ review, results });

        reviews.push(finalReview);
        emit({
          type: definition.eventTypes.reviewProgress,
          orchestratorRunId,
          agentId,
          stage: hard ? 'rejected' : 'done',
        });
      } catch (err: any) {
        logger.warn(`${logPrefix} Agent review failed:`, agentId, err?.message || err);
        emit({
          type: definition.eventTypes.reviewProgress,
          orchestratorRunId,
          agentId,
          stage: 'error',
          error: String(err?.message || err || ''),
        });
      }
    })
  );

  emit({ type: definition.eventTypes.state, state: 'aggregating', orchestratorRunId });

  const verdict = definition.aggregate({ runArgs: args, reviews, orchestratorRunId });

  emit({
    type: definition.eventTypes.state,
    state: 'done',
    orchestratorRunId,
    ...(definition.describeVerdictForEmit ? definition.describeVerdictForEmit(verdict) : {}),
  });

  definition.onRunDone?.({ runArgs: args, orchestratorRunId, verdict });

  return { orchestratorRunId, reviews, verdict };
}
