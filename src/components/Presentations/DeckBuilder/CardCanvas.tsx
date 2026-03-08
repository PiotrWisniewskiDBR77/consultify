import { Plus, Sparkles } from 'lucide-react';
import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import type { DeckCard } from '../wizard/types';
import { CardRenderer } from './CardRenderer';

interface CardCanvasProps {
  cards: DeckCard[];
  activeCardIndex: number;
  colorSetId?: string;
  onSelectCard: (index: number) => void;
  onBlockClick?: (cardId: string, blockId: string) => void;
  onAddCard?: (atIndex: number) => void;
  speakerNotes?: string;
  showNotes: boolean;
  animationsEnabled?: boolean;
}

export const CardCanvas: React.FC<CardCanvasProps> = ({
  cards,
  activeCardIndex,
  colorSetId,
  onSelectCard,
  onBlockClick,
  onAddCard,
  speakerNotes,
  showNotes,
  animationsEnabled = true,
}) => {
  const { t } = useTranslation();
  const scrollRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const el = cardRefs.current[activeCardIndex];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [activeCardIndex]);

  return (
    <div className="flex-1 overflow-hidden flex flex-col bg-slate-100 dark:bg-navy-950">
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-8 py-6 space-y-4">
        {cards.map((card, index) => (
          <React.Fragment key={card.card_id}>
            {/* Gap action buttons */}
            {index > 0 && onAddCard && (
              <div className="flex items-center justify-center gap-2 py-1 opacity-0 hover:opacity-100 transition-opacity">
                <button
                  onClick={() => onAddCard(index)}
                  className="flex items-center gap-1 px-2 py-1 rounded text-[10px] text-slate-400 hover:text-purple-500 hover:bg-purple-50 dark:hover:bg-purple-500/10"
                >
                  <Plus size={10} />
                  {t('presentations.builder.addBlank', 'Blank')}
                </button>
                <button
                  onClick={() => onAddCard(index)}
                  className="flex items-center gap-1 px-2 py-1 rounded text-[10px] text-slate-400 hover:text-purple-500 hover:bg-purple-50 dark:hover:bg-purple-500/10"
                >
                  <Sparkles size={10} />
                  {t('presentations.builder.addAi', 'AI')}
                </button>
              </div>
            )}

            {/* Card */}
            <div
              ref={(el) => {
                cardRefs.current[index] = el;
              }}
              onClick={() => onSelectCard(index)}
              className="max-w-4xl mx-auto cursor-pointer"
            >
              <CardRenderer
                card={card}
                colorSetId={colorSetId}
                isActive={index === activeCardIndex}
                onBlockClick={(blockId) => onBlockClick?.(card.card_id, blockId)}
                animationsEnabled={animationsEnabled}
              />
            </div>
          </React.Fragment>
        ))}
      </div>

      {/* Speaker Notes */}
      {showNotes && (
        <div className="h-32 border-t border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 p-3 overflow-y-auto">
          <p className="text-[10px] font-medium text-slate-400 uppercase mb-1">
            {t('presentations.builder.bottomBar.notes', 'Speaker Notes')}
          </p>
          <textarea
            value={speakerNotes || ''}
            readOnly
            placeholder={t(
              'presentations.builder.notesPlaceholder',
              'Speaker notes for this slide...'
            )}
            className="w-full text-sm text-slate-700 dark:text-slate-300 bg-transparent border-none outline-none resize-none"
            rows={4}
          />
        </div>
      )}
    </div>
  );
};
