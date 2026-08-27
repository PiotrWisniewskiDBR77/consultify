/**
 * @vitest-environment jsdom
 *
 * Day-39 FIX-2 regression guard.
 *
 * The previous version of this file asserted on `isQuickAccessEnabledHost`
 * directly and passed green while the component never called it — `AuthView`
 * called the WIDE `isQuickAccessShortcutHost`, which `consultify.ai` passes.
 * The result on production was a logo announced to screen readers as
 * "Open quick PIN sign-in" opening a panel that did nothing at all.
 *
 * So every assertion below renders the REAL component and looks at what a user
 * (or a screen reader) actually gets. Pointing `AuthView` back at the wide
 * filter turns this file red.
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: any) =>
      typeof fallback === 'string' ? fallback : (fallback?.defaultValue ?? _key),
  }),
}));

const quickAccessSignInMock = vi.fn();

vi.mock('../../src/services/api', () => ({
  API_URL: 'https://api.example.test',
  Api: {
    login: vi.fn(),
    quickAccessSignIn: (...args: unknown[]) => quickAccessSignInMock(...args),
    verifyAccessCode: vi.fn(),
    register: vi.fn(),
    registerDemo: vi.fn(),
    enterDemo: vi.fn(),
  },
}));

import { AuthView } from '../../src/views/AuthView';
import { AuthStep, SessionMode } from '../../src/types';

const LOGO_ARIA = 'Open quick PIN sign-in (double-click)';
const PIN_ARIA = 'Four-digit quick access PIN';

function setHostname(hostname: string): void {
  Object.defineProperty(window, 'location', {
    value: { ...window.location, hostname, href: `https://${hostname}/auth` },
    writable: true,
  });
}

function renderAuthView() {
  return render(
    <AuthView
      initialStep={AuthStep.LOGIN}
      targetMode={SessionMode.FREE}
      onAuthSuccess={vi.fn()}
      onBack={vi.fn()}
    />
  );
}

describe('AuthView quick access shortcut — rendered component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    localStorage.clear();
  });

  it.each(['consultify.ai', 'www.consultify.ai'])(
    'announces no PIN affordance on the public production host %s',
    async (hostname) => {
      setHostname(hostname);
      const user = userEvent.setup();
      renderAuthView();

      // Nothing is advertised to assistive technology...
      expect(screen.queryByLabelText(LOGO_ARIA)).toBeNull();
      expect(screen.queryByRole('button', { name: LOGO_ARIA })).toBeNull();

      // ...and the keyboard shortcut does not reveal the field.
      await user.keyboard('{Control>}{Shift>}K{/Shift}{/Control}');
      expect(screen.queryByLabelText(PIN_ARIA)).toBeNull();
    }
  );

  it.each(['localhost', '127.0.0.1', 'demo.consultify.ai', 'stage.consultify.ai'])(
    'offers the PIN field on the non-production host %s',
    async (hostname) => {
      setHostname(hostname);
      const user = userEvent.setup();
      renderAuthView();

      expect(screen.getByLabelText(LOGO_ARIA)).toBeInTheDocument();
      await user.keyboard('{Control>}{Shift>}K{/Shift}{/Control}');
      expect(await screen.findByLabelText(PIN_ARIA)).toBeInTheDocument();
    }
  );

  it('offers nothing on an arbitrary host', async () => {
    setHostname('evil.example.com');
    const user = userEvent.setup();
    renderAuthView();

    expect(screen.queryByLabelText(LOGO_ARIA)).toBeNull();
    await user.keyboard('{Control>}{Shift>}K{/Shift}{/Control}');
    expect(screen.queryByLabelText(PIN_ARIA)).toBeNull();
  });

  it('sends the PIN to the server and never a password', async () => {
    setHostname('localhost');
    quickAccessSignInMock.mockResolvedValueOnce({ id: 'u-1', email: 'someone@example.test' });
    const user = userEvent.setup();
    renderAuthView();

    await user.keyboard('{Control>}{Shift>}K{/Shift}{/Control}');
    await user.type(await screen.findByLabelText(PIN_ARIA), '9999');

    await waitFor(() => expect(quickAccessSignInMock).toHaveBeenCalledTimes(1));
    // Exactly one argument, the four digits. No account, no password.
    expect(quickAccessSignInMock.mock.calls[0]).toEqual(['9999']);
  });

  it('surfaces a visible error when the server refuses the PIN', async () => {
    setHostname('localhost');
    quickAccessSignInMock.mockRejectedValueOnce(new Error('pg://secret-host/internal'));
    const user = userEvent.setup();
    renderAuthView();

    await user.keyboard('{Control>}{Shift>}K{/Shift}{/Control}');
    await user.type(await screen.findByLabelText(PIN_ARIA), '1111');

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Quick access is temporarily unavailable');
    expect(alert).not.toHaveTextContent('pg://secret-host/internal');
  });
});
