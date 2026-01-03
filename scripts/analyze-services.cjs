#!/usr/bin/env node
/**
 * Automated TypeScript Migration Tool
 * Analyzes JavaScript services and generates migration reports
 */

const fs = require('fs');
const path = require('path');

// Configuration
const SERVICES_DIR = path.join(__dirname, '../server/services');
const OUTPUT_FILE = path.join(__dirname, '../migration-analysis.json');

// Service categories based on complexity
const categories = {
    simple: [],
    medium: [],
    complex: [],
    ai: [],
    alreadyMigrated: []
};

// Analyze a single service file
function analyzeService(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const fileName = path.basename(filePath);
    const relativePath = path.relative(SERVICES_DIR, filePath);

    // Check if already migrated (has .ts equivalent)
    const tsPath = filePath.replace('/services/', '/src/services/').replace('.js', '.ts');
    if (fs.existsSync(tsPath)) {
        return { category: 'alreadyMigrated', fileName, relativePath };
    }

    // Count lines of code (excluding comments and empty lines)
    const loc = content
        .split('\n')
        .filter(line => {
            const trimmed = line.trim();
            return trimmed && !trimmed.startsWith('//') && !trimmed.startsWith('/*') && !trimmed.startsWith('*');
        })
        .length;

    // Detect dependencies
    const requireMatches = content.match(/require\(['"](.*?)['"]\)/g) || [];
    const importMatches = content.match(/import .* from ['"](.*?)['"]/g) || [];
    const dependencies = [...requireMatches, ...importMatches];

    // Detect if it's an object literal service
    const isObjectLiteral = /const\s+\w+Service\s*=\s*\{/.test(content);

    // Detect if it's in AI subdirectory
    const isAI = relativePath.startsWith('ai/');

    // Categorize
    let category;
    if (isAI) {
        category = 'ai';
    } else if (loc < 200 && dependencies.length <= 2) {
        category = 'simple';
    } else if (loc < 500 && dependencies.length <= 5) {
        category = 'medium';
    } else {
        category = 'complex';
    }

    return {
        category,
        fileName,
        relativePath,
        loc,
        dependencies: dependencies.length,
        isObjectLiteral,
        isAI
    };
}

// Recursively find all .js files
function findJSFiles(dir, fileList = []) {
    const files = fs.readdirSync(dir);

    files.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);

        if (stat.isDirectory()) {
            findJSFiles(filePath, fileList);
        } else if (file.endsWith('.js') && !file.includes('.test.') && !file.includes('.bak')) {
            fileList.push(filePath);
        }
    });

    return fileList;
}

// Main analysis
console.log('🔍 Analyzing JavaScript services...\n');

const jsFiles = findJSFiles(SERVICES_DIR);
console.log(`Found ${jsFiles.length} JavaScript files\n`);

jsFiles.forEach(filePath => {
    const analysis = analyzeService(filePath);
    categories[analysis.category].push(analysis);
});

// Generate report
const report = {
    timestamp: new Date().toISOString(),
    summary: {
        total: jsFiles.length,
        simple: categories.simple.length,
        medium: categories.medium.length,
        complex: categories.complex.length,
        ai: categories.ai.length,
        alreadyMigrated: categories.alreadyMigrated.length,
        remaining: jsFiles.length - categories.alreadyMigrated.length
    },
    categories,
    migrationOrder: [
        ...categories.simple.map(s => ({ ...s, priority: 1 })),
        ...categories.medium.map(s => ({ ...s, priority: 2 })),
        ...categories.complex.map(s => ({ ...s, priority: 3 })),
        ...categories.ai.map(s => ({ ...s, priority: 4 }))
    ]
};

// Save report
fs.writeFileSync(OUTPUT_FILE, JSON.stringify(report, null, 2));

// Print summary
console.log('📊 Migration Analysis Summary:');
console.log('================================');
console.log(`Total JavaScript files:     ${report.summary.total}`);
console.log(`Already migrated:           ${report.summary.alreadyMigrated}`);
console.log(`Remaining to migrate:       ${report.summary.remaining}`);
console.log('');
console.log('By Category:');
console.log(`  Simple (Priority 1):      ${report.summary.simple}`);
console.log(`  Medium (Priority 2):      ${report.summary.medium}`);
console.log(`  Complex (Priority 3):     ${report.summary.complex}`);
console.log(`  AI Services (Priority 4): ${report.summary.ai}`);
console.log('');
console.log(`📝 Full report saved to: ${OUTPUT_FILE}`);
console.log('');
console.log('Next steps:');
console.log('  1. Review migration-analysis.json');
console.log('  2. Run: node scripts/migrate-service.js <serviceName>');
console.log('  3. Or run batch: node scripts/migrate-batch.js simple');
