/**
 * DEC-461: language resolution for the first-contact onboarding emails.
 * Precedence: user preference (`users.language`) > organization default
 * (`organizations.default_locale`) > 'en'. This REPLACES the P1
 * (commit 0bfffeac4e) hardcoded-Polish approach, which predates DEC-461.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

const dbGet = vi.fn();
const getTableColumns = vi.fn();

vi.mock('../../../utils/DbPromise.js', () => ({
  get: (...args: unknown[]) => dbGet(...args),
}));
vi.mock('../../../utils/dbSchema.js', () => ({
  getTableColumns: (...args: unknown[]) => getTableColumns(...args),
}));

import { getOnboardingEmailLangForOrganization, getOnboardingEmailLangForUser, resolveOnboardingEmailLang } from '../onboardingEmailLocale.js';

describe('resolveOnboardingEmailLang (pure precedence rule)', () => {
  it('case 1: user preference wins even when the organization differs', () => {
    expect(resolveOnboardingEmailLang({ userLanguage: 'pl', organizationLocale: 'en' })).toBe(
      'pl'
    );
    expect(resolveOnboardingEmailLang({ userLanguage: 'en', organizationLocale: 'pl' })).toBe(
      'en'
    );
  });

  it('case 2: organization default decides when the user has no preference', () => {
    expect(resolveOnboardingEmailLang({ userLanguage: null, organizationLocale: 'pl' })).toBe(
      'pl'
    );
    expect(
      resolveOnboardingEmailLang({ userLanguage: undefined, organizationLocale: 'en' })
    ).toBe('en');
  });

  it('case 3: defaults to en when neither preference is set (DEC-461)', () => {
    expect(resolveOnboardingEmailLang({})).toBe('en');
    expect(resolveOnboardingEmailLang({ userLanguage: null, organizationLocale: null })).toBe(
      'en'
    );
  });

  it('is case-insensitive and tolerates unsupported locale values', () => {
    expect(resolveOnboardingEmailLang({ userLanguage: 'PL' })).toBe('pl');
    expect(resolveOnboardingEmailLang({ userLanguage: 'de' })).toBe('en');
    expect(resolveOnboardingEmailLang({ organizationLocale: 'DE' })).toBe('en');
  });
});

describe('DB-backed lookups (DbPromise/dbSchema mocked)', () => {
  afterEach(() => {
    dbGet.mockReset();
    getTableColumns.mockReset();
  });

  it('getOnboardingEmailLangForUser: user.language wins over the org default', async () => {
    getTableColumns.mockImplementation(async (table: string) =>
      table === 'users' ? new Set(['language', 'organization_id']) : new Set(['default_locale'])
    );
    dbGet.mockImplementation(async (sql: string) => {
      if (String(sql).includes('FROM users')) {
        return { language: 'pl', organization_id: 'org-1' };
      }
      if (String(sql).includes('FROM organizations')) {
        return { default_locale: 'en' };
      }
      return undefined;
    });

    await expect(getOnboardingEmailLangForUser('user-1')).resolves.toBe('pl');
  });

  it('getOnboardingEmailLangForUser: falls through to the org default when unset', async () => {
    getTableColumns.mockImplementation(async (table: string) =>
      table === 'users' ? new Set(['language', 'organization_id']) : new Set(['default_locale'])
    );
    dbGet.mockImplementation(async (sql: string) => {
      if (String(sql).includes('FROM users')) {
        return { language: null, organization_id: 'org-1' };
      }
      if (String(sql).includes('FROM organizations')) {
        return { default_locale: 'pl' };
      }
      return undefined;
    });

    await expect(getOnboardingEmailLangForUser('user-1')).resolves.toBe('pl');
  });

  it('getOnboardingEmailLangForUser: defaults to en on lookup failure (never blocks sending)', async () => {
    getTableColumns.mockRejectedValue(new Error('db unavailable'));

    await expect(getOnboardingEmailLangForUser('user-1')).resolves.toBe('en');
  });

  it('getOnboardingEmailLangForOrganization: no account yet — org default only', async () => {
    getTableColumns.mockResolvedValue(new Set(['default_locale']));
    dbGet.mockResolvedValue({ default_locale: 'pl' });

    await expect(getOnboardingEmailLangForOrganization('org-1')).resolves.toBe('pl');
  });
});
