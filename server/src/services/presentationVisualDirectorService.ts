/**
 * Presentation Visual Director (v3, deterministic v1)
 *
 * Creates a "visual plan" (Gamma-like) by attaching `slide.visuals[]` based on:
 * - slide intent + slide content
 * - brand color + theme
 * - visuals settings (enabled/priority/density)
 *
 * v1 is deterministic (no LLM call). v2 can swap planner to LLM.
 */
import type {
  SlideIntent,
  SlideVisualSlot,
  SlideVisualSpec,
  UnifiedReportMeta,
  UnifiedSlide,
} from './report/pptx/types.js';

type VisualPriority = 'quality' | 'cost';
type ImageDensity = 'low' | 'medium' | 'high';

export type VisualSettings = {
  enabled?: boolean;
  priority?: VisualPriority;
  imageDensity?: ImageDensity;
};

function resolveDensity(settings: VisualSettings): ImageDensity {
  const priority = settings.priority || 'quality';
  const density = settings.imageDensity;
  if (density) return density;
  return priority === 'cost' ? 'low' : 'medium';
}

function baseStyle(meta: UnifiedReportMeta): string {
  return meta.template === 'minimal'
    ? 'minimal, clean, lots of whitespace, subtle gradients'
    : meta.template === 'modern'
      ? 'modern, vibrant, premium SaaS, abstract shapes'
      : 'corporate, BCG-grade, elegant, understated';
}

function langNoText(meta: UnifiedReportMeta): string {
  return meta.language === 'pl'
    ? 'Bez tekstu w obrazie. Zero napisów.'
    : 'No text in the image. Zero lettering.';
}

function purposeForIntent(intent: SlideIntent): SlideVisualSpec['purpose'] {
  if (intent === 'cover') return 'image_cover';
  return 'image_slide_asset';
}

// G6: Smart Image Routing — 6-rule intent→visual matrix
interface IntentVisualRule {
  slot: SlideVisualSlot;
  densityThreshold: ImageDensity;
  promptBuilder: (ctx: {
    style: string;
    noText: string;
    deckTitle: string;
    audience: string;
    goal: string;
    brandColor?: string;
    content: any;
  }) => string;
  styleHintOverride?: string;
  aspect?: SlideVisualSpec['aspect'];
}

const INTENT_VISUAL_RULES: Partial<Record<SlideIntent, IntentVisualRule[]>> = {
  cover: [
    {
      slot: 'cover_bg',
      densityThreshold: 'low',
      aspect: '16:9',
      promptBuilder: (ctx) =>
        `${ctx.style}. Premium 16:9 hero cover for a consulting deck. Topic: "${ctx.deckTitle}". Audience: ${ctx.audience}. Goal: ${ctx.goal}. ${ctx.brandColor ? `Palette: #${ctx.brandColor.replace('#', '')}.` : ''} Confident, sharp, high-end. ${ctx.noText} No logos, no watermarks.`,
    },
  ],
  executive_summary: [
    {
      slot: 'side_illustration',
      densityThreshold: 'high',
      promptBuilder: (ctx) =>
        `${ctx.style}. Subtle editorial illustration for an executive summary. Topic: "${ctx.deckTitle}". ${ctx.brandColor ? `Palette: #${ctx.brandColor.replace('#', '')}.` : ''} Understated, slide-friendly. ${ctx.noText} No logos.`,
    },
  ],
  section_intro: [
    {
      slot: 'background_texture',
      densityThreshold: 'medium',
      promptBuilder: (ctx) =>
        `${ctx.style}. Subtle 16:9 background for a section intro slide. Deck: "${ctx.deckTitle}". Low visual noise, high readability. ${ctx.brandColor ? `Palette: #${ctx.brandColor.replace('#', '')}.` : ''} ${ctx.noText}`,
    },
  ],
  key_messages: [
    {
      slot: 'background_texture',
      densityThreshold: 'medium',
      promptBuilder: (ctx) =>
        `${ctx.style}. Subtle background for a key messages slide. Deck: "${ctx.deckTitle}". Low noise. ${ctx.brandColor ? `Palette: #${ctx.brandColor.replace('#', '')}.` : ''} ${ctx.noText}`,
    },
  ],
  performance_overview: [
    {
      slot: 'decorative_accent',
      densityThreshold: 'high',
      promptBuilder: (ctx) =>
        `${ctx.style}. Small decorative accent for a KPI dashboard slide. Abstract data visualization motif. ${ctx.brandColor ? `Palette: #${ctx.brandColor.replace('#', '')}.` : ''} ${ctx.noText} No logos.`,
      styleHintOverride: 'abstract geometric, data-inspired',
      aspect: '4:3',
    },
  ],
  roadmap: [
    {
      slot: 'decorative_accent',
      densityThreshold: 'high',
      promptBuilder: (ctx) =>
        `${ctx.style}. Subtle decorative accent for a roadmap/timeline slide. Forward-looking, progress motif. ${ctx.brandColor ? `Palette: #${ctx.brandColor.replace('#', '')}.` : ''} ${ctx.noText}`,
      aspect: '4:3',
    },
  ],
};

