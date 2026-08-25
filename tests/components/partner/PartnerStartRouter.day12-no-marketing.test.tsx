/**
 * @vitest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getProgramStatus = vi.fn();

vi.mock('../../../src/services/api/v8', () => ({
  V8PartnerApi: { getProgramStatus: (...args: unknown[]) => getProgramStatus(...args) },
}));

import {
  PartnerOnboardingOrientation,
  PartnerStartRouter,
} from '../../../src/views/partner/PartnerStartRouter';

const MARKETING = 'Zostań Naszym Partnerem';
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

const renderRouter = () =>
  render(<PartnerStartRouter onboardingSurface={<PartnerOnboardingOrientation />} />);

describe('D8 Partner lifecycle routing without acquisition', () => {
  beforeEach(() => getProgramStatus.mockReset());

  it.each(['onboard', 'activate'])(
    '%s renders operational onboarding, never marketing',
    async (phase) => {
      getProgramStatus.mockResolvedValue(statusFor(phase));
      renderRouter();

      expect(await screen.findByTestId('partner-orientation-onboarding')).toBeInTheDocument();
      expect(screen.queryByText(MARKETING)).not.toBeInTheDocument();
    }
  );

  it('unknown phase renders an explanatory state, never marketing', async () => {
    getProgramStatus.mockResolvedValue(statusFor('unexpected'));
    renderRouter();

    expect(await screen.findByTestId('partner-start-unknown')).toBeInTheDocument();
    expect(screen.queryByText(MARKETING)).not.toBeInTheDocument();
  });
});
