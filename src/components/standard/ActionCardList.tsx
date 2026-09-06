import React from 'react';

import { ActionCard } from './ActionCard';
import type { ActionCardModel } from './ActionCard.types';

export interface ActionCardListProps {
  cards: ActionCardModel[];
  onOpen?: (card: ActionCardModel) => void;
  /** P7K część B — „Utwórz zadanie" na karcie. Opcjonalne (bez zmian bez propa). */
  onCreateTask?: (card: ActionCardModel) => void;
  /** P7K część B — „Zamknij kartę". Opcjonalne. */
  onCloseCard?: (card: ActionCardModel) => void;
  /** Identyfikator karty, na której trwa zapis — jej przyciski są zablokowane. */
  busyId?: string | null;
  emptyLabel?: string;
}

export function ActionCardList({
  cards,
  onOpen,
  onCreateTask,
  onCloseCard,
  busyId = null,
  emptyLabel = '—',
}: ActionCardListProps) {
  if (cards.length === 0)
    return <p className="py-8 text-center text-sm text-c-text-muted">{emptyLabel}</p>;
  return (
    <div className="space-y-4">
      {cards.map((card) => (
        <ActionCard
          key={card.id}
          card={card}
          onOpen={onOpen}
          onCreateTask={onCreateTask}
          onCloseCard={onCloseCard}
          busy={busyId === card.id}
        />
      ))}
    </div>
  );
}
