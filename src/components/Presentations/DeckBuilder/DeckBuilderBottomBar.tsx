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
    <div className="h-10 border-t border-c-border bg-c-surface flex items-center px-4 gap-4 flex-shrink-0">
      <span className="text-xs text-c-text-muted">
        {t('presentations.builder.bottomBar.card', 'Card')} {currentIndex + 1}{' '}
        {t('presentations.builder.bottomBar.of', 'of')} {totalCards}
      </span>

      <span className="text-xs font-medium text-c-text-secondary truncate flex-1">
        {cardTitle}
      </span>

      <button
        onClick={onQuickEdits}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs text-c-text-muted hover:bg-c-surface-raised"
      >
        <Sparkles size={12} />
        {t('presentations.builder.bottomBar.quickEdits', 'Ask Teresa')}
      </button>

      <button
        onClick={onToggleNotes}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs ${
          notesOpen
            ? 'bg-c-accent-soft text-c-text'
            : 'text-c-text-muted hover:bg-c-surface-raised'
        }`}
      >
        <FileText size={12} />
        {t('presentations.builder.bottomBar.notes', 'Notes')}
      </button>
    </div>
  );
};
