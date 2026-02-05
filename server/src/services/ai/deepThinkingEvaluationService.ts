/**
 * Deep Thinking Evaluation Service (Enterprise MVP)
 *
 * Provides:
 * - N1–N8 negative pattern detection
 * - P1–P6 positive pattern detection
 * - Rubric scoring (0–2 per criterion; MUST NOT reward length)
 * - Pairwise comparison helper (A vs B) using DoD + rubric (not verbosity)
 */

import { scoreDeepThinkingRubric, validateDeepThinkingDoD } from './deepThinkingQuality.js';

export type NegativePattern =
  | 'N1' // No framing
  | 'N2' // Single-path bias
  | 'N3' // No trade-offs
  | 'N4' // Fake confidence
  | 'N5' // Consultant soup
  | 'N6' // Checklist-only
  | 'N7' // No closure
  | 'N8'; // Overreach / confabulation

export type PositivePattern = 'P1' | 'P2' | 'P3' | 'P4' | 'P5' | 'P6';

export type DeepThinkingRubricV2 = {
  total: number; // 0..14
  criteria: Record<
    | 'framing'
    | 'alternatives'
    | 'tradeoffs'
    | 'assumptions_gaps'
    | 'closure_conditions'
    | 'clarity'
    | 'safety_honesty',
    0 | 1 | 2
  >;
  notes: string[];
};

function hasAny(text: string, needles: string[]): boolean {
  const t = text.toLowerCase();
  return needles.some((n) => t.includes(n.toLowerCase()));
}

function extractSection(text: string, headingNeedles: string[]): string | null {
  const lines = String(text || '').split('\n');
  const idx = lines.findIndex((l) => hasAny(l, headingNeedles));
  if (idx < 0) return null;

  const out: string[] = [];
  for (let i = idx + 1; i < lines.length; i += 1) {
    const line = lines[i] || '';
    if (i > idx + 1 && /^[A-ZĄĆĘŁŃÓŚŹŻ][A-Za-zĄĆĘŁŃÓŚŹŻąćęłńóśźż\s&+/-]{2,}$/.test(line.trim())) {
      break;
    }
    out.push(line);
  }
  return out.join('\n').trim();
}

function extractOptions(text: string): string[] {
  const optionsSection = extractSection(text, ['options', 'opcje', 'warianty']);
  if (!optionsSection) return [];
  const lines = optionsSection.split('\n');
  const items: string[] = [];
  for (const l of lines) {
    const m = l.match(/^\s*(?:-|\*|\d+\.)\s+(.+)\s*$/);
    if (m?.[1]) items.push(m[1].trim());
  }
  const seen = new Set<string>();
  const uniq: string[] = [];
  for (const it of items) {
    const norm = it.toLowerCase().replace(/[^a-ząćęłńóśźż0-9\s]/gi, '').replace(/\s+/g, ' ').trim();
    if (!norm) continue;
    if (seen.has(norm)) continue;
    seen.add(norm);
    uniq.push(it);
  }
  return uniq;
}

function countListItems(text: string): number {
  const items = String(text || '').match(/^\s*(?:-|\*|\d+\.)\s+\S+/gm);
  return items ? items.length : 0;
}

function detectIfDoNothing(text: string): boolean {
  return hasAny(text, [
    'if we do nothing',
    'do nothing',
    'no action',
    'status quo',
    'if nothing changes',
    // PL
    'jeśli nic nie zrobimy',
    'nic nie zrobimy',
    'brak działania',
    'bez zmian',
  ]);
}

function detectTradeoffs(text: string): boolean {
  const t = String(text || '').toLowerCase();
  if (
    /\bvs\b/.test(t) &&
    hasAny(t, [
      'speed',
      'cost',
      'risk',
      'quality',
      'time',
      // PL
      'czas',
      'koszt',
      'ryzyk',
      'jakoś',
    ])
  ) {
    return true;
  }

  return hasAny(text, [
    'trade-off',
    'tradeoff',
    'tension',
    'compromise',
    // PL
    'kompromis',
    'kosztem',
    'w zamian',
    'balans',
    'trade-offy',
  ]);
}

function detectAssumptionsGaps(text: string): boolean {
  return hasAny(text, [
    'assumption',
    'assumptions',
    'unknown',
    'we don’t know',
    "we don't know",
    'gap',
    'missing data',
    // PL
    'założen',
    'nie wiemy',
    'brak danych',
    'luka',
    'hipotez',
  ]);
}

function detectBoundaryConditions(text: string): boolean {
  return hasAny(text, [
    'unless',
    'only if',
    'if and only if',
    'when it fails',
    'fails when',
    // PL
    'chyba że',
    'pod warunkiem',
    'nie działa gdy',
    'kiedy nie działa',
    'gdy',
    'jeśli',
  ]);
}

