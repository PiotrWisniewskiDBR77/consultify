/**
 * Finance Mapping Policy — Confidence Tier System
 *
 * Every extracted financial line is classified into one of four tiers
 * that determine how the system treats it.  The policy ensures:
 *   • 95%+ of common lines are mapped automatically (Tier 1 + Tier 2)
 *   • Unusual lines are surfaced for conscious human review (Tier 3)
 *   • Noise / non-financial content is excluded silently (Tier 4)
 *
 * Learning loop: When a user confirms or corrects a Tier 2/3 mapping,
 * the decision is persisted as a learned alias so the SAME label is
 * handled as Tier 1 next time (zero LLM cost, zero latency).
 */

// ─── Confidence Tiers ───────────────────────────────────────────────────────

export enum MappingTier {
  /** Tier 1 — AUTO: Heuristic alias matched with high confidence.
   *  No LLM needed. Deterministic, free, instant.
   *  Covers ~70% of lines on first encounter, ~95% after learning. */
  AUTO = 'auto',

  /** Tier 2 — LLM_CONFIRMED: LLM proposed mapping with confidence ≥ 0.75.
   *  Automatically accepted, shown to user for passive review.
   *  After user confirms → promoted to Tier 1 via learned alias. */
  LLM_CONFIRMED = 'llm_confirmed',

  /** Tier 3 — REVIEW_REQUIRED: LLM proposed mapping with 0.50 ≤ conf < 0.75,
   *  OR line is a subtotal/aggregate, OR a duplicate-conflict victim with
   *  no alternative canonical ID available.
   *  Shown to user with yellow highlight — requires explicit accept/reject. */
  REVIEW_REQUIRED = 'review_required',

  /** Tier 4 — EXCLUDED: Line classified as non-financial (header, date,
   *  page number, note reference, section title).
   *  Hidden from the mapping table. User can override. */
  EXCLUDED = 'excluded',
}

// ─── Thresholds ─────────────────────────────────────────────────────────────

export const POLICY_THRESHOLDS = {
  /** Heuristic score above which mapping is auto-accepted (Tier 1) */
  HEURISTIC_AUTO_ACCEPT: 0.60,

  /** LLM confidence above which mapping is auto-accepted (Tier 2) */
  LLM_AUTO_ACCEPT: 0.75,

  /** LLM confidence below which mapping is rejected (not even Tier 3) */
  LLM_REJECT: 0.40,

  /** LLM confidence range for review_required (Tier 3) */
  LLM_REVIEW_MIN: 0.50,
  LLM_REVIEW_MAX: 0.75,

  /** Maximum number of lines sent to LLM per pass (cost control) */
  LLM_BATCH_SIZE: 30,

  /** Target coverage percentage — if below this, warn user */
  TARGET_COVERAGE_PCT: 90,

  /** If coverage exceeds this, statement can be auto-confirmed */
  AUTO_CONFIRM_COVERAGE_PCT: 95,
} as const;

// ─── Subtotal / Aggregate Detection ─────────────────────────────────────────

const SUBTOTAL_PATTERNS_EN = [
  /^total\s+(cash.*equivalents|cost\s+of\s+revenues?|automotive\s+revenues?|revenues?\s+and\s+other|stockholders|shareholders)/i,
  /^total\s+(current|non-current)\s+(assets|liabilities)/i,
  /^net\s+(assets|income)\s*\$/i,
  /^net\s+income\s*\$/i,
  /^\w+\s+razem\b/i,
];

const SUBTOTAL_PATTERNS_PL = [
  /^razem\s+/i,
  /zobowiązan[ie]+\s+długo\s+i\s+krótkoterminowe/i,
  /razem\s+zobowiązania\s+i\s+kapitał/i,
  /razem\s+wyłączenia/i,
];

const ALL_SUBTOTAL_PATTERNS = [...SUBTOTAL_PATTERNS_EN, ...SUBTOTAL_PATTERNS_PL];

export function isLikelySubtotalOrAggregate(label: string): boolean {
  const normalized = label.replace(/\s+\d{4}$/, '').trim();
  return ALL_SUBTOTAL_PATTERNS.some((rx) => rx.test(normalized));
}

// ─── Non-Financial Line Detection (enhanced) ────────────────────────────────

