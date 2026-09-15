import type { Request } from 'express';

export type ServerErrorLocale = 'en' | 'pl';

const SERVER_ERROR_MESSAGES: Record<ServerErrorLocale, Record<string, string>> = {
  en: {
    NOT_FOUND: 'Resource not found.',
    VALIDATION: 'The provided data is invalid.',
    UNAUTHORIZED: 'Authentication is required.',
    FORBIDDEN: 'You do not have permission to perform this operation.',
    CONFLICT: 'The operation conflicts with the current state.',
    DB_ERROR: 'The data could not be processed.',
    DATABASE_ERROR: 'The data could not be processed.',
    INTERNAL: 'An unexpected error occurred.',
    INTERNAL_ERROR: 'An unexpected error occurred.',
    REQUEST_JSON_TOO_LARGE: 'Request body exceeds the allowed size.',
    REQUEST_JSON_INVALID: 'Request body must be valid JSON.',
    REQUEST_MULTIPART_FILE_TOO_LARGE: 'Uploaded file exceeds the allowed size.',
    REQUEST_MULTIPART_TOO_MANY_FILES: 'Too many files were uploaded in one request.',
    REQUEST_MULTIPART_UNEXPECTED_FIELD: 'The request contains an unexpected file field.',
    REQUEST_MULTIPART_INVALID_PAYLOAD: 'The multipart request is invalid.',
  },
  pl: {
    NOT_FOUND: 'Nie znaleziono zasobu.',
    VALIDATION: 'Nieprawidłowe dane wejściowe.',
    UNAUTHORIZED: 'Wymagane jest zalogowanie.',
    FORBIDDEN: 'Brak uprawnień do tej operacji.',
    CONFLICT: 'Operacja jest w konflikcie z aktualnym stanem.',
    DB_ERROR: 'Nie udało się przetworzyć danych.',
    DATABASE_ERROR: 'Nie udało się przetworzyć danych.',
    INTERNAL: 'Wystąpił nieoczekiwany błąd.',
    INTERNAL_ERROR: 'Wystąpił nieoczekiwany błąd.',
    REQUEST_JSON_TOO_LARGE: 'Treść żądania przekracza dozwolony rozmiar.',
    REQUEST_JSON_INVALID: 'Treść żądania musi być poprawnym dokumentem JSON.',
    REQUEST_MULTIPART_FILE_TOO_LARGE: 'Przesłany plik przekracza dozwolony rozmiar.',
    REQUEST_MULTIPART_TOO_MANY_FILES: 'W jednym żądaniu przesłano zbyt wiele plików.',
    REQUEST_MULTIPART_UNEXPECTED_FIELD: 'Żądanie zawiera nieoczekiwane pole pliku.',
    REQUEST_MULTIPART_INVALID_PAYLOAD: 'Żądanie wieloczęściowe jest nieprawidłowe.',
  },
};

const OPERATIONAL_ERROR_MESSAGES: Record<ServerErrorLocale, Record<string, string>> = {
  en: {
    PROGRAM_NOT_ACTIVE: 'The OKR program is not active, so a new cycle cannot be opened.',
    FINANCE_SETTINGS_INVALID: 'The finance settings are invalid.',
    NOT_FOUND: 'Template not found.',
    COMMAND_CAPABILITY_DENIED: 'You are not authorized to perform this action.',
  },
  pl: {
    PROGRAM_NOT_ACTIVE: 'Program OKR nie jest aktywny, dlatego nie można otworzyć nowego cyklu.',
    FINANCE_SETTINGS_INVALID: 'Ustawienia finansowe są nieprawidłowe.',
    NOT_FOUND: 'Nie znaleziono szablonu.',
    COMMAND_CAPABILITY_DENIED: 'Nie masz uprawnień do wykonania tej operacji.',
  },
};

type LocaleRequest = Pick<Request, 'get'> & {
  user?: { language?: unknown; preferred_language?: unknown; locale?: unknown };
};

function normalizeLocale(value: unknown): ServerErrorLocale | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  if (/^pl(?:[-_,]|$)/.test(normalized)) return 'pl';
  if (/^en(?:[-_,]|$)/.test(normalized)) return 'en';
  return null;
}

export function resolveServerErrorLocale(req?: LocaleRequest): ServerErrorLocale {
  return (
    normalizeLocale(req?.user?.language) ??
    normalizeLocale(req?.user?.preferred_language) ??
    normalizeLocale(req?.user?.locale) ??
    normalizeLocale(req?.get?.('Accept-Language')) ??
    'en'
  );
}

export function serverErrorMessage(
  code: string,
  locale: ServerErrorLocale,
  fallback: string
): string {
  return SERVER_ERROR_MESSAGES[locale][code] ?? fallback;
}

export function operationalServerErrorMessage(
  code: string,
  locale: ServerErrorLocale,
  fallback: string
): string {
  return OPERATIONAL_ERROR_MESSAGES[locale][code] ?? fallback;
}
