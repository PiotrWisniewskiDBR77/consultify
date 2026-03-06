/**
 * Preflight Cost Service (V4-AI-06)
 * Combines intent → cost estimate → tier recommendation with budget awareness.
 */

import { get as dbGet } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';
import { CAPABILITY_TIERS, TIER_DEFAULTS, type Tier } from './modelRouter.js';

const PRICING: Record<string, { input: number; output: number }> = {
  'openai/gpt-4o': { input: 2.5, output: 10 },
  'openai/gpt-4o-mini': { input: 0.15, output: 0.6 },
  'openai/o1-mini': { input: 3, output: 12 },
  'anthropic/claude-3.5-sonnet': { input: 3, output: 15 },
  'anthropic/claude-3.5-haiku': { input: 0.25, output: 1.25 },
  'google/gemini-2.0-flash': { input: 0.1, output: 0.4 },
  default: { input: 1, output: 4 },
};

export interface PreflightEstimate {
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  estimatedCostUsd: number;
  selectedTier: string;
  selectedModel: string;
  budgetStatus: {
    remainingBudget: number;
    percentUsed: number;
    wouldExceedBudget: boolean;
    suggestedDowngrade?: string;
  };
  tierJustification: string;
  alternatives: Array<{
    tier: string;
    model: string;
    estimatedCost: number;
    tradeoff: string;
  }>;
}

export interface BudgetStatusResult {
  totalBudget: number;
  spent: number;
  remaining: number;
  percentUsed: number;
  alerts: string[];
  tierAvailability: Record<string, boolean>;
}

export function estimateTokens(
  message: string,
  contextSize: number
): { input: number; output: number } {
  const inputTokens = Math.ceil((message.length + contextSize) / 4);
  const outputTokens = Math.ceil(inputTokens * 0.5);
  return { input: inputTokens, output: outputTokens };
}

function estimateCostForModel(
  modelId: string,
  inputTokens: number,
  outputTokens: number
): number {
  const pricing = PRICING[modelId] || PRICING['default'];
  const inputCost = (inputTokens / 1_000_000) * pricing.input;
  const outputCost = (outputTokens / 1_000_000) * pricing.output;
  return Math.round((inputCost + outputCost) * 1_000_000) / 1_000_000;
}

async function getOrgBudgetInfo(
  orgId: string
): Promise<{ budgetUsd: number; spentUsd: number }> {
  let budgetUsd = 0;
  let spentUsd = 0;

  try {
    const budgetRow = await dbGet<{ monthly_budget_usd?: number | null }>(
      `SELECT monthly_budget_usd FROM organizations WHERE id = ? LIMIT 1`,
      [orgId],
      { fallback: true } as any
    );
    budgetUsd = Number(budgetRow?.monthly_budget_usd) || 0;
  } catch {
    /* fail-open */
  }

  try {
    const spendRow = await dbGet<{ cost?: number | null }>(
      `SELECT COALESCE(SUM(estimated_cost_usd), 0) as cost
       FROM ai_usage_logs
       WHERE organization_id = ?
         AND status = 'success'
         AND created_at >= date('now', 'start of month')`,
      [orgId],
      { fallback: true } as any
    );
    spentUsd = Number(spendRow?.cost) || 0;
  } catch {
    /* fail-open */
  }

  return { budgetUsd, spentUsd };
}

function selectTierForIntent(intent: string): Tier {
  return (CAPABILITY_TIERS[intent] as Tier) || 'STANDARD';
}

const TIER_TRADEOFFS: Record<string, string> = {
  BUDGET: 'Fastest & cheapest; suitable for simple tasks',
  STANDARD: 'Good balance of quality and cost',
  PREMIUM: 'Highest quality output; higher cost',
  REASONING: 'Deep reasoning; highest cost and latency',
};

const TIER_ORDER: Tier[] = ['BUDGET', 'STANDARD', 'PREMIUM', 'REASONING'];

