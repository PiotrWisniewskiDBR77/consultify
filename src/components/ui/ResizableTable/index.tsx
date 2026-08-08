/**
 * ResizableTable - Main table wrapper component
 * Unified table system for My Work module with ClickUp-style design
 */

import React, { useCallback, useMemo, useState } from 'react';

import { TableHeader } from './TableHeader';
import type {
  ColumnDef,
  ColumnWidths,
  DateRange,
  ResizableTableProps,
  TableFilters,
} from './types';

// Re-export types
export type { ColumnDef, ColumnWidths, DateRange, FilterOption, TableFilters } from './types';

// Re-export components
export {
  type BulkAction,
  BulkActionBar,
  createDecisionBulkActions,
  createNotificationBulkActions,
  createTaskBulkActions,
} from './BulkActionBar';
export { ColumnResizer } from './ColumnResizer';
export { FilterDropdown } from './FilterDropdown';
export { PreviewPaneShell } from './PreviewPaneShell';
export { TableHeader } from './TableHeader';

/**
 * @deprecated NIE UŻYWAĆ. Kanonicznym register shellem powierzchni T01–T45 jest
 * `FilterableTable` (`src/components/shared/ModuleHub/FilterableTable.tsx`),
 * a jego zadeklarowaną fasadą `StandardTable`
 * (`src/components/standard/StandardTable.tsx`). Nowe rejestry buduje się na nich.
 *
 * ── R04-3A (wygaszenie drugiego shella) ─────────────────────────────────────
 *
 * `REPAIR_MASTER_PLAN.md` R04 wymaga JEDNEGO register shella i wskazuje
 * `ResizableTable/*` jako „adapter albo wygaszany wariant". Preflight R04
 * ustalił, że wygaszenie jest tu jedyną sensowną drogą, bo ten komponent
 * **nie ma ani jednego konsumenta JSX** — wszystkie odwołania w repo to
 * ścieżki importu do barrela, który żyje dla zupełnie innych eksportów
 * (`PreviewPaneShell` ×50, `ColumnResizer` ×22, `FilterDropdown` ×21,
 * `BulkActionBar`, stałe filtrów, fabryki bulk).
 *
 * To NIE jest register shell i nigdy nim nie był: renderuje wyłącznie
 * `<thead>` + `<tbody>{children}</tbody>`, więc nie ma danych, empty state,
 * loadingu, kliknięcia wiersza, preview ani persystencji. Sam plik deklaruje to
 * niżej w wyjątku `§27-exempt: generyczny prymityw tabeli, FilterableTable =
 * kanon dla list`.
 *
 * Sam eksport zostaje — usunięcie go zmieniłoby publiczne API barrela, z którego
 * korzysta 18 plików. Powrót komponentu jako alternatywnego shella pilnuje
 * `resizableTableDeprecation.r04-3a.test.ts`.
 */
export const ResizableTable: React.FC<ResizableTableProps> = ({
  columns,
  children,
  onColumnWidthChange,
  onFilterChange,
  filters: externalFilters,
  selectedIds,
  onSelectAll,
  allSelected = false,
  someSelected = false,
  showSelectColumn = true,
  className = '',
}) => {
  // Internal column widths state (can be controlled externally via onColumnWidthChange)
  const [internalWidths, setInternalWidths] = useState<ColumnWidths>(() =>
    columns.reduce(
      (acc, col) => ({
        ...acc,
        [col.id]: col.width,
      }),
      {}
    )
  );

  // Internal filters state (can be controlled externally via onFilterChange)
  const [internalFilters, setInternalFilters] = useState<TableFilters>({});

  // Use external or internal state
  const filters = externalFilters || internalFilters;

  // Handle column resize
  const handleColumnResize = useCallback(
    (columnId: string, newWidth: number) => {
      setInternalWidths((prev) => ({
        ...prev,
        [columnId]: newWidth,
      }));
      onColumnWidthChange?.(columnId, newWidth);
    },
    [onColumnWidthChange]
  );

  // Handle filter change
  const handleFilterChange = useCallback(
    (columnId: string, value: string[] | DateRange) => {
      const newFilters = {
        ...filters,
        [columnId]: value,
      };
      setInternalFilters(newFilters);
      onFilterChange?.(newFilters);
    },
    [filters, onFilterChange]
  );

  // Calculate total width for proper table sizing
  const totalWidth = useMemo(() => {
    let width = showSelectColumn ? 40 : 0; // Select column
    columns.forEach((col) => {
      if (col.id !== 'title') {
        width += internalWidths[col.id] || col.width;
      }
    });
    return width;
  }, [columns, internalWidths, showSelectColumn]);

  return (
    <div className={`overflow-x-auto ${className}`}>
      <table /* §27-exempt: generyczny prymityw tabeli, FilterableTable = kanon dla list */
        className="w-full"
        style={{ minWidth: `${totalWidth + 200}px` }}
      >
        <TableHeader
          columns={columns}
          columnWidths={internalWidths}
          onColumnResize={handleColumnResize}
          filters={filters}
          onFilterChange={handleFilterChange}
          showSelectColumn={showSelectColumn}
          onSelectAll={onSelectAll}
          allSelected={allSelected}
          someSelected={someSelected}
        />
        <tbody>{children}</tbody>
      </table>
    </div>
  );
};

