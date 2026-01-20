#!/usr/bin/env npx tsx
/**
 * IRIS 6.0 Security Scan Orchestrator
 *
 * Comprehensive security testing orchestrator
 * Usage: npx tsx scripts/testing/security-scan.ts [options]
 */

import { execSync, spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

import { isCI, testConfig } from './test-config.js';

const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

interface SecurityCheck {
  name: string;
  command: string;
  args: string[];
  critical: boolean;
}

interface ScanResult {
  check: string;
  passed: boolean;
  duration: number;
  vulnerabilities?: number;
  details?: string;
}

const securityChecks: SecurityCheck[] = [
  {
    name: 'Dependency Audit',
    command: 'npm',
    args: ['audit', '--audit-level=high', '--json'],
    critical: true,
  },
  {
    name: 'SQL Injection Tests',
    command: 'npx',
    args: ['vitest', 'run', 'tests/security/sql-injection.test.ts', '--reporter=json'],
    critical: true,
  },
  {
    name: 'XSS Prevention Tests',
    command: 'npx',
    args: ['vitest', 'run', 'tests/security/xss-prevention.test.ts', '--reporter=json'],
    critical: true,
  },
  {
    name: 'CSRF Protection Tests',
    command: 'npx',
    args: ['vitest', 'run', 'tests/security/csrf-protection.test.ts', '--reporter=json'],
    critical: true,
  },
  {
    name: 'Full Security Test Suite',
    command: 'npx',
    args: ['vitest', 'run', '--config', 'vitest.security.config.ts', '--reporter=json'],
    critical: false,
  },
];

const quickChecks: SecurityCheck[] = [
  securityChecks[0], // Dependency Audit
  securityChecks[1], // SQL Injection
  securityChecks[2], // XSS Prevention
];

function parseArgs(): { full: boolean; quick: boolean; help: boolean } {
  const args = process.argv.slice(2);
  return {
    full: args.includes('--full') || args.includes('-f'),
    quick: args.includes('--quick') || args.includes('-q'),
    help: args.includes('--help') || args.includes('-h'),
  };
}

function printHelp(): void {
  console.log(`
${colors.bold}${colors.magenta}╔══════════════════════════════════════════════════════════════╗
║             IRIS 6.0 Security Scan Orchestrator              ║
╚══════════════════════════════════════════════════════════════╝${colors.reset}

${colors.bold}USAGE:${colors.reset}
  npx tsx scripts/testing/security-scan.ts [options]

${colors.bold}OPTIONS:${colors.reset}
  --full, -f     Run full security scan (all checks)
  --quick, -q    Run quick security scan (critical checks only)
  --help, -h     Show this help message

${colors.bold}CHECKS INCLUDED:${colors.reset}
  • npm audit (dependency vulnerabilities)
  • SQL Injection prevention tests
  • XSS prevention tests
  • CSRF protection tests
  • Full security test suite

${colors.bold}EXAMPLES:${colors.reset}
  npx tsx scripts/testing/security-scan.ts --quick
  npx tsx scripts/testing/security-scan.ts --full
`);
}

function printBanner(): void {
  console.log(`
${colors.magenta}╔══════════════════════════════════════════════════════════════╗
║            ${colors.bold}IRIS 6.0 Security Scan${colors.reset}${colors.magenta}                         ║
║                                                              ║
║  🔒 Scanning for vulnerabilities...                         ║
║  Started: ${new Date().toISOString()}                  ║
╚══════════════════════════════════════════════════════════════╝${colors.reset}
`);
}

async function runCheck(check: SecurityCheck): Promise<ScanResult> {
  const startTime = Date.now();

  console.log(`\n${colors.cyan}▶ ${check.name}...${colors.reset}`);

  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';

    const proc = spawn(check.command, check.args, {
      shell: true,
      cwd: process.cwd(),
    });

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      const duration = Date.now() - startTime;
      let vulnerabilities = 0;
      let passed = code === 0;

      // Parse npm audit output
      if (check.name === 'Dependency Audit') {
        try {
          const auditResult = JSON.parse(stdout);
          vulnerabilities = auditResult.metadata?.vulnerabilities?.total || 0;
          const high = auditResult.metadata?.vulnerabilities?.high || 0;
          const critical = auditResult.metadata?.vulnerabilities?.critical || 0;
          passed = high + critical === 0;
        } catch {
          // Non-JSON output, check exit code
        }
      }

      // Parse Vitest output
      if (check.name.includes('Tests')) {
        try {
          const testResult = JSON.parse(stdout);
          const numFailed = testResult.numFailedTests || 0;
          passed = numFailed === 0;
          vulnerabilities = numFailed;
        } catch {
          // Non-JSON output
        }
      }

      const status = passed
        ? `${colors.green}✓ PASS${colors.reset}`
        : `${colors.red}✗ FAIL${colors.reset}`;

      console.log(
        `  ${status} (${(duration / 1000).toFixed(2)}s)${vulnerabilities > 0 ? ` - ${vulnerabilities} issues found` : ''}`
      );

      resolve({
        check: check.name,
        passed,
        duration,
        vulnerabilities: vulnerabilities > 0 ? vulnerabilities : undefined,
        details: !passed ? stderr || stdout.slice(0, 500) : undefined,
      });
    });
  });
}