const DENSITY_ORDER: ImageDensity[] = ['low', 'medium', 'high'];

function meetsThreshold(current: ImageDensity, required: ImageDensity): boolean {
  return DENSITY_ORDER.indexOf(current) >= DENSITY_ORDER.indexOf(required);
}

export function planSlideVisuals(params: {
  slide: UnifiedSlide;
  meta: UnifiedReportMeta;
  deckTitle: string;
  audience: string;
  goal: string;
  brandColor?: string;
  settings: VisualSettings;
}): SlideVisualSpec[] {
  const { slide, meta, deckTitle, audience, goal, brandColor, settings } = params;
  const priority = settings.priority || 'quality';
  const density = resolveDensity(settings);
  if (settings.enabled === false) return [];

  const style = baseStyle(meta);
  const noText = langNoText(meta);

  if (priority === 'cost' && slide.intent !== 'cover') return [];

  const visuals: SlideVisualSpec[] = [];

  // G6: Use the full rule matrix for intent→visual mapping
  const rules = INTENT_VISUAL_RULES[slide.intent];
  if (rules) {
    const ctx = { style, noText, deckTitle, audience, goal, brandColor, content: slide.content };
    for (const rule of rules) {
      if (!meetsThreshold(density, rule.densityThreshold)) continue;
      if (priority !== 'quality' && rule.densityThreshold !== 'low') continue;

      visuals.push({
        slot: rule.slot,
        purpose: purposeForIntent(slide.intent),
        label: `Planned ${rule.slot} (${slide.intent})`,
        styleHint: rule.styleHintOverride || style,
        palette: brandColor ? { primary: brandColor.replace('#', '') } : undefined,
        aspect: rule.aspect || '16:9',
        prompt: rule.promptBuilder(ctx),
      });
    }
    if (visuals.length > 0) return visuals;
  }

  // Fallback: section_intro-like intents without explicit rules
  if (priority === 'quality' && meetsThreshold(density, 'medium')) {
    if (
      ['comparison', 'assessment', 'recommendation_portfolio', 'prioritization_matrix'].includes(
        slide.intent
      )
    ) {
      visuals.push({
        slot: 'background_texture',
        purpose: purposeForIntent(slide.intent),
        label: `Planned background texture (${slide.intent})`,
        styleHint: style,
        palette: brandColor ? { primary: brandColor.replace('#', '') } : undefined,
        aspect: '16:9',
        prompt: `${style}. Subtle 16:9 background for a ${slide.intent.replace(/_/g, ' ')} slide. Deck: "${deckTitle}". Low noise, high readability. ${brandColor ? `Palette: #${brandColor.replace('#', '')}.` : ''} ${noText}`,
      });
    }
  }

  return visuals;
}

