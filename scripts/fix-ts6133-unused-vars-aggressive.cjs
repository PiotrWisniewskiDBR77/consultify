#!/usr/bin/env node
/**
 * Fix TS6133: Unused variables - Aggressive approach
 * Prefixes unused variables with _ or removes them
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
        
        const ts6133Errors = result.split('\n').filter(line => 
            line.includes('error TS6133') || line.includes('error TS6196')
        );
        
        if (ts6133Errors.length === 0) {
            return false;
        }
        
        const lines = content.split('\n');
        
        for (const errorLine of ts6133Errors) {
            // Extract variable name
            const match = errorLine.match(/'([^']+)' is declared but (its value is never read|never used)/);
            if (!match) continue;
            
            const varName = match[1];
            
            // Skip if already prefixed
            if (varName.startsWith('_')) continue;
            
            // Skip common patterns that shouldn't be changed
            if (['Database', 'db', 'config', 'logger', 'router', 'app'].includes(varName)) continue;
            
            // Find and prefix all occurrences
            // Pattern 1: const/let/var variableName =
            content = content.replace(
                new RegExp(`\\bconst\\s+${varName}\\s*=`, 'g'),
                `const _${varName} =`
            );
            content = content.replace(
                new RegExp(`\\blet\\s+${varName}\\s*=`, 'g'),
                `let _${varName} =`
            );
            content = content.replace(
                new RegExp(`\\bvar\\s+${varName}\\s*=`, 'g'),
                `var _${varName} =`
            );
            
            // Pattern 2: Function parameters
            content = content.replace(
                new RegExp(`\\(([^)]*)\\b${varName}\\b([^)]*)\\)`, 'g'),
                (match, before, after) => {
                    // Check if it's a typed parameter
                    if (before.includes(':') || after.includes(':')) {
                        return match.replace(new RegExp(`\\b${varName}\\b`), `_${varName}`);
                    }
                    return match.replace(new RegExp(`\\b${varName}\\b`), `_${varName}`);
                }
            );
            
            // Pattern 3: Destructuring
            content = content.replace(
                new RegExp(`\\{([^}]*)\\b${varName}\\b([^}]*)\\}`, 'g'),
                (match) => {
                    // Check if it's a rename pattern: { old: new }
                    if (match.includes(':')) {
                        return match.replace(new RegExp(`\\b${varName}\\b(?=\\s*:)`), `_${varName}`);
                    }
                    return match.replace(new RegExp(`\\b${varName}\\b`), `_${varName}`);
                }
            );
            
            // Pattern 4: Import statements - remove unused imports
            const importPattern = new RegExp(`import\\s+\\{[^}]*\\b${varName}\\b[^}]*\\}\\s+from`, 'g');
            if (importPattern.test(content)) {
                // Remove from import if it's the only one
                content = content.replace(
                    new RegExp(`import\\s+\\{\\s*${varName}\\s*\\}\\s+from[^;]+;`, 'g'),
                    ''
                );
                // Remove from multi-import
                content = content.replace(
                    new RegExp(`import\\s+\\{([^}]*),\\s*${varName}\\s*([^}]*)\\}\\s+from`, 'g'),
                    (match, before, after) => {
                        const newBefore = before.trim();
                        const newAfter = after.trim();
                        if (newBefore && newAfter) {
                            return `import { ${newBefore}, ${newAfter} } from`;
                        } else if (newBefore) {
                            return `import { ${newBefore} } from`;
                        } else if (newAfter) {
                            return `import { ${newAfter} } from`;
                        }
                        return match;
                    }
                );
            }
            
            modified = true;
        }
        
        if (modified && content !== originalContent) {
            fs.writeFileSync(filePath, content, 'utf8');
            return true;
        }
        
    } catch (error) {
        return false;
    }
    
    return false;
}

function main() {
    console.log('\n🔧 Fixing TS6133/TS6196: Unused variables (Aggressive)\n');
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


