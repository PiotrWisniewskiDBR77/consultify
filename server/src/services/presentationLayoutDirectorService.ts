/**
 * presentationLayoutDirectorService — W4 / B1: Deck AI Layout Director
 *
 * Premium LLM planner that, from each slide's CONTENT, picks:
 *   (1) a layout intent from the catalog of 17 (`SlideIntent`),
 *   (2) ONE coherent palette for the whole deck from the catalog of 13,
 *   (3) a one-line image brief.
 *
 * Falls back to a DETERMINISTIC plan (today's behaviour) when the premium
 * tier is off, or when the LLM call fails / returns nothing.
 *
 * SAFETY (program Znalezisko #1 — generation touches live clients):
 *   - Gated behind the premium tier (`resolveDeliverableTier`). Default OFF =
 *     STANDARD = deterministic = today's exact behaviour.
 *   - FAIL-OPEN: the entire LLM path is wrapped in try/catch; any error yields
 *     a deterministic plan. This function NEVER throws.
 *   - NOT wired into the live generation pipeline by B1 — export only.
 *
 * Graphic parameters (docs/.../DELIVERABLES_GRAPHIC_PARAMETERS.md):
 *   - ≥8 distinct layouts across a deck of ≥8 slides (variety).
 *   - never >2 consecutive identical layouts — enforced in post-processing.
 */

import logger from '../utils/Logger.js';
import {
  DELIVERABLE_GENERATION_PURPOSE,
  deliverableModelConfig,
  resolveDeliverableTier,
} from './deliverableGenerationTier.js';
import { resolveDeliverableDefaults } from './deliverables/deliverableDefaults.js';
import type { SlideIntent, UnifiedReportMeta, UnifiedSlide } from './report/pptx/types.js';

// ── Defaults (czytane RAZ przy starcie; nie hardcode) ────────────────────────
const DECK_DEFAULTS = resolveDeliverableDefaults('deck');

/**
 * Mapowanie motywu z deliverableDefaults → id palety PPTX (dwa osobne systemy).
 * Jedyne miejsce tego mapowania w całej bazie.
 */
const THEME_TO_PALETTE_ID: Record<string, string> = {
  executive: 'harvard',
  modern: 'slate',
  corporate: 'midnight',
  classic: 'graphite',
  clean: 'arctic',
};

/** Pula zróżnicowanych intentów do dywersyfikacji layoutów (enforceMinDistinctLayouts). */
const DIVERSE_INTENT_POOL: readonly SlideIntent[] = [
  'key_messages',
  'single_insight',
  'comparison',
  'performance_overview',
  'recommendation_single',
  'root_cause',
  'assessment',
  'recommendation_portfolio',
  'initiative_portfolio',
  'prioritization_matrix',
  'roadmap',
  'risk_management',
] as const;

// ──────────────────────────────────────────────────────────────
// Catalogs (mirrored as plain string literals — single source of
// truth lives in pptx/types.ts SlideIntent + wizard CURATED_COLOR_SETS)
// ──────────────────────────────────────────────────────────────

/** 17 layout intents — keep in sync with `SlideIntent` (pptx/types.ts:12). */
export const LAYOUT_INTENT_CATALOG: readonly SlideIntent[] = [
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
] as const;

/** 13 curated palettes — keep in sync with `CURATED_COLOR_SETS` (wizard/types.ts:285). */
export const PALETTE_CATALOG: readonly string[] = [
  'harvard',
  'ocean',
  'slate',
  'forest',
  'ember',
  'midnight',
  'arctic',
  'sand',
  'indigo',
  'graphite',
  'olive',
  'burgundy',
  'teal',
] as const;

/** Paleta domyślna — pochodzi z defaults (theme → palette-id), nie hardcode. */
const DEFAULT_PALETTE = THEME_TO_PALETTE_ID[DECK_DEFAULTS.graphic.theme] ?? 'harvard';

const LAYOUT_INTENT_SET = new Set<string>(LAYOUT_INTENT_CATALOG);
const PALETTE_SET = new Set<string>(PALETTE_CATALOG);

function isValidLayoutIntent(value: unknown): value is SlideIntent {
  return typeof value === 'string' && LAYOUT_INTENT_SET.has(value);
}

