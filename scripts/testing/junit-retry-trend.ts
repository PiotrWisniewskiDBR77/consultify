#!/usr/bin/env node
/**
 * JUnit Retry Trend (per-run)
 *
 * Generates top N tests with retry/flaky signals based on JUnit XML.
 * Usage:
 *   node --experimental-strip-types scripts/testing/junit-retry-trend.ts --dir test-artifacts --out test-results/flaky-trend --top 10
 */

import * as fs from 'fs';
import * as path from 'path';

type RetryHit = {
  testId: string;
  name?: string;
  classname?: string;
  file: string;
  reason: string;
  count: number;
};

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (flag: string, fallback: string) => {
    const idx = args.indexOf(flag);
    if (idx === -1 || idx + 1 >= args.length) return fallback;
    return args[idx + 1];
  };
  return {
    dir: get('--dir', 'test-artifacts'),
    out: get('--out', path.join('test-results', 'flaky-trend')),
    top: Number(get('--top', '10')) || 10,
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

function detectRetry(attrs: Record<string, string>, body: string): string | null {
  if (attrs.flaky === 'true' || attrs.status === 'flaky') return 'flaky-attr';
  if (isTruthy(attrs.retry) || isTruthy(attrs.retries) || isTruthy(attrs.rerun)) return 'retry-attr';
  if (/<flaky\b/i.test(body)) return 'flaky-tag';
  if (/<rerun\b/i.test(body)) return 'rerun-tag';
  if (/retry/i.test(body) && /<testcase\b/i.test(body)) return 'retry-body';
  return null;
}

function collectRetries(xml: string, file: string, acc: Map<string, RetryHit>) {
  const fullCases = xml.match(/<testcase\b[^>]*>[\s\S]*?<\/testcase>/g) || [];
  const selfClosed = xml.match(/<testcase\b[^>]*\/>/g) || [];
  const cases = [...fullCases, ...selfClosed];

  for (const tc of cases) {
    const openTag = tc.match(/<testcase\b[^>]*>/)?.[0] || tc;
    const attrs = parseAttrs(openTag);
    const reason = detectRetry(attrs, tc);
    if (!reason) continue;

    const name = attrs.name || 'unknown';
    const classname = attrs.classname || 'unknown';
    const testId = `${classname}::${name}`;

    const existing = acc.get(testId);
    if (existing) {
      existing.count += 1;
      continue;
    }
    acc.set(testId, {
      testId,
      name: attrs.name,
      classname: attrs.classname,
      file,
      reason,
      count: 1,
    });
  }
}

function toMd(top: RetryHit[], meta: { generatedAt: string; totalHits: number; xmlFiles: number }) {
  const lines: string[] = [];
  lines.push('# Flaky Trend (Per-Run)');
  lines.push('');
  lines.push(`Generated: ${meta.generatedAt}`);
  lines.push(`XML files: ${meta.xmlFiles}`);
  lines.push(`Total retry signals: ${meta.totalHits}`);
  lines.push('');
  lines.push('## Top retries (this run)');
  lines.push('');
  if (top.length === 0) {
    lines.push('No retry/flaky signals detected in JUnit for this run.');
    return lines.join('\n');
  }
  for (const t of top) {
    lines.push(`- ${t.testId} (count=${t.count}, reason=${t.reason})`);
  }
  lines.push('');
  lines.push('Note: this is per-run only. 30-day trend requires CI history.');
  return lines.join('\n');
}

function main() {
  const { dir, out, top } = parseArgs();
  const xmlFiles = listXmlFiles(dir);
  const acc = new Map<string, RetryHit>();

  for (const abs of xmlFiles) {
    let xml = '';
    try {
      xml = fs.readFileSync(abs, 'utf-8');
    } catch {
      continue;
    }
    collectRetries(xml, abs, acc);
  }

  const all = Array.from(acc.values()).sort((a, b) => b.count - a.count);
  const topList = all.slice(0, top);

  const report = {
    generatedAt: new Date().toISOString(),
    xmlFiles: xmlFiles.length,
    totalHits: all.reduce((sum, h) => sum + h.count, 0),
    top: topList,
  };

  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, 'flaky-trend.json'), JSON.stringify(report, null, 2));
  fs.writeFileSync(path.join(out, 'flaky-trend.md'), toMd(topList, report));
}

main();
