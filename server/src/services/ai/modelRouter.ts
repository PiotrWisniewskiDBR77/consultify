/**
 * Model Router - Dynamic LLM Provider Selection & Fallback
 */

import * as DbPromise from '../../utils/DbPromise.js';
import { appCache } from '../redis/CacheService.js';
import { getRoutingPurposeKeys, normalizePurposeKey } from './aiTaskCatalog.js';
import circuitBreaker from './circuitBreaker.js';
import type { LLMConfigService } from './llmConfigService.js';
import { aiLogger } from './logger.js';
import { modelMeetsRequirements, type ModelRequirements } from './modelCapabilities.js';
import { modelRegistryService } from './modelRegistryService.js';
import { routingRulesService } from './routingRulesService.js';

/**
 * Type-agnostic truthiness predicate: is_active/is_enabled columns are INTEGER
 * in some tables and BOOLEAN in others (and the mix differs per environment),
 * so a raw `= 1` or `= true` always breaks somewhere ("operator does not exist").
 */
const sqlTruthy = (expr: string): string =>
  `COALESCE(NULLIF(LOWER(TRIM(CAST(${expr} AS TEXT))), ''), 'false') IN ('1','t','true','y','yes','on')`;

export const TIER_HIERARCHY = ['BUDGET', 'STANDARD', 'PREMIUM', 'REASONING'] as const;
export type Tier = (typeof TIER_HIERARCHY)[number] | 'VISION';

export const CAPABILITY_TIERS: Record<string, Tier> = {
  chat: 'BUDGET',
  chat_simple: 'BUDGET',
  magic_wand: 'BUDGET',
  chat_confirm: 'BUDGET',
  chat_complex: 'STANDARD',
  chat_with_pdf: 'PREMIUM',
  chat_with_files: 'STANDARD',
  document_extract: 'STANDARD',
  document_compare: 'REASONING',
  document_answer: 'PREMIUM',
  report_section: 'STANDARD',
  report_section_draft: 'STANDARD',
  report_executive_synthesis: 'REASONING',
  report_evidence_validation: 'REASONING',
  report_quality_gate: 'STANDARD',
  analysis: 'STANDARD',
  full_report: 'PREMIUM',
  assessment: 'PREMIUM',
  presentation_deck_outline: 'STANDARD',
  presentation_slide_copy: 'STANDARD',
  presentation_vision_qc: 'REASONING',
  presentation_visual_generation: 'STANDARD',
  max_mode: 'REASONING',
  strategic: 'REASONING',
  vision: 'VISION',
  coding: 'STANDARD',
  suggestTasks: 'BUDGET',
  validateInitiative: 'STANDARD',
  generateInsights: 'STANDARD',
  buildRoadmap: 'PREMIUM',
};

export const MODEL_PROVIDER_MAP: Record<string, string> = {
  // OpenRouter is our single stable provider; model ids are routed through it.
  // (We keep this map mainly for legacy non-namespaced ids.)
  'gpt-4o': 'openrouter',
  'gpt-4o-mini': 'openrouter',
  'o1-preview': 'openrouter',
  'o1-mini': 'openrouter',
  'claude-sonnet-4-6': 'openrouter',
  'claude-3-5-sonnet': 'openrouter',
  'claude-3-5-sonnet-20241022': 'openrouter',
  'claude-3-haiku': 'openrouter',
  'gemini-2.0-flash': 'openrouter',
  // DeepSeek direct API (NOT via OpenRouter) — used for the "Show reasoning"
  // chat path: deepseek-reasoner (DeepSeek-R1) emits a real reasoning trace via
  // delta.reasoning_content, which callStream surfaces as a native reasoning
  // channel. Routed to the deepseek provider so the direct https://api.deepseek.com
  // endpoint is used.
  'deepseek-reasoner': 'deepseek',
  'deepseek-chat': 'deepseek',
};

export const TIER_DEFAULTS: Record<string, string> = {
  BUDGET: 'openai/gpt-4o-mini',
  STANDARD: 'openai/gpt-4o',
  PREMIUM: 'anthropic/claude-sonnet-4-6',
  REASONING: 'openai/o1-mini',
  VISION: 'openai/gpt-4o',
};

export const TIER_FALLBACK_CHAINS: Record<string, string[]> = {
  // OpenRouter-only fallbacks (all are OpenRouter model ids)
  BUDGET: ['openai/gpt-4o-mini', 'anthropic/claude-3.5-haiku'],
  STANDARD: ['openai/gpt-4o', 'anthropic/claude-sonnet-4-6'],
  PREMIUM: ['anthropic/claude-sonnet-4-6', 'openai/gpt-4o'],
  REASONING: ['openai/o1-mini', 'openai/gpt-4o', 'anthropic/claude-sonnet-4-6'],
  VISION: ['openai/gpt-4o', 'anthropic/claude-sonnet-4-6'],
};

export const TIER_FALLBACKS: Record<string, string> = {
  BUDGET: 'openai/gpt-4o-mini',
  STANDARD: 'openai/gpt-4o-mini',
  PREMIUM: 'anthropic/claude-sonnet-4-6',
  REASONING: 'openai/o1-mini',
  VISION: 'openai/gpt-4o',
};

const MULTI_PROVIDER_ENABLED =
  process.env.LLM_MULTI_PROVIDER === '1' ||
  process.env.LLM_MULTI_PROVIDER === 'true' ||
  process.env.LLM_MULTI_PROVIDER === 'yes';

const PURPOSE_ROUTING_ENABLED =
  process.env.LLM_PURPOSE_ROUTING === '1' ||
  process.env.LLM_PURPOSE_ROUTING === 'true' ||
  process.env.LLM_PURPOSE_ROUTING === 'yes';

const ORG_POLICY_ENABLED =
  process.env.LLM_ORG_POLICY === '1' ||
  process.env.LLM_ORG_POLICY === 'true' ||
  process.env.LLM_ORG_POLICY === 'yes';

const MODEL_REGISTRY_ENABLED =
  process.env.LLM_MODEL_REGISTRY === '1' ||
  process.env.LLM_MODEL_REGISTRY === 'true' ||
  process.env.LLM_MODEL_REGISTRY === 'yes';

type ProviderRow = {
  id: string;
  name?: string;
  provider: string;
  model_id?: string;
  api_key?: string | null;
  endpoint?: string | null;
  markup_multiplier?: number | null;
  priority?: number | null;
  health_status?: string | null;
  is_active?: number | null;
  kind?: string | null;
  provider_type?: string | null;
  origin_vendor?: string | null;
  execution_regions?: any;
  allowed_data_classes?: any;
  release_bundle_id?: string | null;
  prompt_key?: string | null;
  prompt_version?: string | null;
  policy_version?: string | null;
};

type TierAssignmentRow = {
  id: string;
  tier: string;
  priority: number;
  is_active: number;
  provider_id: string;
  name?: string;
  provider?: string;
  model_id?: string;
  health_status?: string | null;
};

type OverrideRow = {
  model_id: string;
  tier?: string;
};

type ProviderConfig = {
  id: string;
  tier: string;
  provider: string;
  apiKey: string | null;
  endpoint: string | null;
  source?: string;
  healthStatus?: string | null;
  originalTier?: string;
  markupMultiplier?: number;
  raw?: ProviderRow | null;
  routingTrace?: RoutingTrace;
  releaseBundleId?: string | null;
  promptKey?: string | null;
  promptVersion?: string | null;
  policyVersion?: string | null;
};

export type RoutingTraceCandidate = {
  id: string;
  provider: string;
  tier: string;
  source: string;
  endpoint?: string | null;
  healthStatus?: string | null;
  breakerState?: string | null;
  breakerReason?: string | null;
  originalTier?: string;
  releaseBundleId?: string | null;
  promptKey?: string | null;
  promptVersion?: string | null;
  policyVersion?: string | null;
};

