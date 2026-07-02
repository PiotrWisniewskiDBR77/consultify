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
/** Klucz API dla danego providera z env (by override realnie zadziałał, nie był
 *  re-resolvowany do innego providera w llmService gdy brak api_key). */
function providerApiKeyFromEnv(provider: string): string | undefined {
  switch (provider.toLowerCase()) {
    case 'openrouter': return process.env.OPENROUTER_API_KEY?.trim() || undefined;
    case 'openai': return process.env.OPENAI_API_KEY?.trim() || undefined;
    case 'anthropic': return process.env.ANTHROPIC_API_KEY?.trim() || undefined;
    case 'google':
    case 'gemini': return (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY)?.trim() || undefined;
    case 'deepseek': return process.env.DEEPSEEK_API_KEY?.trim() || undefined;
    case 'groq': return process.env.GROQ_API_KEY?.trim() || undefined;
    default: return undefined;
  }
}

export function deliverableModelConfig(
  fallback?: Record<string, unknown>
): Record<string, unknown> {
  try {
    const provider = process.env.DELIVERABLE_LLM_PROVIDER?.trim();
    const model = process.env.DELIVERABLE_LLM_MODEL?.trim();
    if (provider && model) {
      const cfg: Record<string, unknown> = { id: model, model_id: model, provider, tier: 'PREMIUM' };
      // llmService (getModelConfig) używa przekazanej konfiguracji AS-IS tylko gdy
      // ma provider ORAZ api_key; bez klucza re-resolvuje providera z prefiksu
      // model-id (np. "openai/…" → bezpośredni OpenAI), gubiąc override.
      const apiKey = providerApiKeyFromEnv(provider);
      if (apiKey) { cfg.api_key = apiKey; cfg.apiKey = apiKey; }
      return cfg;
    }
  } catch {
    /* fall through to default */
  }
  return fallback ?? { id: 'premium' };
}
