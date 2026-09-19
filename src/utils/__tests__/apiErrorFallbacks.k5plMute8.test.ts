/**
 * K5pl-MUTE-8 (Wpis 231/232, DEC-690, mechanism B) — the eight "mute" server codes.
 *
 * A MUTE code is a stable UPPER_SNAKE `code` the server emits that was ABSENT from
 * `API_ERROR_FALLBACKS_EN` and from `errors.*` in the locale files. The live client path
 * `normalizeApiErrorMessage`/`createApiError` (src/utils/apiError.ts:168/:175) resolves
 * `translateKnownCode(code) ?? normalized.message`; `translateKnownCode` returns null for an
 * unregistered code, so the raw server sentence rendered verbatim. With an English UI
 * (DEC-461) that sentence was Polish — the real "tester sees Polish" defect.
 *
 * This package registers all eight (EN fallback + `errors.<CODE>` EN/PL pair) and deletes the
 * redundant Polish `error:` literal on the server, keeping only `code:`. These tests are the
 * guard: parity across the three registries, EN (not Polish) resolution on the client, and the
 * PL value frozen to the sentence the server used to send.
 */

import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { createApiError, normalizeApiErrorMessage } from '../apiError';
import { API_ERROR_FALLBACKS_EN } from '../apiErrorFallbacks';

const MUTE8 = [
  'PINNED_INSIGHTS_PIN_FAILED',
  'PINNED_INSIGHTS_UPDATE_FAILED',
  'PINNED_INSIGHTS_UNPIN_FAILED',
  'AI_CHAT_FAILED',
  'ASSESSMENT_SOURCE_UNAVAILABLE',
  'ASSESSMENT_CONCLUSION_LINEAGE_MISSING',
  'ASSESSMENT_WORKFLOW_V2_CREATE_RUN_FAILED',
  'SETTINGS_REGIONAL_UPDATE_FAILED',
] as const;

// The exact Polish sentences the server used to inline. After mechanism B they live ONLY here
// (pl locale) — the server sends the bare code. Frozen so a PL user keeps the same wording.
const PL_SENTENCES: Record<string, string> = {
  PINNED_INSIGHTS_PIN_FAILED: 'Nie udało się przypiąć insightu',
  PINNED_INSIGHTS_UPDATE_FAILED: 'Nie udało się zaktualizować insightu',
  PINNED_INSIGHTS_UNPIN_FAILED: 'Nie udało się odpiąć insightu',
  AI_CHAT_FAILED: 'Nie udało się wygenerować odpowiedzi asystenta',
  ASSESSMENT_SOURCE_UNAVAILABLE: 'Źródło danych oceny jest chwilowo niedostępne.',
  ASSESSMENT_CONCLUSION_LINEAGE_MISSING: 'Wniosek zapisany bez rodowodu do oceny — przerwane',
  ASSESSMENT_WORKFLOW_V2_CREATE_RUN_FAILED: 'Nie udało się utworzyć przebiegu',
  SETTINGS_REGIONAL_UPDATE_FAILED: 'Nie udało się zapisać preferencji regionalnych',
};

const POLISH_DIACRITICS = /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/;

function loadErrors(locale: 'en' | 'pl'): Record<string, unknown> {
  const file = path.resolve(process.cwd(), `public/locales/${locale}/translation.json`);
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as { errors?: Record<string, unknown> };
  return parsed.errors ?? {};
}

const enErrors = loadErrors('en');
const plErrors = loadErrors('pl');

describe('K5pl-MUTE-8 registry parity (fallbacks ⇔ en ⇔ pl)', () => {
  it.each(MUTE8)('%s is registered in all three registries', (code) => {
    expect(API_ERROR_FALLBACKS_EN[code], 'apiErrorFallbacks.ts').toBeTruthy();
    expect(enErrors[code], 'public/locales/en errors').toBeTruthy();
    expect(plErrors[code], 'public/locales/pl errors').toBeTruthy();
  });

  it.each(MUTE8)('%s EN fallback and EN locale agree and carry no Polish diacritics', (code) => {
    const fallback = API_ERROR_FALLBACKS_EN[code];
    expect(enErrors[code]).toBe(fallback);
    expect(fallback).not.toMatch(POLISH_DIACRITICS);
  });

  it.each(MUTE8)('%s PL locale keeps the sentence the server used to send', (code) => {
    expect(plErrors[code]).toBe(PL_SENTENCES[code]);
  });
});

describe('K5pl-MUTE-8 client localization (the defect: raw Polish rendered)', () => {
  it.each(MUTE8)('normalizeApiErrorMessage resolves EN for a code-only body (%s)', (code) => {
    // After the server edit the body carries ONLY the code — no message/error field.
    const message = normalizeApiErrorMessage({ code }, 'Request failed');
    expect(message).toBe(API_ERROR_FALLBACKS_EN[code]);
    expect(message).not.toBe('Request failed');
    expect(message).not.toMatch(POLISH_DIACRITICS);
  });

  it.each(MUTE8)(
    'createApiError prefers the EN code sentence over a raw Polish error field (%s)',
    (code) => {
      // Defence in depth: even if a stale/foreign server still sends a Polish `error`,
      // the registered code wins and the user sees English.
      const err = createApiError({ code, error: PL_SENTENCES[code] }, 'Request failed') as Error & {
        code?: string;
      };
      expect(err.message).toBe(API_ERROR_FALLBACKS_EN[code]);
      expect(err.message).not.toMatch(POLISH_DIACRITICS);
      expect(err.code).toBe(code);
    }
  );
});
