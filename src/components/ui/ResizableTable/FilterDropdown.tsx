/**
 * FilterDropdown - Column filter dropdown component
 * Supports multiselect and date range filters
 */

import { AnimatePresence, motion } from 'framer-motion';
import { Calendar, Check, ChevronDown, Filter, X } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';

import type { ColumnDef, DateRange, FilterOption } from './types';

interface FilterDropdownProps {
  column: ColumnDef;
  value: string[] | DateRange | undefined;
  onChange: (value: string[] | DateRange) => void;
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
}

export const FilterDropdown: React.FC<FilterDropdownProps> = ({
  column,
  value,
  onChange,
  isOpen,
  onToggle,
  onClose,
}) => {
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [localValue, setLocalValue] = useState<string[] | DateRange | undefined>(value);

  // Update local value when prop changes
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
    return undefined;
  }, [isOpen, onClose]);

  const handleSelectOption = (optionValue: string) => {
    const currentValues = (localValue as string[]) || [];
    const newValues = currentValues.includes(optionValue)
      ? currentValues.filter((v) => v !== optionValue)
      : [...currentValues, optionValue];
    setLocalValue(newValues);
  };

  const handleApply = () => {
    if (localValue) {
      onChange(localValue);
    }
    onClose();
  };

  const handleClear = () => {
    setLocalValue(undefined);
    onChange([]);
    onClose();
  };

  const activeCount = Array.isArray(value) ? value.length : 0;

  return (
    <div ref={dropdownRef} className="relative">
      {/* Filter Button */}
      <button
        onClick={onToggle}
        className={`
          flex items-center gap-1 p-1 rounded transition-colors
          ${
            activeCount > 0
              ? 'text-[var(--c-info)] bg-[var(--c-info)]/10'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
          }
        `}
        title={`Filter ${column.label}`}
      >
        <Filter size={12} />
        {activeCount > 0 && (
          <span className="text-[10px] font-medium bg-navy-900 text-white px-1 rounded dark:bg-white dark:text-navy-950">
            {activeCount}
          </span>
        )}
        <ChevronDown size={10} className={isOpen ? 'rotate-180' : ''} />
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 top-full mt-1 z-dropdown min-w-[180px] bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 rounded-lg shadow-xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200 dark:border-navy-600">
              <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                Filter by {column.label}
              </span>
              <button
                onClick={onClose}
                className="p-1 rounded hover:bg-slate-100 dark:hover:bg-navy-700 text-slate-500 dark:text-slate-400"
              >
                <X size={12} />
              </button>
            </div>

            {/* Options */}
            {column.filterType === 'multiselect' || column.filterType === 'select' ? (
              <div className="max-h-48 overflow-y-auto py-1">
                {column.filterOptions?.map((option) => {
                  const isSelected = Array.isArray(localValue) && localValue.includes(option.value);
                  return (
                    <button
                      key={option.value}
                      onClick={() => handleSelectOption(option.value)}
                      className={`
                        w-full flex items-center gap-2 px-3 py-1.5 text-left text-sm
                        transition-colors
                        ${
                          isSelected
                            ? 'bg-slate-100 dark:bg-white/[0.08] text-[var(--c-info)] dark:text-[var(--c-info)]'
                            : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-700'
                        }
                      `}
                    >
                      <div
                        className={`
                          w-4 h-4 rounded border flex items-center justify-center
                          ${
                            isSelected
                              ? 'bg-navy-900 border-navy-900 dark:bg-white dark:border-white'
                              : 'border-slate-300 dark:border-navy-500'
                          }
                        `}
                      >
                        {isSelected && <Check size={10} className="text-white" />}
                      </div>
                      {option.icon && <span className="shrink-0">{option.icon}</span>}
                      <span className="truncate">{option.label}</span>
                    </button>
                  );
                })}
              </div>
            ) : column.filterType === 'daterange' ? (
              <div className="p-3">
                <div className="flex flex-col gap-2">
                  <div>
                    <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">
                      From
                    </label>
                    <input
                      type="date"
                      className="w-full px-2 py-1 text-sm rounded border border-slate-200 dark:border-navy-600 bg-white dark:bg-navy-700 text-slate-900 dark:text-white"
                      value={(localValue as DateRange)?.from?.toISOString().split('T')[0] || ''}
                      onChange={(e) =>
                        setLocalValue({
                          ...(localValue as DateRange),
                          from: e.target.value ? new Date(e.target.value) : null,
                        })
                      }
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">
                      To
                    </label>
                    <input
                      type="date"
                      className="w-full px-2 py-1 text-sm rounded border border-slate-200 dark:border-navy-600 bg-white dark:bg-navy-700 text-slate-900 dark:text-white"
                      value={(localValue as DateRange)?.to?.toISOString().split('T')[0] || ''}
                      onChange={(e) =>
                        setLocalValue({
                          ...(localValue as DateRange),
                          to: e.target.value ? new Date(e.target.value) : null,
                        })
                      }
                    />
                  </div>
                </div>
              </div>
            ) : null}

            {/* Footer */}
            <div className="flex items-center justify-between px-3 py-2 border-t border-slate-200 dark:border-navy-600 bg-slate-50 dark:bg-navy-900/50">
              <button
                onClick={handleClear}
                className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              >
                Clear
              </button>
              <button
                onClick={handleApply}
                className="px-3 py-1 text-xs font-medium bg-navy-900 text-white rounded hover:bg-navy-800 transition-colors dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF]"
              >
                Apply
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default FilterDropdown;
