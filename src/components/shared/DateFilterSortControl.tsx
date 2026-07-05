import { ArrowDownUp, Calendar } from 'lucide-react';
import React, { useMemo, useState } from 'react';

export type DateFilterOption = {
  id: string;
  label: string;
};

type DateFilterSortControlProps = {
  options: DateFilterOption[];
  value: string;
  onChange: (next: string) => void;
  sortOrder: 'asc' | 'desc';
  onToggleSort: () => void;
  sortAscLabel: string;
  sortDescLabel: string;
  filterButtonTitle: string;
  className?: string;
};

export const DateFilterSortControl: React.FC<DateFilterSortControlProps> = ({
  options,
  value,
  onChange,
  sortOrder,
  onToggleSort,
  sortAscLabel,
  sortDescLabel,
  filterButtonTitle,
  className = '',
}) => {
  const [hoveredControl, setHoveredControl] = useState<'sort' | 'filter' | null>(null);

  const activeOption = useMemo(
    () => options.find((opt) => opt.id === value) || options[0],
    [options, value]
  );

  const cycleFilter = () => {
    if (options.length <= 1) return;
    const currentIndex = Math.max(
      0,
      options.findIndex((opt) => opt.id === value)
    );
    const next = options[(currentIndex + 1) % options.length];
    onChange(next.id);
  };

  const sortHelpLabel = sortOrder === 'asc' ? sortAscLabel : sortDescLabel;
  const sortTooltip = `${sortHelpLabel}`;
  const filterTooltip = `${filterButtonTitle} · ${activeOption?.label || ''}`;

  return (
    <div className={`inline-flex items-center gap-1.5 ${className}`}>
      <div className="relative">
        <button
          type="button"
          onClick={cycleFilter}
          onMouseEnter={() => setHoveredControl('filter')}
          onMouseLeave={() => setHoveredControl(null)}
          onFocus={() => setHoveredControl('filter')}
          onBlur={() => setHoveredControl(null)}
          className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md border border-slate-300/50 dark:border-navy-600/60 text-[10px] text-slate-500 dark:text-slate-400 hover:text-primary-500 hover:border-primary-400/40 transition-colors"
          title={filterTooltip}
        >
          <Calendar size={14} />
          {activeOption?.label || ''}
        </button>
        {hoveredControl === 'filter' && (
          <div className="absolute right-0 -top-10 z-20 whitespace-nowrap rounded-md border border-slate-300/60 dark:border-navy-600/70 bg-white/95 dark:bg-navy-900/95 px-2 py-1 text-[10px] text-slate-600 dark:text-slate-300 shadow-lg">
            {filterTooltip}
          </div>
        )}
      </div>

      <div className="relative">
        <button
          type="button"
          onClick={onToggleSort}
          onMouseEnter={() => setHoveredControl('sort')}
          onMouseLeave={() => setHoveredControl(null)}
          onFocus={() => setHoveredControl('sort')}
          onBlur={() => setHoveredControl(null)}
          className="inline-flex items-center justify-center w-6 h-6 rounded-md border border-slate-300/50 dark:border-navy-600/60 text-slate-500 dark:text-slate-400 hover:text-primary-500 hover:border-primary-400/40 transition-colors"
          title={sortTooltip}
        >
          <ArrowDownUp size={14} />
        </button>
        {hoveredControl === 'sort' && (
          <div className="absolute right-0 -top-10 z-20 whitespace-nowrap rounded-md border border-slate-300/60 dark:border-navy-600/70 bg-white/95 dark:bg-navy-900/95 px-2 py-1 text-[10px] text-slate-600 dark:text-slate-300 shadow-lg">
            {sortTooltip}
          </div>
        )}
      </div>
    </div>
  );
};
