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
