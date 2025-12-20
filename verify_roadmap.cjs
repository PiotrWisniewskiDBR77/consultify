// Verification Script for Step 4: Roadmap, Sequencing & Capacity
// Run with: node verify_roadmap.cjs

console.log('===========================================');
console.log('STEP 4 VERIFICATION: Roadmap, Sequencing & Capacity');
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
    const BaselineService = require('./server/services/baselineService');
    testTruthy('BaselineService loads', !!BaselineService.captureBaseline);
    testTruthy('BaselineService.calculateVariance exists', !!BaselineService.calculateVariance);
} catch (e) {
    console.log(`❌ BaselineService failed to load: ${e.message}`);
    failed += 2;
}

try {
    const CapacityService = require('./server/services/capacityService');
    testTruthy('CapacityService loads', !!CapacityService.calculateUserCapacity);
    testTruthy('CapacityService.detectOverloads exists', !!CapacityService.detectOverloads);
} catch (e) {
    console.log(`❌ CapacityService failed to load: ${e.message}`);
    failed += 2;
}

try {
    const ScenarioService = require('./server/services/scenarioService');
    testTruthy('ScenarioService loads', !!ScenarioService.createScenario);
    testTruthy('ScenarioService.analyzeImpact exists', !!ScenarioService.analyzeImpact);
} catch (e) {
    console.log(`❌ ScenarioService failed to load: ${e.message}`);
    failed += 2;
}

try {
    const CriticalPathService = require('./server/services/criticalPathService');
    testTruthy('CriticalPathService loads', !!CriticalPathService.calculateCriticalPath);
    testTruthy('CriticalPathService.analyzeScheduleRisks exists', !!CriticalPathService.analyzeScheduleRisks);
    testTruthy('CriticalPathService.detectSchedulingConflicts exists', !!CriticalPathService.detectSchedulingConflicts);
} catch (e) {
    console.log(`❌ CriticalPathService failed to load: ${e.message}`);
    failed += 3;
}

// 2. Test Capacity Calculation Logic
console.log('\n--- Testing Capacity Logic ---\n');

const CapacityService = require('./server/services/capacityService');

const mockOverloads = {
    overloadedUsers: [
        { userId: '1', userName: 'John Doe', sustainedOverload: true, overloadedWeeks: [{ weekStart: '2024-01-01', allocatedHours: 50 }] },
        { userId: '2', userName: 'Jane Doe', sustainedOverload: false, overloadedWeeks: [{ weekStart: '2024-01-01', allocatedHours: 45 }] }
    ]
};

const suggestions = CapacityService.suggestResolutions(mockOverloads);
test('suggestResolutions returns suggestions', suggestions.length, 2);
test('Sustained overload gets REASSIGN suggestion', suggestions[0].type, 'REASSIGN');
test('Single overload gets RESEQUENCE suggestion', suggestions[1].type, 'RESEQUENCE');

// 3. Test Scenario Comparison Logic
console.log('\n--- Testing Scenario Logic ---\n');

const ScenarioService = require('./server/services/scenarioService');

const scenario1 = { name: 'Option A', impactAnalysis: { delayedByDays: 10 } };
const scenario2 = { name: 'Option B', impactAnalysis: { delayedByDays: 20 } };
const comparison = ScenarioService.compareScenarios(scenario1, scenario2);
testTruthy('Scenario comparison works', comparison.recommendation.includes('Option A'));

// Summary
console.log('\n===========================================');
console.log(`RESULTS: ${passed} passed, ${failed} failed`);
console.log('===========================================\n');

if (failed === 0) {
    console.log('🎉 All Step 4 verifications PASSED!');
    process.exit(0);
} else {
    console.log('⚠️ Some tests failed. Review above.');
    process.exit(1);
}
