/**
 * Pakiet F — widok „Wyliczenia" (`OWN-FIN-017`, drugi z dokładnie DWÓCH
 * głównych widoków Baseline Model — V-3).
 *
 * Przyszłe P&L/BS/CF w tej samej kanonicznej strukturze co Statements (31
 * linii, port `CANONICAL_LINE_META`/`STATEMENT_TYPE_OF_LINE` z
 * `baselineComputeService.ts`). Dynamiczny horyzont (miesiąc/kwartał/rok —
 * roll-up klienta: linie przepływowe sumują się, linie zasobowe biorą stan
 * na koniec okresu). Ślad lineage (proste info: harmonogram → linia). Alarm
 * luki finansowania i ujemna kasa BEZ plugu (DEC-FIN-002) — silnik
 * (`baselineCircularitySolver.ts`) nigdy nie podnosi gotówki do zera ani nie
 * emituje automatycznego finansowania; ten widok tylko RENDERUJE to, co
 * silnik zwrócił, nie koryguje.
 */
import React, { useMemo, useState } from 'react';

import {
  financeValueDisplayReasonLabel,
  formatFinanceValueForDisplay,
  isMissingFinanceValue,
  type BaselineOutputDto,
  type BaselinePeriodComputeSummaryDto,
} from '@/services/api/financeV2.types';

import {
  CANONICAL_LINE_META,
  CANONICAL_LINE_ORDER,
  STATEMENT_TYPE_OF_LINE,
  type CanonicalLineCode,
} from './baselineLabels';
import type { BaselineComputeUiState, BaselineStaleReason } from './useBaselineCompute';

const DRIVING_SCHEDULE_LABEL_OF_LINE: Partial<Record<CanonicalLineCode, string>> = {
  REVENUE: 'Przychody (cena/wolumen/mix)',
  COGS: 'Koszty (COGS/OPEX)',
  OPEX: 'Koszty (COGS/OPEX)',
  AR: 'Kapitał obrotowy (DSO/DIO/DPO)',
  INVENTORY: 'Kapitał obrotowy (DSO/DIO/DPO)',
  AP: 'Kapitał obrotowy (DSO/DIO/DPO)',
  CAPEX: 'CAPEX i amortyzacja',
  DEPRECIATION: 'CAPEX i amortyzacja',
  FIXED_ASSETS: 'CAPEX i amortyzacja',
  LONG_TERM_DEBT: 'Harmonogram zadłużenia',
  INTEREST_EXPENSE: 'Harmonogram zadłużenia',
  TAX_EXPENSE: 'Podatek',
  RETAINED_EARNINGS: 'Kapitał własny / zyski zatrzymane',
};

export type RollupGranularity = 'monthly' | 'quarterly' | 'yearly';

export interface PeriodMeta {
  periodId: string;
  label: string;
  /** ISO okres do grupowania kwartał/rok — `YYYY-MM`. */
  yearMonth: string;
}

export interface CalculationsViewProps {
  outputs: BaselineOutputDto[];
  loadingOutputs: boolean;
  outputsError: string | null;
  forecastPeriods: PeriodMeta[];
  computeState: BaselineComputeUiState;
  computeErrorDetail: { title: string; detail: string; code: string | null } | null;
  lastComputedAt: Date | null;
  wasRecovered: boolean;
  stale: { stale: boolean; reason: BaselineStaleReason };
  monthlyResults: BaselinePeriodComputeSummaryDto[] | null;
  onRunCompute: () => void;
  readOnly?: boolean;
}

function groupKeyFor(period: PeriodMeta, granularity: RollupGranularity): string {
  if (granularity === 'monthly') return period.periodId;
  const [y, m] = period.yearMonth.split('-');
  if (granularity === 'yearly') return y;
  const q = Math.ceil(Number(m) / 3);
  return `${y}-Q${q}`;
}

function rollupLabel(key: string, granularity: RollupGranularity, fallback: string): string {
  if (granularity === 'monthly') return fallback;
  if (granularity === 'yearly') return `FY${key}`;
  return key;
}

