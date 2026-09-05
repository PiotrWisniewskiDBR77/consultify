/**
 * Account-level UI language preference sync (P0.3, 2026-07-26; extended
 * 2026-07-28 with the organization fallback).
 *
 * PROBLEM this fixes: i18next detection order was localStorage -> navigator
 * -> htmlTag (see src/i18n.ts). A logged-in Polish account opening the app
 * in a fresh browser (empty localStorage, browser locale en-*) landed on a
 * 100%-English screen even though PL translations are complete.
 *
 * FIX: for a LOGGED-IN session the source of truth becomes
 *   account (`User.language`) > organization default language > localStorage > navigator
 * — a manual language change now writes through to the account (not just
 * localStorage), and every session bootstrap re-applies the account's
 * language if one is set. Landing/unauthenticated flows are NOT touched:
 * there is no account yet, so navigator detection stays correct there.
 *
 * 2026-07-28 (żywy odbiór — owner saw an English UI on a Polish account):
 * `users.language` is frequently NULL (never explicitly set — there is no
 * language step in onboarding that writes it), so the account tier used to
 * be a no-op far more often than not, silently falling through straight to
 * navigator. The organization already has a UI default language
 * (`organization_profiles.defaultLanguage`, surfaced read-only today in
 * Settings > Language as "Tenant default language" —
 * `src/components/settings/LanguageSettings.tsx`) that was never consulted
 * as a fallback. Inserting it between account and localStorage means a
 * Polish organization's user gets a Polish UI even on a fresh browser with
 * an English `navigator.language`, without ever having touched a language
 * setting.
 */
import { changeLanguage, normalizeLanguageCode } from '../i18n';
import { Api } from './api';

// `/organization-context` resolves org claims consensus (DB reads, not free)
// and App.tsx's bootstrap effect calls `syncLanguageFromAccount` twice per
// load (immediate localStorage-restored user, then again after Api.getMe()
// resolves) — without caching, every session with no explicit account
// language (the common case pre-onboarding) would hit this endpoint twice on
// every page load. Session-scoped (tab lifetime) cache keeps the common path
// (account language IS set) at zero extra cost, since this is only consulted
// when `accountLanguage` is falsy.
const ORG_DEFAULT_LANGUAGE_CACHE_KEY = 'consultify_org_default_language_cache';

/**
 * Clear the cached organization default language. Call on logout so a shared
 * browser tab never carries a previous organization's language guess into
 * the next login before that account's own sync has a chance to run.
 */
export const clearOrganizationDefaultLanguageCache = (): void => {
  try {
    sessionStorage.removeItem(ORG_DEFAULT_LANGUAGE_CACHE_KEY);
  } catch {
    // ignore — best effort
  }
};

/**
 * Best-effort read of the organization's UI default language. Same field
 * `LanguageSettings.tsx` already reads via `GET /organization-context`
 * (`profile.defaultLanguage`) to show the read-only tenant hint — reused
 * here as an active fallback instead of a passive hint. Deliberately
 * fail-soft: an organization-context lookup failure (network, missing
 * profile, claims not yet resolved) must never block or throw during session
 * bootstrap, it just means this fallback tier contributes nothing.
 */
const getOrganizationDefaultLanguage = async (): Promise<string | null> => {
  try {
    const cached = sessionStorage.getItem(ORG_DEFAULT_LANGUAGE_CACHE_KEY);
    if (cached !== null) {
      return cached === '' ? null : cached;
    }
  } catch {
    // sessionStorage unavailable (private mode, etc.) — skip caching, fetch fresh below.
  }
  try {
    const context = (await Api.get('/organization-context')) as {
      profile?: { defaultLanguage?: string | null };
    } | null;
    const value = context?.profile?.defaultLanguage || null;
    try {
      sessionStorage.setItem(ORG_DEFAULT_LANGUAGE_CACHE_KEY, value || '');
    } catch {
      // ignore — best effort
    }
    return value;
  } catch {
    return null;
  }
};

