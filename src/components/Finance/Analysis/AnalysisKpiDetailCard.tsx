/**
 * Pakiet E — karta szczegółowa KPI (brief: "wiersz otwiera kartę szczegółową:
 * pełne lineage, okresy, wykres, formuła, benchmark, interpretacja,
 * historia"). Slide-over z prawej, w tokenach `c-*` (kanon), NIE reużywa
 * `ArtifactRightPanel` (SPEC-A, ekrany-obiekty pełnoekranowe) — to jest
 * panel WEWNĄTRZ workspace'u Analysis, wzorowany na istniejącym
 * Table+Preview layoutcie (`TableWithPreviewLayout`), nie osobny artefakt.
 */
import { X } from 'lucide-react';
import React from 'react';

import type { AnalysisKpiValueDto } from '../../../services/api/financeV2.types';
import { financeValueDisplayReasonLabel, formatFinanceValueForDisplay } from '../../../services/api/financeV2.types';
import type { AnalysisKpiCatalogFormulaInfo } from './analysisKpiTable.contract';
import type { YoyDelta } from './analysisKpiTable.contract';

export interface AnalysisKpiHistoryEntry {
  versionLabel: string;
  valueDisplay: string;
  atIso: string;
}

export interface AnalysisKpiPeriodSeriesPoint {
  periodLabel: string;
  value: AnalysisKpiValueDto['value'];
  isForecast: boolean;
}

export interface AnalysisKpiDetailCardProps {
  kpiValue: AnalysisKpiValueDto;
  formulaInfo: AnalysisKpiCatalogFormulaInfo | null;
  yoyDelta: YoyDelta;
  periodSeries: AnalysisKpiPeriodSeriesPoint[];
  history: AnalysisKpiHistoryEntry[];
  sourceLineageLabel: string;
  onClose: () => void;
}

function SparklineChart({ points }: { points: AnalysisKpiPeriodSeriesPoint[] }): React.ReactElement {
  const numeric = points.map((p) => (p.value.status === 'PRESENT_ZERO' || p.value.status === 'PRESENT_NONZERO' ? Number(p.value.valueDecimal) : null));
  const present = numeric.filter((n): n is number => n !== null);
  if (present.length === 0) {
    return <p className="text-xs text-c-text-muted">Brak wystarczających danych do wykresu.</p>;
  }
  const min = Math.min(...present);
  const max = Math.max(...present);
  const range = max - min || 1;
  const width = 280;
  const height = 64;
  const stepX = points.length > 1 ? width / (points.length - 1) : 0;
  const coords = numeric.map((n, i) => (n === null ? null : { x: i * stepX, y: height - ((n - min) / range) * height }));
  const pathParts: string[] = [];
  coords.forEach((c, i) => {
    if (!c) return;
    pathParts.push(`${pathParts.length === 0 ? 'M' : 'L'}${c.x.toFixed(1)},${c.y.toFixed(1)}`);
  });
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-16" role="img" aria-label="Wykres wartości w czasie">
      <path d={pathParts.join(' ')} fill="none" stroke="currentColor" strokeWidth={2} className="text-c-text-secondary" />
      {coords.map((c, i) =>
        c ? (
          <circle
            key={i}
            cx={c.x}
            cy={c.y}
            r={points[i].isForecast ? 2.5 : 3}
            className={points[i].isForecast ? 'fill-c-text-muted' : 'fill-c-text-secondary'}
          />
        ) : null
      )}
    </svg>
  );
}

