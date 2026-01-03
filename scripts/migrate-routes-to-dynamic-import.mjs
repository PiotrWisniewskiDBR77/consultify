#!/usr/bin/env node
/**
 * Script to migrate wrapper routes from createRequire to dynamic imports
 * Replaces createRequire() + require() with dynamic import pattern
 */

import { readFileSync, writeFileSync } from 'fs';
import globPkg from 'glob';
const { glob } = globPkg;
import path from 'path';

const ROUTES_DIR = 'server/src/routes';

function migrateRoute(filePath) {
    let content = readFileSync(filePath, 'utf-8');
    const originalContent = content;
    
    // Skip if not a wrapper
    if (!content.includes('createRequire') || !content.includes("require('../../")) {
        return { migrated: false, reason: 'Not a wrapper' };
    }
    
    // Remove createRequire imports
    content = content.replace(/import\s*{\s*createRequire\s*}\s*from\s*['"]module['"];?\s*\n?/g, '');
    content = content.replace(/const\s+require\s*=\s*createRequire\(import\.meta\.url\);?\s*\n?/g, '');
    
    // Find all require() statements for services
    const requireMatches = content.matchAll(/const\s+(\w+)\s*=\s*require\(['"](\.\.\/\.\.\/[^'"]+)['"]\)/g);
    
    for (const match of requireMatches) {
        const varName = match[1];
        const requirePath = match[2];
        
        // Replace with dynamic import
        const importPath = requirePath.replace(/\.js$/, '') + '.js';
        const dynamicImport = `// Dynamic import (migrated from createRequire)
let ${varName}Cache: any = null;
let ${varName}Promise: Promise<any> | null = null;

async function load${varName.charAt(0).toUpperCase() + varName.slice(1)}() {
    if (${varName}Cache) {
        return ${varName}Cache;
    }
    if (!${varName}Promise) {
        ${varName}Promise = (async () => {
            const module = await import('${importPath}');
            ${varName}Cache = module.default || module;
            return ${varName}Cache;
        })();
    }
    return ${varName}Promise;
}

const ${varName} = await load${varName.charAt(0).toUpperCase() + varName.slice(1)}();`;
        
        // Replace the require line
        const requirePattern = new RegExp(
            `const\\s+${varName}\\s*=\\s*require\\(['"]${requirePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]\\)`,
            'g'
        );
        
        // Check if we can use top-level await (if file is already async)
        if (content.includes('export default') && content.includes('async')) {
            content = content.replace(requirePattern, dynamicImport);
        } else {
            // Use Promise pattern
            const promisePattern = `const ${varName}Promise = (async () => {
    const module = await import('${importPath}');
    return module.default || module;
})();
const ${varName} = ${varName}Promise;`;
            content = content.replace(requirePattern, promisePattern);
        }
    }
    
    // Write back if changed
    if (content !== originalContent) {
        writeFileSync(filePath, content, 'utf-8');
        return { migrated: true };
    }
    
    return { migrated: false, reason: 'No changes made' };
}

async function main() {
    console.log('Finding wrapper routes...');
    const files = await new Promise((resolve, reject) => {
        glob(`${ROUTES_DIR}/**/*.ts`, (err, matches) => {
            if (err) reject(err);
            else resolve(matches);
        });
    });
    
    const wrappers = [];
    for (const file of files) {
        const content = readFileSync(file, 'utf-8');
        if (content.includes('createRequire') && content.includes("require('../../")) {
            wrappers.push(file);
        }
    }
    
    console.log(`Found ${wrappers.length} wrapper routes to migrate\n`);
    
    let migrated = 0;
    let failed = 0;
    
    for (const file of wrappers) {
        try {
            const result = migrateRoute(file);
            if (result.migrated) {
                console.log(`✓ ${path.basename(file)}`);
                migrated++;
            } else {
                console.log(`- ${path.basename(file)}: ${result.reason}`);
            }
        } catch (error) {
            console.error(`✗ ${path.basename(file)}: ${error.message}`);
            failed++;
        }
    }
    
    console.log(`\nMigration complete: ${migrated} migrated, ${failed} failed`);
    console.log('Note: Some files may need manual adjustment for top-level await support.');
}

main().catch(console.error);




