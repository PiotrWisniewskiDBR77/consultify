/**
 * EvBasketFootballField — Enterprise Value jako KOSZYK metod (football-field).
 *
 * Renderuje wynik deterministycznego `valuationBasketService` (server): poziome
 * paski metod (low→high + znacznik mid) na wspólnej osi (mln waluty), zacieniona
 * STREFA PRZECIĘCIA = rekomendowany przedział, bursztynowa flaga rozjazdu z TOP-
 * driverem, legenda i nagłówek z rekomendacją. Odwzorowanie prototypu
 * `ev_footballfield.html` — spokój, gęsto, bez ozdób.
 *
 * STYL: wyłącznie tokeny c-* (Tailwind). Paski/oś = c-focus-solid (niebieski),
 * flaga = c-warning (bursztyn). NIGDY c-accent (crimson = brand). Pozycje pasków
 * (left/width %) to geometria danych — inline style, zero surowych hexów kolorów.
 *
 * Read-only, additive, fail-soft: brak koszyka → pusty stan „uruchom wycenę".
 */
import React, { useMemo } from 'react';
import { AlertTriangle } from 'lucide-react';

/** Metoda koszyka (podzbiór BasketResult z valuationBasketService). */
export interface EvBasketMethod {
  key?: string;
  label: string;
  low: number;
  mid: number;
  high: number;
  weight?: number;
  note?: string;
}

export interface EvBasketConsistencyFlag {
  triggered: boolean;
  thresholdPct: number;
  maxDivergencePct: number;
  message: string;
  topDriver: {
    methods: [string, string];
    divergencePct: number;
    lowerLabel: string;
    higherLabel: string;
  } | null;
}

export interface EvBasketResult {
  methods: EvBasketMethod[];
  intersection: { low: number; high: number } | null;
  recommended: { low: number; mid: number; high: number };
  consistencyFlag: EvBasketConsistencyFlag;
  weights?: Record<string, number>;
}

interface Props {
  basket?: EvBasketResult | null;
  /** Etykieta jednostki na osi/nagłówku (np. „mln PLN"). Domyślnie skala k/M. */
  unitLabel?: string;
  /** Nazwa firmy/wyceny w nagłówku (eyebrow). */
  subjectLabel?: string;
  /** Formatowanie liczby na osi/etykietach pasków. */
  formatValue?: (value: number) => string;
  /** Tłumacz i18n (opcjonalny — sensowne domyślne PL). */
  t?: (key: string, defaultValue: string) => string;
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

const defaultFormat = (value: number): string => {
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)} mld`;
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(0)}k`;
  return `${Math.round(value)}`;
};

/** „Ładne" ticki: 6 równych podziałów domeny (jak w prototypie). */
function buildTicks(min: number, max: number): number[] {
  const n = 5;
  return Array.from({ length: n + 1 }, (_, i) => min + ((max - min) * i) / n);
}

