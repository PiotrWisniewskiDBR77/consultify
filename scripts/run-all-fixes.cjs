#!/usr/bin/env node
/**
 * Master Script - Run All TypeScript Error Fixes
 * Executes all fix scripts in order and tracks progress
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');
const SERVER_DIR = path.join(ROOT_DIR, 'server');

const FIX_SCRIPTS = [
    { name: 'TS2339 - DB Query Type Assertions', script: 'fix-ts2339-db-queries.cjs', priority: 1 },
    { name: 'TS7030 - Return Paths', script: 'fix-ts7030-return-paths.cjs', priority: 2 },
    { name: 'TS6133 - Unused Variables', script: 'fix-ts6133-unused-vars-aggressive.cjs', priority: 3 },
    { name: 'TS7016 - Type Declarations', script: 'fix-ts7016-type-declarations.cjs', priority: 4 },
    { name: 'TS2367 - Always True/False', script: 'fix-ts2367-always-true-false.cjs', priority: 5 },
    { name: 'TS7006 - Implicit Any', script: 'fix-ts7006-implicit-any-comprehensive.cjs', priority: 6 },
    { name: 'TS2551 - Property Access', script: 'fix-ts2551-property-access.cjs', priority: 7 },
    { name: 'TS2614 - Module Exports', script: 'fix-ts2614-module-exports.cjs', priority: 8 },
    { name: 'TS2345 - Argument Types', script: 'fix-ts2345-argument-types.cjs', priority: 9 },
    { name: 'TS2322 - Type Assignments', script: 'fix-ts2322-type-assignments.cjs', priority: 10 },
];

function countErrors() {
    try {
        const result = execSync(
            `cd ${SERVER_DIR} && npm run build 2>&1 || true`,
            { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 }
        );
        const errorLines = result.split('\n').filter(line => line.includes('error TS'));
        return errorLines.length;
    } catch (error) {
        return -1;
    }
}

function runScript(scriptName) {
    const scriptPath = path.join(__dirname, scriptName);
    if (!fs.existsSync(scriptPath)) {
        console.log(`  ⚠️  Script not found: ${scriptName}`);
        return false;
    }
    
    try {
        console.log(`  🔧 Running ${scriptName}...`);
        execSync(`node ${scriptPath}`, {
            cwd: ROOT_DIR,
            stdio: 'inherit',
            maxBuffer: 50 * 1024 * 1024
        });
        return true;
    } catch (error) {
        console.log(`  ❌ Error running ${scriptName}: ${error.message}`);
        return false;
    }
}

function main() {
    console.log('\n🚀 TypeScript Error Reduction - Master Script\n');
    console.log('═'.repeat(60));
    
    // Initial error count
    console.log('\n📊 Initial error count...');
    const initialErrors = countErrors();
    console.log(`   Starting with: ${initialErrors} errors\n`);
    
    const results = [];
    let currentErrors = initialErrors;
    
    // Run each fix script
    for (const fix of FIX_SCRIPTS.sort((a, b) => a.priority - b.priority)) {
        console.log(`\n${'─'.repeat(60)}`);
        console.log(`\n🔹 ${fix.name}`);
        console.log(`   Script: ${fix.script}`);
        
        const errorsBefore = currentErrors;
        const success = runScript(fix.script);
        
        if (success) {
            const errorsAfter = countErrors();
            const reduction = errorsBefore - errorsAfter;
            const percentReduction = errorsBefore > 0 
                ? ((reduction / errorsBefore) * 100).toFixed(1)
                : 0;
            
            results.push({
                name: fix.name,
                script: fix.script,
                errorsBefore,
                errorsAfter,
                reduction,
                percentReduction: parseFloat(percentReduction),
                success: true
            });
            
            currentErrors = errorsAfter;
            
            console.log(`\n   ✅ Completed`);
            console.log(`   Errors before: ${errorsBefore}`);
            console.log(`   Errors after: ${errorsAfter}`);
            console.log(`   Reduction: ${reduction} (${percentReduction}%)`);
        } else {
            results.push({
                name: fix.name,
                script: fix.script,
                errorsBefore: currentErrors,
                errorsAfter: currentErrors,
                reduction: 0,
                percentReduction: 0,
                success: false
            });
        }
    }
    
    // Final summary
    console.log('\n' + '═'.repeat(60));
    console.log('\n📊 FINAL SUMMARY\n');
    
    const totalReduction = initialErrors - currentErrors;
    const totalPercentReduction = initialErrors > 0 
        ? ((totalReduction / initialErrors) * 100).toFixed(1)
        : 0;
    
    console.log(`Initial errors:     ${initialErrors}`);
    console.log(`Final errors:       ${currentErrors}`);
    console.log(`Total reduction:    ${totalReduction} (${totalPercentReduction}%)`);
    console.log(`Target (90%):       ${Math.round(initialErrors * 0.1)}`);
    console.log(`Status:             ${currentErrors <= Math.round(initialErrors * 0.1) ? '✅ ACHIEVED' : '⚠️  IN PROGRESS'}`);
    
    console.log('\n📋 Per-script results:');
    results.forEach((result, index) => {
        const status = result.success ? '✅' : '❌';
        console.log(`\n${index + 1}. ${status} ${result.name}`);
        console.log(`   Reduction: ${result.reduction} errors (${result.percentReduction}%)`);
    });
    
    // Save report
    const report = {
        timestamp: new Date().toISOString(),
        initialErrors,
        finalErrors: currentErrors,
        totalReduction,
        totalPercentReduction: parseFloat(totalPercentReduction),
        target90Percent: Math.round(initialErrors * 0.1),
        achieved: currentErrors <= Math.round(initialErrors * 0.1),
        results
    };
    
    fs.writeFileSync(
        path.join(ROOT_DIR, 'docs/TS_ERROR_REDUCTION_PROGRESS.json'),
        JSON.stringify(report, null, 2)
    );
    
    console.log('\n✅ Progress saved to docs/TS_ERROR_REDUCTION_PROGRESS.json\n');
}

main();

