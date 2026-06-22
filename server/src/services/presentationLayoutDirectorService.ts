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

import type { SlideIntent, UnifiedReportMeta, UnifiedSlide } from './report/pptx/types.js';
import {
  DELIVERABLE_GENERATION_PURPOSE,
  resolveDeliverableTier,
} from './deliverableGenerationTier.js';
import logger from '../utils/Logger.js';

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

/** DBR77 brand default. */
const DEFAULT_PALETTE = 'harvard';

const LAYOUT_INTENT_SET = new Set<string>(LAYOUT_INTENT_CATALOG);
const PALETTE_SET = new Set<string>(PALETTE_CATALOG);

function isValidLayoutIntent(value: unknown): value is SlideIntent {
  return typeof value === 'string' && LAYOUT_INTENT_SET.has(value);
}

function isValidPalette(value: unknown): boolean {
  return typeof value === 'string' && PALETTE_SET.has(value);
}

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

// ──────────────────────────────────────────────────────────────
// LLM planner (premium tier only)
// ──────────────────────────────────────────────────────────────

function summarizeSlideForLlm(slide: UnifiedSlide, index: number): string {
  const content = (slide?.content ?? {}) as Record<string, unknown>;
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
    `Palette catalog (choose ONLY from these, same paletteId for every slide): ${PALETTE_CATALOG.join(', ')}.`;

  const userPrompt =
    `Deck language: ${meta?.language ?? 'en'}. Template: ${meta?.template ?? 'corporate'}. ` +
    `Project: "${meta?.project ?? ''}" for client "${meta?.client ?? ''}".\n` +
    `Slides (${slides.length}):\n${slideDigest}\n\n` +
    'Return one plan object per slide, in order, with slideIndex matching the slide number above.';

  const PlanItemSchema = z.object({
    slideIndex: z.number(),
    layoutIntent: z.enum(LAYOUT_INTENT_CATALOG as unknown as [string, ...string[]]),
    paletteId: z.enum(PALETTE_CATALOG as unknown as [string, ...string[]]),
    imageBrief: z.string().nullable(),
    reasoning: z.string(),
  });
  const OutputSchema = z.object({ plans: z.array(PlanItemSchema) });

  const result = await (llmService as any).call({
    type: 'structured',
    modelConfig: { id: 'premium' }, // resolveModelConfig maps 'premium' → PREMIUM tier
    systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
    schema: OutputSchema,
    maxTokens: 1500,
    temperature: 0.3,
    cache: false,
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

  const plans: SlideLayoutPlan[] = slides.map((_slide, index) => {
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
      reasoning:
        (typeof raw.reasoning === 'string' && raw.reasoning) || 'LLM layout plan',
      // If a field was invalid we patched it deterministically, but the plan
      // still originates from the LLM call.
      source: usedFallbackField ? 'deterministic' : 'llm',
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

  // STANDARD tier → deterministic, no LLM.
  if (tier !== 'PREMIUM') {
    return {
      plans: enforceSinglePalette(enforceNoTripleRun(deterministicPlan(safeSlides))),
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
      const processed = enforceSinglePalette(enforceNoTripleRun(llmPlans));
      return {
        plans: processed,
        tierUsed: 'PREMIUM',
        // Fallback only if no plan actually came from the LLM.
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
    plans: enforceSinglePalette(enforceNoTripleRun(deterministicPlan(safeSlides))),
    tierUsed: 'PREMIUM',
    fallbackUsed: true,
  };
}
