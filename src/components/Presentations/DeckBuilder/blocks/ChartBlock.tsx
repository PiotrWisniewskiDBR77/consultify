/**
 * ChartBlock (P2.3) — DATA-BOUND deck chart renderer.
 *
 * Was: an inline bar approximation for `chartType==='bar'` and a `BarChart3`
 * ICON PLACEHOLDER for everything else (the "placeholder balast" that dragged
 * the W7 canvas-fill score down). Now: normalizes the block content via
 * {@link adaptChartBlockContent} and draws a REAL chart with recharts —
 * bar / line / area / pie / donut plus consulting archetypes waterfall /
 * matrix 2×2 / RAG / marimekko / harvey-balls.
 *
 * FAIL-OPEN: when the adapter yields `null` (no usable data), the block renders
 * NOTHING (returns null) — no placeholder, no crash. Palette comes from the
 * active theme's `chartPalette` (already ≤7, colorblind-safe).
 */
import React from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import type { CardBlock, CuratedColorSet } from '../../wizard/types';
import type { BlockDensity } from './blockDensity';
import {
  adaptChartBlockContent,
  type CartesianSpec,
  type DeckChartSpec,
  type HarveySpec,
  type MarimekkoSpec,
  type Matrix2x2Spec,
  type PieSpec,
  type RagSpec,
  type WaterfallSpec,
} from './deckChartAdapter';

interface Props {
  block: CardBlock;
  theme: CuratedColorSet;
  /** GROW-CONTENT: 'hero' when the chart owns a tall region → render it large. */
  density?: BlockDensity;
}

/**
 * GROW-CONTENT: the chart was a fixed 150px tall regardless of how much canvas
 * it was given, so a chart owning a full lower region floated small in
 * whitespace. `density: 'hero'` lets it grow to fill the region.
 */
const CHART_H_DEFAULT = 150;
const CHART_H_HERO = 320;

const RAG_COLORS: Record<'green' | 'amber' | 'red', string> = {
  green: '#16A34A',
  amber: '#D97706',
  red: '#DC2626',
};

const ChartTitle: React.FC<{ title?: string; theme: CuratedColorSet }> = ({ title, theme }) =>
  title ? (
    <p className="text-xs font-semibold mb-1" style={{ color: theme.colors.heading }}>
      {title}
    </p>
  ) : null;

export const ChartBlock: React.FC<Props> = ({ block, theme, density = 'default' }) => {
  const spec = adaptChartBlockContent(block.content);
  // FAIL-OPEN: no usable data → render nothing (no placeholder balast).
  if (!spec) return null;

  const chartH = density === 'hero' ? CHART_H_HERO : CHART_H_DEFAULT;

  return (
    <div className="space-y-1 w-full h-full flex flex-col">
      <ChartTitle title={spec.title} theme={theme} />
      {renderSpec(spec, theme, chartH)}
    </div>
  );
};

function renderSpec(spec: DeckChartSpec, theme: CuratedColorSet, chartH: number): React.ReactNode {
  switch (spec.type) {
    case 'bar':
    case 'line':
    case 'area':
      return <CartesianChart spec={spec} theme={theme} chartH={chartH} />;
    case 'pie':
    case 'donut':
      return <PieChartView spec={spec} theme={theme} chartH={chartH} />;
    case 'waterfall':
      return <WaterfallChart spec={spec} theme={theme} chartH={chartH} />;
    case 'matrix_2x2':
      return <MatrixChart spec={spec} theme={theme} chartH={chartH} />;
    case 'rag':
      return <RagChart spec={spec} theme={theme} />;
    case 'marimekko':
      return <MarimekkoChart spec={spec} theme={theme} chartH={chartH} />;
    case 'harvey_balls':
      return <HarveyChart spec={spec} theme={theme} />;
    default:
      return null;
  }
}