export type RoutingTraceSkip = {
  id: string;
  provider: string;
  source: string;
  reason: string;
};

export type RoutingTrace = {
  requestedPurpose: string | null;
  normalizedPurpose: string | null;
  organizationId: string | null;
  tier: string;
  downgradeReason?: string | null;
  selected?: RoutingTraceCandidate | null;
  candidates: RoutingTraceCandidate[];
  skipped: RoutingTraceSkip[];
};

type SelectParams = {
  capability?: string;
  /**
   * v3: prefer purpose over capability (capability kept for backwards compatibility).
   * For now, purpose is treated as an alias of capability in routing logs and overrides.
   */
  purpose?: string;
  tier?: string;
  organizationId?: string;
  options?: { tier?: string };
  requirements?: ModelRequirements;
  /**
   * Optional data classification hint used by org policy (enterprise).
   * If omitted, policy enforcement should treat as lowest sensitivity.
   */
  dataClass?: 'no_pii' | 'pii' | 'confidential';
};

let _llmConfigService: LLMConfigService | null = null;

async function getLLMConfigService(): Promise<LLMConfigService | null> {
  if (!_llmConfigService) {
    try {
      const mod = await import('./llmConfigService.js');
      _llmConfigService = mod.llmConfigService as LLMConfigService;
    } catch (error: unknown) {
      const err = error as Error;
      aiLogger.warn('ModelRouter', `LLMConfigService not available: ${err.message}`);
    }
  }
  return _llmConfigService;
}

export class ModelRouter {
  // Distributed cache via Redis (appCache) used instead of local Maps
  // private overrideCache = new Map<string, { value: OverrideRow | null; expiresAt: number }>();
  // private defaultProviderCache: ProviderRow | null = null;

  private subscriptionActive = false;

  private addTraceCandidate(
    target: RoutingTraceCandidate[],
    seen: Set<string>,
    candidate: RoutingTraceCandidate
  ) {
    const key = `${candidate.provider}::${candidate.id}`;
    if (seen.has(key)) return;
    seen.add(key);
    target.push(candidate);
  }

  private addTraceSkip(
    target: RoutingTraceSkip[],
    seen: Set<string>,
    candidate: { provider?: string | null; id?: string | null; source?: string | null },
    reason: string
  ) {
    const key = `${String(candidate.provider || 'unknown')}::${String(candidate.id || 'unknown')}::${String(candidate.source || 'unknown')}::${reason}`;
    if (seen.has(key)) return;
    seen.add(key);
    target.push({
      provider: String(candidate.provider || 'unknown'),
      id: String(candidate.id || 'unknown'),
      source: String(candidate.source || 'unknown'),
      reason,
    });
  }

  private async evaluateRoutingCandidate(
    config: ProviderConfig | null,
    trace: RoutingTrace,
    candidateSeen: Set<string>,
    skipSeen: Set<string>,
    params: SelectParams,
    orgPolicy: any
  ): Promise<ProviderConfig | null> {
    if (!config) return null;
    const normalized: ProviderConfig = {
      ...config,
      provider: String(config.provider || '').trim(),
      id: String(config.id || '').trim(),
      source: config.source || 'unknown',
    };
    if (!normalized.provider || !normalized.id) {
      this.addTraceSkip(
        skipSeen ? trace.skipped : trace.skipped,
        skipSeen,
        normalized,
        'invalid_candidate'
      );
      return null;
    }

    const providerLike: ProviderRow = {
      id: normalized.id,
      provider: normalized.provider,
      model_id: normalized.id,
      api_key: normalized.apiKey,
      endpoint: normalized.endpoint,
      health_status: normalized.healthStatus || null,
      ...(normalized.raw || {}),
    };

    if (!this.isProviderUsable(providerLike)) {
      this.addTraceSkip(trace.skipped, skipSeen, normalized, 'provider_unusable');
      return null;
    }

    if (
      params.requirements &&
      !modelMeetsRequirements(
        this.normalizeModelIdForCapabilities(normalized.id),
        params.requirements
      )
    ) {
      this.addTraceSkip(trace.skipped, skipSeen, normalized, 'requirements_mismatch');
      return null;
    }

    if (ORG_POLICY_ENABLED && !this.isAllowedByOrgPolicyInternal(providerLike, params, orgPolicy)) {
      this.addTraceSkip(trace.skipped, skipSeen, normalized, 'blocked_by_org_policy');
      return null;
    }

    const breaker = await circuitBreaker.canExecute(normalized.provider);
    if (!breaker.allowed) {
      this.addTraceSkip(
        trace.skipped,
        skipSeen,
        normalized,
        `breaker_${String(breaker.state || 'unknown').toLowerCase()}`
      );
      return null;
    }

    const tracedCandidate: RoutingTraceCandidate = {
      id: normalized.id,
      provider: normalized.provider,
      tier: normalized.tier,
      source: normalized.source || 'unknown',
      endpoint: normalized.endpoint,
      healthStatus: normalized.healthStatus || null,
      breakerState: breaker.state,
      breakerReason: breaker.reason,
      originalTier: normalized.originalTier,
      releaseBundleId: (normalized.raw as any)?.release_bundle_id || null,
      promptKey: (normalized.raw as any)?.prompt_key || null,
      promptVersion: (normalized.raw as any)?.prompt_version || null,
      policyVersion: (normalized.raw as any)?.policy_version || null,
    };
    this.addTraceCandidate(trace.candidates, candidateSeen, tracedCandidate);
    return {
      ...normalized,
      releaseBundleId: (normalized.raw as any)?.release_bundle_id || null,
      promptKey: (normalized.raw as any)?.prompt_key || null,
      promptVersion: (normalized.raw as any)?.prompt_version || null,
      policyVersion: (normalized.raw as any)?.policy_version || null,
      routingTrace: trace,
    };
  }

  private async initSubscription() {
    if (this.subscriptionActive) return;
    this.subscriptionActive = true;

    try {
      await appCache.subscribe('router:config_update', (msg) => {
        aiLogger.info('ModelRouter', `Received invalidation message: ${msg}`);
        this.clearCache().catch((err) =>
          aiLogger.error('ModelRouter', 'Failed to clear cache', err)
        );
      });
    } catch (error) {
      aiLogger.error('ModelRouter', 'Failed to subscribe to updates', error);
      this.subscriptionActive = false;
    }
  }

