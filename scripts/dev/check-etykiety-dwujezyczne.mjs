#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { justification } from './i18n-pl-audyt.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '../..');
const baselinePath = path.join(scriptDir, 'check-etykiety-dwujezyczne.baseline.json');
const languageCondition = String.raw`(?:isPolish|isPL|(?:lang|language)\s*===\s*['"]pl['"]|i18n\.language(?:\?\.startsWith\(['"]pl['"]\)|\s*===\s*['"]pl['"]))`;
const ternaryPattern = new RegExp(`(${languageCondition})\\s*\\?\\s*'([^']*)'\\s*:\\s*'([^']*)'`, 'g');
const sourceExtensions = new Set(['.ts', '.tsx', '.js', '.jsx']);

export function analyzeSource(source, file = '<memory>') {
  const rows = [];
  for (const match of source.matchAll(ternaryPattern)) {
    const pl = match[2];
    const en = match[3];
    const line = source.slice(0, match.index).split('\n').length;
    const identical = pl === en;
    const structural = /^[\s,.;:()\[\]{}|/+_-]*$/.test(pl);
    const reason = identical ? (structural ? 'separator techniczny' : justification(pl)) : null;
    rows.push({ file, line, pl, en, identical, justified: identical && Boolean(reason), reason });
  }
  return rows;
}

function collectFiles(entry, files) {
  if (!fs.existsSync(entry)) return;
  const stat = fs.statSync(entry);
  if (stat.isDirectory()) {
    for (const name of fs.readdirSync(entry)) collectFiles(path.join(entry, name), files);
  } else if (sourceExtensions.has(path.extname(entry))) files.push(entry);
}

export function scanPaths(paths) {
  const files = [];
  paths.forEach(entry => collectFiles(entry, files));
  const rows = files.flatMap(file => analyzeSource(fs.readFileSync(file, 'utf8'), path.relative(repoRoot, file)));
  return { files, rows, unjustified: rows.filter(row => row.identical && !row.justified) };
}

function arg(name) {
  const prefix = `--${name}=`;
  return process.argv.find(value => value.startsWith(prefix))?.slice(prefix.length);
}

export function runCli() {
  const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
  const explicitScope = arg('zakres');
  const roots = explicitScope
    ? [path.resolve(repoRoot, explicitScope)]
    : [
        path.join(repoRoot, 'src/components/DiscoveryTools'),
        path.join(repoRoot, 'src/toolPacks'),
        path.join(repoRoot, 'src/components/AIChat'),
        path.join(repoRoot, 'src/utils/canvas'),
      ];
  const result = scanPaths(roots);
  console.log(`etykiety: zbadane pliki=${result.files.length}, ternary=${result.rows.length}, nieuzasadnione-identyczne=${result.unjustified.length}, baseline=${baseline.maxUnjustifiedIdentical}`);
  if (result.files.length === 0 || result.rows.length === 0) {
    console.error('ETYKIETY FAIL: zero zbadanych obiektów');
    return 1;
  }
  if (!explicitScope && (result.files.length < baseline.minFiles || result.rows.length < baseline.minTernaries)) {
    console.error(`ETYKIETY FAIL: podłoga liczebności naruszona (min pliki=${baseline.minFiles}, ternary=${baseline.minTernaries})`);
    return 1;
  }
  for (const row of result.unjustified) console.log(`NIEUZASADNIONE ${row.file}:${row.line} ${JSON.stringify(row.pl)}`);
  if (result.unjustified.length > baseline.maxUnjustifiedIdentical) {
    console.error('ETYKIETY FAIL: liczba nieuzasadnionych identyczności wzrosła');
    return 1;
  }
  if (!explicitScope && result.unjustified.length < baseline.maxUnjustifiedIdentical) {
    console.error('ETYKIETY FAIL: dług zmalał — obniż baseline w tym samym commicie');
    return 1;
  }
  console.log('ETYKIETY OK: ratchet i podłoga liczebności zachowane');
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = runCli();
