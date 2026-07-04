/**
 * PriorityPicker — a single-select chip row (NOT a dropdown).
 *
 * Four rounded-full buttons (Low / Medium / High / Urgent), each with an icon
 * and a color tint. One click selects. Labels localize PL/EN via `isPolish`.
 * Replaces the "ugly" native <select> for priority.
 */

import { AlertTriangle, ArrowDown, ArrowUp, Minus } from 'lucide-react';
import React from 'react';

import { cn } from '@/utils/cn';

export type Priority = 'low' | 'medium' | 'high' | 'urgent';

interface PriorityMeta {
  value: Priority;
  labelEn: string;
  labelPl: string;
  icon: React.ReactNode;
  /** Tailwind classes applied when this chip is active. */
  active: string;
}

const PRIORITIES: PriorityMeta[] = [
  {
    value: 'low',
    labelEn: 'Low',
    labelPl: 'Niski',
    icon: <ArrowDown size={14} />,
    active: 'border-slate-400 bg-slate-500/15 text-slate-700 dark:text-slate-200',
  },
  {
    value: 'medium',
    labelEn: 'Medium',
    labelPl: 'Średni',
    icon: <Minus size={14} />,
    active: 'border-blue-400 bg-blue-500/15 text-blue-600 dark:text-blue-300',
  },
  {
    value: 'high',
    labelEn: 'High',
    labelPl: 'Wysoki',
    icon: <ArrowUp size={14} />,
    active: 'border-amber-400 bg-amber-500/15 text-amber-600 dark:text-amber-300',
  },
  {
    value: 'urgent',
    labelEn: 'Urgent',
    labelPl: 'Pilny',
    icon: <AlertTriangle size={14} />,
    active: 'border-danger-400 bg-danger-500/15 text-danger-600 dark:text-danger-300',
  },
];

export interface PriorityPickerProps {
  value: Priority;
  onChange: (value: Priority) => void;
  isPolish?: boolean;
  className?: string;
}

const BASE_CHIP =
  'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium ' +
  'transition-colors focus:outline-none focus:ring-2 focus:ring-c-focus';

const INACTIVE_CHIP =
  'border-slate-200/70 dark:border-white/[0.08] bg-white/70 dark:bg-white/[0.04] ' +
  'text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-c-border';

export const PriorityPicker: React.FC<PriorityPickerProps> = ({
  value,
  onChange,
  isPolish,
  className,
}) => (
  <div className={cn('flex flex-wrap gap-2', className)} role="radiogroup">
    {PRIORITIES.map((p) => {
      const isActive = p.value === value;
      return (
        <button
          key={p.value}
          type="button"
          role="radio"
          aria-checked={isActive}
          onClick={() => onChange(p.value)}
          className={cn(BASE_CHIP, isActive ? p.active : INACTIVE_CHIP)}
        >
          {p.icon}
          {isPolish ? p.labelPl : p.labelEn}
        </button>
      );
    })}
  </div>
);

export default PriorityPicker;
