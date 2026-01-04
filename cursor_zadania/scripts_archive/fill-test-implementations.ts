/**
 * Script to help fill test implementations
 * Identifies tests with placeholder implementations
 */

import { readdirSync, readFileSync, statSync, writeFileSync } from 'fs';
import { join } from 'path';

interface TestFile {
    path: string;
    placeholders: number;
    totalTests: number;
}

function findPlaceholders(content: string): number {
    const placeholderPattern = /expect\(true\)\.toBe\(true\)/g;
    return (content.match(placeholderPattern) || []).length;
}

function countTests(content: string): number {
    const testPattern = /(it\(|test\()/g;
    return (content.match(testPattern) || []).length;
}

function scanTestFiles(dir: string): TestFile[] {
    const files: TestFile[] = [];

    function scan(currentDir: string) {
        const entries = readdirSync(currentDir);

        for (const entry of entries) {
            const fullPath = join(currentDir, entry);
            const stat = statSync(fullPath);

            if (stat.isDirectory()) {
                scan(fullPath);
            } else if (entry.endsWith('.test.ts') || entry.endsWith('.test.js')) {
                try {
                    const content = readFileSync(fullPath, 'utf-8');
                    const placeholders = findPlaceholders(content);
                    const totalTests = countTests(content);

                    if (placeholders > 0) {
                        files.push({
                            path: fullPath,
                            placeholders,
                            totalTests,
                        });
                    }
                } catch (error) {
                    console.error(`Error reading ${fullPath}:`, error);
                }
            }
        }
    }

    scan(dir);
    return files;
}

function generateReport(files: TestFile[]): void {
    console.log('\n📊 Test Implementation Report\n');
    console.log(`Total files with placeholders: ${files.length}`);

    const totalPlaceholders = files.reduce((sum, f) => sum + f.placeholders, 0);
    const totalTests = files.reduce((sum, f) => sum + f.totalTests, 0);

    console.log(`Total placeholders: ${totalPlaceholders}`);
    console.log(`Total tests: ${totalTests}`);
    console.log(`Coverage needed: ${((totalPlaceholders / totalTests) * 100).toFixed(2)}%\n`);

    console.log('Top 20 files needing implementation:\n');
    files
        .sort((a, b) => b.placeholders - a.placeholders)
        .slice(0, 20)
        .forEach((file, index) => {
            const percentage = ((file.placeholders / file.totalTests) * 100).toFixed(0);
            console.log(`${index + 1}. ${file.path}`);
            console.log(`   Placeholders: ${file.placeholders}/${file.totalTests} (${percentage}%)`);
        });
}

// Main execution
const testDirs = ['server/tests/unit/backend', 'tests/unit/backend'];

let allFiles: TestFile[] = [];

for (const dir of testDirs) {
    try {
        const files = scanTestFiles(dir);
        allFiles = allFiles.concat(files);
    } catch (error) {
        // Directory might not exist
    }
}

generateReport(allFiles);
