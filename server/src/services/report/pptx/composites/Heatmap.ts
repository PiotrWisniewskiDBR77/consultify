/**
 * Composite: Heatmap / Maturity Matrix
 * Grid-based assessment visualization with color-coded cells.
 * Shows axes with scores — color intensity indicates maturity level.
 */
import type { AxisScore, DesignTokens, ElementPosition, RenderedElement } from '../types.js';

export interface HeatmapProps {
  axes: AxisScore[];
  scaleMax: number;
  overallScore?: number;
  position: ElementPosition;
}

function scoreToColor(score: number, max: number, tokens: DesignTokens): string {
  const pct = score / max;
  if (pct >= 0.8) return tokens.colors.success;
  if (pct >= 0.6) return '7BC67E'; // light green
  if (pct >= 0.4) return tokens.colors.warning;
  if (pct >= 0.2) return 'F5A623'; // orange
  return tokens.colors.danger;
}

export function Heatmap(props: HeatmapProps, tokens: DesignTokens): RenderedElement[] {
  const { axes, scaleMax, position: p } = props;
  const elements: RenderedElement[] = [];

  // Build table data for pptxgenjs
  const headerRow = [
    {
      text: 'Dimension',
      options: {
        bold: true,
        fill: { color: tokens.colors.primary },
        color: 'FFFFFF',
        fontSize: 10,
        fontFace: tokens.fonts.body,
      },
    },
    {
      text: 'Score',
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
      text: 'Target',
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
      text: 'Gap',
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
      text: 'Level',
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

  const dataRows = axes.map((axis) => {
    const gap = axis.gap ?? (axis.target ? axis.target - axis.score : 0);
    const cellColor = scoreToColor(axis.score, scaleMax, tokens);
    return [
      {
        text: axis.axisName,
        options: { fontSize: 10, fontFace: tokens.fonts.body, color: tokens.colors.textPrimary },
      },
      {
        text: axis.score.toFixed(1),
        options: {
          fontSize: 10,
          fontFace: tokens.fonts.body,
          color: tokens.colors.textPrimary,
          align: 'center' as const,
        },
      },
      {
        text: (axis.target ?? scaleMax).toFixed(1),
        options: {
          fontSize: 10,
          fontFace: tokens.fonts.body,
          color: tokens.colors.textSecondary,
          align: 'center' as const,
        },
      },
      {
        text: gap.toFixed(1),
        options: {
          fontSize: 10,
          fontFace: tokens.fonts.body,
          color: gap > 1 ? tokens.colors.danger : tokens.colors.success,
          align: 'center' as const,
        },
      },
      { text: '', options: { fill: { color: cellColor }, fontSize: 10 } },
    ];
  });

  // ── Anti-sparseness (W7): grow rows so the grid fills the usable region ──
  // Reserve room at the bottom for the Overall badge when present so the table
  // and badge together span p.h instead of leaving an empty lower band.
  const hasBadge = props.overallScore != null;
  const badgeH = 0.5;
  const badgeGap = hasBadge ? 0.2 : 0;
  const tableRegionH = p.h - (hasBadge ? badgeH + badgeGap : 0);
  const totalRows = dataRows.length + 1; // +1 header
  const naturalRowH = 0.35;
  const fittedRowH = Math.min(0.9, Math.max(naturalRowH, tableRegionH / totalRows));
  const tableH = fittedRowH * totalRows;

  elements.push({
    kind: 'table',
    apply(slide) {
      slide.addTable([headerRow, ...dataRows], {
        x: p.x,
        y: p.y,
        w: p.w,
        colW: [p.w * 0.35, p.w * 0.15, p.w * 0.15, p.w * 0.15, p.w * 0.2],
        border: { pt: 0.5, color: tokens.colors.border },
        fontFace: tokens.fonts.body,
        rowH: fittedRowH,
        valign: 'middle',
        autoPage: false,
      });
    },
  });

  // Overall score badge (if present) — placed below the table, bottom-right,
  // inside the region (never intrudes into the header band).
  if (props.overallScore != null) {
    const badgeColor = scoreToColor(props.overallScore, scaleMax, tokens);
    const badgeW = 1.8;
    const badgeX = p.x + p.w - badgeW;
    const badgeY = p.y + tableH + badgeGap;
    elements.push({
      kind: 'shape',
      apply(slide) {
        slide.addShape('roundRect', {
          x: badgeX,
          y: badgeY,
          w: badgeW,
          h: badgeH,
          fill: { color: badgeColor },
          rectRadius: 0.06,
        });
        slide.addText(`Overall: ${props.overallScore!.toFixed(1)}/${scaleMax}`, {
          x: badgeX,
          y: badgeY,
          w: badgeW,
          h: badgeH,
          fontSize: 12,
          fontFace: tokens.fonts.body,
          color: 'FFFFFF',
          bold: true,
          align: 'center',
          valign: 'middle',
        });
      },
    });
  }

  return elements;
}
