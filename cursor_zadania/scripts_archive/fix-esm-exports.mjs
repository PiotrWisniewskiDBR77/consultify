#!/usr/bin/env node
/**
 * Fix ESM Export Syntax
 * 
 * Problem: Files have invalid syntax like:
 *   export {
 *     foo: value1,
 *     bar: value2,
 *   }
 * 
 * This is INVALID ESM! Should be either:
 *   - Named exports: export const foo = value1;
 *   - Or object export: const obj = { foo: value1 }; export default obj;
 * 
 * This script fixes it by converting to proper named exports.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const serverDir = path.join(__dirname, '..', 'server');

// Pattern to find invalid export { ... } blocks with object literal syntax
const invalidExportPattern = /export\s*\{\s*\n([\s\S]*?)\n\s*\};?/g;

function isObjectLiteralExport(content) {
    // Check if it contains "key: value" patterns (object literal) vs "name, name2" (valid named export)
    return /^\s*\w+\s*:/m.test(content);
}

function fixFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    
    // Find all export { ... } blocks
    const matches = [...content.matchAll(invalidExportPattern)];
    
    for (const match of matches) {
        const fullMatch = match[0];
        const innerContent = match[1];
        
        // Check if this is an object literal (invalid) vs named exports (valid)
        if (!isObjectLiteralExport(innerContent)) {
            continue; // This is a valid named export, skip
        }
        
        // Parse the object literal and convert to named exports
        const lines = innerContent.split('\n');
        const namedExports = [];
        
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed === ',' || trimmed.startsWith('//')) continue;
            
            // Match patterns like: "foo: value," or "foo: value"
            const match = trimmed.match(/^(\w+)\s*:\s*(.+?),?\s*(\/\/.*)?$/);
            if (match) {
                const [, name, value, comment] = match;
                const cleanValue = value.replace(/,\s*$/, ''); // Remove trailing comma
                const commentStr = comment ? ` ${comment}` : '';
                namedExports.push(`export const ${name} = ${cleanValue};${commentStr}`);
            }
        }
        
        if (namedExports.length > 0) {
            content = content.replace(fullMatch, namedExports.join('\n'));
            modified = true;
        }
    }
    
    if (modified) {
        fs.writeFileSync(filePath, content, 'utf8');
        return true;
    }
    return false;
}

function findJsFiles(dir, files = []) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        // Skip directories
        if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === 'backup') {
            continue;
        }
        
        if (entry.isDirectory()) {
            findJsFiles(fullPath, files);
        } else if (entry.name.endsWith('.js') && !entry.name.endsWith('.test.js')) {
            files.push(fullPath);
        }
    }
    
    return files;
}

console.log('🔧 Fixing ESM export syntax in server/*.js files...\n');

const files = findJsFiles(serverDir);
let fixedCount = 0;
let errorCount = 0;

for (const file of files) {
    try {
        const relativePath = path.relative(serverDir, file);
        const wasFixed = fixFile(file);
        if (wasFixed) {
            console.log(`✅ Fixed: ${relativePath}`);
            fixedCount++;
        }
    } catch (err) {
        console.error(`❌ Error in ${file}: ${err.message}`);
        errorCount++;
    }
}

console.log(`\n📊 Summary:`);
console.log(`   Fixed: ${fixedCount} files`);
console.log(`   Errors: ${errorCount} files`);
console.log(`   Total scanned: ${files.length} files`);



