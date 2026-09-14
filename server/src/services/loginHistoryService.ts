/**
 * Zapis historii logowania — strona SERWERA, w realnym przepływie logowania.
 *
 * T-XI (uwagi testera Tomka, 2026-09-13): „Uwierzytelnienie i dostęp — po
 * przelogowaniu nie pokazuje historii logowania" (zrzut: „Brak dostępnej
 * historii logowania" przy czterech aktywnych sesjach obok).
 *
 * PRZYCZYNA ZMIERZONA: tabela `login_history` miała CZYTELNIKÓW
 * (`GET /api/auth/login-history`, przegląd bezpieczeństwa, panel superadmina,
 * behaviorIntelligenceService, transactionReadinessService), ale jedynym
 * PISARZEM był endpoint `POST /api/auth/login-history`, którego nikt nie
 * wołał — ani `src/`, ani serwer. Tabela była więc pusta zawsze i dla
 * każdego. To jest „wołacz istnieje ≠ ktokolwiek go woła".
 *
 * Dlatego zapis idzie TU, po stronie serwera, wprost z kontrolera logowania —
 * nie przez HTTP do samego siebie.
 *
 * Wypełniamy OBA komplety kolumn, bo czytelnicy nie są zgodni co do nazw:
 *  - `status` ('success' | 'failed') + `created_at` — czyta ekran „Historia
 *    logowania" i panel superadmina,
 *  - `success` (bool) + `login_at` — czyta behaviorIntelligenceService i
 *    transactionReadinessService.
 * Zapis tylko jednej pary zostawiłby połowę powierzchni dalej martwą.
 *
 * Zapis jest FAIL-SOFT: ślad audytowy nigdy nie może przewrócić logowania.
 */
import { v4 as uuidv4 } from 'uuid';

import { run as dbRun } from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';

export interface LoginHistoryEntry {
  userId: string;
  organizationId?: string | null;
  email?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  location?: string | null;
  status: 'success' | 'failed';
  failureReason?: string | null;
}

const truncate = (value: unknown, max: number): string | null => {
  const raw = value === null || value === undefined ? '' : String(value).trim();
  if (!raw) return null;
  return raw.length <= max ? raw : raw.slice(0, max);
};

export async function recordLoginHistory(entry: LoginHistoryEntry): Promise<boolean> {
  if (!entry?.userId) return false;

  const nowIso = new Date().toISOString();
  const isSuccess = entry.status === 'success';

  try {
    const result = await dbRun(
      `INSERT INTO login_history
         (id, user_id, organization_id, ip_address, user_agent, location, status,
          failure_reason, created_at, login_at, success, email)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        uuidv4(),
        entry.userId,
        truncate(entry.organizationId, 255),
        truncate(entry.ipAddress, 100),
        truncate(entry.userAgent, 500),
        truncate(entry.location, 255),
        isSuccess ? 'success' : 'failed',
        truncate(entry.failureReason, 255),
        nowIso,
        nowIso,
        isSuccess,
        truncate(entry.email, 255),
      ],
      { fallback: false }
    );

    if (!result.success) {
      logger.warn('[LoginHistory] Zapis nie powiódł się (logowanie kontynuowane)', {
        userId: entry.userId,
        error: result.error,
      });
      return false;
    }
    return true;
  } catch (err: unknown) {
    logger.warn('[LoginHistory] Zapis rzucił wyjątkiem (logowanie kontynuowane)', {
      userId: entry.userId,
      error: (err as Error)?.message || err,
    });
    return false;
  }
}

export default { recordLoginHistory };
