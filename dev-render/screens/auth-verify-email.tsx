/**
 * Dev-render host for `<VerifyEmail>` — measured as part of the pre-login
 * screen family (grafika/logowanie-i18n-20260902) at the owner's explicit
 * request ("weryfikacja e-mail").
 *
 * ★ FINDING: `src/views/auth/VerifyEmail.tsx` is DEAD CODE. It is never
 * imported by `src/routes/AppRoutes.tsx` and never imported anywhere else in
 * `src/` (`grep -rn "from '@/views/auth/VerifyEmail'" src` → zero hits, and no
 * `/verify-email` path is registered). No real visitor can ever see this
 * screen today, regardless of language. It is rendered here anyway so the
 * PRZED/PO inventory has a screenshot on record — but "screenshot exists"
 * here means "the source file renders", NOT "a user can reach this".
 *
 * Text-wise it is already fully i18n'd (`auth.verifyEmail.*` keys exist with
 * real Polish translations in both locales) and does not use the crimson
 * `c-accent` token — it uses plain Tailwind (`indigo-600`, `gray-900`, …),
 * outside the `c-*` design-token system entirely, which is a separate,
 * pre-existing gap from this task's crimson/i18n scope.
 */
import React from 'react';
import { MemoryRouter } from 'react-router-dom';

import { VerifyEmail } from '@/views/auth/VerifyEmail';

function AuthVerifyEmailScreen() {
  return (
    <MemoryRouter initialEntries={['/verify-email?token=dev-render-mock-token']}>
      <VerifyEmail />
    </MemoryRouter>
  );
}

export default AuthVerifyEmailScreen;
