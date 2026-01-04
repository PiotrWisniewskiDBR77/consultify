#!/usr/bin/env node
/**
 * Script to verify that a service migration was successful
 * Checks for createRequire removal, TypeScript compilation, and imports
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const serviceFile = process.argv[2];

if (!serviceFile) {
    console.error('Usage: node verify-migration.cjs <service-file-path>');
    process.exit(1);
}

const servicePath = path.resolve(serviceFile);
const serviceName = path.basename(servicePath, '.ts');

console.log(`Verifying migration for: ${serviceName}\n`);

const checks = {
    fileExists: false,
    noCreateRequire: false,
    noRequire: false,
    hasTypeScript: false,
    compiles: false,
    hasExports: false
};

// Check 1: File exists
checks.fileExists = fs.existsSync(servicePath);
if (!checks.fileExists) {
    console.error('❌ File does not exist!');
    process.exit(1);
}
console.log('✅ File exists');

// Check 2: No createRequire
const content = fs.readFileSync(servicePath, 'utf-8');
checks.noCreateRequire = !/createRequire/.test(content);
if (checks.noCreateRequire) {
    console.log('✅ No createRequire() found');
} else {
    console.log('❌ createRequire() still present');
}

// Check 3: No require() (except in comments)
const requireMatches = content.match(/require\(/g);
const commentRequires = (content.match(/\/\/.*require\(/g) || []).length;
checks.noRequire = !requireMatches || requireMatches.length === commentRequires;
if (checks.noRequire) {
    console.log('✅ No require() calls (except in comments)');
} else {
    console.log(`❌ Found ${requireMatches.length - commentRequires} require() calls`);
}

// Check 4: Has TypeScript code
checks.hasTypeScript = /export (class|interface|type|const|function|default)/.test(content);
if (checks.hasTypeScript) {
    console.log('✅ Contains TypeScript code');
} else {
    console.log('❌ No TypeScript exports found');
}

// Check 5: TypeScript compilation
try {
    const tscCheck = execSync(
        `npx tsc --noEmit "${servicePath}" 2>&1`,
        { encoding: 'utf-8', stdio: 'pipe', timeout: 10000 }
    );
    checks.compiles = !tscCheck.includes('error');
    if (checks.compiles) {
        console.log('✅ TypeScript compilation successful');
    } else {
        console.log('❌ TypeScript compilation errors:');
        console.log(tscCheck);
    }
} catch (e) {
    checks.compiles = false;
    console.log('❌ TypeScript compilation failed');
    if (e.stdout) console.log(e.stdout);
    if (e.stderr) console.log(e.stderr);
}

// Check 6: Has exports
checks.hasExports = /export (default|const|function|class)/.test(content);
if (checks.hasExports) {
    console.log('✅ Has exports');
} else {
    console.log('❌ No exports found');
}

// Summary
console.log('\n=== Verification Summary ===');
const allPassed = Object.values(checks).every(v => v === true);

if (allPassed) {
    console.log('✅ All checks passed! Migration successful.');
    process.exit(0);
} else {
    console.log('❌ Some checks failed. Please review the migration.');
    process.exit(1);
}






