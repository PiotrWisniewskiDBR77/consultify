#!/usr/bin/env node
/**
 * Fix Implicit Any Parameters
 * Adds explicit types to callback parameters
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const SERVER_DIR = path.join(__dirname, '..', 'server');

function fixImplicitAny(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    const originalContent = content;
    let modified = false;
    
    // Pattern 1: db.get callback: function(err, row) -> function(err: Error | null, row: unknown)
    content = content.replace(
        /function\s*\(err\s*,\s*row\s*\)/g,
        'function(err: Error | null, row: unknown)'
    );
    if (content !== originalContent) modified = true;
    
    // Pattern 2: db.all callback: function(err, rows) -> function(err: Error | null, rows: unknown[])
    content = content.replace(
        /function\s*\(err\s*,\s*rows\s*\)/g,
        'function(err: Error | null, rows: unknown[])'
    );
    if (content !== originalContent) modified = true;
    
    // Pattern 3: db.run callback: function(err) -> function(err: Error | null)
    content = content.replace(
        /function\s*\(err\s*\)/g,
        'function(err: Error | null)'
    );
    if (content !== originalContent) modified = true;
    
    // Pattern 4: Arrow functions: (err, row) => -> (err: Error | null, row: unknown) =>
    content = content.replace(
        /\(err\s*,\s*row\s*\)\s*=>/g,
        '(err: Error | null, row: unknown) =>'
    );
    if (content !== originalContent) modified = true;
    
    // Pattern 5: Arrow functions: (err, rows) => -> (err: Error | null, rows: unknown[]) =>
    content = content.replace(
        /\(err\s*,\s*rows\s*\)\s*=>/g,
        '(err: Error | null, rows: unknown[]) =>'
    );
    if (content !== originalContent) modified = true;
    
    // Pattern 6: Arrow functions: (err) => -> (err: Error | null) =>
    content = content.replace(
        /\(err\s*\)\s*=>/g,
        '(err: Error | null) =>'
    );
    if (content !== originalContent) modified = true;
    
    // Pattern 7: Multiple parameters: (err, row, ...) -> (err: Error | null, row: unknown, ...)
    content = content.replace(
        /\(err\s*,\s*row\s*,\s*(\w+)\s*\)/g,
        '(err: Error | null, row: unknown, $1: unknown)'
    );
    if (content !== originalContent) modified = true;
    
    if (modified) {
        fs.writeFileSync(filePath, content, 'utf8');
        return true;
    }
    
    return false;
}

function getAllTypeScriptFiles(dir) {
    const files = [];
    
    function walk(currentDir) {
        try {
            const entries = fs.readdirSync(currentDir, { withFileTypes: true });
            
            for (const entry of entries) {
                const fullPath = path.join(currentDir, entry.name);
                
                if (entry.isDirectory()) {
                    if (!['node_modules', 'dist', '.git'].includes(entry.name)) {
                        walk(fullPath);
                    }
                } else if (entry.isFile() && entry.name.endsWith('.ts')) {
                    files.push(fullPath);
                }
            }
        } catch (error) {
            // Ignore
        }
    }
    
    walk(dir);
    return files;
}

function main() {
    console.log('\n🔧 Fixing Implicit Any Parameters\n');
    console.log('═'.repeat(60));
    
    const files = getAllTypeScriptFiles(path.join(SERVER_DIR, 'src'));
    
    console.log(`\n📋 Found ${files.length} TypeScript files\n`);
    
    let fixed = 0;
    
    for (const file of files) {
        try {
            if (fixImplicitAny(file)) {
                fixed++;
                const relativePath = path.relative(SERVER_DIR, file);
                console.log(`  ✅ Fixed: ${relativePath}`);
            }
        } catch (error) {
            // Ignore errors
        }
    }
    
    console.log('\n' + '═'.repeat(60));
    console.log(`\n📊 Summary:`);
    console.log(`  Files processed: ${files.length}`);
    console.log(`  Files fixed: ${fixed}\n`);
}

main();

