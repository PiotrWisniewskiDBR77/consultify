/**
 * AuditsMethodHub — druga zakładka „Sesje"/„Sessions" (P0 2026-08-13, Piotr).
 *
 * Osobny plik od `AuditsMethodHub.test.tsx` bo ten ostatni mockuje
 * `react-i18next` NA STAŁE z `i18n.language: 'en'` — tu potrzebujemy `pl`,
 * żeby dowieść, że etykieta faktycznie zmienia się z językiem konta (nie
 * jest twardo zakodowanym stringiem po angielsku).
 *
 * Id zakładki w URL ZOSTAJE `processes` dla zgodności istniejących linków —
 * zmienia się WYŁĄCZNIE etykieta widoczna dla użytkownika.
 */
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string | { defaultValue?: string }) => {
      if (typeof fallback === 'string') return fallback;
      if (fallback && typeof fallback === 'object' && fallback.defaultValue) return fallback.defaultValue;
      return key;
    },
    i18n: { language: 'pl' },
  }),
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}));

vi.mock('react-hot-toast', () => {
  const fn = vi.fn();
  return { default: Object.assign(fn, { success: vi.fn(), error: vi.fn(), loading: vi.fn(() => 'toast-id') }) };
});

vi.mock('../auditsMethodApi', async () => {
  const actual = await vi.importActual<typeof import('../auditsMethodApi')>('../auditsMethodApi');
  return {
    ...actual,
    listPacks: vi.fn(async () => ({ items: [], total: 0 })),
    listPrograms: vi.fn(async () => ({ items: [], total: 0 })),
    listOutputs: vi.fn(async () => ({ items: [], total: 0 })),
    listReports: vi.fn(async () => ({ items: [], total: 0 })),
    listProposals: vi.fn(async () => ({ items: [], total: 0 })),
    createProgram: vi.fn(),
    getPack: vi.fn(),
    getProgram: vi.fn(),
    getProgramCoverage: vi.fn(),
    getProgramLifecycle: vi.fn(),
  };
});

import { AuditsMethodHub } from '../AuditsMethodHub';

describe('AuditsMethodHub — Sesje/Sessions label follows account language', () => {
  it('shows "Sesje" for a Polish account, and `?tab=processes` still resolves to that tab', async () => {
    render(
      <MemoryRouter initialEntries={['/audit-programs/method?tab=processes']}>
        <AuditsMethodHub />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByRole('tab', { name: 'Sesje', selected: true })).toBeInTheDocument());
    // English label must NOT leak into a Polish account.
    expect(screen.queryByRole('tab', { name: 'Sessions' })).toBeNull();
    expect(screen.queryByRole('tab', { name: 'Processes' })).toBeNull();
  });
});
