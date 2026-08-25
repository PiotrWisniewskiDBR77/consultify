/**
 * @vitest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import React from 'react';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const i18n: any = { language: 'pl', changeLanguage: () => Promise.resolve() };
const navigate = vi.fn();
const getConnection = vi.fn();
const getProgramStatus = vi.fn();

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => navigate };
});

vi.mock('../../../src/services/api', () => ({
  Api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

vi.mock('../../../src/services/api/v8', () => ({
  V8PartnerApi: {
    getConnection: (...args: unknown[]) => getConnection(...args),
    getProgramStatus: (...args: unknown[]) => getProgramStatus(...args),
  },
  shouldFallbackToLegacyPartner: () => false,
}));

import { PartnerPortalViewNew } from '../../../src/views/partner/PartnerPortalView';

const statusFor = (lifecyclePhase: string) => ({
  lifecyclePhase,
  payoutSettingsComplete: false,
  balances: {
    grossEarned: 0,
    paidOut: 0,
    heldAmount: 0,
    availableToPayout: 0,
    currency: 'EUR',
  },
  whatNext: [],
  hold: null,
});

const renderPortal = () =>
  render(
    <MemoryRouter initialEntries={['/partner?tab=partner-home']}>
      <I18nextProvider i18n={i18n}>
        <PartnerPortalViewNew />
      </I18nextProvider>
    </MemoryRouter>
  );

describe('D8 /partner four-state contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    navigate.mockReset();
    getConnection.mockReset();
    getProgramStatus.mockReset();
  });

  it('connected active partner sees the operational dashboard', async () => {
    getConnection.mockResolvedValue({ connected: true, partnerOrganizationId: 'partner-1' });
    getProgramStatus.mockResolvedValue(statusFor('earn'));
    renderPortal();

    expect(await screen.findByTestId('partner-start-active')).toBeInTheDocument();
    expect(screen.queryByText('Zostań Naszym Partnerem')).not.toBeInTheDocument();
  });

  it('unconnected partner sees one-screen orientation, never acquisition', async () => {
    getConnection.mockResolvedValue({ connected: false, partnerOrganizationId: null });
    renderPortal();

    expect(await screen.findByTestId('partner-orientation-unconnected')).toBeInTheDocument();
    expect(screen.queryByText('Zostań Naszym Partnerem')).not.toBeInTheDocument();
  });

  it('connected onboarding partner stays in operational orientation', async () => {
    getConnection.mockResolvedValue({ connected: true, partnerOrganizationId: 'partner-1' });
    getProgramStatus.mockResolvedValue(statusFor('onboard'));
    renderPortal();

    expect(await screen.findByTestId('partner-orientation-onboarding')).toBeInTheDocument();
    expect(screen.queryByText('Zostań Naszym Partnerem')).not.toBeInTheDocument();
  });

  it('unknown connection response renders explanation, never registration', async () => {
    getConnection.mockResolvedValue(undefined);
    renderPortal();

    expect(await screen.findByTestId('partner-orientation-error')).toBeInTheDocument();
    expect(screen.queryByText('Zostań Naszym Partnerem')).not.toBeInTheDocument();
  });

  it('unknown lifecycle renders an honest state, never registration', async () => {
    getConnection.mockResolvedValue({ connected: true, partnerOrganizationId: 'partner-1' });
    getProgramStatus.mockResolvedValue(statusFor('unknown-value'));
    renderPortal();

    expect(await screen.findByTestId('partner-start-unknown')).toBeInTheDocument();
    expect(screen.queryByText('Zostań Naszym Partnerem')).not.toBeInTheDocument();
  });
});