export function CalculationsView(props: CalculationsViewProps): React.ReactElement {
  const { outputs, loadingOutputs, outputsError, forecastPeriods, computeState, computeErrorDetail, lastComputedAt, wasRecovered, stale, monthlyResults, onRunCompute, readOnly = false } = props;
  const [granularity, setGranularity] = useState<RollupGranularity>('monthly');
  const [lineageOpenFor, setLineageOpenFor] = useState<string | null>(null);

  const groupedPeriods = useMemo(() => {
    const order: string[] = [];
    const membersByGroup = new Map<string, PeriodMeta[]>();
    for (const p of forecastPeriods) {
      const key = groupKeyFor(p, granularity);
      if (!membersByGroup.has(key)) {
        membersByGroup.set(key, []);
        order.push(key);
      }
      membersByGroup.get(key)!.push(p);
    }
    return order.map((key) => ({ key, label: rollupLabel(key, granularity, membersByGroup.get(key)![0].label), members: membersByGroup.get(key)! }));
  }, [forecastPeriods, granularity]);

  const outputsByLineAndPeriod = useMemo(() => {
    const m = new Map<string, BaselineOutputDto>();
    for (const o of outputs) m.set(`${o.lineCode}::${o.periodId}`, o);
    return m;
  }, [outputs]);

  const fundingGapPeriods = useMemo(
    () => (monthlyResults ?? []).filter((r) => r.qualityFlag === 'FUNDING_GAP'),
    [monthlyResults]
  );

  /**
   * ★ Pięć stanów (korekta kanonu, master plan §2.4 — nie trzy):
   * `PRESENT_ZERO` · `PRESENT_NONZERO` · `MISSING` · `NA` · `NOT_APPLICABLE`.
   * Wszystkie trzy stany „brakowe" renderują ten sam glif „—" (celowa decyzja
   * Pakietu C, `financeV2.types.ts` — widoczne rozróżnienie jest zadaniem
   * `title`/etykiety OBOK glifu, nie samego glifu), ale MUSZĄ być rozróżnialne
   * dla użytkownika — stąd `reason` z `financeValueDisplayReasonLabel`
   * wystawiony jako `title` na komórce.
   */
  function aggregatedValueFor(
    line: CanonicalLineCode,
    group: { members: PeriodMeta[] }
  ): { text: string; isMissingLikeGlyph: boolean; numeric: number | null; reason: string | null } {
    const meta = CANONICAL_LINE_META[line];
    const cellsInGroup = group.members.map((p) => outputsByLineAndPeriod.get(`${line}::${p.periodId}`));
    if (cellsInGroup.some((c) => c === undefined)) {
      // Brak choćby jednego miesiąca w grupie = brak danych dla całej grupy — NIGDY nie renderujemy częściowej sumy jako pełnego wyniku.
      return { text: '—', isMissingLikeGlyph: true, numeric: null, reason: 'Brak wyliczenia dla przynajmniej jednego miesiąca w tym okresie (roll-up)' };
    }
    const present = cellsInGroup as BaselineOutputDto[];
    const missingLike = present.filter((c) => c.value.status === 'MISSING' || c.value.status === 'NA' || c.value.status === 'NOT_APPLICABLE');
    if (missingLike.length > 0 || present.some((c) => isMissingFinanceValue(c.value))) {
      const reason =
        present.length === 1
          ? financeValueDisplayReasonLabel(present[0].value.status)
          : missingLike.length === present.length && new Set(missingLike.map((c) => c.value.status)).size === 1
            ? financeValueDisplayReasonLabel(missingLike[0].value.status)
            : `Część okresów w tym roll-upie bez danych (${Array.from(new Set(missingLike.map((c) => c.value.status))).join(', ')})`;
      return { text: '—', isMissingLikeGlyph: true, numeric: null, reason };
    }
    const numbers = present.map((c) => (c.value.valueDecimal === null ? null : Number(c.value.valueDecimal)));
    if (numbers.some((n) => n === null)) return { text: '—', isMissingLikeGlyph: true, numeric: null, reason: 'Brak wartości liczbowej' };
    const nums = numbers as number[];
    const value = meta.aggregation === 'flow-sum' ? nums.reduce((a, b) => a + b, 0) : nums[nums.length - 1];
    const display = formatFinanceValueForDisplay({ status: value === 0 ? 'PRESENT_ZERO' : 'PRESENT_NONZERO', valueDecimal: String(value) });
    return { text: display.text, isMissingLikeGlyph: false, numeric: value, reason: null };
  }

  const groupsByStatement = (statementType: 'P&L' | 'BS' | 'CF') =>
    CANONICAL_LINE_ORDER.filter((code) => STATEMENT_TYPE_OF_LINE[code] === statementType);

  return (
    <div className="flex h-full w-full flex-col overflow-hidden" data-testid="baseline-calculations-view">
      {/* ── Pasek stanu compute (bez duplikowania statusu z FinanceWorkspaceBar — tylko informacje SPECYFICZNE dla tego widoku: horyzont, ostatnie udane przeliczenie, alarm). ── */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-c-border-subtle px-4 py-2">
        <div className="flex items-center gap-2 text-xs text-c-text-muted">
          <label htmlFor="baseline-granularity" className="sr-only">
            Horyzont
          </label>
          <select
            id="baseline-granularity"
            value={granularity}
            onChange={(e) => setGranularity(e.target.value as RollupGranularity)}
            className="rounded-md border border-c-border-subtle bg-c-bg px-2 py-1 text-xs text-c-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
            data-testid="baseline-granularity-select"
          >
            <option value="monthly">Miesięcznie</option>
            <option value="quarterly">Kwartalnie</option>
            <option value="yearly">Rocznie</option>
          </select>
          <span data-testid="baseline-last-compute-label">
            {lastComputedAt
              ? `Ostatnie udane przeliczenie: ${lastComputedAt.toLocaleString('pl-PL')}${wasRecovered ? ' (odzyskane po przerwaniu połączenia)' : ''}`
              : 'Jeszcze nie przeliczono'}
          </span>
          {stale.stale && (
            <span className="rounded-full bg-c-warning/10 px-2 py-0.5 font-medium text-c-warning" data-testid="baseline-stale-badge">
              {stale.reason === 'ASSUMPTIONS_EDITED' ? 'Nieaktualne — założenia zmienione' : stale.reason === 'SOURCE_CHANGED' ? 'Nieaktualne — źródło zmienione' : 'Nie przeliczono'}
            </span>
          )}
        </div>
        <button
          type="button"
          disabled={readOnly || computeState === 'computing' || computeState === 'recovering'}
          onClick={onRunCompute}
          data-testid="baseline-run-compute"
          className="inline-flex min-h-[2.75rem] items-center rounded-lg bg-c-text px-3.5 text-xs font-semibold text-c-surface hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus disabled:cursor-not-allowed disabled:opacity-50"
        >
          {computeState === 'computing' ? 'Liczę…' : computeState === 'recovering' ? 'Sprawdzam stan…' : 'Przelicz'}
        </button>
      </div>

      {/* ── Stan compute — NIGDY surowy "Request timed out" (OWN-FIN-018). ── */}
      {computeState === 'computing' && (
        <div className="border-b border-c-border-subtle bg-c-surface-raised/60 px-4 py-2 text-xs text-c-text-secondary" data-testid="baseline-compute-computing-banner">
          Trwa przeliczanie modelu (solver zbieżności iteruje po każdym miesiącu)…
        </div>
      )}
      {computeState === 'recovering' && (
        <div className="border-b border-c-border-subtle bg-c-surface-raised/60 px-4 py-2 text-xs text-c-text-secondary" data-testid="baseline-compute-recovering-banner">
          Połączenie trwało dłużej niż zwykle — sprawdzam, czy przeliczenie mimo to się zakończyło…
        </div>
      )}
      {computeState === 'failed' && computeErrorDetail && (
        <div role="alert" className="border-b border-c-border-subtle bg-c-danger/5 px-4 py-2 text-xs text-c-danger" data-testid="baseline-compute-failed-banner">
          <span className="font-semibold">{computeErrorDetail.title}.</span> {computeErrorDetail.detail}
        </div>
      )}

      {/* ── Alarm luki finansowania (DEC-FIN-002) — TYLKO gdy silnik faktycznie oznaczył okres FUNDING_GAP, nigdy wymyślony. ── */}
      {fundingGapPeriods.length > 0 && (
        <div
          role="alert"
          className="flex items-start gap-2 border-b border-c-border-subtle bg-c-danger/10 px-4 py-2.5 text-xs text-c-danger"
          data-testid="baseline-funding-gap-alarm"
        >
          <span aria-hidden="true">⚠</span>
          <span>
            Luka finansowania w {fundingGapPeriods.length} {fundingGapPeriods.length === 1 ? 'okresie' : 'okresach'} — gotówka spada
            poniżej zera i POZOSTAJE ujemna (model nie dodaje finansowania ani nie spłaca długu automatycznie). Okresy:{' '}
            {fundingGapPeriods.map((p) => p.periodId).join(', ')}.
          </span>
        </div>
      )}

      {outputsError && (
        <div role="alert" className="border-b border-c-border-subtle bg-c-danger/5 px-4 py-2 text-xs text-c-danger">
          Nie udało się wczytać wyliczeń: {outputsError}
        </div>
      )}

      <div className="flex-1 overflow-auto">
        {loadingOutputs ? (
          <div className="flex min-h-[240px] items-center justify-center text-sm text-c-text-muted">Wczytuję wyliczenia…</div>
        ) : outputs.length === 0 && groupedPeriods.length === 0 ? (
          <div className="flex min-h-[240px] flex-col items-center justify-center gap-2 p-6 text-center">
            <p className="text-sm font-semibold text-c-text">Brak wyliczeń</p>
            <p className="max-w-sm text-xs text-c-text-muted">Uruchom przeliczenie, aby zobaczyć prognozowany P&amp;L, bilans i przepływy.</p>
          </div>
        ) : (
          (['P&L', 'BS', 'CF'] as const).map((statementType) => (
            <table key={statementType} /* §27-exempt: archetyp Excel — sprawozdanie finansowe (P&L/BS/CF) z liniami kanonicznymi i roll-upem, nie lista rekordów encji (docs/ui-standards/DOKTRYNA_TABELA_NIE_EXCEL.md #2) */ className="w-full min-w-[900px] border-collapse text-sm" data-testid={`baseline-statement-table-${statementType.replace('&', '')}`}>
              <thead className="sticky top-0 z-10 bg-c-surface-raised text-[11px] font-semibold uppercase tracking-wide text-c-text-muted">
                <tr>
                  <th className="px-3 py-2 text-left" style={{ minWidth: 220 }}>
                    {statementType === 'P&L' ? 'Rachunek wyników (P&L)' : statementType === 'BS' ? 'Bilans (BS)' : 'Przepływy pieniężne (CF)'}
                  </th>
                  {groupedPeriods.map((g) => (
                    <th key={g.key} className="px-3 py-2 text-right" style={{ minWidth: 100 }}>
                      <div>{g.label}</div>
                      <div className="text-[9px] font-normal normal-case text-c-text-muted">Prognoza</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {groupsByStatement(statementType).map((line) => {
                  const meta = CANONICAL_LINE_META[line];
                  const isCashLine = line === 'CASH';
                  return (
                    <tr key={line} className="border-b border-c-border-subtle/50">
                      <td className="px-3 py-1.5">
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 text-left text-c-text hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                          onClick={() => setLineageOpenFor((cur) => (cur === line ? null : line))}
                          data-testid={`baseline-line-lineage-toggle-${line}`}
                        >
                          {meta.labelPl}
                        </button>
                        {lineageOpenFor === line && (
                          <p className="mt-0.5 text-[10px] text-c-text-muted" data-testid={`baseline-line-lineage-${line}`}>
                            Ślad: {DRIVING_SCHEDULE_LABEL_OF_LINE[line] ? `Założenie (${DRIVING_SCHEDULE_LABEL_OF_LINE[line]}) → formuła silnika → ${meta.labelPl}` : `Wyliczone z innych linii → ${meta.labelPl} (bez bezpośredniego harmonogramu założeń)`}
                          </p>
                        )}
                      </td>
                      {groupedPeriods.map((g) => {
                        const agg = aggregatedValueFor(line, g);
                        const negative = agg.numeric !== null && agg.numeric < 0;
                        return (
                          <td
                            key={g.key}
                            className={`px-3 py-1.5 text-right tabular-nums ${
                              agg.isMissingLikeGlyph ? 'text-c-text-muted' : negative ? 'font-semibold text-c-danger' : 'text-c-text'
                            }`}
                            data-testid={isCashLine ? `baseline-cash-value-${g.key}` : `baseline-line-value-${line}-${g.key}`}
                            title={agg.reason ?? undefined}
                          >
                            {agg.text}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ))
        )}
      </div>
    </div>
  );
}

export default CalculationsView;
