/**
 * Intent Resolver
 *
 * Maps section types from the existing report system to SlideIntents.
 * Also provides automatic intent inference from section content.
 */

import type { SlideIntent } from './types.js';

// ============================================================
// SECTION TYPE → INTENT MAPPING
// ============================================================

/**
 * Maps existing Report Builder section types to slide intents.
 * This bridges the current system with the new component model.
 */
const SECTION_TYPE_MAP: Record<string, SlideIntent> = {
  // ── Core section types (SectionType enum) ──
  cover: 'cover',
  summary: 'executive_summary',
  executive_summary: 'executive_summary',
  methodology: 'section_intro',
  matrix: 'assessment',
  axis_analysis: 'single_insight',
  list: 'key_messages',
  recommendations: 'recommendation_portfolio',
  action_plan: 'roadmap',
  appendix: 'appendix',
  custom: 'appendix',

  // ── Content blocks (from 524/525 migrations) ──
  analysis: 'appendix',
  quote: 'key_messages',
  context: 'section_intro',
  section_intro: 'section_intro',
  key_messages: 'key_messages',
  next_steps: 'next_steps',

  // ── Data blocks ──
  table: 'appendix',
  findings: 'key_messages',
  dashboard: 'performance_overview',
  scorecard: 'performance_overview',
  gap_analysis: 'assessment',
  root_cause: 'root_cause',
  comparison: 'comparison',

  // ── Visual blocks ──
  chart_bar: 'single_insight',
  chart_pie: 'single_insight',
  image: 'appendix',
  roadmap: 'roadmap',
  kpis: 'performance_overview',
  risk: 'risk_management',
  prioritization: 'prioritization_matrix',
  initiatives: 'initiative_portfolio',
  initiative_cards: 'initiative_portfolio',

  // ── Consulting blocks ──
  consulting_takeaway: 'key_messages',
  consulting_implications: 'key_messages',
  consulting_decisions: 'next_steps',
  consulting_risks_register: 'risk_management',
  consulting_2x2: 'assessment',
  consulting_benchmark_bar: 'single_insight',
  consulting_roadmap: 'roadmap',

  // ── Extended / alias IDs (used in some templates) ──
  cover_page: 'cover',
  executive_summary_block: 'executive_summary',
  key_findings: 'key_messages',
  swot_analysis: 'comparison',
  risk_assessment: 'risk_management',
  maturity_matrix: 'assessment',
  benchmark_comparison: 'comparison',
  performance_dashboard: 'performance_overview',
  trend_analysis: 'single_insight',
  root_cause_analysis: 'root_cause',
  recommendation_single: 'recommendation_single',
  recommendation_list: 'recommendation_portfolio',
  strategic_roadmap: 'roadmap',
  next_steps_block: 'next_steps',
  stakeholder_map: 'assessment',
  cost_benefit: 'comparison',
  implementation_timeline: 'roadmap',
  kpi_scorecard: 'performance_overview',
};

/**
 * Validate a string as a known SlideIntent.
 */
const VALID_INTENTS = new Set<string>([
  'cover',
  'executive_summary',
  'section_intro',
  'key_messages',
  'performance_overview',
  'single_insight',
  'comparison',
  'assessment',
  'root_cause',
  'recommendation_single',
  'recommendation_portfolio',
  'initiative_portfolio',
  'prioritization_matrix',
  'roadmap',
  'risk_management',
  'next_steps',
  'appendix',
]);

function isValidIntent(s: string): s is SlideIntent {
  return VALID_INTENTS.has(s);
}

/**
 * Resolve a section type / block type ID to a slide intent.
 *
 * Priority:
 *   1. Explicit slide_intent from DB (if provided)
 *   2. Block type ID mapping
 *   3. Section type mapping
 *   4. Fallback: 'appendix'
 */
export function resolveIntent(
  sectionType: string,
  blockTypeId?: string | null,
  dbSlideIntent?: string | null
): SlideIntent {
  // 1. Prefer explicit slide_intent from the block type record (set in DB migration 525)
  if (dbSlideIntent && isValidIntent(dbSlideIntent)) {
    return dbSlideIntent;
  }

  // 2. Block type ID mapping
  if (blockTypeId && SECTION_TYPE_MAP[blockTypeId]) {
    return SECTION_TYPE_MAP[blockTypeId];
  }

  // 3. Section type mapping
  if (SECTION_TYPE_MAP[sectionType]) {
    return SECTION_TYPE_MAP[sectionType];
  }

  // 4. Default fallback
  return 'appendix';
}

/**
 * Infer intent from content analysis (heuristic).
 * Used when section type and block type don't provide clear mapping.
 */
export function inferIntentFromContent(content: string): SlideIntent {
  const lower = content.toLowerCase();

  if (lower.includes('recommend') || lower.includes('rekomendacj')) {
    return 'recommendation_portfolio';
  }
  if (lower.includes('roadmap') || lower.includes('plan działania') || lower.includes('timeline')) {
    return 'roadmap';
  }
  if (lower.includes('risk') || lower.includes('ryzyko') || lower.includes('mitigation')) {
    return 'risk_management';
  }
  if (lower.includes('root cause') || lower.includes('przyczyn') || lower.includes('problem')) {
    return 'root_cause';
  }
  if (lower.includes('next step') || lower.includes('kolejne kroki') || lower.includes('action')) {
    return 'next_steps';
  }
  if (lower.includes('kpi') || lower.includes('performance') || lower.includes('metric')) {
    return 'performance_overview';
  }
  if (lower.includes('comparison') || lower.includes('vs') || lower.includes('versus')) {
    return 'comparison';
  }
  if (lower.includes('maturity') || lower.includes('assessment') || lower.includes('dojrzałość')) {
    return 'assessment';
  }
  if (lower.includes('summary') || lower.includes('podsumowanie') || lower.includes('executive')) {
    return 'executive_summary';
  }

  return 'appendix';
}

/**
 * Get all known intents for documentation / UI purposes.
 */
export function getAllIntents(): Array<{ intent: SlideIntent; description: string }> {
  return [
    { intent: 'cover', description: 'Presentation opening' },
    { intent: 'executive_summary', description: 'Board-level synthesis' },
    { intent: 'section_intro', description: 'Section transition' },
    { intent: 'key_messages', description: 'Narrative framing' },
    { intent: 'performance_overview', description: 'KPI overview' },
    { intent: 'single_insight', description: 'One data-driven insight' },
    { intent: 'comparison', description: 'A vs B / before vs after' },
    { intent: 'assessment', description: 'Maturity / heatmap' },
    { intent: 'root_cause', description: 'Problem analysis' },
    { intent: 'recommendation_single', description: 'Single action' },
    { intent: 'recommendation_portfolio', description: 'Set of actions' },
    { intent: 'initiative_portfolio', description: 'Strategic initiative cards' },
    { intent: 'prioritization_matrix', description: 'Impact vs effort quadrants' },
    { intent: 'roadmap', description: 'Sequenced plan' },
    { intent: 'risk_management', description: 'Risks & mitigation' },
    { intent: 'next_steps', description: 'Call to action' },
    { intent: 'appendix', description: 'Deep dive' },
  ];
}
