import { FileText, Sparkles } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

interface DeckBuilderBottomBarProps {
  currentIndex: number;
  totalCards: number;
  cardTitle: string;
  onQuickEdits: () => void;
  onToggleNotes: () => void;
  notesOpen: boolean;
}

export const DeckBuilderBottomBar: React.FC<DeckBuilderBottomBarProps> = ({
  currentIndex,
  totalCards,
  cardTitle,
  onQuickEdits,
  onToggleNotes,
  notesOpen,
}) => {
  const { t } = useTranslation();

  return (
    <div className="h-10 border-t border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 flex items-center px-4 gap-4 flex-shrink-0">
      <span className="text-xs text-slate-500 dark:text-slate-400">
        {t('presentations.builder.bottomBar.card', 'Card')} {currentIndex + 1}{' '}
        {t('presentations.builder.bottomBar.of', 'of')} {totalCards}
      </span>

      <span className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate flex-1">
        {cardTitle}
      </span>

      <button
        onClick={onQuickEdits}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-800"
      >
        <Sparkles size={12} />
        {t('presentations.builder.bottomBar.quickEdits', 'Quick edits')}
      </button>

      <button
        onClick={onToggleNotes}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs ${
          notesOpen
            ? 'bg-primary-500/10 text-primary-600'
            : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-800'
        }`}
      >
        <FileText size={12} />
        {t('presentations.builder.bottomBar.notes', 'Notes')}
      </button>
    </div>
  );
};
