/**
 * ActiveFilters
 * Row of active filter chips with clear functionality
 */

import { X } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

export interface FilterChip {
  id: string;
  column: string;
  value: string;
  label: string;
  color?: string;
}

interface ActiveFiltersProps {
  filters: FilterChip[];
  onRemoveFilter: (id: string) => void;
  onClearAll: () => void;
}

export const ActiveFilters: React.FC<ActiveFiltersProps> = ({
  filters,
  onRemoveFilter,
  onClearAll,
}) => {
  const { t } = useTranslation();

  if (filters.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 dark:bg-navy-900/50 border-b border-slate-200 dark:border-navy-700">
      {/* [ODMROZENIE STANDARD_TABLE DEC-457] 'Filters:' i 'Clear all' były
          wpisane na sztywno po angielsku — komponent w ogóle nie wołał
          useTranslation. Widoczne wszędzie, gdzie renderuje się pasek
          aktywnych filtrów (ModuleNavBar), np. po wybraniu czipu Menu 3. */}
      <span className="text-[10px] text-slate-500 uppercase tracking-wider">
        {t('common.filtersLabel', 'Filters:')}
      </span>

      <div className="flex items-center gap-2 flex-wrap">
        {filters.map((filter) => (
          <div
            key={filter.id}
            className={`
              flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium
              bg-slate-50 dark:bg-navy-800 border border-slate-300 dark:border-navy-600 text-slate-700 dark:text-slate-300
              ${filter.color ? `border-l-2 ${filter.color}` : ''}
            `}
          >
            <span className="text-slate-500 dark:text-slate-400">{filter.column}:</span>
            <span>{filter.label}</span>
            <button
              onClick={() => onRemoveFilter(filter.id)}
              className="p-0.5 rounded-full hover:bg-slate-200 dark:hover:bg-navy-600 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              <X size={12} />
            </button>
          </div>
        ))}
      </div>

      <button
        onClick={onClearAll}
        className="text-[11px] text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors ml-auto"
      >
        {t('common.clearAll', 'Clear all')}
      </button>
    </div>
  );
};

export default ActiveFilters;
