/**
 * Deprecation Header Middleware
 *
 * Adds RFC 8594 Deprecation + Sunset headers to legacy API responses,
 * signaling to clients that they should migrate to V8 endpoints.
 *
 * Usage in Gateway.ts:
 *   app.use('/api/my-work', deprecationHeader('/api/v8/my-work'), legacyMyWorkRouter);
 */

import type { NextFunction, Request, Response } from 'express';

import logger from '../utils/Logger.js';

interface DeprecationOptions {
  v8Replacement: string;
  sunsetDate?: string;
  logFirstCall?: boolean;
}

const warned = new Set<string>();
const LINK_HEADER_MAX_CHARS = 4096;
const LINK_REL_SUFFIX = '>; rel="successor-version"';

const safeRead = <T>(reader: () => T, fallback: T): T => {
  try {
    return reader();
  } catch {
    return fallback;
  }
};

const safeSetHeader = (res: Response, key: string, value: string): void => {
  const alreadyCommitted = safeRead(() => {
    if (res.headersSent) return true;
    const writable = res as Response & { writableEnded?: boolean; writableFinished?: boolean };
    if (writable.writableEnded) return true;
    if (writable.writableFinished) return true;
    return false;
  }, true);
  if (alreadyCommitted) return;

  safeRead(() => {
    res.setHeader(key, value);
    return true;
  }, false);
};

const buildLinkHeader = (target: string): string => `<${target}${LINK_REL_SUFFIX}`;

export function deprecationHeader(v8Replacement: string, opts?: Partial<DeprecationOptions>) {
  const sunset = opts?.sunsetDate ?? '2026-09-01';
  const shouldLog = opts?.logFirstCall ?? true;
  const maxTargetChars = Math.max(0, LINK_HEADER_MAX_CHARS - ('<'.length + LINK_REL_SUFFIX.length));
  const successorPath = String(v8Replacement || '/').slice(0, maxTargetChars);
  const linkHeader = buildLinkHeader(successorPath);

  return (req: Request, res: Response, next: NextFunction) => {
    safeSetHeader(res, 'Deprecation', 'true');
    safeSetHeader(res, 'Sunset', new Date(sunset).toUTCString());
    safeSetHeader(res, 'Link', linkHeader);

    if (shouldLog) {
      const key = `${req.method} ${req.baseUrl}${req.path}`;
      if (!warned.has(key)) {
        warned.add(key);
        logger.info(
          `[Deprecation] First call to legacy route: ${key} → migrate to ${v8Replacement}`
        );
      }
    }

    next();
  };
}
