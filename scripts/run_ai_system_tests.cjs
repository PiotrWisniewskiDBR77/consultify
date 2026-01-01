#!/usr/bin/env node
/**
 * Enterprise AI System Test Suite - Master Runner
 * 
 * Harvard/McKinsey/IBM Enterprise-Level Testing Framework
 * 
 * Orchestrates all AI system tests with:
 * - Sequential test suite execution
 * - Automatic repair triggers on failures
 * - HTML and JSON report generation
 * - CI/CD integration exit codes
 * 
 * Usage:
 *   node scripts/run_ai_system_tests.cjs [options]
 * 
 * Options:
 *   --full       Run all test suites (default)
 *   --quick      Run only critical tests
 *   --repair     Auto-repair failures
 *   --report     Generate HTML report
 *   --suite=X    Run specific suite only
 * 
 * @version 1.0.0
 * @author DBR77 AI System
 */

const path = require('path');
const fs = require('fs');

// ============================================================================
// Configuration
// ============================================================================

const CONFIG = {
    testsDir: path.join(__dirname, 'tests'),
    repairDir: path.join(__dirname, 'repair'),
    reportsDir: path.join(__dirname, '../reports'),
    colors: {
        reset: '\x1b[0m',
        red: '\x1b[31m',
        green: '\x1b[32m',
        yellow: '\x1b[33m',
        blue: '\x1b[34m',
        magenta: '\x1b[35m',
        cyan: '\x1b[36m',
        white: '\x1b[37m',
        bold: '\x1b[1m'
    }
};

// Test suites configuration
const TEST_SUITES = [
    {
        id: 'llm-connectivity',
        name: 'LLM Connectivity',
        file: 'test_llm_connectivity.cjs',
        critical: true,
        repairModule: 'repair_llm.cjs',
        timeout: 60000
    },
    {
        id: 'ai-pipeline',
        name: 'AI Pipeline',
        file: 'test_ai_pipeline.cjs',
        critical: true,
        repairModule: 'repair_database.cjs',
        timeout: 45000
    },
    {
        id: 'memory-system',
        name: 'Memory System',
        file: 'test_memory_system.cjs',
        critical: true,
        repairModule: 'repair_memory.cjs',
        timeout: 30000
    },
    {
        id: 'knowledge-base',
        name: 'Knowledge Base (RAG)',
        file: 'test_knowledge_base.cjs',
        critical: false,
        repairModule: 'repair_database.cjs',
        timeout: 45000
    },
    {
        id: 'quality-checker',
        name: 'Quality Assurance',
        file: 'test_quality_checker.cjs',
        critical: false,
        repairModule: null,
        timeout: 30000
    },
    {
        id: 'enterprise-security',
        name: 'Enterprise Security',
        file: 'test_enterprise_security.cjs',
        critical: true,
        repairModule: 'repair_security.cjs',
        timeout: 30000
    },
    {
        id: 'learning-system',
        name: 'Learning System',
        file: 'test_learning_system.cjs',
        critical: false,
        repairModule: 'repair_database.cjs',
        timeout: 30000
    },
    {
        id: 'health-monitor',
        name: 'Health Monitor',
        file: 'test_health_monitor.cjs',
        critical: true,
        repairModule: null,
        timeout: 30000
    },
    {
        id: 'cothinker',
        name: 'Co-Thinker System',
        file: 'test_cothinker.cjs',
        critical: false,
        repairModule: null,
        timeout: 45000
    },
    {
        id: 'integration-e2e',
        name: 'Integration (E2E)',
        file: 'test_integration_e2e.cjs',
        critical: false,
        repairModule: null,
        timeout: 120000
    }
];

// ============================================================================
// Utilities
// ============================================================================

const c = CONFIG.colors;

function log(message, color = 'white') {
    console.log(`${c[color]}${message}${c.reset}`);
}

function logSection(title) {
    console.log('\n' + '═'.repeat(70));
    log(`  ${title}`, 'cyan');
    console.log('═'.repeat(70) + '\n');
}

