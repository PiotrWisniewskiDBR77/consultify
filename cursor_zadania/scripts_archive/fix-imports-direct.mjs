#!/usr/bin/env node
/**
 * Fix Imports - Bezpośrednia zamiana bez sprawdzania
 * Zamienia wszystkie ../services/ na ../src/services/ itp.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serverDir = path.join(__dirname, '..', 'server');
const backupDir = path.join(__dirname, '..', 'backup', `imports-fix-direct-${Date.now()}`);

function findJsFiles(dir, files = []) {
    const excludeDirs = ['node_modules', 'dist', 'backup', '.git', 'trash_node_modules', '__mocks__'];
    
    try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            
            if (entry.isDirectory()) {
                if (!excludeDirs.includes(entry.name) && !entry.name.startsWith('.')) {
                    findJsFiles(fullPath, files);
                }
            } else if (entry.name.endsWith('.js') && !entry.name.endsWith('.test.js')) {
                files.push(fullPath);
            }
        }
    } catch (err) {
        // Ignore
    }
    
    return files;
}

function fixFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    const original = content;
    
    // Zamień wszystkie ../services/ na ../src/services/
    content = content.replace(/from\s+['"]\.\.\/services\/([^'"]+)['"]/g, "from '../src/services/$1'");
    
    // Zamień wszystkie ../routes/ na ../src/routes/
    content = content.replace(/from\s+['"]\.\.\/routes\/([^'"]+)['"]/g, "from '../src/routes/$1'");
    
    // Zamień wszystkie ../middleware/ na ../src/middleware/
    content = content.replace(/from\s+['"]\.\.\/middleware\/([^'"]+)['"]/g, "from '../src/middleware/$1'");
    
    // Zamień wszystkie ../ai/ na ../src/ai/ (jeśli plik jest w src/)
    content = content.replace(/from\s+['"]\.\.\/ai\/([^'"]+)['"]/g, "from '../src/ai/$1'");
    
    // Zamień wszystkie ../database/ na ../src/database/
    content = content.replace(/from\s+['"]\.\.\/database\/([^'"]+)['"]/g, "from '../src/database/$1'");
    
    // Zamień wszystkie ../utils/ na ../src/utils/ (jeśli plik jest w src/)
    content = content.replace(/from\s+['"]\.\.\/utils\/([^'"]+)['"]/g, "from '../src/utils/$1'");
    
    return content !== original ? content : null;
}

console.log('🔧 Naprawianie importów (bezpośrednia zamiana)...\n');

fs.mkdirSync(backupDir, { recursive: true });

const files = findJsFiles(serverDir);
let fixed = 0;
let errors = 0;
const fixedFiles = [];

console.log(`📊 Sprawdzam ${files.length} plików...\n`);

for (const file of files) {
    try {
        const fixedContent = fixFile(file);
        if (fixedContent) {
            const relPath = path.relative(serverDir, file);
            const backupPath = path.join(backupDir, relPath);
            fs.mkdirSync(path.dirname(backupPath), { recursive: true });
            fs.copyFileSync(file, backupPath);
            fs.writeFileSync(file, fixedContent, 'utf8');
            console.log(`✅ ${relPath}`);
            fixedFiles.push(relPath);
            fixed++;
        }
    } catch (err) {
        console.error(`❌ ${path.relative(serverDir, file)}: ${err.message}`);
        errors++;
    }
}

console.log(`\n📊 Podsumowanie:`);
console.log(`   ✅ Naprawiono: ${fixed} plików`);
console.log(`   ❌ Błędy: ${errors} plików`);
console.log(`   💾 Backup: ${backupDir}`);

if (fixedFiles.length > 0 && fixedFiles.length <= 50) {
    console.log(`\n📋 Naprawione pliki:`);
    fixedFiles.forEach(f => console.log(`   - ${f}`));
}



