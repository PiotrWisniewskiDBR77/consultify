/**
 * K-20b (KANAL Wpis 133, DEC-575) — odbiór wizualny toru OFF pstryczka
 * naprawionego w `KeyboardShortcutsSettings.tsx:565`.
 *
 * UWAGA: `shortcuts` to sekcja UKRYTA w `SettingsView.tsx:297-311` — odbija do
 * Profile, bo customizer skrótów czeka na globalny dispatch (komentarz w
 * kodzie). Więc — inaczej niż `calendar-sync-settings.tsx` — montujemy
 * KOMPONENT bezpośrednio (ten sam wzorzec co
 * `dev-render/screens/feedback-k20-pstryczki.tsx` dla `WorkingHoursSettings`),
 * nie przez `SettingsView`. To wciąż REALNY `<KeyboardShortcutsSettings>`,
 * tylko bez nawigacji powłoki, której ekran i tak nie osiąga w produkcie.
 *
 * Stany MIESZANE celowo: część skrótów włączona, część wyłączona — jeden
 * zrzut pokazuje oba stany toru obok siebie (pamięć „przyrząd kłamie, a oko
 * przywyka").
 *
 * Mockowane WYŁĄCZNIE wołanie, które ten ekran realnie robi przy montażu
 * (`Api.getShortcuts` → `SettingsApi.getShortcutsPreferences`). Zero
 * prawdziwego backendu.
 *
 * URL: ?screen=k20b-shortcuts-settings[&lang=pl|en][&theme=light|dark]
 */
import React from 'react';

import { KeyboardShortcutsSettings } from '../../src/components/settings/KeyboardShortcutsSettings';
import { AppProviders } from '../../src/providers/AppProviders';
import { Api } from '../../src/services/api';
import { useAppStore } from '../../src/store/useAppStore';
import type { User } from '../../src/types';

const uzytkownik = {
  id: 'k20b-user',
  email: 'piotr@atelier-toys.pl',
  firstName: 'Piotr',
  lastName: 'Wiśniewski',
  language: 'en',
  role: 'OWNER',
  organizationId: 'k20b-org',
  isAuthenticated: true,
} as User;

useAppStore.setState({ currentUser: uzytkownik });

// Cztery skróty ON, dwa OFF — oba stany toru na jednym zrzucie.
const SHORTCUT_PREFERENCES = {
  preset: 'default',
  enabled: true,
  showHints: true,
  customShortcuts: {},
  disabledShortcuts: ['go_inbox', 'search_tasks'],
};

const realGet = Api.get.bind(Api);
Api.get = (async (url: string, ...reszta: unknown[]) => {
  if (url.includes('shortcuts')) return { preferences: SHORTCUT_PREFERENCES };
  return (realGet as (u: string, ...r: unknown[]) => unknown)(url, ...reszta);
}) as typeof Api.get;

Object.assign(Api, {
  getShortcuts: async () => ({ preferences: SHORTCUT_PREFERENCES }),
  saveShortcuts: async () => ({ preferences: SHORTCUT_PREFERENCES }),
});

export default function K20bShortcutsSettingsScreen(): React.ReactElement {
  return (
    <AppProviders>
      <div style={{ minHeight: '100vh' }} className="bg-c-bg p-8">
        <KeyboardShortcutsSettings currentUser={uzytkownik} />
      </div>
    </AppProviders>
  );
}
