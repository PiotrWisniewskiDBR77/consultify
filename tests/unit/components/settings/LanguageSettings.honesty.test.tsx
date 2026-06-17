import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LanguageSettings } from '@/components/settings/LanguageSettings';
import { Api } from '@/services/api';
import { changeLanguage } from '@/i18n';

vi.mock('@/services/api', () => ({
  Api: {
    get: vi.fn(),
  },
}));

vi.mock('@/store/useAppStore', () => ({
  useAppStore: () => ({
    currentUser: { id: 'user-1', role: 'USER' },
  }),
}));

vi.mock('@/i18n', () => ({
  changeLanguage: vi.fn(),
  LANGUAGE_NAMES: {
    en: 'English',
    pl: 'Polski',
    de: 'Deutsch',
    es: 'Español',
    ar: 'العربية',
    jp: '日本語',
  },
  normalizeLanguageCode: (code: string) => code,
  SUPPORTED_LANGUAGES: ['en', 'pl', 'de', 'es', 'ar', 'jp'],
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: {
      language: 'en',
      resolvedLanguage: 'en',
    },
    t: (_key: string, fallback?: string | { defaultValue?: string }) =>
      typeof fallback === 'string' ? fallback : (fallback?.defaultValue ?? _key),
  }),
}));

describe('LanguageSettings honest UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows when organization language context cannot be loaded', async () => {
    vi.mocked(Api.get).mockRejectedValue(new Error('Organization context down'));

    render(<LanguageSettings />);

    await waitFor(() => {
      expect(screen.getByText('Organization context down')).toBeInTheDocument();
    });
  });

  it('does not silently ignore a failed language switch', async () => {
    vi.mocked(Api.get).mockResolvedValue({ profile: { defaultLanguage: 'pl' } });
    vi.mocked(changeLanguage).mockResolvedValue(false);

    render(<LanguageSettings />);

    fireEvent.click(screen.getByRole('button', { name: /Polski/i }));

    await waitFor(() => {
      expect(screen.getByText('Failed to change language')).toBeInTheDocument();
    });
  });
});
