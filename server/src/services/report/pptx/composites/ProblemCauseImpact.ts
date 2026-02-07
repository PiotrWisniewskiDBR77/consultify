/**
 * Composite: Problem–Cause–Impact
 * Root cause analysis visualization — structured diagnosis.
 * Problem statement at top, then cause-impact pairs as rows.
 */
import type { DesignTokens, RenderedElement, ElementPosition } from '../types.js';
import { BodyText } from '../atomics/BodyText.js';
import { severityColor } from '../designTokens.js';

export interface ProblemCauseImpactProps {
  problem: string;
  causes: Array<{
    cause: string;
    impact: string;
    severity: 'high' | 'medium' | 'low';
  }>;
  position: ElementPosition;
}

export function ProblemCauseImpact(
  props: ProblemCauseImpactProps,
  tokens: DesignTokens
): RenderedElement[] {
  const { position: p } = props;
  const elements: RenderedElement[] = [];

  // Problem statement box
  elements.push({
    kind: 'shape',
    apply(slide) {
      slide.addShape('roundRect', {
        x: p.x,
        y: p.y,
        w: p.w,
        h: 0.5,
        fill: { color: tokens.colors.danger },
        rectRadius: 0.05,
      });
    },
  });
  elements.push(
    BodyText({
      text: `Problem: ${props.problem}`,
      position: { x: p.x + 0.15, y: p.y, w: p.w - 0.3, h: 0.5 },
      bold: true,
      color: tokens.colors.textInverse,
      valign: 'middle',
    }, tokens)
  );

  // Table: Cause | Impact | Severity
  const headerRow = [
    { text: 'Cause', options: { bold: true, fill: { color: tokens.colors.primary }, color: 'FFFFFF', fontSize: 10, fontFace: tokens.fonts.body } },
    { text: 'Impact', options: { bold: true, fill: { color: tokens.colors.primary }, color: 'FFFFFF', fontSize: 10, fontFace: tokens.fonts.body } },
    { text: 'Severity', options: { bold: true, fill: { color: tokens.colors.primary }, color: 'FFFFFF', fontSize: 10, fontFace: tokens.fonts.body, align: 'center' as const } },
  ];

  const dataRows = props.causes.map((c) => {
    const sevColor = severityColor(c.severity, tokens);
    return [
      { text: c.cause, options: { fontSize: 10, fontFace: tokens.fonts.body, color: tokens.colors.textPrimary } },
      { text: c.impact, options: { fontSize: 10, fontFace: tokens.fonts.body, color: tokens.colors.textPrimary } },
      { text: c.severity.toUpperCase(), options: { fontSize: 9, fontFace: tokens.fonts.body, color: 'FFFFFF', bold: true, fill: { color: sevColor }, align: 'center' as const } },
    ];
  });

  elements.push({
    kind: 'table',
    apply(slide) {
      slide.addTable([headerRow, ...dataRows], {
        x: p.x,
        y: p.y + 0.65,
        w: p.w,
        colW: [p.w * 0.4, p.w * 0.4, p.w * 0.2],
        border: { pt: 0.5, color: tokens.colors.border },
        fontFace: tokens.fonts.body,
        rowH: 0.35,
      });
    },
  });

  return elements;
}
