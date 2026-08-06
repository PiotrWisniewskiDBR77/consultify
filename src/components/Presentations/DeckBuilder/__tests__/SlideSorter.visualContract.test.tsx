import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { DeckCard } from '../../wizard/types';
import { SlideSorter } from '../SlideSorter';

vi.mock('../CardRenderer', () => ({
  CardRenderer: ({ animationsEnabled }: { animationsEnabled?: boolean }) => (
    <div data-testid="card-renderer" data-animations={String(animationsEnabled)} />
  ),
}));

const card: DeckCard = {
  card_id: 'slide-1',
  deck_id: 'deck-1',
  order_index: 0,
  intent: 'key_messages',
  layout_id: 'content_full',
  title: 'Board transformation update',
  blocks: [],
  source_refs: [],
  has_refreshable_data: false,
  background: { type: 'theme' },
  animations: { entrance: 'none', block_stagger: false },
  is_locked: false,
};

describe('SlideSorter visual and accessibility contract', () => {
  it('contains the complete 16:9 composition and exposes a readable truthful title', () => {
    render(
      <SlideSorter
        cards={[card]}
        activeIndex={0}
        onSelect={vi.fn()}
        onReorder={vi.fn()}
        onDuplicate={vi.fn()}
        onDelete={vi.fn()}
        onAddCard={vi.fn()}
      />
    );

    expect(screen.getByTestId('deck-slide-thumbnail-0')).toHaveAttribute(
      'data-thumbnail-fit',
      'contain'
    );
    expect(screen.getByTestId('card-renderer')).toHaveAttribute('data-animations', 'false');
    expect(screen.getByTitle(card.title)).toHaveTextContent(card.title);
  });

  it('supports keyboard slide selection and labels icon-only controls', () => {
    const onSelect = vi.fn();
    render(
      <SlideSorter
        cards={[card]}
        activeIndex={0}
        onSelect={onSelect}
        onReorder={vi.fn()}
        onDuplicate={vi.fn()}
        onDelete={vi.fn()}
        onAddCard={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: 'Slide thumbnails' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Slide list' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Slide 1 actions' })).toBeVisible();
    fireEvent.keyDown(
      screen.getByRole('button', { name: 'Select slide 1: Board transformation update' }),
      { key: 'Enter' }
    );
    expect(onSelect).toHaveBeenCalledWith(0);
  });
});
