import {
  Copy,
  GripVertical,
  LayoutGrid,
  List,
  MoreVertical,
  Plus,
  RefreshCw,
  Trash2,
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
}) => {
  const { t } = useTranslation();
  const [viewMode, setViewMode] = useState<'cards' | 'list'>('cards');
  const [contextMenuIndex, setContextMenuIndex] = useState<number | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

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
    <div className="w-[180px] flex-shrink-0 border-r border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200 dark:border-navy-800">
        <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase">
          {t('presentations.builder.slideSorter', 'Slides')}
        </span>
        <div className="flex gap-1">
          <button
            onClick={() => setViewMode('cards')}
            className={`p-1 rounded ${viewMode === 'cards' ? 'bg-slate-100 dark:bg-navy-800 text-slate-700 dark:text-white' : 'text-slate-600'}`}
          >
            <LayoutGrid size={12} />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-1 rounded ${viewMode === 'list' ? 'bg-slate-100 dark:bg-navy-800 text-slate-700 dark:text-white' : 'text-slate-600'}`}
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
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragEnd={handleDragEnd}
              onClick={() => {
                onSelect(index);
                setContextMenuIndex(null);
              }}
              className={`relative group cursor-pointer rounded-lg transition-all ${
                index === activeIndex
                  ? 'ring-2 ring-primary-500'
                  : 'hover:ring-1 hover:ring-slate-300 dark:hover:ring-navy-600'
              } ${dragIndex === index ? 'opacity-50' : ''}`}
            >
              {viewMode === 'cards' ? (
                <div className="relative">
                  <div className="pointer-events-none overflow-hidden rounded-lg">
                    <CardRenderer card={card} colorSetId={colorSetId} scale={0.2} />
                  </div>
                  <div className="absolute top-1 left-1 flex items-center gap-0.5">
                    <GripVertical
                      size={10}
                      className="text-white/70 cursor-grab opacity-0 group-hover:opacity-100"
                    />
                    <span className="text-[9px] font-bold text-white bg-black/40 rounded px-1">
                      {index + 1}
                    </span>
                  </div>

                  {/* Outdated data badge */}
                  {outdated && (
                    <div
                      className="absolute bottom-1 left-1 flex items-center gap-0.5 px-1 py-0.5 rounded bg-amber-500/90 text-white text-[7px] font-bold"
                      title={t(
                        'presentations.builder.dataRefresh.outdated',
                        'Data may be outdated'
                      )}
                    >
                      <RefreshCw size={8} className="animate-spin-slow" />
                      <span>{t('presentations.builder.dataRefresh.stale', 'Stale')}</span>
                    </div>
                  )}

                  {/* Context menu trigger */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setContextMenuIndex(contextMenuIndex === index ? null : index);
                    }}
                    className="absolute top-1 right-1 p-0.5 rounded bg-black/30 text-white opacity-0 group-hover:opacity-100"
                  >
                    <MoreVertical size={10} />
                  </button>
                </div>
              ) : (
                <div
                  className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs ${
                    index === activeIndex
                      ? 'bg-primary-50 dark:bg-primary-500/10'
                      : 'hover:bg-slate-50 dark:hover:bg-navy-800'
                  }`}
                >
                  <GripVertical size={10} className="text-slate-600 cursor-grab" />
                  <span className="font-bold text-slate-600 w-4 text-right">{index + 1}</span>
                  <span
                    className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${INTENT_COLORS[card.intent] || 'bg-slate-400'}`}
                  />
                  <span className="text-slate-700 dark:text-slate-300 truncate flex-1">
                    {card.title}
                  </span>
                  {outdated && <RefreshCw size={10} className="text-amber-500 flex-shrink-0" />}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setContextMenuIndex(contextMenuIndex === index ? null : index);
                    }}
                    className="text-slate-600 opacity-0 group-hover:opacity-100"
                  >
                    <MoreVertical size={12} />
                  </button>
                </div>
              )}

              {/* Context Menu */}
              {contextMenuIndex === index && (
                <div className="absolute right-0 top-full mt-1 w-36 bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-lg shadow-xl z-50 py-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDuplicate(index);
                      setContextMenuIndex(null);
                    }}
                    className="w-full px-3 py-1.5 text-left text-xs flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-navy-700 text-slate-700 dark:text-slate-300"
                  >
                    <Copy size={12} /> {t('presentations.builder.duplicate')}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(index);
                      setContextMenuIndex(null);
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
      <div className="p-2 border-t border-slate-200 dark:border-navy-800">
        <button
          onClick={onAddCard}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-dashed border-slate-300 dark:border-navy-600 text-xs text-slate-500 hover:border-primary-400 hover:text-primary-500 transition-colors"
        >
          <Plus size={12} /> {t('presentations.builder.addBlank', 'New slide')}
        </button>
      </div>
    </div>
  );
};
