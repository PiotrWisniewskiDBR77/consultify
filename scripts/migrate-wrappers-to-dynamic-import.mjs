#!/usr/bin/env node
/**
 * Script to migrate wrapper services from createRequire to dynamic imports
 * Replaces createRequire() + require() with dynamic import pattern
 */

import { readFileSync, writeFileSync } from 'fs';
import globPkg from 'glob';
const { glob } = globPkg;
import path from 'path';

const SERVICES_DIR = 'server/src/services';

function migrateWrapper(filePath) {
    let content = readFileSync(filePath, 'utf-8');
    const originalContent = content;
    
    // Skip if not a wrapper
    if (!content.includes('createRequire') || !content.includes("require('../../services/")) {
        return { migrated: false, reason: 'Not a wrapper' };
    }
    
    // Extract service name from file path
    const fileName = path.basename(filePath, '.ts');
    
    // Find the require statement
    const requireMatch = content.match(/require\(['"]\.\.\/\.\.\/services\/([^'"]+)['"]\)/);
    if (!requireMatch) {
        return { migrated: false, reason: 'No require statement found' };
    }
    
    const jsFile = requireMatch[1];
    const serviceVarName = content.match(/const\s+(\w+)\s*=\s*require/)?.[1] || `${fileName}ServiceJS`;
    
    // Remove createRequire imports
    content = content.replace(/import\s*{\s*createRequire\s*}\s*from\s*['"]module['"];?\s*\n?/g, '');
    content = content.replace(/const\s+require\s*=\s*createRequire\(import\.meta\.url\);?\s*\n?/g, '');
    
    // Create dynamic import pattern with lazy loading
    const importPath = `../../services/${jsFile}`;
    const dynamicImportCode = `// Dynamic import (migrated from createRequire)
let ${serviceVarName.replace('JS', '')}Cache: any = null;
let ${serviceVarName.replace('JS', '')}Promise: Promise<any> | null = null;

async function load${fileName}Service() {
    if (${serviceVarName.replace('JS', '')}Cache) {
        return ${serviceVarName.replace('JS', '')}Cache;
    }
    if (!${serviceVarName.replace('JS', '')}Promise) {
        ${serviceVarName.replace('JS', '')}Promise = (async () => {
            const module = await import('${importPath}');
            ${serviceVarName.replace('JS', '')}Cache = module.default || module;
            return ${serviceVarName.replace('JS', '')}Cache;
        })();
    }
    return ${serviceVarName.replace('JS', '')}Promise;
}

// Load service immediately (for backward compatibility)
const ${serviceVarName} = await load${fileName}Service();`;

    // Replace the require line with dynamic import
    const requirePattern = new RegExp(
        `const\\s+${serviceVarName}\\s*=\\s*require\\(['"]${importPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]\\);?`,
        'g'
    );
    
    if (content.match(requirePattern)) {
        // Check if file already has async/await (top-level await not supported)
        if (content.includes('export default') && !content.includes('async')) {
            // Use Promise export pattern instead
            content = content.replace(requirePattern, dynamicImportCode.replace(/await /g, ''));
            // Change default export to Promise
            content = content.replace(
                /export\s+default\s+[^;]+;/,
                `export default load${fileName}Service();`
            );
        } else {
            // Simple replacement - will need manual fixes for top-level await
            content = content.replace(requirePattern, `// ${serviceVarName} loaded via dynamic import\n// Note: This file may need manual adjustment for top-level await`);
            // Add dynamic import at top
            const importStatement = `// Dynamic import wrapper\nconst ${serviceVarName}Promise = (async () => {\n    const module = await import('${importPath}');\n    return module.default || module;\n})();\n\n`;
            // Insert after last import or at beginning
            const lastImportIndex = content.lastIndexOf('import ');
            if (lastImportIndex !== -1) {
                const nextNewline = content.indexOf('\n', lastImportIndex);
                content = content.slice(0, nextNewline + 1) + importStatement + content.slice(nextNewline + 1);
            } else {
                content = importStatement + content;
            }
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
    console.log('Finding wrapper services...');
    const files = await new Promise((resolve, reject) => {
        glob(`${SERVICES_DIR}/**/*.ts`, (err, matches) => {
            if (err) reject(err);
            else resolve(matches);
        });
    });
    
    const wrappers = [];
    for (const file of files) {
        const content = readFileSync(file, 'utf-8');
        if (content.includes('createRequire') && content.includes("require('../../services/")) {
            wrappers.push(file);
        }
    }
    
    console.log(`Found ${wrappers.length} wrapper services to migrate\n`);
    
    let migrated = 0;
    let failed = 0;
    
    for (const file of wrappers) {
        try {
            const result = migrateWrapper(file);
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

