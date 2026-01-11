#!/usr/bin/env node
/**
 * Script to automatically migrate tests from createRequire to ESM imports
 * 
 * This script:
 * 1. Finds all test files using createRequire
 * 2. Replaces createRequire + require() with ESM import/await import()
 * 3. Updates code to use dynamic imports where needed
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Find all test files with createRequire
function findFilesWithCreateRequire(dir) {
    const files = [];
    
    function walkDir(currentPath) {
        const entries = fs.readdirSync(currentPath, { withFileTypes: true });
        
        for (const entry of entries) {
            const fullPath = path.join(currentPath, entry.name);
            
            if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
                walkDir(fullPath);
            } else if (entry.isFile() && (entry.name.endsWith('.test.js') || entry.name.endsWith('.test.ts') || entry.name.endsWith('.spec.js') || entry.name.endsWith('.spec.ts'))) {
                const content = fs.readFileSync(fullPath, 'utf8');
                if (content.includes('createRequire') && (content.includes('import') || content.includes('const require = createRequire'))) {
                    files.push(fullPath);
                }
            }
        }
    }
    
    walkDir(dir);
    return files;
}

// Migrate a single file
function migrateFile(filePath) {
    console.log(`Migrating: ${filePath}`);
    
    let content = fs.readFileSync(filePath, 'utf8');
    const originalContent = content;
    
    // Skip if already migrated (has comment "Removed createRequire")
    if (content.includes('// Removed createRequire')) {
        console.log(`  Skipping - already migrated`);
        return false;
    }
    
    // Pattern 1: Simple require() at top level
    // const require = createRequire(import.meta.url);
    // const Module = require('path/to/module');
    const requirePattern = /const require = createRequire\(import\.meta\.url\);\s*\n\s*const (\w+) = require\(['"]([^'"]+)['"]\);/g;
    
    // Pattern 2: Multiple requires
    const multipleRequiresPattern = /const require = createRequire\(import\.meta\.url\);\s*\n((?:const \w+ = require\([^)]+\);\s*\n?)+)/g;
    
    // Pattern 3: require() calls inside functions
    const inlineRequirePattern = /const (\w+) = require\(['"]([^'"]+)['"]\);/g;
    
    let modified = false;
    
    // Remove createRequire import and declaration
    if (content.includes('import { createRequire } from \'module\';')) {
        content = content.replace(/import { createRequire } from 'module';\s*\n?/g, '// Removed createRequire - using ESM imports\n');
        modified = true;
    }
    
    if (content.includes('const require = createRequire(import.meta.url);')) {
        content = content.replace(/const require = createRequire\(import\.meta\.url\);\s*\n?/g, '');
        modified = true;
    }
    
    // Find all require() calls and convert them
    const requireCalls = [];
    let match;
    
    // Match: const Module = require('path');
    const requireRegex = /const (\w+) = require\(['"]([^'"]+)['"]\);/g;
    while ((match = requireRegex.exec(content)) !== null) {
        requireCalls.push({
            varName: match[1],
            modulePath: match[2],
            fullMatch: match[0],
            index: match.index
        });
    }
    
    // Convert require() calls to dynamic imports
    // Strategy: If require() is at top level, move to beforeEach or beforeAll
    // If it's inside a function, convert to await import()
    
    if (requireCalls.length > 0) {
        // Check if we're in a describe block
        const hasDescribe = content.includes('describe(');
        
        if (hasDescribe) {
            // Move requires to beforeEach or beforeAll
            // Find the describe block
            const describeMatch = content.match(/describe\([^)]+\s*,\s*\(\)\s*=>\s*\{/);
            if (describeMatch) {
                const describeEnd = describeMatch.index + describeMatch[0].length;
                const afterDescribe = content.substring(describeEnd);
                
                // Check if beforeEach/beforeAll already exists
                const hasBeforeEach = afterDescribe.includes('beforeEach(');
                const hasBeforeAll = afterDescribe.includes('beforeAll(');
                
                // Build import statements
                let importStatements = '';
                let variableDeclarations = '';
                
                for (const req of requireCalls) {
                    // Convert .js to .js if needed, handle .cjs specially
                    let importPath = req.modulePath;
                    if (!importPath.endsWith('.js') && !importPath.endsWith('.cjs') && !importPath.endsWith('.ts')) {
                        importPath += '.js';
                    }
                    
                    // Handle different import patterns
                    if (importPath.endsWith('.cjs')) {
                        // CommonJS module - use dynamic import
                        importStatements += `        const ${req.varName}Module = await import('${importPath}');\n`;
                        variableDeclarations += `        ${req.varName} = ${req.varName}Module.default || ${req.varName}Module;\n`;
                    } else {
                        // ESM module
                        importStatements += `        const ${req.varName}Module = await import('${importPath}');\n`;
                        variableDeclarations += `        ${req.varName} = ${req.varName}Module.default || ${req.varName}Module;\n`;
                    }
                }
                
                // Declare variables at top of describe
                const variableDecls = requireCalls.map(req => `    let ${req.varName};`).join('\n') + '\n';
                
                // Remove original require() calls
                for (const req of requireCalls.reverse()) { // Reverse to maintain indices
                    content = content.substring(0, req.index) + content.substring(req.index + req.fullMatch.length);
                }
                
                // Insert variable declarations after describe opening
                const insertPoint = describeEnd;
                content = content.substring(0, insertPoint) + '\n' + variableDecls + content.substring(insertPoint);
                
                // Insert import statements in beforeEach or create new one
                if (hasBeforeEach) {
                    // Find beforeEach and add imports
                    const beforeEachMatch = content.match(/beforeEach\([^)]*\)\s*=>\s*\{/);
                    if (beforeEachMatch) {
                        const beforeEachEnd = beforeEachMatch.index + beforeEachMatch[0].length;
                        // Check if it's async
                        const isAsync = beforeEachMatch[0].includes('async');
                        if (!isAsync) {
                            content = content.substring(0, beforeEachMatch.index) + 
                                     beforeEachMatch[0].replace('beforeEach(', 'beforeEach(async (') +
                                     content.substring(beforeEachMatch.index + beforeEachMatch[0].length);
                        }
                        // Insert imports after opening brace
                        const nextBrace = content.indexOf('{', beforeEachEnd);
                        if (nextBrace !== -1) {
                            content = content.substring(0, nextBrace + 1) + '\n' + importStatements + variableDeclarations + content.substring(nextBrace + 1);
                        }
                    }
                } else if (hasBeforeAll) {
                    // Similar for beforeAll
                    const beforeAllMatch = content.match(/beforeAll\([^)]*\)\s*=>\s*\{/);
                    if (beforeAllMatch) {
                        const beforeAllEnd = beforeAllMatch.index + beforeAllMatch[0].length;
                        const isAsync = beforeAllMatch[0].includes('async');
                        if (!isAsync) {
                            content = content.substring(0, beforeAllMatch.index) + 
                                     beforeAllMatch[0].replace('beforeAll(', 'beforeAll(async (') +
                                     content.substring(beforeAllMatch.index + beforeAllMatch[0].length);
                        }
                        const nextBrace = content.indexOf('{', beforeAllEnd);
                        if (nextBrace !== -1) {
                            content = content.substring(0, nextBrace + 1) + '\n' + importStatements + variableDeclarations + content.substring(nextBrace + 1);
                        }
                    }
                } else {
                    // Create new beforeAll
                    const insertPoint = describeEnd + variableDecls.length;
                    content = content.substring(0, insertPoint) + 
                             `\n    beforeAll(async () => {\n${importStatements}${variableDeclarations}    });\n` +
                             content.substring(insertPoint);
                }
                
                modified = true;
            }
        } else {
            // No describe block - convert to top-level await or move to function
            // For now, just remove and add comment
            for (const req of requireCalls.reverse()) {
                content = content.substring(0, req.index) + 
                         `// TODO: Convert to ESM import: const ${req.varName} = await import('${req.modulePath}');\n` +
                         content.substring(req.index + req.fullMatch.length);
            }
            modified = true;
        }
    }
    
    if (modified && content !== originalContent) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`  ✓ Migrated`);
        return true;
    } else if (modified) {
        console.log(`  ⚠ Modified but no changes detected`);
        return false;
    } else {
        console.log(`  ⊘ No changes needed`);
        return false;
    }
}

// Main execution
const testsDir = path.join(__dirname, '..', 'tests');
console.log(`Finding test files with createRequire in: ${testsDir}\n`);

const files = findFilesWithCreateRequire(testsDir);
console.log(`Found ${files.length} files to migrate\n`);

let migrated = 0;
let skipped = 0;
let failed = 0;

for (const file of files) {
    try {
        if (migrateFile(file)) {
            migrated++;
        } else {
            skipped++;
        }
    } catch (error) {
        console.error(`  ✗ Error migrating ${file}:`, error.message);
        failed++;
    }
}

console.log(`\n=== Migration Summary ===`);
console.log(`Migrated: ${migrated}`);
console.log(`Skipped: ${skipped}`);
console.log(`Failed: ${failed}`);
console.log(`Total: ${files.length}`);

if (failed > 0) {
    process.exit(1);
}

