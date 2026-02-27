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

  // Cost mode => only cover (everything else is "none")
  if (priority === 'cost' && slide.intent !== 'cover') return [];

  // Low density => only cover visuals
  if (density === 'low' && slide.intent !== 'cover') return [];

  const visuals: SlideVisualSpec[] = [];

  // COVER
  if (slide.intent === 'cover') {
    visuals.push({
      slot: 'cover_bg',
      purpose: 'image_cover',
      label: 'Planned cover hero',
      styleHint: style,
      palette: brandColor ? { primary: brandColor.replace('#', '') } : undefined,
      aspect: '16:9',
      prompt: [
        `${style}.`,
        `A premium 16:9 hero cover image for a consulting PowerPoint deck.`,
        `Topic: "${deckTitle}".`,
        `Audience: ${audience}. Goal: ${goal}.`,
        brandColor ? `Color palette anchored on #${brandColor.replace('#', '')}.` : '',
        `Feel: confident, sharp, business, high-end.`,
        noText,
        `No logos, no watermarks.`,
      ]
        .filter(Boolean)
        .join(' '),
    });
    return visuals;
  }

  // SECTION INTRO + KEY MESSAGES => subtle texture background in quality mode
  if (
    priority === 'quality' &&
    (slide.intent === 'section_intro' || slide.intent === 'key_messages')
  ) {
    visuals.push({
      slot: 'background_texture',
      purpose: purposeForIntent(slide.intent),
      label: `Planned background texture (${slide.intent})`,
      styleHint:
        meta.template === 'minimal'
          ? 'minimal, clean, subtle paper grain texture, soft gradients'
          : meta.template === 'modern'
            ? 'modern, vibrant, abstract soft shapes, premium SaaS background'
            : 'corporate, understated, subtle geometric texture, BCG-grade background',
      palette: brandColor ? { primary: brandColor.replace('#', '') } : undefined,
      aspect: '16:9',
      prompt: [
        `${style}.`,
        `A subtle 16:9 background image for a consulting PowerPoint slide.`,
        `Deck topic: "${deckTitle}".`,
        `Slide intent: ${slide.intent}.`,
        brandColor ? `Color palette anchored on #${brandColor.replace('#', '')}.` : '',
        `Very low visual noise, high readability for overlay text and cards.`,
        `No logos, no watermarks.`,
        noText,
      ]
        .filter(Boolean)
        .join(' '),
    });
  }

  // EXEC SUMMARY => add a side illustration only on HIGH density (premium feel)
  if (priority === 'quality' && density === 'high' && slide.intent === 'executive_summary') {
    const headline = (slide.content as any)?.headline;
    visuals.push({
      slot: 'side_illustration',
      purpose: 'image_slide_asset',
      label: 'Planned side illustration (exec summary)',
      styleHint: `${style}, subtle editorial illustration`,
      palette: brandColor ? { primary: brandColor.replace('#', '') } : undefined,
      aspect: '16:9',
      prompt: [
        `${style}.`,
        `A subtle right-side illustration for an executive summary slide in a consulting PowerPoint deck.`,
        `Deck topic: "${deckTitle}".`,
        headline ? `Executive summary headline: "${headline}".` : '',
        brandColor ? `Color palette anchored on #${brandColor.replace('#', '')}.` : '',
        `Keep it understated and slide-friendly (low noise).`,
        noText,
        `No logos, no watermarks.`,
      ]
        .filter(Boolean)
        .join(' '),
    });
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
