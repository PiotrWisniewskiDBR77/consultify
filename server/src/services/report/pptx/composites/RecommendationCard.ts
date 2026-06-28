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

  // Anti-sparseness: let the description fill the body of the card so a tall
  // single-recommendation card doesn't leave a void between title and the
  // metric row pinned to the bottom.
  const padX = 0.2;
  const titleY = p.y + 0.18;
  const titleH = 0.4;
  const metricH = 0.46; // larger impact/effort/timeline pills
  const metricY = p.y + p.h - metricH - 0.2;
  const descY = titleY + titleH + 0.12;
  const descH = Math.max(0.4, metricY - descY - 0.15);

  // Title
  elements.push(
    BodyText(
      {
        text: props.title,
        position: { x: p.x + padX, y: titleY, w: p.w - 1.3, h: titleH },
        bold: true,
        fontSize: tokens.fontSizes.subheading,
      },
      tokens
    )
  );

  // Description — fills the body region between title and the metric row.
  elements.push(
    BodyText(
      {
        text: props.description,
        position: { x: p.x + padX, y: descY, w: p.w - padX * 2, h: descH },
        color: tokens.colors.textSecondary,
      },
      tokens
    )
  );

  // Metric row: Impact + Effort (+ Timeline when present), pinned to the bottom.
  const hasTimeline = !!props.timeline;
  const cols = hasTimeline ? 3 : 2;
  const gap = 0.1;
  const innerW = p.w - padX * 2;
  const cellW = (innerW - gap * (cols - 1)) / cols;
  const metrics: Array<{ text: string; bgColor: string }> = [
    { text: `Impact: ${props.impact}`, bgColor: tokens.colors.primary },
    { text: `Effort: ${props.effort}`, bgColor: tokens.colors.secondary },
  ];
  if (hasTimeline) {
    metrics.push({ text: `Timeline: ${props.timeline}`, bgColor: prioColor });
  }
  metrics.forEach((m, i) => {
    elements.push(
      Highlight(
        {
          text: m.text,
          position: { x: p.x + padX + i * (cellW + gap), y: metricY, w: cellW, h: metricH },
          bgColor: m.bgColor,
        },
        tokens
      )
    );
  });

  return elements;
}
