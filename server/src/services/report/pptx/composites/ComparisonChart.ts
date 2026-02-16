/**
 * Composite: Comparison Chart
 * Side-by-side comparison — A vs B / before vs after.
 * Two columns with header labels and bullet items.
 */
import { BodyText } from '../atomics/BodyText.js';
import { Bullet } from '../atomics/Bullet.js';
import { Divider } from '../atomics/Divider.js';
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
  const headerH = 0.4;
  const elements: RenderedElement[] = [];

  // Left column header
  elements.push({
    kind: 'shape',
    apply(slide) {
      slide.addShape('roundRect', {
        x: p.x,
        y: p.y,
        w: colW,
        h: headerH,
        fill: { color: tokens.colors.primary },
        rectRadius: 0.04,
      });
    },
  });
  elements.push(
    BodyText(
      {
        text: props.leftLabel,
        position: { x: p.x, y: p.y, w: colW, h: headerH },
        bold: true,
        color: tokens.colors.textInverse,
        align: 'center',
        valign: 'middle',
      },
      tokens
    )
  );

  // Right column header
  elements.push({
    kind: 'shape',
    apply(slide) {
      slide.addShape('roundRect', {
        x: p.x + colW + tokens.spacing.gutter,
        y: p.y,
        w: colW,
        h: headerH,
        fill: { color: tokens.colors.secondary },
        rectRadius: 0.04,
      });
    },
  });
  elements.push(
    BodyText(
      {
        text: props.rightLabel,
        position: { x: p.x + colW + tokens.spacing.gutter, y: p.y, w: colW, h: headerH },
        bold: true,
        color: tokens.colors.textInverse,
        align: 'center',
        valign: 'middle',
      },
      tokens
    )
  );

  // Left bullets
  const bulletY = p.y + headerH + 0.15;
  const bulletH = p.h - headerH - 0.5;
  elements.push(
    Bullet(
      {
        items: props.leftItems.slice(0, 5),
        position: { x: p.x, y: bulletY, w: colW, h: bulletH },
      },
      tokens
    )
  );

  // Right bullets
  elements.push(
    Bullet(
      {
        items: props.rightItems.slice(0, 5),
        position: { x: p.x + colW + tokens.spacing.gutter, y: bulletY, w: colW, h: bulletH },
      },
      tokens
    )
  );

  // Verdict
  if (props.verdict) {
    elements.push(
      Divider(
        {
          position: { x: p.x, y: p.y + p.h - 0.35, w: p.w, h: 0 },
        },
        tokens
      )
    );
    elements.push(
      BodyText(
        {
          text: props.verdict,
          position: { x: p.x, y: p.y + p.h - 0.3, w: p.w, h: 0.3 },
          bold: true,
          color: tokens.colors.primary,
          align: 'center',
        },
        tokens
      )
    );
  }

  return elements;
}
