/**
 * FootballField — kanoniczny prymityw wyceny (FINANCE_VISUAL_CANON §3, "Football Field").
 *
 * Poziome pasy zakresów (jeden wiersz per metoda wyceny: DCF / comps / NAV),
 * pas low→high z markerem mid, wspólna oś X (wartość). Opcjonalna pionowa linia
 * `point` (np. obecna wycena) służy triangulacji (canon 1.2).
 *
 * Kolory wg §1: pasy slate/blue (--fin-baseline/--fin-progress), marker violet
 * (--fin-accent), linia point = accent. Czysty SVG (viewBox, responsywny),
 * props-driven, data-testid, aria-label.
 */

import React, { useMemo } from 'react';

export interface FootballFieldRange {
  /** Etykieta metody wyceny, np. "DCF", "Comparables", "NAV". */
  label: string;
  /** Dolna granica zakresu. */
  low: number;
  /** Wartość środkowa / punktowa estymacja (marker). */
  mid: number;
  /** Górna granica zakresu. */
  high: number;
}

export interface FootballFieldProps {
  ranges: FootballFieldRange[];
  /** Opcjonalna pojedyncza wartość referencyjna (np. obecna wycena) — pionowa linia triangulacji. */
  point?: number;
  /** Wysokość SVG w px (domyślnie wyliczana z liczby pasów). */
  height?: number;
  /** Formatowanie wartości na osi/tooltipie. Domyślnie skala k/M. */
  formatValue?: (value: number) => string;
}

const defaultFormatValue = (value: number): string => {
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)} mld`;
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(0)}k`;
  return value.toFixed(0);
};

const VIEW_WIDTH = 720;
const PAD_LEFT = 132; // miejsce na etykiety metod
const PAD_RIGHT = 32;
const PAD_TOP = 16;
const PAD_BOTTOM = 40; // miejsce na oś X
const ROW_HEIGHT = 44;
const BAR_HEIGHT = 18;

