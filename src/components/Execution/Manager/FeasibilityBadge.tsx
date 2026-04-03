/**
 * FeasibilityBadge
 *
 * Visual badge for suggestion feasibility classification.
 * Four levels from "can do now" to "not possible at this time".
 */

import { CheckCircle2, Crown, ShieldAlert, Timer } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import type { SuggestionFeasibility } from './types';

const CONFIG: Record<SuggestionFeasibility, {
  icon: React.ElementType;
  bg: string;
  text: string;
  labelEn: string;
  labelPl: string;
}> = {
  immediate: {
    icon: CheckCircle2,
    bg: 'bg-emerald-500/10 dark:bg-emerald-500/15',
    text: 'text-emerald-700 dark:text-emerald-300',
    labelEn: 'Immediate',
    labelPl: 'Do realizacji',
  },
  manager_decision: {
    icon: Timer,
    bg: 'bg-amber-500/10 dark:bg-amber-500/15',
    text: 'text-amber-700 dark:text-amber-300',
    labelEn: 'Manager Decision',
    labelPl: 'Decyzja managera',
  },
  leadership_decision: {
    icon: Crown,
    bg: 'bg-purple-500/10 dark:bg-purple-500/15',
    text: 'text-purple-700 dark:text-purple-300',
    labelEn: 'Leadership Decision',
    labelPl: 'Decyzja kierownictwa',
  },
  not_feasible_now: {
    icon: ShieldAlert,
    bg: 'bg-slate-400/10 dark:bg-slate-400/15',
    text: 'text-slate-500 dark:text-slate-400',
    labelEn: 'Not Feasible Now',
    labelPl: 'Niewykonalne teraz',
  },
};

interface FeasibilityBadgeProps {
  feasibility: SuggestionFeasibility;
  compact?: boolean;
  className?: string;
}

export const FeasibilityBadge: React.FC<FeasibilityBadgeProps> = ({
  feasibility,
  compact = false,
  className = '',
}) => {
  const { i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';
  const cfg = CONFIG[feasibility];
  const Icon = cfg.icon;
  const label = isPolish ? cfg.labelPl : cfg.labelEn;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-lg font-medium ${cfg.bg} ${cfg.text} ${
        compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-[11px]'
      } ${className}`}
    >
      <Icon size={compact ? 10 : 12} />
      {label}
    </span>
  );
};

export default FeasibilityBadge;
