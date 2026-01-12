#!/usr/bin/env node
/**
 * Fix ALL Legacy JS Imports
 * 
 * Comprehensive fix for all import paths in legacy JS files
 * Handles: database, utils, services, middleware imports
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');
const SERVER_DIR = path.join(ROOT_DIR, 'server');

const replacements = [
    // Database imports
    { from: /from\s+(['"])\.\.\/src\/database\/Database\.js\1/g, to: "from '../database.js'" },
    { from: /from\s+(['"])\.\.\/src\/database\1/g, to: "from '../database.js'" },
    
    // Utils imports - check if file exists in dist/utils/ or utils/
    { from: /from\s+(['"])\.\.\/src\/utils\/([^'"]+)\.js\1/g, to: (match, quote, utilName) => {
        // Check if exists in dist/utils/ (compiled)
        const distPath = path.join(SERVER_DIR, 'dist/utils', utilName + '.js');
        const utilsPath = path.join(SERVER_DIR, 'utils', utilName + '.js');
        
        if (fs.existsSync(distPath)) {
            return `from ${quote}../dist/utils/${utilName}.js${quote}`;
        } else if (fs.existsSync(utilsPath)) {
            return `from ${quote}../utils/${utilName}.js${quote}`;
        } else {
            // Keep src/utils if neither exists (will be compiled)
            return `from ${quote}../dist/utils/${utilName}.js${quote}`;
        }
    }},
    
    // Services imports - same directory
    { from: /from\s+(['"])\.\.\/src\/services\/([^'"]+)\.js\1/g, to: "from './$2.js'" },
    { from: /from\s+(['"])\.\.\/\.\.\/src\/services\/([^'"]+)\.js\1/g, to: "from '../$2.js'" },
    
    // Middleware imports
    { from: /from\s+(['"])\.\.\/src\/middleware\/([^'"]+)\.js\1/g, to: "from '../middleware/$2.js'" },
    
    // Fix getDatabase pattern
    { from: /import\s+\{\s*getDatabase\s*\}\s+from\s+['"][^'"]+['"];?\s*\n\s*const\s+db\s*=\s*getDatabase\(\);?/g, 
      to: "import db from '../database.js';" },
];

function fixFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf-8');
    const original = content;
    
    replacements.forEach(replacement => {
        if (typeof replacement.to === 'function') {
            content = content.replace(replacement.from, replacement.to);
        } else {
            content = content.replace(replacement.from, replacement.to);
        }
    });
    
    if (content !== original) {
        fs.writeFileSync(filePath, content);
        return true;
    }
    return false;
}

function walkDir(dir) {
    if (!fs.existsSync(dir)) return 0;
    
    let fixed = 0;
    const files = fs.readdirSync(dir);
    
    for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
            fixed += walkDir(fullPath);
        } else if (file.endsWith('.js') && !file.endsWith('.min.js') && !file.endsWith('.map')) {
            if (fixFile(fullPath)) {
                fixed++;
                console.log(`  ✅ ${path.relative(ROOT_DIR, fullPath)}`);
            }
        }
    }
    
    return fixed;
}

console.log('\n🔧 FIXING ALL LEGACY JS IMPORTS\n');

let totalFixed = 0;

// Fix services
console.log('📁 server/services/');
totalFixed += walkDir(path.join(SERVER_DIR, 'services'));

// Fix routes  
console.log('\n📁 server/routes/');
totalFixed += walkDir(path.join(SERVER_DIR, 'routes'));

console.log('\n' + '═'.repeat(60));
console.log(`📊 Total files fixed: ${totalFixed}`);
console.log('═'.repeat(60));
console.log('\n✅ All imports fixed!\n');


