/* eslint-disable no-control-regex -- These middleware sanitizers intentionally reject ASCII control characters. */
/**
 * Optional JWT parse for rate-limit keying
 * Extracts and verifies JWT if present, sets req._rateLimitUserId so apiLimiter
 * can key by user instead of IP. This gives each authenticated user their own
 * quota instead of sharing 300 req/15min across all users behind one office IP.
 */
import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import type { VerifyOptions } from 'jsonwebtoken';

const MAX_JWT_STRING_CHARS = 8192;
const MAX_AUTHORIZATION_VALUE_SCAN_CHARS = MAX_JWT_STRING_CHARS + 256;
const MAX_JWS_SEGMENT_CHARS = 4096;
const MAX_RATE_LIMIT_USER_ID_CHARS = 256;
const MAX_AUTHORIZATION_HEADER_VALUES = 16;
const DISALLOWED_TOKEN_CHARS = /[\u0000-\u001F\u007F]/;
const COMPACT_JWS_TOKEN_BODY = /^[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+){2}$/;
const RATE_LIMIT_JWT_VERIFY_OPTIONS: VerifyOptions = {
  algorithms: ['HS256'],
  clockTolerance: 30,
};
const RATE_LIMIT_STRICT_JWT_FALLBACK_ENV = 'RATE_LIMIT_KEY_STRICT_JWT';

const isLikelyJwsCompact = (token: string): boolean => {
  const parts = token.split('.');
  return (
    parts.length === 3 &&
    parts.every((part) => part.length > 0 && part.length <= MAX_JWS_SEGMENT_CHARS)
  );
};

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
    if (authHeader.length <= MAX_AUTHORIZATION_VALUE_SCAN_CHARS) {
      const bearerToken = stripBearerPrefix(authHeader);
      if (bearerToken) return bearerToken;
      const normalizedHeaderToken = normalizeTokenCandidate(authHeader);
      if (normalizedHeaderToken) return normalizedHeaderToken;
    }
  }
  if (Array.isArray(authHeader)) {
    const valuesToScan = authHeader.slice(0, MAX_AUTHORIZATION_HEADER_VALUES);
    for (const headerValue of valuesToScan) {
      if (typeof headerValue !== 'string') continue;
      if (headerValue.length > MAX_AUTHORIZATION_VALUE_SCAN_CHARS) continue;
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
    const strictJwtFallback =
      normalizeTokenCandidate(
        safeRead(() => process.env[RATE_LIMIT_STRICT_JWT_FALLBACK_ENV], '')
      ) === '1';

    if (!token) return;
    if (token.length > MAX_JWT_STRING_CHARS) return;
    if (DISALLOWED_TOKEN_CHARS.test(token)) return;
    if (!isLikelyJwsCompact(token)) return;
    if (!COMPACT_JWS_TOKEN_BODY.test(token)) return;

    const assignUserId = (decoded: unknown) => {
      if (decoded === null || typeof decoded !== 'object' || Array.isArray(decoded)) return;
      const payload = decoded as Record<string, unknown>;
      const readOwnClaim = (key: 'id' | 'userId' | 'sub'): string | undefined => {
        if (!payload || !Object.hasOwn(payload, key)) return undefined;
        return normalizeTokenCandidate(safeRead(() => payload[key], undefined));
      };
      const candidate = readOwnClaim('id') || readOwnClaim('userId') || readOwnClaim('sub');
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
        assignUserId(jwt.verify(token, secret, RATE_LIMIT_JWT_VERIFY_OPTIONS));
      } else {
        assignUserId(safeRead(() => jwt.decode(token), null));
      }
    } catch {
      // Rate-limit partitioning should remain stable even for tokens that are no longer verifiable.
      // This fallback is only used to derive a per-user throttle key, not for authorization.
      if (!strictJwtFallback) {
        assignUserId(safeRead(() => jwt.decode(token), null));
      }
    }
  } catch {
    // Fail-open: rate limit keying fallback should never block request flow.
  } finally {
    next();
  }
}