export const FootballField: React.FC<FootballFieldProps> = ({
  ranges,
  point,
  height,
  formatValue = defaultFormatValue,
}) => {
  const safeRanges = useMemo(
    () => (Array.isArray(ranges) ? ranges.filter((r) => r && Number.isFinite(r.low) && Number.isFinite(r.high)) : []),
    [ranges]
  );

  const { domainMin, domainMax } = useMemo(() => {
    let min = Infinity;
    let max = -Infinity;
    for (const r of safeRanges) {
      min = Math.min(min, r.low, r.high, Number.isFinite(r.mid) ? r.mid : r.low);
      max = Math.max(max, r.low, r.high, Number.isFinite(r.mid) ? r.mid : r.high);
    }
    if (Number.isFinite(point as number)) {
      min = Math.min(min, point as number);
      max = Math.max(max, point as number);
    }
    if (!Number.isFinite(min) || !Number.isFinite(max)) {
      return { domainMin: 0, domainMax: 1 };
    }
    if (min === max) {
      // Degeneracja — rozszerz domenę żeby skala miała sens.
      const pad = Math.abs(min) || 1;
      return { domainMin: min - pad, domainMax: max + pad };
    }
    const span = max - min;
    return { domainMin: min - span * 0.05, domainMax: max + span * 0.05 };
  }, [safeRanges, point]);

  const plotWidth = VIEW_WIDTH - PAD_LEFT - PAD_RIGHT;
  const viewHeight = height ?? safeRanges.length * ROW_HEIGHT + PAD_TOP + PAD_BOTTOM;
  const plotHeight = viewHeight - PAD_TOP - PAD_BOTTOM;
  const rowSpan = safeRanges.length > 0 ? plotHeight / safeRanges.length : plotHeight;

  const xScale = (value: number): number => {
    const ratio = (value - domainMin) / (domainMax - domainMin);
    return PAD_LEFT + Math.max(0, Math.min(1, ratio)) * plotWidth;
  };

  // Znaczniki osi X (5 ticków).
  const ticks = useMemo(() => {
    const n = 4;
    return Array.from({ length: n + 1 }, (_, i) => domainMin + ((domainMax - domainMin) * i) / n);
  }, [domainMin, domainMax]);

  const axisY = PAD_TOP + plotHeight;

  // Pusty stan (canon §4) — po wszystkich hookach (rules of hooks).
  if (safeRanges.length === 0) {
    return (
      <div
        data-testid="football-field"
        data-empty="true"
        role="img"
        aria-label="Football field wyceny — brak danych"
        className="flex items-center justify-center rounded-xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-500 dark:border-navy-700 dark:bg-navy-800 dark:text-slate-400"
        style={{ minHeight: 120 }}
      >
        Brak danych — dodaj metody wyceny
      </div>
    );
  }

  return (
    <div
      data-testid="football-field"
      role="img"
      aria-label={`Football field wyceny — ${safeRanges.length} metod`}
      className="w-full"
    >
      <svg
        viewBox={`0 0 ${VIEW_WIDTH} ${viewHeight}`}
        width="100%"
        height={height ?? viewHeight}
        preserveAspectRatio="xMidYMid meet"
        style={{ display: 'block' }}
      >
        {/* Linie siatki pionowe (ticki). */}
        {ticks.map((t, i) => {
          const x = xScale(t);
          return (
            <g key={`tick-${i}`}>
              <line
                x1={x}
                y1={PAD_TOP}
                x2={x}
                y2={axisY}
                stroke="rgb(226 232 240)"
                strokeWidth={1}
                strokeDasharray="3 3"
              />
              <text
                x={x}
                y={axisY + 18}
                textAnchor="middle"
                fontSize={11}
                fill="rgb(100 116 139)"
              >
                {formatValue(t)}
              </text>
            </g>
          );
        })}

        {/* Oś X. */}
        <line x1={PAD_LEFT} y1={axisY} x2={VIEW_WIDTH - PAD_RIGHT} y2={axisY} stroke="rgb(148 163 184)" strokeWidth={1} />

        {/* Pasy zakresów. */}
        {safeRanges.map((r, i) => {
          const rowTop = PAD_TOP + i * rowSpan;
          const cy = rowTop + rowSpan / 2;
          const lo = Math.min(r.low, r.high);
          const hi = Math.max(r.low, r.high);
          const x1 = xScale(lo);
          const x2 = xScale(hi);
          const hasMid = Number.isFinite(r.mid);
          const midX = hasMid ? xScale(r.mid) : (x1 + x2) / 2;
          return (
            <g key={`range-${i}`} data-testid="ff-range" data-label={r.label}>
              {/* Etykieta metody. */}
              <text
                x={PAD_LEFT - 12}
                y={cy + 4}
                textAnchor="end"
                fontSize={12}
                fontWeight={600}
                fill="rgb(51 65 85)"
              >
                {r.label}
              </text>
              {/* Pas low→high (slate baseline z blue obrysem progress). */}
              <rect
                x={x1}
                y={cy - BAR_HEIGHT / 2}
                width={Math.max(2, x2 - x1)}
                height={BAR_HEIGHT}
                rx={4}
                fill="rgb(203 213 225)"
                stroke="rgb(59 130 246)"
                strokeWidth={1.5}
                opacity={0.9}
              >
                <title>
                  {r.label}: {formatValue(lo)} – {formatValue(hi)}
                  {hasMid ? ` (mid ${formatValue(r.mid)})` : ''}
                </title>
              </rect>
              {/* Marker mid (violet accent). */}
              <line
                x1={midX}
                y1={cy - BAR_HEIGHT / 2 - 3}
                x2={midX}
                y2={cy + BAR_HEIGHT / 2 + 3}
                stroke="rgb(139 92 246)"
                strokeWidth={2.5}
                data-testid="ff-mid-marker"
              >
                <title>
                  {r.label} mid: {formatValue(hasMid ? r.mid : (lo + hi) / 2)}
                </title>
              </line>
            </g>
          );
        })}

        {/* Pionowa linia point (triangulacja) — accent. */}
        {Number.isFinite(point as number) && (
          <g data-testid="ff-point-line">
            <line
              x1={xScale(point as number)}
              y1={PAD_TOP - 4}
              x2={xScale(point as number)}
              y2={axisY}
              stroke="rgb(139 92 246)"
              strokeWidth={2}
              strokeDasharray="5 4"
            />
            <text
              x={xScale(point as number)}
              y={PAD_TOP - 6}
              textAnchor="middle"
              fontSize={11}
              fontWeight={600}
              fill="rgb(124 58 237)"
            >
              {formatValue(point as number)}
            </text>
            <title>Punkt referencyjny: {formatValue(point as number)}</title>
          </g>
        )}
      </svg>
    </div>
  );
};

export default FootballField;
