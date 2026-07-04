/**
 * AdvancedFilters - HubSpot-style advanced filters component
 *
 * Features:
 * - Multi-select dropdowns
 * - Date range picker
 * - Saved filter presets
 * - Filter chips display
 * - Clear all filters
 * - Save as preset button
 *
 * Design: HubSpot-style advanced filters with chips
 */

import { AnimatePresence, motion } from 'framer-motion';
import {
  BookmarkPlus,
  Calendar,
  Check,
  ChevronDown,
  Filter,
  RotateCcw,
  Save,
  Search,
  Star,
  Trash2,
  X,
} from 'lucide-react';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '../../../utils/cn';
import { Button } from '../../ui/primitives/Button';
import { Modal } from '../../ui/primitives/Modal';

// Filter field definition
export interface FilterField {
  id: string;
  label: string;
  type: 'select' | 'multiselect' | 'date' | 'daterange' | 'text' | 'number';
  options?: Array<{ value: string; label: string }>;
  placeholder?: string;
}

// Active filter value
export interface FilterValue {
  fieldId: string;
  operator?: 'equals' | 'contains' | 'gt' | 'lt' | 'between' | 'in';
  value: string | string[] | { start: string; end: string };
}

// Saved preset
export interface FilterPreset {
  id: string;
  name: string;
  filters: FilterValue[];
  isDefault?: boolean;
}

interface AdvancedFiltersProps {
  fields: FilterField[];
  values: FilterValue[];
  onChange: (values: FilterValue[]) => void;
  presets?: FilterPreset[];
  onSavePreset?: (name: string, filters: FilterValue[]) => Promise<void>;
  onDeletePreset?: (id: string) => Promise<void>;
  onApplyPreset?: (preset: FilterPreset) => void;
  className?: string;
}

