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
  { id: 'topic', iconEl: CircleDot, labelPl: 'Temat', labelEn: 'Topic', color: 'text-c-info' },
  {
    id: 'hypothesis',
    iconEl: Lightbulb,
    labelPl: 'Hipoteza',
    labelEn: 'Hypothesis',
    color: 'text-c-warning',
  },
  { id: 'risk', iconEl: AlertTriangle, labelPl: 'Ryzyko', labelEn: 'Risk', color: 'text-c-danger' },
  {
    id: 'action',
    iconEl: CheckSquare,
    labelPl: 'Akcja',
    labelEn: 'Action',
    color: 'text-c-success',
  },
  {
    id: 'decision',
    iconEl: Diamond,
    labelPl: 'Punkt decyzyjny',
    labelEn: 'Decision point',
    color: 'text-c-accent',
  },
  { id: 'option', iconEl: Star, labelPl: 'Opcja', labelEn: 'Option', color: 'text-c-info' },
  {
    id: 'subtopic',
    iconEl: GitBranch,
    labelPl: 'Podtemat',
    labelEn: 'Subtopic',
    color: 'text-c-text-secondary',
  },
];

export const SemanticTypeDropdown: React.FC<SemanticTypeDropdownProps> = ({
  isPl,
  current,
  onSelect,
  onClose,
}) => {
  return (
    <div className="w-48 rounded-xl bg-c-surface-raised dark:bg-c-surface border border-c-border-subtle dark:border-c-border-subtle shadow-xl py-1">
      <div className="px-2 py-1 text-[9px] font-bold uppercase tracking-[0.15em] text-c-text-secondary">
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
                ? 'bg-c-surface-raised dark:bg-c-surface text-c-text dark:text-c-text font-semibold'
                : 'text-c-text-secondary dark:text-c-text hover:bg-c-surface-raised dark:hover:bg-c-surface-raised'
            }`}
          >
            <Icon
              size={12}
              className={`shrink-0 ${isActive ? t.color : 'text-c-text-secondary'}`}
            />
            {isPl ? t.labelPl : t.labelEn}
          </button>
        );
      })}
    </div>
  );
};
