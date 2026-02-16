/**
 * Composite: KPI Strip
 * Horizontal row of KPI tiles — max 6 per spec rules.
 * Auto-distributes tiles evenly across available width.
 */
import type { DesignTokens, ElementPosition, KpiData, RenderedElement } from '../types.js';
import { KpiTile } from './KpiTile.js';

export interface KpiStripProps {
  kpis: KpiData[];
  position: ElementPosition;
}

export function KpiStrip(props: KpiStripProps, tokens: DesignTokens): RenderedElement[] {
  const { kpis, position: p } = props;
  const count = Math.min(kpis.length, 6); // Max 6 per rules engine
  const tileW = (p.w - tokens.spacing.gutter * (count - 1)) / count;
  const elements: RenderedElement[] = [];

  for (let i = 0; i < count; i++) {
    const tileX = p.x + i * (tileW + tokens.spacing.gutter);
    const tileElements = KpiTile(
      {
        kpi: kpis[i],
        position: { x: tileX, y: p.y, w: tileW, h: p.h },
      },
      tokens
    );
    elements.push(...tileElements);
  }

  return elements;
}