// Predefined column configurations for consistency
export const STANDARD_COLUMNS = {
  select: {
    id: 'select',
    label: '',
    width: 40,
    minWidth: 40,
    maxWidth: 40,
    resizable: false,
    filterable: false,
  },
  indicator: {
    id: 'indicator',
    label: '',
    width: 24,
    minWidth: 24,
    maxWidth: 24,
    resizable: false,
    filterable: false,
  },
  type: {
    id: 'type',
    label: 'Type',
    width: 100,
    minWidth: 80,
    maxWidth: 150,
    resizable: true,
    filterable: true,
    filterType: 'multiselect' as const,
  },
  title: {
    id: 'title',
    label: 'Title',
    width: 200,
    minWidth: 200,
    resizable: false,
    filterable: false,
  },
  context: {
    id: 'context',
    label: 'Context',
    width: 140,
    minWidth: 100,
    maxWidth: 200,
    resizable: true,
    filterable: true,
    filterType: 'multiselect' as const,
  },
  status: {
    id: 'status',
    label: 'Status',
    width: 110,
    minWidth: 90,
    maxWidth: 150,
    resizable: true,
    filterable: true,
    filterType: 'multiselect' as const,
  },
  priority: {
    id: 'priority',
    label: 'Priority',
    width: 100,
    minWidth: 80,
    maxWidth: 130,
    resizable: true,
    filterable: true,
    filterType: 'multiselect' as const,
  },
  date: {
    id: 'date',
    label: 'Date',
    width: 110,
    minWidth: 90,
    maxWidth: 150,
    resizable: true,
    filterable: true,
    filterType: 'daterange' as const,
  },
  actions: {
    id: 'actions',
    label: 'Actions',
    width: 100,
    minWidth: 80,
    maxWidth: 120,
    resizable: false,
    filterable: false,
    align: 'right' as const,
  },
} as const;

// Priority filter options
export const PRIORITY_FILTER_OPTIONS = [
  { value: 'critical', label: 'Critical', color: 'text-danger-500' },
  { value: 'high', label: 'High', color: 'text-amber-500' },
  { value: 'medium', label: 'Medium', color: 'text-amber-500' },
  { value: 'low', label: 'Low', color: 'text-blue-500' },
];

// Status filter options (can be customized per table)
export const TASK_STATUS_FILTER_OPTIONS = [
  { value: 'todo', label: 'To Do' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'review', label: 'Review' },
  { value: 'blocked', label: 'Blocked' },
  { value: 'completed', label: 'Completed' },
];

export const DECISION_STATUS_FILTER_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'escalated', label: 'Escalated' },
  { value: 'deferred', label: 'Deferred' },
];

export const NOTIFICATION_TYPE_FILTER_OPTIONS = [
  { value: 'task', label: 'Task' },
  { value: 'decision', label: 'Decision' },
  { value: 'ai', label: 'AI Insight' },
  { value: 'system', label: 'System' },
  { value: 'alert', label: 'Alert' },
];

export default ResizableTable;
