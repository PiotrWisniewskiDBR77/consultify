#!/usr/bin/env node

/**
 * Automatic CommonJS to ES Modules Migration Script
 * 
 * Migrates service files from CommonJS (require/module.exports) to ES modules
 * using dependency injection pattern with lazy loading.
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { promisify } from 'util';
import globPkg from 'glob';
const { glob: globSync } = globPkg;
const glob = promisify(globSync);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TARGET_DIR = path.join(__dirname, '../server/services');
const BACKUP_BASE_DIR = path.join(__dirname, '../backup-pre-migration');

// Built-in Node.js modules that should use direct import
const BUILT_IN_MODULES = new Set([
    'fs', 'path', 'crypto', 'http', 'https', 'url', 'util', 
    'stream', 'events', 'buffer', 'os', 'process', 'child_process'
]);

function resolveImportPath(modulePath) {
    return modulePath.startsWith('.') ? `${modulePath}.js` : modulePath;
}

function insertCreateRequire(content) {
    const lines = content.split('\n');
    let insertIndex = 0;
    let i = 0;

    while (i < lines.length) {
        const line = lines[i].trim();
        if (line === '' || line.startsWith('//') || line.startsWith('/*') || line.startsWith('*')) {
            i += 1;
            insertIndex = i;
            continue;
        }
        if (line.startsWith('import ')) {
            i += 1;
            insertIndex = i;
            continue;
        }
        break;
    }

    const createRequireLines = [
        "import { createRequire } from 'module';",
        'const require = createRequire(import.meta.url);',
        ''
    ];

    lines.splice(insertIndex, 0, ...createRequireLines);
    return lines.join('\n');
}

function removeCreateRequire(content) {
    const lines = content.split('\n');
    const filtered = lines.filter(line => {
        const trimmed = line.trim();
        return trimmed !== "import { createRequire } from 'module';"
            && trimmed !== 'const require = createRequire(import.meta.url);';
    });
    return filtered.join('\n');
}

function insertImportLines(content, importLines) {
    if (!importLines || importLines.length === 0) {
        return content;
    }

    const lines = content.split('\n');
    let insertIndex = 0;

    while (insertIndex < lines.length) {
        const line = lines[insertIndex].trim();
        if (line === '' || line.startsWith('//') || line.startsWith('/*') || line.startsWith('*') || line.startsWith('import ')) {
            insertIndex += 1;
            continue;
        }
        break;
    }

    lines.splice(insertIndex, 0, ...importLines, '');
    return lines.join('\n');
}

function buildImportLines(importsByModule) {
    const importLines = [];
    for (const [modulePath, entry] of importsByModule.entries()) {
        const namedParts = [];
        for (const [importName, localName] of entry.named.entries()) {
            if (importName === localName) {
                namedParts.push(importName);
            } else {
                namedParts.push(`${importName} as ${localName}`);
            }
        }

        if (entry.defaultName && namedParts.length > 0) {
            importLines.push(`import ${entry.defaultName}, { ${namedParts.join(', ')} } from '${modulePath}';`);
        } else if (entry.defaultName) {
            importLines.push(`import ${entry.defaultName} from '${modulePath}';`);
        } else if (namedParts.length > 0) {
            importLines.push(`import { ${namedParts.join(', ')} } from '${modulePath}';`);
        }
    }
    return importLines;
}

function convertDepsObjectRequires(content) {
    const lines = content.split('\n');
    const depsStartIndex = lines.findIndex(line => /^const\s+deps\s*=\s*\{\s*$/.test(line.trim()));

    if (depsStartIndex === -1) {
        return { content, converted: false };
    }

    let depsEndIndex = -1;
    for (let i = depsStartIndex + 1; i < lines.length; i += 1) {
        if (/^\s*\};\s*$/.test(lines[i])) {
            depsEndIndex = i;
            break;
        }
    }

    if (depsEndIndex === -1) {
        return { content, converted: false };
    }

    const importsByModule = new Map();
    const getEntry = (modulePath) => {
        if (!importsByModule.has(modulePath)) {
            importsByModule.set(modulePath, { defaultName: null, named: new Map() });
        }
        return importsByModule.get(modulePath);
    };

    let convertedAny = false;

    for (let i = depsStartIndex + 1; i < depsEndIndex; i += 1) {
        const line = lines[i];
        const match = line.match(/^\s*([A-Za-z_$][\w$]*)\s*:\s*require\(\s*['"]([^'"]+)['"]\s*\)(?:\.(\w+))?\s*,?\s*$/);
        if (!match) {
            continue;
        }

        const [, key, modulePathRaw, memberName] = match;
        const modulePath = resolveImportPath(modulePathRaw);
        const entry = getEntry(modulePath);

        if (memberName) {
            if (memberName === 'default') {
                entry.defaultName = key;
            } else {
                entry.named.set(memberName, key);
            }
        } else {
            entry.defaultName = key;
        }

        const indentMatch = line.match(/^\s*/);
        const indent = indentMatch ? indentMatch[0] : '';
        lines[i] = `${indent}${key},`;
        convertedAny = true;
    }

    if (!convertedAny) {
        return { content, converted: false };
    }

    const importLines = buildImportLines(importsByModule);
    const updatedContent = insertImportLines(lines.join('\n'), importLines);

    return { content: updatedContent, converted: true };
}

