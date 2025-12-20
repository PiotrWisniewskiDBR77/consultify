// Verification Script for Step 3: PMO Objects, Statuses & Stage Gates
// Run with: node verify_pmo.cjs

console.log('===========================================');
console.log('STEP 3 VERIFICATION: PMO Objects, Statuses & Stage Gates');
console.log('===========================================\n');

const StatusMachine = require('./server/services/statusMachine');
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

// 1. Status Machine Tests
console.log('\n--- Testing Status Machine ---\n');

// Initiative Transitions
test('Initiative: DRAFT → PLANNED', StatusMachine.canTransitionInitiative('DRAFT', 'PLANNED'), true);
test('Initiative: DRAFT → IN_EXECUTION (invalid)', StatusMachine.canTransitionInitiative('DRAFT', 'IN_EXECUTION'), false);
test('Initiative: APPROVED → IN_EXECUTION', StatusMachine.canTransitionInitiative('APPROVED', 'IN_EXECUTION'), true);
test('Initiative: COMPLETED → DRAFT (terminal)', StatusMachine.canTransitionInitiative('COMPLETED', 'DRAFT'), false);

// Task Transitions
test('Task: TODO → IN_PROGRESS', StatusMachine.canTransitionTask('TODO', 'IN_PROGRESS'), true);
test('Task: TODO → DONE (invalid)', StatusMachine.canTransitionTask('TODO', 'DONE'), false);
test('Task: IN_PROGRESS → DONE', StatusMachine.canTransitionTask('IN_PROGRESS', 'DONE'), true);

// Validation with context
const blockedValidation = StatusMachine.validateInitiativeTransition('APPROVED', 'BLOCKED', {});
test('Initiative: BLOCKED requires reason', blockedValidation.valid, false);

const blockedWithReason = StatusMachine.validateInitiativeTransition('APPROVED', 'BLOCKED', { blockedReason: 'Waiting for decision' });
test('Initiative: BLOCKED with reason OK', blockedWithReason.valid, true);

const taskBlockedValidation = StatusMachine.validateTaskTransition('IN_PROGRESS', 'BLOCKED', {});
test('Task: BLOCKED requires reason', taskBlockedValidation.valid, false);

const taskBlockedWithContext = StatusMachine.validateTaskTransition('IN_PROGRESS', 'BLOCKED', { blockedReason: 'Dependency', blockerType: 'DEPENDENCY' });
test('Task: BLOCKED with context OK', taskBlockedWithContext.valid, true);

// 2. Test Allowed Transitions
console.log('\n--- Testing Allowed Transitions ---\n');

const draftTransitions = StatusMachine.getAllowedInitiativeTransitions('DRAFT');
test('DRAFT allowed transitions count', draftTransitions.length, 2);
console.log(`   DRAFT can transition to: ${draftTransitions.join(', ')}`);

const todoTransitions = StatusMachine.getAllowedTaskTransitions('TODO');
test('TODO allowed transitions count', todoTransitions.length, 2);
console.log(`   TODO can transition to: ${todoTransitions.join(', ')}`);

// 3. Test Services Load
console.log('\n--- Testing Service Modules Load ---\n');

try {
    const StageGateService = require('./server/services/stageGateService');
    test('StageGateService loads', !!StageGateService.evaluateGate, true);
} catch (e) {
    console.log(`❌ StageGateService failed to load: ${e.message}`);
    failed++;
}

try {
    const ProgressService = require('./server/services/progressService');
    test('ProgressService loads', !!ProgressService.calculateInitiativeProgress, true);
} catch (e) {
    console.log(`❌ ProgressService failed to load: ${e.message}`);
    failed++;
}

try {
    const DependencyService = require('./server/services/dependencyService');
    test('DependencyService loads', !!DependencyService.detectDeadlocks, true);
} catch (e) {
    console.log(`❌ DependencyService failed to load: ${e.message}`);
    failed++;
}

try {
    const PMOAnalysisService = require('./server/services/pmoAnalysisService');
    test('PMOAnalysisService loads', !!PMOAnalysisService.analyzeProject, true);
} catch (e) {
    console.log(`❌ PMOAnalysisService failed to load: ${e.message}`);
    failed++;
}

// 4. Test Gate Types
console.log('\n--- Testing Stage Gate Types ---\n');

const StageGateService = require('./server/services/stageGateService');
test('READINESS_GATE defined', StageGateService.GATE_TYPES.READINESS_GATE, 'READINESS_GATE');
test('CLOSURE_GATE defined', StageGateService.GATE_TYPES.CLOSURE_GATE, 'CLOSURE_GATE');
test('Phase order length', StageGateService.PHASE_ORDER.length, 6);
console.log(`   Phase order: ${StageGateService.PHASE_ORDER.join(' → ')}`);

// Summary
console.log('\n===========================================');
console.log(`RESULTS: ${passed} passed, ${failed} failed`);
console.log('===========================================\n');

if (failed === 0) {
    console.log('🎉 All Step 3 verifications PASSED!');
    process.exit(0);
} else {
    console.log('⚠️ Some tests failed. Review above.');
    process.exit(1);
}