  async select(params: SelectParams): Promise<ProviderConfig> {
    const requestedPurpose = params.purpose || params.capability;
    const capability = normalizePurposeKey(requestedPurpose) || requestedPurpose;
    const { organizationId, options = {}, requirements } = params;
    let tier = (options.tier ||
      params.tier ||
      CAPABILITY_TIERS[capability || ''] ||
      CAPABILITY_TIERS[String(requestedPurpose || '')] ||
      'STANDARD') as Tier;

    aiLogger.info(
      'ModelRouter',
      `Selecting model for tier: ${tier}, org: ${organizationId || 'global'}`
    );

    const orgPolicy =
      ORG_POLICY_ENABLED && organizationId ? await this.getOrgPolicy(organizationId) : null;
    let downgradeReason: string | null = null;
    const trace: RoutingTrace = {
      requestedPurpose: requestedPurpose ? String(requestedPurpose) : null,
      normalizedPurpose: capability ? String(capability) : null,
      organizationId: organizationId || null,
      tier,
      downgradeReason: null,
      selected: null,
      candidates: [],
      skipped: [],
    };
    const candidateSeen = new Set<string>();
    const skipSeen = new Set<string>();

    // -------------------------------------------------------------------------
    // v3 soft cap (degraded mode): if org is near/exceeded monthly AI cost budget,
    // degrade non-critical purposes to cheaper tiers (no hard cut).
    //
    // Budget source: organizations.monthly_budget_usd (existing column).
    // Spend source: ai_usage_logs.estimated_cost_usd (written by AIPipeline when available).
    //
    // Controls:
    // - AI_COST_SOFT_CAP_ENABLED=false to disable
    // - AI_COST_SOFT_CAP_THRESHOLD_PCT (default 90)
    // - AI_COST_SOFT_CAP_SEVERE_PCT (default 110)
    // -------------------------------------------------------------------------
    if (
      organizationId &&
      String(process.env.AI_COST_SOFT_CAP_ENABLED || '')
        .trim()
        .toLowerCase() !== 'false'
    ) {
      try {
        const capRow = await DbPromise.get<{ monthly_budget_usd?: number | null }>(
          `SELECT monthly_budget_usd FROM organizations WHERE id = ? LIMIT 1`,
          [organizationId],
          { fallback: true }
        );
        const capUsd = Number(capRow?.monthly_budget_usd);
        if (Number.isFinite(capUsd) && capUsd > 0) {
          const spendRow = await DbPromise.get<{ cost?: number | null }>(
            `SELECT COALESCE(SUM(estimated_cost_usd), 0) as cost
             FROM ai_usage_logs
             WHERE organization_id = ?
               AND status = 'success'
               AND created_at >= date('now', 'start of month')`,
            [organizationId],
            { fallback: true }
          );
          const spendUsd = Number(spendRow?.cost || 0) || 0;
          const pct = capUsd > 0 ? (spendUsd / capUsd) * 100 : 0;

          const thresholdPct = Number(process.env.AI_COST_SOFT_CAP_THRESHOLD_PCT || 90) || 90;
          const severePct = Number(process.env.AI_COST_SOFT_CAP_SEVERE_PCT || 110) || 110;

          const purpose = String(capability || requestedPurpose || '').trim();
          const nonCritical =
            [
              'chat_simple',
              'chat_confirm',
              'chat_complex',
              'presentation_slide_copy',
              'deck_copy_polish',
            ].includes(purpose) || purpose.startsWith('results_');

          // Respect explicit tier override from the caller.
          const hasExplicitTierOverride = !!options.tier || !!params.tier;

          if (!hasExplicitTierOverride && nonCritical && pct >= thresholdPct && tier !== 'BUDGET') {
            aiLogger.warn(
              'ModelRouter',
              `AI cost soft-cap (${pct.toFixed(1)}%): forcing BUDGET for ${purpose}`
            );
            downgradeReason = `soft_cap_${pct.toFixed(1)}pct_budget_to_budget`;
            tier = 'BUDGET';
          }

          if (!hasExplicitTierOverride && pct >= severePct && tier === 'REASONING') {
            aiLogger.warn(
              'ModelRouter',
              `AI cost soft-cap severe (${pct.toFixed(1)}%): degrading REASONING->STANDARD for ${purpose}`
            );
            downgradeReason = `soft_cap_${pct.toFixed(1)}pct_reasoning_to_standard`;
            tier = 'STANDARD';
          }
        }
      } catch {
        // Fail-open: never block routing due to budget checks.
      }
    }
    trace.tier = tier;
    trace.downgradeReason = downgradeReason;

    const override = await this.getOrgOverride(organizationId, capability);
    if (override) {
      if (
        modelMeetsRequirements(
          this.normalizeModelIdForCapabilities(override.model_id),
          requirements
        )
      ) {
        aiLogger.info('ModelRouter', `Using org override for ${capability}: ${override.model_id}`);
        const picked = await this.evaluateRoutingCandidate(
          {
            ...(await this.getProviderConfig(override.model_id, (override.tier || tier) as Tier)),
            source: 'org_override',
          },
          trace,
          candidateSeen,
          skipSeen,
          params,
          orgPolicy
        );
        if (picked) {
          trace.selected = trace.candidates[0] || null;
          picked.routingTrace = trace;
          return picked;
        }
      }
      aiLogger.warn(
        'ModelRouter',
        `Org override model does not meet requirements (${capability}): ${override.model_id}`
      );
      this.addTraceSkip(
        trace.skipped,
        skipSeen,
        {
          provider: this.inferProvider(override.model_id),
          id: override.model_id,
          source: 'org_override',
        },
        'override_not_eligible'
      );
    }

    // v3 enterprise: purpose assignments (higher priority than tier routing)
    if (PURPOSE_ROUTING_ENABLED && capability) {
      try {
        const assigned = await this.getModelsForPurpose(capability, organizationId);
        for (const pick of assigned) {
          const evaluated = await this.evaluateRoutingCandidate(
            {
              id: pick.model_id || pick.id,
              tier,
              provider: pick.provider,
              apiKey: pick.api_key || null,
              endpoint: pick.endpoint || null,
              source: 'purpose_assignment',
              raw: pick,
              healthStatus: pick.health_status || null,
            },
            trace,
            candidateSeen,
            skipSeen,
            params,
            orgPolicy
          );
          if (evaluated) {
            trace.selected = trace.candidates[0] || null;
            evaluated.routingTrace = trace;
            return evaluated;
          }
        }
      } catch (e: any) {
        aiLogger.warn('ModelRouter', `Purpose routing failed: ${e?.message || String(e)}`);
      }

      if (MODEL_REGISTRY_ENABLED && organizationId) {
        for (const routingKey of getRoutingPurposeKeys(capability)) {
          try {
            const assignments = await modelRegistryService.getAssignmentsByPurpose(routingKey);
            const ordered = assignments
              .filter((a) => a.isActive)
              .sort((a, b) => a.priority - b.priority);
            for (const assignment of ordered) {
              const model = await modelRegistryService.getModel(assignment.registryModelId);
              if (!model) {
                this.addTraceSkip(
                  trace.skipped,
                  skipSeen,
                  {
                    provider: 'unknown',
                    id: assignment.registryModelId,
                    source: 'model_registry',
                  },
                  'registry_model_missing'
                );
                continue;
              }

              const config = await this.getProviderConfig(
                model.modelId,
                (assignment.tier || tier) as Tier
              );
              const evaluated = await this.evaluateRoutingCandidate(
                {
                  ...config,
                  source: assignment.fallbackModelId ? 'model_registry_fallback' : 'model_registry',
                  healthStatus: model.healthStatus || config.healthStatus || null,
                },
                trace,
                candidateSeen,
                skipSeen,
                params,
                orgPolicy
              );
              if (evaluated) {
                trace.selected = trace.candidates[0] || null;
                evaluated.routingTrace = trace;
                return evaluated;
              }
            }
          } catch (e: any) {
            aiLogger.warn(
              'ModelRouter',
              `Model registry routing failed for ${routingKey}: ${e?.message || String(e)}`
            );
          }
        }
      }
    }

    const availableModelsRaw = await this.getModelsForTier(tier, organizationId);
    const candidates = MULTI_PROVIDER_ENABLED
      ? availableModelsRaw.filter((m) => this.isProviderUsable(m))
      : availableModelsRaw.filter((m) => String(m.provider || '').toLowerCase() === 'openrouter');

    const availableModels = requirements
      ? candidates.filter((m) =>
          modelMeetsRequirements(
            this.normalizeModelIdForCapabilities(String((m as any).model_id || m.id || '')),
            requirements
          )
        )
      : candidates;

    const availableModelsAfterPolicy = ORG_POLICY_ENABLED
      ? availableModels.filter((m) => this.isAllowedByOrgPolicyInternal(m, params, orgPolicy))
      : availableModels;

    if (availableModelsAfterPolicy.length > 0) {
      const applied = await routingRulesService.applyRulesToCandidates({
        candidates: availableModelsAfterPolicy as any,
        tier,
        purpose: capability,
        organizationId: organizationId || null,
      });

      const candidatesAfterRules = applied.candidates || [];
      const strategy = applied.selectionStrategy?.kind || 'round_robin';

      const orderedCandidates =
        strategy === 'weighted_random' && candidatesAfterRules.length > 0
          ? ([
              routingRulesService.pickWeightedRandom(
                candidatesAfterRules as any,
                applied.selectionStrategy?.weights
              ),
              ...candidatesAfterRules,
            ].filter(Boolean) as ProviderRow[])
          : (candidatesAfterRules as ProviderRow[]);
      for (const selectedModel of orderedCandidates) {
        const evaluated = await this.evaluateRoutingCandidate(
          {
            id: selectedModel.model_id || selectedModel.id,
            tier,
            provider: selectedModel.provider,
            apiKey: selectedModel.api_key || null,
            endpoint: selectedModel.endpoint || null,
            source: 'tier_assignment',
            raw: selectedModel,
            healthStatus: selectedModel.health_status || null,
          },
          trace,
          candidateSeen,
          skipSeen,
          params,
          orgPolicy
        );
        if (evaluated) {
          aiLogger.info(
            'ModelRouter',
            `Selected via ${strategy === 'weighted_random' ? 'weighted routing' : 'tier assignment'}: ${
              selectedModel.model_id
            } (${selectedModel.provider})`
          );
          trace.selected = trace.candidates[0] || null;
          evaluated.routingTrace = trace;
          return evaluated;
        }
      }
    }

    const configService = await getLLMConfigService();
    if (configService) {
      try {
        const fallbackChain = await configService.getFallbackChain(tier);
        for (const providerId of fallbackChain) {
          const providerConfig = await configService.getProviderConfig(providerId);
          if (providerConfig && providerConfig.isConfigured) {
            aiLogger.info('ModelRouter', `Selected ${providerId} from config service for ${tier}`);
            const evaluated = await this.evaluateRoutingCandidate(
              {
                id: providerConfig.model_id || providerConfig.id,
                tier,
                provider: providerConfig.provider,
                apiKey: providerConfig.api_key || null,
                endpoint: providerConfig.endpoint || null,
                healthStatus: providerConfig.healthStatus || null,
                source: 'config_service_fallback',
              },
              trace,
              candidateSeen,
              skipSeen,
              params,
              orgPolicy
            );
            if (evaluated) {
              trace.selected = trace.candidates[0] || null;
              evaluated.routingTrace = trace;
              return evaluated;
            }
          }
        }
      } catch (error: unknown) {
        const err = error as Error;
        aiLogger.warn('ModelRouter', `LLMConfigService fallback failed: ${err.message}`);
      }
    }

    const defaultProvider = await this.getDefaultProvider();
    if (
      defaultProvider &&
      String(defaultProvider.provider || '').toLowerCase() === 'openrouter' &&
      defaultProvider.api_key &&
      modelMeetsRequirements(
        String(defaultProvider.model_id || defaultProvider.id || ''),
        requirements
      )
    ) {
      const evaluated = await this.evaluateRoutingCandidate(
        {
          id: defaultProvider.model_id || defaultProvider.id,
          tier,
          provider: defaultProvider.provider,
          apiKey: defaultProvider.api_key || null,
          endpoint: defaultProvider.endpoint || null,
          source: 'database_default',
          raw: defaultProvider,
          healthStatus: defaultProvider.health_status || null,
        },
        trace,
        candidateSeen,
        skipSeen,
        params,
        orgPolicy
      );
      if (evaluated) {
        aiLogger.info(
          'ModelRouter',
          `Using database default: ${defaultProvider.model_id} (${defaultProvider.provider})`
        );
        trace.selected = trace.candidates[0] || null;
        evaluated.routingTrace = trace;
        return evaluated;
      }
    }

    // Static fallback (OpenRouter-only)
    const staticCandidates = [TIER_DEFAULTS[tier], ...(TIER_FALLBACK_CHAINS[tier] || [])];
    for (const staticPick of staticCandidates) {
      if (!modelMeetsRequirements(String(staticPick || ''), requirements)) continue;
      const evaluated = await this.evaluateRoutingCandidate(
        {
          ...(await this.getProviderConfig(staticPick, tier)),
          source: 'static_fallback',
        },
        trace,
        candidateSeen,
        skipSeen,
        params,
        orgPolicy
      );
      if (evaluated) {
        aiLogger.warn('ModelRouter', `Using static fallback: ${staticPick} for tier ${tier}`);
        trace.selected = trace.candidates[0] || null;
        evaluated.routingTrace = trace;
        return evaluated;
      }
    }
    throw new Error(
      `No routable model satisfies requirements for tier ${tier} (capability=${capability || 'n/a'})`
    );
  }

