import React from 'react';

import { ActionCard } from './ActionCard';
import type { ActionCardModel } from './ActionCard.types';

export interface ActionCardListProps {
  cards: ActionCardModel[];
  onOpen?: (card: ActionCardModel) => void;
  emptyLabel?: string;
}

export function ActionCardList({ cards, onOpen, emptyLabel = '—' }: ActionCardListProps) {
  if (cards.length === 0) return <p className="py-8 text-center text-sm text-c-text-muted">{emptyLabel}</p>;
  return <div className="space-y-4">{cards.map((card) => <ActionCard key={card.id} card={card} onOpen={onOpen} />)}</div>;
}
