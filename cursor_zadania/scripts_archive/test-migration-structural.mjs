#!/usr/bin/env node
/**
 * Structural Migration Test Script
 * 
 * Scans project structure and generates migration mapping report
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');
const serverDir = path.join(projectRoot, 'server');
const srcDir = path.join(serverDir, 'src');
const reportsDir = path.join(projectRoot, 'tests', 'migration', 'reports');

function findFiles(dir, ext, excludeDirs = []) {
    const files = [];
    
    function walk(currentDir, relativePath = '') {
        try {
            const entries = fs.readdirSync(currentDir, { withFileTypes: true });
            
            for (const entry of entries) {
                const fullPath = path.join(currentDir, entry.name);
                const relPath = relativePath ? path.join(relativePath, entry.name) : entry.name;
                
                if (entry.isDirectory()) {
                    if (!excludeDirs.includes(entry.name) && !entry.name.startsWith('.')) {
                        walk(fullPath, relPath);
                    }
                } else if (entry.name.endsWith(ext)) {
                    files.push(relPath);
                }
            }
        } catch (err) {
            // Ignore errors
        }
    }
    
    walk(dir);
    return files;
}

function normalizePath(filePath) {
    return filePath.replace(/\\/g, '/');
}

function getBaseName(filePath) {
    return path.basename(filePath, path.extname(filePath));
}

function findTsEquivalent(jsFile, tsFiles) {
    const baseName = getBaseName(jsFile);
    const dirName = path.dirname(jsFile);
    
    // Try exact match first
    const exactMatch = tsFiles.find(ts => {
        const tsDir = path.dirname(ts);
        const tsBase = getBaseName(ts);
        return tsDir === dirName && tsBase === baseName;
    });
    
    if (exactMatch) return exactMatch;
    
    // Try matching by base name in common directories
    const commonDirs = ['services', 'routes', 'middleware', 'controllers', 'utils', 'cron'];
    for (const dir of commonDirs) {
        const possiblePath = path.join(dir, baseName + '.ts');
        if (tsFiles.includes(possiblePath)) {
            return possiblePath;
        }
    }
    
    return null;
}

function isUtilityScript(filePath) {
    const utilityPatterns = [
        '/seed/',
        '/scripts/',
        '/migrations/',
        'seed_',
        'test_',
        'migrate_',
        'check_',
        'fix_',
        'list_',
        'restore_',
        'verify_',
        'apply_',
        'cleanup_',
        'force_',
        'inspect_',
        'database.sqlite'
    ];
    
    return utilityPatterns.some(pattern => filePath.includes(pattern));
}

async function generateReport() {
    console.log('🔍 Scanning project structure...\n');

    const jsFiles = findFiles(serverDir, '.js', ['node_modules', 'dist', 'backup', 'trash_node_modules', '__mocks__'])
        .filter(f => !f.includes('.test.js') && !f.includes('.spec.js'));
    const tsFiles = findFiles(srcDir, '.ts', [])
        .filter(f => !f.includes('.test.ts') && !f.includes('.spec.ts') && !f.includes('.d.ts'));

    console.log(`📊 Found ${jsFiles.length} .js files in server/`);
    console.log(`📊 Found ${tsFiles.length} .ts files in server/src/\n`);

    const mappings = [];
    const stats = {
        totalJsFiles: jsFiles.length,
        totalTsFiles: tsFiles.length,
        migratedFiles: 0,
        missingMigrations: 0,
        utilityScripts: 0,
        coverage: 0
    };

    for (const jsFile of jsFiles) {
        const isUtility = isUtilityScript(jsFile);
        const tsEquivalent = findTsEquivalent(jsFile, tsFiles);
        
        const mapping = {
            oldJs: normalizePath(jsFile),
            newTs: tsEquivalent ? normalizePath(tsEquivalent) : null,
            status: isUtility ? 'utility' : (tsEquivalent ? 'migrated' : 'missing')
        };
        
        mappings.push(mapping);
        
        if (isUtility) {
            stats.utilityScripts++;
        } else if (tsEquivalent) {
            stats.migratedFiles++;
        } else {
            stats.missingMigrations++;
        }
    }

    const relevantFiles = stats.migratedFiles + stats.missingMigrations;
    stats.coverage = relevantFiles > 0 ? (stats.migratedFiles / relevantFiles) * 100 : 100;

    const report = {
        timestamp: new Date().toISOString(),
        stats,
        mappings: mappings.filter(m => m.status !== 'utility'),
        missingMigrations: mappings.filter(m => m.status === 'missing'),
        utilityScripts: mappings.filter(m => m.status === 'utility')
    };

    // Save report
    fs.mkdirSync(reportsDir, { recursive: true });
    const reportPath = path.join(reportsDir, 'structural-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    console.log('📊 Migration Statistics:');
    console.log(`   Total .js files: ${stats.totalJsFiles}`);
    console.log(`   Total .ts files: ${stats.totalTsFiles}`);
    console.log(`   Migrated files: ${stats.migratedFiles}`);
    console.log(`   Missing migrations: ${stats.missingMigrations}`);
    console.log(`   Utility scripts: ${stats.utilityScripts}`);
    console.log(`   Coverage: ${stats.coverage.toFixed(2)}%\n`);

    if (stats.missingMigrations > 0) {
        console.log('⚠️  Missing migrations:');
        report.missingMigrations.slice(0, 20).forEach(m => {
            console.log(`   - ${m.oldJs}`);
        });
        if (report.missingMigrations.length > 20) {
            console.log(`   ... and ${report.missingMigrations.length - 20} more`);
        }
        console.log('');
    }

    console.log(`✅ Report saved to: ${reportPath}`);

    return stats.coverage >= 80;
}

generateReport()
    .then(success => {
        process.exit(success ? 0 : 1);
    })
    .catch(err => {
        console.error('❌ Error:', err);
        process.exit(1);
    });

