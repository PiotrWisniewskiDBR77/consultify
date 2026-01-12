#!/usr/bin/env node
/**
 * MEGA Comprehensive Import Fix
 * Fixes ALL import patterns in ALL legacy JS files across ALL directories
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');
const SERVER_DIR = path.join(ROOT_DIR, 'server');

function fixFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf-8');
    const original = content;
    
    // ALL src/ imports -> dist/ (for compiled TypeScript)
    content = content.replace(/from\s+(['"])\.\.\/src\//g, "from $1../dist/");
    content = content.replace(/from\s+(['"])\.\.\/\.\.\/src\//g, "from $1../../dist/");
    content = content.replace(/from\s+(['"])\.\.\/\.\.\/\.\.\/src\//g, "from $1../../../dist/");
    
    // Database - special case: database.js is in root
    content = content.replace(/from\s+(['"])\.\.\/dist\/database\/index\.js\1/g, "from '../database.js'");
    content = content.replace(/from\s+(['"])\.\.\/\.\.\/dist\/database\/index\.js\1/g, "from '../../database.js'");
    content = content.replace(/from\s+(['"])\.\.\/dist\/database\/Database\.js\1/g, "from '../database.js'");
    content = content.replace(/from\s+(['"])\.\.\/\.\.\/dist\/database\/Database\.js\1/g, "from '../../database.js'");
    
    // Middleware - use middleware/ (legacy JS), not dist/middleware/
    content = content.replace(/from\s+(['"])\.\.\/dist\/middleware\/([^'"]+)\.js\1/g, "from '../middleware/$2.js'");
    content = content.replace(/from\s+(['"])\.\.\/\.\.\/dist\/middleware\/([^'"]+)\.js\1/g, "from '../../middleware/$2.js'");
    
    // Utils - prefer dist/utils/ (compiled)
    // Services - prefer dist/services/ (compiled) or services/ (legacy)
    
    // Fix .ts imports to .js
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
        
        if (stat.isDirectory() && !file.startsWith('.') && file !== 'node_modules' && file !== 'dist' && file !== 'src') {
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

console.log('\n🔧 MEGA COMPREHENSIVE IMPORT FIX\n');

let totalFixed = 0;

// Fix ALL directories
const dirs = ['ai', 'routes', 'services', 'utils', 'middleware', 'cron', 'queues', 'database'];
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


