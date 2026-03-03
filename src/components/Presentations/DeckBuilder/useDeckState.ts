/**
 * Deck state management hook for the Deck Builder.
 * Manages deck data, undo/redo, and card operations.
 */

import { useCallback, useRef, useState } from 'react';

import type { Deck, DeckCard } from '../wizard/types';

const MAX_UNDO_STEPS = 3;

interface UndoEntry {
  cards: DeckCard[];
  activeCardIndex: number;
}

export function useDeckState(initialDeck: Deck | null) {
  const [deck, setDeck] = useState<Deck | null>(initialDeck);
  const [activeCardIndex, setActiveCardIndex] = useState(0);
  const undoStack = useRef<UndoEntry[]>([]);
  const redoStack = useRef<UndoEntry[]>([]);

  const pushUndo = useCallback(() => {
    if (!deck) return;
    undoStack.current.push({
      cards: JSON.parse(JSON.stringify(deck.cards)),
      activeCardIndex,
    });
    if (undoStack.current.length > MAX_UNDO_STEPS) {
      undoStack.current.shift();
    }
    redoStack.current = [];
  }, [deck, activeCardIndex]);

  const undo = useCallback(() => {
    if (!deck || undoStack.current.length === 0) return;
    const entry = undoStack.current.pop()!;
    redoStack.current.push({
      cards: JSON.parse(JSON.stringify(deck.cards)),
      activeCardIndex,
    });
    setDeck((prev) => (prev ? { ...prev, cards: entry.cards } : prev));
    setActiveCardIndex(entry.activeCardIndex);
  }, [deck, activeCardIndex]);

  const redo = useCallback(() => {
    if (!deck || redoStack.current.length === 0) return;
    const entry = redoStack.current.pop()!;
    undoStack.current.push({
      cards: JSON.parse(JSON.stringify(deck.cards)),
      activeCardIndex,
    });
    setDeck((prev) => (prev ? { ...prev, cards: entry.cards } : prev));
    setActiveCardIndex(entry.activeCardIndex);
  }, [deck, activeCardIndex]);

  const updateCard = useCallback(
    (cardId: string, updates: Partial<DeckCard>) => {
      pushUndo();
      setDeck((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          cards: prev.cards.map((c) => (c.card_id === cardId ? { ...c, ...updates } : c)),
        };
      });
    },
    [pushUndo]
  );

  const reorderCards = useCallback(
    (fromIndex: number, toIndex: number) => {
      if (!deck) return;
      pushUndo();
      setDeck((prev) => {
        if (!prev) return prev;
        const cards = [...prev.cards];
        const [moved] = cards.splice(fromIndex, 1);
        cards.splice(toIndex, 0, moved);
        return {
          ...prev,
          cards: cards.map((c, i) => ({ ...c, order_index: i })),
        };
      });
      if (activeCardIndex === fromIndex) {
        setActiveCardIndex(toIndex);
      }
    },
    [deck, pushUndo, activeCardIndex]
  );

  const deleteCard = useCallback(
    (index: number) => {
      if (!deck || deck.cards.length <= 1) return;
      pushUndo();
      setDeck((prev) => {
        if (!prev) return prev;
        const cards = prev.cards.filter((_, i) => i !== index);
        return { ...prev, cards: cards.map((c, i) => ({ ...c, order_index: i })) };
      });
      if (activeCardIndex >= index && activeCardIndex > 0) {
        setActiveCardIndex((prev) => prev - 1);
      }
    },
    [deck, pushUndo, activeCardIndex]
  );

  const duplicateCard = useCallback(
    (index: number) => {
      if (!deck) return;
      pushUndo();
      setDeck((prev) => {
        if (!prev) return prev;
        const original = prev.cards[index];
        const clone: DeckCard = {
          ...JSON.parse(JSON.stringify(original)),
          card_id: `card-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          order_index: index + 1,
        };
        const cards = [...prev.cards];
        cards.splice(index + 1, 0, clone);
        return { ...prev, cards: cards.map((c, i) => ({ ...c, order_index: i })) };
      });
      setActiveCardIndex(index + 1);
    },
    [deck, pushUndo]
  );

  const addCard = useCallback(
    (atIndex: number, card: DeckCard) => {
      pushUndo();
      setDeck((prev) => {
        if (!prev) return prev;
        const cards = [...prev.cards];
        cards.splice(atIndex, 0, card);
        return { ...prev, cards: cards.map((c, i) => ({ ...c, order_index: i })) };
      });
      setActiveCardIndex(atIndex);
    },
    [pushUndo]
  );

  const activeCard = deck?.cards[activeCardIndex] ?? null;

  return {
    deck,
    setDeck,
    activeCard,
    activeCardIndex,
    setActiveCardIndex,
    updateCard,
    reorderCards,
    deleteCard,
    duplicateCard,
    addCard,
    undo,
    redo,
    canUndo: undoStack.current.length > 0,
    canRedo: redoStack.current.length > 0,
  };
}
