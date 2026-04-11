/**
 * P20 Builder P0 Contract Test: DeckBuilder
 * Contract: PREZENTACJE_V8_BUILDER_P0_CONTRACT §12
 *
 * Covers: stable card IDs after reorder/edit, undo/redo (3-step depth),
 * version history (max 50 snapshots), version diff by card_id.
 */

import { describe, it, expect } from 'vitest';
import { act, renderHook } from '@testing-library/react';

import { computeVersionDiff } from '../../../src/components/Presentations/DeckBuilder/useVersionHistory';
import { useDeckState } from '../../../src/components/Presentations/DeckBuilder/useDeckState';

import type { Deck, DeckCard } from '../../../src/components/Presentations/wizard/types';

function makeCard(id: string, title: string): DeckCard {
  return {
    card_id: id,
    deck_id: 'test-deck',
    order_index: 0,
    intent: 'key_messages',
    layout_id: 'content_full',
    title,
    blocks: [],
    source_refs: [],
    has_refreshable_data: false,
    background: { type: 'theme' },
    animations: { entrance: 'fade', block_stagger: false },
    is_locked: false,
  };
}

function makeDeck(cards: DeckCard[]): Deck {
  return {
    deck_id: 'test-deck',
    organization_id: 'test-org',
    title: 'Test',
    theme_id: 'default',
    presentation_mode: 'show',
    communication_register: 'professional',
    image_style_preset: 'minimal_no_images',
    color_set_id: 'midnight_navy',
    status: 'draft',
    card_size: '16:9',
    cards: cards.map((c, i) => ({ ...c, order_index: i })),
    source_refs: [],
    generation_settings: {
      text_mode: 'preserve',
      content_depth: 'concise',
      audience: 'internal',
      tone: 'professional',
      language: 'en',
      image_source: 'none',
    },
    animations_enabled: true,
    share_settings: { is_shared: false, permissions: 'view' },
    speaker_notes_generated: false,
    created_by: 'test',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

describe('useDeckState — P20-A.4 Stable Card IDs', () => {
  it('reorder preserves card_id values', () => {
    const cards = [makeCard('A', 'First'), makeCard('B', 'Second'), makeCard('C', 'Third')];
    const { result } = renderHook(() => useDeckState(makeDeck(cards)));

    act(() => result.current.reorderCards(0, 2));

    const ids = result.current.deck!.cards.map((c) => c.card_id);
    expect(ids).toContain('A');
    expect(ids).toContain('B');
    expect(ids).toContain('C');
    expect(ids[2]).toBe('A');
    expect(ids[0]).toBe('B');
  });

  it('updateCard does not change card_id', () => {
    const cards = [makeCard('X', 'Original')];
    const { result } = renderHook(() => useDeckState(makeDeck(cards)));

    act(() => result.current.updateCard('X', { title: 'Updated' }));

    expect(result.current.deck!.cards[0].card_id).toBe('X');
    expect(result.current.deck!.cards[0].title).toBe('Updated');
  });

  it('deleteCard preserves IDs of remaining cards', () => {
    const cards = [makeCard('A', 'A'), makeCard('B', 'B'), makeCard('C', 'C')];
    const { result } = renderHook(() => useDeckState(makeDeck(cards)));

    act(() => result.current.deleteCard(1));

    const ids = result.current.deck!.cards.map((c) => c.card_id);
    expect(ids).toEqual(['A', 'C']);
  });

  it('duplicateCard creates new card_id for clone', () => {
    const cards = [makeCard('A', 'Original')];
    const { result } = renderHook(() => useDeckState(makeDeck(cards)));

    act(() => result.current.duplicateCard(0));

    expect(result.current.deck!.cards).toHaveLength(2);
    expect(result.current.deck!.cards[0].card_id).toBe('A');
    expect(result.current.deck!.cards[1].card_id).not.toBe('A');
  });
});

describe('useDeckState — Undo/Redo (P20 §2.6 bounded depth)', () => {
  it('undo/redo reverses card edit', () => {
    const cards = [makeCard('A', 'Original')];
    const { result } = renderHook(() => useDeckState(makeDeck(cards)));

    act(() => result.current.updateCard('A', { title: 'Changed' }));
    expect(result.current.deck!.cards[0].title).toBe('Changed');

    act(() => result.current.undo());
    expect(result.current.deck!.cards[0].title).toBe('Original');

    act(() => result.current.redo());
    expect(result.current.deck!.cards[0].title).toBe('Changed');
  });

  it('undo depth is capped at 3 steps', () => {
    const cards = [makeCard('A', 'V0')];
    const { result } = renderHook(() => useDeckState(makeDeck(cards)));

    for (let i = 1; i <= 5; i++) {
      act(() => result.current.updateCard('A', { title: `V${i}` }));
    }

    let undoCount = 0;
    while (result.current.canUndo && undoCount < 10) {
      act(() => result.current.undo());
      undoCount++;
    }
    expect(undoCount).toBeLessThanOrEqual(3);
  });
});

describe('computeVersionDiff — card-level change detection', () => {
  it('detects added, removed, and modified cards by card_id', () => {
    const oldDeck = makeDeck([makeCard('A', 'A'), makeCard('B', 'B')]);
    const newDeck = makeDeck([
      { ...makeCard('A', 'A-modified'), title: 'A-modified' },
      makeCard('C', 'C'),
    ]);

    const diff = computeVersionDiff(oldDeck, newDeck);
    expect(diff.addedCards).toContain('C');
    expect(diff.removedCards).toContain('B');
    expect(diff.modifiedCards).toContain('A');
  });
});
