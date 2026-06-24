/**
 * FinanceWaterfall — kanoniczny prymityw "value bridge" / "variance bridge" M16.
 *
 * Zgodny z docs/ui-standards/03-modules/FINANCE_VISUAL_CANON.md:
 *  - §1 semantyka kolorów: increase=emerald-500, decrease=rose-500,
 *    start/total=slate-400 / violet-500 (czerwień TYLKO dla realnego spadku).
 *  - §3 prymityw "Waterfall": czysty SVG (bez ciężkich libów), responsywne (viewBox),
 *    props-driven, data-testid, accessible (aria-label).
 *  - §4 konwencje: format k/M, tooltip z dokładną wartością + skumulowaną,
 *    pusty stan, drill-down onSelect(label), dark-mode (dark:).
 *
 * NIE wpięty nigdzie — biblioteczny prymityw do użycia przez panele M16.
 */

import React, { useMemo } from 'react';

export type WaterfallStepKind = 'start' | 'increase' | 'decrease' | 'total';

export interface WaterfallStep {
  label: string;
  /** Dla 'start'/'total' = wartość bezwzględna słupka od zera; dla 'increase'/'decrease' = wielkość zmiany (zwykle dodatnia). */
  value: number;
  kind: WaterfallStepKind;
}

export interface FinanceWaterfallProps {
  steps: WaterfallStep[];
  height?: number;
  /** Formatowanie wartości na osi/tooltipie. Domyślnie skala k/M. */
  formatValue?: (value: number) => string;
  /** Drill-down: klik słupka → label kroku. */
  onSelect?: (label: string) => void;
}

