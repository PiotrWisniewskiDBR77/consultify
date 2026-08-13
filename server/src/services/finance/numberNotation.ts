/**
 * RC-00 — Locale-aware number notation for financial statement ingestion.
 *
 * WHY THIS EXISTS
 * ---------------
 * A financial statement figure such as `122,070` (English notation) and `267.732`
 * (German/Polish notation) carry the SAME digit sequence but a different separator
 * role. Parsing them token-by-token, without knowing which notation the document
 * uses, silently produces a value that is wrong by exactly 1000x:
 *
 *   "122,070" read with a European convention -> 122.07   (should be 122070)
 *   "267.732" read with an English convention -> 267.732  (should be 267732)
 *
 * The magnitude error is invisible downstream — the unit/multiplier layer receives an
 * already-broken number — so the rule must be resolved ONCE PER DOCUMENT, from the
 * document's own evidence, and never guessed per value in isolation.
 *
 * CONTRACT
 * --------
 *  1. `detectNumberNotation(text, hints)` resolves the notation for a whole document,
 *     preferring structurally unambiguous in-document evidence over language/currency
 *     hints. Notation is a property of the DOCUMENT, not of the individual value.
 *  2. `parseStatementNumber(raw, notation)` applies that notation. Where a token is
 *     structurally unambiguous (two grouping separators, or both separators present)
 *     the structure wins and the notation is not consulted at all.
 *  3. A token that stays ambiguous (single separator + exactly three trailing digits,
 *     with no resolved document notation) is NEVER silently guessed: the result is
 *     returned with `ambiguous: true` so the caller can raise a quality flag.
 */

export type NumberNotation = 'en' | 'eu' | 'unknown';

export interface NumberNotationEvidence {
  /** `1,234.56` / `1,234,567` — comma grouping proven by a following dot decimal or a second group. */
  enGrouping: number;
  /** `1.234,56` / `1.234.567` — dot grouping proven by a following comma decimal or a second group. */
  euGrouping: number;
  /** `12.34`, `0.5` — dot decimal with a non-three-digit tail (weak English signal). */
  enDecimal: number;
  /** `12,34`, `0,5` — comma decimal with a non-three-digit tail (weak European signal). */
  euDecimal: number;
  /** `1 234 567` — space grouping. Recorded for diagnostics; never used to decide. */
  spaceGrouping: number;
  /** Tokens that remain ambiguous under the resolved notation (`1,234` / `267.732`). */
  ambiguousShape: number;
}

export interface NumberNotationProfile {
  notation: NumberNotation;
  confidence: 'high' | 'medium' | 'low' | 'none';
  source: 'document_evidence' | 'language_hint' | 'currency_hint' | 'none';
  evidence: NumberNotationEvidence;
}

export interface NumberNotationHints {
  /** Document language as detected upstream (`pl` | `en` | `de` | `fr` | …). */
  language?: string | null;
  /** Reporting currency as detected upstream (`PLN` | `USD` | `EUR` | …). */
  currency?: string | null;
}

export type SeparatorRole =
  | 'grouping' // separator groups thousands
  | 'decimal' // separator introduces the fractional part
  | 'plain' // no separator at all
  | 'none'; // nothing parseable

export interface ParsedStatementNumber {
  value: number | null;
  /** True when the token's shape alone could not decide and no document notation was available. */
  ambiguous: boolean;
  separatorRole: SeparatorRole;
  /** Machine-readable explanation, suitable for a quality flag / audit trail. */
  reason: string;
}

