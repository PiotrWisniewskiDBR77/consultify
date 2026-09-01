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
import { RotateCcw, Trash2 } from 'lucide-react';
import React, { useCallback, useMemo, useRef, useState } from 'react';

import { RowActionsMenu } from '@/components/shared/RowActionsMenu';
import { useDialogA11y } from '@/components/ui/primitives/useDialogA11y';
import {
  type BaselineAssumptionDto,
  type BaselineAssumptionQuality,
  type BaselineAssumptionRule,
  type BaselineScheduleType,
  type FinanceValue,
  formatFinanceValueForDisplay,
} from '@/services/api/financeV2.types';

import {
  BASELINE_RULE_LABELS,
  BASELINE_SCHEDULE_TYPE_LABELS,
  CANONICAL_LINE_META,
  type CanonicalLineCode,
  controlKindForUnit,
  driverLabel,
  driverUnit,
  WIRED_DRIVERS_BY_SCHEDULE,
} from './baselineLabels';
import type {
  AssumptionCellKey,
  UseBaselineAssumptionsEditorResult,
} from './useBaselineAssumptionsEditor';
import { cellKeyOf } from './useBaselineAssumptionsEditor';

/**
 * Wartości z `unit === 'PCT'` (wzrost r/r, COGS/OPEX % przychodów, CAPEX %,
 * oprocentowanie, stawka CIT) są w danych ułamkiem dziesiętnym (0,12 = 12%).
 * `formatFinanceValueForDisplay`'s domyślny formatter pokazuje surowy ułamek
 * ("0,12") bez znaku procenta — myląca ta sama klasa defektu co w
 * `finance-analysis-workspace` ("wskaźniki bez %"), ale TU jednostka JEST
 * znana (`cell.unit`/`historical.unit`), więc naprawialna w wyglądzie.
 */
function formatPctAwareValue(
  value: Pick<FinanceValue, 'status' | 'valueDecimal'>,
  unit: string | undefined
): ReturnType<typeof formatFinanceValueForDisplay> {
  return formatFinanceValueForDisplay(
    value,
    unit === 'PCT'
      ? (n) => `${(n * 100).toLocaleString('pl-PL', { maximumFractionDigits: 2 })}%`
      : undefined
  );
}

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

/** Etykieta linii kanonicznej dla kolumny „Podgląd wpływu" — surowy kod tylko jako fallback dla nieznanego kodu (nie powinien wystąpić, `SCHEDULE_FEEDS_LINES` wypełniamy wyłącznie z `CanonicalLineCode`). */
function feedLineLabel(code: string): string {
  return CANONICAL_LINE_META[code as CanonicalLineCode]?.labelPl ?? code;
}

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
  /** 176-dwie-poprawki: encja nowo dodawanego wiersza ("Dodaj założenie") — Baseline jest single-entity, więc to zawsze ta sama wartość co reszta ekranu. */
  entityId?: string;
}