  async getRuntimeFallbackCandidates(
    params: SelectParams,
    excludeModelIds: string[] = []
  ): Promise<ProviderConfig[]> {
    const requestedPurpose = params.purpose || params.capability;
    const capability = normalizePurposeKey(requestedPurpose) || requestedPurpose;
    const { organizationId, requirements } = params;
    const tier = (params.options?.tier ||
      params.tier ||
      CAPABILITY_TIERS[capability || ''] ||
      CAPABILITY_TIERS[String(requestedPurpose || '')] ||
      'STANDARD') as Tier;
    const orgPolicy =
      ORG_POLICY_ENABLED && organizationId ? await this.getOrgPolicy(organizationId) : null;
    const trace: RoutingTrace = {
      requestedPurpose: requestedPurpose ? String(requestedPurpose) : null,
      normalizedPurpose: capability ? String(capability) : null,
      organizationId: organizationId || null,
      tier,
      downgradeReason: null,
      selected: null,
      candidates: [],
      skipped: [],
    };
    const candidateSeen = new Set<string>();
    const skipSeen = new Set<string>();
    const excluded = new Set(excludeModelIds.map((id) => String(id || '').toLowerCase()));
    const candidates: ProviderConfig[] = [];

    const maybePush = async (config: ProviderConfig | null) => {
      const evaluated = await this.evaluateRoutingCandidate(
        config,
        trace,
        candidateSeen,
        skipSeen,
        params,
        orgPolicy
      );
      if (!evaluated) return;
      if (excluded.has(String(evaluated.id || '').toLowerCase())) {
        this.addTraceSkip(trace.skipped, skipSeen, evaluated, 'excluded_from_retry');
        return;
      }
      candidates.push(evaluated);
    };

    if (PURPOSE_ROUTING_ENABLED && capability) {
      const assigned = await this.getModelsForPurpose(capability, organizationId);
      for (const pick of assigned) {
        await maybePush({
          id: pick.model_id || pick.id,
          tier,
          provider: pick.provider,
          apiKey: pick.api_key || null,
          endpoint: pick.endpoint || null,
          source: 'purpose_assignment',
          raw: pick,
          healthStatus: pick.health_status || null,
        });
      }

      if (MODEL_REGISTRY_ENABLED && organizationId) {
        for (const routingKey of getRoutingPurposeKeys(capability)) {
          const assignments = await modelRegistryService.getAssignmentsByPurpose(routingKey);
          for (const assignment of assignments
            .filter((a) => a.isActive)
            .sort((a, b) => a.priority - b.priority)) {
            const model = await modelRegistryService.getModel(assignment.registryModelId);
            if (!model) continue;
            const baseConfig = await this.getProviderConfig(
              model.modelId,
              (assignment.tier || tier) as Tier
            );
            await maybePush({
              ...baseConfig,
              source: assignment.fallbackModelId ? 'model_registry_fallback' : 'model_registry',
              healthStatus: model.healthStatus || baseConfig.healthStatus || null,
            });
          }
        }
      }
    }

    const tierCandidates = await this.getModelsForTier(tier, organizationId);
    for (const model of tierCandidates) {
      await maybePush({
        id: model.model_id || model.id,
        tier,
        provider: model.provider,
        apiKey: model.api_key || null,
        endpoint: model.endpoint || null,
        source: 'tier_assignment',
        raw: model,
        healthStatus: model.health_status || null,
      });
    }

    const configService = await getLLMConfigService();
    if (configService) {
      try {
        const fallbackChain = await configService.getFallbackChain(tier);
        for (const providerId of fallbackChain) {
          const providerConfig = await configService.getProviderConfig(providerId);
          if (!providerConfig?.isConfigured) continue;
          await maybePush({
            id: providerConfig.model_id || providerConfig.id,
            tier,
            provider: providerConfig.provider,
            apiKey: providerConfig.api_key || null,
            endpoint: providerConfig.endpoint || null,
            healthStatus: providerConfig.healthStatus || null,
            source: 'config_service_fallback',
          });
        }
      } catch {
        // fail open
      }
    }

    for (const modelId of [TIER_DEFAULTS[tier], ...(TIER_FALLBACK_CHAINS[tier] || [])]) {
      if (!modelMeetsRequirements(String(modelId || ''), requirements)) continue;
      await maybePush({
        ...(await this.getProviderConfig(modelId, tier)),
        source: 'static_fallback',
      });
    }

    if (candidates[0]) {
      trace.selected = trace.candidates[0] || null;
    }
    for (const candidate of candidates) {
      candidate.routingTrace = trace;
    }
    return candidates;
  }