function convertTopLevelRequiresToImports(content) {
    const requireMatches = extractRequireStatements(content);
    if (requireMatches.length === 0) {
        return { content, converted: false };
    }

    const importsByModule = new Map();
    const skippedMatches = new Set();

    const getEntry = (modulePath) => {
        if (!importsByModule.has(modulePath)) {
            importsByModule.set(modulePath, { defaultName: null, named: new Map() });
        }
        return importsByModule.get(modulePath);
    };

    for (const match of requireMatches) {
        const modulePath = resolveImportPath(match.modulePath);
        const entry = getEntry(modulePath);

        if (match.type === 'simple') {
            if (entry.defaultName && entry.defaultName !== match.varName) {
                skippedMatches.add(match);
                continue;
            }
            entry.defaultName = match.varName;
            continue;
        }

        if (match.type === 'destructure') {
            entry.named.set(match.importName, match.varName);
            continue;
        }

        if (match.type === 'member') {
            if (match.memberName === 'default') {
                if (entry.defaultName && entry.defaultName !== match.varName) {
                    skippedMatches.add(match);
                    continue;
                }
                entry.defaultName = match.varName;
                continue;
            }
            entry.named.set(match.memberName, match.varName);
        }
    }

    const importLines = buildImportLines(importsByModule);

    if (importLines.length === 0) {
        return { content, converted: false };
    }

    const lines = insertImportLines(content, importLines).split('\n');

    const removeSet = new Set(
        requireMatches.filter(match => !skippedMatches.has(match)).map(match => match.fullMatch.trim())
    );
    const filteredLines = lines.filter(line => !removeSet.has(line.trim()));

    return { content: filteredLines.join('\n'), converted: true };
}

/**
 * Main migration function
 */
async function runMigration(options = {}) {
    const { dryRun = false } = options;
    
    console.log('🚀 ROZPOCZYNAM AUTOMATYCZNĄ MIGRACJĘ ES MODULES...\n');
    
    // 1. Find files to migrate
    const files = await findFilesToMigrate();
    console.log(`📁 Znaleziono ${files.length} plików do migracji\n`);
    
    if (files.length === 0) {
        console.log('✅ Wszystkie pliki są już zmigrowane!');
        return;
    }
    
    // 2. Create backup
    let backupDir = null;
    if (!dryRun) {
        backupDir = await createBackup(files);
        console.log(`💾 Backup utworzony w: ${backupDir}\n`);
    } else {
        console.log(`💾 [DRY RUN] Backup zostałby utworzony\n`);
    }
    
    // 3. Migrate files
    const results = await migrateFiles(files, { dryRun });
    
    // 4. Print summary
    printSummary(results, backupDir, dryRun);
    
    return results;
}

/**
 * Find files requiring migration
 */
