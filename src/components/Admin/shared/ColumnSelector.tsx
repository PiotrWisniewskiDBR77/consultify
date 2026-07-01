/**
 * ColumnSelector - Edit columns functionality for tables
 *
 * Features:
 * - Show/hide columns
 * - Drag and drop reordering
 * - Column width configuration
 * - Reset to default
 *
 * Design: Dropdown with checkboxes and drag handles
 */

import {
  Check,
  ChevronDown,
  ChevronUp,
  Columns,
  Eye,
  EyeOff,
  GripVertical,
  RefreshCw,
  Search,
  Settings,
  X,
} from 'lucide-react';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '../../../utils/cn';
import { Button } from '../../ui/primitives/Button';
import { Tooltip } from '../../ui/primitives/Tooltip';

// Column configuration
export interface ColumnConfig {
  id: string;
  label: string;
  visible: boolean;
  order: number;
  width?: number;
  minWidth?: number;
  maxWidth?: number;
  fixed?: 'left' | 'right';
  required?: boolean;
}

interface ColumnSelectorProps {
  columns: ColumnConfig[];
  onChange: (columns: ColumnConfig[]) => void;
  onReset?: () => void;
  trigger?: React.ReactNode;
  className?: string;
}

export const ColumnSelector: React.FC<ColumnSelectorProps> = ({
  columns,
  onChange,
  onReset,
  trigger,
  className,
}) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  // Sorted columns
  const sortedColumns = useMemo(() => {
    return [...columns].sort((a, b) => a.order - b.order);
  }, [columns]);

  // Filtered columns
  const filteredColumns = useMemo(() => {
    if (!searchQuery.trim()) return sortedColumns;
    const query = searchQuery.toLowerCase();
    return sortedColumns.filter((col) => col.label.toLowerCase().includes(query));
  }, [sortedColumns, searchQuery]);

  // Visible count
  const visibleCount = useMemo(() => {
    return columns.filter((c) => c.visible).length;
  }, [columns]);

  // Toggle column visibility
  const toggleColumn = useCallback(
    (columnId: string) => {
      onChange(
        columns.map((col) =>
          col.id === columnId && !col.required ? { ...col, visible: !col.visible } : col
        )
      );
    },
    [columns, onChange]
  );

  // Move column
  const moveColumn = useCallback(
    (columnId: string, direction: 'up' | 'down') => {
      const sorted = [...columns].sort((a, b) => a.order - b.order);
      const index = sorted.findIndex((c) => c.id === columnId);
      if (index === -1) return;

      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= sorted.length) return;

      const targetColumn = sorted[targetIndex];
      const currentColumn = sorted[index];

      onChange(
        columns.map((col) => {
          if (col.id === columnId) return { ...col, order: targetColumn.order };
          if (col.id === targetColumn.id) return { ...col, order: currentColumn.order };
          return col;
        })
      );
    },
    [columns, onChange]
  );

  // Show all
  const showAll = useCallback(() => {
    onChange(columns.map((col) => ({ ...col, visible: true })));
  }, [columns, onChange]);

  // Hide optional
  const hideOptional = useCallback(() => {
    onChange(columns.map((col) => ({ ...col, visible: col.required || false })));
  }, [columns, onChange]);

  return (
    <div className={cn('relative', className)}>
      {/* Trigger */}
      {trigger ? (
        <div onClick={() => setIsOpen(!isOpen)}>{trigger}</div>
      ) : (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsOpen(!isOpen)}
          icon={<Columns size={16} />}
        >
          {t('admin.table.columns', 'Columns')}
          <span className="ml-1 px-1.5 py-0.5 text-xs bg-slate-100 dark:bg-navy-700 rounded">
            {visibleCount}/{columns.length}
          </span>
        </Button>
      )}

      {/* Dropdown */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />

          {/* Panel */}
          <div className="absolute right-0 top-full mt-2 w-80 bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl shadow-lg z-50">
            {/* Header */}
            <div className="flex items-center justify-between p-3 border-b border-slate-200 dark:border-navy-700">
              <span className="font-medium text-navy-900 dark:text-white">
                {t('admin.table.editColumns', 'Edit Columns')}
              </span>
              <button
                onClick={() => setIsOpen(false)}
                className="text-slate-600 hover:text-slate-600 dark:text-slate-400"
              >
                <X size={16} />
              </button>
            </div>

            {/* Search */}
            <div className="p-2 border-b border-slate-200 dark:border-navy-700">
              <div className="relative">
                <Search
                  size={14}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-600 dark:text-slate-500"
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('admin.table.searchColumns', 'Search columns...')}
                  className="w-full pl-8 pr-3 py-1.5 text-sm bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg"
                />
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-2 p-2 border-b border-slate-200 dark:border-navy-700">
              <button
                onClick={showAll}
                className="flex-1 px-2 py-1.5 text-xs font-medium text-c-text-secondary hover:bg-c-surface-raised rounded"
              >
                {t('admin.table.showAll', 'Show All')}
              </button>
              <button
                onClick={hideOptional}
                className="flex-1 px-2 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-navy-700 rounded"
              >
                {t('admin.table.hideOptional', 'Required Only')}
              </button>
              {onReset && (
                <Tooltip content={t('admin.table.resetColumns', 'Reset to default')}>
                  <button
                    onClick={onReset}
                    className="p-1.5 text-slate-600 hover:text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-navy-700 rounded"
                  >
                    <RefreshCw size={14} />
                  </button>
                </Tooltip>
              )}
            </div>

            {/* Column List */}
            <div className="max-h-64 overflow-y-auto p-2">
              <div className="space-y-1">
                {filteredColumns.map((column, index) => (
                  <div
                    key={column.id}
                    className={cn(
                      'flex items-center gap-2 p-2 rounded-lg transition-colors',
                      column.visible ? 'bg-slate-50 dark:bg-navy-900' : 'opacity-60'
                    )}
                  >
                    {/* Drag Handle */}
                    <div className="cursor-grab text-slate-600 hover:text-slate-600 dark:text-slate-400">
                      <GripVertical size={14} />
                    </div>

                    {/* Move Buttons */}
                    <div className="flex flex-col gap-0.5">
                      <button
                        onClick={() => moveColumn(column.id, 'up')}
                        disabled={index === 0}
                        className="text-slate-600 hover:text-slate-600 dark:text-slate-400 disabled:opacity-30"
                      >
                        <ChevronUp size={10} />
                      </button>
                      <button
                        onClick={() => moveColumn(column.id, 'down')}
                        disabled={index === filteredColumns.length - 1}
                        className="text-slate-600 hover:text-slate-600 dark:text-slate-400 disabled:opacity-30"
                      >
                        <ChevronDown size={10} />
                      </button>
                    </div>

                    {/* Toggle */}
                    <button
                      onClick={() => toggleColumn(column.id)}
                      disabled={column.required}
                      className={cn(
                        'p-1 rounded',
                        column.visible
                          ? 'text-c-text-secondary bg-c-surface-raised'
                          : 'text-slate-400 dark:text-slate-500',
                        column.required && 'opacity-50 cursor-not-allowed'
                      )}
                    >
                      {column.visible ? <Eye size={14} /> : <EyeOff size={14} />}
                    </button>

                    {/* Label */}
                    <span
                      className={cn(
                        'flex-1 text-sm truncate',
                        column.visible ? 'text-navy-900 dark:text-white' : 'text-slate-500'
                      )}
                    >
                      {column.label}
                    </span>

                    {/* Badges */}
                    {column.required && (
                      <span className="px-1 py-0.5 text-xs bg-slate-200 dark:bg-navy-700 text-slate-500 dark:text-slate-400 rounded">
                        {t('admin.table.required', 'Required')}
                      </span>
                    )}
                    {column.fixed && (
                      <span className="px-1 py-0.5 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded">
                        {column.fixed}
                      </span>
                    )}
                  </div>
                ))}
              </div>

              {filteredColumns.length === 0 && (
                <p className="text-center py-4 text-sm text-slate-500 dark:text-slate-400">
                  {t('admin.table.noColumnsFound', 'No columns match your search')}
                </p>
              )}
            </div>

            {/* Footer */}
            <div className="p-3 border-t border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-900 rounded-b-xl">
              <p className="text-xs text-slate-500 dark:text-slate-400 text-center">
                {t('admin.table.columnsTip', 'Drag to reorder, click eye to toggle visibility')}
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ColumnSelector;
