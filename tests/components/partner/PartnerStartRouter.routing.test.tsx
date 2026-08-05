/**
 * M16 — Start routing by persisted partner status (owner decision 2026-08-05).
 *
 * invited / onboarding → acquisition + next onboarding step
 * earn / payout        → earnings dashboard, no "Be Our Partner"
 * unknown / error      → honest degraded state, NEVER the acquisition screen
 *
 * Includes the required negative control: the OLD routing (always render the
 * acquisition surface) fails these expectations.
 */
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { getProgramStatusMock } = vi.hoisted(() => ({ getProgramStatusMock: vi.fn() }));

vi.mock('../../../src/services/api/v8', () => ({
  V8PartnerApi: { getProgramStatus: (...a: unknown[]) => getProgramStatusMock(...a) },
  shouldFallbackToLegacyPartner: () => false,
}));

import { PartnerStartRouter, resolveStartVariant } from '../../../src/views/partner/PartnerStartRouter';

const ACQUISITION_MARKER = 'Zostań Naszym Partnerem';
const OnboardingSurface = () => <div>{ACQUISITION_MARKER}</div>;

const statusFor = (lifecyclePhase: string) => ({
  lifecyclePhase,
  partnerOrganizationStatus: 'active',
  payoutSettingsComplete: true,
  balances: {
    grossEarned: 250,
    paidOut: 514.8,
    heldAmount: 0,
    availableToPayout: 0,
    currency: 'EUR',
    paidReconciliation: {
      status: 'LEDGER_BEHIND_REGISTER',
      ledgerReconciled: 0,
      settledPayouts: 514.8,
      unreconciledAmount: 514.8,
    },
  },
  whatNext: ['Operator dokończy payout w rejestrze.'],
  hold: null,
});

const renderRouter = () =>
  render(<PartnerStartRouter onboardingSurface={<OnboardingSurface />} />);

beforeEach(() => {
  getProgramStatusMock.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('resolveStartVariant', () => {
  it.each([
    ['invited', 'onboarding'],
    ['onboarding', 'onboarding'],
    ['onboard', 'onboarding'],
    ['activate', 'onboarding'],
    ['earn', 'active'],
    ['payout', 'active'],
    ['', 'unknown'],
    ['something-else', 'unknown'],
  ])('maps %s → %s', (phase, expected) => {
    expect(resolveStartVariant(phase)).toBe(expected);
  });
});

describe('Start surface by persisted status', () => {
  it('invited → onboarding/acquisition surface', async () => {
    getProgramStatusMock.mockResolvedValue(statusFor('invited'));
    renderRouter();
    expect(await screen.findByTestId('partner-start-onboarding')).toBeInTheDocument();
    expect(screen.getByText(ACQUISITION_MARKER)).toBeInTheDocument();
  });

  it('onboarding → onboarding/acquisition surface', async () => {
    getProgramStatusMock.mockResolvedValue(statusFor('onboarding'));
    renderRouter();
    expect(await screen.findByTestId('partner-start-onboarding')).toBeInTheDocument();
  });

  it('earn → earnings dashboard, never the acquisition screen', async () => {
    getProgramStatusMock.mockResolvedValue(statusFor('earn'));
    renderRouter();
    expect(await screen.findByTestId('partner-start-active')).toBeInTheDocument();
    expect(screen.queryByText(ACQUISITION_MARKER)).not.toBeInTheDocument();
    expect(screen.getByTestId('partner-start-tile-paid')).toBeInTheDocument();
  });

  it('payout → earnings/payout dashboard with whatNext driving the next step', async () => {
    getProgramStatusMock.mockResolvedValue(statusFor('payout'));
    renderRouter();
    expect(await screen.findByTestId('partner-start-active')).toBeInTheDocument();
    expect(screen.queryByText(ACQUISITION_MARKER)).not.toBeInTheDocument();
    expect(screen.getAllByTestId('partner-start-whatnext-item')).toHaveLength(1);
    expect(screen.getByText(/Operator dokończy payout/)).toBeInTheDocument();
  });

  it('shows the paid figure from the settled register, not a bare zero', async () => {
    getProgramStatusMock.mockResolvedValue(statusFor('payout'));
    renderRouter();
    const paidTile = await screen.findByTestId('partner-start-tile-paid');
    expect(paidTile.textContent).toMatch(/514[,.]8/);
    expect(screen.getByTestId('partner-start-reconciliation')).toBeInTheDocument();
  });

  it('unknown phase → honest state, not acquisition', async () => {
    getProgramStatusMock.mockResolvedValue(statusFor('who-knows'));
    renderRouter();
    expect(await screen.findByTestId('partner-start-unknown')).toBeInTheDocument();
    expect(screen.queryByText(ACQUISITION_MARKER)).not.toBeInTheDocument();
  });

  it('read error → honest state, not acquisition', async () => {
    getProgramStatusMock.mockRejectedValue(new Error('boom'));
    renderRouter();
    expect(await screen.findByTestId('partner-start-unknown')).toBeInTheDocument();
    expect(screen.queryByText(ACQUISITION_MARKER)).not.toBeInTheDocument();
  });

  it('never assumes a default status before the server answers', async () => {
    let resolve!: (v: unknown) => void;
    getProgramStatusMock.mockReturnValue(new Promise((r) => (resolve = r)));
    renderRouter();
    // While pending: neither variant may be shown.
    expect(screen.getByTestId('partner-start-loading')).toBeInTheDocument();
    expect(screen.queryByText(ACQUISITION_MARKER)).not.toBeInTheDocument();
    expect(screen.queryByTestId('partner-start-active')).not.toBeInTheDocument();
    resolve(statusFor('earn'));
    expect(await screen.findByTestId('partner-start-active')).toBeInTheDocument();
  });

  it('fresh reopen re-reads the status from the server and reproduces the variant', async () => {
    getProgramStatusMock.mockResolvedValue(statusFor('payout'));
    const first = renderRouter();
    expect(await screen.findByTestId('partner-start-active')).toBeInTheDocument();
    first.unmount();

    // Reopen: a second, independent mount must fetch again and route the same.
    renderRouter();
    expect(await screen.findByTestId('partner-start-active')).toBeInTheDocument();
    await waitFor(() => expect(getProgramStatusMock).toHaveBeenCalledTimes(2));
  });

  it('NEGATIVE CONTROL — the old routing (always acquisition) fails the earn case', async () => {
    // The pre-repair behaviour: `case 'partner-home': return <ProviderHomeView />`
    const LegacyStart = () => <OnboardingSurface />;
    render(<LegacyStart />);
    expect(screen.getByText(ACQUISITION_MARKER)).toBeInTheDocument();

    // An active partner must NOT see that. Asserting the repair's contract
    // against the legacy render fails, which is the point of this control.
    expect(() => {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const activeSurface = screen.queryByTestId('partner-start-active');
      if (!activeSurface) throw new Error('legacy routing shows acquisition to an active partner');
    }).toThrow(/legacy routing shows acquisition/);
  });
});
