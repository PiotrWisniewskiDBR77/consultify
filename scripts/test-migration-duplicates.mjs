#!/usr/bin/env node
/**
 * Duplicates Migration Test Script
 * 
 * Finds duplicate functionality between old .js and new .ts files:
 * - Function name matching
 * - Old .js files that might be safe to remove
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

function extractFunctions(content) {
    const functions = [];
    
    // Match function declarations
    const functionPatterns = [
        /(?:export\s+)?(?:async\s+)?function\s+(\w+)/g,
        /(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s*)?\(/g,
        /(?:export\s+)?class\s+(\w+)/g
    ];

    functionPatterns.forEach(pattern => {
        let match;
        while ((match = pattern.exec(content)) !== null) {
            functions.push(match[1]);
        }
    });

    return [...new Set(functions)]; // Remove duplicates
}

function normalizeFileName(fileName) {
    return fileName.toLowerCase().replace(/[_-]/g, '');
}

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

async function generateReport() {
    console.log('🔍 Finding duplicates...\n');

    const jsFiles = findFiles(path.join(serverDir, 'services'), '.js', ['node_modules', 'dist', 'backup'])
        .map(f => `services/${f}`)
        .filter(f => !f.includes('.test.js'));
    const tsFiles = findFiles(path.join(srcDir, 'services'), '.ts', [])
        .map(f => `services/${f}`)
        .filter(f => !f.includes('.test.ts') && !f.includes('.spec.ts') && !f.includes('.d.ts'));

    const duplicates = [];

    for (const jsFile of jsFiles.slice(0, 100)) { // Sample
        const jsBaseName = path.basename(jsFile, '.js');
        const jsNormalized = normalizeFileName(jsBaseName);

        // Find matching TS file
        const tsMatch = tsFiles.find(ts => {
            const tsBaseName = path.basename(ts, '.ts');
            const tsNormalized = normalizeFileName(tsBaseName);
            return tsNormalized === jsNormalized || tsBaseName === jsBaseName;
        });

        if (tsMatch) {
            const jsPath = path.join(serverDir, jsFile);
            const tsPath = path.join(srcDir, tsMatch);

            if (fs.existsSync(jsPath) && fs.existsSync(tsPath)) {
                const jsContent = fs.readFileSync(jsPath, 'utf-8');
                const tsContent = fs.readFileSync(tsPath, 'utf-8');

                const jsFunctions = extractFunctions(jsContent);
                const tsFunctions = extractFunctions(tsContent);

                const commonFunctions = jsFunctions.filter(f => tsFunctions.includes(f));

                if (commonFunctions.length > 0 || jsBaseName === path.basename(tsMatch, '.ts')) {
                    duplicates.push({
                        oldJs: jsFile,
                        newTs: tsMatch,
                        jsFunctions: jsFunctions.length,
                        tsFunctions: tsFunctions.length,
                        commonFunctions: commonFunctions.length,
                        commonFunctionNames: commonFunctions.slice(0, 10),
                        recommendation: commonFunctions.length > 0 
                            ? 'Potential duplicate - verify migration completeness before removing'
                            : 'Same filename - likely migrated, verify before removing'
                    });
                }
            }
        }
    }

    const report = {
        timestamp: new Date().toISOString(),
        duplicates,
        summary: {
            total: duplicates.length,
            withCommonFunctions: duplicates.filter(d => d.commonFunctions > 0).length,
            sameFilename: duplicates.filter(d => d.commonFunctions === 0).length
        },
        recommendations: duplicates.map(d => ({
            oldFile: d.oldJs,
            newFile: d.newTs,
            action: d.recommendation,
            commonFunctions: d.commonFunctionNames
        }))
    };

    fs.mkdirSync(reportsDir, { recursive: true });
    const reportPath = path.join(reportsDir, 'duplicates-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    console.log('📊 Duplicates Found:');
    console.log(`   Total potential duplicates: ${report.summary.total}`);
    console.log(`   With common functions: ${report.summary.withCommonFunctions}`);
    console.log(`   Same filename only: ${report.summary.sameFilename}\n`);

    if (duplicates.length > 0) {
        console.log('📋 Potential duplicates (first 10):');
        duplicates.slice(0, 10).forEach(d => {
            console.log(`   ${d.oldJs} → ${d.newTs} (${d.commonFunctions} common functions)`);
        });
        console.log('');
    }

    console.log(`✅ Report saved to: ${reportPath}`);
}

generateReport()
    .then(() => {
        process.exit(0);
    })
    .catch(err => {
        console.error('❌ Error:', err);
        process.exit(1);
    });

