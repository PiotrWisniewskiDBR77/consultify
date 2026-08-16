import type { NextFunction, Response } from 'express';

import type { AuthRequest } from '../middleware/auth.middleware.js';
import { getV8Context } from '../middleware/v8Auth.middleware.js';
import * as DbPromise from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';

type ProtectedLegacyWriter = {
  method: string;
  path: RegExp;
  successor: string;
  legacyTable: string;
  legacyIdFromPath: (path: string) => string;
};

/**
 * Non-destructive emergency rollback. `true` re-enables only the explicitly
 * protected writer; it does not reverse or mutate canonical data.
 */
export const FINANCE_LEGACY_WRITER_ROLLBACK_ENV = 'FINANCE_LEGACY_WRITER_ROLLBACK_ENABLED';

/**
 * First cutover tranche: model approval is the only legacy writer whose
 * canonical successor deliberately preserves its frozen response contract.
 * Other writes remain available but are durably classified as uncovered.
 */
export const PROTECTED_FINANCE_LEGACY_WRITERS: ProtectedLegacyWriter[] = [
  {
    method: 'POST',
    path: /^\/models\/[^/]+\/approve\/?$/,
    successor: '/api/v8/finance-v2/models/:artifactId/approve',
    legacyTable: 'financial_models',
    legacyIdFromPath: (path) => decodeURIComponent(path.split('/')[2] || ''),
  },
];

export function financeLegacyWriterRollbackEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env[FINANCE_LEGACY_WRITER_ROLLBACK_ENV] === 'true';
}

export function findProtectedFinanceLegacyWriter(
  method: string,
  path: string
): ProtectedLegacyWriter | null {
  const normalizedMethod = String(method || '').toUpperCase();
  const normalizedPath = String(path || '').split('?')[0] || '/';
  return (
    PROTECTED_FINANCE_LEGACY_WRITERS.find(
      (entry) => entry.method === normalizedMethod && entry.path.test(normalizedPath)
    ) || null
  );
}

async function recordUsage(params: {
  req: AuthRequest;
  accessKind:
    | 'legacy_read'
    | 'legacy_uncovered_writer'
    | 'legacy_writer_blocked'
    | 'rollback_writer';
  protectedWriter?: ProtectedLegacyWriter | null;
}): Promise<void> {
  const { organizationId, userId } = getV8Context(params.req);
  const requestId = String(params.req.headers['x-request-id'] || '').trim();
  // This guard is mounted with `router.use()` before leaf-route matching, so
  // Express has not populated `req.params` yet. Parse from the already
  // normalized router-local path instead of recording a false empty ID.
  const legacyId = params.protectedWriter
    ? params.protectedWriter.legacyIdFromPath(String(params.req.path || '/')).trim()
    : '';

  await DbPromise.run(
    `INSERT INTO finance_legacy_usage_events
       (organization_id,request_id,user_id,method,route_path,access_kind,
        successor_path,legacy_table,legacy_id,canonical_artifact_id,
        canonical_business_version_id)
     SELECT ?,?,?,?,?,?,?,?,?,a.artifact_id,a.business_version_id
       FROM (SELECT 1) seed
       LEFT JOIN LATERAL (
         SELECT artifact_id,business_version_id
           FROM finance_artifact_aliases
          WHERE organization_id = ? AND legacy_table = ? AND legacy_id = ?
          ORDER BY created_at DESC LIMIT 1
       ) a ON TRUE
     ON CONFLICT (organization_id,request_id,method,route_path,access_kind)
       WHERE request_id IS NOT NULL DO NOTHING`,
    [
      organizationId,
      requestId || null,
      userId,
      String(params.req.method || 'UNKNOWN').toUpperCase(),
      String(params.req.path || '/'),
      params.accessKind,
      params.protectedWriter?.successor || null,
      params.protectedWriter?.legacyTable || null,
      legacyId || null,
      organizationId,
      params.protectedWriter?.legacyTable || '',
      legacyId,
    ],
    { fallback: false }
  );
}

export async function financeLegacyCutoverGuard(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const protectedWriter = findProtectedFinanceLegacyWriter(req.method, req.path);
  const isWrite = !['GET', 'HEAD', 'OPTIONS'].includes(String(req.method || '').toUpperCase());

  if (protectedWriter && !financeLegacyWriterRollbackEnabled()) {
    try {
      await recordUsage({ req, accessKind: 'legacy_writer_blocked', protectedWriter });
    } catch (error) {
      logger.error('[FinanceCutover] Failed to persist blocked legacy writer telemetry', error);
    }
    res.status(410).json({
      success: false,
      code: 'FINANCE_LEGACY_WRITER_DISABLED',
      message: 'This legacy Finance writer has been cut over to the canonical V8 runtime.',
      successor: protectedWriter.successor,
      idBridge: '/api/v8/finance-v2/artifacts/resolve-legacy/financial_models/:legacyId',
      rollbackEnv: FINANCE_LEGACY_WRITER_ROLLBACK_ENV,
    });
    return;
  }

  const accessKind = protectedWriter
    ? 'rollback_writer'
    : isWrite
      ? 'legacy_uncovered_writer'
      : 'legacy_read';
  try {
    await recordUsage({ req, accessKind, protectedWriter });
  } catch (error) {
    // Telemetry never creates a second outage. The protected writer remains
    // fail-closed above even when telemetry storage is unavailable.
    logger.error('[FinanceCutover] Failed to persist legacy usage telemetry', error);
  }
  next();
}