const AXIS_TICK = { fontSize: 9, fill: '#64748b' };
const TOOLTIP_STYLE: React.CSSProperties = {
  background: '#1e293b',
  border: 'none',
  borderRadius: 8,
  fontSize: 11,
  color: '#f1f5f9',
};

// ── Cartesian (bar / line / area) ────────────────────────────────────────────
const CartesianChart: React.FC<{ spec: CartesianSpec; theme: CuratedColorSet; chartH: number }> = ({
  spec,
  theme,
  chartH,
}) => {
  const palette = theme.chartPalette;
  const rows = spec.categories.map((name, i) => {
    const row: Record<string, string | number> = { name };
    spec.series.forEach((s) => {
      row[s.label] = Number.isFinite(s.values[i]) ? s.values[i] : 0;
    });
    return row;
  });

  return (
    <ResponsiveContainer width="100%" height={chartH}>
      {spec.type === 'line' ? (
        <LineChart data={rows} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="name" tick={AXIS_TICK} />
          <YAxis tick={AXIS_TICK} width={28} />
          <Tooltip contentStyle={TOOLTIP_STYLE} />
          {spec.series.length > 1 && <Legend wrapperStyle={{ fontSize: 10 }} />}
          {spec.series.map((s, idx) => (
            <Line
              key={s.label}
              type="monotone"
              dataKey={s.label}
              stroke={palette[idx % palette.length]}
              strokeWidth={2}
              dot={{ r: 2 }}
            />
          ))}
        </LineChart>
      ) : spec.type === 'area' ? (
        <AreaChart data={rows} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="name" tick={AXIS_TICK} />
          <YAxis tick={AXIS_TICK} width={28} />
          <Tooltip contentStyle={TOOLTIP_STYLE} />
          {spec.series.length > 1 && <Legend wrapperStyle={{ fontSize: 10 }} />}
          {spec.series.map((s, idx) => (
            <Area
              key={s.label}
              type="monotone"
              dataKey={s.label}
              stroke={palette[idx % palette.length]}
              fill={palette[idx % palette.length]}
              fillOpacity={0.25}
              strokeWidth={2}
            />
          ))}
        </AreaChart>
      ) : (
        <BarChart data={rows} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="name" tick={AXIS_TICK} />
          <YAxis tick={AXIS_TICK} width={28} />
          <Tooltip contentStyle={TOOLTIP_STYLE} />
          {spec.series.length > 1 && <Legend wrapperStyle={{ fontSize: 10 }} />}
          {spec.series.map((s, idx) => (
            <Bar
              key={s.label}
              dataKey={s.label}
              fill={palette[idx % palette.length]}
              radius={[3, 3, 0, 0]}
            />
          ))}
        </BarChart>
      )}
    </ResponsiveContainer>
  );
};

// ── Pie / donut ──────────────────────────────────────────────────────────────
const PieChartView: React.FC<{ spec: PieSpec; theme: CuratedColorSet; chartH: number }> = ({
  spec,
  theme,
  chartH,
}) => {
  const palette = theme.chartPalette;
  return (
    <ResponsiveContainer width="100%" height={chartH}>
      <PieChart>
        <Pie
          data={spec.slices}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          outerRadius={chartH * 0.38}
          innerRadius={spec.type === 'donut' ? chartH * 0.22 : 0}
          paddingAngle={2}
          labelLine={false}
          label={({ name, percent }) => `${name} ${Math.round((percent ?? 0) * 100)}%`}
        >
          {spec.slices.map((_, idx) => (
            <Cell key={idx} fill={palette[idx % palette.length]} />
          ))}
        </Pie>
        <Tooltip contentStyle={TOOLTIP_STYLE} />
      </PieChart>
    </ResponsiveContainer>
  );
};

