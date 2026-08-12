/**
 * Pakiet F — stan edycji Założeń (`AssumptionsView`).
 *
 * Odpowiada za: wczytanie `GET .../assumptions`, lokalny draft per komórka
 * (bez zapisu do serwera przy każdym keystroke'u), undo/redo (jedna operacja
 * wklejenia wsadowego = jeden wpis stosu — DoD „wklej wsadowo, cofnij JEDNĄ
 * operacją"), cofnięcie pojedynczej komórki do ostatniej zapisanej wartości
 * (nie mylić z globalnym undo — to jest reset do „baseline" tej jednej
 * komórki), zapis wsadowy (`POST .../assumptions`, UPSERT — bezpieczny do
 * ponowienia), stan `dirty`.
 *
 * Klucz komórki: `${scheduleType}::${driverCode}::${entityId}::${periodId}`
 * — schema `finance_baseline_assumptions` ma UNIQUE constraint dokładnie na
 * tej krotce (baseline.routes.ts:101-155 „ON CONFLICT ON CONSTRAINT
 * uq_finance_baseline_assumptions_cell"), więc to jest jedyny poprawny klucz
 * identyczności wiersza — NIGDY samo `assumptionId` (wiersz może jeszcze nie
 * istnieć po stronie serwera, gdy Kreator dodaje nowy driver).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  listBaselineAssumptions,
  type ListBaselineAssumptionsParams,
  upsertBaselineAssumptions,
} from '@/services/api/financeV2.api';
import {
  type BaselineAssumptionDto,
  type BaselineAssumptionQuality,
  type BaselineAssumptionRule,
  type BaselineScheduleType,
  describeFinanceV2Error,
  type FinanceValueStatus,
} from '@/services/api/financeV2.types';

export interface AssumptionCellKey {
  scheduleType: BaselineScheduleType;
  driverCode: string;
  entityId: string;
  periodId: string;
}

export function cellKeyOf(k: AssumptionCellKey): string {
  return `${k.scheduleType}::${k.driverCode}::${k.entityId}::${k.periodId}`;
}

export interface AssumptionDraftPatch {
  rule?: BaselineAssumptionRule;
  valueStatus?: FinanceValueStatus;
  valueDecimal?: number | null;
  rangeLow?: number | null;
  rangeHigh?: number | null;
  quality?: BaselineAssumptionQuality;
  basePeriodId?: string | null;
  /** Notatka lokalna (komentarz) — TYLKO klient, brak endpointu komentarzy w allowlicie tego pakietu (patrz raport §7, EVIDENCE_MISSING). Nie jest zapisywana `POST .../assumptions` (poza kształtem body routera). */
  localComment?: string;
}

interface UndoEntry {
  kind: 'cell' | 'batch';
  changes: Array<{
    key: string;
    before: AssumptionDraftPatch | undefined;
    after: AssumptionDraftPatch;
  }>;
}

export interface EffectiveAssumptionCell {
  key: string;
  server: BaselineAssumptionDto | null;
  draft: AssumptionDraftPatch | null;
  dirty: boolean;
  rule: BaselineAssumptionRule | null;
  valueStatus: FinanceValueStatus;
  valueDecimal: number | null;
  unit: string;
  rangeLow: number | null;
  rangeHigh: number | null;
  quality: BaselineAssumptionQuality | null;
  localComment: string | null;
  /** Poza bezpiecznym zakresem (gdy ustawiony) — preflight go zgłasza, nie blokuje samodzielnie. */
  outOfSafeRange: boolean;
}

export interface UseBaselineAssumptionsEditorResult {
  loading: boolean;
  error: string | null;
  saving: boolean;
  saveError: string | null;
  rows: BaselineAssumptionDto[];
  cells: Map<string, EffectiveAssumptionCell>;
  reload: () => Promise<void>;
  setCellValue: (key: AssumptionCellKey, patch: AssumptionDraftPatch) => void;
  pasteBatch: (entries: Array<{ key: AssumptionCellKey; patch: AssumptionDraftPatch }>) => void;
  resetCellToServer: (key: AssumptionCellKey) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  dirtyCount: number;
  isDirty: (key: AssumptionCellKey) => boolean;
  /** Preflight — komórki MISSING lub poza bezpiecznym zakresem. Nie blokuje zapisu, ostrzega przed zatwierdzeniem zestawu. */
  preflightWarnings: Array<{ key: string; reason: 'MISSING' | 'OUT_OF_RANGE' }>;
  save: () => Promise<{ ok: true; writtenCount: number } | { ok: false; message: string }>;
}

function needsCreateRow(
  key: AssumptionCellKey,
  server: BaselineAssumptionDto | undefined
): boolean {
  return !server;
}

