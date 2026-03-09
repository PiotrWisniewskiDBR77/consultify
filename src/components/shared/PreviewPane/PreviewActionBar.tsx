import type { LucideIcon } from 'lucide-react';
import React from 'react';

import { actionPillClass } from './previewStyles';

type ColorScheme =
  | 'emerald'
  | 'blue'
  | 'purple'
  | 'amber'
  | 'neutral'
  | 'red'
  | 'green'
  | 'primary';

export interface ActionButton {
  label: string;
  icon?: LucideIcon;
  onClick: () => void;
  colorScheme: ColorScheme;
  /** Stretch to fill available space (flex-1) */
  flex?: boolean;
  disabled?: boolean;
  /** Extra CSS classes */
  className?: string;
}

export interface ActionRow {
  buttons: ActionButton[];
  /** Use CSS grid with N columns instead of flex. When omitted, uses flex layout. */
  columns?: number;
}

export interface PreviewActionBarProps {
  rows: ActionRow[];
}

const GRID_COLS: Record<number, string> = {
  2: 'grid-cols-2',
  3: 'grid-cols-3',
  4: 'grid-cols-4',
  5: 'grid-cols-5',
};

export const PreviewActionBar: React.FC<PreviewActionBarProps> = ({ rows }) => (
  <div className="space-y-2.5 py-1">
    {rows.map((row, rowIdx) => {
      const isGrid = row.columns && row.columns > 1;
      const containerClass = isGrid
        ? `grid ${GRID_COLS[row.columns!] ?? `grid-cols-${row.columns}`} gap-2`
        : 'flex gap-2';

      return (
        <div key={rowIdx} className={containerClass}>
          {row.buttons.map((btn, btnIdx) => {
            const Icon = btn.icon;
            return (
              <button
                key={btnIdx}
                onClick={btn.onClick}
                disabled={btn.disabled}
                className={actionPillClass(
                  btn.colorScheme,
                  [
                    btn.flex ? 'flex-1' : '',
                    'w-full',
                    btn.disabled ? 'opacity-50 cursor-not-allowed' : '',
                    btn.className ?? '',
                  ]
                    .filter(Boolean)
                    .join(' ')
                )}
              >
                {Icon ? <Icon size={14} /> : null}
                {btn.label}
              </button>
            );
          })}
        </div>
      );
    })}
  </div>
);

export default PreviewActionBar;
