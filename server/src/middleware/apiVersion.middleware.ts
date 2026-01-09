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

// ==========================================
// MIDDLEWARE
// ==========================================

/**
 * Extract and validate API version from request
 */
export function apiVersionMiddleware(req: VersionedRequest, res: Response, next: NextFunction): void {
    try {
        // Priority: URL > Header > Query > Default
        let version = extractVersionFromUrl(req.path);

        if (!version) {
            version = req.headers[VERSION_HEADER] as string;
        }

        if (!version) {
            version = req.query.version as string;
        }

        if (!version) {
            version = CURRENT_VERSION;
        }

        // Normalize version
        const normalizedVersion = normalizeVersion(version);
        const versionInfo = API_VERSIONS[normalizedVersion];

        if (!versionInfo) {
            res.status(400).json({
                error: 'Invalid API version',
                message: `Unsupported API version: ${version}`,
                supportedVersions: Object.keys(API_VERSIONS).filter((v) => !v.includes('.')),
                currentVersion: LATEST_VERSION,
            });
            return;
        }

        // Attach version info to request
        req.apiVersion = versionInfo;

        // Set response header
        res.setHeader(API_VERSION_RESPONSE_HEADER, versionInfo.full);

        // Handle deprecated versions
        if (versionInfo.deprecated) {
            res.setHeader(DEPRECATION_HEADER, 'true');

            if (versionInfo.sunsetDate) {
                res.setHeader(SUNSET_HEADER, versionInfo.sunsetDate.toISOString());
            }

            logger.warn('[APIVersion] Deprecated version used', {
                version: versionInfo.full,
                path: req.path,
                sunsetDate: versionInfo.sunsetDate?.toISOString(),
            });
        }

        next();
    } catch (error) {
        logger.error('[APIVersion] Version extraction error:', error);
        next();
    }
}

/**
 * Require specific API version
 */
export function requireVersion(minVersion: string) {
    return (req: VersionedRequest, res: Response, next: NextFunction): void => {
        if (!req.apiVersion) {
            res.status(400).json({
                error: 'API version required',
                message: 'This endpoint requires explicit API version.',
            });
            return;
        }

        const minInfo = API_VERSIONS[normalizeVersion(minVersion)];
        if (!minInfo) {
            next();
            return;
        }

        if (compareVersions(req.apiVersion, minInfo) < 0) {
            res.status(400).json({
                error: 'API version too old',
                message: `This endpoint requires API version ${minVersion} or higher.`,
                yourVersion: req.apiVersion.full,
                requiredVersion: minInfo.full,
            });
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
        res.setHeader(DEPRECATION_HEADER, 'true');

        if (sunsetDate) {
            res.setHeader(SUNSET_HEADER, sunsetDate.toISOString());
        }

        // Add deprecation warning to response
        const originalJson = res.json.bind(res);
        res.json = function (body: unknown): Response {
            if (body && typeof body === 'object') {
                return originalJson({
                    ...body,
                    _deprecation: {
                        deprecated: true,
                        sunsetDate: sunsetDate?.toISOString(),
                        alternative: alternativeEndpoint,
                        message: 'This endpoint is deprecated and will be removed.',
                    },
                });
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
    const match = path.match(/\/api\/v(\d+(?:\.\d+(?:\.\d+)?)?)\//);
    return match ? match[1] : null;
}

/**
 * Normalize version string
 */
function normalizeVersion(version: string): string {
    // Remove 'v' prefix if present
    const cleaned = version.replace(/^v/i, '');

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




