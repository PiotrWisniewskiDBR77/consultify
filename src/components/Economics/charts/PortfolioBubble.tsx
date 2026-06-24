/**
 * PortfolioBubble — kanoniczny prymityw M16 Finanse (FINANCE_VISUAL_CANON §3).
 *
 * Wykres bąbelkowy portfela: scatter X×Y (np. ryzyko × NPV), promień bąbla
 * proporcjonalny do √size (nakład inwestycyjny — pole oddaje wielkość).
 * Opcjonalne linie kwadrantów (mediana x/y) z etykietami decyzyjnymi
 * fund / defer / kill. Kolory wg §1.
 */

import React, { useMemo, useState } from 'react';

export interface PortfolioPoint {
  id: string;
  x: number;
  y: number;
  /** Wielkość (np. nakład) — promień ∝ √size. */
  size: number;
  /** Kolor bąbla (CSS). Gdy brak — skala wg wartości y. */
  color?: string;
  label?: string;
}

export interface PortfolioBubbleProps {
  points: PortfolioPoint[];
  xLabel?: string;
  yLabel?: string;
  /** Czy rysować linie kwadrantów (mediana x/y) + etykiety decyzyjne. */
  quadrants?: boolean;
  height?: number;
  onSelect?: (id: string) => void;
}

const VIEW_W = 720;
const PAD_LEFT = 56;
const PAD_RIGHT = 24;
const PAD_TOP = 20;
const PAD_BOTTOM = 44;
const MIN_R = 6;
const MAX_R = 34;

