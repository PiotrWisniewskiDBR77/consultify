/**
 * Dev-render host for the REGISTER screen of the pre-login screen family
 * (grafika/logowanie-i18n-20260902). Same composition as `/register` in
 * `AppRoutes.tsx` (`key="register-form-stable"`, `targetMode={SessionMode.FREE}`).
 */
import React from 'react';
import { MemoryRouter } from 'react-router-dom';

import { AuthLayout } from '@/layouts/AuthLayout';
import { AuthStep, SessionMode } from '@/types';
import { AuthView } from '@/views/AuthView';

function AuthRegisterScreen() {
  return (
    <MemoryRouter initialEntries={['/register']}>
      <AuthLayout>
        <AuthView
          key="register-form-stable"
          initialStep={AuthStep.REGISTER}
          targetMode={SessionMode.FREE}
          onAuthSuccess={() => {}}
          onBack={() => {}}
        />
      </AuthLayout>
    </MemoryRouter>
  );
}

export default AuthRegisterScreen;
