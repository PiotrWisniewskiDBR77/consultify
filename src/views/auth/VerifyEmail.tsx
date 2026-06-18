import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { Api } from '@/services/api';

export const VerifyEmail = () => {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>(() => {
    // Initialize with error if no token
    return token ? 'verifying' : 'error';
  });
  const [message, setMessage] = useState(() => {
    // Initialize message if no token
    return token ? '' : t('auth.verifyEmail.invalidToken');
  });
  const hasVerifiedRef = useRef(false);

  const handleVerify = useCallback(async () => {
    if (!token || hasVerifiedRef.current) return;
    hasVerifiedRef.current = true;

    try {
      await Api.verifyEmail(token);
      queueMicrotask(() => setStatus('success'));
      setTimeout(() => {
        navigate('/login');
      }, 3000);
    } catch (error: any) {
      queueMicrotask(() => {
        setStatus('error');
        setMessage(error?.message || t('auth.verifyEmail.failedMessage'));
      });
    }
  }, [token, navigate, t]);

  useEffect(() => {
    if (token) {
      handleVerify();
    }
  }, [handleVerify, token]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-navy-800 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8 text-center">
        {status === 'verifying' && (
          <div>
            <h2 className="mt-6 text-3xl font-bold tracking-tight text-gray-900">
              {t('auth.verifyEmail.verifying')}
            </h2>
            <div className="mt-4 animate-spin h-8 w-8 border-4 border-indigo-500 border-t-transparent rounded-full mx-auto"></div>
          </div>
        )}
        {status === 'success' && (
          <div>
            <h2 className="mt-6 text-3xl font-bold tracking-tight text-green-600">
              {t('auth.verifyEmail.successTitle')}
            </h2>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              {t('auth.verifyEmail.successMessage')}
            </p>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              {t('auth.verifyEmail.redirecting')}
            </p>
          </div>
        )}
        {status === 'error' && (
          <div>
            <h2 className="mt-6 text-3xl font-bold tracking-tight text-danger-600">
              {t('auth.verifyEmail.errorTitle')}
            </h2>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{message}</p>
            <button
              onClick={() => navigate('/login')}
              className="mt-4 rounded-md bg-indigo-600 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
            >
              {t('auth.backToLogin')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
