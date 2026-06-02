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

interface LlmTemplateRefinementResponse {
  name?: unknown;
  sections?: Array<{ title?: unknown; purpose?: unknown }>;
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
    'You MUST keep exactly the same set of section titles you receive (same order, no rename, no addition, no removal).',
    'You MUST NOT change document type, category, language, formatting, required inputs, audience, density or any other field.',
    'You MUST respond with strict JSON in this shape: {"name":"<optional refined name>","sections":[{"title":"<exact original title>","purpose":"<refined purpose>"}, ...]}',
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
      (e): e is { title: string; purpose?: unknown } =>
        typeof e?.title === 'string' && e.title === original.title
    );
    if (!entry) return original;
    const refinedPurpose =
      typeof entry.purpose === 'string' && entry.purpose.trim().length > 0
        ? entry.purpose.trim()
        : original.purpose;
    return { ...original, purpose: refinedPurpose };
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
