import { Layout, Plus, RefreshCw, Sparkles } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { DeckCard } from '../wizard/types';
import { CardRenderer } from './CardRenderer';

const LAYOUTS = [
  { id: 'full', label: 'Full', icon: '▢' },
  { id: 'left-right', label: 'Left / Right', icon: '▤' },
  { id: 'right-left', label: 'Right / Left', icon: '▥' },
  { id: 'top-bottom', label: 'Top / Bottom', icon: '▦' },
  { id: 'overlay', label: 'Overlay', icon: '▣' },
];

interface CardCanvasProps {
  cards: DeckCard[];
  activeCardIndex: number;
  colorSetId?: string;
  onSelectCard: (index: number) => void;
  onBlockClick?: (cardId: string, blockId: string) => void;
  onAddCard?: (atIndex: number) => void;
  onRegenerateCard?: (cardIndex: number) => Promise<void>;
  onChangeLayout?: (cardIndex: number, layoutId: string) => void;
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
  onRegenerateCard,
  onChangeLayout,
  speakerNotes,
  showNotes,
  animationsEnabled = true,
}) => {
  const { t } = useTranslation();
  const scrollRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [regeneratingIndex, setRegeneratingIndex] = useState<number | null>(null);
  const [layoutMenuIndex, setLayoutMenuIndex] = useState<number | null>(null);

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
                  className="flex items-center gap-1 px-2 py-1 rounded text-[10px] text-slate-600 hover:text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-500/10"
                >
                  <Plus size={10} />
                  {t('presentations.builder.addBlank', 'Blank')}
                </button>
                <button
                  onClick={() => onAddCard(index)}
                  className="flex items-center gap-1 px-2 py-1 rounded text-[10px] text-slate-600 hover:text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-500/10"
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
              className="max-w-4xl mx-auto cursor-pointer relative group"
            >
              <CardRenderer
                card={card}
                colorSetId={colorSetId}
                isActive={index === activeCardIndex}
                onBlockClick={(blockId) => onBlockClick?.(card.card_id, blockId)}
                animationsEnabled={animationsEnabled}
              />
              {(onRegenerateCard || onChangeLayout) && (
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10 flex items-center gap-1">
                  {onChangeLayout && (
                    <div className="relative">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setLayoutMenuIndex((prev) => (prev === index ? null : index));
                        }}
                        title={t('presentations.builder.alternativeLayout', 'Alternative layout')}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium bg-white dark:bg-navy-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-700 border border-slate-200 dark:border-navy-600 shadow-lg"
                      >
                        <Layout size={11} />
                      </button>
                      {layoutMenuIndex === index && (
                        <div
                          className="absolute top-full mt-1 right-0 bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-lg shadow-xl p-1.5 flex gap-1 z-50"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {LAYOUTS.map((l) => (
                            <button
                              key={l.id}
                              onClick={() => {
                                onChangeLayout(index, l.id);
                                setLayoutMenuIndex(null);
                              }}
                              className={`w-8 h-7 rounded border text-[10px] font-mono flex items-center justify-center ${
                                card.layout_id === l.id
                                  ? 'border-primary-500 bg-primary-50 dark:bg-primary-500/10 text-primary-600'
                                  : 'border-slate-200 dark:border-navy-700 text-slate-500 hover:border-slate-300 dark:hover:border-navy-500'
                              }`}
                              title={l.label}
                            >
                              {l.icon}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  {onRegenerateCard && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (regeneratingIndex === index) return;
                        setRegeneratingIndex(index);
                        onRegenerateCard(index).finally(() => setRegeneratingIndex(null));
                      }}
                      disabled={regeneratingIndex === index}
                      title={t('presentations.builder.regenerateSlide', 'Regenerate slide')}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium bg-navy-900 text-white dark:bg-slate-50 dark:text-navy-950 dark:hover:bg-slate-200 hover:bg-navy-800 disabled:opacity-60 disabled:cursor-not-allowed shadow-lg"
                    >
                      <RefreshCw
                        size={11}
                        className={regeneratingIndex === index ? 'animate-spin' : ''}
                      />
                      {regeneratingIndex === index
                        ? t('presentations.builder.regenerating', 'Regenerating…')
                        : t('presentations.builder.regenerateSlide', 'Regenerate')}
                    </button>
                  )}
                </div>
              )}
            </div>
          </React.Fragment>
        ))}
      </div>

      {/* Speaker Notes */}
      {showNotes && (
        <div className="h-32 border-t border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 p-3 overflow-y-auto">
          <p className="text-[10px] font-medium text-slate-600 uppercase mb-1">
            {t('presentations.builder.bottomBar.notes', 'Speaker Notes')}
          </p>
          <textarea
            value={speakerNotes || ''}
            readOnly
            placeholder={t(
              'presentations.builder.notesPlaceholder',
              'Speaker notes for this slide...'
            )}
            className="w-full text-sm text-slate-700 dark:text-slate-300 bg-transparent border-none outline-none focus:ring-1 focus:ring-primary-500/20 resize-none"
            rows={4}
          />
        </div>
      )}
    </div>
  );
};
