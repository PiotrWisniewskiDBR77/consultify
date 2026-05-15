#!/usr/bin/env npx tsx
/**
 * IRIS 6.0 Flaky Test Tracker
 *
 * Tracks tests that fail intermittently and manages quarantine
 * Usage: npx tsx scripts/testing/flaky-test-tracker.ts [options]
 */

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
};

interface TestResult {
  testName: string;
  filePath: string;
  status: 'passed' | 'failed' | 'skipped';
  duration: number;
  retries: number;
  timestamp: string;
}

interface FlakyTestEntry {
  testName: string;
  filePath: string;
  firstSeen: string;
  lastSeen: string;
  totalRuns: number;
  failures: number;
  passRate: number;
  quarantined: boolean;
  quarantinedAt?: string;
}

interface FlakyTestRegistry {
  version: string;
  lastUpdated: string;
  tests: FlakyTestEntry[];
}

const REGISTRY_FILE =
  process.env.FLAKY_TRACKER_REGISTRY_PATH?.trim() || 'test-results/flaky-tests.json';
const QUARANTINE_THRESHOLD = 0.7; // 70% pass rate = flaky
const AUTO_QUARANTINE_THRESHOLD = 0.5; // 50% pass rate = auto-quarantine

function loadRegistry(): FlakyTestRegistry {
  const registryPath = path.isAbsolute(REGISTRY_FILE)
    ? REGISTRY_FILE
    : path.join(process.cwd(), REGISTRY_FILE);
  try {
    if (fs.existsSync(registryPath)) {
      return JSON.parse(fs.readFileSync(registryPath, 'utf-8'));
    }
  } catch {
    // Create new registry
  }
  return {
    version: '1.0.0',
    lastUpdated: new Date().toISOString(),
    tests: [],
  };
}

