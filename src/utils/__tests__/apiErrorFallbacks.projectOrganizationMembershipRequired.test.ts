import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { normalizeApiErrorMessage, setApiErrorTranslator } from '../apiError';
import { API_ERROR_FALLBACKS_EN } from '../apiErrorFallbacks';

const CODE = 'PROJECT_ORGANIZATION_MEMBERSHIP_REQUIRED';
let polishErrors: Record<string, string>;

beforeAll(() => {
  const resources = JSON.parse(
    readFileSync(resolve(process.cwd(), 'public/locales/pl/translation.json'), 'utf8')
  ) as { errors: Record<string, string> };
  polishErrors = resources.errors;
  setApiErrorTranslator((key, defaultValue) => {
    const errorCode = key.replace(/^errors\./, '');
    return polishErrors[errorCode] ?? defaultValue;
  });
});

afterAll(() => {
  setApiErrorTranslator(null);
});

describe('PROJECT_ORGANIZATION_MEMBERSHIP_REQUIRED governed API error', () => {
  it('registers a readable English fallback for environments without i18n', () => {
    expect(API_ERROR_FALLBACKS_EN[CODE]).toBe(
      'The selected person must be an active member of the project organization.'
    );
  });

  it('normalizes the real route envelope to Polish without exposing the raw code', () => {
    const message = normalizeApiErrorMessage(
      { code: CODE, error: CODE },
      'HTTP 400 Bad Request'
    );

    expect(message).toBe('Wybrana osoba musi być aktywnym członkiem organizacji projektu.');
    expect(message).not.toContain(CODE);
    expect(message).not.toContain('HTTP 400');
  });
});
