#!/usr/bin/env node
/**
 * Skip/Only Gate (L5)
 *
 * Fails CI when:
 * - any `*.only(...)` exists anywhere (unless explicitly allowlisted)
 * - any `*.skip(...)` exists under `tests/e2e/smoke/**` (smoke must be deterministic)
 * - any `*.skip(...)` exists under `tests/unit/**` (unless allowlisted)
 *
 * Also writes an evidence report to `test-results/skip-scan/`.
 *
 * Usage:
 *   node --experimental-strip-types scripts/testing/skip-scan-gate.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { execFileSync } from 'child_process';

type AllowKind = 'skip' | 'only';

type FindingKind = 'skip' | 'only';
type SubjectKind = 'test' | 'it' | 'describe';

interface Finding {
  kind: FindingKind;
  subject: SubjectKind;
  filePath: string;
  line: number;
  column: number;
  snippet: string;
}

interface SkipScanReport {
  generatedAt: string;
  roots: string[];
  totals: {
    filesScanned: number;
    findings: number;
    skip: number;
    only: number;
  };
  breakdown: {
    smoke: { skip: number; only: number };
    unit: { skip: number; only: number };
    other: { skip: number; only: number };
  };
  findings: Finding[];
}

interface AllowlistEntry {
  kind: AllowKind;
  filePattern: string;
  matchPattern?: string;
  reason: string;
  expiresOn: string; // YYYY-MM-DD
}

interface AllowlistFile {
  version: number;
  entries: AllowlistEntry[];
}

const projectRoot = process.cwd();
const allowlistPath = path.resolve(projectRoot, 'scripts/testing/skip-allowlist.json');

const scanRoots = ['tests', 'e2e'];
const outputDir = path.resolve(projectRoot, 'test-results', 'skip-scan');
const reportJsonPath = path.join(outputDir, 'skip-scan.report.json');
const reportMdPath = path.join(outputDir, 'skip-scan.report.md');

// Include extensionless test files like `foo.test` (no .ts/.js suffix).
const supportedExts = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.test', '.spec']);

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function isTestFile(p: string): boolean {
  const ext = path.extname(p).toLowerCase();
  if (!supportedExts.has(ext)) return false;
  const base = path.basename(p);
  if (base.startsWith('.')) return false;
  return true;
}

function listTrackedTestFiles(): string[] {
  // Use git-tracked files only. This avoids scanning editor backups like "foo 2.ts".
  let stdout = '';
  try {
    stdout = execFileSync('git', ['ls-files', '--', ...scanRoots], { encoding: 'utf-8' });
  } catch {
    // Fallback to filesystem scan if git isn't available (should not happen in CI).
    const rootsAbs = scanRoots.map((r) => path.resolve(projectRoot, r));
    const files: string[] = [];
    for (const rootAbs of rootsAbs) {
      if (!fs.existsSync(rootAbs)) continue;
      const stack = [rootAbs];
      while (stack.length > 0) {
        const cur = stack.pop();
        if (!cur) continue;
        let entries: fs.Dirent[];
        try {
          entries = fs.readdirSync(cur, { withFileTypes: true });
        } catch {
          continue;
        }
        for (const e of entries) {
          const abs = path.join(cur, e.name);
          if (e.isDirectory()) stack.push(abs);
          else if (e.isFile() && isTestFile(abs)) files.push(abs);
        }
      }
    }
    return files.map((abs) => path.relative(projectRoot, abs).replace(/\\/g, '/'));
  }

  return stdout
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .filter((rel) => isTestFile(rel));
}

function computeLineColumn(content: string, index: number): { line: number; column: number } {
  const before = content.slice(0, index);
  const line = before.split('\n').length;
  const lastNl = before.lastIndexOf('\n');
  const column = lastNl === -1 ? index + 1 : index - lastNl;
  return { line, column };
}

function makeSnippet(lineText: string, column: number): string {
  const trimmed = lineText.trimEnd();
  const caretPos = Math.max(1, Math.min(column, trimmed.length + 1));
  const caretLine = ' '.repeat(caretPos - 1) + '^';
  return `${trimmed}\n${caretLine}`;
}

function classifyByPath(relPath: string): 'smoke' | 'unit' | 'other' {
  const fp = relPath.replace(/\\/g, '/');
  if (fp.startsWith('tests/e2e/smoke/')) return 'smoke';
  if (fp.startsWith('tests/unit/')) return 'unit';
  return 'other';
}

function runSkipScan(): SkipScanReport {
  const filesRel = listTrackedTestFiles();

  const findings: Finding[] = [];

  const patterns: Array<{ kind: FindingKind; subject: SubjectKind; re: RegExp }> = [
    { kind: 'skip', subject: 'test', re: /\btest\.skip\s*\(/g },
    { kind: 'skip', subject: 'it', re: /\bit\.skip\s*\(/g },
    { kind: 'skip', subject: 'describe', re: /\bdescribe\.skip\s*\(/g },
    { kind: 'only', subject: 'test', re: /\btest\.only\s*\(/g },
    { kind: 'only', subject: 'it', re: /\bit\.only\s*\(/g },
    { kind: 'only', subject: 'describe', re: /\bdescribe\.only\s*\(/g },
  ];

  for (const fileRel of filesRel) {
    const fileAbs = path.resolve(projectRoot, fileRel);
    let content = '';
    try {
      content = fs.readFileSync(fileAbs, 'utf-8');
    } catch {
      continue;
    }

    for (const p of patterns) {
      p.re.lastIndex = 0;
      for (const match of content.matchAll(p.re)) {
        const idx = match.index ?? -1;
        if (idx < 0) continue;
        const { line, column } = computeLineColumn(content, idx);
        const lineText = content.split('\n')[line - 1] || '';
        findings.push({
          kind: p.kind,
          subject: p.subject,
          filePath: fileRel.replace(/\\/g, '/'),
          line,
          column,
          snippet: makeSnippet(lineText, column),
        });
      }
    }
  }

  const breakdown: SkipScanReport['breakdown'] = {
    smoke: { skip: 0, only: 0 },
    unit: { skip: 0, only: 0 },
    other: { skip: 0, only: 0 },
  };
  for (const f of findings) breakdown[classifyByPath(f.filePath)][f.kind] += 1;

  return {
    generatedAt: new Date().toISOString(),
    roots: scanRoots,
    totals: {
      filesScanned: filesRel.length,
      findings: findings.length,
      skip: findings.filter((f) => f.kind === 'skip').length,
      only: findings.filter((f) => f.kind === 'only').length,
    },
    breakdown,
    findings: findings.sort((a, b) => (a.filePath + a.line).localeCompare(b.filePath + b.line)),
  };
}

function writeSkipScanReport(report: SkipScanReport): void {
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(reportJsonPath, JSON.stringify(report, null, 2));

  const md: string[] = [];
  md.push(`# Skip/Only Scan Report`);
  md.push('');
  md.push(`Generated: ${report.generatedAt}`);
  md.push('');
  md.push(`Roots: ${report.roots.join(', ')}`);
  md.push('');
  md.push(`## Totals`);
  md.push(`- Files scanned: ${report.totals.filesScanned}`);
  md.push(`- Findings: ${report.totals.findings}`);
  md.push(`- Skip: ${report.totals.skip}`);
  md.push(`- Only: ${report.totals.only}`);
  md.push('');
  md.push(`## Breakdown`);
  md.push(`- Smoke: skip=${report.breakdown.smoke.skip}, only=${report.breakdown.smoke.only}`);
  md.push(`- Unit: skip=${report.breakdown.unit.skip}, only=${report.breakdown.unit.only}`);
  md.push(`- Other: skip=${report.breakdown.other.skip}, only=${report.breakdown.other.only}`);
  md.push('');
  md.push(`## Findings`);
  if (report.findings.length === 0) md.push(`(none)`);
  else {
    for (const f of report.findings) {
      md.push(`- \`${f.kind}\` \`${f.subject}\` \`${f.filePath}:${f.line}:${f.column}\``);
    }
  }
  md.push('');

  fs.writeFileSync(reportMdPath, md.join('\n'));
}

function loadAllowlist(): AllowlistFile {
  try {
    if (!fs.existsSync(allowlistPath)) return { version: 1, entries: [] };
    const parsed = JSON.parse(fs.readFileSync(allowlistPath, 'utf-8'));
    const entries = Array.isArray(parsed?.entries) ? parsed.entries : [];
    return { version: Number(parsed?.version || 1), entries };
  } catch {
    return { version: 1, entries: [] };
  }
}

function isAllowlisted(finding: Finding, allow: AllowlistEntry, nowIso: string): boolean {
  if (allow.kind !== finding.kind) return false;
  if (!allow.expiresOn || allow.expiresOn < nowIso) return false;

  const fileRe = new RegExp(allow.filePattern);
  if (!fileRe.test(finding.filePath)) return false;

  if (allow.matchPattern) {
    const matchRe = new RegExp(allow.matchPattern);
    if (!matchRe.test(finding.snippet)) return false;
  }

  return true;
}

function bucketForGate(finding: Finding): 'smoke' | 'unit' | 'other' {
  return classifyByPath(finding.filePath);
}

function formatFinding(f: Finding): string {
  return `${f.kind} ${f.subject} ${f.filePath}:${f.line}:${f.column}`;
}

function runGate(report: SkipScanReport): void {
  const allowlist = loadAllowlist();
  const now = todayIsoDate();

  const allowlisted: Finding[] = [];
  const blocked: Finding[] = [];
  const onlyFindings = report.findings.filter((f) => f.kind === 'only');

  for (const f of report.findings) {
    const entry = allowlist.entries.find((a) => isAllowlisted(f, a, now));
    if (entry) allowlisted.push(f);
    else blocked.push(f);
  }

  const blockedOnly = blocked.filter((f) => f.kind === 'only');

  const blockedSmokeSkip = blocked.filter(
    (f) => f.kind === 'skip' && bucketForGate(f) === 'smoke'
  );
  const blockedUnitSkip = blocked.filter((f) => f.kind === 'skip' && bucketForGate(f) === 'unit');

  const fatal: string[] = [];

  if (blockedOnly.length > 0) {
    fatal.push(`Found .only() in repo: ${blockedOnly.length} (must be zero).`);
  }
  if (blockedSmokeSkip.length > 0) {
    fatal.push(`Found .skip() in smoke tests: ${blockedSmokeSkip.length} (must be zero).`);
  }
  if (blockedUnitSkip.length > 0) {
    fatal.push(`Found .skip() in unit tests: ${blockedUnitSkip.length} (must be allowlisted).`);
  }

  const allowlistedCount = allowlisted.length;
  const totalSkips = report.totals.skip;
  const totalOnly = report.totals.only;

  console.log('\n🚦 Skip/Only Gate');
  console.log(`  Findings: skip=${totalSkips}, only=${totalOnly}, allowlisted=${allowlistedCount}`);
  if (allowlistedCount > 0) {
    console.log(`  Allowlist: scripts/testing/skip-allowlist.json (date=${now})`);
  }

  if (fatal.length > 0) {
    console.error(`\n❌ skip-scan gate FAILED (${fatal.length} reasons):`);
    for (const r of fatal) console.error(`  - ${r}`);

    if (blockedOnly.length > 0) {
      console.error('\nBlocked `.only(...)` findings:');
      for (const f of blockedOnly.slice(0, 25)) console.error(`  - ${formatFinding(f)}`);
      if (blockedOnly.length > 25) console.error(`  ... +${blockedOnly.length - 25} more`);
    }

    if (blockedSmokeSkip.length > 0) {
      console.error('\nBlocked smoke `.skip(...)` findings:');
      for (const f of blockedSmokeSkip.slice(0, 25)) console.error(`  - ${formatFinding(f)}`);
      if (blockedSmokeSkip.length > 25) console.error(`  ... +${blockedSmokeSkip.length - 25} more`);
    }

    if (blockedUnitSkip.length > 0) {
      console.error('\nBlocked unit `.skip(...)` findings:');
      for (const f of blockedUnitSkip.slice(0, 25)) console.error(`  - ${formatFinding(f)}`);
      if (blockedUnitSkip.length > 25) console.error(`  ... +${blockedUnitSkip.length - 25} more`);
    }

    process.exit(1);
  }

  // Non-fatal: other skips exist (inventory + evidence)
  const otherSkips = report.findings.filter(
    (f) => f.kind === 'skip' && bucketForGate(f) === 'other'
  );
  if (otherSkips.length > 0) {
    console.warn(`\n⚠️  Non-blocking skips found outside smoke/unit: ${otherSkips.length}`);
    console.warn('   (Inventory only — consider paying down over time.)');
  }

  console.log('\n✅ skip-scan gate OK.\n');
}

const report = runSkipScan();
writeSkipScanReport(report);
runGate(report);
