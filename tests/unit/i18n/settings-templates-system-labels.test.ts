import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * WAŻNY audytu evidence/audyt-mvp-20260906/B3/RAPORT_B3.md (defekt #7):
 * Ustawienia → Szablony ustawień — 4 szablony systemowe (Minimal/Power User/
 * Privacy Focused/Enterprise) i ich opisy renderowały się w 100% po angielsku.
 *
 * PRZYCZYNA: dane z API (`server/src/routes/settings.routes.ts` GET
 * /api/settings/templates, stałe `systemTemplates` z id 'minimal'/'power-user'/
 * 'privacy-focused'/'enterprise') były poprawnie przepuszczane przez
 * mechanizm humanizacji już istniejący we froncie
 * (`SettingsTemplates.tsx`'s `getTemplateLabel()` → `t('settings.templates.
 * system.<key>.<field>', template[field])`, `normalizeTemplateKey('power-user')
 * === 'power_user'`) — ALE słownik i18n (`public/locales/{pl,en}/
 * translation.json`, `settings.templates.system`) miał WYŁĄCZNIE klucze
 * `security_focused`/`productivity`/`ai_power_user` — z zupełnie innego,
 * najwyraźniej wcześniejszego zestawu szablonów, które API już nie zwraca.
 * Żaden z 4 REALNYCH id ('minimal', 'power-user', 'privacy-focused',
 * 'enterprise') nie miał odpowiadającego klucza → `t()` zawsze trafiało w
 * fallback (surowy angielski string z API).
 *
 * Naprawa: dodano brakujące 4 klucze `settings.templates.system.{minimal,
 * power_user, privacy_focused, enterprise}.{name,description}` w PL i EN —
 * ZERO zmian w SettingsTemplates.tsx / settings.routes.ts (mechanizm już
 * istniał, tylko słownik nie nadążał za API).
 *
 * Ten test pilnuje kontraktu: dla każdego RZECZYWISTEGO id szablonu
 * systemowego z settings.routes.ts (normalizowanego dokładnie tak jak
 * `normalizeTemplateKey` w SettingsTemplates.tsx), klucz
 * `settings.templates.system.<key>.name` i `.description` istnieje i jest
 * niepustym stringiem w OBU słownikach.
 */

const readLocale = (locale: 'en' | 'pl') =>
  JSON.parse(
    readFileSync(path.join(process.cwd(), 'public', 'locales', locale, 'translation.json'), 'utf8')
  );

const getPath = (obj: unknown, dottedPath: string): unknown =>
  dottedPath.split('.').reduce((current: any, key) => current?.[key], obj);

// Kopia normalizeTemplateKey z SettingsTemplates.tsx.
const normalizeTemplateKey = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');

// Id realnych szablonów systemowych z server/src/routes/settings.routes.ts
// (GET /api/settings/templates, stała `systemTemplates`).
const SYSTEM_TEMPLATE_IDS = ['minimal', 'power-user', 'privacy-focused', 'enterprise'] as const;

describe('Ustawienia → Szablony — etykiety szablonów systemowych istnieją dla RZECZYWISTYCH id z API', () => {
  it.each(SYSTEM_TEMPLATE_IDS)('id API "%s" ma klucz i18n odpowiadający normalizeTemplateKey', (id) => {
    const key = normalizeTemplateKey(id);
    const pl = readLocale('pl');
    const en = readLocale('en');

    for (const [label, dict] of [
      ['pl', pl],
      ['en', en],
    ] as const) {
      const name = getPath(dict, `settings.templates.system.${key}.name`);
      const description = getPath(dict, `settings.templates.system.${key}.description`);
      expect(name, `${label}: settings.templates.system.${key}.name`).toEqual(expect.any(String));
      expect(String(name).trim(), `${label}: name pusty dla ${key}`).not.toBe('');
      expect(description, `${label}: settings.templates.system.${key}.description`).toEqual(
        expect.any(String)
      );
      expect(String(description).trim(), `${label}: description pusty dla ${key}`).not.toBe('');
    }
  });

  it('nazwy PL różnią się od angielskiego API dla przynajmniej "minimal" i "enterprise" (nie jest to gołe kopiowanie fallbacku)', () => {
    const pl = readLocale('pl');
    expect(getPath(pl, 'settings.templates.system.minimal.name')).not.toBe('Minimal');
    expect(getPath(pl, 'settings.templates.system.minimal.description')).not.toBe(
      'Clean, distraction-free settings'
    );
  });
});
