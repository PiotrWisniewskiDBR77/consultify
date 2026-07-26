/**
 * Account-level UI language preference sync (P0.3, 2026-07-26).
 *
 * PROBLEM this fixes: i18next detection order was localStorage -> navigator
 * -> htmlTag (see src/i18n.ts). A logged-in Polish account opening the app
 * in a fresh browser (empty localStorage, browser locale en-*) landed on a
 * 100%-English screen even though PL translations are complete.
 *
 * FIX: for a LOGGED-IN session the source of truth becomes
 *   account (`User.language`) > localStorage > navigator
 * — a manual language change now writes through to the account (not just
 * localStorage), and every session bootstrap re-applies the account's
 * language if one is set. Landing/unauthenticated flows are NOT touched:
 * there is no account yet, so navigator detection stays correct there.
 */
import { changeLanguage, normalizeLanguageCode } from '../i18n';
import { Api } from './api';

/**
 * Call once per session bootstrap, right after the user profile is fetched
 * (App.tsx, after Api.getMe() resolves, and also for the immediate
 * localStorage-restored user so the correct language paints before the
 * network round-trip completes).
 *
 * If the account has no explicit language yet, this is a deliberate no-op:
 * whatever localStorage/navigator already resolved to keeps being
 * authoritative until the user (or a future write-through) sets one.
 */
export const syncLanguageFromAccount = async (
  accountLanguage: string | null | undefined
): Promise<void> => {
  const normalized = accountLanguage ? normalizeLanguageCode(accountLanguage) : null;
  if (!normalized) return;
  // changeLanguage() is idempotent (i18next no-ops when already active) and
  // also refreshes the localStorage cache, so repeated bootstrap calls are cheap.
  await changeLanguage(normalized);
};

/**
 * Call from every logged-in language picker (settings screens, profile
 * menu). Preserves the existing "instant apply" UX — changeLanguage() runs
 * first and its success/failure is what the UI reacts to — and then
 * fire-and-forgets the write-through to the account so the preference
 * survives across devices/browsers. A failed account write does not revert
 * the already-applied UI language; it only means the preference stays
 * device-local (localStorage) until the next successful save.
 */
export const changeLanguageAndPersist = async (
  userId: string | null | undefined,
  lang: string
): Promise<boolean> => {
  const changed = await changeLanguage(lang);
  if (changed && userId) {
    const normalized = normalizeLanguageCode(lang) || lang;
    try {
      await Api.put(`/users/${userId}`, { language: normalized });
    } catch (error) {
      console.warn('[languagePreference] Failed to persist language to account:', error);
    }
  }
  return changed;
};
