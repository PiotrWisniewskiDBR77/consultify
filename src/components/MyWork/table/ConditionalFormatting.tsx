/**
 * ConditionalFormatting — Rules engine for conditional cell styling.
 * Stores rules in extensions.table.formatting[].
 */
import { Paintbrush, Plus, Trash2, X } from 'lucide-react';
import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import type { ColumnDef } from './tableTypes';

export interface FormatRule {
  id: string;
  column: string;
  condition: 'equals' | 'contains' | 'gt' | 'lt' | 'is_empty' | 'not_empty';
  value: string;
  style: {
    backgroundColor?: string;
    textColor?: string;
    fontWeight?: 'bold' | 'normal';
    icon?: string;
  };
}

interface ConditionalFormattingProps {
  open: boolean;
  onClose: () => void;
  rules: FormatRule[];
  onChange: (rules: FormatRule[]) => void;
  columns: ColumnDef[];
}

const PRESET_COLORS = [
  { bg: '#dcfce7', text: '#166534', label: 'Green' },
  { bg: '#fef3c7', text: '#92400e', label: 'Yellow' },
  { bg: '#fee2e2', text: '#991b1b', label: 'Red' },
  { bg: '#dbeafe', text: '#1e40af', label: 'Blue' },
  { bg: '#ede9fe', text: '#5b21b6', label: 'Purple' },
  { bg: '#f3e8ff', text: '#7c3aed', label: 'Violet' },
];

export const ConditionalFormatting: React.FC<ConditionalFormattingProps> = ({
  open,
  onClose,
  rules,
  onChange,
  columns,
}) => {
  const { i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');

  const addRule = useCallback(() => {
    const newRule: FormatRule = {
      id: `fmt-${Date.now()}`,
      column: columns[0]?.key || 'label',
      condition: 'equals',
      value: '',
      style: { backgroundColor: '#dcfce7', textColor: '#166534' },
    };
    onChange([...rules, newRule]);
  }, [columns, onChange, rules]);

  const updateRule = useCallback(
    (id: string, updates: Partial<FormatRule>) => {
      onChange(rules.map((r) => (r.id === id ? { ...r, ...updates } : r)));
    },
    [onChange, rules]
  );

  const removeRule = useCallback(
    (id: string) => onChange(rules.filter((r) => r.id !== id)),
    [onChange, rules]
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="w-[480px] max-h-[70vh] overflow-auto rounded-2xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200/60 dark:border-navy-700/60">
          <div className="flex items-center gap-2">
            <Paintbrush size={16} className="text-violet-500" />
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
              {isPl ? 'Formatowanie warunkowe' : 'Conditional Formatting'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-navy-800"
          >
            <X size={16} className="text-slate-400" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-3">
          {rules.length === 0 && (
            <p className="text-[11px] text-slate-400 text-center py-4">
              {isPl ? 'Brak reguł. Dodaj pierwszą.' : 'No rules. Add one.'}
            </p>
          )}

          {rules.map((rule) => (
            <div
              key={rule.id}
              className="p-3 rounded-xl border border-slate-200/60 dark:border-navy-700/60 space-y-2"
            >
              <div className="flex items-center gap-2">
                <select
                  value={rule.column}
                  onChange={(e) => updateRule(rule.id, { column: e.target.value })}
                  className="flex-1 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-950 px-2 py-1.5 text-[11px] outline-none"
                >
                  {columns.map((col) => (
                    <option key={col.key} value={col.key}>
                      {col.header}
                    </option>
                  ))}
                </select>
                <select
                  value={rule.condition}
                  onChange={(e) =>
                    updateRule(rule.id, { condition: e.target.value as FormatRule['condition'] })
                  }
                  className="w-28 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-950 px-2 py-1.5 text-[11px] outline-none"
                >
                  <option value="equals">{isPl ? 'Równa się' : 'Equals'}</option>
                  <option value="contains">{isPl ? 'Zawiera' : 'Contains'}</option>
                  <option value="gt">{isPl ? 'Większe' : 'Greater'}</option>
                  <option value="lt">{isPl ? 'Mniejsze' : 'Less'}</option>
                  <option value="not_empty">{isPl ? 'Niepuste' : 'Not empty'}</option>
                  <option value="is_empty">{isPl ? 'Puste' : 'Empty'}</option>
                </select>
                {!['is_empty', 'not_empty'].includes(rule.condition) && (
                  <input
                    value={rule.value}
                    onChange={(e) => updateRule(rule.id, { value: e.target.value })}
                    placeholder="..."
                    className="w-24 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-950 px-2 py-1.5 text-[11px] outline-none"
                  />
                )}
                <button
                  onClick={() => removeRule(rule.id)}
                  className="p-1 rounded-lg text-slate-400 hover:text-red-500 transition-colors"
                >
                  <Trash2 size={12} />
                </button>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-[9px] text-slate-400 mr-1">{isPl ? 'Styl:' : 'Style:'}</span>
                {PRESET_COLORS.map((preset) => (
                  <button
                    key={preset.label}
                    onClick={() =>
                      updateRule(rule.id, {
                        style: { backgroundColor: preset.bg, textColor: preset.text },
                      })
                    }
                    className={`w-5 h-5 rounded-md border-2 transition-colors ${
                      rule.style.backgroundColor === preset.bg
                        ? 'border-slate-800 dark:border-white'
                        : 'border-transparent'
                    }`}
                    style={{ backgroundColor: preset.bg }}
                    title={preset.label}
                  />
                ))}
              </div>

              {/* Preview */}
              <div
                className="px-2 py-1 rounded-lg text-[10px] font-medium"
                style={{
                  backgroundColor: rule.style.backgroundColor,
                  color: rule.style.textColor,
                  fontWeight: rule.style.fontWeight || 'normal',
                }}
              >
                {isPl ? 'Podgląd stylu' : 'Style preview'}
              </div>
            </div>
          ))}
        </div>

        <div className="px-5 py-3 border-t border-slate-200/60 dark:border-navy-700/60 flex items-center justify-between">
          <button
            onClick={addRule}
            className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-violet-600 dark:text-violet-400 hover:bg-violet-500/10 px-2 py-1.5 rounded-lg transition-colors"
          >
            <Plus size={12} />
            {isPl ? 'Dodaj regułę' : 'Add rule'}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-900 text-white dark:bg-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors"
          >
            {isPl ? 'Gotowe' : 'Done'}
          </button>
        </div>
      </div>
    </div>
  );
};

export function getConditionalStyle(
  rules: FormatRule[],
  column: string,
  value: any
): React.CSSProperties | undefined {
  for (const rule of rules) {
    if (rule.column !== column) continue;
    const strVal = String(value ?? '').toLowerCase();
    const ruleVal = rule.value.toLowerCase();

    let match = false;
    switch (rule.condition) {
      case 'equals':
        match = strVal === ruleVal;
        break;
      case 'contains':
        match = strVal.includes(ruleVal);
        break;
      case 'gt':
        match = Number(value) > Number(rule.value);
        break;
      case 'lt':
        match = Number(value) < Number(rule.value);
        break;
      case 'not_empty':
        match = strVal.trim().length > 0;
        break;
      case 'is_empty':
        match = strVal.trim().length === 0;
        break;
    }

    if (match) {
      return {
        backgroundColor: rule.style.backgroundColor,
        color: rule.style.textColor,
        fontWeight: rule.style.fontWeight,
        borderRadius: '6px',
        padding: '0 4px',
      };
    }
  }
  return undefined;
}

export default ConditionalFormatting;
