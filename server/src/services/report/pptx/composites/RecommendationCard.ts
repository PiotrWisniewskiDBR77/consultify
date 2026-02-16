/**
 * Composite: Recommendation Card
 * Single actionable recommendation with impact, effort, priority.
 */
import { Badge } from '../atomics/Badge.js';
import { BodyText } from '../atomics/BodyText.js';
import { Highlight } from '../atomics/Highlight.js';
import { severityColor } from '../designTokens.js';
import type { DesignTokens, ElementPosition, RenderedElement } from '../types.js';

export interface RecommendationCardProps {
  title: string;
  description: string;
  impact: string;
  effort: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  timeline?: string;
  position: ElementPosition;
}

export function RecommendationCard(
  props: RecommendationCardProps,
  tokens: DesignTokens
): RenderedElement[] {
  const { position: p } = props;
  const elements: RenderedElement[] = [];
  const prioColor = severityColor(props.priority, tokens);

  // Card background
  elements.push({
    kind: 'shape',
    apply(slide) {
      slide.addShape('roundRect', {
        x: p.x,
        y: p.y,
        w: p.w,
        h: p.h,
        fill: { color: tokens.colors.surface },
        line: { color: tokens.colors.border, width: 0.5 },
        rectRadius: 0.06,
      });
      // Priority accent bar (left)
      slide.addShape('rect', {
        x: p.x,
        y: p.y,
        w: 0.06,
        h: p.h,
        fill: { color: prioColor },
      });
    },
  });

  // Priority badge
  elements.push(
    Badge(
      {
        text: props.priority,
        position: { x: p.x + p.w - 1.0, y: p.y + 0.1, w: 0.85, h: 0.22 },
        bgColor: prioColor,
      },
      tokens
    )
  );

  // Title
  elements.push(
    BodyText(
      {
        text: props.title,
        position: { x: p.x + 0.2, y: p.y + 0.1, w: p.w - 1.3, h: 0.3 },
        bold: true,
        fontSize: tokens.fontSizes.subheading,
      },
      tokens
    )
  );

  // Description
  elements.push(
    BodyText(
      {
        text: props.description,
        position: { x: p.x + 0.2, y: p.y + 0.45, w: p.w - 0.4, h: p.h * 0.3 },
        color: tokens.colors.textSecondary,
      },
      tokens
    )
  );

  // Impact + Effort row
  const metaY = p.y + p.h - 0.5;
  elements.push(
    Highlight(
      {
        text: `Impact: ${props.impact}`,
        position: { x: p.x + 0.2, y: metaY, w: (p.w - 0.6) / 2, h: 0.3 },
        bgColor: tokens.colors.primary,
      },
      tokens
    )
  );
  elements.push(
    Highlight(
      {
        text: `Effort: ${props.effort}`,
        position: { x: p.x + 0.2 + (p.w - 0.6) / 2 + 0.1, y: metaY, w: (p.w - 0.6) / 2, h: 0.3 },
        bgColor: tokens.colors.secondary,
      },
      tokens
    )
  );

  return elements;
}