function logResult(name, passed, failed, duration) {
    const status = failed === 0 ? `${c.green}✓ PASS${c.reset}` : `${c.red}✗ FAIL${c.reset}`;
    const durationStr = `${(duration / 1000).toFixed(2)}s`;
    console.log(`  ${status} ${name.padEnd(25)} ${c.yellow}${passed}/${passed + failed}${c.reset} (${durationStr})`);
}

function parseArgs() {
    const args = process.argv.slice(2);
    return {
        full: args.includes('--full') || !args.some(a => a.startsWith('--suite')),
        quick: args.includes('--quick'),
        repair: args.includes('--repair'),
        report: args.includes('--report'),
        suite: args.find(a => a.startsWith('--suite='))?.split('=')[1],
        verbose: args.includes('--verbose') || args.includes('-v')
    };
}

// ============================================================================
// Test Runner
// ============================================================================

async function runTestSuite(suite) {
    const testPath = path.join(CONFIG.testsDir, suite.file);
    
    if (!fs.existsSync(testPath)) {
        return {
            suite: suite.name,
            status: 'skipped',
            reason: 'Test file not found',
            passed: 0,
            failed: 0,
            duration: 0,
            tests: []
        };
    }

    const startTime = Date.now();
    
    try {
        // Clear require cache to ensure fresh run
        delete require.cache[require.resolve(testPath)];
        
        const testModule = require(testPath);
        
        if (typeof testModule.runTests !== 'function') {
            throw new Error('Test module must export runTests() function');
        }

        const results = await Promise.race([
            testModule.runTests(),
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Timeout')), suite.timeout)
            )
        ]);

        const duration = Date.now() - startTime;

        return {
            suite: suite.name,
            suiteId: suite.id,
            status: results.failed === 0 ? 'passed' : 'failed',
            passed: results.passed || 0,
            failed: results.failed || 0,
            duration,
            tests: results.tests || [],
            critical: suite.critical
        };

    } catch (error) {
        const duration = Date.now() - startTime;
        return {
            suite: suite.name,
            suiteId: suite.id,
            status: 'error',
            error: error.message,
            passed: 0,
            failed: 1,
            duration,
            tests: [{ name: 'Suite execution', status: 'error', error: error.message }],
            critical: suite.critical
        };
    }
}

async function runRepairModule(repairFile) {
    const repairPath = path.join(CONFIG.repairDir, repairFile);
    
    if (!fs.existsSync(repairPath)) {
        log(`  ⚠️  Repair module not found: ${repairFile}`, 'yellow');
        return false;
    }

    try {
        delete require.cache[require.resolve(repairPath)];
        const repairModule = require(repairPath);
        
        if (typeof repairModule.repair !== 'function') {
            log(`  ⚠️  Repair module must export repair() function`, 'yellow');
            return false;
        }

        const result = await repairModule.repair();
        return result.success;
    } catch (error) {
        log(`  ❌ Repair failed: ${error.message}`, 'red');
        return false;
    }
}

// ============================================================================
// Report Generation
// ============================================================================

function generateJSONReport(results, startTime) {
    const report = {
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime,
        summary: {
            total: results.length,
            passed: results.filter(r => r.status === 'passed').length,
            failed: results.filter(r => r.status === 'failed').length,
            errors: results.filter(r => r.status === 'error').length,
            skipped: results.filter(r => r.status === 'skipped').length
        },
        criticalFailures: results.filter(r => r.critical && r.status !== 'passed').length,
        suites: results
    };

    return report;
}

