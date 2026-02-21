/**
 * Optional JWT parse for rate-limit keying
 * Extracts and verifies JWT if present, sets req._rateLimitUserId so apiLimiter
 * can key by user instead of IP. This gives each authenticated user their own
 * quota instead of sharing 300 req/15min across all users behind one office IP.
 */
import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

const extractToken = (req: Request): string | null => {
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) return authHeader.slice(7);
  if (authHeader) return authHeader;
  const cookieToken = (req as any).cookies?.access_token || (req as any).cookies?.token;
  if (typeof cookieToken === 'string' && cookieToken.length > 0) return cookieToken;
  return null;
};

declare module 'express-serve-static-core' {
  interface Request {
    _rateLimitUserId?: string;
  }
}

export function rateLimitUserIdMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const token = extractToken(req);
  const secret = process.env.JWT_SECRET;

  if (!token || !secret) return next();

  try {
    const decoded = jwt.verify(token, secret) as { id?: string };
    if (decoded?.id) req._rateLimitUserId = decoded.id;
  } catch {
    // Invalid/expired token - continue without user (will fall back to IP)
  }
  next();
}
