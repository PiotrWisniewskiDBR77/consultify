/**
 * presentationTemplateArchitect (Epic C2/C4 — FALA B/C, 2026-07-22)
 *
 * FE client for the Deck Template Architect workflow — mirrors the
 * Document Studio Template Architect client (`DocumentStudio/api.ts`
 * `planDocumentStudioTemplate` / `listDocumentStudioTemplates`) but talks
 * to the presentation-templates endpoints that already exist server-side:
 *
 *   POST /api/presentations/templates/plan       — AI-draft a new template
 *                                                   outline from a brief.
 *   GET  /api/presentations/templates             — list templates (system +
 *                                                   org, active only).
 *   GET  /api/presentations/templates/:id         — fetch one template.
 *   PUT  /api/presentations/templates/:id         — manual edit (name,
 *                                                   description, audience,
 *                                                   goal, theme, outlineJson,
 *                                                   maxSlides). Server-side
 *                                                   invariant: only `draft`
 *                                                   lifecycle templates may
 *                                                   be edited in place
 *                                                   (`assertEditableLifecycle`,
 *                                                   presentations.routes.ts:1147).
 *
 * Uses the same `Api` client + `{ data: { data: ... } }` envelope unwrap
 * pattern as `DeckTemplateGallery.tsx` / `PresentationWizard.tsx` (both
 * call `Api.get('/presentations/templates')` directly today) — this
 * module gives that same call surface a typed, reusable home instead of
 * duplicating the unwrap boilerplate a third time.
 */

import { Api } from '@/services/api';

// ---------------------------------------------------------------------------
// Types — mirror server-side `presentationTemplateDraftService.ts` +
// `presentationTemplateCompatibilityService.ts` (`normalizeTemplatePayload`).
// ---------------------------------------------------------------------------

/** Narrative purpose of a slide. Mirrors `SlideIntent` (report/pptx/types.ts). */
export type PresentationSlideIntent =
  | 'cover'
  | 'executive_summary'
  | 'section_intro'
  | 'key_messages'
  | 'performance_overview'
  | 'single_insight'
  | 'comparison'
  | 'assessment'
  | 'root_cause'
  | 'recommendation_single'
  | 'recommendation_portfolio'
  | 'initiative_portfolio'
  | 'prioritization_matrix'
  | 'roadmap'
  | 'risk_management'
  | 'next_steps'
  | 'appendix';

export const PRESENTATION_SLIDE_INTENTS: readonly PresentationSlideIntent[] = [
  'cover',
  'executive_summary',
  'section_intro',
  'key_messages',
  'performance_overview',
  'single_insight',
  'comparison',
  'assessment',
  'root_cause',
  'recommendation_single',
  'recommendation_portfolio',
  'initiative_portfolio',
  'prioritization_matrix',
  'roadmap',
  'risk_management',
  'next_steps',
  'appendix',
];

export interface PresentationTemplateOutlineItem {
  intent: PresentationSlideIntent | string;
  title: string;
  /** Optional 2-4 short thematic guidance phrases (LLM-refined templates only). */
  contentHints?: string[];
  /** Optional one-sentence thesis/take-away shape for the slide (LLM-refined templates only). */
  keyMessage?: string;
  /** Optional 2-3 items naming what data must be gathered — never actual values (LLM-refined templates only). */
  dataNeeded?: string[];
  /** Optional short label for the recommended visualization type (LLM-refined templates only). */
  suggestedVisual?: string;
}

export type PresentationTemplateLifecycleState = 'draft' | 'approved' | 'deprecated';

export interface PresentationCustomTemplateDefinition {
  version: number;
  theme: {
    titleFont: string; bodyFont: string; primaryColor: string; backgroundColor: string;
    surfaceColor: string; textColor: string; accentColor: string; logoDataUri?: string;
  };
  layouts: Record<string, { masterName: string; backgroundColor?: string; accentColor?: string }>;
  layoutMapping: Record<'cover' | 'content' | 'kpi' | 'table' | 'decision', string>;
}

/**
 * Frontend mirror of `normalizeTemplatePayload()` — snake_case, matches
 * the raw `presentation_templates` row shape (same shape `DeckTemplateGallery`
 * and `PresentationTemplateGovernanceView` already consume).
 */
export interface PresentationTemplate {
  id: string;
  organization_id?: string | null;
  name: string;
  description: string;
  deck_type: string;
  audience: string;
  goal: string;
  theme: string;
  language_default: string;
  confidentiality_default: string;
  outline_json: PresentationTemplateOutlineItem[];
  must_have_intents: string[];
  recommended_visuals: string[];
  max_slides: number;
  min_slides: number;
  /**
   * Fala 1 (2026-07-28) — "wzorzec kolorów" (N31). A `CURATED_COLOR_SETS[].id`
   * or `'brand_kit'`, or `null` when this template has no saved color
   * pattern (generation then falls back to whatever the caller picks at
   * generation time, same as today). Stored server-side inside
   * `layout_policy_json.colorTemplateId` — `theme` stays the shallow
   * corporate/minimal/modern enum it always was.
   */
  color_template_id?: string | null;
  custom_template?: PresentationCustomTemplateDefinition | null;
  is_system: boolean;
  is_active?: boolean;
  cloned_from: string | null;
  lifecycle_state?: PresentationTemplateLifecycleState;
  lineage_root_id?: string | null;
  lineage_parent_id?: string | null;
  lineage_version?: number;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
}

