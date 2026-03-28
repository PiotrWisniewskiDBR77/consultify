/**
 * Narrative Engine — Layer 5: Post-Checks
 *
 * Validates generated content against the discourse plan and source facts.
 * Checks:
 *   - No invented numbers (all numbers in content must appear in facts)
 *   - Correct period references
 *   - Source coverage (key facts are mentioned)
 *   - Hedging compliance (recommendations include evidence/rationale)
 */

import type { DiscoursePlan, FactSet, NarrativeEngineInput, PostCheckResult } from './types.js';

interface CheckContext {
  content: string;
  plan: DiscoursePlan;
  facts: FactSet[];
  input: NarrativeEngineInput;
  warnings: PostCheckResult['warnings'];
  errors: PostCheckResult['errors'];
}

// ── Individual checks ───────────────────────────────────────────

/**
 * Verify that all numbers in the generated content can be traced back to fact values.
 * Tolerates common formatting differences (commas, rounding).
 */
function checkNoInventedNumbers(ctx: CheckContext): void {
  const knownNumbers = new Set<string>();

  for (const fact of ctx.facts) {
    const val = fact.value;
    if (typeof val === 'number') {
      knownNumbers.add(String(val));
      knownNumbers.add(val.toFixed(0));
      knownNumbers.add(val.toFixed(1));
      knownNumbers.add(val.toFixed(2));
      if (val >= 1000) {
        knownNumbers.add(val.toLocaleString('en-US'));
        knownNumbers.add(val.toLocaleString('pl-PL'));
      }
    } else if (typeof val === 'string') {
      const parsed = parseFloat(val.replace(/[,\s]/g, ''));
      if (!isNaN(parsed)) {
        knownNumbers.add(String(parsed));
        knownNumbers.add(parsed.toFixed(0));
        knownNumbers.add(parsed.toFixed(1));
      }
    }
  }

  // Common safe numbers to ignore (percentages derived from counts, ordinals, etc.)
  const SAFE_NUMBERS = new Set(['0', '1', '2', '3', '4', '5', '100']);

  const numberPattern = /(?<!\[)\b(\d[\d,.\s]*\d|\d)\b(?![\]%]?\s*\w*_id)/g;
  let match: RegExpExecArray | null;

  while ((match = numberPattern.exec(ctx.content)) !== null) {
    const raw = match[1].replace(/[,\s]/g, '');
    if (SAFE_NUMBERS.has(raw)) continue;
    if (knownNumbers.has(raw)) continue;

    const asNum = parseFloat(raw);
    if (isNaN(asNum)) continue;

    let found = false;
    for (const known of knownNumbers) {
      const knownNum = parseFloat(known);
      if (!isNaN(knownNum) && Math.abs(knownNum - asNum) / (Math.abs(knownNum) || 1) < 0.02) {
        found = true;
        break;
      }
    }

    if (!found) {
      ctx.warnings.push({
        code: 'INVENTED_NUMBER',
        message: `Number "${match[1]}" in content cannot be traced to any source fact`,
        section_key: ctx.plan.section_key,
      });
    }
  }
}

/**
 * Verify period/date references in content match fact timestamps.
 */
function checkPeriodReferences(ctx: CheckContext): void {
  const knownPeriods = new Set<string>();

  for (const fact of ctx.facts) {
    if (fact.timestamp) {
      const d = new Date(fact.timestamp);
      if (!isNaN(d.getTime())) {
        knownPeriods.add(d.getFullYear().toString());
        knownPeriods.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
        knownPeriods.add(d.toISOString().slice(0, 10));
      }
    }
  }

  const yearPattern = /\b(20[12]\d)\b/g;
  let match: RegExpExecArray | null;

  while ((match = yearPattern.exec(ctx.content)) !== null) {
    const year = match[1];
    if (!knownPeriods.has(year)) {
      const currentYear = new Date().getFullYear().toString();
      if (year !== currentYear) {
        ctx.warnings.push({
          code: 'UNVERIFIED_PERIOD',
          message: `Year "${year}" referenced in content but not found in source facts`,
          section_key: ctx.plan.section_key,
        });
      }
    }
  }
}

