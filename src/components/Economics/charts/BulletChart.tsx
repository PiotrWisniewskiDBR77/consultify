/**
 * BulletChart — baseline-target-realized na jednym poziomym pasku
 * (FINANCE_VISUAL_CANON §3 "Bullet").
 *
 * - Tło-skala do `max`.
 * - Słupek `actual`: kolor wg osiągnięcia targetu (emerald ≥ target, amber blisko, rose daleko).
 * - Kreska pionowa `target`.
 * - Cień `forecast` (prognoza).
 * - Znacznik `baseline` (punkt startu).
 * - Etykieta + wartości.
 *
 * Reużywalny w liście: kompaktowy (height ~32px), czysty SVG, kolory wg §1.
 */

import React, { useMemo } from 'react';

// Kolory wg FINANCE_VISUAL_CANON §1 (Tailwind light mapping).
const COLOR = {
  positive: '#10b981', // emerald-500 — ≥ target
  warning: '#f59e0b', // amber-500 — blisko targetu
  negative: '#f43f5e', // rose-500 — daleko od targetu
  target: '#8b5cf6', // violet-500 — target (fin-accent)
  forecast: '#3b82f6', // blue-500 — prognoza (fin-progress)
  baseline: '#94a3b8', // slate-400 — baseline / start
  track: '#f1f5f9', // slate-100 — tło-skala
  text: '#475569', // slate-600
} as const;

export interface BulletChartProps {
  baseline: number;
  target: number;
  forecast?: number;
  actual: number;
  /** Górna granica skali. Domyślnie max(target, actual, forecast, baseline) * 1.1. */
  max?: number;
  label?: string;
  formatValue?: (value: number) => string;
  height?: number;
}

const defaultFormat = (value: number): string => {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(0)}k`;
  return `${Math.round(value)}`;
};

const VB_W = 320;

export const BulletChart: React.FC<BulletChartProps> = ({
  baseline,
  target,
  forecast,
  actual,
  max,
  label,
  formatValue = defaultFormat,
  height = 32,
}) => {
  const model = useMemo(() => {
    const hasForecast = typeof forecast === 'number' && Number.isFinite(forecast);
    const candidates = [target, actual, baseline, ...(hasForecast ? [forecast!] : [])].filter(
      (v) => Number.isFinite(v),
    );
    const rawMax = max ?? Math.max(1, ...candidates) * 1.1;
    const scaleMax = rawMax > 0 ? rawMax : 1;

    // Geometria: etykieta nad paskiem gdy jest miejsce; pasek na całej szerokości.
    const hasLabel = Boolean(label);
    const labelH = hasLabel && height >= 40 ? 14 : 0;
    const padX = 4;
    const trackY = labelH + (height - labelH) / 2 - 5;
    const trackH = 10;
    const innerW = VB_W - padX * 2;

    const x = (v: number) => padX + Math.max(0, Math.min(1, v / scaleMax)) * innerW;

    // Kolor osiągnięcia targetu.
    let actualColor: string = COLOR.positive;
    const ratio = target !== 0 ? actual / target : actual > 0 ? 1 : 0;
    if (ratio >= 1) actualColor = COLOR.positive;
    else if (ratio >= 0.85) actualColor = COLOR.warning;
    else actualColor = COLOR.negative;

    return {
      hasForecast,
      hasLabel,
      labelH,
      padX,
      trackY,
      trackH,
      innerW,
      scaleMax,
      actualColor,
      ratio,
      x,
    };
  }, [baseline, target, forecast, actual, max, label, height]);

  const { x } = model;
  const actualX = x(actual);
  const targetX = x(target);
  const baselineX = x(baseline);
  const forecastX = model.hasForecast ? x(forecast!) : null;

  return (
    <svg
      data-testid="bullet-chart"
      role="img"
      aria-label={`${label ? `${label}: ` : ''}realizacja ${formatValue(
        actual,
      )} z celu ${formatValue(target)} (${Math.round(model.ratio * 100)}%)`}
      viewBox={`0 0 ${VB_W} ${height}`}
      width="100%"
      height={height}
      preserveAspectRatio="xMidYMid meet"
    >
      {/* Etykieta + wartość (gdy jest miejsce) */}
      {model.hasLabel && model.labelH > 0 && (
        <>
          <text x={model.padX} y={10} fontSize={9} fontWeight={600} fill={COLOR.text}>
            {label}
          </text>
          <text x={VB_W - model.padX} y={10} fontSize={9} textAnchor="end" fill={model.actualColor}>
            {formatValue(actual)} / {formatValue(target)}
          </text>
        </>
      )}

      {/* Tło-skala */}
      <rect
        data-testid="bullet-track"
        x={model.padX}
        y={model.trackY}
        width={model.innerW}
        height={model.trackH}
        rx={2}
        fill={COLOR.track}
      />

      {/* Cień forecast (prognoza) */}
      {forecastX != null && (
        <rect
          data-testid="bullet-forecast"
          x={model.padX}
          y={model.trackY}
          width={Math.max(0, forecastX - model.padX)}
          height={model.trackH}
          rx={2}
          fill={COLOR.forecast}
          fillOpacity={0.18}
        >
          <title>Prognoza: {formatValue(forecast!)}</title>
        </rect>
      )}

      {/* Słupek actual */}
      <rect
        data-testid="bullet-actual"
        x={model.padX}
        y={model.trackY + 2.5}
        width={Math.max(0, actualX - model.padX)}
        height={model.trackH - 5}
        rx={1.5}
        fill={model.actualColor}
      >
        <title>
          Realizacja: {formatValue(actual)} ({Math.round(model.ratio * 100)}% celu)
        </title>
      </rect>

      {/* Znacznik baseline (start) */}
      <line
        data-testid="bullet-baseline"
        x1={baselineX}
        x2={baselineX}
        y1={model.trackY - 1}
        y2={model.trackY + model.trackH + 1}
        stroke={COLOR.baseline}
        strokeWidth={1.5}
        strokeDasharray="2 2"
      >
        <title>Baseline: {formatValue(baseline)}</title>
      </line>

      {/* Kreska target */}
      <line
        data-testid="bullet-target"
        x1={targetX}
        x2={targetX}
        y1={model.trackY - 3}
        y2={model.trackY + model.trackH + 3}
        stroke={COLOR.target}
        strokeWidth={2}
      >
        <title>Cel: {formatValue(target)}</title>
      </line>
    </svg>
  );
};

export default BulletChart;
