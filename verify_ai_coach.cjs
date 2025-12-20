const AICoach = require('./server/ai/aiCoach');
const path = require('path');

async function testAICoach() {
    console.log('═══════════════════════════════════════════════════');
    console.log('  AI COACH VERIFICATION - LEGOLEX v2');
    console.log('═══════════════════════════════════════════════════');

    const orgId = 'org-legolex-test';

    try {
        const report = await AICoach.getAdvisoryReport(orgId);

        console.log(`\nOrganization: ${report.orgName}`);
        console.log(`Health Score: ${report.summary.health_score}/100`);
        console.log(`Active Initiatives: ${report.summary.active_initiatives}`);
        console.log(`Total Tasks: ${report.summary.task_count}`);

        console.log('\n--- Detected Signals ---');
        report.signals.forEach(s => {
            console.log(`[${s.type}] (${s.severity}) ${s.title}`);
            console.log(`  > ${s.description}`);
            console.log(`  > Explanation: ${s.explanation}`);
        });

        console.log('\n--- Recommendations ---');
        report.recommendations.forEach(r => {
            console.log(`[${r.category}] Priority ${r.priority}: ${r.title}`);
            console.log(`  > Action: ${r.action}`);
        });

        console.log('\n--- Impact Simulations ---');
        report.simulations.forEach(sim => {
            console.log(`\nSimulation for: ${sim.recommendation_title}`);
            console.log(`  > Narrative: ${sim.narrative}`);
            console.log(`  > Impact: ${sim.metric_impacts.map(m => `${m.metric} ${m.direction} (${m.outlook})`).join(', ')}`);
        });

        // Specific assertions for the Legolex v2 demo
        console.log('\n--- Legolex v2 Scenario Validation ---');

        const juliaStats = report.signals.find(s => s.entity_id === 'user-legolex-julia') || { type: 'NONE' };
        // Actually let's just log the full raw data for Julia from context_snapshot
        const userLoad = report.context_snapshot.task_distribution.user_load['user-legolex-julia'] || { total: 0, completed: 0 };
        console.log(`Julia Task Count: ${userLoad.total}`);
        console.log(`Julia Completed: ${userLoad.completed}`);

        const helpRatio = report.context_snapshot.help_completion_ratios['user-legolex-julia'] || { ratio: 0 };
        console.log(`Julia Help Completion Ratio: ${helpRatio.ratio}`);

        const juliaAtRisk = report.signals.find(s => s.type === 'USER_AT_RISK' && s.title.includes('Julia'));
        console.log(juliaAtRisk ? '✅ Julia Wiśniewska detected as USER_AT_RISK' : '❌ Julia Wiśniewska NOT detected as USER_AT_RISK');

        const partnerBlocked = report.signals.find(s => s.type === 'BLOCKED_INITIATIVE' && s.title.includes('Partner'));
        console.log(partnerBlocked ? '✅ Partner Integration detected as BLOCKED_INITIATIVE' : '❌ Partner Integration NOT detected as BLOCKED_INITIATIVE');

        const lowHelp = report.signals.find(s => s.type === 'LOW_HELP_ADOPTION');
        console.log(lowHelp ? '✅ LOW_HELP_ADOPTION detected' : '⚠️ LOW_HELP_ADOPTION not detected (check help event completion counts)');

        const strongMember = report.signals.find(s => s.type === 'STRONG_TEAM_MEMBER');
        console.log(strongMember ? `✅ STRONG_TEAM_MEMBER detected: ${strongMember.title}` : '⚠️ STRONG_TEAM_MEMBER not detected');

        process.exit(0);
    } catch (err) {
        console.error('❌ Verification failed:', err);
        process.exit(1);
    }
}

testAICoach();
