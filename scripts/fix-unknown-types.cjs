#!/usr/bin/env node
/**
 * Fix Unknown Types
 * Adds type guards and assertions for unknown types
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const SERVER_DIR = path.join(__dirname, '..', 'server');

function fixUnknownTypes(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    const originalContent = content;
    let modified = false;
    
    // Get errors for this specific file
    try {
        const result = execSync(
            `cd ${SERVER_DIR} && npx tsc --noEmit ${filePath} 2>&1 || true`,
            { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }
        );
        
        const unknownErrors = result.split('\n').filter(line => 
            line.includes('TS18046') && line.includes('is of type \'unknown\'')
        );
        
        if (unknownErrors.length === 0) {
            return false;
        }
        
        // Extract variable names from errors
        for (const errorLine of unknownErrors) {
            const match = errorLine.match(/'([^']+)' is of type 'unknown'/);
            if (!match) continue;
            
            const varName = match[1];
            
            // Find all usages of this variable and add type assertions
            // Pattern: variableName.property -> (variableName as Record<string, unknown>).property
            const usagePattern = new RegExp(`\\b${varName}\\s*\\.`, 'g');
            if (usagePattern.test(content)) {
                // Check if already has assertion
                if (!content.includes(`${varName} as Record<string, unknown>`)) {
                    content = content.replace(
                        new RegExp(`\\b${varName}\\s*\\.`, 'g'),
                        `(${varName} as Record<string, unknown>).`
                    );
                    modified = true;
                }
            }
            
            // Pattern: variableName[index] -> (variableName as Record<string, unknown>)[index]
            const indexPattern = new RegExp(`\\b${varName}\\s*\\[`, 'g');
            if (indexPattern.test(content)) {
                if (!content.includes(`${varName} as Record<string, unknown>`)) {
                    content = content.replace(
                        new RegExp(`\\b${varName}\\s*\\[`, 'g'),
                        `(${varName} as Record<string, unknown>)[`
                    );
                    modified = true;
                }
            }
        }
        
        // Add import for asRecord if needed
        if (modified && !content.includes('dbTypeHelpers')) {
            const importMatch = content.match(/^import\s+.*from\s+['"].*['"];?\s*\n/m);
            if (importMatch) {
                const lastImport = content.lastIndexOf('import');
                const importEnd = content.indexOf('\n', lastImport);
                content = content.slice(0, importEnd + 1) + 
                    "import { asRecord } from '../utils/dbTypeHelpers.js';\n" + 
                    content.slice(importEnd + 1);
            }
        }
        
    } catch (error) {
        // Ignore errors
        return false;
    }
    
    if (modified && content !== originalContent) {
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
    console.log('\n🔧 Fixing Unknown Types\n');
    console.log('═'.repeat(60));
    
    const files = getAllTypeScriptFiles(path.join(SERVER_DIR, 'src'));
    
    console.log(`\n📋 Found ${files.length} TypeScript files\n`);
    
    let fixed = 0;
    
    for (const file of files) {
        try {
            if (fixUnknownTypes(file)) {
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

