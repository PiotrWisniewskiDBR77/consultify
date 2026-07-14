/**
 * Atomic: Bullet List
 * Renders a list of items as bullet points (max 5 per spec).
 */
import type { DesignTokens, ElementPosition, RenderedElement } from '../types.js';

export interface BulletProps {
  items: string[];
  position: ElementPosition;
  color?: string;
  fontSize?: number;
  bulletColor?: string;
}

/**
 * Anti-sparseness (proof 2026-07-14, item L2): a short list (2-4 items) in a
 * TALL box (full-height comparison/roadmap card) used the fixed 8pt
 * `paragraphGap` and stacked tight at the top, leaving the bottom ~30-40% of
 * the card empty. Estimate the natural stacked height (rough per-item line
 * count from char-count ÷ estimated chars-per-line) and, if the box has
 * slack, spread the SAME items across it by growing the inter-item gap —
 * never the font — so short lists breathe without touching the top-anchor
 * contract that keeps header-adjacent lists tight (the disconnected-roadmap
 * bug this atomic already guards against).
 */
function estimateFillGap(
  items: string[],
  fontSize: number,
  boxWidthIn: number,
  boxHeightIn: number,
  baseGapPt: number
): number {
  if (items.length <= 1) return baseGapPt;
  const usableWidthPt = Math.max(20, boxWidthIn * 72 - 22); // minus bullet indent
  const avgCharWidthPt = fontSize * 0.52; // calibrated for a sans body face
  const charsPerLine = Math.max(8, Math.floor(usableWidthPt / avgCharWidthPt));
  const lineHeightPt = fontSize * 1.22;
  const totalLines = items.reduce(
    (sum, item) => sum + Math.max(1, Math.ceil(item.length / charsPerLine)),
    0
  );
  const naturalStackPt = totalLines * lineHeightPt + (items.length - 1) * baseGapPt;
  const availablePt = boxHeightIn * 72;
  const slackPt = availablePt - naturalStackPt;
  if (slackPt <= 0) return baseGapPt;
  // Damp to 75% of the measured slack — the char-width estimate is rough, and
  // under-filling by a little reads better than a stray overflow.
  const extraPerGap = (slackPt * 0.75) / (items.length - 1);
  return Math.min(baseGapPt + extraPerGap, baseGapPt + 54);
}

export function Bullet(props: BulletProps, tokens: DesignTokens): RenderedElement {
  return {
    kind: 'text',
    apply(slide) {
      const fontSize = props.fontSize ?? tokens.fontSizes.body;
      const gapPt = estimateFillGap(
        props.items,
        fontSize,
        props.position.w,
        props.position.h,
        tokens.spacing.paragraphGap
      );
      const textRows = props.items.map((item) => ({
        text: item,
        options: {
          fontSize,
          fontFace: tokens.fonts.body,
          color: props.color ?? tokens.colors.textPrimary,
          bullet: { type: 'bullet' as const, color: props.bulletColor ?? tokens.colors.primary },
          paraSpaceAfter: gapPt,
        },
      }));

      slide.addText(textRows, {
        x: props.position.x,
        y: props.position.y,
        w: props.position.w,
        h: props.position.h,
        // Lists read top-down: anchor to the top of the box. Without this
        // pptxgenjs centres the rows vertically, leaving a large gap between a
        // header and a short list (the disconnected-roadmap bug).
        valign: 'top',
      });
    },
  };
}
