/**
 * Wpis 231 pkt 2 (DEC-690) — `apiError-unknown-code`: an UNKNOWN UPPER_SNAKE code
 * renders the generic localized sentence (`errors.generic.unknownCode`), never the
 * raw server sentence. Before this, `normalizeApiErrorMessage`/`createApiError`
 * resolved `translateKnownCode(code) ?? normalized.message`, so the ~1000 server
 * codes absent from `API_ERROR_FALLBACKS_EN` leaked their raw `message` — Polish
 * in an English UI (the MUTE class, 222 hits in the K5pl measurement).
 *
 * Guarded contract:
 *   1. unknown UPPER_SNAKE code + Polish sentence → generic EN (no diacritics);
 *   2. with a registered translator the generic goes through i18n
 *      (`errors.generic.unknownCode`, EN default) — the PL user gets the PL pair;
 *   3. a KNOWN code keeps its registry sentence (unchanged);
 *   4. NO code at all keeps the raw message (unchanged — older routes send
 *      useful English sentences without a code);
 *   5. a code outside the UPPER_SNAKE convention keeps the raw message
 *      (the generic branch must not swallow non-convention payloads).
 *
 * The i18n pair EN/PL must exist in both locale files (DEC-461).
 */

import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  createApiError,
  normalizeApiErrorMessage,
  setApiErrorTranslator,
} from '../apiError';
import { API_ERROR_FALLBACKS_EN, API_ERROR_GENERIC_EN } from '../apiErrorFallbacks';

const UNKNOWN_CODE = 'SOME_FUTURE_SERVER_CODE';
const PL_RAW = 'Nie udało się zapisać zmian w bazie danych';
const POLISH_DIACRITICS = /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/;

function loadErrors(locale: 'en' | 'pl'): Record<string, any> {
  const file = path.resolve(process.cwd(), `public/locales/${locale}/translation.json`);
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as { errors?: Record<string, any> };
  return parsed.errors ?? {};
}

afterEach(() => {
  // The translator is module-global; other suites (e.g. k5plMute8) rely on the
  // unregistered EN-fallback path.
  setApiErrorTranslator(null);
});

describe('apiError-unknown-code — generic sentence for an unknown UPPER_SNAKE code', () => {
  it('sanity: the code under test is really unknown to the registry', () => {
    expect(API_ERROR_FALLBACKS_EN[UNKNOWN_CODE]).toBeUndefined();
  });

  it('normalizeApiErrorMessage: unknown code + Polish error → generic EN, no Polish', () => {
    const message = normalizeApiErrorMessage({ code: UNKNOWN_CODE, error: PL_RAW });
    expect(message).toBe(API_ERROR_GENERIC_EN);
    expect(message).not.toMatch(POLISH_DIACRITICS);
  });

  it('createApiError: unknown code → generic EN message, code/status preserved', () => {
    const err = createApiError({ code: UNKNOWN_CODE, error: PL_RAW, status: 422 }) as Error & {
      code?: string;
      status?: number;
    };
    expect(err.message).toBe(API_ERROR_GENERIC_EN);
    expect(err.message).not.toMatch(POLISH_DIACRITICS);
    expect(err.code).toBe(UNKNOWN_CODE);
    expect(err.status).toBe(422);
  });

  it('errorCode variant: the same contract holds when the payload uses errorCode', () => {
    expect(normalizeApiErrorMessage({ errorCode: UNKNOWN_CODE, message: PL_RAW })).toBe(
      API_ERROR_GENERIC_EN
    );
  });

  it('with a registered translator the generic resolves through errors.generic.unknownCode', () => {
    const calls: Array<[string, string]> = [];
    setApiErrorTranslator((key, defaultValue) => {
      calls.push([key, defaultValue]);
      return key === 'errors.generic.unknownCode' ? 'Coś poszło nie tak. Spróbuj ponownie.' : defaultValue;
    });
    const message = normalizeApiErrorMessage({ code: UNKNOWN_CODE, error: PL_RAW });
    expect(message).toBe('Coś poszło nie tak. Spróbuj ponownie.');
    expect(calls).toContainEqual(['errors.generic.unknownCode', API_ERROR_GENERIC_EN]);
  });
});

describe('apiError-unknown-code — unchanged behavior (regression guards)', () => {
  it('a KNOWN code still resolves to its registry sentence', () => {
    expect(normalizeApiErrorMessage({ code: 'DATABASE_ERROR', error: PL_RAW })).toBe(
      API_ERROR_FALLBACKS_EN.DATABASE_ERROR
    );
  });

  it('NO code at all keeps the raw message (English sentence from an older route)', () => {
    const raw = 'Folders could not be loaded.';
    expect(normalizeApiErrorMessage({ error: raw })).toBe(raw);
    expect(createApiError({ message: raw }).message).toBe(raw);
  });

  it('a non-UPPER_SNAKE code keeps the raw message', () => {
    const raw = 'Access denied for this resource.';
    expect(normalizeApiErrorMessage({ code: 'lowercase-code', error: raw })).toBe(raw);
    expect(normalizeApiErrorMessage({ code: 'HTTP-404', error: raw })).toBe(raw);
    expect(normalizeApiErrorMessage({ code: 'SINGLEWORD', error: raw })).toBe(raw);
  });

  it('the INTERNAL_ERROR string message keeps its dedicated generic mapping', () => {
    expect(normalizeApiErrorMessage('INTERNAL_ERROR')).toBe(
      'Something went wrong. Please try again.'
    );
  });
});

describe('errors.generic.unknownCode — EN/PL locale pair (DEC-461)', () => {
  it('exists in both locales; EN matches the code default, PL is Polish', () => {
    const en = loadErrors('en')?.generic?.unknownCode;
    const pl = loadErrors('pl')?.generic?.unknownCode;
    expect(typeof en).toBe('string');
    expect(en).toBe(API_ERROR_GENERIC_EN);
    expect(typeof pl).toBe('string');
    expect(pl).toMatch(POLISH_DIACRITICS);
    expect(pl).not.toBe(en);
  });
});