function isValidPalette(value: unknown): boolean {
  return typeof value === 'string' && PALETTE_SET.has(value);
}

// ──────────────────────────────────────────────────────────────
// Composition vocabulary (STEP 1a — planner-only prompt context)
//
// This is the TOPOLOGY the LLM reasons over so B1 stops picking a layout
// intent blind and instead COMPOSES the slide: which content primitives land
// in which screen region, under which named layout archetype.
//
// IMPORTANT: this is PROMPT CONTEXT, not a renderer contract. Step 1a does NOT
// wire any of this into LayoutEngine / CardRenderer / PPTX. It exists so the
// model can reason about FIT (capacity, hierarchy, content shape). The renderer
// honours `composition` only in Step 1b. Keep the area/block vocab aligned with
// the eventual region model (`CardBlock.position.area`) + the 14 primitives so
// 1b can interpret what 1a emits.
// ──────────────────────────────────────────────────────────────

/** Region areas a slide can be partitioned into (mirrors CardBlock.position.area). */
export const COMPOSITION_AREAS = ['full', 'left', 'right', 'top', 'bottom', 'overlay'] as const;
export type CompositionArea = (typeof COMPOSITION_AREAS)[number];

/** Content block primitives the deck can render (the 14+ from the region model). */
export const COMPOSITION_BLOCK_TYPES = [
  'heading',
  'paragraph',
  'bullet_list',
  'numbered_list',
  'table',
  'chart',
  'image',
  'kpi_widget',
  'metric_strip',
  'smart_layout',
  'smart_diagram',
  'callout',
  'quote_block',
  'timeline_block',
  'divider',
  'icon_row',
] as const;
export type CompositionBlockType = (typeof COMPOSITION_BLOCK_TYPES)[number];

/**
 * 2–3 sensible layout-variant archetypes per intent family. These are NAMED
 * starting points the model can pick from (or reason near) — not an exhaustive
 * registry. The id is what flows into `composition.layoutVariantId`.
 */
export const COMPOSITION_LAYOUT_VARIANTS: Readonly<Record<string, readonly string[]>> = {
  cover: ['centered', 'left_image', 'bottom_strip'],
  section_intro: ['centered', 'left_image'],
  executive_summary: ['stacked', 'two_column', 'kpi_grid_2x2'],
  key_messages: ['stacked', 'two_column', 'icon_row_grid'],
  single_insight: ['big_number', 'chart_left_text_right', 'stacked'],
  performance_overview: ['kpi_grid_2x2', 'chart_left_text_right', 'big_number'],
  comparison: ['split_lr', 'table', 'two_column'],
  assessment: ['table', 'kpi_grid_2x2', 'split_lr'],
  root_cause: ['smart_diagram', 'two_column', 'stacked'],
  recommendation_single: ['big_number', 'stacked', 'chart_left_text_right'],
  recommendation_portfolio: ['kpi_grid_2x2', 'two_column', 'table'],
  initiative_portfolio: ['kpi_grid_2x2', 'table', 'two_column'],
  prioritization_matrix: ['smart_diagram', 'table', 'split_lr'],
  roadmap: ['timeline_strip', 'stacked', 'two_column'],
  risk_management: ['table', 'two_column', 'kpi_grid_2x2'],
  next_steps: ['numbered_stack', 'two_column', 'timeline_strip'],
  appendix: ['stacked', 'table'],
} as const;

const COMPOSITION_AREA_SET = new Set<string>(COMPOSITION_AREAS);
const COMPOSITION_BLOCK_SET = new Set<string>(COMPOSITION_BLOCK_TYPES);

/** Hard cap on regions per slide (keeps the planner — and the renderer — sane). */
const MAX_REGIONS_PER_SLIDE = 5;
/** Hard cap on block types named inside one region. */
const MAX_BLOCK_TYPES_PER_REGION = 6;

/**
 * Compact, token-frugal description of the composition vocabulary, injected
 * into the planner systemPrompt so the model reasons about FIT.
 */
