/**
 * ODBIÓR NA ŻYWO 05.09 (pakiet 10 · Materiały) — „język interfejsu przeskakuje
 * PL/EN między wczytaniami tego samego ekranu".
 *
 * Ten plik broni JEDNEJ z dwóch przyczyn: wyścigu dwóch wywołań
 * `syncLanguageFromAccount` z `App.tsx` (oba `void`, o różnej długości toru —
 * konto kończy natychmiast, organizacja czeka na sieć). Druga, u właściciela
 * dominująca przyczyna to ładowanie paczki tłumaczeń — patrz `src/i18n.ts`.
 *
 * DOWÓD MUTACYJNY (wykonany): usunięcie bariery `applyIfNotStale` (powrót do
 * gołego `await changeLanguage(...)`) → czerwienieje przypadek „spóźniony
 * wynik organizacji nie nadpisuje konta".
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const changeLanguage = vi.fn(async (_lang: string) => true);
let orgDefaultResolver: () => Promise<unknown> = async () => ({ profile: {} });

vi.mock('../../i18n', () => ({
  changeLanguage: (lang: string) => changeLanguage(lang),
  normalizeLanguageCode: (lng: string | null | undefined) => {
    const base = String(lng || '')
      .toLowerCase()
      .split(/[-_]/)[0];
    return ['en', 'pl', 'de', 'ar', 'ja', 'es'].includes(base) ? base : null;
  },
}));

vi.mock('../api', () => ({
  Api: {
    get: () => orgDefaultResolver(),
    put: async () => ({}),
  },
}));

import {
  __resetLanguageSyncOrderingForTests,
  clearOrganizationDefaultLanguageCache,
  syncLanguageFromAccount,
} from '../languagePreference';

beforeEach(() => {
  changeLanguage.mockClear();
  __resetLanguageSyncOrderingForTests();
  clearOrganizationDefaultLanguageCache();
  orgDefaultResolver = async () => ({ profile: {} });
});

describe('syncLanguageFromAccount — kolejność wygrywa nad czasem odpowiedzi', () => {
  it('spóźniony wynik organizacji NIE nadpisuje języka konta', async () => {
    // Tor organizacji rozstrzyga się PÓŹNIEJ niż tor konta — dokładnie układ
    // z App.tsx (pierwsze wywołanie: użytkownik z localStorage bez języka,
    // drugie: świeży profil z Api.getMe() z językiem konta).
    let releaseOrg: (value: unknown) => void = () => undefined;
    orgDefaultResolver = () =>
      new Promise((resolve) => {
        releaseOrg = resolve;
      });

    const first = syncLanguageFromAccount(null); // pójdzie torem organizacji
    const second = syncLanguageFromAccount('pl'); // kończy natychmiast
    await second;

    releaseOrg({ profile: { defaultLanguage: 'en' } });
    await first;

    expect(changeLanguage).toHaveBeenCalledWith('pl');
    expect(changeLanguage).not.toHaveBeenCalledWith('en');
  });

  it('gdy organizacja rozstrzyga się PIERWSZA, nowsze wywołanie konta i tak wygrywa', async () => {
    orgDefaultResolver = async () => ({ profile: { defaultLanguage: 'en' } });

    await syncLanguageFromAccount(null);
    await syncLanguageFromAccount('pl');

    expect(changeLanguage).toHaveBeenNthCalledWith(1, 'en');
    expect(changeLanguage).toHaveBeenNthCalledWith(2, 'pl');
  });

  it('puste konto i pusta organizacja = no-op (stan konta właściciela 05.09)', async () => {
    orgDefaultResolver = async () => ({ profile: { defaultLanguage: null } });
    await syncLanguageFromAccount(undefined);
    expect(changeLanguage).not.toHaveBeenCalled();
  });
});
