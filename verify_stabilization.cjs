// Verification Script for Step 6: Stabilization, Reporting & Economics
// Run with: node verify_stabilization.cjs

console.log('===========================================');
console.log('STEP 6 VERIFICATION: Stabilization, Reporting & Economics');
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
    const StabilizationService = require('./server/services/stabilizationService');
    testTruthy('StabilizationService loads', !!StabilizationService.checkEntryCriteria);
    testTruthy('StabilizationService.closeProject exists', !!StabilizationService.closeProject);
    test('STABILIZATION_STATUSES count', Object.keys(StabilizationService.STABILIZATION_STATUSES).length, 4);
} catch (e) {
    console.log(`❌ StabilizationService failed to load: ${e.message}`);
    failed += 3;
}

try {
    const EconomicsService = require('./server/services/economicsService');
    testTruthy('EconomicsService loads', !!EconomicsService.createValueHypothesis);
    testTruthy('EconomicsService.getValueSummary exists', !!EconomicsService.getValueSummary);
    test('VALUE_TYPES count', Object.keys(EconomicsService.VALUE_TYPES).length, 5);
} catch (e) {
    console.log(`❌ EconomicsService failed to load: ${e.message}`);
    failed += 3;
}

try {
    const ReportingService = require('./server/services/reportingService');
    testTruthy('ReportingService loads', !!ReportingService.generateExecutiveOverview);
    testTruthy('ReportingService.generateProjectHealthReport exists', !!ReportingService.generateProjectHealthReport);
} catch (e) {
    console.log(`❌ ReportingService failed to load: ${e.message}`);
    failed += 2;
}

try {
    const NarrativeService = require('./server/services/narrativeService');
    testTruthy('NarrativeService loads', !!NarrativeService.generateWeeklySummary);
    testTruthy('NarrativeService.generateExecutiveMemo exists', !!NarrativeService.generateExecutiveMemo);
    testTruthy('NarrativeService.generateProgressNarrative exists', !!NarrativeService.generateProgressNarrative);
} catch (e) {
    console.log(`❌ NarrativeService failed to load: ${e.message}`);
    failed += 3;
}

// 2. Test Value Hypothesis Types
console.log('\n--- Testing Value Hypothesis Types ---\n');

const EconomicsService = require('./server/services/economicsService');
testTruthy('COST_REDUCTION type exists', EconomicsService.VALUE_TYPES.COST_REDUCTION === 'COST_REDUCTION');
testTruthy('REVENUE_INCREASE type exists', EconomicsService.VALUE_TYPES.REVENUE_INCREASE === 'REVENUE_INCREASE');
testTruthy('STRATEGIC_OPTION type exists', EconomicsService.VALUE_TYPES.STRATEGIC_OPTION === 'STRATEGIC_OPTION');

// 3. Test Stabilization Statuses
console.log('\n--- Testing Stabilization Statuses ---\n');

const StabilizationService = require('./server/services/stabilizationService');
testTruthy('STABILIZED status', StabilizationService.STABILIZATION_STATUSES.STABILIZED === 'STABILIZED');
testTruthy('PARTIALLY_STABILIZED status', StabilizationService.STABILIZATION_STATUSES.PARTIALLY_STABILIZED === 'PARTIALLY_STABILIZED');
testTruthy('UNSTABLE status', StabilizationService.STABILIZATION_STATUSES.UNSTABLE === 'UNSTABLE');

// Summary
console.log('\n===========================================');
console.log(`RESULTS: ${passed} passed, ${failed} failed`);
console.log('===========================================\n');

if (failed === 0) {
    console.log('🎉 All Step 6 verifications PASSED!');
    console.log('🏁 SCMS IMPLEMENTATION COMPLETE!');
    process.exit(0);
} else {
    console.log('⚠️ Some tests failed. Review above.');
    process.exit(1);
}
