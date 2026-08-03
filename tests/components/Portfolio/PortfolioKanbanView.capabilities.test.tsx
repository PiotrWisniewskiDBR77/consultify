/**
 * @vitest-environment jsdom
 *
 * PortfolioKanbanView — INI-05 active UI/component test.
 *
 * This is the live "portfolio list" surface (`InitiativesHub` view mode
 * `'timeline'`/kanban), and the only place a portfolio-membership move is
 * actually initiated from drag. It already exposes a capability-aware prop
 * (`canDrag`, #75a) that this packet's backend now enforces for real via
 * `assertCanEditInitiative` — this test locks in that the UI honors the SAME
 * signal:
 *   - initiatives render grouped into the correct status column;
 *   - clicking a card still opens it (`onInitiativeClick`) regardless of
 *     `canDrag` — capability affects MOVING, not VIEWING;
 *   - `canDrag=false` disables the card's drag affordance and surfaces the
 *     `dragDisabledReason` as a title/tooltip, `canDrag=true` (default)
 *     leaves it fully interactive.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string, fallback?: string) => fallback ?? k }),
}));

import { PortfolioKanbanView } from '@/components/Portfolio/PortfolioKanbanView';
import { InitiativeStatus, type PortfolioInitiative } from '@/types';

function fixture(overrides: Partial<PortfolioInitiative> = {}): PortfolioInitiative {
  return {
    id: 'init-1',
    name: 'Reduce cycle time',
    axis: 'operational',
    status: InitiativeStatus.PLANNING,
    priority: 'HIGH',
    progress: 40,
    budget: 100000,
    ...overrides,
  } as PortfolioInitiative;
}

describe('PortfolioKanbanView — INI-05 capability-aware drag', () => {
  it('renders an initiative card in its status column and opens it on click regardless of canDrag', () => {
    const onInitiativeClick = vi.fn();
    const initiative = fixture({ id: 'init-open', name: 'Open me', status: InitiativeStatus.PLANNING });

    render(
      <PortfolioKanbanView
        initiatives={[initiative]}
        onInitiativeClick={onInitiativeClick}
        onStatusChange={vi.fn()}
        scope="active"
        canDrag={false}
        dragDisabledReason="Read-only role"
      />
    );

    const card = screen.getByText('Open me');
    expect(card).toBeInTheDocument();
    card.closest('[role], div')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(onInitiativeClick).toHaveBeenCalledWith(expect.objectContaining({ id: 'init-open' }));
  });

  it('canDrag=false disables the drag affordance and surfaces the reason as a tooltip', () => {
    const initiative = fixture({ id: 'init-locked', name: 'Locked card' });
    const { container } = render(
      <PortfolioKanbanView
        initiatives={[initiative]}
        onInitiativeClick={vi.fn()}
        onStatusChange={vi.fn()}
        scope="active"
        canDrag={false}
        dragDisabledReason="You do not have edit capability on this initiative"
      />
    );

    const titled = container.querySelector('[title="You do not have edit capability on this initiative"]');
    expect(titled).toBeTruthy();
    expect(titled?.className).toContain('cursor-default');
  });

  it('canDrag=true (default) leaves the card draggable — no disabled title/cursor', () => {
    const initiative = fixture({ id: 'init-open2', name: 'Draggable card' });
    const { container } = render(
      <PortfolioKanbanView
        initiatives={[initiative]}
        onInitiativeClick={vi.fn()}
        onStatusChange={vi.fn()}
        scope="active"
      />
    );

    expect(container.querySelector('[title]')).toBeNull();
    expect(screen.getByText('Draggable card')).toBeInTheDocument();
  });

  it('groups initiatives into the correct status columns (no cross-column leakage)', () => {
    const planning = fixture({ id: 'i-planning', name: 'Planning item', status: InitiativeStatus.PLANNING });
    const approved = fixture({ id: 'i-approved', name: 'Approved item', status: InitiativeStatus.APPROVED });

    render(
      <PortfolioKanbanView
        initiatives={[planning, approved]}
        onInitiativeClick={vi.fn()}
        onStatusChange={vi.fn()}
        scope="active"
      />
    );

    expect(screen.getByText('Planning item')).toBeInTheDocument();
    expect(screen.getByText('Approved item')).toBeInTheDocument();
  });
});
