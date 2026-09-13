import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { PresentMode } from '../PresentMode';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback: string) => fallback,
  }),
}));

vi.mock('../CardRenderer', () => ({
  CardRenderer: ({ card }: { card: { title: string } }) => <div>{card.title}</div>,
}));

const cards = [
  { card_id: 'one', title: 'Slide one', blocks: [] },
  { card_id: 'two', title: 'Slide two', blocks: [], speaker_notes: 'Private notes' },
  { card_id: 'three', title: 'Slide three', blocks: [] },
] as any;

describe('PresentMode contrast and accessible controls', () => {
  it('keeps the audience counter readable and exposes named navigation controls', () => {
    const onExit = vi.fn();
    render(<PresentMode cards={cards} title="Deck" initialIndex={1} onExit={onExit} />);

    expect(screen.getByText('2 / 3')).toHaveClass('text-white');
    expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Previous' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it('exposes named previous, next, and close controls in presenter view', () => {
    const onExit = vi.fn();
    render(
      <PresentMode cards={cards} title="Deck" initialIndex={1} presenterView onExit={onExit} />
    );

    expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Previous' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onExit).toHaveBeenCalledTimes(1);
  });
});
