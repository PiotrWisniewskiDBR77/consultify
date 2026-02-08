/**
 * Deep Thinking Self-Check Engine
 *
 * 3-layer quality gate:
 *   A) Pre-Flight  — confirm gate + research visibility gate
 *   B) In-Flight   — process state integrity (diagnostic log, non-blocking)
 *   C) Post-Flight  — DoD compliance + rubric scoring + N-tag detection + auto-repair loop
 *
 * Key decisions:
 * - Honesty/Safety: split into hard overreach (link + "according to" w/o assumptions → 0)
 *   and soft overreach (framework name w/o link → 1). Hard gate: safety_honesty >= 1.
 * - Auto-repair: max 2 iterations, N-tag-driven instructions, "best effort" fallback.
 * - Force-depth diff: Jaccard similarity on options + rubric delta.
 * - UX: generic "Refining analysis…" — no specific details exposed.
 * - Does NOT reward length.
 */

import type { DeepThinkingRubricV2, NegativePattern } from './deepThinkingEvaluationService.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SelfCheckVerdict = 'PASS' | 'FAIL' | 'BEST_EFFORT';

export type SelfCheckResult = {
  verdict: SelfCheckVerdict;
  rubric: DeepThinkingRubricV2;
  negativePatterns: NegativePattern[];
  failReasons: string[];
  repairIterations: number;
};

export type ForceDepthDiffResult = {
  isSubstantiallyDifferent: boolean;
  jaccardSimilarity: number;
  rubricDelta: number;
  newAxesDetected: boolean;
  failReasons: string[];
};

// ---------------------------------------------------------------------------
// Overreach: split into hard vs soft
// ---------------------------------------------------------------------------

function hasAny(text: string, needles: string[]): boolean {
  const t = text.toLowerCase();
  return needles.some((n) => t.includes(n.toLowerCase()));
}

export type OverreachLevel = 'none' | 'soft' | 'hard';

export function detectOverreachLevel(text: string): OverreachLevel {
  const t = text.toLowerCase();
  const hasLink = /https?:\/\/\S+/i.test(text);
  const hasAccordingTo = hasAny(t, ['according to', 'source:', 'źródło', 'wg ', 'według ']);

  // Hard: explicit citation claim (link or "according to") without assumptions
  if (hasLink || hasAccordingTo) {
    return 'hard';
  }

  // Soft: named authority/framework as conceptual reference (common in consulting)
  const hasFrameworkName = hasAny(t, [
    'mckinsey',
    'bcg',
    'gartner',
    'harvard',
    'iso ',
    'iso-',
    'pwc',
    'deloitte',
    'porter',
    'swot',
    'pestel',
  ]);

  if (hasFrameworkName) {
    return 'soft';
  }

  return 'none';
}

// ---------------------------------------------------------------------------
// Pass/Fail threshold (the core rule from the spec)
// ---------------------------------------------------------------------------

export type PassFailInput = {
  rubric: DeepThinkingRubricV2;
  negativePatterns: NegativePattern[];
};

/**
 * Determines pass/fail based on the spec's hard rules:
 * - Each of framing, alternatives, tradeoffs, assumptions_gaps, closure_conditions >= 1
 * - Total >= 10/14
 * - safety_honesty >= 1 (hard gate; using soft/hard split, not raw 2)
 */
export function evaluatePassFail(input: PassFailInput): {
  pass: boolean;
  failReasons: string[];
} {
  const { rubric } = input;
  const c = rubric.criteria;
  const failReasons: string[] = [];

  // Per-criterion minimums
  if (c.framing < 1) failReasons.push('framing_below_minimum');
  if (c.alternatives < 1) failReasons.push('alternatives_below_minimum');
  if (c.tradeoffs < 1) failReasons.push('tradeoffs_below_minimum');
  if (c.assumptions_gaps < 1) failReasons.push('assumptions_gaps_below_minimum');
  if (c.closure_conditions < 1) failReasons.push('closure_conditions_below_minimum');

  // Hard gate: safety/honesty must be >= 1 (soft overreach is 1, hard overreach is 0)
  if (c.safety_honesty < 1) failReasons.push('safety_honesty_hard_fail');

  // Sum threshold
  if (rubric.total < 10) failReasons.push(`total_score_${rubric.total}_below_10`);

  return { pass: failReasons.length === 0, failReasons };
}

// ---------------------------------------------------------------------------
// N-tag driven repair instructions
// ---------------------------------------------------------------------------

const REPAIR_INSTRUCTIONS: Record<NegativePattern, string> = {
  N1: 'ADD: Problem Framing section with problem vs symptom, decision horizon, stakeholders, and explicit "what happens if we do nothing" analysis.',
  N2: 'ADD: 2–3 distinct, mutually exclusive options. Each option must have its own assumptions and consequences.',
  N3: 'ADD: Explicit trade-offs for each option (speed vs cost vs risk vs quality vs people). State what you gain and what you lose.',
  N4: 'FIX: Add Assumptions & Gaps section. Lower confidence tone. Replace certainty language with conditional language.',
  N5: 'FIX: Compress. Add a crisp Executive Summary (5–7 lines). Remove decorative language and filler.',
  N6: 'FIX: Add decision criteria and selection logic. Explain WHY these steps, not just WHAT steps.',
  N7: 'ADD: Clear closure — recommendation with boundary conditions ("unless X", "fails when Y"), success conditions, and next actions with early signals.',
  N8: 'FIX: Add Assumptions & Gaps section. Do NOT cite sources without evidence. If referencing frameworks, state them as conceptual tools, not factual claims.',
};

