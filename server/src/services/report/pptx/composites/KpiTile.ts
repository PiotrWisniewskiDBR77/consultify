/**
 * Composite: KPI Tile
 * Single metric display: value + label + trend indicator.
 * Used in KPI dashboards and executive summaries.
 */
import { KpiLabel } from '../atomics/KpiLabel.js';
import { KpiValue } from '../atomics/KpiValue.js';
import { TrendIndicator } from '../atomics/TrendIndicator.js';
import { statusColor } from '../designTokens.js';
import type { DesignTokens, ElementPosition, KpiData, RenderedElement } from '../types.js';

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

  // W7 anti-sparseness: na wysokim kafelku (Dashboard, h≈3) wyśrodkuj pionowo
  // blok wartość+etykieta+trend i powiększ liczbę-hero, żeby kafelek oddychał.
  // Na niskim kafelku (Exec strip, h≈0.9) zachowaj dotychczasowe proporcje.
  const isTall = p.h >= 1.6;
  const valueColor = kpi.status ? statusColor(kpi.status, tokens) : tokens.colors.primary;

  if (isTall) {
    // Większy obszar wartości (valign:middle + fit:shrink w atomicu KpiValue
    // sprawia, że hero-liczba urośnie do tej wysokości) → liczba czytelniejsza.
    const valueH = Math.min(p.h * 0.5, 1.4);
    const labelH = 0.3;
    const trendH = kpi.trend ? 0.3 : 0;
    const gap = 0.08;
    const stackH = valueH + gap + labelH + (kpi.trend ? gap + trendH : 0);
    let y = p.y + Math.max(0.1, (p.h - stackH) / 2);

    elements.push(
      KpiValue(
        {
          value: kpi.value,
          unit: kpi.unit,
          color: valueColor,
          position: { x: p.x + 0.1, y, w: p.w - 0.2, h: valueH },
        },
        tokens
      )
    );
    y += valueH + gap;

    elements.push(
      KpiLabel(
        {
          text: kpi.name,
          position: { x: p.x + 0.1, y, w: p.w - 0.2, h: labelH },
        },
        tokens
      )
    );
    y += labelH;

    if (kpi.trend) {
      y += gap;
      elements.push(
        TrendIndicator(
          {
            trend: kpi.trend,
            delta: kpi.delta,
            position: { x: p.x + 0.1, y, w: p.w - 0.2, h: trendH },
          },
          tokens
        )
      );
    }

    return elements;
  }

  // KPI Value (compact tile)
  elements.push(
    KpiValue(
      {
        value: kpi.value,
        unit: kpi.unit,
        color: valueColor,
        position: { x: p.x, y: p.y + 0.1, w: p.w, h: p.h * 0.45 },
      },
      tokens
    )
  );

  // KPI Label
  elements.push(
    KpiLabel(
      {
        text: kpi.name,
        position: { x: p.x, y: p.y + p.h * 0.55, w: p.w, h: p.h * 0.2 },
      },
      tokens
    )
  );

  // Trend indicator (if available)
  if (kpi.trend) {
    elements.push(
      TrendIndicator(
        {
          trend: kpi.trend,
          delta: kpi.delta,
          position: { x: p.x, y: p.y + p.h * 0.75, w: p.w, h: p.h * 0.2 },
        },
        tokens
      )
    );
  }

  return elements;
}
