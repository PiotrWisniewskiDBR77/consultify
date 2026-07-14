/**
 * InlineTable
 *
 * N-mode building block for small inline tables (options, KPIs, comparisons).
 * Lightweight alternative to full data tables — no sorting, no pagination.
 *
 * Follows DBR77 Visual Language — quiet UI, minimal chrome.
 *
 * @see docs/ui-standards/01-shell-layout/presentation-modes.md §2.5.5
 */

import React from 'react';

// ── Types ───────────────────────────────────────────────────────────────────

export interface InlineTableColumn<T = Record<string, unknown>> {
  /** Unique key for the column */
  key: string;
  /** Header label */
  header: string;
  /** Width class (e.g. 'w-1/3', 'w-40') — optional */
  width?: string;
  /** Alignment */
  align?: 'left' | 'center' | 'right';
  /** Cell renderer */
  render: (row: T, index: number) => React.ReactNode;
}

export interface InlineTableProps<T = Record<string, unknown>> {
  /** Column definitions */
  columns: InlineTableColumn<T>[];
  /** Row data */
  data: T[];
  /** Unique key extractor for each row */
  rowKey: (row: T, index: number) => string;
  /** Empty state message */
  emptyMessage?: string;
  /** Optional caption above table */
  caption?: string;
  /** Compact mode — less padding */
  compact?: boolean;
  /** Striped rows */
  striped?: boolean;
  /** Additional CSS classes */
  className?: string;
}

// ── Component ───────────────────────────────────────────────────────────────

export const InlineTable = <T extends Record<string, unknown>>({
  columns,
  data,
  rowKey,
  emptyMessage = 'No data.',
  caption,
  compact = false,
  striped = false,
  className = '',
}: InlineTableProps<T>): React.ReactElement => {
  const cellPadding = compact ? 'px-2 py-1.5' : 'px-3 py-2.5';
  const headerPadding = compact ? 'px-2 py-1.5' : 'px-3 py-2';

  const getAlignment = (align?: 'left' | 'center' | 'right') => {
    if (align === 'center') return 'text-center';
    if (align === 'right') return 'text-right';
    return 'text-left';
  };

  return (
    <div
      className={`rounded-xl border border-slate-200/50 dark:border-navy-700/50 overflow-hidden ${className}`}
    >
      {caption && (
        <div className="px-3 py-2 text-[11px] uppercase tracking-wide text-slate-600 dark:text-slate-500 bg-slate-50/50 dark:bg-navy-900/30 border-b border-slate-200/50 dark:border-navy-700/50">
          {caption}
        </div>
      )}
      <table
        /* §27-exempt: macierz/komorki kalkulacyjne, osobny spec matrix-editor */ className="w-full"
      >
        <thead>
          <tr className="border-b border-slate-200/50 dark:border-navy-700/50 bg-slate-50/30 dark:bg-navy-900/20">
            {columns.map((col) => (
              <th
                key={col.key}
                className={`${headerPadding} text-[10px] uppercase tracking-wide font-semibold text-slate-600 dark:text-slate-500 ${getAlignment(col.align)} ${col.width || ''}`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-3 py-6 text-center text-xs text-slate-600 dark:text-slate-500"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((row, idx) => (
              <tr
                key={rowKey(row, idx)}
                className={`border-b border-slate-200/30 dark:border-navy-700/30 last:border-b-0 transition-colors hover:bg-slate-50/50 dark:hover:bg-navy-800/30 ${
                  striped && idx % 2 === 1 ? 'bg-slate-50/20 dark:bg-navy-900/20' : ''
                }`}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`${cellPadding} text-sm text-slate-600 dark:text-slate-300 ${getAlignment(col.align)} ${col.width || ''}`}
                  >
                    {col.render(row, idx)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};

export default InlineTable;