export function buildRepairPrompt(
  originalText: string,
  negativePatterns: NegativePattern[],
  failReasons: string[],
  iterationNumber: number
): string {
  const fixes = negativePatterns.map((n) => `- ${n}: ${REPAIR_INSTRUCTIONS[n]}`).join('\n');

  const systemPrompt = [
    `You are rewriting a Deep Thinking report that failed quality gate (iteration ${iterationNumber}/2).`,
    '',
    'REQUIRED 6-section format:',
    '1) Executive Summary (5–7 lines, decision-grade)',
    '2) Problem Framing (include: "what happens if we do nothing")',
    '3) Options (2–4 distinct, with assumptions and consequences)',
    '4) Recommendation + boundary conditions (explicit "unless"/"fails when" conditions)',
    '5) Risks & Blind spots (explicit assumptions vs facts, gaps, how to fill them)',
    '6) Next actions (checklist + early signals / leading indicators to monitor)',
    '',
    'Make trade-offs explicit (speed vs cost vs risk etc.).',
    'Separate facts from assumptions. Do NOT add fluff. Do NOT reveal chain-of-thought.',
    '',
    'SPECIFIC FIXES REQUIRED:',
    fixes,
    '',
    `Fail reasons: ${failReasons.join(', ')}`,
    '',
    'CRITICAL: Rewrite the ENTIRE report in the correct structure.',
    'Do NOT just append — replace the content completely.',
  ].join('\n');

  return systemPrompt;
}

// ---------------------------------------------------------------------------
// Force-Depth Diff Detection (Jaccard on options + rubric delta)
// ---------------------------------------------------------------------------

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-ząćęłńóśźż0-9\s]/gi, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2)
  );
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  const intersection = new Set([...a].filter((x) => b.has(x)));
  const union = new Set([...a, ...b]);
  return union.size > 0 ? intersection.size / union.size : 1;
}

function extractOptionLabels(text: string): string[] {
  const lines = String(text || '').split('\n');
  const optIdx = lines.findIndex((l) => hasAny(l, ['options', 'opcje', 'warianty']));
  if (optIdx < 0) return [];

  const items: string[] = [];
  for (let i = optIdx + 1; i < lines.length; i++) {
    const line = lines[i] || '';
    if (
      i > optIdx + 1 &&
      /^[A-ZĄĆĘŁŃÓŚŹŻ][A-Za-zĄĆĘŁŃÓŚŹŻąćęłńóśźż\s&+/-]{2,}$/.test(line.trim())
    ) {
      break;
    }
    const m = line.match(/^\s*(?:-|\*|\d+\.)\s+(.+)\s*$/);
    if (m?.[1]) items.push(m[1].trim());
  }
  return items;
}

/**
 * Checks whether a force-depth response is substantially different from the original.
 * Spec rule: if response after force-depth is "the same" → FAIL.
 */
export function evaluateForceDepthDiff(
  before: string,
  after: string,
  beforeRubric: DeepThinkingRubricV2,
  afterRubric: DeepThinkingRubricV2
): ForceDepthDiffResult {
  const failReasons: string[] = [];

  // 1) Jaccard similarity on options
  const beforeOptions = extractOptionLabels(before);
  const afterOptions = extractOptionLabels(after);
  const beforeTokens = tokenize(beforeOptions.join(' '));
  const afterTokens = tokenize(afterOptions.join(' '));
  const jaccard = jaccardSimilarity(beforeTokens, afterTokens);

  // 2) Rubric delta
  const rubricDelta = afterRubric.total - beforeRubric.total;

  // 3) New axes detection: did after introduce option labels not present in before?
  const beforeLabelsLower = new Set(beforeOptions.map((o) => o.toLowerCase()));
  const newAxes = afterOptions.filter((o) => !beforeLabelsLower.has(o.toLowerCase()));
  const newAxesDetected = newAxes.length >= 1;

  // Fail conditions:
  // - Options too similar (Jaccard >= 0.7) AND no new axes AND no rubric improvement
  if (jaccard >= 0.7 && !newAxesDetected) {
    failReasons.push('options_too_similar_to_previous');
  }
  if (rubricDelta <= 0 && !newAxesDetected) {
    failReasons.push('no_rubric_improvement_and_no_new_axes');
  }

  return {
    isSubstantiallyDifferent: failReasons.length === 0,
    jaccardSimilarity: Math.round(jaccard * 100) / 100,
    rubricDelta,
    newAxesDetected,
    failReasons,
  };
}

// ---------------------------------------------------------------------------
// Process State Integrity (Layer B — diagnostic, non-blocking)
// ---------------------------------------------------------------------------

export type ProcessStateLog = {
  statesEmitted: string[];
  isComplete: boolean;
  missingStates: string[];
};

const EXPECTED_STATES = ['research_visibility', 'research', 'thinking', 'synthesis', 'closure'];

export function checkProcessStateIntegrity(emittedStates: string[]): ProcessStateLog {
  const missing = EXPECTED_STATES.filter((s) => !emittedStates.includes(s));
  return {
    statesEmitted: emittedStates,
    isComplete: missing.length === 0,
    missingStates: missing,
  };
}