export async function preflightCostEstimate(
  orgId: string,
  message: string,
  intent: string,
  contextTokens: number
): Promise<PreflightEstimate> {
  const { input: estimatedInputTokens, output: estimatedOutputTokens } = estimateTokens(
    message,
    contextTokens
  );

  const selectedTier = selectTierForIntent(intent);
  const selectedModel = TIER_DEFAULTS[selectedTier] || TIER_DEFAULTS.STANDARD;
  const estimatedCostUsd = estimateCostForModel(
    selectedModel,
    estimatedInputTokens,
    estimatedOutputTokens
  );

  const { budgetUsd, spentUsd } = await getOrgBudgetInfo(orgId);
  const remaining = Math.max(0, budgetUsd - spentUsd);
  const percentUsed = budgetUsd > 0 ? Math.round((spentUsd / budgetUsd) * 10000) / 100 : 0;
  const wouldExceedBudget = budgetUsd > 0 && spentUsd + estimatedCostUsd > budgetUsd;

  let suggestedDowngrade: string | undefined;
  if (wouldExceedBudget && selectedTier !== 'BUDGET') {
    const tierIdx = TIER_ORDER.indexOf(selectedTier);
    for (let i = tierIdx - 1; i >= 0; i--) {
      const altTier = TIER_ORDER[i];
      const altModel = TIER_DEFAULTS[altTier] || TIER_DEFAULTS.BUDGET;
      const altCost = estimateCostForModel(altModel, estimatedInputTokens, estimatedOutputTokens);
      if (spentUsd + altCost <= budgetUsd) {
        suggestedDowngrade = altTier;
        break;
      }
    }
    if (!suggestedDowngrade) suggestedDowngrade = 'BUDGET';
  }

  const alternatives: PreflightEstimate['alternatives'] = [];
  for (const tier of TIER_ORDER) {
    if (tier === selectedTier) continue;
    const model = TIER_DEFAULTS[tier] || TIER_DEFAULTS.STANDARD;
    const cost = estimateCostForModel(model, estimatedInputTokens, estimatedOutputTokens);
    alternatives.push({
      tier,
      model,
      estimatedCost: cost,
      tradeoff: TIER_TRADEOFFS[tier] || '',
    });
  }

  return {
    estimatedInputTokens,
    estimatedOutputTokens,
    estimatedCostUsd,
    selectedTier,
    selectedModel,
    budgetStatus: {
      remainingBudget: Math.round(remaining * 100) / 100,
      percentUsed,
      wouldExceedBudget,
      suggestedDowngrade,
    },
    tierJustification: `Tier '${selectedTier}' selected for intent '${intent}'. ${TIER_TRADEOFFS[selectedTier] || ''}`,
    alternatives,
  };
}

export async function getBudgetStatus(orgId: string): Promise<BudgetStatusResult> {
  const { budgetUsd, spentUsd } = await getOrgBudgetInfo(orgId);
  const remaining = Math.max(0, budgetUsd - spentUsd);
  const percentUsed = budgetUsd > 0 ? Math.round((spentUsd / budgetUsd) * 10000) / 100 : 0;

  const alerts: string[] = [];
  if (percentUsed >= 100) alerts.push('Budget exceeded');
  else if (percentUsed >= 90) alerts.push('Budget critically low (>90% used)');
  else if (percentUsed >= 75) alerts.push('Budget warning (>75% used)');

  const tierAvailability: Record<string, boolean> = {};
  for (const tier of TIER_ORDER) {
    const model = TIER_DEFAULTS[tier] || TIER_DEFAULTS.STANDARD;
    const minCost = estimateCostForModel(model, 500, 250);
    tierAvailability[tier] = remaining >= minCost;
  }

  return {
    totalBudget: budgetUsd,
    spent: Math.round(spentUsd * 100) / 100,
    remaining: Math.round(remaining * 100) / 100,
    percentUsed,
    alerts,
    tierAvailability,
  };
}

export default {
  estimateTokens,
  preflightCostEstimate,
  getBudgetStatus,
};
