import React, { useEffect, useState } from 'react';
import { ActionCard, type ActionCardModel } from '@/components/standard';
import { listActionCards } from '@/services/actionCards';
export function AuditActionCards() {
  const [cards, setCards] = useState<ActionCardModel[]>([]);
  useEffect(() => { void listActionCards({ status: 'OPEN', sourceKind: 'audit_finding' }).then(setCards).catch(() => setCards([])); }, []);
  if (!cards.length) return null;
  return <section aria-label="Karty działania — Audyty" className="space-y-3">{cards.map((card) => <ActionCard key={card.id} card={card} />)}</section>;
}
