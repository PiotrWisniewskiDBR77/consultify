/**
 * Pinning tests for the account-language sync bridge (P0.3, 2026-07-26,
 * extended 2026-07-28 with the organization fallback tier;
 * src/services/languagePreference.ts).
 *
 * Regression this guards: i18next detection order is
 * localStorage -> navigator -> htmlTag (src/i18n.ts) with ZERO account
 * synchronization, so a Polish account opening the app on a clean browser
 * (empty localStorage, en-* navigator locale) rendered 100% English despite
 * complete PL translations. The fix makes the priority for a logged-in
 * session: account > organization default language > localStorage > navigator.
 *
 * 2026-07-28 (żywy odbiór): `users.language` is frequently NULL (no
 * onboarding step ever writes it), so the account tier alone was a no-op far
 * more often than not. The organization's UI default language
 * (`GET /organization-context` -> `profile.defaultLanguage`, already
 * surfaced read-only in Settings > Language) is now consulted as the next
 * fallback tier before giving up to localStorage/navigator.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/i18n', () => ({
  changeLanguage: vi.fn(),
  normalizeLanguageCode: (lng: string | null | undefined) => {
    const base = String(lng || '')
      .toLowerCase()
      .split(/[-_]/)[0];
    const supported = ['en', 'pl', 'de', 'ar', 'ja', 'es'];
    return supported.includes(base) ? base : null;
  },
}));

vi.mock('@/services/api', () => ({
  Api: { put: vi.fn(), get: vi.fn() },
}));

import { changeLanguage } from '@/i18n';
import { Api } from '@/services/api';
import {
  changeLanguageAndPersist,
  clearOrganizationDefaultLanguageCache,
  syncLanguageFromAccount,
} from '@/services/languagePreference';

describe('syncLanguageFromAccount', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // The organization-default lookup is cached in sessionStorage for the
    // tab's lifetime — reset it between tests so each scenario starts fresh.
    clearOrganizationDefaultLanguageCache();
  });

  it('applies the account language (account wins over org/navigator/localStorage)', async () => {
    // Bootstrap scenario (a): account language='pl', browser is English.
    vi.mocked(changeLanguage).mockResolvedValue(true);

    await syncLanguageFromAccount('pl');

    expect(changeLanguage).toHaveBeenCalledWith('pl');
    // Account was set — the organization fallback must not even be consulted.
    expect(Api.get).not.toHaveBeenCalled();
  });

  it('falls back to the organization default language when the account has none (b)', async () => {
    // Bootstrap scenario (b): account has no language, org default is 'pl'.
    vi.mocked(Api.get).mockResolvedValue({ profile: { defaultLanguage: 'pl' } });
    vi.mocked(changeLanguage).mockResolvedValue(true);

    await syncLanguageFromAccount(null);

    expect(Api.get).toHaveBeenCalledWith('/organization-context');
    expect(changeLanguage).toHaveBeenCalledWith('pl');
  });

  it('does nothing when neither the account nor the organization has a language (c)', async () => {
    // Bootstrap scenario (c): account has no language AND org has none either
    // -> whatever localStorage/navigator already resolved to (e.g. 'en')
    // must NOT be overwritten by this sync step (unchanged fail-safe).
    vi.mocked(Api.get).mockResolvedValue({ profile: { defaultLanguage: null } });

    await syncLanguageFromAccount(null);
    await syncLanguageFromAccount(undefined);
    await syncLanguageFromAccount('');

    expect(changeLanguage).not.toHaveBeenCalled();
  });

  it('does nothing when the organization lookup itself fails (fail-soft)', async () => {
    vi.mocked(Api.get).mockRejectedValue(new Error('network down'));

    await syncLanguageFromAccount(null);

    expect(changeLanguage).not.toHaveBeenCalled();
  });

  it('caches the organization lookup so repeated bootstrap calls hit the network once', async () => {
    // App.tsx calls syncLanguageFromAccount twice per boot (immediate
    // localStorage-restored user, then again after Api.getMe() resolves).
    vi.mocked(Api.get).mockResolvedValue({ profile: { defaultLanguage: 'pl' } });
    vi.mocked(changeLanguage).mockResolvedValue(true);

    await syncLanguageFromAccount(null);
    await syncLanguageFromAccount(null);

    expect(Api.get).toHaveBeenCalledTimes(1);
    expect(changeLanguage).toHaveBeenCalledTimes(2);
  });

  it('normalizes locale-ish account values (e.g. "PL-pl") before applying', async () => {
    vi.mocked(changeLanguage).mockResolvedValue(true);

    await syncLanguageFromAccount('PL-pl');

    expect(changeLanguage).toHaveBeenCalledWith('pl');
  });

  it('treats an unsupported/garbage account language value as absent (falls through to org)', async () => {
    vi.mocked(Api.get).mockResolvedValue({ profile: { defaultLanguage: null } });

    await syncLanguageFromAccount('not-a-real-language');

    expect(changeLanguage).not.toHaveBeenCalled();
  });
});

describe('changeLanguageAndPersist', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('applies the language and writes it through to the account', async () => {
    vi.mocked(changeLanguage).mockResolvedValue(true);
    vi.mocked(Api.put).mockResolvedValue({});

    const result = await changeLanguageAndPersist('user-1', 'pl');

    expect(result).toBe(true);
    expect(changeLanguage).toHaveBeenCalledWith('pl');
    expect(Api.put).toHaveBeenCalledWith('/users/user-1', { language: 'pl' });
  });

  it('does not call the account endpoint when there is no logged-in user', async () => {
    vi.mocked(changeLanguage).mockResolvedValue(true);

    const result = await changeLanguageAndPersist(undefined, 'pl');

    expect(result).toBe(true);
    expect(Api.put).not.toHaveBeenCalled();
  });

  it('does not persist when the i18n switch itself fails', async () => {
    vi.mocked(changeLanguage).mockResolvedValue(false);

    const result = await changeLanguageAndPersist('user-1', 'xx');

    expect(result).toBe(false);
    expect(Api.put).not.toHaveBeenCalled();
  });

  it('swallows a failed account write without reverting the UI language switch', async () => {
    vi.mocked(changeLanguage).mockResolvedValue(true);
    vi.mocked(Api.put).mockRejectedValue(new Error('network down'));

    const result = await changeLanguageAndPersist('user-1', 'pl');

    expect(result).toBe(true);
  });
});
