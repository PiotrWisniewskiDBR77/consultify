/**
 * Pinning tests for the account-language sync bridge (P0.3, 2026-07-26,
 * src/services/languagePreference.ts).
 *
 * Regression this guards: i18next detection order is
 * localStorage -> navigator -> htmlTag (src/i18n.ts) with ZERO account
 * synchronization, so a Polish account opening the app on a clean browser
 * (empty localStorage, en-* navigator locale) rendered 100% English despite
 * complete PL translations. The fix makes the priority for a logged-in
 * session: account > localStorage > navigator.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/i18n', () => ({
  changeLanguage: vi.fn(),
  normalizeLanguageCode: (lng: string | null | undefined) => {
    const base = String(lng || '')
      .toLowerCase()
      .split(/[-_]/)[0];
    const supported = ['en', 'pl', 'de', 'ar', 'jp', 'es'];
    return supported.includes(base) ? base : null;
  },
}));

vi.mock('@/services/api', () => ({
  Api: { put: vi.fn() },
}));

import { changeLanguage } from '@/i18n';
import { Api } from '@/services/api';
import { changeLanguageAndPersist, syncLanguageFromAccount } from '@/services/languagePreference';

describe('syncLanguageFromAccount', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('applies the account language (account wins over navigator/localStorage)', async () => {
    // Bootstrap scenario (a): account language='pl', browser is English.
    vi.mocked(changeLanguage).mockResolvedValue(true);

    await syncLanguageFromAccount('pl');

    expect(changeLanguage).toHaveBeenCalledWith('pl');
  });

  it('does nothing when the account has no language preference yet', async () => {
    // Bootstrap scenario (b): account has no language -> whatever
    // localStorage/navigator already resolved to (e.g. 'en') must NOT be
    // overwritten by this sync step.
    await syncLanguageFromAccount(null);
    await syncLanguageFromAccount(undefined);
    await syncLanguageFromAccount('');

    expect(changeLanguage).not.toHaveBeenCalled();
  });

  it('normalizes locale-ish account values (e.g. "PL-pl") before applying', async () => {
    vi.mocked(changeLanguage).mockResolvedValue(true);

    await syncLanguageFromAccount('PL-pl');

    expect(changeLanguage).toHaveBeenCalledWith('pl');
  });

  it('ignores an unsupported/garbage account language value', async () => {
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
