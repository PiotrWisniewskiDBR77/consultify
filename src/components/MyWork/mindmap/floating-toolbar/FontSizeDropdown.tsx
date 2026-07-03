import React from 'react';

interface FontSizeDropdownProps {
  current?: number;
  onSelect: (size: number) => void;
  onClose: () => void;
}

const SIZES = [10, 12, 14, 18, 24, 36, 48];

export const FontSizeDropdown: React.FC<FontSizeDropdownProps> = ({
  current = 14,
  onSelect,
  onClose,
}) => {
  return (
    <div className="w-24 rounded-xl bg-white dark:bg-navy-900 border border-slate-200/60 dark:border-white/[0.06] shadow-xl py-1">
      {SIZES.map((s) => {
        const isActive = current === s;
        return (
          <button
            key={s}
            onClick={() => {
              onSelect(s);
              onClose();
            }}
            className={`w-full px-3 py-1.5 text-left transition-colors ${
              isActive
                ? 'bg-slate-200/70 dark:bg-navy-800 text-slate-900 dark:text-slate-100 font-semibold'
                : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/[0.03]'
            }`}
            style={{ fontSize: Math.min(s, 20) }}
          >
            {s}
          </button>
        );
      })}
    </div>
  );
};
