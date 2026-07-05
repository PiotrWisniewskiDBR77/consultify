/**
 * FilterBuilder — Platform-aware advanced filter builder for the Table Platform.
 *
 * Supports 40 filter operators across 7 field type groups with type-appropriate
 * value inputs (text, number, date, select, multi-select, checkbox).
 */
import { Calendar, Check, ChevronDown, Plus, Trash2, X } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type {
  FieldType,
  FilterGroup,
  FilterRule,
  TablePlatformField,
  TablePlatformSelectOption,
} from '@/types/tablePlatform';

// ── Operator definitions per field type group ────────────────────────────────

interface OperatorDef {
  value: string;
  labelEn: string;
  labelPl: string;
  needsValue: boolean;
}

const TEXT_OPERATORS: OperatorDef[] = [
  { value: 'contains', labelEn: 'Contains', labelPl: 'Zawiera', needsValue: true },
  {
    value: 'doesNotContain',
    labelEn: 'Does not contain',
    labelPl: 'Nie zawiera',
    needsValue: true,
  },
  { value: 'equals', labelEn: 'Equals', labelPl: 'Równa się', needsValue: true },
  { value: 'notEquals', labelEn: 'Not equals', labelPl: 'Nie równa się', needsValue: true },
  { value: 'startsWith', labelEn: 'Starts with', labelPl: 'Zaczyna się od', needsValue: true },
  { value: 'endsWith', labelEn: 'Ends with', labelPl: 'Kończy się na', needsValue: true },
  { value: 'isEmpty', labelEn: 'Is empty', labelPl: 'Puste', needsValue: false },
  { value: 'isNotEmpty', labelEn: 'Is not empty', labelPl: 'Niepuste', needsValue: false },
];

const NUMBER_OPERATORS: OperatorDef[] = [
  { value: 'equals', labelEn: '=', labelPl: '=', needsValue: true },
  { value: 'notEquals', labelEn: '≠', labelPl: '≠', needsValue: true },
  { value: 'gt', labelEn: '>', labelPl: '>', needsValue: true },
  { value: 'gte', labelEn: '≥', labelPl: '≥', needsValue: true },
  { value: 'lt', labelEn: '<', labelPl: '<', needsValue: true },
  { value: 'lte', labelEn: '≤', labelPl: '≤', needsValue: true },
  { value: 'isEmpty', labelEn: 'Is empty', labelPl: 'Puste', needsValue: false },
  { value: 'isNotEmpty', labelEn: 'Is not empty', labelPl: 'Niepuste', needsValue: false },
];

const SINGLE_SELECT_OPERATORS: OperatorDef[] = [
  { value: 'is', labelEn: 'Is', labelPl: 'Jest', needsValue: true },
  { value: 'isNot', labelEn: 'Is not', labelPl: 'Nie jest', needsValue: true },
  { value: 'isAnyOf', labelEn: 'Is any of', labelPl: 'Jest jednym z', needsValue: true },
  { value: 'isNoneOf', labelEn: 'Is none of', labelPl: 'Nie jest żadnym z', needsValue: true },
  { value: 'isEmpty', labelEn: 'Is empty', labelPl: 'Puste', needsValue: false },
  { value: 'isNotEmpty', labelEn: 'Is not empty', labelPl: 'Niepuste', needsValue: false },
];

const MULTI_SELECT_OPERATORS: OperatorDef[] = [
  { value: 'contains', labelEn: 'Contains', labelPl: 'Zawiera', needsValue: true },
  {
    value: 'doesNotContain',
    labelEn: 'Does not contain',
    labelPl: 'Nie zawiera',
    needsValue: true,
  },
  { value: 'isAnyOf', labelEn: 'Is any of', labelPl: 'Jest jednym z', needsValue: true },
  { value: 'isEmpty', labelEn: 'Is empty', labelPl: 'Puste', needsValue: false },
  { value: 'isNotEmpty', labelEn: 'Is not empty', labelPl: 'Niepuste', needsValue: false },
];

