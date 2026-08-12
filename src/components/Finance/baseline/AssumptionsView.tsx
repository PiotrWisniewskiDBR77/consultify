/**
 * Pakiet F — widok „Założenia" (`OWN-FIN-017`, jeden z dokładnie DWÓCH
 * głównych widoków Baseline Model — V-3).
 *
 * Pełnoszeroki grid: per założenie — wartość historyczna · okres bazowy ·
 * reguła kalibracji · jednostka · źródło · wartość prognozy (edytowalna,
 * kontrolka zależna od jednostki) · bezpieczny zakres · jakość · podgląd
 * wpływu (które linie kanoniczne zasila ten harmonogram). Cofnięcie/reset do
 * ostatniej zapisanej wartości, wklejanie wsadowe (kolumna „Wartość
 * prognozy"), undo/redo, stan `dirty`, komentarz lokalny.
 *
 * ★ V-4: jednolity polski (skróty finansowe REVENUE/COGS/EBITDA zostają).
 * ★ V-5: brak martwej przestrzeni — grid wypełnia pełną szerokość
 * (`w-full`, kolumny `minmax`, nie stałe px).
 */
import React, { useCallback, useMemo, useRef, useState } from 'react';

import { useDialogA11y } from '@/components/ui/primitives/useDialogA11y';

import {
  formatFinanceValueForDisplay,
  type BaselineAssumptionDto,
  type BaselineAssumptionQuality,
  type BaselineAssumptionRule,
  type FinanceValue,
} from '@/services/api/financeV2.types';

import {
  BASELINE_RULE_LABELS,
  BASELINE_SCHEDULE_TYPE_LABELS,
  controlKindForUnit,
  driverLabel,
} from './baselineLabels';
import type { AssumptionCellKey, UseBaselineAssumptionsEditorResult } from './useBaselineAssumptionsEditor';
import { cellKeyOf } from './useBaselineAssumptionsEditor';

/** Który harmonogram zasila które linie wyliczeń — port `DRIVING_SCHEDULE_TYPE` (baselineComputeService.ts:132-140), odwrócony do „podgląd wpływu". */
const SCHEDULE_FEEDS_LINES: Record<string, string[]> = {
  revenue_pvm: ['REVENUE'],
  cogs_opex: ['COGS', 'OPEX'],
  wc_dso_dio_dpo: ['AR', 'INVENTORY', 'AP'],
  capex_depreciation: ['CAPEX', 'DEPRECIATION', 'FIXED_ASSETS'],
  debt_maturity: ['LONG_TERM_DEBT', 'INTEREST_EXPENSE'],
  tax_nol: ['TAX_EXPENSE'],
  equity_re: ['RETAINED_EARNINGS'],
  headcount: [],
  leases: [],
};

function periodLabelOf(periodId: string, periodLabelById?: Record<string, string>): string {
  return periodLabelById?.[periodId] ?? periodId;
}

/**
 * ★ NAPRAWA punktu 4 orkiestratora: `rangeLow`/`rangeHigh` bywają liczbami
 * zmiennoprzecinkowymi ze szczątkami precyzji (np. `0.58 - 0.1` w JS daje
 * `0.48000000000000004`, nie `0.48`) — czy to z realnego API (`Number()` na
 * dowolnym decimalu), czy z fikstury dev-render. Renderowane wprost w 56px
 * polu liczbowym, taki ciąg wizualnie się ucina. Zaokrąglenie do 4 miejsc
 * (precyzja wystarczająca dla stopni/procentów tego ekranu — kroki wejścia
 * to `0.001`/`0.01`) usuwa szczątki bez utraty realnej precyzji wejścia.
 */
function roundForRangeDisplay(n: number): number {
  return Math.round(n * 10000) / 10000;
}

function historicalValueOf(row: BaselineAssumptionDto | null): FinanceValue | null {
  const raw = row?.value.sourceRef;
  if (!raw || typeof raw !== 'object') return null;
  const historical = (raw as Record<string, unknown>).historicalValueDecimal;
  if (typeof historical !== 'number' && typeof historical !== 'string') return null;
  return {
    status: 'PRESENT_NONZERO',
    valueDecimal: String(historical),
    nativeCurrency: 'PLN',
    presentationCurrency: 'PLN',
    unit: (row?.value.unit as FinanceValue['unit']) ?? 'UNITS',
    multiplier: '1',
    sourceRef: null,
    isAdjustment: false,
    adjustmentReason: null,
  };
}

