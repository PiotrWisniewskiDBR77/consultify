/**
 * Consultify Document Studio — AI Document Template Architect refiner (MVP-3).
 *
 * Optional LLM-based refinement layer over the deterministic blueprint that
 * `documentTemplateService.draftTemplate` produces from the Document Type
 * Taxonomy. The LLM is allowed to rewrite the *purpose* of each section in
 * the section blueprint and to refine the template *name*; nothing else.
 *
 * Refinement contract (intentionally narrow to avoid hallucination, mirrors
 * `documentNarrativeRefiner.ts`):
 *   - May rewrite the `purpose` text of an existing section.
 *   - May propose a refined template `name`.
 *   - May add optional per-section `contentHints` (2-4 short thematic
 *     structure-guidance phrases, never invented facts/numbers — this is a
 *     template, not a specific document; mirrors the Deck Template
 *     Architect's `contentHints`, see `presentationTemplateDraftService.ts`).
 *     An invalid/missing `contentHints` value is lenient (falls back to "no
 *     hints"), it never invalidates the whole refinement the way a
 *     title/section violation does.
 *   - May add an optional per-section `keyMessage` (one-sentence thesis the
 *     section should argue/prove), `dataNeeded` (2-6 short labels naming
 *     what to collect) and `suggestedEvidence` (type of proof/source, e.g.
 *     "cytat z wywiadu", "tabela wyników ankiety") — all STRUCTURE/WHAT-TO-
 *     COLLECT guidance, never fabricated facts, numbers, client names or
 *     citations. Each is lenient exactly like `contentHints`: an
 *     invalid/missing value just falls back to "no guidance", never fails
 *     the whole refinement.
 *   - May NOT add new sections.
 *   - May NOT remove sections.
 *   - May NOT rename sections.
 *   - May NOT change `documentType`, `category`, `language`, `formattingSchema`,
 *     `requiredInputs`, `audience`, `density` or any governance metadata.
 *
 * Any failure mode (AI freeze / `FEATURE_UNAVAILABLE`, empty response, invalid
 * JSON, schema-violating response) falls back to the deterministic template
 * unchanged. This honors `00-core-execution.mdc` (preserve behavior outside
 * agreed scope) and `40-security-tenancy.mdc` (no hidden writes).
 */

import { generateChatResponse } from '../aiService.js';
import type {
  DocumentTemplate,
  TemplateDraftInput,
  TemplateSectionBlueprint,
} from './documentStudioTypes.js';

const MODEL_DEFAULT = 'default';
const MAX_TOKENS_DEFAULT = 1200;
const MAX_CONTENT_HINTS_PER_SECTION = 4;
const MAX_CONTENT_HINT_CHARS = 100;
const MAX_KEY_MESSAGE_CHARS = 200;
const MAX_DATA_NEEDED_ITEMS = 6;
const MAX_DATA_NEEDED_CHARS = 100;
const MAX_SUGGESTED_EVIDENCE_CHARS = 150;

interface LlmTemplateRefinementResponse {
  name?: unknown;
  sections?: Array<{
    title?: unknown;
    purpose?: unknown;
    contentHints?: unknown;
    keyMessage?: unknown;
    dataNeeded?: unknown;
    suggestedEvidence?: unknown;
  }>;
}

/**
 * Lenient — an invalid/missing value just means "no hints", never fails the
 * refinement. Mirrors `sanitizeContentHints` in
 * `presentationTemplateDraftService.ts` (Deck Template Architect).
 */
function sanitizeContentHints(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const hints = raw
    .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    .map((item) => item.trim().slice(0, MAX_CONTENT_HINT_CHARS))
    .slice(0, MAX_CONTENT_HINTS_PER_SECTION);
  return hints.length > 0 ? hints : undefined;
}

/**
 * Lenient — mirrors `sanitizeContentHints`: an invalid/missing value just
 * means "no key message", never fails the refinement.
 */
