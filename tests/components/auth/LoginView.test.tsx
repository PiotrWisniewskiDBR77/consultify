/**
 * LoginView Component Tests
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { LoginView } from '../../../views/auth/LoginView';
import { Api } from '../../../src/services/api';
import { toast } from 'react-hot-toast';

describe('LoginView', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Ensure reload is stubbed (JSDOM may throw "Not implemented: navigation to another Document")
    try {
      // Prefer spyOn (restores cleanly), fallback to defineProperty for non-writable impls.
      vi.spyOn(window.location, 'reload').mockImplementation(() => {});
    } catch {
      try {
        Object.defineProperty(window.location, 'reload', {
          configurable: true,
          value: vi.fn(),
        });
      } catch {
        // ignore if not configurable in this environment
      }
    }

    // Reset localStorage spies if needed
    vi.spyOn(window.localStorage.__proto__, 'setItem');
  });

  it('renders email/password form by default', () => {
    render(<LoginView />);
    expect(screen.getByRole('heading', { name: 'Login' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Email')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Login' })).toBeInTheDocument();
  });

  it('shows MFA input when API indicates mfaRequired', async () => {
    const user = userEvent.setup();
    vi.spyOn(Api, 'post').mockResolvedValue({
      data: { mfaRequired: true, message: 'Please enter 2FA Code' },
    } as any);

    render(<LoginView />);
    await user.type(screen.getByPlaceholderText('Email'), 'a@b.com');
    await user.type(screen.getByPlaceholderText('Password'), 'pass');
    await user.click(screen.getByRole('button', { name: 'Login' }));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalled();
      expect(screen.getByPlaceholderText('2FA Code')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Verify' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Back to Login' })).toBeInTheDocument();
    });
  });

  it('allows returning from MFA step back to login form', async () => {
    const user = userEvent.setup();
    vi.spyOn(Api, 'post').mockResolvedValue({ data: { mfaRequired: true } } as any);

    render(<LoginView />);
    await user.type(screen.getByPlaceholderText('Email'), 'a@b.com');
    await user.type(screen.getByPlaceholderText('Password'), 'pass');
    await user.click(screen.getByRole('button', { name: 'Login' }));

    await screen.findByPlaceholderText('2FA Code');
    await user.click(screen.getByRole('button', { name: 'Back to Login' }));

    expect(screen.getByPlaceholderText('Email')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Password')).toBeInTheDocument();
  });

  it('uses default MFA toast message when none provided', async () => {
    const user = userEvent.setup();
    vi.spyOn(Api, 'post').mockResolvedValue({ data: { mfaRequired: true } } as any);

    render(<LoginView />);
    await user.type(screen.getByPlaceholderText('Email'), 'a@b.com');
    await user.type(screen.getByPlaceholderText('Password'), 'pass');
    await user.click(screen.getByRole('button', { name: 'Login' }));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Please enter 2FA Code');
    });
  });

  it('submits MFA code (digits only, max 6) and stores tokens on success', async () => {
    const user = userEvent.setup();
    // 1) first call -> mfa required
    // 2) second call -> returns tokens
    vi.spyOn(Api, 'post')
      .mockResolvedValueOnce({ data: { mfaRequired: true, message: '2FA' } } as any)
      .mockResolvedValueOnce({ data: { token: 't1', refreshToken: 'rt1' } } as any);

    const setItemSpy = vi.spyOn(window.localStorage.__proto__, 'setItem');

    render(<LoginView />);
    await user.type(screen.getByPlaceholderText('Email'), 'a@b.com');
    await user.type(screen.getByPlaceholderText('Password'), 'pass');
    await user.click(screen.getByRole('button', { name: 'Login' }));

    const mfaInput = await screen.findByPlaceholderText('2FA Code');
    await user.type(mfaInput, '12ab34-56-78');

    expect((mfaInput as HTMLInputElement).value).toBe('123456');

    await user.click(screen.getByRole('button', { name: 'Verify' }));

    await waitFor(() => {
      expect(setItemSpy).toHaveBeenCalledWith('token', 't1');
      expect(setItemSpy).toHaveBeenCalledWith('refreshToken', 'rt1');
    });
  });

  it('shows toast error on login failure', async () => {
    const user = userEvent.setup();
    vi.spyOn(Api, 'post').mockRejectedValue({
      response: { data: { error: 'Invalid credentials' } },
    } as any);

    render(<LoginView />);
    await user.type(screen.getByPlaceholderText('Email'), 'a@b.com');
    await user.type(screen.getByPlaceholderText('Password'), 'bad');
    await user.click(screen.getByRole('button', { name: 'Login' }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Invalid credentials');
    });
  });

  it('falls back to error.message when response payload is missing', async () => {
    const user = userEvent.setup();
    vi.spyOn(Api, 'post').mockRejectedValue(new Error('Network down'));

    render(<LoginView />);
    await user.type(screen.getByPlaceholderText('Email'), 'a@b.com');
    await user.type(screen.getByPlaceholderText('Password'), 'bad');
    await user.click(screen.getByRole('button', { name: 'Login' }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Network down');
    });
  });

  it('falls back to default message when error has no details', async () => {
    const user = userEvent.setup();
    vi.spyOn(Api, 'post').mockRejectedValue({});

    render(<LoginView />);
    await user.type(screen.getByPlaceholderText('Email'), 'a@b.com');
    await user.type(screen.getByPlaceholderText('Password'), 'bad');
    await user.click(screen.getByRole('button', { name: 'Login' }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Login failed');
    });
  });
});
