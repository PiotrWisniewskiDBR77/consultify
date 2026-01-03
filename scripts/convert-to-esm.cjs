#!/usr/bin/env node
/**
 * ESM Converter
 * Converts CommonJS files to ES Modules
 */

const fs = require('fs');
const path = require('path');

const files = process.argv.slice(2);

if (files.length === 0) {
    console.error('Usage: node convert-to-esm.cjs <file1> <file2> ...');
    process.exit(1);
}

function convertFile(filePath) {
    console.log(`\n🔄 Converting: ${filePath}`);

    let content = fs.readFileSync(filePath, 'utf-8');
    let modified = false;

    // Remove createRequire pattern
    if (content.includes('createRequire')) {
        content = content.replace(/import\s+{\s*createRequire\s*}\s+from\s+['"]module['"]\s*;?\s*/g, '');
        content = content.replace(/const\s+require\s*=\s*createRequire\(import\.meta\.url\)\s*;?\s*/g, '');
        modified = true;
        console.log('  ✓ Removed createRequire');
    }

    // Convert require('../database') to import
    if (content.match(/require\(['"]\.\.\/database['"]\)/)) {
        content = content.replace(
            /const\s+db\s*=\s*require\(['"]\.\.\/database['"]\)\s*;?/g,
            "import { getDatabase } from '../database/Database.js';\nconst db = getDatabase();"
        );
        modified = true;
        console.log('  ✓ Converted database import');
    }

    // Convert require('../db/sqliteAsync') patterns
    content = content.replace(
        /require\(['"]\.\.\/db\/sqliteAsync['"]\)/g,
        "getDatabase()"
    );

    // Convert module.exports to export default
    if (content.match(/module\.exports\s*=/)) {
        content = content.replace(/module\.exports\s*=\s*/g, 'export default ');
        modified = true;
        console.log('  ✓ Converted module.exports to export default');
    }

    // Convert require() to import for common packages
    const requirePatterns = [
        { pattern: /const\s+{\s*v4:\s*uuidv4\s*}\s*=\s*require\(['"]uuid['"]\)\s*;?/g, replacement: "import { v4 as uuidv4 } from 'uuid';" },
        { pattern: /const\s+uuidv4\s*=\s*require\(['"]uuid['"]\)\.v4\s*;?/g, replacement: "import { v4 as uuidv4 } from 'uuid';" },
    ];

    requirePatterns.forEach(({ pattern, replacement }) => {
        if (content.match(pattern)) {
            content = content.replace(pattern, replacement);
            modified = true;
        }
    });

    if (modified) {
        fs.writeFileSync(filePath, content);
        console.log(`  ✅ Converted successfully`);
        return true;
    } else {
        console.log(`  ⏭️  No changes needed`);
        return false;
    }
}

let converted = 0;
files.forEach(file => {
    if (convertFile(file)) {
        converted++;
    }
});

console.log(`\n📊 Summary: ${converted}/${files.length} files converted`);
