/**
 * FilterableTable
 * Table with filterable column headers and row actions
 */

import {
  ChevronDown,
  Copy,
  Edit,
  Eye,
  FileText,
  Maximize2,
  MoreVertical,
  Trash2,
} from 'lucide-react';
import React, { useCallback, useMemo, useState } from 'react';

import { FilterChip } from './ActiveFilters';
import { ItemStatus } from './types';

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
  onRowClick?: (row: TableRow) => void;
  onRowAction?: (action: string, row: TableRow) => void;
  activeFilters: FilterChip[];
  onFilterChange: (filters: FilterChip[]) => void;
  emptyMessage?: string;
}

// Status badge component — supports all status families (assessment, report, initiative)
const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const config: Record<string, { bg: string; text: string; dot: string; label: string }> = {
    // Initiative / shared statuses
    DRAFT: { bg: 'bg-slate-500/20', text: 'text-slate-300', dot: 'bg-slate-400', label: 'Draft' },
    PENDING_REVIEW: {
      bg: 'bg-orange-500/20',
      text: 'text-orange-300',
      dot: 'bg-orange-400',
      label: 'Pending Review',
    },
    REVIEW: {
      bg: 'bg-amber-500/20',
      text: 'text-amber-300',
      dot: 'bg-amber-400',
      label: 'In Review',
    },
    PROMOTED: {
      bg: 'bg-blue-500/20',
      text: 'text-blue-300',
      dot: 'bg-blue-400',
      label: 'Promoted',
    },
    PLANNING: {
      bg: 'bg-indigo-500/20',
      text: 'text-indigo-300',
      dot: 'bg-indigo-400',
      label: 'Planning',
    },
    APPROVED: {
      bg: 'bg-emerald-500/20',
      text: 'text-emerald-300',
      dot: 'bg-emerald-400',
      label: 'Approved',
    },
    SCHEDULED: {
      bg: 'bg-purple-500/20',
      text: 'text-purple-300',
      dot: 'bg-purple-400',
      label: 'Scheduled',
    },
    EXECUTING: {
      bg: 'bg-cyan-500/20',
      text: 'text-cyan-300',
      dot: 'bg-cyan-400',
      label: 'Executing',
    },
    BLOCKED: { bg: 'bg-red-500/20', text: 'text-red-300', dot: 'bg-red-400', label: 'Blocked' },
    DONE: { bg: 'bg-green-500/20', text: 'text-green-300', dot: 'bg-green-400', label: 'Done' },
    TRACKING: {
      bg: 'bg-teal-500/20',
      text: 'text-teal-300',
      dot: 'bg-teal-400',
      label: 'Tracking',
    },
    CANCELLED: {
      bg: 'bg-gray-500/20',
      text: 'text-gray-300',
      dot: 'bg-gray-400',
      label: 'Cancelled',
    },
    ARCHIVED: {
      bg: 'bg-slate-500/20',
      text: 'text-slate-300',
      dot: 'bg-slate-500',
      label: 'Archived',
    },
    // Assessment-specific statuses
    IN_REVIEW: {
      bg: 'bg-amber-500/20',
      text: 'text-amber-300',
      dot: 'bg-amber-400',
      label: 'In Review',
    },
    AWAITING_APPROVAL: {
      bg: 'bg-orange-500/20',
      text: 'text-orange-300',
      dot: 'bg-orange-400',
      label: 'Awaiting Approval',
    },
    REJECTED: {
      bg: 'bg-red-500/20',
      text: 'text-red-300',
      dot: 'bg-red-400',
      label: 'Rejected',
    },
    // Report-specific statuses
    GENERATING: {
      bg: 'bg-blue-500/20',
      text: 'text-blue-300',
      dot: 'bg-blue-400',
      label: 'Generating',
    },
    FINAL: {
      bg: 'bg-indigo-500/20',
      text: 'text-indigo-300',
      dot: 'bg-indigo-400',
      label: 'Final',
    },
    PENDING_APPROVAL: {
      bg: 'bg-orange-500/20',
      text: 'text-orange-300',
      dot: 'bg-orange-400',
      label: 'Pending Approval',
    },
    UTILIZED: {
      bg: 'bg-teal-500/20',
      text: 'text-teal-300',
      dot: 'bg-teal-400',
      label: 'Utilized',
    },
  };

  const { bg, text, dot, label } = config[status] || config.DRAFT;

  return (
    <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full ${bg}`}>
      <span className={`w-2 h-2 rounded-full ${dot}`} />
      <span className={`text-xs font-medium ${text}`}>{label}</span>
    </div>
  );
};

// Progress bar component
const ProgressBar: React.FC<{ progress: number }> = ({ progress }) => (
  <div className="flex items-center gap-2">
    <div className="flex-1 h-1.5 bg-navy-700 rounded-full overflow-hidden">
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
    <span className="text-xs text-slate-400 w-8">{progress}%</span>
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
        className={`p-1 rounded hover:bg-navy-600 transition-colors ${
          activeValues.length > 0 ? 'text-primary-400' : 'text-slate-500'
        }`}
      >
        <ChevronDown size={14} />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute top-full left-0 mt-1 z-50 min-w-[180px] bg-navy-800 border border-navy-600 rounded-lg shadow-xl overflow-hidden">
            <div className="max-h-[200px] overflow-y-auto p-2">
              {column.filterOptions.map((option) => (
                <label
                  key={option.value}
                  className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-navy-700 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(option.value)}
                    onChange={() => handleToggle(option.value)}
                    className="rounded border-navy-600 bg-navy-700 text-primary-500 focus:ring-primary-500"
                  />
                  {option.color && <span className={`w-2 h-2 rounded-full ${option.color}`} />}
                  <span className="text-sm text-slate-300">{option.label}</span>
                </label>
              ))}
            </div>
            <div className="flex items-center justify-between p-2 border-t border-navy-600">
              <button
                onClick={handleClear}
                className="text-xs text-slate-400 hover:text-white transition-colors"
              >
                Clear
              </button>
              <button
                onClick={handleApply}
                className="px-3 py-1 text-xs font-medium bg-primary-500 text-white rounded hover:bg-primary-400 transition-colors"
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
  onRowClick,
  onRowAction,
  activeFilters,
  onFilterChange,
  emptyMessage = 'No items found',
}) => {
  const [actionMenuRow, setActionMenuRow] = useState<string | null>(null);

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

    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return d.toLocaleDateString();
  };

  return (
    <div className="p-4">
      <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-50 dark:bg-navy-900/50">
              {columns.map((column) => (
                <th
                  key={column.id}
                  className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider"
                  style={{ width: column.width }}
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
                </th>
              ))}
              <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider w-20">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-navy-700/50">
            {filteredData.length === 0 ? (
              <tr>
                <td colSpan={columns.length + 1} className="px-4 py-12 text-center text-slate-500">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              filteredData.map((row) => (
                <tr
                  key={row.id}
                  onClick={() => onRowClick?.(row)}
                  className="group hover:bg-navy-800/50 cursor-pointer transition-colors"
                >
                  {columns.map((column) => (
                    <td key={column.id} className="px-4 py-3">
                      {column.render ? (
                        column.render(row)
                      ) : column.id === 'status' ? (
                        <StatusBadge status={row.status} />
                      ) : column.id === 'progress' ? (
                        <ProgressBar progress={row.progress} />
                      ) : column.id === 'updatedAt' ? (
                        <span className="text-sm text-slate-400">
                          {formatRelativeTime(row.updatedAt)}
                        </span>
                      ) : (
                        <span className="text-sm text-slate-300">{row[column.id]}</span>
                      )}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-right">
                    <div className="relative">
                      <div className="flex items-center justify-end gap-1 opacity-100 transition-opacity">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onRowAction?.('preview', row);
                          }}
                          className="p-1.5 rounded hover:bg-navy-700 text-slate-400 hover:text-blue-400 transition-colors"
                          title="Quick preview"
                        >
                          <Eye size={14} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onRowAction?.('edit', row);
                          }}
                          className="p-1.5 rounded hover:bg-navy-700 text-slate-400 hover:text-white transition-colors"
                          title="Open"
                        >
                          <Maximize2 size={14} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setActionMenuRow(actionMenuRow === row.id ? null : row.id);
                          }}
                          className="p-1.5 rounded hover:bg-navy-700 text-slate-400 hover:text-white transition-colors"
                        >
                          <MoreVertical size={14} />
                        </button>
                      </div>

                      {/* Action Menu — Open / Duplicate / Edit / Delete */}
                      {actionMenuRow === row.id && (
                        <>
                          <div
                            className="fixed inset-0 z-40"
                            onClick={() => setActionMenuRow(null)}
                          />
                          <div className="absolute right-0 top-full mt-1 z-50 w-44 bg-navy-800 border border-navy-600 rounded-lg shadow-xl overflow-hidden">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onRowAction?.('edit', row);
                                setActionMenuRow(null);
                              }}
                              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-slate-300 hover:bg-navy-700 transition-colors"
                            >
                              <Maximize2 size={14} />
                              <span>Open</span>
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onRowAction?.('duplicate', row);
                                setActionMenuRow(null);
                              }}
                              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-slate-300 hover:bg-navy-700 transition-colors"
                            >
                              <Copy size={14} />
                              <span>Duplicate</span>
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onRowAction?.('rename', row);
                                setActionMenuRow(null);
                              }}
                              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-slate-300 hover:bg-navy-700 transition-colors"
                            >
                              <Edit size={14} />
                              <span>Edit</span>
                            </button>
                            <div className="border-t border-navy-600" />
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onRowAction?.('delete', row);
                                setActionMenuRow(null);
                              }}
                              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-rose-400 hover:bg-navy-700 transition-colors"
                            >
                              <Trash2 size={14} />
                              <span>Delete</span>
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default FilterableTable;
