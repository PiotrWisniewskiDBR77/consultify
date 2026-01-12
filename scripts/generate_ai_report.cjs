#!/usr/bin/env node
/**
 * AI System Report Generator
 * 
 * Generates comprehensive HTML and JSON reports for AI system health:
 * - Executive summary
 * - Test results by suite
 * - Performance metrics
 * - Recommendations
 * - Historical trends
 */

const path = require('path');
const fs = require('fs');

// Paths
const REPORTS_DIR = path.join(__dirname, '../reports');

// Ensure reports directory exists
if (!fs.existsSync(REPORTS_DIR)) {
    fs.mkdirSync(REPORTS_DIR, { recursive: true });
}

/**
 * Generate JSON report from test results
 */
function generateJSONReport(results, options = {}) {
    const report = {
        metadata: {
            generated_at: new Date().toISOString(),
            version: '1.0.0',
            environment: process.env.NODE_ENV || 'development'
        },
        summary: {
            total_suites: results.length,
            passed_suites: results.filter(r => r.status === 'passed').length,
            failed_suites: results.filter(r => r.status === 'failed' || r.status === 'error').length,
            skipped_suites: results.filter(r => r.status === 'skipped').length,
            total_tests: results.reduce((sum, r) => sum + (r.passed || 0) + (r.failed || 0), 0),
            passed_tests: results.reduce((sum, r) => sum + (r.passed || 0), 0),
            failed_tests: results.reduce((sum, r) => sum + (r.failed || 0), 0),
            pass_rate: 0,
            total_duration: results.reduce((sum, r) => sum + (r.duration || 0), 0)
        },
        critical_issues: [],
        suites: results,
        recommendations: [],
        repair_actions: options.repairs || []
    };

    // Calculate pass rate
    if (report.summary.total_tests > 0) {
        report.summary.pass_rate = Math.round(
            (report.summary.passed_tests / report.summary.total_tests) * 100
        );
    }

    // Identify critical issues
    results.forEach(suite => {
        if (suite.critical && suite.status !== 'passed') {
            report.critical_issues.push({
                suite: suite.suite,
                status: suite.status,
                error: suite.error,
                impact: 'HIGH'
            });
        }
    });

    // Generate recommendations
    report.recommendations = generateRecommendations(results);

    return report;
}

/**
 * Generate recommendations based on test results
 */
function generateRecommendations(results) {
    const recommendations = [];

    // Check LLM connectivity
    const llmSuite = results.find(r => r.suiteId === 'llm-connectivity');
    if (llmSuite && llmSuite.status !== 'passed') {
        recommendations.push({
            priority: 'HIGH',
            category: 'LLM',
            issue: 'LLM connectivity issues detected',
            action: 'Run: node scripts/auto_repair_llm.cjs',
            impact: 'Chat and AI features may not work'
        });
    }

    // Check security
    const securitySuite = results.find(r => r.suiteId === 'enterprise-security');
    if (securitySuite && securitySuite.status !== 'passed') {
        recommendations.push({
            priority: 'CRITICAL',
            category: 'Security',
            issue: 'Security tests failed',
            action: 'Review security configuration immediately',
            impact: 'Potential security vulnerabilities'
        });
    }

    // Check memory system
    const memorySuite = results.find(r => r.suiteId === 'memory-system');
    if (memorySuite && memorySuite.status !== 'passed') {
        recommendations.push({
            priority: 'MEDIUM',
            category: 'Memory',
            issue: 'Memory system issues detected',
            action: 'Run: node scripts/repair/repair_memory.cjs',
            impact: 'Context preservation may be affected'
        });
    }

    // Check health monitor
    const healthSuite = results.find(r => r.suiteId === 'health-monitor');
    if (healthSuite && healthSuite.status !== 'passed') {
        recommendations.push({
            priority: 'MEDIUM',
            category: 'Health',
            issue: 'Self-healing system issues',
            action: 'Run: node scripts/repair/repair_database.cjs',
            impact: 'Auto-recovery may not function'
        });
    }

    // General recommendations based on pass rate
    const passRate = results.filter(r => r.status === 'passed').length / results.length;
    if (passRate < 0.8) {
        recommendations.push({
            priority: 'HIGH',
            category: 'General',
            issue: `Overall pass rate is ${Math.round(passRate * 100)}%`,
            action: 'Run full repair: node scripts/run_ai_system_tests.cjs --repair',
            impact: 'System stability may be compromised'
        });
    }

    return recommendations;
}

/**
 * Generate HTML report from test results
 */
