/**
 * LaneProblemList
 *
 * Left sidebar with scrollable list of grouped problems.
 * Master side of the master-detail pattern inside each lane.
 */

import { AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import type { InsightItem } from './types';

interface ProblemEntry {
  id: string;
  label: string;
  severity: 'info' | 'warning' | 'critical';
  secondaryLabel?: string;
}

interface LaneProblemListProps {
  problems: ProblemEntry[];
  selectedId?: string;
  onSelect: (id: string) => void;
  className?: string;
}

const SEV_ICON: Record<string, React.ElementType> = {
  info: Info,
  warning: AlertTriangle,
  critical: AlertTriangle,
};

const SEV_COLOR: Record<string, string> = {
  info: 'text-slate-400 dark:text-slate-500',
  warning: 'text-amber-500',
  critical: 'text-rose-500',
};

export const LaneProblemList: React.FC<LaneProblemListProps> = ({
  problems,
  selectedId,
  onSelect,
  className = '',
}) => {
  const { i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';

  if (problems.length === 0) {
    return (
      <div className={`flex flex-col items-center justify-center py-8 ${className}`}>
        <CheckCircle2 size={20} className="text-emerald-500 mb-2" />
        <p className="text-xs text-slate-400 dark:text-slate-500">
          {isPolish ? 'Brak problemów' : 'No issues'}
        </p>
      </div>
    );
  }

  return (
    <div className={`space-y-0.5 ${className}`}>
      {problems.map((p) => {
        const SevIcon = SEV_ICON[p.severity] || Info;
        const isSelected = p.id === selectedId;
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => onSelect(p.id)}
            className={`w-full flex items-start gap-2 py-2 px-3 rounded-lg transition-colors text-left ${
              isSelected
                ? 'bg-primary-500/10 dark:bg-primary-500/15'
                : 'hover:bg-slate-50/50 dark:hover:bg-navy-800/30'
            }`}
          >
            <SevIcon size={13} className={`mt-0.5 shrink-0 ${SEV_COLOR[p.severity]}`} />
            <div className="min-w-0 flex-1">
              <p className={`text-xs font-medium ${isSelected ? 'text-primary-600 dark:text-primary-400' : 'text-slate-700 dark:text-slate-200'}`}>
                {p.label}
              </p>
              {p.secondaryLabel && (
                <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate mt-0.5">
                  {p.secondaryLabel}
                </p>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
};

export type { ProblemEntry };
export default LaneProblemList;
