export interface LocalizedErrorFallback {
  pl: string;
  en: string;
}

const SERVER_ERROR_MESSAGES: Readonly<Record<string, LocalizedErrorFallback>> = {
  SET_NOT_EDITABLE: {
    pl: 'Cele i Kluczowe Rezultaty można dodawać i edytować tylko, gdy zestaw OKR ma status „Szkic” lub „Wymaga poprawek”.',
    en: 'Objectives and Key Results can only be added or edited while the OKR set is in Draft or Changes requested status.',
  },
  SET_NOT_ACTIVE: {
    pl: 'Check-iny można dodawać tylko, gdy zestaw OKR ma status „Aktywny”.',
    en: 'Check-ins can only be added while the OKR set is Active.',
  },
  KEY_RESULT_CANCELLED: {
    pl: 'Kluczowy Rezultat jest anulowany, dlatego nie można dodawać check-inów.',
    en: 'The Key Result is cancelled, so check-ins cannot be added.',
  },
};

const SERVER_ERROR_CODE_ALIASES: Readonly<Record<string, string>> = {
  assertSetEditableForUpdate: 'SET_NOT_EDITABLE',
};

function canonicalServerErrorCode(code: string): string {
  const trimmed = String(code ?? '').trim();
  return SERVER_ERROR_CODE_ALIASES[trimmed] ?? trimmed.toUpperCase();
}

export function mapServerErrorToUserMessage(
  code: string,
  fallback: LocalizedErrorFallback,
  isPolish = true
): string {
  const copy = SERVER_ERROR_MESSAGES[canonicalServerErrorCode(code)] ?? fallback;
  return isPolish ? copy.pl : copy.en;
}

export function serverErrorDiagnosticTitle(code: string, isPolish: boolean): string {
  const canonicalCode = canonicalServerErrorCode(code) || 'UNKNOWN_ERROR';
  return isPolish
    ? `Kod diagnostyczny: ${canonicalCode}`
    : `Diagnostic code: ${canonicalCode}`;
}

export const registeredServerErrorCodes = Object.keys(SERVER_ERROR_MESSAGES);
