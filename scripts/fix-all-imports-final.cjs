#!/usr/bin/env node
/**
 * FINAL Comprehensive Import Fix
 * Fixes ALL import patterns in legacy JS files
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');
const SERVER_DIR = path.join(ROOT_DIR, 'server');

function fixFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf-8');
    const original = content;
    
    // Database imports - all variants
    content = content.replace(/from\s+(['"])\.\.\/src\/database\/index\.js\1/g, "from '../database.js'");
    content = content.replace(/from\s+(['"])\.\.\/\.\.\/src\/database\/index\.js\1/g, "from '../../database.js'");
    content = content.replace(/from\s+(['"])\.\.\/src\/database\/Database\.js\1/g, "from '../database.js'");
    content = content.replace(/from\s+(['"])\.\.\/\.\.\/src\/database\/Database\.js\1/g, "from '../../database.js'");
    content = content.replace(/from\s+(['"])\.\.\/\.\.\/\.\.\/src\/database\/Database\.js\1/g, "from '../../../database.js'");
    
    // Utils imports - check dist/utils/ first
    content = content.replace(/from\s+(['"])\.\.\/src\/utils\/([^'"]+)\.js\1/g, "from '../dist/utils/$2.js'");
    content = content.replace(/from\s+(['"])\.\.\/\.\.\/src\/utils\/([^'"]+)\.js\1/g, "from '../../dist/utils/$2.js'");
    
    // Services - use services/ (legacy) or dist/services/ (compiled)
    content = content.replace(/from\s+(['"])\.\.\/src\/services\/([^'"]+)\.js\1/g, "from '../services/$2.js'");
    content = content.replace(/from\s+(['"])\.\.\/\.\.\/src\/services\/([^'"]+)\.js\1/g, "from '../../services/$2.js'");
    
    // Middleware - use middleware/ (legacy)
    content = content.replace(/from\s+(['"])\.\.\/dist\/middleware\/([^'"]+)\.js\1/g, "from '../middleware/$2.js'");
    content = content.replace(/from\s+(['"])\.\.\/\.\.\/dist\/middleware\/([^'"]+)\.js\1/g, "from '../../middleware/$2.js'");
    content = content.replace(/from\s+(['"])\.\.\/src\/middleware\/([^'"]+)\.js\1/g, "from '../middleware/$2.js'");
    content = content.replace(/from\s+(['"])\.\.\/\.\.\/src\/middleware\/([^'"]+)\.js\1/g, "from '../../middleware/$2.js'");
    
    // Fix .ts imports to .js (shouldn't happen but just in case)
    content = content.replace(/from\s+(['"])([^'"]+)\.ts\1/g, "from $1$2.js$1");
    
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
        
        if (stat.isDirectory() && !file.startsWith('.') && file !== 'node_modules' && file !== 'dist') {
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

console.log('\n🔧 FINAL COMPREHENSIVE IMPORT FIX\n');

let totalFixed = 0;

// Fix all directories
const dirs = ['ai', 'routes', 'services', 'utils', 'middleware', 'cron'];
for (const dir of dirs) {
    const dirPath = path.join(SERVER_DIR, dir);
    if (fs.existsSync(dirPath)) {
        console.log(`📁 server/${dir}/`);
        totalFixed += walkDir(dirPath);
    }
}

console.log('\n' + '═'.repeat(60));
console.log(`📊 Total files fixed: ${totalFixed}`);
console.log('═'.repeat(60));
console.log('\n✅ All imports fixed!\n');


