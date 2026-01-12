#!/usr/bin/env node
/**
 * Fix All Imports - Prosta wersja
 * Naprawia tylko najczęstsze przypadki błędnych importów
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serverDir = path.join(__dirname, '..', 'server');
const backupDir = path.join(__dirname, '..', 'backup', `imports-fix-${Date.now()}`);

// Proste mapowania - tylko najważniejsze przypadki
const replacements = [
    // ../services/ → ../src/services/ (jeśli plik istnieje w src/)
    {
        pattern: /from\s+['"]\.\.\/services\/([^'"]+)['"]/g,
        check: (p1) => {
            const srcPath = path.join(serverDir, 'src', 'services', p1);
            return fs.existsSync(srcPath + '.ts') || fs.existsSync(srcPath + '.js');
        },
        replace: (match, p1) => `from '../src/services/${p1}'`
    },
    // ../routes/ → ../src/routes/
    {
        pattern: /from\s+['"]\.\.\/routes\/([^'"]+)['"]/g,
        check: (p1) => {
            const srcPath = path.join(serverDir, 'src', 'routes', p1);
            return fs.existsSync(srcPath + '.ts') || fs.existsSync(srcPath + '.js');
        },
        replace: (match, p1) => `from '../src/routes/${p1}'`
    },
    // ../middleware/ → ../src/middleware/
    {
        pattern: /from\s+['"]\.\.\/middleware\/([^'"]+)['"]/g,
        check: (p1) => {
            const srcPath = path.join(serverDir, 'src', 'middleware', p1);
            return fs.existsSync(srcPath + '.ts') || fs.existsSync(srcPath + '.js');
        },
        replace: (match, p1) => `from '../src/middleware/${p1}'`
    },
    // Circular import - jeśli plik importuje sam siebie, zmień na src/
    {
        pattern: /from\s+['"]\.\/([^'"]+)\.js['"]/g,
        check: (p1, filePath) => {
            const fileName = path.basename(filePath, '.js');
            if (p1 === fileName) {
                const dir = path.dirname(filePath);
                const srcDir = path.join(serverDir, 'src', path.relative(serverDir, dir));
                return fs.existsSync(path.join(srcDir, p1 + '.ts')) || fs.existsSync(path.join(srcDir, p1 + '.js'));
            }
            return false;
        },
        replace: (match, p1, filePath) => {
            const dir = path.dirname(filePath);
            const srcDir = path.join(serverDir, 'src', path.relative(serverDir, dir));
            const relativePath = path.relative(dir, path.join(srcDir, p1 + '.js')).replace(/\\/g, '/');
            return `from '${relativePath.startsWith('.') ? relativePath : './' + relativePath}'`;
        }
    }
];

function findJsFiles(dir, files = [], excludeDirs = ['node_modules', 'dist', 'backup', '.git', 'trash_node_modules']) {
    try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            
            if (entry.isDirectory()) {
                if (!excludeDirs.includes(entry.name) && !entry.name.startsWith('.')) {
                    findJsFiles(fullPath, files, excludeDirs);
                }
            } else if (entry.name.endsWith('.js') && !entry.name.endsWith('.test.js') && !entry.name.includes('node_modules')) {
                files.push(fullPath);
            }
        }
    } catch (err) {
        // Ignore errors
    }
    
    return files;
}

function fixFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    const original = content;
    
    for (const { pattern, check, replace } of replacements) {
        content = content.replace(pattern, (match, ...args) => {
            if (check(args[0], filePath)) {
                return replace(match, ...args, filePath);
            }
            return match;
        });
    }
    
    return content !== original ? content : null;
}

console.log('🔧 Naprawianie importów...\n');

fs.mkdirSync(backupDir, { recursive: true });

const files = findJsFiles(serverDir);
let fixed = 0;
let errors = 0;

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
            fixed++;
        }
    } catch (err) {
        errors++;
    }
}

console.log(`\n📊 Naprawiono: ${fixed} plików`);
console.log(`❌ Błędy: ${errors} plików`);
console.log(`💾 Backup: ${backupDir}`);


