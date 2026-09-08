import type { Response } from 'express';

/**
 * J17 — jedyny sposób, w jaki router ma odpowiadać błędem 4xx/5xx.
 *
 * ZASADA 5 planu JEZYK_EN_PL_20260908: **serwer nie wysyła zdań, wysyła kody**.
 * Zdanie po polsku wysłane z serwera trafiało 1:1 na ekran użytkownika wersji
 * angielskiej (pomiar K5pl = 258 miejsc).
 *
 * KSZTAŁT ODPOWIEDZI JEST ROZSZERZANY, NIGDY ZWĘŻANY:
 *   { errorCode, code, error }
 * - `errorCode` — pole kanoniczne J17 (front: `translateApiError`),
 * - `code`      — to samo, dla ~1170 istniejących konsumentów, którzy czytają
 *                 `code` (m.in. `src/utils/apiError.ts#normalizeApiError`,
 *                 `accessBlocked.ts`, `aiProviderErrorCopy.ts`),
 * - `error`     — zostaje WYŁĄCZNIE dla dziennika i zgodności wstecznej.
 *                 Front nie renderuje go, gdy jest kod.
 *
 * `logMessage` jest opcjonalny i NIE jest tłumaczony — to tekst dla człowieka
 * czytającego logi, nie dla użytkownika. Domyślnie równy kodowi.
 */
export function apiError(
  res: Response,
  status: number,
  code: string,
  logMessage?: string,
  extra?: Record<string, unknown>
): Response {
  return res.status(status).json({
    ...(extra || {}),
    errorCode: code,
    code,
    error: logMessage ?? code,
  });
}

/** Wariant dla routerów, które odpowiadają kopertą `{ success: false, ... }`. */
export function apiErrorEnvelope(
  res: Response,
  status: number,
  code: string,
  logMessage?: string,
  extra?: Record<string, unknown>
): Response {
  return apiError(res, status, code, logMessage, { success: false, ...(extra || {}) });
}
