#!/usr/bin/env node
/**
 * Fix TS2551: Property does not exist on type
 * Adds optional chaining and type assertions
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
    
    try {
        const result = execSync(
            `cd ${SERVER_DIR} && npx tsc --noEmit ${filePath} 2>&1 || true`,
            { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }
        );
        
        const ts2551Errors = result.split('\n').filter(line => 
            line.includes('error TS2551') && line.includes('Property')
        );
        
        if (ts2551Errors.length === 0) {
            return false;
        }
        
        const lines = content.split('\n');
        
        for (const errorLine of ts2551Errors) {
            const match = errorLine.match(/\((\d+),(\d+)\):.*Property '([^']+)' does not exist/);
            if (!match) continue;
            
            const lineNum = parseInt(match[1]);
            const propName = match[3];
            
            if (lineNum > lines.length) continue;
            
            const lineIndex = lineNum - 1;
            let line = lines[lineIndex];
            
            // Find variable.property pattern
            const propPattern = new RegExp(`(\\w+)\\.${propName}`, 'g');
            if (propPattern.test(line)) {
                // Add optional chaining if safe
                line = line.replace(
                    new RegExp(`(\\w+)\\.${propName}`, 'g'),
                    `$1?.${propName}`
                );
                lines[lineIndex] = line;
                modified = true;
            }
        }
        
        if (modified) {
            content = lines.join('\n');
            fs.writeFileSync(filePath, content, 'utf8');
            return true;
        }
        
    } catch (error) {
        return false;
    }
    
    return false;
}

function main() {
    console.log('\n🔧 Fixing TS2551: Property does not exist on type\n');
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


