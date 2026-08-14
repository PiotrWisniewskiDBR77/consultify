/**
 * @vitest-environment jsdom
 *
 * ★ A10/D3. Karta rozstrzygnięcia pokazywała cztery przyciski, a wszystkie trzy
 * ekrany-wywołujące podawały `onResolutionAction: () => {}`. Użytkownik przy
 * luce wiedzy klikał „Przypisz pytanie" i nie działo się nic — martwy przycisk
 * jest gorszy niż jego brak, bo kosztuje zaufanie dokładnie w momencie, w
 * którym jest ono potrzebne.
 */
import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { ResolutionCard } from '../ResolutionCard';
import { makeResolutionData } from './fixtures';

describe('ResolutionCard — renderuje wyłącznie akcje obsługiwane', () => {
  it('pusta deklaracja = zero przycisków, nie cztery martwe', () => {
    render(<ResolutionCard data={makeResolutionData()} onAction={vi.fn()} availableActions={[]} />);
    expect(screen.getByTestId('resolution-card')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('deklaracja jednej akcji pokazuje dokładnie ją', () => {
    render(
      <ResolutionCard data={makeResolutionData()} onAction={vi.fn()} availableActions={['ask_teresa']} />
    );
    expect(screen.getByRole('button', { name: /Zapytaj Teresę/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Przypisz pytanie/ })).not.toBeInTheDocument();
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });

  it('kliknięcie zadeklarowanej akcji dowozi jej identyfikator', () => {
    const onAction = vi.fn();
    render(
      <ResolutionCard data={makeResolutionData()} onAction={onAction} availableActions={['ask_teresa']} />
    );
    screen.getByRole('button', { name: /Zapytaj Teresę/ }).click();
    expect(onAction).toHaveBeenCalledWith('ask_teresa');
  });
});
