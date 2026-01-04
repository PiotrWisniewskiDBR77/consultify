#!/usr/bin/env node
/**
 * Verify Duplicates Script
 * 
 * Checks if old .js files are still imported and if new .ts files exist and work
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');
const serverDir = path.join(projectRoot, 'server');
const srcDir = path.join(serverDir, 'src');
const duplicatesReportPath = path.join(projectRoot, 'tests', 'migration', 'reports', 'duplicates-report.json');

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

function checkImports(filePath, searchPattern) {
    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.split('\n');
        const matches = [];
        
        lines.forEach((line, index) => {
            if (searchPattern.test(line) && !line.trim().startsWith('//')) {
                matches.push({
                    line: index + 1,
                    code: line.trim()
                });
            }
        });
        
        return matches;
    } catch (err) {
        return [];
    }
}

async function verifyDuplicates() {
    console.log('🔍 Verifying duplicates...\n');

    if (!fs.existsSync(duplicatesReportPath)) {
        console.error('❌ Duplicates report not found. Run test-migration-duplicates.mjs first.');
        process.exit(1);
    }

    const duplicatesReport = JSON.parse(fs.readFileSync(duplicatesReportPath, 'utf-8'));
    const tsFiles = findFiles(srcDir, '.ts', ['node_modules'])
        .filter(f => !f.includes('.test.ts') && !f.includes('.spec.ts') && !f.includes('.d.ts'));
    
    const jsFiles = findFiles(serverDir, '.js', ['node_modules', 'dist', 'backup'])
        .filter(f => !f.includes('.test.js') && !f.includes('.spec.js'));

    const verificationResults = [];
    const safeToRemove = [];
    const needsVerification = [];
    const stillUsed = [];

    for (const duplicate of duplicatesReport.duplicates.slice(0, 20)) { // Check first 20
        const oldJsPath = path.join(serverDir, duplicate.oldJs);
        const newTsPath = path.join(srcDir, duplicate.newTs);
        
        // Check if old .js file exists
        const oldJsExists = fs.existsSync(oldJsPath);
        
        // Check if new .ts file exists
        const newTsExists = fs.existsSync(newTsPath);
        
        // Check if old .js is imported anywhere in src/
        const oldJsImportPattern = new RegExp(
            `from\\s+['"].*${duplicate.oldJs.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}|require\\(['"].*${duplicate.oldJs.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`
        );
        
        let importsFound = [];
        for (const tsFile of tsFiles) {
            const tsFilePath = path.join(srcDir, tsFile);
            const matches = checkImports(tsFilePath, oldJsImportPattern);
            if (matches.length > 0) {
                importsFound.push({
                    file: tsFile,
                    matches
                });
            }
        }
        
        const result = {
            oldJs: duplicate.oldJs,
            newTs: duplicate.newTs,
            oldJsExists,
            newTsExists,
            stillImported: importsFound.length > 0,
            importLocations: importsFound,
            commonFunctions: duplicate.commonFunctions,
            recommendation: duplicate.recommendation
        };
        
        verificationResults.push(result);
        
        if (!oldJsExists) {
            // Already removed
            continue;
        }
        
        if (!newTsExists) {
            needsVerification.push({
                ...result,
                reason: 'New .ts file does not exist'
            });
            continue;
        }
        
        if (importsFound.length > 0) {
            stillUsed.push({
                ...result,
                reason: 'Still imported in TypeScript files'
            });
            continue;
        }
        
        if (duplicate.commonFunctions > 0) {
            needsVerification.push({
                ...result,
                reason: 'Has common functions - needs manual verification'
            });
            continue;
        }
        
        // Safe to remove
        safeToRemove.push({
            ...result,
            reason: 'New .ts exists, not imported, no common functions'
        });
    }

    // Generate report
    const report = {
        timestamp: new Date().toISOString(),
        summary: {
            totalChecked: verificationResults.length,
            safeToRemove: safeToRemove.length,
            needsVerification: needsVerification.length,
            stillUsed: stillUsed.length
        },
        safeToRemove: safeToRemove,
        needsVerification: needsVerification,
        stillUsed: stillUsed,
        allResults: verificationResults
    };

    const reportPath = path.join(projectRoot, 'tests', 'migration', 'reports', 'duplicates-verification.json');
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    console.log('📊 Verification Results:');
    console.log(`   Total checked: ${report.summary.totalChecked}`);
    console.log(`   Safe to remove: ${safeToRemove.length} ✅`);
    console.log(`   Needs verification: ${needsVerification.length} ⚠️`);
    console.log(`   Still used: ${stillUsed.length} ❌\n`);

    if (safeToRemove.length > 0) {
        console.log('✅ Safe to remove (first 10):');
        safeToRemove.slice(0, 10).forEach(item => {
            console.log(`   - ${item.oldJs} → ${item.newTs}`);
        });
        console.log('');
    }

    if (stillUsed.length > 0) {
        console.log('❌ Still used (first 5):');
        stillUsed.slice(0, 5).forEach(item => {
            console.log(`   - ${item.oldJs} (imported in ${item.importLocations.length} files)`);
        });
        console.log('');
    }

    if (needsVerification.length > 0) {
        console.log('⚠️  Needs verification (first 5):');
        needsVerification.slice(0, 5).forEach(item => {
            console.log(`   - ${item.oldJs} (${item.reason})`);
        });
        console.log('');
    }

    console.log(`✅ Report saved to: ${reportPath}`);

    return {
        safeToRemove: safeToRemove.length,
        needsVerification: needsVerification.length,
        stillUsed: stillUsed.length
    };
}

verifyDuplicates()
    .then(() => {
        process.exit(0);
    })
    .catch(err => {
        console.error('❌ Error:', err);
        process.exit(1);
    });