function sanitizeKeyMessage(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed.slice(0, MAX_KEY_MESSAGE_CHARS) : undefined;
}

/**
 * Lenient — mirrors `sanitizeContentHints`: an invalid/missing value just
 * means "no data-needed guidance", never fails the refinement.
 */
function sanitizeDataNeeded(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const items = raw
    .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    .map((item) => item.trim().slice(0, MAX_DATA_NEEDED_CHARS))
    .slice(0, MAX_DATA_NEEDED_ITEMS);
  return items.length > 0 ? items : undefined;
}

/**
 * Lenient — mirrors `sanitizeContentHints`: an invalid/missing value just
 * means "no suggested-evidence guidance", never fails the refinement.
 */
function sanitizeSuggestedEvidence(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed.slice(0, MAX_SUGGESTED_EVIDENCE_CHARS) : undefined;
}

function safeParseJson(raw: string): LlmTemplateRefinementResponse | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const fenceStripped = trimmed
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  try {
    const parsed = JSON.parse(fenceStripped);
    return typeof parsed === 'object' && parsed !== null
      ? (parsed as LlmTemplateRefinementResponse)
      : null;
  } catch {
    return null;
  }
}

function buildSystemPrompt(): string {
  return [
    'You are a senior consulting document architect refining a Word/PDF template.',
    'You MAY rewrite the "purpose" text of each section in the same language as the input.',
    'You MAY propose a refined "name" for the template.',
    'You MAY add "contentHints": 2-4 short phrases per section guiding WHAT KIND of content belongs there (e.g. "Contrast current-state pain points with target state", "List the top 3 risks with owner and mitigation") — this is a REUSABLE TEMPLATE, not a specific document, so hints MUST describe content structure/themes only and MUST NOT invent specific numbers, dates, client names, or other facts.',
    'You MAY add "keyMessage": one sentence naming the THESIS this section should argue or prove (e.g. "The current operating model cannot scale past 3x volume without a platform rebuild") — this is a guidance ANCHOR describing the kind of claim the section should make, not an actual conclusion, so it MUST NOT state a specific fabricated number, date, or client fact.',
    'You MAY add "dataNeeded": 2-6 short labels naming WHAT DATA OR INPUT should be collected before this section can be written (e.g. "Latest org chart", "Customer churn by segment, last 4 quarters") — categories of evidence to gather, MUST NOT contain invented values.',
    'You MAY add "suggestedEvidence": one short phrase naming the TYPE of evidence or source that should back this section (e.g. "quote from stakeholder interview", "benchmark table from survey results") — a category of proof, MUST NOT be a specific fabricated citation.',
    'You MUST keep exactly the same set of section titles you receive (same order, no rename, no addition, no removal).',
    'You MUST NOT change document type, category, language, formatting, required inputs, audience, density or any other field.',
    'You MUST respond with strict JSON in this shape: {"name":"<optional refined name>","sections":[{"title":"<exact original title>","purpose":"<refined purpose>","contentHints":["<optional phrase>", ...],"keyMessage":"<optional thesis sentence>","dataNeeded":["<optional data label>", ...],"suggestedEvidence":"<optional evidence type>"}, ...]}',
    'No prose, no commentary, JSON only.',
  ].join(' ');
}

function buildUserPrompt(template: DocumentTemplate, input: TemplateDraftInput): string {
  const audience =
    template.audience.length > 0 ? template.audience.join(', ') : 'Internal stakeholders';
  return [
    `Template name: ${template.name}`,
    `Document type: ${template.documentType}`,
    `Category: ${template.category}`,
    `Audience: ${audience}`,
    `Language: ${template.language}`,
    `Density: ${template.density}`,
    `Brief / purpose: ${input.purpose}`,
    'Section blueprint (rewrite-purpose only, keep titles exactly):',
    JSON.stringify(
      template.sectionBlueprint.map((s) => ({ title: s.title, purpose: s.purpose })),
      null,
      2
    ),
  ].join('\n');
}

