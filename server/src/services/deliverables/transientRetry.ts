/**
 * Deliverables — WARSTWA PIPELINE (H3.6): wykrywanie błędów przejściowych + 1 retry.
 *
 * Generatory doc/deck/sheet wołają LLM w trybie fire-and-forget (wzorzec Gamma:
 * 202 + poll). Pojedynczy transient (timeout sieci / 429 rate-limit / 5xx dostawcy /
 * zerwane gniazdo) kończył całą generację stanem `error`, mimo że ponowienie za
 * chwilę zwykle przechodzi. Ten helper daje JEDEN retry z krótkim backoffem
 * WYŁĄCZNIE dla błędów rozpoznanych jako przejściowe — błędy trwałe (zła prośba,
 * refusal modelu, brak danych) propagują natychmiast, bez maskowania.
 *
 * ZAKRES: to jest warstwa obserwowalności/odporności WOKÓŁ generatora — nie
 * dotyka logiki budowania treści (prozy/tabel/slajdów).
 */
import logger from '../../utils/Logger.js';

const LOG_PREFIX = '[DeliverablesRetry]';

/**
 * Korelacja logów: jeden identyfikator na próbę generacji, żeby w logu dało się
 * połączyć start → retry → wynik/porażkę dla konkretnego przebiegu.
 */
export function newCorrelationId(prefix = 'gen'): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now().toString(36)}_${rand}`;
}

/**
 * Czy błąd wygląda na PRZEJŚCIOWY (wart jednego ponowienia)?
 * Rozpoznaje: timeouty, 429 (rate-limit / quota), 5xx dostawcy, zerwane
 * połączenia sieciowe. Wzorce spójne z services/ai/AIPipeline.ts (429/quota)
 * i providerSentinel.ts (mapowanie kodów).
 */
export function isTransientError(err: unknown): boolean {
  if (!err) return false;
  const anyErr = err as { status?: number; statusCode?: number; code?: string; message?: string };

  // Kod statusu HTTP (jeśli niesiony na obiekcie błędu).
  const status = Number(anyErr.status ?? anyErr.statusCode);
  if (status === 429 || (status >= 500 && status <= 599)) return true;

  // Kody błędów sieciowych Node.
  const code = String(anyErr.code || '').toUpperCase();
  if (
    code === 'ETIMEDOUT' ||
    code === 'ECONNRESET' ||
    code === 'ECONNREFUSED' ||
    code === 'EPIPE' ||
    code === 'EAI_AGAIN' ||
    code === 'UND_ERR_CONNECT_TIMEOUT' ||
    code === 'UND_ERR_HEADERS_TIMEOUT' ||
    code === 'UND_ERR_SOCKET'
  ) {
    return true;
  }

  // Fallback: dopasowanie po treści komunikatu (dostawcy LLM często nie niosą
  // ustrukturyzowanego .status na rzuconym Error).
  const msg = String(anyErr.message || err).toLowerCase();
  return (
    /\b429\b/.test(msg) ||
    /\b5\d{2}\b/.test(msg) ||
    msg.includes('too many requests') ||
    msg.includes('rate limit') ||
    msg.includes('rate-limit') ||
    msg.includes('quota') ||
    msg.includes('overloaded') ||
    msg.includes('timeout') ||
    msg.includes('timed out') ||
    msg.includes('etimedout') ||
    msg.includes('econnreset') ||
    msg.includes('socket hang up') ||
    msg.includes('network error') ||
    msg.includes('service unavailable') ||
    msg.includes('bad gateway') ||
    msg.includes('gateway timeout') ||
    msg.includes('temporarily unavailable')
  );
}

export interface TransientRetryOptions {
  /** Ile RAZEM prób (1 = bez retry). Domyślnie 2 = pierwsza + jeden retry. */
  attempts?: number;
  /** Backoff przed retry (ms). Domyślnie 1200 ms. */
  backoffMs?: number;
  /** Etykieta do logów (np. 'deck', 'doc', 'sheet'). */
  label?: string;
  /** Identyfikator korelacji — jeśli brak, zostanie wygenerowany. */
  correlationId?: string;
}

/**
 * Uruchamia `fn`; przy błędzie PRZEJŚCIOWYM ponawia (do `attempts` łącznie).
 * Błąd trwały propaguje natychmiast. Ostatni błąd propaguje po wyczerpaniu prób.
 */
export async function withTransientRetry<T>(
  fn: () => Promise<T>,
  options: TransientRetryOptions = {}
): Promise<T> {
  const attempts = Math.max(1, options.attempts ?? 2);
  const backoffMs = options.backoffMs ?? 1200;
  const label = options.label || 'generation';
  const cid = options.correlationId || newCorrelationId(label);

  let lastErr: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const transient = isTransientError(err);
      const message = err instanceof Error ? err.message : String(err);
      if (!transient || attempt >= attempts) {
        if (attempt > 1) {
          logger.warn(
            `${LOG_PREFIX} giving up cid=${cid} label=${label} attempt=${attempt}/${attempts} transient=${transient} — ${message}`
          );
        }
        throw err;
      }
      logger.warn(
        `${LOG_PREFIX} transient error, retrying cid=${cid} label=${label} attempt=${attempt}/${attempts} backoff=${backoffMs}ms — ${message}`
      );
      await new Promise((resolve) => setTimeout(resolve, backoffMs));
    }
  }
  // Nieosiągalne (pętla zawsze zwraca albo rzuca), ale TS wymaga.
  throw lastErr;
}
