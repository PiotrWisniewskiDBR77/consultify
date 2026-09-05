#!/usr/bin/env node
/**
 * stoplista-en.mjs — one-off F-M1 acceptance counter (§10, F1_FINANSE
 * program dokończenia). Counts occurrences of the given stop-list phrases
 * as RAW, un-translated UI text — i.e. NOT the English default argument of
 * a `t('key', 'default')` call (that is a legitimate i18next fallback for
 * the English locale), and not inside a line or block comment.
 *
 * Usage: node scripts/dev/audyt-award-20260905/stoplista-en.mjs --zakres=DIR[,DIR...]
 */
import fs from 'fs';
import path from 'path';

const args = process.argv.slice(2);
const zakresArg = args.find((a) => a.startsWith('--zakres='));
const roots = zakresArg
  ? zakresArg.slice('--zakres='.length).split(',')
  : ['src/components/Finance', 'src/components/Economics'];

const STOP = [
  'Banking value', 'Cash forecast', 'Driver planner', 'Driver tree', 'Extended ratios',
  'Headcount planner', 'Investment appraisal', 'Rolling forecast', 'Valuation visuals',
  'Value attribution', 'Value capture pipeline', 'Value ledger', 'Value office',
  'Variance bridge', 'Variance narration', 'EV basket', 'Monte Carlo NPV', 'Real options',
  'Efficient frontier', 'What-if sensitivity', 'Scenario compute', 'Validation results',
  'Delete', 'Loading panel', 'Draft', 'In Review', 'Approved',
];

function walk(dir, out) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '__tests__' || entry.name.includes('.test.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(tsx|ts)$/.test(entry.name)) out.push(full);
  }
}

const files = [];
for (const r of roots) walk(r, files);

let total = 0;
const hits = [];

for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  const lines = src.split('\n');
  let inBlockComment = false;
  lines.forEach((rawLine, idx) => {
    let line = rawLine;
    // Strip block comments spanning/ending on this line (best-effort, line-local).
    if (inBlockComment) {
      const end = line.indexOf('*/');
      if (end === -1) return; // whole line still inside a block comment
      line = line.slice(end + 2);
      inBlockComment = false;
    }
    const blockStart = line.indexOf('/*');
    if (blockStart !== -1 && line.indexOf('*/', blockStart) === -1) {
      inBlockComment = true;
      line = line.slice(0, blockStart);
    }
    // Strip a trailing `//` line comment.
    const lineCommentIdx = line.indexOf('//');
    const codePart = lineCommentIdx === -1 ? line : line.slice(0, lineCommentIdx);
    for (const term of STOP) {
      if (!codePart.includes(term)) continue;
      // Exclude the case where this occurrence is the default-value string of
      // a `t('key', 'default')` call on the same line (legit EN fallback).
      const termIdx = codePart.indexOf(term);
      const before = codePart.slice(0, termIdx);
      const isTDefaultArg = /\bt\(\s*[\s\S]*?,\s*['"`][^'"`]*$/.test(before) && before.includes("t(");
      if (isTDefaultArg) continue;
      hits.push(`${f}:${idx + 1}: [${term}] ${codePart.trim().slice(0, 140)}`);
      total++;
    }
  });
}

for (const h of hits) console.log(h);
console.log('\nTOTAL RAW (non-t()-default) HITS:', total);
process.exit(total > 0 ? 1 : 0);
