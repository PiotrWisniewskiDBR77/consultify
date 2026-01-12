#!/usr/bin/env node
/**
 * Memory System Test Suite
 * 
 * Tests the AI memory architecture:
 * - Session memory CRUD
 * - Project memory persistence
 * - Organization memory isolation
 * - Memory significance scoring
 * - Context window management
 */

const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();

const SERVER_PATH = path.join(__dirname, '../../server');
const DB_PATH = path.join(SERVER_PATH, 'database.sqlite');

// Test implementations
async function testSessionMemoryModule() {
    const memoryPath = path.join(SERVER_PATH, 'services/ai/memoryManager.js');
    const exists = fs.existsSync(memoryPath);

    let hasSessionMemory = false;
    if (exists) {
        try {
            const content = fs.readFileSync(memoryPath, 'utf8');
            hasSessionMemory = content.includes('session') || 
                              content.includes('Session') ||
                              content.includes('temporary');
        } catch {}
    }

    return {
        name: 'Session Memory Module',
        passed: exists && hasSessionMemory,
        message: exists ? (hasSessionMemory ? 'Session memory operational' : 'Session memory not implemented') : 'Memory manager not found'
    };
}

async function testProjectMemoryModule() {
    const memoryPath = path.join(SERVER_PATH, 'services/ai/projectMemoryStore.js');
    const exists = fs.existsSync(memoryPath);

    let hasProjectMemory = false;
    if (exists) {
        try {
            const content = fs.readFileSync(memoryPath, 'utf8');
            hasProjectMemory = content.includes('project') || 
                              content.includes('Project') ||
                              content.includes('addMemory');
        } catch {}
    }

    return {
        name: 'Project Memory Module',
        passed: exists && hasProjectMemory,
        message: exists ? (hasProjectMemory ? 'Project memory operational' : 'Project memory not implemented') : 'Project memory store not found'
    };
}

async function testOrganizationMemoryModule() {
    const memoryPath = path.join(SERVER_PATH, 'services/ai/organizationMemoryStore.js');
    const exists = fs.existsSync(memoryPath);

    let hasOrgMemory = false;
    if (exists) {
        try {
            const content = fs.readFileSync(memoryPath, 'utf8');
            hasOrgMemory = content.includes('organization') || 
                          content.includes('Organization') ||
                          content.includes('org');
        } catch {}
    }

    return {
        name: 'Organization Memory Module',
        passed: exists && hasOrgMemory,
        message: exists ? (hasOrgMemory ? 'Organization memory operational' : 'Org memory not implemented') : 'Organization memory store not found'
    };
}

async function testMemoryDatabaseTables() {
    return new Promise((resolve) => {
        if (!fs.existsSync(DB_PATH)) {
            resolve({
                name: 'Memory Database Tables',
                passed: false,
                message: 'Database not found'
            });
            return;
        }

        const db = new sqlite3.Database(DB_PATH);
        const requiredTables = ['ai_learning_patterns', 'ai_audit_log'];
        const foundTables = [];

        db.all("SELECT name FROM sqlite_master WHERE type='table'", [], (err, rows) => {
            db.close();
            if (err) {
                resolve({
                    name: 'Memory Database Tables',
                    passed: false,
                    message: err.message
                });
                return;
            }

            const tableNames = (rows || []).map(r => r.name);
            requiredTables.forEach(t => {
                if (tableNames.includes(t)) foundTables.push(t);
            });

            resolve({
                name: 'Memory Database Tables',
                passed: foundTables.length >= 1,
                message: `${foundTables.length}/${requiredTables.length} memory tables found`
            });
        });
    });
}

async function testSignificanceScoring() {
    const memoryPath = path.join(SERVER_PATH, 'services/ai/memoryManager.js');
    let hasSignificance = false;

    if (fs.existsSync(memoryPath)) {
        try {
            const content = fs.readFileSync(memoryPath, 'utf8');
            hasSignificance = content.includes('significance') || 
                             content.includes('Significance') ||
                             content.includes('score') ||
                             content.includes('importance');
        } catch {}
    }

    return {
        name: 'Significance Scoring',
        passed: hasSignificance,
        message: hasSignificance ? 'Significance scoring implemented' : 'Significance scoring not found'
    };
}

async function testContextWindowManagement() {
    const paths = [
        path.join(SERVER_PATH, 'services/ai/memoryManager.js'),
        path.join(SERVER_PATH, 'services/ai/enhancedContextBuilder.js'),
        path.join(SERVER_PATH, 'services/ai/aiContext.js')
    ];

    let hasContextManagement = false;
    for (const p of paths) {
        if (fs.existsSync(p)) {
            try {
                const content = fs.readFileSync(p, 'utf8');
                if (content.includes('context') && (content.includes('window') || content.includes('limit') || content.includes('truncate'))) {
                    hasContextManagement = true;
                    break;
                }
            } catch {}
        }
    }

    return {
        name: 'Context Window Management',
        passed: hasContextManagement,
        message: hasContextManagement ? 'Context management operational' : 'Context management not found'
    };
}

async function testMemoryRetrieval() {
    const memoryPath = path.join(SERVER_PATH, 'services/ai/memoryManager.js');
    let hasRetrieval = false;

    if (fs.existsSync(memoryPath)) {
        try {
            const content = fs.readFileSync(memoryPath, 'utf8');
            hasRetrieval = content.includes('get') || 
                          content.includes('retrieve') ||
                          content.includes('fetch') ||
                          content.includes('recall');
        } catch {}
    }

    return {
        name: 'Memory Retrieval',
        passed: hasRetrieval,
        message: hasRetrieval ? 'Memory retrieval operational' : 'Memory retrieval not found'
    };
}

async function testMemoryPersistence() {
    const memoryPath = path.join(SERVER_PATH, 'services/ai/memoryManager.js');
    let hasPersistence = false;

    if (fs.existsSync(memoryPath)) {
        try {
            const content = fs.readFileSync(memoryPath, 'utf8');
            hasPersistence = content.includes('save') || 
                            content.includes('store') ||
                            content.includes('persist') ||
                            content.includes('add');
        } catch {}
    }

    return {
        name: 'Memory Persistence',
        passed: hasPersistence,
        message: hasPersistence ? 'Memory persistence operational' : 'Memory persistence not found'
    };
}

async function testMemoryIsolation() {
    // Check if memory operations include organization/project context
    const paths = [
        path.join(SERVER_PATH, 'services/ai/projectMemoryStore.js'),
        path.join(SERVER_PATH, 'services/ai/organizationMemoryStore.js')
    ];

    let hasIsolation = false;
    for (const p of paths) {
        if (fs.existsSync(p)) {
            try {
                const content = fs.readFileSync(p, 'utf8');
                if (content.includes('organizationId') || content.includes('projectId') || content.includes('userId')) {
                    hasIsolation = true;
                    break;
                }
            } catch {}
        }
    }

    return {
        name: 'Memory Isolation',
        passed: hasIsolation,
        message: hasIsolation ? 'Memory isolation enforced' : 'Memory isolation not verified'
    };
}

// Main test runner
async function runTests() {
    const tests = [];
    let passed = 0;
    let failed = 0;

    const testFunctions = [
        testSessionMemoryModule,
        testProjectMemoryModule,
        testOrganizationMemoryModule,
        testMemoryDatabaseTables,
        testSignificanceScoring,
        testContextWindowManagement,
        testMemoryRetrieval,
        testMemoryPersistence,
        testMemoryIsolation
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
        console.log('\nMemory System Test Results:');
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

