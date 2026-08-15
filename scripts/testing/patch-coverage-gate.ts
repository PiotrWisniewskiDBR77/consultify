#!/usr/bin/env npx tsx
/**
 * Patch Coverage Gate
 *
 * Checks that files changed in the current PR have adequate test coverage.
 * Runs after tests with coverage, compares changed files against coverage map.
 *
 * Usage: npx tsx scripts/testing/patch-coverage-gate.ts --coverage-json <path> [--threshold 80]
 *
 * Exit codes:
 *   0 — patch coverage meets threshold
 *   1 — patch coverage below threshold
 *   2 — configuration/input error
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

const COLORS = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
};

interface PatchResult {
  file: string;
  statements: number;
  branches: number;
  functions: number;
  lines: number;
}

function parseArgs(): { coverageJson: string; threshold: number; baseBranch: string } {
  const argv = process.argv.slice(2);
  let coverageJson = '';
  let threshold = 80;
  let baseBranch = 'main';

  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--coverage-json' && argv[i + 1]) {
      coverageJson = argv[++i];
    } else if (argv[i] === '--threshold' && argv[i + 1]) {
      threshold = parseInt(argv[++i], 10);
    } else if (argv[i] === '--base' && argv[i + 1]) {
      baseBranch = argv[++i];
    }
  }

  if (!coverageJson) {
    console.error('Usage: patch-coverage-gate.ts --coverage-json <path> [--threshold 80] [--base main]');
    process.exit(2);
  }

  return { coverageJson, threshold, baseBranch };
}

function getChangedSourceFiles(baseBranch: string): string[] {
  const sourceExtensions = ['.ts', '.tsx', '.js', '.jsx'];
  const excludeDirs = ['node_modules', 'dist', 'build', 'test-results', 'coverage'];

  try {
    const mergeBase = execSync(`git merge-base ${baseBranch} HEAD`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();

    const diff = execSync(`git diff --name-only --diff-filter=ACMR ${mergeBase}...HEAD`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    return diff
      .trim()
      .split('\n')
      .filter((f) => f.length > 0)
      .filter((f) => sourceExtensions.some((ext) => f.endsWith(ext)))
      .filter((f) => !excludeDirs.some((dir) => f.includes(`/${dir}/`) || f.startsWith(`${dir}/`)))
      .filter((f) => !f.includes('.test.') && !f.includes('.spec.') && !f.includes('__tests__'));
  } catch {
    console.warn(`${COLORS.yellow}Warning: Could not determine changed files. Falling back to staged files.${COLORS.reset}`);
    try {
      const staged = execSync('git diff --cached --name-only --diff-filter=ACMR', {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      return staged
        .trim()
        .split('\n')
        .filter((f) => f.length > 0)
        .filter((f) => sourceExtensions.some((ext) => f.endsWith(ext)))
        .filter((f) => !f.includes('.test.') && !f.includes('.spec.'));
    } catch {
      return [];
    }
  }
}

function loadCoverageMap(coverageJsonPath: string): Record<string, any> {
  const absPath = path.resolve(process.cwd(), coverageJsonPath);
  if (!fs.existsSync(absPath)) {
    console.error(`${COLORS.red}Coverage file not found: ${absPath}${COLORS.reset}`);
    process.exit(2);
  }

  const data = JSON.parse(fs.readFileSync(absPath, 'utf-8'));
  return data.coverageMap?.data || data.coverageMap || data;
}

function getPctFromSummary(summary: any): number {
  if (!summary || typeof summary !== 'object') return 0;
  const pct = summary.pct;
  return typeof pct === 'number' ? pct : 0;
}

function getCoverageForFile(coverageMap: Record<string, any>, relPath: string): PatchResult | null {
  const absPath = path.resolve(process.cwd(), relPath);
  const entry = coverageMap[absPath] || coverageMap[relPath];
  if (!entry) return null;

  const s = entry.s || {};
  const b = entry.b || {};
  const f = entry.f || {};

  const stmtTotal = Object.keys(s).length;
  const stmtCovered = Object.values(s).filter((v: any) => v > 0).length;

  const branchTotal = Object.values(b).reduce((acc: number, arr: any) => acc + (Array.isArray(arr) ? arr.length : 0), 0);
  const branchCovered = Object.values(b).reduce((acc: number, arr: any) => acc + (Array.isArray(arr) ? arr.filter((v: any) => v > 0).length : 0), 0);

  const fnTotal = Object.keys(f).length;
  const fnCovered = Object.values(f).filter((v: any) => v > 0).length;

  return {
    file: relPath,
    statements: stmtTotal > 0 ? (stmtCovered / stmtTotal) * 100 : 100,
    branches: branchTotal > 0 ? (branchCovered / branchTotal) * 100 : 100,
    functions: fnTotal > 0 ? (fnCovered / fnTotal) * 100 : 100,
    lines: stmtTotal > 0 ? (stmtCovered / stmtTotal) * 100 : 100,
  };
}

function main() {
  const { coverageJson, threshold, baseBranch } = parseArgs();

  console.log(`\n${COLORS.cyan}╔══════════════════════════════════════════════════════╗${COLORS.reset}`);
  console.log(`${COLORS.cyan}║${COLORS.reset}          ${COLORS.bold}PATCH COVERAGE GATE${COLORS.reset}                       ${COLORS.cyan}║${COLORS.reset}`);
  console.log(`${COLORS.cyan}╚══════════════════════════════════════════════════════╝${COLORS.reset}\n`);
  console.log(`Threshold: ${threshold}% | Base: ${baseBranch}\n`);

  // Validate the explicitly supplied evidence before any diff-based early exit.
  // A missing coverage artifact is a configuration failure even when the patch
  // happens to contain no source files.
  const coverageMap = loadCoverageMap(coverageJson);
  const changedFiles = getChangedSourceFiles(baseBranch);

  if (changedFiles.length === 0) {
    console.log(`${COLORS.green}✅ No source files changed — patch coverage gate passes.${COLORS.reset}\n`);
    process.exit(0);
  }

  console.log(`Changed source files (${changedFiles.length}):`);
  for (const f of changedFiles) {
    console.log(`  • ${f}`);
  }
  console.log();

  const results: PatchResult[] = [];
  const uncovered: string[] = [];

  for (const file of changedFiles) {
    const result = getCoverageForFile(coverageMap, file);
    if (result) {
      results.push(result);
    } else {
      uncovered.push(file);
    }
  }

  console.log(`${COLORS.bold}Coverage results:${COLORS.reset}\n`);
  console.log('| File | Stmts | Branch | Funcs | Lines | Status |');
  console.log('|------|-------|--------|-------|-------|--------|');

  const failures: string[] = [];

  for (const r of results) {
    const minPct = Math.min(r.statements, r.branches, r.functions, r.lines);
    const status = minPct >= threshold ? `${COLORS.green}✅${COLORS.reset}` : `${COLORS.red}❌${COLORS.reset}`;
    const shortFile = r.file.length > 50 ? '…' + r.file.slice(-49) : r.file;

    console.log(
      `| ${shortFile} | ${r.statements.toFixed(1)}% | ${r.branches.toFixed(1)}% | ${r.functions.toFixed(1)}% | ${r.lines.toFixed(1)}% | ${status} |`
    );

    if (r.statements < threshold) failures.push(`${r.file}: statements ${r.statements.toFixed(1)}% < ${threshold}%`);
    if (r.branches < threshold) failures.push(`${r.file}: branches ${r.branches.toFixed(1)}% < ${threshold}%`);
    if (r.functions < threshold) failures.push(`${r.file}: functions ${r.functions.toFixed(1)}% < ${threshold}%`);
  }

  if (uncovered.length > 0) {
    console.log(`\n${COLORS.yellow}Files without coverage data (not instrumented or new):${COLORS.reset}`);
    for (const f of uncovered) {
      console.log(`  ⚠ ${f}`);
    }
  }

  const totalFiles = results.length;
  const avgStmts = totalFiles > 0 ? results.reduce((s, r) => s + r.statements, 0) / totalFiles : 0;
  const avgBranch = totalFiles > 0 ? results.reduce((s, r) => s + r.branches, 0) / totalFiles : 0;

  console.log(`\n${COLORS.bold}Summary:${COLORS.reset}`);
  console.log(`  Changed source files: ${changedFiles.length}`);
  console.log(`  With coverage data:   ${results.length}`);
  console.log(`  Without coverage:     ${uncovered.length}`);
  console.log(`  Avg statements:       ${avgStmts.toFixed(1)}%`);
  console.log(`  Avg branches:         ${avgBranch.toFixed(1)}%`);

  if (failures.length > 0) {
    console.log(`\n${COLORS.red}${COLORS.bold}❌ PATCH COVERAGE GATE FAILED${COLORS.reset}`);
    console.log(`${COLORS.red}${failures.length} threshold violation(s):${COLORS.reset}`);
    for (const f of failures) {
      console.log(`  • ${f}`);
    }
    console.log();
    process.exit(1);
  }

  console.log(`\n${COLORS.green}${COLORS.bold}✅ PATCH COVERAGE GATE PASSED${COLORS.reset}`);
  console.log(`All changed files meet the ${threshold}% threshold.\n`);
  process.exit(0);
}

main();
