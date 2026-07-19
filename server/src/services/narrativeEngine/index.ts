/**
 * Narrative Engine — Orchestrator
 *
 * 5-layer pipeline that transforms structured data into quality-checked narrative:
 *   L1: Fact Extraction    (deterministic)
 *   L2: Observation Selection (deterministic)
 *   L3: Discourse Planning (deterministic)
 *   L4: Linguistic Realization (LLM)
 *   L5: Post-Checks        (deterministic)
 *
 * Each layer is logged with timing. On failure, returns a simplified fallback.
 */

import logger from '../../utils/Logger.js';
import { buildDiscoursePlan } from './discoursePlan.js';
import { extractFacts } from './factExtraction.js';
import { buildSystemPrompt, realizeLinguistically } from './linguisticRealization.js';
import { selectObservations } from './observationSelection.js';
import { runPostChecks } from './postChecks.js';
import type {
  DiscoursePlan,
  FactSet,
  NarrativeEngineInput,
  NarrativeEngineOutput,
  NarrativeSegment,
  Observation,
  PostCheckResult,
} from './types.js';

export type {
  DiscoursePlan,
  FactSet,
  NarrativeEngineInput,
  NarrativeEngineOutput,
  NarrativeSegment,
  Observation,
  PostCheckResult,
};

export {
  buildDiscoursePlan,
  buildSystemPrompt,
  extractFacts,
  realizeLinguistically,
  runPostChecks,
  selectObservations,
};

// ── Helpers ─────────────────────────────────────────────────────

function elapsed(start: [number, number]): string {
  const [s, ns] = process.hrtime(start);
  return `${(s * 1000 + ns / 1e6).toFixed(1)}ms`;
}

function buildFallbackOutput(
  input: NarrativeEngineInput,
  partialFacts?: FactSet[],
  partialObs?: Observation[],
  partialPlan?: DiscoursePlan,
  error?: unknown
): NarrativeEngineOutput {
  const fallbackPlan: DiscoursePlan = partialPlan ?? {
    section_key: input.section_key,
    section_title: input.section_title,
    segments: [],
    communication_register: input.report_config.communication_register,
    density: input.report_config.density,
  };

  const errMsg = error instanceof Error ? error.message : String(error ?? 'Unknown error');

  return {
    content: `## ${input.section_title}\n\n*Content generation encountered an issue. Please regenerate this section.*\n\n<!-- engine-error: ${errMsg} -->`,
    facts_used: partialFacts?.map((f) => f.fact_id) ?? [],
    observations_used: partialObs?.map((o) => o.observation_id) ?? [],
    discourse_plan: fallbackPlan,
    post_check: {
      passed: false,
      warnings: [],
      errors: [{ code: 'ENGINE_FAILURE', message: errMsg, section_key: input.section_key }],
    },
  };
}

// ── Main orchestrator ───────────────────────────────────────────

/**
 * Generate a narrative section through the 5-layer pipeline.
 */
export async function generateNarrative(
  input: NarrativeEngineInput
): Promise<NarrativeEngineOutput> {
  const pipelineStart = process.hrtime();
  const tag = `[NarrativeEngine][${input.section_key}]`;

  let facts: FactSet[] | undefined;
  let observations: Observation[] | undefined;
  let plan: DiscoursePlan | undefined;

  try {
    // L1: Fact Extraction
    const l1Start = process.hrtime();
    facts = extractFacts(input);
    logger.info(`${tag} L1 Fact Extraction: ${facts.length} facts in ${elapsed(l1Start)}`);

    // L2: Observation Selection
    const l2Start = process.hrtime();
    observations = selectObservations(facts, input);
    logger.info(
      `${tag} L2 Observation Selection: ${observations.length} observations in ${elapsed(l2Start)}`
    );

    // L3: Discourse Planning
    const l3Start = process.hrtime();
    plan = buildDiscoursePlan(observations, facts, input);
    logger.info(
      `${tag} L3 Discourse Planning: ${plan.segments.length} segments in ${elapsed(l3Start)}`
    );

    // L4: Linguistic Realization
    const l4Start = process.hrtime();
    const content = await realizeLinguistically(plan, facts, observations, input);
    logger.info(`${tag} L4 Linguistic Realization: ${content.length} chars in ${elapsed(l4Start)}`);

    // L5: Post-Checks
    const l5Start = process.hrtime();
    const postCheck = runPostChecks(content, plan, facts, input);
    logger.info(
      `${tag} L5 Post-Checks: passed=${postCheck.passed}, ` +
        `${postCheck.warnings.length} warnings, ${postCheck.errors.length} errors in ${elapsed(l5Start)}`
    );

    logger.info(`${tag} Pipeline complete in ${elapsed(pipelineStart)}`);

    return {
      content,
      facts_used: facts.map((f) => f.fact_id),
      observations_used: observations.map((o) => o.observation_id),
      discourse_plan: plan,
      post_check: postCheck,
    };
  } catch (error) {
    logger.error(`${tag} Pipeline failed after ${elapsed(pipelineStart)}`, { error });
    return buildFallbackOutput(input, facts, observations, plan, error);
  }
}
