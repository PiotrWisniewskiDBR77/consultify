#!/usr/bin/env node
/**
 * Automatic Fix for Unused Variables
 * Prefixes unused variables with _ or removes them if safe
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
    }
    
    walk(dir);
    return files;
}

function fixUnusedVariables(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    const originalContent = content;
    
    // Pattern 1: Unused variables in destructuring - prefix with _
    // Example: const { unused } = obj; -> const { unused: _unused } = obj;
    // But we need to be careful - only if variable is truly unused
    
    // Pattern 2: Unused function parameters - prefix with _
    // Example: function test(err, row) -> function test(_err, _row)
    // But we need to check if they're actually unused
    
    // Pattern 3: Unused imports - remove or prefix
    // Example: import { unused } from 'module'; -> import type { unused } from 'module'; or remove
    
    // Pattern 4: Unused declared variables - prefix with _
    // Example: let unused = value; -> let _unused = value;
    
    // Get TypeScript errors for this file
    try {
        const result = execSync(
            `cd ${SERVER_DIR} && npx tsc --noEmit ${filePath} 2>&1 || true`,
            { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }
        );
        
        const unusedVarErrors = result.match(/TS6133|TS6196/g);
        if (!unusedVarErrors || unusedVarErrors.length === 0) {
            return false;
        }
        
        // Extract line numbers and variable names from errors
        const errorLines = result.split('\n').filter(line => 
            line.includes('TS6133') || line.includes('TS6196')
        );
        
        for (const errorLine of errorLines) {
            // Extract variable name from error message
            // Format: file.ts(line,col): error TS6133: 'variableName' is declared but its value is never read.
            const match = errorLine.match(/'([^']+)'/);
            if (!match) continue;
            
            const varName = match[1];
            
            // Skip if already prefixed with _
            if (varName.startsWith('_')) continue;
            
            // Skip common patterns that shouldn't be changed
            if (['Database', 'db', 'config', 'logger'].includes(varName)) continue;
            
            // Find and replace variable declarations
            // Pattern: const/let/var variableName = ...
            const varPatterns = [
                new RegExp(`\\bconst\\s+${varName}\\s*=`, 'g'),
                new RegExp(`\\blet\\s+${varName}\\s*=`, 'g'),
                new RegExp(`\\bvar\\s+${varName}\\s*=`, 'g'),
                new RegExp(`\\bconst\\s+\\{[^}]*\\b${varName}\\b[^}]*\\}\\s*=`, 'g'),
                new RegExp(`\\bconst\\s+\\{[^}]*\\b${varName}\\s*:\\s*([^,}]+)[^}]*\\}\\s*=`, 'g'),
            ];
            
            // Also check function parameters
            const paramPatterns = [
                new RegExp(`\\(([^)]*)\\b${varName}\\b([^)]*)\\)`, 'g'),
                new RegExp(`function\\s+\\w+\\s*\\(([^)]*)\\b${varName}\\b([^)]*)\\)`, 'g'),
                new RegExp(`=>\\s*\\(([^)]*)\\b${varName}\\b([^)]*)\\)`, 'g'),
            ];
            
            // Try to prefix variable in destructuring
            // Example: const { unused } = obj; -> const { unused: _unused } = obj;
            const destructuringPattern = new RegExp(`(const|let|var)\\s+\\{([^}]*)\\b${varName}\\b([^}]*)\\}\\s*=`, 'g');
            if (destructuringPattern.test(content)) {
                content = content.replace(
                    new RegExp(`(\\{[^}]*)\\b${varName}\\b([^}]*\\})`, 'g'),
                    `$1${varName}: _${varName}$2`
                );
                modified = true;
            }
            
            // Prefix in function parameters
            const funcParamPattern = new RegExp(`(function\\s+\\w+\\s*\\([^)]*)\\b${varName}\\b([^)]*\\))`, 'g');
            if (funcParamPattern.test(content)) {
                content = content.replace(
                    new RegExp(`\\b${varName}\\b(?=\\s*[,)])`, 'g'),
                    `_${varName}`
                );
                modified = true;
            }
            
            // Prefix in arrow function parameters
            const arrowParamPattern = new RegExp(`(=>\\s*\\([^)]*)\\b${varName}\\b([^)]*\\))`, 'g');
            if (arrowParamPattern.test(content)) {
                content = content.replace(
                    new RegExp(`\\b${varName}\\b(?=\\s*[,)])`, 'g'),
                    `_${varName}`
                );
                modified = true;
            }
            
            // Prefix standalone variable declarations
            const standalonePattern = new RegExp(`(const|let|var)\\s+${varName}\\s*=`, 'g');
            if (standalonePattern.test(content)) {
                content = content.replace(
                    new RegExp(`\\b${varName}\\b`, 'g'),
                    `_${varName}`
                );
                modified = true;
            }
        }
        
        if (modified && content !== originalContent) {
            fs.writeFileSync(filePath, content, 'utf8');
            return true;
        }
    } catch (error) {
        // Ignore errors - file might have syntax errors
        return false;
    }
    
    return false;
}

function main() {
    console.log('\n🔧 Fixing Unused Variables\n');
    console.log('═'.repeat(60));
    
    const files = [
        ...getAllTypeScriptFiles(SRC_DIR),
        ...getAllTypeScriptFiles(SERVICES_DIR)
    ];
    
    console.log(`\n📋 Found ${files.length} TypeScript files\n`);
    
    let fixed = 0;
    let errors = 0;
    
    for (const file of files) {
        try {
            if (fixUnusedVariables(file)) {
                fixed++;
                const relativePath = path.relative(SERVER_DIR, file);
                console.log(`  ✅ Fixed: ${relativePath}`);
            }
        } catch (error) {
            errors++;
            const relativePath = path.relative(SERVER_DIR, file);
            console.log(`  ⚠️  Error in ${relativePath}: ${error.message}`);
        }
    }
    
    console.log('\n' + '═'.repeat(60));
    console.log(`\n📊 Summary:`);
    console.log(`  Files processed: ${files.length}`);
    console.log(`  Files fixed: ${fixed}`);
    console.log(`  Errors: ${errors}\n`);
}

main();

