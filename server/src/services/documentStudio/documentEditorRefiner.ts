/**
 * Consultify Document Studio — AI Editor Refiner (MVP-3 hardening).
 *
 * Optional LLM rewrite step for editor proposals. Used by `local`, `section`,
 * and `global` scopes; the function operates on a single text payload and is
 * called per-block by the caller. The deterministic instruction marker is
 * always available as a fallback.
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
 * This honors `00-core-execution.mdc` (preserve behavior outside agreed
 * scope) and `40-security-tenancy.mdc` (no hidden writes).
 */

import { generateChatResponse } from '../aiService.js';

const MODEL_DEFAULT = 'default';
const MAX_TOKENS_DEFAULT = 800;
const MAX_OUTPUT_CHARS = 4000;
const MAX_GROWTH_FACTOR = 4;
const MIN_INPUT_CHARS_FOR_GROWTH_CAP = 40;

export interface EditorRefinerContext {
  /** Document type used for tone hints; e.g. "executive_memo". */
  documentType?: string;
  /** Editor scope of this rewrite ("local", "section", "global"). */
  scope: 'local' | 'section' | 'global';
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

function buildSystemPrompt(): string {
  return [
    'You are a senior consulting document editor.',
    'You receive a single block of document text and an instruction.',
    'You MUST rewrite the block according to the instruction, keeping the same language as the input.',
    'You MUST keep the rewrite focused: do not invent facts, do not introduce sources, do not change KPIs.',
    'You MUST NOT exceed roughly 4× the original length.',
    'You MUST respond with strict JSON: {"text":"<the rewritten block>"}',
    'No prose, no commentary, JSON only.',
  ].join(' ');
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
      systemPrompt: buildSystemPrompt(),
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

  return rewritten;
}
