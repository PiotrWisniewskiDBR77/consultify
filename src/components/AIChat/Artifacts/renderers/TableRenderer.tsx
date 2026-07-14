/**
 * TableRenderer - Interactive table display with sorting, filtering, export
 */

import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Check,
  Copy,
  Download,
  Search,
  Table as TableIcon,
} from 'lucide-react';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface TableRendererProps {
  content: string; // CSV or JSON string
  className?: string;
}

interface TableData {
  headers: string[];
  rows: string[][];
}

type SortDirection = 'asc' | 'desc' | null;

// Parse CSV or JSON content into table data
const parseContent = (content: string): TableData => {
  try {
    // Try JSON first
    const json = JSON.parse(content);
    if (Array.isArray(json) && json.length > 0) {
      const headers = Object.keys(json[0]);
      const rows = json.map((item) => headers.map((h) => String(item[h] ?? '')));
      return { headers, rows };
    }
  } catch {
    // Not JSON, try CSV
  }

  // Parse as CSV
  const lines = content.trim().split('\n');
  if (lines.length === 0) return { headers: [], rows: [] };

  const headers = lines[0].split(',').map((h) => h.trim().replace(/^["']|["']$/g, ''));
  const rows = lines.slice(1).map((line) => {
    // Simple CSV parsing (doesn't handle quoted commas)
    return line.split(',').map((cell) => cell.trim().replace(/^["']|["']$/g, ''));
  });

  return { headers, rows };
};

export const TableRenderer: React.FC<TableRendererProps> = ({ content, className = '' }) => {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [sortColumn, setSortColumn] = useState<number | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);
  const [copied, setCopied] = useState(false);

  const tableData = useMemo(() => parseContent(content), [content]);

  // Filter rows based on search
  const filteredRows = useMemo(() => {
    if (!searchQuery.trim()) return tableData.rows;

    const query = searchQuery.toLowerCase();
    return tableData.rows.filter((row) => row.some((cell) => cell.toLowerCase().includes(query)));
  }, [tableData.rows, searchQuery]);

  // Sort rows
  const sortedRows = useMemo(() => {
    if (sortColumn === null || sortDirection === null) return filteredRows;

    return [...filteredRows].sort((a, b) => {
      const aVal = a[sortColumn] || '';
      const bVal = b[sortColumn] || '';

      // Try numeric comparison
      const aNum = parseFloat(aVal);
      const bNum = parseFloat(bVal);

      if (!isNaN(aNum) && !isNaN(bNum)) {
        return sortDirection === 'asc' ? aNum - bNum : bNum - aNum;
      }

      // String comparison
      const comparison = aVal.localeCompare(bVal);
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [filteredRows, sortColumn, sortDirection]);

  const handleSort = useCallback(
    (columnIndex: number) => {
      if (sortColumn === columnIndex) {
        if (sortDirection === 'asc') {
          setSortDirection('desc');
        } else if (sortDirection === 'desc') {
          setSortColumn(null);
          setSortDirection(null);
        }
      } else {
        setSortColumn(columnIndex);
        setSortDirection('asc');
      }
    },
    [sortColumn, sortDirection]
  );

  const handleCopy = useCallback(async () => {
    try {
      // Convert to TSV for pasting into spreadsheets
      const tsv = [tableData.headers.join('\t'), ...sortedRows.map((row) => row.join('\t'))].join(
        '\n'
      );

      await navigator.clipboard.writeText(tsv);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }, [tableData.headers, sortedRows]);

  const handleExportCSV = useCallback(() => {
    const csv = [
      tableData.headers.map((h) => `"${h.replace(/"/g, '""')}"`).join(','),
      ...sortedRows.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `table-${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }, [tableData.headers, sortedRows]);

  const getSortIcon = (columnIndex: number) => {
    if (sortColumn !== columnIndex) {
      return <ArrowUpDown size={14} className="text-slate-600 dark:text-slate-500" />;
    }
    return sortDirection === 'asc' ? (
      <ArrowUp size={14} className="text-brand" />
    ) : (
      <ArrowDown size={14} className="text-brand" />
    );
  };

  if (tableData.headers.length === 0) {
    return (
      <div className="flex items-center justify-center h-full p-8 text-center text-slate-500 dark:text-slate-400">
        <div className="flex flex-col items-center gap-2">
          <TableIcon size={32} />
          <p>{t('table.noData', 'No table data found')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-full bg-white dark:bg-navy-900 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-800/50 gap-4">
        {/* Search */}
        <div className="relative flex-1 max-w-xs">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 dark:text-slate-500"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('table.search', 'Search...')}
            className="w-full pl-9 pr-3 py-1.5 text-sm bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-md focus:outline-none focus:ring-2 focus:ring-brand/50"
          />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-2 py-1.5 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-700 rounded"
          >
            {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
            {copied ? t('table.copied', 'Copied!') : t('table.copy', 'Copy')}
          </button>
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-2 py-1.5 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-700 rounded"
          >
            <Download size={14} />
            {t('table.export', 'Export CSV')}
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table
          /* §27-exempt: renderer artefaktu AI/markdown read-only, poza zakresem 1.2 */ className="min-w-full divide-y divide-slate-200 dark:divide-navy-700"
        >
          <thead className="bg-slate-50 dark:bg-navy-800 sticky top-0 z-10">
            <tr>
              {tableData.headers.map((header, index) => (
                <th
                  key={index}
                  onClick={() => handleSort(index)}
                  className="px-4 py-3 text-left text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider cursor-pointer hover:bg-slate-100 dark:hover:bg-navy-700 transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    {header}
                    {getSortIcon(index)}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-navy-700">
            {sortedRows.length === 0 ? (
              <tr>
                <td
                  colSpan={tableData.headers.length}
                  className="px-4 py-8 text-center text-slate-500 dark:text-slate-400"
                >
                  {searchQuery
                    ? t('table.noResults', 'No matching results')
                    : t('table.empty', 'Table is empty')}
                </td>
              </tr>
            ) : (
              sortedRows.map((row, rowIndex) => (
                <tr
                  key={rowIndex}
                  className="hover:bg-slate-50 dark:hover:bg-navy-800/50 transition-colors"
                >
                  {row.map((cell, cellIndex) => (
                    <td
                      key={cellIndex}
                      className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300 whitespace-nowrap"
                    >
                      {cell || <span className="text-slate-600 dark:text-slate-500 italic">—</span>}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-2 border-t border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-800/50 text-xs text-slate-500 dark:text-slate-400">
        <span>
          {sortedRows.length}{' '}
          {sortedRows.length === 1 ? t('table.row', 'row') : t('table.rows', 'rows')}
          {searchQuery && ` (${t('table.filtered', 'filtered from')} ${tableData.rows.length})`}
        </span>
        <span>
          {tableData.headers.length}{' '}
          {tableData.headers.length === 1
            ? t('table.column', 'column')
            : t('table.columns', 'columns')}
        </span>
      </div>
    </div>
  );
};

export default TableRenderer;
