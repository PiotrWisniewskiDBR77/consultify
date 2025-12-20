// Verification Script for Step 5: Execution Control, My Work & Notifications
// Run with: node verify_execution.cjs

console.log('===========================================');
console.log('STEP 5 VERIFICATION: Execution Control, My Work & Notifications');
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
console.log('\n--- Testing Service Modules Load ---\n');

try {
    const NotificationService = require('./server/services/notificationService');
    testTruthy('NotificationService loads', !!NotificationService.create);
    testTruthy('NotificationService.getCounts exists', !!NotificationService.getCounts);
    test('NOTIFICATION_TYPES count', Object.keys(NotificationService.NOTIFICATION_TYPES).length, 15);
} catch (e) {
    console.log(`❌ NotificationService failed to load: ${e.message}`);
    failed += 3;
}

try {
    const MyWorkService = require('./server/services/myWorkService');
    testTruthy('MyWorkService loads', !!MyWorkService.getMyWork);
} catch (e) {
    console.log(`❌ MyWorkService failed to load: ${e.message}`);
    failed++;
}

try {
    const ExecutionMonitorService = require('./server/services/executionMonitorService');
    testTruthy('ExecutionMonitorService loads', !!ExecutionMonitorService.runDailyMonitor);
    testTruthy('ExecutionMonitorService.generateExecutionSummary exists', !!ExecutionMonitorService.generateExecutionSummary);
} catch (e) {
    console.log(`❌ ExecutionMonitorService failed to load: ${e.message}`);
    failed += 2;
}

try {
    const EscalationService = require('./server/services/escalationService');
    testTruthy('EscalationService loads', !!EscalationService.createEscalation);
    testTruthy('EscalationService.runAutoEscalation exists', !!EscalationService.runAutoEscalation);
} catch (e) {
    console.log(`❌ EscalationService failed to load: ${e.message}`);
    failed += 2;
}

// 2. Test Notification Types
console.log('\n--- Testing Notification Types ---\n');

const NotificationService = require('./server/services/notificationService');

testTruthy('TASK_ASSIGNED type exists', NotificationService.NOTIFICATION_TYPES.TASK_ASSIGNED === 'TASK_ASSIGNED');
testTruthy('DECISION_REQUIRED type exists', NotificationService.NOTIFICATION_TYPES.DECISION_REQUIRED === 'DECISION_REQUIRED');
testTruthy('AI_RISK_DETECTED type exists', NotificationService.NOTIFICATION_TYPES.AI_RISK_DETECTED === 'AI_RISK_DETECTED');

// 3. Test Severity Levels
console.log('\n--- Testing Severity Levels ---\n');

test('INFO severity', NotificationService.SEVERITY.INFO, 'INFO');
test('WARNING severity', NotificationService.SEVERITY.WARNING, 'WARNING');
test('CRITICAL severity', NotificationService.SEVERITY.CRITICAL, 'CRITICAL');

// Summary
console.log('\n===========================================');
console.log(`RESULTS: ${passed} passed, ${failed} failed`);
console.log('===========================================\n');

if (failed === 0) {
    console.log('🎉 All Step 5 verifications PASSED!');
    process.exit(0);
} else {
    console.log('⚠️ Some tests failed. Review above.');
    process.exit(1);
}
