/**
 * useDataRefresh — hook for per-block, per-card, and per-deck data refresh.
 * Tracks outdated data indicators and provides refresh actions.
 */

import { useCallback, useState } from 'react';

import type { CardBlock, Deck, DeckCard } from '../wizard/types';

interface RefreshResult {
  blockId: string;
  updated: boolean;
  newContent?: Record<string, unknown>;
}

interface DataRefreshState {
  isRefreshing: boolean;
  outdatedCardIds: Set<string>;
  lastRefreshSummary: string | null;
}

export function useDataRefresh(
  deck: Deck | null,
  updateCard: (cardId: string, updates: Partial<DeckCard>) => void
) {
  const [state, setState] = useState<DataRefreshState>({
    isRefreshing: false,
    outdatedCardIds: new Set(),
    lastRefreshSummary: null,
  });

  const checkOutdated = useCallback(() => {
    if (!deck) return;
    const outdated = new Set<string>();
    for (const card of deck.cards) {
      if (card.has_refreshable_data) {
        const lastRefresh = card.last_data_refresh ? new Date(card.last_data_refresh) : null;
        for (const ref of card.source_refs) {
          // In production, compare source artifact updated_at vs last_data_refresh
          // For now, mark cards that have refreshable data and were refreshed >1h ago
          if (!lastRefresh || Date.now() - lastRefresh.getTime() > 3600000) {
            outdated.add(card.card_id);
          }
        }
      }
    }
    setState((prev) => ({ ...prev, outdatedCardIds: outdated }));
  }, [deck]);

  const refreshBlock = useCallback(
    async (cardId: string, blockId: string): Promise<RefreshResult> => {
      setState((prev) => ({ ...prev, isRefreshing: true }));
      try {
        const response = await fetch(
          `/api/presentations/decks/${deck?.deck_id}/cards/${cardId}/blocks/${blockId}/refresh`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${localStorage.getItem('token')}`,
            },
          }
        );

        if (response.ok) {
          const data = await response.json();
          if (data.updated && data.content) {
            const card = deck?.cards.find((c) => c.card_id === cardId);
            if (card) {
              updateCard(cardId, {
                blocks: card.blocks.map((b) =>
                  b.block_id === blockId ? { ...b, content: data.content } : b
                ),
                last_data_refresh: new Date().toISOString(),
              });
            }
          }
          return { blockId, updated: data.updated, newContent: data.content };
        }
        return { blockId, updated: false };
      } catch {
        return { blockId, updated: false };
      } finally {
        setState((prev) => ({ ...prev, isRefreshing: false }));
      }
    },
    [deck, updateCard]
  );

  const refreshCard = useCallback(
    async (cardId: string): Promise<RefreshResult[]> => {
      const card = deck?.cards.find((c) => c.card_id === cardId);
      if (!card) return [];

      setState((prev) => ({ ...prev, isRefreshing: true }));
      const refreshableBlocks = card.blocks.filter((b) => b.is_refreshable);
      const results: RefreshResult[] = [];

      for (const block of refreshableBlocks) {
        const result = await refreshBlock(cardId, block.block_id);
        results.push(result);
      }

      setState((prev) => {
        const newOutdated = new Set(prev.outdatedCardIds);
        newOutdated.delete(cardId);
        return {
          ...prev,
          isRefreshing: false,
          outdatedCardIds: newOutdated,
          lastRefreshSummary: `Updated ${results.filter((r) => r.updated).length}/${results.length} blocks`,
        };
      });

      return results;
    },
    [deck, refreshBlock]
  );

  const refreshAllCards = useCallback(async () => {
    if (!deck) return;
    setState((prev) => ({ ...prev, isRefreshing: true }));

    let totalUpdated = 0;
    let totalBlocks = 0;

    for (const card of deck.cards) {
      if (card.has_refreshable_data) {
        const results = await refreshCard(card.card_id);
        totalBlocks += results.length;
        totalUpdated += results.filter((r) => r.updated).length;
      }
    }

    setState({
      isRefreshing: false,
      outdatedCardIds: new Set(),
      lastRefreshSummary: `Updated ${totalUpdated} blocks across ${deck.cards.filter((c) => c.has_refreshable_data).length} cards. ${totalBlocks - totalUpdated} blocks had no changes.`,
    });
  }, [deck, refreshCard]);

  return {
    ...state,
    checkOutdated,
    refreshBlock,
    refreshCard,
    refreshAllCards,
    isCardOutdated: (cardId: string) => state.outdatedCardIds.has(cardId),
  };
}