export interface RefineTemplateOptions {
  enable?: boolean;
  model?: string;
  maxTokens?: number;
}

/**
 * Apply optional LLM refinement to a deterministic template draft. Always
 * returns a usable DocumentTemplate: the deterministic input on any failure
 * path. This function is pure-ish: it does NOT persist anything; the caller
 * is responsible for storing the (possibly refined) template via the
 * registry.
 */
export async function refineTemplateWithLlm(
  template: DocumentTemplate,
  input: TemplateDraftInput,
  options: RefineTemplateOptions = {}
): Promise<DocumentTemplate> {
  if (options.enable === false) return template;
  if (template.sectionBlueprint.length === 0) return template;

  let response: { content: string };
  try {
    response = await generateChatResponse({
      systemPrompt: buildSystemPrompt(),
      messages: [{ role: 'user', content: buildUserPrompt(template, input) }],
      model: options.model || MODEL_DEFAULT,
      maxTokens: options.maxTokens ?? MAX_TOKENS_DEFAULT,
    });
  } catch {
    return template;
  }

  const parsed = safeParseJson(response.content);
  if (!parsed || !Array.isArray(parsed.sections)) return template;

  const originalByTitle = new Map<string, TemplateSectionBlueprint>(
    template.sectionBlueprint.map((s) => [s.title, s])
  );
  const originalTitles = template.sectionBlueprint.map((s) => s.title);

  // Validate: returned sections must be a permutation of the original titles
  // and same length. Any deviation triggers a full deterministic fallback.
  const returnedTitles: string[] = [];
  for (const entry of parsed.sections) {
    if (!entry || typeof entry.title !== 'string') return template;
    if (!originalByTitle.has(entry.title)) return template;
    returnedTitles.push(entry.title);
  }
  if (returnedTitles.length !== originalTitles.length) return template;
  const returnedSet = new Set(returnedTitles);
  if (returnedSet.size !== originalTitles.length) return template;
  for (const title of originalTitles) {
    if (!returnedSet.has(title)) return template;
  }

  // The refiner must NOT reorder section blueprints (template authoring
  // discipline keeps the deterministic order canonical). Only purpose
  // rewrites are accepted.
  const parsedSections = parsed.sections;
  const refinedBlueprint: TemplateSectionBlueprint[] = template.sectionBlueprint.map((original) => {
    const entry = parsedSections.find(
      (
        e
      ): e is {
        title: string;
        purpose?: unknown;
        contentHints?: unknown;
        keyMessage?: unknown;
        dataNeeded?: unknown;
        suggestedEvidence?: unknown;
      } => typeof e?.title === 'string' && e.title === original.title
    );
    if (!entry) return original;
    const refinedPurpose =
      typeof entry.purpose === 'string' && entry.purpose.trim().length > 0
        ? entry.purpose.trim()
        : original.purpose;
    const contentHints = sanitizeContentHints(entry.contentHints) ?? original.contentHints;
    const keyMessage = sanitizeKeyMessage(entry.keyMessage) ?? original.keyMessage;
    const dataNeeded = sanitizeDataNeeded(entry.dataNeeded) ?? original.dataNeeded;
    const suggestedEvidence =
      sanitizeSuggestedEvidence(entry.suggestedEvidence) ?? original.suggestedEvidence;
    return {
      ...original,
      purpose: refinedPurpose,
      contentHints,
      keyMessage,
      dataNeeded,
      suggestedEvidence,
    };
  });

  const refinedName =
    typeof parsed.name === 'string' && parsed.name.trim().length > 0
      ? parsed.name.trim()
      : template.name;

  return {
    ...template,
    name: refinedName,
    sectionBlueprint: refinedBlueprint,
    updatedAt: new Date().toISOString(),
  };
}