const DATE_OPERATORS: OperatorDef[] = [
  { value: 'is', labelEn: 'Is', labelPl: 'Jest', needsValue: true },
  { value: 'isBefore', labelEn: 'Is before', labelPl: 'Przed', needsValue: true },
  { value: 'isAfter', labelEn: 'Is after', labelPl: 'Po', needsValue: true },
  {
    value: 'isOnOrBefore',
    labelEn: 'Is on or before',
    labelPl: 'W dniu lub przed',
    needsValue: true,
  },
  { value: 'isOnOrAfter', labelEn: 'Is on or after', labelPl: 'W dniu lub po', needsValue: true },
  { value: 'isWithin', labelEn: 'Is within', labelPl: 'W zakresie', needsValue: true },
  { value: 'isEmpty', labelEn: 'Is empty', labelPl: 'Puste', needsValue: false },
  { value: 'isNotEmpty', labelEn: 'Is not empty', labelPl: 'Niepuste', needsValue: false },
];

const CHECKBOX_OPERATORS: OperatorDef[] = [
  { value: 'is', labelEn: 'Is', labelPl: 'Jest', needsValue: true },
];

const LINKED_RECORD_OPERATORS: OperatorDef[] = [
  { value: 'contains', labelEn: 'Contains', labelPl: 'Zawiera', needsValue: true },
  {
    value: 'doesNotContain',
    labelEn: 'Does not contain',
    labelPl: 'Nie zawiera',
    needsValue: true,
  },
  { value: 'isEmpty', labelEn: 'Is empty', labelPl: 'Puste', needsValue: false },
  { value: 'isNotEmpty', labelEn: 'Is not empty', labelPl: 'Niepuste', needsValue: false },
];

const FIELD_TYPE_GROUPS: Record<string, FieldType[]> = {
  text: ['singleLineText', 'longText', 'url', 'email', 'phone'],
  number: ['number', 'currency', 'percent'],
  singleSelect: ['singleSelect'],
  multiSelect: ['multiSelect'],
  date: ['date'],
  checkbox: ['checkbox'],
  linkedRecord: ['linkedRecord'],
};

function getOperatorsForFieldType(fieldType: FieldType): OperatorDef[] {
  if (FIELD_TYPE_GROUPS.text.includes(fieldType)) return TEXT_OPERATORS;
  if (FIELD_TYPE_GROUPS.number.includes(fieldType)) return NUMBER_OPERATORS;
  if (FIELD_TYPE_GROUPS.singleSelect.includes(fieldType)) return SINGLE_SELECT_OPERATORS;
  if (FIELD_TYPE_GROUPS.multiSelect.includes(fieldType)) return MULTI_SELECT_OPERATORS;
  if (FIELD_TYPE_GROUPS.date.includes(fieldType)) return DATE_OPERATORS;
  if (FIELD_TYPE_GROUPS.checkbox.includes(fieldType)) return CHECKBOX_OPERATORS;
  if (FIELD_TYPE_GROUPS.linkedRecord.includes(fieldType)) return LINKED_RECORD_OPERATORS;
  return TEXT_OPERATORS;
}

function isMultiValueOperator(op: string): boolean {
  return op === 'isAnyOf' || op === 'isNoneOf';
}

function getSelectOptions(field: TablePlatformField): TablePlatformSelectOption[] {
  const opts = field.options as { options?: TablePlatformSelectOption[] } | undefined;
  return opts?.options ?? [];
}

// ── Date range presets for "isWithin" ────────────────────────────────────────

const DATE_WITHIN_OPTIONS = [
  { value: 'pastWeek', labelEn: 'Past week', labelPl: 'Ostatni tydzień' },
  { value: 'pastMonth', labelEn: 'Past month', labelPl: 'Ostatni miesiąc' },
  { value: 'pastYear', labelEn: 'Past year', labelPl: 'Ostatni rok' },
  { value: 'nextWeek', labelEn: 'Next week', labelPl: 'Następny tydzień' },
  { value: 'nextMonth', labelEn: 'Next month', labelPl: 'Następny miesiąc' },
  { value: 'nextYear', labelEn: 'Next year', labelPl: 'Następny rok' },
  { value: 'today', labelEn: 'Today', labelPl: 'Dziś' },
  { value: 'thisWeek', labelEn: 'This week', labelPl: 'Ten tydzień' },
  { value: 'thisMonth', labelEn: 'This month', labelPl: 'Ten miesiąc' },
];

