#!/usr/bin/env node
/**
 * JUnit Flaky Report
 *
 * Generates a summary + flaky indicators from JUnit XML files.
 * Usage:
 *   node --experimental-strip-types scripts/testing/junit-flaky-report.ts --dir test-artifacts --out test-results/flaky-report
 */

import * as fs from 'fs';
import * as path from 'path';

type FlakyTestcase = {
  file: string;
  suite?: string;
  name?: string;
  classname?: string;
  time?: string;
  reason: string;
};

type SuiteSummary = {
  file: string;
  name?: string;
  tests: number;
  failures: number;
  errors: number;
  skipped: number;
  time?: string;
};

function parseArgs(): { dir: string; out: string } {
  const args = process.argv.slice(2);
  const get = (flag: string, fallback: string) => {
    const idx = args.indexOf(flag);
    if (idx === -1 || idx + 1 >= args.length) return fallback;
    return args[idx + 1];
  };
  return {
    dir: get('--dir', 'test-artifacts'),
    out: get('--out', path.join('test-results', 'flaky-report')),
  };
}

function listXmlFiles(dir: string): string[] {
  const results: string[] = [];
  const stack = [dir];
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
      else if (e.isFile() && abs.endsWith('.xml')) results.push(abs);
    }
  }
  return results;
}

function parseAttrs(tag: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const re = /(\w+)="([^"]*)"/g;
  for (const m of tag.matchAll(re)) attrs[m[1]] = m[2];
  return attrs;
}

function isTruthy(val?: string): boolean {
  if (!val) return false;
  if (val === 'true') return true;
  const n = Number(val);
  return Number.isFinite(n) && n > 0;
}

function detectFlaky(attrs: Record<string, string>, body: string): string | null {
  if (attrs.flaky === 'true' || attrs.status === 'flaky') return 'flaky-attr';
  if (isTruthy(attrs.retry) || isTruthy(attrs.retries) || isTruthy(attrs.rerun)) return 'retry-attr';
  if (/<flaky\b/i.test(body)) return 'flaky-tag';
  if (/<rerun\b/i.test(body)) return 'rerun-tag';
  if (/retry/i.test(body) && /<testcase\b/i.test(body)) return 'retry-body';
  return null;
}

function parseSuites(xml: string): SuiteSummary[] {
  const suites: SuiteSummary[] = [];
  const suiteRe = /<testsuite\b[^>]*>/g;
  for (const m of xml.matchAll(suiteRe)) {
    const attrs = parseAttrs(m[0]);
    suites.push({
      file: '',
      name: attrs.name,
      tests: Number(attrs.tests || 0),
      failures: Number(attrs.failures || 0),
      errors: Number(attrs.errors || 0),
      skipped: Number(attrs.skipped || 0),
      time: attrs.time,
    });
  }
  return suites;
}

function parseTestcases(xml: string, file: string): FlakyTestcase[] {
  const flaky: FlakyTestcase[] = [];
  const fullCases = xml.match(/<testcase\b[^>]*>[\s\S]*?<\/testcase>/g) || [];
  const selfClosed = xml.match(/<testcase\b[^>]*\/>/g) || [];
  const cases = [...fullCases, ...selfClosed];

  for (const tc of cases) {
    const openTag = tc.match(/<testcase\b[^>]*>/)?.[0] || tc;
    const attrs = parseAttrs(openTag);
    const reason = detectFlaky(attrs, tc);
    if (!reason) continue;

    flaky.push({
      file,
      suite: attrs.classname,
      name: attrs.name,
      classname: attrs.classname,
      time: attrs.time,
      reason,
    });
  }
  return flaky;
}

function toMd(report: {
  generatedAt: string;
  totals: { xmlFiles: number; suites: number; tests: number; failures: number; errors: number; skipped: number; flaky: number };
  suites: SuiteSummary[];
  flaky: FlakyTestcase[];
}): string {
  const lines: string[] = [];
  lines.push('# JUnit Flaky Report');
  lines.push('');
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push('');
  lines.push('## Totals');
  lines.push('');
  lines.push(`- XML files: ${report.totals.xmlFiles}`);
  lines.push(`- Suites: ${report.totals.suites}`);
  lines.push(`- Tests: ${report.totals.tests}`);
  lines.push(`- Failures: ${report.totals.failures}`);
  lines.push(`- Errors: ${report.totals.errors}`);
  lines.push(`- Skipped: ${report.totals.skipped}`);
  lines.push(`- Flaky signals: ${report.totals.flaky}`);
  lines.push('');

  if (report.flaky.length > 0) {
    lines.push('## Flaky signals (sample)');
    lines.push('');
    const sample = report.flaky.slice(0, 200);
    for (const f of sample) {
      lines.push(`- ${f.file} :: ${f.classname || 'suite'} :: ${f.name || 'test'} (${f.reason})`);
    }
    if (report.flaky.length > sample.length) {
      lines.push('');
      lines.push(`... truncated: ${report.flaky.length - sample.length} more`);
    }
  } else {
    lines.push('## Flaky signals');
    lines.push('');
    lines.push('No flaky signals detected by heuristic.');
  }

  return lines.join('\n');
}

function main() {
  const { dir, out } = parseArgs();
  const xmlFiles = listXmlFiles(dir);
  const flakyAll: FlakyTestcase[] = [];
  const suiteAll: SuiteSummary[] = [];

  for (const abs of xmlFiles) {
    let xml = '';
    try {
      xml = fs.readFileSync(abs, 'utf-8');
    } catch {
      continue;
    }

    const suites = parseSuites(xml).map((s) => ({ ...s, file: abs }));
    const flaky = parseTestcases(xml, abs);
    suiteAll.push(...suites);
    flakyAll.push(...flaky);
  }

  const totals = suiteAll.reduce(
    (acc, s) => {
      acc.suites += 1;
      acc.tests += s.tests;
      acc.failures += s.failures;
      acc.errors += s.errors;
      acc.skipped += s.skipped;
      return acc;
    },
    { suites: 0, tests: 0, failures: 0, errors: 0, skipped: 0 }
  );

  const report = {
    generatedAt: new Date().toISOString(),
    totals: {
      xmlFiles: xmlFiles.length,
      suites: totals.suites,
      tests: totals.tests,
      failures: totals.failures,
      errors: totals.errors,
      skipped: totals.skipped,
      flaky: flakyAll.length,
    },
    suites: suiteAll,
    flaky: flakyAll,
  };

  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, 'flaky-report.json'), JSON.stringify(report, null, 2));
  fs.writeFileSync(path.join(out, 'flaky-report.md'), toMd(report));
}

main();
