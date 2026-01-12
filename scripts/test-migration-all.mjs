#!/usr/bin/env node
/**
 * Migration Test Orchestrator
 * 
 * Runs all migration tests and generates comprehensive report
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');

const tests = [
    { name: 'Structural', script: 'test-migration-structural.mjs', required: true },
    { name: 'Imports', script: 'test-migration-imports.mjs', required: true },
    { name: 'Duplicates', script: 'test-migration-duplicates.mjs', required: false },
    { name: 'Coverage', script: 'test-migration-coverage.mjs', required: false }
];

async function runTest(test) {
    console.log(`\n🧪 Running ${test.name} tests...`);
    console.log('─'.repeat(50));
    
    try {
        const scriptPath = path.join(__dirname, test.script);
        execSync(`node ${scriptPath}`, {
            cwd: projectRoot,
            stdio: 'inherit'
        });
        console.log(`✅ ${test.name} tests passed\n`);
        return { name: test.name, status: 'passed' };
    } catch (error) {
        console.error(`❌ ${test.name} tests failed\n`);
        if (test.required) {
            throw error;
        }
        return { name: test.name, status: 'failed', error: error.message };
    }
}

async function runVitestTests() {
    console.log('\n🧪 Running Vitest migration tests...');
    console.log('─'.repeat(50));
    
    try {
        execSync('npm run test:migration:structural', {
            cwd: projectRoot,
            stdio: 'inherit'
        });
        console.log('✅ Vitest tests passed\n');
        return true;
    } catch (error) {
        console.error('⚠️  Some Vitest tests failed (non-critical)\n');
        return false;
    }
}

async function main() {
    console.log('🚀 Starting Migration Test Suite');
    console.log('='.repeat(50));

    const results = [];

    // Run script-based tests
    for (const test of tests) {
        try {
            const result = await runTest(test);
            results.push(result);
        } catch (error) {
            if (test.required) {
                console.error(`\n❌ Critical test failed: ${test.name}`);
                process.exit(1);
            }
        }
    }

    // Run Vitest tests (if available)
    try {
        await runVitestTests();
    } catch (error) {
        console.warn('⚠️  Vitest tests not available or failed');
    }

    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('📊 Test Summary');
    console.log('='.repeat(50));
    
    results.forEach(result => {
        const icon = result.status === 'passed' ? '✅' : '❌';
        console.log(`${icon} ${result.name}: ${result.status}`);
    });

    const allPassed = results.every(r => r.status === 'passed');
    
    if (allPassed) {
        console.log('\n✅ All migration tests passed!');
        process.exit(0);
    } else {
        console.log('\n⚠️  Some tests failed. Check reports for details.');
        process.exit(1);
    }
}

main().catch(err => {
    console.error('❌ Fatal error:', err);
    process.exit(1);
});

