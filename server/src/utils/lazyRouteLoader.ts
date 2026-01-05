/**
 * Lazy Route Loader Utility
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Utility for lazy-loading ES module routes to replace createRequire() wrappers
 */

import { NextFunction, Request, Response, Router } from 'express';

import logger from './Logger.js';

interface RouteModule {
    default?: unknown;
    [key: string]: unknown;
}

/**
 * Create a lazy-loaded route wrapper
 */
export function createLazyRoute(routePath: string): Router {
    const router = Router();
    let routeModule: RouteModule | null = null;

    async function loadRoute() {
        if (!routeModule) {
            routeModule = await import(routePath);
        }
        return routeModule;
    }

    // Apply routes lazily on first request
    router.use(async (req: Request, res: Response, next: NextFunction) => {
        try {
            const routes = await loadRoute();
            if (!routes) {
                return next(new Error('Failed to load routes'));
            }
            const routesHandler = routes.default || routes;

            if (typeof routesHandler === 'function') {
                return (routesHandler as (req: Request, res: Response, next: NextFunction) => void)(req, res, next);
            } else if (routesHandler && typeof (routesHandler as { use: unknown }).use === 'function') {
                return (routesHandler as { use: (req: Request, res: Response, next: NextFunction) => void }).use(
                    req,
                    res,
                    next,
                );
            }
            next();
        } catch (error: unknown) {
            logger.error(`[LazyRoute] Error loading route from ${routePath}:`, error);
            res.status(500).json({ error: 'Failed to load route' });
        }
    });

    return router;
}
