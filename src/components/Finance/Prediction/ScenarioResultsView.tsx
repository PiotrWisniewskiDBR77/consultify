/**
 * Pakiet G (Prediction) — widok „Modele/Wyniki": wyliczone scenariuszowe P&L/BS/CF + porównania z
 * baseline (absolutne/Δ/%), płynność + covenant headroom, status materiału (clean/conditional/
 * provisional, DEC-FIN-009 pełna wersja) i badge świeżości (`stale` gdy założenia zmieniły się po
 * ostatnim compute — wyniki NIE są kasowane).
 */
import React from 'react';

import { formatFinanceValueForDisplay, type FinanceValueStatus } from '@/services/api/financeV2.types';

import {
  computeCovenantHeadroom,
  computeLiquidityHeadroom,
  computeScenarioComparison,
  evaluateExceptionLedgerForCompute,
  MathUndefinedError,
  resolveResultFreshness,
  type CanonicalValueMap,
  type ExceptionLedgerEntry,
  type MaterialStatus,
  type ScenarioDraft,
} from './predictionScenarioModel';

export interface ScenarioResultsViewProps {
  draft: ScenarioDraft;
  scenarioValues: CanonicalValueMap;
  baselineValues: CanonicalValueMap;
  exceptionLedger: readonly ExceptionLedgerEntry[];
}

function toDisplay(value: number | null) {
  const status: FinanceValueStatus = value === null ? 'MISSING' : value === 0 ? 'PRESENT_ZERO' : 'PRESENT_NONZERO';
  return formatFinanceValueForDisplay({ status, valueDecimal: value === null ? null : String(value) });
}

const STATUS_LABEL: Record<MaterialStatus, string> = { clean: 'Czysty', conditional: 'Warunkowy', provisional: 'Tymczasowy (Provisional)' };
const STATUS_TONE: Record<MaterialStatus, string> = {
  clean: 'border-c-success/30 bg-c-success/10 text-c-success',
  conditional: 'border-c-warning/30 bg-c-warning/10 text-c-warning',
  provisional: 'border-c-danger/30 bg-c-danger/10 text-c-danger',
};

