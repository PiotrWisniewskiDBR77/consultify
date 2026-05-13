/**
 * API Versioning Middleware
 * Enterprise SaaS Architecture - API Management
 *
 * Implements API versioning strategy:
 * - Header-based versioning (X-API-Version)
 * - URL-based versioning (/api/v1/, /api/v2/)
 * - Query parameter fallback (?version=1)
 * - Deprecation warnings
 *
 * Strategy: Semantic versioning with major versions in URL
 *
 * Usage:
 * - Current: /api/* (v1, default)
 * - Future: /api/v2/* (breaking changes)
 *
 * Backward Compatibility:
 * - Old versions supported for 12 months after deprecation
 * - Sunset header indicates end-of-life date
 */

import { NextFunction, Request, Response } from 'express';

import logger from '../utils/Logger.js';

// ==========================================
// TYPES
// ==========================================

export interface ApiVersionInfo {
  major: number;
  minor: number;
  patch: number;
  full: string;
  deprecated: boolean;
  sunsetDate: Date | null;
}

interface VersionedRequest extends Request {
  apiVersion?: ApiVersionInfo;
}

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

const coerceVersionInput = (value: unknown): string | undefined => {
  if (typeof value === 'string') return normalizeOptionalString(value);
  if (Array.isArray(value)) {
    for (const item of value) {
      const normalized = normalizeOptionalString(item);
      if (normalized) return normalized;
    }
  }
  return undefined;
};

const safeSetHeader = (res: Response, name: string, value: string): void => {
  safeRead(() => {
    res.setHeader(name, value);
    return true;
  }, false);
};

// ==========================================
// CONFIGURATION
// ==========================================

// Supported API versions
export const API_VERSIONS: Record<string, ApiVersionInfo> = {
  '1': {
    major: 1,
    minor: 0,
    patch: 0,
    full: '1.0.0',
    deprecated: false,
    sunsetDate: null,
  },
  '1.0': {
    major: 1,
    minor: 0,
    patch: 0,
    full: '1.0.0',
    deprecated: false,
    sunsetDate: null,
  },
  '1.0.0': {
    major: 1,
    minor: 0,
    patch: 0,
    full: '1.0.0',
    deprecated: false,
    sunsetDate: null,
  },
  // Future version (example)
  // '2': {
  //     major: 2,
  //     minor: 0,
  //     patch: 0,
  //     full: '2.0.0',
  //     deprecated: false,
  //     sunsetDate: null,
  // },
};

// Current default version
export const CURRENT_VERSION = '1';
export const LATEST_VERSION = '1.0.0';

// Deprecation notice period (months)
const DEPRECATION_NOTICE_MONTHS = 6;
const SUNSET_PERIOD_MONTHS = 12;

// Headers
const VERSION_HEADER = 'x-api-version';
const DEPRECATION_HEADER = 'deprecation';
const SUNSET_HEADER = 'sunset';
const API_VERSION_RESPONSE_HEADER = 'x-api-version';
const MAX_VERSION_ECHO_CHARS = 64;
const MAX_VERSION_INPUT_CHARS = 256;
const MAX_HEADER_VALUE_CHARS = 128;
const MAX_PATH_CHARS_FOR_VERSION_URL_PARSE = 8192;
const MAX_LOG_PATH_CHARS = 512;
const MAX_SUPPORTED_VERSIONS_IN_ERROR = 32;
const MAX_API_VERSION_ERROR_LOG_DETAIL_CHARS = 256;

const formatVersionForError = (value: unknown): string => {
  const normalized = String(value ?? '');
  if (normalized.length <= MAX_VERSION_ECHO_CHARS) return normalized;
  return `${normalized.slice(0, MAX_VERSION_ECHO_CHARS)}...`;
};

const clampVersionInput = (value: string): string =>
  value.length > MAX_VERSION_INPUT_CHARS ? value.slice(0, MAX_VERSION_INPUT_CHARS) : value;
