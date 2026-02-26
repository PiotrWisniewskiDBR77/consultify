#!/usr/bin/env npx tsx
/**
 * Test Impact Analysis (MVP)
 *
 * Maps changed source files to test directories that should run.
 * Used in CI to decide between targeted vs full test suites.
 *
 * Usage: npx tsx scripts/testing/test-impact-analysis.ts [--base main] [--json]
 *
 * Output: list of impacted test directories + risk level (low/medium/high).
 * High-risk changes always trigger full suite.
 */

import { execSync } from 'child_process';

interface ImpactResult {
  changedFiles: string[];
  impactedTestDirs: string[];
  riskLevel: 'low' | 'medium' | 'high';
  reason: string;
  runFull: boolean;
}

const HIGH_RISK_PATTERNS = [
  'server/src/middleware/',
  'server/src/routes/auth',
  'server/src/routes/security',
  'server/src/services/billing',
  'server/src/services/accessPolicy',
  'server/src/services/encryption',
  'server/src/utils/security',
  'server/src/config/',
];

const SOURCE_TO_TEST_MAP: Array<{ sourcePattern: RegExp; testDirs: string[]; tag: string }> = [
  { sourcePattern: /^server\/src\/middleware\//, testDirs: ['tests/unit/backend', 'tests/integration', 'tests/security'], tag: '@critical' },
  { sourcePattern: /^server\/src\/routes\//, testDirs: ['tests/integration', 'tests/unit/backend'], tag: '@critical' },
  { sourcePattern: /^server\/src\/controllers\//, testDirs: ['tests/integration', 'tests/unit/backend'], tag: '@critical' },
  { sourcePattern: /^server\/src\/services\//, testDirs: ['tests/unit/backend', 'tests/integration'], tag: '@critical' },
  { sourcePattern: /^server\/src\/services\/ai\//, testDirs: ['tests/unit/backend', 'tests/integration'], tag: '@slow' },
  { sourcePattern: /^src\/components\//, testDirs: ['tests/components'], tag: '@smoke' },
  { sourcePattern: /^src\/views\//, testDirs: ['tests/components'], tag: '@smoke' },
  { sourcePattern: /^src\/store\//, testDirs: ['tests/unit', 'tests/components'], tag: '@smoke' },
  { sourcePattern: /^src\/hooks\//, testDirs: ['tests/unit', 'tests/components'], tag: '@smoke' },
  { sourcePattern: /^src\/services\//, testDirs: ['tests/unit'], tag: '@smoke' },
  { sourcePattern: /^src\/utils\//, testDirs: ['tests/unit'], tag: '@smoke' },
  { sourcePattern: /^server\/src\/services\/billing/, testDirs: ['tests/unit/backend', 'tests/integration', 'tests/security'], tag: '@critical' },
  { sourcePattern: /^(package\.json|package-lock\.json|tsconfig|vite\.config|vitest\.config)/, testDirs: ['tests/unit', 'tests/components', 'tests/integration'], tag: '@critical' },
];

function getChangedFiles(baseBranch: string): string[] {
  try {
    const mergeBase = execSync(`git merge-base ${baseBranch} HEAD`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();

    return execSync(`git diff --name-only --diff-filter=ACMR ${mergeBase}...HEAD`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    })
      .trim()
      .split('\n')
      .filter((f) => f.length > 0);
  } catch {
    return execSync('git diff --cached --name-only --diff-filter=ACMR', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    })
      .trim()
      .split('\n')
      .filter((f) => f.length > 0);
  }
}

function analyze(baseBranch: string): ImpactResult {
  const changedFiles = getChangedFiles(baseBranch);
  const sourceFiles = changedFiles.filter(
    (f) => !f.includes('.test.') && !f.includes('.spec.') && !f.startsWith('tests/')
  );

  const isHighRisk = sourceFiles.some((f) => HIGH_RISK_PATTERNS.some((p) => f.startsWith(p)));

  if (isHighRisk) {
    return {
      changedFiles: sourceFiles,
      impactedTestDirs: ['tests/unit', 'tests/components', 'tests/integration', 'tests/security'],
      riskLevel: 'high',
      reason: 'Changes in high-risk area (auth/security/billing/middleware)',
      runFull: true,
    };
  }

  const impactedDirs = new Set<string>();
  const tags = new Set<string>();

  for (const file of sourceFiles) {
    for (const mapping of SOURCE_TO_TEST_MAP) {
      if (mapping.sourcePattern.test(file)) {
        mapping.testDirs.forEach((d) => impactedDirs.add(d));
        tags.add(mapping.tag);
      }
    }
  }

  if (impactedDirs.size === 0) {
    return {
      changedFiles: sourceFiles,
      impactedTestDirs: ['tests/unit'],
      riskLevel: 'low',
      reason: 'No matching source-to-test mapping; defaulting to unit tests',
      runFull: false,
    };
  }

  const riskLevel = impactedDirs.size >= 3 ? 'medium' : 'low';

  return {
    changedFiles: sourceFiles,
    impactedTestDirs: Array.from(impactedDirs).sort(),
    riskLevel,
    reason: `Matched ${sourceFiles.length} files → ${impactedDirs.size} test directories (tags: ${Array.from(tags).join(', ')})`,
    runFull: false,
  };
}

const argv = process.argv.slice(2);
const isJson = argv.includes('--json');
const baseIdx = argv.indexOf('--base');
const baseBranch = baseIdx >= 0 && argv[baseIdx + 1] ? argv[baseIdx + 1] : 'main';

const result = analyze(baseBranch);

if (isJson) {
  console.log(JSON.stringify(result, null, 2));
} else {
  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║          TEST IMPACT ANALYSIS                ║');
  console.log('╚══════════════════════════════════════════════╝\n');
  console.log(`Base branch: ${baseBranch}`);
  console.log(`Changed source files: ${result.changedFiles.length}`);
  console.log(`Risk level: ${result.riskLevel.toUpperCase()}`);
  console.log(`Run full suite: ${result.runFull ? 'YES' : 'no'}`);
  console.log(`Reason: ${result.reason}`);
  console.log(`\nImpacted test directories:`);
  for (const dir of result.impactedTestDirs) {
    console.log(`  → ${dir}`);
  }
  if (result.changedFiles.length <= 20) {
    console.log(`\nChanged files:`);
    for (const f of result.changedFiles) {
      console.log(`  • ${f}`);
    }
  }
  console.log();
}

process.exit(result.runFull ? 2 : 0);
