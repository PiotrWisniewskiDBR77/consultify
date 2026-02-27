#!/usr/bin/env node
/**
 * High-risk area scan.
 * Reports whether the current diff touches high-risk code paths.
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

type HighRiskConfig = {
  prefixes: string[];
};

function getBaseRef(): string {
  const base = process.env.GITHUB_BASE_REF?.trim();
  if (base) return `origin/${base}`;
  return 'HEAD~1';
}

function loadConfig(): HighRiskConfig {
  const configPath = path.resolve(process.cwd(), 'scripts/testing/high-risk-areas.json');
  const raw = fs.readFileSync(configPath, 'utf-8');
  return JSON.parse(raw) as HighRiskConfig;
}

function listChangedFiles(baseRef: string): string[] {
  let output = '';
  try {
    output = execFileSync('git', ['diff', '--name-only', `${baseRef}...HEAD`], {
      encoding: 'utf-8',
    });
  } catch {
    return [];
  }
  return output
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
}

function main() {
  const baseRef = getBaseRef();
  const config = loadConfig();
  const files = listChangedFiles(baseRef);
  const hits = files.filter((f) => config.prefixes.some((p) => f.startsWith(p)));

  const summary = {
    baseRef,
    changedFiles: files.length,
    highRiskFiles: hits,
    highRiskHit: hits.length > 0,
  };

  const outDir = path.resolve(process.cwd(), 'test-results', 'high-risk-scan');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'high-risk-scan.json'), JSON.stringify(summary, null, 2));

  const mdLines: string[] = [];
  mdLines.push('# High-risk Scan');
  mdLines.push('');
  mdLines.push(`Base ref: ${baseRef}`);
  mdLines.push(`Changed files: ${files.length}`);
  mdLines.push(`High-risk hit: ${summary.highRiskHit ? 'YES' : 'NO'}`);
  mdLines.push('');
  if (hits.length > 0) {
    mdLines.push('## Files');
    mdLines.push('');
    for (const f of hits) mdLines.push(`- ${f}`);
  }
  fs.writeFileSync(path.join(outDir, 'high-risk-scan.md'), mdLines.join('\n'));
}

main();
