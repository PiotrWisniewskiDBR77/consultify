/**
 * EnhancedDataTable - Extended DataTable with admin features
 *
 * Features:
 * - Bulk selection with checkboxes
 * - Column visibility toggle (Edit columns)
 * - Row actions dropdown (ellipsis menu)
 * - Inline editing support
 * - Export functionality (CSV/Excel)
 * - Bulk actions toolbar
 *
 * Design: HubSpot-style admin table with enhanced functionality
 */

import { AnimatePresence, motion } from 'framer-motion';
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  ChevronUp,
  Columns3,
  Download,
  FileSpreadsheet,
  GripVertical,
  MoreHorizontal,
  Pencil,
  Trash2,
  X,
} from 'lucide-react';
import React, { forwardRef, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '../../../utils/cn';
import { EmptyState } from '../../ui/composed/EmptyState';
import { Button } from '../../ui/primitives/Button';
import {
  Dropdown,
  DropdownContent,
  DropdownItem,
  DropdownTrigger,
} from '../../ui/primitives/Dropdown';
import { Modal } from '../../ui/primitives/Modal';
import { Skeleton, TableRowSkeleton } from '../../ui/primitives/Skeleton';

export type SortDirection = 'asc' | 'desc' | null;

export interface EnhancedColumn<T> {
  /** Unique column key */
  key: keyof T | string;
  /** Column header text */
  header: string;
  /** Column width */
  width?: string | number;
  /** Sortable column */
  sortable?: boolean;
  /** Custom cell renderer */
  render?: (value: unknown, row: T, index: number) => React.ReactNode;
  /** Header alignment */
  headerAlign?: 'left' | 'center' | 'right';
  /** Cell alignment */
  cellAlign?: 'left' | 'center' | 'right';
  /** Column is hidden by default */
  hidden?: boolean;
  /** Column cannot be hidden */
  required?: boolean;
  /** Column is editable */
  editable?: boolean;
  /** Edit cell renderer */
  editRender?: (value: unknown, row: T, onChange: (value: unknown) => void) => React.ReactNode;
}

export interface RowAction<T> {
  /** Action label */
  label: string;
  /** Action icon */
  icon?: React.ElementType;
  /** Action callback */
  onClick: (row: T, index: number) => void;
  /** Disable condition */
  disabled?: (row: T) => boolean;
  /** Danger action (red color) */
  danger?: boolean;
  /** Separator before this action */
  separator?: boolean;
}

export interface BulkAction<T> {
  /** Action label */
  label: string;
  /** Action icon */
  icon?: React.ElementType;
  /** Action callback */
  onClick: (selectedRows: T[], selectedIds: string[]) => void;
  /** Danger action (red color) */
  danger?: boolean;
}

export interface EnhancedDataTableProps<T> {
  /** Column definitions */
  columns: EnhancedColumn<T>[];
  /** Table data */
  data: T[];
  /** Unique key for each row */
  rowKey?: keyof T | ((row: T) => string);
  /** On row click */
  onRowClick?: (row: T, index: number) => void;
  /** Loading state */
  loading?: boolean;
  /** Number of skeleton rows when loading */
  loadingRows?: number;
  /** Empty state configuration */
  emptyState?: {
    title?: string;
    description?: string;
    action?: { label: string; onClick: () => void };
  };
  /** Enable pagination */
  pagination?: boolean;
  /** Page size */
  pageSize?: number;
  /** Striped rows */
  striped?: boolean;
  /** Compact mode */
  compact?: boolean;
  /** Enable row selection */
  selectable?: boolean;
  /** Selected row IDs (controlled) */
  selectedIds?: string[];
  /** On selection change */
  onSelectionChange?: (selectedIds: string[], selectedRows: T[]) => void;
  /** Row actions */
  rowActions?: RowAction<T>[];
  /** Bulk actions */
  bulkActions?: BulkAction<T>[];
  /** Enable column visibility toggle */
  editableColumns?: boolean;
  /** Enable inline editing */
  editable?: boolean;
  /** On cell edit */
  onCellEdit?: (rowId: string, column: string, value: unknown) => void;
  /** Enable export */
  exportable?: boolean;
  /** Export formats */
  exportFormats?: ('csv' | 'xlsx')[];
  /** On export */
  onExport?: (format: 'csv' | 'xlsx', data: T[], columns: EnhancedColumn<T>[]) => void;
  /** Table title (for toolbar) */
  title?: string;
  /** Additional toolbar content */
  toolbarContent?: React.ReactNode;
  /** Additional className */
  className?: string;
}

// Helper to convert data to CSV
function convertToCSV<T>(data: T[], columns: EnhancedColumn<T>[]): string {
  const headers = columns.map((col) => col.header).join(',');
  const rows = data.map((row) =>
    columns
      .map((col) => {
        const value = row[col.key as keyof T];
        const strValue = String(value ?? '');
        // Escape commas and quotes
        if (strValue.includes(',') || strValue.includes('"') || strValue.includes('\n')) {
          return `"${strValue.replace(/"/g, '""')}"`;
        }
        return strValue;
      })
      .join(',')
  );
  return [headers, ...rows].join('\n');
}

// Helper to download file
function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export const EnhancedDataTable = forwardRef<
  HTMLDivElement,
  EnhancedDataTableProps<Record<string, unknown>>
>(
  <T extends Record<string, unknown>>(
    {
      columns,
      data,
      rowKey = 'id' as keyof T,
      onRowClick,
      loading = false,
      loadingRows = 5,
      emptyState,
      pagination = false,
      pageSize = 10,
      striped = false,
      compact = false,
      selectable = false,
      selectedIds: controlledSelectedIds,
      onSelectionChange,
      rowActions,
      bulkActions,
      editableColumns = false,
      editable = false,
      onCellEdit,
      exportable = false,
      exportFormats = ['csv', 'xlsx'],
      onExport,
      title,
      toolbarContent,
      className = '',
    }: EnhancedDataTableProps<T>,
    ref: React.Ref<HTMLDivElement>
  ) => {
    const { t } = useTranslation();
    const [sortKey, setSortKey] = useState<keyof T | string | null>(null);
    const [sortDirection, setSortDirection] = useState<SortDirection>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [internalSelectedIds, setInternalSelectedIds] = useState<Set<string>>(new Set());
    const [visibleColumns, setVisibleColumns] = useState<Set<string>>(
      new Set(columns.filter((c) => !c.hidden).map((c) => String(c.key)))
    );
    const [showColumnModal, setShowColumnModal] = useState(false);
    const [editingCell, setEditingCell] = useState<{ rowId: string; column: string } | null>(null);
    const [editValue, setEditValue] = useState<unknown>(null);

    // Use controlled or internal selected IDs
    const selectedIds = controlledSelectedIds
      ? new Set(controlledSelectedIds)
      : internalSelectedIds;

    // Get row key
    const getRowKey = useCallback(
      (row: T, index: number): string => {
        if (typeof rowKey === 'function') {
          return rowKey(row);
        }
        return String(row[rowKey] ?? index);
      },
      [rowKey]
    );

    // Sort data
    const sortedData = useMemo(() => {
      if (!sortKey || !sortDirection) return data;

      return [...data].sort((a, b) => {
        const aVal = a[sortKey as keyof T];
        const bVal = b[sortKey as keyof T];

        if (aVal === bVal) return 0;
        if (aVal === null || aVal === undefined) return 1;
        if (bVal === null || bVal === undefined) return -1;

        const comparison = aVal < bVal ? -1 : 1;
        return sortDirection === 'asc' ? comparison : -comparison;
      });
    }, [data, sortKey, sortDirection]);

    // Paginate data
    const paginatedData = useMemo(() => {
      if (!pagination) return sortedData;

      const start = (currentPage - 1) * pageSize;
      return sortedData.slice(start, start + pageSize);
    }, [sortedData, pagination, currentPage, pageSize]);

    const totalPages = Math.ceil(sortedData.length / pageSize);

    // Visible columns
    const displayColumns = useMemo(
      () => columns.filter((c) => visibleColumns.has(String(c.key))),
      [columns, visibleColumns]
    );

    // Handle sort
    const handleSort = useCallback((key: keyof T | string) => {
      setSortKey((prevKey) => {
        if (prevKey === key) {
          setSortDirection((prev) => {
            if (prev === 'asc') return 'desc';
            if (prev === 'desc') {
              return null;
            }
            return 'asc';
          });
        } else {
          setSortDirection('asc');
        }
        return key;
      });
      setCurrentPage(1);
    }, []);

    // Handle selection
    const handleSelectRow = useCallback(
      (rowId: string, row: T) => {
        const newSelected = new Set(selectedIds);
        if (newSelected.has(rowId)) {
          newSelected.delete(rowId);
        } else {
          newSelected.add(rowId);
        }

        if (!controlledSelectedIds) {
          setInternalSelectedIds(newSelected);
        }

        const selectedRows = data.filter((r) => newSelected.has(getRowKey(r, 0)));
        onSelectionChange?.(Array.from(newSelected), selectedRows);
      },
      [selectedIds, controlledSelectedIds, data, getRowKey, onSelectionChange]
    );

    // Handle select all
    const handleSelectAll = useCallback(() => {
      const allIds = paginatedData.map((row, index) => getRowKey(row, index));
      const allSelected = allIds.every((id) => selectedIds.has(id));

      let newSelected: Set<string>;
      if (allSelected) {
        newSelected = new Set([...selectedIds].filter((id) => !allIds.includes(id)));
      } else {
        newSelected = new Set([...selectedIds, ...allIds]);
      }

      if (!controlledSelectedIds) {
        setInternalSelectedIds(newSelected);
      }

      const selectedRows = data.filter((r) => newSelected.has(getRowKey(r, 0)));
      onSelectionChange?.(Array.from(newSelected), selectedRows);
    }, [paginatedData, selectedIds, controlledSelectedIds, data, getRowKey, onSelectionChange]);

    // Handle export
    const handleExport = useCallback(
      (format: 'csv' | 'xlsx') => {
        if (onExport) {
          onExport(format, data, displayColumns);
        } else if (format === 'csv') {
          const csv = convertToCSV(data, displayColumns);
          downloadFile(csv, `export-${Date.now()}.csv`, 'text/csv');
        }
      },
      [data, displayColumns, onExport]
    );

    // Handle inline edit
    const startEditing = useCallback((rowId: string, column: string, value: unknown) => {
      setEditingCell({ rowId, column });
      setEditValue(value);
    }, []);

    const saveEdit = useCallback(() => {
      if (editingCell && onCellEdit) {
        onCellEdit(editingCell.rowId, editingCell.column, editValue);
      }
      setEditingCell(null);
      setEditValue(null);
    }, [editingCell, editValue, onCellEdit]);

    const cancelEdit = useCallback(() => {
      setEditingCell(null);
      setEditValue(null);
    }, []);

    // Keyboard handling for edit
    useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (editingCell) {
          if (e.key === 'Enter') {
            saveEdit();
          } else if (e.key === 'Escape') {
            cancelEdit();
          }
        }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }, [editingCell, saveEdit, cancelEdit]);

    // Render sort icon
    const SortIcon = ({ columnKey }: { columnKey: keyof T | string }) => {
      if (sortKey !== columnKey) {
        return <ChevronsUpDown size={14} className="text-slate-400 dark:text-slate-500" />;
      }
      if (sortDirection === 'asc') {
        return <ChevronUp size={14} className="text-primary-500" />;
      }
      return <ChevronDown size={14} className="text-primary-500" />;
    };

    const alignmentClasses = {
      left: 'text-left',
      center: 'text-center',
      right: 'text-right',
    };

    const paddingClasses = compact ? 'px-3 py-2' : 'px-4 py-3';

    const isAllSelected =
      paginatedData.length > 0 &&
      paginatedData.every((row, index) => selectedIds.has(getRowKey(row, index)));
    const isSomeSelected =
      paginatedData.some((row, index) => selectedIds.has(getRowKey(row, index))) && !isAllSelected;

    const selectedCount = Array.from(selectedIds).length;

    return (
      <div ref={ref} className={cn('w-full', className)}>
        {/* Toolbar */}
        {(selectable && selectedCount > 0) ||
        title ||
        toolbarContent ||
        editableColumns ||
        exportable ? (
          <div className="flex items-center justify-between mb-4 gap-4">
            {/* Left side */}
            <div className="flex items-center gap-4">
              {title && !selectedCount && (
                <h3 className="text-lg font-semibold text-navy-900 dark:text-white">{title}</h3>
              )}

              {/* Bulk selection info & actions */}
              {selectable && selectedCount > 0 && (
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-primary-600 dark:text-primary-400">
                    {selectedCount} {t('admin.table.selected', 'selected')}
                  </span>
                  <button
                    onClick={() => {
                      if (!controlledSelectedIds) {
                        setInternalSelectedIds(new Set());
                      }
                      onSelectionChange?.([], []);
                    }}
                    className="text-sm text-slate-500 hover:text-slate-700 dark:text-slate-300 dark:hover:text-slate-300"
                  >
                    {t('admin.table.clearSelection', 'Clear')}
                  </button>
                  {bulkActions && bulkActions.length > 0 && (
                    <div className="flex items-center gap-2 pl-3 border-l border-slate-200 dark:border-navy-700">
                      {bulkActions.map((action, index) => {
                        const Icon = action.icon;
                        return (
                          <Button
                            key={index}
                            variant={action.danger ? 'danger' : 'outline'}
                            size="sm"
                            onClick={() => {
                              const selectedRows = data.filter((r) =>
                                selectedIds.has(getRowKey(r, 0))
                              );
                              action.onClick(selectedRows, Array.from(selectedIds));
                            }}
                            icon={Icon ? <Icon size={14} /> : undefined}
                          >
                            {action.label}
                          </Button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {toolbarContent}
            </div>

            {/* Right side */}
            <div className="flex items-center gap-2">
              {/* Edit columns button */}
              {editableColumns && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowColumnModal(true)}
                  icon={<Columns3 size={14} />}
                >
                  {t('admin.table.editColumns', 'Edit columns')}
                </Button>
              )}

              {/* Export button */}
              {exportable && (
                <Dropdown>
                  <DropdownTrigger asChild>
                    <Button variant="outline" size="sm" icon={<Download size={14} />}>
                      {t('admin.table.export', 'Export')}
                    </Button>
                  </DropdownTrigger>
                  <DropdownContent align="end">
                    {exportFormats.includes('csv') && (
                      <DropdownItem onClick={() => handleExport('csv')}>
                        <FileSpreadsheet size={14} />
                        {t('admin.table.exportCSV', 'Export as CSV')}
                      </DropdownItem>
                    )}
                    {exportFormats.includes('xlsx') && (
                      <DropdownItem onClick={() => handleExport('xlsx')}>
                        <FileSpreadsheet size={14} />
                        {t('admin.table.exportExcel', 'Export as Excel')}
                      </DropdownItem>
                    )}
                  </DropdownContent>
                </Dropdown>
              )}
            </div>
          </div>
        ) : null}

        {/* Table */}
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-navy-700">
          <table
            /* §27-exempt: generyczny prymityw tabeli, FilterableTable = kanon dla list */ className="w-full"
          >
            {/* Header */}
            <thead className="bg-slate-50 dark:bg-navy-900">
              <tr>
                {/* Selection checkbox column */}
                {selectable && (
                  <th className={cn(paddingClasses, 'w-12')}>
                    <input
                      type="checkbox"
                      checked={isAllSelected}
                      ref={(input) => {
                        if (input) input.indeterminate = isSomeSelected;
                      }}
                      onChange={handleSelectAll}
                      className="w-4 h-4 rounded border-slate-300 dark:border-navy-700 text-primary-600 focus:ring-primary-500"
                    />
                  </th>
                )}

                {displayColumns.map((column) => (
                  <th
                    key={String(column.key)}
                    className={cn(
                      paddingClasses,
                      alignmentClasses[column.headerAlign || 'left'],
                      'text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider',
                      column.sortable &&
                        'cursor-pointer select-none hover:bg-slate-100 dark:hover:bg-navy-800/30 dark:hover:bg-navy-800'
                    )}
                    style={{ width: column.width }}
                    onClick={() => column.sortable && handleSort(column.key)}
                  >
                    <span className="inline-flex items-center gap-2">
                      {column.header}
                      {column.sortable && <SortIcon columnKey={column.key} />}
                    </span>
                  </th>
                ))}

                {/* Actions column */}
                {rowActions && rowActions.length > 0 && (
                  <th className={cn(paddingClasses, 'w-20 text-right')}>
                    <span className="sr-only">{t('admin.table.actions', 'Actions')}</span>
                  </th>
                )}
              </tr>
            </thead>

            {/* Body */}
            <tbody className="bg-white dark:bg-navy-800 divide-y divide-slate-200 dark:divide-navy-700">
              {loading ? (
                <TableRowSkeleton
                  columns={displayColumns.length + (selectable ? 1 : 0) + (rowActions ? 1 : 0)}
                  rows={loadingRows}
                />
              ) : paginatedData.length === 0 ? (
                <tr>
                  <td colSpan={displayColumns.length + (selectable ? 1 : 0) + (rowActions ? 1 : 0)}>
                    <EmptyState
                      preset="noData"
                      compact
                      title={emptyState?.title}
                      description={emptyState?.description}
                      action={emptyState?.action}
                    />
                  </td>
                </tr>
              ) : (
                <AnimatePresence>
                  {paginatedData.map((row, index) => {
                    const rowId = getRowKey(row, index);
                    const isSelected = selectedIds.has(rowId);

                    return (
                      <motion.tr
                        key={rowId}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        onClick={() => onRowClick?.(row, index)}
                        className={cn(
                          'transition-colors',
                          onRowClick &&
                            'cursor-pointer hover:bg-slate-50 dark:hover:bg-navy-700/50',
                          striped && index % 2 === 1 && 'bg-slate-50/50 dark:bg-navy-800/50',
                          isSelected &&
                            'bg-primary-50 dark:bg-primary-900/20 border-l-2 border-primary-600'
                        )}
                      >
                        {/* Selection checkbox */}
                        {selectable && (
                          <td className={paddingClasses} onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleSelectRow(rowId, row)}
                              className="w-4 h-4 rounded border-slate-300 dark:border-navy-700 text-primary-600 focus:ring-primary-500"
                            />
                          </td>
                        )}

                        {displayColumns.map((column) => {
                          const value = row[column.key as keyof T];
                          const isEditing =
                            editingCell?.rowId === rowId &&
                            editingCell?.column === String(column.key);

                          return (
                            <td
                              key={String(column.key)}
                              className={cn(
                                paddingClasses,
                                alignmentClasses[column.cellAlign || 'left'],
                                'text-sm text-navy-900 dark:text-white'
                              )}
                              onDoubleClick={() => {
                                if (editable && column.editable) {
                                  startEditing(rowId, String(column.key), value);
                                }
                              }}
                            >
                              {isEditing ? (
                                <div className="flex items-center gap-2">
                                  {column.editRender ? (
                                    column.editRender(editValue, row, setEditValue)
                                  ) : (
                                    <input
                                      type="text"
                                      value={String(editValue ?? '')}
                                      onChange={(e) => setEditValue(e.target.value)}
                                      className="w-full px-2 py-1 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
                                      autoFocus
                                    />
                                  )}
                                  <button
                                    onClick={saveEdit}
                                    className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
                                  >
                                    <Check size={14} />
                                  </button>
                                  <button
                                    onClick={cancelEdit}
                                    className="p-1 text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-navy-800/30 rounded"
                                  >
                                    <X size={14} />
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2 group">
                                  {column.render
                                    ? column.render(value, row, index)
                                    : String(value ?? '-')}
                                  {editable && column.editable && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        startEditing(rowId, String(column.key), value);
                                      }}
                                      className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-slate-600 dark:text-slate-400 transition-opacity"
                                    >
                                      <Pencil size={12} />
                                    </button>
                                  )}
                                </div>
                              )}
                            </td>
                          );
                        })}

                        {/* Row actions */}
                        {rowActions && rowActions.length > 0 && (
                          <td
                            className={cn(paddingClasses, 'text-right')}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Dropdown>
                              <DropdownTrigger asChild>
                                <button className="p-1 rounded hover:bg-slate-100 dark:hover:bg-navy-800/30 dark:hover:bg-navy-700 text-slate-400 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-300">
                                  <MoreHorizontal size={16} />
                                </button>
                              </DropdownTrigger>
                              <DropdownContent align="end">
                                {rowActions.map((action, actionIndex) => {
                                  const Icon = action.icon;
                                  const isDisabled = action.disabled?.(row);

                                  return (
                                    <React.Fragment key={actionIndex}>
                                      {action.separator && actionIndex > 0 && (
                                        <div className="h-px bg-slate-200 dark:bg-navy-700 my-1" />
                                      )}
                                      <DropdownItem
                                        onClick={() => !isDisabled && action.onClick(row, index)}
                                        disabled={isDisabled}
                                        className={cn(
                                          action.danger &&
                                            'text-danger-600 hover:bg-danger-50 dark:hover:bg-danger-900/20'
                                        )}
                                      >
                                        {Icon && <Icon size={14} />}
                                        {action.label}
                                      </DropdownItem>
                                    </React.Fragment>
                                  );
                                })}
                              </DropdownContent>
                            </Dropdown>
                          </td>
                        )}
                      </motion.tr>
                    );
                  })}
                </AnimatePresence>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination && totalPages > 1 && !loading && (
          <div className="flex items-center justify-between mt-4 px-2">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {t('admin.table.showing', 'Showing')} {(currentPage - 1) * pageSize + 1}{' '}
              {t('admin.table.to', 'to')} {Math.min(currentPage * pageSize, sortedData.length)}{' '}
              {t('admin.table.of', 'of')} {sortedData.length} {t('admin.table.results', 'results')}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                icon={<ChevronLeft size={16} />}
              >
                {t('admin.table.previous', 'Previous')}
              </Button>
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum: number;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }

                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={cn(
                        'w-8 h-8 text-sm rounded-lg transition-colors',
                        currentPage === pageNum
                          ? 'bg-c-text text-c-bg'
                          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-800/30 dark:hover:bg-navy-700'
                      )}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                iconRight={<ChevronRight size={16} />}
              >
                {t('admin.table.next', 'Next')}
              </Button>
            </div>
          </div>
        )}

        {/* Column visibility modal */}
        <Modal
          open={showColumnModal}
          onClose={() => setShowColumnModal(false)}
          title={t('admin.table.editColumnsTitle', 'Edit columns')}
          size="sm"
        >
          <div className="space-y-2">
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
              {t('admin.table.editColumnsDesc', 'Select which columns to display in the table.')}
            </p>
            {columns.map((column) => {
              const key = String(column.key);
              const isVisible = visibleColumns.has(key);
              const isRequired = column.required;

              return (
                <label
                  key={key}
                  className={cn(
                    'flex items-center gap-3 p-2 rounded-lg cursor-pointer hover:bg-slate-50 dark:hover:bg-navy-800',
                    isRequired && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  <input
                    type="checkbox"
                    checked={isVisible}
                    disabled={isRequired}
                    onChange={() => {
                      if (isRequired) return;
                      const newVisible = new Set(visibleColumns);
                      if (isVisible) {
                        newVisible.delete(key);
                      } else {
                        newVisible.add(key);
                      }
                      setVisibleColumns(newVisible);
                    }}
                    className="w-4 h-4 rounded border-slate-300 dark:border-navy-700 text-primary-600 focus:ring-primary-500"
                  />
                  <GripVertical
                    size={14}
                    className="text-slate-400 dark:text-slate-500 cursor-grab"
                  />
                  <span className="text-sm text-navy-900 dark:text-white flex-1">
                    {column.header}
                  </span>
                  {isRequired && (
                    <span className="text-xs text-slate-400 dark:text-slate-500">
                      {t('admin.table.required', 'Required')}
                    </span>
                  )}
                </label>
              );
            })}
          </div>
          <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-slate-200 dark:border-navy-700">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setVisibleColumns(
                  new Set(columns.filter((c) => !c.hidden).map((c) => String(c.key)))
                );
              }}
            >
              {t('admin.table.resetColumns', 'Reset to default')}
            </Button>
            <Button variant="primary" size="sm" onClick={() => setShowColumnModal(false)}>
              {t('admin.table.done', 'Done')}
            </Button>
          </div>
        </Modal>
      </div>
    );
  }
) as <T extends Record<string, unknown>>(
  props: EnhancedDataTableProps<T> & { ref?: React.Ref<HTMLDivElement> }
) => React.ReactElement;

(EnhancedDataTable as React.FC).displayName = 'EnhancedDataTable';

export default EnhancedDataTable;