function generateHTMLReport(results, startTime) {
    const report = generateJSONReport(results, startTime);
    const passRate = ((report.summary.passed / report.summary.total) * 100).toFixed(1);
    const statusColor = report.summary.failed === 0 && report.summary.errors === 0 ? '#22c55e' : '#ef4444';

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AI System Health Report - ${new Date().toLocaleDateString()}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', system-ui, sans-serif; background: #0f172a; color: #e2e8f0; line-height: 1.6; }
        .container { max-width: 1200px; margin: 0 auto; padding: 2rem; }
        .header { text-align: center; margin-bottom: 3rem; padding: 2rem; background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); border-radius: 16px; border: 1px solid #334155; }
        .header h1 { font-size: 2.5rem; margin-bottom: 0.5rem; background: linear-gradient(90deg, #06b6d4, #8b5cf6); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        .header .subtitle { color: #94a3b8; font-size: 1.1rem; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1.5rem; margin-bottom: 3rem; }
        .stat-card { background: #1e293b; padding: 1.5rem; border-radius: 12px; text-align: center; border: 1px solid #334155; }
        .stat-card .value { font-size: 3rem; font-weight: bold; }
        .stat-card .label { color: #94a3b8; text-transform: uppercase; font-size: 0.85rem; letter-spacing: 0.05em; }
        .stat-card.success .value { color: #22c55e; }
        .stat-card.danger .value { color: #ef4444; }
        .stat-card.warning .value { color: #f59e0b; }
        .stat-card.info .value { color: #06b6d4; }
        .suite-list { display: flex; flex-direction: column; gap: 1rem; }
        .suite { background: #1e293b; border-radius: 12px; padding: 1.5rem; border: 1px solid #334155; }
        .suite.passed { border-left: 4px solid #22c55e; }
        .suite.failed { border-left: 4px solid #ef4444; }
        .suite.error { border-left: 4px solid #f59e0b; }
        .suite.skipped { border-left: 4px solid #64748b; }
        .suite-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
        .suite-name { font-size: 1.25rem; font-weight: 600; }
        .suite-status { padding: 0.25rem 0.75rem; border-radius: 9999px; font-size: 0.85rem; font-weight: 600; }
        .suite-status.passed { background: #22c55e20; color: #22c55e; }
        .suite-status.failed { background: #ef444420; color: #ef4444; }
        .suite-status.error { background: #f59e0b20; color: #f59e0b; }
        .suite-status.skipped { background: #64748b20; color: #64748b; }
        .suite-meta { display: flex; gap: 2rem; color: #94a3b8; font-size: 0.9rem; }
        .tests-list { margin-top: 1rem; padding-top: 1rem; border-top: 1px solid #334155; }
        .test-item { display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem 0; font-size: 0.9rem; }
        .test-item .icon { width: 20px; }
        .test-item.passed .icon { color: #22c55e; }
        .test-item.failed .icon { color: #ef4444; }
        .footer { text-align: center; margin-top: 3rem; padding-top: 2rem; border-top: 1px solid #334155; color: #64748b; }
        .overall-status { font-size: 1.5rem; padding: 1rem 2rem; border-radius: 12px; display: inline-block; margin-top: 1rem; background: ${statusColor}20; color: ${statusColor}; font-weight: bold; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🧠 AI System Health Report</h1>
            <p class="subtitle">Enterprise-Level Diagnostics - ${new Date().toLocaleString()}</p>
            <div class="overall-status">${report.summary.failed === 0 && report.summary.errors === 0 ? '✓ ALL SYSTEMS OPERATIONAL' : '⚠ ISSUES DETECTED'}</div>
        </div>

        <div class="summary">
            <div class="stat-card success">
                <div class="value">${report.summary.passed}</div>
                <div class="label">Passed</div>
            </div>
            <div class="stat-card danger">
                <div class="value">${report.summary.failed + report.summary.errors}</div>
                <div class="label">Failed</div>
            </div>
            <div class="stat-card info">
                <div class="value">${passRate}%</div>
                <div class="label">Pass Rate</div>
            </div>
            <div class="stat-card warning">
                <div class="value">${(report.duration / 1000).toFixed(1)}s</div>
                <div class="label">Duration</div>
            </div>
        </div>

        <h2 style="margin-bottom: 1.5rem; color: #f1f5f9;">Test Suite Results</h2>
        <div class="suite-list">
            ${report.suites.map(suite => `
                <div class="suite ${suite.status}">
                    <div class="suite-header">
                        <span class="suite-name">${suite.critical ? '⭐ ' : ''}${suite.suite}</span>
                        <span class="suite-status ${suite.status}">${suite.status.toUpperCase()}</span>
                    </div>
                    <div class="suite-meta">
                        <span>✓ ${suite.passed} passed</span>
                        <span>✗ ${suite.failed} failed</span>
                        <span>⏱ ${(suite.duration / 1000).toFixed(2)}s</span>
                    </div>
                    ${suite.tests && suite.tests.length > 0 ? `
                        <div class="tests-list">
                            ${suite.tests.slice(0, 10).map(test => `
                                <div class="test-item ${test.status || (test.passed ? 'passed' : 'failed')}">
                                    <span class="icon">${test.status === 'passed' || test.passed ? '✓' : '✗'}</span>
                                    <span>${test.name}</span>
                                    ${test.error ? `<span style="color: #94a3b8; margin-left: auto;">${test.error}</span>` : ''}
                                </div>
                            `).join('')}
                            ${suite.tests.length > 10 ? `<div style="color: #64748b; padding-top: 0.5rem;">... and ${suite.tests.length - 10} more tests</div>` : ''}
                        </div>
                    ` : ''}
                </div>
            `).join('')}
        </div>

        <div class="footer">
            <p>Generated by DBR77 AI System Test Suite</p>
            <p style="margin-top: 0.5rem;">Harvard/McKinsey/IBM Enterprise Level</p>
        </div>
    </div>
</body>
</html>`;

    return html;
}

function saveReports(results, startTime) {
    if (!fs.existsSync(CONFIG.reportsDir)) {
        fs.mkdirSync(CONFIG.reportsDir, { recursive: true });
    }

    const dateStr = new Date().toISOString().split('T')[0];
    
    // Save JSON
    const jsonReport = generateJSONReport(results, startTime);
    const jsonPath = path.join(CONFIG.reportsDir, `ai_test_results_${dateStr}.json`);
    fs.writeFileSync(jsonPath, JSON.stringify(jsonReport, null, 2));
    
    // Save HTML
    const htmlReport = generateHTMLReport(results, startTime);
    const htmlPath = path.join(CONFIG.reportsDir, `ai_system_health_${dateStr}.html`);
    fs.writeFileSync(htmlPath, htmlReport);

    return { jsonPath, htmlPath };
}

// ============================================================================
// Main Execution
// ============================================================================

async function main() {
    const args = parseArgs();
    const startTime = Date.now();

    console.log('\n');
    console.log(c.bold + c.cyan + '╔════════════════════════════════════════════════════════════════════╗' + c.reset);
    console.log(c.bold + c.cyan + '║                                                                    ║' + c.reset);
    console.log(c.bold + c.cyan + '║   🧠 ENTERPRISE AI SYSTEM TEST SUITE                              ║' + c.reset);
    console.log(c.bold + c.cyan + '║   Harvard/McKinsey/IBM Enterprise Level                           ║' + c.reset);
    console.log(c.bold + c.cyan + '║                                                                    ║' + c.reset);
    console.log(c.bold + c.cyan + '╚════════════════════════════════════════════════════════════════════╝' + c.reset);
    console.log('\n');

    log(`Started: ${new Date().toLocaleString()}`, 'yellow');
    log(`Mode: ${args.quick ? 'Quick (Critical Only)' : 'Full Suite'}`, 'yellow');
    log(`Auto-Repair: ${args.repair ? 'Enabled' : 'Disabled'}`, 'yellow');
    log(`Report Generation: ${args.report ? 'Enabled' : 'Disabled'}`, 'yellow');

    // Determine which suites to run
    let suitesToRun = TEST_SUITES;
    
    if (args.suite) {
        suitesToRun = TEST_SUITES.filter(s => s.id === args.suite);
        if (suitesToRun.length === 0) {
            log(`\n❌ Unknown suite: ${args.suite}`, 'red');
            log(`Available suites: ${TEST_SUITES.map(s => s.id).join(', ')}`, 'yellow');
            process.exit(1);
        }
    } else if (args.quick) {
        suitesToRun = TEST_SUITES.filter(s => s.critical);
    }

    // Run tests
    logSection('Running Test Suites');
    
    const results = [];
    const failedSuites = [];

    for (const suite of suitesToRun) {
        process.stdout.write(`  Running ${suite.name}... `);
        
        const result = await runTestSuite(suite);
        results.push(result);

        if (result.status === 'passed') {
            console.log(`${c.green}✓ PASS${c.reset} (${result.passed}/${result.passed + result.failed})`);
        } else if (result.status === 'skipped') {
            console.log(`${c.yellow}⊘ SKIP${c.reset} (${result.reason})`);
        } else {
            console.log(`${c.red}✗ FAIL${c.reset} (${result.passed}/${result.passed + result.failed})`);
            failedSuites.push(suite);
        }
    }

    // Run repairs if enabled and there are failures
    if (args.repair && failedSuites.length > 0) {
        logSection('Running Auto-Repair');
        
        const repairedModules = new Set();
        
        for (const suite of failedSuites) {
            if (suite.repairModule && !repairedModules.has(suite.repairModule)) {
                process.stdout.write(`  Repairing with ${suite.repairModule}... `);
                const repaired = await runRepairModule(suite.repairModule);
                console.log(repaired ? `${c.green}✓ Done${c.reset}` : `${c.yellow}⚠ Partial${c.reset}`);
                repairedModules.add(suite.repairModule);
            }
        }

        // Re-run failed tests after repair
        logSection('Re-Running Failed Tests');
        
        for (let i = 0; i < results.length; i++) {
            if (results[i].status !== 'passed' && results[i].status !== 'skipped') {
                const suite = suitesToRun.find(s => s.name === results[i].suite);
                if (suite) {
                    process.stdout.write(`  Re-testing ${suite.name}... `);
                    const newResult = await runTestSuite(suite);
                    results[i] = newResult;
                    
                    if (newResult.status === 'passed') {
                        console.log(`${c.green}✓ FIXED${c.reset}`);
                    } else {
                        console.log(`${c.red}✗ STILL FAILING${c.reset}`);
                    }
                }
            }
        }
    }

    // Generate reports
    if (args.report) {
        logSection('Generating Reports');
        const { jsonPath, htmlPath } = saveReports(results, startTime);
        log(`  📄 JSON: ${jsonPath}`, 'cyan');
        log(`  📊 HTML: ${htmlPath}`, 'cyan');
    }

    // Summary
    logSection('Test Summary');
    
    const totalPassed = results.filter(r => r.status === 'passed').length;
    const totalFailed = results.filter(r => r.status === 'failed' || r.status === 'error').length;
    const totalSkipped = results.filter(r => r.status === 'skipped').length;
    const criticalFailed = results.filter(r => r.critical && r.status !== 'passed' && r.status !== 'skipped').length;
    const duration = Date.now() - startTime;

    console.log(`  Total Suites:    ${results.length}`);
    console.log(`  ${c.green}Passed:${c.reset}          ${totalPassed}`);
    console.log(`  ${c.red}Failed:${c.reset}          ${totalFailed}`);
    console.log(`  ${c.yellow}Skipped:${c.reset}         ${totalSkipped}`);
    console.log(`  ${c.magenta}Critical Fails:${c.reset}  ${criticalFailed}`);
    console.log(`  Duration:        ${(duration / 1000).toFixed(2)}s`);

    console.log('\n' + '═'.repeat(70));
    
    if (totalFailed === 0 && criticalFailed === 0) {
        console.log(c.green + c.bold + '\n  ✓ ALL TESTS PASSED - AI SYSTEM IS PRODUCTION READY\n' + c.reset);
        process.exit(0);
    } else if (criticalFailed > 0) {
        console.log(c.red + c.bold + '\n  ✗ CRITICAL FAILURES DETECTED - IMMEDIATE ACTION REQUIRED\n' + c.reset);
        process.exit(2);
    } else {
        console.log(c.yellow + c.bold + '\n  ⚠ SOME TESTS FAILED - REVIEW RECOMMENDED\n' + c.reset);
        process.exit(1);
    }
}

// Run if executed directly
if (require.main === module) {
    main().catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}

module.exports = { runTestSuite, generateJSONReport, generateHTMLReport };

