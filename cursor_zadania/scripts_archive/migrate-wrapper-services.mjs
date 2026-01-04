#!/usr/bin/env node
/**
 * Script to migrate wrapper services from createRequire to dynamic imports
 * Processes services in batches to avoid overwhelming the system
 */

import { readFileSync, writeFileSync } from 'fs';
import { glob } from 'glob';
import path from 'path';

const SERVICES_DIR = 'server/src/services';
const BATCH_SIZE = 20;

async function migrateWrapper(filePath) {
    const content = readFileSync(filePath, 'utf-8');
    
    // Skip if not a wrapper (no createRequire)
    if (!content.includes('createRequire')) {
        return false;
    }
    
    // Skip if no require('../../services/...)
    const requireMatch = content.match(/require\(['"]\.\.\/\.\.\/services\/([^'"]+)['"]\)/);
    if (!requireMatch) {
        return false;
    }
    
    const jsFile = requireMatch[1];
    const serviceName = path.basename(jsFile, '.js');
    
    // Create new content with dynamic import
    let newContent = content;
    
    // Remove createRequire import
    newContent = newContent.replace(/import\s*{\s*createRequire\s*}\s*from\s*['"]module['"];?\s*\n/g, '');
    newContent = newContent.replace(/const\s+require\s*=\s*createRequire\(import\.meta\.url\);?\s*\n/g, '');
    
    // Replace require() with dynamic import pattern
    const importPath = `../../services/${jsFile}`;
    const dynamicImport = `const ${serviceName}Module = await import('${importPath}');\nconst ${serviceName}ServiceJS = ${serviceName}Module.default || ${serviceName}Module;`;
    
    // Replace the require line
    newContent = newContent.replace(
        new RegExp(`const\\s+\\w+ServiceJS\\s*=\\s*require\\(['"]${importPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]\\);?`, 'g'),
        dynamicImport
    );
    
    // If file doesn't have async wrapper, we need to make it async or use lazy loading
    // For now, use lazy loading pattern with Promise
    if (!newContent.includes('async') && !newContent.includes('await')) {
        // Wrap in async function or use Promise pattern
        // This is a simplified version - may need manual fixes
        newContent = `// Dynamic import wrapper (migrated from createRequire)\n` +
            `let serviceCache = null;\n` +
            `const servicePromise = (async () => {\n` +
            `    if (serviceCache) return serviceCache;\n` +
            `    ${dynamicImport}\n` +
            `    serviceCache = ${serviceName}ServiceJS;\n` +
            `    return serviceCache;\n` +
            `})();\n\n` +
            newContent.replace(
                new RegExp(`const\\s+\\w+ServiceJS\\s*=.*?;`, 's'),
                `// Service loaded via dynamic import above`
            );
    }
    
    writeFileSync(filePath, newContent, 'utf-8');
    return true;
}

async function main() {
    const files = await glob(`${SERVICES_DIR}/*.ts`);
    const wrappers = files.filter(f => {
        const content = readFileSync(f, 'utf-8');
        return content.includes('createRequire') && content.includes("require('../../services/");
    });
    
    console.log(`Found ${wrappers.length} wrapper services to migrate`);
    console.log(`Processing in batches of ${BATCH_SIZE}...`);
    
    for (let i = 0; i < wrappers.length; i += BATCH_SIZE) {
        const batch = wrappers.slice(i, i + BATCH_SIZE);
        console.log(`\nProcessing batch ${Math.floor(i / BATCH_SIZE) + 1} (${batch.length} files)...`);
        
        for (const file of batch) {
            try {
                const migrated = await migrateWrapper(file);
                if (migrated) {
                    console.log(`  ✓ ${path.basename(file)}`);
                }
            } catch (error) {
                console.error(`  ✗ ${path.basename(file)}: ${error.message}`);
            }
        }
    }
    
    console.log(`\nMigration complete!`);
}

main().catch(console.error);
