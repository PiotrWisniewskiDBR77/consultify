import type { Request } from 'express';
import { ipKeyGenerator } from 'express-rate-limit';

const AUTHENTICATED_PROD_LIMIT = 1000;
const ANONYMOUS_PROD_LIMIT = 300;
const NON_PROD_LIMIT = 20000;
const STAGE_LIKE_AUTHENTICATED_LIMIT = 20000;

function isStageLikeRuntime(): boolean {
  const envName = String(
    process.env.APP_ENV ||
      process.env.RAILWAY_ENVIRONMENT_NAME ||
      process.env.RAILWAY_ENVIRONMENT ||
      ''
  ).toLowerCase();

  return /^(staging|stage|demo|preview|qa|test)$/.test(envName);
}

export function getApiLimiterLimit(req: Request, isProduction: boolean): number {
  const rateLimitUserId = (req as Request & { _rateLimitUserId?: string })._rateLimitUserId;
  if (!isProduction) return NON_PROD_LIMIT;
  if (rateLimitUserId && isStageLikeRuntime()) return STAGE_LIKE_AUTHENTICATED_LIMIT;
  return rateLimitUserId ? AUTHENTICATED_PROD_LIMIT : ANONYMOUS_PROD_LIMIT;
}

export function buildApiLimiterKey(req: Request): string {
  const rateLimitUserId = (req as Request & { _rateLimitUserId?: string })._rateLimitUserId;
  if (rateLimitUserId) return `api:v2:user:${rateLimitUserId}`;

  const ip =
    req.ip ||
    req.socket?.remoteAddress ||
    req.headers['x-forwarded-for']?.toString().split(',')[0].trim() ||
    req.headers['x-real-ip']?.toString() ||
    'unknown';

  const safeIpKey = ip !== 'unknown' ? ipKeyGenerator(ip, 56) : 'unknown';
  const key = `api:v2:ip:${safeIpKey}`;
  return key && key !== 'api:v2:ip:' ? key : 'api:v2:ip:unknown';
}