async function findFilesToMigrate() {
    const allFiles = await glob('**/*.js', {
        cwd: TARGET_DIR,
        absolute: true,
        ignore: [
            '**/node_modules/**',
            '**/__mocks__/**',
            '**/integrations/**',
            '**/ai/**'
        ]
    });
    
    // Ensure allFiles is an array
    const filesArray = Array.isArray(allFiles) ? allFiles : [];
    
    const filesToMigrate = [];
    
    for (const file of filesArray) {
        try {
            const content = await fs.readFile(file, 'utf-8');
            
            // Check if file needs migration
            const hasRequire = /require\s*\(/.test(content);
            const hasModuleExports = /module\.exports/.test(content);
            
            if (hasRequire || hasModuleExports) {
                filesToMigrate.push(file);
            }
        } catch (error) {
            console.error(`⚠️  Błąd czytania pliku ${file}:`, error.message);
        }
    }
    
    return filesToMigrate;
}

/**
 * Create backup of all files
 */
async function createBackup(files) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const backupDir = path.join(BACKUP_BASE_DIR, timestamp);
    
    await fs.mkdir(backupDir, { recursive: true });
    
    for (const file of files) {
        const relativePath = path.relative(TARGET_DIR, file);
        const backupPath = path.join(backupDir, relativePath);
        const backupFileDir = path.dirname(backupPath);
        
        await fs.mkdir(backupFileDir, { recursive: true });
        await fs.copyFile(file, backupPath);
    }
    
    return backupDir;
}

/**
 * Migrate all files
 */
async function migrateFiles(files, options = {}) {
    const { dryRun = false } = options;
    
    const results = {
        success: [],
        failed: [],
        skipped: [],
        warnings: []
    };
    
    for (const file of files) {
        try {
            const result = await migrateFile(file, { dryRun });
            
            if (result === 'success') {
                results.success.push(file);
                if (!dryRun) {
                    console.log(`✅ ${path.basename(file)}`);
                } else {
                    console.log(`✅ [DRY RUN] ${path.basename(file)}`);
                }
            } else if (result === 'skipped') {
                results.skipped.push(file);
                console.log(`⏭️  ${path.basename(file)} (już zmigrowany)`);
            } else if (result.warning) {
                results.warnings.push({ file, warning: result.warning });
                console.log(`⚠️  ${path.basename(file)} - ${result.warning}`);
            }
        } catch (error) {
            results.failed.push({ file, error: error.message });
            console.log(`❌ ${path.basename(file)} - ${error.message}`);
        }
    }
    
    return results;
}

/**
 * Migrate single file
 */
async function migrateFile(filePath, options = {}) {
    const { dryRun = false } = options;
    
    const content = await fs.readFile(filePath, 'utf-8');
    
    // Check if file already migrated
    if (!content.includes('require(') && !content.includes('module.exports')) {
        return 'skipped';
    }
    
    // Transform file content
    const transformed = transformFileContent(content, filePath);
    
    if (!transformed) {
        return { warning: 'Nie można automatycznie zmigrować - wymaga ręcznej korekty' };
    }
    
    // Save file if not dry run
    if (!dryRun) {
        await fs.writeFile(filePath, transformed.content, 'utf-8');
    }
    
    return 'success';
}

/**
 * Transform file content from CommonJS to ES modules
 */
