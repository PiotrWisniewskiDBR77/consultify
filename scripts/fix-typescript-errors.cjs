#!/usr/bin/env node
/**
 * Fix TypeScript Errors Script
 * 
 * Automatically fixes common TypeScript errors:
 * 1. TS5097: Import paths ending with .ts should be .js
 * 2. TS7006: Implicit any parameters in callbacks
 * 
 * Usage: node scripts/fix-typescript-errors.cjs
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');
const SERVER_SRC = path.join(ROOT_DIR, 'server/src');

const results = {
    scanned: 0,
    modified: 0,
    fixes: {
        importExtensions: 0,
        implicitAny: 0,
        catchUnknown: 0,
    },
    modifiedFiles: [],
    errors: [],
};

/**
 * Fix import extensions from .ts to .js
 * Matches: from './something.ts' or from "../something.ts"
 */
function fixImportExtensions(content, filePath) {
    let modified = false;
    
    // Fix imports ending with .ts to .js
    const tsImportRegex = /from\s+(['"])([^'"]+)\.ts\1/g;
    const newContent = content.replace(tsImportRegex, (match, quote, importPath) => {
        modified = true;
        results.fixes.importExtensions++;
        return `from ${quote}${importPath}.js${quote}`;
    });
    
    return { content: newContent, modified };
}

/**
 * Fix implicit any in common callback patterns
 */
function fixImplicitAny(content, filePath) {
    let modified = false;
    let newContent = content;
    
    // Fix: (err) => to (err: Error | null) =>
    // Be careful not to match already typed params
    const errCallbackRegex = /\(\s*(err)\s*\)\s*=>/g;
    if (errCallbackRegex.test(newContent)) {
        newContent = newContent.replace(errCallbackRegex, '(err: Error | null) =>');
        modified = true;
        results.fixes.implicitAny++;
    }
    
    // Fix: (err, row) => to (err: Error | null, row: unknown) =>
    const errRowRegex = /\(\s*(err)\s*,\s*(row|rows|result|data)\s*\)\s*=>/g;
    if (errRowRegex.test(newContent)) {
        newContent = newContent.replace(errRowRegex, '(err: Error | null, $2: unknown) =>');
        modified = true;
        results.fixes.implicitAny++;
    }
    
    // Fix: catch (e) { to catch (e: unknown) {
    // Only if not already typed
    const catchRegex = /catch\s*\(\s*(e|err|error)\s*\)\s*\{/g;
    if (catchRegex.test(newContent)) {
        // Check if already has type annotation
        if (!/catch\s*\(\s*(e|err|error)\s*:\s*\w+/.test(newContent)) {
            newContent = newContent.replace(catchRegex, 'catch ($1: unknown) {');
            modified = true;
            results.fixes.catchUnknown++;
        }
    }
    
    return { content: newContent, modified };
}

/**
 * Process a single file
 */
function processFile(filePath) {
    try {
        let content = fs.readFileSync(filePath, 'utf-8');
        let fileModified = false;
        
        // Apply fixes
        const importFix = fixImportExtensions(content, filePath);
        if (importFix.modified) {
            content = importFix.content;
            fileModified = true;
        }
        
        const anyFix = fixImplicitAny(content, filePath);
        if (anyFix.modified) {
            content = anyFix.content;
            fileModified = true;
        }
        
        // Write back if modified
        if (fileModified) {
            fs.writeFileSync(filePath, content);
            results.modified++;
            results.modifiedFiles.push(path.relative(ROOT_DIR, filePath));
        }
        
        return fileModified;
    } catch (err) {
        results.errors.push({
            file: filePath,
            error: err.message,
        });
        return false;
    }
}

/**
 * Recursively walk directory
 */
function walkDir(dir, callback) {
    if (!fs.existsSync(dir)) return;
    
    const files = fs.readdirSync(dir);
    
    for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
            walkDir(fullPath, callback);
        } else if (file.endsWith('.ts') && !file.endsWith('.d.ts')) {
            callback(fullPath);
        }
    }
}

// Main execution
console.log('\n🔧 TYPESCRIPT ERROR FIX SCRIPT\n');
console.log('Scanning server/src/ for TypeScript files...\n');

walkDir(SERVER_SRC, (filePath) => {
    results.scanned++;
    const relativePath = path.relative(ROOT_DIR, filePath);
    
    if (processFile(filePath)) {
        console.log(`  ✅ Fixed: ${relativePath}`);
    }
});

// Summary
console.log('\n' + '═'.repeat(50));
console.log('📊 SUMMARY\n');
console.log(`  Files scanned: ${results.scanned}`);
console.log(`  Files modified: ${results.modified}`);
console.log(`  Errors: ${results.errors.length}`);
console.log('\n  Fixes applied:');
console.log(`    Import extensions (.ts → .js): ${results.fixes.importExtensions}`);
console.log(`    Implicit any parameters: ${results.fixes.implicitAny}`);
console.log(`    Catch block unknown type: ${results.fixes.catchUnknown}`);
console.log('═'.repeat(50));

// Save report
const reportPath = path.join(ROOT_DIR, 'fix-typescript-report.json');
fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
console.log(`\n📄 Report saved to: fix-typescript-report.json`);

if (results.errors.length > 0) {
    console.log('\n⚠️ Errors encountered:');
    results.errors.forEach(e => console.log(`  - ${e.file}: ${e.error}`));
    process.exit(1);
}

