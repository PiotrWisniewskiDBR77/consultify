#!/usr/bin/env node
/**
 * Script to show migration batch status
 * Displays progress, completed services, and remaining work
 */

const fs = require('fs');
const path = require('path');

const servicesDir = path.join(__dirname, '..', 'server', 'src', 'services');
const categorizationFile = path.join(__dirname, '..', 'wrapper-categorization.json');

function checkServiceMigrated(filename) {
    const filepath = path.join(servicesDir, filename);
    if (!fs.existsSync(filepath)) return false;
    
    const content = fs.readFileSync(filepath, 'utf-8');
    const hasCreateRequire = /createRequire/.test(content);
    const hasMigratedCode = /export class\s+\w+|export const \w+\s*=\s*new|^const \w+\s*=\s*new/.test(content);
    
    return !hasCreateRequire && hasMigratedCode;
}

function getMigrationStatus() {
    const allServices = fs.readdirSync(servicesDir)
        .filter(f => f.endsWith('.ts'))
        .map(f => ({
            filename: f,
            migrated: checkServiceMigrated(f)
        }));
    
    const wrappers = allServices.filter(s => {
        const filepath = path.join(servicesDir, s.filename);
        const content = fs.readFileSync(filepath, 'utf-8');
        return /createRequire|require\(.*\.js\)/.test(content);
    });
    
    return {
        total: allServices.length,
        wrappers: wrappers.length,
        migrated: allServices.filter(s => s.migrated).length,
        remaining: wrappers.length
    };
}

function loadCategorization() {
    if (!fs.existsSync(categorizationFile)) {
        return null;
    }
    return JSON.parse(fs.readFileSync(categorizationFile, 'utf-8'));
}

// Main execution
const status = getMigrationStatus();
const categorization = loadCategorization();

console.log('=== Migration Status ===\n');
console.log(`Total services: ${status.total}`);
console.log(`Wrapper services: ${status.wrappers}`);
console.log(`Migrated: ${status.migrated}`);
console.log(`Remaining: ${status.remaining}`);
console.log(`Progress: ${((status.migrated / status.wrappers) * 100).toFixed(1)}%\n`);

if (categorization && categorization.batches) {
    console.log('=== Batch Status ===\n');
    
    let totalInBatches = 0;
    let migratedInBatches = 0;
    
    Object.keys(categorization.batches).sort().forEach(batchName => {
        const batch = categorization.batches[batchName];
        const migrated = batch.services.filter(s => checkServiceMigrated(s)).length;
        const remaining = batch.services.length - migrated;
        
        totalInBatches += batch.services.length;
        migratedInBatches += migrated;
        
        const progress = ((migrated / batch.services.length) * 100).toFixed(0);
        const statusIcon = migrated === batch.services.length ? '✅' : migrated > 0 ? '🔄' : '⏳';
        
        console.log(`${statusIcon} ${batchName}: ${migrated}/${batch.services.length} (${progress}%)`);
        if (remaining > 0 && remaining <= 5) {
            console.log(`   Remaining: ${batch.services.filter(s => !checkServiceMigrated(s)).join(', ')}`);
        }
    });
    
    console.log(`\nBatch Progress: ${migratedInBatches}/${totalInBatches} (${((migratedInBatches / totalInBatches) * 100).toFixed(1)}%)`);
}

// Show next services to migrate
if (categorization && categorization.services) {
    const nextServices = categorization.services
        .filter(s => !checkServiceMigrated(s.filename))
        .slice(0, 10);
    
    if (nextServices.length > 0) {
        console.log('\n=== Next Services to Migrate ===\n');
        nextServices.forEach((s, i) => {
            console.log(`${i + 1}. ${s.filename} (${s.priority}, ${s.usageCategory}, ${s.complexity})`);
        });
    }
}






