// Verification Script for AI Core Layer
// Run with: node verify_ai.cjs

console.log('===========================================');
console.log('AI CORE LAYER VERIFICATION');
console.log('Enterprise PMO Brain');
console.log('===========================================\n');

let passed = 0;
let failed = 0;

function test(name, actual, expected) {
    if (actual === expected) {
        console.log(`✅ ${name}: PASSED`);
        passed++;
    } else {
        console.log(`❌ ${name}: FAILED (got ${actual}, expected ${expected})`);
        failed++;
    }
}

function testTruthy(name, value) {
    if (value) {
        console.log(`✅ ${name}: PASSED`);
        passed++;
    } else {
        console.log(`❌ ${name}: FAILED (falsy value)`);
        failed++;
    }
}

// 1. Test Service Modules Load
console.log('\n--- Testing AI Service Modules Load ---\n');

try {
    const AIContextBuilder = require('./server/services/aiContextBuilder');
    testTruthy('AIContextBuilder loads', !!AIContextBuilder.buildContext);
    testTruthy('AIContextBuilder._buildPlatformContext exists', !!AIContextBuilder._buildPlatformContext);
    testTruthy('AIContextBuilder._buildProjectContext exists', !!AIContextBuilder._buildProjectContext);
} catch (e) {
    console.log(`❌ AIContextBuilder failed to load: ${e.message}`);
    failed += 3;
}

try {
    const AIPolicyEngine = require('./server/services/aiPolicyEngine');
    testTruthy('AIPolicyEngine loads', !!AIPolicyEngine.getEffectivePolicy);
    testTruthy('AIPolicyEngine.canPerformAction exists', !!AIPolicyEngine.canPerformAction);
    test('POLICY_LEVELS count', Object.keys(AIPolicyEngine.POLICY_LEVELS).length, 4);
} catch (e) {
    console.log(`❌ AIPolicyEngine failed to load: ${e.message}`);
    failed += 3;
}

try {
    const AIMemoryManager = require('./server/services/aiMemoryManager');
    testTruthy('AIMemoryManager loads', !!AIMemoryManager.recordProjectMemory);
    testTruthy('AIMemoryManager.getUserPreferences exists', !!AIMemoryManager.getUserPreferences);
    testTruthy('AIMemoryManager.createSession exists', !!AIMemoryManager.createSession);
    test('MEMORY_TYPES count', Object.keys(AIMemoryManager.MEMORY_TYPES).length, 4);
} catch (e) {
    console.log(`❌ AIMemoryManager failed to load: ${e.message}`);
    failed += 4;
}

try {
    const AIOrchestrator = require('./server/services/aiOrchestrator');
    testTruthy('AIOrchestrator loads', !!AIOrchestrator.processMessage);
    testTruthy('AIOrchestrator._detectIntent exists', !!AIOrchestrator._detectIntent);
    test('AI_ROLES count', Object.keys(AIOrchestrator.AI_ROLES).length, 4);
    test('CHAT_MODES count', Object.keys(AIOrchestrator.CHAT_MODES).length, 5);
} catch (e) {
    console.log(`❌ AIOrchestrator failed to load: ${e.message}`);
    failed += 4;
}

try {
    const AIActionExecutor = require('./server/services/aiActionExecutor');
    testTruthy('AIActionExecutor loads', !!AIActionExecutor.requestAction);
    testTruthy('AIActionExecutor.createDraft exists', !!AIActionExecutor.createDraft);
    testTruthy('AIActionExecutor.approveAction exists', !!AIActionExecutor.approveAction);
    test('ACTION_TYPES count', Object.keys(AIActionExecutor.ACTION_TYPES).length, 7);
} catch (e) {
    console.log(`❌ AIActionExecutor failed to load: ${e.message}`);
    failed += 4;
}

try {
    const AIAuditLogger = require('./server/services/aiAuditLogger');
    testTruthy('AIAuditLogger loads', !!AIAuditLogger.logInteraction);
    testTruthy('AIAuditLogger.getAuditLogs exists', !!AIAuditLogger.getAuditLogs);
    testTruthy('AIAuditLogger.getAuditStats exists', !!AIAuditLogger.getAuditStats);
} catch (e) {
    console.log(`❌ AIAuditLogger failed to load: ${e.message}`);
    failed += 3;
}

// 2. Test Policy Levels
console.log('\n--- Testing Policy Levels ---\n');

const AIPolicyEngine = require('./server/services/aiPolicyEngine');
testTruthy('ADVISORY level exists', AIPolicyEngine.POLICY_LEVELS.ADVISORY === 'ADVISORY');
testTruthy('ASSISTED level exists', AIPolicyEngine.POLICY_LEVELS.ASSISTED === 'ASSISTED');
testTruthy('PROACTIVE level exists', AIPolicyEngine.POLICY_LEVELS.PROACTIVE === 'PROACTIVE');
testTruthy('AUTOPILOT level exists', AIPolicyEngine.POLICY_LEVELS.AUTOPILOT === 'AUTOPILOT');

// 3. Test AI Roles
console.log('\n--- Testing AI Roles ---\n');

const AIOrchestrator = require('./server/services/aiOrchestrator');
testTruthy('ADVISOR role exists', AIOrchestrator.AI_ROLES.ADVISOR === 'ADVISOR');
testTruthy('PMO_MANAGER role exists', AIOrchestrator.AI_ROLES.PMO_MANAGER === 'PMO_MANAGER');
testTruthy('EXECUTOR role exists', AIOrchestrator.AI_ROLES.EXECUTOR === 'EXECUTOR');
testTruthy('EDUCATOR role exists', AIOrchestrator.AI_ROLES.EDUCATOR === 'EDUCATOR');

// 4. Test Chat Modes
console.log('\n--- Testing Chat Modes ---\n');

testTruthy('EXPLAIN mode exists', AIOrchestrator.CHAT_MODES.EXPLAIN === 'EXPLAIN');
testTruthy('GUIDE mode exists', AIOrchestrator.CHAT_MODES.GUIDE === 'GUIDE');
testTruthy('ANALYZE mode exists', AIOrchestrator.CHAT_MODES.ANALYZE === 'ANALYZE');
testTruthy('DO mode exists', AIOrchestrator.CHAT_MODES.DO === 'DO');
testTruthy('TEACH mode exists', AIOrchestrator.CHAT_MODES.TEACH === 'TEACH');

// Summary
console.log('\n===========================================');
console.log(`RESULTS: ${passed} passed, ${failed} failed`);
console.log('===========================================\n');

if (failed === 0) {
    console.log('🎉 All AI Core Layer verifications PASSED!');
    console.log('🧠 Enterprise PMO Brain is READY!');
    process.exit(0);
} else {
    console.log('⚠️ Some tests failed. Review above.');
    process.exit(1);
}
