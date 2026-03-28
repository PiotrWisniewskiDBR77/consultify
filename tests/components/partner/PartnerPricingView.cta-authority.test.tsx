/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ROUTES } from '../../../src/routes/routeConfig';
import { PartnerPricingView } from '../../../src/views/partner/PartnerPricingView';

const navigateMock = vi.fn();
const setCurrentViewMock = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock('../../../src/store/useAppStore', () => ({
  useAppStore: () => ({
    setCurrentView: setCurrentViewMock,
  }),
}));

describe('PartnerPricingView CTA authority', () => {
  beforeEach(() => {
    navigateMock.mockReset();
    setCurrentViewMock.mockReset();
    vi.stubGlobal('IntersectionObserver', class {
      observe() {}
      unobserve() {}
      disconnect() {}
    });
  });

  it('routes entry CTAs to onboarding and governed partner docs', () => {
    render(<PartnerPricingView />);

    fireEvent.click(screen.getAllByRole('button', { name: 'Otwórz onboarding partnera' })[0]);
    expect(navigateMock).toHaveBeenCalledWith(ROUTES.PARTNER.ONBOARDING);

    fireEvent.click(screen.getByRole('button', { name: 'Otwórz materiały partnera' }));
    expect(navigateMock).toHaveBeenCalledWith(`${ROUTES.PARTNER.LANDING}?tab=documentation`);
  });
});