  /**
   * V3-A06: Resolve model by purpose using the model registry.
   * Uses health gating, org policy, fallback chain. Throws on no candidate (no silent degradation).
   */
  async resolveByPurpose(
    purpose: string,
    organizationId: string,
    options?: {
      tier?: string;
      requirements?: ModelRequirements;
      dataClass?: 'no_pii' | 'pii' | 'confidential';
      preferLocal?: boolean;
    }
  ): Promise<ProviderConfig> {
    const req = {
      organizationId,
      purpose,
      requirements: options?.requirements
        ? {
            vision: options.requirements.vision,
            tools: options.requirements.tools,
            streaming: options.requirements.streaming,
            jsonMode: (options.requirements as any).jsonMode,
            contextWindow: (options.requirements as any).contextWindow,
          }
        : undefined,
      options: {
        preferLocal: options?.preferLocal,
        dataClass: options?.dataClass,
      },
    };

    const result = await modelRegistryService.resolveModel(req);
    const baseConfig = await this.getProviderConfig(
      result.modelId,
      (options?.tier || 'STANDARD') as Tier
    );
    return {
      ...baseConfig,
      id: result.modelId,
      source: result.isFallback ? 'model_registry_fallback' : 'model_registry',
      raw: baseConfig.raw
        ? ({ ...baseConfig.raw, modelRegistryId: result.modelRegistryId } as ProviderRow)
        : null,
    };
  }

  async getModelsForPurpose(purpose: string, organizationId?: string): Promise<ProviderRow[]> {
    const p = String(purpose || '').trim();
    if (!p) return [];

    const fetchRows = async (routingKey: string): Promise<ProviderRow[]> => {
      const activeSql = (expr: string) =>
        `COALESCE(NULLIF(LOWER(TRIM(CAST(${expr} AS TEXT))), ''), 'false') IN ('1','t','true','y','yes','on')`;
      const query = organizationId
        ? `
        SELECT
          lp.*,
          apa.priority as purpose_priority,
          apa.release_bundle_id,
          apa.prompt_key,
          apa.prompt_version,
          apa.policy_version
        FROM ai_purpose_assignments apa
        INNER JOIN llm_providers lp ON lp.id = apa.provider_id
        LEFT JOIN organization_provider_settings ops ON lp.id = ops.provider_id AND ops.organization_id = ?
        WHERE apa.purpose = ?
          AND (apa.organization_id = ? OR apa.organization_id IS NULL)
          AND ${activeSql('apa.is_active')}
          AND ${activeSql('lp.is_active')}
          AND (ops.is_enabled IS NULL OR ${sqlTruthy('ops.is_enabled')})
          AND (lp.health_status IS NULL OR lp.health_status != 'unhealthy')
        ORDER BY
          CASE WHEN apa.organization_id = ? THEN 0 ELSE 1 END,
          apa.priority,
          lp.cost_per_1k,
          lp.priority
      `
        : `
        SELECT
          lp.*,
          apa.priority as purpose_priority,
          apa.release_bundle_id,
          apa.prompt_key,
          apa.prompt_version,
          apa.policy_version
        FROM ai_purpose_assignments apa
        INNER JOIN llm_providers lp ON lp.id = apa.provider_id
        WHERE apa.purpose = ?
          AND apa.organization_id IS NULL
          AND ${activeSql('apa.is_active')}
          AND ${activeSql('lp.is_active')}
          AND (lp.health_status IS NULL OR lp.health_status != 'unhealthy')
        ORDER BY apa.priority, lp.cost_per_1k, lp.priority
      `;

      const params = organizationId
        ? [organizationId, routingKey, organizationId, organizationId]
        : [routingKey];

      try {
        return await DbPromise.all<ProviderRow>(query, params, { fallback: true });
      } catch {
        return [];
      }
    };

    for (const routingKey of getRoutingPurposeKeys(p)) {
      const rows = await fetchRows(routingKey);
      if (rows.length > 0) return rows;
    }

    return [];
  }

  async getModelsForTier(tier: Tier, organizationId?: string): Promise<ProviderRow[]> {
    let query: string;
    let params: unknown[];

    if (organizationId) {
      query = `
                SELECT p.*, mta.priority as tier_priority
                FROM llm_providers p
                INNER JOIN llm_tier_assignments mta ON p.id = mta.provider_id
                LEFT JOIN organization_provider_settings ops ON p.id = ops.provider_id AND ops.organization_id = ?
                WHERE mta.tier = ?
                  AND ${sqlTruthy('mta.is_active')}
                  AND ${sqlTruthy('p.is_active')}
                  AND (ops.is_enabled IS NULL OR ${sqlTruthy('ops.is_enabled')})
                  AND (p.health_status IS NULL OR p.health_status != 'unhealthy')
                ORDER BY COALESCE(ops.custom_priority, mta.priority), p.cost_per_1k, p.priority
            `;
      params = [organizationId, tier];
    } else {
      query = `
                SELECT p.*, mta.priority as tier_priority
                FROM llm_providers p
                INNER JOIN llm_tier_assignments mta ON p.id = mta.provider_id
                WHERE mta.tier = ?
                  AND ${sqlTruthy('mta.is_active')}
                  AND ${sqlTruthy('p.is_active')}
                  AND (p.health_status IS NULL OR p.health_status != 'unhealthy')
                ORDER BY mta.priority, p.cost_per_1k, p.priority
            `;
      params = [tier];
    }

    try {
      return await DbPromise.all<ProviderRow>(query, params, { fallback: false });
    } catch (error: unknown) {
      const err = error as Error;
      aiLogger.error('ModelRouter', `Failed to get models for tier ${tier}: ${err.message}`);
      return [];
    }
  }

  async getAllTierAssignments(): Promise<Record<string, TierAssignmentRow[]>> {
    const query = `
            SELECT 
                mta.id,
                mta.tier,
                mta.priority,
                mta.is_active,
                p.id as provider_id,
                p.name,
                p.provider,
                p.model_id,
                p.health_status
            FROM llm_tier_assignments mta
            INNER JOIN llm_providers p ON mta.provider_id = p.id
            WHERE ${sqlTruthy('p.is_active')}
            ORDER BY mta.tier, mta.priority
        `;

    try {
      const rows = await DbPromise.all<TierAssignmentRow>(query, [], { fallback: false });
      const grouped: Record<string, TierAssignmentRow[]> = {};
      for (const row of rows || []) {
        if (!grouped[row.tier]) {
          grouped[row.tier] = [];
        }
        grouped[row.tier].push(row);
      }
      return grouped;
    } catch (error: unknown) {
      const err = error as Error;
      aiLogger.error('ModelRouter', `Failed to get tier assignments: ${err.message}`);
      return {};
    }
  }

