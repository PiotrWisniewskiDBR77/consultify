#!/usr/bin/env node
/**
 * Batch Service Migration Script
 * 
 * Creates TypeScript service files for all remaining JS services
 * This creates basic TypeScript wrappers that can be gradually migrated
 */

const fs = require('fs');
const path = require('path');

const SERVICES_DIR = path.join(__dirname, '../server/services');
const TARGET_DIR = path.join(__dirname, '../server/src/services');

// Services already migrated
const MIGRATED_SERVICES = [
    'BaseService',
    'ActivityService',
    'AuditLogService',
    'RefreshTokenService',
    'MFAService',
    'EmailVerificationService',
    'BillingService',
    'BillingWebhookService',
    'InvoiceService',
    'SubscriptionAnalyticsService'
];

function toPascalCase(str) {
    return str
        .split(/[-_]/)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join('');
}

function generateServiceWrapper(serviceName) {
    const className = toPascalCase(serviceName);
    const serviceVar = serviceName.replace(/-/g, '_');
    
    return `/**
 * ${className} Service
 * Enterprise SaaS Architecture - TypeScript Backend
 * 
 * Note: This is a TypeScript wrapper around the existing JS implementation
 * to maintain backward compatibility during migration.
 * TODO: Fully migrate to TypeScript with proper types
 */

import { createRequire } from 'module';
import logger from '../utils/Logger.js';

const require = createRequire(import.meta.url);

// Import the JS implementation for now (will be fully migrated later)
const ${serviceVar}ServiceJS = require('../../services/${serviceName}.js');

// Re-export all functions/properties from the JS service
// This maintains backward compatibility while providing TypeScript types
const ${serviceVar}Service = ${serviceVar}ServiceJS.default || ${serviceVar}ServiceJS;

// Export default instance (for backward compatibility)
export default ${serviceVar}Service;

// Also export named exports if they exist
if (typeof ${serviceVar}ServiceJS === 'object' && ${serviceVar}ServiceJS !== null) {
    Object.keys(${serviceVar}ServiceJS).forEach(key => {
        if (key !== 'default') {
            (exports as any)[key] = ${serviceVar}ServiceJS[key];
        }
    });
}
`;
}

// Recursively find all JS service files
function findServiceFiles(dir, baseDir = dir) {
    const files = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relativePath = path.relative(baseDir, fullPath);

        if (entry.isDirectory()) {
            // Skip certain directories
            if (entry.name === 'node_modules' || entry.name === '__mocks__' || entry.name === 'worldClassAI') {
                continue;
            }
            files.push(...findServiceFiles(fullPath, baseDir));
        } else if (entry.isFile() && entry.name.endsWith('.js') && !entry.name.endsWith('.test.js')) {
            files.push({
                fullPath,
                relativePath: relativePath.replace(/\\/g, '/'),
                name: entry.name.replace('.js', ''),
                dir: path.dirname(relativePath)
            });
        }
    }

    return files;
}

// Main migration function
function migrateServices() {
    if (!fs.existsSync(TARGET_DIR)) {
        fs.mkdirSync(TARGET_DIR, { recursive: true });
    }

    const serviceFiles = findServiceFiles(SERVICES_DIR);
    
    // Filter out already migrated services
    const servicesToMigrate = serviceFiles.filter(file => {
        const serviceName = file.name;
        return !MIGRATED_SERVICES.some(migrated => 
            serviceName.toLowerCase().includes(migrated.toLowerCase()) ||
            migrated.toLowerCase().includes(serviceName.toLowerCase())
        );
    });

    console.log(`Found ${servicesToMigrate.length} services to migrate`);

    let migrated = 0;
    let skipped = 0;
    let errors = 0;

    for (const service of servicesToMigrate) {
        try {
            // Determine target directory structure
            const targetSubDir = service.dir === '.' ? TARGET_DIR : path.join(TARGET_DIR, service.dir);
            if (!fs.existsSync(targetSubDir)) {
                fs.mkdirSync(targetSubDir, { recursive: true });
            }

            const tsServiceFile = path.join(targetSubDir, `${service.name}.ts`);

            // Skip if already exists
            if (fs.existsSync(tsServiceFile)) {
                skipped++;
                continue;
            }

            // Generate service wrapper
            const serviceContent = generateServiceWrapper(service.relativePath.replace('.js', ''));
            fs.writeFileSync(tsServiceFile, serviceContent);

            migrated++;
            if (migrated % 50 === 0) {
                console.log(`Migrated ${migrated} services...`);
            }
        } catch (error) {
            console.error(`Error migrating ${service.name}:`, error.message);
            errors++;
        }
    }

    console.log(`\nMigration complete:`);
    console.log(`  Migrated: ${migrated}`);
    console.log(`  Skipped: ${skipped}`);
    console.log(`  Errors: ${errors}`);
    console.log(`  Total: ${servicesToMigrate.length}`);
}

// Run migration
migrateServices();





