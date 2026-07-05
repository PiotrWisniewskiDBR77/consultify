import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { AuthService } from '@/services/modules/AuthService';

export const ResetPasswordView: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-c-bg px-4 py-12 sm:px-6 lg:px-8">
        <div className="w-full max-w-md text-center">
          <div className="rounded-2xl border border-c-border-subtle bg-c-surface p-8 shadow-sm">
            <h2 className="text-xl font-semibold text-danger-600">
              {t('auth.resetPassword.invalidToken', 'Invalid or missing reset token')}
            </h2>
            <p className="mt-2 text-sm text-c-text-secondary">
              {t('auth.resetPassword.requestNew', 'Please request a new password reset link.')}
            </p>
            <button
              onClick={() => navigate('/forgot-password')}
              className="mt-6 w-full rounded-lg bg-c-accent px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-90 transition-colors"
            >
              {t('auth.forgotPassword.title', 'Reset your password')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-c-bg px-4 py-12 sm:px-6 lg:px-8">
        <div className="w-full max-w-md text-center">
          <div className="rounded-2xl border border-c-border-subtle bg-c-surface p-8 shadow-sm">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-c-success/10">
              <svg
                className="h-6 w-6 text-c-success"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-c-text">
              {t('auth.resetPassword.successTitle', 'Password updated')}
            </h2>
            <p className="mt-2 text-sm text-c-text-secondary">
              {t(
                'auth.resetPassword.successMessage',
                'Your password has been reset successfully. You can now log in with your new password.'
              )}
            </p>
            <button
              onClick={() => navigate('/login')}
              className="mt-6 w-full rounded-lg bg-c-accent px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-90 transition-colors"
            >
              {t('auth.backToLogin', 'Back to login')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (newPassword !== confirmPassword) {
      setErrorMsg(t('auth.resetPassword.passwordMismatch', 'Passwords do not match.'));
      return;
    }

    if (newPassword.length < 8) {
      setErrorMsg(
        t('auth.resetPassword.passwordTooShort', 'Password must be at least 8 characters.')
      );
      return;
    }

    setStatus('loading');

    try {
      await AuthService.resetPassword(token, newPassword);
      setStatus('success');
    } catch (err: any) {
      setStatus('error');
      setErrorMsg(
        err?.message ||
          t(
            'auth.resetPassword.errorGeneric',
            'Failed to reset password. The link may have expired.'
          )
      );
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-c-bg px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-6">
        <div className="rounded-2xl border border-c-border-subtle bg-c-surface p-8 shadow-sm">
          <h2 className="text-xl font-semibold text-c-text">
            {t('auth.resetPassword.title', 'Set new password')}
          </h2>
          <p className="mt-2 text-sm text-c-text-secondary">
            {t('auth.resetPassword.subtitle', 'Enter your new password below.')}
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label
                htmlFor="newPassword"
                className="block text-sm font-medium text-c-text-secondary"
              >
                {t('auth.newPassword', 'New password')}
              </label>
              <input
                id="newPassword"
                type="password"
                required
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-c-border bg-c-surface px-3 py-2.5 text-sm text-c-text placeholder-c-text-muted focus:border-c-focus-solid focus:outline-none focus:ring-1 focus:ring-c-focus"
                placeholder="********"
              />
            </div>

            <div>
              <label
                htmlFor="confirmPassword"
                className="block text-sm font-medium text-c-text-secondary"
              >
                {t('auth.confirmPassword', 'Confirm password')}
              </label>
              <input
                id="confirmPassword"
                type="password"
                required
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-c-border bg-c-surface px-3 py-2.5 text-sm text-c-text placeholder-c-text-muted focus:border-c-focus-solid focus:outline-none focus:ring-1 focus:ring-c-focus"
                placeholder="********"
              />
            </div>

            {status === 'error' && (
              <p className="text-sm text-danger-600 dark:text-danger-400">{errorMsg}</p>
            )}

            <button
              type="submit"
              disabled={status === 'loading'}
              className="w-full rounded-lg bg-c-accent px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {status === 'loading'
                ? t('common.saving', 'Saving...')
                : t('auth.resetPassword.submit', 'Reset password')}
            </button>
          </form>

          <div className="mt-4 text-center">
            <button
              onClick={() => navigate('/login')}
              className="text-sm text-c-accent hover:underline"
            >
              {t('auth.backToLogin', 'Back to login')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