function transformFileContent(content, filePath) {
    if (!/require\s*\(|module\.exports/.test(content)) {
        return null;
    }

    let result = transformModuleExports(content);

    const depsConverted = convertDepsObjectRequires(result);
    result = depsConverted.content;

    const converted = convertTopLevelRequiresToImports(result);
    result = converted.content;

    if (/require\s*\(/.test(result)) {
        if (!/createRequire\s*\(/.test(result)) {
            result = insertCreateRequire(result);
        }
    } else if (/createRequire\s*\(/.test(result)) {
        result = removeCreateRequire(result);
    }

    return { content: result };
}

/**
 * Extract all require statements from content
 */
function extractRequireStatements(content) {
    const matches = [];
    
    // Pattern 1: Simple require - const name = require('module');
    const simplePattern = /^(?:const|let|var)\s+(\w+)\s*=\s*require\s*\(\s*['"]([^'"]+)['"]\s*\);?\s*$/gm;
    let match;
    while ((match = simplePattern.exec(content)) !== null) {
        matches.push({
            fullMatch: match[0],
            varName: match[1],
            modulePath: match[2],
            type: 'simple',
            line: content.substring(0, match.index).split('\n').length
        });
    }
    
    // Pattern 2: Destructuring - const { v4: uuidv4 } = require('uuid');
    const destructurePattern = /^(?:const|let|var)\s+\{\s*([^}]+)\s*\}\s*=\s*require\s*\(\s*['"]([^'"]+)['"]\s*\);?\s*$/gm;
    while ((match = destructurePattern.exec(content)) !== null) {
        const destructure = match[1].trim();
        const items = destructure.split(',').map(item => item.trim()).filter(Boolean);
        const line = content.substring(0, match.index).split('\n').length;
        
        for (const item of items) {
            const parts = item.split(':').map(s => s.trim()).filter(Boolean);
            const importName = parts[0];
            const varName = parts.length > 1 ? parts[1] : parts[0];
            
            if (!importName || !varName) {
                continue;
            }
            
            matches.push({
                fullMatch: match[0],
                varName,
                importName,
                modulePath: match[2],
                type: 'destructure',
                line
            });
        }
    }

    // Pattern 3: Member access - const foo = require('module').bar;
    const memberPattern = /^(?:const|let|var)\s+(\w+)\s*=\s*require\s*\(\s*['"]([^'"]+)['"]\s*\)\s*\.\s*([A-Za-z0-9_$]+)\s*;?\s*$/gm;
    while ((match = memberPattern.exec(content)) !== null) {
        matches.push({
            fullMatch: match[0],
            varName: match[1],
            modulePath: match[2],
            memberName: match[3],
            type: 'member',
            line: content.substring(0, match.index).split('\n').length
        });
    }
    
    return matches;
}

/**
 * Create dependency injection container
 */
function createDependencyInjection(content, requireMatches) {
    const depsEntries = [];
    const initDepsLines = [];
    const destructureGroups = new Map();
    
    for (const match of requireMatches) {
        const varName = match.varName;
        const modulePath = match.modulePath;
        const isBuiltIn = BUILT_IN_MODULES.has(modulePath);
        
        if (match.type === 'destructure') {
            const importName = match.importName;
            depsEntries.push(`    _${varName}: null,`);
            depsEntries.push(`    get ${varName}() { return this._${varName}; },`);
            depsEntries.push(`    set ${varName}(val) { this._${varName} = val; }`);

            if (!destructureGroups.has(modulePath)) {
                destructureGroups.set(modulePath, []);
            }
            destructureGroups.get(modulePath).push({
                varName,
                importName
            });
        } else if (match.type === 'member') {
            // Member access: const foo = require('module').bar;
            const memberName = match.memberName;
            depsEntries.push(`    _${varName}: null,`);
            depsEntries.push(`    get ${varName}() { return this._${varName}; },`);
            depsEntries.push(`    set ${varName}(val) { this._${varName} = val; }`);

            const importPath = isBuiltIn ? modulePath : resolveImportPath(modulePath);
            initDepsLines.push(`    if (!deps._${varName}) {
        const ${varName}Module = await import('${importPath}');
        deps._${varName} = ${memberName === 'default' ? `${varName}Module.default ?? ${varName}Module` : `${varName}Module.${memberName}`};
    }`);
        } else {
            // Simple: const db = require('../database');
            depsEntries.push(`    _${varName}: null,`);
            depsEntries.push(`    get ${varName}() { return this._${varName}; },`);
            depsEntries.push(`    set ${varName}(val) { this._${varName} = val; }`);
            
            if (isBuiltIn) {
                initDepsLines.push(`    if (!deps._${varName}) {
        const ${varName}Module = await import('${modulePath}');
        deps._${varName} = ${varName}Module.default || ${varName}Module;
    }`);
            } else {
                // Add .js extension for local modules
                const importPath = resolveImportPath(modulePath);
                initDepsLines.push(`    if (!deps._${varName}) {
        const { default: ${varName}Instance } = await import('${importPath}');
        deps._${varName} = ${varName}Instance;
    }`);
            }
        }
    }

    for (const [modulePath, items] of destructureGroups.entries()) {
        const importPath = resolveImportPath(modulePath);
        const imports = items.map(({ importName, varName }) => (
            importName === varName ? importName : `${importName}: ${varName}`
        ));
        const assignments = items.map(({ varName }) => (
            `        if (!deps._${varName}) deps._${varName} = ${varName};`
        ));
        const condition = items.map(({ varName }) => `!deps._${varName}`).join(' || ');

        initDepsLines.push(`    if (${condition}) {
        const { ${imports.join(', ')} } = await import('${importPath}');
${assignments.join('\n')}
    }`);
    }
    
    const depsInjection = `// BEGIN AUTO-DEPS
// Dependency injection for testing
const deps = {
${depsEntries.join('\n')}
};

/**
 * Initialize dependencies lazily
 */
async function initDeps() {
${initDepsLines.join('\n')}
}

// END AUTO-DEPS
`;
    
    // Find insertion point (after comments/imports, before code)
    const lines = content.split('\n');
    let insertIndex = 0;
    
    // Skip initial comments and empty lines
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.startsWith('//') || line.startsWith('/*') || line.startsWith('*') || line === '') {
            insertIndex = i + 1;
        } else {
            break;
        }
    }
    
    lines.splice(insertIndex, 0, depsInjection.trim());
    return lines.join('\n');
}

/**
 * Add missing dependencies to existing deps object
 */
function addMissingDeps(content, requireMatches) {
    // Find existing deps object
    const depsMatch = content.match(/const\s+deps\s*=\s*\{([^}]+)\}/s);
    if (!depsMatch) return null;
    
    // Find initDeps function
    const initDepsMatch = content.match(/async\s+function\s+initDeps\s*\([^)]*\)\s*\{([^}]+)\}/s);
    if (!initDepsMatch) return null;
    
    let result = content;
    
    // Add missing deps to the object
    for (const match of requireMatches) {
        const varName = match.varName;
        
        // Check if already in deps
        if (!depsMatch[1].includes(`_${varName}`)) {
            // Add to deps object
            const depsEnd = depsMatch.index + depsMatch[0].length - 1;
            const insertPos = depsEnd - 1; // Before closing brace
            
            const newDep = `    _${varName}: null,\n    get ${varName}() { return this._${varName}; },\n    set ${varName}(val) { this._${varName} = val; },\n`;
            
            result = result.slice(0, insertPos) + newDep + result.slice(insertPos);
            
            // Add to initDeps
            const initDepsEnd = initDepsMatch.index + initDepsMatch[0].length - 1;
            const modulePath = match.modulePath;
            const isBuiltIn = BUILT_IN_MODULES.has(modulePath);
            
            let initLine;
            if (match.type === 'destructure') {
                const importName = match.importName;
                const importPath = resolveImportPath(modulePath);
                initLine = `    if (!deps._${varName}) {\n        const { ${importName} } = await import('${importPath}');\n        deps._${varName} = ${importName};\n    }\n`;
            } else if (match.type === 'member') {
                const importPath = resolveImportPath(modulePath);
                const memberName = match.memberName;
                initLine = `    if (!deps._${varName}) {\n        const ${varName}Module = await import('${importPath}');\n        deps._${varName} = ${memberName === 'default' ? `${varName}Module.default ?? ${varName}Module` : `${varName}Module.${memberName}`};\n    }\n`;
            } else {
                const importPath = resolveImportPath(modulePath);
                initLine = `    if (!deps._${varName}) {\n        const { default: ${varName}Instance } = await import('${importPath}');\n        deps._${varName} = ${varName}Instance;\n    }\n`;
            }
            
            result = result.slice(0, initDepsEnd - 1) + initLine + result.slice(initDepsEnd - 1);
        }
    }
    
    return result;
}