// ── Waterfall (bridge) — recharts stacked-bar approximation ───────────────────
const WaterfallChart: React.FC<{ spec: WaterfallSpec; theme: CuratedColorSet; chartH: number }> = ({
  spec,
  theme,
  chartH,
}) => {
  const palette = theme.chartPalette;
  // Float trick: transparent base up to `start`, coloured delta of height (end-start).
  const rows = spec.bars.map((b) => ({
    name: b.label,
    base: b.start,
    span: b.end - b.start,
    kind: b.kind,
  }));
  const colorFor = (kind: WaterfallSpec['bars'][number]['kind']) =>
    kind === 'total' ? palette[0] : kind === 'increase' ? RAG_COLORS.green : RAG_COLORS.red;

  return (
    <ResponsiveContainer width="100%" height={chartH}>
      <BarChart data={rows} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="name" tick={AXIS_TICK} />
        <YAxis tick={AXIS_TICK} width={28} domain={[spec.domain.min, spec.domain.max]} />
        <Tooltip contentStyle={TOOLTIP_STYLE} />
        <Bar dataKey="base" stackId="w" fill="transparent" />
        <Bar dataKey="span" stackId="w" radius={[3, 3, 0, 0]}>
          {rows.map((r, idx) => (
            <Cell key={idx} fill={colorFor(r.kind)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
};

// ── Matrix 2×2 — recharts-free scatter over quadrant grid ─────────────────────
const MatrixChart: React.FC<{ spec: Matrix2x2Spec; theme: CuratedColorSet; chartH: number }> = ({
  spec,
  theme,
  chartH,
}) => {
  const xs = spec.points.map((p) => p.x);
  const ys = spec.points.map((p) => p.y);
  const xMin = Math.min(...xs, spec.midpoints.x);
  const xMax = Math.max(...xs, spec.midpoints.x);
  const yMin = Math.min(...ys, spec.midpoints.y);
  const yMax = Math.max(...ys, spec.midpoints.y);
  const nx = (v: number) => (xMax === xMin ? 50 : ((v - xMin) / (xMax - xMin)) * 90 + 5);
  const ny = (v: number) => (yMax === yMin ? 50 : (1 - (v - yMin) / (yMax - yMin)) * 90 + 5);

  return (
    <div
      className="relative w-full rounded border"
      style={{ height: chartH, borderColor: '#e2e8f0' }}
    >
      {/* Axis crosshair at midpoints */}
      <div
        className="absolute inset-y-0 border-l border-dashed"
        style={{ left: `${nx(spec.midpoints.x)}%`, borderColor: '#cbd5e1' }}
      />
      <div
        className="absolute inset-x-0 border-t border-dashed"
        style={{ top: `${ny(spec.midpoints.y)}%`, borderColor: '#cbd5e1' }}
      />
      {spec.points.map((p, i) => (
        <div
          key={i}
          className="absolute -translate-x-1/2 -translate-y-1/2 flex items-center gap-1"
          style={{ left: `${nx(p.x)}%`, top: `${ny(p.y)}%` }}
        >
          <span
            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: theme.chartPalette[i % theme.chartPalette.length] }}
          />
          <span
            className="text-[8px] whitespace-nowrap"
            style={{ color: theme.colors.textPrimary }}
          >
            {p.label}
          </span>
        </div>
      ))}
      <span
        className="absolute bottom-0.5 right-1 text-[8px]"
        style={{ color: theme.colors.textSecondary }}
      >
        {spec.axisLabels.x} →
      </span>
      <span
        className="absolute top-0.5 left-1 text-[8px]"
        style={{ color: theme.colors.textSecondary }}
      >
        ↑ {spec.axisLabels.y}
      </span>
    </div>
  );
};

// ── RAG status — coloured chips ───────────────────────────────────────────────
const RagChart: React.FC<{ spec: RagSpec; theme: CuratedColorSet }> = ({ spec, theme }) => (
  <div className="flex flex-col gap-1">
    {spec.items.map((it, i) => (
      <div key={i} className="flex items-center gap-2">
        <span
          className="w-3 h-3 rounded-full flex-shrink-0"
          style={{ backgroundColor: RAG_COLORS[it.status] }}
        />
        <span className="text-[10px] flex-1 truncate" style={{ color: theme.colors.textPrimary }}>
          {it.label}
        </span>
        <span className="text-[10px] font-semibold" style={{ color: theme.colors.heading }}>
          {it.value}
        </span>
      </div>
    ))}
  </div>
);

// ── Marimekko — normalized rects (0..1) mapped to a flex-height container ──────
const MarimekkoChart: React.FC<{ spec: MarimekkoSpec; theme: CuratedColorSet; chartH: number }> = ({
  spec,
  theme,
  chartH,
}) => {
  const palette = theme.chartPalette;
  const segColor = (name: string) =>
    palette[Math.max(0, spec.segmentNames.indexOf(name)) % palette.length];
  return (
    <div className="w-full" style={{ height: chartH }}>
      <div className="relative w-full h-[85%]">
        {spec.rects.map((r, i) => (
          <div
            key={i}
            className="absolute flex items-center justify-center overflow-hidden"
            style={{
              left: `${r.x * 100}%`,
              top: `${r.y * 100}%`,
              width: `${r.w * 100}%`,
              height: `${r.h * 100}%`,
              backgroundColor: segColor(r.segmentName),
              outline: '1px solid rgba(255,255,255,0.6)',
            }}
          >
            {r.h > 0.15 && r.w > 0.12 && (
              <span className="text-[8px] text-white font-medium truncate px-0.5">
                {Math.round(r.shareOfTotal * 100)}%
              </span>
            )}
          </div>
        ))}
      </div>
      <div className="relative w-full h-[15%]">
        {spec.columnBounds.map((c, i) => (
          <span
            key={i}
            className="absolute text-[8px] text-center truncate"
            style={{
              left: `${c.x * 100}%`,
              width: `${c.w * 100}%`,
              color: theme.colors.textSecondary,
            }}
          >
            {c.label}
          </span>
        ))}
      </div>
    </div>
  );
};

// ── Harvey balls — quarter-fill circles ───────────────────────────────────────
const HarveyBallGlyph: React.FC<{ fraction: number; color: string }> = ({ fraction, color }) => {
  // 4 quadrant wedges filled by fraction (0, .25, .5, .75, 1).
  const filled = Math.round(fraction * 4);
  return (
    <svg width="14" height="14" viewBox="0 0 20 20">
      <circle cx="10" cy="10" r="9" fill="none" stroke={color} strokeWidth="1.5" />
      {filled >= 4 ? (
        <circle cx="10" cy="10" r="8" fill={color} />
      ) : (
        [0, 1, 2, 3].slice(0, filled).map((q) => {
          const paths = [
            'M10,10 L10,2 A8,8 0 0,1 18,10 Z',
            'M10,10 L18,10 A8,8 0 0,1 10,18 Z',
            'M10,10 L10,18 A8,8 0 0,1 2,10 Z',
            'M10,10 L2,10 A8,8 0 0,1 10,2 Z',
          ];
          return <path key={q} d={paths[q]} fill={color} />;
        })
      )}
    </svg>
  );
};

const HarveyChart: React.FC<{ spec: HarveySpec; theme: CuratedColorSet }> = ({ spec, theme }) => (
  <div className="flex flex-col gap-1">
    {spec.balls.map((b, i) => (
      <div key={i} className="flex items-center gap-2">
        <HarveyBallGlyph fraction={b.fillFraction} color={theme.chartPalette[0]} />
        <span className="text-[10px] flex-1 truncate" style={{ color: theme.colors.textPrimary }}>
          {b.label}
        </span>
        {b.note && (
          <span className="text-[9px]" style={{ color: theme.colors.textSecondary }}>
            {b.note}
          </span>
        )}
      </div>
    ))}
  </div>
);
