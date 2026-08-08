import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { DeckCard } from '../../wizard/types';
import { CardFloatingToolbar } from '../CardFloatingToolbar';

const card: DeckCard = {
  card_id: 'card-1',
  deck_id: 'deck-1',
  order_index: 0,
  intent: 'cover',
  layout_id: 'auto',
  title: 'Cover',
  blocks: [],
  source_refs: [],
  has_refreshable_data: false,
  background: { type: 'theme' },
  animations: { entrance: 'fade', block_stagger: false },
  is_locked: false,
};

describe('CardFloatingToolbar background image flow', () => {
  it('opens the media picker instead of saving an empty image background', () => {
    const onUpdateCard = vi.fn();
    const onChooseBackgroundImage = vi.fn();

    render(
      <CardFloatingToolbar
        card={card}
        onUpdateCard={onUpdateCard}
        onChooseBackgroundImage={onChooseBackgroundImage}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Choose slide background' }));
    fireEvent.click(screen.getByRole('button', { name: 'Use Background image background' }));

    expect(onChooseBackgroundImage).toHaveBeenCalledOnce();
    expect(onUpdateCard).not.toHaveBeenCalled();
  });
});
