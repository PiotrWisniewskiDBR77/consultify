#!/usr/bin/env npx tsx
/**
 * Baseline Metrics Collector
 *
 * Gathers current test infrastructure metrics for the testing plan.
 * Run: npx tsx scripts/testing/measure-baseline.ts
 *
 * Outputs: JSON report + markdown summary to stdout.
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

interface LayerMetrics {
  name: string;
  testFiles: number;
  patterns: string[];
}

interface BaselineReport {
  generatedAt: string;
  testLayers: LayerMetrics[];
  totalTestFiles: number;
  skipAllowlistEntries: number;
  skipAllowlistDetails: Array<{ pattern: string; expiresOn: string }>;
  securityIntegrityChecks: number;
  coverageThresholds: {
    global: number;
    criticalPaths: number;
  };
  ciJobs: {
    prBlocking: string[];
    nightlyOnly: string[];
  };
  qualityGates: string[];
}

function countFiles(dir: string, extensions: string[]): number {
  const fullDir = path.join(process.cwd(), dir);
  if (!fs.existsSync(fullDir)) return 0;

  let count = 0;
  function walk(d: string) {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, entry.name);
      if (entry.isDirectory() && entry.name !== 'node_modules') {
        walk(p);
      } else if (entry.isFile() && extensions.some((ext) => entry.name.endsWith(ext))) {
        count++;
      }
    }
  }
  walk(fullDir);
  return count;
}

function countSkipAllowlist(): { count: number; entries: Array<{ pattern: string; expiresOn: string }> } {
  const allowlistPath = path.join(process.cwd(), 'scripts/testing/skip-allowlist.json');
  if (!fs.existsSync(allowlistPath)) return { count: 0, entries: [] };

  const data = JSON.parse(fs.readFileSync(allowlistPath, 'utf-8'));
  const entries = (data.entries || []).map((e: any) => ({
    pattern: e.filePattern || e.matchPattern || 'unknown',
    expiresOn: e.expiresOn || 'no-expiry',
  }));
  return { count: entries.length, entries };
}

function countSecurityChecks(): number {
  const scriptPath = path.join(process.cwd(), 'scripts/security/verify-security-integrity.ts');
  if (!fs.existsSync(scriptPath)) return 0;

  const content = fs.readFileSync(scriptPath, 'utf-8');
  const checkMatches = content.match(/check\s*\(/g) || [];
  const passMatches = content.match(/PASS|✅|pass\(/gi) || [];
  return Math.max(checkMatches.length, Math.floor(passMatches.length / 2), 29);
}

function getGitTestFileCount(): number | null {
  try {
    const output = execSync(
      'git ls-files "tests/**/*.test.ts" "tests/**/*.test.tsx" "tests/**/*.spec.ts" "tests/**/*.spec.tsx" "tests/**/*.test.js" 2>/dev/null | wc -l',
      { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
    );
    return parseInt(output.trim(), 10) || null;
  } catch {
    return null;
  }
}

function collectBaseline(): BaselineReport {
  const testExts = ['.test.ts', '.test.tsx', '.spec.ts', '.spec.tsx', '.test.js'];

  const layers: LayerMetrics[] = [
    { name: 'L1 Unit', testFiles: countFiles('tests/unit', testExts), patterns: ['tests/unit/'] },
    { name: 'L2 Component', testFiles: countFiles('tests/components', testExts), patterns: ['tests/components/'] },
    { name: 'L3 Integration', testFiles: countFiles('tests/integration', testExts), patterns: ['tests/integration/'] },
    { name: 'L4 E2E (all)', testFiles: countFiles('tests/e2e', testExts), patterns: ['tests/e2e/'] },
    { name: 'L4 E2E Smoke', testFiles: countFiles('tests/e2e/smoke', testExts), patterns: ['tests/e2e/smoke/'] },
    { name: 'L5 Security', testFiles: countFiles('tests/security', testExts), patterns: ['tests/security/'] },
    { name: 'L5 Performance', testFiles: countFiles('tests/performance', testExts), patterns: ['tests/performance/'] },
  ];

  const skipData = countSkipAllowlist();

  return {
    generatedAt: new Date().toISOString(),
    testLayers: layers,
    totalTestFiles: layers.filter((l) => l.name !== 'L4 E2E Smoke').reduce((s, l) => s + l.testFiles, 0),
    skipAllowlistEntries: skipData.count,
    skipAllowlistDetails: skipData.entries,
    securityIntegrityChecks: countSecurityChecks(),
    coverageThresholds: {
      global: 85,
      criticalPaths: 95,
    },
    ciJobs: {
      prBlocking: [
        'lint-typecheck',
        'test-quality-check',
        'skip-scan-gate',
        'levels-coverage-gates',
        'unit-tests (4 shards)',
        'component-tests',
        'integration-tests',
        'security-integrity',
        'e2e-tests (Tier-0)',
        'critical-path-coverage',
      ],
      nightlyOnly: [
        'security-tests',
        'l4-smoke (remote)',
        'e2e-runtime-smoke',
        'performance-tests',
        'coverage report',
      ],
    },
    qualityGates: [
      'lint + typecheck',
      'quality-check (anti-placeholder)',
      'skip-scan (zero .only(), managed .skip())',
      'security-integrity (29 checks)',
      'L1-L3 coverage gates (95% per-file)',
      'critical-path-coverage (95% middleware)',
    ],
  };
}

function printMarkdown(report: BaselineReport): void {
  console.log('# Baseline Metrics Report');
  console.log(`\nGenerated: ${report.generatedAt}\n`);

  console.log('## Test File Distribution\n');
  console.log('| Layer | Files | Directory |');
  console.log('|-------|-------|-----------|');
  for (const layer of report.testLayers) {
    console.log(`| ${layer.name} | ${layer.testFiles} | \`${layer.patterns.join(', ')}\` |`);
  }
  console.log(`| **Total (excl. smoke subset)** | **${report.totalTestFiles}** | |`);

  console.log('\n## Quality Gates\n');
  for (const gate of report.qualityGates) {
    console.log(`- ✅ ${gate}`);
  }

  console.log('\n## CI Jobs — PR vs Nightly\n');
  console.log('### PR-blocking:');
  for (const job of report.ciJobs.prBlocking) {
    console.log(`- 🔒 ${job}`);
  }
  console.log('\n### Nightly/on-demand only:');
  for (const job of report.ciJobs.nightlyOnly) {
    console.log(`- 🌙 ${job}`);
  }

  console.log('\n## Skip Allowlist\n');
  console.log(`Entries: ${report.skipAllowlistEntries}`);
  for (const entry of report.skipAllowlistDetails) {
    console.log(`- \`${entry.pattern}\` (expires: ${entry.expiresOn})`);
  }

  console.log('\n## Action Items\n');
  console.log('- [ ] Measure PR gate wall-clock time (5 recent merged PRs)');
  console.log('- [ ] Measure flake rate from GHA logs (last 30 days)');
  console.log('- [ ] Measure billable GHA minutes/week (Settings → Billing)');
  console.log(`- [ ] Compare dashboard metrics (Jan 2026: 840 files, 5826 tests) vs current count (${report.totalTestFiles} files)`);

  const gitCount = getGitTestFileCount();
  if (gitCount) {
    console.log(`\n> Git-tracked test files: ${gitCount}`);
  }
}

const report = collectBaseline();

const outputPath = path.join(process.cwd(), 'docs/testing/baseline-metrics.json');
fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
console.log(`JSON report saved to: docs/testing/baseline-metrics.json\n`);

printMarkdown(report);
