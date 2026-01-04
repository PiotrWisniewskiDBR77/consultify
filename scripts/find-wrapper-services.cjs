#!/usr/bin/env node
/**
 * Script to identify wrapper services that need cleanup
 * Finds services with createRequire/require that can be removed
 */

const fs = require('fs');
const path = require('path');

const servicesDir = path.join(__dirname, '..', 'server', 'src', 'services');

function analyzeService(filepath) {
    const content = fs.readFileSync(filepath, 'utf-8');
    const filename = path.basename(filepath);
    
    const hasMigrated = /export class\s+\w+|export const \w+\s*=\s*new|^const \w+\s*=\s*new/.test(content);
    const hasCreateRequire = /createRequire/.test(content);
    const hasRequire = /require\(/.test(content);
    const hasWrapper = hasCreateRequire || hasRequire;
    
    // Check if there's duplicate export default
    const exportDefaults = (content.match(/export default/g) || []).length;
    const hasDuplicateExport = exportDefaults > 1;
    
    // Check if wrapper code exists after migrated code
    const wrapperPattern = /\/\*\*[\s\S]*?Note: This is a TypeScript wrapper[\s\S]*?createRequire|require\(.*\.js\)/;
    const hasWrapperAfterMigrated = hasMigrated && wrapperPattern.test(content);
    
    return {
        filename,
        hasMigrated,
        hasWrapper,
        hasCreateRequire,
        hasRequire,
        hasDuplicateExport,
        hasWrapperAfterMigrated,
        exportDefaults
    };
}

const files = fs.readdirSync(servicesDir)
    .filter(f => f.endsWith('.ts'))
    .map(f => path.join(servicesDir, f));

const results = files.map(analyzeService);

const migratedWithWrapper = results.filter(r => r.hasMigrated && r.hasWrapper);
const pureWrappers = results.filter(r => !r.hasMigrated && r.hasWrapper);
const withDuplicateExports = results.filter(r => r.hasDuplicateExport);

console.log('=== Analysis Results ===\n');
console.log(`Total services: ${results.length}`);
console.log(`Migrated with wrapper code: ${migratedWithWrapper.length}`);
console.log(`Pure wrappers: ${pureWrappers.length}`);
console.log(`With duplicate exports: ${withDuplicateExports.length}\n`);

if (migratedWithWrapper.length > 0) {
    console.log('=== Migrated services with wrapper code (remove wrapper) ===');
    migratedWithWrapper.forEach(r => {
        console.log(`  ${r.filename} - createRequire: ${r.hasCreateRequire}, require: ${r.hasRequire}, duplicate exports: ${r.hasDuplicateExport}`);
    });
    console.log('');
}

if (withDuplicateExports.length > 0) {
    console.log('=== Services with duplicate export default ===');
    withDuplicateExports.forEach(r => {
        console.log(`  ${r.filename} - ${r.exportDefaults} exports`);
    });
    console.log('');
}

if (pureWrappers.length > 0 && process.argv.includes('--show-wrappers')) {
    console.log('=== Pure wrapper services (first 20) ===');
    pureWrappers.slice(0, 20).forEach(r => {
        console.log(`  ${r.filename}`);
    });
    console.log(`  ... and ${pureWrappers.length - 20} more\n`);
}

// Write results to file
const output = {
    migratedWithWrapper: migratedWithWrapper.map(r => r.filename),
    pureWrappers: pureWrappers.map(r => r.filename),
    withDuplicateExports: withDuplicateExports.map(r => r.filename)
};

fs.writeFileSync(
    path.join(__dirname, '..', 'wrapper-services-analysis.json'),
    JSON.stringify(output, null, 2)
);

console.log('Results saved to wrapper-services-analysis.json');





