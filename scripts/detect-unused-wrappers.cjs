#!/usr/bin/env node
/**
 * Script to detect unused wrapper services
 * Identifies wrapper services that are not imported/used anywhere in the codebase
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const servicesDir = path.join(__dirname, '..', 'server', 'src', 'services');
const srcDir = path.join(__dirname, '..', 'server', 'src');

function getAllServiceFiles() {
    return fs.readdirSync(servicesDir)
        .filter(f => f.endsWith('.ts'))
        .map(f => ({
            filename: f,
            filepath: path.join(servicesDir, f),
            basename: f.replace('.ts', '')
        }));
}

function isWrapperService(filepath) {
    const content = fs.readFileSync(filepath, 'utf-8');
    return /createRequire|require\(.*\.js\)/.test(content) && 
           !/export class\s+\w+|export const \w+\s*=\s*new|^const \w+\s*=\s*new/.test(content);
}

function getServiceName(filename) {
    // Convert filename to various possible import patterns
    const basename = filename.replace('.ts', '');
    
    // Remove "Service" suffix if present
    const withoutService = basename.replace(/Service$/, '');
    
    // Convert to camelCase
    const camelCase = basename.charAt(0).toLowerCase() + basename.slice(1);
    
    // Convert to kebab-case
    const kebabCase = basename.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '');
    
    return {
        exact: basename,
        camelCase,
        kebabCase,
        withoutService,
        variations: [
            basename,
            camelCase,
            kebabCase,
            withoutService,
            `./${basename}`,
            `../services/${basename}`,
            `services/${basename}`,
            `@/services/${basename}`
        ]
    };
}

function findImports(serviceName) {
    try {
        // Search for imports in TypeScript files
        const patterns = [
            `from.*['"]${serviceName.exact}`,
            `from.*['"]${serviceName.camelCase}`,
            `from.*['"]${serviceName.kebabCase}`,
            `import.*${serviceName.exact}`,
            `import.*${serviceName.camelCase}`,
            `require.*${serviceName.exact}`,
            `require.*${serviceName.camelCase}`
        ];
        
        let found = false;
        for (const pattern of patterns) {
            try {
                const result = execSync(
                    `grep -r "${pattern}" "${srcDir}" --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v node_modules | head -1`,
                    { encoding: 'utf-8', stdio: 'pipe' }
                );
                if (result.trim()) {
                    found = true;
                    break;
                }
            } catch (e) {
                // grep returns non-zero if no matches
            }
        }
        
        return found;
    } catch (error) {
        return false;
    }
}

function analyzeServices() {
    const services = getAllServiceFiles();
    const wrappers = [];
    const usedWrappers = [];
    const unusedWrappers = [];
    
    console.log(`Analyzing ${services.length} services...\n`);
    
    for (const service of services) {
        if (isWrapperService(service.filepath)) {
            wrappers.push(service);
            const serviceName = getServiceName(service.filename);
            const isUsed = findImports(serviceName);
            
            if (isUsed) {
                usedWrappers.push(service);
            } else {
                unusedWrappers.push(service);
            }
        }
    }
    
    return {
        total: services.length,
        wrappers: wrappers.length,
        usedWrappers: usedWrappers.length,
        unusedWrappers: unusedWrappers.length,
        used: usedWrappers,
        unused: unusedWrappers
    };
}

// Main execution
const results = analyzeServices();

console.log('=== Wrapper Services Analysis ===\n');
console.log(`Total services: ${results.total}`);
console.log(`Wrapper services: ${results.wrappers}`);
console.log(`Used wrappers: ${results.usedWrappers}`);
console.log(`Unused wrappers: ${results.unusedWrappers}\n`);

if (results.unusedWrappers.length > 0) {
    console.log('=== Unused Wrapper Services (can be safely removed) ===');
    results.unusedWrappers.slice(0, 50).forEach(s => {
        console.log(`  ${s.filename}`);
    });
    if (results.unusedWrappers.length > 50) {
        console.log(`  ... and ${results.unusedWrappers.length - 50} more`);
    }
    console.log('');
}

if (results.usedWrappers.length > 0 && process.argv.includes('--show-used')) {
    console.log('=== Used Wrapper Services (need migration) ===');
    results.usedWrappers.slice(0, 20).forEach(s => {
        console.log(`  ${s.filename}`);
    });
    if (results.usedWrappers.length > 20) {
        console.log(`  ... and ${results.usedWrappers.length - 20} more`);
    }
    console.log('');
}

// Save results
const output = {
    summary: {
        total: results.total,
        wrappers: results.wrappers,
        usedWrappers: results.usedWrappers.length,
        unusedWrappers: results.unusedWrappers.length
    },
    unused: (results.unused || []).map(s => s.filename),
    used: (results.used || []).map(s => s.filename)
};

fs.writeFileSync(
    path.join(__dirname, '..', 'unused-wrappers-analysis.json'),
    JSON.stringify(output, null, 2)
);

console.log('Results saved to unused-wrappers-analysis.json');

