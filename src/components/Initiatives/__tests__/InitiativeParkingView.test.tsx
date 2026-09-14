/** @vitest-environment jsdom */

import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({ listPortfolioDispositions: vi.fn() }));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string | { defaultValue?: string }) =>
      typeof fallback === 'string' ? fallback : (fallback?.defaultValue ?? key),
    i18n: { language: 'en', resolvedLanguage: 'en' },
  }),
}));
vi.mock('@/services/initiatives-execution/runtimeApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/services/initiatives-execution/runtimeApi')>()),
  ...api,
}));

import { InitiativeParkingView } from '../InitiativeParkingView';

const parked = {
  decisionId: 'decision-parked',
  initiativeId: 'initiative-parked',
  kind: 'PARKING' as const,
  reason: 'Overlaps the automation wave already running.',
  returnCondition: 'Returns when the automation wave closes.',
  actorId: 'manager-a',
  decidedAt: '2026-09-14T08:00:00.000Z',
  analysisId: 'analysis-1',
  projectId: 'project-a',
};
const archived = {
  ...parked,
  decisionId: 'decision-archived',
  initiativeId: 'initiative-archived',
  kind: 'ARCHIVE' as const,
  reason: 'An earlier Decision already closed this scope.',
  returnCondition: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  api.listPortfolioDispositions.mockResolvedValue([parked, archived]);
});
afterEach(cleanup);

const renderView = () =>
  render(
    <MemoryRouter>
      <InitiativeParkingView
        scopeKey="org-a:manager-a"
        initiativeName={(id) => (id === 'initiative-parked' ? 'Second robotics pilot' : undefined)}
      />
    </MemoryRouter>
  );

describe('F2-1 E1 A2 — lista parkingu', () => {
  it('pokazuje powod nie-wejscia i warunek ponownej propozycji w kanonicznej tabeli', async () => {
    renderView();
    const table = await screen.findByTestId('initiatives-parking-table');
    await within(table).findByText('Second robotics pilot');
    // Tekst wystepuje dwa razy (wiersz tabeli + otwarty podglad) — to celowe,
    // wiec liczymy wystapienia zamiast zadac jednego.
    expect(
      within(table).getAllByText('Overlaps the automation wave already running.').length
    ).toBeGreaterThan(0);
    expect(
      within(table).getAllByText('Returns when the automation wave closes.').length
    ).toBeGreaterThan(0);
  });

  it('gdy warunek powrotu nie zostal podany, mowi to wprost zamiast zostawiac pustke', async () => {
    renderView();
    const table = await screen.findByTestId('initiatives-parking-table');
    await within(table).findByText('An earlier Decision already closed this scope.');
    expect(within(table).getByText('Not stated')).toBeVisible();
  });

  it('bez nazwy w rejestrze pokazuje identyfikator, a nie zmyslona nazwe', async () => {
    renderView();
    const table = await screen.findByTestId('initiatives-parking-table');
    expect(await within(table).findByText('initiative-archived')).toBeVisible();
  });

  it('przy bledzie trasy nie udaje pustego parkingu', async () => {
    api.listPortfolioDispositions.mockRejectedValueOnce(new Error('boom'));
    renderView();
    await waitFor(() =>
      expect(
        screen.getAllByRole('alert').some((el) => el.textContent?.includes('PARKING_UNAVAILABLE'))
      ).toBe(true)
    );
    expect(screen.queryByText('Nothing is parked')).toBeNull();
  });
});
