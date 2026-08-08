import { fireEvent, render, screen } from '@testing-library/react';
import type React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { DeckCard } from '../../wizard/types';
import { CardRenderer } from '../CardRenderer';

vi.mock('../AnimatedBlock', () => ({
  AnimatedBlock: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  AnimatedCard: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const card: DeckCard = {
  card_id: 'slide-1',
  deck_id: 'deck-1',
  order_index: 0,
  intent: 'key_messages',
  layout_id: 'content_full',
  title: 'Freeform slide',
  blocks: [
    {
      block_id: 'block-1',
      card_id: 'slide-1',
      type: 'paragraph',
      content: { text: 'Move me' },
      position: { area: 'full', order: 0 },
      geometry: { x: 10, y: 10, width: 30, height: 20, rotation: 0 },
      is_refreshable: false,
      ai_editable: true,
    },
  ],
  source_refs: [],
  has_refreshable_data: false,
  background: { type: 'theme' },
  animations: { entrance: 'none', block_stagger: false },
  is_locked: false,
};

afterEach(() => vi.restoreAllMocks());

describe('CardRenderer freeform handles', () => {
  it('renders accessible handles and commits keyboard movement once', () => {
    const onBlockUpdate = vi.fn();
    render(
      <CardRenderer
        card={card}
        editable
        selectedBlockIds={['block-1']}
        onBlockUpdate={onBlockUpdate}
      />
    );

    expect(screen.getByRole('button', { name: 'Resize selected block' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Rotate selected block' })).toBeVisible();
    fireEvent.keyDown(screen.getByRole('button', { name: 'Move selected block' }), {
      key: 'ArrowRight',
      shiftKey: true,
    });
    expect(onBlockUpdate).toHaveBeenCalledOnce();
    expect(onBlockUpdate).toHaveBeenCalledWith('block-1', {
      geometry: { x: 15, y: 10, width: 30, height: 20, rotation: 0 },
    });
  });

  it('keeps pointer previews local and commits one move on pointerup', () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 1000,
      bottom: 500,
      width: 1000,
      height: 500,
      toJSON: () => ({}),
    });
    const onBlockUpdate = vi.fn();
    render(
      <CardRenderer
        card={card}
        editable
        selectedBlockIds={['block-1']}
        onBlockUpdate={onBlockUpdate}
      />
    );
    const handle = screen.getByRole('button', { name: 'Move selected block' });
    Object.defineProperty(handle, 'setPointerCapture', { value: vi.fn() });
    fireEvent.pointerDown(handle, { pointerId: 1, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(window, { pointerId: 1, clientX: 200, clientY: 150 });
    expect(onBlockUpdate).not.toHaveBeenCalled();
    fireEvent.pointerUp(window, { pointerId: 1, clientX: 200, clientY: 150 });
    expect(onBlockUpdate).toHaveBeenCalledOnce();
  });
});