/**
 * Replace direct usage of variables with deps.*
 */
function replaceDirectUsage(content, requireMatches) {
    let result = content;
    
    for (const match of requireMatches) {
        const varName = match.varName;
        
        // Replace direct usage (but not in require statements or deps object)
        // Use word boundaries to avoid partial matches
        const regex = new RegExp(`\\b${varName}\\b(?!\\s*[:=])`, 'g');
        
        // More careful replacement - avoid auto-generated deps blocks
        const lines = result.split('\n');
        let inAutoDeps = false;
        const newLines = lines.map(line => {
            if (line.includes('// BEGIN AUTO-DEPS')) {
                inAutoDeps = true;
            }
            if (line.includes('// END AUTO-DEPS')) {
                inAutoDeps = false;
                return line;
            }

            if (inAutoDeps) {
                return line;
            }

            // Skip if it's a require statement or deps definition
            if (line.includes('require(') || line.includes('const deps') || line.includes('deps.') || line.includes('initDeps')) {
                return line;
            }
            
            // Replace standalone variable usage with deps.variable
            return line.replace(new RegExp(`\\b${varName}\\b(?!\\s*[:=])`, 'g'), `deps.${varName}`);
        });
        
        result = newLines.join('\n');
    }
    
    return result;
}

/**
 * Transform module.exports to export default
 */
