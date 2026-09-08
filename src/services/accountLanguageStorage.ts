/**
 * Pamięć języka KONTA — osobna od `i18nextLng`, celowo (paczka ZZ, 2026-09-09).
 *
 * DLACZEGO OSOBNY KLUCZ. `i18nextLng` jest kluczem DETEKTORA: i18next zapisuje
 * tam także język, który dopiero ZGADŁ z `navigator.language`. Nie da się z
 * niego odczytać, czy „en" to wybór konta, czy przypadek ustawień przeglądarki.
 * Zmierzone 09.09 na czystym stanowisku (evidence/jezyk-jzz): konto
 * `users.language='en'` w świeżej przeglądarce z `navigator=pl-PL` dostaje
 * POLSKĄ powłokę i stoi w niej przez cały czas lotu `GET /auth/me`, bo o
 * pierwszy render języka gra przeglądarka, a konto dochodzi później.
 *
 * Ten klucz trzyma wyłącznie język pochodzący z KONTA (albo z domyślnego
 * języka organizacji), więc przy następnym wejściu można go użyć jako `lng`
 * jeszcze PRZED pierwszym renderem — deterministycznie, bez czekania na sieć.
 *
 * Moduł jest celowo bez zależności (nie importuje `i18n` ani `Api`): czytają
 * go i `src/i18n.ts`, i `src/services/api.ts`, i `languagePreference.ts`,
 * a każda inna zależność zrobiłaby z tego cykl importów.
 */

export const ACCOUNT_LANGUAGE_STORAGE_KEY = 'consultify.accountLanguage';

/** Języki, dla których mamy pliki tłumaczeń (kopia listy z `src/i18n.ts`). */
const OBSLUGIWANE = new Set(['en', 'pl', 'de', 'ar', 'ja', 'es']);
const ALIASY: Record<string, string> = { jp: 'ja' };

const znormalizuj = (lng: string | null | undefined): string | null => {
  const base = String(lng || '')
    .toLowerCase()
    .split(/[-_]/)[0];
  if (!base) return null;
  if (OBSLUGIWANE.has(base)) return base;
  return ALIASY[base] || null;
};

/** Język konta zapamiętany przy poprzedniej sesji. `null`, gdy nic nie wiemy. */
export const readStoredAccountLanguage = (): string | null => {
  try {
    return znormalizuj(window.localStorage.getItem(ACCOUNT_LANGUAGE_STORAGE_KEY));
  } catch {
    return null;
  }
};

/** Zapamiętaj język KONTA (nie języka przeglądarki). Wołane tylko z warstwy, która wie, że to konto. */
export const writeStoredAccountLanguage = (language: string | null | undefined): void => {
  const normalized = znormalizuj(language);
  if (!normalized) return;
  try {
    window.localStorage.setItem(ACCOUNT_LANGUAGE_STORAGE_KEY, normalized);
  } catch {
    // brak localStorage (tryb prywatny) — pamięć języka konta jest wtedy
    // wyłącznie na czas życia karty, i tak ma być: to optymalizacja, nie SSOT.
  }
};

/** Wyczyść przy wylogowaniu, żeby następne konto na tej przeglądarce nie odziedziczyło cudzego języka. */
export const clearStoredAccountLanguage = (): void => {
  try {
    window.localStorage.removeItem(ACCOUNT_LANGUAGE_STORAGE_KEY);
  } catch {
    // ignore — best effort
  }
};

// ---------------------------------------------------------------------------
// Sygnał „język konta jest już rozstrzygnięty".
//
// Powłoka nie ma prawa malować pierwszego ekranu, dopóki nie wiadomo, w jakim
// języku ma go namalować — inaczej użytkownik EN widzi polskie wartości
// domyślne z kodu (`t('klucz', 'Polski tekst')`, 1046 wystąpień w repo).
// Rozstrzygnięcie oznacza też świadome „nie wiem" (konto i organizacja nie mają
// języka) — wtedy zostaje detekcja przeglądarki i to jest poprawny wynik.
// ---------------------------------------------------------------------------
let rozstrzygniety = false;
const sluchacze = new Set<() => void>();

export const isAccountLanguageResolved = (): boolean => rozstrzygniety;

export const markAccountLanguageResolved = (): void => {
  if (rozstrzygniety) return;
  rozstrzygniety = true;
  for (const s of [...sluchacze]) {
    try {
      s();
    } catch {
      // słuchacz nie może zablokować bootstrapu
    }
  }
  sluchacze.clear();
};

/** Zwraca funkcję odsubskrybowania. Woła natychmiast, jeśli już rozstrzygnięte. */
export const onAccountLanguageResolved = (listener: () => void): (() => void) => {
  if (rozstrzygniety) {
    listener();
    return () => undefined;
  }
  sluchacze.add(listener);
  return () => sluchacze.delete(listener);
};

/** Tylko dla testów — zeruje sygnał między przypadkami. */
export const __resetAccountLanguageResolvedForTests = (): void => {
  rozstrzygniety = false;
  sluchacze.clear();
};
