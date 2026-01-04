#!/usr/bin/env node
/**
 * Analyze Console Usage
 * 
 * Analyzes console.log/error/warn/debug usage across the codebase
 * Categorizes files by priority (critical vs others)
 * Excludes test files, seed scripts, migration scripts
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT_DIR = path.join(__dirname, '..');
const SERVER_SRC = path.join(ROOT_DIR, 'server/src');

// Patterns to exclude
const EXCLUDE_PATTERNS = [
    /\.test\.(ts|js)$/,
    /\.spec\.(ts|js)$/,
    /test[s]?/,
    /seed/,
    /migration/,
    /\.backup\./,
    /node_modules/,
    /dist/,
];

// Critical directories (high priority)
const CRITICAL_DIRS = [
    'routes/auth',
    'routes/billing',
    'routes/ai',
    'controllers',
    'services/billing',
    'services/ai',
    'middleware/auth',
];

function shouldExclude(filePath) {
    return EXCLUDE_PATTERNS.some(pattern => pattern.test(filePath));
}

function isCritical(filePath) {
    const relativePath = path.relative(SERVER_SRC, filePath);
    return CRITICAL_DIRS.some(dir => relativePath.includes(dir));
}

function countConsoleStatements(content) {
    const patterns = {
        log: /console\.log\(/g,
        error: /console\.error\(/g,
        warn: /console\.warn\(/g,
        debug: /console\.debug\(/g,
        info: /console\.info\(/g,
    };

    const counts = {};
    for (const [type, pattern] of Object.entries(patterns)) {
        const matches = content.match(pattern);
        counts[type] = matches ? matches.length : 0;
    }

    counts.total = Object.values(counts).reduce((sum, count) => sum + count, 0);
    return counts;
}

function findFiles(dir, fileList = []) {
    const files = fs.readdirSync(dir);

    files.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);

        if (stat.isDirectory()) {
            findFiles(filePath, fileList);
        } else if ((file.endsWith('.ts') || file.endsWith('.js')) && !shouldExclude(filePath)) {
            fileList.push(filePath);
        }
    });

    return fileList;
}

function analyzeFile(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        const counts = countConsoleStatements(content);
        
        if (counts.total === 0) {
            return null;
        }

        return {
            file: path.relative(ROOT_DIR, filePath),
            path: filePath,
            critical: isCritical(filePath),
            counts,
        };
    } catch (error) {
        console.error(`Error analyzing ${filePath}:`, error.message);
        return null;
    }
}

function main() {
    console.log('🔍 Analyzing console usage in server/src...\n');

    const files = findFiles(SERVER_SRC);
    console.log(`Found ${files.length} files to analyze\n`);

    const results = [];
    let totalCount = 0;

    files.forEach(filePath => {
        const result = analyzeFile(filePath);
        if (result) {
            results.push(result);
            totalCount += result.counts.total;
        }
    });

    // Sort by critical first, then by count
    results.sort((a, b) => {
        if (a.critical !== b.critical) {
            return b.critical ? 1 : -1;
        }
        return b.counts.total - a.counts.total;
    });

    // Categorize
    const critical = results.filter(r => r.critical);
    const others = results.filter(r => !r.critical);

    console.log('='.repeat(80));
    console.log('SUMMARY');
    console.log('='.repeat(80));
    console.log(`Total files with console statements: ${results.length}`);
    console.log(`Total console statements: ${totalCount}`);
    console.log(`Critical files: ${critical.length} (${critical.reduce((sum, r) => sum + r.counts.total, 0)} statements)`);
    console.log(`Other files: ${others.length} (${others.reduce((sum, r) => sum + r.counts.total, 0)} statements)`);
    console.log('');

    // Breakdown by type
    const breakdown = {
        log: 0,
        error: 0,
        warn: 0,
        debug: 0,
        info: 0,
    };

    results.forEach(r => {
        Object.keys(breakdown).forEach(key => {
            breakdown[key] += r.counts[key] || 0;
        });
    });

    console.log('Breakdown by type:');
    Object.entries(breakdown).forEach(([type, count]) => {
        if (count > 0) {
            console.log(`  console.${type}: ${count}`);
        }
    });
    console.log('');

    // Top 20 files
    console.log('='.repeat(80));
    console.log('TOP 20 FILES (by console statement count)');
    console.log('='.repeat(80));
    results.slice(0, 20).forEach((result, index) => {
        const marker = result.critical ? '🔥' : '  ';
        console.log(`${marker} ${index + 1}. ${result.file} (${result.counts.total} statements)`);
        Object.entries(result.counts).forEach(([type, count]) => {
            if (type !== 'total' && count > 0) {
                console.log(`     - console.${type}: ${count}`);
            }
        });
    });
    console.log('');

    // Critical files
    if (critical.length > 0) {
        console.log('='.repeat(80));
        console.log('CRITICAL FILES (Priority Migration)');
        console.log('='.repeat(80));
        critical.forEach((result, index) => {
            console.log(`${index + 1}. ${result.file} (${result.counts.total} statements)`);
        });
        console.log('');
    }

    // Save detailed report
    const reportPath = path.join(ROOT_DIR, 'docs/CONSOLE_USAGE_ANALYSIS.json');
    fs.writeFileSync(reportPath, JSON.stringify({
        summary: {
            totalFiles: results.length,
            totalStatements: totalCount,
            criticalFiles: critical.length,
            otherFiles: others.length,
            breakdown,
        },
        critical,
        others,
        all: results,
    }, null, 2));

    console.log(`📊 Detailed report saved to: ${reportPath}`);
    console.log('');

    return {
        totalCount,
        critical,
        others,
        results,
    };
}

if (require.main === module) {
    main();
}

module.exports = { main, analyzeFile, findFiles };

