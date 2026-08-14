/**
 * context — wspólny kontekst wywołania i obsługa błędów dla tras Audits.
 *
 * Jedno miejsce, żeby każda trasa modułu miała ten sam aktora, ten sam sposób
 * zamiany błędu domenowego na kod HTTP i ten sam kształt odpowiedzi błędu.
 * Bez tego łatwo o trasę, która zwraca 500 tam, gdzie powinna zwrócić 403 —
 * a w audycie różnica między „awaria" a „nie masz uprawnień" jest istotna,
 * bo ta druga jest normalnym, testowalnym wynikiem segregacji obowiązków.
 */

import type { Response } from 'express';

import type { AuthRequest } from '../../middleware/auth.middleware.js';
import { AuditDomainError } from '../../services/audits/auditsDb.js';
import type { AuditActor } from '../../services/audits/types.js';
import logger from '../../utils/Logger.js';

export function auditActor(req: AuthRequest): AuditActor {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const user = (req as any).user || {};
  return {
    organizationId: String(req.organizationId || user.organizationId || user.organization_id || ''),
    userId: String(req.userId || user.id || user.userId || ''),
    platformRole: String(user.role || user.accessRole || '') || undefined,
  };
}

export function assertActor(actor: AuditActor): void {
  if (!actor.organizationId || !actor.userId) {
    throw new AuditDomainError(
      'Brak kontekstu organizacji lub użytkownika',
      401,
      'AUDIT_NO_CONTEXT'
    );
  }
}

/**
 * Zamienia wyjątek na odpowiedź HTTP. Błędy domenowe niosą swój kod; wszystko
 * inne to 500 z logiem — nigdy nie wyciekamy surowej treści błędu SQL do
 * klienta, bo bywa w niej fragment zapytania z danymi.
 */
export function handleAuditError(res: Response, error: unknown, where: string): void {
  if (error instanceof AuditDomainError) {
    res.status(error.statusCode).json({
      success: false,
      error: error.message,
      code: error.code,
    });
    return;
  }
  logger.error(`[audits] błąd w ${where}`, {
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  });
  res.status(500).json({
    success: false,
    error: 'Wystąpił błąd podczas przetwarzania operacji audytowej',
    code: 'AUDIT_INTERNAL_ERROR',
  });
}

/** Opakowanie handlera — jedna ścieżka błędu dla wszystkich tras modułu. */
export function route(where: string, handler: (req: AuthRequest, res: Response) => Promise<void>) {
  return async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      await handler(req, res);
    } catch (error) {
      handleAuditError(res, error, where);
    }
  };
}

export function parsePaging(query: Record<string, unknown>): { limit: number; offset: number } {
  const rawLimit = Number(query.limit);
  const rawOffset = Number(query.offset);
  const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 200) : 50;
  const offset = Number.isFinite(rawOffset) && rawOffset > 0 ? rawOffset : 0;
  return { limit, offset };
}
