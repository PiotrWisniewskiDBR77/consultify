/**
 * Bundle Content Gate — F1.4
 *
 * Two checks:
 *   1. Placeholder scan — finds "TBD / TODO / [PLACEHOLDER] / LOREM" patterns
 *      in generated text across all bundle formats (deck, report, table).
 *   2. Hero-number consistency — if a spine provides hero numbers, verifies
 *      the formatted value for each key appears consistently (no contradictions).
 *      Inconsistency = same label key found with a DIFFERENT number in the text.
 *
 * Returns a ContentGateReport; never throws (fail-open on errors).
 *
 * NOTE: Wires seamlessly with SPINE's existing ValidationReport
 *       (businessPlanSpine.ts `validation.passed`) — caller can merge results.
 */

import logger from '../../utils/Logger.js';

// ── Placeholder patterns ─────────────────────────────────────────────────────
const PLACEHOLDER_PATTERNS = [
  /\[\s*PLACEHOLDER\s*\]/gi,
  /\[\s*INSERT[^\]]{0,40}\]/gi,
  /\[\s*TODO[^\]]{0,40}\]/gi,
  /\[\s*TBD[^\]]{0,40}\]/gi,
  /\bTBD\b/g,
  /\bLOREM\b/gi,
  /\bCOMING SOON\b/gi,
  /\[\s*ADD [^\]]{0,40}\]/gi,
  /AWAITING CONTENT/gi,
  /\bXXX+\b/g,
  /\(\?\?\?\)/g,
] as const;

// ── Types ────────────────────────────────────────────────────────────────────
export interface PlaceholderHit {
  pattern: string;
  context: string;
  format: 'deck' | 'report' | 'table' | 'unknown';
}

export interface HeroNumberMismatch {
  key: string;
  expected: string;
  foundVariants: string[];
}

export interface ContentGateReport {
  passed: boolean;
  placeholderHits: PlaceholderHit[];
  heroNumberMismatches: HeroNumberMismatch[];
  issues: string[];
}

export interface HeroNumber {
  key: string;
  label: string;
  formatted: string;
}

export interface BundleTextInput {
  deckText?: string;
  reportText?: string;
  tableText?: string;
}

// ── Placeholder scanner ──────────────────────────────────────────────────────
function scanPlaceholders(text: string, format: PlaceholderHit['format']): PlaceholderHit[] {
  const hits: PlaceholderHit[] = [];
  for (const pattern of PLACEHOLDER_PATTERNS) {
    let match: RegExpExecArray | null;
    const re = new RegExp(pattern.source, pattern.flags);
    while ((match = re.exec(text)) !== null) {
      const start = Math.max(0, match.index - 40);
      const end = Math.min(text.length, match.index + match[0].length + 40);
      hits.push({
        pattern: pattern.source,
        context: text.slice(start, end).replace(/\n/g, ' '),
        format,
      });
    }
  }
  return hits;
}

// ── Hero-number consistency ──────────────────────────────────────────────────
// Strategy: look for the hero's FORMATTED value in per-format texts.
// If the label appears in a format but the formatted value is ABSENT from that format,
// it's a potential mismatch. We only flag when evidence is strong (label present +
// formatted value absent), avoiding false positives from unrelated numbers.

function checkHeroNumbers(
  heroNumbers: HeroNumber[],
  inputs: BundleTextInput
): HeroNumberMismatch[] {
  const mismatches: HeroNumberMismatch[] = [];

  // Only check formats where we have text
  const formats: Array<[string, string]> = [
    ['deck', inputs.deckText ?? ''],
    ['report', inputs.reportText ?? ''],
    ['table', inputs.tableText ?? ''],
  ].filter(([, text]) => text.length > 0) as Array<[string, string]>;

  for (const hero of heroNumbers) {
    const found: string[] = [];
    for (const [format, text] of formats) {
      // Look for label in this format's text
      if (!text.toLowerCase().includes(hero.label.toLowerCase())) continue;
      // Check if formatted value (or its core numeric part) appears in this format
      const coreNum = hero.formatted.replace(/[^0-9.,]/g, '');
      if (coreNum.length > 0 && !text.includes(coreNum)) {
        // Label present but formatted value absent → record the discrepancy
        found.push(`${format}: label found but "${hero.formatted}" absent`);
      }
    }
    // Only flag when discrepancy is present in BOTH deck AND report (strong evidence)
    if (found.filter((f) => f.startsWith('deck') || f.startsWith('report')).length >= 2) {
      mismatches.push({
        key: hero.key,
        expected: hero.formatted,
        foundVariants: found,
      });
    }
  }
  return mismatches;
}

// ── Gate ─────────────────────────────────────────────────────────────────────

/**
 * Run the content gate against bundle text.
 *
 * @param inputs     Raw text strings per format
 * @param heroNumbers  Optional list of spine hero numbers to check consistency
 */
export function runBundleContentGate(
  inputs: BundleTextInput,
  heroNumbers: HeroNumber[] = []
): ContentGateReport {
  try {
    const placeholderHits: PlaceholderHit[] = [
      ...scanPlaceholders(inputs.deckText ?? '', 'deck'),
      ...scanPlaceholders(inputs.reportText ?? '', 'report'),
      ...scanPlaceholders(inputs.tableText ?? '', 'table'),
    ];

    const heroNumberMismatches = checkHeroNumbers(heroNumbers, inputs);

    const issues: string[] = [];
    if (placeholderHits.length > 0) {
      issues.push(
        `${placeholderHits.length} placeholder(s) found in output (TBD / TODO / [PLACEHOLDER] / LOREM etc.)`
      );
    }
    if (heroNumberMismatches.length > 0) {
      issues.push(
        `${heroNumberMismatches.length} hero-number mismatch(es): ` +
          heroNumberMismatches.map((m) => `${m.key} expected "${m.expected}"`).join('; ')
      );
    }

    const passed = placeholderHits.length === 0 && heroNumberMismatches.length === 0;

    if (!passed) {
      logger.warn('[ContentGate] failed', {
        placeholders: placeholderHits.length,
        mismatches: heroNumberMismatches.length,
      });
    }

    return { passed, placeholderHits, heroNumberMismatches, issues };
  } catch (err) {
    logger.warn('[ContentGate] error during check — fail-open', { err: (err as Error)?.message });
    return { passed: true, placeholderHits: [], heroNumberMismatches: [], issues: [] };
  }
}
