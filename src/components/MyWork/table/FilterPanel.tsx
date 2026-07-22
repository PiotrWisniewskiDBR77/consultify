/**
 * FilterPanel — Advanced multi-filter builder for the Idea Table.
 * Supports AND/OR logic with multiple filter rules.
 */
import { Plus, Trash2, X } from 'lucide-react';
import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import type { ColumnDef, FilterGroup, FilterOperator, FilterRule } from './tableTypes';

interface FilterPanelProps {
  open: boolean;
  onClose: () => void;
  filters: FilterGroup;
  onChange: (filters: FilterGroup) => void;
  columns: ColumnDef[];
}

const OPERATORS: { value: FilterOperator; labelEn: string; labelPl: string }[] = [
  { value: 'contains', labelEn: 'Contains', labelPl: 'Zawiera' },
  { value: 'equals', labelEn: 'Equals', labelPl: 'Równa się' },
  { value: 'not_empty', labelEn: 'Not empty', labelPl: 'Niepuste' },
  { value: 'is_empty', labelEn: 'Is empty', labelPl: 'Puste' },
  { value: 'gt', labelEn: 'Greater than', labelPl: 'Większe niż' },
  { value: 'lt', labelEn: 'Less than', labelPl: 'Mniejsze niż' },
];

export const FilterPanel: React.FC<FilterPanelProps> = ({
  open,
  onClose,
  filters,
  onChange,
  columns,
}) => {
  const { t } = useTranslation();

  const addRule = useCallback(() => {
    const firstCol = columns[0]?.key || 'label';
    const rule: FilterRule = {
      id: `fr-${Date.now()}`,
      column: firstCol,
      operator: 'contains',
      value: '',
    };
    onChange({ ...filters, rules: [...filters.rules, rule] });
  }, [columns, filters, onChange]);

  const updateRule = useCallback(
    (id: string, updates: Partial<FilterRule>) => {
      onChange({
        ...filters,
        rules: filters.rules.map((r) => (r.id === id ? { ...r, ...updates } : r)),
      });
    },
    [filters, onChange]
  );

  const removeRule = useCallback(
    (id: string) => {
      onChange({ ...filters, rules: filters.rules.filter((r) => r.id !== id) });
    },
    [filters, onChange]
  );

  const toggleLogic = useCallback(() => {
    onChange({ ...filters, logic: filters.logic === 'and' ? 'or' : 'and' });
  }, [filters, onChange]);

  const clearAll = useCallback(() => {
    onChange({ logic: 'and', rules: [] });
  }, [onChange]);

  if (!open) return null;

  const needsValue = (op: FilterOperator) => op !== 'not_empty' && op !== 'is_empty';

  return (
    <div className="absolute left-0 top-full mt-1 z-overlay w-[400px] rounded-2xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface shadow-2xl">
      <div className="flex items-center justify-between px-4 py-3 border-b border-c-border-subtle">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-c-text">
            {t('ideas.table.filterPanel.title', 'Filters')}
          </span>
          {filters.rules.length > 1 && (
            <button
              onClick={toggleLogic}
              className="px-2 py-0.5 rounded-md text-[9px] font-bold bg-c-surface-raised text-c-text"
            >
              {filters.logic.toUpperCase()}
            </button>
          )}
        </div>
        <div className="flex items-center gap-1">
          {filters.rules.length > 0 && (
            <button
              onClick={clearAll}
              className="text-[10px] text-c-text-secondary hover:text-danger-500 transition-colors px-1"
            >
              {t('ideas.table.clear', 'Clear')}
            </button>
          )}
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-c-surface-raised">
            <X size={14} className="text-c-text-secondary" />
          </button>
        </div>
      </div>

      <div className="px-4 py-3 space-y-2 max-h-[300px] overflow-auto">
        {filters.rules.length === 0 && (
          <p className="text-[11px] text-c-text-secondary text-center py-4">
            {t('ideas.table.filterPanel.noFilters', 'No filters. Add one.')}
          </p>
        )}
        {filters.rules.map((rule, idx) => (
          <div key={rule.id} className="flex items-center gap-1.5">
            {idx > 0 && (
              <span className="text-[9px] font-bold text-c-text-secondary w-6 text-center flex-shrink-0">
                {filters.logic === 'and'
                  ? t('ideas.table.filterPanel.and', 'AND')
                  : t('ideas.table.filterPanel.or', 'OR')}
              </span>
            )}
            {idx === 0 && <span className="w-6 flex-shrink-0" />}
            <select
              value={rule.column}
              onChange={(e) => updateRule(rule.id, { column: e.target.value })}
              className="flex-1 rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface px-2 py-1.5 text-[11px] text-c-text outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
            >
              {columns.map((col) => (
                <option key={col.key} value={col.key}>
                  {col.header}
                </option>
              ))}
            </select>
            <select
              value={rule.operator}
              onChange={(e) => updateRule(rule.id, { operator: e.target.value as FilterOperator })}
              className="w-28 rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface px-2 py-1.5 text-[11px] text-c-text outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
            >
              {OPERATORS.map((op) => (
                <option key={op.value} value={op.value}>
                  {t(`ideas.table.filterOperator.${op.value}`, op.labelEn)}
                </option>
              ))}
            </select>
            {needsValue(rule.operator) && (
              <input
                value={String(rule.value ?? '')}
                onChange={(e) => updateRule(rule.id, { value: e.target.value })}
                placeholder="..."
                className="w-24 rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface px-2 py-1.5 text-[11px] text-c-text outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
              />
            )}
            <button
              onClick={() => removeRule(rule.id)}
              className="p-1 rounded-lg text-c-text-secondary hover:text-danger-500 hover:bg-danger-50 dark:hover:bg-danger-500/10 transition-colors"
            >
              <Trash2 size={12} />
            </button>
          </div>
        ))}
      </div>

      <div className="px-4 py-3 border-t border-c-border-subtle">
        <button
          onClick={addRule}
          className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-c-text-secondary hover:bg-c-surface-raised hover:text-c-text px-2 py-1.5 rounded-lg transition-colors"
        >
          <Plus size={12} />
          {t('ideas.table.filterPanel.addFilter', 'Add filter')}
        </button>
      </div>
    </div>
  );
};

export default FilterPanel;