export function AssumptionsView({
  editor,
  rowOrder,
  periodLabelById,
  readOnly = false,
  entityId: entityIdProp,
}: AssumptionsViewProps): React.ReactElement {
  const {
    cells,
    setCellValue,
    resetCellToServer,
    deleteRow,
    undo,
    redo,
    canUndo,
    canRedo,
    dirtyCount,
    preflightWarnings,
    saving,
    save,
    saveError,
  } = editor;
  const [confirmingDespiteWarnings, setConfirmingDespiteWarnings] = useState(false);

  /*
   * 176-dwie-poprawki (uwaga właściciela, DRUGIE zgłoszenie: "dalej nie mam
   * przycisku dodawania założeń i możliwości usuwania linii"). Sprawdzone:
   * `assumptionRowOrder` (kontekst z serwera, `baselineContextService.ts`)
   * to `SELECT DISTINCT` z JUŻ ISTNIEJĄCYCH wierszy — serwer nie ma pojęcia
   * "katalogu" wierszy do wyboru, więc dodanie NOWEGO (scheduleType,
   * driverCode) po prostu nie pojawia się, dopóki ktoś go nie zapisze.
   * `extraRows` to wiersze dodane W TEJ SESJI (jeszcze nie odświeżone z
   * kontekstu) — scalone z `rowOrder` poniżej, znikają z tej listy same,
   * gdy `rowOrder` faktycznie już je zawiera (po zapisie + przeładowaniu
   * kontekstu przez rodzica, albo po prostu przy następnym mount).
   */
  const [extraRows, setExtraRows] = useState<AssumptionRowSpec[]>([]);
  /**
   * Klucze usunięte W TEJ SESJI. Ten sam powód co `extraRows` w drugą
   * stronę: `rowOrder` (kontekst z serwera) jest pobierany RAZ przy mount
   * (`BaselineWorkspaceContextLoader`) — `deleteRow` odświeża TYLKO
   * `editor.rows`/`cells` (`listBaselineAssumptions`), nie kontekst
   * rodzica. Bez tej listy usunięty wiersz z ORYGINALNEGO `rowOrder`
   * wracałby natychmiast (żywy dowód: zmierzone w tej sesji — DELETE
   * naprawdę usuwał wiersz z backendu/mocka, ale UI dalej go pokazywał,
   * bo `rowOrder` nie wiedział o usunięciu).
   */
  const [deletedKeys, setDeletedKeys] = useState<Set<string>>(new Set());
  const effectiveRowOrder = useMemo(() => {
    const known = new Set(rowOrder.map((r) => cellKeyOf(r)));
    return [...rowOrder, ...extraRows.filter((r) => !known.has(cellKeyOf(r)))].filter(
      (r) => !deletedKeys.has(cellKeyOf(r))
    );
  }, [rowOrder, extraRows, deletedKeys]);

  const entityId = entityIdProp ?? rowOrder[0]?.entityId ?? extraRows[0]?.entityId ?? '';
  const periodOptions = useMemo(
    () => Object.entries(periodLabelById ?? {}),
    [periodLabelById]
  );

  const [addOpen, setAddOpen] = useState(false);
  const [addScheduleType, setAddScheduleType] = useState<BaselineScheduleType>('revenue_pvm');
  const [addDriverCode, setAddDriverCode] = useState<string>('');
  const [addCustomDriverCode, setAddCustomDriverCode] = useState('');
  const [addPeriodId, setAddPeriodId] = useState<string>('');
  const [addError, setAddError] = useState<string | null>(null);
  const addDialogContainerRef = useRef<HTMLDivElement>(null);
  const addTriggerRef = useRef<HTMLButtonElement>(null);
  useDialogA11y({
    open: addOpen,
    onClose: () => setAddOpen(false),
    containerRef: addDialogContainerRef,
    getFallbackFocusTarget: () => addTriggerRef.current,
  });

  const wiredDrivers = WIRED_DRIVERS_BY_SCHEDULE[addScheduleType] ?? [];
  const scheduleIsWired = wiredDrivers.length > 0;

  function openAddDialog(): void {
    setAddScheduleType('revenue_pvm');
    setAddDriverCode(WIRED_DRIVERS_BY_SCHEDULE.revenue_pvm?.[0] ?? '');
    setAddCustomDriverCode('');
    setAddPeriodId(periodOptions[0]?.[0] ?? '');
    setAddError(null);
    setAddOpen(true);
  }

  function submitAddRow(): void {
    const driverCode = scheduleIsWired ? addDriverCode : addCustomDriverCode.trim();
    if (!driverCode) {
      setAddError('Wybierz założenie.');
      return;
    }
    if (!addPeriodId) {
      setAddError('Wybierz okres.');
      return;
    }
    if (!entityId) {
      setAddError('Brak identyfikatora encji — nie da się dodać wiersza.');
      return;
    }
    const spec: AssumptionRowSpec = {
      scheduleType: addScheduleType,
      driverCode,
      entityId,
      periodId: addPeriodId,
    };
    const key = cellKeyOf(spec);
    if (effectiveRowOrder.some((r) => cellKeyOf(r) === key)) {
      setAddError('Ten wiersz już istnieje w zestawie.');
      return;
    }
    setExtraRows((prev) => [...prev, spec]);
    setCellValue(spec, {
      rule: 'MANUAL_OVERRIDE',
      quality: 'ESTIMATED',
      valueStatus: 'MISSING',
      valueDecimal: null,
      unit: scheduleIsWired ? driverUnit(driverCode) : 'PCT',
    });
    setAddOpen(false);
    addTriggerRef.current?.focus();
  }

  const [pendingDelete, setPendingDelete] = useState<AssumptionRowSpec | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const deleteDialogContainerRef = useRef<HTMLDivElement>(null);
  useDialogA11y({
    open: pendingDelete !== null,
    onClose: () => setPendingDelete(null),
    containerRef: deleteDialogContainerRef,
  });

  async function confirmDeleteRow(): Promise<void> {
    if (!pendingDelete) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const result = await deleteRow(pendingDelete);
      if (!result.ok) {
        setDeleteError(result.message);
        return;
      }
      const key = cellKeyOf(pendingDelete);
      setExtraRows((prev) => prev.filter((r) => cellKeyOf(r) !== key));
      setDeletedKeys((prev) => new Set(prev).add(key));
      setPendingDelete(null);
    } finally {
      setDeleting(false);
    }
  }

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
      const entries: Array<{
        key: AssumptionCellKey;
        patch: { valueDecimal: number | null; valueStatus: 'PRESENT_NONZERO' | 'PRESENT_ZERO' };
      }> = [];
      for (let i = 0; i < values.length && startIndex + i < effectiveRowOrder.length; i++) {
        const spec = effectiveRowOrder[startIndex + i];
        const parsed = Number(values[i].replace(',', '.').replace('%', ''));
        if (Number.isNaN(parsed)) continue;
        entries.push({
          key: spec,
          patch: {
            valueDecimal: parsed,
            valueStatus: parsed === 0 ? 'PRESENT_ZERO' : 'PRESENT_NONZERO',
          },
        });
      }
      if (entries.length > 0) editor.pasteBatch(entries);
    },
    [editor, effectiveRowOrder]
  );

  return (
    <div
      className="flex h-full w-full flex-col overflow-hidden"
      data-testid="baseline-assumptions-view"
    >
      <div className="flex items-center justify-between gap-3 border-b border-c-border-subtle px-4 py-2">
        <div className="flex items-center gap-2 text-xs text-c-text-muted">
          <span data-testid="baseline-assumptions-dirty-count">
            {dirtyCount > 0 ? `${dirtyCount} niezapisanych zmian` : 'Brak niezapisanych zmian'}
          </span>
          {preflightWarnings.length > 0 && (
            <span
              className="rounded-full bg-c-warning/10 px-2 py-0.5 font-medium text-c-warning"
              data-testid="baseline-preflight-warning-count"
            >
              {preflightWarnings.length} do sprawdzenia przed zatwierdzeniem
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            ref={addTriggerRef}
            type="button"
            disabled={readOnly || periodOptions.length === 0}
            onClick={openAddDialog}
            data-testid="baseline-assumptions-add-row"
            title={
              periodOptions.length === 0
                ? 'Brak skonfigurowanych okresów prognozy — nie da się dodać wiersza.'
                : undefined
            }
            className="inline-flex min-h-[2.75rem] items-center rounded-lg border border-c-border-subtle px-3 text-xs font-medium text-c-text-secondary hover:bg-c-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus disabled:cursor-not-allowed disabled:opacity-40"
          >
            + Dodaj założenie
          </button>
          <div className="mx-1 h-5 w-px bg-c-border-subtle" aria-hidden="true" />
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
        <p
          role="alert"
          className="border-b border-c-border-subtle bg-c-danger/5 px-4 py-1.5 text-xs text-c-danger"
        >
          Nie udało się zapisać: {saveError}
        </p>
      )}
      {confirmingDespiteWarnings && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4"
          role="presentation"
          onMouseDown={() => setConfirmingDespiteWarnings(false)}
        >
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
              {preflightWarnings.length}{' '}
              {preflightWarnings.length === 1 ? 'komórka wymaga' : 'komórek wymaga'} uwagi (brak
              danych lub wartość poza bezpiecznym zakresem). Możesz zapisać mimo to — wyliczenia
              będą to odzwierciedlać.
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
      {addOpen && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4"
          role="presentation"
          onMouseDown={() => setAddOpen(false)}
        >
          <div
            ref={addDialogContainerRef}
            role="alertdialog"
            aria-modal="true"
            aria-label="Dodaj założenie"
            onMouseDown={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-xl border border-c-border-subtle bg-c-surface p-4 shadow-xl"
            data-testid="baseline-assumptions-add-dialog"
          >
            <p className="text-sm font-semibold text-c-text">Dodaj założenie</p>
            <div className="mt-3 space-y-3">
              <label className="block text-xs font-medium text-c-text-secondary">
                Harmonogram
                <select
                  autoFocus
                  value={addScheduleType}
                  onChange={(e) => {
                    const next = e.target.value as BaselineScheduleType;
                    setAddScheduleType(next);
                    const drivers = WIRED_DRIVERS_BY_SCHEDULE[next] ?? [];
                    setAddDriverCode(drivers[0] ?? '');
                    setAddCustomDriverCode('');
                  }}
                  className="mt-1 w-full rounded-md border border-c-border-subtle bg-c-bg px-2 py-1.5 text-sm text-c-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                  data-testid="baseline-add-schedule-type"
                >
                  {Object.entries(BASELINE_SCHEDULE_TYPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>

              {scheduleIsWired ? (
                <label className="block text-xs font-medium text-c-text-secondary">
                  Założenie
                  <select
                    value={addDriverCode}
                    onChange={(e) => setAddDriverCode(e.target.value)}
                    className="mt-1 w-full rounded-md border border-c-border-subtle bg-c-bg px-2 py-1.5 text-sm text-c-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                    data-testid="baseline-add-driver-code"
                  >
                    {wiredDrivers.map((code) => (
                      <option key={code} value={code}>
                        {driverLabel(code)}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <div>
                  <label className="block text-xs font-medium text-c-text-secondary">
                    Nazwa założenia (własna)
                    <input
                      type="text"
                      value={addCustomDriverCode}
                      onChange={(e) => setAddCustomDriverCode(e.target.value)}
                      placeholder="np. HEADCOUNT_GROWTH_PCT"
                      className="mt-1 w-full rounded-md border border-c-border-subtle bg-c-bg px-2 py-1.5 text-sm text-c-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                      data-testid="baseline-add-driver-custom"
                    />
                  </label>
                  <p className="mt-1 text-[11px] text-c-warning">
                    Ten harmonogram nie zasila dziś wyliczeń (silnik go jeszcze nie czyta) — wiersz
                    zapisze się, ale nie zmieni żadnej liczby w „Wyliczeniach".
                  </p>
                </div>
              )}

              <label className="block text-xs font-medium text-c-text-secondary">
                Okres
                <select
                  value={addPeriodId}
                  onChange={(e) => setAddPeriodId(e.target.value)}
                  disabled={periodOptions.length === 0}
                  className="mt-1 w-full rounded-md border border-c-border-subtle bg-c-bg px-2 py-1.5 text-sm text-c-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                  data-testid="baseline-add-period"
                >
                  {periodOptions.map(([id, label]) => (
                    <option key={id} value={id}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {addError && (
              <p role="alert" className="mt-2 text-xs text-c-danger">
                {addError}
              </p>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setAddOpen(false)}
                className="inline-flex min-h-[2.75rem] items-center rounded-lg border border-c-border-subtle px-3.5 text-xs font-medium text-c-text-secondary hover:bg-c-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
              >
                Anuluj
              </button>
              <button
                type="button"
                onClick={submitAddRow}
                data-testid="baseline-add-submit"
                className="inline-flex min-h-[2.75rem] items-center rounded-lg bg-c-text px-3.5 text-xs font-semibold text-c-surface hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
              >
                Dodaj wiersz
              </button>
            </div>
          </div>
        </div>
      )}
      {pendingDelete && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4"
          role="presentation"
          onMouseDown={() => setPendingDelete(null)}
        >
          <div
            ref={deleteDialogContainerRef}
            role="alertdialog"
            aria-modal="true"
            aria-label="Usuń wiersz założenia"
            onMouseDown={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-xl border border-c-border-subtle bg-c-surface p-4 shadow-xl"
            data-testid="baseline-delete-confirm"
          >
            <p className="text-sm font-semibold text-c-text">Usunąć wiersz założenia?</p>
            <p className="mt-1 text-sm text-c-text-secondary">
              {driverLabel(pendingDelete.driverCode)} —{' '}
              {BASELINE_SCHEDULE_TYPE_LABELS[pendingDelete.scheduleType]} (
              {periodLabelOf(pendingDelete.periodId, periodLabelById)}). Tej operacji nie da się
              cofnąć przyciskiem „Cofnij" — wiersz usuwa się od razu.
            </p>
            {deleteError && (
              <p role="alert" className="mt-2 text-xs text-c-danger">
                Nie udało się usunąć: {deleteError}
              </p>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingDelete(null)}
                className="inline-flex min-h-[2.75rem] items-center rounded-lg border border-c-border-subtle px-3.5 text-xs font-medium text-c-text-secondary hover:bg-c-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
              >
                Anuluj
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={() => void confirmDeleteRow()}
                data-testid="baseline-delete-confirm-submit"
                className="inline-flex min-h-[2.75rem] items-center rounded-lg bg-c-danger px-3.5 text-xs font-semibold text-white hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus disabled:cursor-not-allowed disabled:opacity-40"
              >
                {deleting ? 'Usuwam…' : 'Usuń wiersz'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* `pb-16`: patrz uzasadnienie w `CalculationsView.tsx` (punkt 1 orkiestratora) — ostatni wiersz nie chowa się pod pływającą kontrolką w rogu przy przewinięciu do końca. */}
      <div className="flex-1 overflow-auto pb-16">
        {/* prettier-ignore */}
        <table /* §27-exempt: archetyp Excel — grid komórek edytowalnych (reguła/wartość/zakres) z formułami silnika, nie lista rekordów encji (docs/ui-standards/DOKTRYNA_TABELA_NIE_EXCEL.md #2) */ className="w-full min-w-[1200px] border-collapse text-sm" role="table" data-testid="baseline-assumptions-table">
          <thead className="sticky top-0 z-10 bg-c-surface-raised text-[11px] font-semibold uppercase tracking-wide text-c-text-muted">
            <tr>
              <th className="px-3 py-2 text-left" style={{ minWidth: 220 }}>
                Założenie
              </th>
              <th className="px-3 py-2 text-right" style={{ minWidth: 110 }}>
                Wart. historyczna
              </th>
              <th className="px-3 py-2 text-left" style={{ minWidth: 90 }}>
                Okres bazowy
              </th>
              {/*
                ★ NAPRAWA punktu 4 orkiestratora: „Reguła kalibracji" (najdłuższa
                etykieta „Powiązane z KPI analizy" ~23 znaki) i „Jakość"
                („Ograniczona") były węższe niż treść natywnych `<select>` —
                przeglądarka obcinała wybraną opcję wielokropkiem
                („Średnia historycz…", „Potwierd…"). Szerokości poniżej
                zmierzone pod realne etykiety z `baselineLabels.ts`
                (`BASELINE_RULE_LABELS`/opcje jakości), nie zgadywane.
              */}
              <th className="px-3 py-2 text-left" style={{ minWidth: 210 }}>
                Reguła kalibracji
              </th>
              <th className="px-3 py-2 text-left" style={{ minWidth: 170 }}>
                Źródło
              </th>
              <th className="px-3 py-2 text-right" style={{ minWidth: 140 }}>
                Wartość prognozy
              </th>
              {/*
                185-usuwanie-zalozenia: kebab w kolumnie Akcje sam nie
                domykał 1440px (zostawał 36px nadmiaru) — winna kolumna
                „Bezpieczny zakres", jedyna poza Akcje, która realnie
                (nie tylko wg minWidth) rosła do 199px z powodu dwóch pól
                liczbowych `w-20` (80px). Zwężone do `w-14` (56px, mieści
                „0,155" — najdłuższą realną wartość w danych demo) —
                kolumna spada do naturalnych ~140px.
              */}
              <th className="px-2 py-2 text-left" style={{ minWidth: 140 }}>
                Bezpieczny zakres
              </th>
              <th className="px-3 py-2 text-left" style={{ minWidth: 140 }}>
                Jakość
              </th>
              {
                /**
                 * ★ NAPRAWA drugiego przebiegu (148-finanse-parametry): ten
                 * element tabeli (§27-exempt, patrz znacznik na otwierającym
                 * tagu wyżej) NIE ma table-layout: fixed — to natywny HTML
                 * z auto-layout, kolumny renderują się szerzej niż
                 * `minWidth`, gdy trzeba (żadnego `columnFit`/ściskania jak w
                 * `FilterableTable`). Zbyt szeroki `minWidth` tutaj NIE ucina
                 * tekstu wielokropkiem (ta komórka zawija normalnie, dowód:
                 * `text-c-text-muted` bez `overflow-hidden`/`text-ellipsis`)
                 * — zamiast tego rozpycha CAŁY element szerzej niż widoczny
                 * kontener (`flex-1 overflow-auto`, 1440px), więc kolumna
                 * ląduje ZA prawą krawędzią i jest obcięta przez SCROLL, nie
                 * przez CSS (żywy pomiar: 200px dawało scrollWidth 1569px >
                 * kontener 1440px — „Zasila: Przychody (REVEN" urywało się na
                 * krawędzi ekranu bez przewinięcia, mimo że DOM miał pełny
                 * tekst). 150px: mieści najszersze POJEDYNCZE słowo etykiety
                 * PL („długoterminowy," ≈94px + padding 24px ≈118px) z
                 * zapasem, a suma kolumn 1-9 (1260+150=1410px) zostaje w
                 * granicach 1440px — kolumna w pełni widoczna bez przewijania.
                 */
              }
              <th className="px-3 py-2 text-left" style={{ minWidth: 150 }}>
                Podgląd wpływu
              </th>
              {/*
                185-usuwanie-zalozenia (uwaga właściciela: "dalej nie mam...
                możliwości usuwania linii" — DRUGIE zgłoszenie). Kolumna z
                dwoma przyciskami tekstowymi (Reset + Usuń, 90px) pchała sumę
                kolumn 1-10 na 1500px > 1440px kontener — mechanizm istniał,
                ale wymagał przewinięcia w prawo, którego właściciel nie
                zrobił (i nie ma powodu robić — nic go tam nie kieruje).
                Kebab (`RowActionsMenu`, wzorzec z 26 miejsc w repo, w tym
                `StandardTable`) mieści obie akcje w jednym przycisku 32×32,
                44px kolumny zamiast 90 — suma spada do 1454, w granicach
                zmierzonego zapasu (patrz kolumna „Podgląd wpływu" wyżej,
                miała już wykorzystany budżet do 1440 BEZ tej kolumny; kebab
                dowozi resztę w klawiszu, nie w tekście, więc mieści się).
              */}
              <th className="px-1 py-2 text-center" style={{ minWidth: 44 }}>
                Akcje
              </th>
            </tr>
          </thead>
          <tbody>
            {effectiveRowOrder.map((spec, index) => {
              const key = cellKeyOf(spec);
              const cell = cells.get(key);
              const server = cell?.server ?? null;
              const historical = historicalValueOf(server);
              const historicalDisplay = historical
                ? formatPctAwareValue(historical, historical.unit)
                : { text: '—', isMissingLikeGlyph: true };
              const valueDisplay = formatPctAwareValue(
                {
                  status: cell?.valueStatus ?? 'MISSING',
                  valueDecimal:
                    cell?.valueDecimal !== null && cell?.valueDecimal !== undefined
                      ? String(cell.valueDecimal)
                      : null,
                },
                cell?.unit
              );
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
                    <div className="text-xs text-c-text-muted">
                      {BASELINE_SCHEDULE_TYPE_LABELS[spec.scheduleType]}
                    </div>
                  </td>
                  <td
                    className={`px-3 py-2 text-right tabular-nums ${historicalDisplay.isMissingLikeGlyph ? 'text-c-text-muted' : 'text-c-text'}`}
                  >
                    {historicalDisplay.text}
                  </td>
                  <td className="px-3 py-2 text-xs text-c-text-secondary">
                    {periodLabelOf(server?.basePeriodId ?? spec.periodId, periodLabelById)}
                  </td>
                  <td className="px-3 py-2">
                    {/* ★ NAPRAWA a11y (Pakiet I, wymaganie #5): `<select>` bez
                        nazwy (axe: "select-name" critical, 18 wystąpień w tym
                        widoku) — nagłówek kolumny "Reguła kalibracji" nie jest
                        programowo powiązany z KAŻDYM wierszem selecta. */}
                    <select
                      aria-label={`Reguła kalibracji — ${driverLabel(spec.driverCode)}`}
                      disabled={readOnly}
                      value={cell?.rule ?? 'MANUAL_OVERRIDE'}
                      onChange={(e) =>
                        setCellValue(spec, { rule: e.target.value as BaselineAssumptionRule })
                      }
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
                  <td className="px-3 py-2 text-xs text-c-text-secondary">
                    {sourceLabelOf(server)}
                  </td>
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
                              valueStatus:
                                e.target.value === ''
                                  ? 'MISSING'
                                  : Number(e.target.value) === 0
                                    ? 'PRESENT_ZERO'
                                    : 'PRESENT_NONZERO',
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
                              valueStatus:
                                e.target.value === ''
                                  ? 'MISSING'
                                  : Number(e.target.value) === 0
                                    ? 'PRESENT_ZERO'
                                    : 'PRESENT_NONZERO',
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
                        <span className="text-[10px] text-c-text-muted">
                          {cell?.unit === 'DAYS' ? 'dni' : cell?.unit === 'MONTHS' ? 'mies.' : ''}
                        </span>
                      </div>
                    )}
                  </td>
                  <td className="px-2 py-2">
                    {cell?.rangeLow !== null &&
                    cell?.rangeHigh !== null &&
                    cell?.rangeLow !== undefined &&
                    cell?.rangeHigh !== undefined ? (
                      <div className="flex items-center gap-1 text-xs text-c-text-secondary">
                        {/* ★ NAPRAWA a11y (Pakiet I, wymaganie #5): pola zakresu
                            bez aria-label (axe: "label" critical). */}
                        {/* 185-usuwanie-zalozenia: w-20→w-14 (patrz nagłówek kolumny wyżej dla uzasadnienia). */}
                        <input
                          type="number"
                          disabled={readOnly}
                          value={roundForRangeDisplay(cell.rangeLow)}
                          onChange={(e) => setCellValue(spec, { rangeLow: Number(e.target.value) })}
                          className="w-14 rounded-md border border-c-border-subtle bg-c-bg px-1.5 py-1 text-right tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                          data-testid={`baseline-assumption-range-low-${index}`}
                          aria-label={`Bezpieczny zakres — dolna granica — ${driverLabel(spec.driverCode)}`}
                        />
                        <span aria-hidden="true">–</span>
                        <input
                          type="number"
                          disabled={readOnly}
                          value={roundForRangeDisplay(cell.rangeHigh)}
                          onChange={(e) =>
                            setCellValue(spec, { rangeHigh: Number(e.target.value) })
                          }
                          className="w-14 rounded-md border border-c-border-subtle bg-c-bg px-1.5 py-1 text-right tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                          data-testid={`baseline-assumption-range-high-${index}`}
                          aria-label={`Bezpieczny zakres — górna granica — ${driverLabel(spec.driverCode)}`}
                        />
                      </div>
                    ) : (
                      <span className="text-xs text-c-text-muted">Bez limitu</span>
                    )}
                    {cell?.outOfSafeRange && (
                      <p
                        className="mt-0.5 text-[10px] font-medium text-c-danger"
                        data-testid={`baseline-assumption-outofrange-${index}`}
                      >
                        Poza bezpiecznym zakresem
                      </p>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <select
                      aria-label={`Jakość — ${driverLabel(spec.driverCode)}`}
                      disabled={readOnly}
                      value={cell?.quality ?? 'ESTIMATED'}
                      onChange={(e) =>
                        setCellValue(spec, { quality: e.target.value as BaselineAssumptionQuality })
                      }
                      className="w-full rounded-md border border-c-border-subtle bg-c-bg px-2 py-1 text-xs text-c-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                      data-testid={`baseline-assumption-quality-${index}`}
                    >
                      <option value="CONFIRMED">Potwierdzona</option>
                      <option value="ESTIMATED">Szacowana</option>
                      <option value="DEGRADED_INSUFFICIENT_HISTORY">Ograniczona</option>
                    </select>
                  </td>
                  <td className="px-3 py-2 text-xs text-c-text-muted">
                    {feeds.length > 0 ? `Zasila: ${feeds.map(feedLineLabel).join(', ')}` : '—'}
                  </td>
                  <td className="px-1 py-2 text-center">
                    {/*
                      185-usuwanie-zalozenia: dwa przyciski tekstowe (Reset +
                      Usuń) rozpychały kolumnę do 90px i pchały tabelę poza
                      1440px kontener — mechanizm istniał, ale wymagał
                      przewinięcia, którego właściciel nie zrobił. Kebab
                      (`RowActionsMenu`, ten sam komponent co `StandardTable`,
                      26 miejsc renderu w repo) mieści obie akcje w jednym
                      przycisku 32×32 — kolumna spada do 44px, bez
                      przewijania.
                    */}
                    <div className="flex items-center justify-center" data-testid={`baseline-assumption-actions-${index}`}>
                      <RowActionsMenu
                        actions={[
                          {
                            id: 'reset',
                            label: 'Cofnij do ostatniej zapisanej wartości',
                            icon: RotateCcw,
                            disabled: !cell?.dirty || readOnly,
                            onClick: () => resetCellToServer(spec),
                          },
                          {
                            id: 'delete',
                            label: 'Usuń wiersz założenia',
                            icon: Trash2,
                            variant: 'danger',
                            disabled: readOnly,
                            onClick: () => {
                              setDeleteError(null);
                              setPendingDelete(spec);
                            },
                          },
                        ]}
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
            {effectiveRowOrder.length === 0 && (
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
