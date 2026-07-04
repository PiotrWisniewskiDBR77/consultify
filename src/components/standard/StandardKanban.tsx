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

import type { LucideIcon } from 'lucide-react';
import { GripVertical, User } from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/utils/cn';

import type { ChipTone } from '../ui/primitives/chips/chipBase';
import { CHIP_TONE_VAR, ChipDot } from '../ui/primitives/chips/chipBase';
import { MetaChip } from '../ui/primitives/chips/MetaChip';

/** Pilność karty → pasek akcentu ~3px (kanon A9: TYLKO bursztyn/czerwony/brak). */
export type StandardKanbanUrgency = 'none' | 'pending' | 'critical';

export interface StandardKanbanColumn {
  id: string;
  label: string;
  /** Kolor kropki nagłówka kolumny (semantyka stanu — kanon C1). */
  tone?: ChipTone;
  /** Pokazuje „+" w nagłówku (tylko kolumny, w których wolno tworzyć). */
  onCreate?: () => void;
  createLabel?: string;
}

export interface StandardKanbanCard {
  id: string;
  columnId: string;
  title: string;
  description?: string;
  /** Ciche chipy (priorytet, typ…) — neutralna ramka, kolor tylko w kropce. */
  chips?: { id: string; label: string; icon?: LucideIcon; tone?: ChipTone }[];
  /** Chip projektu/kontekstu (zawsze neutralny — kanon A9). */
  projectLabel?: string;
  /** Termin — treść steruje kolorem (overdue = czerwonawe, inne = szare). */
  dueLabel?: string;
  dueOverdue?: boolean;
  /** Inicjały/awatar właściciela (prawy dolny róg stopki). */
  ownerInitials?: string;
  ownerAvatarUrl?: string;
  /** Pilność → pasek akcentu ~3px + (CRITICAL) delikatny tint tła. */
  urgency?: StandardKanbanUrgency;
}

export interface StandardKanbanProps {
  columns: StandardKanbanColumn[];
  /** Zwraca karty należące do danej kolumny (moduł kontroluje sortowanie). */
  cards: (columnId: string) => StandardKanbanCard[];
  onCardClick?: (card: StandardKanbanCard) => void;
  /** Drag&drop między kolumnami — natywny HTML5 DnD, opcjonalny. */
  onDrop?: (cardId: string, columnId: string) => void;
  emptyPlaceholder?: (columnId: string) => React.ReactNode;
  className?: string;
}

const URGENCY_ACCENT: Record<StandardKanbanUrgency, string> = {
  none: 'border-l-transparent',
  pending: 'border-l-amber-500',
  critical: 'border-l-danger-500',
};

const KanbanCardView: React.FC<{
  card: StandardKanbanCard;
  onClick?: () => void;
  draggable: boolean;
  onDragStartCard?: (e: React.DragEvent) => void;
  isDragging?: boolean;
}> = ({ card, onClick, draggable, onDragStartCard, isDragging }) => {
  const { t } = useTranslation();
  const urgency = card.urgency ?? 'none';

  return (
    <div
      draggable={draggable}
      onDragStart={onDragStartCard}
      onClick={onClick}
      data-testid={`standard-kanban-card-${card.id}`}
      className={cn(
        'group rounded-lg border border-c-border-subtle bg-c-surface p-3 cursor-pointer select-none',
        'border-l-[3px] shadow-token-card hover:shadow-token-card-hover transition-shadow duration-150',
        URGENCY_ACCENT[urgency],
        urgency === 'critical' && 'bg-danger-500/[0.04] dark:bg-danger-500/[0.06]',
        isDragging && 'opacity-40'
      )}
    >
      <div className="flex items-start gap-1.5">
        {draggable ? (
          <span
            className="mt-0.5 shrink-0 cursor-grab text-c-text-muted opacity-0 group-hover:opacity-100 transition-opacity active:cursor-grabbing"
            aria-hidden="true"
          >
            <GripVertical size={14} />
          </span>
        ) : null}
        <h4 className="min-w-0 flex-1 text-sm font-semibold text-c-text leading-snug line-clamp-2">
          {card.title}
        </h4>
      </div>

      {card.description ? (
        <p
          className={cn(
            'mt-1 text-xs text-c-text-muted leading-relaxed line-clamp-2',
            draggable && 'pl-5'
          )}
        >
          {card.description}
        </p>
      ) : null}

      {card.chips?.length || card.projectLabel ? (
        <div className={cn('mt-2 flex flex-wrap items-center gap-1.5', draggable && 'pl-5')}>
          {card.chips?.map((chip) => {
            const Icon = chip.icon;
            const toneVar =
              chip.tone && chip.tone !== 'neutral'
                ? CHIP_TONE_VAR[chip.tone as Exclude<ChipTone, 'neutral'>]
                : undefined;
            return (
              <MetaChip
                key={chip.id}
                label={
                  <span className="inline-flex items-center gap-1">
                    {toneVar ? <ChipDot colorVar={toneVar} /> : null}
                    {chip.label}
                  </span>
                }
                icon={Icon}
                title={chip.label}
              />
            );
          })}
          {card.projectLabel ? (
            <MetaChip label={card.projectLabel} className="max-w-[120px] truncate" />
          ) : null}
        </div>
      ) : null}

      <div className={cn('mt-2 flex items-center justify-between', draggable && 'pl-5')}>
        {card.dueLabel ? (
          <span
            className={cn(
              'text-[11px] font-medium',
              card.dueOverdue ? 'text-danger-500' : 'text-c-text-muted'
            )}
          >
            {card.dueLabel}
          </span>
        ) : (
          <span />
        )}
        {card.ownerInitials || card.ownerAvatarUrl ? (
          <div
            className="h-5 w-5 shrink-0 overflow-hidden rounded-full bg-c-surface-raised text-[10px] font-bold text-c-text-secondary ring-1 ring-c-border-subtle flex items-center justify-center"
            title={card.ownerInitials}
          >
            {card.ownerAvatarUrl ? (
              <img src={card.ownerAvatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              card.ownerInitials
            )}
          </div>
        ) : (
          <div className="h-5 w-5 shrink-0 rounded-full bg-c-surface-raised flex items-center justify-center">
            <User size={10} className="text-c-text-muted" aria-hidden="true" />
          </div>
        )}
      </div>
      {!draggable ? null : (
        <span className="sr-only">
          {t('common.dragToMove', 'Drag to move to another column')}
        </span>
      )}
    </div>
  );
};

const KanbanColumnZone: React.FC<{
  column: StandardKanbanColumn;
  cards: StandardKanbanCard[];
  onCardClick?: (card: StandardKanbanCard) => void;
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
          <KanbanCardView
            key={card.id}
            card={card}
            draggable={droppable}
            isDragging={draggingCardId === card.id}
            onDragStartCard={(e) => {
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
    <div
      data-testid="standard-kanban"
      className={cn('h-full overflow-x-auto p-4', className)}
    >
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
