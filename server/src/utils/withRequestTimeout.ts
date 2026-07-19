/**
 * H5.2 — timeouts dla ciężkich operacji (raporty, exporty, AI).
 *
 * Zgodne z docs/standards/ERROR_HANDLING_STANDARD.md:
 *  - przekroczenie budżetu czasu ⇒ `AppError(504, code)` (klasa 5xx z kodem),
 *  - rzucany błąd łapie centralny `errorHandlerMiddleware`, który loguje
 *    `logger.error` z `correlationId` i zwraca stabilny kształt `{ code }`,
 *  - żaden wyciek `err.message` ani gołe `res.status(500)`.
 *
 * Użycie w handlerze owiniętym `asyncHandler`:
 *   const pdf = await withRequestTimeout(
 *     buildHeavyReport(...),
 *     REPORT_TIMEOUT_MS,
 *     { code: 'REPORT_GENERATION_TIMEOUT' }
 *   );
 *
 * Uwaga: `Promise.race` NIE anuluje pracy w tle — jeśli operacja przyjmuje
 * `AbortSignal`, przekaż go i zerwij po timeoucie (patrz `createTimeoutSignal`).
 */
import { AppError } from './ErrorHandler.js';

export const DEFAULT_HEAVY_TIMEOUT_MS = 30_000;

export interface TimeoutOptions {
  /** Maszynowy kod błędu (UPPER_SNAKE, stabilny) trafiający do klienta i telemetrii. */
  code: string;
  /** Bezpieczny komunikat dla klienta (bez wewnętrznych detali). */
  message?: string;
  /** Dodatkowy kontekst do logu (np. { reportId }). */
  details?: Record<string, unknown>;
}

/**
 * Ściga `promise` z budżetem czasu `ms`. Po przekroczeniu rzuca `AppError(504)`,
 * który centralny middleware zaloguje z correlation-id i ustandaryzuje.
 */
export async function withRequestTimeout<T>(
  promise: Promise<T>,
  ms: number,
  options: TimeoutOptions
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      reject(
        new AppError(options.message || 'Operation timed out', 504, options.code, {
          timeoutMs: ms,
          ...(options.details || {}),
        })
      );
    }, ms);
    // Nie trzymaj procesu przy życiu tylko dla tego timera.
    if (typeof (timer as any)?.unref === 'function') (timer as any).unref();
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * `AbortSignal` który sam zrywa się po `ms` — do przekazania do `fetch`/rendererów
 * PDF, tak by praca w tle faktycznie została anulowana (nie tylko odpięta).
 * Zwraca też `clear()` do posprzątania timera po normalnym zakończeniu.
 */
export function createTimeoutSignal(ms: number): { signal: AbortSignal; clear: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  if (typeof (timer as any)?.unref === 'function') (timer as any).unref();
  return { signal: controller.signal, clear: () => clearTimeout(timer) };
}

export default withRequestTimeout;