function saveRegistry(registry: FlakyTestRegistry): void {
  const targetPath = path.isAbsolute(REGISTRY_FILE)
    ? REGISTRY_FILE
    : path.join(process.cwd(), REGISTRY_FILE);
  const outputDir = path.dirname(targetPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  registry.lastUpdated = new Date().toISOString();
  fs.writeFileSync(targetPath, JSON.stringify(registry, null, 2));
}

function recordTestResult(registry: FlakyTestRegistry, result: TestResult): void {
  const key = `${result.filePath}::${result.testName}`;
  let entry = registry.tests.find(
    (t) => t.filePath === result.filePath && t.testName === result.testName
  );

  if (!entry) {
    entry = {
      testName: result.testName,
      filePath: result.filePath,
      firstSeen: result.timestamp,
      lastSeen: result.timestamp,
      totalRuns: 0,
      failures: 0,
      passRate: 1,
      quarantined: false,
    };
    registry.tests.push(entry);
  }

  entry.lastSeen = result.timestamp;
  entry.totalRuns++;

  if (result.status === 'failed') {
    entry.failures++;
  }

  // Recalculate pass rate
  entry.passRate = (entry.totalRuns - entry.failures) / entry.totalRuns;

  // Check for auto-quarantine
  if (entry.passRate < AUTO_QUARANTINE_THRESHOLD && entry.totalRuns >= 5 && !entry.quarantined) {
    entry.quarantined = true;
    entry.quarantinedAt = new Date().toISOString();
    console.log(
      `${colors.yellow}⚠ Auto-quarantined: ${result.testName} (${(entry.passRate * 100).toFixed(1)}% pass rate)${colors.reset}`
    );
  }
}

function identifyFlakyTests(registry: FlakyTestRegistry): FlakyTestEntry[] {
  return registry.tests.filter(
    (t) => t.passRate < QUARANTINE_THRESHOLD && t.passRate > 0 && t.totalRuns >= 3
  );
}

function generateReport(registry: FlakyTestRegistry): void {
  console.log(
    `\n${colors.cyan}╔══════════════════════════════════════════════════════════════╗${colors.reset}`
  );
  console.log(
    `${colors.cyan}║${colors.reset}                 ${colors.bold}FLAKY TEST REPORT${colors.reset}                          ${colors.cyan}║${colors.reset}`
  );
  console.log(
    `${colors.cyan}╚══════════════════════════════════════════════════════════════╝${colors.reset}\n`
  );

  const flaky = identifyFlakyTests(registry);
  const quarantined = registry.tests.filter((t) => t.quarantined);
  const stable = registry.tests.filter((t) => t.passRate === 1 && t.totalRuns >= 5);

  console.log(`${colors.bold}Summary:${colors.reset}`);
  console.log(`  Total tracked tests: ${registry.tests.length}`);
  console.log(`  ${colors.yellow}Flaky tests: ${flaky.length}${colors.reset}`);
  console.log(`  ${colors.red}Quarantined: ${quarantined.length}${colors.reset}`);
  console.log(`  ${colors.green}Stable (100% pass, 5+ runs): ${stable.length}${colors.reset}`);

  if (flaky.length > 0) {
    console.log(`\n${colors.bold}${colors.yellow}Flaky Tests (need attention):${colors.reset}`);
    for (const test of flaky.slice(0, 10)) {
      const passPercent = (test.passRate * 100).toFixed(1);
      console.log(`  • ${test.testName}`);
      console.log(`    File: ${test.filePath}`);
      console.log(
        `    Pass Rate: ${passPercent}% (${test.totalRuns - test.failures}/${test.totalRuns})`
      );
    }
    if (flaky.length > 10) {
      console.log(`  ... and ${flaky.length - 10} more`);
    }
  }

  if (quarantined.length > 0) {
    console.log(`\n${colors.bold}${colors.red}Quarantined Tests (skipped in CI):${colors.reset}`);
    for (const test of quarantined.slice(0, 10)) {
      console.log(`  • ${test.testName}`);
      console.log(`    Quarantined: ${test.quarantinedAt}`);
      console.log(`    Pass Rate: ${(test.passRate * 100).toFixed(1)}%`);
    }
  }
}

function quarantineTest(registry: FlakyTestRegistry, filePath: string, testName: string): void {
  const entry = registry.tests.find((t) => t.filePath === filePath && t.testName === testName);

  if (entry) {
    entry.quarantined = true;
    entry.quarantinedAt = new Date().toISOString();
    console.log(`${colors.yellow}✓ Quarantined: ${testName}${colors.reset}`);
  } else {
    console.log(`${colors.red}✗ Test not found in registry${colors.reset}`);
  }
}

function unquarantineTest(registry: FlakyTestRegistry, filePath: string, testName: string): void {
  const entry = registry.tests.find((t) => t.filePath === filePath && t.testName === testName);

  if (entry) {
    entry.quarantined = false;
    entry.quarantinedAt = undefined;
    // Reset stats
    entry.totalRuns = 0;
    entry.failures = 0;
    entry.passRate = 1;
    console.log(`${colors.green}✓ Unquarantined: ${testName}${colors.reset}`);
  } else {
    console.log(`${colors.red}✗ Test not found in registry${colors.reset}`);
  }
}

function parseArgs(): {
  report: boolean;
  quarantine?: string;
  unquarantine?: string;
  record?: string;
  help: boolean;
} {
  const args = process.argv.slice(2);
  return {
    report: args.includes('--report') || args.includes('-r') || args.length === 0,
    quarantine: args.find((a) => a.startsWith('--quarantine='))?.split('=')[1],
    unquarantine: args.find((a) => a.startsWith('--unquarantine='))?.split('=')[1],
    record: args.find((a) => a.startsWith('--record='))?.split('=')[1],
    help: args.includes('--help') || args.includes('-h'),
  };
}

function printHelp(): void {
  console.log(`
${colors.bold}${colors.cyan}╔══════════════════════════════════════════════════════════════╗
║             IRIS 6.0 Flaky Test Tracker                      ║
╚══════════════════════════════════════════════════════════════╝${colors.reset}

${colors.bold}USAGE:${colors.reset}
  npx tsx scripts/testing/flaky-test-tracker.ts [options]

${colors.bold}OPTIONS:${colors.reset}
  --report, -r              Show flaky test report (default)
  --quarantine=<test>       Manually quarantine a test
  --unquarantine=<test>     Remove test from quarantine
  --record=<file>           Record test results from JSON file
  --help, -h                Show this help message

${colors.bold}THRESHOLDS:${colors.reset}
  Flaky: <70% pass rate (over 3+ runs)
  Auto-quarantine: <50% pass rate (over 5+ runs)

${colors.bold}EXAMPLES:${colors.reset}
  npx tsx scripts/testing/flaky-test-tracker.ts --report
  npx tsx scripts/testing/flaky-test-tracker.ts --quarantine="should handle concurrent requests"
`);
}

async function main(): Promise<void> {
  const options = parseArgs();

  if (options.help) {
    printHelp();
    process.exit(0);
  }

  const registry = loadRegistry();

  if (options.quarantine) {
    quarantineTest(registry, '', options.quarantine);
    saveRegistry(registry);
    return;
  }

  if (options.unquarantine) {
    unquarantineTest(registry, '', options.unquarantine);
    saveRegistry(registry);
    return;
  }

  if (options.record) {
    try {
      const results: TestResult[] = JSON.parse(fs.readFileSync(options.record, 'utf-8'));
      for (const result of results) {
        recordTestResult(registry, result);
      }
      saveRegistry(registry);
      console.log(`${colors.green}✓ Recorded ${results.length} test results${colors.reset}`);
    } catch (e) {
      console.log(`${colors.red}✗ Failed to parse test results: ${e}${colors.reset}`);
    }
    return;
  }

  if (options.report) {
    generateReport(registry);
    console.log(`\n${colors.cyan}Registry saved to: ${REGISTRY_FILE}${colors.reset}\n`);
  }
}

main().catch((err) => {
  console.error(`${colors.red}Fatal error:${colors.reset}`, err);
  process.exit(1);
});
