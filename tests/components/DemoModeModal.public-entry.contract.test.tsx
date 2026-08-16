/**
 * @vitest-environment jsdom
 *
 * OPS-DEMO-002 — public entry modal contract.
 *
 * Guards three properties of the landing `Try demo` modal:
 *  1. it never renders a raw backend message (hostnames, driver text, stack hints);
 *  2. it distinguishes invalid credentials / signup rejection / unavailable seed,
 *     while a registered address and an unknown address produce the SAME output;
 *  3. a successful signup pins the isolated demo tenant into the store before the
 *     caller navigates, so `X-Demo-Session-Org` is present on the first request.
 *
 * Fixture addresses are namespaced `.invalid` and belong to no real person.
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

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}));

// The motion stand-ins must be STABLE component identities. A Proxy that mints a
// fresh arrow per access remounts the subtree on every render, so a controlled
// input loses focus after the first keystroke and the form never validates.
vi.mock('framer-motion', () => {
  const cache = new Map<string, any>();
  const strip = ({
    children,
    initial: _i,
    animate: _a,
    exit: _e,
    transition: _t,
    ...rest
  }: any) => <div {...rest}>{children}</div>;
  return {
    AnimatePresence: ({ children }: any) => <>{children}</>,
    motion: new Proxy(
      {},
      {
        get: (_target, key: string) => {
          if (!cache.has(key)) cache.set(key, strip);
          return cache.get(key);
        },
      }
    ),
  };
});

const registerDemoMock = vi.fn();
const loginMock = vi.fn();
const enterDemoMock = vi.fn();

vi.mock('../../src/services/api', () => ({
  Api: {
    registerDemo: (...args: unknown[]) => registerDemoMock(...args),
    login: (...args: unknown[]) => loginMock(...args),
    enterDemo: (...args: unknown[]) => enterDemoMock(...args),
    register: vi.fn(),
  },
}));

const setDemoModeMock = vi.fn();
const setDemoSessionOrgIdMock = vi.fn();

vi.mock('../../src/store/useAppStore', () => ({
  useAppStore: {
    getState: () => ({
      setDemoMode: setDemoModeMock,
      setDemoSessionOrgId: setDemoSessionOrgIdMock,
    }),
  },
}));

import {
  DEMO_MODAL_PUBLIC_ERROR_COPY,
  DemoModeModal,
  mapPublicEntryError,
} from '../../src/components/Landing/DemoModeModal';

const SIGNUP_FIXTURE = 'ops-demo-002+modal@fixture.invalid';
const FIXTURE_PASSWORD = 'fixture-pass-1234';

async function submitSignup() {
  const user = userEvent.setup();
  await user.type(screen.getByPlaceholderText('you@company.com'), SIGNUP_FIXTURE);
  await user.type(screen.getByPlaceholderText('Min. 8 characters'), FIXTURE_PASSWORD);
  await user.click(screen.getByRole('button', { name: /Sign up & Enter Demo/i }));
  return user;
}

async function submitLogin() {
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'Log in' }));
  await user.type(screen.getByPlaceholderText('you@company.com'), SIGNUP_FIXTURE);
  await user.type(screen.getByPlaceholderText('••••••••'), FIXTURE_PASSWORD);
  await user.click(screen.getByRole('button', { name: /Log in & Enter Demo/i }));
}

function renderDemoModal(onSuccess = vi.fn()) {
  render(
    <DemoModeModal isOpen onClose={vi.fn()} onSuccess={onSuccess} mode="demo" />
  );
  return onSuccess;
}

describe('DemoModeModal public entry contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('a registered address and an unknown address yield the identical public message', () => {
    const duplicate = {
      status: 409,
      data: { code: 'DEMO_SIGNUP_UNAVAILABLE', error: 'server wording for a duplicate' },
    };
    const otherFailure = { status: 500, data: { error: 'pg://secret-host:5432/railway' } };

    expect(mapPublicEntryError(duplicate, 'demoSignup')).toBe(
      mapPublicEntryError(otherFailure, 'demoSignup')
    );
    expect(mapPublicEntryError(duplicate, 'demoSignup')).toBe(
      DEMO_MODAL_PUBLIC_ERROR_COPY.signupUnavailable
    );
  });

  it('separates unavailable seed from a credential problem', () => {
    expect(
      mapPublicEntryError({ data: { code: 'DEMO_SEED_UNAVAILABLE' } }, 'demoSignup')
    ).toBe(DEMO_MODAL_PUBLIC_ERROR_COPY.demoUnavailable);
    expect(mapPublicEntryError({ code: 'DEMO_UNAVAILABLE' }, 'demoLogin')).toBe(
      DEMO_MODAL_PUBLIC_ERROR_COPY.demoUnavailable
    );
    expect(mapPublicEntryError(new Error('whatever'), 'demoLogin')).toBe(
      DEMO_MODAL_PUBLIC_ERROR_COPY.invalidCredentials
    );
  });

  it('renders the neutral signup message and leaks nothing from the backend', async () => {
    const leaky: any = new Error('postgres://rw-user:secret@internal-host/db');
    leaky.status = 409;
    leaky.data = { code: 'DEMO_SIGNUP_UNAVAILABLE' };
    registerDemoMock.mockRejectedValueOnce(leaky);

    renderDemoModal();
    await submitSignup();

    await waitFor(() => {
      const alert = screen.getByRole('alert');
      expect(alert).toHaveTextContent(DEMO_MODAL_PUBLIC_ERROR_COPY.signupUnavailable);
      expect(alert).not.toHaveTextContent('postgres://');
      expect(alert).not.toHaveTextContent('internal-host');
    });
  });

  it('never replays the typed password against an existing account', async () => {
    const duplicate: any = new Error('duplicate');
    duplicate.status = 409;
    duplicate.data = { code: 'DEMO_SIGNUP_UNAVAILABLE' };
    registerDemoMock.mockRejectedValueOnce(duplicate);

    renderDemoModal();
    await submitSignup();

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    // The old fallback logged in silently on EMAIL_IN_USE — an existence oracle
    // and a credential replay in one. It must not happen any more.
    expect(loginMock).not.toHaveBeenCalled();
    expect(enterDemoMock).not.toHaveBeenCalled();
  });

  it('pins the isolated demo tenant into the store on a successful signup', async () => {
    registerDemoMock.mockResolvedValueOnce({
      user: { id: 'u-1', email: SIGNUP_FIXTURE },
      token: 't',
      refreshToken: 'r',
      isDemo: true,
      demoSession: {
        id: 's-1',
        organizationId: 'demo-org-session-u1-abc',
        locale: 'en',
        expiresAt: '2026-08-02T00:00:00.000Z',
        anchorDate: '2026-08-01T00:00:00.000Z',
      },
    });

    const onSuccess = renderDemoModal();
    await submitSignup();

    await waitFor(() => {
      expect(setDemoModeMock).toHaveBeenCalledWith(true);
      expect(setDemoSessionOrgIdMock).toHaveBeenCalledWith('demo-org-session-u1-abc');
      expect(onSuccess).toHaveBeenCalled();
    });
  });

  it('reuses a returning public-demo session without calling the forbidden enable toggle', async () => {
    loginMock.mockResolvedValueOnce({
      id: 'u-returning',
      email: SIGNUP_FIXTURE,
      isDemo: true,
      demoSession: {
        id: 's-returning',
        organizationId: 'demo-org-session-returning-abc',
        locale: 'en',
        expiresAt: '2026-08-18T00:00:00.000Z',
        anchorDate: '2026-08-17T00:00:00.000Z',
      },
    });

    const onSuccess = renderDemoModal();
    await submitLogin();

    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    expect(enterDemoMock).not.toHaveBeenCalled();
    expect(setDemoSessionOrgIdMock).toHaveBeenCalledWith('demo-org-session-returning-abc');
  });
});