function sourceLabelOf(row: BaselineAssumptionDto | null): string {
  const raw = row?.value.sourceRef;
  if (!raw || typeof raw !== 'object') return '—';
  const r = raw as Record<string, unknown>;
  const parts: string[] = [];
  if (typeof r.statementPackLabel === 'string') parts.push(r.statementPackLabel);
  if (typeof r.analysisVersionLabel === 'string') parts.push(r.analysisVersionLabel);
  return parts.length > 0 ? parts.join(' · ') : '—';
}

export type AssumptionRowSpec = AssumptionCellKey;

export interface AssumptionsViewProps {
  editor: UseBaselineAssumptionsEditorResult;
  /** Kolejność wyświetlanych komórek — z modułu wywołującego (Kreator/kolejność harmonogramów), nie zgadywana tutaj. */
  rowOrder: AssumptionRowSpec[];
  periodLabelById?: Record<string, string>;
  readOnly?: boolean;
}

export function AssumptionsView({ editor, rowOrder, periodLabelById, readOnly = false }: AssumptionsViewProps): React.ReactElement {
  const { cells, setCellValue, resetCellToServer, undo, redo, canUndo, canRedo, dirtyCount, preflightWarnings, saving, save, saveError } = editor;
  const [confirmingDespiteWarnings, setConfirmingDespiteWarnings] = useState(false);

  // ★ NAPRAWA a11y (Pakiet I): dialog potwierdzenia zapisu mimo ostrzeżeń
  // nie miał pułapki fokusa/Escape/przywrócenia. Wyzwalacz („Zapisz zestaw
  // założeń", `baseline-assumptions-save`) NIE odmontowuje się pod dialogiem
  // — domyślne przechwycenie `document.activeElement` w `useDialogA11y`
  // wystarczy, bez fallbacku.
  const confirmDialogContainerRef = useRef<HTMLDivElement>(null);
  useDialogA11y({
    open: confirmingDespiteWarnings,
    onClose: () => setConfirmingDespiteWarnings(false),
    containerRef: confirmDialogContainerRef,
  });

  const requestSave = useCallback(() => {
    if (preflightWarnings.length > 0) {
      setConfirmingDespiteWarnings(true);
      return;
    }
    void save();
  }, [preflightWarnings.length, save]);

  const preflightByKey = useMemo(() => {
    const m = new Map<string, 'MISSING' | 'OUT_OF_RANGE'>();
    for (const w of preflightWarnings) m.set(w.key, w.reason);
    return m;
  }, [preflightWarnings]);

  const handlePasteIntoColumn = useCallback(
    (startIndex: number, clipboardText: string) => {
      const values = clipboardText
        .split(/\r?\n/)
        .map((line) => line.split('\t')[0]?.trim())
        .filter((v) => v !== undefined && v !== '');
      if (values.length === 0) return;
      const entries: Array<{ key: AssumptionCellKey; patch: { valueDecimal: number | null; valueStatus: 'PRESENT_NONZERO' | 'PRESENT_ZERO' } }> = [];
      for (let i = 0; i < values.length && startIndex + i < rowOrder.length; i++) {
        const spec = rowOrder[startIndex + i];
        const parsed = Number(values[i].replace(',', '.').replace('%', ''));
        if (Number.isNaN(parsed)) continue;
        entries.push({
          key: spec,
          patch: { valueDecimal: parsed, valueStatus: parsed === 0 ? 'PRESENT_ZERO' : 'PRESENT_NONZERO' },
        });
      }
      if (entries.length > 0) editor.pasteBatch(entries);
    },
    [editor, rowOrder]
  );

  return (
    <div className="flex h-full w-full flex-col overflow-hidden" data-testid="baseline-assumptions-view">
      <div className="flex items-center justify-between gap-3 border-b border-c-border-subtle px-4 py-2">
        <div className="flex items-center gap-2 text-xs text-c-text-muted">
          <span data-testid="baseline-assumptions-dirty-count">
            {dirtyCount > 0 ? `${dirtyCount} niezapisanych zmian` : 'Brak niezapisanych zmian'}
          </span>
          {preflightWarnings.length > 0 && (
            <span className="rounded-full bg-c-warning/10 px-2 py-0.5 font-medium text-c-warning" data-testid="baseline-preflight-warning-count">
              {preflightWarnings.length} do sprawdzenia przed zatwierdzeniem
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={!canUndo || readOnly}
            onClick={undo}
            data-testid="baseline-assumptions-undo"
            className="inline-flex min-h-[2.75rem] items-center rounded-lg border border-c-border-subtle px-3 text-xs font-medium text-c-text-secondary hover:bg-c-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus disabled:cursor-not-allowed disabled:opacity-40"
          >
            Cofnij
          </button>
          <button
            type="button"
            disabled={!canRedo || readOnly}
            onClick={redo}
            data-testid="baseline-assumptions-redo"
            className="inline-flex min-h-[2.75rem] items-center rounded-lg border border-c-border-subtle px-3 text-xs font-medium text-c-text-secondary hover:bg-c-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus disabled:cursor-not-allowed disabled:opacity-40"
          >
            Ponów
          </button>
          <button
            type="button"
            disabled={dirtyCount === 0 || saving || readOnly}
            onClick={requestSave}
            data-testid="baseline-assumptions-save"
            className="inline-flex min-h-[2.75rem] items-center rounded-lg bg-c-text px-3.5 text-xs font-semibold text-c-surface hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving ? 'Zapisuję…' : 'Zapisz zestaw założeń'}
          </button>
        </div>
      </div>
      {saveError && (
        <p role="alert" className="border-b border-c-border-subtle bg-c-danger/5 px-4 py-1.5 text-xs text-c-danger">
          Nie udało się zapisać: {saveError}
        </p>
      )}
      {confirmingDespiteWarnings && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4" role="presentation" onMouseDown={() => setConfirmingDespiteWarnings(false)}>
          <div
            ref={confirmDialogContainerRef}
            role="alertdialog"
            aria-modal="true"
            aria-label="Potwierdź zapis zestawu założeń mimo ostrzeżeń"
            onMouseDown={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-xl border border-c-border-subtle bg-c-surface p-4 shadow-xl"
            data-testid="baseline-assumptions-preflight-confirm"
          >
            <p className="text-sm font-semibold text-c-text">Zestaw założeń ma ostrzeżenia</p>
            <p className="mt-1 text-sm text-c-text-secondary">
              {preflightWarnings.length} {preflightWarnings.length === 1 ? 'komórka wymaga' : 'komórek wymaga'} uwagi (brak danych lub
              wartość poza bezpiecznym zakresem). Możesz zapisać mimo to — wyliczenia będą to odzwierciedlać.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmingDespiteWarnings(false)}
                className="inline-flex min-h-[2.75rem] items-center rounded-lg border border-c-border-subtle px-3.5 text-xs font-medium text-c-text-secondary hover:bg-c-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
              >
                Anuluj
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmingDespiteWarnings(false);
                  void save();
                }}
                data-testid="baseline-assumptions-preflight-confirm-save"
                className="inline-flex min-h-[2.75rem] items-center rounded-lg bg-c-text px-3.5 text-xs font-semibold text-c-surface hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
              >
                Zapisz mimo to
              </button>
            </div>
          </div>
        </div>
      )}
      {/* `pb-16`: patrz uzasadnienie w `CalculationsView.tsx` (punkt 1 orkiestratora) — ostatni wiersz nie chowa się pod pływającą kontrolką w rogu przy przewinięciu do końca. */}
      <div className="flex-1 overflow-auto pb-16">
        <table /* §27-exempt: archetyp Excel — grid komórek edytowalnych (reguła/wartość/zakres) z formułami silnika, nie lista rekordów encji (docs/ui-standards/DOKTRYNA_TABELA_NIE_EXCEL.md #2) */ className="w-full min-w-[1200px] border-collapse text-sm" role="table" data-testid="baseline-assumptions-table">
          <thead className="sticky top-0 z-10 bg-c-surface-raised text-[11px] font-semibold uppercase tracking-wide text-c-text-muted">
            <tr>
              <th className="px-3 py-2 text-left" style={{ minWidth: 220 }}>Założenie</th>
              <th className="px-3 py-2 text-right" style={{ minWidth: 110 }}>Wart. historyczna</th>
              <th className="px-3 py-2 text-left" style={{ minWidth: 90 }}>Okres bazowy</th>
              {/*
                ★ NAPRAWA punktu 4 orkiestratora: „Reguła kalibracji" (najdłuższa
                etykieta „Powiązane z KPI analizy" ~23 znaki) i „Jakość"
                („Ograniczona") były węższe niż treść natywnych `<select>` —
                przeglądarka obcinała wybraną opcję wielokropkiem
                („Średnia historycz…", „Potwierd…"). Szerokości poniżej
                zmierzone pod realne etykiety z `baselineLabels.ts`
                (`BASELINE_RULE_LABELS`/opcje jakości), nie zgadywane.
              */}
              <th className="px-3 py-2 text-left" style={{ minWidth: 210 }}>Reguła kalibracji</th>
              <th className="px-3 py-2 text-left" style={{ minWidth: 170 }}>Źródło</th>
              <th className="px-3 py-2 text-right" style={{ minWidth: 140 }}>Wartość prognozy</th>
              <th className="px-3 py-2 text-left" style={{ minWidth: 180 }}>Bezpieczny zakres</th>
              <th className="px-3 py-2 text-left" style={{ minWidth: 140 }}>Jakość</th>
              <th className="px-3 py-2 text-left" style={{ minWidth: 140 }}>Podgląd wpływu</th>
              <th className="px-3 py-2 text-center" style={{ minWidth: 90 }}>Akcje</th>
            </tr>
          </thead>
          <tbody>
            {rowOrder.map((spec, index) => {
              const key = cellKeyOf(spec);
              const cell = cells.get(key);
              const server = cell?.server ?? null;
              const historical = historicalValueOf(server);
              const historicalDisplay = historical ? formatFinanceValueForDisplay(historical) : { text: '—', isMissingLikeGlyph: true };
              const valueDisplay = formatFinanceValueForDisplay({ status: cell?.valueStatus ?? 'MISSING', valueDecimal: cell?.valueDecimal !== null && cell?.valueDecimal !== undefined ? String(cell.valueDecimal) : null });
              const control = controlKindForUnit(cell?.unit ?? 'PCT');
              const warning = preflightByKey.get(key);
              const feeds = SCHEDULE_FEEDS_LINES[spec.scheduleType] ?? [];

              return (
                <tr
                  key={key}
                  data-testid={`baseline-assumption-row-${index}`}
                  className={`border-b border-c-border-subtle/60 ${cell?.dirty ? 'bg-c-warning/5' : ''} ${warning === 'MISSING' ? 'bg-c-danger/5' : ''}`}
                >
                  <td className="px-3 py-2">
                    <div className="font-medium text-c-text">{driverLabel(spec.driverCode)}</div>
                    <div className="text-xs text-c-text-muted">{BASELINE_SCHEDULE_TYPE_LABELS[spec.scheduleType]}</div>
                  </td>
                  <td className={`px-3 py-2 text-right tabular-nums ${historicalDisplay.isMissingLikeGlyph ? 'text-c-text-muted' : 'text-c-text'}`}>
                    {historicalDisplay.text}
                  </td>
                  <td className="px-3 py-2 text-xs text-c-text-secondary">{periodLabelOf(server?.basePeriodId ?? spec.periodId, periodLabelById)}</td>
                  <td className="px-3 py-2">
                    <select
                      disabled={readOnly}
                      value={cell?.rule ?? 'MANUAL_OVERRIDE'}
                      onChange={(e) => setCellValue(spec, { rule: e.target.value as BaselineAssumptionRule })}
                      className="w-full rounded-md border border-c-border-subtle bg-c-bg px-2 py-1 text-xs text-c-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                      data-testid={`baseline-assumption-rule-${index}`}
                    >
                      {Object.entries(BASELINE_RULE_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2 text-xs text-c-text-secondary">{sourceLabelOf(server)}</td>
                  <td className="px-3 py-2 text-right">
                    {control === 'percent-stepper' ? (
                      <div className="flex items-center justify-end gap-1">
                        <input
                          type="number"
                          step="0.001"
                          disabled={readOnly}
                          value={cell?.valueDecimal ?? ''}
                          onChange={(e) =>
                            setCellValue(spec, {
                              valueDecimal: e.target.value === '' ? null : Number(e.target.value),
                              valueStatus: e.target.value === '' ? 'MISSING' : Number(e.target.value) === 0 ? 'PRESENT_ZERO' : 'PRESENT_NONZERO',
                            })
                          }
                          onPaste={(e) => {
                            const text = e.clipboardData.getData('text');
                            if (text.includes('\n') || text.includes('\t')) {
                              e.preventDefault();
                              handlePasteIntoColumn(index, text);
                            }
                          }}
                          className="w-20 rounded-md border border-c-border-subtle bg-c-bg px-2 py-1 text-right text-xs tabular-nums text-c-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                          data-testid={`baseline-assumption-value-${index}`}
                          aria-label={`Wartość prognozy — ${driverLabel(spec.driverCode)}`}
                        />
                        <span className="text-xs text-c-text-muted">{valueDisplay.text}</span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-end gap-1">
                        <input
                          type="number"
                          step={control === 'amount-precise' ? '0.01' : '1'}
                          disabled={readOnly}
                          value={cell?.valueDecimal ?? ''}
                          onChange={(e) =>
                            setCellValue(spec, {
                              valueDecimal: e.target.value === '' ? null : Number(e.target.value),
                              valueStatus: e.target.value === '' ? 'MISSING' : Number(e.target.value) === 0 ? 'PRESENT_ZERO' : 'PRESENT_NONZERO',
                            })
                          }
                          onPaste={(e) => {
                            const text = e.clipboardData.getData('text');
                            if (text.includes('\n') || text.includes('\t')) {
                              e.preventDefault();
                              handlePasteIntoColumn(index, text);
                            }
                          }}
                          className="w-24 rounded-md border border-c-border-subtle bg-c-bg px-2 py-1 text-right text-xs tabular-nums text-c-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                          data-testid={`baseline-assumption-value-${index}`}
                          aria-label={`Wartość prognozy — ${driverLabel(spec.driverCode)}`}
                        />
                        <span className="text-[10px] text-c-text-muted">{cell?.unit === 'DAYS' ? 'dni' : cell?.unit === 'MONTHS' ? 'mies.' : ''}</span>
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {cell?.rangeLow !== null && cell?.rangeHigh !== null && cell?.rangeLow !== undefined && cell?.rangeHigh !== undefined ? (
                      <div className="flex items-center gap-1 text-xs text-c-text-secondary">
                        <input
                          type="number"
                          disabled={readOnly}
                          value={roundForRangeDisplay(cell.rangeLow)}
                          onChange={(e) => setCellValue(spec, { rangeLow: Number(e.target.value) })}
                          className="w-20 rounded-md border border-c-border-subtle bg-c-bg px-1.5 py-1 text-right tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                          data-testid={`baseline-assumption-range-low-${index}`}
                        />
                        <span>–</span>
                        <input
                          type="number"
                          disabled={readOnly}
                          value={roundForRangeDisplay(cell.rangeHigh)}
                          onChange={(e) => setCellValue(spec, { rangeHigh: Number(e.target.value) })}
                          className="w-20 rounded-md border border-c-border-subtle bg-c-bg px-1.5 py-1 text-right tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                          data-testid={`baseline-assumption-range-high-${index}`}
                        />
                      </div>
                    ) : (
                      <span className="text-xs text-c-text-muted">Bez limitu</span>
                    )}
                    {cell?.outOfSafeRange && (
                      <p className="mt-0.5 text-[10px] font-medium text-c-danger" data-testid={`baseline-assumption-outofrange-${index}`}>
                        Poza bezpiecznym zakresem
                      </p>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <select
                      disabled={readOnly}
                      value={cell?.quality ?? 'ESTIMATED'}
                      onChange={(e) => setCellValue(spec, { quality: e.target.value as BaselineAssumptionQuality })}
                      className="w-full rounded-md border border-c-border-subtle bg-c-bg px-2 py-1 text-xs text-c-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                      data-testid={`baseline-assumption-quality-${index}`}
                    >
                      <option value="CONFIRMED">Potwierdzona</option>
                      <option value="ESTIMATED">Szacowana</option>
                      <option value="DEGRADED_INSUFFICIENT_HISTORY">Ograniczona</option>
                    </select>
                  </td>
                  <td className="px-3 py-2 text-xs text-c-text-muted">{feeds.length > 0 ? `Zasila: ${feeds.join(', ')}` : '—'}</td>
                  <td className="px-3 py-2 text-center">
                    <button
                      type="button"
                      disabled={!cell?.dirty || readOnly}
                      onClick={() => resetCellToServer(spec)}
                      title="Cofnij do ostatniej zapisanej wartości"
                      className="inline-flex min-h-[2.25rem] items-center rounded-md border border-c-border-subtle px-2 text-[11px] text-c-text-secondary hover:bg-c-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus disabled:cursor-not-allowed disabled:opacity-30"
                      data-testid={`baseline-assumption-reset-${index}`}
                    >
                      Reset
                    </button>
                  </td>
                </tr>
              );
            })}
            {rowOrder.length === 0 && (
              <tr>
                <td colSpan={10} className="px-3 py-10 text-center text-sm text-c-text-muted">
                  Ten model nie ma jeszcze żadnych założeń.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default AssumptionsView;