export const EvBasketFootballField: React.FC<Props> = ({
  basket,
  unitLabel,
  subjectLabel,
  formatValue = defaultFormat,
  t,
}) => {
  const tr = t ?? ((_k: string, d: string) => d);

  const methods = useMemo(
    () =>
      (Array.isArray(basket?.methods) ? basket!.methods : []).filter(
        (m) => m && isNum(m.low) && isNum(m.high)
      ),
    [basket]
  );

  // Domena osi: min(low) .. max(high) wszystkich metod + strefa przecięcia, z 6% marginesem.
  const { domainMin, domainMax } = useMemo(() => {
    let min = Infinity;
    let max = -Infinity;
    for (const m of methods) {
      min = Math.min(min, m.low, m.high, isNum(m.mid) ? m.mid : m.low);
      max = Math.max(max, m.low, m.high, isNum(m.mid) ? m.mid : m.high);
    }
    if (basket?.intersection) {
      min = Math.min(min, basket.intersection.low);
      max = Math.max(max, basket.intersection.high);
    }
    if (!Number.isFinite(min) || !Number.isFinite(max)) return { domainMin: 0, domainMax: 1 };
    if (min === max) {
      const pad = Math.abs(min) || 1;
      return { domainMin: min - pad, domainMax: max + pad };
    }
    const span = max - min;
    return { domainMin: min - span * 0.06, domainMax: max + span * 0.06 };
  }, [methods, basket]);

  const pct = (value: number): number => {
    const ratio = (value - domainMin) / (domainMax - domainMin);
    return Math.max(0, Math.min(1, ratio)) * 100;
  };

  const ticks = useMemo(() => buildTicks(domainMin, domainMax), [domainMin, domainMax]);

  // Pusty stan — po hookach (rules of hooks).
  if (!basket || methods.length === 0) {
    return (
      <div
        data-testid="ev-basket-football"
        data-empty="true"
        className="rounded-xl border border-c-border bg-c-surface p-6 text-center"
      >
        <p className="text-sm text-c-text-muted">
          {tr('valuation.basket.empty', 'Uruchom wycenę, aby zobaczyć koszyk metod.')}
        </p>
      </div>
    );
  }

  const reco = basket.recommended;
  const flag = basket.consistencyFlag;
  const unit = unitLabel || tr('valuation.basket.unit', 'wartość');
  const intersection = basket.intersection;

  // Stała szerokość kolumny etykiet — WSPÓLNY układ współrzędnych dla osi,
  // pasków i strefy przecięcia (prototyp: 150px). Track = pozostała szerokość.
  const LABEL_W = 164;

  return (
    <div data-testid="ev-basket-football" className="w-full">
      <div className="rounded-xl border border-c-border bg-c-surface p-5">
        {/* Nagłówek: eyebrow + tytuł + rekomendacja */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.13em] text-c-text-muted">
              {tr('valuation.basket.eyebrow', 'Wycena · koszyk metod')}
              {subjectLabel ? ` · ${subjectLabel}` : ''}
            </div>
            <h3 className="mt-1 text-[17px] font-semibold tracking-tight text-c-text">
              {tr('valuation.basket.title', 'Enterprise Value — przedział rekomendowany')}
            </h3>
          </div>
          <div className="shrink-0 text-right">
            <div className="text-[10.5px] uppercase tracking-[0.08em] text-c-text-muted">
              {tr('valuation.basket.recommendation', 'rekomendacja')}
            </div>
            <div className="font-mono text-[22px] font-bold leading-tight tracking-tight tabular-nums text-c-focus-solid">
              {formatValue(reco.low)}
              {reco.high !== reco.low ? `–${formatValue(reco.high)}` : ''}
            </div>
            <div className="text-xs font-medium text-c-text-muted">{unit}</div>
          </div>
        </div>

        {/* Wykres */}
        <div className="mt-6">
          {/* Oś (offset o kolumnę etykiet → współdzielone współrzędne z paskami) */}
          <div className="relative h-5 border-b border-c-border" style={{ marginLeft: LABEL_W }}>
            {ticks.map((tk, i) => (
              <span
                key={`tick-${i}`}
                className="absolute top-0 -translate-x-1/2 font-mono text-[11px] tabular-nums text-c-text-muted"
                style={{ left: `${pct(tk)}%` }}
              >
                {formatValue(tk)}
              </span>
            ))}
          </div>

          {/* Plot: strefa przecięcia (overlay) + wiersze metod */}
          <div className="relative mt-0.5">
            {/* Strefa przecięcia = rekomendacja (zacieniona) */}
            {intersection && intersection.high > intersection.low && (
              <div
                className="pointer-events-none absolute z-0 border-x border-dashed border-c-focus-solid bg-c-focus-solid/10"
                style={{
                  left: `calc(${LABEL_W}px + (100% - ${LABEL_W}px) * ${pct(intersection.low) / 100})`,
                  width: `calc((100% - ${LABEL_W}px) * ${(pct(intersection.high) - pct(intersection.low)) / 100})`,
                  top: 0,
                  bottom: 8,
                }}
              >
                <span className="absolute -top-0.5 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] font-semibold text-c-focus-solid">
                  {tr('valuation.basket.intersection', 'strefa przecięcia')}
                </span>
              </div>
            )}

            {/* Wiersze metod */}
            {methods.map((m, i) => {
              const lo = Math.min(m.low, m.high);
              const hi = Math.max(m.low, m.high);
              const midV = isNum(m.mid) ? Math.max(lo, Math.min(hi, m.mid)) : (lo + hi) / 2;
              const leftPct = pct(lo);
              const widthPct = Math.max(1.5, pct(hi) - pct(lo));
              const midPct = pct(midV);
              return (
                <div
                  key={`row-${m.key || i}`}
                  className="relative z-[1] grid items-center"
                  style={{ gridTemplateColumns: `${LABEL_W}px 1fr`, minHeight: 44 }}
                  data-testid="ev-basket-row"
                  data-label={m.label}
                >
                  {/* Etykieta metody */}
                  <div className="py-1 pr-3">
                    <div className="text-[13px] font-medium leading-tight text-c-text">{m.label}</div>
                    {m.note ? (
                      <div className="mt-0.5 text-[11px] leading-tight text-c-text-muted">
                        {m.note}
                      </div>
                    ) : null}
                  </div>
                  {/* Track */}
                  <div className="relative h-11">
                    {/* Pasek low→high */}
                    <div
                      className="absolute top-1/2 h-[15px] -translate-y-1/2 rounded-full border border-c-focus-solid bg-c-focus-solid/40"
                      style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                      title={`${m.label}: ${formatValue(lo)} – ${formatValue(hi)} (mid ${formatValue(midV)})`}
                    />
                    {/* Znacznik mid */}
                    <div
                      className="absolute top-1/2 h-[22px] w-[2.5px] -translate-x-1/2 -translate-y-1/2 rounded-sm bg-c-focus-solid"
                      style={{ left: `${midPct}%` }}
                      title={`${m.label} mid: ${formatValue(midV)}`}
                    />
                    {/* Wartości low / high */}
                    <span
                      className="absolute top-1/2 -translate-y-1/2 -translate-x-full pr-[7px] font-mono text-[11px] tabular-nums text-c-text-secondary"
                      style={{ left: `${leftPct}%` }}
                    >
                      {formatValue(lo)}
                    </span>
                    <span
                      className="absolute top-1/2 -translate-y-1/2 pl-[7px] font-mono text-[11px] tabular-nums text-c-text-secondary"
                      style={{ left: `${pct(hi)}%` }}
                    >
                      {formatValue(hi)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Flaga rozjazdu (bursztyn) */}
        {flag?.triggered && (
          <div
            className="mt-5 flex items-start gap-2.5 rounded-lg border border-c-warning bg-c-warning/10 px-3.5 py-2.5 text-[12.5px] text-c-text-secondary"
            data-testid="ev-basket-flag"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-c-warning" aria-hidden="true" />
            <div>
              <span className="font-semibold text-c-warning">
                {tr('valuation.basket.divergence', 'Rozjazd')} {flag.maxDivergencePct}%
                {' > '}
                {tr('valuation.basket.threshold', 'próg')} {flag.thresholdPct}%.
              </span>{' '}
              {flag.message}
              {flag.topDriver ? (
                <>
                  {' '}
                  <span className="font-medium">
                    {tr('valuation.basket.topDriver', 'TOP-driver różnicy')}:
                  </span>{' '}
                  {flag.topDriver.higherLabel} vs {flag.topDriver.lowerLabel} (
                  {flag.topDriver.divergencePct}%).
                </>
              ) : null}
            </div>
          </div>
        )}

        {/* Stopka: legenda + źródło */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-c-border pt-3 text-[11.5px] text-c-text-muted">
          <div className="flex flex-wrap gap-4">
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded-sm border border-c-focus-solid bg-c-focus-solid/40" />
              {tr('valuation.basket.legendRange', 'przedział metody (low–high)')}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded-sm border border-dashed border-c-focus-solid bg-c-focus-solid/10" />
              {tr('valuation.basket.legendZone', 'strefa przecięcia = rekomendacja')}
            </span>
          </div>
          <div>
            {tr('valuation.basket.engine', 'silnik')}: <span className="font-medium">koszyk metod</span>
            {' · '}
            {tr('valuation.basket.deterministic', 'deterministyczny, zero LLM')}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EvBasketFootballField;