const stripAsciiControlChars = (value: string): string => value.replace(/[\u0000-\u001F\u007F]/g, '');
const sanitizeHeaderValue = (value: string): string =>
  value.replace(/[\r\n\0]/g, '').slice(0, MAX_HEADER_VALUE_CHARS);
const sanitizeVersionTokenForPayload = (value: string): string => sanitizeHeaderValue(value);
const truncateLogPath = (value: string): string =>
  value.length > MAX_LOG_PATH_CHARS ? `${value.slice(0, MAX_LOG_PATH_CHARS)}...` : value;
const getSupportedMajorVersionsForError = (): string[] =>
  Object.keys(API_VERSIONS)
    .filter((v) => !v.includes('.'))
    .slice(0, MAX_SUPPORTED_VERSIONS_IN_ERROR);

const applyNoStoreHeaders = (res: Response): void => {
  safeSetHeader(res, 'Cache-Control', 'no-store');
  safeSetHeader(res, 'Pragma', 'no-cache');
};

const safeStatusJson = (
  res: Response,
  statusCode: number,
  payload: Record<string, unknown>
): boolean =>
  safeRead(() => {
    res.status(statusCode).json(payload);
    return true;
  }, false);

const formatDateToIsoOrUndefined = (value: Date | null | undefined): string | undefined => {
  if (!(value instanceof Date)) return undefined;
  if (!Number.isFinite(value.getTime())) return undefined;
  return safeRead(() => value.toISOString(), undefined as string | undefined);
};
const formatErrorForLog = (error: unknown): string => {
  const rawDetail = (() => {
    if (error instanceof Error) return `${error.name}: ${error.message}`;
    return String(error);
  })();
  return rawDetail.replace(/[\r\n\0]/g, ' ').slice(0, MAX_API_VERSION_ERROR_LOG_DETAIL_CHARS);
};
const isPlainJsonObject = (value: unknown): value is Record<string, unknown> => {
  if (value == null || typeof value !== 'object' || Array.isArray(value)) return false;
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(value)) return false;
  if (value instanceof Date) return false;
  const prototype = safeRead(() => Object.getPrototypeOf(value), null as object | null);
  return prototype === Object.prototype || prototype === null;
};

// ==========================================
// MIDDLEWARE
// ==========================================

/**
 * Extract and validate API version from request
 */
