/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import i18n from '../../src/i18n';
import { BecomePartnerView } from '../../src/views/BecomePartnerView';

const navigateMock = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock('../../src/store/useAppStore', () => ({
  useAppStore: () => ({
    currentUser: null,
    setCurrentView: vi.fn(),
    setSessionMode: vi.fn(),
    setCurrentUser: vi.fn(),
    setDemoMode: vi.fn(),
    theme: 'dark',
    toggleTheme: vi.fn(),
  }),
}));

vi.mock('../../src/components/Landing/DemoModeModal', () => ({
  DemoModeModal: () => null,
}));

function renderView() {
  return render(
    <I18nextProvider i18n={i18n}>
      <BecomePartnerView />
    </I18nextProvider>,
  );
}

describe('BecomePartnerView marketing shell parity', () => {
  beforeEach(() => {
    navigateMock.mockReset();
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({}),
      }),
    );
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: { randomUUID: () => 'anna-session-id' },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders shared landing shell chrome and preserves partner portal access', () => {
    renderView();

    expect(screen.getByTestId('landing-mobile-menu-trigger')).toBeInTheDocument();
    expect(screen.getByText('Terms')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ask Anna' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Portal Partnera' }));

    expect(navigateMock).toHaveBeenCalledWith('/partner');
  });
});
