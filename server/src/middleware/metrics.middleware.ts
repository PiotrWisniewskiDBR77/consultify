/**
 * Metrics Middleware
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Collects HTTP metrics for Prometheus
 * Integrates with performanceMetricsMiddleware
 */

import type { NextFunction, Request, Response } from 'express';

import { getMetricsService } from '../services/MetricsService.js';

// ==========================================
// MIDDLEWARE
// ==========================================

/**
 * Metrics collection middleware
 * Records HTTP request metrics for Prometheus
 */
export function metricsMiddleware(req: Request, res: Response, next: NextFunction): void {
    const startTime = Date.now();
    const metricsService = getMetricsService();

    // Normalize route (remove IDs, query params)
    const route = normalizeRoute(req.path);

    // Record response finish
    res.on('finish', () => {
        const duration = (Date.now() - startTime) / 1000; // Convert to seconds
        const method = req.method;
        const statusCode = res.statusCode;

        // Record metrics
        metricsService.recordHttpRequest(method, route, statusCode, duration);

        // Record by organization if available
        const orgId = (req as any).user?.organizationId || (req as any).organizationId;
        if (orgId) {
            metricsService.recordApiRequestByOrg(orgId);
        }
    });

    next();
}

/**
 * Normalize route path for metrics
 * Removes IDs and query parameters to group similar routes
 */
function normalizeRoute(path: string): string {
    // Remove UUIDs (8-4-4-4-12 format)
    let normalized = path.replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:id');

    // Remove other numeric IDs
    normalized = normalized.replace(/\/\d+/g, '/:id');

    // Remove query parameters
    normalized = normalized.split('?')[0];

    // Limit length to avoid cardinality explosion
    if (normalized.length > 100) {
        normalized = normalized.substring(0, 100);
    }

    return normalized || '/';
}

export default metricsMiddleware;



