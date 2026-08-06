import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { DeckCard } from '../../wizard/types';
import { CardCanvas } from '../CardCanvas';

vi.mock('../CardRenderer', () => ({
  CardRenderer: () => <div data-testid="card-renderer" />,
}));

const card: DeckCard = {
  card_id: 'slide-1',
  deck_id: 'deck-1',
  order_index: 0,
  intent: 'key_messages',
  layout_id: 'content_full',
  title: 'Manual slide',
  blocks: [],
  source_refs: [],
  has_refreshable_data: false,
  background: { type: 'theme' },
  animations: { entrance: 'fade', block_stagger: false },
  is_locked: false,
};

describe('CardCanvas speaker notes', () => {
  it('lets a manual editor change speaker notes', () => {
    const onSpeakerNotesChange = vi.fn();
    render(
      <CardCanvas
        cards={[card]}
        activeCardIndex={0}
        onSelectCard={vi.fn()}
        speakerNotes="Existing note"
        onSpeakerNotesChange={onSpeakerNotesChange}
        showNotes
      />
    );

    const editor = screen.getByPlaceholderText('Speaker notes for this slide...');
    expect(editor).not.toHaveAttribute('readonly');
    fireEvent.change(editor, { target: { value: 'Updated manual note' } });
    expect(onSpeakerNotesChange).toHaveBeenCalledWith('Updated manual note');
  });

  it('mounts the real slide layout toolbar for the active card', () => {
    const onUpdateCard = vi.fn();
    render(
      <CardCanvas
        cards={[card]}
        activeCardIndex={0}
        onSelectCard={vi.fn()}
        showNotes={false}
        onUpdateCard={onUpdateCard}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Choose slide layout' }));
    fireEvent.click(screen.getByRole('button', { name: 'Use Left / Right layout' }));
    expect(onUpdateCard).toHaveBeenCalledWith('slide-1', {
      layout_id: 'content_left_right',
    });
  });
});
