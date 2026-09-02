/**
 * Dev-render host for the FORGOT PASSWORD screen of the pre-login screen
 * family (grafika/logowanie-i18n-20260902). Same composition as
 * `/forgot-password` in `AppRoutes.tsx`: `<AuthLayout><ForgotPasswordView /></AuthLayout>`.
 */
import React from 'react';
import { MemoryRouter } from 'react-router-dom';

import { AuthLayout } from '@/layouts/AuthLayout';
import { ForgotPasswordView } from '@/views/auth/ForgotPasswordView';

function AuthForgotPasswordScreen() {
  return (
    <MemoryRouter initialEntries={['/forgot-password']}>
      <AuthLayout>
        <ForgotPasswordView />
      </AuthLayout>
    </MemoryRouter>
  );
}

export default AuthForgotPasswordScreen;
