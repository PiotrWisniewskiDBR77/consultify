/**
 * conclusionValidators — the 12 machine validators from
 * `docs/standards/CONCLUSION_LAYER_STANDARD.md` §4.4, implemented as PURE
 * functions over a variant-agnostic shape so the same lint runs against any
 * K1→K2→K3→K4 conclusion (W2 tool output, W3 finance chain, …) before it is
 * allowed to render as a WNIOSEK.
 *
 * This is a pragmatic, machine-checkable SUBSET of §4.4/§5 — a lint, not a
 * substitute for the adversarial recenzent checklist (§5). It exists to
 * catch the mechanical failure modes (missing K-step, no owner, no horizon,
 * filler prose, an invented number) BEFORE a human/adversarial pass.
 *
 * Backend twin of `src/services/report/conclusionValidators.ts` (frontend).
 * Kept duplicated on purpose — server/ and src/ are separate TS projects
 * (HIGIENA WYKONANIA: esbuild per file, no cross-package bundling assumed).
 */

export type ValidatorResult = 'pass' | 'fail' | 'skip';

export interface ValidatableK3Action {
  action: string;
  whyFirst: string;
  ownerRole: string;
}

export interface ValidatableTradeoff {
  chosen: string;
  rejected: string;
  why: string;
}

export interface ValidatableChain {
  indicator: string;
  trend: string;
  driver: string;
  forecast: string | null;
  recommendation: string;
}

/** Variant-agnostic conclusion shape the validators operate on. */
export interface ValidatableConclusion {
  headline: string;
  k1Text: string;
  k1FactRefs: string[];
  k2Text: string;
  k2FactRefs: string[];
  k3Actions: ValidatableK3Action[];
  k4Text: string;
  k4Horizon: string | null | undefined;
  /** Weakest-link confidence over the evidence used. */
  confidence: 'confirmed' | 'mixed' | 'declared' | 'high' | 'medium' | 'low' | 'insufficient';
  language: 'pl' | 'en';
  /** The engine facts pool the numbers in the prose must come from (R5). */
  facts: Record<string, unknown>;
  /** W2 only — present ⇒ tradeoff_present is checked; absent ⇒ skipped. */
  tradeoffs?: ValidatableTradeoff[];
  /** W3 only — present ⇒ chain_complete is checked; absent ⇒ skipped. */
  chain?: ValidatableChain;
  /** W5 only — slide titles; present ⇒ title_is_thesis is checked. */
  slideTitles?: string[];
}

export interface ConclusionValidationReport {
  numbers_from_engine: ValidatorResult;
  k_complete: ValidatorResult;
  k3_max3: ValidatorResult;
  k4_horizon: ValidatorResult;
  evidence_link: ValidatorResult;
  confidence_honest: ValidatorResult;
  no_filler: ValidatorResult;
  len_limits: ValidatorResult;
  lang: ValidatorResult;
  tradeoff_present: ValidatorResult;
  chain_complete: ValidatorResult;
  title_is_thesis: ValidatorResult;
  /** Hard gate: numbers_from_engine + k_complete + k3_max3 + k4_horizon +
   *  no_filler + (tradeoff_present if checked) + (chain_complete if checked).
   *  A conclusion failing this MUST NOT be published (§4.4 pipeline). */
  allHardPass: boolean;
  /** Convenience: which validators actually failed (names). */
  failures: string[];
}

// ---------------------------------------------------------------------------
// R1 — filler phrase list (PL primary per the standard; small EN set added).
// ---------------------------------------------------------------------------

const FILLER_PHRASES_PL = [
  'poprawić komunikację',
  'zoptymalizować procesy',
  'należy rozważyć',
  'warto zwrócić uwagę',
  'dynamiczny rozwój technologii',
  'w dzisiejszych czasach',
  'kluczowe znaczenie ma',
];

const FILLER_PHRASES_EN = [
  'leverage synergies',
  'optimize processes',
  "in today's world",
  'dynamic technology landscape',
  'consider exploring',
  'it is worth noting',
];

