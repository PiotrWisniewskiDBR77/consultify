#!/usr/bin/env node
/**
 * Fix TS7006: Implicit any parameters - Comprehensive
 * Extends the basic fix to handle more patterns
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const SERVER_DIR = path.join(__dirname, '..', 'server');
const SRC_DIR = path.join(SERVER_DIR, 'src');

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

function fixFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    const originalContent = content;
    let modified = false;
    
    // Pattern 1: db.get callback
    if (content.includes('db.get') || content.includes('db.all') || content.includes('db.run')) {
        content = content.replace(
            /function\s*\(err\s*,\s*row\s*\)/g,
            'function(err: Error | null, row: unknown)'
        );
        content = content.replace(
            /function\s*\(err\s*,\s*rows\s*\)/g,
            'function(err: Error | null, rows: unknown[])'
        );
        content = content.replace(
            /function\s*\(err\s*\)/g,
            'function(err: Error | null)'
        );
        
        // Arrow functions
        content = content.replace(
            /\(err\s*,\s*row\s*\)\s*=>/g,
            '(err: Error | null, row: unknown) =>'
        );
        content = content.replace(
            /\(err\s*,\s*rows\s*\)\s*=>/g,
            '(err: Error | null, rows: unknown[]) =>'
        );
        content = content.replace(
            /\(err\s*\)\s*=>/g,
            '(err: Error | null) =>'
        );
        
        modified = content !== originalContent;
    }
    
    // Pattern 2: Promise handlers
    content = content.replace(
        /\.then\s*\(\s*\((\w+)\)\s*=>/g,
        '.then(($1: unknown) =>'
    );
    content = content.replace(
        /\.catch\s*\(\s*\((\w+)\)\s*=>/g,
        '.catch(($1: unknown) =>'
    );
    
    // Pattern 3: Event handlers
    content = content.replace(
        /\.on\s*\(\s*['"][^'"]+['"]\s*,\s*\((\w+)\)\s*=>/g,
        (match, param) => {
            return match.replace(`(${param})`, `(${param}: unknown)`);
        }
    );
    
    // Pattern 4: Array methods
    content = content.replace(
        /\.forEach\s*\(\s*\((\w+)\)\s*=>/g,
        '.forEach(($1: unknown) =>'
    );
    content = content.replace(
        /\.map\s*\(\s*\((\w+)\)\s*=>/g,
        '.map(($1: unknown) =>'
    );
    content = content.replace(
        /\.filter\s*\(\s*\((\w+)\)\s*=>/g,
        '.filter(($1: unknown) =>'
    );
    
    if (content !== originalContent) {
        modified = true;
        fs.writeFileSync(filePath, content, 'utf8');
    }
    
    return modified;
}

function main() {
    console.log('\n🔧 Fixing TS7006: Implicit any parameters (Comprehensive)\n');
    console.log('═'.repeat(60));
    
    const files = getAllTypeScriptFiles(SRC_DIR);
    console.log(`\n📋 Found ${files.length} TypeScript files\n`);
    
    let fixed = 0;
    let processed = 0;
    
    for (const file of files) {
        processed++;
        if (processed % 50 === 0) {
            console.log(`  Processed ${processed}/${files.length} files...`);
        }
        
        try {
            if (fixFile(file)) {
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

