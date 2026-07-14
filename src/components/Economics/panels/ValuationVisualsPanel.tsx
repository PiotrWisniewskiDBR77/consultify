/**
 * M16/1.2+1.3 — Valuation Visuals panel (FE binding for already-computed valuation).
 *
 * Renders the three canonical valuation visuals (FINANCE_VISUAL_CANON §3) on top of
 * data the backend already produces (audit: liczone w backendzie, FE nie renderuje):
 *   - Football field (triangulacja): DCF / comps / asset-based ranges + point marker.
 *   - Sensitivity heatmap (WACC × wzrost): z sensitivity.matrix.
 *   - Tornado: one-way sensitivity drivers.
 *
 * Read-only, additive, fail-soft (wzór: ExecutionIntelligencePanel): brak danych =
 * cichy pusty stan ("uruchom wycenę"), nigdy nie blokuje workspace. Osobny panel —
 * NIE wpięty w ValuationWorkspace (uniknięcie regresji), do wpięcia osobno.
 */
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { FootballField, SensitivityHeatmap, TornadoChart } from '@/components/Economics/charts';
import type { FootballFieldRange } from '@/components/Economics/charts/FootballField';
import type { SensitivityCell } from '@/components/Economics/charts/SensitivityHeatmap';
import type { TornadoBar } from '@/components/Economics/charts/TornadoChart';

/** Kształt wyceny z backendu (M16) — wszystkie pola opcjonalne (fail-soft). */
export interface ValuationResults {
  dcf?: {
    enterpriseValue?: number | null;
  } | null;
  comps?: {
    impliedEnterpriseValue?: {
      min?: number | null;
      median?: number | null;
      max?: number | null;
    } | null;
  } | null;
  sensitivity?: {
    waccGrid?: Array<number | string> | null;
    gGrid?: Array<number | string> | null;
    matrix?: Array<{ wacc: number | string; g: number | string; ev: number }> | null;
  } | null;
  tornado?: Array<{ label: string; low: number; high: number }> | null;
  assetBased?: {
    enterpriseValue?: number | null;
    /** Asset-based jako pojedyncza wartość (NAV) — tolerujemy alias. */
    netAssetValue?: number | null;
  } | null;
}

interface Props {
  valuation?: ValuationResults | null;
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

type TFn = (key: string, defaultValue: string) => string;

/** Buduje pasy football field z DCF / comps / asset-based. */
function buildRanges(
  v: ValuationResults,
  t: TFn
): { ranges: FootballFieldRange[]; point?: number } {
  const ranges: FootballFieldRange[] = [];

  // DCF: jeśli mamy sensitivity, użyj min/max z matrix jako low/high; inaczej ±15%.
  const dcfEv = v.dcf?.enterpriseValue;
  if (isNum(dcfEv)) {
    let low = dcfEv * 0.85;
    let high = dcfEv * 1.15;
    const evs = (v.sensitivity?.matrix ?? [])
      .map((c) => c?.ev)
      .filter((e): e is number => isNum(e));
    if (evs.length > 0) {
      low = Math.min(...evs);
      high = Math.max(...evs);
    }
    ranges.push({ label: 'DCF', low: Math.min(low, high), mid: dcfEv, high: Math.max(low, high) });
  }

  // Comps: min / median / max wprost.
  const comps = v.comps?.impliedEnterpriseValue;
  if (comps && (isNum(comps.min) || isNum(comps.median) || isNum(comps.max))) {
    const min = isNum(comps.min)
      ? comps.min
      : isNum(comps.median)
        ? comps.median
        : (comps.max as number);
    const max = isNum(comps.max)
      ? comps.max
      : isNum(comps.median)
        ? comps.median
        : (comps.min as number);
    const median = isNum(comps.median) ? comps.median : (min + max) / 2;
    ranges.push({
      label: t('valuation.visuals.methodComps', 'Comparables'),
      low: Math.min(min, max),
      mid: median,
      high: Math.max(min, max),
    });
  }

  // Asset-based / NAV: pojedyncza wartość → degenerowany pas (low=mid=high).
  const nav = isNum(v.assetBased?.enterpriseValue)
    ? (v.assetBased!.enterpriseValue as number)
    : isNum(v.assetBased?.netAssetValue)
      ? (v.assetBased!.netAssetValue as number)
      : undefined;
  if (isNum(nav)) {
    ranges.push({
      label: t('valuation.visuals.methodAsset', 'Asset-based (NAV)'),
      low: nav,
      mid: nav,
      high: nav,
    });
  }

  // Punkt referencyjny (triangulacja): główna wycena = DCF jeśli jest, inaczej mediana comps.
  const point = isNum(dcfEv) ? dcfEv : isNum(comps?.median) ? (comps!.median as number) : undefined;

  return { ranges, point };
}

/** Mapuje sensitivity.matrix ({wacc,g,ev}) na komórki heatmapy ({x,y,value}). */
function buildHeatmap(v: ValuationResults): {
  xLabels: Array<number | string>;
  yLabels: Array<number | string>;
  cells: SensitivityCell[];
} {
  const s = v.sensitivity;
  const xLabels = Array.isArray(s?.waccGrid) ? s!.waccGrid : [];
  const yLabels = Array.isArray(s?.gGrid) ? s!.gGrid : [];
  const cells: SensitivityCell[] = Array.isArray(s?.matrix)
    ? s!.matrix.filter((c) => c && isNum(c.ev)).map((c) => ({ x: c.wacc, y: c.g, value: c.ev }))
    : [];
  return { xLabels, yLabels, cells };
}

/** Tornado bars + base (mediana low/high lub DCF ev). */
function buildTornado(v: ValuationResults): { bars: TornadoBar[]; base: number } {
  const bars: TornadoBar[] = Array.isArray(v.tornado)
    ? v.tornado
        .filter((t) => t && isNum(t.low) && isNum(t.high) && typeof t.label === 'string')
        .map((t) => ({ label: t.label, low: t.low, high: t.high }))
    : [];

  // Baza: DCF ev jeśli jest; inaczej średnia ze środków słupków.
  let base = v.dcf?.enterpriseValue;
  if (!isNum(base) && bars.length > 0) {
    const mids = bars.map((b) => (b.low + b.high) / 2);
    base = mids.reduce((a, c) => a + c, 0) / mids.length;
  }
  return { bars, base: isNum(base) ? base : 0 };
}

const SectionEmpty: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="text-sm text-gray-500">{children}</p>
);