const median = (nums: number[]): number => {
  if (!nums.length) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

export const PortfolioBubble: React.FC<PortfolioBubbleProps> = ({
  points,
  xLabel = 'Ryzyko',
  yLabel = 'NPV',
  quadrants = false,
  height = 420,
  onSelect,
}) => {
  const [hover, setHover] = useState<string | null>(null);

  const svgH = height;
  const plotW = VIEW_W - PAD_LEFT - PAD_RIGHT;
  const plotH = svgH - PAD_TOP - PAD_BOTTOM;

  const dom = useMemo(() => {
    if (!points.length) {
      return { xMin: 0, xMax: 1, yMin: 0, yMax: 1, sMax: 1, xMed: 0.5, yMed: 0.5 };
    }
    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);
    const padX = (Math.max(...xs) - Math.min(...xs)) * 0.1 || 1;
    const padY = (Math.max(...ys) - Math.min(...ys)) * 0.1 || 1;
    return {
      xMin: Math.min(...xs) - padX,
      xMax: Math.max(...xs) + padX,
      yMin: Math.min(...ys) - padY,
      yMax: Math.max(...ys) + padY,
      sMax: Math.max(...points.map((p) => Math.max(0, p.size))) || 1,
      xMed: median(xs),
      yMed: median(ys),
    };
  }, [points]);

  const xScale = (v: number) =>
    PAD_LEFT + ((v - dom.xMin) / (dom.xMax - dom.xMin || 1)) * plotW;
  const yScale = (v: number) =>
    PAD_TOP + plotH - ((v - dom.yMin) / (dom.yMax - dom.yMin || 1)) * plotH;
  const rScale = (s: number) =>
    MIN_R + (Math.sqrt(Math.max(0, s)) / Math.sqrt(dom.sMax || 1)) * (MAX_R - MIN_R);

  if (!points.length) {
    return (
      <div
        data-testid="portfolio-bubble"
        className="flex items-center justify-center rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-500"
      >
        Brak danych — dodaj pozycje portfela
      </div>
    );
  }

  const qx = xScale(dom.xMed);
  const qy = yScale(dom.yMed);
  const hovered = points.find((p) => p.id === hover) || null;

  return (
    <div className="relative">
      <svg
        data-testid="portfolio-bubble"
        viewBox={`0 0 ${VIEW_W} ${svgH}`}
        width="100%"
        role="img"
        aria-label={`Wykres bąbelkowy portfela — ${xLabel} × ${yLabel}`}
        className="select-none"
      >
        {/* Osie */}
        <line
          x1={PAD_LEFT}
          x2={PAD_LEFT}
          y1={PAD_TOP}
          y2={PAD_TOP + plotH}
          className="stroke-slate-300 dark:stroke-slate-600"
          strokeWidth={1}
        />
        <line
          x1={PAD_LEFT}
          x2={PAD_LEFT + plotW}
          y1={PAD_TOP + plotH}
          y2={PAD_TOP + plotH}
          className="stroke-slate-300 dark:stroke-slate-600"
          strokeWidth={1}
        />
        <text
          x={PAD_LEFT + plotW / 2}
          y={svgH - 10}
          textAnchor="middle"
          className="fill-slate-500 text-[12px] dark:fill-slate-400"
        >
          {xLabel}
        </text>
        <text
          x={16}
          y={PAD_TOP + plotH / 2}
          textAnchor="middle"
          transform={`rotate(-90 16 ${PAD_TOP + plotH / 2})`}
          className="fill-slate-500 text-[12px] dark:fill-slate-400"
        >
          {yLabel}
        </text>

        {/* Kwadranty (mediana x/y) + etykiety decyzyjne */}
        {quadrants && (
          <g data-testid="portfolio-quadrants">
            <line
              x1={qx}
              x2={qx}
              y1={PAD_TOP}
              y2={PAD_TOP + plotH}
              className="stroke-slate-300 dark:stroke-slate-600"
              strokeWidth={1}
              strokeDasharray="4 4"
            />
            <line
              x1={PAD_LEFT}
              x2={PAD_LEFT + plotW}
              y1={qy}
              y2={qy}
              className="stroke-slate-300 dark:stroke-slate-600"
              strokeWidth={1}
              strokeDasharray="4 4"
            />
            {/* góra-lewo: wysoki NPV, niskie ryzyko = fund */}
            <text
              x={PAD_LEFT + 8}
              y={PAD_TOP + 14}
              className="fill-emerald-600 text-[11px] font-medium dark:fill-emerald-400"
            >
              fund
            </text>
            {/* góra-prawo: wysoki NPV, wysokie ryzyko = defer */}
            <text
              x={PAD_LEFT + plotW - 8}
              y={PAD_TOP + 14}
              textAnchor="end"
              className="fill-amber-600 text-[11px] font-medium dark:fill-amber-400"
            >
              defer
            </text>
            {/* dół-prawo: niski NPV, wysokie ryzyko = kill */}
            <text
              x={PAD_LEFT + plotW - 8}
              y={PAD_TOP + plotH - 8}
              textAnchor="end"
              className="fill-rose-600 text-[11px] font-medium dark:fill-rose-400"
            >
              kill
            </text>
            {/* dół-lewo: niski NPV, niskie ryzyko = defer */}
            <text
              x={PAD_LEFT + 8}
              y={PAD_TOP + plotH - 8}
              className="fill-amber-600 text-[11px] font-medium dark:fill-amber-400"
            >
              defer
            </text>
          </g>
        )}

        {/* Bąble */}
        {points.map((p) => {
          const cx = xScale(p.x);
          const cy = yScale(p.y);
          const r = rScale(p.size);
          const isHover = hover === p.id;
          const fill = p.color ?? 'var(--fin-progress, #3b82f6)';
          return (
            <g
              key={p.id}
              data-testid="bubble"
              data-id={p.id}
              role={onSelect ? 'button' : undefined}
              tabIndex={onSelect ? 0 : undefined}
              aria-label={p.label ?? p.id}
              onMouseEnter={() => setHover(p.id)}
              onMouseLeave={() => setHover((h) => (h === p.id ? null : h))}
              onClick={() => onSelect?.(p.id)}
              onKeyDown={(e) => {
                if (onSelect && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault();
                  onSelect(p.id);
                }
              }}
              style={{ cursor: onSelect ? 'pointer' : 'default' }}
            >
              <circle
                cx={cx}
                cy={cy}
                r={r}
                fill={fill}
                opacity={isHover ? 0.95 : 0.65}
                stroke={isHover ? fill : 'transparent'}
                strokeWidth={isHover ? 2 : 0}
              />
            </g>
          );
        })}
      </svg>

      {hovered && (
        <div
          data-testid="portfolio-tooltip"
          className="pointer-events-none absolute left-1/2 top-2 -translate-x-1/2 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs shadow-md dark:border-slate-700 dark:bg-slate-800"
        >
          <div className="font-semibold text-slate-800 dark:text-slate-100">
            {hovered.label ?? hovered.id}
          </div>
          <div className="text-slate-500 dark:text-slate-400">
            {xLabel}: {hovered.x} · {yLabel}: {hovered.y}
          </div>
          <div className="text-slate-400 dark:text-slate-500">
            nakład: {hovered.size}
          </div>
        </div>
      )}
    </div>
  );
};

export default PortfolioBubble;
