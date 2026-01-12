#!/usr/bin/env node
/**
 * Fix ALL Remaining Import Issues
 * Comprehensive fix for all directories
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');
const SERVER_DIR = path.join(ROOT_DIR, 'server');

function fixFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf-8');
    const original = content;
    
    // Fix src/database/Database.js -> database.js or dist/database/Database.js
    content = content.replace(/from\s+(['"])\.\.\/src\/database\/Database\.js\1/g, "from '../database.js'");
    content = content.replace(/from\s+(['"])\.\.\/\.\.\/src\/database\/Database\.js\1/g, "from '../../database.js'");
    content = content.replace(/from\s+(['"])\.\.\/\.\.\/\.\.\/src\/database\/Database\.js\1/g, "from '../../../database.js'");
    
    // Fix src/utils/ -> dist/utils/ or utils/
    content = content.replace(/from\s+(['"])\.\.\/src\/utils\/([^'"]+)\.js\1/g, "from '../dist/utils/$2.js'");
    content = content.replace(/from\s+(['"])\.\.\/\.\.\/src\/utils\/([^'"]+)\.js\1/g, "from '../../dist/utils/$2.js'");
    
    // Fix src/services/ -> services/ or dist/services/
    content = content.replace(/from\s+(['"])\.\.\/src\/services\/([^'"]+)\.js\1/g, "from '../services/$2.js'");
    content = content.replace(/from\s+(['"])\.\.\/\.\.\/src\/services\/([^'"]+)\.js\1/g, "from '../../services/$2.js'");
    
    // Fix src/middleware/ -> middleware/ or dist/middleware/
    content = content.replace(/from\s+(['"])\.\.\/src\/middleware\/([^'"]+)\.js\1/g, "from '../dist/middleware/$2.js'");
    content = content.replace(/from\s+(['"])\.\.\/\.\.\/src\/middleware\/([^'"]+)\.js\1/g, "from '../../dist/middleware/$2.js'");
    
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

console.log('\n🔧 FIXING ALL REMAINING IMPORTS\n');

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


