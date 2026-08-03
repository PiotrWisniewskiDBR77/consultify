/**
 * Consultify Presentation Studio — Template Draft Service (FALA B).
 *
 * AI-native mirror of the Document Studio Template Architect
 * (`documentStudio/documentTemplateService.ts` `draftTemplate`/
 * `draftTemplateAsync` + `documentTemplateRefiner.ts`) for the Deck tool.
 * See `Harvard/wdrozenie-100/_HANDOFF_FALA_B_GENERATORY_TEMPLATE_2026-07-22.md`.
 *
 * Scope (backend only — FE kreator/edytor is a later step):
 *   - `draftPresentationTemplate` builds a deterministic template skeleton
 *     (an outline of {intent,title} slides + governance defaults) from a
 *     `PresentationTemplateDraftInput`. It reuses the existing
 *     `buildSystemTemplateRuntime` family outlines
 *     (`presentationTemplateRuntimeService.ts`) as the deterministic
 *     starting point — the SAME source of truth the generator itself
 *     already renders from, so a freshly drafted template is guaranteed
 *     to be a runnable recipe (known intents, known layouts).
 *   - `draftPresentationTemplateAsync({ useLlm: true })` optionally lets an
 *     LLM rewrite slide titles + the template name/description, and add
 *     optional per-slide structural briefing fields — `contentHints`
 *     (thematic structure guidance), `keyMessage` (one-sentence thesis
 *     SHAPE), `dataNeeded` (what data categories to gather), and
 *     `suggestedVisual` (visualization type) — never invented facts/numbers
 *     (this is a template, not a specific deck) — never intents, never
 *     slide order/count, never governance metadata. Any LLM failure or
 *     schema-violating response falls back to the deterministic draft
 *     unchanged (mirrors `documentTemplateRefiner.ts`'s narrow,
 *     hallucination-resistant contract); an invalid/missing value for any
 *     of these fields is lenient (falls back to "no value"), it never
 *     invalidates the whole refinement the way an intent violation does.
 *
 * Persistence: this module is pure (no DB access). The route layer
 * (`presentations.routes.ts`) inserts the returned draft into
 * `presentation_templates` as a `lifecycle_state = 'draft'` row — the
 * existing governance lifecycle (approve/deprecate/clone/audit,
 * `presentationTemplateGovernanceService.ts`) applies unchanged, and the
 * existing manual editor (`PUT /templates/:id`, `outlineJson`) can edit the
 * draft's outline before approval.
 */

import { generateChatResponse } from './aiService.js';
import {
  buildSystemTemplateRuntime,
  type PresentationTemplateRuntime,
  type TemplateFamily,
} from './presentationTemplateRuntimeService.js';
import type { SlideIntent } from './report/pptx/types.js';

export type DeckTheme = 'corporate' | 'minimal' | 'modern';

export interface PresentationTemplateDraftInput {
  /** Required. Free-text brief describing what the deck template is for. */
  purpose: string;
  name?: string;
  description?: string;
  /** Machine deck-type key (e.g. `steering_committee`); mapped to a family. */
  deckType?: string;
  /** Direct family override; takes priority over `deckType`. */
  templateFamily?: TemplateFamily;
  audience?: string;
  goal?: string;
  language?: string;
  theme?: DeckTheme;
  maxSlides?: number;
  minSlides?: number;
  notes?: string;
}

export interface PresentationTemplateOutlineItem {
  intent: SlideIntent;
  title: string;
  /**
   * Optional 2-4 short thematic guidance phrases for this slide (e.g. "Frame
   * the current-state pain points", "Contrast before/after operating model")
   * — content STRUCTURE guidance for whoever fills the template with real
   * data later, never fabricated facts/numbers (this is a reusable template,
   * not a specific deck). LLM-only field: the deterministic draft never sets
   * it; `refinePresentationTemplateWithLlm` may add it, `undefined` means
   * "no guidance yet" and is safe to omit anywhere this type is used.
   */
  contentHints?: string[];
  /**
   * Optional one-sentence thesis/take-away for this slide (e.g. "Cost overrun
   * concentrates in Q3 procurement, not headcount") — a STRUCTURAL claim
   * shape for whoever fills the template later, never an invented fact
   * itself (this is a reusable template, not a specific deck). LLM-only,
   * same lenient/optional contract as `contentHints`.
   */
  keyMessage?: string;
  /**
   * Optional 2-3 short items naming WHAT data must be gathered to fill this
   * slide (e.g. "quarterly revenue by segment") — never actual values.
   * LLM-only, same lenient/optional contract as `contentHints`.
   */
  dataNeeded?: string[];
  /**
   * Optional short label for the recommended visualization type (e.g. "bar
   * chart trend", "RAG status table") — never chart data itself. LLM-only,
   * same lenient/optional contract as `contentHints`.
   */
  suggestedVisual?: string;
}

