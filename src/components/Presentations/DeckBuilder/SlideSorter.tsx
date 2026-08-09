import {
  ChevronRight,
  Copy,
  GripVertical,
  LayoutGrid,
  List,
  Lock,
  MoreVertical,
  Move,
  Plus,
  RefreshCw,
  Trash2,
  Unlock,
} from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { type DeckCard, INTENT_COLORS } from '../wizard/types';
import { CardRenderer } from './CardRenderer';

interface SlideSorterProps {
  cards: DeckCard[];
  activeIndex: number;
  colorSetId?: string;
  onSelect: (index: number) => void;
  onReorder: (from: number, to: number) => void;
  onDuplicate: (index: number) => void;
  onDelete: (index: number) => void;
  onAddCard: () => void;
  isCardOutdated?: (cardId: string) => boolean;
  /**
   * Fala 2 (SPEC §3.3.2) — widoczna, odwracalna kłódka. Karta tknięta ręcznie
   * (Tryb 1 / lokalne AI) dostaje ją automatycznie; klik świadomie
   * odblokowuje/blokuje kartę bez czekania na ręczną zmianę.
   */
  onToggleLock?: (cardId: string) => void;
}

export const SlideSorter: React.FC<SlideSorterProps> = ({
  cards,
  activeIndex,
  colorSetId,
  onSelect,
  onReorder,
  onDuplicate,
  onDelete,
  onAddCard,
  isCardOutdated,
  onToggleLock,
}) => {
  const { t } = useTranslation();
  const [viewMode, setViewMode] = useState<'cards' | 'list'>('cards');
  const [contextMenuIndex, setContextMenuIndex] = useState<number | null>(null);
  const [showMoveSubmenu, setShowMoveSubmenu] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const closeContextMenu = () => {
    setContextMenuIndex(null);
    setShowMoveSubmenu(false);
  };

  const handleDragStart = (index: number) => {
    setDragIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (dragIndex !== null && dragIndex !== index) {
      onReorder(dragIndex, index);
      setDragIndex(index);
    }
  };

  const handleDragEnd = () => {
    setDragIndex(null);
  };

  return (
    <div className="w-[180px] flex-shrink-0 border-r border-c-border-subtle bg-c-surface flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-c-border-subtle">
        <span className="text-[10px] font-semibold text-c-text-secondary uppercase">
          {t('presentations.builder.slideSorter', 'Slides')}
        </span>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setViewMode('cards')}
            aria-label={t('presentations.builder.cardView', 'Slide thumbnails')}
            aria-pressed={viewMode === 'cards'}
            className={`p-1 rounded ${viewMode === 'cards' ? 'bg-c-surface-raised text-c-text' : 'text-c-text-secondary'}`}
          >
            <LayoutGrid size={12} />
          </button>
          <button
            type="button"
            onClick={() => setViewMode('list')}
            aria-label={t('presentations.builder.listView', 'Slide list')}
            aria-pressed={viewMode === 'list'}
            className={`p-1 rounded ${viewMode === 'list' ? 'bg-c-surface-raised text-c-text' : 'text-c-text-secondary'}`}
          >
            <List size={12} />
          </button>
        </div>
      </div>

      {/* Cards/List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        {cards.map((card, index) => {
          const outdated = isCardOutdated?.(card.card_id);
          return (
            <div
              key={card.card_id}
              data-testid={`deck-slide-${index}`}
              draggable
              role="button"
              tabIndex={0}
              aria-label={`${t('presentations.builder.selectSlide', 'Select slide')} ${index + 1}: ${card.title}`}
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragEnd={handleDragEnd}
              onClick={() => {
                onSelect(index);
                closeContextMenu();
              }}
              onKeyDown={(event) => {
                if (event.key !== 'Enter' && event.key !== ' ') return;
                event.preventDefault();
                onSelect(index);
                closeContextMenu();
              }}
              className={`relative group cursor-pointer rounded-lg transition-all ${
                index === activeIndex ? 'ring-2 ring-c-focus' : 'hover:ring-1 hover:ring-c-border'
              } ${dragIndex === index ? 'opacity-50' : ''}`}
            >
              {viewMode === 'cards' ? (
                <div className="relative bg-c-surface rounded-lg overflow-hidden">
                  <div
                    className="relative pointer-events-none overflow-hidden aspect-video rounded-t-lg bg-c-surface-raised"
                    data-testid={`deck-slide-thumbnail-${index}`}
                    data-thumbnail-fit="contain"
                    aria-hidden="true"
                  >
                    <div className="absolute left-0 top-0 h-[540px] w-[960px] origin-top-left scale-[0.1708333333]">
                      <CardRenderer card={card} colorSetId={colorSetId} animationsEnabled={false} />
                    </div>
                  </div>
                  <p
                    className="truncate px-2 py-1.5 text-[10px] font-medium text-c-text"
                    title={card.title}
                  >
                    {card.title}
                  </p>
                  <div className="absolute top-1 left-1 flex items-center gap-0.5">
                    <GripVertical
                      size={10}
                      className="text-c-text cursor-grab opacity-0 group-hover:opacity-100"
                    />
                    <span className="text-[9px] font-bold text-c-text bg-black/40 rounded px-1">
                      {index + 1}
                    </span>
                  </div>

                  {/* Outdated data badge */}
                  {outdated && (
                    <div
                      className="absolute bottom-1 left-1 flex items-center gap-0.5 px-1 py-0.5 rounded bg-amber-500/90 text-c-text text-[7px] font-bold"
                      title={t(
                        'presentations.builder.dataRefresh.outdated',
                        'Data may be outdated'
                      )}
                    >
                      <RefreshCw size={8} className="animate-spin-slow" />
                      <span>{t('presentations.builder.dataRefresh.stale', 'Stale')}</span>
                    </div>
                  )}

                  {/* ★ Fala 2 — widoczna, odwracalna kłódka (SPEC §3.3.2). Karta
                      tknięta ręcznie (Tryb 1 / lokalne AI) dostaje `is_locked`
                      automatycznie; klik świadomie odblokowuje. Zawsze
                      widoczna gdy zablokowana (nie tylko na hover), bo to jest
                      informacja o STANIE ochrony, nie akcja kontekstowa. */}
                  {card.is_locked && (
                    <button
                      type="button"
                      aria-label={t('presentations.builder.unlockSlideAction', 'Unlock slide')}
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleLock?.(card.card_id);
                      }}
                      title={t(
                        'presentations.builder.unlockSlide',
                        'Manually edited — protected from AI rewrite. Click to unlock.'
                      )}
                      className="absolute bottom-1 right-1 flex items-center gap-0.5 p-0.5 rounded bg-black/40 text-c-text hover:bg-black/60"
                    >
                      <Lock size={9} />
                    </button>
                  )}

                  {/* Context menu trigger */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowMoveSubmenu(false);
                      setContextMenuIndex(contextMenuIndex === index ? null : index);
                    }}
                    className="absolute top-1 right-1 p-0.5 rounded bg-black/30 text-c-text opacity-0 group-hover:opacity-100"
                    aria-label={`${t('presentations.builder.slideActions', 'Slide')} ${index + 1} actions`}
                  >
                    <MoreVertical size={10} />
                  </button>
                </div>
              ) : (
                <div
                  className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs ${
                    index === activeIndex ? 'bg-c-accent-soft' : 'hover:bg-c-surface-raised'
                  }`}
                >
                  <GripVertical size={10} className="text-c-text-secondary cursor-grab" />
                  <span className="font-bold text-c-text-secondary w-4 text-right">
                    {index + 1}
                  </span>
                  <span
                    className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${INTENT_COLORS[card.intent] || 'bg-c-text-muted'}`}
                  />
                  <span className="text-c-text truncate flex-1">{card.title}</span>
                  {card.is_locked && (
                    <button
                      type="button"
                      aria-label={t('presentations.builder.unlockSlideAction', 'Unlock slide')}
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleLock?.(card.card_id);
                      }}
                      title={t(
                        'presentations.builder.unlockSlide',
                        'Manually edited — protected from AI rewrite. Click to unlock.'
                      )}
                      className="text-c-text-secondary hover:text-c-text flex-shrink-0"
                    >
                      <Lock size={10} />
                    </button>
                  )}
                  {outdated && <RefreshCw size={10} className="text-amber-500 flex-shrink-0" />}
                  <button
                    type="button"
                    aria-label={t('presentations.builder.slideActions', 'Slide actions')}
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowMoveSubmenu(false);
                      setContextMenuIndex(contextMenuIndex === index ? null : index);
                    }}
                    className="text-c-text-secondary opacity-0 group-hover:opacity-100"
                  >
                    <MoreVertical size={12} />
                  </button>
                </div>
              )}

              {/* Context Menu */}
              {contextMenuIndex === index && (
                <div className="absolute right-0 top-full mt-1 w-36 bg-c-surface border border-c-border-subtle rounded-lg shadow-xl z-50 py-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDuplicate(index);
                      closeContextMenu();
                    }}
                    className="w-full px-3 py-1.5 text-left text-xs flex items-center gap-2 hover:bg-c-surface-raised text-c-text"
                  >
                    <Copy size={12} /> {t('presentations.builder.duplicate')}
                  </button>

                  {onToggleLock && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleLock(card.card_id);
                        closeContextMenu();
                      }}
                      className="w-full px-3 py-1.5 text-left text-xs flex items-center gap-2 hover:bg-c-surface-raised text-c-text"
                    >
                      {card.is_locked ? (
                        <>
                          <Unlock size={12} />{' '}
                          {t('presentations.builder.unlockSlideAction', 'Unlock slide')}
                        </>
                      ) : (
                        <>
                          <Lock size={12} />{' '}
                          {t('presentations.builder.lockSlideAction', 'Lock slide')}
                        </>
                      )}
                    </button>
                  )}

                  {/* Move ▸ submenu (na górę / na dół / na pozycję) */}
                  <div
                    className="relative"
                    onMouseEnter={() => setShowMoveSubmenu(true)}
                    onMouseLeave={() => setShowMoveSubmenu(false)}
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowMoveSubmenu((v) => !v);
                      }}
                      className="w-full px-3 py-1.5 text-left text-xs flex items-center justify-between gap-2 hover:bg-c-surface-raised text-c-text"
                    >
                      <span className="flex items-center gap-2">
                        <Move size={12} /> {t('presentations.builder.move', 'Move')}
                      </span>
                      <ChevronRight size={12} />
                    </button>
                    {showMoveSubmenu && (
                      <div className="absolute right-full top-0 mr-1 w-36 bg-c-surface border border-c-border-subtle rounded-lg shadow-xl z-50 py-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onReorder(index, 0);
                            closeContextMenu();
                          }}
                          disabled={index === 0}
                          className="w-full px-3 py-1.5 text-left text-xs hover:bg-c-surface-raised text-c-text disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {t('presentations.builder.moveToTop', 'To top')}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onReorder(index, cards.length - 1);
                            closeContextMenu();
                          }}
                          disabled={index === cards.length - 1}
                          className="w-full px-3 py-1.5 text-left text-xs hover:bg-c-surface-raised text-c-text disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {t('presentations.builder.moveToBottom', 'To bottom')}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const raw = window.prompt(
                              t(
                                'presentations.builder.moveToPositionPrompt',
                                'Move to position (1-{{count}})',
                                { count: cards.length }
                              ),
                              String(index + 1)
                            );
                            if (raw !== null) {
                              const parsed = parseInt(raw, 10);
                              if (Number.isFinite(parsed)) {
                                const target = Math.min(Math.max(parsed - 1, 0), cards.length - 1);
                                onReorder(index, target);
                              }
                            }
                            closeContextMenu();
                          }}
                          className="w-full px-3 py-1.5 text-left text-xs hover:bg-c-surface-raised text-c-text"
                        >
                          {t('presentations.builder.moveToPosition', 'To position…')}
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="h-px bg-c-border-subtle my-1" />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(index);
                      closeContextMenu();
                    }}
                    className="w-full px-3 py-1.5 text-left text-xs flex items-center gap-2 hover:bg-danger-50 dark:hover:bg-danger-500/10 text-danger-500"
                  >
                    <Trash2 size={12} /> {t('presentations.builder.delete')}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add button */}
      <div className="p-2 border-t border-c-border-subtle">
        <button
          onClick={onAddCard}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-dashed border-c-border-subtle text-xs text-c-text-secondary hover:border-c-accent hover:text-c-accent transition-colors"
        >
          <Plus size={12} /> {t('presentations.builder.addBlank', 'New slide')}
        </button>
      </div>
    </div>
  );
};
