import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  CANONICAL_INITIATIVE_REGISTER_COLUMN_IDS,
  CanonicalInitiativeRegister,
  createCanonicalInitiativeRegisterColumns,
} from '../../../src/components/Initiatives/CanonicalInitiativeRegister';
import { InitiativeStatus } from '../../../src/types';

const row = {
  id: 'initiative-1',
  title: 'Program poprawy jakości',
  name: 'Program poprawy jakości',
  summary: 'Rosnący poziom reklamacji.',
  axis: 'operational',
  status: InitiativeStatus.EXECUTING,
  displayStatus: 'IN_EXECUTION',
  priority: undefined as never,
  progress: undefined as never,
  budget: undefined as never,
  ownerBusiness: { id: 'owner-1', firstName: 'Anna', lastName: 'Nowak' },
  canonicalVersion: 7,
  gateName: 'Delivery',
  gateReadiness: 'READY',
  nextAction: 'Monitoruj realizację',
  expectedImpact: 'Spadek reklamacji o 20%',
  impactConfidence: 'HIGH',
  plannedWindow: '2026-Q3',
  healthState: 'ON_TRACK',
  sourceFreshness: 'CURRENT',
  createdAt: '2026-08-01T08:00:00.000Z',
  updatedAt: '2026-08-10T08:00:00.000Z',
};

describe('canonical Initiative register parity', () => {
  it('freezes the same ordered column contract for Initiatives and Realizacje', () => {
    expect(createCanonicalInitiativeRegisterColumns().map(({ id }) => id)).toEqual(
      CANONICAL_INITIATIVE_REGISTER_COLUMN_IDS
    );
  });

  it.each([['initiatives.canonical-register.v1'], ['execution.canonical.executions.v1']])(
    'keeps identical presentation while routing Open for %s',
    (persistKey) => {
      const onOpen = vi.fn();
      render(
        <CanonicalInitiativeRegister
          rows={[row]}
          selectedId="initiative-1"
          onSelect={vi.fn()}
          onOpen={onOpen}
          persistKey={persistKey}
          emptyTitle="Empty"
          emptyDescription="Empty description"
        />
      );

      expect(screen.getByRole('columnheader', { name: /^Inicjatywa/ })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: /^Lifecycle/ })).toBeInTheDocument();
      expect(screen.getAllByText('Spadek reklamacji o 20%').length).toBeGreaterThan(0);
      fireEvent.click(screen.getAllByRole('button', { name: 'Otwórz' })[0]);
      expect(onOpen).toHaveBeenCalledWith(row);
    }
  );

  it('opens the selected Initiative with Enter and exposes filtered-empty reset', () => {
    const onOpen = vi.fn();
    const onResetFilters = vi.fn();
    const { rerender } = render(
      <CanonicalInitiativeRegister
        rows={[row]}
        selectedId="initiative-1"
        onSelect={vi.fn()}
        onOpen={onOpen}
        onResetFilters={onResetFilters}
        persistKey="initiatives.keyboard-reset.v1"
        emptyTitle="Empty"
        emptyDescription="Empty description"
      />
    );
    const workspace = screen.getByRole('region', { name: 'Table and preview workspace' });
    workspace.focus();
    fireEvent.keyDown(workspace, { key: 'Enter' });
    expect(onOpen).toHaveBeenCalledWith(row);

    rerender(
      <CanonicalInitiativeRegister
        rows={[]}
        selectedId={null}
        onSelect={vi.fn()}
        onOpen={onOpen}
        onResetFilters={onResetFilters}
        persistKey="initiatives.keyboard-reset.v1"
        emptyTitle="Empty"
        emptyDescription="Empty description"
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Wyczyść filtry' }));
    expect(onResetFilters).toHaveBeenCalledTimes(1);
  });
});