  async selectWithRoundRobin(
    tier: Tier,
    organizationId: string | undefined,
    availableModels: ProviderRow[]
  ): Promise<ProviderRow | null> {
    if (!availableModels || availableModels.length === 0) {
      return null;
    }
    if (availableModels.length === 1) {
      return availableModels[0];
    }

    const lastUsed = await this.getLastUsedProvider(tier, organizationId);
    const lastIndex = lastUsed ? availableModels.findIndex((model) => model.id === lastUsed) : -1;

    const nextIndex = (lastIndex + 1) % availableModels.length;
    const selectedModel = availableModels[nextIndex];

    await this.updateLastUsedProvider(tier, organizationId, selectedModel.id);

    aiLogger.info(
      'ModelRouter',
      `Round-robin selected: ${selectedModel.name} (index ${nextIndex}/${availableModels.length})`
    );
    return selectedModel;
  }

  async getLastUsedProvider(tier: Tier, organizationId?: string): Promise<string | null> {
    // Split queries: Postgres can't infer type of "$3 IS NULL" when $3 is null
    const query =
      organizationId == null
        ? `SELECT last_provider_id FROM tier_round_robin_state WHERE tier = ? AND organization_id IS NULL`
        : `SELECT last_provider_id FROM tier_round_robin_state WHERE tier = ? AND organization_id = ?`;
    const params = organizationId == null ? [tier] : [tier, organizationId];
    const row = await DbPromise.get<{ last_provider_id?: string }>(query, params, {
      fallback: true,
    });
    return row?.last_provider_id || null;
  }

  async updateLastUsedProvider(
    tier: Tier,
    organizationId: string | undefined,
    providerId: string
  ): Promise<void> {
    const id = `${organizationId || 'global'}-${tier}`;
    const query = `
            INSERT OR REPLACE INTO tier_round_robin_state (id, organization_id, tier, last_provider_id, last_used_at)
            VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
        `;
    try {
      await DbPromise.run(query, [id, organizationId, tier, providerId], { fallback: true });
    } catch (error: unknown) {
      const err = error as Error;
      aiLogger.warn('ModelRouter', `Failed to update round-robin state: ${err.message}`);
    }
  }

  async selectFallback(
    tier: Tier,
    excludeModels: string[] = [],
    organizationId: string | null = null
  ): Promise<ProviderConfig | null> {
    const excludeSet = new Set(excludeModels.map((model) => model.toLowerCase()));

    const sameTierModels = await this.getModelsForTier(tier, organizationId || undefined);
    for (const model of sameTierModels) {
      if (!excludeSet.has((model.model_id || '').toLowerCase())) {
        aiLogger.info('ModelRouter', `Fallback within tier ${tier}: ${model.model_id}`);
        return {
          id: model.model_id || model.id,
          tier,
          provider: model.provider,
          apiKey: model.api_key || null,
          endpoint: model.endpoint || null,
          source: 'fallback_same_tier',
        };
      }
    }

    const tierIndex = TIER_HIERARCHY.indexOf(tier as (typeof TIER_HIERARCHY)[number]);
    for (let i = tierIndex - 1; i >= 0; i--) {
      const fallbackTier = TIER_HIERARCHY[i];
      const fallbackModels = await this.getModelsForTier(fallbackTier, organizationId || undefined);

      for (const model of fallbackModels) {
        if (!excludeSet.has((model.model_id || '').toLowerCase())) {
          aiLogger.info(
            'ModelRouter',
            `Cross-tier fallback from ${tier} to ${fallbackTier}: ${model.model_id}`
          );
          return {
            id: model.model_id || model.id,
            tier: fallbackTier,
            provider: model.provider,
            apiKey: model.api_key || null,
            endpoint: model.endpoint || null,
            source: 'fallback_lower_tier',
            originalTier: tier,
          };
        }
      }
    }

    const configService = await getLLMConfigService();
    if (configService) {
      try {
        const excludeProviders = excludeModels.map((model) => this.inferProvider(model));
        const nextProvider = await configService.getNextFallback(excludeProviders, tier);
        if (nextProvider) {
          aiLogger.info(
            'ModelRouter',
            `Selected fallback from config service: ${nextProvider.provider}`
          );
          return {
            id: nextProvider.model_id || nextProvider.id,
            tier,
            provider: nextProvider.provider,
            apiKey: nextProvider.api_key || null,
            endpoint: nextProvider.endpoint || null,
          };
        }
      } catch (error: unknown) {
        const err = error as Error;
        aiLogger.warn('ModelRouter', `Config service fallback failed: ${err.message}`);
      }
    }

    return this.getAnyActiveProvider(tier, excludeModels);
  }

  async getAnyActiveProvider(
    tier: Tier,
    excludeModels: string[] = []
  ): Promise<ProviderConfig | null> {
    const excludeProviders = new Set(excludeModels.map((model) => this.inferProvider(model)));

    const row = await DbPromise.get<ProviderRow>(
      `SELECT * FROM llm_providers 
             WHERE ${sqlTruthy('is_active')} AND api_key IS NOT NULL AND api_key != ''
             ORDER BY is_default DESC, priority DESC LIMIT 1`,
      [],
      { fallback: true }
    );

    if (row && !excludeProviders.has(row.provider)) {
      aiLogger.info('ModelRouter', `Ultimate fallback: ${row.provider}`);
      return {
        id: row.model_id || row.id,
        tier,
        provider: row.provider,
        apiKey: row.api_key || null,
        endpoint: row.endpoint || null,
      };
    }

    aiLogger.error('ModelRouter', 'No providers available for fallback');
    return null;
  }

  async assignModelToTier(
    providerId: string,
    tier: Tier,
    priority = 0
  ): Promise<{ id: string; providerId: string; tier: Tier; priority: number }> {
    const id = `${providerId}-${tier}`;
    const query = `
            INSERT OR REPLACE INTO llm_tier_assignments (id, provider_id, tier, priority, is_active, updated_at)
            VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `;
    await DbPromise.run(query, [id, providerId, tier, priority, 1], { fallback: false });
    aiLogger.info(
      'ModelRouter',
      `Assigned provider ${providerId} to tier ${tier} with priority ${priority}`
    );
    return { id, providerId, tier, priority };
  }

  async removeModelFromTier(providerId: string, tier: Tier): Promise<{ success: true }> {
    const query = `DELETE FROM llm_tier_assignments WHERE provider_id = ? AND tier = ?`;
    await DbPromise.run(query, [providerId, tier], { fallback: false });
    aiLogger.info('ModelRouter', `Removed provider ${providerId} from tier ${tier}`);
    return { success: true };
  }

  async updateTierPriority(
    providerId: string,
    tier: Tier,
    priority: number
  ): Promise<{ success: true }> {
    const query = `
            UPDATE llm_tier_assignments 
            SET priority = ?, updated_at = CURRENT_TIMESTAMP
            WHERE provider_id = ? AND tier = ?
        `;
    await DbPromise.run(query, [priority, providerId, tier], { fallback: false });
    return { success: true };
  }

  async setOrgProviderEnabled(
    organizationId: string,
    providerId: string,
    isEnabled: boolean
  ): Promise<{ success: true }> {
    const id = `${organizationId}-${providerId}`;
    const query = `
            INSERT OR REPLACE INTO organization_provider_settings 
            (id, organization_id, provider_id, is_enabled, updated_at)
            VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
        `;
    await DbPromise.run(query, [id, organizationId, providerId, isEnabled ? 1 : 0], {
      fallback: false,
    });
    aiLogger.info(
      'ModelRouter',
      `Set provider ${providerId} enabled=${isEnabled} for org ${organizationId}`
    );
    return { success: true };
  }

  async getOrgProviderSettings(
    organizationId: string
  ): Promise<Array<ProviderRow & { is_enabled_for_org: number; custom_priority?: number }>> {
    const query = `
            SELECT 
                p.*,
                COALESCE(ops.is_enabled, 1) as is_enabled_for_org,
                ops.custom_priority
            FROM llm_providers p
            LEFT JOIN organization_provider_settings ops 
                ON p.id = ops.provider_id AND ops.organization_id = ?
            WHERE ${sqlTruthy('p.is_active')}
            ORDER BY p.priority
        `;
    return DbPromise.all(query, [organizationId], { fallback: true });
  }