const HEDGE_PHRASES_PL = ['deklarowan', 'do potwierdzenia', 'do ustalenia', 'szacunkow'];
const HEDGE_PHRASES_EN = ['declared', 'to be confirmed', 'to be established', 'estimate'];

// A small allow-list of nietłumaczone terms (CARD_CONTENT_FORMULA §A5-style) so the
// `lang` heuristic does not flag legitimate PL/EN mixed vocabulary.
const EN_TERM_WHITELIST = new Set([
  'kpi',
  'roi',
  'mece',
  'raci',
  'capex',
  'opex',
  'cfo',
  'cto',
  'ceo',
  'ebitda',
  'ebit',
  'dso',
  'dio',
  'dpo',
  'wacc',
  'npv',
  'irr',
  'pi',
  'b2b',
  'b2c',
  'saas',
  'dach',
  'ev',
  'dcf',
  'p&l',
  'bs',
  'cf',
  'r1-r8',
  'r1',
  'r2',
  'r8',
  'llm',
  'ai',
  'fof',
  'siri',
  'adma',
]);

function wordCount(text: string): number {
  return text.trim().length === 0 ? 0 : text.trim().split(/\s+/).length;
}

function containsAny(haystack: string, needles: string[]): boolean {
  const low = haystack.toLowerCase();
  return needles.some((n) => low.includes(n.toLowerCase()));
}

/** Extract "meaningful" numeric tokens (2+ digits, or has a decimal/percent) — small
 * ordinals used for enumeration (1-5) are excluded to avoid false positives on
 * "pierwsza akcja" / "3 rekomendacje" style enumeration language. */
function extractMeaningfulNumbers(text: string): string[] {
  const matches: string[] = text.match(/\d+[.,]?\d*/g) || [];
  return matches.filter((m) => {
    const normalized = m.replace(',', '.');
    const n = Number(normalized);
    if (!Number.isFinite(n)) return false;
    if (m.includes('.') || m.includes(',')) return true; // any decimal counts
    return n >= 10 || n === 0; // small integers 1-9 are usually ordinals/counts, skip
  });
}

/** Flatten an arbitrary facts object into every numeric value it contains —
 * INCLUDING numbers embedded in prose strings (e.g. a `keyInsights` sentence
 * like "Klient A = 61% przychodu" legitimately carries the fact 61, not just
 * facts stored as bare numeric fields). This is what makes the check usable
 * against real session facts, which are often prose the engine/session
 * already produced, not a flat number table (R5 approximation). */
function flattenFactNumbers(facts: Record<string, unknown>): number[] {
  const out: number[] = [];
  const seen = new Set<unknown>();
  const walk = (value: unknown, depth: number) => {
    if (depth > 6 || value == null) return;
    if (typeof value === 'number') {
      if (Number.isFinite(value)) out.push(value);
      return;
    }
    if (typeof value === 'string') {
      for (const n of extractMeaningfulNumbers(value)) {
        const parsed = Number(n.replace(',', '.'));
        if (Number.isFinite(parsed)) out.push(parsed);
      }
      // Also allow the whole string when it IS a bare number (e.g. "38").
      const whole = Number(value.replace(',', '.'));
      if (Number.isFinite(whole)) out.push(whole);
      return;
    }
    if (typeof value === 'object') {
      if (seen.has(value)) return;
      seen.add(value);
      if (Array.isArray(value)) {
        value.forEach((v) => walk(v, depth + 1));
      } else {
        Object.values(value as Record<string, unknown>).forEach((v) => walk(v, depth + 1));
      }
    }
  };
  walk(facts, 0);
  return out;
}

// ---------------------------------------------------------------------------
// Individual validators
// ---------------------------------------------------------------------------

