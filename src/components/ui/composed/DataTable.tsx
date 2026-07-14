/**
 * DataTable Component - Apple HIG Design System
 *
 * A sortable, filterable data table with pagination support.
 *
 * @example
 * <DataTable
 *   columns={[
 *     { key: 'name', header: 'Name', sortable: true },
 *     { key: 'email', header: 'Email' },
 *   ]}
 *   data={users}
 *   onRowClick={(row) => console.log(row)}
 * />
 */

import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, ChevronLeft, ChevronRight, ChevronsUpDown, ChevronUp } from 'lucide-react';
import React, { forwardRef, useMemo, useState } from 'react';

import { Button } from '../primitives/Button';
import { Skeleton, TableRowSkeleton } from '../primitives/Skeleton';
import { EmptyState } from './EmptyState';

export type SortDirection = 'asc' | 'desc' | null;

export interface Column<T> {
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
}

export interface DataTableProps<T> {
  /** Column definitions */
  columns: Column<T>[];
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
  /** Additional className */
  className?: string;
}

export const DataTable = forwardRef<HTMLDivElement, DataTableProps<Record<string, unknown>>>(
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
      className = '',
    }: DataTableProps<T>,
    ref: React.Ref<HTMLDivElement>
  ) => {
    const [sortKey, setSortKey] = useState<keyof T | string | null>(null);
    const [sortDirection, setSortDirection] = useState<SortDirection>(null);
    const [currentPage, setCurrentPage] = useState(1);

    // Get row key
    const getRowKey = (row: T, index: number): string => {
      if (typeof rowKey === 'function') {
        return rowKey(row);
      }
      return String(row[rowKey] ?? index);
    };

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

    // Handle sort
    const handleSort = (key: keyof T | string) => {
      if (sortKey === key) {
        setSortDirection((prev) => (prev === 'asc' ? 'desc' : prev === 'desc' ? null : 'asc'));
        if (sortDirection === 'desc') {
          setSortKey(null);
        }
      } else {
        setSortKey(key);
        setSortDirection('asc');
      }
      setCurrentPage(1);
    };

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

    return (
      <div ref={ref} className={`w-full ${className}`}>
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-navy-700">
          <table
            /* §27-exempt: generyczny prymityw tabeli, FilterableTable = kanon dla list */ className="w-full"
          >
            {/* Header */}
            <thead className="bg-slate-50 dark:bg-navy-900">
              <tr>
                {columns.map((column) => (
                  <th
                    key={String(column.key)}
                    className={`
                      ${paddingClasses}
                      ${alignmentClasses[column.headerAlign || 'left']}
                      text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider
                      ${column.sortable ? 'cursor-pointer select-none hover:bg-slate-100 dark:hover:bg-white/5' : ''}
                    `}
                    style={{ width: column.width }}
                    onClick={() => column.sortable && handleSort(column.key)}
                  >
                    <span className="inline-flex items-center gap-2">
                      {column.header}
                      {column.sortable && <SortIcon columnKey={column.key} />}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>

            {/* Body */}
            <tbody className="bg-white dark:bg-navy-800 divide-y divide-slate-200 dark:divide-white/5">
              {loading ? (
                <TableRowSkeleton columns={columns.length} rows={loadingRows} />
              ) : paginatedData.length === 0 ? (
                <tr>
                  <td colSpan={columns.length}>
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
                  {paginatedData.map((row, index) => (
                    <motion.tr
                      key={getRowKey(row, index)}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      onClick={() => onRowClick?.(row, index)}
                      className={`
                        transition-colors
                        ${onRowClick ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-white/[0.02]' : ''}
                        ${striped && index % 2 === 1 ? 'bg-slate-50/50 dark:bg-white/[0.01]' : ''}
                      `}
                    >
                      {columns.map((column) => {
                        const value = row[column.key as keyof T];
                        return (
                          <td
                            key={String(column.key)}
                            className={`
                              ${paddingClasses}
                              ${alignmentClasses[column.cellAlign || 'left']}
                              text-sm text-navy-900 dark:text-white
                            `}
                          >
                            {column.render
                              ? column.render(value, row, index)
                              : String(value ?? '-')}
                          </td>
                        );
                      })}
                    </motion.tr>
                  ))}
                </AnimatePresence>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination && totalPages > 1 && !loading && (
          <div className="flex items-center justify-between mt-4 px-2">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Showing {(currentPage - 1) * pageSize + 1} to{' '}
              {Math.min(currentPage * pageSize, sortedData.length)} of {sortedData.length} results
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                icon={<ChevronLeft size={16} />}
              >
                Previous
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
                      className={`
                        w-8 h-8 text-sm rounded-lg transition-colors
                        ${
                          currentPage === pageNum
                            ? 'bg-navy-900 text-white dark:bg-white dark:text-navy-950'
                            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5'
                        }
                      `}
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
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  }
) as <T extends Record<string, unknown>>(
  props: DataTableProps<T> & { ref?: React.Ref<HTMLDivElement> }
) => React.ReactElement;

(DataTable as React.FC).displayName = 'DataTable';

export default DataTable;
