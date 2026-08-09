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
    <div className="h-full w-full bg-c-surface flex items-center gap-4 flex-shrink-0">
      <span className="text-xs text-c-text-muted">
        {t('presentations.builder.bottomBar.card', 'Card')} {currentIndex + 1}{' '}
        {t('presentations.builder.bottomBar.of', 'of')} {totalCards}
      </span>

      <span className="text-xs font-medium text-c-text-secondary truncate flex-1">{cardTitle}</span>

      <button
        type="button"
        onClick={onQuickEdits}
        className="flex min-h-8 items-center gap-1.5 px-2.5 rounded-lg text-xs text-c-text-muted hover:bg-c-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
      >
        <Sparkles size={12} />
        {t('presentations.builder.bottomBar.quickEdits', 'Ask Teresa')}
      </button>

      <button
        type="button"
        onClick={onToggleNotes}
        aria-pressed={notesOpen}
        className={`flex min-h-8 items-center gap-1.5 px-2.5 rounded-lg text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus ${
          // VF1-7: was crimson `bg-c-accent-soft` — active/toggle state is neutral
          // chrome (canonical c-focus tint, matches RightRail.tsx's active tool style).
          notesOpen
            ? 'bg-c-focus/10 text-c-focus-solid'
            : 'text-c-text-muted hover:bg-c-surface-raised'
        }`}
      >
        <FileText size={12} />
        {t('presentations.builder.bottomBar.notes', 'Notes')}
      </button>
    </div>
  );
};
