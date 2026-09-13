import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ActionCardList } from '../ActionCardList';
import type { ActionCardModel } from '../ActionCard.types';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_key: string, fallback?: string) => fallback ?? _key }),
}));
afterEach(cleanup);
const card: ActionCardModel = {
  id: 'card-reopen',
  sourceKind: 'audit_finding',
  sourceId: 'finding-1',
  periodStart: '2026-09-01',
  periodEnd: '2026-09-30',
  goalMet: false,
  actionRequired: true,
  problem: 'Review delivery quality',
  rootCause: 'Review missed',
  actionText: 'Repeat the review',
  ownerName: 'Test Owner',
  dueDate: '2026-10-01',
  status: 'CLOSED',
};
describe('ActionCardList lifecycle and navigation', () => {
  it('closed card reopens through lifecycle callback; opening the card only navigates', () => {
    const onOpen = vi.fn();
    const onReopenCard = vi.fn();
    const onCloseCard = vi.fn();
    render(
      <ActionCardList
        cards={[card]}
        onOpen={onOpen}
        onReopenCard={onReopenCard}
        onCloseCard={onCloseCard}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /^Open card$/ }));
    expect(onOpen).toHaveBeenCalledWith(card);
    expect(onReopenCard).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /^Reopen card$/ }));
    expect(onReopenCard).toHaveBeenCalledExactlyOnceWith(card);
    expect(onCloseCard).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Close card' })).toBeNull();
  });
  it('open card has close and create-task actions, never another reopen action', () => {
    const open = { ...card, status: 'OPEN' as const };
    const close = vi.fn();
    const reopen = vi.fn();
    render(
      <ActionCardList
        cards={[open]}
        onCloseCard={close}
        onReopenCard={reopen}
        onCreateTask={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Close card' }));
    expect(close).toHaveBeenCalledWith(open);
    expect(reopen).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Create task' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Reopen card' })).toBeNull();
  });
  it('busy card cannot submit another reopen request', () => {
    const reopen = vi.fn();
    render(<ActionCardList cards={[card]} onReopenCard={reopen} busyId={card.id} />);
    const button = screen.getByRole('button', { name: 'Reopen card' });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(button);
    expect(reopen).not.toHaveBeenCalled();
  });
  it('a caller without a lifecycle callback cannot reopen a card', () => {
    render(<ActionCardList cards={[card]} onOpen={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Reopen card' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Open card' })).toBeTruthy();
  });
});
