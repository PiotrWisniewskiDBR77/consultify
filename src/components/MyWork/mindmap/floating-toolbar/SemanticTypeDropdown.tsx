import {
  AlertTriangle,
  CheckSquare,
  CircleDot,
  Diamond,
  GitBranch,
  Lightbulb,
  Star,
} from 'lucide-react';
import React from 'react';

interface SemanticTypeDropdownProps {
  isPl: boolean;
  current?: string;
  onSelect: (type: string) => void;
  onClose: () => void;
}

export const SEMANTIC_TYPE_OPTIONS = [
  { id: 'topic', iconEl: CircleDot, labelPl: 'Temat', labelEn: 'Topic', color: 'text-blue-500' },
  {
    id: 'hypothesis',
    iconEl: Lightbulb,
    labelPl: 'Hipoteza',
    labelEn: 'Hypothesis',
    color: 'text-amber-500',
  },
  { id: 'risk', iconEl: AlertTriangle, labelPl: 'Ryzyko', labelEn: 'Risk', color: 'text-danger-500' },
  {
    id: 'action',
    iconEl: CheckSquare,
    labelPl: 'Akcja',
    labelEn: 'Action',
    color: 'text-green-500',
  },
  {
    id: 'decision',
    iconEl: Diamond,
    labelPl: 'Punkt decyzyjny',
    labelEn: 'Decision point',
    color: 'text-primary-500',
  },
  { id: 'option', iconEl: Star, labelPl: 'Opcja', labelEn: 'Option', color: 'text-blue-500' },
  {
    id: 'subtopic',
    iconEl: GitBranch,
    labelPl: 'Podtemat',
    labelEn: 'Subtopic',
    color: 'text-slate-500',
  },
];

export const SemanticTypeDropdown: React.FC<SemanticTypeDropdownProps> = ({
  isPl,
  current,
  onSelect,
  onClose,
}) => {
  return (
    <div className="w-48 rounded-xl bg-white dark:bg-navy-900 border border-slate-200/60 dark:border-white/[0.06] shadow-xl py-1">
      <div className="px-2 py-1 text-[9px] font-bold uppercase tracking-[0.15em] text-slate-600">
        {isPl ? 'Typ węzła' : 'Node type'}
      </div>
      {SEMANTIC_TYPE_OPTIONS.map((t) => {
        const Icon = t.iconEl;
        const isActive = current === t.id;
        return (
          <button
            key={t.id}
            onClick={() => {
              onSelect(t.id);
              onClose();
            }}
            className={`w-full flex items-center gap-2 px-2 py-1.5 text-[11px] transition-colors ${
              isActive
                ? 'bg-slate-200/70 dark:bg-navy-800 text-slate-900 dark:text-slate-100 font-semibold'
                : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/[0.03]'
            }`}
          >
            <Icon size={12} className={`shrink-0 ${isActive ? t.color : 'text-slate-600'}`} />
            {isPl ? t.labelPl : t.labelEn}
          </button>
        );
      })}
    </div>
  );
};
