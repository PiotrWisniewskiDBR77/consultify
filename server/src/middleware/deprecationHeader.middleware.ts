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

export function deprecationHeader(v8Replacement: string, opts?: Partial<DeprecationOptions>) {
  const sunset = opts?.sunsetDate ?? '2026-09-01';
  const shouldLog = opts?.logFirstCall ?? true;

  return (req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Deprecation', 'true');
    res.setHeader('Sunset', new Date(sunset).toUTCString());
    res.setHeader('Link', `<${v8Replacement}>; rel="successor-version"`);

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