export const AdvancedFilters: React.FC<AdvancedFiltersProps> = ({
  fields,
  values,
  onChange,
  presets = [],
  onSavePreset,
  onDeletePreset,
  onApplyPreset,
  className,
}) => {
  const { t } = useTranslation();
  const [showFilters, setShowFilters] = useState(false);
  const [activeField, setActiveField] = useState<string | null>(null);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [presetName, setPresetName] = useState('');
  const [savingPreset, setSavingPreset] = useState(false);

  // Get filter value for a field
  const getFilterValue = useCallback(
    (fieldId: string): FilterValue | undefined => {
      return values.find((v) => v.fieldId === fieldId);
    },
    [values]
  );

  // Update filter value
  const updateFilter = useCallback(
    (fieldId: string, value: FilterValue['value'], operator?: FilterValue['operator']) => {
      const existing = values.filter((v) => v.fieldId !== fieldId);

      if (
        value === null ||
        value === undefined ||
        (Array.isArray(value) && value.length === 0) ||
        value === ''
      ) {
        onChange(existing);
      } else {
        onChange([...existing, { fieldId, value, operator: operator || 'equals' }]);
      }
    },
    [values, onChange]
  );

  // Remove filter
  const removeFilter = useCallback(
    (fieldId: string) => {
      onChange(values.filter((v) => v.fieldId !== fieldId));
    },
    [values, onChange]
  );

  // Clear all filters
  const clearAll = useCallback(() => {
    onChange([]);
  }, [onChange]);

  // Save preset
  const handleSavePreset = useCallback(async () => {
    if (!presetName.trim() || !onSavePreset) return;

    setSavingPreset(true);
    try {
      await onSavePreset(presetName.trim(), values);
      setShowSaveModal(false);
      setPresetName('');
    } finally {
      setSavingPreset(false);
    }
  }, [presetName, values, onSavePreset]);

  // Format filter value for display
  const formatFilterValue = useCallback((filter: FilterValue, field: FilterField): string => {
    if (Array.isArray(filter.value)) {
      const labels = filter.value.map((v) => {
        const option = field.options?.find((o) => o.value === v);
        return option?.label || v;
      });
      return labels.join(', ');
    }
    if (typeof filter.value === 'object' && 'start' in filter.value) {
      return `${filter.value.start} - ${filter.value.end}`;
    }
    const option = field.options?.find((o) => o.value === filter.value);
    return option?.label || String(filter.value);
  }, []);

  // Active filters count
  const activeCount = values.length;

  return (
    <div className={cn('space-y-3', className)}>
      {/* Filter Bar */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Add Filter Button */}
        <div className="relative">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            icon={<Filter size={14} />}
            className={cn(activeCount > 0 && 'border-primary-500 text-primary-600')}
          >
            {t('admin.filters.addFilter', 'Add filter')}
            {activeCount > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-xs bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded-full">
                {activeCount}
              </span>
            )}
          </Button>

          {/* Filter Dropdown */}
          <AnimatePresence>
            {showFilters && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
                className="absolute top-full left-0 mt-1 w-64 bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-lg shadow-lg z-50"
              >
                <div className="p-2">
                  <p className="px-2 py-1 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
                    {t('admin.filters.selectField', 'Select field')}
                  </p>
                  {fields.map((field) => {
                    const hasValue = !!getFilterValue(field.id);
                    return (
                      <button
                        key={field.id}
                        onClick={() => {
                          setActiveField(field.id);
                          setShowFilters(false);
                        }}
                        className={cn(
                          'w-full flex items-center justify-between px-2 py-2 text-sm rounded hover:bg-slate-50 dark:hover:bg-navy-700',
                          hasValue
                            ? 'text-primary-600 dark:text-primary-400'
                            : 'text-navy-900 dark:text-white'
                        )}
                      >
                        {field.label}
                        {hasValue && <Check size={14} />}
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Active Filter Chips */}
        {values.map((filter) => {
          const field = fields.find((f) => f.id === filter.fieldId);
          if (!field) return null;

          return (
            <motion.div
              key={filter.fieldId}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded-lg text-sm"
            >
              <span className="font-medium">{field.label}:</span>
              <span className="max-w-[150px] truncate">{formatFilterValue(filter, field)}</span>
              <button
                onClick={() => removeFilter(filter.fieldId)}
                className="ml-1 p-0.5 hover:bg-primary-200 dark:hover:bg-primary-800 rounded"
              >
                <X size={12} />
              </button>
            </motion.div>
          );
        })}

        {/* Clear All */}
        {activeCount > 0 && (
          <button
            onClick={clearAll}
            className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          >
            <RotateCcw size={12} />
            {t('admin.filters.clearAll', 'Clear all')}
          </button>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Presets */}
        {presets.length > 0 && (
          <div className="relative group">
            <Button variant="ghost" size="sm" icon={<Star size={14} />}>
              {t('admin.filters.presets', 'Presets')}
              <ChevronDown size={14} />
            </Button>
            <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
              <div className="p-1">
                {presets.map((preset) => (
                  <div
                    key={preset.id}
                    className="flex items-center justify-between px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-navy-700 rounded"
                  >
                    <button
                      onClick={() => onApplyPreset?.(preset)}
                      className="flex-1 text-left text-sm text-navy-900 dark:text-white"
                    >
                      {preset.name}
                      {preset.isDefault && (
                        <Star size={10} className="inline ml-1 text-amber-500 fill-amber-500" />
                      )}
                    </button>
                    {onDeletePreset && !preset.isDefault && (
                      <button
                        onClick={() => onDeletePreset(preset.id)}
                        className="p-1 text-slate-400 dark:text-slate-500 hover:text-danger-500"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Save as Preset */}
        {onSavePreset && activeCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowSaveModal(true)}
            icon={<BookmarkPlus size={14} />}
          >
            {t('admin.filters.savePreset', 'Save')}
          </Button>
        )}
      </div>

      {/* Field-specific Filter Modal/Dropdown */}
      {activeField && (
        <FilterFieldEditor
          field={fields.find((f) => f.id === activeField)!}
          value={getFilterValue(activeField)}
          onChange={(value, operator) => {
            updateFilter(activeField, value, operator);
            setActiveField(null);
          }}
          onClose={() => setActiveField(null)}
        />
      )}

      {/* Save Preset Modal */}
      <Modal
        open={showSaveModal}
        onClose={() => {
          setShowSaveModal(false);
          setPresetName('');
        }}
        title={t('admin.filters.savePresetTitle', 'Save Filter Preset')}
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {t(
              'admin.filters.savePresetDescription',
              'Give your filter combination a name to quickly apply it later.'
            )}
          </p>
          <input
            type="text"
            value={presetName}
            onChange={(e) => setPresetName(e.target.value)}
            placeholder={t('admin.filters.presetNamePlaceholder', 'e.g., Active users this month')}
            className="w-full px-3 py-2 bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg text-navy-900 dark:text-white focus:ring-2 focus:ring-c-focus"
          />

          <div className="p-3 bg-slate-50 dark:bg-navy-900 rounded-lg">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">
              {t('admin.filters.includedFilters', 'Included filters')}:
            </p>
            <div className="flex flex-wrap gap-1">
              {values.map((filter) => {
                const field = fields.find((f) => f.id === filter.fieldId);
                return (
                  <span
                    key={filter.fieldId}
                    className="px-2 py-0.5 text-xs bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded"
                  >
                    {field?.label}
                  </span>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-200 dark:border-navy-700">
          <Button variant="outline" onClick={() => setShowSaveModal(false)}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button
            variant="primary"
            onClick={handleSavePreset}
            loading={savingPreset}
            disabled={!presetName.trim()}
          >
            {t('admin.filters.savePresetButton', 'Save Preset')}
          </Button>
        </div>
      </Modal>
    </div>
  );
};

// Field-specific editor component
interface FilterFieldEditorProps {
  field: FilterField;
  value?: FilterValue;
  onChange: (value: FilterValue['value'], operator?: FilterValue['operator']) => void;
  onClose: () => void;
}

const FilterFieldEditor: React.FC<FilterFieldEditorProps> = ({
  field,
  value,
  onChange,
  onClose,
}) => {
  const { t } = useTranslation();
  const [localValue, setLocalValue] = useState<FilterValue['value']>(
    value?.value || (field.type === 'multiselect' ? [] : '')
  );

  const handleApply = useCallback(() => {
    onChange(localValue);
  }, [localValue, onChange]);

  return (
    <Modal open={true} onClose={onClose} title={field.label} size="sm">
      <div className="space-y-4">
        {/* Select */}
        {field.type === 'select' && field.options && (
          <select
            value={localValue as string}
            onChange={(e) => setLocalValue(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg text-navy-900 dark:text-white focus:ring-2 focus:ring-c-focus"
          >
            <option value="">{field.placeholder || 'Select...'}</option>
            {field.options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        )}

        {/* Multi-select */}
        {field.type === 'multiselect' && field.options && (
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {field.options.map((opt) => {
              const selected = (localValue as string[]).includes(opt.value);
              return (
                <label
                  key={opt.value}
                  className="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-navy-700 rounded cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setLocalValue([...(localValue as string[]), opt.value]);
                      } else {
                        setLocalValue((localValue as string[]).filter((v) => v !== opt.value));
                      }
                    }}
                    className="w-4 h-4 rounded border-slate-300 dark:border-navy-700 text-primary-600 focus:ring-c-focus"
                  />
                  <span className="text-sm text-navy-900 dark:text-white">{opt.label}</span>
                </label>
              );
            })}
          </div>
        )}

        {/* Text */}
        {field.type === 'text' && (
          <input
            type="text"
            value={localValue as string}
            onChange={(e) => setLocalValue(e.target.value)}
            placeholder={field.placeholder}
            className="w-full px-3 py-2 bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg text-navy-900 dark:text-white focus:ring-2 focus:ring-c-focus"
          />
        )}

        {/* Date */}
        {field.type === 'date' && (
          <input
            type="date"
            value={localValue as string}
            onChange={(e) => setLocalValue(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg text-navy-900 dark:text-white focus:ring-2 focus:ring-c-focus"
          />
        )}

        {/* Date Range */}
        {field.type === 'daterange' && (
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={
                typeof localValue === 'object' && 'start' in localValue ? localValue.start : ''
              }
              onChange={(e) =>
                setLocalValue({
                  start: e.target.value,
                  end: typeof localValue === 'object' && 'end' in localValue ? localValue.end : '',
                })
              }
              className="flex-1 px-3 py-2 bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg text-navy-900 dark:text-white focus:ring-2 focus:ring-c-focus"
            />
            <span className="text-slate-400 dark:text-slate-500">-</span>
            <input
              type="date"
              value={typeof localValue === 'object' && 'end' in localValue ? localValue.end : ''}
              onChange={(e) =>
                setLocalValue({
                  start:
                    typeof localValue === 'object' && 'start' in localValue ? localValue.start : '',
                  end: e.target.value,
                })
              }
              className="flex-1 px-3 py-2 bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg text-navy-900 dark:text-white focus:ring-2 focus:ring-c-focus"
            />
          </div>
        )}
      </div>

      <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-200 dark:border-navy-700">
        <Button variant="outline" onClick={onClose}>
          {t('common.cancel', 'Cancel')}
        </Button>
        <Button variant="primary" onClick={handleApply}>
          {t('admin.filters.apply', 'Apply')}
        </Button>
      </div>
    </Modal>
  );
};

export default AdvancedFilters;
