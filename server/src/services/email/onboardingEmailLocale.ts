/**
 * Language resolution for the first-contact onboarding emails (DEC-461,
 * 2026-09-10 evening: software and data are built in English, Polish is a
 * translation layer — including transactional email copy).
 *
 * This REPLACES the hardcoded-Polish approach from P1
 * (commit 0bfffeac4e, "polskie maile pierwszego kontaktu"), which shipped
 * before DEC-461 existed. English is now the default; Polish is selected
 * only when a preference explicitly says so.
 *
 * Precedence: user's own language preference (`users.language`, the SSOT
 * added by server/migrations/20260726_users_language_preference.sql) wins;
 * otherwise the organization's default (`organizations.default_locale`,
 * server/migrations/250_entity_translations.sql); otherwise `en`.
 *
 * Only `en`/`pl` are supported for this email copy — any other value
 * collapses to `en`, matching `TransactionalEmailLang` in
 * transactionalEmailLayout.ts.
 */
import * as DbPromise from '../../utils/DbPromise.js';
import { getTableColumns } from '../../utils/dbSchema.js';
import logger from '../../utils/Logger.js';

export type OnboardingEmailLang = 'en' | 'pl';

function normalize(value: unknown): string {
  return String(value || '')
    .trim()
    .toLowerCase();
}

/**
 * Pure precedence rule: user preference > organization default > 'en'.
 * Exported separately from the DB-backed lookups below so the precedence
 * logic itself can be unit-tested without a database.
 */
export function resolveOnboardingEmailLang(preferences: {
  userLanguage?: unknown;
  organizationLocale?: unknown;
}): OnboardingEmailLang {
  const user = normalize(preferences.userLanguage);
  if (user === 'pl') return 'pl';
  if (user === 'en') return 'en';

  const org = normalize(preferences.organizationLocale);
  if (org === 'pl') return 'pl';

  return 'en';
}

async function getOrganizationLocale(organizationId: string | null | undefined): Promise<string | null> {
  if (!organizationId) return null;
  try {
    const cols = await getTableColumns('organizations');
    if (!cols.has('default_locale')) return null;
    const row = await DbPromise.get<{ default_locale?: string | null }>(
      `SELECT default_locale FROM organizations WHERE id = ?`,
      [organizationId],
      { fallback: false }
    );
    return row?.default_locale ?? null;
  } catch (e) {
    logger.warn('[OnboardingEmailLocale] organization lookup failed (defaulting)', {
      error: (e as Error)?.message || e,
    });
    return null;
  }
}

/**
 * Resolve the email language for an already-existing user. Falls back to
 * 'en' on any DB error — a locale lookup must never block sending the email.
 */
export async function getOnboardingEmailLangForUser(
  userId: string | null | undefined
): Promise<OnboardingEmailLang> {
  if (!userId) return 'en';
  try {
    const cols = await getTableColumns('users');
    const hasLanguage = cols.has('language');
    const hasOrgId = cols.has('organization_id');
    const columns = [
      hasLanguage ? 'language' : 'NULL AS language',
      hasOrgId ? 'organization_id' : 'NULL AS organization_id',
    ].join(', ');

    const row = await DbPromise.get<{ language?: string | null; organization_id?: string | null }>(
      `SELECT ${columns} FROM users WHERE id = ?`,
      [userId],
      { fallback: false }
    );
    if (!row) return 'en';

    const organizationLocale = await getOrganizationLocale(row.organization_id);
    return resolveOnboardingEmailLang({
      userLanguage: row.language,
      organizationLocale,
    });
  } catch (e) {
    logger.warn('[OnboardingEmailLocale] user lookup failed (defaulting to en)', {
      error: (e as Error)?.message || e,
    });
    return 'en';
  }
}

/**
 * Resolve the email language when there is no user yet (e.g. an invitee who
 * has not accepted and created an account) — degrades to the organization's
 * default, then 'en'.
 */
export async function getOnboardingEmailLangForOrganization(
  organizationId: string | null | undefined
): Promise<OnboardingEmailLang> {
  const organizationLocale = await getOrganizationLocale(organizationId);
  return resolveOnboardingEmailLang({ organizationLocale });
}
