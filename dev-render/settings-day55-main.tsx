/** DEV-ONLY Settings harness for duty 55 visual self-QA. */
import '../src/index.css';

import React from 'react';
import { createRoot } from 'react-dom/client';

import { AuthenticationAccessPage } from '../src/components/settings/security/AuthenticationAccessPage';
import { Api } from '../src/services/api';

const theme =
  new URLSearchParams(window.location.search).get('theme') === 'dark' ? 'dark' : 'light';
document.documentElement.classList.toggle('dark', theme === 'dark');
document.documentElement.style.colorScheme = theme;

Object.assign(Api, {
  getActiveSessions: async () => ({ sessions: [] }),
  getLoginHistory: async () => ({ history: [] }),
  getRecoveryOptions: async () => ({
    recoveryEmail: '',
    recoveryPhone: '',
    backupCodesCount: 0,
  }),
});

const currentUser = {
  id: 'day55-owner',
  email: 'owner@local.test',
  firstName: 'Piotr',
  lastName: 'Wiśniewski',
  role: 'OWNER',
  organizationId: 'day55-local-org',
} as any;

const el = document.getElementById('root');
if (el) {
  createRoot(el).render(
    <React.StrictMode>
      <main className="min-h-screen bg-white p-8 text-slate-950 dark:bg-slate-950 dark:text-slate-50">
        <div className="mx-auto max-w-5xl">
          <AuthenticationAccessPage currentUser={currentUser} />
        </div>
      </main>
    </React.StrictMode>
  );
  window.setTimeout(() => {
    const button = [...document.querySelectorAll('button')].find((item) =>
      item.textContent?.toLowerCase().includes('change password')
    );
    button?.click();
  }, 350);
}
