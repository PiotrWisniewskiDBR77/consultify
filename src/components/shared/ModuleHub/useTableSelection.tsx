/**
 * useTableSelection — shared per-adopter wiring for FilterableTable row selection
 * + bulk actions (canon §3.5 / TABLE_AND_PREVIEW_CANON).
 *
 * FilterableTable already ships a `selection` prop (select-all header checkbox +
 * per-row checkbox). This hook is the missing per-adopter glue: it owns the
 * selected-id Set, keeps it pruned to currently-visible rows, and exposes a
 * `runBulk` runner that loops over the caller's existing single-item mutation
 * with honest partial-failure reporting ("8/10 deleted"). We deliberately do NOT
 * add new backend endpoints — bulk = a loop over mutations the module already
 * supports singly.
 *
 * Usage:
 *   const sel = useTableSelection(visibleIds);
 *   <FilterableTable selection={sel.selectionProp} ... />
 *   <BulkActionBar selection={sel} actions={[{ id:'delete', ... , run: id => Api.delete(...) }]} />
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

export interface TableSelectionApi {
  /** Currently selected ids (stable identity per render batch). */
  selectedIds: Set<string>;
  /** Count of selected rows. */
  count: number;
  toggleRow: (id: string) => void;
  toggleAll: () => void;
  clear: () => void;
  isAllSelected: boolean;
  isIndeterminate: boolean;
  /** Ready-to-spread `selection` prop for FilterableTable. */
  selectionProp: {
    selectedIds: Set<string>;
    onToggleRow: (id: string) => void;
    onToggleAll: () => void;
    isAllSelected: boolean;
    isIndeterminate: boolean;
    selectRowLabel: string;
    selectAllLabel: string;
  };
  /**
   * Run an async op over every selected id with partial-failure reporting.
   * Returns { success, failed }. Emits a single summary toast and clears
   * the selection afterwards.
   */
  runBulk: (
    op: (id: string) => Promise<void>,
    opts?: {
      /** i18n'd verb for the toast, e.g. "deleted" / "usunięto". */
      successNoun?: string;
      /** Skip the summary toast (caller handles messaging). */
      silent?: boolean;
    }
  ) => Promise<{ success: number; failed: number }>;
}

/**
 * R04-1 — tryb selection wg deskryptora capability (§1, §5, §10).
 *
 * Kanon: checkbox nagłówka i wiersza istnieją WYŁĄCZNIE przy `selection: 'bulk'`;
 * `selection: 'none'` znaczy „brak obu", a nie „checkboxy, których nikt nie
 * używa". Do R04-1 hook nie miał o tym pojęcia i zawsze oddawał pełne API,
 * więc jedyną obroną było to, że ekran go nie zawoła.
 *
 * Tryb `'none'` neutralizuje selection u ŹRÓDŁA: przełączniki są no-opami,
 * a zbiór zaznaczeń nie może urosnąć. Nawet źle podpięta tabela nie zbierze
 * zaznaczenia, którego encja nie deklaruje.
 *
 * Parametr jest opcjonalny i domyślnie `'bulk'` — publiczne API dwóch obecnych
 * konsumentów pozostaje bez zmiany.
 */
export type TableSelectionMode = 'bulk' | 'none';

export interface UseTableSelectionOptions {
  mode?: TableSelectionMode;
}

/**
 * @param visibleIds ids of the rows currently visible (post-filter). Used for
 *   select-all semantics and to prune stale selections on filter/scope changes.
 * @param options `mode: 'none'` wyłącza selection zgodnie z deskryptorem encji.
 */
export function useTableSelection(
  visibleIds: string[],
  options: UseTableSelectionOptions = {}
): TableSelectionApi {
  const { mode = 'bulk' } = options;
  const canSelect = mode === 'bulk';
  const { t } = useTranslation();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());

  const visibleSet = useMemo(() => new Set(visibleIds.map(String)), [visibleIds]);

  // Prune selections that are no longer visible (filter / scope / delete).
  useEffect(() => {
    setSelectedIds((prev) => {
      if (prev.size === 0) return prev;
      const next = new Set<string>();
      prev.forEach((id) => {
        if (visibleSet.has(id)) next.add(id);
      });
      return next.size === prev.size ? prev : next;
    });
  }, [visibleSet]);

  const isAllSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(String(id)));
  const isIndeterminate = selectedIds.size > 0 && !isAllSelected;

  const toggleRow = useCallback(
    (id: string) => {
      // `selection: 'none'` — przełącznik istnieje w API, ale nic nie robi,
      // więc zaznaczenie nie może powstać nawet przy źle podpiętej tabeli.
      if (!canSelect) return;
      setSelectedIds((prev) => {
        const next = new Set(prev);
        const key = String(id);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        return next;
      });
    },
    [canSelect]
  );

  const toggleAll = useCallback(() => {
    if (!canSelect) return;
    setSelectedIds((prev) => {
      const all = visibleIds.length > 0 && visibleIds.every((id) => prev.has(String(id)));
      return all ? new Set<string>() : new Set(visibleIds.map(String));
    });
  }, [visibleIds, canSelect]);

  const clear = useCallback(() => setSelectedIds(new Set()), []);

  const runBulk = useCallback<TableSelectionApi['runBulk']>(
    async (op, opts) => {
      const ids = Array.from(selectedIds);
      let success = 0;
      let failed = 0;
      for (const id of ids) {
        try {
          await op(id);
          success += 1;
        } catch {
          failed += 1;
        }
      }
      clear();
      if (!opts?.silent) {
        if (failed === 0) {
          toast.success(
            t('common.bulk.done', '{{count}} {{noun}}', {
              count: success,
              noun: opts?.successNoun ?? t('common.bulk.processedNoun', 'processed'),
            })
          );
        } else {
          toast.error(
            t('common.bulk.partial', '{{success}} done, {{failed}} failed', {
              success,
              failed,
            })
          );
        }
      }
      return { success, failed };
    },
    [selectedIds, clear, t]
  );

  const selectionProp = useMemo(
    () => ({
      selectedIds,
      onToggleRow: toggleRow,
      onToggleAll: toggleAll,
      isAllSelected,
      isIndeterminate,
      selectRowLabel: t('common.selectRow', 'Select row'),
      selectAllLabel: t('common.selectAll', 'Select all'),
    }),
    [selectedIds, toggleRow, toggleAll, isAllSelected, isIndeterminate, t]
  );

  return {
    selectedIds,
    count: selectedIds.size,
    toggleRow,
    toggleAll,
    clear,
    isAllSelected,
    isIndeterminate,
    selectionProp,
    runBulk,
  };
}
