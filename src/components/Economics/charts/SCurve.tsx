/**
 * SCurve — S-curve realizacji wartości w czasie (FINANCE_VISUAL_CANON §3 "S-curve").
 *
 * Skumulowana wartość (cum) per okres dla planu i realizacji.
 * - Linia plan: szara slate, przerywana (baseline / plan).
 * - Linia actual: emerald gdy ≥ plan w ostatnim wspólnym punkcie, amber/rose gdy poniżej.
 * - Wypełnienie obszaru pod actual + zacieniony gap plan-vs-actual.
 * - Oś X = okresy, Y = skumulowana wartość, znacznik „dziś".
 *
 * Czysty SVG, props-driven, kolory wg §1 (znaczeniowe). aria-label + tooltip (title).
 */

import React, { useMemo, useState } from 'react';

// Kolory wg FINANCE_VISUAL_CANON §1 (Tailwind light mapping).
const COLOR = {
  positive: '#10b981', // emerald-500 — on-track / realized ≥ plan
  warning: '#f59e0b', // amber-500 — at-risk / poniżej progu
  negative: '#f43f5e', // rose-500 — missed / strata
  baseline: '#94a3b8', // slate-400 — plan / neutral
  grid: '#e2e8f0', // slate-200
  axis: '#64748b', // slate-500
} as const;

export interface SCurvePoint {
  t: string | number;
  cum: number;
}

export interface SCurveProps {
  plan: SCurvePoint[];
  actual?: SCurvePoint[];
  height?: number;
  /** Format wartości osi/tooltipa. Domyślnie skala k/M. */
  formatValue?: (value: number) => string;
  /** Etykieta okresu w tooltipie (np. "Miesiąc"). */
  periodLabel?: string;
}

