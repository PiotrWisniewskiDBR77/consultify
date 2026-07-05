/**
 * Composite: Recommendation Stack
 * Portfolio of recommendations as a structured table.
 * Used when count >= 3 (per Rules Engine decision rules).
 */
import { severityColor } from '../designTokens.js';
import type { DesignTokens, ElementPosition, RenderedElement } from '../types.js';

export interface RecommendationStackProps {
  recommendations: Array<{
    title: string;
    description: string;
    impact: string;
    priority: 'critical' | 'high' | 'medium' | 'low';
    category?: string;
  }>;
  position: ElementPosition;
}

export function RecommendationStack(
  props: RecommendationStackProps,
  tokens: DesignTokens
): RenderedElement[] {
  const { position: p } = props;
  const elements: RenderedElement[] = [];

  const headerRow = [
    {
      text: '#',
      options: {
        bold: true,
        fill: { color: tokens.colors.primary },
        color: 'FFFFFF',
        fontSize: 9,
        fontFace: tokens.fonts.body,
        align: 'center' as const,
      },
    },
    {
      text: 'Recommendation',
      options: {
        bold: true,
        fill: { color: tokens.colors.primary },
        color: 'FFFFFF',
        fontSize: 10,
        fontFace: tokens.fonts.body,
      },
    },
    {
      text: 'Impact',
      options: {
        bold: true,
        fill: { color: tokens.colors.primary },
        color: 'FFFFFF',
        fontSize: 10,
        fontFace: tokens.fonts.body,
      },
    },
    {
      text: 'Priority',
      options: {
        bold: true,
        fill: { color: tokens.colors.primary },
        color: 'FFFFFF',
        fontSize: 10,
        fontFace: tokens.fonts.body,
        align: 'center' as const,
      },
    },
  ];

  const dataRows = props.recommendations.map((rec, i) => {
    const prioColor = severityColor(rec.priority, tokens);
    return [
      {
        text: String(i + 1),
        options: {
          fontSize: 9,
          fontFace: tokens.fonts.body,
          color: tokens.colors.textSecondary,
          align: 'center' as const,
        },
      },
      {
        text: `${rec.title}\n${rec.description}`,
        options: { fontSize: 10, fontFace: tokens.fonts.body, color: tokens.colors.textPrimary },
      },
      {
        text: rec.impact,
        options: { fontSize: 10, fontFace: tokens.fonts.body, color: tokens.colors.textPrimary },
      },
      {
        text: rec.priority.toUpperCase(),
        options: {
          fontSize: 9,
          fontFace: tokens.fonts.body,
          color: 'FFFFFF',
          bold: true,
          fill: { color: prioColor },
          align: 'center' as const,
        },
      },
    ];
  });

  // Anti-sparseness: grow row height so the portfolio table fills the region
  // (p.h) instead of sitting in the top with an empty bottom. Cap so a 3-row
  // table doesn't become absurdly tall.
  const rowCount = 1 + dataRows.length; // header + data rows
  const rowH = Math.max(0.45, Math.min(0.9, p.h / rowCount));

  elements.push({
    kind: 'table',
    apply(slide) {
      slide.addTable([headerRow, ...dataRows], {
        x: p.x,
        y: p.y,
        w: p.w,
        colW: [p.w * 0.07, p.w * 0.48, p.w * 0.25, p.w * 0.2],
        border: { pt: 0.5, color: tokens.colors.border },
        fontFace: tokens.fonts.body,
        rowH,
        valign: 'middle',
        autoPage: false,
      });
    },
  });

  return elements;
}
