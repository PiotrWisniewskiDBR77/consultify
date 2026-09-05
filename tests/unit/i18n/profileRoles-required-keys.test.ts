import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * BLOKER audytu evidence/audyt-mvp-20260906/B/RAPORT_B.md (defekt #1, pozycja 15-3):
 * `src/components/settings/ProfileSettings.tsx:603` renderuje
 * `t(\`settings.profile.roles.${String(currentUser.role).toLowerCase()}\`)` BEZ fallbacku.
 * Gdy klucz nie istnieje, i18next (returnNull:false, returnEmptyString:false, brak
 * parseMissingKeyHandler — src/i18n.ts) zwraca surowy klucz jako tekst, więc użytkownik
 * z rolą `USER`/`user` widziałby literalnie „settings.profile.roles.user".
 *
 * `UserRole` (src/types/domain/user.ts) wylicza WSZYSTKIE role, jakie może mieć
 * `currentUser.role` w tym komponencie. Ten test bierze każdą wartość z tego typu,
 * lowercase'uje ją dokładnie tak jak robi to ProfileSettings.tsx, i sprawdza że klucz
 * `settings.profile.roles.<rola>` istnieje i jest niepustym stringiem w OBU słownikach.
 *
 * Mutacja: usuń dowolny z kluczy (np. "user") z jednego z plików translation.json →
 * test czerwony.
 */

const readLocale = (locale: 'en' | 'pl') =>
  JSON.parse(
    readFileSync(path.join(process.cwd(), 'public', 'locales', locale, 'translation.json'), 'utf8')
  );

const getPath = (obj: unknown, dottedPath: string): unknown =>
  dottedPath.split('.').reduce((current: any, key) => current?.[key], obj);

// Kopia UserRole z src/types/domain/user.ts — każda wartość, jaką może przyjąć
// `currentUser.role` renderowany przez ProfileSettings.tsx:603.
const USER_ROLE_VALUES = [
  'user',
  'admin',
  'owner',
  'super_admin',
  'USER',
  'ADMIN',
  'OWNER',
  'SUPERADMIN',
  'GUEST',
  'VIEWER',
  'PROJECT_MANAGER',
  'TEAM_MEMBER',
] as const;

// Dokładnie ta sama transformacja co w ProfileSettings.tsx:603.
const ROLE_I18N_KEYS = Array.from(
  new Set(USER_ROLE_VALUES.map((role) => `settings.profile.roles.${role.toLowerCase()}`))
);

describe('ProfileSettings.tsx role i18n keys (settings.profile.roles.*)', () => {
  it('enumerates at least the known UserRole values, including "user"', () => {
    expect(ROLE_I18N_KEYS).toContain('settings.profile.roles.user');
  });

  it.each(['en', 'pl'] as const)(
    '%s locale has a non-empty translation for every settings.profile.roles.<UserRole> key',
    (locale) => {
      const translation = readLocale(locale);

      for (const key of ROLE_I18N_KEYS) {
        expect(getPath(translation, key), key).toEqual(expect.any(String));
        expect(String(getPath(translation, key)).trim(), key).not.toBe('');
      }
    }
  );
});
