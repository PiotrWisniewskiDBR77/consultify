/**
 * J17 — kontrakt `translateApiError`. Test pilnuje trzech gałęzi opisanych
 * w nagłówku `src/utils/translateApiError.ts`, bo każda z nich odpowiada za
 * inną klasę defektu zmierzoną 2026-09-08:
 *   - znany kod  -> tekst z `errors.*` (użytkownik EN nie widzi polskiego),
 *   - nieznany kod -> generyczne zdanie EN (nie polskie zdanie serwera),
 *   - brak kodu  -> stare pole `error` (świadomy dług, żeby ekran nie był pusty).
 *
 * MUTACJA DOWODOWA (opisana w meldunku): usunięcie wpisu z `API_ERROR_FALLBACKS_EN`
 * przewraca test „znany kod" — czyli słownik naprawdę trzyma ten kontrakt.
 */
import { describe, expect, it } from 'vitest';

import { API_ERROR_FALLBACKS_EN } from '@/utils/apiErrorFallbacks';
import { resolveApiError, translateApiError } from '@/utils/translateApiError';

/** Atrapa i18n: EN = fallback z kodu, PL = własny słownik. */
const tEn = (_key: string, fallback: string) => fallback;
const PL: Record<string, string> = {
  'errors.MFA_SETUP_FAILED': 'Nie udało się skonfigurować MFA.',
  'errors.API_ERROR_GENERIC': 'Coś poszło nie tak. Spróbuj ponownie.',
};
const tPl = (key: string, fallback: string) => PL[key] ?? fallback;

describe('translateApiError', () => {
  it('znany kod: EN dostaje angielskie zdanie, PL polskie — z tego samego kodu', () => {
    const body = { code: 'MFA_SETUP_FAILED', error: 'Nie udało się skonfigurować MFA' };

    expect(translateApiError(body, tEn)).toBe(
      API_ERROR_FALLBACKS_EN.MFA_SETUP_FAILED
    );
    expect(translateApiError(body, tEn)).toBe('Multi-factor authentication could not be set up.');
    expect(translateApiError(body, tPl)).toBe('Nie udało się skonfigurować MFA.');
  });

  it('czyta też pole `errorCode` (kształt kanoniczny J17), nie tylko `code`', () => {
    const body = { errorCode: 'VAULT_SCOPE_INVALID', error: 'scope musi być jednym z: …' };
    expect(translateApiError(body, tEn)).toBe('scope must be one of: user, project, organization.');
  });

  it('polskie zdanie serwera NIE trafia na ekran, gdy jest znany kod', () => {
    const body = { code: 'KNOWLEDGE_VAULT_FOLDERS_FAILED', error: 'Nie udało się pobrać folderów' };
    const out = translateApiError(body, tEn);
    expect(out).toBe('Folders could not be loaded.');
    expect(out).not.toMatch(/Nie udało/);
  });

  it('nieznany kod: generyczne zdanie EN, a NIE zdanie serwera', () => {
    const body = { code: 'ZUPELNIE_NOWY_KOD_Z_PRZYSZLOSCI', error: 'Nie udało się nic zrobić' };
    const wynik = resolveApiError(body, tEn);

    expect(wynik.message).toBe('Something went wrong. Please try again.');
    expect(wynik.message).not.toMatch(/Nie udało/);
    // kod zostaje dla dziennika i telemetrii, mimo że nie ma tłumaczenia
    expect(wynik.code).toBe('ZUPELNIE_NOWY_KOD_Z_PRZYSZLOSCI');
    expect(wynik.fromServerText).toBe(false);
  });

  it('brak kodu: pokazuje stare pole `error` i oznacza to jako dług', () => {
    const wynik = resolveApiError({ error: 'Legacy sentence from an old route' }, tEn);
    expect(wynik.message).toBe('Legacy sentence from an old route');
    expect(wynik.fromServerText).toBe(true);
    expect(wynik.code).toBeUndefined();
  });

  it('brak kodu i brak treści: generyczne zdanie, nigdy pustka', () => {
    expect(translateApiError({}, tEn)).toBe('Something went wrong. Please try again.');
    expect(translateApiError(null, tEn)).toBe('Something went wrong. Please try again.');
  });

  it('kod ma pierwszeństwo nad treścią serwera także dla obiektu Error', () => {
    const err = Object.assign(new Error('Nie udało się pobrać ocen'), {
      code: 'ASSESSMENT_HUB_FETCH_ASSESSMENTS_FAILED',
      status: 500,
    });
    const wynik = resolveApiError(err, tEn);
    expect(wynik.message).toBe('Assessments could not be loaded.');
    expect(wynik.status).toBe(500);
  });

  it('słownik fallbacków nie zawiera polskich znaków — EN ma być czysty', () => {
    const polskie = Object.entries(API_ERROR_FALLBACKS_EN).filter(([, value]) =>
      /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/.test(value)
    );
    expect(polskie).toEqual([]);
  });
});

/**
 * J17 — warstwa globalna: `normalizeApiErrorMessage` jest wołane w 515 miejscach
 * frontu, w większości BEZ `t` w zasięgu. Ta ścieżka jest tym, co realnie
 * zdejmuje polskie zdanie z ekranu użytkownika EN bez przepisywania 515 plików.
 */
describe('normalizeApiErrorMessage — warstwa globalna J17', () => {
  it('ZNANY kod wypiera polskie zdanie serwera (bez tłumacza: angielski fallback)', async () => {
    const { normalizeApiErrorMessage, setApiErrorTranslator } = await import('@/utils/apiError');
    setApiErrorTranslator(null);

    const out = normalizeApiErrorMessage({
      code: 'KNOWLEDGE_VAULT_FOLDERS_FAILED',
      error: 'Nie udało się pobrać folderów',
    });
    expect(out).toBe('Folders could not be loaded.');
  });

  it('zarejestrowany tłumacz decyduje o języku (PL dostaje polskie)', async () => {
    const { normalizeApiErrorMessage, setApiErrorTranslator } = await import('@/utils/apiError');
    setApiErrorTranslator((key, def) =>
      key === 'errors.KNOWLEDGE_VAULT_FOLDERS_FAILED' ? 'Nie udało się pobrać folderów.' : def
    );

    expect(
      normalizeApiErrorMessage({ code: 'KNOWLEDGE_VAULT_FOLDERS_FAILED', error: 'x' })
    ).toBe('Nie udało się pobrać folderów.');
    setApiErrorTranslator(null);
  });

  it('NIEZNANY kod nie jest ruszany — stare angielskie komunikaty zostają', async () => {
    const { normalizeApiErrorMessage, setApiErrorTranslator } = await import('@/utils/apiError');
    setApiErrorTranslator(null);

    expect(
      normalizeApiErrorMessage({ error: { message: 'Email already exists', code: 'DUPLICATE_EMAIL' } })
    ).toBe('Email already exists');
  });
});
