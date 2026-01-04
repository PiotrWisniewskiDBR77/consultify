#!/usr/bin/env node
/**
 * Fix Legacy JS Imports from src/
 * 
 * Converts imports from src/ to correct paths for legacy JS files
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');
const LEGACY_DIRS = [
    path.join(ROOT_DIR, 'server/services'),
    path.join(ROOT_DIR, 'server/routes'),
];

let filesFixed = 0;
let importsFixed = 0;

function fixImportsInFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    let modified = false;
    let newContent = content;
    
    // Fix: ../src/services/X.js -> ./X.js (same directory)
    const srcServicesRegex = /from\s+(['"])(\.\.\/)+src\/services\/([^'"]+)\.js\1/g;
    newContent = newContent.replace(srcServicesRegex, (match, quote, dots, serviceName) => {
        modified = true;
        importsFixed++;
        // Count ../ to determine relative path
        const depth = (dots.match(/\.\.\//g) || []).length;
        const relativePath = depth > 1 ? '../' + serviceName + '.js' : './' + serviceName + '.js';
        return `from ${quote}${relativePath}${quote}`;
    });
    
    // Fix: ../src/utils/X.js -> ../utils/X.js
    const srcUtilsRegex = /from\s+(['"])(\.\.\/)+src\/utils\/([^'"]+)\.js\1/g;
    newContent = newContent.replace(srcUtilsRegex, (match, quote, dots, utilName) => {
        modified = true;
        importsFixed++;
        const depth = (dots.match(/\.\.\//g) || []).length;
        const relativePath = '../utils/' + utilName + '.js';
        return `from ${quote}${relativePath}${quote}`;
    });
    
    // Fix: ../src/database/X.js -> ../database.js
    const srcDatabaseRegex = /from\s+(['"])(\.\.\/)+src\/database\/[^'"]+\.js\1/g;
    newContent = newContent.replace(srcDatabaseRegex, (match, quote) => {
        modified = true;
        importsFixed++;
        return `from ${quote}../database.js${quote}`;
    });
    
    // Fix: ../src/middleware/X.js -> ../middleware/X.js
    const srcMiddlewareRegex = /from\s+(['"])(\.\.\/)+src\/middleware\/([^'"]+)\.js\1/g;
    newContent = newContent.replace(srcMiddlewareRegex, (match, quote, dots, middlewareName) => {
        modified = true;
        importsFixed++;
        return `from ${quote}../middleware/${middlewareName}.js${quote}`;
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
        } else if (file.endsWith('.js') && !file.endsWith('.min.js')) {
            fixImportsInFile(fullPath);
        }
    }
}

console.log('\n🔧 FIXING LEGACY JS IMPORTS FROM src/\n');

for (const dir of LEGACY_DIRS) {
    console.log(`📁 ${path.relative(ROOT_DIR, dir)}/`);
    walkDir(dir);
}

console.log('\n' + '═'.repeat(60));
console.log(`📊 Files fixed: ${filesFixed}`);
console.log(`📊 Imports fixed: ${importsFixed}`);
console.log('═'.repeat(60));
console.log('\n✅ Fix complete!\n');


