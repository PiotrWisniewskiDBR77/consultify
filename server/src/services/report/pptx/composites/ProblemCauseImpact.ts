/**
 * Composite: Problem–Cause–Impact
 * Root cause analysis visualization — structured diagnosis.
 * Problem statement at top, then cause-impact pairs as rows.
 */
import { BodyText } from '../atomics/BodyText.js';
import { severityColor } from '../designTokens.js';
import type { DesignTokens, ElementPosition, RenderedElement } from '../types.js';

export interface ProblemCauseImpactProps {
  problem: string;
  language?: 'en' | 'pl';
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
  const isPolish = props.language === 'pl';

  // ── Vertical rhythm: problem banner on top, table fills the rest ──
  const problemH = 0.8;
  const gapBelowProblem = 0.25;
  const tableY = p.y + problemH + gapBelowProblem;
  const tableAvailH = p.y + p.h - tableY;
  // Distribute available height across header + data rows so the table fills
  // the region instead of leaving an empty bottom (anti-sparseness).
  const totalRows = props.causes.length + 1; // +1 for header
  const rowH = Math.min(0.9, Math.max(0.35, tableAvailH / Math.max(totalRows, 1)));

  // Problem statement box — editorial, not alarming: light surface panel with a
  // red accent spine + a small uppercase "PROBLEM" label, dark problem text.
  // (Full-bleed red read as an alarm; this is calmer and more consultant-grade.)
  elements.push({
    kind: 'shape',
    apply(slide) {
      slide.addShape('roundRect', {
        x: p.x,
        y: p.y,
        w: p.w,
        h: problemH,
        fill: { color: tokens.colors.surface },
        line: { color: tokens.colors.border, width: 1 },
        rectRadius: 0.05,
      });
      // Red accent spine on the left edge.
      slide.addShape('rect', {
        x: p.x,
        y: p.y + 0.06,
        w: 0.08,
        h: problemH - 0.12,
        fill: { color: tokens.colors.danger },
        line: { color: tokens.colors.danger, width: 0 },
      });
    },
  });
  elements.push(
    BodyText(
      {
        text: props.problem,
        position: { x: p.x + 0.3, y: p.y, w: p.w - 0.5, h: problemH },
        bold: true,
        fontSize: tokens.fontSizes.subheading,
        color: tokens.colors.textPrimary,
        valign: 'middle',
      },
      tokens
    )
  );

  // Table: Cause | Impact | Severity
  const headerRow = [
    {
      text: isPolish ? 'Przyczyna' : 'Cause',
      options: {
        bold: true,
        fill: { color: tokens.colors.primary },
        color: 'FFFFFF',
        fontSize: 10,
        fontFace: tokens.fonts.body,
      },
    },
    {
      text: isPolish ? 'Wpływ' : 'Impact',
      options: {
        bold: true,
        fill: { color: tokens.colors.primary },
        color: 'FFFFFF',
        fontSize: 10,
        fontFace: tokens.fonts.body,
      },
    },
    {
      text: isPolish ? 'Ważność' : 'Severity',
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

  const dataRows = props.causes.map((c) => {
    const sevColor = severityColor(c.severity, tokens);
    return [
      {
        text: c.cause,
        options: { fontSize: 10, fontFace: tokens.fonts.body, color: tokens.colors.textPrimary },
      },
      {
        text: c.impact,
        options: { fontSize: 10, fontFace: tokens.fonts.body, color: tokens.colors.textPrimary },
      },
      {
        text: isPolish
          ? ({ high: 'WYSOKA', medium: 'ŚREDNIA', low: 'NISKA' } as const)[c.severity]
          : c.severity.toUpperCase(),
        options: {
          fontSize: 9,
          fontFace: tokens.fonts.body,
          color: 'FFFFFF',
          bold: true,
          fill: { color: sevColor },
          align: 'center' as const,
        },
      },
    ];
  });

  elements.push({
    kind: 'table',
    apply(slide) {
      slide.addTable([headerRow, ...dataRows], {
        x: p.x,
        y: tableY,
        w: p.w,
        colW: [p.w * 0.4, p.w * 0.4, p.w * 0.2],
        border: { pt: 0.5, color: tokens.colors.border },
        fontFace: tokens.fonts.body,
        rowH,
        valign: 'middle',
      });
    },
  });

  return elements;
}
