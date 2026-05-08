/**
 * Consultify Document Studio — AI Editor Refiner (MVP-3 hardening; Sprint 4
 * extends with methodology + source scopes; Slice E3.6 extends with the
 * 6th `transformative` scope).
 *
 * Optional LLM rewrite step for editor proposals. Used by `local`, `section`,
 * `global`, `methodology`, `source` and `transformative` scopes; the
 * function operates on a single text payload and is called per-block by
 * the caller. The deterministic instruction marker is always available
 * as a fallback.
 *
 * Refinement contract (intentionally narrow to avoid hallucination):
 *   - Input: original block text + user instruction + minimal context.
 *   - Output: rewritten text in the SAME language as the input.
 *   - The rewrite MUST be ≤ 4× the original length (a soft cap that catches
 *     runaway LLM expansions without rejecting reasonable elaborations).
 *   - The rewrite MUST NOT be empty.
 *   - The rewrite MUST NOT exceed 4000 characters absolute.
 *   - On any failure mode (AI freeze / `FEATURE_UNAVAILABLE`, empty
 *     response, schema-violating response) → caller falls back to the
 *     deterministic marker output of `applyInstruction`.
 *
 * Sprint-4 extensions:
 *   - `methodology` scope: appends scope-specific guardrails ("do not
 *     invent methodology, do not add/remove/reorder steps or phases, only
 *     refine prose"). Same numeric safety as base contract.
 *   - `source` scope: appends scope-specific guardrails ("never modify
 *     numbers, names, citation markers"). Adds a post-rewrite preservation
 *     guard: the multiset of bracketed citation markers (e.g.
 *     "[Source: ...]") AND the multiset of standalone integer/decimal
 *     numbers MUST match before/after. If either drift, the function
 *     returns null (caller falls back deterministically). This protects
 *     against silent fact-drift in source-anchored passages.
 *
 * Slice E3.6 extension:
 *   - `transformative` scope: the user has explicitly authorized a
 *     dramatic rebuild. The refiner relaxes structural guardrails (the
 *     model MAY merge / split paragraphs, MAY shift register
 *     fundamentally, MAY restructure the block) but keeps the absolute
 *     safety net (non-empty + 4× growth cap + 4000 char absolute cap).
 *     No source-preservation guard runs — the user has consciously
 *     opted into a rebuild. Caller still falls back deterministically
 *     on any AI failure.
 *
 * This honors `00-core-execution.mdc` (preserve behavior outside agreed
 * scope) and `40-security-tenancy.mdc` (no hidden writes).
 */

import { generateChatResponse } from '../aiService.js';

const MODEL_DEFAULT = 'default';
const MAX_TOKENS_DEFAULT = 800;
const MAX_OUTPUT_CHARS = 4000;
const MAX_GROWTH_FACTOR = 4;
const MIN_INPUT_CHARS_FOR_GROWTH_CAP = 40;

export type EditorRefinerScope =
  | 'local'
  | 'section'
  | 'global'
  | 'methodology'
  | 'source'
  | 'transformative';

export interface EditorRefinerContext {
  /** Document type used for tone hints; e.g. "executive_memo". */
  documentType?: string;
  /** Editor scope of this rewrite. */
  scope: EditorRefinerScope;
  /** Communication register hint, e.g. "executive". */
  communicationRegister?: string;
  /** Document language hint ("pl" / "en"). */
  language?: 'pl' | 'en';
}

export interface RefineEditorTextOptions {
  enable?: boolean;
  model?: string;
  maxTokens?: number;
}

interface LlmRewriteResponse {
  text?: unknown;
}

function safeParseJson(raw: string): LlmRewriteResponse | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const fenceStripped = trimmed
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  try {
    const parsed = JSON.parse(fenceStripped);
    return typeof parsed === 'object' && parsed !== null ? (parsed as LlmRewriteResponse) : null;
  } catch {
    return null;
  }
}

function buildSystemPrompt(scope: EditorRefinerScope): string {
  const base = [
    'You are a senior consulting document editor.',
    'You receive a single block of document text and an instruction.',
    'You MUST rewrite the block according to the instruction, keeping the same language as the input.',
    'You MUST keep the rewrite focused: do not invent facts, do not introduce sources, do not change KPIs.',
    'You MUST NOT exceed roughly 4× the original length.',
  ];

  if (scope === 'methodology') {
    base.push(
      'METHODOLOGY SCOPE: This block describes methodology, approach, scope, assumptions, scenarios, sensitivity or risks.',
      'You MUST NOT invent new methodology steps, phases, or analytical techniques.',
      'You MUST NOT remove, add, or reorder methodology steps, phases, scenarios, or assumptions.',
      'You MUST preserve every named technique, framework, scenario name and assumption verbatim.',
      'Only refine prose: clarity, register, fluency. The factual scaffolding stays untouched.'
    );
  } else if (scope === 'source') {
    base.push(
      'SOURCE-ANCHORED SCOPE: This block is anchored to a source reference and may contain factual claims tied to that source.',
      'You MUST NOT modify any numbers, percentages, currency amounts, dates, or quantitative figures.',
      'You MUST NOT modify any proper names of organizations, people, products, jurisdictions or laws.',
      'You MUST PRESERVE every bracketed citation marker exactly (e.g. "[Source: X]", "[Ref: 12]", "[Footnote 3]") in the same positions.',
      'Only refine prose around the protected entities: clarity, register, fluency.'
    );
  } else if (scope === 'transformative') {
    base.push(
      'TRANSFORMATIVE SCOPE: The user has explicitly authorized a dramatic rebuild of this block.',
      'You MAY restructure paragraphs, merge or split sentences, and reorganize the internal flow.',
      'You MAY shift the communication register (e.g. analytical → executive, technical → narrative).',
      'You MAY expand stub bullets into prose or compress prose into bullets, when that better serves the instruction.',
      'You MUST still keep the rewrite focused on the same topic and purpose as the original block.',
      'You MUST NOT fabricate new factual claims, KPIs, sources, citations, dates, currencies or proper names that were not in the original.',
      'You MUST NOT exceed roughly 4× the original length even though the structure may change significantly.'
    );
  }

  base.push(
    'You MUST respond with strict JSON: {"text":"<the rewritten block>"}',
    'No prose, no commentary, JSON only.'
  );

  return base.join(' ');
}

