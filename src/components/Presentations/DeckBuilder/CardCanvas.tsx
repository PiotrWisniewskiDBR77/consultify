import { Plus, RefreshCw, Sparkles } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { CardBlock, DeckCard } from '../wizard/types';
import { CardRenderer } from './CardRenderer';

interface CardCanvasProps {
  cards: DeckCard[];
  activeCardIndex: number;
  colorSetId?: string;
  onSelectCard: (index: number) => void;
  onBlockClick?: (cardId: string, blockId: string) => void;
  onAddCard?: (atIndex: number) => void;
  /**
   * R4 — Free-text AI rewrite of a single slide. `instruction` is the optional
   * author directive ("make this punchier", "add a risk callout"…). Empty =
   * plain regenerate of the slide's narrative copy.
   */
  onRewriteCard?: (cardIndex: number, instruction?: string) => Promise<void>;
  speakerNotes?: string;
  onSpeakerNotesChange?: (value: string) => void;
  showNotes: boolean;
  animationsEnabled?: boolean;
  /** Fala 1 (manual mode) — selected block (id only; unique across the deck). */
  selectedBlockId?: string | null;
  onBlockUpdate?: (cardId: string, blockId: string, updates: Partial<CardBlock>) => void;
  onBlockDelete?: (cardId: string, blockId: string) => void;
  onBlockDuplicate?: (cardId: string, blockId: string) => void;
  onBlockMove?: (cardId: string, blockId: string, direction: 'up' | 'down') => void;
  onBlockRefresh?: (cardId: string, blockId: string) => void;
}

