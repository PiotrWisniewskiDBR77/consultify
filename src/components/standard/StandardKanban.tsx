/**
 * StandardKanban — JEDYNA fasada widoku kanban (Triada standard, kanon A9).
 *
 * SSOT: docs/ui-standards/TRIADA_KANON.md (część A9/A10, część C10) + żywe
 * wzorce `Portfolio/PortfolioKanbanView.tsx` i `MyWork/DecisionsKanbanBoard.tsx`
 * (My Work Decisions). Moduł DEKLARUJE kolumny + karty; fasada NARZUCA wygląd:
 *
 *  - kolumny = STREFY (bez tła/obrysu), nagłówek = kropka stanu + nazwa +
 *    goły licznik; puste kolumny ZAWSZE widoczne z placeholderem,
 *  - karta: lewy pasek akcentu ~3px wg pilności (bursztyn=oczekujące,
 *    czerwony=krytyczne; CRITICAL + delikatny tint tła — jedyny kolor
 *    powierzchni karty), uchwyt drag, tytuł 2 linie, opis 2 linie, ciche
 *    chipy, stopka termin/awatar, hairline ramka, hover raised,
 *  - onCardClick → preview (kanon A7); onDrop(cardId, colId) opcjonalny —
 *    natywne HTML5 DnD (bez dodatkowej zależności; kolumna-do-kolumny, zgodnie
 *    z kontraktem — reorder wewnątrz kolumny NIE jest częścią kontraktu).
 *
 * ZAKAZY (kanon A9): kolumny-pudełka z tłem/obrysem, pełne czerwone pigułki
 * priorytetów, różne wysokości pasków akcentu, chowanie pustych kolumn.
 */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/utils/cn';

import type { ChipTone } from '../ui/primitives/chips/chipBase';
import { CHIP_TONE_VAR, ChipDot } from '../ui/primitives/chips/chipBase';
import type { StandardKanbanCard as StandardKanbanCardData } from './StandardKanbanCard';
// Karta = JEDEN kanon (#75b): renderer żyje w `StandardKanbanCard.tsx` i jest
// reużywany też przez bespoke boardy dnd-kit. Fasada tylko go komponuje.
import { StandardKanbanCard } from './StandardKanbanCard';

export type { StandardKanbanChip, StandardKanbanUrgency } from './StandardKanbanCard';
// Re-eksport modelu danych karty pod historyczną nazwą (moduły deklarują karty).
export type { StandardKanbanCard } from './StandardKanbanCard';

export interface StandardKanbanColumn {
  id: string;
  label: string;
  /** Kolor kropki nagłówka kolumny (semantyka stanu — kanon C1). */
  tone?: ChipTone;
  /** Pokazuje „+" w nagłówku (tylko kolumny, w których wolno tworzyć). */
  onCreate?: () => void;
  createLabel?: string;
}

export interface StandardKanbanProps {
  columns: StandardKanbanColumn[];
  /** Zwraca karty należące do danej kolumny (moduł kontroluje sortowanie). */
  cards: (columnId: string) => StandardKanbanCardData[];
  onCardClick?: (card: StandardKanbanCardData) => void;
  /** Drag&drop między kolumnami — natywny HTML5 DnD, opcjonalny. */
  onDrop?: (cardId: string, columnId: string) => void;
  emptyPlaceholder?: (columnId: string) => React.ReactNode;
  className?: string;
}

