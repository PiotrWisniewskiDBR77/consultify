#!/usr/bin/env node
/**
 * Fix All TypeScript Import Extensions
 * 
 * Adds .js extensions to relative imports in all TypeScript files
 * Required for ESM compatibility with moduleResolution: NodeNext
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');
const TARGET_DIRS = [
    path.join(ROOT_DIR, 'server/src'),
    path.join(ROOT_DIR, 'server/services'),  // legacy but might have TS imports
    path.join(ROOT_DIR, 'server/routes'),    // legacy but might have TS imports
    path.join(ROOT_DIR, 'server/utils'),     // legacy
    path.join(ROOT_DIR, 'server/controllers'),
    path.join(ROOT_DIR, 'server/middleware'),
];

let filesFixed = 0;
let importsFixed = 0;

function fixImportsInFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf-8');
    let modified = false;
    
    // Pattern: from './something' or from '../something' without proper extension
    // This catches imports that end with a word character (not already .js, .json, etc.)
    const importRegex = /from\s+(['"])(\.\.?\/[^'"]+?)(['"])/g;
    
    const newContent = content.replace(importRegex, (match, quote1, importPath, quote2) => {
        // Skip if already has a file extension
        if (/\.(js|json|cjs|mjs|ts|tsx)$/.test(importPath)) {
            return match;
        }
        // Skip if it's a directory import (ends with /)
        if (importPath.endsWith('/')) {
            return match;
        }
        // Skip node_modules or absolute paths
        if (!importPath.startsWith('.')) {
            return match;
        }
        
        modified = true;
        importsFixed++;
        return `from ${quote1}${importPath}.js${quote2}`;
    });
    
    if (modified) {
        fs.writeFileSync(filePath, newContent);
        filesFixed++;
        console.log(`  ✅ Fixed: ${path.relative(ROOT_DIR, filePath)}`);
    }
}

function walkDir(dir) {
    if (!fs.existsSync(dir)) return;
    
    const files = fs.readdirSync(dir);
    
    for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
            walkDir(fullPath);
        } else if ((file.endsWith('.ts') && !file.endsWith('.d.ts')) || 
                   (file.endsWith('.js') && !file.endsWith('.min.js'))) {
            fixImportsInFile(fullPath);
        }
    }
}

console.log('\n🔧 FIXING ALL TYPESCRIPT IMPORTS\n');

for (const dir of TARGET_DIRS) {
    if (fs.existsSync(dir)) {
        console.log(`📁 ${path.relative(ROOT_DIR, dir)}/`);
        walkDir(dir);
    }
}

console.log('\n' + '═'.repeat(50));
console.log(`📊 Files fixed: ${filesFixed}`);
console.log(`📊 Imports fixed: ${importsFixed}`);
console.log('═'.repeat(50));

