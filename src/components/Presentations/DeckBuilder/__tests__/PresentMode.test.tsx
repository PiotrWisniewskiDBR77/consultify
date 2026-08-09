import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PresentMode } from '../PresentMode';

vi.mock('../CardRenderer', () => ({
  CardRenderer: ({ card }: { card: { title: string } }) => <div>{card.title}</div>,
}));

const cards = [
  { card_id: 'one', title: 'Slide one', blocks: [] },
  { card_id: 'two', title: 'Slide two', blocks: [], speaker_notes: 'Private notes' },
  { card_id: 'three', title: 'Slide three', blocks: [] },
] as any;

describe('PresentMode', () => {
  beforeEach(() => vi.useRealTimers());

  it('starts the audience presentation from the requested current slide', () => {
    render(<PresentMode cards={cards} title="Deck" initialIndex={1} onExit={vi.fn()} />);
    expect(screen.getByTestId('audience-present-view')).toBeInTheDocument();
    expect(screen.getByText('Slide two')).toBeInTheDocument();
    expect(screen.getByText('2 / 3')).toBeInTheDocument();
    expect(screen.queryByText('Private notes')).not.toBeInTheDocument();
  });

  it('clamps an invalid starting slide and exits with Escape', () => {
    const onExit = vi.fn();
    render(<PresentMode cards={cards} title="Deck" initialIndex={99} onExit={onExit} />);
    expect(screen.getByText('Slide three')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it('shows notes, next slide, and timer only in presenter view', () => {
    render(
      <PresentMode
        cards={cards}
        title="Deck"
        initialIndex={1}
        presenterView
        onExit={vi.fn()}
      />
    );
    expect(screen.getByTestId('presenter-view')).toBeInTheDocument();
    expect(screen.getByText('Private notes')).toBeInTheDocument();
    expect(screen.getByText('Slide three')).toBeInTheDocument();
    expect(screen.getByText('00:00')).toBeInTheDocument();
  });
});
