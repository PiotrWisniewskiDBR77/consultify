#!/usr/bin/env node
/**
 * Cleanup Artifacts Script
 * 
 * Removes compiled artifacts from legacy directories:
 * - .d.ts declaration files
 * - .d.ts.map declaration map files
 * - .js.map source map files
 * - .bak backup files
 * 
 * Usage: node scripts/cleanup-artifacts.cjs
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');
const LEGACY_DIRS = [
    path.join(ROOT_DIR, 'server/services'),
    path.join(ROOT_DIR, 'server/routes'),
];

const ARTIFACT_PATTERNS = [
    /\.d\.ts$/,
    /\.d\.ts\.map$/,
    /\.js\.map$/,
    /\.bak$/,
    /\.backup$/,
    /\.test-backup$/,
];

const results = {
    scanned: 0,
    removed: [],
    errors: [],
    byType: {},
};

function getFileType(filename) {
    if (filename.endsWith('.d.ts.map')) return '.d.ts.map';
    if (filename.endsWith('.d.ts')) return '.d.ts';
    if (filename.endsWith('.js.map')) return '.js.map';
    if (filename.endsWith('.bak')) return '.bak';
    if (filename.endsWith('.backup')) return '.backup';
    if (filename.endsWith('.test-backup')) return '.test-backup';
    return 'other';
}

function cleanDirectory(dir) {
    if (!fs.existsSync(dir)) {
        console.log(`  Directory not found: ${dir}`);
        return;
    }

    const files = fs.readdirSync(dir);
    
    for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
            // Recursively clean subdirectories (like ai/, integrations/, etc.)
            cleanDirectory(fullPath);
            continue;
        }
        
        results.scanned++;
        
        // Check if file matches any artifact pattern
        const isArtifact = ARTIFACT_PATTERNS.some(pattern => pattern.test(file));
        
        if (isArtifact) {
            try {
                fs.unlinkSync(fullPath);
                const relativePath = path.relative(ROOT_DIR, fullPath);
                results.removed.push(relativePath);
                
                const type = getFileType(file);
                results.byType[type] = (results.byType[type] || 0) + 1;
                
                console.log(`  ✅ Removed: ${relativePath}`);
            } catch (err) {
                results.errors.push({
                    file: fullPath,
                    error: err.message,
                });
                console.log(`  ❌ Failed: ${file} - ${err.message}`);
            }
        }
    }
}

console.log('\n🧹 ARTIFACT CLEANUP SCRIPT\n');
console.log('Scanning legacy directories for compiled artifacts...\n');

for (const dir of LEGACY_DIRS) {
    const relativePath = path.relative(ROOT_DIR, dir);
    console.log(`📁 ${relativePath}/`);
    cleanDirectory(dir);
    console.log('');
}

// Summary
console.log('═'.repeat(50));
console.log('📊 SUMMARY\n');
console.log(`  Files scanned: ${results.scanned}`);
console.log(`  Files removed: ${results.removed.length}`);
console.log(`  Errors: ${results.errors.length}`);
console.log('\n  By type:');
for (const [type, count] of Object.entries(results.byType)) {
    console.log(`    ${type}: ${count}`);
}
console.log('═'.repeat(50));

// Save results to JSON
const reportPath = path.join(ROOT_DIR, 'cleanup-artifacts-report.json');
fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
console.log(`\n📄 Report saved to: cleanup-artifacts-report.json`);

// Exit with error code if there were failures
if (results.errors.length > 0) {
    process.exit(1);
}


