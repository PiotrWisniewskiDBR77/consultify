/**
 * `ReconciliationLedgerPanel` — brief: "reconciliation ledger", zbudowany nad
 * REALNYMI, przetestowanymi na Postgresie odczytami B2:
 *   `GET /statements/:businessVersionId/reconciliation-runs` (ledger, newest first)
 *   `GET /statements/reconciliation-runs/:id` (jeden run + wiersze detalu)
 *
 * Ledger to jedyna część kontraktu Statements, którą ten pakiet mógł
 * zweryfikować bez potrzeby wywoływania `POST .../map` (ten workspace nie ma
 * `rawLines`/`rules` źródłowych — patrz `financeV2.api.ts` komentarz przy
 * `mapStatementLines`) — więc "reconcile" w DoD tego pakietu oznacza: pokaż
 * PRAWDZIWY ledger przebiegów, nie fabrykuj przycisku "Uruchom rekoncyliację",
 * którego nie da się uczciwie podłączyć bez kroku mapowania.
 */

import React from 'react';

import {
  reconciliationBucketLabel,
  reconciliationResultQualityLabel,
  reconciliationRunStatusLabel,
  type ReconciliationDetailRowDto,
  type ReconciliationRunDetailDto,
  type ReconciliationRunSummaryDto,
} from '@/services/api/financeV2.types';

export interface ReconciliationLedgerPanelProps {
  runs: ReconciliationRunSummaryDto[];
  loading: boolean;
  selectedRunId: string | null;
  onSelectRun: (runId: string) => void;
  runDetail: ReconciliationRunDetailDto | null;
  runDetailLoading: boolean;
  emptyLabel: string;
}

function bucketCounts(rows: ReconciliationDetailRowDto[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const row of rows) {
    counts[row.bucket] = (counts[row.bucket] ?? 0) + 1;
  }
  return counts;
}

function formatPct(value: string | null): string {
  if (value === null) return '—';
  const n = Number(value);
  return Number.isFinite(n) ? `${n.toFixed(2)}%` : '—';
}

/**
 * NAPRAWIONE (sweep 148-finanse-parametry): dwie odrębne wady w tej samej
 * funkcji.
 * 1. `MATERIAL_BREAK` nigdy nie jest realną wartością `resultQuality`
 *    (`ReconciliationResultQuality` = CLEAN/CONDITIONAL/PROVISIONAL,
 *    `financeV2.types.ts`) ani `status`
 *    (`ReconciliationRunStatus` = CLEAN/WITHIN_TOLERANCE/EXCEEDS_MATERIALITY) —
 *    martwa gałąź, kolor nigdy się nie uruchamiał.
 * 2. Wywołanie w JSX (linia z badge'em) kolorowało WYŁĄCZNIE po
 *    `resultQuality`, ale WYŚWIETLANY tekst był `resultQuality ?? status`
 *    (fallback na inne pole) — gdy `resultQuality` było `null`, badge
 *    pokazywał `status` (np. „EXCEEDS_MATERIALITY") zawsze w SZAREJ,
 *    domyślnej barwie, nigdy w czerwonej mimo że to najgorszy wynik.
 * `runBadgeTone()` koloruje dokładnie to pole, które faktycznie się
 * wyświetla (`resultQuality ?? status` — ten sam fallback co treść).
 */
function runBadgeTone(resultQuality: string | null, status: string): string {
  const value = resultQuality ?? status;
  if (value === 'CLEAN') return 'bg-c-success/10 text-c-success';
  if (value === 'WITHIN_TOLERANCE' || value === 'CONDITIONAL') {
    return 'bg-c-surface-raised text-c-text-secondary';
  }
  if (value === 'EXCEEDS_MATERIALITY' || value === 'PROVISIONAL') {
    return 'bg-c-danger/10 text-c-danger';
  }
  return 'bg-c-surface-raised text-c-text-muted';
}

function runBadgeLabel(resultQuality: string | null, status: string): string {
  return resultQuality != null
    ? reconciliationResultQualityLabel(resultQuality)
    : reconciliationRunStatusLabel(status);
}

