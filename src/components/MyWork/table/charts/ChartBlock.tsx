import React, { useCallback, useEffect, useRef } from 'react';

interface ChartBlockProps {
  tableId: string;
  chartType: 'bar' | 'line' | 'pie' | 'donut';
  xFieldId: string;
  yFieldId?: string;
  aggregation: 'count' | 'sum' | 'avg' | 'min' | 'max';
  colorFieldId?: string;
  title?: string;
  records?: Array<{ data?: Record<string, unknown> }>;
  fields?: Array<{ id: string; name: string; type: string }>;
}

// Chart series draw from the identity palette (c-tag-*), blue-first and never
// crimson — data must never wear the brand accent (Artifact Anatomy §15.1).
// Tokens resolve at render time so charts follow light/dark theme swaps.
const TAG_ORDER = [1, 10, 2, 6, 3, 9, 4, 12, 5, 11, 7, 8];

function resolveTag(n: number): string {
  if (typeof window === 'undefined') return '#3b8ea5';
  const v = getComputedStyle(document.documentElement)
    .getPropertyValue(`--c-tag-${n}`)
    .trim();
  return v || '#3b8ea5';
}

function generateColors(count: number): string[] {
  const colors: string[] = [];
  for (let i = 0; i < count; i++) {
    colors.push(resolveTag(TAG_ORDER[i % TAG_ORDER.length]!));
  }
  return colors;
}

function aggregate(vals: number[], method: ChartBlockProps['aggregation']): number {
  if (vals.length === 0) return 0;
  switch (method) {
    case 'count':
      return vals.length;
    case 'sum':
      return vals.reduce((a, b) => a + b, 0);
    case 'avg':
      return vals.reduce((a, b) => a + b, 0) / vals.length;
    case 'min':
      return Math.min(...vals);
    case 'max':
      return Math.max(...vals);
    default:
      return vals.length;
  }
}

export const ChartBlock: React.FC<ChartBlockProps> = ({
  chartType,
  xFieldId,
  yFieldId,
  aggregation,
  title,
  records = [],
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartInstanceRef = useRef<InstanceType<typeof import('chart.js').Chart> | null>(null);

  const computeChartData = useCallback(() => {
    if (!records.length || !xFieldId) return { labels: [] as string[], datasets: [] };

    const groups = new Map<string, number[]>();

    for (const record of records) {
      const xVal = String(record.data?.[xFieldId] ?? 'Unknown');
      if (!groups.has(xVal)) groups.set(xVal, []);

      if (yFieldId) {
        const yVal = Number(record.data?.[yFieldId] ?? 0);
        groups.get(xVal)!.push(yVal);
      } else {
        groups.get(xVal)!.push(1);
      }
    }

    const labels = Array.from(groups.keys());
    const values = labels.map((label) => aggregate(groups.get(label)!, aggregation));
    const colors = generateColors(labels.length);
    const isPieish = chartType === 'pie' || chartType === 'donut';

    return {
      labels,
      datasets: [
        {
          label: title || aggregation,
          data: values,
          backgroundColor: isPieish ? colors : colors[0],
          borderColor: chartType === 'line' ? colors[0] : undefined,
          borderWidth: 1,
          fill: chartType !== 'line',
        },
      ],
    };
  }, [records, xFieldId, yFieldId, aggregation, chartType, title]);

  useEffect(() => {
    if (!canvasRef.current) return;

    let destroyed = false;

    const loadChart = async () => {
      try {
        const { Chart, registerables } = await import('chart.js');
        Chart.register(...registerables);

        if (destroyed) return;

        if (chartInstanceRef.current) {
          chartInstanceRef.current.destroy();
        }

        const data = computeChartData();
        const isPieish = chartType === 'pie' || chartType === 'donut';

        chartInstanceRef.current = new Chart(canvasRef.current!, {
          type: chartType === 'donut' ? 'doughnut' : chartType,
          data,
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              title: { display: !!title, text: title || '' },
              legend: { display: isPieish },
            },
            scales: isPieish
              ? undefined
              : {
                  y: { beginAtZero: true },
                },
          },
        });
      } catch (err) {
        console.error('[ChartBlock] Failed to load Chart.js:', err);
      }
    };

    loadChart();

    return () => {
      destroyed = true;
      chartInstanceRef.current?.destroy();
      chartInstanceRef.current = null;
    };
  }, [computeChartData, chartType, title]);

  return (
    <div className="w-full h-full min-h-[200px] p-2">
      <canvas ref={canvasRef} />
    </div>
  );
};

export default ChartBlock;
