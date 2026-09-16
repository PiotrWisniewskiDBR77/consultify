/**
 * K-21 (zgłoszenie testera #61, Tomek, CRITICAL, `/organization/profile/identity-scale`):
 * „Nie można dodać nowej organizacji".
 *
 * PREMISA ZMIERZONA NA `cbad80887c`: `OrganizationSettings.tsx` renderował
 * przycisk „Create Organization" (i cały modal) WYŁĄCZNIE w gałęzi
 * `organizations.length === 0`. Każdy, kto miał już choć jedną organizację,
 * dostawał widok główny (`:295+`) BEZ jakiegokolwiek wejścia do tworzenia —
 * funkcja istniała w kodzie i w API, ale nie miała wołacza na ekranie.
 *
 * Test renderuje realny komponent z odpowiedzią API „jedna organizacja" i
 * pyta o to, co widzi tester: czy przycisk jest na ekranie i czy otwiera modal.
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => (typeof fallback === 'string' ? fallback : key),
    i18n: { language: 'en' },
  }),
}));

vi.mock('react-hot-toast', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const getUserOrganizations = vi.fn();
const getOrganization = vi.fn();
const getOrganizationMembers = vi.fn();

vi.mock('../../../services/api', () => ({
  Api: {
    getUserOrganizations: (...a: any[]) => getUserOrganizations(...a),
    getOrganization: (...a: any[]) => getOrganization(...a),
    getOrganizationMembers: (...a: any[]) => getOrganizationMembers(...a),
    getOrgTokenBalance: vi.fn().mockResolvedValue(null),
    getOrgTokenLedger: vi.fn().mockResolvedValue([]),
    createOrganization: vi.fn(),
    addOrganizationMember: vi.fn(),
    activateBilling: vi.fn(),
  },
}));

vi.mock('../../../services/api/v8/finance', () => ({
  V8FinanceApi: {
    getSettings: vi.fn().mockResolvedValue(null),
    updateSettings: vi.fn(),
  },
}));

import { OrganizationSettings } from '../OrganizationSettings';

const ORG = { id: 'org-1', name: 'Northwind Manufacturing', billing_status: 'TRIAL' };

const uzytkownik = (role: string) => ({ id: 'u1', email: 't@x.pl', role }) as any;

describe('K-21 — wejście „Create Organization" poza gałęzią zero-org', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUserOrganizations.mockResolvedValue([ORG]);
    getOrganization.mockResolvedValue(ORG);
    getOrganizationMembers.mockResolvedValue([]);
  });

  it('ADMIN z jedną organizacją WIDZI przycisk (usterka: było tylko przy zero orgs)', async () => {
    render(<OrganizationSettings currentUser={uzytkownik('ADMIN')} />);

    const przycisk = await screen.findByRole('button', { name: /Create Organization/i });
    expect(przycisk).toBeTruthy();
  });

  it('przycisk otwiera modal z polem nazwy', async () => {
    render(<OrganizationSettings currentUser={uzytkownik('OWNER')} />);

    const przycisk = await screen.findByRole('button', { name: /Create Organization/i });
    await userEvent.click(przycisk);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('e.g., Acme Corporation')).toBeTruthy();
    });
  });

  it('rola bez uprawnień (CONSULTANT) nie dostaje wejścia, którego serwer i tak by nie przepuścił', async () => {
    render(<OrganizationSettings currentUser={uzytkownik('CONSULTANT')} />);

    await screen.findByText('Organization Settings');
    expect(screen.queryByRole('button', { name: /Create Organization/i })).toBeNull();
  });

  it('pusty stan bez uprawnień: zamiast martwego przycisku — zdanie co zrobić', async () => {
    getUserOrganizations.mockResolvedValue([]);
    render(<OrganizationSettings currentUser={uzytkownik('CONSULTANT')} />);

    await screen.findByText('No Organization Found');
    expect(screen.queryByRole('button', { name: /Create Organization/i })).toBeNull();
    expect(screen.getByText(/Ask your administrator for an invitation/i)).toBeTruthy();
  });
});
