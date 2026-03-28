/**
 * StatusBar — footer bar showing record count, selection count, and
 * per-column aggregate summaries (sum/avg/min/max/count).
 * Positioned between the table grid and the TableTabStrip.
 */
import { ChevronDown } from 'lucide-react';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

type AggregateMode = 'none' | 'sum' | 'avg' | 'min' | 'max' | 'count';

export interface StatusBarProps {
  totalRecords: number;
  selectedCount: number;
  columns: { id: string; name: string; fieldType: string }[];
  records: Record<string, unknown>[];
  aggregateConfig: Record<string, AggregateMode>;
  onAggregateChange: (fieldId: string, mode: string) => void;
}

const NUMERIC_TYPES = new Set([
  'number',
  'currency',
  'percent',
  'rating',
  'duration',
  'count',
  'rollup',
  'autoNumber',
]);

const AGG_OPTIONS: { value: AggregateMode; labelEn: string; labelPl: string }[] = [
  { value: 'none', labelEn: 'None', labelPl: 'Brak' },
  { value: 'sum', labelEn: 'Sum', labelPl: 'Suma' },
  { value: 'avg', labelEn: 'Average', labelPl: 'Średnia' },
  { value: 'min', labelEn: 'Min', labelPl: 'Min' },
  { value: 'max', labelEn: 'Max', labelPl: 'Max' },
  { value: 'count', labelEn: 'Count', labelPl: 'Liczba' },
];

function computeAggregate(mode: AggregateMode, values: unknown[]): string {
  if (mode === 'none') return '';
  const nums = values.map((v) => Number(v)).filter((n) => Number.isFinite(n));
  if (mode === 'count') return String(nums.length);
  if (nums.length === 0) return '—';
  switch (mode) {
    case 'sum':
      return (Math.round(nums.reduce((a, b) => a + b, 0) * 100) / 100).toLocaleString();
    case 'avg':
      return (
        Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 100) / 100
      ).toLocaleString();
    case 'min':
      return String(Math.min(...nums));
    case 'max':
      return String(Math.max(...nums));
    default:
      return '';
  }
}

export const StatusBar: React.FC<StatusBarProps> = ({
  totalRecords,
  selectedCount,
  columns,
  records,
  aggregateConfig,
  onAggregateChange,
}) => {
  const { i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');

  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  const numericColumns = useMemo(
    () => columns.filter((c) => NUMERIC_TYPES.has(c.fieldType)),
    [columns]
  );

  const aggregates = useMemo(() => {
    const result: Record<string, string> = {};
    for (const col of numericColumns) {
      const mode = aggregateConfig[col.id] ?? 'none';
      if (mode === 'none') continue;
      const values = records.map((r) => r[col.id]);
      result[col.id] = computeAggregate(mode, values);
    }
    return result;
  }, [numericColumns, aggregateConfig, records]);

  const handleDropdownToggle = useCallback((fieldId: string) => {
    setOpenDropdown((prev) => (prev === fieldId ? null : fieldId));
  }, []);

  return (
    <div className="flex items-center h-7 bg-gray-50 dark:bg-navy-900/80 border-t border-slate-200/60 dark:border-navy-700/60 px-3 gap-4 text-xs text-slate-500 dark:text-slate-400 flex-shrink-0 overflow-x-auto">
      {/* Record count */}
      <span>
        {totalRecords} {isPl ? 'rekordów' : 'records'}
      </span>

      {/* Selection count */}
      {selectedCount > 0 && (
        <span className="text-blue-600 dark:text-blue-400 font-medium">
          {selectedCount} {isPl ? 'zaznaczonych' : 'selected'}
        </span>
      )}

      {/* Aggregate summaries */}
      {numericColumns.map((col) => {
        const mode = (aggregateConfig[col.id] ?? 'none') as AggregateMode;
        const value = aggregates[col.id];
        const isOpen = openDropdown === col.id;

        return (
          <div key={col.id} className="relative flex items-center gap-1">
            <button
              onClick={() => handleDropdownToggle(col.id)}
              className="flex items-center gap-0.5 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
            >
              <span className="text-slate-400 dark:text-slate-500">{col.name}:</span>
              {mode !== 'none' && value ? (
                <span className="font-mono font-medium text-slate-600 dark:text-slate-300">
                  {value}
                </span>
              ) : (
                <span className="text-slate-400">—</span>
              )}
              <ChevronDown size={10} className="text-slate-400" />
            </button>

            {isOpen && (
              <div
                className="absolute bottom-full mb-1 left-0 z-[100] bg-white dark:bg-navy-900 rounded-lg shadow-xl border border-slate-200 dark:border-navy-700 py-1 min-w-[120px]"
                onClick={(e) => e.stopPropagation()}
              >
                {AGG_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    className={`w-full px-3 py-1 text-xs text-left hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors ${
                      mode === opt.value
                        ? 'text-blue-600 dark:text-blue-400 font-medium'
                        : 'text-slate-600 dark:text-slate-300'
                    }`}
                    onClick={() => {
                      onAggregateChange(col.id, opt.value);
                      setOpenDropdown(null);
                    }}
                  >
                    {isPl ? opt.labelPl : opt.labelEn}
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