function detectEarlySignals(text: string): boolean {
  return hasAny(text, [
    'early signal',
    'leading indicator',
    'monitor',
    'watch',
    // PL
    'wczesne sygna',
    'wskaźnik',
    'monitoruj',
    'obserwuj',
    'leading indicators',
  ]);
}

function detectOverreach(text: string): boolean {
  // Heuristic: specific named external authorities/standards without citations,
  // or concrete "according to" claims. This is intentionally conservative.
  const t = text.toLowerCase();
  const hasAuthority =
    hasAny(t, ['mckinsey', 'bcg', 'gartner', 'harvard', 'iso ', 'iso-', 'pwc', 'deloitte']) ||
    hasAny(t, ['according to', 'source:', 'źródło', 'wg ', 'według ']);
  const hasLink = /https?:\/\/\S+/i.test(text);
  return Boolean(hasAuthority || hasLink);
}

export function detectPatterns(text: string, language?: string): {
  negative: NegativePattern[];
  positive: PositivePattern[];
  diagnostics: Record<string, unknown>;
} {
  const t = String(text || '').trim();
  const dod = validateDeepThinkingDoD(t, language);
  const options = extractOptions(t);
  const nextActions = extractSection(t, ['next actions', 'kolejne kroki', 'następne kroki', 'checklista']) || '';
  const hasChecklist = countListItems(nextActions) >= 3;

  const negative = new Set<NegativePattern>();
  const positive = new Set<PositivePattern>();

  // Negative patterns (N1–N8)
  if (dod.missing.includes('problem_framing') || !detectIfDoNothing(t)) negative.add('N1');
  if (options.length < 2) negative.add('N2');
  if (!detectTradeoffs(t)) negative.add('N3');

  const strongConfidence = hasAny(t, [
    'definitely',
    'certainly',
    'guarantee',
    '100%',
    // PL
    'na pewno',
    'gwarantuj',
    'z pewnością',
    'bez wątpienia',
  ]);
  if (strongConfidence && !detectAssumptionsGaps(t)) negative.add('N4');

  // "Soup": long + missing key elements (structure-only)
  if (t.length > 2200 && (!dod.ok || dod.missing.includes('executive_summary_too_thin'))) negative.add('N5');

  // Checklist-only: lots of steps but missing reasoning structure
  if (hasChecklist && (options.length < 2 || dod.missing.includes('recommendation'))) negative.add('N6');

  // No closure: no recommendation or no boundary conditions / when fails
  if (dod.missing.includes('recommendation') || !detectBoundaryConditions(t)) negative.add('N7');

  // Overreach / confabulation proxy
  if (detectOverreach(t) && !detectAssumptionsGaps(t)) negative.add('N8');

  // Positive patterns (P1–P6)
  if (!negative.has('N1') && detectIfDoNothing(t)) positive.add('P1');
  if (options.length >= 2 && options.length <= 4) positive.add('P2');
  if (detectTradeoffs(t)) positive.add('P3');
  if (detectAssumptionsGaps(t)) positive.add('P4');
  if (detectBoundaryConditions(t)) positive.add('P5');
  if (!dod.missing.includes('next_actions') && detectEarlySignals(t) && !dod.missing.includes('recommendation')) {
    positive.add('P6');
  }

  return {
    negative: Array.from(negative),
    positive: Array.from(positive),
    diagnostics: {
      dod,
      optionsCount: options.length,
      hasChecklist,
    },
  };
}

