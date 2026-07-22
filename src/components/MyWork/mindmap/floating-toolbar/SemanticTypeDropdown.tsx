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
import { useTranslation } from 'react-i18next';

interface SemanticTypeDropdownProps {
  isPl: boolean;
  current?: string;
  onSelect: (type: string) => void;
  onClose: () => void;
}

export const SEMANTIC_TYPE_OPTIONS = [
  { id: 'topic', iconEl: CircleDot, labelEn: 'Topic', color: 'text-c-info' },
  {
    id: 'hypothesis',
    iconEl: Lightbulb,
    labelEn: 'Hypothesis',
    color: 'text-c-warning',
  },
  { id: 'risk', iconEl: AlertTriangle, labelEn: 'Risk', color: 'text-c-danger' },
  {
    id: 'action',
    iconEl: CheckSquare,
    labelEn: 'Action',
    color: 'text-c-success',
  },
  {
    id: 'decision',
    iconEl: Diamond,
    labelEn: 'Decision point',
    color: 'text-c-tag-2',
  },
  { id: 'option', iconEl: Star, labelEn: 'Option', color: 'text-c-info' },
  {
    id: 'subtopic',
    iconEl: GitBranch,
    labelEn: 'Subtopic',
    color: 'text-c-text-secondary',
  },
];

export const SemanticTypeDropdown: React.FC<SemanticTypeDropdownProps> = ({
  isPl: _isPl,
  current,
  onSelect,
  onClose,
}) => {
  const { t } = useTranslation();
  return (
    <div className="w-48 rounded-xl bg-c-surface-raised dark:bg-c-surface border border-c-border-subtle dark:border-c-border-subtle shadow-xl py-1">
      <div className="px-2 py-1 text-[9px] font-bold uppercase tracking-[0.15em] text-c-text-secondary">
        {t('ideas.mindmap.nodeType', 'Node type')}
      </div>
      {SEMANTIC_TYPE_OPTIONS.map((opt) => {
        const Icon = opt.iconEl;
        const isActive = current === opt.id;
        return (
          <button
            key={opt.id}
            onClick={() => {
              onSelect(opt.id);
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
              className={`shrink-0 ${isActive ? opt.color : 'text-c-text-secondary'}`}
            />
            {t(`myWorkMindmap.semanticType.${opt.id}`, opt.labelEn)}
          </button>
        );
      })}
    </div>
  );
};
