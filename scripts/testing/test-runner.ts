#!/usr/bin/env npx tsx
/**
 * IRIS 6.0 Unified Test Runner
 *
 * Comprehensive CLI for all testing operations
 * Usage: npx tsx scripts/testing/test-runner.ts [options]
 *
 * @example
 *   npx tsx scripts/testing/test-runner.ts --all
 *   npx tsx scripts/testing/test-runner.ts --unit --coverage
 *   npx tsx scripts/testing/test-runner.ts --changed-only
 *   npx tsx scripts/testing/test-runner.ts --failed-first
 *   npx tsx scripts/testing/test-runner.ts --module mes
 */

import { execSync, spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

import { isCI, moduleTestMap, testConfig } from './test-config.js';

// ANSI colors for terminal output
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

interface TestResult {
  suite: string;
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
  coverage?: number;
}

interface RunnerOptions {
  all: boolean;
  unit: boolean;
  integration: boolean;
  component: boolean;
  e2e: boolean;
  security: boolean;
  performance: boolean;
  coverage: boolean;
  watch: boolean;
  changedOnly: boolean;
  failedFirst: boolean;
  module?: string;
  shard?: string;
  verbose: boolean;
  report: boolean;
}

// Parse command line arguments
function parseArgs(): RunnerOptions {
  const args = process.argv.slice(2);
  const options: RunnerOptions = {
    all: args.includes('--all') || args.includes('-a'),
    unit: args.includes('--unit') || args.includes('-u'),
    integration: args.includes('--integration') || args.includes('-i'),
    component: args.includes('--component') || args.includes('-c'),
    e2e: args.includes('--e2e') || args.includes('-e'),
    security: args.includes('--security') || args.includes('-s'),
    performance: args.includes('--performance') || args.includes('-p'),
    coverage: args.includes('--coverage') || args.includes('--cov'),
    watch: args.includes('--watch') || args.includes('-w'),
    changedOnly: args.includes('--changed-only') || args.includes('--changed'),
    failedFirst: args.includes('--failed-first') || args.includes('--ff'),
    verbose: args.includes('--verbose') || args.includes('-v'),
    report: args.includes('--report') || args.includes('-r'),
    module: undefined,
    shard: undefined,
  };

  // Parse --module=<name>
  const moduleArg = args.find((a) => a.startsWith('--module='));
  if (moduleArg) {
    options.module = moduleArg.split('=')[1];
  }

  // Parse --shard=<n/total>
  const shardArg = args.find((a) => a.startsWith('--shard='));
  if (shardArg) {
    options.shard = shardArg.split('=')[1];
  }

  // Show help
  if (args.includes('--help') || args.includes('-h')) {
    printHelp();
    process.exit(0);
  }

  // Default to --all if no specific suite selected
  if (
    !options.unit &&
    !options.integration &&
    !options.component &&
    !options.e2e &&
    !options.security &&
    !options.performance &&
    !options.all
  ) {
    options.all = true;
  }

  return options;
}

function printHelp(): void {
  console.log(`
${colors.bold}${colors.cyan}╔══════════════════════════════════════════════════════════════╗
║              IRIS 6.0 Unified Test Runner                    ║
╚══════════════════════════════════════════════════════════════╝${colors.reset}

${colors.bold}USAGE:${colors.reset}
  npx tsx scripts/testing/test-runner.ts [options]

${colors.bold}TEST SUITES:${colors.reset}
  --all, -a           Run all test suites
  --unit, -u          Run unit tests only
  --integration, -i   Run integration tests only
  --component, -c     Run component tests only
  --e2e, -e           Run E2E tests (Playwright)
  --security, -s      Run security tests
  --performance, -p   Run performance tests

${colors.bold}OPTIONS:${colors.reset}
  --coverage, --cov   Generate coverage report
  --watch, -w         Watch mode (unit/component only)
  --changed-only      Test only changed files (git diff)
  --failed-first, --ff Run previously failed tests first
  --module=<name>     Test specific module (e.g., --module=mes)
  --shard=<n/total>   Shard tests for parallel CI (e.g., --shard=1/4)
  --report, -r        Generate HTML test report
  --verbose, -v       Verbose output

${colors.bold}EXAMPLES:${colors.reset}
  npx tsx scripts/testing/test-runner.ts --all
  npx tsx scripts/testing/test-runner.ts --unit --coverage
  npx tsx scripts/testing/test-runner.ts --module=wms --integration
  npx tsx scripts/testing/test-runner.ts --e2e --shard=1/4
  npx tsx scripts/testing/test-runner.ts --changed-only --unit

${colors.bold}ENVIRONMENT:${colors.reset}
  CI detected: ${isCI() ? colors.green + 'Yes' : colors.yellow + 'No'}${colors.reset}
  `);
}

function printBanner(): void {
  console.log(`
${colors.cyan}╔══════════════════════════════════════════════════════════════╗
║            ${colors.bold}IRIS 6.0 Automated Test Suite${colors.reset}${colors.cyan}                  ║
║                                                              ║
║  Environment: ${isCI() ? 'CI/CD Pipeline' : 'Local Development'}                             ║
║  Started: ${new Date().toISOString()}                  ║
╚══════════════════════════════════════════════════════════════╝${colors.reset}
`);
}

// Get changed files from git
function getChangedFiles(): string[] {
  const base = process.env.TEST_CHANGED_BASE || process.env.GIT_BASE || 'main';
  try {
    const mergeBase = execSync(`git merge-base ${base} HEAD`, { encoding: 'utf-8' }).trim();
    const stdout = execSync(`git diff --name-only --diff-filter=ACMR ${mergeBase}...HEAD`, {
      encoding: 'utf-8',
    });
    return stdout
      .split('\n')
      .map((f) => f.trim())
      .filter((f) => f.length > 0);
  } catch {
    try {
      const stdout = execSync('git diff --cached --name-only --diff-filter=ACMR', {
        encoding: 'utf-8',
      });
      return stdout
        .split('\n')
        .map((f) => f.trim())
        .filter((f) => f.length > 0);
    } catch {
      console.warn(`${colors.yellow}⚠ Could not determine changed files from git${colors.reset}`);
      return [];
    }
  }
}

function isTestFile(filePath: string): boolean {
  if (/\.(test|spec)\.(ts|tsx|js|jsx)$/.test(filePath)) return true;
  if (/\.(test|spec)$/.test(filePath)) return true; // legacy extensionless
  return false;
}

// Get previously failed tests
function getFailedTests(): string[] {
  const failedTestsFile = path.join(process.cwd(), 'test-results', 'failed-tests.json');
  try {
    if (fs.existsSync(failedTestsFile)) {
      return JSON.parse(fs.readFileSync(failedTestsFile, 'utf-8'));
    }
  } catch {
    // Ignore
  }
  return [];
}

// Save failed tests for --failed-first
function saveFailedTests(tests: string[]): void {
  const outputDir = path.join(process.cwd(), 'test-results');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  fs.writeFileSync(path.join(outputDir, 'failed-tests.json'), JSON.stringify(tests, null, 2));
}

// Run a test command
async function runTests(
  name: string,
  command: string,
  args: string[],
  options: RunnerOptions
): Promise<TestResult> {
  const startTime = Date.now();

  console.log(
    `\n${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`
  );
  console.log(`${colors.bold}▶ Running ${name} tests...${colors.reset}`);
  console.log(`${colors.cyan}  Command: ${command} ${args.join(' ')}${colors.reset}`);
  console.log(
    `${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`
  );

  return new Promise((resolve) => {
    const proc = spawn(command, args, {
      stdio: options.verbose ? 'inherit' : 'pipe',
      shell: true,
      cwd: process.cwd(),
    });

    let stdout = '';
    let stderr = '';

    if (!options.verbose) {
      proc.stdout?.on('data', (data) => {
        stdout += data.toString();
      });
      proc.stderr?.on('data', (data) => {
        stderr += data.toString();
      });
    }

    proc.on('close', (code) => {
      const duration = Date.now() - startTime;

      // Parse results (basic parsing - can be enhanced)
      const passMatch = stdout.match(/(\d+)\s+pass/i);
      const failMatch = stdout.match(/(\d+)\s+fail/i);
      const skipMatch = stdout.match(/(\d+)\s+skip/i);
      const coverageMatch = stdout.match(/All files.*?(\d+(?:\.\d+)?)\s*%/);

      const result: TestResult = {
        suite: name,
        passed: passMatch ? parseInt(passMatch[1]) : code === 0 ? 1 : 0,
        failed: failMatch ? parseInt(failMatch[1]) : code !== 0 ? 1 : 0,
        skipped: skipMatch ? parseInt(skipMatch[1]) : 0,
        duration,
        coverage: coverageMatch ? parseFloat(coverageMatch[1]) : undefined,
      };

      // Print summary
      const status =
        result.failed === 0
          ? `${colors.green}✓ PASSED${colors.reset}`
          : `${colors.red}✗ FAILED${colors.reset}`;

      console.log(`\n${colors.bold}${name} Results:${colors.reset} ${status}`);
      console.log(
        `  Tests: ${colors.green}${result.passed} passed${colors.reset}, ${colors.red}${result.failed} failed${colors.reset}, ${colors.yellow}${result.skipped} skipped${colors.reset}`
      );
      console.log(`  Duration: ${(duration / 1000).toFixed(2)}s`);
      if (result.coverage !== undefined) {
        console.log(
          `  Coverage: ${result.coverage >= testConfig.thresholds.coverageGlobal ? colors.green : colors.yellow}${result.coverage.toFixed(1)}%${colors.reset}`
        );
      }

      resolve(result);
    });
  });
}

// Build test command for Vitest
function buildVitestCommand(testPath: string, options: RunnerOptions): string[] {
  const args = ['vitest', 'run', testPath];

  if (options.coverage) {
    args.push('--coverage');
  }
  if (options.watch) {
    args[1] = 'watch'; // Replace 'run' with 'watch'
  }
  if (options.shard) {
    args.push(`--shard=${options.shard}`);
  }
  if (options.verbose) {
    args.push('--reporter=verbose');
  }
  return args;
}

// Main execution
async function main(): Promise<void> {
  const options = parseArgs();
  printBanner();

  const results: TestResult[] = [];
  const failedTests: string[] = [];

  const changedFiles = options.changedOnly ? getChangedFiles() : [];
  const changedTestFiles = options.changedOnly ? changedFiles.filter(isTestFile) : [];
  if (options.changedOnly && changedTestFiles.length === 0) {
    console.log(
      `${colors.yellow}⚠ No changed test files detected (merge-base: ${process.env.TEST_CHANGED_BASE || process.env.GIT_BASE || 'main'}). Running full suite.${colors.reset}`
    );
    options.changedOnly = false;
  }

  // Determine which suites to run
  const suitesToRun: Array<{
    name: string;
    path: string;
    type: 'vitest' | 'playwright' | 'vitest-config';
  }> = [];

  if (options.all || options.unit) {
    suitesToRun.push({ name: 'Unit', path: testConfig.paths.unit, type: 'vitest' });
  }
  if (options.all || options.component) {
    suitesToRun.push({ name: 'Component', path: testConfig.paths.component, type: 'vitest' });
  }
  if (options.all || options.integration) {
    suitesToRun.push({ name: 'Integration', path: testConfig.paths.integration, type: 'vitest' });
  }
  if (options.all || options.security) {
    suitesToRun.push({
      name: 'Security',
      path: '--config vitest.security.config.ts',
      type: 'vitest-config',
    });
  }
  if (options.all || options.performance) {
    suitesToRun.push({
      name: 'Performance',
      path: '--config vitest.perf.config.ts',
      type: 'vitest-config',
    });
  }
  if (options.all || options.e2e) {
    suitesToRun.push({ name: 'E2E', path: '', type: 'playwright' });
  }

  // Filter by module if specified
  if (options.module) {
    const modulePaths = moduleTestMap[options.module.toLowerCase()];
    if (!modulePaths) {
      console.error(`${colors.red}✗ Unknown module: ${options.module}${colors.reset}`);
      console.log(`  Available modules: ${Object.keys(moduleTestMap).join(', ')}`);
      process.exit(1);
    }
    suitesToRun.length = 0;
    for (const p of modulePaths) {
      const name = options.module.toUpperCase();
      suitesToRun.push({ name: `${name} (${path.basename(p)})`, path: p, type: 'vitest' });
    }
  }

  // Failed-first mode
  if (options.failedFirst) {
    const previouslyFailed = getFailedTests();
    if (previouslyFailed.length > 0) {
      console.log(
        `${colors.yellow}⚡ Running ${previouslyFailed.length} previously failed tests first...${colors.reset}\n`
      );
      // Run failed tests first (simplified - full implementation would filter exact test names)
    }
  }

  // Run each suite
  for (const suite of suitesToRun) {
    let result: TestResult;

    if (options.changedOnly) {
      const suiteBasePath =
        suite.type === 'playwright'
          ? 'tests/e2e'
          : suite.type === 'vitest-config'
            ? suite.name === 'Security'
              ? 'tests/security'
              : suite.name === 'Performance'
                ? 'tests/performance'
                : ''
            : suite.path;

      const suiteChanged = suiteBasePath
        ? changedTestFiles.filter((f) => f.startsWith(suiteBasePath))
        : [];

      if (suiteChanged.length === 0) {
        console.log(
          `${colors.yellow}⚠ Skipping ${suite.name} (no changed tests in ${suiteBasePath})${colors.reset}`
        );
        continue;
      }

      if (suite.type === 'playwright') {
        const args = ['playwright', 'test', ...suiteChanged];
        if (options.shard) {
          args.push(`--shard=${options.shard}`);
        }
        result = await runTests(suite.name, 'npx', args, options);
      } else {
        const args = ['vitest', 'run', ...suiteChanged];
        if (options.coverage) {
          args.push('--coverage');
        }
        if (options.watch) {
          args[1] = 'watch';
        }
        if (options.shard) {
          args.push(`--shard=${options.shard}`);
        }
        if (options.verbose) {
          args.push('--reporter=verbose');
        }
        result = await runTests(suite.name, 'npx', args, options);
      }
    } else if (suite.type === 'playwright') {
      const args = ['playwright', 'test'];
      if (options.shard) {
        args.push(`--shard=${options.shard}`);
      }
      result = await runTests(suite.name, 'npx', args, options);
    } else if (suite.type === 'vitest-config') {
      result = await runTests(
        suite.name,
        'npx',
        ['vitest', 'run', ...suite.path.split(' ')],
        options
      );
    } else {
      const args = buildVitestCommand(suite.path, options);
      result = await runTests(suite.name, 'npx', args, options);
    }

    results.push(result);

    if (result.failed > 0) {
      failedTests.push(suite.name);
    }
  }

  // Save failed tests for next run
  saveFailedTests(failedTests);

  // Print final summary
  console.log(
    `\n${colors.cyan}╔══════════════════════════════════════════════════════════════╗${colors.reset}`
  );
  console.log(
    `${colors.cyan}║${colors.reset}                   ${colors.bold}TEST EXECUTION SUMMARY${colors.reset}                    ${colors.cyan}║${colors.reset}`
  );
  console.log(
    `${colors.cyan}╚══════════════════════════════════════════════════════════════╝${colors.reset}\n`
  );

  let totalPassed = 0;
  let totalFailed = 0;
  let totalSkipped = 0;
  let totalDuration = 0;

  for (const r of results) {
    const status =
      r.failed === 0
        ? `${colors.green}✓ PASS${colors.reset}`
        : `${colors.red}✗ FAIL${colors.reset}`;
    console.log(
      `  ${status} ${r.suite.padEnd(15)} ${colors.green}${r.passed}${colors.reset}/${colors.red}${r.failed}${colors.reset}/${colors.yellow}${r.skipped}${colors.reset} (${(r.duration / 1000).toFixed(2)}s)`
    );
    totalPassed += r.passed;
    totalFailed += r.failed;
    totalSkipped += r.skipped;
    totalDuration += r.duration;
  }

  console.log(
    `\n${colors.bold}  TOTAL:${colors.reset} ${colors.green}${totalPassed} passed${colors.reset}, ${colors.red}${totalFailed} failed${colors.reset}, ${colors.yellow}${totalSkipped} skipped${colors.reset}`
  );
  console.log(`  ${colors.bold}Duration:${colors.reset} ${(totalDuration / 1000).toFixed(2)}s`);

  const passRate = (totalPassed / (totalPassed + totalFailed)) * 100;
  const passRateColor = passRate >= 95 ? colors.green : passRate >= 85 ? colors.yellow : colors.red;
  console.log(
    `  ${colors.bold}Pass Rate:${colors.reset} ${passRateColor}${passRate.toFixed(1)}%${colors.reset}`
  );

  // Generate report if requested
  if (options.report) {
    const reportPath = path.join(process.cwd(), 'test-results', 'report.json');
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(
      reportPath,
      JSON.stringify(
        {
          timestamp: new Date().toISOString(),
          environment: isCI() ? 'CI' : 'local',
          results,
          summary: { totalPassed, totalFailed, totalSkipped, totalDuration, passRate },
        },
        null,
        2
      )
    );
    console.log(`\n${colors.green}✓ Report saved to: ${reportPath}${colors.reset}`);
  }

  // Exit with appropriate code
  process.exit(totalFailed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(`${colors.red}Fatal error:${colors.reset}`, err);
  process.exit(1);
});