export const ValuationVisualsPanel: React.FC<Props> = ({ valuation }) => {
  const { t } = useTranslation();
  const v = valuation ?? {};

  const { ranges, point } = useMemo(() => buildRanges(v, t), [v, t]);
  const { xLabels, yLabels, cells } = useMemo(() => buildHeatmap(v), [v]);
  const { bars, base } = useMemo(() => buildTornado(v), [v]);

  const hasFootball = ranges.length > 0;
  const hasHeatmap = xLabels.length > 0 && yLabels.length > 0 && cells.length > 0;
  const hasTornado = bars.length > 0;
  const hasAnything = hasFootball || hasHeatmap || hasTornado;

  if (!hasAnything) {
    return (
      <div
        className="rounded-xl border border-gray-200 bg-white p-6 text-center"
        data-testid="valuation-visuals-panel"
        data-empty="true"
      >
        <p className="text-sm text-gray-500">
          {t('valuation.visuals.emptyAll', 'Run the valuation to see the visualizations.')}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="valuation-visuals-panel">
      {/* Football field — valuation triangulation */}
      <section
        className="rounded-xl border border-gray-200 bg-white p-4"
        data-testid="valuation-football"
      >
        <h3 className="mb-3 text-sm font-semibold text-gray-900">
          {t('valuation.visuals.triangulation', 'Valuation triangulation')}
        </h3>
        {hasFootball ? (
          <FootballField ranges={ranges} point={point} />
        ) : (
          <SectionEmpty>
            {t('valuation.visuals.emptyMethods', 'No valuation methods — run the valuation.')}
          </SectionEmpty>
        )}
      </section>

      {/* Sensitivity heatmap — WACC × growth */}
      <section
        className="rounded-xl border border-gray-200 bg-white p-4"
        data-testid="valuation-heatmap"
      >
        <h3 className="mb-3 text-sm font-semibold text-gray-900">
          {t('valuation.visuals.sensitivity', 'Sensitivity: WACC × growth')}
        </h3>
        {hasHeatmap ? (
          <SensitivityHeatmap xLabels={xLabels} yLabels={yLabels} matrix={cells} />
        ) : (
          <SectionEmpty>
            {t(
              'valuation.visuals.emptySensitivity',
              'No sensitivity analysis — run the valuation.'
            )}
          </SectionEmpty>
        )}
      </section>

      {/* Tornado — one-way sensitivity */}
      <section
        className="rounded-xl border border-gray-200 bg-white p-4"
        data-testid="valuation-tornado"
      >
        <h3 className="mb-3 text-sm font-semibold text-gray-900">
          {t('valuation.visuals.tornado', 'One-way sensitivity')}
        </h3>
        {hasTornado ? (
          <TornadoChart bars={bars} base={base} />
        ) : (
          <SectionEmpty>
            {t('valuation.visuals.emptyDrivers', 'No sensitivity drivers — run the valuation.')}
          </SectionEmpty>
        )}
      </section>
    </div>
  );
};

export default ValuationVisualsPanel;