export interface DraftedPresentationTemplate {
  name: string;
  description: string;
  deckType: string;
  templateFamily: TemplateFamily;
  audience: string;
  goal: string;
  languageDefault: string;
  confidentialityDefault: string;
  theme: DeckTheme;
  outlineJson: PresentationTemplateOutlineItem[];
  maxSlides: number;
  minSlides: number;
  mustHaveIntents: SlideIntent[];
  recommendedVisuals: string[];
  notes?: string;
}

const VALID_THEMES: ReadonlySet<string> = new Set(['corporate', 'minimal', 'modern']);

// Mirrors `FAMILY_BY_DECK_TYPE` in presentationTemplateRuntimeService.ts —
// duplicated (not imported) because that map is module-private there; kept
// in sync manually, both are small and stable.
const DECK_TYPE_TO_FAMILY: Record<string, TemplateFamily> = {
  digital_transformation_read_deck: 'Digital Transformation Read Deck',
  transformation_read_deck: 'Digital Transformation Read Deck',
  board_decision_deck: 'Board Decision Deck',
  assessment_summary: 'DRD Diagnostic Deck',
  drd_diagnostic: 'DRD Diagnostic Deck',
  tool_workshop: 'Initiative Kickoff Deck',
  initiative_kickoff: 'Initiative Kickoff Deck',
  steering_committee: 'Steering Committee Deck',
  program_update: 'Steering Committee Deck',
};

function familyForInput(input: PresentationTemplateDraftInput): TemplateFamily {
  const explicit = String(input.templateFamily || '').trim();
  if (explicit) return explicit;
  const deckType = String(input.deckType || '')
    .trim()
    .toLowerCase();
  if (deckType && DECK_TYPE_TO_FAMILY[deckType]) return DECK_TYPE_TO_FAMILY[deckType];
  // Best-effort keyword fallback when the caller supplies neither
  // `deckType` nor `templateFamily` (e.g. a freeform Teresa brief).
  // Single-word stems on purpose so Polish declension (sterujący /
  // sterującego / sterującym / ...) still matches; `deckType` or
  // `templateFamily` should be preferred whenever the caller knows them.
  const purpose = input.purpose.toLowerCase();
  if (purpose.includes('steering') || purpose.includes('sterując')) {
    return 'Steering Committee Deck';
  }
  if (purpose.includes('board') || purpose.includes('decyzj') || purpose.includes('decision')) {
    return 'Board Decision Deck';
  }
  if (purpose.includes('diagnos') || purpose.includes('audit')) return 'DRD Diagnostic Deck';
  if (purpose.includes('kickoff') || purpose.includes('kick-off')) {
    return 'Initiative Kickoff Deck';
  }
  return 'Digital Transformation Read Deck';
}

function deckTypeForFamily(family: TemplateFamily): string {
  const entry = Object.entries(DECK_TYPE_TO_FAMILY).find(([, value]) => value === family);
  return entry ? entry[0] : 'custom_deck';
}

function themeFor(input: PresentationTemplateDraftInput): DeckTheme {
  const raw = String(input.theme || '').trim();
  return VALID_THEMES.has(raw) ? (raw as DeckTheme) : 'corporate';
}

export interface DraftPresentationTemplateParams {
  input: PresentationTemplateDraftInput;
}

export interface DraftPresentationTemplateResult {
  template: DraftedPresentationTemplate;
  runtime: PresentationTemplateRuntime;
}

/**
 * Deterministic draft: maps the input purpose/deckType onto one of the
 * existing system template families (`buildSystemTemplateRuntime`) so the
 * generated outline always matches a runtime the generator already knows
 * how to render (same slide recipes, same source requirements). Always
 * throws only on missing/empty `purpose` — every other field has a safe
 * default, matching `documentTemplateService.draftTemplate`'s contract.
 */
export function draftPresentationTemplate(
  params: DraftPresentationTemplateParams
): DraftPresentationTemplateResult {
  const input = params?.input;
  if (!input || typeof input.purpose !== 'string' || input.purpose.trim().length === 0) {
    throw new Error('template purpose is required');
  }

  const family = familyForInput(input);
  const runtime = buildSystemTemplateRuntime(family);
  const outlineJson: PresentationTemplateOutlineItem[] = runtime.outline.map((item) => ({
    intent: item.intent,
    title: item.title,
  }));

  const template: DraftedPresentationTemplate = {
    name: input.name?.trim() || `${family} Template`,
    description: input.description?.trim() || input.purpose.trim(),
    deckType: deckTypeForFamily(family),
    templateFamily: family,
    audience: input.audience?.trim() || 'executive',
    goal: input.goal?.trim() || 'inform',
    languageDefault: input.language?.trim() || 'en',
    confidentialityDefault: 'internal',
    theme: themeFor(input),
    outlineJson,
    maxSlides:
      Number.isFinite(input.maxSlides) && Number(input.maxSlides) > 0
        ? Math.floor(Number(input.maxSlides))
        : runtime.maxSlides,
    minSlides:
      Number.isFinite(input.minSlides) && Number(input.minSlides) > 0
        ? Math.floor(Number(input.minSlides))
        : runtime.minSlides,
    mustHaveIntents: runtime.mustHaveIntents,
    recommendedVisuals: runtime.recommendedVisuals,
    notes: input.notes?.trim() || undefined,
  };

  return { template, runtime };
}

