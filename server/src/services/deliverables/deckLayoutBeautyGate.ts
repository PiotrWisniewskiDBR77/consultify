/**
 * Deck Layout Beauty Gate — F1.3
 *
 * Scores a generated deck layout plan on 3 deterministic axes:
 *   1. Diversity   — distinct intent ratio vs minDistinctLayouts target
 *   2. Balance     — heavy slides (key_messages) not clumped in one block
 *   3. Framing     — first slide=cover, last=next_steps|conclusion|summary
 *
 * If overall score < BEAUTY_THRESHOLD, requests a regen (up to MAX_REGENS=2).
 * Caller supplies a `planFn` that re-runs the B1 layout director.
 *
 * SAFETY: fail-open — any error returns the original result, never throws.
 */

import type {
  DeckLayoutDirectorResult,
  SlideLayoutPlan,
} from '../presentationLayoutDirectorService.js';
import { resolveDeliverableDefaults } from './deliverableDefaults.js';
import logger from '../../utils/Logger.js';

// ── Thresholds ───────────────────────────────────────────────────────────────
export const BEAUTY_THRESHOLD = 0.70;
const MAX_REGENS = 2;

// ── Config (from defaults) ───────────────────────────────────────────────────
const DECK_DEFAULTS = resolveDeliverableDefaults('deck');
const MIN_DISTINCT = DECK_DEFAULTS.graphic.layout?.minDistinctLayouts ?? 8;

// ── Types ────────────────────────────────────────────────────────────────────
export interface BeautyScore {
  overall: number;
  diversity: number;
  balance: number;
  framing: number;
  passed: boolean;
  issues: string[];
}

export interface BeautyGateResult extends DeckLayoutDirectorResult {
  beautyScore: BeautyScore;
  regenCount: number;
}

// ── Scoring ──────────────────────────────────────────────────────────────────

const HEAVY_INTENTS = new Set([
  'key_messages',
  'performance_overview',
  'assessment',
  'root_cause',
]);

const STRONG_CLOSERS = new Set([
  'next_steps',
  'conclusion',
  'summary',
  'recommendation_single',
  'recommendation_portfolio',
]);

function scoreDiversity(plans: SlideLayoutPlan[]): number {
  if (plans.length === 0) return 0;
  const target = Math.min(MIN_DISTINCT, plans.length);
  const distinct = new Set(plans.map((p) => p.layoutIntent)).size;
  return Math.min(distinct / target, 1);
}

function scoreBalance(plans: SlideLayoutPlan[]): number {
  if (plans.length <= 3) return 1;
  // Check if heavy slides are clumped: find longest consecutive run of heavy intents
  let maxRun = 0;
  let run = 0;
  for (const p of plans) {
    if (HEAVY_INTENTS.has(p.layoutIntent)) {
      run++;
      if (run > maxRun) maxRun = run;
    } else {
      run = 0;
    }
  }
  const threshold = Math.ceil(plans.length / 3); // max 1/3 can be clumped
  if (maxRun <= 2) return 1;
  if (maxRun > threshold) return 0;
  return 1 - (maxRun - 2) / (threshold - 2 + 1);
}

function scoreFraming(plans: SlideLayoutPlan[]): number {
  if (plans.length === 0) return 0;
  let score = 1;
  if (plans[0].layoutIntent !== 'cover') {
    score -= 0.5;
  }
  const last = plans[plans.length - 1].layoutIntent;
  if (!STRONG_CLOSERS.has(last)) {
    score -= 0.5;
  }
  return Math.max(score, 0);
}

export function scoreBeauty(plans: SlideLayoutPlan[]): BeautyScore {
  const diversity = scoreDiversity(plans);
  const balance = scoreBalance(plans);
  const framing = scoreFraming(plans);

  // Weighted: diversity most important (50%), balance (30%), framing (20%)
  const overall = diversity * 0.5 + balance * 0.3 + framing * 0.2;
  const passed = overall >= BEAUTY_THRESHOLD;

  const issues: string[] = [];
  if (diversity < 0.7) {
    const distinct = new Set(plans.map((p) => p.layoutIntent)).size;
    issues.push(
      `Low layout diversity: ${distinct}/${Math.min(MIN_DISTINCT, plans.length)} distinct (score ${diversity.toFixed(2)})`
    );
  }
  if (balance < 0.7) {
    issues.push(`Heavy slides clumped (balance score ${balance.toFixed(2)})`);
  }
  if (framing < 0.5) {
    const first = plans[0]?.layoutIntent;
    const last = plans[plans.length - 1]?.layoutIntent;
    issues.push(`Weak framing: first="${first ?? 'n/a'}", last="${last ?? 'n/a'}"`);
  }

  return { overall, diversity, balance, framing, passed, issues };
}

// ── Gate ─────────────────────────────────────────────────────────────────────

/**
 * Apply the beauty gate to a deck layout result.
 *
 * @param result   Initial layout result from planDeckLayout
 * @param planFn   Re-invoke the layout director for regen (same inputs)
 * @returns        The best-scoring result with beautyScore + regenCount attached
 */
export async function applyDeckBeautyGate(
  result: DeckLayoutDirectorResult,
  planFn: () => Promise<DeckLayoutDirectorResult>
): Promise<BeautyGateResult> {
  let best = result;
  let bestScore = scoreBeauty(result.plans);
  let regenCount = 0;

  if (bestScore.passed) {
    logger.info('[BeautyGate] passed on first attempt', {
      score: bestScore.overall.toFixed(2),
    });
    return { ...best, beautyScore: bestScore, regenCount: 0 };
  }

  logger.info('[BeautyGate] failed initial score, triggering regen', {
    score: bestScore.overall.toFixed(2),
    issues: bestScore.issues,
  });

  while (regenCount < MAX_REGENS) {
    regenCount++;
    try {
      const regen = await planFn();
      const regenScore = scoreBeauty(regen.plans);

      logger.info('[BeautyGate] regen result', {
        attempt: regenCount,
        score: regenScore.overall.toFixed(2),
        passed: regenScore.passed,
      });

      if (regenScore.overall > bestScore.overall) {
        best = regen;
        bestScore = regenScore;
      }

      if (bestScore.passed) break;
    } catch (err) {
      logger.warn('[BeautyGate] regen failed, keeping best so far', {
        err: (err as Error)?.message,
      });
      break;
    }
  }

  return { ...best, beautyScore: bestScore, regenCount };
}
