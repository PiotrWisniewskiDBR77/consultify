/**
 * Composite: KPI Tile
 * Single metric display: value + label + trend indicator.
 * Used in KPI dashboards and executive summaries.
 */
import type { DesignTokens, RenderedElement, ElementPosition, KpiData } from '../types.js';
import { KpiValue } from '../atomics/KpiValue.js';
import { KpiLabel } from '../atomics/KpiLabel.js';
import { TrendIndicator } from '../atomics/TrendIndicator.js';
import { statusColor } from '../designTokens.js';

export interface KpiTileProps {
  kpi: KpiData;
  position: ElementPosition;
  showBackground?: boolean;
}

export function KpiTile(props: KpiTileProps, tokens: DesignTokens): RenderedElement[] {
  const { kpi, position: p } = props;
  const elements: RenderedElement[] = [];

  // Background card
  if (props.showBackground !== false) {
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
      },
    });
  }

  // KPI Value
  const valueColor = kpi.status ? statusColor(kpi.status, tokens) : tokens.colors.primary;
  elements.push(
    KpiValue({
      value: kpi.value,
      unit: kpi.unit,
      color: valueColor,
      position: { x: p.x, y: p.y + 0.1, w: p.w, h: p.h * 0.45 },
    }, tokens)
  );

  // KPI Label
  elements.push(
    KpiLabel({
      text: kpi.name,
      position: { x: p.x, y: p.y + p.h * 0.55, w: p.w, h: p.h * 0.2 },
    }, tokens)
  );

  // Trend indicator (if available)
  if (kpi.trend) {
    elements.push(
      TrendIndicator({
        trend: kpi.trend,
        delta: kpi.delta,
        position: { x: p.x, y: p.y + p.h * 0.75, w: p.w, h: p.h * 0.2 },
      }, tokens)
    );
  }

  return elements;
}
