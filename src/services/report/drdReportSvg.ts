/**
 * DRD Report — SVG builders (pure, dependency-free)
 *
 * Hand-rolled inline SVG so the report renders to a standalone HTML file and prints
 * cleanly (no chart library, no runtime canvas). Palette is blue/teal/slate + amber
 * for gaps. CRIMSON IS FORBIDDEN — see `assertNoCrimson()` guard used by tests.
 *
 * All geometry is derived from engine-provided percentages (0..100); this module
 * never invents scores.
 */

import type { DrdAreaRow, DrdDimension } from './drdReportModel';

/** Report palette — blue / teal / slate / amber. NO crimson / red. */
export const DRD_REPORT_PALETTE = {
  actual: '#0d9488', // teal-600
  target: '#3b82f6', // blue-500
  grid: '#cbd5e1', // slate-300
  axisLabel: '#334155', // slate-700
  ink: '#0f172a', // slate-900
  muted: '#64748b', // slate-500
  // gap severity ramp (blue → teal → amber; never red/crimson)
  sevNone: '#e2e8f0', // slate-200
  sevLow: '#5eead4', // teal-300
  sevMedium: '#38bdf8', // sky-400
  sevHigh: '#f59e0b', // amber-500
} as const;

/** Hex tokens that are considered crimson/red and are banned from the report. */
export const BANNED_CRIMSON_TOKENS = [
  '#85182f',
  '#a51c30',
  '#e80538',
  'crimson',
  'text-primary',
  'bg-primary',
  '--primary',
] as const;

/**
 * Throws if any banned crimson token appears in the given string.
 * Used by tests to enforce the "ZAKAZ crimson" rule over generated output.
 */
