import type { ChartConfiguration, ChartDataset, ScatterDataPoint } from 'chart.js';

import {
  type DocumentBlock,
  documentChartBlockContent,
  type DocumentChartKind,
} from './documentStudioTypes.js';

const DEFAULT_WIDTH = 960;
const DEFAULT_HEIGHT = 540;

const PALETTE = ['#2563EB', '#0D9488', '#7C3AED', '#DC2626', '#EA580C', '#0891B2', '#65A30D'];

type ChartCanvasCtor = {
  new (options: { width: number; height: number; backgroundColour: string }): {
    renderToBuffer: (configuration: ChartConfiguration, mimeType?: string) => Promise<Buffer>;
  };
};

let chartCanvasCtor: ChartCanvasCtor | null | undefined;
let defaultChartCanvas: {
  renderToBuffer: (configuration: ChartConfiguration, mimeType?: string) => Promise<Buffer>;
} | null = null;

async function getChartCanvasCtor(): Promise<ChartCanvasCtor | null> {
  if (chartCanvasCtor !== undefined) return chartCanvasCtor;
  try {
    const mod = await import('chartjs-node-canvas');
    chartCanvasCtor = mod.ChartJSNodeCanvas as unknown as ChartCanvasCtor;
    return chartCanvasCtor;
  } catch {
    chartCanvasCtor = null;
    return null;
  }
}

function paletteColor(index: number): string {
  return PALETTE[index % PALETTE.length];
}

function rgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return `rgba(37,99,235,${alpha})`;
  const r = Number.parseInt(clean.slice(0, 2), 16);
  const g = Number.parseInt(clean.slice(2, 4), 16);
  const b = Number.parseInt(clean.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function chartTypeForKind(kind: DocumentChartKind): ChartConfiguration['type'] {
  if (kind === 'donut') return 'doughnut';
  if (kind === 'area') return 'line';
  return kind;
}

function labelsFromContent(
  content: NonNullable<ReturnType<typeof documentChartBlockContent>>
): string[] {
  if (Array.isArray(content.categories) && content.categories.length > 0) {
    return content.categories.map((value) => String(value));
  }
  const longest = content.series.reduce((max, s) => Math.max(max, s.values.length), 0);
  return Array.from({ length: longest }, (_, idx) => String(idx + 1));
}

function buildDatasets(
  content: NonNullable<ReturnType<typeof documentChartBlockContent>>
): ChartDataset[] {
  if (content.kind === 'scatter') {
    return content.series.map((series, idx) => {
      const color = series.color ?? paletteColor(idx);
      const points: ScatterDataPoint[] = series.values.map((value, pointIdx) => ({
        x: pointIdx + 1,
        y: value,
      }));
      return {
        label: series.label,
        data: points,
        borderColor: color,
        backgroundColor: rgba(color, 0.35),
        pointRadius: 4,
      };
    });
  }

  return content.series.map((series, idx) => {
    const color = series.color ?? paletteColor(idx);
    const isArea = content.kind === 'area';
    return {
      label: series.label,
      data: series.values,
      borderColor: color,
      backgroundColor: isArea ? rgba(color, 0.24) : rgba(color, 0.75),
      fill: isArea ? 'origin' : false,
      tension: isArea || content.kind === 'line' ? 0.28 : 0,
      pointRadius: content.kind === 'line' || isArea ? 2 : 0,
    };
  });
}

/**
 * Renders a chart block to PNG bytes using Chart.js. Returns `null`
 * when the block is malformed or not renderable.
 */
export async function renderChartBlockToPng(
  block: DocumentBlock,
  options: { width?: number; height?: number } = {}
): Promise<Buffer | null> {
  const CanvasCtor = await getChartCanvasCtor();
  if (!CanvasCtor) return null;

  const content = documentChartBlockContent(block);
  if (!content) return null;
  if (!Array.isArray(content.series) || content.series.length === 0) return null;

  const labels = labelsFromContent(content);
  const datasets = buildDatasets(content);
  if (datasets.length === 0) return null;

  const chartType = chartTypeForKind(content.kind);
  const widthCandidate = Number(options.width);
  const heightCandidate = Number(options.height);
  const width = Number.isFinite(widthCandidate) && widthCandidate > 0 ? widthCandidate : 960;
  const height = Number.isFinite(heightCandidate) && heightCandidate > 0 ? heightCandidate : 540;

  if (!defaultChartCanvas) {
    defaultChartCanvas = new CanvasCtor({
      width: DEFAULT_WIDTH,
      height: DEFAULT_HEIGHT,
      backgroundColour: 'white',
    });
  }
  const localCanvas =
    width === DEFAULT_WIDTH && height === DEFAULT_HEIGHT
      ? defaultChartCanvas
      : new CanvasCtor({ width, height, backgroundColour: 'white' });

  const configuration: ChartConfiguration = {
    type: chartType,
    data: {
      labels: chartType === 'scatter' ? undefined : labels,
      datasets,
    },
    options: {
      responsive: false,
      animation: false,
      plugins: {
        title: {
          display: true,
          text: content.title,
          color: '#0F172A',
          font: { size: 18, weight: 'bold' },
        },
        legend: {
          display: datasets.length > 1,
          position: 'bottom',
          labels: { color: '#0F172A' },
        },
      },
      scales:
        chartType === 'pie' || chartType === 'doughnut'
          ? undefined
          : {
              x: {
                title: {
                  display: Boolean(content.xAxisLabel),
                  text: content.xAxisLabel ?? '',
                  color: '#334155',
                },
                ticks: { color: '#334155' },
                grid: { color: '#E2E8F0' },
              },
              y: {
                title: {
                  display: Boolean(content.yAxisLabel),
                  text: content.yAxisLabel ?? '',
                  color: '#334155',
                },
                ticks: { color: '#334155' },
                grid: { color: '#E2E8F0' },
                beginAtZero: true,
              },
            },
    },
  };

  try {
    return await localCanvas.renderToBuffer(configuration, 'image/png');
  } catch {
    return null;
  }
}
