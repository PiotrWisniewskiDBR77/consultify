/**
 * Platform AI Services — Phase 5
 *
 * 5.3 Per-Tier Rate Limiting
 * 5.4 Token Pre-Counting
 * 5.5 Prompt Caching
 * 5.6 Industry Intelligence Service
 */

import logger from '../../utils/Logger.js';

// ================================================================
// 5.3 Per-Tier Rate Limiting
// ================================================================

export interface TierLimits {
  aiRequestsPerMinute: number;
  aiRequestsPerDay: number;
  maxTokensPerRequest: number;
  maxTokensPerDay: number;
  deepThinkingEnabled: boolean;
  voiceEnabled: boolean;
  decisionRoomEnabled: boolean;
}

const TIER_LIMITS: Record<string, TierLimits> = {
  free: {
    aiRequestsPerMinute: 5,
    aiRequestsPerDay: 50,
    maxTokensPerRequest: 2000,
    maxTokensPerDay: 100_000,
    deepThinkingEnabled: false,
    voiceEnabled: false,
    decisionRoomEnabled: false,
  },
  starter: {
    aiRequestsPerMinute: 15,
    aiRequestsPerDay: 200,
    maxTokensPerRequest: 4000,
    maxTokensPerDay: 500_000,
    deepThinkingEnabled: true,
    voiceEnabled: false,
    decisionRoomEnabled: false,
  },
  professional: {
    aiRequestsPerMinute: 30,
    aiRequestsPerDay: 1000,
    maxTokensPerRequest: 8000,
    maxTokensPerDay: 2_000_000,
    deepThinkingEnabled: true,
    voiceEnabled: true,
    decisionRoomEnabled: true,
  },
  enterprise: {
    aiRequestsPerMinute: 60,
    aiRequestsPerDay: 5000,
    maxTokensPerRequest: 16000,
    maxTokensPerDay: 10_000_000,
    deepThinkingEnabled: true,
    voiceEnabled: true,
    decisionRoomEnabled: true,
  },
};

export function getTierLimits(tier: string): TierLimits {
  return TIER_LIMITS[tier] || TIER_LIMITS.free;
}

export function checkTierAccess(tier: string, feature: string): boolean {
  const limits = getTierLimits(tier);
  switch (feature) {
    case 'deepThinking':
      return limits.deepThinkingEnabled;
    case 'voice':
      return limits.voiceEnabled;
    case 'decisionRoom':
      return limits.decisionRoomEnabled;
    default:
      return true;
  }
}

// In-memory per-tier usage tracking
const dailyUsage = new Map<string, { count: number; tokens: number; resetAt: number }>();

export function trackTierUsage(
  userId: string,
  tier: string,
  tokensUsed: number
): { allowed: boolean; reason?: string } {
  const limits = getTierLimits(tier);
  const key = `daily:${userId}`;
  const now = Date.now();
  const startOfDay = new Date().setHours(0, 0, 0, 0);

  let usage = dailyUsage.get(key);
  if (!usage || now >= usage.resetAt) {
    usage = { count: 0, tokens: 0, resetAt: startOfDay + 86400000 };
  }

  if (usage.count >= limits.aiRequestsPerDay) {
    return {
      allowed: false,
      reason: `Daily request limit (${limits.aiRequestsPerDay}) exceeded for ${tier} tier`,
    };
  }

  if (usage.tokens + tokensUsed > limits.maxTokensPerDay) {
    return {
      allowed: false,
      reason: `Daily token limit (${limits.maxTokensPerDay}) exceeded for ${tier} tier`,
    };
  }

  usage.count++;
  usage.tokens += tokensUsed;
  dailyUsage.set(key, usage);
  return { allowed: true };
}

// ================================================================
// 5.4 Token Pre-Counting (Approximate)
// ================================================================

/**
 * Approximate token count using character-based heuristic.
 * For precise counting, use tiktoken when available.
 * Average: ~4 characters per token for English, ~3 for Polish.
 */
