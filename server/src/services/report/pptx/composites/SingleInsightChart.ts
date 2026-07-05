/**
 * Composite: Single Insight Chart
 * One chart + one insight text — evidence-based storytelling.
 * Chart on the left (60%), insight text on the right (40%).
 */
import { BodyText } from '../atomics/BodyText.js';
import { SourceTag } from '../atomics/SourceTag.js';
import type { ChartDataSet, DesignTokens, ElementPosition, RenderedElement } from '../types.js';

export interface SingleInsightChartProps {
  chartType: 'bar' | 'line' | 'pie' | 'radar' | 'gauge';
  chartData: ChartDataSet;
  insightText: string;
  source?: string;
  position: ElementPosition;
}

const CHART_TYPE_MAP: Record<string, string> = {
  bar: 'bar',
  line: 'line',
  pie: 'pie',
  radar: 'radar',
  gauge: 'doughnut',
};

export function SingleInsightChart(
  props: SingleInsightChartProps,
  tokens: DesignTokens
): RenderedElement[] {
  const { position: p } = props;
  // Chart claims the majority of the region; insight becomes a full-height
  // callout panel on the right so neither column leaves an empty bottom.
  const gutter = p.w * 0.035;
  const textW = p.w * 0.32;
  const chartW = p.w - textW - gutter;
  const sourceH = props.source ? 0.22 : 0;
  const chartH = p.h - sourceH;
  const elements: RenderedElement[] = [];

  // Chart element (enlarged to fill the region height)
  elements.push({
    kind: 'chart',
    apply(slide) {
      const pptxChartType = CHART_TYPE_MAP[props.chartType] || 'bar';
      const chartDataForPptx = props.chartData.series.map((s) => ({
        name: s.name,
        labels: props.chartData.labels,
        values: s.values,
      }));

      slide.addChart(pptxChartType, chartDataForPptx, {
        x: p.x,
        y: p.y,
        w: chartW,
        h: chartH,
        showLegend: props.chartData.series.length > 1,
        legendPos: 'b',
        chartColors: props.chartData.series.map((s) => s.color ?? tokens.colors.primary),
        showValue: true,
        valueFontSize: 9,
      });
    },
  });

  // Insight callout panel (full-height, vertically centered text)
  const calloutX = p.x + chartW + gutter;
  elements.push({
    kind: 'shape',
    apply(slide) {
      slide.addShape('roundRect', {
        x: calloutX,
        y: p.y,
        w: textW,
        h: p.h,
        fill: { color: tokens.colors.surface },
        line: { color: tokens.colors.border, width: 0.5 },
        rectRadius: 0.06,
      });
      // Accent stripe along the left edge of the callout
      slide.addShape('rect', {
        x: calloutX,
        y: p.y,
        w: 0.06,
        h: p.h,
        fill: { color: tokens.colors.primary },
      });
    },
  });

  // Insight text (centered inside the panel so it fills the full height)
  elements.push(
    BodyText(
      {
        text: props.insightText,
        position: { x: calloutX + 0.2, y: p.y + 0.15, w: textW - 0.35, h: p.h - 0.3 },
        fontSize: tokens.fontSizes.body,
        valign: 'middle',
      },
      tokens
    )
  );

  // Source tag (under the chart, bottom of region)
  if (props.source) {
    elements.push(
      SourceTag(
        {
          source: props.source,
          position: { x: p.x, y: p.y + p.h - sourceH, w: chartW, h: sourceH },
        },
        tokens
      )
    );
  }

  return elements;
}
