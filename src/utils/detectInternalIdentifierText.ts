/**
 * CB-06 / RV-015 — heuristic check for backend-authored freeform text (e.g.
 * report-pack "limitations" strings) that leaks internal vocabulary: raw
 * snake_case worksheet/field keys or UUIDs. Used to route such text into a
 * support-only technical disclosure instead of the primary client-facing
 * surface — never to rewrite it, since its exact meaning isn't known here.
 */
const UUID_PATTERN = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
const SNAKE_CASE_IDENTIFIER_PATTERN = /\b[a-z][a-z0-9]*(?:_[a-z0-9]+){1,}\b/;

export function looksLikeInternalIdentifierText(text: string): boolean {
  if (!text) return false;
  return UUID_PATTERN.test(text) || SNAKE_CASE_IDENTIFIER_PATTERN.test(text);
}

/**
 * CB-06 / RV-016 — heuristic check for backend "next step" guidance text
 * that leaks raw HTTP call instructions (e.g. `Call POST
 * .../workbench/transition with { toState: "running" }`) instead of a
 * human next step. Used to drop such lines from a client-facing guidance
 * list rather than show them verbatim.
 */
const API_INSTRUCTION_PATTERN = /\b(GET|POST|PUT|PATCH|DELETE)\s+\S*\/\S*/;

export function looksLikeApiInstructionText(text: string): boolean {
  if (!text) return false;
  return API_INSTRUCTION_PATTERN.test(text);
}