function buildCompositionVocab(): string {
  const variantLines = LAYOUT_INTENT_CATALOG.map((intent) => {
    const variants = COMPOSITION_LAYOUT_VARIANTS[intent] ?? ['stacked'];
    return `  ${intent}: ${variants.join(' | ')}`;
  }).join('\n');

  return [
    'COMPOSITION VOCABULARY (reason about FIT, do not pick blind):',
    `- Region areas: ${COMPOSITION_AREAS.join(', ')}.`,
    `- Content block primitives: ${COMPOSITION_BLOCK_TYPES.join(', ')}.`,
    '- Layout-variant archetypes per intent (pick ONE layoutVariantId, or the',
    '  closest fit when content suggests another):',
    variantLines,
  ].join('\n');
}

/** Prompt-ready constant (built once). */
export const COMPOSITION_VOCAB = buildCompositionVocab();

// ──────────────────────────────────────────────────────────────
// Public contract
// ──────────────────────────────────────────────────────────────

export interface SlideLayoutPlan {
  slideIndex: number;
  layoutIntent: SlideIntent; // from catalog of 17
  paletteId: string; // from catalog of 13
  imageBrief: string | null; // short image description (1-2 sentences) or null
  reasoning: string;
  source: 'llm' | 'deterministic';
  /**
   * Pass-through of the slide's INPUT title + key_message (B1 does NOT author
   * these — they are the slide's own content). Carried on the plan so that
   * downstream renderers/QA evaluate the REAL slide title rather than a proxy
   * (reasoning/imageBrief). `null` when the source slide supplied none; omitted
   * by plans built before this carry-through existed.
   */
  title?: string | null;
  keyMessage?: string | null;
  /**
   * STEP 1a — OPTIONAL composition plan. Additive + back-compatible:
   *   - absent / `null`  → today's behaviour (renderer keeps its heuristic).
   *   - present          → the LLM's per-slide region plan, NORMALIZED
   *     (invalid areas/blockTypes dropped, regions capped). Carried for the
   *     Step 1b renderer to honour; Step 1a touches no renderer.
   *
   * `layoutVariantId` is a named archetype from COMPOSITION_LAYOUT_VARIANTS.
   * `regions` map content primitives → screen areas. `emphasis` is a one-word
   * hint (e.g. "data", "narrative", "visual") for what the slide leads with.
   */
  composition?: SlideComposition | null;
  /**
   * W1.5 — chart spec attached POST layout (not authored by LLM). When present,
   * the PPTX renderer draws the chart in place of / alongside the key-message text.
   * Absent = renderer falls back to text layout.
   */
  chartSpec?: SlideChartSpec | null;
}

/** Union of supported chart specs for slides (W1.5 / F11.1 / W7.5). */
export type SlideChartSpec =
  | {
      type: 'bar_series';
      labels: string[];
      series: Array<{ name: string; values: number[]; color?: string }>;
    }
  | {
      type: 'rag';
      items: Array<{ label: string; value: number; status: 'green' | 'amber' | 'red' }>;
    }
  | {
      type: 'marimekko';
      columns: Array<{ label: string; segments: Array<{ name: string; value: number }> }>;
    }
  | { type: 'harvey_balls'; rows: Array<{ label: string; level: number; note?: string }> };

export interface SlideCompositionRegion {
  area: CompositionArea;
  blockTypes: string[];
}

export interface SlideComposition {
  layoutVariantId?: string;
  regions?: SlideCompositionRegion[];
  emphasis?: string;
}

export interface DeckLayoutDirectorResult {
  plans: SlideLayoutPlan[];
  tierUsed: 'PREMIUM' | 'STANDARD';
  fallbackUsed: boolean;
}

export interface PlanDeckLayoutOptions {
  orgId: string;
  userId?: string;
  preferPremium?: boolean;
}

// ──────────────────────────────────────────────────────────────
// Deterministic plan (the always-safe fallback)
// ──────────────────────────────────────────────────────────────

/**
 * Heuristic intent for a slide when it doesn't already carry one:
 *   - first slide → cover
 *   - last slide  → next_steps
 *   - otherwise   → key_messages
 */
function heuristicIntent(index: number, total: number): SlideIntent {
  if (index === 0) return 'cover';
  if (index === total - 1) return 'next_steps';
  return 'key_messages';
}

