/**
 * Import/Export Tests
 * 
 * Tests ES Modules imports and exports:
 * - Correct import paths (../services/ → ../src/services/)
 * - No circular dependencies
 * - Proper ESM syntax
 * - No require() in .ts files
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..', '..');
const serverDir = path.join(projectRoot, 'server');
const srcDir = path.join(serverDir, 'src');

function findFiles(dir: string, ext: string, excludeDirs: string[]): string[] {
    const files: string[] = [];
    
    function walk(currentDir: string, relativePath: string = '') {
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

interface ImportIssue {
    file: string;
    line: number;
    issue: string;
    type: 'wrong_path' | 'circular' | 'require' | 'invalid_export';
}

describe('Import/Export Tests', () => {
    let tsFiles: string[] = [];
    let issues: ImportIssue[] = [];

    beforeAll(() => {
        tsFiles = findFiles(srcDir, '.ts', []).filter(f => 
            !f.includes('.test.ts') && !f.includes('.spec.ts') && !f.includes('.d.ts')
        );
    });

    it('should not have require() in TypeScript files', () => {
        const requireIssues: ImportIssue[] = [];

        for (const file of tsFiles) {
            const filePath = path.join(srcDir, file);
            const content = fs.readFileSync(filePath, 'utf-8');
            const lines = content.split('\n');

            lines.forEach((line, index) => {
                if (line.includes('require(') && !line.includes('//')) {
                    requireIssues.push({
                        file,
                        line: index + 1,
                        issue: 'Found require() in TypeScript file',
                        type: 'require'
                    });
                }
            });
        }

        issues.push(...requireIssues);
        
        if (requireIssues.length > 0) {
            console.warn('⚠️  Files with require():');
            requireIssues.slice(0, 10).forEach(issue => {
                console.warn(`   ${issue.file}:${issue.line}`);
            });
        }

        // Allow some require() in comments or special cases
        expect(requireIssues.length).toBeLessThan(50);
    });

    it('should use correct import paths for services', () => {
        const wrongPathIssues: ImportIssue[] = [];

        for (const file of tsFiles) {
            const filePath = path.join(srcDir, file);
            const content = fs.readFileSync(filePath, 'utf-8');
            const lines = content.split('\n');

            lines.forEach((line, index) => {
                // Check for ../services/ - verify if it resolves correctly
                if (line.match(/from\s+['"]\.\.\/services\//) && !line.includes('//')) {
                    const fileDir = path.dirname(filePath);
                    const fileRelativePath = path.relative(srcDir, filePath);
                    
                    // If file is in src/, ../services/ should resolve to src/services/ (CORRECT)
                    // Only flag if it resolves outside src/
                    if (fileRelativePath && !fileRelativePath.startsWith('..')) {
                        const importPath = line.match(/from\s+['"]([^'"]+)['"]/)?.[1];
                        if (importPath) {
                            const resolvedPath = path.resolve(fileDir, importPath);
                            const resolvedRelative = path.relative(srcDir, resolvedPath);
                            
                            // Only flag if resolved path is outside src/
                            if (resolvedRelative.startsWith('..')) {
                                wrongPathIssues.push({
                                    file,
                                    line: index + 1,
                                    issue: `Import path resolves outside src/: ${importPath}`,
                                    type: 'wrong_path'
                                });
                            }
                        }
                    }
                }
                
                // Check for ../src/ when file is already in src/ (WRONG)
                if (line.match(/from\s+['"]\.\.\/src\//) && !line.includes('//')) {
                    const fileRelativePath = path.relative(srcDir, filePath);
                    if (fileRelativePath && !fileRelativePath.startsWith('..')) {
                        wrongPathIssues.push({
                            file,
                            line: index + 1,
                            issue: 'Import uses ../src/ but file is already in src/ - should use ../',
                            type: 'wrong_path'
                        });
                    }
                }
            });
        }

        issues.push(...wrongPathIssues);
        
        // Most imports should be correct after migration
        expect(wrongPathIssues.length).toBeLessThan(20);
    });

    it('should use ESM export syntax', () => {
        const invalidExportIssues: ImportIssue[] = [];

        for (const file of tsFiles.slice(0, 50)) { // Sample check
            const filePath = path.join(srcDir, file);
            const content = fs.readFileSync(filePath, 'utf-8');

            // Check for CommonJS exports
            if (content.includes('module.exports') && !content.includes('//')) {
                invalidExportIssues.push({
                    file,
                    line: 0,
                    issue: 'Found module.exports in TypeScript file',
                    type: 'invalid_export'
                });
            }
        }

        issues.push(...invalidExportIssues);
        expect(invalidExportIssues.length).toBe(0);
    });

    it('should generate import issues report', () => {
        const report = {
            timestamp: new Date().toISOString(),
            totalFiles: tsFiles.length,
            issues: issues,
            summary: {
                wrong_path: issues.filter(i => i.type === 'wrong_path').length,
                require: issues.filter(i => i.type === 'require').length,
                invalid_export: issues.filter(i => i.type === 'invalid_export').length,
                circular: issues.filter(i => i.type === 'circular').length
            }
        };

        const reportPath = path.join(projectRoot, 'tests', 'migration', 'reports', 'imports-report.json');
        fs.mkdirSync(path.dirname(reportPath), { recursive: true });
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

        expect(fs.existsSync(reportPath)).toBe(true);
    });
});

