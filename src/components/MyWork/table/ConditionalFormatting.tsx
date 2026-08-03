/**
 * ConditionalFormatting — Configuration UI + utility for cell-level conditional
 * formatting. Supports multiple operators and style properties (background,
 * text color, font weight, font style).
 */
import { Paintbrush, Plus, Trash2 } from 'lucide-react';
import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import type { ColumnDef } from './tableTypes';

export type FormatOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'is_empty'
  | 'is_not_empty'
  | 'greater_than'
  | 'less_than'
  | 'between';

export interface FormatRuleStyle {
  backgroundColor?: string;
  color?: string;
  fontWeight?: 'bold' | 'normal';
  fontStyle?: 'italic' | 'normal';
}

export interface FormatRule {
  id: string;
  fieldId: string;
  operator: FormatOperator;
  value?: unknown;
  value2?: unknown;
  style: FormatRuleStyle;
}

export interface ConditionalFormattingConfigProps {
  rules: FormatRule[];
  fields: ColumnDef[];
  onChange: (rules: FormatRule[]) => void;
  /** When true, shows the config UI (e.g. in a modal). When false, renders nothing. */
  open?: boolean;
  onClose?: () => void;
}

const OPERATOR_LABELS: Record<FormatOperator, { en: string; pl: string }> = {
  equals: { en: 'equals', pl: 'równa się' },
  not_equals: { en: 'not equals', pl: 'nie równa się' },
  contains: { en: 'contains', pl: 'zawiera' },
  not_contains: { en: 'not contains', pl: 'nie zawiera' },
  is_empty: { en: 'is empty', pl: 'jest puste' },
  is_not_empty: { en: 'is not empty', pl: 'nie jest puste' },
  greater_than: { en: 'greater than', pl: 'większe niż' },
  less_than: { en: 'less than', pl: 'mniejsze niż' },
  between: { en: 'between', pl: 'pomiędzy' },
};

const PRESET_BG_COLORS = [
  '#fee2e2',
  '#fef3c7',
  '#d1fae5',
  '#dbeafe',
  '#ede9fe',
  '#fce7f3',
  '#ccfbf1',
  '#e0e7ff',
];

const PRESET_TEXT_COLORS = [
  '#f43f5e',
  '#f59e0b',
  '#10b981',
  '#3b82f6',
  '#6366f1',
  '#ec4899',
  '#334155',
  '#ffffff',
];

export function evaluateCondition(
  value: unknown,
  operator: FormatOperator,
  ruleValue?: unknown,
  ruleValue2?: unknown
): boolean {
  const strVal = value != null ? String(value) : '';
  const numVal = Number(value);
  const ruleStr = ruleValue != null ? String(ruleValue) : '';

  switch (operator) {
    case 'equals':
      return strVal === ruleStr;
    case 'not_equals':
      return strVal !== ruleStr;
    case 'contains':
      return strVal.toLowerCase().includes(ruleStr.toLowerCase());
    case 'not_contains':
      return !strVal.toLowerCase().includes(ruleStr.toLowerCase());
    case 'is_empty':
      return value == null || strVal === '' || (Array.isArray(value) && value.length === 0);
    case 'is_not_empty':
      return value != null && strVal !== '' && !(Array.isArray(value) && value.length === 0);
    case 'greater_than':
      return !isNaN(numVal) && numVal > Number(ruleValue);
    case 'less_than':
      return !isNaN(numVal) && numVal < Number(ruleValue);
    case 'between': {
      const lo = Number(ruleValue);
      const hi = Number(ruleValue2);
      return !isNaN(numVal) && numVal >= lo && numVal <= hi;
    }
    default:
      return false;
  }
}

export function getCellStyle(
  fieldId: string,
  value: unknown,
  rules: FormatRule[]
): React.CSSProperties {
  for (const rule of rules) {
    if (rule.fieldId !== fieldId) continue;
    if (evaluateCondition(value, rule.operator, rule.value, rule.value2)) {
      return rule.style as React.CSSProperties;
    }
  }
  return {};
}

let _fmtCounter = 0;
function nextFmtId(): string {
  return `cfr-${Date.now()}-${++_fmtCounter}`;
}