/** Whitespace variants used as thousands separators in PL/FR/CH typesetting, plus the CH apostrophe. */
const GROUPING_WHITESPACE = /[\s    ٬']/g;

/**
 * Locale families. Only notation matters here, not the full locale:
 *  - `eu` = dot (or space) groups thousands, comma introduces decimals
 *  - `en` = comma groups thousands, dot introduces decimals
 */
const EU_LANGUAGES = new Set([
  'pl',
  'de',
  'fr',
  'es',
  'it',
  'pt',
  'nl',
  'cs',
  'sk',
  'hu',
  'ro',
  'ru',
  'uk',
  'lt',
  'lv',
  'sl',
  'hr',
  'bg',
  'da',
  'fi',
  'sv',
  'no',
  'tr',
  'el',
]);
const EN_LANGUAGES = new Set(['en', 'ga', 'mt', 'he', 'ja', 'zh', 'ko', 'th']);

/** Currencies whose issuers overwhelmingly report in one notation. EUR is deliberately absent
 *  (Ireland and Malta report in English notation, Germany and France in European notation). */
const EU_CURRENCIES = new Set(['PLN', 'CZK', 'HUF', 'RON', 'SEK', 'NOK', 'DKK', 'RUB', 'UAH']);
const EN_CURRENCIES = new Set(['USD', 'GBP', 'JPY', 'CNY', 'HKD', 'AUD', 'CAD', 'NZD', 'SGD']);

/** `1,234.5` or `1,234,567` — comma cannot be a decimal separator in either shape. */
const EN_GROUPING_RE = /(?<![\d.,])\d{1,3}(?:,\d{3})+(?:\.\d+)?(?![\d.,])/g;
/** `1.234,5` or `1.234.567` — dot cannot be a decimal separator in either shape. */
const EU_GROUPING_RE = /(?<![\d.,])\d{1,3}(?:\.\d{3})+(?:,\d+)?(?![\d.,])/g;
/** `12.5`, `0.75`, `12.3456` — a dot tail that is not a three-digit group. */
const EN_DECIMAL_RE = /(?<![\d.,])\d+\.(?:\d{1,2}|\d{4,})(?![\d.,])/g;
/** `12,5`, `0,75`, `12,3456` — a comma tail that is not a three-digit group. */
const EU_DECIMAL_RE = /(?<![\d.,])\d+,(?:\d{1,2}|\d{4,})(?![\d.,])/g;
/** `1 234 567` — space grouping (diagnostic only). */
const SPACE_GROUPING_RE = /(?<![\d.,])\d{1,3}(?:[    ]\d{3})+(?![\d., ])/g;
/** `1,234` or `267.732` — a single separator with exactly three trailing digits. */
const AMBIGUOUS_SHAPE_RE = /(?<![\d.,])\d{1,3}[.,]\d{3}(?![\d.,])/g;

function countMatches(text: string, re: RegExp): number {
  re.lastIndex = 0;
  let count = 0;
  while (re.exec(text) !== null) count += 1;
  re.lastIndex = 0;
  return count;
}

/**
 * Strip the constructs that mimic grouped numbers but are not numbers:
 *  - PDF page markers `-- 12 of 40 --`
 *  - dotted dates `31.12.2024` (which would otherwise read as European grouping)
 *  - slashed dates `12/31/2024`
 *  - English date-with-comma `December 31, 2024` (a comma followed by a 4-digit year)
 */
function stripNonNumericLookalikes(text: string): string {
  return text
    .replace(/--\s*\d+\s+of\s+\d+\s*--/gi, ' ')
    .replace(/\b\d{1,2}\.\d{1,2}\.\d{2,4}\b/g, ' ')
    .replace(/\b\d{1,4}[/-]\d{1,2}[/-]\d{1,4}\b/g, ' ')
    .replace(/,\s*(?:19|20)\d{2}\b/g, ' ');
}

/**
 * Resolve which notation a whole document uses.
 *
 * Order of authority (never inverted):
 *   1. structurally unambiguous grouping evidence found inside the document,
 *   2. weaker decimal-tail evidence inside the document,
 *   3. the document's detected language,
 *   4. the document's reporting currency,
 *   5. `unknown` — the caller must treat ambiguous tokens as needing attention.
 */
export function detectNumberNotation(
  text: string,
  hints: NumberNotationHints = {}
): NumberNotationProfile {
  const sample = stripNonNumericLookalikes(String(text || ''));
  const evidence: NumberNotationEvidence = {
    enGrouping: countMatches(sample, EN_GROUPING_RE),
    euGrouping: countMatches(sample, EU_GROUPING_RE),
    enDecimal: countMatches(sample, EN_DECIMAL_RE),
    euDecimal: countMatches(sample, EU_DECIMAL_RE),
    spaceGrouping: countMatches(sample, SPACE_GROUPING_RE),
    ambiguousShape: countMatches(sample, AMBIGUOUS_SHAPE_RE),
  };

  const build = (
    notation: NumberNotation,
    confidence: NumberNotationProfile['confidence'],
    source: NumberNotationProfile['source']
  ): NumberNotationProfile => ({ notation, confidence, source, evidence });

  // 1. Unambiguous grouping evidence. A document mixing both shapes is not trusted:
  //    that happens when a report quotes foreign figures, so require a clear majority.
  const { enGrouping, euGrouping } = evidence;
  if (enGrouping > 0 || euGrouping > 0) {
    if (enGrouping >= Math.max(2 * euGrouping, 1)) return build('en', 'high', 'document_evidence');
    if (euGrouping >= Math.max(2 * enGrouping, 1)) return build('eu', 'high', 'document_evidence');
  }

  // 2. Weaker decimal-tail evidence (a "0,5" cannot be grouping; neither can a "0.5").
  const { enDecimal, euDecimal } = evidence;
  if (enDecimal + euDecimal >= 3) {
    if (enDecimal >= Math.max(2 * euDecimal, 1)) return build('en', 'medium', 'document_evidence');
    if (euDecimal >= Math.max(2 * enDecimal, 1)) return build('eu', 'medium', 'document_evidence');
  }

  // 3. Document language.
  const language = String(hints.language || '')
    .trim()
    .toLowerCase()
    .slice(0, 2);
  if (EU_LANGUAGES.has(language)) return build('eu', 'low', 'language_hint');
  if (EN_LANGUAGES.has(language)) return build('en', 'low', 'language_hint');

  // 4. Reporting currency.
  const currency = String(hints.currency || '')
    .trim()
    .toUpperCase();
  if (EU_CURRENCIES.has(currency)) return build('eu', 'low', 'currency_hint');
  if (EN_CURRENCIES.has(currency)) return build('en', 'low', 'currency_hint');

  return build('unknown', 'none', 'none');
}

const NONE: ParsedStatementNumber = {
  value: null,
  ambiguous: false,
  separatorRole: 'none',
  reason: 'NOT_A_NUMBER',
};

/**
 * Parse one statement token under a resolved document notation.
 *
 * Structure beats notation wherever the structure is decisive:
 *   - both separators present  -> the LAST one is the decimal separator (universal rule)
 *   - two or more identical separators -> grouping (a number has at most one decimal point)
 *   - a separator tail that is not exactly three digits -> decimal separator
 * Only `<1-3 digits><separator><exactly 3 digits>` needs the document notation, and when the
 * notation is `unknown` the result is flagged `ambiguous` instead of being quietly guessed.
 */
export function parseStatementNumber(
  raw: string,
  notation: NumberNotation = 'unknown'
): ParsedStatementNumber {
  let s = String(raw ?? '').trim();
  if (!s) return NONE;

  // Accounting negatives: (1 234), -1 234, 1 234-
  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1).trim();
  }
  if (/^[-−–—]/.test(s)) {
    negative = true;
    s = s.slice(1).trim();
  }
  if (/[-−–—]$/.test(s)) {
    negative = true;
    s = s.slice(0, -1).trim();
  }

  s = s.replace(GROUPING_WHITESPACE, '');
  if (!/^\d[\d.,]*$/.test(s)) return NONE;
  // A trailing separator is sentence punctuation, not a decimal point ("Total assets 122,070.").
  s = s.replace(/[.,]+$/, '');
  if (!/^\d[\d.,]*$/.test(s)) return NONE;

  const finish = (
    digits: string,
    separatorRole: SeparatorRole,
    reason: string,
    ambiguous = false
  ): ParsedStatementNumber => {
    const num = Number.parseFloat(digits);
    if (!Number.isFinite(num)) return NONE;
    return { value: negative ? -num : num, ambiguous, separatorRole, reason };
  };

  const commaCount = (s.match(/,/g) || []).length;
  const dotCount = (s.match(/\./g) || []).length;

  // No separator at all.
  if (commaCount === 0 && dotCount === 0) return finish(s, 'plain', 'PLAIN_INTEGER');

  // Both separators present: the rightmost one is the decimal separator in every locale.
  if (commaCount > 0 && dotCount > 0) {
    const decimalSep = s.lastIndexOf(',') > s.lastIndexOf('.') ? ',' : '.';
    const groupSep = decimalSep === ',' ? '.' : ',';
    const digits = s.split(groupSep).join('').replace(decimalSep, '.');
    return finish(
      digits,
      'decimal',
      decimalSep === ',' ? 'MIXED_SEPARATORS_EU_DECIMAL' : 'MIXED_SEPARATORS_EN_DECIMAL'
    );
  }

  const sep = commaCount > 0 ? ',' : '.';
  const parts = s.split(sep);
  const head = parts[0];
  const tail = parts[parts.length - 1];

  // Two or more identical separators can only be grouping.
  if (parts.length > 2) {
    const grouped = parts.slice(1).every((part) => part.length === 3) && head.length <= 3;
    return finish(
      parts.join(''),
      'grouping',
      grouped ? 'REPEATED_SEPARATOR_GROUPING' : 'REPEATED_SEPARATOR_MALFORMED'
    );
  }

  // Single separator.
  if (tail.length !== 3) {
    // A 1-, 2- or 4+-digit tail cannot be a thousands group.
    return finish(`${head}.${tail}`, 'decimal', 'NON_GROUP_TAIL_IS_DECIMAL');
  }
  if (head.length > 3) {
    // `12345,678` — the leading run is too long to be the first group of a grouped number.
    return finish(`${head}.${tail}`, 'decimal', 'OVERLONG_HEAD_IS_DECIMAL');
  }

  // `<1-3 digits><sep><3 digits>` — the only genuinely ambiguous shape. This is RC-00.
  const separatorIsGrouping =
    notation === 'en' ? sep === ',' : notation === 'eu' ? sep === '.' : null;

  if (separatorIsGrouping === null) {
    // No document notation: do not invent one. Report the grouped reading (statement
    // subtotals are integers) but mark the value as requiring attention.
    return finish(
      `${head}${tail}`,
      'grouping',
      'AMBIGUOUS_SEPARATOR_NO_DOCUMENT_NOTATION',
      true
    );
  }

  return separatorIsGrouping
    ? finish(`${head}${tail}`, 'grouping', `NOTATION_${notation.toUpperCase()}_GROUPING`)
    : finish(`${head}.${tail}`, 'decimal', `NOTATION_${notation.toUpperCase()}_DECIMAL`);
}
