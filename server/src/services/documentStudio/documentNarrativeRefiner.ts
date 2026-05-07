/**
 * Consultify Document Studio — Narrative Refiner (MVP-1 finalization).
 *
 * Optional LLM-based refinement layer over the deterministic outline produced
 * by `documentNarrativePlanner.planDocumentOutline`.
 *
 * Refinement contract (intentionally narrow to avoid hallucination):
 *   - May REORDER sections.
 *   - May REWRITE the `purpose` text of an existing section.
 *   - May NOT add new sections.
 *   - May NOT remove sections from the deterministic outline.
 *   - May NOT change the `documentType`.
 *
 * Any failure mode (AI freeze / `FEATURE_UNAVAILABLE`, empty response, invalid
 * JSON, schema-violating response) falls back to the deterministic outline
 * unchanged. This honors `00-core-execution.mdc` (preserve behavior outside
 * agreed scope) and `40-security-tenancy.mdc` (no hidden writes / no learning
 * behavior).
 */

import { generateChatResponse } from '../aiService.js';
import type {
  DocumentIntake,
  DocumentOutline,
  DocumentOutlineSection,
} from './documentStudioTypes.js';

const MODEL_DEFAULT = 'default';
const MAX_TOKENS_DEFAULT = 1200;

interface LlmRefinementResponse {
  sections?: Array<{ title?: unknown; purpose?: unknown }>;
}

function safeParseJson(raw: string): LlmRefinementResponse | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  // The LLM may wrap JSON in a markdown fence. Strip a leading ``` and
  // optional language tag, plus a trailing ``` before parsing.
  const fenceStripped = trimmed
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  try {
    const parsed = JSON.parse(fenceStripped);
    return typeof parsed === 'object' && parsed !== null ? (parsed as LlmRefinementResponse) : null;
  } catch {
    return null;
  }
}

function buildSystemPrompt(): string {
  return [
    'You are a senior consulting document architect.',
    'Your task is to refine an outline of a consulting document.',
    'You MUST keep exactly the same set of section titles you receive.',
    'You MAY reorder sections.',
    'You MAY rewrite the "purpose" text of each section in the document language.',
    'You MUST NOT invent new sections, MUST NOT remove sections, and MUST NOT rename sections.',
    'You MUST respond with strict JSON in this shape: {"sections":[{"title":"<exact original title>","purpose":"<refined purpose>"}, ...]}',
    'No prose, no commentary, JSON only.',
  ].join(' ');
}

function buildUserPrompt(intake: DocumentIntake, outline: DocumentOutline): string {
  const audience = (
    intake.audience && intake.audience.length > 0 ? intake.audience.join(', ') : 'Internal'
  ) as string;
  return [
    `Document type: ${outline.documentType}`,
    `Title: ${outline.title}`,
    `Audience: ${audience}`,
    `Language: ${intake.language ?? 'pl'}`,
    `Goal: ${intake.goal ?? 'inform'}`,
    `Description: ${intake.description}`,
    'Original outline (reorder + rewrite-purpose only):',
    JSON.stringify(
      outline.sections.map((s) => ({ title: s.title, purpose: s.purpose })),
      null,
      2
    ),
  ].join('\n');
}

export interface RefineOutlineOptions {
  enable?: boolean;
  model?: string;
  maxTokens?: number;
}

/**
 * Apply optional LLM refinement to a deterministic outline. Always returns a
 * valid DocumentOutline: the deterministic input on any failure path.
 */
export async function refineOutlineWithLlm(
  outline: DocumentOutline,
  intake: DocumentIntake,
  options: RefineOutlineOptions = {}
): Promise<DocumentOutline> {
  if (options.enable === false) return outline;
  if (outline.sections.length === 0) return outline;

  let response: { content: string };
  try {
    response = await generateChatResponse({
      systemPrompt: buildSystemPrompt(),
      messages: [{ role: 'user', content: buildUserPrompt(intake, outline) }],
      model: options.model || MODEL_DEFAULT,
      maxTokens: options.maxTokens ?? MAX_TOKENS_DEFAULT,
    });
  } catch {
    // AI freeze, network, or any provider error → deterministic fallback.
    return outline;
  }

  const parsed = safeParseJson(response.content);
  if (!parsed || !Array.isArray(parsed.sections)) return outline;

  const originalTitles = outline.sections.map((s) => s.title);
  const originalByTitle = new Map<string, DocumentOutlineSection>(
    outline.sections.map((s) => [s.title, s])
  );

  // Validate: every returned title must exist in the original list, and the
  // returned set must be a permutation of the original (same length, same set).
  const returnedTitles: string[] = [];
  for (const entry of parsed.sections) {
    if (!entry || typeof entry.title !== 'string') return outline;
    if (!originalByTitle.has(entry.title)) return outline;
    returnedTitles.push(entry.title);
  }
  if (returnedTitles.length !== originalTitles.length) return outline;
  const returnedSet = new Set(returnedTitles);
  if (returnedSet.size !== originalTitles.length) return outline;
  for (const title of originalTitles) {
    if (!returnedSet.has(title)) return outline;
  }

  // Build refined outline preserving original metadata, applying reorder and
  // optional purpose rewrites.
  const refinedSections: DocumentOutlineSection[] = [];
  for (const entry of parsed.sections) {
    const original = originalByTitle.get(String(entry.title));
    if (!original) return outline; // Defensive; validated above.
    const refinedPurpose =
      typeof entry.purpose === 'string' && entry.purpose.trim().length > 0
        ? entry.purpose.trim()
        : original.purpose;
    refinedSections.push({
      title: original.title,
      level: original.level,
      purpose: refinedPurpose,
      expectedLengthHint: original.expectedLengthHint,
    });
  }

  return {
    ...outline,
    sections: refinedSections,
  };
}
