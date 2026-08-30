/**
 * @vitest-environment jsdom
 */

import { render, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { User } from '../../types';
import { SettingsView } from '../SettingsView';

const { navigate, toastError } = vi.hoisted(() => ({
  navigate: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock('react-hot-toast', () => ({
  default: { error: toastError },
}));

vi.mock('react-i18next', () => ({
  initReactI18next: { type: '3rdParty', init: vi.fn() },
  useTranslation: () => ({
    t: (_key: string, fallback?: string | { defaultValue?: string }) =>
      typeof fallback === 'string' ? fallback : (fallback?.defaultValue ?? _key),
  }),
}));

vi.mock('react-router-dom', () => ({
  useLocation: () => ({ pathname: '/settings/security', search: '', hash: '' }),
  useNavigate: () => navigate,
}));

vi.mock('../../store/useAppStore', () => ({
  useAppStore: () => ({ setCurrentView: vi.fn() }),
}));

vi.mock('../../components/settings/security/SecurityOverviewPage', () => ({
  SecurityOverviewPage: () => <div>Security</div>,
}));

describe('day176 Settings MEMBER redirect', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows an explanatory error and redirects a MEMBER from a blocked section to Profile', async () => {
    render(
      <SettingsView
        currentUser={{ role: 'MEMBER' } as unknown as User}
        onUpdateUser={vi.fn()}
        theme="light"
        toggleTheme={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith(
        'Ta sekcja nie jest dostępna w Twojej roli podczas pilota. Skontaktuj się z administratorem, jeśli potrzebujesz dostępu.'
      );
      expect(navigate).toHaveBeenCalledWith('/settings/profile', { replace: true });
    });
  });
});
