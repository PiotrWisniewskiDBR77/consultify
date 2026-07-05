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
    <div className="flex items-center h-7 bg-c-surface-raised border-t border-c-border-subtle px-3 gap-4 text-xs text-c-text-muted flex-shrink-0 overflow-x-auto">
      {/* Record count */}
      <span>
        {totalRecords} {isPl ? 'rekordów' : 'records'}
      </span>

      {/* Selection count */}
      {selectedCount > 0 && (
        <span className="text-c-info font-medium">
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
              className="flex items-center gap-0.5 hover:text-c-text-secondary transition-colors"
            >
              <span className="text-c-text-muted">{col.name}:</span>
              {mode !== 'none' && value ? (
                <span className="font-mono font-medium text-c-text-secondary">
                  {value}
                </span>
              ) : (
                <span className="text-c-text-muted">—</span>
              )}
              <ChevronDown size={10} className="text-c-text-muted" />
            </button>

            {isOpen && (
              <div
                className="absolute bottom-full mb-1 left-0 z-[100] bg-c-surface rounded-lg shadow-xl border border-c-border py-1 min-w-[120px]"
                onClick={(e) => e.stopPropagation()}
              >
                {AGG_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    className={`w-full px-3 py-1 text-xs text-left hover:bg-c-surface-raised transition-colors ${
                      mode === opt.value
                        ? 'text-c-info font-medium'
                        : 'text-c-text-secondary'
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
