/**
 * deliverableGenerationTier — W4 / B5: premium tier wiring + cost telemetry tag
 * for the deliverable GENERATION step (deck layout director / doc structure /
 * table schema — series B1-B4).
 *
 * The platform already owns model-tier routing (`modelRouter.select`) and cost
 * telemetry (`ai/cost-monitoring.service` + AIPipeline auto-records usage). B5
 * adds ONE thin decision on top: when the premium-deliverables flag is on, the
 * generation call routes to the PREMIUM tier instead of the STANDARD default,
 * and the spend is attributable via a stable `purpose` tag.
 *
 * SAFETY (program Znalezisko #1 — generation touches live clients):
 *   - default OFF (`ENABLE_DELIVERABLES_PREMIUM=false`) ⇒ STANDARD tier, i.e.
 *     today's exact behaviour. Clients stay on STANDARD until quality is proven.
 *   - FAIL-OPEN: any error resolving the flag falls back to STANDARD and never
 *     throws into the generation path.
 *
 * This module is deliberately model-agnostic: it returns a *tier* name, not a
 * concrete model id. `modelRouter` maps tier → model per org policy, so premium
 * routing honours each org's model registry and downgrade rules.
 */

import featureFlags from '../config/FeatureFlags.js';
import logger from '../utils/Logger.js';

/** Tier names understood by `modelRouter.select({ tier })`. */
export type DeliverableTier = 'STANDARD' | 'PREMIUM';

/** Stable telemetry purpose for all deliverable-generation spend. */
export const DELIVERABLE_GENERATION_PURPOSE = 'deliverable_generation' as const;

export interface ResolveDeliverableTierOptions {
  /** Organization the generation runs for (reserved for future per-org override). */
  orgId?: string;
  /**
   * Per-call override. When `false`, forces STANDARD regardless of the flag
   * (e.g. a cheap regeneration). When `true`, requests PREMIUM *if* the flag
   * permits it. When omitted, the flag alone decides.
   */
  preferPremium?: boolean;
  /**
   * Test/DI seam: inject the flag value instead of reading the global config.
   * Production callers omit this.
   */
  premiumEnabled?: boolean;
}

/**
 * Decide which model tier the deliverable generation step should use.
 *
 * @returns `'PREMIUM'` only when the premium-deliverables flag is enabled AND
 *          the caller did not explicitly opt out; otherwise `'STANDARD'`.
 *          Never throws — resolution errors fall back to `'STANDARD'`.
 */
export function resolveDeliverableTier(
  options: ResolveDeliverableTierOptions = {}
): DeliverableTier {
  try {
    if (options.preferPremium === false) return 'STANDARD';

    const premiumEnabled =
      typeof options.premiumEnabled === 'boolean'
        ? options.premiumEnabled
        : Boolean(featureFlags.ENABLE_DELIVERABLES_PREMIUM);

    return premiumEnabled ? 'PREMIUM' : 'STANDARD';
  } catch (err) {
    // Fail-open: the generation path must never break because tier resolution
    // hiccuped. STANDARD is always a safe, working default.
    logger.warn('[deliverableGenerationTier] resolution failed, defaulting to STANDARD', {
      err: (err as Error)?.message,
    });
    return 'STANDARD';
  }
}

/**
 * Whether premium deliverable generation is active for this call. Convenience
 * wrapper over {@link resolveDeliverableTier} for branch checks.
 */
export function isDeliverablePremiumActive(
  options: ResolveDeliverableTierOptions = {}
): boolean {
  return resolveDeliverableTier(options) === 'PREMIUM';
}

/**
 * "Full model choice" for the deliverable GENERATION step (deck/doc/table) — so
 * production can route premium generation to a cheaper/faster model (e.g. a
 * Chinese model like DeepSeek / GLM / Qwen) instead of the default Opus-class
 * Anthropic tier, controlling cost without code changes.
 *
 *   DELIVERABLE_LLM_PROVIDER  e.g. "deepseek" | "z_ai" | "openrouter" | "anthropic"
 *   DELIVERABLE_LLM_MODEL     e.g. "deepseek-chat" | "glm-4.6" | "qwen/qwen-2.5-72b-instruct"
 *
 * When BOTH are set → that concrete model is used (the provider's API key is
 * read from env by `llmService.getProviderSync`). When UNSET → returns the
 * supplied `fallback` (or `{ id: 'premium' }`), i.e. TODAY'S behaviour byte-for-byte.
 * Never throws — a malformed override falls back to the default.
 */
export function deliverableModelConfig(
  fallback?: Record<string, unknown>
): Record<string, unknown> {
  try {
    const provider = process.env.DELIVERABLE_LLM_PROVIDER?.trim();
    const model = process.env.DELIVERABLE_LLM_MODEL?.trim();
    if (provider && model) {
      return { id: model, model_id: model, provider, tier: 'PREMIUM' };
    }
  } catch {
    /* fall through to default */
  }
  return fallback ?? { id: 'premium' };
}
