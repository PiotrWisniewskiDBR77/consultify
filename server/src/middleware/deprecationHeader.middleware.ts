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
const WARNED_KEY_CAP = 2048;
const WARNED_KEY_MAX_CHARS = 512;
const SUNSET_INPUT_MAX_CHARS = 128;
const LINK_TARGET_MAX_CHARS = 2048;
const LINK_HEADER_MAX_CHARS = 4096;
const LINK_REL_SUFFIX = '>; rel="successor-version"';

const safeRead = <T>(reader: () => T, fallback: T): T => {
  try {
    return reader();
  } catch {
    return fallback;
  }
};

const normalizeOptionalString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  return normalized || undefined;
};
const stripControlChars = (value: string): string =>
  value.replace(/[\u0000-\u001F\u007F]/g, '');
const stripQueryAndHash = (value: string): string => value.split('?')[0]?.split('#')[0] || '';
const sanitizeLinkTargetPath = (value: string): string =>
  stripControlChars(value).replace(/ /g, '%20').replace(/[<>"\\]/g, '');

const evictWarnedKeysIfNeeded = (): void => {
  if (warned.size < WARNED_KEY_CAP) return;
  const toDelete = Math.floor(WARNED_KEY_CAP / 2);
  let deleted = 0;
  for (const key of warned) {
    warned.delete(key);
    deleted += 1;
    if (deleted >= toDelete) break;
  }
};

const safeSetHeader = (res: Response, key: string, value: string): void => {
  const getIsResponseCommitted = (): boolean => {
    const headersSentCommitted = safeRead(() => Boolean(res.headersSent), true);
    const writable = res as Response & { writableEnded?: boolean; writableFinished?: boolean };
    const writableEndedCommitted = safeRead(() => Boolean(writable.writableEnded), false);
    const writableFinishedCommitted = safeRead(() => Boolean(writable.writableFinished), false);
    return headersSentCommitted || writableEndedCommitted || writableFinishedCommitted;
  };
  if (getIsResponseCommitted()) return;
  safeRead(() => {
    res.setHeader(key, value);
    return true;
  }, false);
};

const safeSetOrAppendLinkHeader = (res: Response, linkValue: string): void => {
  const headersSentCommitted = safeRead(() => Boolean(res.headersSent), true);
  const writable = res as Response & { writableEnded?: boolean; writableFinished?: boolean };
  const writableEndedCommitted = safeRead(() => Boolean(writable.writableEnded), false);
  const writableFinishedCommitted = safeRead(() => Boolean(writable.writableFinished), false);
  const alreadyCommitted =
    headersSentCommitted || writableEndedCommitted || writableFinishedCommitted;
  if (alreadyCommitted) return;

  const rawExistingLinkHeader = safeRead(
    () => (res as Response & { getHeader?: (name: string) => unknown }).getHeader?.('Link'),
    undefined
  );
  const existingLinkHeader = Buffer.isBuffer(rawExistingLinkHeader)
    ? rawExistingLinkHeader.toString('utf8')
    : rawExistingLinkHeader;
  if (typeof existingLinkHeader === 'string' && existingLinkHeader.trim().length > 0) {
    const append = safeRead(
      () => (res as Response & { append?: unknown }).append,
      undefined
    );
    const appended =
      typeof append === 'function'
        ? safeRead(() => {
            (append as (name: string, value: string) => unknown).call(res, 'Link', linkValue);
            return true;
          }, false)
        : false;
    if (appended) {
      return;
    }
    safeRead(() => {
      const merged = `${existingLinkHeader}, ${linkValue}`;
      res.setHeader('Link', merged.length > LINK_HEADER_MAX_CHARS ? linkValue : merged);
      return true;
    }, false);
    return;
  }
  if (
    Array.isArray(existingLinkHeader) &&
    existingLinkHeader.every((entry) => typeof entry === 'string') &&
    existingLinkHeader.length > 0
  ) {
    safeRead(() => {
      const merged = [...existingLinkHeader, linkValue].join(', ');
      res.setHeader('Link', merged.length > LINK_HEADER_MAX_CHARS ? linkValue : merged);
      return true;
    }, false);
    return;
  }

  safeRead(() => {
    res.setHeader('Link', linkValue);
    return true;
  }, false);
};

export function deprecationHeader(v8Replacement: string, opts?: Partial<DeprecationOptions>) {
  const defaultSunset = '2026-09-01';
  const rawSunsetDate = normalizeOptionalString(opts?.sunsetDate);
  const sunset = stripControlChars(
    (rawSunsetDate && rawSunsetDate.slice(0, SUNSET_INPUT_MAX_CHARS)) || defaultSunset
  );
  const parsedSunset = new Date(sunset);
  const sunsetHeaderValue = Number.isNaN(parsedSunset.getTime())
    ? new Date(defaultSunset).toUTCString()
    : parsedSunset.toUTCString();
  let successorPath = sanitizeLinkTargetPath(normalizeOptionalString(v8Replacement) || '/').slice(
    0,
    LINK_TARGET_MAX_CHARS
  );
  if (
    successorPath.length > 0 &&
    !successorPath.startsWith('/') &&
    !/^https?:\/\//i.test(successorPath)
  ) {
    successorPath = `/${successorPath}`;
  }
  if (successorPath.startsWith('//')) {
    successorPath = '/';
  }
  const buildLinkHeader = (target: string): string => `<${target}${LINK_REL_SUFFIX}`;
  let linkHeader = buildLinkHeader(successorPath);
  if (linkHeader.length > LINK_HEADER_MAX_CHARS) {
    const maxTargetChars = Math.max(0, LINK_HEADER_MAX_CHARS - (`<`.length + LINK_REL_SUFFIX.length));
    successorPath = successorPath.slice(0, maxTargetChars);
    linkHeader = buildLinkHeader(successorPath);
  }
  const shouldLog = opts?.logFirstCall ?? true;

  return (req: Request, res: Response, next: NextFunction) => {
    safeSetHeader(res, 'Deprecation', 'true');
    safeSetHeader(res, 'Sunset', sunsetHeaderValue);
    safeSetOrAppendLinkHeader(res, linkHeader);

    if (shouldLog) {
      const method = stripControlChars(
        normalizeOptionalString(safeRead(() => req.method, undefined)) || 'UNKNOWN'
      );
      const baseUrl = stripControlChars(
        normalizeOptionalString(safeRead(() => req.baseUrl, undefined)) || ''
      );
      const path = stripControlChars(
        stripQueryAndHash(
          normalizeOptionalString(safeRead(() => req.path, undefined)) ||
            normalizeOptionalString(safeRead(() => req.originalUrl, undefined)) ||
            ''
        )
      );
      const key = `${method} ${baseUrl}${path}`.slice(0, WARNED_KEY_MAX_CHARS);
      if (!warned.has(key)) {
        const registered = safeRead(() => {
          evictWarnedKeysIfNeeded();
          warned.add(key);
          return true;
        }, false);
        if (registered && warned.has(key)) {
          safeRead(() => {
            logger.info(
              `[Deprecation] First call to legacy route: ${key} → migrate to ${successorPath}`
            );
            return true;
          }, false);
        }
      }
    }

    next();
  };
}
