import { describe, expect, it } from 'vitest';

import {
  mapServerErrorToUserMessage,
  registeredServerErrorCodes,
  serverErrorDiagnosticTitle,
} from '../errorMessageMapper';

const FORBIDDEN_UI_FRAGMENTS = new RegExp(['assertSet', 'kod' + ' serwera', 'server rule'].join('|'), 'i');
const fallback = {
  pl: 'Coś poszło nie tak. Spróbuj ponownie.',
  en: 'Something went wrong. Try again.',
};

describe('mapServerErrorToUserMessage', () => {
  it('maps every registered server code to clean Polish and English copy', () => {
    expect(registeredServerErrorCodes).toEqual([
      'SET_NOT_EDITABLE',
      'SET_NOT_ACTIVE',
      'KEY_RESULT_CANCELLED',
    ]);
    registeredServerErrorCodes.forEach((code) => {
      expect(mapServerErrorToUserMessage(code, fallback, true)).not.toMatch(FORBIDDEN_UI_FRAGMENTS);
      expect(mapServerErrorToUserMessage(code, fallback, false)).not.toMatch(FORBIDDEN_UI_FRAGMENTS);
    });
  });

  it('normalizes the legacy function alias without exposing it', () => {
    const message = mapServerErrorToUserMessage('assertSetEditableForUpdate', fallback, true);
    expect(message).toContain('Cele i Kluczowe Rezultaty');
    expect(message).not.toMatch(FORBIDDEN_UI_FRAGMENTS);
    expect(serverErrorDiagnosticTitle('assertSetEditableForUpdate', true)).toBe(
      'Kod diagnostyczny: SET_NOT_EDITABLE'
    );
  });

  it('uses a localized generic fallback for an unknown code', () => {
    expect(mapServerErrorToUserMessage('FUTURE_CODE', fallback, true)).toBe(fallback.pl);
    expect(mapServerErrorToUserMessage('FUTURE_CODE', fallback, false)).toBe(fallback.en);
  });
});
