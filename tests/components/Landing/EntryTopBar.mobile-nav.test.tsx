/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { describe, expect, it, vi } from 'vitest';

// F2 fix: don't import the real i18next singleton in tests — it's a true
// module-level singleton (src/i18n.ts calls i18n.init() at import time) and
// importing it directly across many test files leaks state between them,
// crashing the coverage collection run. react-i18next is globally mocked in
// tests/setup.ts (I18nextProvider is a passthrough), so this stub only needs
// to satisfy the `i18n` prop shape.
const i18n: any = { language: 'en', changeLanguage: () => Promise.resolve() };
import { EntryTopBar } from '../../../src/components/Landing/EntryTopBar';

const navigateMock = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock('../../../src/store/useAppStore', () => ({
  useAppStore: () => ({
    theme: 'dark',
    toggleTheme: vi.fn(),
  }),
}));

function renderTopBar() {
  return render(
    <I18nextProvider i18n={i18n}>
      <EntryTopBar
        onTrialClick={vi.fn()}
        onDemoClick={vi.fn()}
        onLoginClick={vi.fn()}
        onRegisterClick={vi.fn()}
        isLoggedIn={false}
        hasWorkspace={false}
        forceDark
      />
    </I18nextProvider>,
  );
}

describe('EntryTopBar mobile navigation continuity', () => {
  it('exposes the canonical public landing IA links inside the mobile menu', async () => {
    renderTopBar();

    fireEvent.click(screen.getByTestId('landing-mobile-menu-trigger'));

    const panel = screen.getByTestId('landing-mobile-menu-panel');
    expect(panel).toBeInTheDocument();
    expect(within(panel).getByRole('button', { name: 'Product' })).toBeInTheDocument();
    expect(within(panel).getByRole('button', { name: 'Knowledge Base' })).toBeInTheDocument();
    expect(within(panel).getByRole('button', { name: 'Pricing' })).toBeInTheDocument();
    expect(within(panel).getByRole('button', { name: 'Partners' })).toBeInTheDocument();
    expect(within(panel).getByRole('button', { name: 'Security' })).toBeInTheDocument();
    expect(within(panel).getByRole('button', { name: 'Become Partner' })).toBeInTheDocument();
  });

  it('navigates to public pricing from the mobile menu and closes the panel', async () => {
    renderTopBar();

    fireEvent.click(screen.getByTestId('landing-mobile-menu-trigger'));
    fireEvent.click(within(screen.getByTestId('landing-mobile-menu-panel')).getByRole('button', { name: 'Pricing' }));

    expect(navigateMock).toHaveBeenCalledWith('/pricing');
    await waitFor(() =>
      expect(screen.queryByTestId('landing-mobile-menu-panel')).not.toBeInTheDocument(),
    );
  });

  it('routes knowledge base to the canonical public knowledge entry from the mobile menu', async () => {
    renderTopBar();

    fireEvent.click(screen.getByTestId('landing-mobile-menu-trigger'));
    fireEvent.click(
      within(screen.getByTestId('landing-mobile-menu-panel')).getByRole('button', {
        name: 'Knowledge Base',
      })
    );

    expect(navigateMock).toHaveBeenCalledWith('/knowledge-base');
    await waitFor(() =>
      expect(screen.queryByTestId('landing-mobile-menu-panel')).not.toBeInTheDocument(),
    );
  });

  it('navigates to become-partner from the mobile menu and closes the panel', async () => {
    renderTopBar();

    fireEvent.click(screen.getByTestId('landing-mobile-menu-trigger'));
    fireEvent.click(
      within(screen.getByTestId('landing-mobile-menu-panel')).getByRole('button', {
        name: 'Become Partner',
      }),
    );

    expect(navigateMock).toHaveBeenCalledWith('/become-partner');
    await waitFor(() =>
      expect(screen.queryByTestId('landing-mobile-menu-panel')).not.toBeInTheDocument(),
    );
  });

  it('exposes the same canonical IA links in the desktop menu dropdown', () => {
    renderTopBar();

    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));

    expect(screen.getByRole('button', { name: 'Product' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Knowledge Base' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pricing' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Partners' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Security' })).toBeInTheDocument();
  });
});
