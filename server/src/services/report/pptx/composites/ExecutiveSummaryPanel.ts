/**
 * Composite: Executive Summary Panel
 * Board-level synthesis: headline + optional KPIs + key findings + recommendation.
 */
import { BodyText } from '../atomics/BodyText.js';
import { Bullet } from '../atomics/Bullet.js';
import { Divider } from '../atomics/Divider.js';
import type { DesignTokens, ElementPosition, KpiData, RenderedElement } from '../types.js';
import { KpiStrip } from './KpiStrip.js';

export interface ExecutiveSummaryPanelProps {
  headline: string;
  kpis?: KpiData[];
  keyFindings: string[];
  recommendation?: string;
  position: ElementPosition;
}

export function ExecutiveSummaryPanel(
  props: ExecutiveSummaryPanelProps,
  tokens: DesignTokens
): RenderedElement[] {
  const { position: p } = props;
  const elements: RenderedElement[] = [];
  let currentY = p.y;

  // Headline
  elements.push(
    BodyText(
      {
        text: props.headline,
        position: { x: p.x, y: currentY, w: p.w, h: 0.45 },
        bold: true,
        fontSize: tokens.fontSizes.heading,
        color: tokens.colors.primary,
      },
      tokens
    )
  );
  currentY += 0.55;

  // KPI strip (if present, max 4 for exec summary)
  if (props.kpis && props.kpis.length > 0) {
    const kpiH = 0.8;
    const kpiElements = KpiStrip(
      {
        kpis: props.kpis.slice(0, 4),
        position: { x: p.x, y: currentY, w: p.w, h: kpiH },
      },
      tokens
    );
    elements.push(...kpiElements);
    currentY += kpiH + 0.15;
  }

  // Divider
  elements.push(
    Divider(
      {
        position: { x: p.x, y: currentY, w: p.w, h: 0 },
      },
      tokens
    )
  );
  currentY += 0.15;

  // Key findings
  const findingsH = props.recommendation ? 1.2 : 1.8;
  elements.push(
    Bullet(
      {
        items: props.keyFindings.slice(0, 5),
        position: { x: p.x, y: currentY, w: p.w, h: findingsH },
      },
      tokens
    )
  );
  currentY += findingsH + 0.1;

  // Recommendation callout
  if (props.recommendation) {
    elements.push({
      kind: 'shape',
      apply(slide) {
        slide.addShape('roundRect', {
          x: p.x,
          y: currentY,
          w: p.w,
          h: 0.45,
          fill: { color: tokens.colors.accent },
          rectRadius: 0.05,
        });
      },
    });
    elements.push(
      BodyText(
        {
          text: `Recommendation: ${props.recommendation}`,
          position: { x: p.x + 0.15, y: currentY, w: p.w - 0.3, h: 0.45 },
          bold: true,
          color: tokens.colors.textInverse,
          valign: 'middle',
        },
        tokens
      )
    );
  }

  return elements;
}