export function validateNumbersFromEngine(input: ValidatableConclusion): ValidatorResult {
  const prose = [
    input.headline,
    input.k1Text,
    input.k2Text,
    ...input.k3Actions.map((a) => a.action),
    input.k4Text,
  ].join(' ');
  const numbers = extractMeaningfulNumbers(prose);
  if (numbers.length === 0) return 'pass';
  const pool = flattenFactNumbers(input.facts);
  // Tolerant proximity match: a deterministic narrator legitimately derives
  // numbers FROM engine facts (safety-margin nudges like threshold*1.05,
  // benchmark midpoints, rounding) without inventing them — an exact string
  // match would flag those as "fabricated". ±25% of some real fact value is
  // accepted as "derived from the engine"; anything further off is flagged.
  const missing = numbers.filter((n) => {
    // Regex extraction cannot reliably capture a leading minus sign (prose
    // renders negatives many ways: "-0,4", "spadek 0,4", "(0,4)") — compare
    // magnitudes so a genuine engine number (e.g. delta=-0.4) still matches
    // its unsigned mention in prose ("spadło o 0,4").
    const value = Math.abs(Number(n.replace(',', '.')));
    if (!Number.isFinite(value)) return false;
    return !pool.some((raw) => {
      const p = Math.abs(raw);
      if (p === 0 && value === 0) return true;
      if (p === 0) return false;
      return Math.abs(value - p) / p <= 0.25;
    });
  });
  return missing.length === 0 ? 'pass' : 'fail';
}

export function validateKComplete(input: ValidatableConclusion): ValidatorResult {
  const ok =
    input.headline.trim().length > 0 &&
    input.k1Text.trim().length > 0 &&
    input.k2Text.trim().length > 0 &&
    input.k3Actions.length >= 1 &&
    input.k4Text.trim().length > 0;
  return ok ? 'pass' : 'fail';
}

export function validateK3Max3(input: ValidatableConclusion): ValidatorResult {
  const { k3Actions } = input;
  if (k3Actions.length < 1 || k3Actions.length > 3) return 'fail';
  const ok = k3Actions.every(
    (a) =>
      a.action.trim().length > 0 && a.whyFirst.trim().length > 0 && a.ownerRole.trim().length > 0
  );
  return ok ? 'pass' : 'fail';
}

export function validateK4Horizon(input: ValidatableConclusion): ValidatorResult {
  const horizon = (input.k4Horizon || '').trim();
  if (horizon.length > 0) return 'pass';
  const horizonPattern =
    /\d+\s*(miesi|kwarta[lł]|tygod|dni|dzień|rok|lat|month|quarter|week|day|year)/i;
  return horizonPattern.test(input.k4Text) ? 'pass' : 'fail';
}

export function validateEvidenceLink(input: ValidatableConclusion): ValidatorResult {
  return input.k2FactRefs.length >= 1 ? 'pass' : 'fail';
}

export function validateConfidenceHonest(input: ValidatableConclusion): ValidatorResult {
  const weak = ['mixed', 'declared', 'low', 'insufficient'].includes(input.confidence);
  if (!weak) return 'pass';
  const hedges = input.language === 'pl' ? HEDGE_PHRASES_PL : HEDGE_PHRASES_EN;
  const prose = `${input.k1Text} ${input.k2Text}`;
  return containsAny(prose, hedges) ? 'pass' : 'fail';
}

export function validateNoFiller(input: ValidatableConclusion): ValidatorResult {
  const prose = [
    input.headline,
    input.k1Text,
    input.k2Text,
    ...input.k3Actions.map((a) => a.action),
    input.k4Text,
  ].join(' ');
  const fillers = input.language === 'pl' ? FILLER_PHRASES_PL : FILLER_PHRASES_EN;
  return containsAny(prose, fillers) ? 'fail' : 'pass';
}

