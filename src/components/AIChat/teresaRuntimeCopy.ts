import i18n from '@/i18n';

import { getAiErrorLine } from './aiProviderErrorCopy';

/**
 * Build a compact, admin-only diagnostic string from a stream error so the real
 * cause (HTTP status / error code / message) is visible in the chat instead of
 * being collapsed into the generic "temporarily unavailable" copy. Returns '' if
 * nothing useful can be extracted.
 */
export function formatTeresaAdminDiagnostic(err: unknown): string {
  const e = (err || {}) as Record<string, any>;
  const status = Number(e?.status ?? e?.statusCode ?? e?.httpStatus ?? e?.response?.status) || null;
  const code = typeof e?.code === 'string' && e.code.trim().length > 0 ? e.code.trim() : null;
  const message =
    typeof e?.message === 'string' && e.message.trim().length > 0
      ? e.message.trim().slice(0, 200)
      : null;
  const parts: string[] = [];
  if (status) parts.push(`HTTP ${status}`);
  if (code) parts.push(code);
  if (message) parts.push(message);
  return parts.join(' · ');
}

/**
 * CHAT-OWN-016: tresc glowna pochodzi teraz WYLACZNIE z `aiProviderErrorCopy`
 * (klucze `aiChat.providerError.*` w obu translation.json). Wczesniej byly tu
 * dwa twarde zdania bez `t()`, do tego pozbawione polskich znakow
 * („niedostepna", „Sprobuj"), niezalezne od reszty komunikatow Czatu.
 * `errorSource` pozwala dobrac zdanie do przypadku (limit / konfiguracja /
 * czas / przerwany strumien) zamiast jednego ogolnika na wszystko.
 */
export function getTeresaStartFailureMessage(
  language?: string,
  adminDiagnostic?: string | null,
  errorSource?: unknown
): string {
  const base = String(language || 'en')
    .trim()
    .toLowerCase()
    .split('-')[0];
  const pl = base === 'pl';

  const main = `⚠️ ${getAiErrorLine(
    ((key: string, dflt?: string) => i18n.t(key, { defaultValue: dflt, lng: base })) as (
      k: string,
      d?: string
    ) => string,
    errorSource ?? { errorCode: 'AI_UNAVAILABLE' }
  )}`;

  const diag = String(adminDiagnostic || '').trim();
  if (!diag) return main;

  // Admin-only technical detail to speed up production diagnosis.
  const label = pl ? '🔧 Szczegoly (admin)' : '🔧 Details (admin)';
  const hint = pl
    ? 'Sprawdz /api/llm/health/detailed oraz logi serwera.'
    : 'Check /api/llm/health/detailed and server logs.';
  return `${main}\n\n${label}: ${diag}\n${hint}`;
}

export function getTeresaEmptyResponseMessage(language?: string): string {
  const base = String(language || 'en')
    .trim()
    .toLowerCase()
    .split('-')[0];

  if (base === 'pl') {
    return '⚠️ Teresa nie zwrocila pelnej odpowiedzi. Sprobuj ponownie za chwile.';
  }

  return '⚠️ Teresa did not return a complete answer. Please try again in a moment.';
}
