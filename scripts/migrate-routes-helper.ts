/**
 * Route Migration Helper
 * Utility script to help migrate JS routes to TypeScript
 *
 * Usage: This provides patterns and utilities for systematic route migration
 */

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

interface RouteMigrationConfig {
    sourceDir: string;
    targetDir: string;
    routeName: string;
}

/**
 * Generate TypeScript route file template
 */
export function generateRouteTemplate(config: RouteMigrationConfig): string {
    const { routeName } = config;
    const className = routeName.charAt(0).toUpperCase() + routeName.slice(1).replace(/-/g, '');

    return `/**
 * ${className} Routes
 * API endpoints for ${routeName}
 * 
 * Migrated from ${routeName}.js
 */

import { Router, Response } from 'express';
import { verifyToken, type AuthRequest } from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import { validateBody, validateParams, validateQuery } from '../middleware/validation.middleware';
// TODO: Import validators from '../validators/${routeName}.validators'

const router = Router();

// All routes require authentication
router.use(verifyToken);

// TODO: Add route handlers here

export default router;
`;
}

/**
 * Generate validator file template
 */
export function generateValidatorTemplate(routeName: string): string {
    return `/**
 * ${routeName} Validators
 * Zod schemas for ${routeName}-related endpoints
 */

import { z } from 'zod';

// TODO: Add Zod schemas here

export type CreateRequest = z.infer<typeof CreateRequestSchema>;
export type UpdateRequest = z.infer<typeof UpdateRequestSchema>;
`;
}

/**
 * Check if route is already migrated
 */
export function isRouteMigrated(routeName: string, targetDir: string): boolean {
    const tsFile = join(targetDir, `${routeName}.routes.ts`);
    return existsSync(tsFile);
}

/**
 * Extract route endpoints from JS file (basic pattern matching)
 */
export function extractEndpoints(jsContent: string): string[] {
    const endpoints: string[] = [];
    const routePattern = /router\.(get|post|put|delete|patch)\(['"]([^'"]+)['"]/g;
    let match;

    while ((match = routePattern.exec(jsContent)) !== null) {
        endpoints.push(`${match[1].toUpperCase()} ${match[2]}`);
    }

    return endpoints;
}