export function estimateTokenCount(text: string, language?: string): number {
  if (!text) return 0;
  const charsPerToken = language === 'pl' || language === 'de' ? 3 : 4;
  return Math.ceil(text.length / charsPerToken);
}

/**
 * Estimate total tokens for a prompt + context.
 */
export function estimateRequestTokens(
  systemPrompt: string,
  userPrompt: string,
  chatHistory: string[],
  language?: string
): { promptTokens: number; estimatedCompletionTokens: number; totalEstimate: number } {
  const promptTokens =
    estimateTokenCount(systemPrompt, language) +
    estimateTokenCount(userPrompt, language) +
    chatHistory.reduce((sum, msg) => sum + estimateTokenCount(msg, language), 0);

  // Estimate completion as ~50% of prompt for chat, less for structured
  const estimatedCompletionTokens = Math.ceil(promptTokens * 0.5);

  return {
    promptTokens,
    estimatedCompletionTokens,
    totalEstimate: promptTokens + estimatedCompletionTokens,
  };
}

// ================================================================
// 5.5 Prompt Caching (5-min TTL per user+project+screen)
// ================================================================

interface CacheEntry {
  response: any;
  createdAt: number;
  hitCount: number;
}

const promptCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_CACHE_SIZE = 500;

// Cleanup old entries every minute
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of promptCache) {
    if (now - entry.createdAt > CACHE_TTL_MS) {
      promptCache.delete(key);
    }
  }
}, 60_000);

function generateCacheKey(
  userId: string,
  projectId: string | null,
  screen: string | null,
  promptHash: string
): string {
  return `${userId}:${projectId || 'none'}:${screen || 'any'}:${promptHash}`;
}

function hashPrompt(prompt: string): string {
  // Simple hash — first 100 chars + length
  const core = prompt.slice(0, 100).replace(/\s+/g, ' ');
  return `${core.length}:${core}`.slice(0, 64);
}

export function getCachedResponse(
  userId: string,
  projectId: string | null,
  screen: string | null,
  prompt: string
): any | null {
  const key = generateCacheKey(userId, projectId, screen, hashPrompt(prompt));
  const entry = promptCache.get(key);

  if (entry && Date.now() - entry.createdAt < CACHE_TTL_MS) {
    entry.hitCount++;
    logger.debug(`[PromptCache] Hit for key ${key.slice(0, 40)} (${entry.hitCount} hits)`);
    return entry.response;
  }

  return null;
}

export function setCachedResponse(
  userId: string,
  projectId: string | null,
  screen: string | null,
  prompt: string,
  response: any
): void {
  if (promptCache.size >= MAX_CACHE_SIZE) {
    // Evict oldest entry
    let oldestKey = '';
    let oldestTime = Infinity;
    for (const [key, entry] of promptCache) {
      if (entry.createdAt < oldestTime) {
        oldestTime = entry.createdAt;
        oldestKey = key;
      }
    }
    if (oldestKey) promptCache.delete(oldestKey);
  }

  const key = generateCacheKey(userId, projectId, screen, hashPrompt(prompt));
  promptCache.set(key, {
    response,
    createdAt: Date.now(),
    hitCount: 0,
  });
}

export function getCacheStats(): { size: number; maxSize: number; ttlMs: number } {
  return { size: promptCache.size, maxSize: MAX_CACHE_SIZE, ttlMs: CACHE_TTL_MS };
}

// ================================================================
// 5.6 Industry Intelligence Service
// ================================================================

/**
 * Industry benchmarks and intelligence — currently using static data.
 * Can be extended with real-time APIs (Statista, Gartner, etc.) in the future.
 */

export interface IndustryBenchmark {
  industry: string;
  avgMaturityScore: number;
  topChallenges: string[];
  trendingInitiatives: string[];
  avgTransformationBudgetPercent: number;
  avgTimeToValueMonths: number;
}

