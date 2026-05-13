/**
 * Optional JWT parse for rate-limit keying
 * Extracts and verifies JWT if present, sets req._rateLimitUserId so apiLimiter
 * can key by user instead of IP. This gives each authenticated user their own
 * quota instead of sharing 300 req/15min across all users behind one office IP.
 */
import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

const MAX_JWT_STRING_CHARS = 8192;
const MAX_RATE_LIMIT_USER_ID_CHARS = 256;
const DISALLOWED_TOKEN_CHARS = /[\u0000\r\n]/;

const normalizeTokenCandidate = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  return normalized || undefined;
};

const readRequestHeader = (req: Request, headerName: string): unknown => {
  try {
    return req.headers?.[headerName];
  } catch {
    return undefined;
  }
};

const safeRead = <T>(reader: () => T, fallback: T): T => {
  try {
    return reader();
  } catch {
    return fallback;
  }
};

const safeWrite = (writer: () => void): boolean => {
  try {
    writer();
    return true;
  } catch {
    return false;
  }
};

const extractToken = (req: Request): string | null => {
  const stripBearerPrefix = (value: string): string | undefined => {
    const normalizedValue = normalizeTokenCandidate(value);
    if (!normalizedValue) return undefined;
    const match = normalizedValue.match(/^Bearer\s+(.+)$/i);
    if (!match) return undefined;
    return normalizeTokenCandidate(match[1]);
  };
  const authHeader = readRequestHeader(req, 'authorization');
  if (typeof authHeader === 'string') {
    const bearerToken = stripBearerPrefix(authHeader);
    if (bearerToken) return bearerToken;
    const normalizedHeaderToken = normalizeTokenCandidate(authHeader);
    if (normalizedHeaderToken) return normalizedHeaderToken;
  }
  if (Array.isArray(authHeader)) {
    for (const headerValue of authHeader) {
      if (typeof headerValue !== 'string') continue;
      const bearerToken = stripBearerPrefix(headerValue);
      if (bearerToken) return bearerToken;
      const normalizedHeaderToken = normalizeTokenCandidate(headerValue);
      if (normalizedHeaderToken) return normalizedHeaderToken;
    }
  }

  let cookieToken: unknown;
  try {
    cookieToken =
      safeRead(() => (req as any).cookies?.access_token, undefined as unknown) ||
      safeRead(() => (req as any).cookies?.token, undefined as unknown);
  } catch {
    cookieToken = undefined;
  }
  const normalizedCookieToken = normalizeTokenCandidate(cookieToken);
  if (normalizedCookieToken) return normalizedCookieToken;
  return null;
};

declare module 'express-serve-static-core' {
  interface Request {
    _rateLimitUserId?: string;
  }
}

export function rateLimitUserIdMiddleware(req: Request, _res: Response, next: NextFunction): void {
  try {
    const token = safeRead(() => extractToken(req), null);
    const secret = normalizeTokenCandidate(
      safeRead(() => process.env.JWT_SECRET as string | undefined, undefined)
    );

    if (!token) return;
    if (token.length > MAX_JWT_STRING_CHARS) return;
    if (DISALLOWED_TOKEN_CHARS.test(token)) return;

    const assignUserId = (decoded: unknown) => {
      const payload =
        decoded && typeof decoded === 'object'
          ? (decoded as { id?: string; userId?: string; sub?: string })
          : null;
      const candidate =
        normalizeTokenCandidate(safeRead(() => payload?.id, undefined)) ||
        normalizeTokenCandidate(safeRead(() => payload?.userId, undefined)) ||
        normalizeTokenCandidate(safeRead(() => payload?.sub, undefined));
      if (
        candidate &&
        candidate.length <= MAX_RATE_LIMIT_USER_ID_CHARS &&
        !DISALLOWED_TOKEN_CHARS.test(candidate)
      ) {
        safeWrite(() => {
          req._rateLimitUserId = candidate;
        });
      }
    };

    try {
      if (secret) {
        assignUserId(jwt.verify(token, secret));
      } else {
        assignUserId(safeRead(() => jwt.decode(token), null));
      }
    } catch {
      // Rate-limit partitioning should remain stable even for tokens that are no longer verifiable.
      // This fallback is only used to derive a per-user throttle key, not for authorization.
      assignUserId(safeRead(() => jwt.decode(token), null));
    }
  } catch {
    // Fail-open: rate limit keying fallback should never block request flow.
  } finally {
    next();
  }
}