export function apiVersionMiddleware(
  req: VersionedRequest,
  res: Response,
  next: NextFunction
): void {
  try {
    // Priority: URL > Header > Query > Default
    let version = extractVersionFromUrl(
      normalizeOptionalString(safeRead(() => req.path, undefined)) ||
        normalizeOptionalString(safeRead(() => req.originalUrl, undefined)) ||
        ''
    );

    if (!version) {
      version =
        coerceVersionInput(
          safeRead(() => req.headers?.[VERSION_HEADER] as string | string[] | undefined, undefined)
        ) || '';
    }

    if (!version) {
      version =
        coerceVersionInput(
          safeRead(() => (req.query as Record<string, unknown> | undefined)?.version, undefined)
        ) || '';
    }

    if (!version) {
      version = CURRENT_VERSION;
    }

    // Normalize version
    const normalizedVersion = normalizeVersion(stripAsciiControlChars(clampVersionInput(version)));
    const versionInfo = API_VERSIONS[normalizedVersion];

    if (!versionInfo) {
      const headersAlreadySent = safeRead(() => res.headersSent, false);
      if (headersAlreadySent) {
        logger.warn('[APIVersion] Invalid version but response already started', {
          requestedVersion: String(version).slice(0, 64),
        });
        safeRead(() => {
          next();
          return true;
        }, false);
        return;
      }
      applyNoStoreHeaders(res);
      if (
        !safeStatusJson(res, 400, {
        error: 'Invalid API version',
        message: `Unsupported API version: ${formatVersionForError(version)}`,
        supportedVersions: getSupportedMajorVersionsForError(),
        currentVersion: sanitizeVersionTokenForPayload(LATEST_VERSION),
        })
      ) {
        logger.warn('[APIVersion] Failed to send invalid version response body', {
          requestedVersion: String(version).slice(0, 64),
        });
      }
      return;
    }

    // Attach version info to request
    req.apiVersion = versionInfo;

    // Set response header
    safeSetHeader(res, API_VERSION_RESPONSE_HEADER, sanitizeHeaderValue(versionInfo.full));

    // Handle deprecated versions
    if (versionInfo.deprecated) {
      safeSetHeader(res, DEPRECATION_HEADER, 'true');

      const sunsetIso = formatDateToIsoOrUndefined(versionInfo.sunsetDate);
      if (sunsetIso) {
        safeSetHeader(res, SUNSET_HEADER, sanitizeHeaderValue(sunsetIso));
      }

      logger.warn('[APIVersion] Deprecated version used', {
        version: versionInfo.full,
        path: truncateLogPath(
          normalizeOptionalString(safeRead(() => req.path, undefined)) ||
            normalizeOptionalString(safeRead(() => req.originalUrl, undefined)) ||
            ''
        ),
        sunsetDate: sunsetIso,
      });
    }

    next();
  } catch (error) {
    logger.error('[APIVersion] Version extraction error', {
      detail: formatErrorForLog(error),
    });
    const nextSucceeded = safeRead(() => {
      next();
      return true;
    }, false);
    if (!nextSucceeded) {
      logger.warn('[APIVersion] Failed to invoke next after extraction error', {
        detail: formatErrorForLog(error),
      });
    }
  }
}

/**
 * Require specific API version
 */
export function requireVersion(minVersion: string) {
  return (req: VersionedRequest, res: Response, next: NextFunction): void => {
    if (!req.apiVersion) {
      if (safeRead(() => res.headersSent, false)) {
        logger.warn('[APIVersion] requireVersion blocked write; headers already sent', {
          reason: 'missing_api_version',
        });
        safeRead(() => {
          next();
          return true;
        }, false);
        return;
      }
      applyNoStoreHeaders(res);
      if (
        !safeStatusJson(res, 400, {
        error: 'API version required',
        message: 'This endpoint requires explicit API version.',
        })
      ) {
        logger.warn('[APIVersion] Failed to send missing api version response body');
      }
      return;
    }

    const normalizedMinVersionInput = stripAsciiControlChars(clampVersionInput(String(minVersion ?? '')));
    const minInfo = API_VERSIONS[normalizeVersion(normalizedMinVersionInput)];
    if (!minInfo) {
      next();
      return;
    }

    if (compareVersions(req.apiVersion, minInfo) < 0) {
      if (safeRead(() => res.headersSent, false)) {
        logger.warn('[APIVersion] requireVersion blocked write; headers already sent', {
          reason: 'api_version_too_old',
          requiredVersion: minInfo.full,
          currentVersion: req.apiVersion.full,
        });
        safeRead(() => {
          next();
          return true;
        }, false);
        return;
      }
      applyNoStoreHeaders(res);
      if (
        !safeStatusJson(res, 400, {
        error: 'API version too old',
        message: `This endpoint requires API version ${formatVersionForError(
          normalizedMinVersionInput
        )} or higher.`,
        yourVersion: sanitizeVersionTokenForPayload(req.apiVersion.full),
        requiredVersion: sanitizeVersionTokenForPayload(minInfo.full),
        })
      ) {
        logger.warn('[APIVersion] Failed to send outdated api version response body', {
          requiredVersion: minInfo.full,
          currentVersion: req.apiVersion.full,
        });
      }
      return;
    }

    next();
  };
}

/**
 * Mark endpoint as deprecated
 */
