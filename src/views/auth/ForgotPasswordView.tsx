import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { AuthService } from '@/services/modules/AuthService';

export const ForgotPasswordView: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'sent' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');
    setErrorMsg('');

    try {
      await AuthService.requestPasswordReset(email);
      setStatus('sent');
    } catch (err: any) {
      setStatus('error');
      setErrorMsg(
        err?.message ||
          t('auth.forgotPassword.errorGeneric', 'Something went wrong. Please try again.')
      );
    }
  };

  if (status === 'sent') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-navy-800 px-4 py-12 sm:px-6 lg:px-8">
        <div className="w-full max-w-md space-y-6 text-center">
          <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm dark:border-navy-700 dark:bg-navy-900">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
              <svg
                className="h-6 w-6 text-green-600 dark:text-green-400"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
                />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
              {t('auth.forgotPassword.checkEmail', 'Check your email')}
            </h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              {t(
                'auth.forgotPassword.sentMessage',
                'If an account with that email exists, we sent a password reset link. Please check your inbox and spam folder.'
              )}
            </p>
            <button
              onClick={() => navigate('/login')}
              className="mt-6 w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 transition-colors"
            >
              {t('auth.backToLogin', 'Back to login')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-navy-800 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm dark:border-navy-700 dark:bg-navy-900">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
            {t('auth.forgotPassword.title', 'Reset your password')}
          </h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            {t(
              'auth.forgotPassword.subtitle',
              "Enter your email address and we'll send you a link to reset your password."
            )}
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300"
              >
                {t('auth.email', 'Email')}
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-navy-600 dark:bg-navy-800 dark:text-white dark:placeholder-slate-500"
                placeholder={t('auth.emailPlaceholder', 'you@company.com')}
              />
            </div>

            {status === 'error' && (
              <p className="text-sm text-danger-600 dark:text-danger-400">{errorMsg}</p>
            )}

            <button
              type="submit"
              disabled={status === 'loading'}
              className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {status === 'loading'
                ? t('common.sending', 'Sending...')
                : t('auth.forgotPassword.sendLink', 'Send reset link')}
            </button>
          </form>

          <div className="mt-4 text-center">
            <button
              onClick={() => navigate('/login')}
              className="text-sm text-indigo-600 hover:underline dark:text-indigo-400"
            >
              {t('auth.backToLogin', 'Back to login')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
