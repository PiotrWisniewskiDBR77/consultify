/**
 * StandardTable — JEDYNA fasada tabeli listy encji (Triada standard).
 *
 * SSOT wzorca: żywa tabela My Work Tasks/Decisions + NOTATKA-PRAWO
 * `Harvard/wdrozenie-100/_STANDARD_TRIADA_NOTATKA.md` (+ aneksy #2/#3).
 * Fasada NIE reimplementuje mechaniki — deleguje do kanonicznego
 * FilterableTable (§2 SSOT), który po uzupełnieniach gwarantuje 9 MUSTów:
 *
 *  1. nagłówek uppercase sticky + sort (asc→desc→none, 1:1 MyTasks) + lejki
 *     filtrów per kolumna,
 *  2. hairline separatory wierszy (divide-y slate-200/60 · white/[0.03]),
 *     ZERO zebry i grubych linii,
 *  3. wiersz z opcjonalnym opisem — toggle „Show row description",
 *  4. OBOWIĄZKOWY pstryczek Settings2 → TableSettingsPopover w prawym górnym
 *     rogu (kolumny + LOCKED + reorder ▲▼ + reset + toggle opisu) — moduł NIE
 *     może go podmienić (aneks #3),
 *  5. resize zero-sum z persistencją (persistKey),
 *  6. kebab ⋮ z DŁUGĄ kontekstową listą sekcjami (`rowActions(row)`;
 *     akcje statusowe u góry, Delete na dole — wzór menu Decisions),
 *  7. checkbox po lewej każdego wiersza (prop `selection`); zaznaczenie ≥1 ⇒
 *     Menu 3 przełącza się w tryb bulk (StandardModuleBar `bulk`),
 *  8. bulk akcje = kontekstowy prop per encja (nie hardcode),
 *  9. stany empty/loading/error ze shared/states.
 */

import { Archive, Eye, type LucideIcon, Pencil, Trash2 } from 'lucide-react';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { FilterChip } from '../shared/ModuleHub/ActiveFilters';
import {
  FilterableTable,
  type TableColumn,
  type TableRow,
} from '../shared/ModuleHub/FilterableTable';
import type { RowAction, RowActionSection } from '../shared/RowActionsMenu';
import { EmptyState, LoadingState } from '../shared/states';

export type { TableColumn, TableRow } from '../shared/ModuleHub/FilterableTable';
export type { RowAction, RowActionSection } from '../shared/RowActionsMenu';

// ── Kebab wiersza — kontrakt 5 bloków (ANEKS #4, _STANDARD_TRIADA_NOTATKA) ──
//
// Moduł deklaruje TYLKO bloki 1-3; bloki 4 (Open preview · Edit · Archive)
// i 5 (Delete/Reject — czerwony, ostatni, oddzielony) StandardTable dokłada
// SAM — zawsze obecne. Brak handlera ⇒ pozycja disabled z dopiskiem
// (np. „Coming soon (backend)"), NIGDY ukryta.

export interface StandardRowMenuAction {
  id: string;
  label: string;
  icon?: React.ElementType;
  onClick?: () => void;
  disabled?: boolean;
  /** Dopisek pod etykietą (np. powód disabled). */
  note?: string;
  /** Submenu rozwijane strzałką (np. Delay › +1/+3/+7). */
  submenu?: StandardRowMenuAction[];
}

export interface StandardRowMenu {
  /** Blok 1: akcja główna encji (View/Open + Complete/Done/Approve). */
  primary?: StandardRowMenuAction[];
  /** Blok 2: przejścia stanu wg encji (To do / In progress / Blocked…). */
  statusTransitions?: StandardRowMenuAction[];
  /** Blok 3: czas — Delay ›/Snooze-presety (tylko encje z terminami). */
  timeActions?: StandardRowMenuAction[];
  /** Blok 4: handlery uniwersalne; brak handlera = disabled z notą. */
  universalHandlers?: {
    preview?: () => void;
    previewNote?: string;
    edit?: () => void;
    editNote?: string;
    archive?: () => void;
    archiveNote?: string;
  };
  /** Blok 5: akcja destrukcyjna (Delete/Reject). Brak = disabled z notą. */
  destructive?: {
    label?: string;
    icon?: React.ElementType;
    onClick?: () => void;
    note?: string;
  };
}

const NOOP = () => undefined;

const toRowAction = (action: StandardRowMenuAction): RowAction => ({
  id: action.id,
  label: action.label,
  icon: action.icon,
  onClick: action.onClick ?? NOOP,
  disabled: action.disabled || (!action.onClick && !action.submenu?.length),
  description: action.note,
  submenu: action.submenu?.map(toRowAction),
});

export interface StandardTableEmpty {
  title: string;
  description?: string;
  icon?: LucideIcon;
  actionLabel?: string;
  onAction?: () => void;
}