export function planDeckVisuals(params: {
  slides: UnifiedSlide[];
  meta: UnifiedReportMeta;
  deckTitle: string;
  audience: string;
  goal: string;
  brandColor?: string;
  settings: VisualSettings;
}): UnifiedSlide[] {
  const { slides, meta, deckTitle, audience, goal, brandColor, settings } = params;

  return slides.map((s) => {
    const planned = planSlideVisuals({
      slide: s,
      meta,
      deckTitle,
      audience,
      goal,
      brandColor,
      settings,
    });
    if (!planned.length) return s;
    return {
      ...s,
      visuals: [...(s.visuals || []), ...planned],
    };
  });
}

// ──────────────────────────────────────────────────────────────
// W4 / B1 WIRE — premium Layout Director augmentation (flag-gated)
//
// `planDeckVisualsTiered` is a drop-in superset of `planDeckVisuals`: it runs
// the SAME deterministic visual planner, then — only when the premium
// deliverables tier is active — augments the result with the B1 Layout
// Director's plan (single deck palette + per-slide image brief).
//
// SAFETY (program Znalezisko #1 — generation touches live clients):
//   - Flag OFF (default, all clients) ⇒ returns EXACTLY what `planDeckVisuals`
//     returns, byte-identical, with ZERO LLM call.
//   - FAIL-OPEN: every premium step is wrapped — any error (tier resolution,
//     LLM, mapping) falls back to the deterministic output and NEVER throws.
//   - No contract change: same params (+ optional `orgId`/`preferPremium`),
//     same `UnifiedSlide[]` output the live pipeline already consumes.
//
// MAPPING RATIONALE — why B1's `layoutIntent` is NOT written onto
// `slide.intent`: the live renderer (`PptxPipelineService.resolveLayout`)
// requires `slide.intent` ⇄ `slide.content.type` coherence (each layout reads
// content typed by intent). Overwriting `intent` from a layout *recommendation*
// would desync content and break rendering. So B1's plan is mapped onto the
// fields that are SAFE to vary per-deck: the deck palette (→ every visual's
// `palette.primary`) and the per-slide image brief (→ an extra
// `SlideVisualSpec`). The layout recommendation is carried as a non-destructive
// debug label only.
// ──────────────────────────────────────────────────────────────

/** Map a B1 paletteId (catalog of 13) → a brand hex the visual specs can use. */
const B1_PALETTE_PRIMARY_HEX: Record<string, string> = {
  harvard: 'A41034',
  ocean: '0A6EBD',
  slate: '475569',
  forest: '166534',
  ember: 'C2410C',
  midnight: '1E293B',
  arctic: '0EA5E9',
  sand: 'B45309',
  indigo: '4338CA',
  graphite: '374151',
  olive: '4D7C0F',
  burgundy: '7F1D1D',
  teal: '0F766E',
};

function imageBriefVisual(
  slide: UnifiedSlide,
  brief: string,
  paletteHex: string | undefined,
  style: string
): SlideVisualSpec {
  const slot: SlideVisualSlot = slide.intent === 'cover' ? 'cover_bg' : 'side_illustration';
  return {
    slot,
    purpose: purposeForIntent(slide.intent),
    label: `B1 image brief (${slide.intent})`,
    styleHint: style,
    palette: paletteHex ? { primary: paletteHex } : undefined,
    aspect: slide.intent === 'cover' ? '16:9' : '4:3',
    prompt: brief,
  };
}

/**
 * Tier-aware deck visual planner.
 *
 * STANDARD (flag OFF / opt-out / any error) → identical to `planDeckVisuals`.
 * PREMIUM → deterministic plan, then augmented with the B1 Layout Director's
 * single-palette + per-slide image briefs.
 *
 * @param params same shape as {@link planDeckVisuals} plus optional tier hints.
 * @returns the augmented slides AND the resolved deck palette hex (so the
 *          caller can adopt B1's coherent palette downstream if it wishes).
 *          NEVER throws.
 */