const INDUSTRY_BENCHMARKS: Record<string, IndustryBenchmark> = {
  manufacturing: {
    industry: 'Manufacturing',
    avgMaturityScore: 2.8,
    topChallenges: [
      'Legacy systems integration',
      'Workforce digital skills',
      'OT/IT convergence',
      'Supply chain visibility',
    ],
    trendingInitiatives: [
      'Digital Twin implementation',
      'Predictive maintenance',
      'Smart factory MES',
      'Automated quality control',
    ],
    avgTransformationBudgetPercent: 3.5,
    avgTimeToValueMonths: 18,
  },
  automotive: {
    industry: 'Automotive',
    avgMaturityScore: 3.2,
    topChallenges: [
      'EV transition',
      'Connected car data',
      'Supply chain resilience',
      'IATF 16949 compliance',
    ],
    trendingInitiatives: [
      'Software-defined vehicle',
      'EV battery analytics',
      'Digital supply network',
      'Autonomous testing platforms',
    ],
    avgTransformationBudgetPercent: 4.2,
    avgTimeToValueMonths: 24,
  },
  pharma: {
    industry: 'Pharmaceutical',
    avgMaturityScore: 3.0,
    topChallenges: [
      'GxP compliance',
      'Data integrity',
      'Batch record digitization',
      'Clinical trial efficiency',
    ],
    trendingInitiatives: [
      'Electronic batch records',
      'AI drug discovery',
      'Connected lab automation',
      'Real-world evidence analytics',
    ],
    avgTransformationBudgetPercent: 3.8,
    avgTimeToValueMonths: 20,
  },
  fmcg: {
    industry: 'FMCG / Consumer Goods',
    avgMaturityScore: 2.5,
    topChallenges: [
      'Demand forecasting',
      'Omnichannel integration',
      'Sustainability reporting',
      'Production flexibility',
    ],
    trendingInitiatives: [
      'AI demand sensing',
      'Digital shelf optimization',
      'Smart packaging',
      'Carbon footprint tracking',
    ],
    avgTransformationBudgetPercent: 2.8,
    avgTimeToValueMonths: 12,
  },
  energy: {
    industry: 'Energy & Utilities',
    avgMaturityScore: 2.6,
    topChallenges: [
      'Grid modernization',
      'Renewable integration',
      'Asset management',
      'Regulatory compliance',
    ],
    trendingInitiatives: [
      'Smart grid analytics',
      'Predictive asset maintenance',
      'Energy trading AI',
      'EV charging network optimization',
    ],
    avgTransformationBudgetPercent: 3.0,
    avgTimeToValueMonths: 24,
  },
  default: {
    industry: 'General Industry',
    avgMaturityScore: 2.5,
    topChallenges: [
      'Digital skills gap',
      'Legacy IT modernization',
      'Data silos',
      'Change management',
    ],
    trendingInitiatives: [
      'Cloud migration',
      'Data analytics platform',
      'Process automation (RPA)',
      'Customer experience digitization',
    ],
    avgTransformationBudgetPercent: 3.0,
    avgTimeToValueMonths: 15,
  },
};

export function getIndustryBenchmark(industry: string): IndustryBenchmark {
  const normalized = industry.toLowerCase().replace(/[^a-z]/g, '');

  for (const [key, benchmark] of Object.entries(INDUSTRY_BENCHMARKS)) {
    if (key !== 'default' && normalized.includes(key)) {
      return benchmark;
    }
  }

  return INDUSTRY_BENCHMARKS.default;
}

export function getAllIndustryBenchmarks(): Record<string, IndustryBenchmark> {
  return { ...INDUSTRY_BENCHMARKS };
}

export default {
  getTierLimits,
  checkTierAccess,
  trackTierUsage,
  estimateTokenCount,
  estimateRequestTokens,
  getCachedResponse,
  setCachedResponse,
  getCacheStats,
  getIndustryBenchmark,
  getAllIndustryBenchmarks,
};