function buildUserPrompt(
  before: string,
  instruction: string,
  context: EditorRefinerContext
): string {
  return [
    `Document type: ${context.documentType ?? 'generic_document'}`,
    `Edit scope: ${context.scope}`,
    `Communication register: ${context.communicationRegister ?? 'professional'}`,
    `Language: ${context.language ?? 'pl'}`,
    `Instruction: ${instruction}`,
    'Original block:',
    before,
  ].join('\n');
}

/**
 * Apply optional LLM rewrite to a single block-text payload. Returns the
 * rewritten text on success or `null` on any failure path (caller is
 * responsible for falling back to the deterministic marker). The function
 * never throws; AI errors collapse to `null`.
 */
export async function refineEditorTextWithLlm(
  before: string,
  instruction: string,
  context: EditorRefinerContext,
  options: RefineEditorTextOptions = {}
): Promise<string | null> {
  if (options.enable === false) return null;
  if (!instruction.trim()) return null;
  if (!before.trim()) return null;

  let response: { content: string };
  try {
    response = await generateChatResponse({
      systemPrompt: buildSystemPrompt(context.scope),
      messages: [{ role: 'user', content: buildUserPrompt(before, instruction, context) }],
      model: options.model || MODEL_DEFAULT,
      maxTokens: options.maxTokens ?? MAX_TOKENS_DEFAULT,
    });
  } catch {
    return null;
  }

  const parsed = safeParseJson(response.content);
  if (!parsed) return null;
  if (typeof parsed.text !== 'string') return null;

  const rewritten = parsed.text.trim();
  if (rewritten.length === 0) return null;
  if (rewritten.length > MAX_OUTPUT_CHARS) return null;

  // Soft growth cap: if the input is non-trivial, refuse rewrites that grow
  // beyond `MAX_GROWTH_FACTOR×` the original length. Tiny inputs are
  // exempt to avoid forcing the model into terse one-liners on stubs.
  if (
    before.trim().length >= MIN_INPUT_CHARS_FOR_GROWTH_CAP &&
    rewritten.length > before.trim().length * MAX_GROWTH_FACTOR
  ) {
    return null;
  }

  // Scope-specific preservation guards. For `source` scope we run a hard
  // multiset comparison of citation markers and standalone numbers; any
  // drift collapses the rewrite to deterministic fallback. We deliberately
  // do NOT run this check in other scopes because legitimate prose edits
  // can change number formatting / citation phrasing.
  if (context.scope === 'source' && !preservesSourceFactsAndCitations(before, rewritten)) {
    return null;
  }

  return rewritten;
}

// =============================================================================
// Preservation guards (Slice 4.2 — `source` scope).
// =============================================================================

/**
 * Match bracketed citation markers commonly produced by the document
 * pipeline: "[Source: ...]", "[Ref: ...]", "[Footnote 3]", "[1]", "[42]".
 * The pattern is intentionally narrow — only square-bracketed tokens that
 * either start with a known keyword or are pure numeric ids. Free-form
 * brackets in regular prose are NOT counted as citations.
 */
const CITATION_MARKER_PATTERN =
  /\[(?:source|ref|footnote|przypis|źródło|zrodlo)\b[^\]]*\]|\[\d{1,4}(?:\s*[,-]\s*\d{1,4})*\]/gi;

/** Match standalone integer/decimal numbers, including those with units. */
const NUMBER_PATTERN = /-?\d+(?:[.,]\d+)?/g;

function extractCitationMarkers(text: string): string[] {
  const out: string[] = [];
  let match: RegExpExecArray | null;
  const re = new RegExp(CITATION_MARKER_PATTERN.source, 'gi');
  while ((match = re.exec(text)) !== null) {
    out.push(match[0].toLowerCase().replace(/\s+/g, ' '));
  }
  return out;
}

function extractNumbers(text: string): string[] {
  const out: string[] = [];
  let match: RegExpExecArray | null;
  const re = new RegExp(NUMBER_PATTERN.source, 'g');
  while ((match = re.exec(text)) !== null) {
    // Normalize Polish/English decimal separators so "12,5" === "12.5".
    out.push(match[0].replace(',', '.'));
  }
  return out;
}

function multisetEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const counts = new Map<string, number>();
  for (const x of a) counts.set(x, (counts.get(x) ?? 0) + 1);
  for (const y of b) {
    const c = counts.get(y);
    if (!c) return false;
    if (c === 1) counts.delete(y);
    else counts.set(y, c - 1);
  }
  return counts.size === 0;
}

/**
 * Returns true iff the multiset of citation markers AND the multiset of
 * numeric tokens is identical between `before` and `after`. Position
 * differences are tolerated; only counts and values matter.
 */
export function preservesSourceFactsAndCitations(before: string, after: string): boolean {
  const beforeCites = extractCitationMarkers(before);
  const afterCites = extractCitationMarkers(after);
  if (!multisetEqual(beforeCites, afterCites)) return false;
  const beforeNums = extractNumbers(before);
  const afterNums = extractNumbers(after);
  if (!multisetEqual(beforeNums, afterNums)) return false;
  return true;
}
