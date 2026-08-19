import type { NextFunction, Request, Response } from 'express';

import * as DbPromise from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';

type ProtectedLegacyWriter = {
  method: string;
  path: RegExp;
  successor: string;
};

export const PARTNER_LEGACY_WRITER_ROLLBACK_ENV = 'PARTNER_LEGACY_ROLLBACK_ENABLED';

export const PROTECTED_PARTNER_LEGACY_WRITERS: ProtectedLegacyWriter[] = [
  { method: 'POST', path: /^\/connect\/?$/, successor: '/api/v8/partner/connect' },
  { method: 'POST', path: /^\/payouts\/request\/?$/, successor: '/api/v8/partner/payouts/request' },
  { method: 'POST', path: /^\/campaign-links\/?$/, successor: '/api/v8/partner/campaign-links' },
  {
    method: 'DELETE',
    path: /^\/campaign-links\/[^/]+\/?$/,
    successor: '/api/v8/partner/campaign-links/:linkId',
  },
  { method: 'PUT', path: /^\/organization\/?$/, successor: '/api/v8/partner/organization' },
  {
    method: 'PUT',
    path: /^\/organization\/specializations\/?$/,
    successor: '/api/v8/partner/organization/specializations',
  },
  {
    method: 'PUT',
    path: /^\/organization\/regions\/?$/,
    successor: '/api/v8/partner/organization/regions',
  },
  {
    method: 'PUT',
    path: /^\/organization\/listing\/?$/,
    successor: '/api/v8/partner/organization/listing',
  },
  {
    method: 'PUT',
    path: /^\/payout-settings\/?$/,
    successor: '/api/v8/partner/payout-settings',
  },
  {
    method: 'POST',
    path: /^\/certifications\/[^/]+\/modules\/[^/]+\/progress\/?$/,
    successor: '/api/v8/partner/certifications/:certId/modules/:moduleId/progress',
  },
  {
    method: 'POST',
    path: /^\/certifications\/[^/]+\/exam\/start\/?$/,
    successor: '/api/v8/partner/certifications/:certId/exam/start',
  },
  {
    method: 'POST',
    path: /^\/certifications\/[^/]+\/exam\/submit\/?$/,
    successor: '/api/v8/partner/certifications/:certId/exam/submit',
  },
];

export function partnerLegacyRollbackEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env[PARTNER_LEGACY_WRITER_ROLLBACK_ENV] === 'true';
}

export function findProtectedPartnerLegacyWriter(
  method: string,
  path: string
): ProtectedLegacyWriter | null {
  const normalizedMethod = String(method || '').toUpperCase();
  const normalizedPath = String(path || '').split('?')[0] || '/';
  return (
    PROTECTED_PARTNER_LEGACY_WRITERS.find(
      (entry) => entry.method === normalizedMethod && entry.path.test(normalizedPath)
    ) || null
  );
}

async function recordUsage(params: {
  req: Request;
  accessKind:
    | 'legacy_read'
    | 'legacy_uncovered_writer'
    | 'legacy_writer_blocked'
    | 'rollback_writer';
  successorPath?: string | null;
}): Promise<void> {
  const userId = String((params.req as any).user?.id || (params.req as any).userId || '').trim();
  const requestId = String(params.req.headers['x-request-id'] || '').trim();
  await DbPromise.run(
    `INSERT INTO partner_legacy_usage_events
       (request_id,user_id,method,route_path,access_kind,successor_path)
     VALUES (?,?,?,?,?,?)`,
    [
      requestId || null,
      userId || null,
      String(params.req.method || 'UNKNOWN').toUpperCase(),
      String(params.req.path || '/'),
      params.accessKind,
      params.successorPath || null,
    ],
    { fallback: false }
  );
}

export async function partnerLegacyCutoverGuard(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const protectedWriter = findProtectedPartnerLegacyWriter(req.method, req.path);
  const isWrite = !['GET', 'HEAD', 'OPTIONS'].includes(String(req.method || '').toUpperCase());

  if (protectedWriter && !partnerLegacyRollbackEnabled()) {
    try {
      await recordUsage({
        req,
        accessKind: 'legacy_writer_blocked',
        successorPath: protectedWriter.successor,
      });
    } catch (error) {
      logger.error('[PartnerCutover] Failed to persist blocked legacy writer telemetry', error);
    }
    res.status(410).json({
      success: false,
      code: 'PARTNER_LEGACY_WRITER_DISABLED',
      message: 'This legacy Partner writer has been cut over to V8.',
      successor: protectedWriter.successor,
      rollbackEnv: PARTNER_LEGACY_WRITER_ROLLBACK_ENV,
    });
    return;
  }

  const accessKind = protectedWriter
    ? 'rollback_writer'
    : isWrite
      ? 'legacy_uncovered_writer'
      : 'legacy_read';
  try {
    await recordUsage({ req, accessKind, successorPath: protectedWriter?.successor });
  } catch (error) {
    // Reads and not-yet-covered endpoints retain availability while telemetry
    // rollout is repaired. A protected writer is still blocked above even if
    // its audit insert failed.
    logger.error('[PartnerCutover] Failed to persist legacy usage telemetry', error);
  }
  next();
}
