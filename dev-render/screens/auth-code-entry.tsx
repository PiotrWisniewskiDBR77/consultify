/**
 * Dev-render host for the ORGANIZATION CODE / INVITE screen ("zaproszenie do
 * organizacji") of the pre-login screen family (grafika/logowanie-i18n-20260902).
 *
 * Not its own route — a real user reaches it by clicking "Enter access code"
 * on /login or /register, which sets `AuthView`'s internal step to
 * `AuthStep.CODE_ENTRY` (same component, same code path — see
 * `src/views/AuthView.tsx` `renderCodeEntry()`). Mounted here with that step
 * pre-selected so the screen is screenshottable without a click sequence.
 */
import React from 'react';
import { MemoryRouter } from 'react-router-dom';

import { AuthLayout } from '@/layouts/AuthLayout';
import { AuthStep, SessionMode } from '@/types';
import { AuthView } from '@/views/AuthView';

function AuthCodeEntryScreen() {
  return (
    <MemoryRouter initialEntries={['/login']}>
      <AuthLayout>
        <AuthView
          key="code-entry-stable"
          initialStep={AuthStep.CODE_ENTRY}
          targetMode={SessionMode.FREE}
          onAuthSuccess={() => {}}
          onBack={() => {}}
        />
      </AuthLayout>
    </MemoryRouter>
  );
}

export default AuthCodeEntryScreen;
