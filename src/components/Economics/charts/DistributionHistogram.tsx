/**
 * DistributionHistogram — M16 Monte Carlo NPV outcome distribution.
 *
 * Renders equal-width histogram bins (server: monteCarloNpvService.histogram())
 * as vertical bars, with optional vertical reference lines (mean/p10/p50/p90).
 * Custom SVG, `c-*` tokens only (FINANCE_VISUAL_CANON pattern — no chart
 * library, matches TornadoChart / SensitivityHeatmap in this folder).
 */
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

export interface HistogramBin {
  binStart: number;
  binEnd: number;
  count: number;
}

export interface HistogramMarker {
  label: string;
  value: number;
}

export interface DistributionHistogramProps {
  bins: HistogramBin[];
  /** Optional vertical reference lines (e.g. mean, p10, p50, p90). */
  markers?: HistogramMarker[];
  height?: number;
  formatValue?: (value: number) => string;
  emptyLabel?: string;
}

const defaultFormat = (value: number): string => {
  const abs = Math.abs(value);
  let formatted: string;
  if (abs >= 1_000_000_000) formatted = `${(value / 1_000_000_000).toFixed(1)}B`;
  else if (abs >= 1_000_000) formatted = `${(value / 1_000_000).toFixed(1)}M`;
  else if (abs >= 1_000) formatted = `${(value / 1_000).toFixed(0)}k`;
  else formatted = value.toFixed(0);
  return value < 0 ? `(${formatted.replace('-', '')})` : formatted;
};

const VIEW_W = 720;
const PAD_LEFT = 8;
const PAD_RIGHT = 8;
const PAD_TOP = 16;
const PAD_BOTTOM = 30;
const BAR_GAP = 2;

export const DistributionHistogram: React.FC<DistributionHistogramProps> = ({
  bins,
  markers = [],
  height = 220,
  formatValue = defaultFormat,
  emptyLabel = 'No data',
}) => {
  const { t } = useTranslation();
  const [hover, setHover] = useState<number | null>(null);

  const plotW = VIEW_W - PAD_LEFT - PAD_RIGHT;
  const plotH = height - PAD_TOP - PAD_BOTTOM;

  const maxCount = useMemo(() => bins.reduce((m, b) => Math.max(m, b.count), 0), [bins]);
  const domain = useMemo(() => {
    if (bins.length === 0) return { min: 0, max: 1 };
    return { min: bins[0].binStart, max: bins[bins.length - 1].binEnd };
  }, [bins]);

  const xScale = (v: number): number => {
    const span = domain.max - domain.min || 1;
    const t = (v - domain.min) / span;
    return PAD_LEFT + t * plotW;
  };

  if (bins.length === 0 || maxCount === 0) {
    return (
      <div
        data-testid="distribution-histogram"
        data-empty="true"
        role="img"
        aria-label={t(
          'finance.m16.monteCarlo.histogramEmptyAriaLabel',
          'NPV distribution histogram — no data'
        )}
        className="flex items-center justify-center rounded-xl border border-c-border bg-c-surface p-6 text-sm text-c-text-muted"
        style={{ minHeight: 120 }}
      >
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className="relative" data-testid="distribution-histogram">
      <svg
        viewBox={`0 0 ${VIEW_W} ${height}`}
        width="100%"
        role="img"
        aria-label={t('finance.m16.monteCarlo.histogramAriaLabel', 'NPV distribution histogram')}
        className="select-none"
      >
        {bins.map((bin, i) => {
          const x = xScale(bin.binStart);
          const w = Math.max(1, xScale(bin.binEnd) - xScale(bin.binStart) - BAR_GAP);
          const barH = maxCount > 0 ? (bin.count / maxCount) * plotH : 0;
          const y = PAD_TOP + (plotH - barH);
          const isHover = hover === i;
          return (
            <rect
              key={i}
              data-testid="histogram-bar"
              x={x}
              y={y}
              width={w}
              height={Math.max(0, barH)}
              rx={2}
              className="fill-c-chart-1"
              opacity={isHover ? 1 : 0.82}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover((h) => (h === i ? null : h))}
            />
          );
        })}

        {markers.map((m, i) => {
          if (!Number.isFinite(m.value) || m.value < domain.min || m.value > domain.max) {
            return null;
          }
          const x = xScale(m.value);
          return (
            <g key={`marker-${i}`} data-testid="histogram-marker" data-label={m.label}>
              <line
                x1={x}
                x2={x}
                y1={PAD_TOP}
                y2={PAD_TOP + plotH}
                className="stroke-c-text-secondary"
                strokeWidth={1.25}
                strokeDasharray="3 3"
              />
              <text
                x={x}
                y={height - 10}
                textAnchor="middle"
                className="fill-c-text-secondary text-[10px]"
              >
                {m.label}
              </text>
            </g>
          );
        })}

        <text
          x={PAD_LEFT}
          y={height - 2}
          textAnchor="start"
          className="fill-c-text-muted text-[10px]"
        >
          {formatValue(domain.min)}
        </text>
        <text
          x={VIEW_W - PAD_RIGHT}
          y={height - 2}
          textAnchor="end"
          className="fill-c-text-muted text-[10px]"
        >
          {formatValue(domain.max)}
        </text>
      </svg>

      {hover !== null && bins[hover] && (
        <div
          data-testid="histogram-tooltip"
          className="pointer-events-none absolute left-1/2 top-2 -translate-x-1/2 rounded-md border border-c-border bg-c-surface px-3 py-2 text-xs shadow-md"
        >
          <div className="font-semibold text-c-text">
            {formatValue(bins[hover].binStart)} – {formatValue(bins[hover].binEnd)}
          </div>
          <div className="text-c-text-muted">{bins[hover].count}</div>
        </div>
      )}
    </div>
  );
};

export default DistributionHistogram;
