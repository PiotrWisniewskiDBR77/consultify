/**
 * Render-level proof for the Kanban lifecycle fix (2026-08-29).
 *
 * The sibling `PortfolioKanbanView.lifecycle.test.ts` proves the grouping
 * invariant on the pure helper. This file closes the remaining gap: that the
 * COMPONENT actually renders an EXECUTING initiative instead of dropping it.
 * The shipped defect was exactly this — the module filter chip said
 * "W realizacji 1" while the board showed a wall of zeros.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { InitiativeStatus, type PortfolioInitiative } from '../../../types';
import { PortfolioKanbanView } from '../PortfolioKanbanView';

const executing = {
  id: 'init-executing-1',
  name: 'Initiative in execution',
  status: InitiativeStatus.IN_EXECUTION,
  priority: 'HIGH',
} as unknown as PortfolioInitiative;

describe('PortfolioKanbanView renders an EXECUTING initiative', () => {
  it('shows the card in the default "active" scope', () => {
    render(
      <PortfolioKanbanView
        initiatives={[executing]}
        onInitiativeClick={vi.fn()}
        onStatusChange={vi.fn()}
        scope="active"
      />
    );

    expect(screen.getByText('Initiative in execution')).toBeTruthy();
  });

  it('shows the card in the "all" scope', () => {
    render(
      <PortfolioKanbanView
        initiatives={[executing]}
        onInitiativeClick={vi.fn()}
        onStatusChange={vi.fn()}
        scope="all"
      />
    );

    expect(screen.getByText('Initiative in execution')).toBeTruthy();
  });
});