export interface PresentationTemplateDraftInput {
  /** Required. Free-text brief describing what the deck template is for. */
  purpose: string;
  name?: string;
  description?: string;
  deckType?: string;
  audience?: string;
  goal?: string;
  language?: string;
  theme?: 'corporate' | 'minimal' | 'modern';
  maxSlides?: number;
  minSlides?: number;
  notes?: string;
  customTemplate?: PresentationCustomTemplateDefinition;
}

export interface PlanPresentationTemplateOptions {
  useLlm?: boolean;
}

export interface PlanPresentationTemplateResult {
  template: PresentationTemplate;
  llmRefined: boolean;
}

export interface UpdatePresentationTemplateInput {
  name?: string;
  description?: string;
  audience?: string;
  goal?: string;
  theme?: string;
  outlineJson?: PresentationTemplateOutlineItem[];
  maxSlides?: number;
  /** Fala 1 (2026-07-28) — see `PresentationTemplate.color_template_id`. `null` clears it. */
  colorTemplateId?: string | null;
  customTemplate?: PresentationCustomTemplateDefinition | null;
}

// ---------------------------------------------------------------------------
// Helpers — same envelope shape as `DeckTemplateGallery.tsx`'s local `unwrap`.
// ---------------------------------------------------------------------------

function unwrap<T = unknown>(res: unknown): T {
  const d = (res as { data?: unknown } | null | undefined)?.data;
  if (d && typeof d === 'object' && 'data' in (d as Record<string, unknown>)) {
    return (d as { data: T }).data;
  }
  return d as T;
}

// ---------------------------------------------------------------------------
// listPresentationTemplates
// ---------------------------------------------------------------------------

export async function listPresentationTemplates(): Promise<PresentationTemplate[]> {
  const res = await Api.get('/presentations/templates');
  const data = unwrap<PresentationTemplate[]>(res);
  return Array.isArray(data) ? data : [];
}

// ---------------------------------------------------------------------------
// getPresentationTemplate
// ---------------------------------------------------------------------------

export async function getPresentationTemplate(templateId: string): Promise<PresentationTemplate> {
  const res = await Api.get(`/presentations/templates/${encodeURIComponent(templateId)}`);
  return unwrap<PresentationTemplate>(res);
}

// ---------------------------------------------------------------------------
// planPresentationTemplate — POST /templates/plan
// ---------------------------------------------------------------------------

export async function planPresentationTemplate(
  input: PresentationTemplateDraftInput,
  options: PlanPresentationTemplateOptions = {}
): Promise<PlanPresentationTemplateResult> {
  const res = await Api.post('/presentations/templates/plan', {
    input,
    useLlm: options.useLlm === true,
  });
  const data = unwrap<{ template: PresentationTemplate; llmRefined?: boolean }>(res);
  return { template: data.template, llmRefined: Boolean(data.llmRefined) };
}

// ---------------------------------------------------------------------------
// updatePresentationTemplate — PUT /templates/:id (Epic C4: the FE caller
// this route has been missing since it shipped — see presentations.routes.ts:1147).
// ---------------------------------------------------------------------------

export async function updatePresentationTemplate(
  templateId: string,
  patch: UpdatePresentationTemplateInput
): Promise<void> {
  await Api.put(`/presentations/templates/${encodeURIComponent(templateId)}`, patch);
}

// ---------------------------------------------------------------------------
// clonePresentationTemplate — POST /templates/:id/clone (existing surface,
// re-exported here so the architect view can offer "start a new draft from
// this template" without a second copy of the endpoint string).
// ---------------------------------------------------------------------------

export async function clonePresentationTemplate(
  templateId: string,
  name?: string
): Promise<{ id: string }> {
  const res = await Api.post(`/presentations/templates/${encodeURIComponent(templateId)}/clone`, {
    name,
  });
  return unwrap<{ id: string }>(res);
}

// ---------------------------------------------------------------------------
// deprecatePresentationTemplate — POST /templates/:id/governance/deprecate
// (existing governance surface, re-exported here so the architect view can
// offer "withdraw this draft" without duplicating the endpoint string; see
// presentations.routes.ts:1310. Requires `template_approve` capability and a
// non-empty `reason` server-side.)
// ---------------------------------------------------------------------------

export async function deprecatePresentationTemplate(
  templateId: string,
  reason: string
): Promise<{ record: unknown }> {
  const res = await Api.post(
    `/presentations/templates/${encodeURIComponent(templateId)}/governance/deprecate`,
    { reason }
  );
  return unwrap<{ record: unknown }>(res);
}
