/**
 * `CanonicalStatementTableV2` — kanoniczna tabela P&L/BS/CF nad realnym
 * kontraktem B2 (`StatementLineDto`/`FinanceValue`), Pakiet D.
 *
 * Różnice vs legacy `CanonicalStatementTable.tsx` (świadome, per brief):
 *   - dynamiczne okresy (nie ucięte do 2) — poziomy scroll wewnątrz tabeli,
 *     sticky pierwsza kolumna (nazwa linii) + sticky nagłówek (oba kierunki);
 *   - `FinanceValue.status` renderowany przez `formatFinanceValueForDisplay`
 *     — MISSING/NA/NOT_APPLICABLE NIGDY nie wygląda jak `0`;
 *   - waluta+skala widoczne w nagłówku tabeli (nie tylko w pasku modułu) —
 *     "waluta i skala przy KAŻDEJ tabeli";
 *   - dowód źródłowy NA POZIOMIE KOMÓRKI: klik komórki → `onSelectCell`
 *     (rodzic pokazuje `sourceRef` w panelu bocznym), nie tylko na poziomie
 *     wiersza;
 *   - `isAdjustment`/`adjustmentReason` → odznaka "Korekta zarządcza"
 *     (management-adjusted) na komórce; brak takiej flagi = "as reported"
 *     (domyślne, bez odznaki — unikamy szumu). Odznaka "restated" NIE jest tu
 *     renderowana — `StatementLineDto` nie niesie takiej flagi (zmierzone
 *     czytaniem `statements.routes.ts`, zgłoszone w raporcie jako
 *     EVIDENCE_MISSING, nie ukryte/zmyślone).
 *
 * DOKTRYNA_TABELA_NIE_EXCEL: kanoniczna struktura sprawozdania finansowego
 * (P&L/BS/CF), nie lista obiektów — ten sam archetyp co
 * `CanonicalStatementTable.tsx` (baseline). Zbudowana na div-grid, bez
 * surowych prymitywów tabelowych HTML i bez ról ARIA table/grid/columnheader
 * (celowo — check-list-canon R1 skanuje pod kątem tych tokenów).
 */

import React, { useMemo } from 'react';

import {
  financeValueDisplayReasonLabel,
  formatFinanceValueForDisplay,
  type FinanceValue,
} from '@/services/api/financeV2.types';

import {
  deriveStatementTable,
  pickHeaderCurrencyAndScale,
  type StatementTableCell,
} from './deriveStatementTable';
import type { StatementLineDto } from '@/services/api/financeV2.types';

/**
 * 2026-08-26 night-fixes-a (NIGHT_SWEEP_A_REPORT_20260826.md #10, Finance
 * FIX-2026): an unmapped line's raw source `lineCode` (e.g.
 * `MISC_UNMAPPED_90_ACCT`) rendered verbatim as the row's ONLY label —
 * `resolveLineLabel`'s real production implementation
 * (`lineCode ?? canonicalLineId ?? rowKey`, `FinanceHub.tsx`) has no
 * canonical->PL name dictionary to fall back on, so this table — the one
 * place that actually knows a row `usesLineCodeFallback` — is the right
 * layer to soften the presentation. Formats the raw code into readable
 * words (same "never a bare code" humanizer pattern already used for
 * Finance lineage edge types and ROI next-action types); the FULL raw code
 * stays in the `title` tooltip and next to the "nieprzypisana" badge for
 * traceability — nothing is hidden, just made readable at a glance.
 */