export interface DraftPresentationTemplateAsyncParams extends DraftPresentationTemplateParams {
  /** Optional opt-in LLM refinement of slide titles + template name/description. */
  useLlm?: boolean;
  model?: string;
  maxTokens?: number;
}

export interface DraftPresentationTemplateAsyncResult extends DraftPresentationTemplateResult {
  llmRefined: boolean;
}

/**
 * Draft + optionally refine a deck template via the bounded AI Template
 * Architect. On any LLM failure/violation path the deterministic draft is
 * preserved unchanged — mirrors `documentTemplateService.draftTemplateAsync`.
 */
export async function draftPresentationTemplateAsync(
  params: DraftPresentationTemplateAsyncParams
): Promise<DraftPresentationTemplateAsyncResult> {
  const base = draftPresentationTemplate(params);
  if (!params.useLlm) return { ...base, llmRefined: false };

  const refined = await refinePresentationTemplateWithLlm(base.template, params.input, {
    model: params.model,
    maxTokens: params.maxTokens,
  });
  if (!refined) return { ...base, llmRefined: false };
  return { template: refined, runtime: base.runtime, llmRefined: true };
}

// ---------------------------------------------------------------------------
// LLM refinement (bounded — mirrors documentStudio/documentTemplateRefiner.ts)
// ---------------------------------------------------------------------------

interface LlmDeckTemplateResponse {
  name?: unknown;
  description?: unknown;
  slides?: Array<{
    intent?: unknown;
    title?: unknown;
    contentHints?: unknown;
    keyMessage?: unknown;
    dataNeeded?: unknown;
    suggestedVisual?: unknown;
  }>;
}

const MAX_CONTENT_HINTS_PER_SLIDE = 4;
const MAX_CONTENT_HINT_CHARS = 100;
const MAX_KEY_MESSAGE_CHARS = 160;
const MAX_DATA_NEEDED_PER_SLIDE = 3;
const MAX_DATA_NEEDED_CHARS = 100;
const MAX_SUGGESTED_VISUAL_CHARS = 80;

/** Lenient — an invalid/missing value just means "no hints", never fails the refinement. */
function sanitizeContentHints(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const hints = raw
    .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    .map((item) => item.trim().slice(0, MAX_CONTENT_HINT_CHARS))
    .slice(0, MAX_CONTENT_HINTS_PER_SLIDE);
  return hints.length > 0 ? hints : undefined;
}

/** Lenient — an invalid/missing value just means "no key message", never fails the refinement. */
function sanitizeKeyMessage(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed.slice(0, MAX_KEY_MESSAGE_CHARS) : undefined;
}

/** Lenient — an invalid/missing value just means "no data needed list", never fails the refinement. */
function sanitizeDataNeeded(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const items = raw
    .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    .map((item) => item.trim().slice(0, MAX_DATA_NEEDED_CHARS))
    .slice(0, MAX_DATA_NEEDED_PER_SLIDE);
  return items.length > 0 ? items : undefined;
}

/** Lenient — an invalid/missing value just means "no suggested visual", never fails the refinement. */
function sanitizeSuggestedVisual(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed.slice(0, MAX_SUGGESTED_VISUAL_CHARS) : undefined;
}

function safeParseJson(raw: string): LlmDeckTemplateResponse | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const fenceStripped = trimmed
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  try {
    const parsed = JSON.parse(fenceStripped);
    return typeof parsed === 'object' && parsed !== null
      ? (parsed as LlmDeckTemplateResponse)
      : null;
  } catch {
    return null;
  }
}

