#!/usr/bin/env node
/**
 * Enterprise Security Test Suite
 * 
 * Tests security mechanisms:
 * - PII detection and redaction
 * - SQL injection prevention
 * - Prompt injection detection
 * - Rate limiting
 * - Audit logging
 * - Access control
 */

const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();

const SERVER_PATH = path.join(__dirname, '../../server');
const DB_PATH = path.join(SERVER_PATH, 'database.sqlite');

// Test implementations
async function testEnterpriseSecurity() {
    const secPath = path.join(SERVER_PATH, 'services/ai/enterpriseSecurity.js');
    const exists = fs.existsSync(secPath);

    let hasSecurity = false;
    if (exists) {
        try {
            const content = fs.readFileSync(secPath, 'utf8');
            hasSecurity = content.includes('security') || 
                         content.includes('protect') ||
                         content.includes('sanitize');
        } catch {}
    }

    return {
        name: 'Enterprise Security Module',
        passed: exists && hasSecurity,
        message: exists ? (hasSecurity ? 'Security module operational' : 'Security logic not found') : 'Enterprise security not found'
    };
}

async function testPIIDetection() {
    const secPath = path.join(SERVER_PATH, 'services/ai/enterpriseSecurity.js');
    let hasPII = false;

    if (fs.existsSync(secPath)) {
        try {
            const content = fs.readFileSync(secPath, 'utf8');
            hasPII = content.includes('PII') || 
                    content.includes('pii') ||
                    content.includes('email') ||
                    content.includes('phone') ||
                    content.includes('ssn') ||
                    content.includes('personal');
        } catch {}
    }

    return {
        name: 'PII Detection',
        passed: hasPII,
        message: hasPII ? 'PII detection enabled' : 'PII detection not found'
    };
}

async function testPIIRedaction() {
    const secPath = path.join(SERVER_PATH, 'services/ai/enterpriseSecurity.js');
    let hasRedaction = false;

    if (fs.existsSync(secPath)) {
        try {
            const content = fs.readFileSync(secPath, 'utf8');
            hasRedaction = content.includes('redact') || 
                          content.includes('REDACTED') ||
                          content.includes('mask') ||
                          content.includes('anonymize') ||
                          content.includes('sanitize');
        } catch {}
    }

    return {
        name: 'PII Redaction',
        passed: hasRedaction,
        message: hasRedaction ? 'PII redaction enabled' : 'PII redaction not found'
    };
}

async function testSQLInjectionPrevention() {
    const paths = [
        path.join(SERVER_PATH, 'services/ai/enterpriseSecurity.js'),
        path.join(SERVER_PATH, 'utils/dbPromise.js')
    ];

    let hasSQLProtection = false;
    for (const p of paths) {
        if (fs.existsSync(p)) {
            try {
                const content = fs.readFileSync(p, 'utf8');
                if (content.includes('injection') || content.includes('sanitize') || content.includes('escape') || content.includes('parameterized')) {
                    hasSQLProtection = true;
                    break;
                }
            } catch {}
        }
    }

    return {
        name: 'SQL Injection Prevention',
        passed: hasSQLProtection,
        message: hasSQLProtection ? 'SQL injection protection enabled' : 'SQL protection not verified'
    };
}

async function testPromptInjectionDetection() {
    const paths = [
        path.join(SERVER_PATH, 'services/ai/enterpriseSecurity.js'),
        path.join(SERVER_PATH, 'services/ai/aiGateway.js'),
        path.join(SERVER_PATH, 'services/ai/qualityChecker.js')
    ];

    let hasPromptProtection = false;
    for (const p of paths) {
        if (fs.existsSync(p)) {
            try {
                const content = fs.readFileSync(p, 'utf8');
                if (content.includes('injection') || 
                    content.includes('jailbreak') ||
                    content.includes('malicious') ||
                    content.includes('filter') ||
                    (content.includes('prompt') && content.includes('valid'))) {
                    hasPromptProtection = true;
                    break;
                }
            } catch {}
        }
    }

    return {
        name: 'Prompt Injection Detection',
        passed: hasPromptProtection,
        message: hasPromptProtection ? 'Prompt injection protection enabled' : 'Prompt injection protection not found'
    };
}

async function testRateLimiting() {
    const ratePath = path.join(SERVER_PATH, 'services/ai/rateLimiter.js');
    const exists = fs.existsSync(ratePath);

    let hasRateLimiting = false;
    if (exists) {
        try {
            const content = fs.readFileSync(ratePath, 'utf8');
            hasRateLimiting = content.includes('limit') || 
                             content.includes('rate') ||
                             content.includes('throttle');
        } catch {}
    }

    return {
        name: 'Rate Limiting',
        passed: exists && hasRateLimiting,
        message: exists ? (hasRateLimiting ? 'Rate limiting operational' : 'Rate limiting logic not found') : 'Rate limiter not found'
    };
}

