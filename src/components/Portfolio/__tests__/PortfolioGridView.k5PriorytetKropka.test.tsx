/**
 * K5-I1 — karta grid nie maluje priorytetu crimsonem i nie pokazuje surowego
 * enuma.
 *
 * DEFEKT ZE ZRZUTU (staging 2026-09-13, `k5-inicjatywy-widok-grid-jasny.png`):
 * kropka przy „MEDIUM" była BORDOWA (#85182F / #902C41), bo `PRIORITY_TONE`
 * mapowało `MEDIUM → 'accent'`, a ten ton sięga po zmienną akcentu MARKI —
 * Harvard Crimson, zakazany jako dana (tailwind.config.js §15.1). Ta sama
 * inicjatywa miała w tym samym czasie kropkę NIEBIESKĄ na kanbanie
 * i POMARAŃCZOWĄ w panelu Właściwości. Etykieta szła surowym enumem
 * („MEDIUM"), gdy kanban tłumaczył ją przez `initiatives.priority.*`.
 */
import { render, screen, within } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { priorityToneStyle } from '../../standard/PriorityCell';
import { InitiativeStatus, type PortfolioInitiative } from '../../../types';
import { PortfolioGridView } from '../PortfolioGridView';

const mediumInitiative = {
  id: 'init-medium',
  name: 'Optymalizacja zapasów komponentów',
  axis: 'processes',
  status: InitiativeStatus.IN_EXECUTION,
  priority: 'MEDIUM',
  progress: 0,
  budget: 0,
} as unknown as PortfolioInitiative;

describe('K5-I1 — kropka priorytetu na karcie grid', () => {
  it('używa skali z `standard/PriorityCell`, nie zmiennej marki', () => {
    render(<PortfolioGridView initiatives={[mediumInitiative]} onInitiativeClick={vi.fn()} />);

    const card = screen.getByTestId('standard-grid-card-init-medium');
    const dot = card.querySelector(`.${priorityToneStyle('MEDIUM').dot}`);

    expect(dot).not.toBeNull();
    // Kropka crimson szła INLINE stylem (`background-color` ze zmiennej marki),
    // więc sprawdzamy i sam kolor, i to, że kropka nie stoi już na stylu inline.
    expect(card.innerHTML).not.toContain('85182');
    expect(card.innerHTML).not.toContain('902C41');
    expect((dot as HTMLElement).getAttribute('style')).toBeNull();
  });

  it('pokazuje etykietę priorytetu, nie surowy enum bazy', () => {
    render(<PortfolioGridView initiatives={[mediumInitiative]} onInitiativeClick={vi.fn()} />);

    const card = screen.getByTestId('standard-grid-card-init-medium');
    expect(within(card).queryByText('MEDIUM')).toBeNull();
  });
});