/**
 * Check that high-severity facts are referenced in the content.
 */
function checkSourceCoverage(ctx: CheckContext): void {
  const importantFacts = ctx.facts.filter((f) => {
    const seg = ctx.plan.segments.find((s) => s.related_observations.length > 0);
    return seg !== undefined || typeof f.value === 'number';
  });

  if (importantFacts.length === 0) return;

  const contentLower = ctx.content.toLowerCase();
  let covered = 0;

  for (const fact of importantFacts) {
    const labelLower = fact.label.toLowerCase();
    const labelWords = labelLower.split(/\s+/).filter((w) => w.length > 3);
    const labelMatch = labelWords.some((w) => contentLower.includes(w));

    const valueStr = String(fact.value).toLowerCase();
    const valueMatch = contentLower.includes(valueStr);

    if (labelMatch || valueMatch) covered++;
  }

  const coverageRatio = importantFacts.length > 0 ? covered / importantFacts.length : 1;

  if (coverageRatio < 0.3) {
    ctx.errors.push({
      code: 'LOW_SOURCE_COVERAGE',
      message: `Only ${Math.round(coverageRatio * 100)}% of important facts are referenced in content (minimum: 30%)`,
      section_key: ctx.plan.section_key,
    });
  } else if (coverageRatio < 0.5) {
    ctx.warnings.push({
      code: 'PARTIAL_SOURCE_COVERAGE',
      message: `${Math.round(coverageRatio * 100)}% of important facts are referenced in content (recommended: ≥50%)`,
      section_key: ctx.plan.section_key,
    });
  }
}

/**
 * Verify that recommendation segments include rationale/evidence ("because", "due to", etc.).
 */
function checkHedgingCompliance(ctx: CheckContext): void {
  const recSegments = ctx.plan.segments.filter((s) => s.segment_type === 'recommendation');
  if (recSegments.length === 0) return;

  const hasRecommendationSection =
    ctx.content.toLowerCase().includes('recommendation') ||
    ctx.content.toLowerCase().includes('zaleceni');

  if (!hasRecommendationSection && recSegments.length > 0) {
    ctx.warnings.push({
      code: 'MISSING_RECOMMENDATIONS',
      message:
        'Discourse plan includes recommendation segments but content lacks a recommendations section',
      section_key: ctx.plan.section_key,
    });
    return;
  }

  const evidenceMarkers = [
    'because',
    'due to',
    'as a result',
    'given that',
    'based on',
    'evidence',
    'data shows',
    'analysis indicates',
    'ponieważ',
    'ze względu na',
    'w oparciu o',
    'na podstawie',
    'wynika z',
  ];

  const contentLower = ctx.content.toLowerCase();
  const hasEvidence = evidenceMarkers.some((marker) => contentLower.includes(marker));

  if (!hasEvidence) {
    ctx.warnings.push({
      code: 'HEDGING_NO_EVIDENCE',
      message:
        'Recommendations section lacks evidence markers (e.g. "because", "based on", "due to")',
      section_key: ctx.plan.section_key,
    });
  }
}

/**
 * Run all post-checks on the generated narrative content.
 */
export function runPostChecks(
  content: string,
  plan: DiscoursePlan,
  facts: FactSet[],
  input: NarrativeEngineInput
): PostCheckResult {
  const ctx: CheckContext = {
    content,
    plan,
    facts,
    input,
    warnings: [],
    errors: [],
  };

  checkNoInventedNumbers(ctx);
  checkPeriodReferences(ctx);
  checkSourceCoverage(ctx);
  checkHedgingCompliance(ctx);

  return {
    passed: ctx.errors.length === 0,
    warnings: ctx.warnings,
    errors: ctx.errors,
  };
}
