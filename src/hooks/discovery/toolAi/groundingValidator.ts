/**
 * groundingValidator — DETERMINISTIC post-parse guard against fabricated numbers.
 *
 * Born from the O-C2 adversarial panel (2026-07-09, panel v2): GROUNDING_RULES
 * (prompt-only instructions) improved 4/6 Discovery tools but capability-mapper
 * kept fabricating numbers stamped evidenceType:'fact' / confidence:5 /
 * provenance:'Platform data' — e.g. "0 ukończonych z 25 inicjatyw", "14
 * anulowanych" — with NO such figures anywhere in the session input. A prompt
 * instruction is advisory; the model can and does ignore it. This module is
 * the code-level backstop, in the same spirit as
 * server/src/services/advisory/BusinessCaseService.ts → checkNarrativeNumbers()
 * (extract numbers from generated text, compare against the facts that were
 * actually fed to the model).
 *
 * Call this on the raw parsed LLM JSON, BEFORE any apply*PendingAction() maps
 * it into store shapes (i.e. before ids are generated) — see useToolAI.ts.
 */

// ---------------------------------------------------------------------------
// Number extraction (same convention as BusinessCaseService.checkNarrativeNumbers:
// strip whitespace/comma/period separators, ignore lone single digits — those
// are almost always list markers / step counts, not client metrics).
// ---------------------------------------------------------------------------

const NUMBER_PATTERN = /-?\d[\d\s.,]*\d|\d/g;

function normalizeNumber(raw: string): string {
  return raw.replace(/[\s.,]/g, '');
}

function extractNumbers(text: string): string[] {
  if (!text) return [];
  const matches = text.match(NUMBER_PATTERN) || [];
  return matches.map(normalizeNumber).filter((n) => n.length >= 2);
}

function collectSourceNumbers(sources: string[]): Set<string> {
  const set = new Set<string>();
  for (const source of sources) {
    if (!source) continue;
    for (const n of extractNumbers(source)) set.add(n);
  }
  return set;
}

// ---------------------------------------------------------------------------
// Rule 1: fact/high-confidence/client-provenance record whose text carries a
// number absent from the grounding sources → downgrade in place.
// ---------------------------------------------------------------------------

/** Provenance strings that claim client/platform data (per GROUNDING_RULES). */
const CLIENT_PROVENANCE_PATTERN = /Platform data|Client briefing|Brief data|DBR77/i;

/** Keys that hold structural identifiers/refs, never a "claim" — skip them
 * when scanning for numbers so generated/echoed ids can't false-positive. */
const NUMBER_SCAN_EXCLUDE_KEYS = new Set(['id']);
const isRefIdKey = (key: string) => /Id$|Ids$/i.test(key) || NUMBER_SCAN_EXCLUDE_KEYS.has(key);

function qualifiesForFactCheck(obj: Record<string, any>): boolean {
  if (obj.evidenceType === 'fact') return true;
  if (typeof obj.confidence === 'number' && obj.confidence >= 4) return true;
  if (typeof obj.provenance === 'string' && CLIENT_PROVENANCE_PATTERN.test(obj.provenance)) {
    return true;
  }
  return false;
}

/** All string / string-array field values on this object (one level — nested
 * objects are validated independently as the recursion reaches them). */
function textFieldValues(obj: Record<string, any>): string[] {
  const texts: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    if (isRefIdKey(key)) continue;
    if (typeof value === 'string') {
      texts.push(value);
    } else if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === 'string') texts.push(item);
      }
    }
  }
  return texts;
}

function applyFactRule(
  obj: Record<string, any>,
  path: string,
  sourceNumbers: Set<string>,
  downgrades: GroundingDowngrade[]
): void {
  if (!qualifiesForFactCheck(obj)) return;

  const unverified: string[] = [];
  for (const text of textFieldValues(obj)) {
    for (const n of extractNumbers(text)) {
      if (!sourceNumbers.has(n) && !unverified.includes(n)) unverified.push(n);
    }
  }
  if (unverified.length === 0) return;

  obj.evidenceType = 'hypothesis';
  obj.confidence = 2;
  obj.requires_evidence = true;
  obj.provenance = 'AI-estimate (auto-downgraded: number not in source)';

  for (const number of unverified) {
    downgrades.push({
      path,
      number,
      reason: `number "${number}" not found in grounding sources`,
    });
  }
}

// ---------------------------------------------------------------------------
// Rule 2 (N2): records surfaced from QA/test artifacts (ticket/defect fixtures,
// probe data) must never present as confirmed fact — cap at 'observation'.
// ---------------------------------------------------------------------------

const QA_ARTIFACT_PATTERN = /\bQA\b|\bTEST\b|DEF-\d+|\bPROBE\b|\bfixture\b/i;
const QA_CHECK_KEYS = ['content', 'sourceLabel', 'title', 'description'];

function looksLikeQaArtifact(obj: Record<string, any>): boolean {
  return QA_CHECK_KEYS.some(
    (key) => typeof obj[key] === 'string' && QA_ARTIFACT_PATTERN.test(obj[key])
  );
}

function applyQaFilterRule(obj: Record<string, any>): void {
  if (!looksLikeQaArtifact(obj)) return;
  if (obj.evidenceType === 'fact') obj.evidenceType = 'observation';
  if (obj.state === 'confirmed') obj.state = 'proposed';
  obj.requires_evidence = true;
}

// ---------------------------------------------------------------------------
// Recursive walk
// ---------------------------------------------------------------------------

export interface GroundingDowngrade {
  path: string;
  number: string;
  reason: string;
}

export interface GroundingValidationResult<T = any> {
  output: T;
  downgrades: GroundingDowngrade[];
}

function walk(
  node: any,
  path: string,
  sourceNumbers: Set<string>,
  downgrades: GroundingDowngrade[]
): any {
  if (Array.isArray(node)) {
    return node.map((item, i) => walk(item, `${path}[${i}]`, sourceNumbers, downgrades));
  }
  if (node && typeof node === 'object') {
    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(node)) {
      result[key] = walk(value, path ? `${path}.${key}` : key, sourceNumbers, downgrades);
    }
    applyQaFilterRule(result);
    applyFactRule(result, path, sourceNumbers, downgrades);
    return result;
  }
  return node;
}

/**
 * Validate a parsed LLM output against the raw texts that were actually sent
 * to the model (the built prompt + org context — whatever went into the
 * prompt, verbatim). Returns a new, downgraded-where-needed output plus the
 * list of downgrades applied (for logging/QA — never surfaced to the user).
 *
 * Does NOT mutate parsedOutput.
 */
export function validateGrounding<T = any>(
  parsedOutput: T,
  groundingSources: string[]
): GroundingValidationResult<T> {
  const sourceNumbers = collectSourceNumbers(groundingSources);
  const downgrades: GroundingDowngrade[] = [];
  const output = walk(parsedOutput, 'root', sourceNumbers, downgrades);
  return { output, downgrades };
}
