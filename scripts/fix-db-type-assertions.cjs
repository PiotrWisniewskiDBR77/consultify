#!/usr/bin/env node
/**
 * Fix Database Type Assertions
 * Adds type assertions for database query results that return {}
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const SERVER_DIR = path.join(__dirname, '..', 'server');
const SRC_DIR = path.join(SERVER_DIR, 'src');
const SERVICES_DIR = path.join(SERVER_DIR, 'services');

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
            // Ignore errors
        }
    }
    
    walk(dir);
    return files;
}

function addTypeAssertions(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    const originalContent = content;
    let modified = false;
    
    // Skip if already has dbTypeHelpers import
    const hasHelperImport = content.includes('dbTypeHelpers') || content.includes('asRecord');
    
    // Pattern 1: db.get() results - add asRecord
    // Example: const row = await db.get(...) -> const row = asRecord(await db.get(...))
    content = content.replace(
        /const\s+(\w+)\s*=\s*await\s+db\.get\(/g,
        (match, varName) => {
            if (!hasHelperImport && !content.includes(`import.*asRecord`)) {
                // Add import at top
                const importMatch = content.match(/^import\s+.*from\s+['"].*['"];?\s*\n/m);
                if (importMatch) {
                    const lastImport = content.lastIndexOf('import');
                    const importEnd = content.indexOf('\n', lastImport);
                    content = content.slice(0, importEnd + 1) + 
                        "import { asRecord } from '../utils/dbTypeHelpers.js';\n" + 
                        content.slice(importEnd + 1);
                }
            }
            modified = true;
            return `const ${varName} = asRecord(await db.get(`;
        }
    );
    
    // Pattern 2: db.all() results - add asRecordArray
    content = content.replace(
        /const\s+(\w+)\s*=\s*await\s+db\.all\(/g,
        (match, varName) => {
            if (!hasHelperImport && !content.includes(`import.*asRecordArray`)) {
                const importMatch = content.match(/^import\s+.*from\s+['"].*['"];?\s*\n/m);
                if (importMatch) {
                    const lastImport = content.lastIndexOf('import');
                    const importEnd = content.indexOf('\n', lastImport);
                    content = content.slice(0, importEnd + 1) + 
                        "import { asRecordArray } from '../utils/dbTypeHelpers.js';\n" + 
                        content.slice(importEnd + 1);
                }
            }
            modified = true;
            return `const ${varName} = asRecordArray(await db.all(`;
        }
    );
    
    // Pattern 3: Direct property access on {} - wrap with asRecord
    // This is more complex and requires parsing the actual errors
    
    if (modified && content !== originalContent) {
        fs.writeFileSync(filePath, content, 'utf8');
        return true;
    }
    
    return false;
}

function fixSpecificFile(filePath, errors) {
    let content = fs.readFileSync(filePath, 'utf8');
    const originalContent = content;
    let modified = false;
    
    // Extract errors for this file
    const fileErrors = errors.filter(e => e.file === filePath);
    
    for (const error of fileErrors) {
        // error format: line:col: error TS2339: Property 'propName' does not exist on type '{}'.
        const propMatch = error.message.match(/Property '([^']+)' does not exist/);
        if (!propMatch) continue;
        
        const propName = propMatch[1];
        const lineNum = parseInt(error.line);
        
        // Read the specific line
        const lines = content.split('\n');
        if (lineNum > lines.length) continue;
        
        const line = lines[lineNum - 1];
        
        // Find the variable being accessed
        // Pattern: variableName.propertyName
        const varMatch = line.match(/(\w+)\.\s*'?${propName}'?/);
        if (!varMatch) continue;
        
        const varName = varMatch[1];
        
        // Find where this variable is assigned (look backwards)
        for (let i = lineNum - 2; i >= 0; i--) {
            const prevLine = lines[i];
            const assignMatch = prevLine.match(new RegExp(`const\\s+${varName}\\s*=\\s*(.+)`));
            if (assignMatch) {
                const assignment = assignMatch[1];
                
                // Check if it's a db query
                if (assignment.includes('db.get') || assignment.includes('db.all') || assignment.includes('await db')) {
                    // Wrap with asRecord
                    if (!content.includes('asRecord')) {
                        // Add import
                        const importIndex = content.indexOf('import');
                        if (importIndex !== -1) {
                            const importEnd = content.indexOf('\n', importIndex);
                            content = content.slice(0, importEnd + 1) + 
                                "import { asRecord, asRecordArray } from '../utils/dbTypeHelpers.js';\n" + 
                                content.slice(importEnd + 1);
                            lines.splice(i + 1, 0, "import { asRecord, asRecordArray } from '../utils/dbTypeHelpers.js';");
                        }
                    }
                    
                    // Wrap assignment
                    const newAssignment = assignment.includes('db.all') 
                        ? `asRecordArray(${assignment})`
                        : `asRecord(${assignment})`;
                    
                    lines[i] = prevLine.replace(assignment, newAssignment);
                    modified = true;
                    break;
                }
            }
        }
    }
    
    if (modified) {
        content = lines.join('\n');
        fs.writeFileSync(filePath, content, 'utf8');
        return true;
    }
    
    return false;
}

function main() {
    console.log('\n🔧 Fixing Database Type Assertions\n');
    console.log('═'.repeat(60));
    
    // Get TypeScript errors
    console.log('\n📋 Analyzing TypeScript errors...\n');
    
    try {
        const result = execSync(
            `cd ${SERVER_DIR} && npm run build 2>&1 || true`,
            { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 }
        );
        
        // Parse errors
        const errorLines = result.split('\n').filter(line => 
            line.includes('error TS2339') && line.includes("Property '") && line.includes("does not exist on type '{}'")
        );
        
        console.log(`Found ${errorLines.length} TS2339 errors (Property does not exist on type '{}')\n`);
        
        // Group by file
        const errorsByFile = {};
        for (const errorLine of errorLines) {
            const match = errorLine.match(/^([^(]+)\((\d+),(\d+)\):.*Property '([^']+)' does not exist/);
            if (match) {
                const [, file, line, col, prop] = match;
                const fullPath = path.resolve(SERVER_DIR, file);
                if (!errorsByFile[fullPath]) {
                    errorsByFile[fullPath] = [];
                }
                errorsByFile[fullPath].push({ file: fullPath, line: parseInt(line), col: parseInt(col), prop, message: errorLine });
            }
        }
        
        console.log(`Files with errors: ${Object.keys(errorsByFile).length}\n`);
        
        // Fix files with most errors first
        const sortedFiles = Object.entries(errorsByFile)
            .sort((a, b) => b[1].length - a[1].length)
            .slice(0, 20); // Top 20 files
        
        let fixed = 0;
        
        for (const [filePath, errors] of sortedFiles) {
            if (!fs.existsSync(filePath)) continue;
            
            try {
                if (fixSpecificFile(filePath, errors)) {
                    fixed++;
                    const relativePath = path.relative(SERVER_DIR, filePath);
                    console.log(`  ✅ Fixed: ${relativePath} (${errors.length} errors)`);
                }
            } catch (error) {
                console.log(`  ⚠️  Error fixing ${path.relative(SERVER_DIR, filePath)}: ${error.message}`);
            }
        }
        
        console.log('\n' + '═'.repeat(60));
        console.log(`\n📊 Summary:`);
        console.log(`  Files with errors: ${Object.keys(errorsByFile).length}`);
        console.log(`  Files fixed: ${fixed}`);
        console.log(`  Total errors found: ${errorLines.length}\n`);
        
    } catch (error) {
        console.error('Error:', error.message);
    }
}

main();

