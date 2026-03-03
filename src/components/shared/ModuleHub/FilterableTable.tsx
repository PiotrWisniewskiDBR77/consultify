/**
 * FilterableTable
 * Table with filterable column headers and row actions
 */

import { ChevronDown, Columns, Copy, Edit, Eye, Maximize2, Trash2 } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ColumnSelector, type ColumnConfig } from '@/components/Admin/shared/ColumnSelector';
import { ColumnResizer } from '@/components/ui/ResizableTable';

import { type RowAction, RowActionsMenu } from '../RowActionsMenu';
import { FilterChip } from './ActiveFilters';

// Column definition
export interface TableColumn {
  id: string;
  label: string;
  width?: string;
  filterable?: boolean;
  filterOptions?: { value: string; label: string; color?: string }[];
  sortable?: boolean;
  render?: (row: any) => React.ReactNode;
}

// Row data
export interface TableRow {
  id: string;
  [key: string]: any;
}

interface FilterableTableProps {
  columns: TableColumn[];
  data: TableRow[];
  /** Optional: highlight a selected row (for Table+Preview layouts). */
  selectedRowId?: string | null;
  onRowClick?: (row: TableRow) => void;
  onRowDoubleClick?: (row: TableRow) => void;
  onRowAction?: (action: string, row: TableRow) => void;
  /** Optional: override the row actions menu contents. */
  getRowActions?: (row: TableRow) => RowAction[];
  /** Optional: hide the row actions menu column. */
  hideRowActions?: boolean;
  activeFilters: FilterChip[];
  onFilterChange: (filters: FilterChip[]) => void;
  emptyMessage?: string;
  /** Outer padding of the table canvas (not the surface). */
  canvasClassName?: string;
  /** Controls row/header density. */
  density?: 'comfortable' | 'compact';
  /** Show the table header settings (columns) button. */
  enableColumnSettings?: boolean;
}

// Status badge component — uses canonical color palette
const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const LABELS: Record<string, string> = {
    DRAFT: 'Draft',
    PENDING_REVIEW: 'Pending Review',
    REVIEW: 'In Review',
    PROMOTED: 'Promoted',
    PLANNING: 'Planning',
    APPROVED: 'Approved',
    SCHEDULED: 'Scheduled',
    EXECUTING: 'Executing',
    BLOCKED: 'Blocked',
    DONE: 'Done',
    TRACKING: 'Tracking',
    CANCELLED: 'Cancelled',
    ARCHIVED: 'Archived',
    IN_REVIEW: 'In Review',
    AWAITING_APPROVAL: 'Awaiting Approval',
    REJECTED: 'Rejected',
    GENERATING: 'Generating',
    FINAL: 'Final',
    PENDING_APPROVAL: 'Pending Approval',
    UTILIZED: 'Utilized',
  };

  const style = (() => {
    const key = status?.toUpperCase().replace(/[\s-]+/g, '_') || 'DRAFT';
    const alarm = ['BLOCKED', 'REJECTED'];
    const success = ['DONE', 'COMPLETED', 'APPROVED', 'TRACKING', 'UTILIZED', 'ACTIVE'];
    const info = ['IN_PROGRESS', 'EXECUTING', 'SCHEDULED', 'GENERATING', 'PROMOTED'];
    const warning = [
      'PENDING_REVIEW',
      'REVIEW',
      'PLANNING',
      'PENDING_APPROVAL',
      'AWAITING_APPROVAL',
      'IN_REVIEW',
      'ESCALATED',
    ];

    if (alarm.includes(key))
      return { bg: 'bg-red-500/20', text: 'text-red-400', dot: 'bg-red-500' };
    if (success.includes(key))
      return { bg: 'bg-emerald-500/10', text: 'text-emerald-400', dot: 'bg-emerald-500' };
    if (info.includes(key))
      return { bg: 'bg-blue-500/10', text: 'text-blue-400', dot: 'bg-blue-500' };
    if (warning.includes(key))
      return { bg: 'bg-amber-500/10', text: 'text-amber-400', dot: 'bg-amber-500' };
    return { bg: 'bg-slate-500/10', text: 'text-slate-400', dot: 'bg-slate-400' };
  })();

  const label = LABELS[status] || status || 'Draft';

  return (
    <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full ${style.bg}`}>
      <span className={`w-2 h-2 rounded-full ${style.dot}`} />
      <span className={`text-xs font-medium ${style.text}`}>{label}</span>
    </div>
  );
};

// Progress bar component
const ProgressBar: React.FC<{ progress: number }> = ({ progress }) => (
  <div className="flex items-center gap-2">
    <div className="flex-1 h-1.5 bg-slate-200 dark:bg-navy-700 rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-all ${
          progress === 100
            ? 'bg-emerald-500'
            : progress >= 75
              ? 'bg-blue-500'
              : progress >= 50
                ? 'bg-amber-500'
                : 'bg-slate-500'
        }`}
        style={{ width: `${progress}%` }}
      />
    </div>
    <span className="text-xs text-slate-500 dark:text-slate-400 w-8">{progress}%</span>
  </div>
);