  async getProviderConfig(modelId: string, tier: Tier): Promise<ProviderConfig> {
    const providerName = this.inferProvider(modelId);

    const normalizeOpenRouterModelId = (id: string): string => {
      const raw = String(id || '').trim();
      if (!raw) return raw;
      if (raw.includes('/') && !raw.includes('://')) return raw;
      const lower = raw.toLowerCase();
      if (lower === 'gpt-4o') return 'openai/gpt-4o';
      if (lower === 'gpt-4o-mini') return 'openai/gpt-4o-mini';
      if (lower === 'o1-preview') return 'openai/o1-preview';
      if (lower === 'o1-mini' || lower === 'o1') return 'openai/o1-mini';
      if (lower.startsWith('claude')) return `anthropic/${raw}`;
      if (lower.startsWith('gemini')) return `google/${raw}`;
      return raw;
    };

    const requestedModelId =
      providerName === 'openrouter' ? normalizeOpenRouterModelId(modelId) : modelId;

    // Cache provider rows — they change only on admin config updates (router:config_update flushes).
    const CACHE_KEY = `router:provider_cfg:${providerName}:${requestedModelId}`;
    let provider: ProviderRow | null | undefined;
    try {
      // NOTE: appCache.get() returns `null` on a cache MISS (Redis CacheService:
      // `if (!data) return null`), never `undefined`. The old check
      // `if (cached !== undefined)` therefore treated every miss as a cached
      // `null`, leaving `provider = null` so the DB query below (gated on
      // `provider === undefined`) NEVER ran. Providers whose API key lives only
      // in the DB (e.g. deepseek/deepseek-reasoner — key not in process.env)
      // then fell through to the env fallback, found no key, and were skipped as
      // "unconfigured". Only treat a TRUTHY cached row as a hit; a null/miss must
      // re-query the DB.
      const cached = await appCache.get<ProviderRow | null>(CACHE_KEY);
      if (cached) provider = cached;
    } catch {
      /* ignore */
    }

    if (provider === undefined) {
      provider = await DbPromise.get<ProviderRow>(
        `SELECT * FROM llm_providers
               WHERE provider = ? AND ${sqlTruthy('is_active')}
               AND (model_id = ? OR model_id IS NULL OR model_id = '')
               LIMIT 1`,
        [providerName, requestedModelId],
        { fallback: true }
      );

      if (!provider) {
        provider = await DbPromise.get<ProviderRow>(
          `SELECT * FROM llm_providers WHERE provider = ? AND ${sqlTruthy('is_active')} LIMIT 1`,
          [providerName],
          { fallback: true }
        );
      }

      try {
        await appCache.set(CACHE_KEY, provider ?? null, 300); // 5 mins, flushed on config_update
      } catch {
        /* ignore */
      }
    }

    if (!provider || !provider.api_key) {
      const envKey = this.getEnvKeyForProvider(providerName);
      const envApiKey = process.env[envKey];
      if (envApiKey) {
        aiLogger.info('ModelRouter', `Using env fallback for ${providerName}`);
        return {
          id: requestedModelId,
          tier,
          provider: providerName,
          apiKey: envApiKey,
          endpoint: this.getDefaultEndpoint(providerName),
          source: 'platform',
          markupMultiplier: 1.0,
          raw: null,
        };
      }
    }

    return {
      id:
        providerName === 'openrouter'
          ? normalizeOpenRouterModelId(String(provider?.model_id || requestedModelId))
          : provider?.model_id || requestedModelId,
      tier,
      provider: providerName,
      apiKey: provider?.api_key || null,
      endpoint: provider?.endpoint || this.getDefaultEndpoint(providerName),
      source: provider?.api_key ? 'organization' : 'platform',
      markupMultiplier: provider?.markup_multiplier || 1.0,
      raw: provider || null,
    };
  }

  async getDefaultProvider(): Promise<ProviderRow | null> {
    const CACHE_KEY = 'router:default_provider';

    try {
      const cached = await appCache.get<ProviderRow>(CACHE_KEY);
      if (cached) return cached;
    } catch (err) {
      /* ignore */
    }

    const row = await DbPromise.get<ProviderRow>(
      `SELECT * FROM llm_providers WHERE ${sqlTruthy('is_default')} AND ${sqlTruthy('is_active')} LIMIT 1`,
      [],
      { fallback: true }
    );

    if (row) {
      await appCache.set(CACHE_KEY, row, 300); // 5 mins
    }
    return row || null;
  }

  async getOrgOverride(organizationId?: string, capability?: string): Promise<OverrideRow | null> {
    if (!organizationId || !capability) return null;

    const CACHE_KEY = `router:override:${organizationId}:${capability}`;

    try {
      const cached = await appCache.get<OverrideRow>(CACHE_KEY);
      if (cached) return cached;
    } catch (err) {
      /* ignore */
    }

    const row = await DbPromise.get<OverrideRow>(
      `SELECT * FROM ai_model_overrides WHERE organization_id = ? AND capability = ?`,
      [organizationId, capability],
      { fallback: true }
    );

    await appCache.set(CACHE_KEY, row || null, 300); // 5 mins

    return row || null;
  }

  getFallbackChain(tier: Tier): string[] {
    return TIER_FALLBACK_CHAINS[tier] || TIER_FALLBACK_CHAINS.STANDARD;
  }

  inferProvider(modelId?: string): string {
    if (!modelId) return 'openrouter';

    // OpenRouter uses namespaced model IDs like "openai/gpt-4o".
    // Treat any "org/model" id as OpenRouter unless it is a URL.
    if (modelId.includes('/') && !modelId.includes('://')) {
      return 'openrouter';
    }

    const mapped = MODEL_PROVIDER_MAP[modelId];
    if (mapped) return mapped;

    const modelLower = modelId.toLowerCase();
    // DeepSeek direct-API models (deepseek-reasoner / deepseek-chat) — route to
    // the deepseek provider (direct endpoint), never to OpenRouter, so the
    // reasoning_content channel from DeepSeek-R1 is preserved.
    if (modelLower.startsWith('deepseek')) {
      return 'deepseek';
    }
    if (
      modelLower.startsWith('gpt') ||
      modelLower.startsWith('o1') ||
      modelLower.startsWith('claude') ||
      modelLower.startsWith('gemini')
    ) {
      return 'openrouter';
    }

    return 'openrouter';
  }

  private normalizeModelIdForCapabilities(modelId: string): string {
    const raw = String(modelId || '').trim();
    if (!raw) return raw;
    // OpenRouter often uses namespaced ids like "openai/gpt-4o".
    if (raw.includes('/') && !raw.includes('://')) {
      return raw.split('/').slice(-1)[0] || raw;
    }
    return raw;
  }

  private isProviderUsable(row: ProviderRow): boolean {
    const provider = String(row.provider || '').toLowerCase();
    const apiKey = String(row.api_key || '').trim();

    // If a DB key exists, it's usable.
    if (apiKey) return true;

    // Some providers can be configured via env vars (llmService prefers env keys).
    if (provider === 'openrouter') return !!process.env.OPENROUTER_API_KEY?.trim();
    if (provider === 'openai') return !!process.env.OPENAI_API_KEY?.trim();
    if (provider === 'anthropic') return !!process.env.ANTHROPIC_API_KEY?.trim();
    if (provider === 'google' || provider === 'gemini') {
      return !!(
        process.env.GEMINI_API_KEY ||
        process.env.GOOGLE_AI_API_KEY ||
        (process.env as any).GOOGLE_API_KEY
      )?.trim();
    }
    if (provider === 'deepseek') return !!process.env.DEEPSEEK_API_KEY?.trim();
    if (provider === 'zai' || provider === 'z_ai') return !!process.env.ZAI_API_KEY?.trim();
    if (provider === 'replicate') {
      return !!(process.env.REPLICATE_API_TOKEN || process.env.REPLICATE_API_KEY)?.trim();
    }

    // Local providers usually don't require an API key.
    if (provider === 'ollama') return true;

    // Otherwise: require DB key.
    return false;
  }

