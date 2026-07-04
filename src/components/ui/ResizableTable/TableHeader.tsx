/**
 * TableHeader - Header row with resizable columns and filters
 * ClickUp-style table header
 */

import { CheckSquare, Minus, Square } from 'lucide-react';
import React, { useState } from 'react';

import { ColumnResizer } from './ColumnResizer';
import { FilterDropdown } from './FilterDropdown';
import type { ColumnDef, ColumnWidths, DateRange, TableFilters } from './types';

interface TableHeaderProps {
  columns: ColumnDef[];
  columnWidths: ColumnWidths;
  onColumnResize: (columnId: string, width: number) => void;
  filters: TableFilters;
  onFilterChange: (columnId: string, value: string[] | DateRange) => void;
  showSelectColumn?: boolean;
  onSelectAll?: (selected: boolean) => void;
  allSelected?: boolean;
  someSelected?: boolean;
}

export const TableHeader: React.FC<TableHeaderProps> = ({
  columns,
  columnWidths,
  onColumnResize,
  filters,
  onFilterChange,
  showSelectColumn = true,
  onSelectAll,
  allSelected = false,
  someSelected = false,
}) => {
  const [openFilterId, setOpenFilterId] = useState<string | null>(null);

  const handleFilterToggle = (columnId: string) => {
    setOpenFilterId(openFilterId === columnId ? null : columnId);
  };

  return (
    <thead>
      <tr className="border-b border-slate-200 dark:border-c-border-subtle bg-slate-50 dark:bg-c-bg/90 sticky top-0 z-20">
        {/* Select All Checkbox */}
        {showSelectColumn && (
          <th className="w-10 px-2 py-2">
            <button
              onClick={() => onSelectAll?.(!allSelected)}
              className={`
                w-5 h-5 rounded border flex items-center justify-center transition-colors
                ${
                  allSelected
                    ? 'bg-navy-900 border-navy-900 text-white dark:bg-white dark:border-white dark:text-navy-950'
                    : someSelected
                      ? 'bg-navy-900/50 border-navy-900/60 text-white dark:bg-white/50 dark:border-c-border-strong'
                      : 'border-slate-300 dark:border-navy-500 hover:border-slate-400 text-transparent hover:text-slate-400'
                }
              `}
            >
              {allSelected ? (
                <CheckSquare size={14} />
              ) : someSelected ? (
                <Minus size={14} />
              ) : (
                <Square size={14} />
              )}
            </button>
          </th>
        )}

        {/* Dynamic Columns */}
        {columns.map((column, index) => {
          const width = columnWidths[column.id] || column.width;
          const isLast = index === columns.length - 1;
          const filterValue = filters[column.id];
          const hasActiveFilter = Array.isArray(filterValue)
            ? filterValue.length > 0
            : !!filterValue;

          return (
            <th
              key={column.id}
              className={`
                relative group/header px-3 py-2
                text-left text-xs font-medium text-slate-500 uppercase tracking-wider
                ${column.align === 'center' ? 'text-center' : ''}
                ${column.align === 'right' ? 'text-right' : ''}
              `}
              style={{
                width: column.id === 'title' ? 'auto' : `${width}px`,
                minWidth: `${column.minWidth}px`,
                maxWidth: column.maxWidth ? `${column.maxWidth}px` : undefined,
              }}
            >
              <div className="flex items-center gap-1">
                <span className={hasActiveFilter ? 'text-primary-500' : ''}>{column.label}</span>

                {/* Filter Dropdown */}
                {column.filterable && column.filterOptions && (
                  <FilterDropdown
                    column={column}
                    value={filterValue}
                    onChange={(value) => onFilterChange(column.id, value)}
                    isOpen={openFilterId === column.id}
                    onToggle={() => handleFilterToggle(column.id)}
                    onClose={() => setOpenFilterId(null)}
                  />
                )}
              </div>

              {/* Column Resizer */}
              {column.resizable && !isLast && (
                <ColumnResizer
                  columnId={column.id}
                  currentWidth={width}
                  minWidth={column.minWidth}
                  maxWidth={column.maxWidth}
                  onResize={onColumnResize}
                />
              )}
            </th>
          );
        })}
      </tr>
    </thead>
  );
};

export default TableHeader;
