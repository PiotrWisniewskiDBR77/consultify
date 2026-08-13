/**
 * Composite: Risk Table
 * Structured risk register: risk, likelihood, impact, mitigation.
 */
import { likelihoodImpactColor } from '../designTokens.js';
import type { DesignTokens, ElementPosition, RenderedElement } from '../types.js';

export interface RiskTableProps {
  risks: Array<{
    risk: string;
    likelihood: string;
    impact: string;
    mitigation: string;
    owner?: string;
  }>;
  position: ElementPosition;
}

export function RiskTable(props: RiskTableProps, tokens: DesignTokens): RenderedElement[] {
  const { position: p } = props;
  const elements: RenderedElement[] = [];
  const hasOwner = props.risks.some((r) => r.owner);

  const headerCells = [
    {
      text: 'Risk',
      options: {
        bold: true,
        fill: { color: tokens.colors.primary },
        color: 'FFFFFF',
        fontSize: 10,
        fontFace: tokens.fonts.body,
      },
    },
    {
      text: 'Likelihood',
      options: {
        bold: true,
        fill: { color: tokens.colors.primary },
        color: 'FFFFFF',
        fontSize: 10,
        fontFace: tokens.fonts.body,
        align: 'center' as const,
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
        align: 'center' as const,
      },
    },
    {
      text: 'Mitigation',
      options: {
        bold: true,
        fill: { color: tokens.colors.primary },
        color: 'FFFFFF',
        fontSize: 10,
        fontFace: tokens.fonts.body,
      },
    },
  ];
  if (hasOwner) {
    headerCells.push({
      text: 'Owner',
      options: {
        bold: true,
        fill: { color: tokens.colors.primary },
        color: 'FFFFFF',
        fontSize: 10,
        fontFace: tokens.fonts.body,
        align: 'center' as const,
      },
    });
  }

  const dataRows = props.risks.map((r) => {
    const lColor = likelihoodImpactColor(r.likelihood, tokens);
    const iColor = likelihoodImpactColor(r.impact, tokens);
    const row: any[] = [
      {
        text: r.risk,
        options: { fontSize: 10, fontFace: tokens.fonts.body, color: tokens.colors.textPrimary },
      },
      {
        text: r.likelihood.toUpperCase(),
        options: {
          fontSize: 9,
          fontFace: tokens.fonts.body,
          color: 'FFFFFF',
          bold: true,
          fill: { color: lColor },
          align: 'center' as const,
        },
      },
      {
        text: r.impact.toUpperCase(),
        options: {
          fontSize: 9,
          fontFace: tokens.fonts.body,
          color: 'FFFFFF',
          bold: true,
          fill: { color: iColor },
          align: 'center' as const,
        },
      },
      {
        text: r.mitigation,
        options: { fontSize: 10, fontFace: tokens.fonts.body, color: tokens.colors.textPrimary },
      },
    ];
    if (hasOwner) {
      row.push({
        text: r.owner ?? '',
        options: {
          fontSize: 10,
          fontFace: tokens.fonts.body,
          color: tokens.colors.textSecondary,
          align: 'center' as const,
        },
      });
    }
    return row;
  });

  const colWidths = hasOwner
    ? [p.w * 0.25, p.w * 0.12, p.w * 0.12, p.w * 0.35, p.w * 0.16]
    : [p.w * 0.28, p.w * 0.14, p.w * 0.14, p.w * 0.44];

  // ── Anti-sparseness (W7): grow rows so the table fills the usable region ──
  // Header counts as one row. Stretch each row toward p.h, but cap so a 2-risk
  // table doesn't become absurdly tall.
  const totalRows = dataRows.length + 1; // +1 header
  const naturalRowH = 0.4;
  const fittedRowH = Math.min(1.0, Math.max(naturalRowH, p.h / totalRows));

  elements.push({
    kind: 'table',
    apply(slide) {
      slide.addTable([headerCells, ...dataRows], {
        x: p.x,
        y: p.y,
        w: p.w,
        colW: colWidths,
        border: { pt: 0.5, color: tokens.colors.border },
        fontFace: tokens.fonts.body,
        rowH: fittedRowH,
        valign: 'middle',
        autoPage: false,
      });
    },
  });

  return elements;
}
