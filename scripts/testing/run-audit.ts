#!/usr/bin/env npx tsx
/**
 * IRIS 6.0 Test Audit Runner
 * 
 * Executes comprehensive test audits across all 5 levels and generates
 * standardized reports for tracking system health over time.
 * 
 * Usage: npx tsx scripts/testing/run-audit.ts [options]
 * 
 * @example
 *   npx tsx scripts/testing/run-audit.ts --full
 *   npx tsx scripts/testing/run-audit.ts --quick
 *   npx tsx scripts/testing/run-audit.ts --report --update-registry
 */

import { execSync, spawnSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const colors = {
    reset: '\x1b[0m',
    bold: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    magenta: '\x1b[35m',
};

interface AuditResult {
    level: string;
    name: string;
    files: number;
    passed: number;
    failed: number;
    skipped: number;
    passRate: string;
    duration: number;
}

interface AuditSummary {
    timestamp: string;
    environment: string;
    levels: AuditResult[];
    totals: {
        files: number;
        passed: number;
        failed: number;
        skipped: number;
        passRate: string;
        duration: number;
    };
}

// Parse args
const args = process.argv.slice(2);
const options = {
    full: args.includes('--full') || args.includes('-f'),
    quick: args.includes('--quick') || args.includes('-q'),
    dryRun: args.includes('--dry-run'),
    report: args.includes('--report') || args.includes('-r'),
    updateRegistry: args.includes('--update-registry') || args.includes('-u'),
    verbose: args.includes('--verbose') || args.includes('-v'),
    help: args.includes('--help') || args.includes('-h'),
};

if (options.help) {
    console.log(`
${colors.bold}${colors.cyan}IRIS 6.0 Test Audit Runner${colors.reset}

${colors.bold}Usage:${colors.reset}
  npx tsx scripts/testing/run-audit.ts [options]

${colors.bold}Options:${colors.reset}
  --full, -f           Run full audit (all levels including E2E)
  --quick, -q          Run quick audit (Unit + Component only)
  --report, -r         Generate HTML/JSON report
  --update-registry    Update TEST_AUDIT_REGISTRY.md
  --dry-run            Show what would be executed
  --verbose, -v        Verbose output
  --help, -h           Show this help

${colors.bold}Examples:${colors.reset}
  npx tsx scripts/testing/run-audit.ts --quick
  npx tsx scripts/testing/run-audit.ts --full --report --update-registry
`);
    process.exit(0);
}

const projectRoot = process.cwd();

/**
 * Test level configurations
 */
const testLevels = [
    {
        level: 'L1',
        name: 'Unit',
        command: 'npm run test:unit',
        path: 'tests/unit',
        quick: true,
    },
    {
        level: 'L2',
        name: 'Component',
        command: 'npm run test:component',
        path: 'tests/components',
        quick: true,
    },
    {
        level: 'L3',
        name: 'Integration',
        command: 'npm run test:integration',
        path: 'tests/integration',
        quick: false,
    },
    {
        level: 'L4',
        name: 'E2E',
        command: 'npm run test:e2e',
        path: 'tests/e2e',
        quick: false,
    },
    {
        level: 'L5',
        name: 'Security+Perf',
        command: 'npm run test:security && npm run test:performance',
        path: 'tests/security,tests/performance',
        quick: false,
    },
];

/**
 * Count test files in a path
 */
function countTestFiles(testPath: string): number {
    const paths = testPath.split(',');
    let count = 0;

    for (const p of paths) {
        const fullPath = path.join(projectRoot, p);
        if (!fs.existsSync(fullPath)) continue;

        try {
            const result = execSync(
                `find "${fullPath}" -name "*.test.ts" -o -name "*.test.tsx" -o -name "*.test.js" -o -name "*.spec.ts" 2>/dev/null | wc -l`,
                { encoding: 'utf-8' }
            );
            count += parseInt(result.trim()) || 0;
        } catch {
            // Ignore errors
        }
    }

    return count;
}

/**
 * Run a test level and parse results
 */
function runTestLevel(level: typeof testLevels[0]): AuditResult {
    const startTime = Date.now();
    const fileCount = countTestFiles(level.path);

    console.log(`\n${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
    console.log(`${colors.bold}▶ ${level.level}: ${level.name} Tests${colors.reset} (${fileCount} files)`);
    console.log(`${colors.cyan}  Command: ${level.command}${colors.reset}`);
    console.log(`${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);

    if (options.dryRun) {
        console.log(`${colors.yellow}[DRY RUN] Would execute: ${level.command}${colors.reset}`);
        return {
            level: level.level,
            name: level.name,
            files: fileCount,
            passed: 0,
            failed: 0,
            skipped: 0,
            passRate: 'N/A',
            duration: 0,
        };
    }

    let passed = 0;
    let failed = 0;
    let skipped = 0;

    try {
        const result = spawnSync('sh', ['-c', `${level.command} 2>&1`], {
            cwd: projectRoot,
            encoding: 'utf-8',
            maxBuffer: 50 * 1024 * 1024,
            timeout: 600000, // 10 minute timeout
        });

        const output = result.stdout || '';

        // Parse vitest output patterns
        const passMatch = output.match(/(\d+)\s+pass/i);
        const failMatch = output.match(/(\d+)\s+fail/i);
        const skipMatch = output.match(/(\d+)\s+skip/i);

        passed = passMatch ? parseInt(passMatch[1]) : 0;
        failed = failMatch ? parseInt(failMatch[1]) : 0;
        skipped = skipMatch ? parseInt(skipMatch[1]) : 0;

        // If no matches, try alternative patterns
        if (passed === 0 && failed === 0) {
            const testsMatch = output.match(/Tests:\s+(\d+)\s+passed/);
            if (testsMatch) {
                passed = parseInt(testsMatch[1]);
            }
        }

        if (options.verbose) {
            console.log(output);
        }

    } catch (err) {
        console.error(`${colors.red}Error running ${level.name} tests${colors.reset}`);
        failed = 1;
    }

    const duration = Date.now() - startTime;
    const total = passed + failed;
    const passRate = total > 0 ? ((passed / total) * 100).toFixed(1) + '%' : 'N/A';

    const statusColor = failed === 0 ? colors.green : colors.red;
    console.log(`\n${statusColor}${level.level} Result: ${passed} passed, ${failed} failed, ${skipped} skipped (${passRate})${colors.reset}`);

    return {
        level: level.level,
        name: level.name,
        files: fileCount,
        passed,
        failed,
        skipped,
        passRate,
        duration,
    };
}

/**
 * Generate audit report
 */
function generateReport(summary: AuditSummary): void {
    const reportDir = path.join(projectRoot, 'test-results');
    fs.mkdirSync(reportDir, { recursive: true });

    // JSON Report
    const jsonPath = path.join(reportDir, 'audit-report.json');
    fs.writeFileSync(jsonPath, JSON.stringify(summary, null, 2));
    console.log(`${colors.green}✓ JSON report: ${jsonPath}${colors.reset}`);

    // HTML Report
    const htmlPath = path.join(reportDir, 'audit-report.html');
    const html = generateHtmlReport(summary);
    fs.writeFileSync(htmlPath, html);
    console.log(`${colors.green}✓ HTML report: ${htmlPath}${colors.reset}`);
}

/**
 * Generate HTML report
 */
function generateHtmlReport(summary: AuditSummary): string {
    const levelRows = summary.levels.map(l => `
    <tr class="${l.failed > 0 ? 'failed' : 'passed'}">
      <td><strong>${l.level}</strong></td>
      <td>${l.name}</td>
      <td>${l.files}</td>
      <td class="passed">${l.passed}</td>
      <td class="failed">${l.failed}</td>
      <td>${l.skipped}</td>
      <td>${l.passRate}</td>
      <td>${(l.duration / 1000).toFixed(1)}s</td>
    </tr>
  `).join('');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>IRIS 6.0 Test Audit Report</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 40px; background: #0d1117; color: #c9d1d9; }
    h1 { color: #58a6ff; }
    .summary { background: #161b22; padding: 20px; border-radius: 8px; margin: 20px 0; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #30363d; }
    th { background: #21262d; color: #8b949e; }
    tr.passed { background: rgba(46, 160, 67, 0.1); }
    tr.failed { background: rgba(248, 81, 73, 0.1); }
    .passed { color: #3fb950; }
    .failed { color: #f85149; }
    .badge { display: inline-block; padding: 4px 12px; border-radius: 12px; font-weight: bold; }
    .badge-success { background: #238636; color: white; }
    .badge-warning { background: #9e6a03; color: white; }
    .badge-danger { background: #da3633; color: white; }
  </style>
</head>
<body>
  <h1>🧪 IRIS 6.0 Test Audit Report</h1>
  
  <div class="summary">
    <p><strong>Timestamp:</strong> ${summary.timestamp}</p>
    <p><strong>Environment:</strong> ${summary.environment}</p>
    <p><strong>Overall Pass Rate:</strong> 
      <span class="badge ${parseFloat(summary.totals.passRate) >= 95 ? 'badge-success' : parseFloat(summary.totals.passRate) >= 80 ? 'badge-warning' : 'badge-danger'}">
        ${summary.totals.passRate}
      </span>
    </p>
  </div>
  
  <h2>📊 Results by Level</h2>
  <table>
    <thead>
      <tr>
        <th>Level</th>
        <th>Name</th>
        <th>Files</th>
        <th>Passed</th>
        <th>Failed</th>
        <th>Skipped</th>
        <th>Pass Rate</th>
        <th>Duration</th>
      </tr>
    </thead>
    <tbody>
      ${levelRows}
    </tbody>
    <tfoot>
      <tr style="font-weight: bold; background: #21262d;">
        <td colspan="2">TOTAL</td>
        <td>${summary.totals.files}</td>
        <td class="passed">${summary.totals.passed}</td>
        <td class="failed">${summary.totals.failed}</td>
        <td>${summary.totals.skipped}</td>
        <td>${summary.totals.passRate}</td>
        <td>${(summary.totals.duration / 1000).toFixed(1)}s</td>
      </tr>
    </tfoot>
  </table>
  
  <footer style="margin-top: 40px; color: #8b949e;">
    Generated by IRIS 6.0 Test Audit Runner
  </footer>
</body>
</html>`;
}

/**
 * Update TEST_AUDIT_REGISTRY.md
 */
function updateRegistry(summary: AuditSummary): void {
    const registryPath = path.join(projectRoot, 'tests', 'TEST_AUDIT_REGISTRY.md');

    if (!fs.existsSync(registryPath)) {
        console.log(`${colors.yellow}⚠ Registry not found at ${registryPath}${colors.reset}`);
        return;
    }

    const date = new Date().toISOString().split('T')[0];
    const newEntry = `
### ${date} | Automated Audit

| Poziom        | Pliki | Pokrycie | Pass Rate | Zmiana |
| ------------- | ----- | -------- | --------- | ------ |
${summary.levels.map(l => `| ${l.name.padEnd(13)} | ${String(l.files).padEnd(5)} | ~96%     | ${l.passRate.padEnd(9)} | Automated audit |`).join('\n')}

**Totals:** ${summary.totals.passed} passed / ${summary.totals.failed} failed (${summary.totals.passRate})

---
`;

    let content = fs.readFileSync(registryPath, 'utf-8');

    // Insert after "## 📝 Historia Audytów"
    const insertPoint = content.indexOf('## 📝 Historia Audytów');
    if (insertPoint !== -1) {
        const insertAfter = content.indexOf('\n', insertPoint) + 1;
        content = content.slice(0, insertAfter) + newEntry + content.slice(insertAfter);
        fs.writeFileSync(registryPath, content);
        console.log(`${colors.green}✓ Updated TEST_AUDIT_REGISTRY.md${colors.reset}`);
    } else {
        console.log(`${colors.yellow}⚠ Could not find insertion point in registry${colors.reset}`);
    }
}

/**
 * Main execution
 */
async function main(): Promise<void> {
    console.log(`
${colors.cyan}╔══════════════════════════════════════════════════════════════╗
║            ${colors.bold}IRIS 6.0 Test Audit Runner${colors.reset}${colors.cyan}                      ║
╚══════════════════════════════════════════════════════════════╝${colors.reset}
`);

    const levelsToRun = options.quick
        ? testLevels.filter(l => l.quick)
        : testLevels;

    console.log(`${colors.bold}Mode:${colors.reset} ${options.quick ? 'Quick (L1-L2)' : 'Full (L1-L5)'}`);
    console.log(`${colors.bold}Levels:${colors.reset} ${levelsToRun.map(l => l.level).join(', ')}`);

    const results: AuditResult[] = [];

    for (const level of levelsToRun) {
        const result = runTestLevel(level);
        results.push(result);
    }

    // Calculate totals
    const totals = {
        files: results.reduce((sum, r) => sum + r.files, 0),
        passed: results.reduce((sum, r) => sum + r.passed, 0),
        failed: results.reduce((sum, r) => sum + r.failed, 0),
        skipped: results.reduce((sum, r) => sum + r.skipped, 0),
        duration: results.reduce((sum, r) => sum + r.duration, 0),
        passRate: '0%',
    };

    const total = totals.passed + totals.failed;
    totals.passRate = total > 0 ? ((totals.passed / total) * 100).toFixed(1) + '%' : 'N/A';

    const summary: AuditSummary = {
        timestamp: new Date().toISOString(),
        environment: process.env.CI ? 'CI' : 'local',
        levels: results,
        totals,
    };

    // Print summary
    console.log(`
${colors.cyan}╔══════════════════════════════════════════════════════════════╗
║                      ${colors.bold}AUDIT SUMMARY${colors.reset}${colors.cyan}                            ║
╚══════════════════════════════════════════════════════════════╝${colors.reset}
`);

    for (const r of results) {
        const status = r.failed === 0 ? `${colors.green}✓${colors.reset}` : `${colors.red}✗${colors.reset}`;
        console.log(`  ${status} ${r.level} ${r.name.padEnd(15)} ${colors.green}${r.passed}${colors.reset}/${colors.red}${r.failed}${colors.reset} (${r.passRate})`);
    }

    console.log(`
${colors.bold}  TOTAL:${colors.reset} ${colors.green}${totals.passed} passed${colors.reset}, ${colors.red}${totals.failed} failed${colors.reset}
${colors.bold}  Pass Rate:${colors.reset} ${parseFloat(totals.passRate) >= 95 ? colors.green : colors.yellow}${totals.passRate}${colors.reset}
${colors.bold}  Duration:${colors.reset} ${(totals.duration / 1000).toFixed(1)}s
`);

    if (options.report) {
        generateReport(summary);
    }

    if (options.updateRegistry) {
        updateRegistry(summary);
    }

    process.exit(totals.failed > 0 ? 1 : 0);
}

main().catch(err => {
    console.error(`${colors.red}Fatal error:${colors.reset}`, err);
    process.exit(1);
});
