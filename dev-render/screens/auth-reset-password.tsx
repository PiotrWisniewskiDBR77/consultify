/**
 * Dev-render host for the RESET PASSWORD ("zmiana hasła z linku") screen of
 * the pre-login screen family (grafika/logowanie-i18n-20260902). Same
 * composition as `/reset-password` in `AppRoutes.tsx`:
 * `<AuthLayout><ResetPasswordView /></AuthLayout>`.
 *
 * Mounted with a `?token=` present (via MemoryRouter initialEntries) so the
 * screen shows the real "set new password" form — without a token the same
 * component renders its "invalid/missing token" state instead, which is a
 * distinct, secondary state (not the primary screen a user reaches from a
 * genuine reset-password email link).
 */
import React from 'react';
import { MemoryRouter } from 'react-router-dom';

import { AuthLayout } from '@/layouts/AuthLayout';
import { ResetPasswordView } from '@/views/auth/ResetPasswordView';

function AuthResetPasswordScreen() {
  return (
    <MemoryRouter initialEntries={['/reset-password?token=dev-render-mock-token']}>
      <AuthLayout>
        <ResetPasswordView />
      </AuthLayout>
    </MemoryRouter>
  );
}

export default AuthResetPasswordScreen;