function transformModuleExports(content) {
    let result = content;
    
    // Pattern 1: module.exports = new Service();
    result = result.replace(/module\.exports\s*=\s*new\s+(\w+)\s*\(\s*\)\s*;?/g, (match, serviceName) => {
        const instanceName = `${serviceName.charAt(0).toLowerCase()}${serviceName.slice(1)}Instance`;
        return `const ${instanceName} = new ${serviceName}();\nexport default ${instanceName};`;
    });

    // Pattern 1: module.exports = Service;
    result = result.replace(/module\.exports\s*=\s*(?!new\b)(\w+);?/g, 'export default $1;');
    
    // Pattern 2: module.exports = new Service();
    // Pattern 3: module.exports = { ... };
    result = result.replace(/module\.exports\s*=\s*(\{[\s\S]*?\});?/g, 'export default $1;');

    // Pattern 4: module.exports.FOO = BAR;
    result = result.replace(/module\.exports\.(\w+)\s*=\s*([^;]+);/g, (match, propName, value) => {
        const trimmedValue = value.trim();
        if (trimmedValue === propName) {
            return `export { ${propName} };`;
        }
        return `export const ${propName} = ${value};`;
    });
    
    return result;
}

/**
 * Print migration summary
 */
function printSummary(results, backupDir, dryRun) {
    console.log('\n🎉 MIGRACJA ZAKOŃCZONA!\n');
    
    if (dryRun) {
        console.log('⚠️  [DRY RUN MODE] - Żadne pliki nie zostały zmienione\n');
    }
    
    console.log(`✅ Pomyślnie zmigrowane: ${results.success.length} plików`);
    console.log(`❌ Błędy: ${results.failed.length} plików`);
    console.log(`⏭️  Pominięte (już zmigrowane): ${results.skipped.length} plików`);
    console.log(`⚠️  Ostrzeżenia: ${results.warnings.length} plików`);
    
    if (results.failed.length > 0) {
        console.log('\n❌ PLIKI Z BŁĘDAMI:');
        results.failed.forEach(({ file, error }) => {
            console.log(`  - ${path.relative(TARGET_DIR, file)}: ${error}`);
        });
    }
    
    if (results.warnings.length > 0) {
        console.log('\n⚠️  PLIKI WYMAGAJĄCE RĘCZNEJ KOREKTY:');
        results.warnings.forEach(({ file, warning }) => {
            console.log(`  - ${path.relative(TARGET_DIR, file)}: ${warning}`);
        });
    }
    
    if (backupDir) {
        console.log(`\n💾 Backup dostępny w: ${backupDir}`);
    }
    
    console.log('\n📋 NASTĘPNE KROKI:');
    console.log('1. Przetestuj aplikację: npm run lint');
    console.log('2. Sprawdź pliki z błędami ręcznie');
    console.log('3. Uruchom testy: npm test');
    console.log('4. Commituj zmiany');
}

// Run migration if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    const args = process.argv.slice(2);
    const dryRun = args.includes('--dry-run') || args.includes('-d');
    
    runMigration({ dryRun }).catch(error => {
        console.error('❌ Błąd podczas migracji:', error);
        process.exit(1);
    });
}

export { runMigration, findFilesToMigrate, transformFileContent };