export interface StandardTableSelection {
  selectedIds: Set<string>;
  onChange: (ids: Set<string>) => void;
}

export interface StandardTableProps {
  columns: TableColumn[];
  data: TableRow[];

  /** Stany (MUST #9) — shared/states, nie ad-hoc teksty. */
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  empty?: StandardTableEmpty;

  /** Podświetlenie wiersza (layout Table+Preview). */
  selectedRowId?: string | null;
  onRowClick?: (row: TableRow) => void;
  onRowDoubleClick?: (row: TableRow) => void;

  /**
   * MUST #6 / ANEKS #4 — KONTRAKT kebaba (preferowany): moduł deklaruje bloki
   * 1-3 (primary / statusTransitions / timeActions), a StandardTable SAM
   * dokłada zawsze obecne bloki 4 (Open preview · Edit · Archive) i 5
   * (Delete/Reject — czerwony, ostatni, oddzielony separatorem).
   */
  rowMenu?: (row: TableRow) => StandardRowMenu;
  /**
   * Niskopoziomowa alternatywa (pełne sekcje) — używać tylko, gdy encja nie
   * mieści się w kontrakcie `rowMenu`. Gdy podano oba, wygrywa `rowMenu`.
   */
  rowActions?: (row: TableRow) => RowActionSection[];

  /** MUST #3 — treść opisu wiersza (default: `row.description`). */
  rowDescription?: (row: TableRow) => React.ReactNode;

  /** Lejki kolumn — kontrolowane z zewnątrz lub stan wewnętrzny fasady. */
  activeFilters?: FilterChip[];
  onFilterChange?: (filters: FilterChip[]) => void;

  defaultSort?: { columnId: string; direction: 'asc' | 'desc' };
  /** Persistencja układu kolumn + toggle opisu (localStorage). */
  persistKey?: string;

  /** MUST #7 — checkbox po lewej; zaznaczenie steruje trybem bulk Menu 3. */
  selection?: StandardTableSelection;

  density?: 'comfortable' | 'compact';
  canvasClassName?: string;
}

