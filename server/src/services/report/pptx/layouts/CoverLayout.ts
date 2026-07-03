/**
 * Layout: Cover
 * Premium editorial opening — full-bleed brand color, left accent spine,
 * uppercase eyebrow/kicker, large action title, accent rule, subtitle, and
 * a meta baseline (organization · date) with a Consultify wordmark.
 *
 * Design intent (beat-Gamma, W7.1): left-aligned asymmetric composition with
 * a strong type hierarchy instead of a flat centered stack. Renders identically
 * across MS PowerPoint / Google Slides (pure geometry + color, no exotic fonts).
 */
import { BodyText } from '../atomics/BodyText.js';
import { ConfidentialityBanner } from '../atomics/ConfidentialityBanner.js';
import { Divider } from '../atomics/Divider.js';
import { Image } from '../atomics/Image.js';
import type {
  CoverContent,
  DesignTokens,
  LayoutResult,
  RenderedElement,
  UnifiedReportMeta,
  UnifiedSlide,
} from '../types.js';

/** Small colored rectangle (no atomic for a filled rect with custom color, so inline). */
function accentRect(
  pos: { x: number; y: number; w: number; h: number },
  color: string
): RenderedElement {
  return {
    kind: 'shape',
    apply(slide) {
      slide.addShape('rect', {
        x: pos.x,
        y: pos.y,
        w: pos.w,
        h: pos.h,
        fill: { color },
        line: { color, width: 0 },
      });
    },
  };
}

export function CoverLayout(
  slide: UnifiedSlide,
  meta: UnifiedReportMeta,
  tokens: DesignTokens
): LayoutResult {
  const c = slide.content as CoverContent;
  const elements: RenderedElement[] = [];
  const isPolish = meta.language === 'pl';
  const inverse = tokens.colors.textInverse;
  const accent = tokens.colors.accent;

  // Optional Gamma-like hero/background visual (render first, so text sits on top)
  const visual = (slide.visuals || []).find(
    (v) => v && (v.slot === 'cover_bg' || v.slot === 'hero' || v.purpose === 'image_cover')
  );
  const asset = visual?.asset;
  const hasHero = !!(asset?.path || asset?.dataUri);
  if (hasHero) {
    elements.push(
      Image(
        {
          position: { x: 0, y: 0, w: tokens.grid.slideW, h: tokens.grid.slideH },
          path: asset?.path,
          data: asset?.dataUri,
          fit: 'cover',
          transparency: 10, // keep cover text readable
        },
        tokens
      )
    );
  }

  // Left accent spine — a premium vertical bar anchoring the composition.
  elements.push(accentRect({ x: 0, y: 0, w: 0.16, h: tokens.grid.slideH }, accent));

  const LEFT = 0.85;
  const TEXT_W = 8.3;

  // Eyebrow / kicker — uppercase, letter-spaced, accent color.
  const rawKicker = (meta.framework || meta.sourceType || '').trim();
  const kicker = (
    rawKicker || (isPolish ? 'Prezentacja strategiczna' : 'Strategic briefing')
  ).toUpperCase();
  elements.push(
    BodyText(
      {
        text: kicker,
        position: { x: LEFT, y: 1.5, w: TEXT_W, h: 0.32 },
        fontSize: 12,
        bold: true,
        color: accent,
        charSpacing: 2,
        fontFace: tokens.fonts.body,
        align: 'left',
        valign: 'middle',
      },
      tokens
    )
  );

  // Title — large, bold, title font, left-aligned.
  elements.push(
    BodyText(
      {
        text: c.title,
        position: { x: LEFT, y: 1.92, w: TEXT_W, h: 1.5 },
        fontSize: 40,
        bold: true,
        color: inverse,
        fontFace: tokens.fonts.title,
        align: 'left',
        valign: 'top',
        lineSpacingMultiple: 0.95,
      },
      tokens
    )
  );

  // Accent rule under the title.
  elements.push(
    Divider({ position: { x: LEFT + 0.02, y: 3.5, w: 1.7, h: 0 }, color: accent, thickness: 3 }, tokens)
  );

  // Subtitle.
  if (c.subtitle) {
    elements.push(
      BodyText(
        {
          text: c.subtitle,
          position: { x: LEFT, y: 3.68, w: TEXT_W, h: 0.8 },
          fontSize: 18,
          color: inverse,
          fontFace: tokens.fonts.body,
          align: 'left',
          valign: 'top',
        },
        tokens
      )
    );
  }

  // Meta baseline — organization (emphasised) · date.
  const metaLine = [c.organization, c.date].filter(Boolean).join('   ·   ');
  if (metaLine) {
    elements.push(
      BodyText(
        {
          text: metaLine,
          position: { x: LEFT, y: 4.92, w: 6.0, h: 0.4 },
          fontSize: 13,
          bold: true,
          color: inverse,
          fontFace: tokens.fonts.body,
          align: 'left',
          valign: 'middle',
        },
        tokens
      )
    );
  }

  // Consultify wordmark — bottom-right.
  elements.push(
    BodyText(
      {
        text: 'CONSULTIFY',
        position: { x: 7.0, y: 4.92, w: 2.65, h: 0.4 },
        fontSize: 11,
        bold: true,
        color: inverse,
        charSpacing: 3,
        fontFace: tokens.fonts.body,
        align: 'right',
        valign: 'middle',
      },
      tokens
    )
  );

  // Confidentiality
  if (meta.confidentiality && meta.confidentiality !== 'public') {
    elements.push(ConfidentialityBanner({ level: meta.confidentiality }, tokens));
  }

  return {
    masterName: 'COVER',
    elements,
  };
}
