/**
 * ActiveFilters
 * Row of active filter chips with clear functionality
 */

import { X } from 'lucide-react';
import React from 'react';

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
  if (filters.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-navy-900/50 border-b border-navy-700">
      <span className="text-xs text-slate-500 uppercase tracking-wider">Filters:</span>

      <div className="flex items-center gap-2 flex-wrap">
        {filters.map((filter) => (
          <div
            key={filter.id}
            className={`
              flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium
              bg-navy-800 border border-navy-600 text-slate-300
              ${filter.color ? `border-l-2 ${filter.color}` : ''}
            `}
          >
            <span className="text-slate-500">{filter.column}:</span>
            <span>{filter.label}</span>
            <button
              onClick={() => onRemoveFilter(filter.id)}
              className="p-0.5 rounded-full hover:bg-navy-600 text-slate-400 hover:text-white transition-colors"
            >
              <X size={12} />
            </button>
          </div>
        ))}
      </div>

      <button
        onClick={onClearAll}
        className="text-xs text-slate-500 hover:text-primary-400 transition-colors ml-auto"
      >
        Clear all
      </button>
    </div>
  );
};

export default ActiveFilters;