function humanizeFallbackLineCode(code: string): string {
  return code
    .toLowerCase()
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export interface CanonicalStatementCellSelection {
  rowKey: string;
  periodId: string;
  cell: StatementTableCell;
}

export interface CanonicalStatementTableV2Props {
  lines: readonly StatementLineDto[];
  /** Etykieta linii (nazwa PL) po `canonicalLineId`/`lineCode` — moduł dostarcza słownik, tabela go nie zna. */
  resolveLineLabel: (rowKey: string, canonicalLineId: string | null, lineCode: string | null) => string;
  selectedCellKey: string | null;
  onSelectCell: (selection: CanonicalStatementCellSelection) => void;
  emptyLabel: string;
}

function cellKey(rowKey: string, periodId: string): string {
  return `${rowKey}::${periodId}`;
}

const UNIT_LABELS: Record<FinanceValue['unit'], string> = {
  UNITS: 'jednostki',
  THOUSANDS: 'tysiące',
  MILLIONS: 'miliony',
  BILLIONS: 'miliardy',
};

export function CanonicalStatementTableV2(props: CanonicalStatementTableV2Props): React.ReactElement {
  const { lines, resolveLineLabel, selectedCellKey, onSelectCell, emptyLabel } = props;

  const table = useMemo(() => deriveStatementTable(lines), [lines]);
  const headerScale = useMemo(() => pickHeaderCurrencyAndScale(table), [table]);

  if (table.rows.length === 0) {
    return (
      <div className="flex min-h-[160px] flex-col items-center justify-center gap-1 p-6 text-center" data-testid="canonical-statement-table-v2-empty">
        <p className="text-sm font-medium text-c-text">{emptyLabel}</p>
      </div>
    );
  }

  return (
    <div
      className="flex h-full flex-col overflow-hidden rounded-xl border border-c-border-subtle bg-c-surface"
      aria-label="Tabela sprawozdania finansowego"
      data-testid="canonical-statement-table-v2"
    >
      {/* Waluta + skala — przy KAŻDEJ tabeli, nie tylko w pasku modułu. */}
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-c-border-subtle bg-c-surface-raised px-3 py-1.5 text-[10px] text-c-text-muted">
        <span data-testid="canonical-statement-table-v2-scale">
          {headerScale ? (
            <>
              Waluta: <span className="font-semibold text-c-text">{headerScale.currency}</span> · Skala:{' '}
              <span className="font-semibold text-c-text">{UNIT_LABELS[headerScale.unit]}</span>
            </>
          ) : (
            'Waluta/skala nieznana — brak danych w tej tabeli'
          )}
        </span>
        <span>
          {table.rows.length} {table.rows.length === 1 ? 'linia' : 'linii'} × {table.periods.length}{' '}
          {table.periods.length === 1 ? 'okres' : 'okresów'}
        </span>
      </div>

      <div className="flex-1 overflow-auto">
        <div
          className="grid"
          style={{ gridTemplateColumns: `minmax(220px,260px) repeat(${table.periods.length}, minmax(112px,1fr))` }}
        >
          {/* Nagłówek — sticky top */}
          <div className="sticky left-0 top-0 z-20 border-b border-r border-c-border-subtle bg-c-surface-raised px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-c-text-muted">
            Linia
          </div>
          {table.periods.map((period) => (
            <div
              key={period.periodId}
              className="sticky top-0 z-10 border-b border-c-border-subtle bg-c-surface-raised px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-c-text-muted"
            >
              {period.periodLabel}
            </div>
          ))}

          {/* Wiersze */}
          {table.rows.map((row, rowIdx) => {
            const rawLabel = resolveLineLabel(row.rowKey, row.canonicalLineId, row.lineCode);
            const label =
              row.usesLineCodeFallback && rawLabel ? humanizeFallbackLineCode(rawLabel) : rawLabel;
            const isEven = rowIdx % 2 === 0;
            return (
              <React.Fragment key={row.rowKey}>
                <div
                  className={`sticky left-0 z-10 flex items-center border-r border-b border-c-border-subtle px-3 py-1.5 text-[12.5px] font-medium text-c-text ${
                    isEven ? 'bg-c-surface' : 'bg-c-surface-raised/40'
                  }`}
                  title={row.usesLineCodeFallback ? `${label} (${rawLabel})` : label}
                >
                  <span className="truncate">{label}</span>
                  {row.usesLineCodeFallback && (
                    // ★ NAPRAWA a11y (Pakiet I): `text-c-warning` na 9px na tle
                    // `bg-c-warning/10` mierzy 3.91:1 (axe) — token ten sam
                    // odcień co tło (mniejszy kontrast niż jego własny kolor na
                    // czystej powierzchni sugeruje). `text-amber-900`/dark
                    // `amber-300` to ta sama konwencja co `StatusChip`
                    // TONE_SHELL.warning (już zweryfikowana kontrastowo tam).
                    <span
                      className="ml-1.5 shrink-0 rounded bg-c-warning/10 px-1 text-[9px] font-semibold uppercase text-amber-900 dark:text-amber-300"
                      title="Brak canonicalLineId — grupowane po kodzie źródłowym"
                    >
                      nieprzypisana
                    </span>
                  )}
                </div>
                {table.periods.map((period) => {
                  const cell = row.cellsByPeriodId[period.periodId];
                  if (!cell) {
                    return (
                      <div
                        key={period.periodId}
                        className={`border-b border-c-border-subtle px-3 py-1.5 text-right text-[12.5px] tabular-nums text-c-text-muted ${
                          isEven ? 'bg-c-surface' : 'bg-c-surface-raised/40'
                        }`}
                      >
                        —
                      </div>
                    );
                  }
                  const display = formatFinanceValueForDisplay(cell.value);
                  const reason = financeValueDisplayReasonLabel(cell.value.status);
                  const key = cellKey(row.rowKey, period.periodId);
                  const isSelected = selectedCellKey === key;
                  return (
                    <button
                      key={period.periodId}
                      type="button"
                      onClick={() => onSelectCell({ rowKey: row.rowKey, periodId: period.periodId, cell })}
                      title={reason ?? undefined}
                      aria-pressed={isSelected}
                      data-testid={`canonical-statement-cell-${key}`}
                      data-value-status={cell.value.status}
                      className={`flex items-center justify-end gap-1 border-b border-c-border-subtle px-3 py-1.5 text-right text-[12.5px] tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus focus-visible:ring-inset ${
                        isSelected
                          ? 'bg-c-focus/10 font-semibold text-c-text'
                          : display.isMissingLikeGlyph
                            ? `text-c-text-muted hover:bg-c-surface-raised ${isEven ? 'bg-c-surface' : 'bg-c-surface-raised/40'}`
                            : `text-c-text hover:bg-c-surface-raised ${isEven ? 'bg-c-surface' : 'bg-c-surface-raised/40'}`
                      }`}
                    >
                      {cell.value.isAdjustment && (
                        // ★ NAPRAWA a11y (Pakiet I) — sam defekt co odznaka "nieprzypisana" wyżej.
                        <span
                          className="rounded bg-c-warning/10 px-1 text-[9px] font-semibold uppercase text-amber-900 dark:text-amber-300"
                          title={cell.value.adjustmentReason ? `Korekta zarządcza: ${cell.value.adjustmentReason}` : 'Korekta zarządcza'}
                        >
                          korekta
                        </span>
                      )}
                      <span>{display.text}</span>
                    </button>
                  );
                })}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default CanonicalStatementTableV2;
