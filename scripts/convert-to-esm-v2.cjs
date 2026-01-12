#!/usr/bin/env node
/**
 * ESM Converter v2
 * Converts CommonJS files to ES Modules
 * Supports both services and routes patterns
 */

const fs = require('fs');
const path = require('path');

const files = process.argv.slice(2);

if (files.length === 0) {
    console.error('Usage: node convert-to-esm-v2.cjs <file1> <file2> ...');
    console.error('   or: node convert-to-esm-v2.cjs server/routes/*.js');
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

    // Convert require('express') to import
    if (content.match(/const\s+express\s*=\s*require\(['"]express['"]\)/)) {
        content = content.replace(
            /const\s+express\s*=\s*require\(['"]express['"]\)\s*;?/g,
            "import express from 'express';"
        );
        modified = true;
        console.log('  ✓ Converted express import');
    }

    // Convert const router = express.Router()
    if (content.match(/const\s+router\s*=\s*express\.Router\(\)/)) {
        // Already correct, just ensure express is imported
        if (!content.includes("import express from 'express'")) {
            content = "import express from 'express';\n" + content;
            modified = true;
        }
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

    // Convert module.exports = router to export default router
    if (content.match(/module\.exports\s*=\s*router\s*;?/)) {
        content = content.replace(/module\.exports\s*=\s*router\s*;?/g, 'export default router;');
        modified = true;
        console.log('  ✓ Converted module.exports = router');
    }

    // Convert module.exports = ... to export default ...
    if (content.match(/module\.exports\s*=/)) {
        content = content.replace(/module\.exports\s*=\s*/g, 'export default ');
        modified = true;
        console.log('  ✓ Converted module.exports to export default');
    }

    // Convert require() for services with .js extension
    content = content.replace(
        /require\(['"]\.\.\/services\/([^'"]+)['"]\)/g,
        "import('$1.js')"
    );

    // Convert require() for middleware
    if (content.match(/require\(['"]\.\.\/middleware\//)) {
        content = content.replace(
            /const\s+(\w+)\s*=\s*require\(['"]\.\.\/middleware\/([^'"]+)['"]\)\s*;?/g,
            "import $1 from '../middleware/$2.js';"
        );
        modified = true;
        console.log('  ✓ Converted middleware imports');
    }

    // Convert require() to import for common packages
    const requirePatterns = [
        { pattern: /const\s+{\s*v4:\s*uuidv4\s*}\s*=\s*require\(['"]uuid['"]\)\s*;?/g, replacement: "import { v4 as uuidv4 } from 'uuid';" },
        { pattern: /const\s+uuidv4\s*=\s*require\(['"]uuid['"]\)\.v4\s*;?/g, replacement: "import { v4 as uuidv4 } from 'uuid';" },
        { pattern: /const\s+bcrypt\s*=\s*require\(['"]bcrypt['"]\)\s*;?/g, replacement: "import bcrypt from 'bcrypt';" },
        { pattern: /const\s+jwt\s*=\s*require\(['"]jsonwebtoken['"]\)\s*;?/g, replacement: "import jwt from 'jsonwebtoken';" },
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
