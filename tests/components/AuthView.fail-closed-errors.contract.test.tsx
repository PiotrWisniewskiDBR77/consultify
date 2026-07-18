/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: any) => (typeof fallback === 'string' ? fallback : (fallback?.defaultValue ?? _key)),
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
});