export function scoreRubricV2(text: string, language?: string): DeepThinkingRubricV2 {
  const t = String(text || '').trim();
  const notes: string[] = [];
  if (!t) {
    return {
      total: 0,
      criteria: {
        framing: 0,
        alternatives: 0,
        tradeoffs: 0,
        assumptions_gaps: 0,
        closure_conditions: 0,
        clarity: 0,
        safety_honesty: 0,
      },
      notes: ['empty_output'],
    };
  }

  const dod = validateDeepThinkingDoD(t, language);
  const options = extractOptions(t);

  // Framing (0..2)
  const hasFramingHeading = !dod.missing.includes('problem_framing');
  const framing: 0 | 1 | 2 = !hasFramingHeading ? 0 : detectIfDoNothing(t) ? 2 : 1;
  if (framing < 2) notes.push('framing_missing_if_do_nothing_or_heading');

  // Alternatives (0..2)
  const alternatives: 0 | 1 | 2 =
    options.length < 2 ? 0 : options.length > 4 ? 1 : hasAny(t, ['consequence', 'impact', 'pros', 'cons', 'koszt', 'ryzyko', 'konsekwencj']) ? 2 : 1;
  if (alternatives < 2) notes.push('alternatives_need_2_4_distinct_and_consequences');

  // Trade-offs (0..2)
  const tradeoffs: 0 | 1 | 2 = detectTradeoffs(t) ? 2 : hasAny(t, ['vs', 'versus', 'plus', 'minus', 'zaleta', 'wada']) ? 1 : 0;
  if (tradeoffs < 2) notes.push('tradeoffs_not_explicit');

  // Assumptions & gaps (0..2)
  const assumptions_gaps: 0 | 1 | 2 =
    detectAssumptionsGaps(t) ? (hasAny(t, ['assumption', 'założen']) && hasAny(t, ['gap', 'brak danych', 'unknown', 'nie wiemy']) ? 2 : 1) : 0;
  if (assumptions_gaps < 2) notes.push('assumptions_gaps_need_explicitness');

  // Closure + recommendation/conditions (0..2)
  const hasRecommendation = !dod.missing.includes('recommendation');
  const closure_conditions: 0 | 1 | 2 = !hasRecommendation ? 0 : detectBoundaryConditions(t) ? 2 : 1;
  if (closure_conditions < 2) notes.push('closure_needs_boundary_conditions_and_when_fails');

  // Clarity (0..2) — do NOT reward length
  const exec = extractSection(t, ['executive summary', 'podsumowanie', 'streszczenie']) || '';
  const clarityPenalty = dod.missing.includes('executive_summary_too_thin') || dod.missing.includes('next_actions_checklist_too_short');
  const clarity: 0 | 1 | 2 =
    !exec
      ? 0
      : clarityPenalty
        ? 1
        : t.length > 7000 && !hasAny(t, ['1)', '2)', '3)'])
          ? 0
          : 2;
  if (clarity < 2) notes.push('clarity_needs_exec_grade_and_no_fluff');

  // Safety/honesty (0..2)
  const overreach = detectOverreach(t);
  const safety_honesty: 0 | 1 | 2 = overreach ? (detectAssumptionsGaps(t) ? 1 : 0) : detectAssumptionsGaps(t) ? 2 : 1;
  if (safety_honesty < 2) notes.push('safety_honesty_risk_of_overreach_or_missing_unknowns');

  const criteria = {
    framing,
    alternatives,
    tradeoffs,
    assumptions_gaps,
    closure_conditions,
    clarity,
    safety_honesty,
  } as const;
  const total = (Object.values(criteria) as number[]).reduce((a, b) => a + b, 0);

  return { total, criteria, notes };
}

export function pairwiseCompareDeepThinking(args: {
  a: string;
  b: string;
  language?: string;
}): {
  winner: 'A' | 'B' | 'TIE';
  rationale: string;
  a: { dod: ReturnType<typeof validateDeepThinkingDoD>; rubric: DeepThinkingRubricV2; patterns: ReturnType<typeof detectPatterns> };
  b: { dod: ReturnType<typeof validateDeepThinkingDoD>; rubric: DeepThinkingRubricV2; patterns: ReturnType<typeof detectPatterns> };
} {
  const { a, b, language } = args;
  const aDod = validateDeepThinkingDoD(a, language);
  const bDod = validateDeepThinkingDoD(b, language);
  const aRubric = scoreRubricV2(a, language);
  const bRubric = scoreRubricV2(b, language);
  const aPatterns = detectPatterns(a, language);
  const bPatterns = detectPatterns(b, language);

  let winner: 'A' | 'B' | 'TIE' = 'TIE';
  if (aDod.ok && !bDod.ok) winner = 'A';
  else if (!aDod.ok && bDod.ok) winner = 'B';
  else if (aRubric.total > bRubric.total + 1) winner = 'A';
  else if (bRubric.total > aRubric.total + 1) winner = 'B';

  // Tie-breaker: if both equal-ish, prefer fewer negative patterns (still not length)
  if (winner === 'TIE') {
    const aNeg = aPatterns.negative.length;
    const bNeg = bPatterns.negative.length;
    if (aNeg + 1 < bNeg) winner = 'A';
    else if (bNeg + 1 < aNeg) winner = 'B';
  }

  const rationaleLines: string[] = [];
  rationaleLines.push(`Decision rule: DoD pass > rubric total > fewer negative patterns (never length).`);
  rationaleLines.push(`A: DoD=${aDod.ok ? 'pass' : 'fail'} score=${aRubric.total}/14 neg=${aPatterns.negative.join(',') || '-'}`);
  rationaleLines.push(`B: DoD=${bDod.ok ? 'pass' : 'fail'} score=${bRubric.total}/14 neg=${bPatterns.negative.join(',') || '-'}`);
  if (winner === 'A') {
    rationaleLines.push(`Winner: A — stronger compliance + decision-grade elements.`);
  } else if (winner === 'B') {
    rationaleLines.push(`Winner: B — stronger compliance + decision-grade elements.`);
  } else {
    rationaleLines.push(`Winner: TIE — both comparable by DoD/rubric.`);
  }

  // Keep backward compatibility with existing rubric if needed elsewhere
  void scoreDeepThinkingRubric; // reference to avoid accidental unused removal when bundlers tree-shake

  return {
    winner,
    rationale: rationaleLines.join('\n'),
    a: { dod: aDod, rubric: aRubric, patterns: aPatterns },
    b: { dod: bDod, rubric: bRubric, patterns: bPatterns },
  };
}