export function ReconciliationLedgerPanel(props: ReconciliationLedgerPanelProps): React.ReactElement {
  const { runs, loading, selectedRunId, onSelectRun, runDetail, runDetailLoading, emptyLabel } = props;

  if (loading) {
    return (
      <div className="space-y-2 p-3" data-testid="reconciliation-ledger-loading">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-10 animate-pulse rounded-lg bg-c-surface-raised" />
        ))}
      </div>
    );
  }

  if (runs.length === 0) {
    return (
      <div className="p-4 text-xs text-c-text-muted" data-testid="reconciliation-ledger-empty">
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col" data-testid="reconciliation-ledger">
      <div className="flex-1 divide-y divide-c-border-subtle overflow-auto">
        {runs.map((run) => {
          const isSelected = selectedRunId === run.reconciliationRunId;
          return (
            <button
              key={run.reconciliationRunId}
              type="button"
              onClick={() => onSelectRun(run.reconciliationRunId)}
              aria-pressed={isSelected}
              data-testid={`reconciliation-run-${run.reconciliationRunId}`}
              className={`flex w-full flex-col gap-1 px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus focus-visible:ring-inset ${
                isSelected ? 'bg-c-focus/10' : 'hover:bg-c-surface-raised'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-medium text-c-text">{run.sourceSystem}</span>
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-semibold ${runBadgeTone(run.resultQuality, run.status)}`}
                >
                  {runBadgeLabel(run.resultQuality, run.status)}
                </span>
              </div>
              {/* axe color-contrast: text-c-text-muted on the bg-c-focus/10
                  selected tint measures 4.13:1 (< 4.5) in light theme.
                  text-c-text-secondary passes (6.58:1) — swapped only for the
                  selected state, unselected rows (plain/hover background)
                  keep text-c-text-muted since that combo already passes. */}
              <div
                className={`flex items-center justify-between gap-2 text-[10px] ${
                  isSelected ? 'text-c-text-secondary' : 'text-c-text-muted'
                }`}
              >
                <span>{new Date(run.createdAt).toLocaleString('pl-PL')}</span>
                <span className="tabular-nums">Residual: {formatPct(run.totals.residualPct)}</span>
              </div>
            </button>
          );
        })}
      </div>

      {selectedRunId && (
        <div className="border-t border-c-border-subtle p-3">
          {runDetailLoading ? (
            <div className="h-16 animate-pulse rounded-lg bg-c-surface-raised" />
          ) : runDetail ? (
            <div data-testid="reconciliation-run-detail">
              <div className="mb-2 grid grid-cols-2 gap-2 text-[11px]">
                <Metric label="Status" value={reconciliationRunStatusLabel(runDetail.status)} />
                <Metric label="Jakość" value={reconciliationResultQualityLabel(runDetail.resultQuality)} />
                <Metric label="Residual" value={formatPct(runDetail.residualPct)} />
                <Metric label="Wierszy" value={String(runDetail.rows.length)} />
              </div>
              <BucketBreakdown rows={runDetail.rows} />
            </div>
          ) : (
            <p className="text-[11px] text-c-text-muted" data-testid="reconciliation-run-detail-missing">
              Nie udało się wczytać detalu tego przebiegu.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }): React.ReactElement {
  return (
    <div>
      <p className="text-[9px] uppercase tracking-wide text-c-text-muted">{label}</p>
      <p className="font-medium tabular-nums text-c-text">{value}</p>
    </div>
  );
}

function BucketBreakdown({ rows }: { rows: ReconciliationDetailRowDto[] }): React.ReactElement {
  const counts = bucketCounts(rows);
  const duplicateCount = counts.DUPLICATE ?? 0;
  return (
    <div>
      <p className="mb-1 text-[9px] font-semibold uppercase tracking-wide text-c-text-muted">Podział po bucketach</p>
      <div className="flex flex-wrap gap-1.5" data-testid="reconciliation-bucket-breakdown">
        {Object.entries(counts).map(([bucket, count]) => (
          <span
            key={bucket}
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-semibold ${
              bucket === 'DUPLICATE' ? 'bg-c-warning/10 text-c-warning' : 'bg-c-surface-raised text-c-text-secondary'
            }`}
          >
            {reconciliationBucketLabel(bucket as ReconciliationDetailRowDto['bucket'])}: {count}
          </span>
        ))}
      </div>
      {duplicateCount > 0 && (
        <p className="mt-1.5 text-[10px] text-c-warning" data-testid="reconciliation-duplicate-warning">
          {duplicateCount} {duplicateCount === 1 ? 'wiersz oznaczony' : 'wierszy oznaczonych'} jako{' '}
          {reconciliationBucketLabel('DUPLICATE').toLowerCase()} w tym przebiegu.
        </p>
      )}
    </div>
  );
}

export default ReconciliationLedgerPanel;
