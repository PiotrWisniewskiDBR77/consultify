import { BookOpen, FileText, MessageSquare, Shield, Star } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

interface KnowledgePopoverProps {
  isPl: boolean;
  onAction: (action: string) => void;
  onClose: () => void;
}

const KNOWLEDGE_CARDS = [
  {
    action: 'mm_add_knowledge',
    iconEl: FileText,
    labelPl: 'Karta wiedzy',
    labelEn: 'Knowledge card',
  },
  { action: 'mm_add_note', iconEl: Star, labelPl: 'Notatka', labelEn: 'Note card' },
  {
    action: 'mm_add_evidence',
    iconEl: Shield,
    labelPl: 'Dowód / Evidence',
    labelEn: 'Evidence card',
  },
];

const FROM_PLATFORM = [
  {
    action: 'mm_insert_from_notebook',
    iconEl: BookOpen,
    labelPl: 'Wstaw z Notebook',
    labelEn: 'Insert from Notebook',
  },
  {
    action: 'mm_insert_from_interview',
    iconEl: MessageSquare,
    labelPl: 'Wstaw z Interview',
    labelEn: 'Insert from Interview',
  },
];

export const KnowledgePopover: React.FC<KnowledgePopoverProps> = ({ isPl, onAction, onClose }) => {
  const { t } = useTranslation();
  const dispatch = (action: string) => {
    onAction(action);
    onClose();
  };

  return (
    <div className="w-56 rounded-xl bg-c-surface-raised dark:bg-c-surface border border-c-border-subtle dark:border-c-border-subtle shadow-xl">
      <div className="px-1 py-1">
        <div className="px-2 py-1 text-[9px] font-bold uppercase tracking-[0.15em] text-c-text-secondary">
          {t('ideas.mindmap.knowledgeCards', 'Knowledge cards')}
        </div>
        {KNOWLEDGE_CARDS.map((a) => {
          const Icon = a.iconEl;
          return (
            <button
              key={a.action}
              onClick={() => dispatch(a.action)}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-[11px] text-c-text-secondary dark:text-c-text hover:bg-c-surface-raised dark:hover:bg-c-surface-raised transition-colors"
            >
              <Icon size={12} className="text-c-text-secondary shrink-0" />
              {isPl ? a.labelPl : a.labelEn}
            </button>
          );
        })}
      </div>
      <div className="border-t border-c-border-subtle dark:border-c-border-subtle px-1 py-1">
        <div className="px-2 py-1 text-[9px] font-bold uppercase tracking-[0.15em] text-c-text-secondary">
          {t('ideas.mindmap.fromPlatform', 'From platform')}
        </div>
        {FROM_PLATFORM.map((a) => {
          const Icon = a.iconEl;
          return (
            <button
              key={a.action}
              onClick={() => dispatch(a.action)}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-[11px] text-c-text-secondary dark:text-c-text hover:bg-c-surface-raised dark:hover:bg-c-surface-raised transition-colors"
            >
              <Icon size={12} className="text-c-text-secondary shrink-0" />
              {isPl ? a.labelPl : a.labelEn}
            </button>
          );
        })}
      </div>
    </div>
  );
};
