import React from 'react';
import { useNavigate } from 'react-router-dom';

import { useTrial } from '../../contexts/TrialContext';

export const TrialExpiredGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isTrial, isExpired, loading } = useTrial();
  const navigate = useNavigate();

  if (loading) return <>{children}</>; // Or spinner

  if (isTrial && isExpired) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-900/95 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full p-8 text-center animate-in fade-in zoom-in duration-300">
          <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>

          <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-4">
            Trial Period Expired
          </h2>
          <p className="text-lg text-slate-600 dark:text-slate-400 mb-8 max-w-lg mx-auto">
            Your 7-day trial has ended. Your data is safe, but your organization is now in read-only
            mode. Upgrade to continue using Consultify.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-lg mx-auto">
            <button
              onClick={() => navigate('/settings?tab=billing')}
              className="bg-primary-500 text-white px-6 py-4 rounded-xl font-bold hover:bg-primary-600 transition-all flex items-center justify-center"
            >
              <span>Create Organization</span>
              <span className="block text-xs font-normal opacity-75 ml-2">(Upgrade)</span>
            </button>

            <button
              onClick={() => window.open('https://consultify.io/contact', '_blank')}
              className="bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 px-6 py-4 rounded-xl font-bold hover:bg-slate-100 dark:hover:bg-navy-800/50 transition-all flex items-center justify-center"
            >
              Talk to Consulting
            </button>
          </div>

          <div className="mt-8 pt-8 border-t border-slate-100 dark:border-navy-700">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Need to export your data?{' '}
              <button className="text-primary-500 hover:underline">Download Archive</button>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