export function AnalysisKpiDetailCard(props: AnalysisKpiDetailCardProps): React.ReactElement {
  const { kpiValue, formulaInfo, yoyDelta, periodSeries, history, sourceLineageLabel, onClose } = props;
  const display = formatFinanceValueForDisplay(kpiValue.value);
  const reason = financeValueDisplayReasonLabel(kpiValue.value.status);

  return (
    <aside
      data-testid="analysis-kpi-detail-card"
      className="w-full max-w-md shrink-0 border-l border-c-border-subtle bg-c-surface flex flex-col h-full"
      aria-label={`Szczegóły wskaźnika ${kpiValue.kpiName}`}
    >
      <header className="flex items-start justify-between gap-2 p-4 border-b border-c-border-subtle">
        <div className="min-w-0">
          <p className="text-xs text-c-text-muted">{kpiValue.category ?? 'Bez kategorii'}</p>
          <h3 className="text-sm font-semibold text-c-text truncate">{kpiValue.kpiName}</h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="min-h-11 min-w-11 inline-flex items-center justify-center rounded-lg text-c-text-muted hover:text-c-text hover:bg-c-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
          aria-label="Zamknij kartę szczegółową"
          data-testid="analysis-kpi-detail-close"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-5 text-sm">
        <section>
          <p className="text-xs font-medium text-c-text-muted uppercase tracking-wide mb-1">Wartość bieżąca</p>
          <p
            className={`text-2xl font-semibold tabular-nums ${display.isMissingLikeGlyph ? 'text-c-text-muted' : 'text-c-text'}`}
            data-testid="analysis-kpi-detail-value"
          >
            {display.text}
          </p>
          {reason ? <p className="text-xs text-c-text-muted mt-1">{reason}</p> : null}
          <p className="text-xs text-c-text-muted mt-2">
            Zmiana r/r:{' '}
            {yoyDelta.status === 'COMPUTED' && yoyDelta.percentDelta !== null
              ? `${yoyDelta.percentDelta >= 0 ? '+' : ''}${yoyDelta.percentDelta.toFixed(1)}%`
              : yoyDelta.status === 'PRIOR_ZERO_PCT_UNDEFINED'
                ? 'zmiana % nieokreślona (poprzedni okres = 0)'
                : '—'}
          </p>
        </section>

        <section>
          <p className="text-xs font-medium text-c-text-muted uppercase tracking-wide mb-1">Wykres — okresy historyczne i prognozowane</p>
          <SparklineChart points={periodSeries} />
          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-xs text-c-text-muted">
            {periodSeries.map((p) => (
              <span key={p.periodLabel} className={p.isForecast ? 'italic' : ''}>
                {p.periodLabel}
                {p.isForecast ? ' (prognoza)' : ''}: {formatFinanceValueForDisplay(p.value).text}
              </span>
            ))}
          </div>
        </section>

        <section>
          <p className="text-xs font-medium text-c-text-muted uppercase tracking-wide mb-1">Formuła i składniki</p>
          <p className="font-mono text-xs bg-c-surface-raised rounded-md px-2 py-1.5 text-c-text">
            {formulaInfo?.formulaDisplay ?? 'Brak zdefiniowanej formuły wyświetlanej.'}
          </p>
          {formulaInfo ? <p className="text-xs text-c-text-muted mt-1">{formulaInfo.interpretationGeneral}</p> : null}
        </section>

        <section>
          <p className="text-xs font-medium text-c-text-muted uppercase tracking-wide mb-1">Benchmark branżowy</p>
          {kpiValue.benchmark ? (
            <p className="text-c-text">
              {kpiValue.benchmark.rangeLow}–{kpiValue.benchmark.rangeHigh} ({kpiValue.benchmark.industryCode}) · źródło: {kpiValue.benchmark.source} ·{' '}
              {kpiValue.benchmark.asOf}
            </p>
          ) : (
            <p className="text-c-text-muted">Benchmark niedostępny dla tego wskaźnika.</p>
          )}
        </section>

        <section>
          <p className="text-xs font-medium text-c-text-muted uppercase tracking-wide mb-1">Interpretacja tego wyniku</p>
          <p className="text-c-text">{kpiValue.interpretationText ?? 'Brak zapisanej interpretacji dla tego wyniku.'}</p>
        </section>

        <section>
          <p className="text-xs font-medium text-c-text-muted uppercase tracking-wide mb-1">Lineage — źródło danych</p>
          <p className="text-c-text">{sourceLineageLabel}</p>
        </section>

        <section>
          <p className="text-xs font-medium text-c-text-muted uppercase tracking-wide mb-1">Historia</p>
          {history.length === 0 ? (
            <p className="text-c-text-muted">Brak wcześniejszych wersji tego wskaźnika.</p>
          ) : (
            <ul className="space-y-1">
              {history.map((h) => (
                <li key={h.versionLabel} className="flex items-center justify-between text-xs text-c-text-secondary">
                  <span>{h.versionLabel}</span>
                  <span className="tabular-nums">{h.valueDisplay}</span>
                  <span className="text-c-text-muted">{h.atIso}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </aside>
  );
}

export default AnalysisKpiDetailCard;
