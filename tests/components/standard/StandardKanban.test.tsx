/**
 * @vitest-environment jsdom
 * StandardKanban — testy renderu (Triada standard, kanon A9).
 */
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  StandardKanban,
  type StandardKanbanCard,
  type StandardKanbanColumn,
} from '../../../src/components/standard/StandardKanban';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: any) => (typeof fallback === 'string' ? fallback : _key),
    i18n: { language: 'en', resolvedLanguage: 'en' },
  }),
}));

const columns: StandardKanbanColumn[] = [
  { id: 'pending', label: 'Pending', tone: 'warning' },
  { id: 'critical', label: 'Critical', tone: 'danger' },
  { id: 'done', label: 'Done', tone: 'success' },
];

const CARDS: Record<string, StandardKanbanCard[]> = {
  pending: [
    {
      id: 'card-1',
      columnId: 'pending',
      title: 'Review vendor contract',
      description: 'Needs legal sign-off before renewal date',
      chips: [{ id: 'priority', label: 'High' }],
      projectLabel: 'Atelier',
      dueLabel: '3d waiting',
      ownerInitials: 'PW',
      urgency: 'pending',
    },
  ],
  critical: [
    {
      id: 'card-2',
      columnId: 'critical',
      title: 'Escalated: budget overrun',
      dueLabel: '10d overdue',
      dueOverdue: true,
      urgency: 'critical',
    },
  ],
  done: [],
};

const cardsFor = (columnId: string) => CARDS[columnId] ?? [];

describe('StandardKanban', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders every declared column, even when empty, with a bare count', () => {
    render(<StandardKanban columns={columns} cards={cardsFor} />);
    expect(screen.getByTestId('standard-kanban-column-pending')).toBeInTheDocument();
    expect(screen.getByTestId('standard-kanban-column-critical')).toBeInTheDocument();
    expect(screen.getByTestId('standard-kanban-column-done')).toBeInTheDocument();
    // Empty column stays visible with a placeholder (kanon A9 — never hidden).
    expect(screen.getByTestId('standard-kanban-empty-done')).toBeInTheDocument();
  });

  it('renders card title, description, chips, due label and owner', () => {
    render(<StandardKanban columns={columns} cards={cardsFor} />);
    expect(screen.getByText('Review vendor contract')).toBeInTheDocument();
    expect(screen.getByText('Needs legal sign-off before renewal date')).toBeInTheDocument();
    expect(screen.getByText('High')).toBeInTheDocument();
    expect(screen.getByText('Atelier')).toBeInTheDocument();
    expect(screen.getByText('3d waiting')).toBeInTheDocument();
    expect(screen.getByText('PW')).toBeInTheDocument();
  });

  it('applies the ~3px left accent bar per urgency (pending=amber, critical=danger)', () => {
    render(<StandardKanban columns={columns} cards={cardsFor} />);
    const pendingCard = screen.getByTestId('standard-kanban-card-card-1');
    const criticalCard = screen.getByTestId('standard-kanban-card-card-2');
    expect(pendingCard.className).toContain('border-l-amber-500');
    expect(criticalCard.className).toContain('border-l-danger-500');
    // CRITICAL card also gets the sole surface tint allowed by the canon.
    expect(criticalCard.className).toContain('bg-danger-500/[0.04]');
  });

  it('marks overdue due labels distinctly from waiting labels', () => {
    render(<StandardKanban columns={columns} cards={cardsFor} />);
    const overdue = screen.getByText('10d overdue');
    const waiting = screen.getByText('3d waiting');
    expect(overdue.className).toContain('text-danger-500');
    expect(waiting.className).not.toContain('text-danger-500');
  });

  it('calls onCardClick with the clicked card (→ preview, kanon A7)', () => {
    const onCardClick = vi.fn();
    render(<StandardKanban columns={columns} cards={cardsFor} onCardClick={onCardClick} />);
    screen.getByText('Review vendor contract').click();
    expect(onCardClick).toHaveBeenCalledWith(expect.objectContaining({ id: 'card-1' }));
  });

  it('cards are draggable only when onDrop is provided', () => {
    const { rerender } = render(<StandardKanban columns={columns} cards={cardsFor} />);
    expect(screen.getByTestId('standard-kanban-card-card-1')).toHaveAttribute(
      'draggable',
      'false'
    );

    rerender(<StandardKanban columns={columns} cards={cardsFor} onDrop={vi.fn()} />);
    expect(screen.getByTestId('standard-kanban-card-card-1')).toHaveAttribute('draggable', 'true');
  });

  it('shows a "+" create trigger only for columns that declare onCreate', () => {
    const onCreate = vi.fn();
    const withCreate: StandardKanbanColumn[] = [
      { id: 'pending', label: 'Pending', tone: 'warning', onCreate, createLabel: 'Add card' },
      { id: 'done', label: 'Done', tone: 'success' },
    ];
    render(<StandardKanban columns={withCreate} cards={cardsFor} />);
    expect(screen.getByTitle('Add card')).toBeInTheDocument();
  });
});
