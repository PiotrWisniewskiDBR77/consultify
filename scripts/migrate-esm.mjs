#!/usr/bin/env node
/**
 * ES Modules Migration Script
 * 
 * Automatyczna konwersja plików CommonJS do ES Modules:
 * 1. const X = require('path') -> import X from 'path.js'
 * 2. const { X, Y } = require('path') -> import { X, Y } from 'path.js'
 * 3. Dodanie named exports gdzie brakuje
 * 4. Naprawa podwójnych rozszerzeń .js.js
 * 
 * Użycie: node scripts/migrate-esm.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SERVER_DIR = path.join(__dirname, '..', 'server');

// Statystyki
const stats = {
    filesScanned: 0,
    requiresConverted: 0,
    exportsAdded: 0,
    errors: []
};

/**
 * Rekurencyjne pobieranie plików .js
 */
function getJsFiles(dir, files = []) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        // Pomijamy node_modules, dist, testy
        if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.cache') {
            continue;
        }
        
        if (entry.isDirectory()) {
            getJsFiles(fullPath, files);
        } else if (entry.isFile() && entry.name.endsWith('.js') && !entry.name.endsWith('.test.js') && !entry.name.endsWith('.cjs')) {
            files.push(fullPath);
        }
    }
    
    return files;
}

/**
 * Konwersja require() na import
 */
function convertRequiresToImports(content, filePath) {
    let modified = false;
    let newContent = content;
    
    // Wzorzec 1: const X = require('path')
    const simpleRequireRegex = /^const\s+(\w+)\s*=\s*require\(['"]([^'"]+)['"]\);?$/gm;
    newContent = newContent.replace(simpleRequireRegex, (match, varName, importPath) => {
        modified = true;
        // Dodaj .js jeśli to lokalny import bez rozszerzenia
        const ext = importPath.startsWith('.') && !importPath.endsWith('.js') && !importPath.endsWith('.json') ? '.js' : '';
        return `import ${varName} from '${importPath}${ext}';`;
    });
    
    // Wzorzec 2: const { X, Y } = require('path')
    const destructuredRequireRegex = /^const\s*\{\s*([^}]+)\s*\}\s*=\s*require\(['"]([^'"]+)['"]\);?$/gm;
    newContent = newContent.replace(destructuredRequireRegex, (match, vars, importPath) => {
        modified = true;
        const ext = importPath.startsWith('.') && !importPath.endsWith('.js') && !importPath.endsWith('.json') ? '.js' : '';
        return `import { ${vars.trim()} } from '${importPath}${ext}';`;
    });
    
    // Wzorzec 3: const { X: aliasX } = require('path') - aliasy
    // np. const { v4: uuidv4 } = require('uuid')
    const aliasRequireRegex = /^const\s*\{\s*(\w+)\s*:\s*(\w+)\s*\}\s*=\s*require\(['"]([^'"]+)['"]\);?$/gm;
    newContent = newContent.replace(aliasRequireRegex, (match, original, alias, importPath) => {
        modified = true;
        const ext = importPath.startsWith('.') && !importPath.endsWith('.js') && !importPath.endsWith('.json') ? '.js' : '';
        return `import { ${original} as ${alias} } from '${importPath}${ext}';`;
    });
    
    // Napraw podwójne .js.js
    newContent = newContent.replace(/\.js\.js(['"])/g, '.js$1');
    
    if (modified) {
        stats.requiresConverted++;
    }
    
    return { content: newContent, modified };
}

/**
 * Dodanie named exports gdzie brakuje
 */
function addNamedExports(content, filePath) {
    let modified = false;
    let newContent = content;
    
    // Sprawdź czy ma export default { bez export {
    const hasDefaultExport = /^export\s+default\s+\{/m.test(newContent);
    const hasNamedExport = /^export\s+\{/m.test(newContent);
    
    if (hasDefaultExport && !hasNamedExport) {
        // Wyciągnij zawartość export default { ... }
        const defaultExportMatch = newContent.match(/^export\s+default\s+\{([^}]+)\}/m);
        
        if (defaultExportMatch) {
            const exports = defaultExportMatch[1].trim();
            
            // Sprawdź czy nie są to tylko funkcje/klasy (czyli nie { name, name2 })
            if (exports && !exports.includes('=>') && !exports.includes('function')) {
                // Dodaj named export przed export default
                const namedExport = `export {\n${exports}\n};\n\n`;
                newContent = newContent.replace(/^(export\s+default\s+\{)/m, namedExport + '$1');
                modified = true;
                stats.exportsAdded++;
            }
        }
    }
    
    return { content: newContent, modified };
}

/**
 * Przetwarzanie pojedynczego pliku
 */
function processFile(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        stats.filesScanned++;
        
        // Konwersja require -> import
        const { content: content1, modified: mod1 } = convertRequiresToImports(content, filePath);
        
        // Dodanie named exports
        const { content: content2, modified: mod2 } = addNamedExports(content1, filePath);
        
        // Zapisz jeśli zmodyfikowano
        if (mod1 || mod2) {
            fs.writeFileSync(filePath, content2, 'utf8');
            const relativePath = path.relative(process.cwd(), filePath);
            console.log(`✅ ${relativePath}`);
            return true;
        }
        
        return false;
    } catch (error) {
        stats.errors.push({ file: filePath, error: error.message });
        console.error(`❌ ${filePath}: ${error.message}`);
        return false;
    }
}

/**
 * Główna funkcja
 */
async function main() {
    console.log('\n🚀 ES Modules Migration Script\n');
    console.log(`📁 Skanowanie: ${SERVER_DIR}\n`);
    
    // Pobierz wszystkie pliki .js
    const files = getJsFiles(SERVER_DIR);
    console.log(`📊 Znaleziono ${files.length} plików .js do przetworzenia\n`);
    
    let modifiedCount = 0;
    
    // Przetwórz każdy plik
    for (const file of files) {
        if (processFile(file)) {
            modifiedCount++;
        }
    }
    
    // Podsumowanie
    console.log('\n' + '='.repeat(60));
    console.log('📊 PODSUMOWANIE MIGRACJI');
    console.log('='.repeat(60));
    console.log(`   Plików przeskanowanych: ${stats.filesScanned}`);
    console.log(`   Plików zmodyfikowanych: ${modifiedCount}`);
    console.log(`   Konwersji require->import: ${stats.requiresConverted}`);
    console.log(`   Dodanych named exports: ${stats.exportsAdded}`);
    
    if (stats.errors.length > 0) {
        console.log(`\n⚠️  Błędy (${stats.errors.length}):`);
        stats.errors.forEach(e => console.log(`   - ${e.file}: ${e.error}`));
    }
    
    console.log('\n✅ Migracja zakończona!\n');
    console.log('Następne kroki:');
    console.log('1. Uruchom: npm run dev');
    console.log('2. Sprawdź logi błędów');
    console.log('3. Napraw pozostałe problemy ręcznie\n');
}

main().catch(console.error);

