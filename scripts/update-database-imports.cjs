#!/usr/bin/env node
/**
 * Update Database Imports in Legacy JS Files
 * 
 * Updates all legacy JS service files to use TypeScript database
 * Changes: import db from '../database.js' 
 * To: import { getDatabase } from '../src/database/index.js'; const db = getDatabase();
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');
const SERVER_DIR = path.join(ROOT_DIR, 'server');
// Process multiple directories
const DIRECTORIES_TO_PROCESS = [
    'services',
    'routes',
    'middleware',
    'utils',
    'controllers',
    'ai',
    'mcp',
    'repositories'
];

const results = {
    updated: [],
    skipped: [],
    errors: [],
    total: 0
};

function updateDatabaseImport(filePath, baseDir) {
    const fullPath = path.join(baseDir, filePath);
    
    if (!fs.existsSync(fullPath)) {
        results.errors.push({ file: filePath, error: 'File not found' });
        return false;
    }
    
    let content = fs.readFileSync(fullPath, 'utf-8');
    const originalContent = content;
    
    // Check if file uses old database import (handle different path depths and patterns)
    // Pattern 1: import db from '../database.js' (from server/services/)
    // Pattern 2: await import('../database.js') (lazy loading)
    // Pattern 3: import db from '../../database.js' (from server/services/ai/)
    
    let foundPattern = false;
    
    // Calculate relative path based on file depth from server/ directory
    const relativeFromServer = path.relative(SERVER_DIR, fullPath);
    const depth = relativeFromServer.split(path.sep).length - 1;
    let relativePath = '../'.repeat(depth) + 'src/database/index.js';
    
    // Special handling for root-level files (routes, middleware, etc.)
    if (depth === 0) {
        relativePath = './src/database/index.js';
    }
    
    // Pattern 1a: Direct import - import db from '../database.js'
    const directImportPattern = /import\s+db\s+from\s+['"]\.\.+\/database\.js['"];?/;
    if (directImportPattern.test(content)) {
        foundPattern = true;
        content = content.replace(
            directImportPattern,
            `import { getDatabase } from '${relativePath}';\nconst db = getDatabase();`
        );
    }
    
    // Pattern 1b: import defaultDb from '../database.js'
    const defaultDbImportPattern = /import\s+defaultDb\s+from\s+['"]\.\.+\/database\.js['"];?/;
    if (defaultDbImportPattern.test(content)) {
        foundPattern = true;
        content = content.replace(
            defaultDbImportPattern,
            `import { getDatabase } from '${relativePath}';\nconst defaultDb = getDatabase();`
        );
    }
    
    // Pattern 1c: Already using getDatabase but wrong path - import { getDatabase } from '../database.js'
    const getDatabaseWrongPathPattern = /import\s+\{\s*getDatabase\s*\}\s+from\s+['"]\.\.+\/database\.js['"];?/;
    if (getDatabaseWrongPathPattern.test(content)) {
        foundPattern = true;
        content = content.replace(
            getDatabaseWrongPathPattern,
            `import { getDatabase } from '${relativePath}';`
        );
    }
    
    // Pattern 2: Lazy loading - await import('../database.js')
    const lazyImportPattern = /await\s+import\(['"]\.\.+\/database\.js['"]\)/;
    if (lazyImportPattern.test(content)) {
        foundPattern = true;
        // Replace in Promise.all patterns
        content = content.replace(
            /import\(['"]\.\.+\/database\.js['"]\)/g,
            `import('${relativePath}')`
        );
        // Update assignment patterns
        content = content.replace(
            /deps\.db\s*=\s*dbModule\.default\s*\|\|\s*dbModule;?/g,
            `const { getDatabase } = dbModule;\n        deps.db = getDatabase();`
        );
        // Handle single await import
        content = content.replace(
            /const\s+dbModule\s*=\s*await\s+import\(['"]\.\.+\/src\/database\/index\.js['"]\);?/g,
            `const dbModule = await import('${relativePath}')`
        );
    }
    
    // Pattern 3: Promise.all with database import
    const promiseAllPattern = /Promise\.all\(\[[^\]]*import\(['"]\.\.+\/database\.js['"]\)[^\]]*\]\)/;
    if (promiseAllPattern.test(content) && !foundPattern) {
        foundPattern = true;
        content = content.replace(
            /import\(['"]\.\.+\/database\.js['"]\)/g,
            `import('${relativePath}')`
        );
        // Update assignment after Promise.all - handle both patterns
        // Pattern 1: const [dbModule, uuidModule] = await Promise.all([...])
        content = content.replace(
            /const\s+\[dbModule,\s*(\w+Module)\]\s*=\s*await\s+Promise\.all\(\[[^\]]*import\(['"]\.\.+\/src\/database\/index\.js['"]\)[^\]]*\]\);?\s*\n\s*(const\s+\{\s*getDatabase\s*\}\s*=\s*dbModule;?\s*\n\s*deps\.db\s*=\s*getDatabase\(\);?)/,
            `const [dbModule, $1] = await Promise.all([\n        import('${relativePath}'),\n        import('uuid')\n    ]);\n    const { getDatabase } = dbModule;\n    deps.db = getDatabase();`
        );
        // Pattern 2: Simple replacement for deps.db assignment
        content = content.replace(
            /deps\.db\s*=\s*dbModule\.default\s*\|\|\s*dbModule;?/g,
            `const { getDatabase } = dbModule;\n    deps.db = getDatabase();`
        );
    }
    
    if (!foundPattern) {
        results.skipped.push({ file: filePath, reason: 'No old database import found' });
        return false;
    }
    
    // Write updated file
    if (content !== originalContent) {
        fs.writeFileSync(fullPath, content);
        results.updated.push(filePath);
        return true;
    }
    
    return false;
}

function findFiles(dir, baseDir, fileList = []) {
    if (!fs.existsSync(dir)) {
        return fileList;
    }
    
    const files = fs.readdirSync(dir);
    
    files.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        
        if (stat.isDirectory()) {
            // Skip node_modules and other non-service directories
            if (file !== 'node_modules' && !file.startsWith('.') && file !== 'dist' && file !== 'build') {
                findFiles(filePath, baseDir, fileList);
            }
        } else if (file.endsWith('.js') && !file.endsWith('.map') && !file.endsWith('.ts') && !file.includes(' 2.js') && !file.includes(' 3.js')) {
            const relativePath = path.relative(baseDir, filePath);
            fileList.push(relativePath);
        }
    });
    
    return fileList;
}

function main() {
    console.log('\n🔄 UPDATING DATABASE IMPORTS IN LEGACY JS FILES\n');
    
    let allFiles = [];
    
    // Process all directories
    for (const dirName of DIRECTORIES_TO_PROCESS) {
        const dirPath = path.join(SERVER_DIR, dirName);
        if (fs.existsSync(dirPath)) {
            const files = findFiles(dirPath, SERVER_DIR);
            console.log(`Found ${files.length} files in ${dirName}/`);
            allFiles = allFiles.concat(files.map(f => ({ file: f, baseDir: SERVER_DIR })));
        }
    }
    
    console.log(`\nTotal files to check: ${allFiles.length}\n`);
    
    // Update each file
    for (const { file, baseDir } of allFiles) {
        results.total++;
        updateDatabaseImport(file, baseDir);
    }
    
    // Summary
    console.log('═'.repeat(60));
    console.log('📊 UPDATE RESULTS\n');
    console.log(`Total processed: ${results.total}`);
    console.log(`Updated: ${results.updated.length}`);
    console.log(`Skipped: ${results.skipped.length}`);
    console.log(`Errors: ${results.errors.length}`);
    console.log('═'.repeat(60));
    
    if (results.updated.length > 0) {
        console.log('\n✅ Updated files:');
        results.updated.slice(0, 20).forEach(f => {
            console.log(`  ✅ ${f}`);
        });
        if (results.updated.length > 20) {
            console.log(`  ... and ${results.updated.length - 20} more`);
        }
    }
    
    if (results.errors.length > 0) {
        console.log('\n❌ Errors:');
        results.errors.forEach(e => {
            console.log(`  ❌ ${e.file}: ${e.error}`);
        });
    }
    
    // Save log
    const logPath = path.join(ROOT_DIR, 'docs/DATABASE_IMPORT_UPDATE_LOG.json');
    fs.writeFileSync(logPath, JSON.stringify(results, null, 2));
    
    console.log(`\n📄 Update log saved to: docs/DATABASE_IMPORT_UPDATE_LOG.json`);
    console.log('\n✅ Update complete!\n');
}

main();