export async function planDeckVisualsTiered(params: {
  slides: UnifiedSlide[];
  meta: UnifiedReportMeta;
  deckTitle: string;
  audience: string;
  goal: string;
  brandColor?: string;
  settings: VisualSettings;
  orgId?: string;
  preferPremium?: boolean;
}): Promise<{ slides: UnifiedSlide[]; deckPaletteHex?: string; tierUsed: 'PREMIUM' | 'STANDARD' }> {
  const { slides, meta, deckTitle, audience, goal, brandColor, settings, orgId, preferPremium } =
    params;

  // 1) Deterministic plan — ALWAYS computed; the always-safe baseline.
  const deterministic = planDeckVisuals({
    slides,
    meta,
    deckTitle,
    audience,
    goal,
    brandColor,
    settings,
  });

  // 2) Tier gate — fail-open to STANDARD on any resolution hiccup.
  let premium = false;
  try {
    const { resolveDeliverableTier } = await import('./deliverableGenerationTier.js');
    premium = resolveDeliverableTier({ orgId, preferPremium }) === 'PREMIUM';
  } catch {
    premium = false;
  }

  if (!premium) {
    // Flag OFF → byte-identical to today's behaviour, no LLM call.
    return { slides: deterministic, tierUsed: 'STANDARD' };
  }

  // 3) PREMIUM — call B1, map its plan, fail-open to deterministic on ANY error.
  try {
    const { planDeckLayout } = await import('./presentationLayoutDirectorService.js');
    const result = await planDeckLayout(slides, meta, {
      orgId: orgId ?? '',
      preferPremium,
    });
    const plans = result?.plans ?? [];

    // Deck-wide palette (B1 enforces ONE palette across plans).
    const paletteId = plans.find((p) => p?.paletteId)?.paletteId;
    const paletteHex = paletteId ? B1_PALETTE_PRIMARY_HEX[paletteId] : undefined;
    const style = baseStyle(meta);

    const augmented = deterministic.map((s, i) => {
      const plan = plans[i];
      const existing = [...(s.visuals || [])];

      // (a) Adopt B1's single deck palette on every planned visual.
      const repaletted = paletteHex
        ? existing.map((v) => ({ ...v, palette: { ...(v.palette || {}), primary: paletteHex } }))
        : existing;

      // (b) Add the per-slide image brief as an extra visual when present and
      //     not already covered by a same-slot deterministic visual.
      const next = [...repaletted];
      if (plan?.imageBrief && plan.source === 'llm') {
        const briefVisual = imageBriefVisual(s, plan.imageBrief, paletteHex, style);
        const alreadyHasSlot = next.some((v) => v.slot === briefVisual.slot);
        if (!alreadyHasSlot) next.push(briefVisual);
      }

      // (c) Carry B1's layout recommendation as a NON-destructive debug label.
      //     `slide.intent` is deliberately left untouched (renderer coherence).
      const out: UnifiedSlide =
        next.length || repaletted.length ? { ...s, visuals: next } : { ...s };
      if (plan?.layoutIntent) {
        (out as any)._b1LayoutIntent = plan.layoutIntent;
      }
      // (d) STEP 1b — carry B1's per-slide COMPOSITION onto the persisted slide
      //     so it survives into `unifiedJson` and reaches the FE renderer
      //     (deckFromUnifiedJson → DeckCard.composition). Only when the LLM
      //     actually composed this slide; absent/deterministic → field omitted
      //     → FE keeps its heuristic (byte-identical back-compat).
      if (plan?.composition && plan.source === 'llm') {
        out.composition = plan.composition;
      }
      return out;
    });

    return {
      slides: augmented,
      deckPaletteHex: paletteHex || (brandColor ? brandColor.replace('#', '') : undefined),
      tierUsed: 'PREMIUM',
    };
  } catch {
    // FAIL-OPEN — premium augmentation failed → deterministic output unchanged.
    return { slides: deterministic, tierUsed: 'STANDARD' };
  }
}