function buildSystemPrompt(): string {
  return [
    'You are a senior BCG-grade presentation template architect.',
    'You MAY rewrite the "title" of each slide, in the same language as the brief.',
    'You MAY propose a refined "name" and a one-sentence "description" for the template.',
    'You MAY add "contentHints": 2-4 short phrases per slide guiding WHAT KIND of content belongs there (e.g. "Contrast current-state pain points with target state", "Show a 3-scenario cost sensitivity range") — this is a REUSABLE TEMPLATE, not a specific deck, so hints MUST describe content structure/themes only and MUST NOT invent specific numbers, dates, client names, or other facts.',
    'You MAY add "keyMessage": a one-sentence thesis/take-away SHAPE for the slide (e.g. "Cost overrun concentrates in one area, not headcount") — describe the STRUCTURE of the claim (comparison/contrast/trend shape), never a specific invented number, date, or client fact.',
    'You MAY add "dataNeeded": 2-3 short items naming WHAT DATA must be gathered to fill this slide (e.g. "quarterly revenue by segment", "customer churn rate by cohort") — name the data category only, MUST NOT include any actual value/number.',
    'You MAY add "suggestedVisual": a short label for the recommended visualization type (e.g. "bar chart trend", "RAG status table", "waterfall chart") — a visualization TYPE only, never actual chart data.',
    'You MUST keep exactly the same set of slide intents you receive, in the same order (no add, no remove, no reorder, no intent rename).',
    'You MUST NOT change audience, goal, language, theme, slide counts, or any other governance field.',
    'You MUST respond with strict JSON in this shape: {"name":"<optional refined name>","description":"<optional refined description>","slides":[{"intent":"<exact original intent>","title":"<refined title>","contentHints":["<optional phrase>", ...],"keyMessage":"<optional one-sentence thesis shape>","dataNeeded":["<optional data item>", ...],"suggestedVisual":"<optional visual type>"}, ...]}',
    'No prose, no commentary, JSON only.',
  ].join(' ');
}

function buildUserPrompt(
  template: DraftedPresentationTemplate,
  input: PresentationTemplateDraftInput
): string {
  return [
    `Template family: ${template.templateFamily}`,
    `Audience: ${template.audience}`,
    `Goal: ${template.goal}`,
    `Brief / purpose: ${input.purpose}`,
    input.notes ? `Notes: ${input.notes}` : '',
    'Slide outline (rewrite "title" only, keep "intent" exactly, same order):',
    JSON.stringify(template.outlineJson, null, 2),
  ]
    .filter((line) => line.length > 0)
    .join('\n');
}

export interface RefinePresentationTemplateOptions {
  model?: string;
  maxTokens?: number;
}

/**
 * Returns the refined template, or `null` on any failure/violation — the
 * caller falls back to the deterministic draft unchanged. Never throws.
 */
export async function refinePresentationTemplateWithLlm(
  template: DraftedPresentationTemplate,
  input: PresentationTemplateDraftInput,
  options: RefinePresentationTemplateOptions = {}
): Promise<DraftedPresentationTemplate | null> {
  if (template.outlineJson.length === 0) return null;

  let response: { content: string };
  try {
    response = await generateChatResponse({
      systemPrompt: buildSystemPrompt(),
      messages: [{ role: 'user', content: buildUserPrompt(template, input) }],
      model: options.model || 'default',
      maxTokens: options.maxTokens ?? 1200,
    });
  } catch {
    return null;
  }

  const parsed = safeParseJson(response.content);
  if (!parsed || !Array.isArray(parsed.slides)) return null;
  if (parsed.slides.length !== template.outlineJson.length) return null;

  const refinedOutline: PresentationTemplateOutlineItem[] = [];
  for (let i = 0; i < template.outlineJson.length; i++) {
    const original = template.outlineJson[i];
    const entry = parsed.slides[i];
    if (!entry || typeof entry.intent !== 'string' || entry.intent !== original.intent) {
      // Any reorder/rename/add/remove of intents invalidates the whole
      // refinement — fall back to the deterministic draft.
      return null;
    }
    const title =
      typeof entry.title === 'string' && entry.title.trim().length > 0
        ? entry.title.trim()
        : original.title;
    const contentHints = sanitizeContentHints(entry.contentHints) ?? original.contentHints;
    const keyMessage = sanitizeKeyMessage(entry.keyMessage) ?? original.keyMessage;
    const dataNeeded = sanitizeDataNeeded(entry.dataNeeded) ?? original.dataNeeded;
    const suggestedVisual =
      sanitizeSuggestedVisual(entry.suggestedVisual) ?? original.suggestedVisual;
    refinedOutline.push({
      intent: original.intent,
      title,
      contentHints,
      keyMessage,
      dataNeeded,
      suggestedVisual,
    });
  }

  const name =
    typeof parsed.name === 'string' && parsed.name.trim().length > 0
      ? parsed.name.trim()
      : template.name;
  const description =
    typeof parsed.description === 'string' && parsed.description.trim().length > 0
      ? parsed.description.trim()
      : template.description;

  return { ...template, name, description, outlineJson: refinedOutline };
}
