/**
 * Odbiór na żywo 05.09 (`evidence/odbior-zywo-20260905/16-kanon/wyniki.json`,
 * id `standard-grid-card`, ROZNI_SIE): ekran Inicjatywy → Siatka renderował
 * `InitiativeGridCard` (bespoke JSX) zamiast tego pliku — mimo że
 * `PortfolioGridView` już budował dokładnie kanoniczną kartę `StandardGridCard`
 * (#76a), po prostu nie miał ŻADNEGO wołacza w `InitiativesHub.tsx`. Realny
 * skutek: karcie brakowało paska akcentu kategorii, paska postępu z procentem
 * i kebaba.
 *
 * `InitiativesHub` renderuje teraz `PortfolioGridView`; dodatkowo ten plik
 * zyskał `onArchive`/`onOpenFull` → `rowMenuSections` (kebab), które wcześniej
 * miał tylko `InitiativeGridCard`. Test dowodzi mutacyjnie, że WSZYSTKIE TRZY
 * brakujące elementy są teraz obecne: (1) testid `standard-grid-card-…`
 * (dowód kanonicznego renderera), (2) pasek akcentu (`accentColorVar` →
 * `style.borderLeftColor`), (3) pasek postępu z procentem, (4) kebab
 * (przycisk „Row actions" z `RowActionsMenu`, ten sam co w tabeli).
 */
import { render, screen, within } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { InitiativeStatus, type PortfolioInitiative } from '../../../types';
import { PortfolioGridView } from '../PortfolioGridView';

const initiative = {
  id: 'init-1',
  name: 'Standaryzacja raportów zarządczych KPI',
  axis: 'finance',
  status: InitiativeStatus.IN_EXECUTION,
  priority: 'HIGH',
  progress: 42,
  budget: 100000,
} as unknown as PortfolioInitiative;

describe('PortfolioGridView renders through the canonical StandardGridCard (kanon #76a)', () => {
  it('shows the accent bar, the progress bar, and the row-actions kebab', () => {
    render(
      <PortfolioGridView
        initiatives={[initiative]}
        onInitiativeClick={vi.fn()}
        onArchive={vi.fn()}
        onOpenFull={vi.fn()}
      />
    );

    // Proof #1 — canonical renderer: this testid only exists on StandardGridCard.
    const card = screen.getByTestId('standard-grid-card-init-1');

    // Proof #2 — category accent bar (kanon #76a "lewy pasek akcentu ~3px").
    expect(card.style.borderLeftColor).toBeTruthy();

    // Proof #3 — progress bar with a percentage readout.
    expect(within(card).getByText('42%')).toBeInTheDocument();

    // Proof #4 — kebab (RowActionsMenu, same dropdown as the table row).
    expect(within(card).getByRole('button', { name: 'Row actions' })).toBeInTheDocument();
  });

  it('still shows the kebab (Open preview/Edit) even without onArchive/onOpenFull', () => {
    // Mirrors InitiativeGridCard's contract: the kebab is a permanent part of
    // the card (canon A6/§76a) — individual actions disable, the menu itself
    // never disappears.
    render(<PortfolioGridView initiatives={[initiative]} onInitiativeClick={vi.fn()} />);
    const card = screen.getByTestId('standard-grid-card-init-1');
    expect(within(card).getByRole('button', { name: 'Row actions' })).toBeInTheDocument();
  });
});