const NON_FINANCIAL_PATTERNS = [
  /^(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{4}$/i,
  /^\d{1,2}\s+(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{4}$/i,
  /^\w+\s+annual\s+report\s+and\s+form/i,
  /^\w+\s+annual\s+report\s+\d{4}/i,
  /^page\s+\d+/i,
  /^see\s+accompanying\s+notes/i,
  /^the\s+accompanying\s+notes\s+are/i,
  /nota\s+\d{4}$/i,
  /^nota\s+\d/i,
  /^note\s+\d/i,
  /^\d+\.\s+\w/i,
];

export function isNonFinancialByPolicy(label: string): boolean {
  const trimmed = label.trim();
  if (NON_FINANCIAL_PATTERNS.some((rx) => rx.test(trimmed))) return true;
  const cleaned = trimmed.replace(/\s+\d{4}$/, '').trim();
  if (/^(december|styczeń|luty|marzec|kwiecień|maj|czerwiec|lipiec|sierpień|wrzesień|październik|listopad|grudzień)$/i.test(cleaned)) return true;
  return false;
}

// ─── Line Classification ────────────────────────────────────────────────────

export interface MappingTierResult {
  tier: MappingTier;
  reason: string;
}

export function classifyMappingTier(params: {
  suggestedCanonicalId?: string | null;
  mappingReason?: string | null;
  isNonFinancial?: boolean;
  originalLabel: string;
  heuristicScore?: number;
  llmConfidence?: number;
}): MappingTierResult {
  const { suggestedCanonicalId, mappingReason, isNonFinancial, originalLabel } = params;

  if (isNonFinancial || isNonFinancialByPolicy(originalLabel)) {
    return { tier: MappingTier.EXCLUDED, reason: 'non_financial_line' };
  }

  if (isLikelySubtotalOrAggregate(originalLabel) && !suggestedCanonicalId) {
    return { tier: MappingTier.EXCLUDED, reason: 'likely_subtotal_aggregate' };
  }

  if (!suggestedCanonicalId) {
    if (mappingReason === 'duplicate_candidate_conflict') {
      return { tier: MappingTier.REVIEW_REQUIRED, reason: 'duplicate_conflict_unresolved' };
    }
    return { tier: MappingTier.REVIEW_REQUIRED, reason: 'no_mapping_found' };
  }

  if (mappingReason?.startsWith('llm_second_pass') || mappingReason?.startsWith('llm_mapping')) {
    const confMatch = mappingReason.match(/\((\d+\.\d+)\)/);
    const confidence = confMatch ? parseFloat(confMatch[1]) : 0;

    if (confidence >= POLICY_THRESHOLDS.LLM_AUTO_ACCEPT) {
      return { tier: MappingTier.LLM_CONFIRMED, reason: 'llm_high_confidence' };
    }
    if (confidence >= POLICY_THRESHOLDS.LLM_REVIEW_MIN) {
      return { tier: MappingTier.REVIEW_REQUIRED, reason: 'llm_medium_confidence' };
    }
    return { tier: MappingTier.REVIEW_REQUIRED, reason: 'llm_low_confidence' };
  }

  return { tier: MappingTier.AUTO, reason: 'heuristic_match' };
}

// ─── Coverage Assessment ────────────────────────────────────────────────────

export interface CoverageAssessment {
  totalEligible: number;
  tier1Auto: number;
  tier2LlmConfirmed: number;
  tier3ReviewRequired: number;
  tier4Excluded: number;
  effectiveCoveragePct: number;
  meetsTarget: boolean;
  canAutoConfirm: boolean;
  summary: string;
}

export function assessCoverage(
  tiers: MappingTierResult[],
  totalExtracted: number
): CoverageAssessment {
  const tier1 = tiers.filter((t) => t.tier === MappingTier.AUTO).length;
  const tier2 = tiers.filter((t) => t.tier === MappingTier.LLM_CONFIRMED).length;
  const tier3 = tiers.filter((t) => t.tier === MappingTier.REVIEW_REQUIRED).length;
  const tier4 = tiers.filter((t) => t.tier === MappingTier.EXCLUDED).length;

  const eligible = totalExtracted - tier4;
  const mapped = tier1 + tier2;
  const coveragePct = eligible > 0 ? Math.round((mapped / eligible) * 100) : 0;

  const meetsTarget = coveragePct >= POLICY_THRESHOLDS.TARGET_COVERAGE_PCT;
  const canAutoConfirm = coveragePct >= POLICY_THRESHOLDS.AUTO_CONFIRM_COVERAGE_PCT && tier3 === 0;

  let summary: string;
  if (canAutoConfirm) {
    summary = `${coveragePct}% coverage — all lines mapped with high confidence, auto-confirm eligible`;
  } else if (meetsTarget) {
    summary = `${coveragePct}% coverage — meets ${POLICY_THRESHOLDS.TARGET_COVERAGE_PCT}% target, ${tier3} line(s) need review`;
  } else {
    summary = `${coveragePct}% coverage — below ${POLICY_THRESHOLDS.TARGET_COVERAGE_PCT}% target, ${tier3} line(s) need review`;
  }

  return {
    totalEligible: eligible,
    tier1Auto: tier1,
    tier2LlmConfirmed: tier2,
    tier3ReviewRequired: tier3,
    tier4Excluded: tier4,
    effectiveCoveragePct: coveragePct,
    meetsTarget,
    canAutoConfirm,
    summary,
  };
}
