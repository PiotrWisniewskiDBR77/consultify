/**
 * @vitest-environment jsdom
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

const loginMock = vi.fn();
const demoLoginMock = vi.fn();
const verifyAccessCodeMock = vi.fn();

vi.mock('../../src/services/api', () => ({
  API_URL: 'https://api.example.test',
  Api: {
    login: (...args: unknown[]) => loginMock(...args),
    demoLogin: (...args: unknown[]) => demoLoginMock(...args),
    verifyAccessCode: (...args: unknown[]) => verifyAccessCodeMock(...args),
    register: vi.fn(),
    registerDemo: vi.fn(),
    enterDemo: vi.fn(),
  },
}));

import { AuthView } from '../../src/views/AuthView';
import { AuthStep, SessionMode } from '../../src/types';

describe('AuthView fail-closed error contract', () => {
  const onAuthSuccess = vi.fn();
  const onBack = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    localStorage.clear();
    Object.defineProperty(window, 'location', {
      value: { ...window.location, hostname: 'localhost', href: 'http://localhost/auth' },
      writable: true,
    });
  });

  it('quick access failure is non-leaking and alert-accessible', async () => {
    demoLoginMock.mockRejectedValueOnce(new Error('pg://secret-host/internal'));
    const user = userEvent.setup();

    render(
      <AuthView
        initialStep={AuthStep.LOGIN}
        targetMode={SessionMode.FREE}
        onAuthSuccess={onAuthSuccess}
        onBack={onBack}
      />
    );

    await user.keyboard('{Control>}{Shift>}K{/Shift}{/Control}');
    const pinInput = await screen.findByLabelText('Four-digit quick access PIN');
    await user.type(pinInput, '7778');

    await waitFor(() => {
      const alert = screen.getByRole('alert');
      expect(alert).toHaveTextContent('Quick access is temporarily unavailable');
      expect(alert).not.toHaveTextContent('pg://secret-host/internal');
    });
  });

  it('invite code verification failure does not leak runtime details', async () => {
    verifyAccessCodeMock.mockRejectedValueOnce(new Error('INTERNAL_STACK_TRACE_SECRET'));
    const user = userEvent.setup();

    render(
      <AuthView
        initialStep={AuthStep.CODE_ENTRY}
        targetMode={SessionMode.FREE}
        onAuthSuccess={onAuthSuccess}
        onBack={onBack}
      />
    );

    await user.type(screen.getByPlaceholderText('WPISZ KOD (np. ABCD1234)'), 'ABCD1234');
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    await waitFor(() => {
      const alert = screen.getByRole('alert');
      expect(alert).toHaveTextContent('Failed to verify access code');
      expect(alert).not.toHaveTextContent('INTERNAL_STACK_TRACE_SECRET');
    });
  });

  it('login retry failure shows one alert with safe fallback copy', async () => {
    loginMock.mockRejectedValue(new Error('postgres://rw-user:secret@host/db'));
    const user = userEvent.setup();

    render(
      <AuthView
        initialStep={AuthStep.LOGIN}
        targetMode={SessionMode.FREE}
        onAuthSuccess={onAuthSuccess}
        onBack={onBack}
      />
    );

    await user.type(screen.getByTestId('email-input'), 'user@example.com');
    await user.type(screen.getByTestId('password-input'), 'secret123');
    await user.click(screen.getByTestId('login-button'));

    await waitFor(
      () => {
        const alerts = screen.getAllByRole('alert');
        expect(alerts).toHaveLength(1);
        expect(alerts[0]).toHaveTextContent(
          'Login failed. Please check your connection and try again.'
        );
        expect(alerts[0]).not.toHaveTextContent('postgres://rw-user');
      },
      { timeout: 5000 }
    );
  });

  it('completes the password-to-MFA login handoff without storing a partial session', async () => {
    const required: any = new Error('Two-factor authentication required');
    required.code = 'AUTH_MFA_REQUIRED';
    required.data = { mfaRequired: true, mfaChallenge: 'challenge-1' };
    const invalid: any = new Error('Invalid verification code');
    invalid.status = 401;
    invalid.data = { mfaRequired: true };
    loginMock
      .mockRejectedValueOnce(required)
      .mockRejectedValueOnce(invalid)
      .mockImplementationOnce(async () => {
        localStorage.setItem('token', 'signed-token');
        return { id: 'user-1', email: 'mfa@example.com' };
      });
    const user = userEvent.setup();

    render(
      <AuthView
        initialStep={AuthStep.LOGIN}
        targetMode={SessionMode.FREE}
        onAuthSuccess={onAuthSuccess}
        onBack={onBack}
      />
    );

    await user.type(screen.getByTestId('email-input'), 'mfa@example.com');
    await user.type(screen.getByTestId('password-input'), 'secret123');
    await user.click(screen.getByTestId('login-button'));
    expect(await screen.findByTestId('login-mfa-challenge')).toBeInTheDocument();
    expect(localStorage.getItem('token')).toBeNull();

    await user.type(screen.getByLabelText('Authentication code'), '111111');
    await user.click(screen.getByRole('button', { name: 'Verify' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('invalid or expired');
    expect(screen.getByLabelText('Authentication code')).toHaveValue('');

    await user.type(screen.getByLabelText('Authentication code'), '222222');
    await user.click(screen.getByRole('button', { name: 'Verify' }));
    await waitFor(() => expect(onAuthSuccess).toHaveBeenCalledTimes(1));
    expect(loginMock).toHaveBeenNthCalledWith(3, '', '', {
      mfaChallenge: 'challenge-1',
      mfaToken: '222222',
      deviceFingerprint: expect.stringMatching(/^web-[a-f0-9]{64}$/),
      trustDevice: false,
    });
  });

  it('fails closed when membership is revoked between password and MFA', async () => {
    const required: any = new Error('Two-factor authentication required');
    required.code = 'AUTH_MFA_REQUIRED';
    required.data = { mfaRequired: true, mfaChallenge: 'challenge-revoked' };
    const revoked: any = new Error('You no longer have access to this organization');
    revoked.status = 403;
    revoked.data = { code: 'ORG_MEMBERSHIP_REVOKED' };
    loginMock.mockRejectedValueOnce(required).mockRejectedValueOnce(revoked);
    const user = userEvent.setup();

    render(
      <AuthView
        initialStep={AuthStep.LOGIN}
        targetMode={SessionMode.FREE}
        onAuthSuccess={onAuthSuccess}
        onBack={onBack}
      />
    );

    await user.type(screen.getByTestId('email-input'), 'mfa@example.com');
    await user.type(screen.getByTestId('password-input'), 'secret123');
    await user.click(screen.getByTestId('login-button'));
    await user.type(await screen.findByLabelText('Authentication code'), '222222');
    await user.click(screen.getByRole('button', { name: 'Verify' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Your access to this organization has been revoked.'
    );
    expect(screen.queryByTestId('login-mfa-challenge')).not.toBeInTheDocument();
    expect(localStorage.getItem('token')).toBeNull();
    expect(onAuthSuccess).not.toHaveBeenCalled();
  });
});
