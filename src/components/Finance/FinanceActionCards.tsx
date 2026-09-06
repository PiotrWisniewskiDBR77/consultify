import React, { useEffect, useState } from 'react';
import { ActionCard, type ActionCardModel } from '@/components/standard';
import { listActionCards } from '@/services/actionCards';
export function FinanceActionCards() {
  const [cards, setCards] = useState<ActionCardModel[]>([]);
  useEffect(() => { void listActionCards({ status: 'OPEN', sourceKind: 'finance_variance' }).then(setCards).catch(() => setCards([])); }, []);
  if (!cards.length) return null;
  return <section aria-label="Karty działania — Finanse" className="space-y-3 p-4">{cards.map((card) => <ActionCard key={card.id} card={card} />)}</section>;
}
