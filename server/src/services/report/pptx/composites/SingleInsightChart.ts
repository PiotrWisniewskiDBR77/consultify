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
  const chartW = p.w * 0.58;
  const textW = p.w * 0.38;
  const gutter = p.w * 0.04;
  const elements: RenderedElement[] = [];

  // Chart element
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
        h: p.h,
        showLegend: props.chartData.series.length > 1,
        legendPos: 'b',
        chartColors: props.chartData.series.map((s) => s.color ?? tokens.colors.primary),
        showValue: true,
        valueFontSize: 9,
      });
    },
  });

  // Insight text
  elements.push(
    BodyText(
      {
        text: props.insightText,
        position: { x: p.x + chartW + gutter, y: p.y, w: textW, h: p.h * 0.85 },
        fontSize: tokens.fontSizes.body,
      },
      tokens
    )
  );

  // Source tag
  if (props.source) {
    elements.push(
      SourceTag(
        {
          source: props.source,
          position: { x: p.x, y: p.y + p.h - 0.2, w: chartW, h: 0.2 },
        },
        tokens
      )
    );
  }

  return elements;
}
