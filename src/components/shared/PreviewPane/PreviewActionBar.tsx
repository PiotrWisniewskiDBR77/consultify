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
  /** Single-key shortcut displayed as a badge (e.g. "T" for Triage). Handled by TableWithPreviewLayout. */
  shortcut?: string;
}

export interface ActionRow {
  buttons?: ActionButton[];
  /** Use CSS grid with N columns instead of flex. When omitted, uses flex layout. */
  columns?: number;
  id?: string;
  label?: string;
  onClick?: () => void;
  variant?: 'primary' | 'secondary';
}

export interface PreviewActionBarProps {
  rows?: ActionRow[];
  actions?: ActionRow[];
}

const GRID_COLS: Record<number, string> = {
  2: 'grid-cols-2',
  3: 'grid-cols-3',
  4: 'grid-cols-4',
  5: 'grid-cols-5',
};

export const PreviewActionBar: React.FC<PreviewActionBarProps> = ({ rows, actions }) => {
  const resolvedRows: Array<{ buttons: ActionButton[]; columns?: number }> = (
    rows ??
    actions ??
    []
  ).map((row) =>
    row.buttons
      ? { buttons: row.buttons, columns: row.columns }
      : {
          buttons: [
            {
              label: row.label || '',
              onClick: row.onClick || (() => undefined),
              colorScheme: row.variant === 'primary' ? 'primary' : 'neutral',
              disabled: false,
            },
          ],
          columns: row.columns,
        }
  );

  return (
    <div className="space-y-2.5 py-1">
      {resolvedRows.map((row, rowIdx) => {
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
                  {btn.shortcut ? (
                    <kbd className="ml-1 inline-flex items-center justify-center h-4 min-w-[16px] px-1 rounded text-[9px] font-semibold leading-none bg-black/[0.06] dark:bg-white/[0.08] text-current opacity-60">
                      {btn.shortcut}
                    </kbd>
                  ) : null}
                </button>
              );
            })}
          </div>
        );
      })}
    </div>
  );
};

export default PreviewActionBar;