/** Pull the slide's own title (from content) — INPUT, not authored by B1. */
function slideTitle(slide: UnifiedSlide): string | null {
  const content = (slide?.content ?? {}) as unknown as Record<string, unknown>;
  for (const k of ['title', 'headline', 'section_title']) {
    const v = content[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return null;
}

function slideKeyMessage(slide: UnifiedSlide): string | null {
  const km = slide?.key_message;
  return typeof km === 'string' && km.trim() ? km.trim() : null;
}

function deterministicPlan(slides: UnifiedSlide[]): SlideLayoutPlan[] {
  const total = slides.length;
  return slides.map((slide, index) => {
    const intent: SlideIntent = isValidLayoutIntent(slide?.intent)
      ? slide.intent
      : heuristicIntent(index, total);
    return {
      slideIndex: index,
      layoutIntent: intent,
      paletteId: DEFAULT_PALETTE,
      imageBrief: null,
      reasoning: isValidLayoutIntent(slide?.intent)
        ? 'Deterministic: slide-supplied intent'
        : `Deterministic heuristic (slide ${index + 1}/${total})`,
      source: 'deterministic' as const,
      title: slideTitle(slide),
      keyMessage: slideKeyMessage(slide),
      // STEP 1a — deterministic path never composes (renderer heuristic stays).
      composition: null,
    };
  });
}

// ──────────────────────────────────────────────────────────────
// Post-processing: enforce graphic parameters
// ──────────────────────────────────────────────────────────────

/** Best-effort "related" layout to break a run of 3 identical layouts. */
const RELATED_INTENT: Partial<Record<SlideIntent, SlideIntent>> = {
  key_messages: 'single_insight',
  single_insight: 'key_messages',
  comparison: 'assessment',
  assessment: 'comparison',
  recommendation_single: 'recommendation_portfolio',
  recommendation_portfolio: 'recommendation_single',
  initiative_portfolio: 'prioritization_matrix',
  prioritization_matrix: 'initiative_portfolio',
  roadmap: 'next_steps',
  next_steps: 'roadmap',
  risk_management: 'root_cause',
  root_cause: 'risk_management',
  performance_overview: 'single_insight',
  executive_summary: 'key_messages',
  section_intro: 'key_messages',
  appendix: 'key_messages',
  cover: 'section_intro',
};

function relatedIntent(intent: SlideIntent): SlideIntent {
  return RELATED_INTENT[intent] ?? 'key_messages';
}

/**
 * Never allow >2 consecutive identical layouts: if three in a row share a
 * layout, rewrite the MIDDLE one to a related layout. Mutates a copy.
 */
function enforceNoTripleRun(plans: SlideLayoutPlan[]): SlideLayoutPlan[] {
  const out = plans.map((p) => ({ ...p }));
  for (let i = 2; i < out.length; i++) {
    if (
      out[i].layoutIntent === out[i - 1].layoutIntent &&
      out[i - 1].layoutIntent === out[i - 2].layoutIntent
    ) {
      const original = out[i - 1].layoutIntent;
      let swap = relatedIntent(original);
      // Avoid re-introducing a run with the neighbour we'd create.
      if (swap === out[i - 2].layoutIntent || swap === out[i].layoutIntent) {
        swap = swap === 'key_messages' ? 'single_insight' : 'key_messages';
      }
      out[i - 1] = {
        ...out[i - 1],
        layoutIntent: swap,
        reasoning: `${out[i - 1].reasoning} | adjusted: broke 3x "${original}" run`,
      };
    }
  }
  return out;
}

/** Force ONE palette for the whole deck (consistency). Uses the first valid. */
function enforceSinglePalette(plans: SlideLayoutPlan[]): SlideLayoutPlan[] {
  if (plans.length === 0) return plans;
  const chosen = plans.find((p) => isValidPalette(p.paletteId))?.paletteId ?? DEFAULT_PALETTE;
  return plans.map((p) => (p.paletteId === chosen ? p : { ...p, paletteId: chosen }));
}

/**
 * Enforces `minDistinct` distinct layout intents across the deck. For decks
 * shorter than `minDistinct`, the target is capped at the deck length.
 *
 * Strategy: scan middle slides (skip cover/last); replace only an intent used
 * at least three times with an unused intent from DIVERSE_INTENT_POOL. Keeping
 * two occurrences matters for comparison-heavy and other deliberately repeated
 * narrative patterns; graphic diversity must never erase that semantics.
 * Stop once the target is reached. Never touches first/last slide.
 */
function enforceMinDistinctLayouts(
  plans: SlideLayoutPlan[],
  minDistinct: number
): SlideLayoutPlan[] {
  if (plans.length === 0) return plans;
  const target = Math.min(minDistinct, plans.length);

  const usedIntents = new Set(plans.map((p) => p.layoutIntent));
  if (usedIntents.size >= target) return plans;

  const available = DIVERSE_INTENT_POOL.filter((i) => !usedIntents.has(i));
  if (available.length === 0) return plans;

  const out = plans.map((p) => ({ ...p }));
  let avIdx = 0;

  for (let i = 1; i < out.length - 1; i++) {
    const currentDistinct = new Set(out.map((p) => p.layoutIntent));
    if (currentDistinct.size >= target) break;
    if (avIdx >= available.length) break;

    const current = out[i].layoutIntent;
    const count = out.filter((p) => p.layoutIntent === current).length;
    if (count > 2) {
      const newIntent = available[avIdx++];
      out[i] = {
        ...out[i],
        layoutIntent: newIntent,
        reasoning: `${out[i].reasoning} | diversified → "${newIntent}"`,
      };
    }
  }

  return out;
}

// ──────────────────────────────────────────────────────────────
// LLM planner (premium tier only)
// ──────────────────────────────────────────────────────────────

function summarizeSlideForLlm(slide: UnifiedSlide, index: number): string {
  const content = (slide?.content ?? {}) as unknown as Record<string, unknown>;
  const km = slide?.key_message ? ` key_message="${String(slide.key_message).slice(0, 160)}"` : '';
  const currentIntent = isValidLayoutIntent(slide?.intent) ? slide.intent : '(none)';
  // Pull a couple of human-readable hints from the content blob.
  const hintKeys = ['title', 'headline', 'section_title', 'problem', 'verdict', 'closing_message'];
  const hints = hintKeys
    .map((k) => (typeof content[k] === 'string' ? `${k}="${String(content[k]).slice(0, 80)}"` : ''))
    .filter(Boolean)
    .join(' ');
  return `Slide ${index}: currentIntent=${currentIntent}${km} ${hints}`.trim();
}

/**
 * Normalize a raw LLM `composition` into our contract. Fail-open by design:
 *   - invalid / non-object / empty  → null (renderer keeps its heuristic).
 *   - unknown areas / blockTypes    → dropped.
 *   - regions capped (count + per-region blockTypes).
 *   - layoutVariantId / emphasis    → kept only when a non-empty string.
 * NEVER throws. A composition that normalizes to "nothing useful" → null, so
 * back-compat holds: absent composition === today's behaviour.
 */
function normalizeComposition(raw: unknown): SlideComposition | null {
  try {
    if (!raw || typeof raw !== 'object') return null;
    const r = raw as Record<string, unknown>;

    const out: SlideComposition = {};

    if (typeof r.layoutVariantId === 'string' && r.layoutVariantId.trim()) {
      out.layoutVariantId = r.layoutVariantId.trim().slice(0, 60);
    }

    if (typeof r.emphasis === 'string' && r.emphasis.trim()) {
      // one-word hint — take the first token, keep it short.
      out.emphasis = r.emphasis.trim().split(/\s+/)[0].slice(0, 24);
    }

    if (Array.isArray(r.regions)) {
      const regions: SlideCompositionRegion[] = [];
      for (const reg of r.regions) {
        if (regions.length >= MAX_REGIONS_PER_SLIDE) break;
        if (!reg || typeof reg !== 'object') continue;
        const area = (reg as Record<string, unknown>).area;
        if (typeof area !== 'string' || !COMPOSITION_AREA_SET.has(area)) continue;

        const rawTypes = (reg as Record<string, unknown>).blockTypes;
        const blockTypes: string[] = [];
        if (Array.isArray(rawTypes)) {
          for (const bt of rawTypes) {
            if (blockTypes.length >= MAX_BLOCK_TYPES_PER_REGION) break;
            if (
              typeof bt === 'string' &&
              COMPOSITION_BLOCK_SET.has(bt) &&
              !blockTypes.includes(bt)
            ) {
              blockTypes.push(bt);
            }
          }
        }
        // A region with no valid block types carries no useful info — drop it.
        if (blockTypes.length === 0) continue;
        regions.push({ area: area as CompositionArea, blockTypes });
      }
      if (regions.length > 0) out.regions = regions;
    }

    // Nothing survived normalization → treat as absent.
    if (
      out.layoutVariantId === undefined &&
      out.emphasis === undefined &&
      out.regions === undefined
    ) {
      return null;
    }
    return out;
  } catch {
    return null;
  }
}

async function planViaLlm(
  slides: UnifiedSlide[],
  meta: UnifiedReportMeta
): Promise<SlideLayoutPlan[] | null> {
  // Dynamic import so unit tests don't drag the whole AI stack.
  const { llmService } = await import('./ai/llmService.js');
  const { z } = await import('zod');

  const slideDigest = slides.map((s, i) => summarizeSlideForLlm(s, i)).join('\n');

  const systemPrompt =
    'You are a presentation layout director (Gamma-quality). For each slide pick the best ' +
    'layout intent from the catalog, a coherent palette (ONE palette for the whole deck for ' +
    'consistency), and a one-line image brief. Favor variety: avoid >2 consecutive identical ' +
    'layouts.\n' +
    `Layout intent catalog (choose ONLY from these): ${LAYOUT_INTENT_CATALOG.join(', ')}.\n` +
    `Palette catalog (choose ONLY from these, same paletteId for every slide): ${PALETTE_CATALOG.join(', ')}.\n\n` +
    // ── STEP 1a: ALSO COMPOSE each slide (reason about content shape → regions) ──
    `${COMPOSITION_VOCAB}\n\n` +
    'For EACH slide ALSO return a `composition` object that PLANS the slide layout:\n' +
    '  - layoutVariantId: ONE archetype id from the list above for that intent (or the closest fit ' +
    'when the content shape suggests another).\n' +
    '  - regions: an array of { area, blockTypes[] } mapping content primitives to screen areas. ' +
    'Reason about FIT: e.g. "4 metrics + 1 chart" → kpi_grid_2x2 with metric_strip/kpi_widget in one ' +
    'area and chart in another; a single quote → big_number/centered with quote_block full. Use ONLY ' +
    'the listed areas and block primitives. Keep it minimal (1–4 regions); do not overfill.\n' +
    '  - emphasis: ONE word for what the slide leads with (e.g. data, narrative, visual, comparison).\n' +
    'The composition must reflect the ACTUAL content of that slide — vary it slide-to-slide. If a slide ' +
    'is genuinely trivial, a single full-area region is fine.';

  const userPrompt =
    `Deck language: ${meta?.language ?? 'en'}. Template: ${meta?.template ?? 'corporate'}. ` +
    `Project: "${meta?.project ?? ''}" for client "${meta?.client ?? ''}".\n` +
    `Slides (${slides.length}):\n${slideDigest}\n\n` +
    'Return one plan object per slide, in order, with slideIndex matching the slide number above.';

  // composition is OPTIONAL + permissive (areas/blockTypes are NORMALIZED
  // post-parse, not enum-gated here, so a stray value never rejects the slide).
  const CompositionSchema = z
    .object({
      layoutVariantId: z.string().optional(),
      regions: z
        .array(
          z.object({
            area: z.string(),
            blockTypes: z.array(z.string()),
          })
        )
        .optional(),
      emphasis: z.string().optional(),
    })
    .nullish();

  const PlanItemSchema = z.object({
    slideIndex: z.number(),
    layoutIntent: z.enum(LAYOUT_INTENT_CATALOG as unknown as [string, ...string[]]),
    paletteId: z.enum(PALETTE_CATALOG as unknown as [string, ...string[]]),
    imageBrief: z.string().nullable(),
    reasoning: z.string(),
    composition: CompositionSchema,
  });
  const OutputSchema = z.object({ plans: z.array(PlanItemSchema) });

  const result = await (llmService as any).call({
    type: 'structured',
    modelConfig: deliverableModelConfig(), // env DELIVERABLE_LLM_* → cheaper model; else PREMIUM tier
    systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
    schema: OutputSchema,
    maxTokens: 1500,
    temperature: 0.3,
    cache: false,
    // W2.1 fix: premium deck planning is heavy; without this override the
    // baseClient 20s hard-timeout silently kills it → deck:null → missing PPTX.
    // Aligns with assumptionsModel/tableSchema/docBlock (all 120000).
    timeoutMs: 120000,
  });

  const obj = (result as any)?.object;
  const rawPlans: unknown[] = Array.isArray(obj?.plans) ? obj.plans : [];
  if (rawPlans.length === 0) return null;

  // Map LLM output onto our contract, slide-by-slide. Invalid entries fall
  // back to the deterministic plan for that slide.
  const det = deterministicPlan(slides);
  const byIndex = new Map<number, any>();
  for (const p of rawPlans) {
    const idx = (p as any)?.slideIndex;
    if (typeof idx === 'number') byIndex.set(idx, p);
  }

  const plans: SlideLayoutPlan[] = slides.map((slide, index) => {
    const raw = byIndex.get(index);
    const fallback = det[index];
    if (!raw) return fallback; // LLM omitted this slide → deterministic

    const layoutIntent = isValidLayoutIntent(raw.layoutIntent)
      ? (raw.layoutIntent as SlideIntent)
      : fallback.layoutIntent;
    const paletteId = isValidPalette(raw.paletteId) ? raw.paletteId : fallback.paletteId;
    const usedFallbackField = !isValidLayoutIntent(raw.layoutIntent);

    return {
      slideIndex: index,
      layoutIntent,
      paletteId,
      imageBrief:
        typeof raw.imageBrief === 'string' && raw.imageBrief.trim() ? raw.imageBrief.trim() : null,
      reasoning: (typeof raw.reasoning === 'string' && raw.reasoning) || 'LLM layout plan',
      // If a field was invalid we patched it deterministically, but the plan
      // still originates from the LLM call.
      source: usedFallbackField ? 'deterministic' : 'llm',
      // Title/key_message are slide INPUTS — always carried from the source
      // slide, regardless of which layout the LLM picked.
      title: slideTitle(slide),
      keyMessage: slideKeyMessage(slide),
      // STEP 1a — normalized composition (null when absent/invalid → back-compat).
      composition: normalizeComposition(raw.composition),
    };
  });

  return plans;
}

// ──────────────────────────────────────────────────────────────
// Main entry
// ──────────────────────────────────────────────────────────────

export async function planDeckLayout(
  slides: UnifiedSlide[],
  meta: UnifiedReportMeta,
  opts: PlanDeckLayoutOptions
): Promise<DeckLayoutDirectorResult> {
  const safeSlides = Array.isArray(slides) ? slides : [];

  const tier = resolveDeliverableTier({
    orgId: opts?.orgId,
    preferPremium: opts?.preferPremium,
  });

  const minDistinct = DECK_DEFAULTS.graphic.layout?.minDistinctLayouts ?? 8;

  const postProcess = (raw: SlideLayoutPlan[]) =>
    enforceSinglePalette(enforceNoTripleRun(enforceMinDistinctLayouts(raw, minDistinct)));

  // STANDARD tier → deterministic, no LLM.
  if (tier !== 'PREMIUM') {
    return {
      plans: postProcess(deterministicPlan(safeSlides)),
      tierUsed: 'STANDARD',
      fallbackUsed: true,
    };
  }

  // PREMIUM tier — try LLM, fail-open to deterministic.
  try {
    logger.info('[layoutDirector] premium plan', {
      purpose: DELIVERABLE_GENERATION_PURPOSE,
      orgId: opts?.orgId,
      slides: safeSlides.length,
    });

    const llmPlans = await planViaLlm(safeSlides, meta);
    if (llmPlans && llmPlans.length > 0) {
      const processed = postProcess(llmPlans);
      return {
        plans: processed,
        tierUsed: 'PREMIUM',
        fallbackUsed: !processed.some((p) => p.source === 'llm'),
      };
    }
    // Empty/no result → deterministic fallback.
  } catch (err) {
    logger.warn('[layoutDirector] LLM planning failed, using deterministic fallback', {
      err: (err as Error)?.message,
      orgId: opts?.orgId,
    });
  }

  return {
    plans: postProcess(deterministicPlan(safeSlides)),
    tierUsed: 'PREMIUM',
    fallbackUsed: true,
  };
}
