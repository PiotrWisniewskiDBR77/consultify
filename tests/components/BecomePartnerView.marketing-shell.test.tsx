/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// F2 fix: don't import the real i18next singleton in tests — it's a true
// module-level singleton (src/i18n.ts calls i18n.init() at import time) and
// importing it directly across many test files leaks state between them,
// crashing the coverage collection run. react-i18next is globally mocked in
// tests/setup.ts (I18nextProvider is a passthrough), so this stub only needs
// to satisfy the `i18n` prop shape.
const i18n: any = { language: 'en', changeLanguage: () => Promise.resolve() };
import { ROUTES } from '../../src/routes/routeConfig';
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
    </I18nextProvider>
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
      })
    );
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: { randomUUID: () => 'anna-session-id' },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders shared landing shell chrome and the verified program paths', () => {
    renderView();

    expect(screen.getByTestId('landing-mobile-menu-trigger')).toBeInTheDocument();
    expect(screen.getAllByText('Consultify Partner Program').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Ask Anna first' })).toBeInTheDocument();
    expect(screen.getByText('Start with the way you create value')).toBeInTheDocument();
    expect(screen.getAllByRole('tab')).toHaveLength(6);
    expect(screen.queryByText(/do 20% prowizji/i)).toBeNull();
  });

  it('routes the main application CTA to partner onboarding', () => {
    renderView();

    fireEvent.click(screen.getByRole('button', { name: 'Start application' }));

    expect(navigateMock).toHaveBeenCalledWith(ROUTES.PARTNER.PUBLIC_APPLY);
  });
});
