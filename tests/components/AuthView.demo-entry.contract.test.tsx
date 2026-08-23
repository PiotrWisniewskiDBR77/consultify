/**
 * @vitest-environment jsdom
 *
 * OPS-DEMO-002 — the SECOND public demo entry.
 *
 * `DemoModeModal` is the landing-page entry; `AuthView` is the routed one
 * (`/auth/demo`, plus `/login` and `/register` once the user takes the
 * "try demo" redirect). Both must adopt the isolated demo tenant through the
 * SAME helper, and both must do it BEFORE handing control to the caller that
 * navigates — `getHeaders()` derives `X-Demo-Session-Org` from the store, so a
 * navigation that happens first issues its requests against the wrong org.
 *
 * Also pinned: the user object handed to `onAuthSuccess` keeps `isDemo: true`.
 * Without it, `handleAuthSuccess` in AppRoutes runs `setDemoMode(false)` +
 * `resetDemoState()` and undoes the adoption a few lines later.
 *
 * Fixture addresses are namespaced `.invalid` and belong to no real person.
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: any) =>
      typeof fallback === 'string' ? fallback : (fallback?.defaultValue ?? key),
  }),
}));

// Stand-ins must be STABLE component identities. A Proxy that mints a fresh
// arrow per property access remounts the subtree on every render, so controlled
// inputs lose focus after one keystroke and the form never validates.
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
const demoLoginMock = vi.fn();

vi.mock('../../src/services/api', () => ({
  API_URL: 'https://api.example.test',
  Api: {
    registerDemo: (...args: unknown[]) => registerDemoMock(...args),
    login: (...args: unknown[]) => loginMock(...args),
    enterDemo: (...args: unknown[]) => enterDemoMock(...args),
    demoLogin: (...args: unknown[]) => demoLoginMock(...args),
    register: vi.fn(),
    verifyAccessCode: vi.fn(),
  },
}));

// The store is mocked, NOT the adoption helper: the point of these tests is
// that AuthView really drives the shared helper down onto the store.
const setDemoModeMock = vi.fn();
const setDemoSessionOrgIdMock = vi.fn();
const setCurrentOrganizationMock = vi.fn();

vi.mock('../../src/store/useAppStore', () => ({
  useAppStore: {
    getState: () => ({
      setDemoMode: setDemoModeMock,
      setDemoSessionOrgId: setDemoSessionOrgIdMock,
      setCurrentOrganization: setCurrentOrganizationMock,
    }),
  },
}));

import { AuthView } from '../../src/views/AuthView';
import { AuthStep, SessionMode } from '../../src/types';

const SIGNUP_FIXTURE = 'ops-demo-002+authview@fixture.invalid';
const LOGIN_FIXTURE = 'ops-demo-002+authview-login@fixture.invalid';
const FIXTURE_PASSWORD = 'fixture-pass-1234';
const SESSION_ORG = 'demo-org-session-authview-abc';

function demoSessionFixture(organizationId = SESSION_ORG) {
  return {
    id: 'demo-session-1',
    organizationId,
    locale: 'en' as const,
    expiresAt: '2026-08-02T00:00:00.000Z',
    anchorDate: '2026-08-01T00:00:00.000Z',
  };
}

/**
 * The register form has no test ids and its labels are siblings rather than
 * wrappers, so nothing is reachable via `getByLabelText`. Select on the input
 * types instead, and take the two attribute-less text inputs for the name pair.
 */
function registerFields(container: HTMLElement) {
  const form = container.querySelector('form');
  if (!form) throw new Error('register form not rendered');
  const plainText = form.querySelectorAll<HTMLInputElement>('input:not([type])');
  return {
    firstName: plainText[0],
    lastName: plainText[1],
    email: form.querySelector<HTMLInputElement>('input[type="email"]')!,
    password: form.querySelector<HTMLInputElement>('input[type="password"]')!,
    legalConsent: form.querySelector<HTMLInputElement>('input[type="checkbox"]')!,
  };
}

async function fillAndSubmitRegister(
  user: ReturnType<typeof userEvent.setup>,
  container: HTMLElement
) {
  const fields = registerFields(container);
  await user.type(fields.firstName, 'Fixture');
  await user.type(fields.lastName, 'Tester');
  await user.type(fields.email, SIGNUP_FIXTURE);
  await user.type(fields.password, FIXTURE_PASSWORD);
  await user.click(fields.legalConsent);
  await user.click(screen.getByRole('button', { name: 'auth.createStart' }));
}

