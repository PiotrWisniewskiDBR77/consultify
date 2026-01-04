#!/usr/bin/env node
/**
 * Fix All Imports - Automatyczna naprawa importów ES Modules
 * 
 * Naprawia wszystkie błędne importy w server/:
 * - ../services/ → ../src/services/
 * - ../routes/ → ../src/routes/
 * - ../middleware/ → ../src/middleware/
 * - ../ai/ → ../src/ai/ (jeśli plik jest w src/)
 * - ./services/ → ./src/services/ (w niektórych przypadkach)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const serverDir = path.join(__dirname, '..', 'server');
const backupDir = path.join(__dirname, '..', 'backup', `imports-fix-${Date.now()}`);

// Mapowanie starych ścieżek na nowe
const importMappings = [
    // Z ../services/ na ../src/services/
    {
        pattern: /from\s+['"]\.\.\/services\/([^'"]+)['"]/g,
        replacement: (match, p1) => {
            // Sprawdź czy plik istnieje w src/services/
            const srcPath = path.join(serverDir, 'src', 'services', p1);
            if (fs.existsSync(srcPath) || fs.existsSync(srcPath + '.ts') || fs.existsSync(srcPath + '.js')) {
                return `from '../src/services/${p1}'`;
            }
            return match; // Nie zmieniaj jeśli plik nie istnieje w src/
        }
    },
    // Z ../routes/ na ../src/routes/
    {
        pattern: /from\s+['"]\.\.\/routes\/([^'"]+)['"]/g,
        replacement: (match, p1) => {
            const srcPath = path.join(serverDir, 'src', 'routes', p1);
            if (fs.existsSync(srcPath) || fs.existsSync(srcPath + '.ts') || fs.existsSync(srcPath + '.js')) {
                return `from '../src/routes/${p1}'`;
            }
            return match;
        }
    },
    // Z ../middleware/ na ../src/middleware/
    {
        pattern: /from\s+['"]\.\.\/middleware\/([^'"]+)['"]/g,
        replacement: (match, p1) => {
            const srcPath = path.join(serverDir, 'src', 'middleware', p1);
            if (fs.existsSync(srcPath) || fs.existsSync(srcPath + '.ts') || fs.existsSync(srcPath + '.js')) {
                return `from '../src/middleware/${p1}'`;
            }
            return match;
        }
    },
    // Z ../ai/ na ../src/ai/ (jeśli plik jest w src/)
    {
        pattern: /from\s+['"]\.\.\/ai\/([^'"]+)['"]/g,
        replacement: (match, p1) => {
            const srcPath = path.join(serverDir, 'src', 'ai', p1);
            if (fs.existsSync(srcPath) || fs.existsSync(srcPath + '.ts') || fs.existsSync(srcPath + '.js')) {
                return `from '../src/ai/${p1}'`;
            }
            return match;
        }
    },
    // Z ./services/ na ./src/services/ (dla plików w root server/)
    {
        pattern: /from\s+['"]\.\/services\/([^'"]+)['"]/g,
        replacement: (match, p1) => {
            const srcPath = path.join(serverDir, 'src', 'services', p1);
            if (fs.existsSync(srcPath) || fs.existsSync(srcPath + '.ts') || fs.existsSync(srcPath + '.js')) {
                return `from './src/services/${p1}'`;
            }
            return match;
        }
    },
    // Circular imports - jeśli plik importuje sam siebie
    {
        pattern: /from\s+['"]\.\/([^'"]+)\.js['"]/g,
        replacement: (match, p1, filePath) => {
            // Sprawdź czy to nie jest import samego siebie
            const currentFile = path.basename(filePath, '.js');
            if (p1 === currentFile) {
                // To jest circular import - sprawdź czy istnieje w src/
                const srcPath = path.join(path.dirname(filePath), '..', 'src', path.dirname(filePath).split(path.sep).pop(), p1);
                if (fs.existsSync(srcPath + '.ts') || fs.existsSync(srcPath + '.js')) {
                    return `from '../src/${path.dirname(filePath).split(path.sep).pop()}/${p1}.js'`;
                }
            }
            return match;
        }
    }
];

// Specjalne przypadki - pliki które muszą importować z konkretnych miejsc
const specialCases = {
    // database.js może być w root lub src/database/
    'database.js': (content, filePath) => {
        // Jeśli importuje z ../database/ a jest w src/, zmień na ../database/
        return content.replace(/from\s+['"]\.\.\/database\/([^'"]+)['"]/g, (match, p1) => {
            const dbPath = path.join(serverDir, 'database', p1);
            const srcDbPath = path.join(serverDir, 'src', 'database', p1);
            if (fs.existsSync(srcDbPath + '.ts') || fs.existsSync(srcDbPath + '.js')) {
                return `from '../src/database/${p1}'`;
            }
            if (fs.existsSync(dbPath + '.ts') || fs.existsSync(dbPath + '.js')) {
                return match; // Zostaw jak jest
            }
            return match;
        });
    }
};

function findJsFiles(dir, files = []) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        // Skip directories
        if (entry.name === 'node_modules' || 
            entry.name === 'dist' || 
            entry.name === 'backup' ||
            entry.name === '.git' ||
            entry.name.startsWith('.')) {
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

function fixImportsInFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    const originalContent = content;
    let modified = false;
    
    // Sprawdź specjalne przypadki
    const fileName = path.basename(filePath);
    if (specialCases[fileName]) {
        content = specialCases[fileName](content, filePath);
        if (content !== originalContent) {
            modified = true;
        }
    }
    
    // Zastosuj wszystkie mapowania
    for (const mapping of importMappings) {
        const newContent = content.replace(mapping.pattern, (match, ...args) => {
            if (mapping.replacement.length === 3) {
                // Ma parametr filePath
                return mapping.replacement(match, ...args, filePath);
            } else {
                return mapping.replacement(match, ...args);
            }
        });
        
        if (newContent !== content) {
            content = newContent;
            modified = true;
        }
    }
    
    // Napraw circular imports - jeśli plik importuje sam siebie
    const dirName = path.dirname(filePath);
    const baseName = path.basename(filePath, '.js');
    const selfImportPattern = new RegExp(`from\\s+['"]\\./${baseName}\\.js['"]`, 'g');
    if (content.match(selfImportPattern)) {
        // To jest circular import - sprawdź czy istnieje w src/
        const srcDir = path.join(serverDir, 'src', path.relative(serverDir, dirName));
        const srcFile = path.join(srcDir, baseName + '.ts');
        if (fs.existsSync(srcFile)) {
            const relativePath = path.relative(dirName, srcFile).replace(/\\/g, '/');
            content = content.replace(selfImportPattern, `from '${relativePath.startsWith('.') ? relativePath : './' + relativePath}'`);
            modified = true;
        }
    }
    
    if (modified) {
        return content;
    }
    
    return null;
}

console.log('🔧 Automatyczna naprawa importów ES Modules...\n');
console.log(`📁 Server dir: ${serverDir}`);
console.log(`💾 Backup dir: ${backupDir}\n`);

// Utwórz backup
fs.mkdirSync(backupDir, { recursive: true });

const files = findJsFiles(serverDir);
let fixedCount = 0;
let errorCount = 0;
const fixedFiles = [];

console.log(`📊 Znaleziono ${files.length} plików .js do sprawdzenia\n`);

for (const file of files) {
    try {
        const relativePath = path.relative(serverDir, file);
        const fixedContent = fixImportsInFile(file);
        
        if (fixedContent) {
            // Backup
            const backupPath = path.join(backupDir, relativePath);
            fs.mkdirSync(path.dirname(backupPath), { recursive: true });
            fs.copyFileSync(file, backupPath);
            
            // Zapisz naprawiony plik
            fs.writeFileSync(file, fixedContent, 'utf8');
            
            console.log(`✅ ${relativePath}`);
            fixedFiles.push(relativePath);
            fixedCount++;
        }
    } catch (err) {
        console.error(`❌ Błąd w ${file}: ${err.message}`);
        errorCount++;
    }
}

console.log(`\n📊 Podsumowanie:`);
console.log(`   ✅ Naprawiono: ${fixedCount} plików`);
console.log(`   ❌ Błędy: ${errorCount} plików`);
console.log(`   📁 Backup: ${backupDir}`);
console.log(`\n✅ Gotowe!`);

if (fixedFiles.length > 0) {
    console.log(`\n📋 Naprawione pliki:`);
    fixedFiles.slice(0, 20).forEach(f => console.log(`   - ${f}`));
    if (fixedFiles.length > 20) {
        console.log(`   ... i ${fixedFiles.length - 20} więcej`);
    }
}