export function ScenarioResultsView({ draft, scenarioValues, baselineValues, exceptionLedger }: ScenarioResultsViewProps): React.ReactElement {
  const freshness = resolveResultFreshness(draft);
  const comparison = computeScenarioComparison(scenarioValues, baselineValues);
  const gate = evaluateExceptionLedgerForCompute(exceptionLedger);

  const ebitda = scenarioValues['EBITDA::latest'] ?? null;
  const netDebt = scenarioValues['LONG_TERM_DEBT::latest'] ?? null;
  const cash = scenarioValues['CASH::latest'] ?? null;

  let covenantError: string | null = null;
  let covenant: ReturnType<typeof computeCovenantHeadroom> | null = null;
  if (ebitda !== null && netDebt !== null) {
    try {
      covenant = computeCovenantHeadroom({ netDebt, ebitda, covenantMaxNetDebtToEbitda: 3.5 });
    } catch (err) {
      covenantError = err instanceof MathUndefinedError ? err.message : 'Błąd obliczenia covenant headroom.';
    }
  }
  const liquidity = cash === null ? null : computeLiquidityHeadroom(cash, 200_000);

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto p-4" data-testid="prediction-results-view">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${
            freshness === 'CURRENT' ? 'border-c-success/30 bg-c-success/10 text-c-success' : freshness === 'STALE' ? 'border-c-warning/30 bg-c-warning/10 text-c-warning' : 'border-c-border-subtle bg-c-surface-raised text-c-text-secondary'
          }`}
          data-testid="results-freshness-badge"
        >
          {freshness === 'CURRENT' ? 'Aktualne' : freshness === 'STALE' ? 'Nieaktualne — zmieniono założenia od ostatniego przeliczenia' : 'Nie przeliczono'}
        </span>
        <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${STATUS_TONE[gate.materialStatus]}`} data-testid="material-status-badge">
          {STATUS_LABEL[gate.materialStatus]}
        </span>
        {!gate.allowed && (
          <span className="inline-flex items-center rounded-full border border-c-danger/30 bg-c-danger/10 px-2.5 py-1 text-xs font-medium text-c-danger" role="alert" data-testid="compute-blocked-badge">
            Compute zablokowany — {gate.blockedBy.length} wyjątek(ów) bezpieczeństwa/matematyki
          </span>
        )}
      </div>

      <section className="rounded-xl border border-c-border-subtle bg-c-surface p-4">
        <h3 className="mb-2 text-sm font-semibold text-c-text">Porównanie ze scenariuszem bazowym — absolutne / Δ / %</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">{/* §27-exempt — scenariusz-vs-baseline porównanie linii P&L/BS/CF (Excel/Platforma-tabel archetyp, DOKTRYNA_TABELA_NIE_EXCEL.md Decyzja 07-13), nie lista rekordów: kolumny to Δ/%, nie akcje na wierszu. */}
            <thead className="bg-c-surface-raised text-xs uppercase tracking-wide text-c-text-muted">
              <tr>
                <th className="px-3 py-2">Linia</th>
                <th className="px-3 py-2">Okres</th>
                <th className="px-3 py-2 text-right">Scenariusz</th>
                <th className="px-3 py-2 text-right">Baseline</th>
                <th className="px-3 py-2 text-right">Δ</th>
                <th className="px-3 py-2 text-right">%</th>
              </tr>
            </thead>
            <tbody>
              {comparison.map((cell) => (
                <tr key={`${cell.lineCode}::${cell.periodId}`} className="border-t border-c-border-subtle">
                  <td className="px-3 py-2">{cell.lineCode}</td>
                  <td className="px-3 py-2">{cell.periodId}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{toDisplay(cell.scenarioValue).text}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{toDisplay(cell.baselineValue).text}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{toDisplay(cell.absoluteDelta).text}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{cell.percentDelta === null ? '—' : `${(cell.percentDelta * 100).toFixed(1)}%`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-c-border-subtle bg-c-surface p-4">
          <h3 className="mb-1 text-sm font-semibold text-c-text">Zapas płynności</h3>
          {liquidity === null || liquidity.liquidityHeadroom === null ? (
            <p className="text-sm text-c-text-muted">Brak danych o gotówce lub polityce min. cash — wyjątek, nie blokada.</p>
          ) : (
            <p className="text-lg tabular-nums text-c-text">{liquidity.liquidityHeadroom.toLocaleString('pl-PL')} PLN</p>
          )}
        </div>
        <div className="rounded-xl border border-c-border-subtle bg-c-surface p-4">
          <h3 className="mb-1 text-sm font-semibold text-c-text">Covenant headroom (Net Debt / EBITDA ≤ 3.5x)</h3>
          {covenantError ? (
            <p className="text-sm font-medium text-c-danger" role="alert" data-testid="covenant-hard-block">
              Twarda blokada: {covenantError}
            </p>
          ) : covenant === null ? (
            <p className="text-sm text-c-text-muted">Brak danych EBITDA/Net Debt.</p>
          ) : (
            <p className="text-lg tabular-nums text-c-text">
              {covenant.netDebtToEbitda.toFixed(2)}x <span className="text-sm text-c-text-secondary">(zapas {covenant.headroomRatio.toFixed(2)}x)</span>
            </p>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-c-border-subtle bg-c-surface p-4">
        <h3 className="mb-2 text-sm font-semibold text-c-text">Rejestr wyjątków (DEC-FIN-009)</h3>
        {exceptionLedger.length === 0 ? (
          <p className="text-sm text-c-text-muted">Brak wyjątków.</p>
        ) : (
          <ul className="space-y-1 text-sm text-c-text-secondary">
            {exceptionLedger.map((e) => (
              <li key={e.id} data-testid={`exception-${e.id}`}>
                <span className="font-medium text-c-text">[{e.level}]</span> {e.message}
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-xs text-c-text-muted">Autor: system@finance-v3 · Jakość: {STATUS_LABEL[gate.materialStatus]}</p>
    </div>
  );
}