const defaultFormat = (value: number): string => {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(0)}k`;
  return `${Math.round(value)}`;
};

const PAD = { top: 16, right: 16, bottom: 28, left: 48 };
const VB_W = 640;

export const SCurve: React.FC<SCurveProps> = ({
  plan,
  actual,
  height = 240,
  formatValue = defaultFormat,
  periodLabel = 'Okres',
}) => {
  const [hover, setHover] = useState<number | null>(null);

  const model = useMemo(() => {
    const hasActual = Array.isArray(actual) && actual.length > 0;
    const innerW = VB_W - PAD.left - PAD.right;
    const innerH = height - PAD.top - PAD.bottom;

    const allCum = [...plan.map((p) => p.cum), ...(hasActual ? actual!.map((a) => a.cum) : []), 0];
    const maxY = Math.max(1, ...allCum);
    const minY = Math.min(0, ...allCum);
    const rangeY = maxY - minY || 1;

    // Oś X indeksowana po pozycji (równe odstępy okresów); plan jest osią odniesienia.
    const n = Math.max(plan.length, hasActual ? actual!.length : 0);
    const stepX = n > 1 ? innerW / (n - 1) : 0;

    const x = (i: number) => PAD.left + stepX * i;
    const y = (v: number) => PAD.top + innerH - ((v - minY) / rangeY) * innerH;

    const planPts = plan.map((p, i) => ({ ...p, px: x(i), py: y(p.cum) }));
    const actualPts = hasActual ? actual!.map((a, i) => ({ ...a, px: x(i), py: y(a.cum) })) : [];

    // Ocena realizacji w ostatnim wspólnym punkcie.
    const lastIdx = hasActual ? actualPts.length - 1 : -1;
    let actualColor: string = COLOR.positive;
    if (hasActual && lastIdx >= 0 && plan[lastIdx]) {
      const planV = plan[lastIdx].cum;
      const actV = actual![lastIdx].cum;
      if (actV >= planV) actualColor = COLOR.positive;
      else if (actV >= planV * 0.9) actualColor = COLOR.warning;
      else actualColor = COLOR.negative;
    }

    const toLine = (pts: { px: number; py: number }[]) =>
      pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.px.toFixed(2)},${p.py.toFixed(2)}`).join(' ');

    const planPath = toLine(planPts);
    const actualPath = hasActual ? toLine(actualPts) : '';

    const baselineY = y(Math.max(0, minY));
    const actualArea = hasActual
      ? `${actualPath} L${actualPts[actualPts.length - 1].px.toFixed(2)},${baselineY.toFixed(
          2
        )} L${actualPts[0].px.toFixed(2)},${baselineY.toFixed(2)} Z`
      : '';

    // Gap plan-vs-actual: obszar między dwiema liniami (do wspólnego indeksu).
    let gapPath = '';
    if (hasActual && actualPts.length > 1) {
      const common = Math.min(planPts.length, actualPts.length);
      const planSeg = planPts.slice(0, common);
      const actSeg = actualPts.slice(0, common);
      const down = toLine(actSeg);
      const back = planSeg
        .slice()
        .reverse()
        .map((p) => `L${p.px.toFixed(2)},${p.py.toFixed(2)}`)
        .join(' ');
      gapPath = `${down} ${back} Z`;
    }

    // „Dziś" = ostatni okres z realizacją.
    const todayX = hasActual && actualPts.length > 0 ? actualPts[actualPts.length - 1].px : null;

    // Punkty hover (po pozycji okresu).
    const hoverCols = Array.from({ length: n }, (_, i) => ({
      i,
      px: x(i),
      plan: plan[i] ? plan[i].cum : null,
      actual: hasActual && actual![i] ? actual![i].cum : null,
      t: (plan[i] ?? (hasActual ? actual![i] : undefined))?.t,
    }));

    const yTicks = [minY, minY + rangeY / 2, maxY].map((v) => ({ v, py: y(v) }));

    return {
      hasActual,
      planPath,
      actualPath,
      actualArea,
      gapPath,
      actualColor,
      todayX,
      hoverCols,
      stepX,
      innerH,
      yTicks,
    };
  }, [plan, actual, height]);

  if (!plan || plan.length === 0) {
    return (
      <div
        data-testid="s-curve"
        role="img"
        aria-label="Krzywa S — brak danych"
        className="flex items-center justify-center text-xs text-slate-500"
        style={{ height }}
      >
        Brak danych — dodaj plan realizacji
      </div>
    );
  }

  const hoverCol = hover != null ? model.hoverCols[hover] : null;

  return (
    <svg
      data-testid="s-curve"
      role="img"
      aria-label="Krzywa S realizacji wartości: plan vs realizacja"
      viewBox={`0 0 ${VB_W} ${height}`}
      width="100%"
      height={height}
      preserveAspectRatio="xMidYMid meet"
      onMouseLeave={() => setHover(null)}
    >
      {/* Osie / siatka Y */}
      {model.yTicks.map((tick, i) => (
        <g key={`yt-${i}`}>
          <line
            x1={PAD.left}
            x2={VB_W - PAD.right}
            y1={tick.py}
            y2={tick.py}
            stroke={COLOR.grid}
            strokeWidth={1}
          />
          <text x={PAD.left - 6} y={tick.py + 3} textAnchor="end" fontSize={9} fill={COLOR.axis}>
            {formatValue(tick.v)}
          </text>
        </g>
      ))}

      {/* Gap plan-vs-actual (zacieniony) */}
      {model.gapPath && (
        <path
          data-testid="sc-gap"
          d={model.gapPath}
          fill={model.actualColor}
          fillOpacity={0.12}
          stroke="none"
        />
      )}

      {/* Wypełnienie obszaru pod actual */}
      {model.actualArea && (
        <path d={model.actualArea} fill={model.actualColor} fillOpacity={0.08} stroke="none" />
      )}

      {/* Linia plan — szara, przerywana */}
      <path
        data-testid="sc-plan"
        d={model.planPath}
        fill="none"
        stroke={COLOR.baseline}
        strokeWidth={1.75}
        strokeDasharray="5 4"
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {/* Linia actual — kolor wg realizacji */}
      {model.actualPath && (
        <path
          data-testid="sc-actual"
          d={model.actualPath}
          fill="none"
          stroke={model.actualColor}
          strokeWidth={2.25}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      )}

      {/* Znacznik „dziś" */}
      {model.todayX != null && (
        <g data-testid="sc-today">
          <line
            x1={model.todayX}
            x2={model.todayX}
            y1={PAD.top}
            y2={PAD.top + model.innerH}
            stroke={COLOR.axis}
            strokeWidth={1}
            strokeDasharray="2 3"
          />
          <text x={model.todayX} y={PAD.top - 4} textAnchor="middle" fontSize={8} fill={COLOR.axis}>
            dziś
          </text>
        </g>
      )}

      {/* Strefy hover + tooltip */}
      {model.hoverCols.map((col) => (
        <rect
          key={`hz-${col.i}`}
          x={col.px - model.stepX / 2}
          y={PAD.top}
          width={Math.max(model.stepX, 8)}
          height={model.innerH}
          fill="transparent"
          onMouseEnter={() => setHover(col.i)}
        >
          <title>
            {`${periodLabel} ${col.t ?? col.i}`}
            {col.plan != null ? ` · plan ${formatValue(col.plan)}` : ''}
            {col.actual != null ? ` · realizacja ${formatValue(col.actual)}` : ''}
          </title>
        </rect>
      ))}

      {hoverCol && (
        <line
          x1={hoverCol.px}
          x2={hoverCol.px}
          y1={PAD.top}
          y2={PAD.top + model.innerH}
          stroke={COLOR.axis}
          strokeWidth={0.75}
          strokeOpacity={0.5}
          pointerEvents="none"
        />
      )}
    </svg>
  );
};

export default SCurve;