const KanbanColumnZone: React.FC<{
  column: StandardKanbanColumn;
  cards: StandardKanbanCardData[];
  onCardClick?: (card: StandardKanbanCardData) => void;
  onDrop?: (cardId: string, columnId: string) => void;
  draggingCardId: string | null;
  setDraggingCardId: (id: string | null) => void;
  emptyPlaceholder?: (columnId: string) => React.ReactNode;
}> = ({
  column,
  cards,
  onCardClick,
  onDrop,
  draggingCardId,
  setDraggingCardId,
  emptyPlaceholder,
}) => {
  const { t } = useTranslation();
  const [isOver, setIsOver] = useState(false);
  const droppable = !!onDrop;
  const toneVar = column.tone && column.tone !== 'neutral' ? CHIP_TONE_VAR[column.tone] : undefined;

  return (
    <div
      data-testid={`standard-kanban-column-${column.id}`}
      className="flex w-[280px] shrink-0 flex-col"
      onDragOver={
        droppable
          ? (e) => {
              e.preventDefault();
              setIsOver(true);
            }
          : undefined
      }
      onDragLeave={droppable ? () => setIsOver(false) : undefined}
      onDrop={
        droppable
          ? (e) => {
              e.preventDefault();
              setIsOver(false);
              const cardId = e.dataTransfer.getData('text/standard-kanban-card') || draggingCardId;
              if (cardId) onDrop?.(cardId, column.id);
              setDraggingCardId(null);
            }
          : undefined
      }
    >
      {/* Nagłówek strefy — bez tła/obrysu kolumny (kanon A9: kolumna = strefa). */}
      <div className="flex items-center justify-between px-1 py-2">
        <div className="flex items-center gap-2 min-w-0">
          <ChipDot colorVar={toneVar} size="md" />
          <span className="truncate text-xs font-semibold uppercase tracking-wider text-c-text-secondary">
            {column.label}
          </span>
          <span className="shrink-0 text-xs font-medium text-c-text-muted">{cards.length}</span>
        </div>
        {column.onCreate ? (
          <button
            type="button"
            onClick={column.onCreate}
            title={column.createLabel ?? t('common.add', 'Add')}
            className="shrink-0 rounded-md p-1 text-c-text-muted hover:bg-c-surface-raised hover:text-c-text transition-colors"
          >
            +
          </button>
        ) : null}
      </div>

      {/* Strefa kart — separacja światłem (odstępem), nie tłem/obrysem. */}
      <div
        className={cn(
          'flex-1 space-y-2 rounded-lg p-1 min-h-[120px] transition-colors',
          isOver && 'ring-2 ring-c-focus bg-c-surface-raised/40'
        )}
      >
        {cards.map((card) => (
          <StandardKanbanCard
            key={card.id}
            card={card}
            draggable={droppable}
            isDragging={draggingCardId === card.id}
            onDragStart={(e) => {
              e.dataTransfer.setData('text/standard-kanban-card', card.id);
              e.dataTransfer.effectAllowed = 'move';
              setDraggingCardId(card.id);
            }}
            onClick={() => onCardClick?.(card)}
          />
        ))}

        {/* Puste kolumny ZAWSZE widoczne (kanon A9 — zakaz chowania). */}
        {cards.length === 0 ? (
          <div
            data-testid={`standard-kanban-empty-${column.id}`}
            className="flex flex-col items-center justify-center gap-1.5 py-10 text-center"
          >
            <ChipDot colorVar={toneVar} size="md" className="opacity-40" />
            <span className="text-xs text-c-text-muted opacity-70">
              {emptyPlaceholder
                ? emptyPlaceholder(column.id)
                : t('common.noItems', `No ${column.label.toLowerCase()}`)}
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export const StandardKanban: React.FC<StandardKanbanProps> = ({
  columns,
  cards,
  onCardClick,
  onDrop,
  emptyPlaceholder,
  className,
}) => {
  const [draggingCardId, setDraggingCardId] = useState<string | null>(null);

  return (
    <div data-testid="standard-kanban" className={cn('h-full overflow-x-auto p-4', className)}>
      <div className="flex h-full gap-4">
        {columns.map((column) => (
          <KanbanColumnZone
            key={column.id}
            column={column}
            cards={cards(column.id)}
            onCardClick={onCardClick}
            onDrop={onDrop}
            draggingCardId={draggingCardId}
            setDraggingCardId={setDraggingCardId}
            emptyPlaceholder={emptyPlaceholder}
          />
        ))}
      </div>
    </div>
  );
};

export default StandardKanban;