// Filter dropdown component
const FilterDropdown: React.FC<{
  column: TableColumn;
  activeValues: string[];
  onApply: (values: string[]) => void;
}> = ({ column, activeValues, onApply }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>(activeValues);

  const handleToggle = (value: string) => {
    setSelected((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );
  };

  const handleApply = () => {
    onApply(selected);
    setIsOpen(false);
  };

  const handleClear = () => {
    setSelected([]);
    onApply([]);
    setIsOpen(false);
  };

  if (!column.filterable || !column.filterOptions) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`p-1 rounded-md hover:bg-slate-100/70 dark:hover:bg-white/[0.06] transition-colors ${
          activeValues.length > 0 ? 'text-primary-400' : 'text-slate-500'
        }`}
      >
        <ChevronDown size={14} />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute top-full left-0 mt-1 z-50 min-w-[180px] bg-white dark:bg-navy-900 border border-slate-200/70 dark:border-white/[0.08] rounded-xl shadow-xl overflow-hidden">
            <div className="max-h-[200px] overflow-y-auto p-2">
              {column.filterOptions.map((option) => (
                <label
                  key={option.value}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-white/[0.04] cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(option.value)}
                    onChange={() => handleToggle(option.value)}
                    className="rounded border-navy-600 bg-slate-200 dark:bg-navy-700 text-primary-500 focus:ring-primary-500"
                  />
                  {option.color && <span className={`w-2 h-2 rounded-full ${option.color}`} />}
                  <span className="text-sm text-slate-700 dark:text-slate-200">{option.label}</span>
                </label>
              ))}
            </div>
            <div className="flex items-center justify-between p-2 border-t border-slate-200/70 dark:border-white/[0.08]">
              <button
                onClick={handleClear}
                className="text-xs font-medium text-slate-500 dark:text-slate-300 hover:text-slate-700 dark:hover:text-white transition-colors"
              >
                Clear
              </button>
              <button
                onClick={handleApply}
                className="px-3 py-1 text-xs font-medium bg-primary-500 text-white rounded-lg hover:bg-primary-400 transition-colors"
              >
                Apply
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export const FilterableTable: React.FC<FilterableTableProps> = ({
  columns,
  data,
  selectedRowId,
  onRowClick,
  onRowDoubleClick,
  onRowAction,
  getRowActions,
  hideRowActions = false,
  activeFilters,
  onFilterChange,
  emptyMessage = 'No items found',
  canvasClassName = 'p-4',
  density = 'comfortable',
  enableColumnSettings = true,
}) => {
  const { i18n, t } = useTranslation();
  const isPolish = i18n.language?.startsWith('pl');
  const cellPadding = density === 'compact' ? 'px-3 py-2' : 'px-4 py-3';

  const parsePx = useCallback((value?: string, fallback = 140) => {
    if (!value) return fallback;
    const m = String(value).match(/(\d+)\s*px/i);
    if (m?.[1]) return Number(m[1]);
    const n = Number(String(value).replace(/[^\d.]/g, ''));
    return Number.isFinite(n) && n > 0 ? n : fallback;
  }, []);

  const defaultColumnConfigs = useMemo<ColumnConfig[]>(() => {
    return columns.map((c, idx) => ({
      id: c.id,
      label: c.label,
      visible: true,
      order: idx,
      width: parsePx(c.width, c.id === 'title' || c.id === 'name' ? 260 : 140),
      minWidth: c.id === 'title' || c.id === 'name' ? 200 : 90,
      maxWidth: c.id === 'title' || c.id === 'name' ? 520 : 320,
      required: c.id === 'title' || c.id === 'name',
    }));
  }, [columns, parsePx]);

  const [columnConfigs, setColumnConfigs] = useState<ColumnConfig[]>(defaultColumnConfigs);
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => {
    const widths: Record<string, number> = {};
    for (const c of defaultColumnConfigs) widths[c.id] = c.width ?? 140;
    return widths;
  });

  // Keep column settings in sync when columns change (e.g., tab switch).
  useEffect(() => {
    setColumnConfigs(defaultColumnConfigs);
    setColumnWidths(() => {
      const widths: Record<string, number> = {};
      for (const c of defaultColumnConfigs) widths[c.id] = c.width ?? 140;
      return widths;
    });
  }, [defaultColumnConfigs]);

  const visibleColumns = useMemo(() => {
    const byId = new Map(columnConfigs.map((c) => [c.id, c]));
    return columns
      .filter((c) => byId.get(c.id)?.visible !== false)
      .sort((a, b) => (byId.get(a.id)?.order ?? 0) - (byId.get(b.id)?.order ?? 0));
  }, [columns, columnConfigs]);

  const handleColumnResize = useCallback(
    (columnId: string, newWidth: number) => {
      setColumnWidths((prev) => ({ ...prev, [columnId]: newWidth }));
      setColumnConfigs((prev) =>
        prev.map((c) => (c.id === columnId ? { ...c, width: newWidth } : c))
      );
    },
    [setColumnWidths, setColumnConfigs]
  );

  const resetColumns = useCallback(() => {
    setColumnConfigs(defaultColumnConfigs);
    setColumnWidths(() => {
      const widths: Record<string, number> = {};
      for (const c of defaultColumnConfigs) widths[c.id] = c.width ?? 140;
      return widths;
    });
  }, [defaultColumnConfigs]);

  // Get active filter values for a column
  const getActiveFilterValues = useCallback(
    (columnId: string) => {
      return activeFilters.filter((f) => f.column === columnId).map((f) => f.value);
    },
    [activeFilters]
  );

  // Handle filter change for a column
  const handleColumnFilter = useCallback(
    (column: TableColumn, values: string[]) => {
      // Remove existing filters for this column
      const otherFilters = activeFilters.filter((f) => f.column !== column.id);

      // Add new filters
      const newFilters = values.map((value) => {
        const option = column.filterOptions?.find((o) => o.value === value);
        return {
          id: `${column.id}-${value}`,
          column: column.id,
          value,
          label: option?.label || value,
          color: option?.color,
        };
      });

      onFilterChange([...otherFilters, ...newFilters]);
    },
    [activeFilters, onFilterChange]
  );

  // Filter data based on active filters
  const filteredData = useMemo(() => {
    if (activeFilters.length === 0) return data;

    return data.filter((row) => {
      // Group filters by column
      const filtersByColumn = activeFilters.reduce(
        (acc, filter) => {
          if (!acc[filter.column]) acc[filter.column] = [];
          acc[filter.column].push(filter.value);
          return acc;
        },
        {} as Record<string, string[]>
      );

      // Check each column's filters (OR within column, AND between columns)
      return Object.entries(filtersByColumn).every(([column, values]) => {
        const rowValue = row[column];
        return values.includes(rowValue);
      });
    });
  }, [data, activeFilters]);

  // Format relative time
  const formatRelativeTime = (date: Date | string) => {
    const d = new Date(date);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);

    if (hours < 1) return isPolish ? 'Przed chwilą' : 'Just now';
    if (hours < 24) return isPolish ? `${hours} h temu` : `${hours}h ago`;
    if (days < 7) return isPolish ? `${days} dni temu` : `${days}d ago`;
    return d.toLocaleDateString();
  };

  return (
    <div className={canvasClassName}>
      <div className="bg-white/70 dark:bg-navy-900/70 backdrop-blur border border-slate-200/70 dark:border-white/[0.06] rounded-xl overflow-hidden">
        <div className="w-full overflow-x-auto">
          <table className="w-full table-fixed">
          <thead>
            <tr className="bg-white/60 dark:bg-navy-900/60 border-b border-slate-200/70 dark:border-white/[0.06]">
              {visibleColumns.map((column, idx) => {
                const cfg = columnConfigs.find((c) => c.id === column.id);
                const width = columnWidths[column.id] ?? parsePx(column.width, 140);
                const minWidth = cfg?.minWidth ?? (column.id === 'title' || column.id === 'name' ? 200 : 90);
                const maxWidth = cfg?.maxWidth ?? (column.id === 'title' || column.id === 'name' ? 520 : 320);
                const isLastDataCol = idx === visibleColumns.length - 1;
                return (
                <th
                  key={column.id}
                  className={`${cellPadding} relative text-left text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider`}
                  style={{
                    width: `${width}px`,
                    minWidth: `${minWidth}px`,
                    maxWidth: `${maxWidth}px`,
                  }}
                >
                  <div className="flex items-center gap-1">
                    <span>{column.label}</span>
                    {column.filterable && (
                      <FilterDropdown
                        column={column}
                        activeValues={getActiveFilterValues(column.id)}
                        onApply={(values) => handleColumnFilter(column, values)}
                      />
                    )}
                  </div>
                  {!isLastDataCol ? (
                    <ColumnResizer
                      columnId={column.id}
                      currentWidth={width}
                      minWidth={minWidth}
                      maxWidth={maxWidth}
                      onResize={handleColumnResize}
                    />
                  ) : null}
                </th>
              );
              })}
              {!hideRowActions ? (
                <th
                  className={`${cellPadding} text-right text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-20`}
                >
                  {enableColumnSettings ? (
                    <div className="flex justify-end">
                      <ColumnSelector
                        columns={columnConfigs}
                        onChange={setColumnConfigs}
                        onReset={resetColumns}
                        trigger={
                          <button
                            type="button"
                            className="inline-flex items-center justify-center h-7 w-7 rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-100/70 dark:hover:bg-white/[0.06] transition-colors"
                            title={t('common.columns', isPolish ? 'Kolumny' : 'Columns')}
                            aria-label={t('common.columns', isPolish ? 'Kolumny' : 'Columns')}
                          >
                            <Columns size={14} />
                          </button>
                        }
                      />
                    </div>
                  ) : null}
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200/70 dark:divide-white/[0.06]">
            {filteredData.length === 0 ? (
              <tr>
                <td
                  colSpan={visibleColumns.length + (hideRowActions ? 0 : 1)}
                  className={`${density === 'compact' ? 'px-3' : 'px-4'} py-12 text-center text-slate-500`}
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              filteredData.map((row) => (
                <tr
                  key={row.id}
                  onClick={() => onRowClick?.(row)}
                  onDoubleClick={() => onRowDoubleClick?.(row)}
                  className={[
                    'group cursor-pointer transition-colors',
                    row.id === selectedRowId
                      ? 'bg-primary-500/10'
                      : 'hover:bg-slate-50/70 dark:hover:bg-white/[0.03]',
                  ].join(' ')}
                >
                  {visibleColumns.map((column) => (
                    <td key={column.id} className={cellPadding}>
                      {column.render ? (
                        column.render(row)
                      ) : column.id === 'status' ? (
                        <StatusBadge status={row.status} />
                      ) : column.id === 'progress' ? (
                        <ProgressBar progress={row.progress} />
                      ) : column.id === 'updatedAt' ? (
                        <span className="text-sm text-slate-500 dark:text-slate-400">
                          {formatRelativeTime(row.updatedAt)}
                        </span>
                      ) : (
                        <div className="min-w-0">
                          <span
                            className={[
                              'text-sm text-slate-700 dark:text-slate-200',
                              column.id === 'title' || column.id === 'name' ? 'block truncate' : '',
                            ].join(' ')}
                            title={typeof row[column.id] === 'string' ? row[column.id] : undefined}
                          >
                            {row[column.id]}
                          </span>
                        </div>
                      )}
                    </td>
                  ))}
                  {!hideRowActions ? (
                    <td className={`${cellPadding} text-right`}>
                      <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
                        {(() => {
                          const actions: RowAction[] =
                            getRowActions?.(row) ??
                            ([
                              {
                                id: 'open',
                                label: t('common.open', 'Open'),
                                icon: Maximize2,
                                variant: 'primary',
                                onClick: () => onRowAction?.('edit', row),
                              },
                              {
                                id: 'preview',
                                label: t('common.preview', 'Preview'),
                                icon: Eye,
                                onClick: () => onRowAction?.('preview', row),
                              },
                              {
                                id: 'duplicate',
                                label: t('common.duplicate', 'Duplicate'),
                                icon: Copy,
                                onClick: () => onRowAction?.('duplicate', row),
                              },
                              {
                                id: 'rename',
                                label: t('common.edit', 'Edit'),
                                icon: Edit,
                                onClick: () => onRowAction?.('rename', row),
                              },
                              {
                                id: 'delete',
                                label: t('common.delete', 'Delete'),
                                icon: Trash2,
                                divider: true,
                                variant: 'danger',
                                onClick: () => onRowAction?.('delete', row),
                              },
                            ] as RowAction[]);

                          if (!actions.length) return null;

                          return <RowActionsMenu iconVariant="vertical" actions={actions} />;
                        })()}
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))
            )}
          </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default FilterableTable;
