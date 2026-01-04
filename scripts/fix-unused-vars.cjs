#!/usr/bin/env node
/**
 * Fix Unused Variables
 * 
 * Automatically prefixes unused variables with underscore
 * based on TypeScript compiler errors TS6133 and TS6196
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');
const SERVER_DIR = path.join(ROOT_DIR, 'server');

console.log('\n🔧 FIXING UNUSED VARIABLES\n');

// Get TypeScript errors
let tscOutput;
try {
    tscOutput = execSync('npx tsc --noEmit 2>&1', {
        cwd: SERVER_DIR,
        encoding: 'utf-8',
        maxBuffer: 10 * 1024 * 1024
    });
} catch (err) {
    tscOutput = err.stdout || '';
}

// Parse unused variable errors
const errorRegex = /^([^(]+)\((\d+),(\d+)\): error (TS6133|TS6196): '([^']+)' is declared but/gm;
const fixes = new Map(); // Map<filePath, Array<{line, col, varName}>>

let match;
while ((match = errorRegex.exec(tscOutput)) !== null) {
    const [, filePath, line, col, errorCode, varName] = match;
    const fullPath = path.join(SERVER_DIR, filePath);
    
    if (!fixes.has(fullPath)) {
        fixes.set(fullPath, []);
    }
    fixes.get(fullPath).push({
        line: parseInt(line),
        col: parseInt(col),
        varName,
        errorCode
    });
}

console.log(`Found ${fixes.size} files with unused variables\n`);

let filesFixed = 0;
let varsFixed = 0;

for (const [filePath, errors] of fixes) {
    if (!fs.existsSync(filePath)) continue;
    
    let content = fs.readFileSync(filePath, 'utf-8');
    let modified = false;
    
    // Sort errors by line (descending) to avoid offset issues
    errors.sort((a, b) => b.line - a.line || b.col - a.col);
    
    const lines = content.split('\n');
    
    for (const error of errors) {
        const lineIdx = error.line - 1;
        if (lineIdx >= lines.length) continue;
        
        let line = lines[lineIdx];
        const varName = error.varName;
        
        // Skip if already prefixed with underscore
        if (varName.startsWith('_')) continue;
        
        // Common patterns to fix
        const patterns = [
            // Function parameters: (err, result) => or (err: Error) =>
            new RegExp(`\\b${varName}\\b(?=\\s*[,:)]|\\s*:)`),
            // Variable declarations: const foo = or let bar =
            new RegExp(`\\b(const|let|var)\\s+${varName}\\b`),
            // Destructuring: { foo, bar } or { foo: renamed }
            new RegExp(`\\{[^}]*\\b${varName}\\b[^}]*\\}`),
            // Import: import { foo } from
            new RegExp(`import\\s*\\{[^}]*\\b${varName}\\b[^}]*\\}`),
        ];
        
        let replaced = false;
        for (const pattern of patterns) {
            if (pattern.test(line)) {
                // Replace the variable name with underscore prefix
                const newLine = line.replace(
                    new RegExp(`\\b${varName}\\b`),
                    `_${varName}`
                );
                if (newLine !== line) {
                    lines[lineIdx] = newLine;
                    modified = true;
                    replaced = true;
                    varsFixed++;
                    break;
                }
            }
        }
        
        // Fallback: simple word boundary replacement
        if (!replaced) {
            const newLine = line.replace(
                new RegExp(`\\b${varName}\\b`),
                `_${varName}`
            );
            if (newLine !== line) {
                lines[lineIdx] = newLine;
                modified = true;
                varsFixed++;
            }
        }
    }
    
    if (modified) {
        fs.writeFileSync(filePath, lines.join('\n'));
        filesFixed++;
        console.log(`  ✅ Fixed: ${path.relative(ROOT_DIR, filePath)} (${errors.length} vars)`);
    }
}

console.log('\n' + '═'.repeat(50));
console.log(`📊 Files fixed: ${filesFixed}`);
console.log(`📊 Variables prefixed: ${varsFixed}`);
console.log('═'.repeat(50));

// Re-check remaining errors
console.log('\nRe-checking for remaining errors...');
try {
    const newOutput = execSync('npx tsc --noEmit 2>&1', {
        cwd: SERVER_DIR,
        encoding: 'utf-8',
        maxBuffer: 10 * 1024 * 1024
    });
    console.log('✅ No TypeScript errors!');
} catch (err) {
    const remaining = (err.stdout || '').match(/TS6133|TS6196/g);
    if (remaining) {
        console.log(`⚠️  Remaining unused variable errors: ${remaining.length}`);
    }
}


