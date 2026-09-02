/**
 * Dev-render host for the LOGIN screen of the pre-login screen family
 * (grafika/logowanie-i18n-20260902).
 *
 * Renders the REAL `<AuthView initialStep={AuthStep.LOGIN}>` inside the REAL
 * `<AuthLayout>`, the exact same composition `AppRoutes.tsx` mounts on the
 * `/login` route (`key="login-form-stable"`, `targetMode={SessionMode.FREE}`).
 * No re-implementation, no mock text — this is the literal component tree a
 * visitor sees on the first screen of the product.
 *
 * Evidence for: bug measured 2026-09-02 on staging
 * (evidence/staging-20260902/01-logowanie.png) — the login screen rendered
 * 100% in English regardless of the Polish product's default language, and
 * the "Forgot password?" / "Create one" links were crimson (`text-c-accent`)
 * on a non-critical navigational link, violating CLAUDE.md pułapka nr 1.
 */
import React from 'react';
import { MemoryRouter } from 'react-router-dom';

import { AuthLayout } from '@/layouts/AuthLayout';
import { AuthStep, SessionMode } from '@/types';
import { AuthView } from '@/views/AuthView';

function AuthLoginScreen() {
  return (
    <MemoryRouter initialEntries={['/login']}>
      <AuthLayout>
        <AuthView
          key="login-form-stable"
          initialStep={AuthStep.LOGIN}
          targetMode={SessionMode.FREE}
          onAuthSuccess={() => {}}
          onBack={() => {}}
        />
      </AuthLayout>
    </MemoryRouter>
  );
}

export default AuthLoginScreen;
