#!/usr/bin/env npx tsx
/**
 * Test Quality Check - wykrywa placeholdery
 * Użycie: npx tsx scripts/testing/quality-check.ts
 */

import * as fs from 'fs';
import * as path from 'path';

const projectRoot = process.cwd();
const testDirs = ['tests/', 'server/tests/'];

const testRootAbs = testDirs.map((d) => path.resolve(projectRoot, d));

function isInsideAny(p: string, dirs: string[]): boolean {
  const norm = path.normalize(p);
  return dirs.some((dir) => {
    const base = path.normalize(dir.endsWith(path.sep) ? dir : dir + path.sep);
    return norm === path.normalize(dir) || norm.startsWith(base);
  });
}

function extractImportSources(content: string): string[] {
  const sources: string[] = [];

  // import ... from 'x'
  for (const m of content.matchAll(/from\s+['"]([^'"]+)['"]/g)) sources.push(m[1]);
  // import('x')
  for (const m of content.matchAll(/import\s*\(\s*['"]([^'"]+)['"]\s*\)/g)) sources.push(m[1]);
  // require('x')
  for (const m of content.matchAll(/require\s*\(\s*['"]([^'"]+)['"]\s*\)/g)) sources.push(m[1]);

  return Array.from(new Set(sources));
}

function resolveLocalImport(importerPath: string, source: string): string | null {
  if (!source.startsWith('.')) return null;

  const base = path.resolve(path.dirname(importerPath), source);
  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.js`,
    `${base}.jsx`,
    path.join(base, 'index.ts'),
    path.join(base, 'index.tsx'),
    path.join(base, 'index.js'),
    path.join(base, 'index.jsx'),
  ];

  for (const c of candidates) {
    try {
      if (fs.existsSync(c) && fs.statSync(c).isFile()) return c;
    } catch {
      // ignore filesystem race/permission issues; keep scanning
    }
  }
  return null;
}

function isRealTest(content: string, filePath: string): boolean {
  const sources = extractImportSources(content);

  // Quick positives: explicit src/server module import patterns
  if (sources.some((s) => s.startsWith('@/') || s.startsWith('src/') || s.startsWith('server/')))
    return true;
  if (content.includes('supertest') || content.includes("from 'supertest'")) return true;

  // Robust: any resolvable local import that points outside tests/ roots
  for (const src of sources) {
    const resolved = resolveLocalImport(filePath, src);
    if (!resolved) continue;
    if (!isInsideAny(resolved, testRootAbs)) return true;
  }

  return false;
}

function isPlaceholder(content: string): boolean {
  // Wzorzec: const obj = {...}; expect(obj.prop)
  const placeholderPattern = /const\s+\w+\s*=\s*\{[^}]*\}[\s\S]{0,200}expect\s*\(\s*\w+\.\w+/;
  return placeholderPattern.test(content);
}

function scan(): void {
  let real = 0,
    placeholder = 0,
    other = 0;

  for (const dir of testDirs) {
    const fullPath = path.join(projectRoot, dir);
    if (!fs.existsSync(fullPath)) continue;

    const files = findTestFiles(fullPath);
    for (const file of files) {
      const content = fs.readFileSync(file, 'utf-8');
      const realTest = isRealTest(content, file);
      const placeholderTest = isPlaceholder(content);

      // Placeholder always loses to REAL, so we don't misclassify real tests.
      if (realTest) real++;
      else if (placeholderTest) placeholder++;
      else other++;
    }
  }

  const total = real + placeholder + other;
  const scored = real + placeholder;
  const authenticityOverall = total > 0 ? ((real / total) * 100).toFixed(1) : '0.0';
  const authenticityScored = scored > 0 ? ((real / scored) * 100).toFixed(1) : '100.0';

  console.log('\n📊 Test Quality Report');
  console.log('====================');
  console.log(`REAL: ${real}`);
  console.log(`PLACEHOLDER: ${placeholder}`);
  console.log(`OTHER: ${other}`);
  console.log(`AUTHENTICITY (SCORED = REAL/(REAL+PLACEHOLDER)): ${authenticityScored}%`);
  console.log(`AUTHENTICITY (OVERALL = REAL/(ALL)): ${authenticityOverall}%`);
  console.log('');

  const threshold = 25;
  if (parseFloat(authenticityScored) < threshold) {
    console.log(`⚠️  Autentyczność (SCORED) < ${threshold}% (cel: ${threshold}%+)`);
    process.exit(1);
  }
  process.exit(0);
}

function findTestFiles(dir: string): string[] {
  const results: string[] = [];
  const walk = (d: string) => {
    const entries = fs.readdirSync(d, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(d, e.name);
      if (e.isDirectory() && !e.name.startsWith('.') && e.name !== 'node_modules') {
        walk(full);
      } else if (e.isFile() && /\.(test|spec)\.(ts|tsx|js|jsx)$/.test(e.name)) {
        results.push(full);
      }
    }
  };
  walk(dir);
  return results;
}

scan();
