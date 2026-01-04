#!/usr/bin/env node
/**
 * Batch Route Migration Script
 * 
 * Creates TypeScript route files for all remaining JS routes
 * This creates basic TypeScript wrappers that can be gradually migrated
 */

const fs = require('fs');
const path = require('path');

const ROUTES_DIR = path.join(__dirname, '../server/routes');
const TARGET_DIR = path.join(__dirname, '../server/src/routes');
const VALIDATORS_DIR = path.join(__dirname, '../server/src/validators');

// Routes already migrated
const MIGRATED_ROUTES = ['auth', 'billing', 'ai', 'projects'];

function toPascalCase(str) {
    return str
        .split(/[-_]/)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join('');
}

function generateRouteWrapper(routeName) {
    const className = toPascalCase(routeName);
    const routeVar = routeName.replace(/-/g, '_');
    
    return `/**
 * ${className} Routes
 * API endpoints for ${routeName}
 * 
 * Note: This is a TypeScript wrapper around the existing JS implementation
 * to maintain backward compatibility during migration.
 * TODO: Fully migrate to TypeScript
 */

import { Router } from 'express';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

// Import the JS implementation for now (will be fully migrated later)
const ${routeVar}RoutesJS = require('../../routes/${routeName}.js');

// Create router and apply JS routes
const router = Router();

// Re-export the JS router (maintains backward compatibility)
// The JS route file exports a router that we can use directly
if (typeof ${routeVar}RoutesJS === 'function') {
    // If it's a router function, use it
    router.use(${routeVar}RoutesJS);
} else if (${routeVar}RoutesJS.default) {
    // If it has a default export
    router.use(${routeVar}RoutesJS.default);
} else {
    // If it's the router itself
    router.use(${routeVar}RoutesJS);
}

export default router;
`;
}

function generateValidatorTemplate(routeName) {
    const className = toPascalCase(routeName);
    
    return `/**
 * ${className} Validators
 * Zod schemas for ${routeName}-related endpoints
 * 
 * TODO: Add Zod schemas as routes are migrated
 */

import { z } from 'zod';

// Placeholder - validators will be added here as routes are migrated
export {};
`;
}

// Main migration function
function migrateRoutes() {
    if (!fs.existsSync(TARGET_DIR)) {
        fs.mkdirSync(TARGET_DIR, { recursive: true });
    }
    
    if (!fs.existsSync(VALIDATORS_DIR)) {
        fs.mkdirSync(VALIDATORS_DIR, { recursive: true });
    }

    const jsFiles = fs.readdirSync(ROUTES_DIR)
        .filter(file => file.endsWith('.js') && !file.includes('webhooks'))
        .map(file => file.replace('.js', ''))
        .filter(name => !MIGRATED_ROUTES.includes(name));

    console.log(`Found ${jsFiles.length} routes to migrate`);

    let migrated = 0;
    let skipped = 0;

    for (const routeName of jsFiles) {
        const tsRouteFile = path.join(TARGET_DIR, `${routeName}.routes.ts`);
        const validatorFile = path.join(VALIDATORS_DIR, `${routeName}.validators.ts`);

        // Skip if already exists
        if (fs.existsSync(tsRouteFile)) {
            console.log(`Skipping ${routeName} - already exists`);
            skipped++;
            continue;
        }

        // Generate route wrapper
        const routeContent = generateRouteWrapper(routeName);
        fs.writeFileSync(tsRouteFile, routeContent);

        // Generate validator template if doesn't exist
        if (!fs.existsSync(validatorFile)) {
            const validatorContent = generateValidatorTemplate(routeName);
            fs.writeFileSync(validatorFile, validatorContent);
        }

        migrated++;
        console.log(`Migrated ${routeName}`);
    }

    console.log(`\nMigration complete:`);
    console.log(`  Migrated: ${migrated}`);
    console.log(`  Skipped: ${skipped}`);
    console.log(`  Total: ${jsFiles.length}`);
}

// Run migration
migrateRoutes();






