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

const PALETTE = [
  'rgba(59, 130, 246, 0.7)',
  'rgba(239, 68, 68, 0.7)',
  'rgba(16, 185, 129, 0.7)',
  'rgba(245, 158, 11, 0.7)',
  'rgba(165,28,48, 0.7)',
  'rgba(236, 72, 153, 0.7)',
  'rgba(6, 182, 212, 0.7)',
  'rgba(132, 204, 22, 0.7)',
  'rgba(249, 115, 22, 0.7)',
  'rgba(99, 102, 241, 0.7)',
];

function generateColors(count: number): string[] {
  const colors: string[] = [];
  for (let i = 0; i < count; i++) {
    colors.push(PALETTE[i % PALETTE.length]!);
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
