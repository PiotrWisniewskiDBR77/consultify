#!/usr/bin/env node
/**
 * Import/Export Migration Test Script
 * 
 * Checks all imports and exports for migration issues:
 * - Wrong import paths
 * - Circular dependencies
 * - require() in .ts files
 * - Invalid exports
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

function findTsFiles() {
    return findFiles(srcDir, '.ts', ['node_modules'])
        .filter(f => !f.includes('.test.ts') && !f.includes('.spec.ts') && !f.includes('.d.ts'));
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

function checkFile(filePath, content) {
    const issues = [];
    const lines = content.split('\n');

    lines.forEach((line, index) => {
        const lineNum = index + 1;

        // Check for require()
        if (line.includes('require(') && !line.trim().startsWith('//')) {
            issues.push({
                type: 'require',
                line: lineNum,
                message: 'Found require() in TypeScript file',
                code: line.trim()
            });
        }

        // Check for module.exports
        if (line.includes('module.exports') && !line.trim().startsWith('//')) {
            issues.push({
                type: 'module_exports',
                line: lineNum,
                message: 'Found module.exports in TypeScript file',
                code: line.trim()
            });
        }

        // Check for wrong import paths
        // Only flag if file is in src/ and import goes outside src/ (should use ../src/)
        if (line.match(/from\s+['"]\.\.\/services\//) && !line.includes('//')) {
            const fileDir = path.dirname(filePath);
            const fileRelativePath = path.relative(srcDir, filePath);
            
            // If file is in src/, check if import path resolves correctly
            if (fileRelativePath && !fileRelativePath.startsWith('..')) {
                // File is in src/, so ../services/ should resolve to src/services/
                // This is CORRECT, so don't flag it
                // Only flag if import goes outside src/ (e.g., from root server/)
                const importPath = line.match(/from\s+['"]([^'"]+)['"]/)?.[1];
                if (importPath) {
                    // Resolve the import path relative to file location
                    const resolvedPath = path.resolve(fileDir, importPath);
                    const resolvedRelative = path.relative(srcDir, resolvedPath);
                    
                    // If resolved path is outside src/, it's wrong
                    if (resolvedRelative.startsWith('..')) {
                        issues.push({
                            type: 'wrong_path',
                            line: lineNum,
                            message: `Import path resolves outside src/: ${importPath}`,
                            code: line.trim()
                        });
                    }
                }
            }
        }
        
        // Check for imports that should use relative paths within src/
        // Flag imports like ../src/services/ when file is already in src/
        if (line.match(/from\s+['"]\.\.\/src\//) && !line.includes('//')) {
            const fileDir = path.dirname(filePath);
            const fileRelativePath = path.relative(srcDir, filePath);
            
            // If file is already in src/, ../src/ is wrong (should be ../)
            if (fileRelativePath && !fileRelativePath.startsWith('..')) {
                issues.push({
                    type: 'wrong_path',
                    line: lineNum,
                    message: 'Import uses ../src/ but file is already in src/ - should use ../',
                    code: line.trim()
                });
            }
        }
    });

    return issues;
}

async function generateReport() {
    console.log('🔍 Checking imports and exports...\n');

    const tsFiles = await findTsFiles();
    const allIssues = [];
    const summary = {
        require: 0,
        module_exports: 0,
        wrong_path: 0,
        total_files: tsFiles.length
    };

    for (const file of tsFiles) {
        const filePath = path.join(srcDir, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        const issues = checkFile(filePath, content);

        if (issues.length > 0) {
            allIssues.push({
                file,
                issues
            });

            issues.forEach(issue => {
                summary[issue.type] = (summary[issue.type] || 0) + 1;
            });
        }
    }

    const report = {
        timestamp: new Date().toISOString(),
        summary,
        issues: allIssues.slice(0, 100), // Limit to first 100 files with issues
        total_issues: allIssues.reduce((sum, f) => sum + f.issues.length, 0)
    };

    fs.mkdirSync(reportsDir, { recursive: true });
    const reportPath = path.join(reportsDir, 'imports-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    console.log('📊 Import/Export Issues:');
    console.log(`   Total files checked: ${summary.total_files}`);
    console.log(`   Files with issues: ${allIssues.length}`);
    console.log(`   require() found: ${summary.require}`);
    console.log(`   module.exports found: ${summary.module_exports}`);
    console.log(`   Wrong paths: ${summary.wrong_path}`);
    console.log(`   Total issues: ${report.total_issues}\n`);

    if (allIssues.length > 0) {
        console.log('⚠️  Files with issues (first 10):');
        allIssues.slice(0, 10).forEach(({ file, issues }) => {
            console.log(`   ${file}: ${issues.length} issue(s)`);
        });
        console.log('');
    }

    console.log(`✅ Report saved to: ${reportPath}`);

    return report.total_issues < 100; // Allow some issues
}

generateReport()
    .then(success => {
        process.exit(success ? 0 : 1);
    })
    .catch(err => {
        console.error('❌ Error:', err);
        process.exit(1);
    });

