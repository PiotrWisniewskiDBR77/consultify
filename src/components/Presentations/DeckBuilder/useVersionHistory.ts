/**
 * useVersionHistory — auto-save and version snapshot management for decks.
 * Auto-saves every 30s, creates named snapshots every 5 min.
 * Provides undo to any previous version with diff highlighting.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import type { Deck } from '../wizard/types';

export interface VersionSnapshot {
  id: string;
  timestamp: number;
  label: string;
  type: 'auto' | 'manual' | 'checkpoint';
  cardCount: number;
  summary: string;
  deckData: string;
}

interface VersionHistoryState {
  versions: VersionSnapshot[];
  isSaving: boolean;
  lastSavedAt: number | null;
  hasUnsavedChanges: boolean;
}

const AUTO_SAVE_INTERVAL_MS = 30_000;
const SNAPSHOT_INTERVAL_MS = 300_000;
const MAX_VERSIONS = 50;

export function useVersionHistory(deck: Deck | null) {
  const [state, setState] = useState<VersionHistoryState>({
    versions: [],
    isSaving: false,
    lastSavedAt: null,
    hasUnsavedChanges: false,
  });

  const lastSavedDeckRef = useRef<string>('');
  const autoSaveTimerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const snapshotTimerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  const createSnapshot = useCallback(
    (type: 'auto' | 'manual' | 'checkpoint', label?: string): VersionSnapshot | null => {
      if (!deck) return null;

      const serialized = JSON.stringify(deck);
      if (serialized === lastSavedDeckRef.current && type === 'auto') return null;

      const snapshot: VersionSnapshot = {
        id: `v_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        timestamp: Date.now(),
        label: label || generateLabel(type, deck),
        type,
        cardCount: deck.cards.length,
        summary: generateSummary(deck),
        deckData: serialized,
      };

      setState((prev) => {
        const versions = [snapshot, ...prev.versions].slice(0, MAX_VERSIONS);
        return {
          ...prev,
          versions,
          lastSavedAt: Date.now(),
          hasUnsavedChanges: false,
          isSaving: false,
        };
      });

      lastSavedDeckRef.current = serialized;
      return snapshot;
    },
    [deck]
  );

  const autoSave = useCallback(async () => {
    if (!deck) return;

    const serialized = JSON.stringify(deck);
    if (serialized === lastSavedDeckRef.current) return;

    setState((prev) => ({ ...prev, isSaving: true }));

    try {
      await fetch(`/api/presentations/decks/${deck.deck_id}/autosave`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: serialized,
      });

      lastSavedDeckRef.current = serialized;
      setState((prev) => ({
        ...prev,
        isSaving: false,
        lastSavedAt: Date.now(),
        hasUnsavedChanges: false,
      }));
    } catch {
      setState((prev) => ({ ...prev, isSaving: false }));
    }
  }, [deck]);

  const restoreVersion = useCallback(
    (versionId: string): Deck | null => {
      const version = state.versions.find((v) => v.id === versionId);
      if (!version) return null;

      try {
        return JSON.parse(version.deckData) as Deck;
      } catch {
        return null;
      }
    },
    [state.versions]
  );

  const saveManualCheckpoint = useCallback(
    (label: string) => {
      createSnapshot('manual', label);
    },
    [createSnapshot]
  );

  // Track unsaved changes
  useEffect(() => {
    if (!deck) return;
    const serialized = JSON.stringify(deck);
    if (serialized !== lastSavedDeckRef.current) {
      setState((prev) => ({ ...prev, hasUnsavedChanges: true }));
    }
  }, [deck]);

  // Auto-save timer
  useEffect(() => {
    autoSaveTimerRef.current = setInterval(autoSave, AUTO_SAVE_INTERVAL_MS);
    return () => clearInterval(autoSaveTimerRef.current);
  }, [autoSave]);

  // Snapshot timer (every 5 min)
  useEffect(() => {
    snapshotTimerRef.current = setInterval(() => {
      createSnapshot('checkpoint');
    }, SNAPSHOT_INTERVAL_MS);
    return () => clearInterval(snapshotTimerRef.current);
  }, [createSnapshot]);

  // Warn before unload if unsaved
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (state.hasUnsavedChanges) {
        e.preventDefault();
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [state.hasUnsavedChanges]);

  return {
    ...state,
    createSnapshot,
    restoreVersion,
    saveManualCheckpoint,
    autoSave,
  };
}

function generateLabel(type: string, deck: Deck): string {
  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  switch (type) {
    case 'auto':
      return `Auto-save ${time}`;
    case 'checkpoint':
      return `Checkpoint ${time}`;
    default:
      return `Saved ${time}`;
  }
}

function generateSummary(deck: Deck): string {
  const totalBlocks = deck.cards.reduce((sum, c) => sum + c.blocks.length, 0);
  return `${deck.cards.length} cards, ${totalBlocks} blocks`;
}

/**
 * Compute a simple diff between two deck versions for UI highlighting.
 */
export function computeVersionDiff(
  oldDeck: Deck,
  newDeck: Deck
): {
  addedCards: string[];
  removedCards: string[];
  modifiedCards: string[];
} {
  const oldCardIds = new Set(oldDeck.cards.map((c) => c.card_id));
  const newCardIds = new Set(newDeck.cards.map((c) => c.card_id));

  const addedCards = newDeck.cards
    .filter((c) => !oldCardIds.has(c.card_id))
    .map((c) => c.card_id);
  const removedCards = oldDeck.cards
    .filter((c) => !newCardIds.has(c.card_id))
    .map((c) => c.card_id);

  const modifiedCards: string[] = [];
  for (const newCard of newDeck.cards) {
    if (!oldCardIds.has(newCard.card_id)) continue;
    const oldCard = oldDeck.cards.find((c) => c.card_id === newCard.card_id);
    if (oldCard && JSON.stringify(oldCard) !== JSON.stringify(newCard)) {
      modifiedCards.push(newCard.card_id);
    }
  }

  return { addedCards, removedCards, modifiedCards };
}
