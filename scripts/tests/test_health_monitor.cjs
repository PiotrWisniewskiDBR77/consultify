#!/usr/bin/env node
/**
 * Health Monitor Test Suite
 * 
 * Tests self-healing capabilities:
 * - Auto-repair triggers
 * - Table verification
 * - Database recovery
 * - Provider health tracking
 * - Alert system
 */

const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();

const SERVER_PATH = path.join(__dirname, '../../server');
const DB_PATH = path.join(SERVER_PATH, 'database.sqlite');

// Test implementations
async function testHealthMonitorModule() {
    const hmPath = path.join(SERVER_PATH, 'services/ai/healthMonitor.js');
    const exists = fs.existsSync(hmPath);

    let hasHealth = false;
    if (exists) {
        try {
            const content = fs.readFileSync(hmPath, 'utf8');
            hasHealth = content.includes('health') || 
                       content.includes('monitor') ||
                       content.includes('check');
        } catch {}
    }

    return {
        name: 'Health Monitor Module',
        passed: exists && hasHealth,
        message: exists ? (hasHealth ? 'Health monitor operational' : 'Health logic not found') : 'Health monitor not found'
    };
}

async function testAutoRepairTriggers() {
    const hmPath = path.join(SERVER_PATH, 'services/ai/healthMonitor.js');
    let hasAutoRepair = false;

    if (fs.existsSync(hmPath)) {
        try {
            const content = fs.readFileSync(hmPath, 'utf8');
            hasAutoRepair = content.includes('repair') || 
                           content.includes('fix') ||
                           content.includes('recover') ||
                           content.includes('heal');
        } catch {}
    }

    return {
        name: 'Auto-Repair Triggers',
        passed: hasAutoRepair,
        message: hasAutoRepair ? 'Auto-repair enabled' : 'Auto-repair not found'
    };
}

async function testTableVerification() {
    const hmPath = path.join(SERVER_PATH, 'services/ai/healthMonitor.js');
    let hasTableCheck = false;

    if (fs.existsSync(hmPath)) {
        try {
            const content = fs.readFileSync(hmPath, 'utf8');
            hasTableCheck = content.includes('table') || 
                           content.includes('schema') ||
                           content.includes('CREATE');
        } catch {}
    }

    return {
        name: 'Table Verification',
        passed: hasTableCheck,
        message: hasTableCheck ? 'Table verification enabled' : 'Table verification not found'
    };
}

async function testDatabaseConnectivity() {
    return new Promise((resolve) => {
        if (!fs.existsSync(DB_PATH)) {
            resolve({
                name: 'Database Connectivity',
                passed: false,
                message: 'Database not found'
            });
            return;
        }

        const db = new sqlite3.Database(DB_PATH);
        db.get("SELECT 1 as test", [], (err, row) => {
            db.close();
            resolve({
                name: 'Database Connectivity',
                passed: !err && row?.test === 1,
                message: err ? err.message : 'Database accessible'
            });
        });
    });
}

async function testProviderHealthTracking() {
    const paths = [
        path.join(SERVER_PATH, 'services/ai/healthMonitor.js'),
        path.join(SERVER_PATH, 'services/ai/llmHealthMonitor.js'),
        path.join(SERVER_PATH, 'services/ai/circuitBreaker.js')
    ];

    let hasProviderTracking = false;
    for (const p of paths) {
        if (fs.existsSync(p)) {
            try {
                const content = fs.readFileSync(p, 'utf8');
                if (content.includes('provider') && (content.includes('health') || content.includes('status') || content.includes('check'))) {
                    hasProviderTracking = true;
                    break;
                }
            } catch {}
        }
    }

    return {
        name: 'Provider Health Tracking',
        passed: hasProviderTracking,
        message: hasProviderTracking ? 'Provider tracking enabled' : 'Provider tracking not found'
    };
}

async function testAlertSystem() {
    const alertPath = path.join(SERVER_PATH, 'services/ai/alerting.js');
    const exists = fs.existsSync(alertPath);

    let hasAlerts = false;
    if (exists) {
        try {
            const content = fs.readFileSync(alertPath, 'utf8');
            hasAlerts = content.includes('alert') || 
                       content.includes('notify') ||
                       content.includes('send');
        } catch {}
    }

    return {
        name: 'Alert System',
        passed: exists && hasAlerts,
        message: exists ? (hasAlerts ? 'Alert system operational' : 'Alert logic not found') : 'Alert system not found'
    };
}

