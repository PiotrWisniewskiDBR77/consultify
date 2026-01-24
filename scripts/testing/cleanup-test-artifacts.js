#!/usr/bin/env node
/**
 * IRIS 6.0 Test Artifact Cleanup Script
 * 
 * Cleans up orphaned test artifacts including:
 * - test-*.db SQLite databases from project root
 * - Duplicate test structure files
 * - Temporary coverage reports
 * 
 * Usage: node scripts/testing/cleanup-test-artifacts.js [--dry-run]
 */

import * as fs from 'fs';
import * as path from 'path';

const colors = {
    reset: '\x1b[0m',
    bold: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
};

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run') || args.includes('-n');
const verbose = args.includes('--verbose') || args.includes('-v');

const projectRoot = process.cwd();

/**
 * Cleanup configuration
 */
const cleanupConfig = {
    // Test database patterns (in project root)
    testDatabases: {
        pattern: /^test-.*\.db$/,
        location: projectRoot,
    },
    // Duplicate files to remove
    duplicateFiles: [
        'tests/TEST_STRUCTURE_COMPLETE 2',
        'tests/TEST_STRUCTURE_COMPLETE 3',
        'tests/skip-unstable 2',
        'tests/skip-unstable 3',
    ],
    // Temporary directories to clean
    tempDirs: [
        'test-results/tmp',
    ],
};

/**
 * Format bytes to human readable
 */
function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Find and remove test databases
 */
function cleanTestDatabases() {
    console.log(`\n${colors.cyan}━━━ Cleaning Test Databases ━━━${colors.reset}\n`);

    let count = 0;
    let totalSize = 0;
    const files = [];

    try {
        const entries = fs.readdirSync(cleanupConfig.testDatabases.location);

        for (const entry of entries) {
            if (cleanupConfig.testDatabases.pattern.test(entry)) {
                const filePath = path.join(cleanupConfig.testDatabases.location, entry);
                try {
                    const stats = fs.statSync(filePath);
                    files.push({ path: filePath, size: stats.size, name: entry });
                    totalSize += stats.size;
                    count++;
                } catch (err) {
                    // File might have been deleted
                }
            }
        }

        if (files.length === 0) {
            console.log(`${colors.green}✓ No orphaned test databases found${colors.reset}`);
            return { count: 0, size: 0 };
        }

        console.log(`Found ${colors.yellow}${count}${colors.reset} test databases (${formatBytes(totalSize)})\n`);

        if (verbose) {
            for (const file of files.slice(0, 10)) {
                console.log(`  ${colors.yellow}•${colors.reset} ${file.name} (${formatBytes(file.size)})`);
            }
            if (files.length > 10) {
                console.log(`  ... and ${files.length - 10} more`);
            }
            console.log();
        }

        if (!dryRun) {
            for (const file of files) {
                try {
                    fs.unlinkSync(file.path);
                } catch (err) {
                    console.error(`${colors.red}✗ Failed to delete ${file.name}: ${err.message}${colors.reset}`);
                }
            }
            console.log(`${colors.green}✓ Deleted ${count} test databases (freed ${formatBytes(totalSize)})${colors.reset}`);
        } else {
            console.log(`${colors.yellow}[DRY RUN] Would delete ${count} files (${formatBytes(totalSize)})${colors.reset}`);
        }

        return { count, size: totalSize };
    } catch (err) {
        console.error(`${colors.red}Error scanning for test databases: ${err.message}${colors.reset}`);
        return { count: 0, size: 0 };
    }
}

/**
 * Remove duplicate files
 */