describe('AuthView public demo entry adopts the isolated demo session', () => {
  let callOrder: string[];
  let onAuthSuccess: ReturnType<typeof vi.fn>;
  const onBack = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    localStorage.clear();
    callOrder = [];
    setDemoSessionOrgIdMock.mockImplementation((orgId: string | null) => {
      callOrder.push(`adopt:${orgId}`);
    });
    setDemoModeMock.mockImplementation((enabled: boolean) => {
      callOrder.push(`demoMode:${enabled}`);
    });
    onAuthSuccess = vi.fn(() => {
      callOrder.push('onAuthSuccess');
    });
    Object.defineProperty(window, 'location', {
      value: { ...window.location, hostname: 'localhost', href: 'http://localhost/auth/demo' },
      writable: true,
    });
  });

  it('retains controlled login email and password values after real input events', async () => {
    const user = userEvent.setup();
    render(
      <AuthView
        initialStep={AuthStep.LOGIN}
        targetMode={SessionMode.DEMO}
        onAuthSuccess={onAuthSuccess}
        onBack={onBack}
      />
    );

    const email = screen.getByTestId('email-input');
    const password = screen.getByTestId('password-input');
    await user.type(email, LOGIN_FIXTURE);
    expect(email).toHaveValue(LOGIN_FIXTURE);
    await user.type(password, FIXTURE_PASSWORD);
    expect(email).toHaveValue(LOGIN_FIXTURE);
    expect(password).toHaveValue(FIXTURE_PASSWORD);
  });

  it('/auth/demo sign-up: adopts the session org BEFORE onAuthSuccess', async () => {
    registerDemoMock.mockResolvedValueOnce({
      user: { id: 'u-1', email: SIGNUP_FIXTURE, isDemo: true },
      token: 't',
      refreshToken: 'r',
      isDemo: true,
      demoSession: demoSessionFixture(),
    });
    const user = userEvent.setup();

    const { container } = render(
      <AuthView
        initialStep={AuthStep.REGISTER}
        targetMode={SessionMode.DEMO}
        onAuthSuccess={onAuthSuccess}
        onBack={onBack}
      />
    );

    await fillAndSubmitRegister(user, container);

    await waitFor(() => expect(onAuthSuccess).toHaveBeenCalled());
    expect(registerDemoMock).toHaveBeenCalledWith(
      expect.objectContaining({ email: SIGNUP_FIXTURE, password: FIXTURE_PASSWORD })
    );
    expect(setDemoModeMock).toHaveBeenCalledWith(true);
    expect(setDemoSessionOrgIdMock).toHaveBeenCalledWith(SESSION_ORG);
    // Ordering is the whole contract: the headers are derived at navigation time.
    expect(callOrder.indexOf(`adopt:${SESSION_ORG}`)).toBeGreaterThanOrEqual(0);
    expect(callOrder.indexOf(`adopt:${SESSION_ORG}`)).toBeLessThan(
      callOrder.indexOf('onAuthSuccess')
    );
  });

  it('/auth/demo sign-up: the user handed over keeps isDemo so AppRoutes does not wipe the adoption', async () => {
    registerDemoMock.mockResolvedValueOnce({
      user: { id: 'u-1', email: SIGNUP_FIXTURE },
      token: 't',
      refreshToken: 'r',
      isDemo: true,
      demoSession: demoSessionFixture(),
    });
    const user = userEvent.setup();

    const { container } = render(
      <AuthView
        initialStep={AuthStep.REGISTER}
        targetMode={SessionMode.DEMO}
        onAuthSuccess={onAuthSuccess}
        onBack={onBack}
      />
    );

    await fillAndSubmitRegister(user, container);

    await waitFor(() => expect(onAuthSuccess).toHaveBeenCalled());
    expect(onAuthSuccess).toHaveBeenCalledWith(
      expect.objectContaining({ isDemo: true, hasWorkspace: true })
    );
  });

  it('demo redirect from a non-demo mount: "try demo" then sign-up adopts the same way', async () => {
    registerDemoMock.mockResolvedValueOnce({
      user: { id: 'u-2', email: SIGNUP_FIXTURE, isDemo: true },
      token: 't',
      refreshToken: 'r',
      isDemo: true,
      demoSession: demoSessionFixture('demo-org-session-redirect-xyz'),
    });
    const user = userEvent.setup();

    const { container } = render(
      <AuthView
        initialStep={AuthStep.REGISTER}
        targetMode={SessionMode.FREE}
        onAuthSuccess={onAuthSuccess}
        onBack={onBack}
      />
    );

    // `startDemoFlow` — the affordance under the register form.
    await user.click(screen.getByRole('button', { name: 'auth.tryDemo' }));
    await fillAndSubmitRegister(user, container);

    await waitFor(() => expect(onAuthSuccess).toHaveBeenCalled());
    expect(registerDemoMock).toHaveBeenCalledTimes(1);
    expect(setDemoSessionOrgIdMock).toHaveBeenCalledWith('demo-org-session-redirect-xyz');
    expect(callOrder.indexOf('adopt:demo-org-session-redirect-xyz')).toBeLessThan(
      callOrder.indexOf('onAuthSuccess')
    );
    expect(onAuthSuccess).toHaveBeenCalledWith(expect.objectContaining({ isDemo: true }));
  });

  it('login tab in demo mode: adopts from the enterDemo payload before onAuthSuccess', async () => {
    loginMock.mockResolvedValueOnce({ id: 'u-3', email: LOGIN_FIXTURE });
    enterDemoMock.mockResolvedValueOnce({
      success: true,
      isDemoMode: true,
      demoSession: demoSessionFixture('demo-org-session-login-def'),
    });
    const user = userEvent.setup();

    render(
      <AuthView
        initialStep={AuthStep.LOGIN}
        targetMode={SessionMode.DEMO}
        onAuthSuccess={onAuthSuccess}
        onBack={onBack}
      />
    );

    await user.type(screen.getByTestId('email-input'), LOGIN_FIXTURE);
    await user.type(screen.getByTestId('password-input'), FIXTURE_PASSWORD);
    await user.click(screen.getByTestId('login-button'));

    await waitFor(() => expect(onAuthSuccess).toHaveBeenCalled());
    expect(enterDemoMock).toHaveBeenCalledTimes(1);
    expect(setDemoModeMock).toHaveBeenCalledWith(true);
    expect(setDemoSessionOrgIdMock).toHaveBeenCalledWith('demo-org-session-login-def');
    expect(callOrder.indexOf('adopt:demo-org-session-login-def')).toBeLessThan(
      callOrder.indexOf('onAuthSuccess')
    );
    expect(onAuthSuccess).toHaveBeenCalledWith(expect.objectContaining({ isDemo: true }));
  });

  it('returning public-demo login reuses its active session and never enables demo again', async () => {
    loginMock.mockResolvedValueOnce({
      id: 'u-returning',
      email: LOGIN_FIXTURE,
      isDemo: true,
      demoSession: demoSessionFixture('demo-org-session-returning-auth'),
    });
    const user = userEvent.setup();

    render(
      <AuthView
        initialStep={AuthStep.LOGIN}
        targetMode={SessionMode.DEMO}
        onAuthSuccess={onAuthSuccess}
        onBack={onBack}
      />
    );

    await user.type(screen.getByTestId('email-input'), LOGIN_FIXTURE);
    await user.type(screen.getByTestId('password-input'), FIXTURE_PASSWORD);
    await user.click(screen.getByTestId('login-button'));

    await waitFor(() => expect(onAuthSuccess).toHaveBeenCalled());
    expect(enterDemoMock).not.toHaveBeenCalled();
    expect(setDemoSessionOrgIdMock).toHaveBeenCalledWith('demo-org-session-returning-auth');
  });

  it('a backend that returns no demoSession clears the org id instead of leaving a stale tenant pinned', async () => {
    loginMock.mockResolvedValueOnce({ id: 'u-4', email: LOGIN_FIXTURE });
    enterDemoMock.mockResolvedValueOnce({ success: true, isDemoMode: true });
    const user = userEvent.setup();

    render(
      <AuthView
        initialStep={AuthStep.LOGIN}
        targetMode={SessionMode.DEMO}
        onAuthSuccess={onAuthSuccess}
        onBack={onBack}
      />
    );

    await user.type(screen.getByTestId('email-input'), LOGIN_FIXTURE);
    await user.type(screen.getByTestId('password-input'), FIXTURE_PASSWORD);
    await user.click(screen.getByTestId('login-button'));

    await waitFor(() => expect(onAuthSuccess).toHaveBeenCalled());
    expect(setDemoSessionOrgIdMock).toHaveBeenCalledWith(null);
  });

  it('a failed demo sign-up adopts nothing', async () => {
    const failure: any = new Error('boom');
    failure.status = 409;
    failure.data = { code: 'DEMO_SIGNUP_UNAVAILABLE' };
    registerDemoMock.mockRejectedValueOnce(failure);
    const user = userEvent.setup();

    const { container } = render(
      <AuthView
        initialStep={AuthStep.REGISTER}
        targetMode={SessionMode.DEMO}
        onAuthSuccess={onAuthSuccess}
        onBack={onBack}
      />
    );

    await fillAndSubmitRegister(user, container);

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(onAuthSuccess).not.toHaveBeenCalled();
    expect(setDemoModeMock).not.toHaveBeenCalled();
    expect(setDemoSessionOrgIdMock).not.toHaveBeenCalled();
  });
});
