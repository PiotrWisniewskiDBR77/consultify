import fs from 'fs';
import path from 'path';

// Define the whitelist of files to process or a glob pattern manually
// For now, I will scan server/routes and server/middleware and server/utils
// And apply replacements.

const dirs = [
    'server/routes',
    'server/middleware',
    'server/utils'
];

// Patterns to replace
// 1. const X = require('Y'); -> import X from 'Y';
// 2. const { X } = require('Y'); -> import { X } from 'Y';
// 3. const X = require('./Y'); -> import X from './Y.js';
// 4. const X = require('../Y'); -> import X from '../Y.js';

function processFile(filePath) {
    if (!filePath.endsWith('.js') && !filePath.endsWith('.ts')) return;
    
    let content = fs.readFileSync(filePath, 'utf8');
    let originalContent = content;

    // Handle require('crypto')
    if (content.includes("require('crypto')")) {
         // Add import if not present
         if (!content.includes("import crypto from 'crypto'")) {
             content = "import crypto from 'crypto';\n" + content;
         }
         content = content.replace(/require\('crypto'\)/g, 'crypto');
    }
    
    // Handle require('uuid')
    if (content.includes("require('uuid')")) {
         if (!content.includes("import { v4 as uuidv4 } from 'uuid'")) {
             content = "import { v4 as uuidv4 } from 'uuid';\n" + content;
         }
         content = content.replace(/require\('uuid'\)\.v4\(\)/g, 'uuidv4()');
    }

    // Replace const { X } = require('Y') with import { X } from 'Y'
    // This is complex because of multiline. We'll handle single line for now.
    
    // Standard named imports
    content = content.replace(/const\s+\{\s*([a-zA-Z0-9_,\s]+)\s*\}\s*=\s*require\(['"]([^'"]+)['"]\);/g, (match, imports, modulePath) => {
        if (modulePath.startsWith('.')) {
             return `import { ${imports} } from '${modulePath}.js';`;
        }
        return `import { ${imports} } from '${modulePath}';`;
    });

    // Standard default imports
    content = content.replace(/const\s+([a-zA-Z0-9_]+)\s*=\s*require\(['"]([^'"]+)['"]\);/g, (match, varName, modulePath) => {
        if (modulePath.startsWith('.')) {
            // Check if it's .json
            if (modulePath.endsWith('.json')) return match; 
            return `import ${varName} from '${modulePath}.js';`;
        }
        return `import ${varName} from '${modulePath}';`;
    });
    
    // Handle requireRole specifically if missed
    // const { requireRole } = require('../middleware/rbac');
    // -> import { requireRole } from '../middleware/rbac.js'; (Handled by named imports above mostly)
    
    // Cleanup double .js.js
    content = content.replace(/\.js\.js/g, '.js');

    if (content !== originalContent) {
        console.log(`Updating ${filePath}`);
        fs.writeFileSync(filePath, content);
    }
}

function processDir(dir) {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            processDir(fullPath);
        } else {
            processFile(fullPath);
        }
    }
}

dirs.forEach(d => processDir(d));

