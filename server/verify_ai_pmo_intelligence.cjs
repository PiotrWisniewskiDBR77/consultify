/**
 * AI PMO Intelligence Layers Verification Script
 * 
 * Tests all 6 AI PMO layers (AI-6 to AI-11):
 * - AI-6: Decision Governance
 * - AI-7: Risk & Change Control
 * - AI-8: Workload Intelligence
 * - AI-9: Maturity Monitor
 * - AI-10: Executive Reporting
 * - AI-11: Failure Handling
 */

const db = require('./database');

// Wait for DB initialization
db.initPromise.then(async () => {
    console.log('\n🧠 AI PMO Intelligence Layers Verification\n');
    console.log('='.repeat(60) + '\n');

    let passed = 0;
    let failed = 0;

    const test = (name, condition) => {
        if (condition) {
            console.log(`  ✅ ${name}`);
            passed++;
        } else {
            console.log(`  ❌ ${name}`);
            failed++;
        }
    };

    // ==========================================
    // AI-6: Decision Governance
    // ==========================================
    console.log('⚖️ AI-6: Decision Governance\n');

    try {
        const AIDecisionGovernance = require('./services/aiDecisionGovernance');

        test('Exports DECISION_TYPES', !!AIDecisionGovernance.DECISION_TYPES);
        test('DECISION_TYPES.STRATEGIC exists', AIDecisionGovernance.DECISION_TYPES.STRATEGIC === 'strategic');
        test('DECISION_TYPES.EXECUTION exists', AIDecisionGovernance.DECISION_TYPES.EXECUTION === 'execution');

        test('Exports DECISION_STATUS', !!AIDecisionGovernance.DECISION_STATUS);
        test('DECISION_STATUS.APPROVED exists', AIDecisionGovernance.DECISION_STATUS.APPROVED === 'approved');

        test('Exports detectDecisionNeeded', typeof AIDecisionGovernance.detectDecisionNeeded === 'function');
        test('Exports prepareDecisionBrief', typeof AIDecisionGovernance.prepareDecisionBrief === 'function');
        test('Exports getDecisionDebt', typeof AIDecisionGovernance.getDecisionDebt === 'function');
        test('Exports suggestDecision', typeof AIDecisionGovernance.suggestDecision === 'function');
        test('Exports registerImpact', typeof AIDecisionGovernance.registerImpact === 'function');

        // Test decision detection
        const detection = await AIDecisionGovernance.detectDecisionNeeded({
            projectId: 'test',
            trigger: 'phase_transition'
        });
        test('detectDecisionNeeded works', detection.decisionsNeeded.length > 0);

    } catch (e) {
        console.log(`  ❌ Failed to load AIDecisionGovernance: ${e.message}`);
        failed++;
    }

    console.log('');

    // ==========================================
    // AI-7: Risk & Change Control
    // ==========================================
    console.log('⚠️ AI-7: Risk & Change Control\n');

    try {
        const AIRiskChangeControl = require('./services/aiRiskChangeControl');

        test('Exports RISK_TYPES', !!AIRiskChangeControl.RISK_TYPES);
        test('RISK_TYPES.DELIVERY exists', AIRiskChangeControl.RISK_TYPES.DELIVERY === 'delivery');
        test('RISK_TYPES.CAPACITY exists', AIRiskChangeControl.RISK_TYPES.CAPACITY === 'capacity');
        test('RISK_TYPES.CHANGE_FATIGUE exists', AIRiskChangeControl.RISK_TYPES.CHANGE_FATIGUE === 'change_fatigue');

        test('Exports RISK_SEVERITY', !!AIRiskChangeControl.RISK_SEVERITY);
        test('RISK_SEVERITY.CRITICAL exists', AIRiskChangeControl.RISK_SEVERITY.CRITICAL === 'critical');

        test('Exports CHANGE_TYPES', !!AIRiskChangeControl.CHANGE_TYPES);
        test('CHANGE_TYPES.EXPAND exists', AIRiskChangeControl.CHANGE_TYPES.EXPAND === 'expand');

        test('Exports detectRisks', typeof AIRiskChangeControl.detectRisks === 'function');
        test('Exports explainRisk', typeof AIRiskChangeControl.explainRisk === 'function');
        test('Exports trackScopeChange', typeof AIRiskChangeControl.trackScopeChange === 'function');
        test('Exports detectUncontrolledChanges', typeof AIRiskChangeControl.detectUncontrolledChanges === 'function');
        test('Exports preEscalationWarning', typeof AIRiskChangeControl.preEscalationWarning === 'function');
        test('Exports getOpenRisks', typeof AIRiskChangeControl.getOpenRisks === 'function');

    } catch (e) {
        console.log(`  ❌ Failed to load AIRiskChangeControl: ${e.message}`);
        failed++;
    }

    console.log('');

    // ==========================================
    // AI-8: Workload Intelligence
    // ==========================================
    console.log('📊 AI-8: Workload Intelligence\n');

    try {
        const AIWorkloadIntelligence = require('./services/aiWorkloadIntelligence');

        test('Exports WORKLOAD_STATUS', !!AIWorkloadIntelligence.WORKLOAD_STATUS);
        test('WORKLOAD_STATUS.OPTIMAL exists', AIWorkloadIntelligence.WORKLOAD_STATUS.OPTIMAL === 'optimal');
        test('WORKLOAD_STATUS.OVERLOADED exists', AIWorkloadIntelligence.WORKLOAD_STATUS.OVERLOADED === 'overloaded');

        test('Exports BURNOUT_RISK', !!AIWorkloadIntelligence.BURNOUT_RISK);
        test('BURNOUT_RISK.CRITICAL exists', AIWorkloadIntelligence.BURNOUT_RISK.CRITICAL === 'critical');

        test('Exports getPortfolioWorkload', typeof AIWorkloadIntelligence.getPortfolioWorkload === 'function');
        test('Exports detectOverAllocation', typeof AIWorkloadIntelligence.detectOverAllocation === 'function');
        test('Exports suggestRebalancing', typeof AIWorkloadIntelligence.suggestRebalancing === 'function');
        test('Exports detectUnrealisticTimelines', typeof AIWorkloadIntelligence.detectUnrealisticTimelines === 'function');
        test('Exports takeSnapshot', typeof AIWorkloadIntelligence.takeSnapshot === 'function');
        test('Exports getWorkloadTrend', typeof AIWorkloadIntelligence.getWorkloadTrend === 'function');

    } catch (e) {
        console.log(`  ❌ Failed to load AIWorkloadIntelligence: ${e.message}`);
        failed++;
    }

    console.log('');

    // ==========================================
    // AI-9: Maturity Monitor
    // ==========================================
    console.log('📈 AI-9: Maturity Monitor\n');

    try {
        const AIMaturityMonitor = require('./services/aiMaturityMonitor');

        test('Exports MATURITY_DIMENSIONS', !!AIMaturityMonitor.MATURITY_DIMENSIONS);
        test('MATURITY_DIMENSIONS.PLANNING exists', AIMaturityMonitor.MATURITY_DIMENSIONS.PLANNING === 'planning_discipline');
        test('MATURITY_DIMENSIONS.EXECUTION exists', AIMaturityMonitor.MATURITY_DIMENSIONS.EXECUTION === 'execution_predictability');

        test('Exports MATURITY_LEVELS', !!AIMaturityMonitor.MATURITY_LEVELS);
        test('MATURITY_LEVELS.OPTIMIZING level is 5', AIMaturityMonitor.MATURITY_LEVELS.OPTIMIZING.level === 5);

        test('Exports DISCIPLINE_EVENTS', !!AIMaturityMonitor.DISCIPLINE_EVENTS);
        test('DISCIPLINE_EVENTS.MISSED_DEADLINE exists', AIMaturityMonitor.DISCIPLINE_EVENTS.MISSED_DEADLINE === 'missed_deadline');

        test('Exports assessMaturity', typeof AIMaturityMonitor.assessMaturity === 'function');
        test('Exports getMaturityTrend', typeof AIMaturityMonitor.getMaturityTrend === 'function');
        test('Exports logDisciplineEvent', typeof AIMaturityMonitor.logDisciplineEvent === 'function');
        test('Exports getDisciplinePatterns', typeof AIMaturityMonitor.getDisciplinePatterns === 'function');
        test('Exports benchmarkAgainstPractices', typeof AIMaturityMonitor.benchmarkAgainstPractices === 'function');

    } catch (e) {
        console.log(`  ❌ Failed to load AIMaturityMonitor: ${e.message}`);
        failed++;
    }

    console.log('');

    // ==========================================
    // AI-10: Executive Reporting
    // ==========================================
    console.log('📝 AI-10: Executive Reporting\n');

    try {
        const AIExecutiveReporting = require('./services/aiExecutiveReporting');

        test('Exports REPORT_TYPES', !!AIExecutiveReporting.REPORT_TYPES);
        test('REPORT_TYPES.PROJECT_STATUS exists', AIExecutiveReporting.REPORT_TYPES.PROJECT_STATUS === 'project_status');
        test('REPORT_TYPES.EXECUTIVE_BRIEF exists', AIExecutiveReporting.REPORT_TYPES.EXECUTIVE_BRIEF === 'executive_brief');

        test('Exports STATUS_INDICATORS', !!AIExecutiveReporting.STATUS_INDICATORS);
        test('STATUS_INDICATORS.GREEN exists', AIExecutiveReporting.STATUS_INDICATORS.GREEN.color === 'green');
        test('STATUS_INDICATORS.RED exists', AIExecutiveReporting.STATUS_INDICATORS.RED.color === 'red');

        test('Exports generateReport', typeof AIExecutiveReporting.generateReport === 'function');
        test('Exports translateToNarrative', typeof AIExecutiveReporting.translateToNarrative === 'function');
        test('Exports extractDeviations', typeof AIExecutiveReporting.extractDeviations === 'function');
        test('Exports formatForExecutive', typeof AIExecutiveReporting.formatForExecutive === 'function');

        // Test narrative generation
        const narrative = AIExecutiveReporting.translateToNarrative({
            project: { name: 'Test Project' },
            overallStatus: { label: 'On Track' }
        });
        test('translateToNarrative generates text', narrative.length > 0);

    } catch (e) {
        console.log(`  ❌ Failed to load AIExecutiveReporting: ${e.message}`);
        failed++;
    }

    console.log('');

    // ==========================================
    // AI-11: Failure Handling
    // ==========================================
    console.log('🛡️ AI-11: Failure Handling\n');

    try {
        const AIFailureHandler = require('./services/aiFailureHandler');

        test('Exports FAILURE_SCENARIOS', !!AIFailureHandler.FAILURE_SCENARIOS);
        test('FAILURE_SCENARIOS.MODEL_UNAVAILABLE exists', AIFailureHandler.FAILURE_SCENARIOS.MODEL_UNAVAILABLE === 'model_unavailable');
        test('FAILURE_SCENARIOS.BUDGET_EXCEEDED exists', AIFailureHandler.FAILURE_SCENARIOS.BUDGET_EXCEEDED === 'budget_exceeded');
        test('FAILURE_SCENARIOS.TIMEOUT exists', AIFailureHandler.FAILURE_SCENARIOS.TIMEOUT === 'timeout');

        test('Exports HEALTH_STATUS', !!AIFailureHandler.HEALTH_STATUS);
        test('HEALTH_STATUS.HEALTHY exists', AIFailureHandler.HEALTH_STATUS.HEALTHY === 'healthy');
        test('HEALTH_STATUS.DEGRADED exists', AIFailureHandler.HEALTH_STATUS.DEGRADED === 'degraded');

        test('Exports FALLBACK_STRATEGIES', !!AIFailureHandler.FALLBACK_STRATEGIES);

        test('Exports withFallback', typeof AIFailureHandler.withFallback === 'function');
        test('Exports checkAvailability', typeof AIFailureHandler.checkAvailability === 'function');
        test('Exports degrade', typeof AIFailureHandler.degrade === 'function');
        test('Exports explainFailure', typeof AIFailureHandler.explainFailure === 'function');
        test('Exports logFailure', typeof AIFailureHandler.logFailure === 'function');
        test('Exports nonBlocking', typeof AIFailureHandler.nonBlocking === 'function');

        // Test degradation response
        const degradation = AIFailureHandler.degrade('model_unavailable');
        test('degrade provides non-blocking message', degradation.message.includes('continue'));
        test('degrade lists capabilities', degradation.capabilities.length > 0);

        // Test failure explanation
        const explanation = AIFailureHandler.explainFailure('budget_exceeded');
        test('explainFailure provides user-friendly title', !!explanation.title);
        test('explainFailure provides user action', !!explanation.userAction);

        // Test availability check
        const availability = await AIFailureHandler.checkAvailability();
        test('checkAvailability returns status', !!availability.status);

    } catch (e) {
        console.log(`  ❌ Failed to load AIFailureHandler: ${e.message}`);
        failed++;
    }

    console.log('');

    // ==========================================
    // Database Tables Verification
    // ==========================================
    console.log('🗄️ Database Tables (AI-6 to AI-11)\n');

    const tables = [
        'decision_briefs',
        'decision_impacts',
        'risk_register',
        'scope_change_log',
        'user_capacity_profile',
        'workload_snapshots',
        'maturity_assessments',
        'discipline_events',
        'ai_failure_log',
        'ai_health_status'
    ];

    for (const table of tables) {
        const exists = await new Promise((resolve) => {
            db.get(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`, [table], (err, row) => {
                resolve(!!row);
            });
        });
        test(`Table ${table} exists`, exists);
    }

    console.log('');

    // ==========================================
    // Summary
    // ==========================================
    console.log('='.repeat(60));
    console.log(`\n📋 Summary: ${passed} passed, ${failed} failed\n`);

    if (failed === 0) {
        console.log('✅ All AI PMO Intelligence Layers verified successfully!\n');
    } else {
        console.log('⚠️ Some tests failed. Please review the output above.\n');
    }

    process.exit(failed > 0 ? 1 : 0);

}).catch(err => {
    console.error('Database initialization failed:', err);
    process.exit(1);
});
