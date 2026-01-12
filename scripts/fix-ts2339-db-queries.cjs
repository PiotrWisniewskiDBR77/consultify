#!/usr/bin/env node
/**
 * Fix TS2339: Property does not exist on type '{}'
 * Adds type assertions for database query results
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
    
    // Check if file has TS2339 errors related to DB queries
    try {
        const result = execSync(
            `cd ${SERVER_DIR} && npx tsc --noEmit ${filePath} 2>&1 || true`,
            { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }
        );
        
        const ts2339Errors = result.split('\n').filter(line => 
            line.includes('error TS2339') && line.includes("Property '") && line.includes("does not exist on type '{}'")
        );
        
        if (ts2339Errors.length === 0) {
            return false;
        }
        
        // Check if already has dbTypeHelpers import
        const hasHelperImport = content.includes('dbTypeHelpers') || content.includes('asRecord');
        
        // Pattern 1: db.get() - wrap with asRecord
        if (content.includes('db.get') || content.includes('await db.get')) {
            content = content.replace(
                /const\s+(\w+)\s*=\s*await\s+db\.get\(/g,
                (match, varName) => {
                    if (!hasHelperImport) {
                        // Add import at top
                        const importIndex = content.indexOf('import');
                        if (importIndex !== -1) {
                            const importEnd = content.indexOf('\n', importIndex);
                            content = content.slice(0, importEnd + 1) + 
                                "import { asRecord } from '../utils/dbTypeHelpers.js';\n" + 
                                content.slice(importEnd + 1);
                        }
                    }
                    modified = true;
                    return `const ${varName} = asRecord(await db.get(`;
                }
            );
        }
        
        // Pattern 2: db.all() - wrap with asRecordArray
        if (content.includes('db.all') || content.includes('await db.all')) {
            content = content.replace(
                /const\s+(\w+)\s*=\s*await\s+db\.all\(/g,
                (match, varName) => {
                    if (!hasHelperImport && !content.includes('asRecordArray')) {
                        const importIndex = content.indexOf('import');
                        if (importIndex !== -1) {
                            const importEnd = content.indexOf('\n', importIndex);
                            content = content.slice(0, importEnd + 1) + 
                                "import { asRecordArray } from '../utils/dbTypeHelpers.js';\n" + 
                                content.slice(importEnd + 1);
                        }
                    }
                    modified = true;
                    return `const ${varName} = asRecordArray(await db.all(`;
                }
            );
        }
        
        // Pattern 3: DbPromise.all() - wrap with asRecordArray
        if (content.includes('DbPromise.all')) {
            content = content.replace(
                /const\s+(\w+)\s*=\s*await\s+DbPromise\.all<[^>]+>\(/g,
                (match, varName) => {
                    if (!hasHelperImport && !content.includes('asRecordArray')) {
                        const importIndex = content.indexOf('import');
                        if (importIndex !== -1) {
                            const importEnd = content.indexOf('\n', importIndex);
                            content = content.slice(0, importEnd + 1) + 
                                "import { asRecordArray } from '../utils/dbTypeHelpers.js';\n" + 
                                content.slice(importEnd + 1);
                        }
                    }
                    modified = true;
                    return match.replace('await DbPromise.all<', 'asRecordArray(await DbPromise.all<');
                }
            );
        }
        
        // Pattern 4: Direct property access on {} - find variable and wrap assignment
        // This is more complex - we'll handle common patterns
        
        // Pattern: const result = await someQuery(); result.property
        // Find variables used in TS2339 errors and wrap their assignments
        for (const errorLine of ts2339Errors) {
            const match = errorLine.match(/\((\d+),(\d+)\):.*Property '([^']+)' does not exist/);
            if (!match) continue;
            
            const [, lineNum, colNum, propName] = match;
            const lineIndex = parseInt(lineNum) - 1;
            const lines = content.split('\n');
            
            if (lineIndex >= lines.length) continue;
            const line = lines[lineIndex];
            
            // Find variable name before the property access
            const varMatch = line.match(/(\w+)\.\s*'?${propName}'?/);
            if (!varMatch) continue;
            
            const varName = varMatch[1];
            
            // Find where this variable is assigned (look backwards)
            for (let i = lineIndex - 1; i >= 0 && i >= lineIndex - 20; i--) {
                const prevLine = lines[i];
                const assignMatch = prevLine.match(new RegExp(`const\\s+${varName}\\s*=\\s*(.+)`));
                if (assignMatch) {
                    const assignment = assignMatch[1].trim();
                    
                    // Check if it's a DB query that needs wrapping
                    if (assignment.includes('db.get') || assignment.includes('db.all') || 
                        assignment.includes('DbPromise') || assignment.includes('await db')) {
                        
                        // Wrap with asRecord or asRecordArray
                        if (!content.includes('asRecord') && !content.includes('asRecordArray')) {
                            const importIndex = content.indexOf('import');
                            if (importIndex !== -1) {
                                const importEnd = content.indexOf('\n', importIndex);
                                content = content.slice(0, importEnd + 1) + 
                                    "import { asRecord, asRecordArray } from '../utils/dbTypeHelpers.js';\n" + 
                                    content.slice(importEnd + 1);
                                lines.splice(i + 1, 0, "import { asRecord, asRecordArray } from '../utils/dbTypeHelpers.js';");
                            }
                        }
                        
                        const isArray = assignment.includes('.all') || assignment.includes('DbPromise.all');
                        const wrapper = isArray ? 'asRecordArray' : 'asRecord';
                        
                        lines[i] = prevLine.replace(
                            new RegExp(`const\\s+${varName}\\s*=\\s*`),
                            `const ${varName} = ${wrapper}(`
                        ) + ')';
                        
                        modified = true;
                        break;
                    }
                }
            }
        }
        
        if (modified) {
            content = lines ? lines.join('\n') : content;
        }
        
    } catch (error) {
        return false;
    }
    
    if (modified && content !== originalContent) {
        fs.writeFileSync(filePath, content, 'utf8');
        return true;
    }
    
    return false;
}

function main() {
    console.log('\n🔧 Fixing TS2339: Property does not exist on type \'{}\'\n');
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

