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
    <div className="w-24 rounded-xl bg-c-surface-raised dark:bg-c-surface border border-c-border-subtle dark:border-c-border shadow-xl py-1">
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
                ? 'bg-c-surface-raised dark:bg-c-surface text-c-text dark:text-c-text font-semibold'
                : 'text-c-text-secondary dark:text-c-text hover:bg-c-surface-raised dark:hover:bg-c-surface-raised'
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