export function assertNoCrimson(html: string): void {
  const lower = html.toLowerCase();
  for (const token of BANNED_CRIMSON_TOKENS) {
    if (lower.includes(token)) {
      throw new Error(`DRD report palette violation: banned crimson token "${token}" found`);
    }
  }
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function polar(cx: number, cy: number, r: number, angleRad: number): [number, number] {
  return [cx + r * Math.cos(angleRad), cy + r * Math.sin(angleRad)];
}

/**
 * Radar chart of the DRD dimensions (7 measured axes). Values are actualPercent /
 * targetPercent (0..100) so mixed 5/6/7 scales are comparable on one chart.
 */
export function buildRadarSvg(dimensions: DrdDimension[], size = 460): string {
  const n = dimensions.length;
  if (n === 0) return '';
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 70; // padding for labels
  const startAngle = -Math.PI / 2; // top
  const step = (Math.PI * 2) / n;
  const rings = [20, 40, 60, 80, 100];

  const angleAt = (i: number) => startAngle + i * step;

  // grid rings
  const ringPaths = rings
    .map((ring) => {
      const pts = dimensions
        .map((_, i) => {
          const [x, y] = polar(cx, cy, (ring / 100) * r, angleAt(i));
          return `${x.toFixed(1)},${y.toFixed(1)}`;
        })
        .join(' ');
      return `<polygon points="${pts}" fill="none" stroke="${DRD_REPORT_PALETTE.grid}" stroke-width="1" opacity="0.7"/>`;
    })
    .join('');

  // spokes + labels
  const spokes = dimensions
    .map((d, i) => {
      const [x, y] = polar(cx, cy, r, angleAt(i));
      const [lx, ly] = polar(cx, cy, r + 22, angleAt(i));
      const anchor = Math.abs(lx - cx) < 4 ? 'middle' : lx > cx ? 'start' : 'end';
      const shortName = d.name.length > 22 ? d.name.slice(0, 21) + '…' : d.name;
      return (
        `<line x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="${DRD_REPORT_PALETTE.grid}" stroke-width="1"/>` +
        `<text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" font-size="11" fill="${DRD_REPORT_PALETTE.axisLabel}" text-anchor="${anchor}" dominant-baseline="middle">${esc(shortName)}</text>` +
        `<text x="${lx.toFixed(1)}" y="${(ly + 13).toFixed(1)}" font-size="10" fill="${DRD_REPORT_PALETTE.muted}" text-anchor="${anchor}" dominant-baseline="middle">${d.actualPercent}% / ${d.targetPercent}%</text>`
      );
    })
    .join('');

  const polygon = (accessor: (d: DrdDimension) => number) =>
    dimensions
      .map((d, i) => {
        const [x, y] = polar(cx, cy, (accessor(d) / 100) * r, angleAt(i));
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');

  const targetPoly = polygon((d) => d.targetPercent);
  const actualPoly = polygon((d) => d.actualPercent);

  return `
<svg viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="DRD radar">
  ${ringPaths}
  ${spokes}
  <polygon points="${targetPoly}" fill="${DRD_REPORT_PALETTE.target}" fill-opacity="0.10" stroke="${DRD_REPORT_PALETTE.target}" stroke-width="1.5" stroke-dasharray="4 3"/>
  <polygon points="${actualPoly}" fill="${DRD_REPORT_PALETTE.actual}" fill-opacity="0.22" stroke="${DRD_REPORT_PALETTE.actual}" stroke-width="2"/>
  ${dimensions
    .map((d, i) => {
      const [x, y] = polar(cx, cy, (d.actualPercent / 100) * r, angleAt(i));
      return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3" fill="${DRD_REPORT_PALETTE.actual}"/>`;
    })
    .join('')}
</svg>`.trim();
}

const SEVERITY_FILL: Record<DrdAreaRow['severity'], string> = {
  none: DRD_REPORT_PALETTE.sevNone,
  low: DRD_REPORT_PALETTE.sevLow,
  medium: DRD_REPORT_PALETTE.sevMedium,
  high: DRD_REPORT_PALETTE.sevHigh,
};

/**
 * Matrix (heatmap) of all areas grouped by axis. Each cell = one area, colored by
 * gap severity, labeled with the area id and actual level.
 */
export function buildMatrixSvg(areas: DrdAreaRow[], width = 720): string {
  if (areas.length === 0) return '';
  // Group by axis, preserve order.
  const axisOrder: number[] = [];
  const byAxis = new Map<number, DrdAreaRow[]>();
  for (const a of areas) {
    if (!byAxis.has(a.axisId)) {
      byAxis.set(a.axisId, []);
      axisOrder.push(a.axisId);
    }
    byAxis.get(a.axisId)!.push(a);
  }

  const labelW = 190;
  const cell = 46;
  const gap = 6;
  const rowH = cell + gap;
  const topPad = 8;
  const maxCols = Math.max(...[...byAxis.values()].map((v) => v.length));
  const gridW = maxCols * (cell + gap);
  const svgW = Math.max(width, labelW + gridW + 20);
  const svgH = topPad + axisOrder.length * rowH + 8;

  const rows = axisOrder
    .map((axisId, rowIdx) => {
      const list = byAxis.get(axisId)!;
      const y = topPad + rowIdx * rowH;
      const axisName = list[0].axisName;
      const shortAxis = axisName.length > 26 ? axisName.slice(0, 25) + '…' : axisName;
      const cells = list
        .map((a, colIdx) => {
          const x = labelW + colIdx * (cell + gap);
          const fill = SEVERITY_FILL[a.severity];
          const textFill = a.severity === 'high' ? '#7c2d12' : DRD_REPORT_PALETTE.ink;
          return (
            `<g>` +
            `<rect x="${x}" y="${y}" width="${cell}" height="${cell}" rx="6" fill="${fill}" stroke="#ffffff" stroke-width="1.5"/>` +
            `<text x="${x + cell / 2}" y="${y + cell / 2 - 3}" font-size="11" font-weight="600" fill="${textFill}" text-anchor="middle">${esc(a.areaId)}</text>` +
            `<text x="${x + cell / 2}" y="${y + cell / 2 + 11}" font-size="9" fill="${textFill}" text-anchor="middle">${a.actual}/${a.maxLevel}</text>` +
            `</g>`
          );
        })
        .join('');
      return (
        `<text x="0" y="${y + cell / 2}" font-size="11" fill="${DRD_REPORT_PALETTE.axisLabel}" dominant-baseline="middle">${esc(shortAxis)}</text>` +
        cells
      );
    })
    .join('');

  return `
<svg viewBox="0 0 ${svgW} ${svgH}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="DRD area matrix">
  ${rows}
</svg>`.trim();
}

/** Small horizontal bar comparing actual vs target percent (used in chapters). */
export function buildDimensionBarsSvg(dimensions: DrdDimension[], width = 640): string {
  if (dimensions.length === 0) return '';
  const rowH = 34;
  const labelW = 190;
  const barW = width - labelW - 60;
  const height = dimensions.length * rowH + 10;
  const rows = dimensions
    .map((d, i) => {
      const y = 8 + i * rowH;
      const aW = (d.actualPercent / 100) * barW;
      const tW = (d.targetPercent / 100) * barW;
      const name = d.name.length > 26 ? d.name.slice(0, 25) + '…' : d.name;
      return (
        `<text x="0" y="${y + 13}" font-size="11" fill="${DRD_REPORT_PALETTE.axisLabel}">${esc(name)}</text>` +
        `<rect x="${labelW}" y="${y + 4}" width="${barW}" height="16" rx="8" fill="${DRD_REPORT_PALETTE.sevNone}"/>` +
        `<rect x="${labelW}" y="${y + 4}" width="${tW.toFixed(1)}" height="16" rx="8" fill="${DRD_REPORT_PALETTE.target}" fill-opacity="0.30"/>` +
        `<rect x="${labelW}" y="${y + 4}" width="${aW.toFixed(1)}" height="16" rx="8" fill="${DRD_REPORT_PALETTE.actual}"/>` +
        `<text x="${labelW + barW + 8}" y="${y + 16}" font-size="10" fill="${DRD_REPORT_PALETTE.muted}">${d.actualPercent}%/${d.targetPercent}%</text>`
      );
    })
    .join('');
  return `
<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="DRD dimension bars">
  ${rows}
</svg>`.trim();
}
