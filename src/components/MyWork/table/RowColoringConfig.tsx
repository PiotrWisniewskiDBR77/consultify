/**
 * RowColoringConfig — Configuration UI + utility for row-level background coloring
 * based on field value rules. Supports equals, contains, is_empty, is_not_empty.
 */
import { Palette, Plus, Trash2 } from 'lucide-react';
import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import type { ColumnDef } from './tableTypes';

export type RowColorOperator = 'equals' | 'contains' | 'is_empty' | 'is_not_empty';

export interface RowColorRule {
  id: string;
  fieldId: string;
  operator: RowColorOperator;
  value?: string;
  color: string;
}

export interface RowColoringConfigProps {
  rules: RowColorRule[];
  fields: ColumnDef[];
  onChange: (rules: RowColorRule[]) => void;
}

const OPERATOR_LABELS: Record<RowColorOperator, { en: string; pl: string }> = {
  equals: { en: 'equals', pl: 'równa się' },
  contains: { en: 'contains', pl: 'zawiera' },
  is_empty: { en: 'is empty', pl: 'jest puste' },
  is_not_empty: { en: 'is not empty', pl: 'nie jest puste' },
};

const PRESET_COLORS = [
  '#fee2e2',
  '#fef3c7',
  '#d1fae5',
  '#dbeafe',
  '#ede9fe',
  '#fce7f3',
  '#ccfbf1',
  '#e0e7ff',
  '#fef9c3',
  '#f3e8ff',
  '#f43f5e',
  '#f59e0b',
  '#10b981',
  '#3b82f6',
  '#6366f1',
];

export function getRowColor(
  record: { data?: Record<string, any> },
  rules: RowColorRule[]
): string | undefined {
  for (const rule of rules) {
    const val = record.data?.[rule.fieldId];
    switch (rule.operator) {
      case 'equals':
        if (String(val ?? '') === (rule.value ?? '')) return rule.color;
        break;
      case 'contains':
        if (typeof val === 'string' && val.includes(rule.value || '')) return rule.color;
        break;
      case 'is_empty':
        if (val == null || val === '' || (Array.isArray(val) && val.length === 0))
          return rule.color;
        break;
      case 'is_not_empty':
        if (val != null && val !== '' && !(Array.isArray(val) && val.length === 0))
          return rule.color;
        break;
    }
  }
  return undefined;
}

let _ruleCounter = 0;
function nextRuleId(): string {
  return `rcr-${Date.now()}-${++_ruleCounter}`;
}

export const RowColoringConfig: React.FC<RowColoringConfigProps> = ({
  rules,
  fields,
  onChange,
}) => {
  const { t } = useTranslation();

  const addRule = useCallback(() => {
    const firstField = fields[0]?.key || '';
    onChange([
      ...rules,
      {
        id: nextRuleId(),
        fieldId: firstField,
        operator: 'equals',
        value: '',
        color: PRESET_COLORS[rules.length % PRESET_COLORS.length],
      },
    ]);
  }, [fields, onChange, rules]);

  const removeRule = useCallback(
    (id: string) => onChange(rules.filter((r) => r.id !== id)),
    [onChange, rules]
  );

  const updateRule = useCallback(
    (id: string, patch: Partial<RowColorRule>) => {
      onChange(rules.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    },
    [onChange, rules]
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Palette size={12} className="text-c-text-secondary" />
          <span className="text-[10px] font-bold text-c-text-muted uppercase tracking-wider">
            {t('ideas.table.rowColoring.title', 'Row coloring')}
          </span>
        </div>
        <button
          onClick={addRule}
          className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium text-c-accent hover:bg-c-accent-soft transition-colors"
        >
          <Plus size={10} />
          {t('ideas.table.rowColoring.addRule', 'Add rule')}
        </button>
      </div>

      {rules.length === 0 && (
        <div className="text-[10px] text-c-text-secondary text-center py-3">
          {t('ideas.table.rowColoring.noRules', 'No coloring rules')}
        </div>
      )}

      {rules.map((rule) => {
        const needsValue = rule.operator === 'equals' || rule.operator === 'contains';
        return (
          <div
            key={rule.id}
            className="p-2.5 rounded-xl border border-c-border-subtle space-y-2"
            style={{ borderLeftWidth: 3, borderLeftColor: rule.color }}
          >
            <div className="flex items-center gap-2">
              {/* Field select */}
              <select
                value={rule.fieldId}
                onChange={(e) => updateRule(rule.id, { fieldId: e.target.value })}
                className="flex-1 h-7 px-2 rounded-lg text-[10px] bg-c-surface-raised border border-c-border-subtle text-c-text outline-none"
              >
                {fields.map((f) => (
                  <option key={f.key} value={f.key}>
                    {f.header}
                  </option>
                ))}
              </select>

              {/* Operator select */}
              <select
                value={rule.operator}
                onChange={(e) =>
                  updateRule(rule.id, { operator: e.target.value as RowColorOperator })
                }
                className="w-28 h-7 px-2 rounded-lg text-[10px] bg-c-surface-raised border border-c-border-subtle text-c-text outline-none"
              >
                {(Object.keys(OPERATOR_LABELS) as RowColorOperator[]).map((op) => (
                  <option key={op} value={op}>
                    {t(`ideas.table.rowColoring.operator.${op}`, OPERATOR_LABELS[op].en)}
                  </option>
                ))}
              </select>

              {/* Delete */}
              <button
                onClick={() => removeRule(rule.id)}
                className="p-1 rounded-lg hover:bg-danger-50 dark:hover:bg-danger-500/10 text-c-text-secondary hover:text-danger-500 transition-colors"
              >
                <Trash2 size={12} />
              </button>
            </div>

            <div className="flex items-center gap-2">
              {/* Value input */}
              {needsValue && (
                <input
                  type="text"
                  value={rule.value || ''}
                  onChange={(e) => updateRule(rule.id, { value: e.target.value })}
                  placeholder={t('ideas.table.rowColoring.valuePlaceholder', 'Value...')}
                  className="flex-1 h-7 px-2 rounded-lg text-[10px] bg-c-surface-raised border border-c-border-subtle text-c-text outline-none"
                />
              )}

              {/* Color picker */}
              <div className="flex items-center gap-1">
                {PRESET_COLORS.slice(0, 8).map((c) => (
                  <button
                    key={c}
                    onClick={() => updateRule(rule.id, { color: c })}
                    className={`w-4 h-4 rounded-full border-2 transition-transform hover:scale-125 ${
                      rule.color === c ? 'border-c-accent scale-110' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
                <input
                  type="color"
                  value={rule.color}
                  onChange={(e) => updateRule(rule.id, { color: e.target.value })}
                  className="w-5 h-5 rounded cursor-pointer border-0 p-0"
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default RowColoringConfig;
