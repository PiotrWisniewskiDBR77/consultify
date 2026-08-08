/**
 * Composite: Comparison Chart
 * Side-by-side comparison — A vs B / before vs after.
 *
 * W7 anti-sparseness:
 *  - The two columns are framed as full-height surface cards so the bullet lists
 *    visually fill the region instead of floating under the headers.
 *  - The verdict is rendered as a filled bar anchored at the bottom of the region
 *    (a confident closing element low on the slide), not a thin centred line.
 */
import { BodyText } from '../atomics/BodyText.js';
import type { DesignTokens, ElementPosition, RenderedElement } from '../types.js';

export interface ComparisonChartProps {
  leftLabel: string;
  rightLabel: string;
  leftItems: string[];
  rightItems: string[];
  verdict?: string;
  position: ElementPosition;
}

export function ComparisonChart(
  props: ComparisonChartProps,
  tokens: DesignTokens
): RenderedElement[] {
  const { position: p } = props;
  const colW = (p.w - tokens.spacing.gutter) / 2;
  const headerH = 0.42;
  const elements: RenderedElement[] = [];

  const hasVerdict = !!props.verdict;
  const verdictH = 0.5;
  const verdictGap = 0.18;
  // Columns occupy the full region minus the verdict bar (if any) at the bottom.
  const colBottomReserve = hasVerdict ? verdictH + verdictGap : 0;
  const colH = p.h - colBottomReserve;

  const rightX = p.x + colW + tokens.spacing.gutter;
  const columns: Array<{ x: number; label: string; items: string[]; color: string }> = [
    { x: p.x, label: props.leftLabel, items: props.leftItems, color: tokens.colors.primary },
    {
      x: rightX,
      label: props.rightLabel,
      items: props.rightItems,
      color: tokens.colors.secondary,
    },
  ];

  for (const col of columns) {
    // Full-height column card so the body reads as filled.
    elements.push({
      kind: 'shape',
      apply(slide) {
        slide.addShape('roundRect', {
          x: col.x,
          y: p.y,
          w: colW,
          h: colH,
          fill: { color: tokens.colors.surface },
          line: { color: tokens.colors.border, width: 1 },
          rectRadius: 0.05,
        });
      },
    });

    // Column header.
    elements.push({
      kind: 'shape',
      apply(slide) {
        slide.addShape('roundRect', {
          x: col.x,
          y: p.y,
          w: colW,
          h: headerH,
          fill: { color: col.color },
          line: { color: col.color, width: 0 },
          rectRadius: 0.05,
        });
      },
    });
    elements.push(
      BodyText(
        {
          text: col.label,
          position: { x: col.x + 0.1, y: p.y, w: colW - 0.2, h: headerH },
          bold: true,
          color: tokens.colors.textInverse,
          align: 'center',
          valign: 'middle',
          fontFace: tokens.fonts.title,
        },
        tokens
      )
    );

    // Comparison values are rendered as independent rows. A rich-text bullet
    // box can apply a negative hanging indent that crosses the centre gutter
    // (especially for the right column), causing visually overlapping text
    // even though every shape remains inside the slide canvas.
    const bulletY = p.y + headerH + 0.18;
    const bulletH = colH - headerH - 0.36;
    const items = col.items.slice(0, 6);
    const rowH = Math.max(0.32, bulletH / Math.max(1, items.length));
    items.forEach((item, index) => {
      elements.push(
        BodyText(
          {
            text: item,
            position: {
              x: col.x + 0.3,
              y: bulletY + index * rowH,
              w: colW - 0.6,
              h: rowH,
            },
            valign: 'middle',
          },
          tokens
        )
      );
    });
  }

  // Verdict — filled bar anchored at the bottom of the region.
  if (hasVerdict) {
    const verdictY = p.y + p.h - verdictH;
    elements.push({
      kind: 'shape',
      apply(slide) {
        slide.addShape('roundRect', {
          x: p.x,
          y: verdictY,
          w: p.w,
          h: verdictH,
          fill: { color: tokens.colors.primary },
          line: { color: tokens.colors.primary, width: 0 },
          rectRadius: 0.05,
        });
      },
    });
    elements.push(
      BodyText(
        {
          text: props.verdict!,
          position: { x: p.x + 0.3, y: verdictY, w: p.w - 0.6, h: verdictH },
          bold: true,
          color: tokens.colors.textInverse,
          align: 'center',
          valign: 'middle',
          fontSize: tokens.fontSizes.body,
        },
        tokens
      )
    );
  }

  return elements;
}