// --- Domyślny formatter k/M (§4) ---
const defaultFormatValue = (value: number): string => {
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 1_000_000_000) return `${sign}${(abs / 1_000_000_000).toFixed(1)} mld`;
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}${(abs / 1_000).toFixed(1)}k`;
  return `${sign}${abs.toFixed(0)}`;
};

// --- Kolory wg §1 (klasy fill + warianty dark) ---
const KIND_FILL: Record<WaterfallStepKind, string> = {
  start: 'fill-slate-400 dark:fill-slate-500',
  total: 'fill-violet-500 dark:fill-violet-400',
  increase: 'fill-emerald-500 dark:fill-emerald-400',
  decrease: 'fill-rose-500 dark:fill-rose-400',
};

interface ComputedBar {
  step: WaterfallStep;
  index: number;
  /** Górna i dolna wartość słupka w jednostkach danych. */
  yTop: number;
  yBottom: number;
  /** Wartość skumulowana po tym kroku (poziom „running total"). */
  cumulative: number;
}

const VIEW_W = 800;
const PAD_LEFT = 64;
const PAD_RIGHT = 16;
const PAD_TOP = 16;
const PAD_BOTTOM = 56; // miejsce na (potencjalnie obrócone) etykiety osi X

export const FinanceWaterfall: React.FC<FinanceWaterfallProps> = ({
  steps,
  height = 320,
  formatValue,
  onSelect,
}) => {
  const fmt = formatValue ?? defaultFormatValue;

  const model = useMemo(() => {
    if (!steps || steps.length === 0) return null;

    const bars: ComputedBar[] = [];
    let running = 0;

    steps.forEach((step, index) => {
      if (step.kind === 'start' || step.kind === 'total') {
        // Słupek od zera do wartości bezwzględnej.
        const top = step.value;
        bars.push({
          step,
          index,
          yTop: Math.max(0, top),
          yBottom: Math.min(0, top),
          cumulative: top,
        });
        running = top;
      } else if (step.kind === 'increase') {
        const top = running + Math.abs(step.value);
        bars.push({ step, index, yTop: top, yBottom: running, cumulative: top });
        running = top;
      } else {
        // decrease — w dół od bieżącej sumy.
        const bottom = running - Math.abs(step.value);
        bars.push({ step, index, yTop: running, yBottom: bottom, cumulative: bottom });
        running = bottom;
      }
    });

    // Zakres osi Y obejmujący wszystkie poziomy + zero.
    let dataMin = 0;
    let dataMax = 0;
    bars.forEach((b) => {
      dataMin = Math.min(dataMin, b.yBottom, b.yTop);
      dataMax = Math.max(dataMax, b.yBottom, b.yTop);
    });
    if (dataMin === dataMax) dataMax = dataMin + 1; // unikamy dzielenia przez zero

    const yTicks = computeTicks(dataMin, dataMax);

    return { bars, dataMin, dataMax, yTicks };
  }, [steps]);

  if (!model) {
    return (
      <div
        data-testid="finance-waterfall"
        data-empty="true"
        className="flex h-48 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-500 dark:border-navy-700 dark:bg-navy-800 dark:text-slate-400"
      >
        Brak danych — dodaj kroki mostka wartości
      </div>
    );
  }

  const { bars, dataMin, dataMax, yTicks } = model;

  const plotW = VIEW_W - PAD_LEFT - PAD_RIGHT;
  const plotH = height - PAD_TOP - PAD_BOTTOM;
  const range = dataMax - dataMin;

  // Mapowanie wartości danych → współrzędna Y w SVG (oś odwrócona).
  const toY = (v: number) => PAD_TOP + (1 - (v - dataMin) / range) * plotH;

  const slot = plotW / bars.length;
  const barW = Math.min(56, slot * 0.62);
  const xCenter = (i: number) => PAD_LEFT + slot * i + slot / 2;

  // Czy etykiety obrócić (ciasno) — heurystyka po liczbie kroków.
  const rotateLabels = bars.length > 6;

  // Linia zera.
  const zeroY = toY(0);

  return (
    <div className="w-full">
      <svg
        data-testid="finance-waterfall"
        role="img"
        aria-label="Wykres mostka wartości (waterfall)"
        viewBox={`0 0 ${VIEW_W} ${height}`}
        width="100%"
        height={height}
        preserveAspectRatio="xMidYMid meet"
        className="select-none"
      >
        {/* Oś Y: ticki + siatka */}
        {yTicks.map((t) => {
          const y = toY(t);
          return (
            <g key={`tick-${t}`}>
              <line
                x1={PAD_LEFT}
                x2={VIEW_W - PAD_RIGHT}
                y1={y}
                y2={y}
                className="stroke-slate-200 dark:stroke-navy-700"
                strokeWidth={1}
              />
              <text
                x={PAD_LEFT - 8}
                y={y}
                textAnchor="end"
                dominantBaseline="middle"
                className="fill-slate-500 dark:fill-slate-400"
                fontSize={11}
              >
                {fmt(t)}
              </text>
            </g>
          );
        })}

        {/* Linia zera (mocniejsza) */}
        <line
          x1={PAD_LEFT}
          x2={VIEW_W - PAD_RIGHT}
          y1={zeroY}
          y2={zeroY}
          className="stroke-slate-300 dark:stroke-navy-600"
          strokeWidth={1.5}
        />

        {/* Łączniki między szczytami sąsiednich słupków */}
        {bars.slice(0, -1).map((b, i) => {
          const next = bars[i + 1];
          // Poziom łącznika = skumulowana suma po kroku b (poziom „running total").
          const connectorY = toY(b.cumulative);
          const x1 = xCenter(i) + barW / 2;
          const x2 = xCenter(i + 1) - barW / 2;
          return (
            <line
              key={`conn-${b.index}-${next.index}`}
              data-testid="wf-connector"
              x1={x1}
              x2={x2}
              y1={connectorY}
              y2={connectorY}
              className="stroke-slate-400 dark:stroke-slate-500"
              strokeWidth={1}
              strokeDasharray="3 3"
            />
          );
        })}

        {/* Słupki */}
        {bars.map((b) => {
          const yTop = toY(b.yTop);
          const yBottom = toY(b.yBottom);
          const rectY = Math.min(yTop, yBottom);
          const rectH = Math.max(2, Math.abs(yBottom - yTop));
          const x = xCenter(b.index) - barW / 2;
          const cx = xCenter(b.index);

          const labelX = cx;
          const labelY = height - PAD_BOTTOM + 16;

          return (
            <g
              key={`bar-${b.index}`}
              data-testid="wf-bar"
              data-kind={b.step.kind}
              data-label={b.step.label}
              data-value={b.step.value}
              data-cumulative={b.cumulative}
              className={onSelect ? 'cursor-pointer' : undefined}
              onClick={onSelect ? () => onSelect(b.step.label) : undefined}
              role={onSelect ? 'button' : undefined}
              tabIndex={onSelect ? 0 : undefined}
              onKeyDown={
                onSelect
                  ? (e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onSelect(b.step.label);
                      }
                    }
                  : undefined
              }
            >
              <rect
                x={x}
                y={rectY}
                width={barW}
                height={rectH}
                rx={3}
                className={`${KIND_FILL[b.step.kind]} transition-opacity hover:opacity-80`}
              >
                {/* Tooltip natywny SVG (§4): dokładna wartość + skumulowana */}
                <title>
                  {`${b.step.label}\n${b.step.kind === 'decrease' ? '-' : b.step.kind === 'increase' ? '+' : ''}${fmt(Math.abs(b.step.value))}\nSkumulowane: ${fmt(b.cumulative)}`}
                </title>
              </rect>

              {/* Etykieta wartości nad słupkiem */}
              <text
                x={cx}
                y={Math.min(yTop, yBottom) - 4}
                textAnchor="middle"
                className="fill-slate-600 dark:fill-slate-300"
                fontSize={10}
                fontWeight={600}
              >
                {b.step.kind === 'decrease' ? '-' : b.step.kind === 'increase' ? '+' : ''}
                {fmt(Math.abs(b.step.value))}
              </text>

              {/* Etykieta osi X */}
              <text
                x={labelX}
                y={labelY}
                textAnchor={rotateLabels ? 'end' : 'middle'}
                className="fill-slate-600 dark:fill-slate-300"
                fontSize={11}
                transform={rotateLabels ? `rotate(-35 ${labelX} ${labelY})` : undefined}
              >
                {b.step.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

// Generuje ~5 „ładnych" ticków osi Y w zakresie [min,max].
function computeTicks(min: number, max: number): number[] {
  const range = max - min || 1;
  const rawStep = range / 4;
  const mag = Math.pow(10, Math.floor(Math.log10(Math.abs(rawStep) || 1)));
  const norm = rawStep / mag;
  let niceStep: number;
  if (norm <= 1) niceStep = 1;
  else if (norm <= 2) niceStep = 2;
  else if (norm <= 5) niceStep = 5;
  else niceStep = 10;
  niceStep *= mag;

  const start = Math.floor(min / niceStep) * niceStep;
  const end = Math.ceil(max / niceStep) * niceStep;
  const ticks: number[] = [];
  for (let v = start; v <= end + niceStep * 0.001; v += niceStep) {
    ticks.push(Math.round(v * 1000) / 1000);
  }
  return ticks;
}

export default FinanceWaterfall;