export function validateLenLimits(input: ValidatableConclusion): ValidatorResult {
  const headlineOk = wordCount(input.headline) <= 30;
  const k1Ok = wordCount(input.k1Text) <= 78; // R4 ≤60, 1.3x tolerance
  const k2Ok = wordCount(input.k2Text) <= 104; // R4 ≤80
  const k3Ok = input.k3Actions.every((a) => wordCount(a.action) <= 33); // R4 ≤25
  const k4Ok = wordCount(input.k4Text) <= 65; // R4 ≤50
  return headlineOk && k1Ok && k2Ok && k3Ok && k4Ok ? 'pass' : 'fail';
}

export function validateLang(input: ValidatableConclusion): ValidatorResult {
  if (input.language !== 'pl') return 'pass';
  const prose = [input.headline, input.k1Text, input.k2Text, input.k4Text].join(' ');
  // Heuristic: standalone English connector words leaking into PL prose.
  const leaks = /\b(the|and|with|this|that|for|from|which|their)\b/gi;
  const hits = prose.match(leaks) || [];
  // Allow up to 1 accidental hit (e.g. a quoted English term); >1 flags a real leak.
  if (hits.length <= 1) return 'pass';
  // Exempt whitelisted acronyms from counting toward the leak (case-insensitive check
  // already excludes them since they are not connector words).
  void EN_TERM_WHITELIST;
  return 'fail';
}

export function validateTradeoffPresent(input: ValidatableConclusion): ValidatorResult {
  if (input.tradeoffs === undefined) return 'skip';
  if (input.tradeoffs.length === 0) return 'fail';
  const first = input.tradeoffs[0];
  const ok =
    (first.chosen || '').trim().length > 0 &&
    (first.rejected || '').trim().length > 0 &&
    (first.why || '').trim().length > 0;
  return ok ? 'pass' : 'fail';
}

export function validateChainComplete(input: ValidatableConclusion): ValidatorResult {
  if (input.chain === undefined) return 'skip';
  const { indicator, trend, driver, recommendation } = input.chain;
  const ok =
    indicator.trim().length > 0 &&
    trend.trim().length > 0 &&
    driver.trim().length > 0 &&
    recommendation.trim().length > 0;
  // forecast is intentionally optional (null when the engine cannot project).
  return ok ? 'pass' : 'fail';
}

export function validateTitleIsThesis(input: ValidatableConclusion): ValidatorResult {
  if (input.slideTitles === undefined) return 'skip';
  if (input.slideTitles.length === 0) return 'fail';
  // A thesis title has a verb (very loose PL/EN heuristic: contains a space-separated
  // token ending in a verb-ish suffix, or simply has ≥5 words — a bare noun phrase is short).
  const ok = input.slideTitles.every((t) => wordCount(t) >= 5);
  return ok ? 'pass' : 'fail';
}

// ---------------------------------------------------------------------------
// Aggregator
// ---------------------------------------------------------------------------

export function validateConclusion(input: ValidatableConclusion): ConclusionValidationReport {
  const report: Omit<ConclusionValidationReport, 'allHardPass' | 'failures'> = {
    numbers_from_engine: validateNumbersFromEngine(input),
    k_complete: validateKComplete(input),
    k3_max3: validateK3Max3(input),
    k4_horizon: validateK4Horizon(input),
    evidence_link: validateEvidenceLink(input),
    confidence_honest: validateConfidenceHonest(input),
    no_filler: validateNoFiller(input),
    len_limits: validateLenLimits(input),
    lang: validateLang(input),
    tradeoff_present: validateTradeoffPresent(input),
    chain_complete: validateChainComplete(input),
    title_is_thesis: validateTitleIsThesis(input),
  };

  const hardKeys: (keyof typeof report)[] = [
    'numbers_from_engine',
    'k_complete',
    'k3_max3',
    'k4_horizon',
    'no_filler',
    'tradeoff_present',
    'chain_complete',
  ];
  const failures = Object.entries(report)
    .filter(([, v]) => v === 'fail')
    .map(([k]) => k);
  const allHardPass = hardKeys.every((k) => report[k] !== 'fail');

  return { ...report, allHardPass, failures };
}
