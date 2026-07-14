/**
 * Assessment AI-Guidance — client runtime wiring
 *
 * Bridges `assessmentGuidanceService` (framework-agnostic, LLM-injected) to the app's
 * existing client LLM wrapper `sendMessageToAI` (src/services/ai/gemini.ts), which routes
 * to the backend AIPipeline. Kept in a SEPARATE module so the pure service stays free of
 * app/store imports and is trivially unit-testable with a mock LLM.
 *
 * Usage from the assessment runtime (e.g. DRDAssessmentEditor):
 *
 *   import { getAssessmentGuidanceLive } from '@/services/assessmentKnowledge/assessmentGuidanceRuntime';
 *   const g = await getAssessmentGuidanceLive({
 *     framework: 'DRD', dimensionId: area.id, dimensionName: area.name,
 *     levelNumber: level, levelTitle: lvl.title, levelDescription: lvl.description,
 *   });
 *   // g.whyItMatters / g.levelInterpretation / g.canonContext / g.pitfalls
 *
 * Never throws: on any LLM failure it degrades to canon-derived deterministic guidance.
 */

import { sendMessageToAI } from '@/services/ai/gemini';

import {
  type AssessmentGuidanceInput,
  type AssessmentGuidanceOutput,
  getAssessmentGuidance,
  type GuidanceLlm,
} from './assessmentGuidanceService';

/**
 * Adapter: the app's `sendMessageToAI` returns a plain string (and swallows its own
 * errors into a sentinel string). We surface that sentinel as a throw so the guidance
 * service treats it as a failure and falls back deterministically.
 */
const clientLlm: GuidanceLlm = async ({ systemPrompt, userPrompt }) => {
  const text = await sendMessageToAI([], userPrompt, systemPrompt);
  const t = String(text ?? '');
  // sendMessageToAI's internal catch returns this sentinel; treat it as failure.
  if (/I encountered an error while processing your request/i.test(t)) {
    throw new Error('llm_wrapper_error');
  }
  return t;
};

/**
 * Live per-question guidance using the app's backend LLM pipeline, with the
 * deterministic canon fallback baked in. Safe to call directly from the runtime.
 */
export function getAssessmentGuidanceLive(
  input: AssessmentGuidanceInput
): Promise<AssessmentGuidanceOutput> {
  return getAssessmentGuidance(input, {
    llm: clientLlm,
    timeoutMs: 20_000,
    logger: { warn: (msg, meta) => console.warn(`[assessment-guidance] ${msg}`, meta) },
  });
}

/** Deterministic-only guidance (no LLM) — cheap, synchronous-feeling, always available. */
export function getAssessmentGuidanceOffline(
  input: AssessmentGuidanceInput
): Promise<AssessmentGuidanceOutput> {
  return getAssessmentGuidance(input, {});
}