async function main(): Promise<void> {
  const options = parseArgs();

  if (options.help) {
    printHelp();
    process.exit(0);
  }

  printBanner();

  const checksToRun = options.quick ? quickChecks : securityChecks;
  const results: ScanResult[] = [];

  console.log(`${colors.bold}Running ${checksToRun.length} security checks...${colors.reset}`);

  for (const check of checksToRun) {
    const result = await runCheck(check);
    results.push(result);
  }

  // Print summary
  console.log(
    `\n${colors.magenta}╔══════════════════════════════════════════════════════════════╗${colors.reset}`
  );
  console.log(
    `${colors.magenta}║${colors.reset}                   ${colors.bold}SECURITY SCAN SUMMARY${colors.reset}                    ${colors.magenta}║${colors.reset}`
  );
  console.log(
    `${colors.magenta}╚══════════════════════════════════════════════════════════════╝${colors.reset}\n`
  );

  let allPassed = true;
  let criticalFailed = false;
  let totalVulnerabilities = 0;

  for (const result of results) {
    const status = result.passed
      ? `${colors.green}✓ PASS${colors.reset}`
      : `${colors.red}✗ FAIL${colors.reset}`;

    console.log(`  ${status.padEnd(20)} ${result.check}`);

    if (!result.passed) {
      allPassed = false;
      const check = checksToRun.find((c) => c.name === result.check);
      if (check?.critical) {
        criticalFailed = true;
      }
    }

    if (result.vulnerabilities) {
      totalVulnerabilities += result.vulnerabilities;
    }
  }

  // Final status
  console.log('\n' + '─'.repeat(60));

  if (allPassed) {
    console.log(`\n${colors.green}${colors.bold}✓ ALL SECURITY CHECKS PASSED${colors.reset}`);
    console.log(`${colors.green}  Platform is secure and ready for deployment.${colors.reset}\n`);
  } else if (criticalFailed) {
    console.log(`\n${colors.red}${colors.bold}✗ CRITICAL SECURITY ISSUES DETECTED${colors.reset}`);
    console.log(`${colors.red}  Please resolve the above issues before deployment.${colors.reset}`);
    console.log(`${colors.red}  Total vulnerabilities: ${totalVulnerabilities}${colors.reset}\n`);
  } else {
    console.log(`\n${colors.yellow}${colors.bold}⚠ NON-CRITICAL SECURITY WARNINGS${colors.reset}`);
    console.log(
      `${colors.yellow}  Review the issues above. Total: ${totalVulnerabilities}${colors.reset}\n`
    );
  }

  // Save report
  const reportDir = path.join(process.cwd(), 'test-results');
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }

  const report = {
    timestamp: new Date().toISOString(),
    environment: isCI() ? 'CI' : 'local',
    scanType: options.quick ? 'quick' : 'full',
    results,
    summary: {
      totalChecks: results.length,
      passed: results.filter((r) => r.passed).length,
      failed: results.filter((r) => !r.passed).length,
      totalVulnerabilities,
      criticalFailed,
    },
  };

  fs.writeFileSync(path.join(reportDir, 'security-scan.json'), JSON.stringify(report, null, 2));

  console.log(`${colors.cyan}Report saved to: test-results/security-scan.json${colors.reset}\n`);

  process.exit(criticalFailed ? 1 : 0);
}

main().catch((err) => {
  console.error(`${colors.red}Fatal error:${colors.reset}`, err);
  process.exit(1);
});
