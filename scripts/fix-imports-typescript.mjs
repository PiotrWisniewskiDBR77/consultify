#!/usr/bin/env node
/**
 * Fix Imports in TypeScript files
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serverDir = path.join(__dirname, '..', 'server', 'src');

function findTsFiles(dir, files = []) {
    try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory() && entry.name !== 'node_modules') {
                findTsFiles(fullPath, files);
            } else if (entry.name.endsWith('.ts')) {
                files.push(fullPath);
            }
        }
    } catch (err) {}
    return files;
}

function fixFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    const original = content;
    
    // Napraw importy które wskazują na ../services/ zamiast ./services/
    content = content.replace(/from\s+['"]\.\.\/services\/([^'"]+)['"]/g, "from '../services/$1'");
    
    // Jeśli plik jest w src/ i importuje z ../services/, zmień na ./services/
    if (filePath.includes('/src/')) {
        content = content.replace(/from\s+['"]\.\.\/services\/([^'"]+)['"]/g, "from '../services/$1'");
    }
    
    return content !== original ? content : null;
}

const files = findTsFiles(serverDir);
let fixed = 0;

for (const file of files) {
    try {
        const fixedContent = fixFile(file);
        if (fixedContent) {
            fs.writeFileSync(file, fixedContent, 'utf8');
            console.log(`✅ ${path.relative(serverDir, file)}`);
            fixed++;
        }
    } catch (err) {}
}

console.log(`\n📊 Naprawiono ${fixed} plików TypeScript`);


