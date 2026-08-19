/**
 * Bramka: kebab wiersza nie pokazuje ATRAP.
 *
 * Piotr, P-17 (Sejf) / P-18 (Run agent): „Ta tabela jest w ogóle wbrew
 * jakimkolwiek standardom" — o menu, w którym 3 z 4 pozycji były martwe.
 * Wzorcem jest kebab Interview→Templates: 9 pozycji, zero wyłączonych.
 *
 * Rozróżnienie, którego pilnuje ten test:
 *   „jeszcze tego nie ma"  → znika z menu
 *   „nie wolno, bo…"       → zostaje wyłączone, z powodem
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { describe, expect, it } from 'vitest';

import { czyAtrapa, RowActionsMenu } from '@/components/shared/RowActionsMenu';

describe('czyAtrapa — rozróżnienie „nie ma" od „nie wolno"', () => {
  it('uznaje za atrapę wyłączoną akcję z „Coming soon"', () => {
    expect(czyAtrapa({ disabled: true, description: 'Coming soon (backend)' })).toBe(true);
    expect(czyAtrapa({ disabled: true, description: 'Wkrótce (backend)' })).toBe(true);
  });

  it('NIE uznaje za atrapę blokady z powodem merytorycznym', () => {
    // Te trzy komunikaty przeglad wskazal jako WZORCOWE — ucza reguly produktu.
    expect(czyAtrapa({ disabled: true, description: 'AI-generated — read-only' })).toBe(false);
    expect(czyAtrapa({ disabled: true, description: 'Archive first' })).toBe(false);
    expect(
      czyAtrapa({ disabled: true, description: 'Safes are automatic — cannot be deleted' })
    ).toBe(false);
  });

  it('nie rusza akcji działających', () => {
    expect(czyAtrapa({ disabled: false, description: 'Coming soon' })).toBe(false);
    expect(czyAtrapa({})).toBe(false);
  });
});

describe('RowActionsMenu — menu bez atrap', () => {
  const sekcje = [
    {
      id: 'manage',
      actions: [
        { id: 'open', label: 'Otwórz podgląd', onClick: () => undefined },
        {
          id: 'archive',
          label: 'Archiwizuj',
          onClick: () => undefined,
          disabled: true,
          description: 'Coming soon (backend)',
        },
        {
          id: 'delete',
          label: 'Usuń',
          onClick: () => undefined,
          disabled: true,
          description: 'Safes are automatic — cannot be deleted',
        },
      ],
    },
  ];

  it('ukrywa „jeszcze tego nie ma", zostawia „nie wolno, bo…"', async () => {
    const user = userEvent.setup();
    render(<RowActionsMenu sections={sekcje} />);

    await user.click(screen.getByRole('button'));

    expect(screen.getByText('Otwórz podgląd')).toBeTruthy();
    expect(screen.queryByText('Archiwizuj')).toBeNull();
    // Blokada z powodem ZOSTAJE jako pozycja — znika tylko jej powód.
    // Decyzja zarządzająca R01 (2026-08-06), nadrzędna wobec P-17/P-18:
    // disabled jest widoczny i jaśniejszy, ale bez komentarza w menu (§1/§7/§10).
    expect(screen.getByText('Usuń')).toBeTruthy();
    expect(screen.getByText('Usuń').closest('button')).toBeDisabled();
    expect(screen.queryByText(/Safes are automatic/)).toBeNull();
  });

  it('gdy po odsianiu atrap nie zostaje nic, kebab w ogóle się nie renderuje', () => {
    const { container } = render(
      <RowActionsMenu
        sections={[
          {
            id: 'manage',
            actions: [
              {
                id: 'archive',
                label: 'Archiwizuj',
                onClick: () => undefined,
                disabled: true,
                description: 'Coming soon (backend)',
              },
            ],
          },
        ]}
      />
    );

    // Pusty kebab to gorzej niz brak kebaba — obiecuje akcje, ktorych nie ma.
    expect(container.querySelector('button')).toBeNull();
  });

  it('oznacza osobno menu kebaba i menu otwarte przez PPM', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<RowActionsMenu sections={sekcje} />);

    await user.click(screen.getByRole('button'));
    expect(document.querySelector('[data-row-actions-menu="kebab"]')).toBeTruthy();

    rerender(<RowActionsMenu sections={sekcje} contextMenuAnchor={{ x: 200, y: 200 }} />);
    expect(document.querySelector('[data-row-actions-menu="context"]')).toBeTruthy();
  });
});