  private isAllowedByOrgPolicyInternal(
    row: ProviderRow,
    params: SelectParams,
    policy: any | null
  ): boolean {
    const dataClass = params.dataClass || 'no_pii';
    if (!ORG_POLICY_ENABLED) return true;

    const pt = String(row.provider_type || '').toLowerCase() || 'unknown';
    const origin = String(row.origin_vendor || '').toLowerCase() || 'unknown';
    const regions = this.normalizeRegions(row.execution_regions);

    if (policy && typeof policy === 'object') {
      const denyProviderTypes = this.normalizeStringSet(
        policy.deny_provider_types || policy.denyProviderTypes
      );
      if (denyProviderTypes.size > 0 && denyProviderTypes.has(pt)) return false;

      const allowProviderTypes = this.normalizeStringSet(
        policy.allow_provider_types || policy.allowProviderTypes
      );
      if (allowProviderTypes.size > 0 && !allowProviderTypes.has(pt)) return false;

      const denyOrigins = this.normalizeStringSet(policy.deny_origin_vendors || policy.denyOrigins);
      if (denyOrigins.size > 0 && denyOrigins.has(origin)) return false;

      const allowOrigins = this.normalizeStringSet(
        policy.allow_origin_vendors || policy.allowOrigins
      );
      if (allowOrigins.size > 0 && !allowOrigins.has(origin)) return false;

      const denyRegions = this.normalizeStringSet(policy.deny_regions || policy.denyRegions);
      if (denyRegions.size > 0 && regions.some((r) => denyRegions.has(r))) return false;

      const allowRegions = this.normalizeStringSet(policy.allow_regions || policy.allowRegions);
      if (allowRegions.size > 0 && !regions.some((r) => allowRegions.has(r))) return false;

      const requireLocalFor = this.normalizeStringSet(
        policy.require_local_for_data_classes || policy.requireLocalForDataClasses
      );
      if (requireLocalFor.size > 0 && requireLocalFor.has(dataClass)) {
        if (pt !== 'local' && pt !== 'customer_managed') return false;
      }
    } else {
      // No explicit policy stored: still enforce "confidential -> local" if the caller asked for it.
      if (dataClass === 'confidential') {
        if (pt !== 'local' && pt !== 'customer_managed') return false;
      }
    }
    return true;
  }

  private normalizeRegions(value: any): string[] {
    try {
      if (!value) return ['UNKNOWN'];
      if (Array.isArray(value)) {
        return value.map((x) => String(x).trim().toUpperCase()).filter(Boolean);
      }
      const s = String(value || '').trim();
      if (!s) return ['UNKNOWN'];
      if (s.startsWith('[')) {
        const arr = JSON.parse(s);
        if (Array.isArray(arr)) {
          return arr.map((x) => String(x).trim().toUpperCase()).filter(Boolean);
        }
      }
      // Comma separated
      return s
        .split(',')
        .map((x) => x.trim().toUpperCase())
        .filter(Boolean);
    } catch {
      return ['UNKNOWN'];
    }
  }

  private normalizeStringSet(value: any): Set<string> {
    const out = new Set<string>();
    if (!value) return out;
    if (Array.isArray(value)) {
      for (const v of value) {
        const s = String(v || '')
          .trim()
          .toLowerCase();
        if (s) out.add(s);
      }
      return out;
    }
    const s = String(value || '').trim();
    if (!s) return out;
    for (const item of s.split(',')) {
      const v = String(item || '')
        .trim()
        .toLowerCase();
      if (v) out.add(v);
    }
    return out;
  }

  private async getOrgPolicy(organizationId: string): Promise<any | null> {
    const orgId = String(organizationId || '').trim();
    if (!orgId) return null;
    const CACHE_KEY = `router:org_policy:${orgId}`;
    try {
      const cached = await appCache.get<any>(CACHE_KEY);
      if (cached) return cached;
    } catch {
      /* ignore */
    }

    try {
      const row = await DbPromise.get<{ policy?: any }>(
        `SELECT policy FROM organization_ai_policy WHERE organization_id = ?`,
        [orgId],
        { fallback: true }
      );
      const raw = (row as any)?.policy ?? null;
      let parsed = raw;
      if (typeof raw === 'string') {
        try {
          parsed = JSON.parse(raw);
        } catch {
          parsed = null;
        }
      }
      await appCache.set(CACHE_KEY, parsed || null, 300);
      return parsed || null;
    } catch {
      return null;
    }
  }

  getEnvKeyForProvider(provider: string): string {
    const envKeys: Record<string, string> = {
      openrouter: 'OPENROUTER_API_KEY',
      openai: 'OPENAI_API_KEY',
      anthropic: 'ANTHROPIC_API_KEY',
      google: 'GEMINI_API_KEY',
      gemini: 'GEMINI_API_KEY',
      deepseek: 'DEEPSEEK_API_KEY',
      z_ai: 'ZAI_API_KEY',
      zai: 'ZAI_API_KEY',
      replicate: 'REPLICATE_API_TOKEN',
    };
    return envKeys[provider] || `${provider.toUpperCase()}_API_KEY`;
  }

  getDefaultEndpoint(provider: string): string | null {
    const endpoints: Record<string, string> = {
      // Base URL (not the /chat/completions path) — matches our llmService OpenRouter client usage.
      openrouter: 'https://openrouter.ai/api/v1',
      openai: 'https://api.openai.com/v1',
      anthropic: 'https://api.anthropic.com',
      google: 'https://generativelanguage.googleapis.com/v1beta',
      gemini: 'https://generativelanguage.googleapis.com/v1beta',
      deepseek: 'https://api.deepseek.com',
      z_ai: 'https://api.z.ai/api/paas/v4',
      zai: 'https://api.z.ai/api/paas/v4',
      replicate: 'https://api.replicate.com/v1',
    };
    return endpoints[provider] || null;
  }

  async clearCache(): Promise<void> {
    // Redis cache invalidation
    await appCache.delPattern('router:*');
    aiLogger.info('ModelRouter', 'Cache cleared via pattern match router:*');
  }

  async isProviderConfigured(_providerId: string): Promise<boolean> {
    const config = await this.getProviderConfig(TIER_DEFAULTS.STANDARD, 'STANDARD');
    return !!config?.apiKey;
  }

  async getConfiguredProviders(): Promise<ProviderRow[]> {
    return DbPromise.all(
      `SELECT * FROM llm_providers 
             WHERE ${sqlTruthy('is_active')} AND api_key IS NOT NULL AND api_key != ''
             ORDER BY priority DESC, is_default DESC`,
      [],
      { fallback: true }
    );
  }

  async route(
    capabilityOrUserId: string | SelectParams,
    intentOrCapability?: string
  ): Promise<{
    providerConfig:
      | ProviderRow
      | { model_id: string; provider: string; markup_multiplier?: number };
    orgId?: string;
    sourceType?: string;
    model: string;
  }> {
    let params: SelectParams = {};

    if (typeof capabilityOrUserId === 'object') {
      params = capabilityOrUserId;
    } else {
      params = {
        capability: intentOrCapability || 'chat',
      };
    }

    params.options = params.options || {};

    const result = await this.select(params);

    return {
      providerConfig: result.raw || {
        model_id: result.id,
        provider: result.provider,
        markup_multiplier: result.markupMultiplier,
      },
      orgId: params.organizationId,
      sourceType: result.source || 'platform',
      model: result.id,
    };
  }
}

export const modelRouter = new ModelRouter();

export default modelRouter;
