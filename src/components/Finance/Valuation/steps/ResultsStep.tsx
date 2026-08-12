/**
 * Step 4/7 — Results (DEC-FIN-005 point 3): EV, Equity Value, recommended range, per-method
 * breakdown + contribution, terminal share, WACC, full EV→Equity bridge, method-agreement
 * warnings.
 *
 * Coordinator correction (WP-D05 DoD, "disagreement analysis zamiast fałszywej jednej wartości"):
 * the headline number is shown ALONGSIDE the method-result range/disagreement read
 * (`computeMethodResultRange`) — a single weighted point estimate is never the only thing on
 * screen when more than one method has a result.
 */
import React from 'react';

import { valuationMethodTypeLabel, type ValuationResultsDto } from '@/services/api/financeV2.types';

import { computeMethodResultRange } from '../valuationMath';
import { ValuationValueCell } from '../ValuationValueCell';

export interface ResultsStepProps {
  results: ValuationResultsDto | null;
}

function fmt(n: number): string {
  return n.toLocaleString('pl-PL', { maximumFractionDigits: 0 });
}

/** Decimal string -> pl-PL thousands-grouped display, `'—'` for null/unparsable (never a raw un-grouped digit string). */
function fmtDecimalString(raw: string | null): string {
  if (raw === null) return '—';
  const n = Number(raw);
  return Number.isFinite(n) ? fmt(n) : '—';
}

export function ResultsStep(props: ResultsStepProps): React.ReactElement {
  const { results } = props;

  if (!results) {
    return (
      <p className="text-xs text-c-text-muted" data-testid="results-step-loading">
        Wczytywanie wyników…
      </p>
    );
  }

  const range = computeMethodResultRange(results.methods);
  const headline = results.headlineEnterpriseValue;

  return (
    <div className="max-w-5xl space-y-5" data-testid="valuation-results-step">
      <div className="rounded-xl border border-c-border-subtle bg-c-surface p-4">
        <p className="text-xs text-c-text-muted">Wartość przedsiębiorstwa (EV) — nagłówek</p>
        <p className="mt-1 text-2xl font-semibold text-c-text" data-testid="headline-ev">
          {headline.value === null ? '—' : fmt(headline.value)}
        </p>
        <p className="mt-1 text-xs text-c-text-muted" data-testid="headline-ev-source">
          Źródło: {headlineSourceLabel(headline.source)}
        </p>
      </div>

      {range.readyCount >= 2 && (
        <div
          role="status"
          data-testid="method-disagreement-banner"
          data-material={range.hasMaterialDisagreement}
          className={`rounded-lg border px-3 py-2 text-xs ${range.hasMaterialDisagreement ? 'border-c-warning/30 bg-c-warning/10 text-c-warning' : 'border-c-border-subtle bg-c-surface text-c-text-secondary'}`}
        >
          Przedział wyników metod: <span className="font-mono">{fmt(range.min as number)}</span> –{' '}
          <span className="font-mono">{fmt(range.max as number)}</span>
          {range.spreadPct !== null && ` (rozrzut ${range.spreadPct.toFixed(1)}%)`}
          {range.hasMaterialDisagreement &&
            ' — istotna rozbieżność między metodami, nie traktuj nagłówka jako pewnika.'}
        </div>
      )}

      {/* §27-exempt: wewnętrzna tabela breakdown metod wyceny w artefakcie Wyniki, nie ekran listowy modułu — docs/ui-standards/DOKTRYNA_TABELA_NIE_EXCEL.md */}
      {/* prettier-ignore */}
      <table className="w-full text-left text-xs" data-testid="results-methods-table" data-canon="§27-exempt">
        <thead>
          <tr className="border-b border-c-border-subtle text-c-text-muted">
            <th className="py-1.5 pr-2">Metoda</th>
            <th className="py-1.5 pr-2">Wynik</th>
            <th className="py-1.5 pr-2">W koszyku</th>
            <th className="py-1.5 pr-2">Waga</th>
          </tr>
        </thead>
        <tbody>
          {results.methods.map((m) => (
            <tr key={m.methodId} className="border-b border-c-border-subtle/60">
              <td className="py-1.5 pr-2 text-c-text">{valuationMethodTypeLabel(m.methodType)}</td>
              <td className="py-1.5 pr-2">
                <ValuationValueCell status={m.result.status} valueDecimal={m.result.valueDecimal} />
              </td>
              <td className="py-1.5 pr-2 text-c-text-muted">
                {m.isInRecommendationBasket ? 'Tak' : 'Nie'}
              </td>
              <td className="py-1.5 pr-2 text-c-text-muted">{m.weightPct ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {results.methodAgreementWarnings.length > 0 && (
        <div className="space-y-1" data-testid="method-agreement-warnings">
          <p className="text-xs font-semibold text-c-text">Ostrzeżenia o rozbieżności metod</p>
          {results.methodAgreementWarnings.map((w) => (
            <p key={w.ruleId} className="text-xs text-c-warning">
              {w.title} — {w.narrative}
            </p>
          ))}
        </div>
      )}

      {results.bridge && (
        <div
          className="rounded-xl border border-c-border-subtle bg-c-surface p-4"
          data-testid="results-bridge-summary"
        >
          <p className="text-xs font-semibold text-c-text">Most EV → Equity</p>
          <dl className="mt-1 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-c-text-muted">
            <dt>EV</dt>
            <dd className="text-c-text">
              {fmtDecimalString(results.bridge.header.enterprise_value_decimal)}
            </dd>
            <dt>Equity Value</dt>
            <dd className="text-c-text">
              {fmtDecimalString(results.bridge.header.equity_value_decimal)}
            </dd>
          </dl>
        </div>
      )}
      {!results.bridge && (
        <p className="text-xs text-c-text-muted" data-testid="results-bridge-missing">
          Brak zapisanego mostu EV→Equity dla tego wariantu.
        </p>
      )}
    </div>
  );
}

function headlineSourceLabel(
  source: ValuationResultsDto['headlineEnterpriseValue']['source']
): string {
  switch (source) {
    case 'BRIDGE':
      return 'Most EV→Equity (zapisany)';
    case 'WEIGHTED_BASKET':
      return 'Ważony koszyk metod';
    case 'SINGLE_READY_METHOD':
      return 'Pojedyncza gotowa metoda';
    case 'NONE':
      return 'Brak — nic nie jest jeszcze policzone';
    default:
      return source;
  }
}

export default ResultsStep;
