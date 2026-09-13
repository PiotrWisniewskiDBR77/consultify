import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

const cards = [
  card,
  { ...card, card_id: 'slide-2', order_index: 1, title: 'Delivery plan' },
  { ...card, card_id: 'slide-3', order_index: 2, title: 'Risks' },
];

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

  it('uses sibling controls without nested interactive elements', () => {
    const onSelect = vi.fn();
    const { container } = render(
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
    const slideRow = screen.getByTestId('deck-slide-0');
    const selectButton = within(slideRow).getByRole('button', {
      name: 'Select slide 1: Board transformation update',
    });
    expect(selectButton).toHaveAttribute('aria-current', 'true');
    expect(selectButton.querySelector('button, [role="button"]')).toBeNull();

    fireEvent.click(selectButton);
    expect(onSelect).toHaveBeenCalledWith(0);

    expect(
      container.querySelector('button button, button [role="button"], [role="button"] button')
    ).toBeNull();
  });

  it('invokes New slide as an argument-free action', () => {
    const onAddCard = vi.fn();
    render(
      <SlideSorter
        cards={[card]}
        activeIndex={0}
        onSelect={vi.fn()}
        onReorder={vi.fn()}
        onDuplicate={vi.fn()}
        onDelete={vi.fn()}
        onAddCard={onAddCard}
      />
    );

    const addButton = screen.getByRole('button', { name: 'New slide' });
    expect(addButton).toHaveAttribute('type', 'button');
    fireEvent.click(addButton);

    expect(onAddCard).toHaveBeenCalledOnce();
    expect(onAddCard).toHaveBeenCalledWith();
  });

  it('keeps Move actions inside the context menu and reachable by click and keyboard', async () => {
    const user = userEvent.setup();
    const onReorder = vi.fn();
    const onDuplicate = vi.fn();
    const onDelete = vi.fn();
    const onToggleLock = vi.fn();
    render(
      <SlideSorter
        cards={cards}
        activeIndex={1}
        onSelect={vi.fn()}
        onReorder={onReorder}
        onDuplicate={onDuplicate}
        onDelete={onDelete}
        onAddCard={vi.fn()}
        onToggleLock={onToggleLock}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Slide 2 actions' }));
    expect(screen.getByRole('button', { name: /duplicate$/i })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Lock slide' })).toBeVisible();
    expect(screen.getByRole('button', { name: /delete$/i })).toBeVisible();

    const move = screen.getByRole('button', { name: 'Move' });
    move.focus();
    await user.keyboard('{Enter}');
    const back = screen.getByRole('button', { name: /back$/i });
    expect(back).toHaveFocus();
    await user.keyboard('{Tab}');
    expect(screen.getByRole('button', { name: 'To top' })).toHaveFocus();
    fireEvent.click(screen.getByRole('button', { name: 'To top' }));
    expect(onReorder).toHaveBeenLastCalledWith(1, 0);

    fireEvent.click(screen.getByRole('button', { name: 'Slide 2 actions' }));
    fireEvent.click(screen.getByRole('button', { name: 'Move' }));
    fireEvent.click(screen.getByRole('button', { name: 'To bottom' }));
    expect(onReorder).toHaveBeenLastCalledWith(1, 2);

    fireEvent.click(screen.getByRole('button', { name: 'Slide 2 actions' }));
    fireEvent.click(screen.getByRole('button', { name: 'Move' }));
    fireEvent.click(screen.getByRole('button', { name: /back$/i }));
    expect(screen.getByRole('button', { name: 'Move' })).toHaveFocus();
    expect(screen.getByRole('button', { name: /duplicate$/i })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Lock slide' })).toBeVisible();
    expect(screen.getByRole('button', { name: /delete$/i })).toBeVisible();
  });

  it('preserves move guards and treats cancelled or invalid positions as no-ops', () => {
    const onReorder = vi.fn();
    const prompt = vi.spyOn(window, 'prompt');
    const { rerender } = render(
      <SlideSorter
        cards={cards}
        activeIndex={0}
        onSelect={vi.fn()}
        onReorder={onReorder}
        onDuplicate={vi.fn()}
        onDelete={vi.fn()}
        onAddCard={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Slide 1 actions' }));
    fireEvent.click(screen.getByRole('button', { name: 'Move' }));
    expect(screen.getByRole('button', { name: 'To top' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: /back$/i }));

    rerender(
      <SlideSorter
        cards={cards}
        activeIndex={1}
        onSelect={vi.fn()}
        onReorder={onReorder}
        onDuplicate={vi.fn()}
        onDelete={vi.fn()}
        onAddCard={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Slide 2 actions' }));
    fireEvent.click(screen.getByRole('button', { name: 'Move' }));
    prompt.mockReturnValueOnce(null);
    fireEvent.click(screen.getByRole('button', { name: 'To position…' }));
    expect(onReorder).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Slide 2 actions' }));
    fireEvent.click(screen.getByRole('button', { name: 'Move' }));
    prompt.mockReturnValueOnce('not-a-number');
    fireEvent.click(screen.getByRole('button', { name: 'To position…' }));
    expect(onReorder).not.toHaveBeenCalled();
  });
});