export function useBaselineAssumptionsEditor(
  businessVersionId: string,
  listParams: ListBaselineAssumptionsParams = {}
): UseBaselineAssumptionsEditorResult {
  const [rows, setRows] = useState<BaselineAssumptionDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, AssumptionDraftPatch>>({});
  const [undoStack, setUndoStack] = useState<UndoEntry[]>([]);
  const [redoStack, setRedoStack] = useState<UndoEntry[]>([]);

  const serverByKey = useMemo(() => {
    const m = new Map<string, BaselineAssumptionDto>();
    for (const r of rows) {
      m.set(
        cellKeyOf({
          scheduleType: r.scheduleType,
          driverCode: r.driverCode,
          entityId: r.entityId,
          periodId: r.periodId,
        }),
        r
      );
    }
    return m;
  }, [rows]);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listBaselineAssumptions(businessVersionId, listParams);
      setRows(data);
      setDrafts({});
      setUndoStack([]);
      setRedoStack([]);
    } catch (e) {
      // ID_BRIDGE (Gate E) fix: honest-UI PL message (CANON §4.1 zakazuje
      // surowego błędu backendu) — było `e.message` wprost, np. surowe "Not
      // Found" albo network error string, niezrozumiałe dla analityka.
      setError(describeFinanceV2Error(e).detail);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessVersionId, JSON.stringify(listParams)]);

  // ★ Naprawa (Pakiet F, wykryte przy weryfikacji szkicu): bez tego efektu
  // `reload()` nie był wołany PRZY MOUNCIE — tylko z przycisku „Spróbuj
  // ponownie" w ErrorBoundary — więc `rows`/`cells` zostawały puste, a
  // `AssumptionsView` renderowała siatkę z samymi wartościami domyślnymi
  // (nigdy z realnych danych z serwera). Ten sam wzorzec co `useBaselineOutputs`.
  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reload]);

  const applyChanges = useCallback(
    (changes: Array<{ key: string; after: AssumptionDraftPatch }>) => {
      setDrafts((prev) => {
        const next = { ...prev };
        for (const c of changes) next[c.key] = { ...next[c.key], ...c.after };
        return next;
      });
    },
    []
  );

  const setCellValue = useCallback((key: AssumptionCellKey, patch: AssumptionDraftPatch) => {
    const k = cellKeyOf(key);
    setDrafts((prev) => {
      const before = prev[k];
      const after = { ...before, ...patch };
      setUndoStack((stack) => [...stack, { kind: 'cell', changes: [{ key: k, before, after }] }]);
      setRedoStack([]);
      return { ...prev, [k]: after };
    });
  }, []);

  const pasteBatch = useCallback(
    (entries: Array<{ key: AssumptionCellKey; patch: AssumptionDraftPatch }>) => {
      if (entries.length === 0) return;
      setDrafts((prev) => {
        const next = { ...prev };
        const changes: UndoEntry['changes'] = [];
        for (const e of entries) {
          const k = cellKeyOf(e.key);
          const before = next[k];
          const after = { ...before, ...e.patch };
          changes.push({ key: k, before, after });
          next[k] = after;
        }
        setUndoStack((stack) => [...stack, { kind: 'batch', changes }]);
        setRedoStack([]);
        return next;
      });
    },
    []
  );

  const resetCellToServer = useCallback((key: AssumptionCellKey) => {
    const k = cellKeyOf(key);
    setDrafts((prev) => {
      if (!(k in prev)) return prev;
      const before = prev[k];
      const next = { ...prev };
      delete next[k];
      setUndoStack((stack) => [
        ...stack,
        { kind: 'cell', changes: [{ key: k, before, after: {} }] },
      ]);
      setRedoStack([]);
      return next;
    });
  }, []);

  const undo = useCallback(() => {
    setUndoStack((stack) => {
      if (stack.length === 0) return stack;
      const entry = stack[stack.length - 1];
      setDrafts((prev) => {
        const next = { ...prev };
        for (const c of entry.changes) {
          if (c.before === undefined) delete next[c.key];
          else next[c.key] = c.before;
        }
        return next;
      });
      setRedoStack((r) => [...r, entry]);
      return stack.slice(0, -1);
    });
  }, []);

  const redo = useCallback(() => {
    setRedoStack((stack) => {
      if (stack.length === 0) return stack;
      const entry = stack[stack.length - 1];
      setDrafts((prev) => {
        const next = { ...prev };
        for (const c of entry.changes) next[c.key] = c.after;
        return next;
      });
      setUndoStack((u) => [...u, entry]);
      return stack.slice(0, -1);
    });
  }, []);

  const isDirty = useCallback((key: AssumptionCellKey) => cellKeyOf(key) in drafts, [drafts]);

  const cells = useMemo(() => {
    const out = new Map<string, EffectiveAssumptionCell>();
    const allKeys = new Set<string>([...serverByKey.keys(), ...Object.keys(drafts)]);
    for (const k of allKeys) {
      const server = serverByKey.get(k) ?? null;
      const draft = drafts[k] ?? null;
      const rule = draft?.rule ?? server?.rule ?? null;
      const valueStatus = draft?.valueStatus ?? server?.value.status ?? 'MISSING';
      const valueDecimal =
        draft?.valueDecimal !== undefined
          ? draft.valueDecimal
          : server?.value.valueDecimal !== undefined && server?.value.valueDecimal !== null
            ? Number(server.value.valueDecimal)
            : null;
      const unit = server?.value.unit ?? 'PCT';
      const rangeLow =
        draft?.rangeLow !== undefined
          ? draft.rangeLow
          : server?.rangeLow !== null && server?.rangeLow !== undefined
            ? Number(server.rangeLow)
            : null;
      const rangeHigh =
        draft?.rangeHigh !== undefined
          ? draft.rangeHigh
          : server?.rangeHigh !== null && server?.rangeHigh !== undefined
            ? Number(server.rangeHigh)
            : null;
      const quality = draft?.quality ?? server?.quality ?? null;
      const outOfSafeRange =
        valueDecimal !== null &&
        rangeLow !== null &&
        rangeHigh !== null &&
        (valueDecimal < rangeLow || valueDecimal > rangeHigh);
      out.set(k, {
        key: k,
        server,
        draft,
        dirty: draft !== null,
        rule,
        valueStatus,
        valueDecimal,
        unit,
        rangeLow,
        rangeHigh,
        quality,
        localComment: draft?.localComment ?? null,
        outOfSafeRange,
      });
    }
    return out;
  }, [serverByKey, drafts]);

  const preflightWarnings = useMemo(() => {
    const warnings: Array<{ key: string; reason: 'MISSING' | 'OUT_OF_RANGE' }> = [];
    for (const cell of cells.values()) {
      if (cell.valueStatus === 'MISSING') warnings.push({ key: cell.key, reason: 'MISSING' });
      else if (cell.outOfSafeRange) warnings.push({ key: cell.key, reason: 'OUT_OF_RANGE' });
    }
    return warnings;
  }, [cells]);

  const save = useCallback(async (): Promise<
    { ok: true; writtenCount: number } | { ok: false; message: string }
  > => {
    const dirtyKeys = Object.keys(drafts);
    if (dirtyKeys.length === 0) return { ok: true, writtenCount: 0 };
    setSaving(true);
    setSaveError(null);
    try {
      const inputs = dirtyKeys
        .map((k) => {
          const [scheduleType, driverCode, entityId, periodId] = k.split('::') as [
            BaselineScheduleType,
            string,
            string,
            string,
          ];
          const cell = cells.get(k);
          if (!cell || cell.rule === null || cell.quality === null) return null;
          return {
            scheduleType,
            driverCode,
            entityId,
            periodId,
            rule: cell.rule,
            valueStatus: cell.valueStatus,
            valueDecimal: cell.valueDecimal,
            unit: cell.unit,
            rangeLow: cell.rangeLow,
            rangeHigh: cell.rangeHigh,
            quality: cell.quality,
          };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null);
      if (inputs.length === 0) {
        setSaving(false);
        return {
          ok: false,
          message:
            'Brakuje reguły lub jakości dla przynajmniej jednej zmienionej komórki — nie da się zapisać.',
        };
      }
      const result = await upsertBaselineAssumptions(businessVersionId, inputs);
      await reload();
      return { ok: true, writtenCount: result.writtenCount };
    } catch (e) {
      // ID_BRIDGE (Gate E) fix: honest-UI PL message, same reasoning as `reload()` above.
      const message = describeFinanceV2Error(e).detail;
      setSaveError(message);
      return { ok: false, message };
    } finally {
      setSaving(false);
    }
  }, [businessVersionId, cells, drafts, reload]);

  return {
    loading,
    error,
    saving,
    saveError,
    rows,
    cells,
    reload,
    setCellValue,
    pasteBatch,
    resetCellToServer,
    undo,
    redo,
    canUndo: undoStack.length > 0,
    canRedo: redoStack.length > 0,
    dirtyCount: Object.keys(drafts).length,
    isDirty,
    preflightWarnings,
    save,
  };
}

export { needsCreateRow };
export default useBaselineAssumptionsEditor;