function cleanDuplicateFiles() {
    console.log(`\n${colors.cyan}━━━ Cleaning Duplicate Files ━━━${colors.reset}\n`);

    let count = 0;
    let totalSize = 0;

    for (const relativePath of cleanupConfig.duplicateFiles) {
        const filePath = path.join(projectRoot, relativePath);

        try {
            if (fs.existsSync(filePath)) {
                const stats = fs.statSync(filePath);
                totalSize += stats.size;

                if (!dryRun) {
                    fs.unlinkSync(filePath);
                    console.log(`${colors.green}✓${colors.reset} Deleted: ${relativePath}`);
                } else {
                    console.log(`${colors.yellow}[DRY RUN]${colors.reset} Would delete: ${relativePath}`);
                }
                count++;
            }
        } catch (err) {
            if (verbose) {
                console.log(`${colors.yellow}⚠${colors.reset} Not found: ${relativePath}`);
            }
        }
    }

    if (count === 0) {
        console.log(`${colors.green}✓ No duplicate files found${colors.reset}`);
    } else {
        console.log(`\n${colors.green}✓ Cleaned ${count} duplicate files (${formatBytes(totalSize)})${colors.reset}`);
    }

    return { count, size: totalSize };
}

/**
 * Clean temporary directories
 */
function cleanTempDirs() {
    console.log(`\n${colors.cyan}━━━ Cleaning Temporary Directories ━━━${colors.reset}\n`);

    let count = 0;

    for (const relativePath of cleanupConfig.tempDirs) {
        const dirPath = path.join(projectRoot, relativePath);

        try {
            if (fs.existsSync(dirPath)) {
                if (!dryRun) {
                    fs.rmSync(dirPath, { recursive: true, force: true });
                    console.log(`${colors.green}✓${colors.reset} Removed: ${relativePath}`);
                } else {
                    console.log(`${colors.yellow}[DRY RUN]${colors.reset} Would remove: ${relativePath}`);
                }
                count++;
            }
        } catch (err) {
            console.error(`${colors.red}✗ Failed to remove ${relativePath}: ${err.message}${colors.reset}`);
        }
    }

    if (count === 0) {
        console.log(`${colors.green}✓ No temporary directories found${colors.reset}`);
    }

    return { count };
}

/**
 * Generate cleanup report
 */
function generateReport(results) {
    const reportPath = path.join(projectRoot, 'test-results', 'cleanup-report.json');

    const report = {
        timestamp: new Date().toISOString(),
        dryRun,
        results: {
            testDatabases: results.databases,
            duplicateFiles: results.duplicates,
            tempDirs: results.tempDirs,
        },
        totalFreedSpace: formatBytes(results.databases.size + results.duplicates.size),
    };

    if (!dryRun) {
        try {
            fs.mkdirSync(path.dirname(reportPath), { recursive: true });
            fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
            console.log(`\n${colors.green}✓ Report saved to: ${reportPath}${colors.reset}`);
        } catch (err) {
            console.error(`${colors.yellow}⚠ Could not save report: ${err.message}${colors.reset}`);
        }
    }

    return report;
}

/**
 * Main execution
 */
function main() {
    console.log(`
${colors.cyan}╔══════════════════════════════════════════════════════════════╗
║            ${colors.bold}IRIS 6.0 Test Artifact Cleanup${colors.reset}${colors.cyan}                  ║
╚══════════════════════════════════════════════════════════════╝${colors.reset}
`);

    if (dryRun) {
        console.log(`${colors.yellow}${colors.bold}DRY RUN MODE${colors.reset} - No files will be deleted\n`);
    }

    const databases = cleanTestDatabases();
    const duplicates = cleanDuplicateFiles();
    const tempDirs = cleanTempDirs();

    const report = generateReport({ databases, duplicates, tempDirs });

    // Print summary
    console.log(`
${colors.cyan}╔══════════════════════════════════════════════════════════════╗
║                        ${colors.bold}CLEANUP SUMMARY${colors.reset}${colors.cyan}                        ║
╚══════════════════════════════════════════════════════════════╝${colors.reset}

  ${colors.bold}Test Databases:${colors.reset}     ${databases.count} files (${formatBytes(databases.size)})
  ${colors.bold}Duplicate Files:${colors.reset}    ${duplicates.count} files (${formatBytes(duplicates.size)})
  ${colors.bold}Temp Directories:${colors.reset}   ${tempDirs.count} directories
  
  ${colors.bold}Total Freed Space:${colors.reset}  ${colors.green}${report.totalFreedSpace}${colors.reset}
`);

    if (dryRun) {
        console.log(`${colors.yellow}Run without --dry-run to actually delete files${colors.reset}\n`);
    }
}

main();