function operatorNeedsValue(op: FormatOperator): boolean {
  return op !== 'is_empty' && op !== 'is_not_empty';
}

export const ConditionalFormattingConfig: React.FC<ConditionalFormattingConfigProps> = ({
  rules,
  fields,
  onChange,
  open = true,
  onClose: _onClose,
}) => {
  const { t, i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');

  const addRule = useCallback(() => {
    const firstField = fields[0]?.key || '';
    onChange([
      ...rules,
      {
        id: nextFmtId(),
        fieldId: firstField,
        operator: 'equals',
        value: '',
        style: { backgroundColor: '#fef3c7' },
      },
    ]);
  }, [fields, onChange, rules]);

  const removeRule = useCallback(
    (id: string) => onChange(rules.filter((r) => r.id !== id)),
    [onChange, rules]
  );

  const updateRule = useCallback(
    (id: string, patch: Partial<FormatRule>) => {
      onChange(rules.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    },
    [onChange, rules]
  );

  const updateStyle = useCallback(
    (id: string, stylePatch: Partial<FormatRuleStyle>) => {
      onChange(
        rules.map((r) => (r.id === id ? { ...r, style: { ...r.style, ...stylePatch } } : r))
      );
    },
    [onChange, rules]
  );

  if (open === false) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Paintbrush size={12} className="text-c-text-secondary" />
          <span className="text-[10px] font-bold text-c-text-muted uppercase tracking-wider">
            {t('myWorkTable.conditionalFormatting.title')}
          </span>
        </div>
        <button
          onClick={addRule}
          className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium text-c-text-secondary hover:bg-c-surface-raised hover:text-c-text transition-colors"
        >
          <Plus size={10} />
          {t('myWorkTable.conditionalFormatting.addRule')}
        </button>
      </div>

      {rules.length === 0 && (
        <div className="text-[10px] text-c-text-secondary text-center py-3">
          {t('myWorkTable.conditionalFormatting.noRules')}
        </div>
      )}

      {rules.map((rule) => {
        const needsValue = operatorNeedsValue(rule.operator);
        const isBetween = rule.operator === 'between';

        return (
          <div key={rule.id} className="p-2.5 rounded-xl border border-c-border-subtle space-y-2">
            {/* Row 1: field + operator */}
            <div className="flex items-center gap-2">
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

              <select
                value={rule.operator}
                onChange={(e) =>
                  updateRule(rule.id, { operator: e.target.value as FormatOperator })
                }
                className="w-28 h-7 px-2 rounded-lg text-[10px] bg-c-surface-raised border border-c-border-subtle text-c-text outline-none"
              >
                {(Object.keys(OPERATOR_LABELS) as FormatOperator[]).map((op) => (
                  <option key={op} value={op}>
                    {isPl ? OPERATOR_LABELS[op].pl : OPERATOR_LABELS[op].en}
                  </option>
                ))}
              </select>

              <button
                onClick={() => removeRule(rule.id)}
                className="p-1 rounded-lg hover:bg-danger-50 dark:hover:bg-danger-500/10 text-c-text-secondary hover:text-danger-500 transition-colors"
              >
                <Trash2 size={12} />
              </button>
            </div>

            {/* Row 2: value(s) */}
            {needsValue && (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={rule.value != null ? String(rule.value) : ''}
                  onChange={(e) => updateRule(rule.id, { value: e.target.value })}
                  placeholder={t('myWorkTable.conditionalFormatting.valuePlaceholder')}
                  className="flex-1 h-7 px-2 rounded-lg text-[10px] bg-c-surface-raised border border-c-border-subtle text-c-text outline-none"
                />
                {isBetween && (
                  <>
                    <span className="text-[9px] text-c-text-secondary">&</span>
                    <input
                      type="text"
                      value={rule.value2 != null ? String(rule.value2) : ''}
                      onChange={(e) => updateRule(rule.id, { value2: e.target.value })}
                      placeholder={t('myWorkTable.conditionalFormatting.toPlaceholder')}
                      className="flex-1 h-7 px-2 rounded-lg text-[10px] bg-c-surface-raised border border-c-border-subtle text-c-text outline-none"
                    />
                  </>
                )}
              </div>
            )}

            {/* Row 3: style controls */}
            <div className="flex items-center gap-3 flex-wrap">
              {/* Background color */}
              <div className="flex items-center gap-1">
                <span className="text-[8px] text-c-text-secondary uppercase tracking-wider">
                  {t('myWorkTable.conditionalFormatting.bg')}
                </span>
                {PRESET_BG_COLORS.slice(0, 5).map((c) => (
                  <button
                    key={c}
                    onClick={() => updateStyle(rule.id, { backgroundColor: c })}
                    className={`w-3.5 h-3.5 rounded-full border transition-transform hover:scale-125 ${
                      rule.style.backgroundColor === c
                        ? 'border-c-focus scale-110'
                        : 'border-c-border-subtle'
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
                <input
                  type="color"
                  value={rule.style.backgroundColor || '#ffffff'}
                  onChange={(e) => updateStyle(rule.id, { backgroundColor: e.target.value })}
                  className="w-4 h-4 rounded cursor-pointer border-0 p-0"
                />
              </div>

              {/* Text color */}
              <div className="flex items-center gap-1">
                <span className="text-[8px] text-c-text-secondary uppercase tracking-wider">
                  {t('myWorkTable.conditionalFormatting.text')}
                </span>
                {PRESET_TEXT_COLORS.slice(0, 4).map((c) => (
                  <button
                    key={c}
                    onClick={() => updateStyle(rule.id, { color: c })}
                    className={`w-3.5 h-3.5 rounded-full border transition-transform hover:scale-125 ${
                      rule.style.color === c ? 'border-c-focus scale-110' : 'border-c-border-subtle'
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>

              {/* Bold toggle */}
              <button
                onClick={() =>
                  updateStyle(rule.id, {
                    fontWeight: rule.style.fontWeight === 'bold' ? 'normal' : 'bold',
                  })
                }
                className={`px-1.5 py-0.5 rounded text-[9px] font-bold transition-colors ${
                  rule.style.fontWeight === 'bold'
                    ? 'bg-c-surface-raised text-c-text'
                    : 'text-c-text-secondary hover:bg-c-surface-raised'
                }`}
              >
                B
              </button>

              {/* Italic toggle */}
              <button
                onClick={() =>
                  updateStyle(rule.id, {
                    fontStyle: rule.style.fontStyle === 'italic' ? 'normal' : 'italic',
                  })
                }
                className={`px-1.5 py-0.5 rounded text-[9px] italic transition-colors ${
                  rule.style.fontStyle === 'italic'
                    ? 'bg-c-surface-raised text-c-text'
                    : 'text-c-text-secondary hover:bg-c-surface-raised'
                }`}
              >
                I
              </button>
            </div>

            {/* Preview */}
            <div
              className="px-2 py-1 rounded-lg text-[10px] border border-c-border-subtle"
              style={rule.style as React.CSSProperties}
            >
              {t('myWorkTable.conditionalFormatting.preview')}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export { ConditionalFormattingConfig as ConditionalFormatting };

export function getConditionalStyle(
  rules: FormatRule[],
  fieldId: string,
  value: unknown
): React.CSSProperties | undefined {
  for (const rule of rules) {
    if (rule.fieldId !== fieldId) continue;
    const v = value == null ? '' : String(value);
    const rv = rule.value == null ? '' : String(rule.value);
    let match = false;
    switch (rule.operator) {
      case 'equals':
        match = v === rv;
        break;
      case 'not_equals':
        match = v !== rv;
        break;
      case 'contains':
        match = v.toLowerCase().includes(rv.toLowerCase());
        break;
      case 'not_contains':
        match = !v.toLowerCase().includes(rv.toLowerCase());
        break;
      case 'is_empty':
        match = v.trim() === '';
        break;
      case 'is_not_empty':
        match = v.trim() !== '';
        break;
      case 'greater_than':
        match = Number(v) > Number(rv);
        break;
      case 'less_than':
        match = Number(v) < Number(rv);
        break;
      case 'between': {
        const n = Number(v);
        match = n >= Number(rv) && n <= Number(rule.value2 ?? rv);
        break;
      }
    }
    if (match) return rule.style as React.CSSProperties;
  }
  return undefined;
}

export default ConditionalFormattingConfig;