// ── Props ────────────────────────────────────────────────────────────────────

export interface FilterBuilderProps {
  open: boolean;
  onClose: () => void;
  filters: FilterGroup;
  onChange: (filters: FilterGroup) => void;
  fields: TablePlatformField[];
}

// ── Value Input Components ───────────────────────────────────────────────────

const inputCls =
  'w-full rounded-lg border border-c-border-subtle bg-c-surface px-2 py-1.5 text-[11px] text-c-text outline-none focus:ring-2 focus:ring-blue-500/30';

interface ValueInputProps {
  field: TablePlatformField;
  operator: string;
  value: unknown;
  onChange: (val: unknown) => void;
  isPl: boolean;
}

const TextValueInput: React.FC<ValueInputProps> = ({ value, onChange }) => (
  <input
    value={String(value ?? '')}
    onChange={(e) => onChange(e.target.value)}
    placeholder="..."
    className={inputCls}
  />
);

const NumberValueInput: React.FC<ValueInputProps> = ({ value, onChange }) => (
  <input
    type="number"
    value={value != null && typeof value === 'number' ? value : ''}
    onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
    placeholder="0"
    className={`${inputCls} tabular-nums`}
  />
);

const DateValueInput: React.FC<ValueInputProps> = ({ value, operator, onChange, isPl }) => {
  if (operator === 'isWithin') {
    return (
      <select
        value={String(value ?? '')}
        onChange={(e) => onChange(e.target.value)}
        className={inputCls}
      >
        <option value="">{isPl ? 'Wybierz…' : 'Select…'}</option>
        {DATE_WITHIN_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {isPl ? opt.labelPl : opt.labelEn}
          </option>
        ))}
      </select>
    );
  }
  return (
    <div className="flex items-center gap-1">
      <Calendar size={11} className="text-c-text-secondary flex-shrink-0" />
      <input
        type="date"
        value={value ? String(value).slice(0, 10) : ''}
        onChange={(e) => onChange(e.target.value || null)}
        className={inputCls}
      />
    </div>
  );
};

const CheckboxValueInput: React.FC<ValueInputProps> = ({ value, onChange, isPl }) => (
  <select
    value={value === true || value === 'true' ? 'true' : 'false'}
    onChange={(e) => onChange(e.target.value === 'true')}
    className={inputCls}
  >
    <option value="true">{isPl ? 'Zaznaczony' : 'Checked'}</option>
    <option value="false">{isPl ? 'Niezaznaczony' : 'Unchecked'}</option>
  </select>
);

const SelectValueInput: React.FC<ValueInputProps> = ({
  field,
  operator,
  value,
  onChange,
  isPl,
}) => {
  const options = getSelectOptions(field);
  const isMulti = isMultiValueOperator(operator);

  if (isMulti) {
    const selected: string[] = Array.isArray(value) ? value : value ? [String(value)] : [];
    return (
      <MultiSelectDropdown options={options} selected={selected} onChange={onChange} isPl={isPl} />
    );
  }

  return (
    <select
      value={String(value ?? '')}
      onChange={(e) => onChange(e.target.value)}
      className={inputCls}
    >
      <option value="">{isPl ? 'Wybierz…' : 'Select…'}</option>
      {options.map((opt) => (
        <option key={opt.id} value={opt.name ?? opt.id}>
          {opt.name ?? opt.id}
        </option>
      ))}
    </select>
  );
};

// ── Multi-select dropdown for isAnyOf / isNoneOf ─────────────────────────────

interface MultiSelectDropdownProps {
  options: TablePlatformSelectOption[];
  selected: string[];
  onChange: (val: string[]) => void;
  isPl: boolean;
}

