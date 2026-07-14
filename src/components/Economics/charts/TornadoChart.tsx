/**
 * TornadoChart — kanoniczny prymityw M16 Finanse (FINANCE_VISUAL_CANON §3).
 *
 * Wrażliwość jednozmiennowa (one-way sensitivity): dla każdego drivera pokazuje
 * przedział wyniku, gdy driver przyjmuje wartość min (`low`) i max (`high`),
 * wycentrowany na `base`. Słupki posortowane malejąco po |high − low| — driver
 * o największym wpływie na górze (kształt „tornada").
 *
 * Kolory wg §1: część poniżej `base` = strata (--fin-negative / rose),
 * część powyżej `base` = zysk (--fin-positive / emerald).
 */

import React, { useMemo, useState } from 'react';

export interface TornadoBar {
  /** Nazwa drivera (np. „WACC", „Cena jednostkowa"). */
  label: string;
  /** Wartość wyniku, gdy driver na minimum. */
  low: number;
  /** Wartość wyniku, gdy driver na maksimum. */
  high: number;
}

export interface TornadoChartProps {
  bars: TornadoBar[];
  /** Wartość bazowa wyniku (oś centralna). */
  base: number;
  /** Wysokość SVG w px (domyślnie wyliczana z liczby słupków). */
  height?: number;
  /** Formatter wartości do tooltipa/etykiet. */
  formatValue?: (value: number) => string;
}

const defaultFormat = (value: number): string => {
  const abs = Math.abs(value);
  let formatted: string;
  if (abs >= 1_000_000_000) formatted = `${(value / 1_000_000_000).toFixed(1)} mld`;
  else if (abs >= 1_000_000) formatted = `${(value / 1_000_000).toFixed(1)}M`;
  else if (abs >= 1_000) formatted = `${(value / 1_000).toFixed(0)}k`;
  else formatted = value.toFixed(0);
  return value < 0 ? `(${formatted.replace('-', '')})` : formatted;
};

const VIEW_W = 720;
const LABEL_W = 150;
const PAD_RIGHT = 24;
const PAD_TOP = 16;
const PAD_BOTTOM = 28;
const BAR_H = 24;
const BAR_GAP = 14;

export const TornadoChart: React.FC<TornadoChartProps> = ({
  bars,
  base,
  height,
  formatValue = defaultFormat,
}) => {
  const [hover, setHover] = useState<number | null>(null);

  const sorted = useMemo(
    () => [...bars].sort((a, b) => Math.abs(b.high - b.low) - Math.abs(a.high - a.low)),
    [bars]
  );

  const rowH = BAR_H + BAR_GAP;
  const plotH = sorted.length * rowH;
  const svgH = height ?? plotH + PAD_TOP + PAD_BOTTOM;
  const plotW = VIEW_W - LABEL_W - PAD_RIGHT;

  // Domena: rozpiętość wszystkich low/high oraz base, symetryzowana wokół base
  // tak, by oś centralna (base) była w środku obszaru wykresu.
  const domain = useMemo(() => {
    const vals = sorted.flatMap((b) => [b.low, b.high]);
    vals.push(base);
    let min = Math.min(...vals, base);
    let max = Math.max(...vals, base);
    if (min === max) {
      min -= 1;
      max += 1;
    }
    const spread = Math.max(base - min, max - base) || 1;
    return { min: base - spread, max: base + spread, spread };
  }, [sorted, base]);

  const xScale = (v: number): number => {
    const t = (v - domain.min) / (domain.max - domain.min);
    return LABEL_W + t * plotW;
  };

  const baseX = xScale(base);

  if (!bars.length) {
    return (
      <div
        data-testid="tornado-chart"
        className="flex items-center justify-center rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-500"
      >
        Brak danych — dodaj drivery wrażliwości
      </div>
    );
  }

  return (
    <div className="relative">
      <svg
        data-testid="tornado-chart"
        viewBox={`0 0 ${VIEW_W} ${svgH}`}
        width="100%"
        role="img"
        aria-label="Wykres tornado — wrażliwość jednozmiennowa"
        className="select-none"
      >
        {/* Linia bazowa (pionowa) */}
        <line
          data-testid="tornado-base-line"
          x1={baseX}
          x2={baseX}
          y1={PAD_TOP}
          y2={PAD_TOP + plotH}
          className="stroke-slate-400 dark:stroke-slate-500"
          strokeWidth={1.5}
          strokeDasharray="4 3"
        />
        <text
          x={baseX}
          y={PAD_TOP + plotH + 18}
          textAnchor="middle"
          className="fill-slate-500 text-[11px] dark:fill-slate-400"
        >
          baza {formatValue(base)}
        </text>

        {sorted.map((bar, i) => {
          const y = PAD_TOP + i * rowH;
          const xLow = xScale(bar.low);
          const xHigh = xScale(bar.high);
          // część poniżej base (strata) = rose; powyżej base (zysk) = emerald
          const negFrom = Math.min(xLow, xHigh, baseX);
          const negTo = baseX;
          const posFrom = baseX;
          const posTo = Math.max(xLow, xHigh, baseX);
          const isHover = hover === i;

          return (
            <g
              key={`${bar.label}-${i}`}
              data-testid="tornado-bar"
              data-label={bar.label}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover((h) => (h === i ? null : h))}
            >
              {/* segment straty (poniżej base) */}
              {negTo > negFrom && (
                <rect
                  x={negFrom}
                  y={y}
                  width={negTo - negFrom}
                  height={BAR_H}
                  rx={3}
                  className="fill-rose-500/85 dark:fill-rose-500/70"
                  opacity={isHover ? 1 : 0.92}
                />
              )}
              {/* segment zysku (powyżej base) */}
              {posTo > posFrom && (
                <rect
                  x={posFrom}
                  y={y}
                  width={posTo - posFrom}
                  height={BAR_H}
                  rx={3}
                  className="fill-emerald-500/85 dark:fill-emerald-500/70"
                  opacity={isHover ? 1 : 0.92}
                />
              )}
              {/* etykieta drivera po lewej */}
              <text
                x={LABEL_W - 10}
                y={y + BAR_H / 2 + 4}
                textAnchor="end"
                className="fill-slate-700 text-[12px] dark:fill-slate-200"
              >
                {bar.label}
              </text>
            </g>
          );
        })}
      </svg>

      {hover !== null && sorted[hover] && (
        <div
          data-testid="tornado-tooltip"
          className="pointer-events-none absolute left-1/2 top-2 -translate-x-1/2 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs shadow-md dark:border-slate-700 dark:bg-slate-800"
        >
          <div className="font-semibold text-slate-800 dark:text-slate-100">
            {sorted[hover].label}
          </div>
          <div className="text-slate-500 dark:text-slate-400">
            min {formatValue(sorted[hover].low)} · max {formatValue(sorted[hover].high)}
          </div>
          <div className="text-slate-400 dark:text-slate-500">
            wpływ {formatValue(Math.abs(sorted[hover].high - sorted[hover].low))}
          </div>
        </div>
      )}
    </div>
  );
};

export default TornadoChart;