/**
 * Call once per session bootstrap, right after the user profile is fetched
 * (App.tsx, after Api.getMe() resolves, and also for the immediate
 * localStorage-restored user so the correct language paints before the
 * network round-trip completes).
 *
 * Priority: account (`User.language`) > organization default language >
 * whatever i18next's own detector already resolved (localStorage, then
 * navigator — unchanged fail-safe when neither account nor organization has
 * an explicit language).
 */
/**
 * ODBIÓR NA ŻYWO 05.09 (pakiet 10 · Materiały) — WYŚCIG DWÓCH WYWOŁAŃ.
 *
 * `App.tsx` woła tę funkcję DWA RAZY na jeden bootstrap i oba wywołania są
 * `void` (bez czekania): raz dla użytkownika odtworzonego z localStorage, raz
 * po `Api.getMe()`. Tory obu wywołań mają RÓŻNE długości — tor konta kończy się
 * natychmiast, tor organizacji czeka na `GET /organization-context` — więc
 * kolejność ZAKOŃCZEŃ nie jest kolejnością WYWOŁAŃ. Bez niżej wprowadzonej
 * bariery starsze wywołanie, które poszło dłuższą drogą (organizacja), mogło
 * nadpisać język ustawiony przez nowsze wywołanie (konto): ten sam ekran
 * kończył raz po polsku, raz po angielsku, zależnie od czasu odpowiedzi sieci.
 *
 * Bariera jest kolejnością, nie blokadą: każde wywołanie dostaje numer, a wynik
 * może zostać ZASTOSOWANY tylko wtedy, gdy żadne PÓŹNIEJSZE wywołanie już nie
 * zastosowało swojego. Wynik spóźniony jest po prostu porzucany.
 *
 * ⚠️ UCZCIWIE: dla konta właściciela (zmierzone 05.09) ta bariera niczego dziś
 * nie zmienia, bo `users.language` jest puste, a `organization_profiles
 * .defaultLanguage` dla DBR77 to `null` (`GET /api/organization-context` →
 * `"defaultLanguage": null`) — obie warstwy są PUSTE i funkcja i tak kończy
 * no-opem. Zaobserwowany przeskok PL/EN miał inną przyczynę (ładowanie paczki
 * tłumaczeń — patrz `src/i18n.ts`). Bariera zamyka realną, ale osobną dziurę.
 */
let languageSyncSeq = 0;
let languageSyncApplied = -1;

/** Zastosuj język tylko, jeśli nie wyprzedziło nas nowsze wywołanie. */
async function applyIfNotStale(seq: number, language: string): Promise<void> {
  if (seq < languageSyncApplied) return;
  languageSyncApplied = seq;
  await changeLanguage(language);
}

export const syncLanguageFromAccount = async (
  accountLanguage: string | null | undefined
): Promise<void> => {
  const seq = ++languageSyncSeq;
  const normalized = accountLanguage ? normalizeLanguageCode(accountLanguage) : null;
  if (normalized) {
    // changeLanguage() is idempotent (i18next no-ops when already active) and
    // also refreshes the localStorage cache, so repeated bootstrap calls are cheap.
    await applyIfNotStale(seq, normalized);
    return;
  }

  const orgDefault = await getOrganizationDefaultLanguage();
  const normalizedOrgDefault = orgDefault ? normalizeLanguageCode(orgDefault) : null;
  if (normalizedOrgDefault) {
    await applyIfNotStale(seq, normalizedOrgDefault);
    return;
  }

  // Neither account nor organization has an explicit language: deliberate
  // no-op, exactly as before this fix — whatever localStorage/navigator
  // already resolved to keeps being authoritative.
};

/** Tylko dla testów — zeruje barierę kolejności między przypadkami. */
export const __resetLanguageSyncOrderingForTests = (): void => {
  languageSyncSeq = 0;
  languageSyncApplied = -1;
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