const readStoredFlag = (key: string | null): boolean => {
  if (!key || typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
};

export const StandardTable: React.FC<StandardTableProps> = ({
  columns,
  data,
  loading = false,
  error = null,
  onRetry,
  empty,
  selectedRowId,
  onRowClick,
  onRowDoubleClick,
  rowMenu,
  rowActions,
  rowDescription,
  activeFilters,
  onFilterChange,
  defaultSort,
  persistKey,
  selection,
  density = 'comfortable',
  canvasClassName = 'p-4',
}) => {
  const { t, i18n } = useTranslation();
  const isPolish = !!i18n.language?.startsWith('pl');

  // ── Kebab: kontrakt 5 bloków → RowActionSection[] (ANEKS #4) ─────────────
  const comingSoon = t('common.comingSoonBackend', 'Coming soon (backend)');
  const buildSections = useCallback(
    (menu: StandardRowMenu): RowActionSection[] => {
      const sections: RowActionSection[] = [];
      if (menu.primary?.length) {
        sections.push({ id: 'primary', kind: 'open', actions: menu.primary.map(toRowAction) });
      }
      if (menu.statusTransitions?.length) {
        sections.push({
          id: 'status',
          kind: 'manage',
          actions: menu.statusTransitions.map(toRowAction),
        });
      }
      if (menu.timeActions?.length) {
        sections.push({ id: 'time', kind: 'manage', actions: menu.timeActions.map(toRowAction) });
      }
      // Blok 4 — ZAWSZE obecny; brak handlera = disabled z notą, nigdy ukryty.
      const u = menu.universalHandlers ?? {};
      sections.push({
        id: 'universal',
        kind: 'context',
        actions: [
          {
            id: 'open-preview',
            label: t('common.openPreview', isPolish ? 'Otwórz podgląd' : 'Open preview'),
            icon: Eye,
            onClick: u.preview ?? NOOP,
            disabled: !u.preview,
            description: u.preview ? undefined : (u.previewNote ?? comingSoon),
          },
          {
            id: 'edit',
            label: t('common.edit', isPolish ? 'Edytuj' : 'Edit'),
            icon: Pencil,
            onClick: u.edit ?? NOOP,
            disabled: !u.edit,
            description: u.edit ? undefined : (u.editNote ?? comingSoon),
          },
          {
            id: 'archive',
            label: t('common.archive', isPolish ? 'Archiwizuj' : 'Archive'),
            icon: Archive,
            onClick: u.archive ?? NOOP,
            disabled: !u.archive,
            description: u.archive ? undefined : (u.archiveNote ?? comingSoon),
          },
        ],
      });
      // Blok 5 — ZAWSZE ostatni, czerwony, oddzielony separatorem sekcji.
      const d = menu.destructive ?? {};
      sections.push({
        id: 'danger',
        kind: 'danger',
        actions: [
          {
            id: 'destructive',
            label: d.label ?? t('common.delete', isPolish ? 'Usuń' : 'Delete'),
            icon: d.icon ?? Trash2,
            variant: 'danger',
            onClick: d.onClick ?? NOOP,
            disabled: !d.onClick,
            description: d.onClick ? undefined : (d.note ?? comingSoon),
          },
        ],
      });
      return sections;
    },
    [t, isPolish, comingSoon]
  );

  const getSections = useMemo(() => {
    if (rowMenu) return (row: TableRow) => buildSections(rowMenu(row));
    return rowActions;
  }, [rowMenu, rowActions, buildSections]);

  // ── Lejki kolumn: controlled ↔ internal ──────────────────────────────────
  const [internalFilters, setInternalFilters] = useState<FilterChip[]>([]);
  const filters = activeFilters ?? internalFilters;
  const handleFilterChange = useCallback(
    (next: FilterChip[]) => {
      setInternalFilters(next);
      onFilterChange?.(next);
    },
    [onFilterChange]
  );

  // ── „Show row description" — persistowane per persistKey ────────────────
  const descKey = persistKey ? `standardTable.rowDesc.${persistKey}` : null;
  const [showRowDescription, setShowRowDescription] = useState<boolean>(() =>
    readStoredFlag(descKey)
  );
  const handleToggleDescription = useCallback(
    (value: boolean) => {
      setShowRowDescription(value);
      if (descKey && typeof window !== 'undefined') {
        try {
          window.localStorage.setItem(descKey, value ? '1' : '0');
        } catch {
          /* non-fatal */
        }
      }
    },
    [descKey]
  );

  const renderDescription = useCallback(
    (row: TableRow): React.ReactNode =>
      rowDescription ? rowDescription(row) : ((row.description as React.ReactNode) ?? null),
    [rowDescription]
  );

  // ── Selection (MUST #7): auto-prepend kolumny select + driver ───────────
  const visibleIds = useMemo(() => data.map((row) => String(row.id)), [data]);
  const selectedIds = selection?.selectedIds;
  const isAllSelected =
    !!selectedIds && visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));
  const isIndeterminate =
    !!selectedIds && !isAllSelected && visibleIds.some((id) => selectedIds.has(id));

  const effectiveColumns = useMemo<TableColumn[]>(
    () =>
      selection
        ? [{ id: '__select', label: '', type: 'select' as const, width: '44px' }, ...columns]
        : columns,
    [selection, columns]
  );

  const selectionDriver = useMemo(() => {
    if (!selection) return undefined;
    return {
      selectedIds: selection.selectedIds,
      onToggleRow: (id: string) => {
        const next = new Set(selection.selectedIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        selection.onChange(next);
      },
      onToggleAll: () => {
        selection.onChange(isAllSelected ? new Set<string>() : new Set(visibleIds));
      },
      isAllSelected,
      isIndeterminate,
    };
  }, [selection, isAllSelected, isIndeterminate, visibleIds]);

  // ── Stany (MUST #9) ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className={canvasClassName} data-testid="standard-table-loading">
        <LoadingState template="list" rows={6} />
      </div>
    );
  }

  if (error) {
    return (
      <div className={canvasClassName} data-testid="standard-table-error">
        <EmptyState
          variant="error"
          title={error}
          primaryAction={onRetry ? { label: 'Retry', onClick: onRetry } : undefined}
        />
      </div>
    );
  }

  if (data.length === 0 && filters.length === 0 && empty) {
    return (
      <div className={canvasClassName} data-testid="standard-table-empty">
        <EmptyState
          variant="new"
          icon={empty.icon}
          title={empty.title}
          description={empty.description}
          primaryAction={
            empty.actionLabel && empty.onAction
              ? { label: empty.actionLabel, onClick: empty.onAction }
              : undefined
          }
        />
      </div>
    );
  }

  return (
    <FilterableTable
      columns={effectiveColumns}
      data={data}
      selectedRowId={selectedRowId}
      onRowClick={onRowClick}
      onRowDoubleClick={onRowDoubleClick}
      getRowActionSections={getSections}
      hideRowActions={false}
      activeFilters={filters}
      onFilterChange={handleFilterChange}
      canvasClassName={canvasClassName}
      density={density}
      /* Aneks #3: Settings2 → TableSettingsPopover OBOWIĄZKOWY, nie do podmiany. */
      enableColumnSettings
      rowDescription={{
        render: renderDescription,
        show: showRowDescription,
        onToggle: handleToggleDescription,
      }}
      defaultSort={defaultSort ?? null}
      persistKey={persistKey}
      selection={selectionDriver}
    />
  );
};

export default StandardTable;