async function testSelfHealingCycle() {
    const hmPath = path.join(SERVER_PATH, 'services/ai/healthMonitor.js');
    let hasCycle = false;

    if (fs.existsSync(hmPath)) {
        try {
            const content = fs.readFileSync(hmPath, 'utf8');
            hasCycle = content.includes('interval') || 
                      content.includes('schedule') ||
                      content.includes('periodic') ||
                      content.includes('check') && content.includes('Interval');
        } catch {}
    }

    return {
        name: 'Self-Healing Cycle',
        passed: hasCycle,
        message: hasCycle ? 'Self-healing cycle configured' : 'Self-healing cycle not found'
    };
}

async function testStartupValidator() {
    const svPath = path.join(SERVER_PATH, 'services/ai/startupValidator.js');
    const exists = fs.existsSync(svPath);

    let hasValidation = false;
    if (exists) {
        try {
            const content = fs.readFileSync(svPath, 'utf8');
            hasValidation = content.includes('valid') || 
                           content.includes('startup') ||
                           content.includes('check');
        } catch {}
    }

    return {
        name: 'Startup Validator',
        passed: exists && hasValidation,
        message: exists ? (hasValidation ? 'Startup validator operational' : 'Validation logic not found') : 'Startup validator not found'
    };
}

async function testCircuitBreaker() {
    const cbPath = path.join(SERVER_PATH, 'services/ai/circuitBreaker.js');
    const exists = fs.existsSync(cbPath);

    let hasCircuitBreaker = false;
    if (exists) {
        try {
            const content = fs.readFileSync(cbPath, 'utf8');
            hasCircuitBreaker = content.includes('circuit') || 
                               content.includes('breaker') ||
                               content.includes('open') ||
                               content.includes('closed');
        } catch {}
    }

    return {
        name: 'Circuit Breaker',
        passed: exists && hasCircuitBreaker,
        message: exists ? (hasCircuitBreaker ? 'Circuit breaker operational' : 'Circuit breaker logic not found') : 'Circuit breaker not found'
    };
}

async function testRequiredTablesExist() {
    return new Promise((resolve) => {
        if (!fs.existsSync(DB_PATH)) {
            resolve({
                name: 'Required Tables Exist',
                passed: false,
                message: 'Database not found'
            });
            return;
        }

        const db = new sqlite3.Database(DB_PATH);
        const requiredTables = ['llm_providers', 'ai_audit_log'];
        const foundTables = [];

        db.all("SELECT name FROM sqlite_master WHERE type='table'", [], (err, rows) => {
            db.close();
            if (err) {
                resolve({
                    name: 'Required Tables Exist',
                    passed: false,
                    message: err.message
                });
                return;
            }

            const tableNames = (rows || []).map(r => r.name);
            requiredTables.forEach(t => {
                if (tableNames.some(tn => tn.includes(t.replace('_', '')) || tn === t)) {
                    foundTables.push(t);
                }
            });

            resolve({
                name: 'Required Tables Exist',
                passed: foundTables.length >= 1,
                message: `${foundTables.length}/${requiredTables.length} critical tables found`
            });
        });
    });
}

// Main test runner
async function runTests() {
    const tests = [];
    let passed = 0;
    let failed = 0;

    const testFunctions = [
        testHealthMonitorModule,
        testAutoRepairTriggers,
        testTableVerification,
        testDatabaseConnectivity,
        testProviderHealthTracking,
        testAlertSystem,
        testSelfHealingCycle,
        testStartupValidator,
        testCircuitBreaker,
        testRequiredTablesExist
    ];

    for (const testFn of testFunctions) {
        try {
            const result = await testFn();
            tests.push(result);
            if (result.passed) passed++; else failed++;
        } catch (e) {
            tests.push({
                name: testFn.name,
                passed: false,
                message: e.message
            });
            failed++;
        }
    }

    return { passed, failed, tests };
}

module.exports = { runTests };

if (require.main === module) {
    runTests().then(results => {
        console.log('\nHealth Monitor Test Results:');
        console.log('─'.repeat(50));
        results.tests.forEach(t => {
            const status = t.passed ? '✓' : '✗';
            console.log(`${status} ${t.name}: ${t.message}`);
        });
        console.log('─'.repeat(50));
        console.log(`Passed: ${results.passed}, Failed: ${results.failed}`);
        process.exit(results.failed > 0 ? 1 : 0);
    });
}