function generateHTMLReport(results, options = {}) {
    const jsonReport = generateJSONReport(results, options);
    const { summary, critical_issues, recommendations, suites } = jsonReport;
    
    const statusColor = summary.failed_suites === 0 ? '#22c55e' : '#ef4444';
    const statusText = summary.failed_suites === 0 ? 'ALL SYSTEMS OPERATIONAL' : 'ISSUES DETECTED';

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AI System Health Report - ${new Date().toLocaleDateString()}</title>
    <style>
        :root {
            --bg-primary: #0f172a;
            --bg-secondary: #1e293b;
            --bg-tertiary: #334155;
            --text-primary: #f1f5f9;
            --text-secondary: #94a3b8;
            --accent-green: #22c55e;
            --accent-red: #ef4444;
            --accent-yellow: #f59e0b;
            --accent-blue: #3b82f6;
            --accent-purple: #8b5cf6;
        }
        
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        body {
            font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
            background: var(--bg-primary);
            color: var(--text-primary);
            line-height: 1.6;
            min-height: 100vh;
        }
        
        .container {
            max-width: 1400px;
            margin: 0 auto;
            padding: 2rem;
        }
        
        .header {
            text-align: center;
            margin-bottom: 3rem;
            padding: 3rem;
            background: linear-gradient(135deg, var(--bg-secondary) 0%, var(--bg-primary) 100%);
            border-radius: 24px;
            border: 1px solid var(--bg-tertiary);
            position: relative;
            overflow: hidden;
        }
        
        .header::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 4px;
            background: linear-gradient(90deg, var(--accent-blue), var(--accent-purple), var(--accent-green));
        }
        
        .header h1 {
            font-size: 3rem;
            margin-bottom: 0.5rem;
            background: linear-gradient(90deg, var(--accent-blue), var(--accent-purple));
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }
        
        .header .subtitle {
            color: var(--text-secondary);
            font-size: 1.2rem;
            margin-bottom: 1.5rem;
        }
        
        .overall-status {
            display: inline-flex;
            align-items: center;
            gap: 0.75rem;
            font-size: 1.5rem;
            padding: 1rem 2rem;
            border-radius: 16px;
            background: ${statusColor}15;
            color: ${statusColor};
            font-weight: 700;
            border: 2px solid ${statusColor}40;
        }
        
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 1.5rem;
            margin-bottom: 3rem;
        }
        
        .stat-card {
            background: var(--bg-secondary);
            padding: 2rem;
            border-radius: 16px;
            text-align: center;
            border: 1px solid var(--bg-tertiary);
            transition: transform 0.2s, box-shadow 0.2s;
        }
        
        .stat-card:hover {
            transform: translateY(-4px);
            box-shadow: 0 12px 40px rgba(0,0,0,0.3);
        }
        
        .stat-card .value {
            font-size: 3.5rem;
            font-weight: 800;
            line-height: 1;
            margin-bottom: 0.5rem;
        }
        
        .stat-card .label {
            color: var(--text-secondary);
            text-transform: uppercase;
            font-size: 0.85rem;
            letter-spacing: 0.1em;
            font-weight: 600;
        }
        
        .stat-card.success .value { color: var(--accent-green); }
        .stat-card.danger .value { color: var(--accent-red); }
        .stat-card.warning .value { color: var(--accent-yellow); }
        .stat-card.info .value { color: var(--accent-blue); }
        
        .section {
            margin-bottom: 3rem;
        }
        
        .section-title {
            font-size: 1.75rem;
            margin-bottom: 1.5rem;
            padding-bottom: 0.75rem;
            border-bottom: 2px solid var(--bg-tertiary);
            display: flex;
            align-items: center;
            gap: 0.75rem;
        }
        
        .suite-grid {
            display: grid;
            gap: 1rem;
        }
        
        .suite-card {
            background: var(--bg-secondary);
            border-radius: 16px;
            padding: 1.5rem;
            border: 1px solid var(--bg-tertiary);
            transition: all 0.2s;
        }
        
        .suite-card:hover {
            border-color: var(--accent-blue);
        }
        
        .suite-card.passed { border-left: 4px solid var(--accent-green); }
        .suite-card.failed { border-left: 4px solid var(--accent-red); }
        .suite-card.error { border-left: 4px solid var(--accent-yellow); }
        .suite-card.skipped { border-left: 4px solid var(--text-secondary); }
        
        .suite-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 1rem;
        }
        
        .suite-name {
            font-size: 1.25rem;
            font-weight: 600;
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }
        
        .suite-badge {
            padding: 0.35rem 1rem;
            border-radius: 9999px;
            font-size: 0.8rem;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }
        
        .suite-badge.passed { background: var(--accent-green)20; color: var(--accent-green); }
        .suite-badge.failed { background: var(--accent-red)20; color: var(--accent-red); }
        .suite-badge.error { background: var(--accent-yellow)20; color: var(--accent-yellow); }
        .suite-badge.skipped { background: var(--text-secondary)20; color: var(--text-secondary); }
        
        .suite-stats {
            display: flex;
            gap: 2rem;
            color: var(--text-secondary);
            font-size: 0.95rem;
        }
        
        .suite-stats span {
            display: flex;
            align-items: center;
            gap: 0.35rem;
        }
        
        .tests-list {
            margin-top: 1rem;
            padding-top: 1rem;
            border-top: 1px solid var(--bg-tertiary);
        }
        
        .test-item {
            display: flex;
            align-items: center;
            gap: 0.75rem;
            padding: 0.5rem 0;
            font-size: 0.95rem;
        }
        
        .test-item .icon {
            width: 20px;
            text-align: center;
        }
        
        .test-item.passed .icon { color: var(--accent-green); }
        .test-item.failed .icon { color: var(--accent-red); }
        
        .recommendations {
            display: grid;
            gap: 1rem;
        }
        
        .recommendation {
            background: var(--bg-secondary);
            border-radius: 12px;
            padding: 1.25rem;
            border-left: 4px solid;
        }
        
        .recommendation.CRITICAL { border-color: var(--accent-red); }
        .recommendation.HIGH { border-color: var(--accent-yellow); }
        .recommendation.MEDIUM { border-color: var(--accent-blue); }
        .recommendation.LOW { border-color: var(--text-secondary); }
        
        .recommendation-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 0.5rem;
        }
        
        .recommendation-priority {
            font-size: 0.75rem;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            padding: 0.25rem 0.75rem;
            border-radius: 9999px;
        }
        
        .recommendation-priority.CRITICAL { background: var(--accent-red)20; color: var(--accent-red); }
        .recommendation-priority.HIGH { background: var(--accent-yellow)20; color: var(--accent-yellow); }
        .recommendation-priority.MEDIUM { background: var(--accent-blue)20; color: var(--accent-blue); }
        
        .recommendation-action {
            font-family: 'Consolas', 'Monaco', monospace;
            background: var(--bg-primary);
            padding: 0.5rem 1rem;
            border-radius: 8px;
            font-size: 0.9rem;
            margin-top: 0.75rem;
            color: var(--accent-green);
        }
        
        .footer {
            text-align: center;
            margin-top: 4rem;
            padding-top: 2rem;
            border-top: 1px solid var(--bg-tertiary);
            color: var(--text-secondary);
        }
        
        .footer-logo {
            font-size: 1.5rem;
            font-weight: 700;
            margin-bottom: 0.5rem;
            background: linear-gradient(90deg, var(--accent-blue), var(--accent-purple));
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }
        
        @media (max-width: 768px) {
            .container { padding: 1rem; }
            .header h1 { font-size: 2rem; }
            .stats-grid { grid-template-columns: repeat(2, 1fr); }
            .stat-card .value { font-size: 2.5rem; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🧠 AI System Health Report</h1>
            <p class="subtitle">Enterprise-Level Diagnostics • ${new Date().toLocaleString()}</p>
            <div class="overall-status">
                ${summary.failed_suites === 0 ? '✓' : '⚠'} ${statusText}
            </div>
        </div>

        <div class="stats-grid">
            <div class="stat-card success">
                <div class="value">${summary.passed_tests}</div>
                <div class="label">Tests Passed</div>
            </div>
            <div class="stat-card danger">
                <div class="value">${summary.failed_tests}</div>
                <div class="label">Tests Failed</div>
            </div>
            <div class="stat-card info">
                <div class="value">${summary.pass_rate}%</div>
                <div class="label">Pass Rate</div>
            </div>
            <div class="stat-card warning">
                <div class="value">${(summary.total_duration / 1000).toFixed(1)}s</div>
                <div class="label">Duration</div>
            </div>
        </div>

        ${critical_issues.length > 0 ? `
        <div class="section">
            <h2 class="section-title">🚨 Critical Issues</h2>
            <div class="recommendations">
                ${critical_issues.map(issue => `
                    <div class="recommendation CRITICAL">
                        <div class="recommendation-header">
                            <strong>${issue.suite}</strong>
                            <span class="recommendation-priority CRITICAL">CRITICAL</span>
                        </div>
                        <p>Status: ${issue.status}${issue.error ? ` - ${issue.error}` : ''}</p>
                    </div>
                `).join('')}
            </div>
        </div>
        ` : ''}

        <div class="section">
            <h2 class="section-title">📊 Test Suite Results</h2>
            <div class="suite-grid">
                ${suites.map(suite => `
                    <div class="suite-card ${suite.status}">
                        <div class="suite-header">
                            <span class="suite-name">
                                ${suite.critical ? '⭐' : ''} ${suite.suite}
                            </span>
                            <span class="suite-badge ${suite.status}">${suite.status}</span>
                        </div>
                        <div class="suite-stats">
                            <span>✓ ${suite.passed} passed</span>
                            <span>✗ ${suite.failed} failed</span>
                            <span>⏱ ${(suite.duration / 1000).toFixed(2)}s</span>
                        </div>
                        ${suite.tests && suite.tests.length > 0 ? `
                            <div class="tests-list">
                                ${suite.tests.slice(0, 8).map(test => `
                                    <div class="test-item ${test.passed || test.status === 'passed' ? 'passed' : 'failed'}">
                                        <span class="icon">${test.passed || test.status === 'passed' ? '✓' : '✗'}</span>
                                        <span>${test.name}</span>
                                    </div>
                                `).join('')}
                                ${suite.tests.length > 8 ? `
                                    <div style="color: var(--text-secondary); padding-top: 0.5rem; font-size: 0.9rem;">
                                        ... and ${suite.tests.length - 8} more tests
                                    </div>
                                ` : ''}
                            </div>
                        ` : ''}
                    </div>
                `).join('')}
            </div>
        </div>

        ${recommendations.length > 0 ? `
        <div class="section">
            <h2 class="section-title">💡 Recommendations</h2>
            <div class="recommendations">
                ${recommendations.map(rec => `
                    <div class="recommendation ${rec.priority}">
                        <div class="recommendation-header">
                            <strong>[${rec.category}] ${rec.issue}</strong>
                            <span class="recommendation-priority ${rec.priority}">${rec.priority}</span>
                        </div>
                        <p style="color: var(--text-secondary); margin-top: 0.5rem;">${rec.impact}</p>
                        <div class="recommendation-action">${rec.action}</div>
                    </div>
                `).join('')}
            </div>
        </div>
        ` : ''}

        <div class="footer">
            <div class="footer-logo">DBR77 AI System</div>
            <p>Harvard/McKinsey/IBM Enterprise Level</p>
            <p style="margin-top: 1rem; font-size: 0.9rem;">
                Report generated at ${new Date().toISOString()}
            </p>
        </div>
    </div>
</body>
</html>`;

    return html;
}

/**
 * Save reports to files
 */
function saveReports(results, options = {}) {
    const dateStr = new Date().toISOString().split('T')[0];
    const timeStr = new Date().toISOString().split('T')[1].split('.')[0].replace(/:/g, '-');
    
    // Generate reports
    const jsonReport = generateJSONReport(results, options);
    const htmlReport = generateHTMLReport(results, options);
    
    // Save JSON
    const jsonFilename = `ai_test_results_${dateStr}_${timeStr}.json`;
    const jsonPath = path.join(REPORTS_DIR, jsonFilename);
    fs.writeFileSync(jsonPath, JSON.stringify(jsonReport, null, 2));
    
    // Save HTML
    const htmlFilename = `ai_system_health_${dateStr}_${timeStr}.html`;
    const htmlPath = path.join(REPORTS_DIR, htmlFilename);
    fs.writeFileSync(htmlPath, htmlReport);
    
    // Also save as "latest"
    fs.writeFileSync(path.join(REPORTS_DIR, 'latest_results.json'), JSON.stringify(jsonReport, null, 2));
    fs.writeFileSync(path.join(REPORTS_DIR, 'latest_report.html'), htmlReport);
    
    return {
        jsonPath,
        htmlPath,
        jsonReport
    };
}

module.exports = {
    generateJSONReport,
    generateHTMLReport,
    saveReports,
    generateRecommendations
};

// CLI usage
if (require.main === module) {
    // Generate sample report for testing
    const sampleResults = [
        { suite: 'LLM Connectivity', suiteId: 'llm-connectivity', status: 'passed', passed: 10, failed: 0, duration: 5000, critical: true, tests: [] },
        { suite: 'AI Pipeline', suiteId: 'ai-pipeline', status: 'passed', passed: 8, failed: 1, duration: 3000, critical: true, tests: [] },
        { suite: 'Memory System', suiteId: 'memory-system', status: 'passed', passed: 9, failed: 0, duration: 2000, critical: true, tests: [] }
    ];
    
    const { jsonPath, htmlPath } = saveReports(sampleResults);
    console.log(`\nReports generated:`);
    console.log(`  JSON: ${jsonPath}`);
    console.log(`  HTML: ${htmlPath}`);
}

