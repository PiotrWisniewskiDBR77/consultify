import {
  AlertTriangle,
  CheckSquare,
  CircleDot,
  Diamond,
  GitBranch,
  Lightbulb,
  Plus,
  Star,
} from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

interface AddNodePopoverProps {
  isPl: boolean;
  hasSelection: boolean;
  onAction: (action: string) => void;
  onClose: () => void;
}

const STRUCTURE_ACTIONS = [
  {
    action: 'mm_add_child',
    iconEl: Plus,
    tkey: 'myWorkMindmap.addNode.addChildTab',
    labelEn: 'Add child (Tab)',
  },
  {
    action: 'mm_add_sibling',
    iconEl: Plus,
    tkey: 'myWorkMindmap.addNode.addSiblingEnter',
    labelEn: 'Add sibling (Enter)',
  },
  {
    action: 'mm_add_root',
    iconEl: GitBranch,
    tkey: 'myWorkMindmap.addNode.newRootTopic',
    labelEn: 'New root topic',
  },
];

const SEMANTIC_TYPES = [
  {
    action: 'mm_insert_topic',
    iconEl: CircleDot,
    tkey: 'myWorkMindmap.semanticType.topic',
    labelEn: 'Topic',
  },
  {
    action: 'mm_insert_hypothesis',
    iconEl: Lightbulb,
    tkey: 'myWorkMindmap.semanticType.hypothesis',
    labelEn: 'Hypothesis',
  },
  {
    action: 'mm_insert_risk',
    iconEl: AlertTriangle,
    tkey: 'myWorkMindmap.semanticType.risk',
    labelEn: 'Risk',
  },
  {
    action: 'mm_insert_action',
    iconEl: CheckSquare,
    tkey: 'myWorkMindmap.semanticType.action',
    labelEn: 'Action',
  },
  {
    action: 'mm_insert_decision',
    iconEl: Diamond,
    tkey: 'myWorkMindmap.semanticType.decision',
    labelEn: 'Decision point',
  },
  {
    action: 'mm_insert_option',
    iconEl: Star,
    tkey: 'myWorkMindmap.semanticType.option',
    labelEn: 'Option',
  },
];

export const AddNodePopover: React.FC<AddNodePopoverProps> = ({
  isPl: _isPl,
  hasSelection,
  onAction,
  onClose,
}) => {
  const { t } = useTranslation();
  const dispatch = (action: string) => {
    onAction(action);
    onClose();
  };

  return (
    <div className="w-56 rounded-xl bg-c-surface-raised dark:bg-c-surface border border-c-border-subtle dark:border-c-border-subtle shadow-xl">
      <div className="px-1 py-1">
        <div className="px-2 py-1 text-[9px] font-bold uppercase tracking-[0.15em] text-c-text-secondary">
          {t('ideas.mindmap.add', 'Add')}
        </div>
        {STRUCTURE_ACTIONS.map((a) => {
          const Icon = a.iconEl;
          const disabled =
            (a.action === 'mm_add_child' || a.action === 'mm_add_sibling') && !hasSelection;
          return (
            <button
              key={a.action}
              onClick={() => dispatch(a.action)}
              disabled={disabled}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-[11px] text-c-text-secondary dark:text-c-text hover:bg-c-surface-raised dark:hover:bg-c-surface-raised transition-colors disabled:opacity-40"
            >
              <Icon size={12} className="text-c-text-secondary shrink-0" />
              {t(a.tkey, a.labelEn)}
            </button>
          );
        })}
      </div>
      <div className="border-t border-c-border-subtle dark:border-c-border-subtle px-1 py-1">
        <div className="px-2 py-1 text-[9px] font-bold uppercase tracking-[0.15em] text-c-text-secondary">
          {t('ideas.mindmap.insertSpecial', 'Insert special')}
        </div>
        {SEMANTIC_TYPES.map((a) => {
          const Icon = a.iconEl;
          return (
            <button
              key={a.action}
              onClick={() => dispatch(a.action)}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-[11px] text-c-text-secondary dark:text-c-text hover:bg-c-surface-raised dark:hover:bg-c-surface-raised transition-colors"
            >
              <Icon size={12} className="text-c-text-secondary shrink-0" />
              {t(a.tkey, a.labelEn)}
            </button>
          );
        })}
      </div>
    </div>
  );
};