export function deprecatedEndpoint(sunsetDate?: Date, alternativeEndpoint?: string) {
  return (_req: Request, res: Response, next: NextFunction): void => {
    safeSetHeader(res, DEPRECATION_HEADER, 'true');
    const sunsetIso = formatDateToIsoOrUndefined(sunsetDate);

    if (sunsetIso) {
      safeSetHeader(res, SUNSET_HEADER, sanitizeHeaderValue(sunsetIso));
    }

    // Add deprecation warning to response
    const originalJson = safeRead(() => res.json.bind(res), null as unknown as Response['json']);
    if (!originalJson) {
      next();
      return;
    }
    const trimmedAlternative =
      typeof alternativeEndpoint === 'string' ? alternativeEndpoint.trim() : '';
    const sanitizedAlternative = trimmedAlternative
      ? sanitizeHeaderValue(trimmedAlternative)
      : '';
    const safeAlternative = sanitizedAlternative || undefined;
    res.json = function (body: unknown): Response {
      if (isPlainJsonObject(body)) {
        try {
          return originalJson({
            ...body,
            _deprecation: {
              deprecated: true,
              sunsetDate: sunsetIso,
              ...(safeAlternative ? { alternative: safeAlternative } : {}),
              message: 'This endpoint is deprecated and will be removed.',
            },
          });
        } catch {
          logger.warn(
            '[APIVersion] deprecatedEndpoint failed to attach deprecation metadata; sending original body'
          );
          return originalJson(body);
        }
      }
      return originalJson(body);
    };

    next();
  };
}

// ==========================================
// UTILITY FUNCTIONS
// ==========================================

/**
 * Extract version from URL path
 * Supports: /api/v1/*, /api/v2/*
 */
function extractVersionFromUrl(path: string): string | null {
  const pathForScan =
    path.length > MAX_PATH_CHARS_FOR_VERSION_URL_PARSE
      ? path.slice(0, MAX_PATH_CHARS_FOR_VERSION_URL_PARSE)
      : path;
  const match = pathForScan.match(/\/api\/v(\d+(?:\.\d+(?:\.\d+)?)?)\//);
  return match ? match[1] : null;
}

/**
 * Normalize version string
 */
function normalizeVersion(version: string): string {
  // Remove 'v' prefix if present
  const rawNormalized = normalizeOptionalString(String(version || '')) || '';
  const cleaned = rawNormalized.replace(/^v/i, '');
  if (!cleaned) return '';

  // Return as-is if it's a known format
  if (API_VERSIONS[cleaned]) {
    return cleaned;
  }

  // Try major version only
  const major = cleaned.split('.')[0];
  return major;
}

/**
 * Compare two versions
 * Returns: -1 if a < b, 0 if a == b, 1 if a > b
 */
function compareVersions(a: ApiVersionInfo, b: ApiVersionInfo): number {
  if (a.major !== b.major) return a.major - b.major;
  if (a.minor !== b.minor) return a.minor - b.minor;
  return a.patch - b.patch;
}

/**
 * Create a versioned route path
 */
export function versionedPath(version: number, path: string): string {
  return `/api/v${version}${path}`;
}

/**
 * Get version info for documentation
 */
export function getVersionInfo(): {
  current: string;
  latest: string;
  supported: string[];
  deprecated: string[];
} {
  const supported: string[] = [];
  const deprecated: string[] = [];

  for (const [version, info] of Object.entries(API_VERSIONS)) {
    // Only include major versions
    if (!version.includes('.')) {
      if (info.deprecated) {
        deprecated.push(version);
      } else {
        supported.push(version);
      }
    }
  }

  return {
    current: CURRENT_VERSION,
    latest: LATEST_VERSION,
    supported,
    deprecated,
  };
}

// ==========================================
// EXPORTS
// ==========================================

export default {
  apiVersionMiddleware,
  requireVersion,
  deprecatedEndpoint,
  versionedPath,
  getVersionInfo,
  API_VERSIONS,
  CURRENT_VERSION,
  LATEST_VERSION,
};
