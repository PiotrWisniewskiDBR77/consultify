import type { LucideIcon } from 'lucide-react';
import React from 'react';

import { getMenu3AiButtonClass } from '@/components/shared/ModuleHub/menu3ActionButtonStyles';

type Menu3Chip = {
  id: string;
  label: string;
  icon?: React.ReactNode;
  badge?: string | number | null;
  active?: boolean;
};

type Menu3Action = {
  id: string;
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title?: string;
};

interface AssessmentMenu3ActionBarProps {
  chips?: Menu3Chip[];
  actions: Menu3Action[];
  className?: string;
}

const CHIP_BASE =
  'h-8 inline-flex items-center gap-1.5 rounded-full px-2.5 text-[11px] font-medium border transition-colors whitespace-nowrap';

const BADGE_BASE =
  'px-1.5 py-0.5 rounded-full text-[10px] font-semibold tabular-nums leading-none';

export const AssessmentMenu3ActionBar: React.FC<AssessmentMenu3ActionBarProps> = ({
  chips = [],
  actions,
  className = '',
}) => {
  return (
    <div
      className={`flex items-center justify-between gap-3 bg-white dark:bg-navy-900 border-b border-slate-200/60 dark:border-white/5 px-4 py-2 ${className}`}
    >
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar min-w-0">
        {chips.map((chip) => (
          <div
            key={chip.id}
            className={`${CHIP_BASE} ${
              chip.active
                ? 'bg-purple-500/10 text-purple-700 dark:text-purple-200 border-purple-500/40'
                : 'bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-300 border-slate-200/60 dark:border-navy-700/60'
            }`}
          >
            {chip.icon || <span className="h-2 w-2 rounded-full bg-slate-400" />}
            <span className="truncate">{chip.label}</span>
            {chip.badge !== undefined && chip.badge !== null ? (
              <span
                className={`${BADGE_BASE} ${
                  chip.active
                    ? 'bg-purple-500/30 text-purple-700 dark:text-purple-200'
                    : 'bg-slate-200 dark:bg-navy-700 text-slate-600 dark:text-slate-300'
                }`}
              >
                {chip.badge}
              </span>
            ) : null}
          </div>
        ))}
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <button
              key={action.id}
              type="button"
              onClick={action.onClick}
              disabled={action.disabled}
              className={getMenu3AiButtonClass(Boolean(action.active))}
              title={action.title || action.label}
            >
              <Icon size={12} />
              {action.label}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export type { Menu3Action, Menu3Chip };

export default AssessmentMenu3ActionBar;