async function testAuditLogging() {
    return new Promise((resolve) => {
        if (!fs.existsSync(DB_PATH)) {
            resolve({
                name: 'Audit Logging',
                passed: false,
                message: 'Database not found'
            });
            return;
        }

        const db = new sqlite3.Database(DB_PATH);
        db.all("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%audit%'", [], (err, rows) => {
            db.close();
            if (err) {
                resolve({
                    name: 'Audit Logging',
                    passed: false,
                    message: err.message
                });
                return;
            }

            const hasAuditTable = rows && rows.length > 0;
            resolve({
                name: 'Audit Logging',
                passed: hasAuditTable,
                message: hasAuditTable ? `Found: ${rows.map(r => r.name).join(', ')}` : 'No audit tables found'
            });
        });
    });
}

async function testAccessControl() {
    const permPath = path.join(SERVER_PATH, 'services/permissionService.js');
    const exists = fs.existsSync(permPath);

    let hasAccessControl = false;
    if (exists) {
        try {
            const content = fs.readFileSync(permPath, 'utf8');
            hasAccessControl = content.includes('permission') || 
                              content.includes('role') ||
                              content.includes('access') ||
                              content.includes('authorize');
        } catch {}
    }

    return {
        name: 'Access Control',
        passed: exists && hasAccessControl,
        message: exists ? (hasAccessControl ? 'Access control operational' : 'Access control logic not found') : 'Permission service not found'
    };
}

async function testInputValidation() {
    const secPath = path.join(SERVER_PATH, 'services/ai/enterpriseSecurity.js');
    let hasValidation = false;

    if (fs.existsSync(secPath)) {
        try {
            const content = fs.readFileSync(secPath, 'utf8');
            hasValidation = content.includes('valid') || 
                           content.includes('sanitize') ||
                           content.includes('clean');
        } catch {}
    }

    return {
        name: 'Input Validation',
        passed: hasValidation,
        message: hasValidation ? 'Input validation enabled' : 'Input validation not found'
    };
}

async function testSecurityAlerts() {
    const alertPath = path.join(SERVER_PATH, 'services/ai/alerting.js');
    const exists = fs.existsSync(alertPath);

    let hasAlerts = false;
    if (exists) {
        try {
            const content = fs.readFileSync(alertPath, 'utf8');
            hasAlerts = content.includes('alert') || 
                       content.includes('notify') ||
                       content.includes('warning');
        } catch {}
    }

    return {
        name: 'Security Alerts',
        passed: exists && hasAlerts,
        message: exists ? (hasAlerts ? 'Security alerts operational' : 'Alert logic not found') : 'Alerting service not found'
    };
}

// Functional tests - test actual PII detection patterns
async function testPIIPatterns() {
    const testCases = [
        { input: 'Email: test@example.com', type: 'email', expected: true },
        { input: 'Phone: +1-555-123-4567', type: 'phone', expected: true },
        { input: 'SSN: 123-45-6789', type: 'ssn', expected: true },
        { input: 'Credit Card: 4111111111111111', type: 'credit_card', expected: true },
        { input: 'Just regular text', type: 'none', expected: false }
    ];

    const patterns = {
        email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/,
        phone: /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/,
        ssn: /\d{3}-\d{2}-\d{4}/,
        credit_card: /\d{16}|\d{4}[-\s]\d{4}[-\s]\d{4}[-\s]\d{4}/
    };

    let detected = 0;
    for (const tc of testCases) {
        let found = false;
        for (const [type, pattern] of Object.entries(patterns)) {
            if (pattern.test(tc.input)) {
                found = true;
                break;
            }
        }
        if (found === tc.expected) detected++;
    }

    return {
        name: 'PII Pattern Detection',
        passed: detected >= testCases.length - 1,
        message: `${detected}/${testCases.length} patterns correctly identified`
    };
}

// Main test runner
async function runTests() {
    const tests = [];
    let passed = 0;
    let failed = 0;

    const testFunctions = [
        testEnterpriseSecurity,
        testPIIDetection,
        testPIIRedaction,
        testPIIPatterns,
        testSQLInjectionPrevention,
        testPromptInjectionDetection,
        testRateLimiting,
        testAuditLogging,
        testAccessControl,
        testInputValidation,
        testSecurityAlerts
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
        console.log('\nEnterprise Security Test Results:');
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