export const CardCanvas: React.FC<CardCanvasProps> = ({
  cards,
  activeCardIndex,
  colorSetId,
  onSelectCard,
  onBlockClick,
  onAddCard,
  onRewriteCard,
  speakerNotes,
  onSpeakerNotesChange,
  showNotes,
  animationsEnabled = true,
  selectedBlockId = null,
  onBlockUpdate,
  onBlockDelete,
  onBlockDuplicate,
  onBlockMove,
  onBlockRefresh,
}) => {
  const { t } = useTranslation();
  const scrollRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [regeneratingIndex, setRegeneratingIndex] = useState<number | null>(null);
  const [instructions, setInstructions] = useState<Record<number, string>>({});

  useEffect(() => {
    const el = cardRefs.current[activeCardIndex];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [activeCardIndex]);

  const runRewrite = (index: number, instruction?: string) => {
    if (!onRewriteCard || regeneratingIndex === index) return;
    setRegeneratingIndex(index);
    onRewriteCard(index, instruction).finally(() => {
      setRegeneratingIndex(null);
      if (instruction) {
        setInstructions((prev) => {
          const next = { ...prev };
          delete next[index];
          return next;
        });
      }
    });
  };

  return (
    <div className="flex-1 overflow-hidden flex flex-col bg-c-bg">
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-8 py-6 space-y-4">
        {cards.map((card, index) => (
          <React.Fragment key={card.card_id}>
            {/* Gap action buttons */}
            {index > 0 && onAddCard && (
              <div className="flex items-center justify-center gap-2 py-1 opacity-0 hover:opacity-100 transition-opacity">
                <button
                  onClick={() => onAddCard(index)}
                  className="flex items-center gap-1 px-2 py-1 rounded text-[10px] text-c-text-secondary hover:text-c-text hover:bg-c-surface-raised"
                >
                  <Plus size={10} />
                  {t('presentations.builder.addBlank', 'Blank')}
                </button>
                <button
                  onClick={() => onAddCard(index)}
                  className="flex items-center gap-1 px-2 py-1 rounded text-[10px] text-c-text-secondary hover:text-c-text hover:bg-c-surface-raised"
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
                editable
                selectedBlockId={selectedBlockId}
                onBlockUpdate={(blockId, updates) =>
                  onBlockUpdate?.(card.card_id, blockId, updates)
                }
                onBlockDelete={(blockId) => onBlockDelete?.(card.card_id, blockId)}
                onBlockDuplicate={(blockId) => onBlockDuplicate?.(card.card_id, blockId)}
                onBlockMove={(blockId, direction) =>
                  onBlockMove?.(card.card_id, blockId, direction)
                }
                onBlockRefresh={(blockId) => onBlockRefresh?.(card.card_id, blockId)}
              />
              {onRewriteCard && (
                <>
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10 flex items-center gap-1">
                    <button
                      data-testid="deck-regenerate-slide"
                      onClick={(e) => {
                        e.stopPropagation();
                        runRewrite(index);
                      }}
                      disabled={regeneratingIndex === index}
                      title={t('presentations.builder.regenerateSlide', 'Regenerate slide')}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium bg-c-text text-c-surface hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed shadow-lg"
                    >
                      <RefreshCw
                        size={11}
                        className={regeneratingIndex === index ? 'animate-spin' : ''}
                      />
                      {regeneratingIndex === index
                        ? t('presentations.builder.regenerating', 'Regenerating…')
                        : t('presentations.builder.regenerateSlide', 'Regenerate')}
                    </button>
                  </div>

                  {/* R4 — inline free-text rewrite input (appears on hover) */}
                  <div
                    className="absolute bottom-2 left-1/2 -translate-x-1/2 w-[min(28rem,90%)] opacity-0 group-hover:opacity-100 transition-opacity z-10"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center gap-1.5 bg-c-surface border border-slate-200/60 dark:border-white/[0.03] rounded-lg shadow-lg px-2 py-1.5">
                      {/* KANON KOLORU (CLAUDE.md §UI.3): ikona to DEKORACJA pola
                          „przerób slajd", nie semantyka krytyczna — token akcentu
                          (crimson) zabroniony. Neutralne text-c-text-secondary,
                          jak Sparkles w KimiWorkspaceShell. */}
                      <Sparkles size={13} className="text-c-text-secondary shrink-0" />
                      <input
                        type="text"
                        value={instructions[index] ?? ''}
                        disabled={regeneratingIndex === index}
                        onChange={(e) =>
                          setInstructions((prev) => ({ ...prev, [index]: e.target.value }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            const value = (instructions[index] ?? '').trim();
                            if (value) runRewrite(index, value);
                          }
                        }}
                        placeholder={t(
                          'presentations.builder.rewritePlaceholder',
                          'Przerób ten slajd…'
                        )}
                        className="flex-1 text-sm bg-transparent border-none outline-none text-c-text placeholder:text-c-text-muted disabled:opacity-60"
                      />
                      <button
                        onClick={() => {
                          const value = (instructions[index] ?? '').trim();
                          if (value) runRewrite(index, value);
                        }}
                        disabled={
                          regeneratingIndex === index || !(instructions[index] ?? '').trim()
                        }
                        title={t('presentations.builder.rewriteSlide', 'Rewrite slide')}
                        className="shrink-0 px-2 py-1 rounded-md text-[11px] font-medium bg-c-accent-soft0 text-c-text hover:bg-c-accent-soft disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {regeneratingIndex === index
                          ? t('presentations.builder.regenerating', 'Regenerating…')
                          : t('presentations.builder.rewriteSend', 'Send')}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </React.Fragment>
        ))}
      </div>

      {/* Speaker Notes */}
      {showNotes && (
        <div className="h-32 border-t border-c-border-subtle bg-c-surface p-3 overflow-y-auto">
          <p className="text-[10px] font-medium text-c-text-secondary uppercase mb-1">
            {t('presentations.builder.bottomBar.notes', 'Speaker Notes')}
          </p>
          <textarea
            value={speakerNotes || ''}
            onChange={(event) => onSpeakerNotesChange?.(event.target.value)}
            readOnly={!onSpeakerNotesChange}
            placeholder={t(
              'presentations.builder.notesPlaceholder',
              'Speaker notes for this slide...'
            )}
            className="w-full text-sm text-c-text-secondary bg-transparent border-none outline-none focus:ring-1 focus:ring-c-focus resize-none read-only:cursor-default"
            rows={4}
          />
        </div>
      )}
    </div>
  );
};