const MultiSelectDropdown: React.FC<MultiSelectDropdownProps> = ({
  options,
  selected,
  onChange,
  isPl,
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const toggle = (val: string) => {
    const next = selected.includes(val) ? selected.filter((s) => s !== val) : [...selected, val];
    onChange(next);
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`${inputCls} text-left flex items-center justify-between gap-1`}
      >
        <span className="truncate">
          {selected.length > 0 ? selected.join(', ') : isPl ? 'Wybierz…' : 'Select…'}
        </span>
        <ChevronDown size={10} className="text-c-text-secondary flex-shrink-0" />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 w-full rounded-xl border border-c-border-subtle bg-c-surface shadow-xl p-1 max-h-48 overflow-auto">
          {options.map((opt) => {
            const val = opt.name ?? opt.id;
            const isSelected = selected.includes(val);
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => toggle(val)}
                className="w-full text-left px-2 py-1.5 rounded-lg text-[11px] hover:bg-c-surface-raised transition-colors flex items-center gap-2"
              >
                <span
                  className={`w-3.5 h-3.5 rounded-sm border flex items-center justify-center flex-shrink-0 ${
                    isSelected
                      ? 'bg-c-surface border-c-border'
                      : 'border-c-border'
                  }`}
                >
                  {isSelected && <Check size={9} className="text-white" />}
                </span>
                {val}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ── Value input router ───────────────────────────────────────────────────────

const ValueInput: React.FC<ValueInputProps> = (props) => {
  const { field } = props;
  const ft = field.fieldType;

  if (FIELD_TYPE_GROUPS.checkbox.includes(ft)) return <CheckboxValueInput {...props} />;
  if (FIELD_TYPE_GROUPS.date.includes(ft)) return <DateValueInput {...props} />;
  if (FIELD_TYPE_GROUPS.number.includes(ft)) return <NumberValueInput {...props} />;
  if (FIELD_TYPE_GROUPS.singleSelect.includes(ft) || FIELD_TYPE_GROUPS.multiSelect.includes(ft)) {
    return <SelectValueInput {...props} />;
  }
  return <TextValueInput {...props} />;
};

// ── Main FilterBuilder ───────────────────────────────────────────────────────

export const FilterBuilder: React.FC<FilterBuilderProps> = ({
  open,
  onClose,
  filters,
  onChange,
  fields,
}) => {
  const { i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');

  const fieldMap = useMemo(() => new Map(fields.map((f) => [f.id, f])), [fields]);

  const filterableFields = useMemo(
    () =>
      fields.filter(
        (f) => !f.isComputed || f.fieldType === 'singleSelect' || f.fieldType === 'multiSelect'
      ),
    [fields]
  );

  const addRule = useCallback(() => {
    const firstField = filterableFields[0];
    if (!firstField) return;
    const ops = getOperatorsForFieldType(firstField.fieldType);
    const rule: FilterRule = {
      fieldId: firstField.id,
      operator: ops[0]?.value ?? 'contains',
      value: undefined,
    };
    onChange({ ...filters, rules: [...filters.rules, rule] });
  }, [filterableFields, filters, onChange]);

  const updateRule = useCallback(
    (idx: number, updates: Partial<FilterRule>) => {
      const newRules = filters.rules.map((r, i) => (i === idx ? { ...r, ...updates } : r));
      onChange({ ...filters, rules: newRules });
    },
    [filters, onChange]
  );

  const removeRule = useCallback(
    (idx: number) => {
      onChange({ ...filters, rules: filters.rules.filter((_, i) => i !== idx) });
    },
    [filters, onChange]
  );

  const toggleLogic = useCallback(() => {
    onChange({ ...filters, logic: filters.logic === 'and' ? 'or' : 'and' });
  }, [filters, onChange]);

  const clearAll = useCallback(() => {
    onChange({ logic: 'and', rules: [] });
  }, [onChange]);

  const handleFieldChange = useCallback(
    (idx: number, fieldId: string) => {
      const field = fieldMap.get(fieldId);
      if (!field) return;
      const ops = getOperatorsForFieldType(field.fieldType);
      updateRule(idx, { fieldId, operator: ops[0]?.value ?? 'contains', value: undefined });
    },
    [fieldMap, updateRule]
  );

  const handleOperatorChange = useCallback(
    (idx: number, operator: string, fieldType: FieldType) => {
      const ops = getOperatorsForFieldType(fieldType);
      const opDef = ops.find((o) => o.value === operator);
      const updates: Partial<FilterRule> = { operator };
      if (opDef && !opDef.needsValue) {
        updates.value = undefined;
      }
      updateRule(idx, updates);
    },
    [updateRule]
  );

  if (!open) return null;

  return (
    <div className="absolute left-0 top-full mt-1 z-50 w-[480px] rounded-2xl border border-c-border-subtle bg-c-surface shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-c-border-subtle">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-c-text">
            {isPl ? 'Filtry' : 'Filters'}
          </span>
          {filters.rules.length > 1 && (
            <button
              type="button"
              onClick={toggleLogic}
              className="px-2 py-0.5 rounded-md text-[9px] font-bold bg-c-accent-soft text-c-accent hover:bg-c-accent-soft transition-colors"
            >
              {filters.logic.toUpperCase()}
            </button>
          )}
        </div>
        <div className="flex items-center gap-1">
          {filters.rules.length > 0 && (
            <button
              type="button"
              onClick={clearAll}
              className="text-[10px] text-c-text-secondary hover:text-danger-500 transition-colors px-1"
            >
              {isPl ? 'Wyczyść' : 'Clear all'}
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-c-surface-raised transition-colors"
          >
            <X size={14} className="text-c-text-secondary" />
          </button>
        </div>
      </div>

      {/* Rules */}
      <div className="px-4 py-3 space-y-2 max-h-[360px] overflow-auto">
        {filters.rules.length === 0 && (
          <p className="text-[11px] text-c-text-secondary text-center py-4">
            {isPl ? 'Brak filtrów. Dodaj pierwszy.' : 'No filters. Add one.'}
          </p>
        )}
        {filters.rules.map((rule, idx) => {
          const field = fieldMap.get(rule.fieldId);
          const fieldType = field?.fieldType ?? 'singleLineText';
          const operators = getOperatorsForFieldType(fieldType);
          const currentOp = operators.find((o) => o.value === rule.operator);
          const showValue = currentOp?.needsValue ?? true;

          return (
            <div key={`${rule.fieldId}-${idx}`} className="flex items-start gap-1.5">
              {/* Logic label */}
              {idx > 0 ? (
                <span className="text-[9px] font-bold text-c-text-secondary w-8 text-center flex-shrink-0 pt-2">
                  {filters.logic === 'and' ? (isPl ? 'I' : 'AND') : isPl ? 'LUB' : 'OR'}
                </span>
              ) : (
                <span className="w-8 flex-shrink-0" />
              )}

              <div className="flex-1 flex items-start gap-1.5 flex-wrap sm:flex-nowrap">
                {/* Field selector */}
                <select
                  value={rule.fieldId}
                  onChange={(e) => handleFieldChange(idx, e.target.value)}
                  className="flex-1 min-w-[100px] rounded-lg border border-c-border-subtle bg-c-surface px-2 py-1.5 text-[11px] text-c-text outline-none focus:ring-2 focus:ring-blue-500/30"
                >
                  {filterableFields.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>

                {/* Operator selector */}
                <select
                  value={rule.operator}
                  onChange={(e) => handleOperatorChange(idx, e.target.value, fieldType)}
                  className="w-32 rounded-lg border border-c-border-subtle bg-c-surface px-2 py-1.5 text-[11px] text-c-text outline-none focus:ring-2 focus:ring-blue-500/30"
                >
                  {operators.map((op) => (
                    <option key={op.value} value={op.value}>
                      {isPl ? op.labelPl : op.labelEn}
                    </option>
                  ))}
                </select>

                {/* Value input */}
                {showValue && field && (
                  <div className="flex-1 min-w-[80px]">
                    <ValueInput
                      field={field}
                      operator={rule.operator}
                      value={rule.value}
                      onChange={(val) => updateRule(idx, { value: val })}
                      isPl={!!isPl}
                    />
                  </div>
                )}
              </div>

              {/* Remove button */}
              <button
                type="button"
                onClick={() => removeRule(idx)}
                className="p-1 rounded-lg text-c-text-secondary hover:text-danger-500 hover:bg-danger-50 dark:hover:bg-danger-500/10 transition-colors flex-shrink-0 mt-0.5"
              >
                <Trash2 size={12} />
              </button>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-c-border-subtle">
        <button
          type="button"
          onClick={addRule}
          className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-c-accent hover:bg-c-accent-soft px-2 py-1.5 rounded-lg transition-colors"
        >
          <Plus size={12} />
          {isPl ? 'Dodaj filtr' : 'Add filter'}
        </button>
      </div>
    </div>
  );
};

export default FilterBuilder;
