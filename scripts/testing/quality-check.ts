#!/usr/bin/env node
/**
 * Test Quality Check (Anti-Placeholder + Anti-Fake)
 *
 * Goal: detect "sham" tests that do not touch real application code:
 * - placeholders / TODO-only tests
 * - "fake integration" tests (supertest + local express() routes)
 * - spec/file-based tests that read source via fs.readFileSync
 * - low-signal tests like expect(true).toBe(true)
 *
 * Output:
 * - Console summary
 * - JSON + Markdown report under test-results/quality-check/
 *
 * Usage:
 *   node --experimental-strip-types scripts/testing/quality-check.ts
 */

import * as fs from 'fs';
import * as path from 'path';

const projectRoot = process.cwd();
const testDirs = ['tests/', 'e2e/'];

const testRootAbs = testDirs.map((d) => path.resolve(projectRoot, d));

const outputDir = path.resolve(projectRoot, 'test-results', 'quality-check');
const reportJsonPath = path.join(outputDir, 'quality-check.report.json');
const reportMdPath = path.join(outputDir, 'quality-check.report.md');
const baselinePath = path.resolve(projectRoot, 'scripts', 'testing', 'quality-check.baseline.json');

type QualityBaseline = {
  buckets?: Partial<Record<'FAKE_UNIT' | 'PLACEHOLDER' | 'FAKE_INTEGRATION', string[]>>;
};

function loadBaseline(): QualityBaseline {
  try {
    if (!fs.existsSync(baselinePath)) return {};
    return JSON.parse(fs.readFileSync(baselinePath, 'utf-8')) as QualityBaseline;
  } catch (e) {
    console.log(`⚠️  Failed to read quality baseline: ${(e as Error).message}`);
    return {};
  }
}

function unbaselinedFiles(bucket: Bucket, files: string[], baseline: QualityBaseline): string[] {
  if (bucket !== 'FAKE_UNIT' && bucket !== 'PLACEHOLDER' && bucket !== 'FAKE_INTEGRATION') {
    return files;
  }
  const allowed = new Set(baseline.buckets?.[bucket] || []);
  return files.filter((file) => !allowed.has(file));
}

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
  const extSwapCandidates: string[] = [];
  // NodeNext/ESM projects often import TS sources via `.js` extension.
  // Try swapping extensions so filesystem-based resolution matches Vitest aliasing.
  if (base.endsWith('.js')) extSwapCandidates.push(base.slice(0, -3) + '.ts');
  if (base.endsWith('.jsx')) extSwapCandidates.push(base.slice(0, -4) + '.tsx');
  if (base.endsWith('.ts')) extSwapCandidates.push(base.slice(0, -3) + '.js');
  if (base.endsWith('.tsx')) extSwapCandidates.push(base.slice(0, -4) + '.jsx');
  const candidates = [
    base,
    ...extSwapCandidates,
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

function hasRealCodeImport(content: string, filePath: string): boolean {
  const sources = extractImportSources(content);

  // Quick positives: explicit application module import patterns
  if (
    sources.some(
      (s) =>
        s.startsWith('@/') ||
        s.startsWith('src/') ||
        s.startsWith('server/src/') ||
        s.startsWith('server/services/') ||
        // server/ (legacy) but exclude server/tests/
        (s.startsWith('server/') && !s.startsWith('server/tests/'))
    )
  ) {
    return true;
  }

  // Robust: any resolvable local import that points outside tests/ roots
  for (const src of sources) {
    const resolved = resolveLocalImport(filePath, src);
    if (!resolved) continue;
    if (!isInsideAny(resolved, testRootAbs)) return true;
  }

  return false;
}

function usesSupertest(content: string): boolean {
  return /\bsupertest\b/.test(content) || /from\s+['"]supertest['"]/.test(content);
}

function createsLocalExpressApp(content: string): boolean {
  if (!/\bexpress\b/.test(content)) return false;
  // Most common: app = express(); const app = express(); let app = express();
  if (/\bexpress\s*\(\s*\)/.test(content)) return true;
  return false;
}

function importsServerIndex(content: string): boolean {
  // We treat direct imports of server/src/index as "real runtime" integration signal.
  return (
    /server\/src\/index(\.ts|\.js)?/.test(content) ||
    /from\s+['"][^'"]*server\/src\/index/.test(content)
  );
}

function usesPlaywright(content: string, filePath: string): boolean {
  if (
    /from\s+['"]@playwright\/test['"]/.test(content) ||
    /require\s*\(\s*['"]@playwright\/test['"]/.test(content)
  )
    return true;
  if (
    filePath.includes(`${path.sep}tests${path.sep}e2e${path.sep}`) ||
    filePath.includes(`${path.sep}e2e${path.sep}`)
  ) {
    // Heuristic: Playwright tests typically call `test(...)` and use `page.` APIs.
    if (
      /\btest\.(describe|beforeEach|afterEach|beforeAll|afterAll)\b|\btest\s*\(/.test(content) &&
      /\bpage\./.test(content)
    ) {
      return true;
    }
  }
  return false;
}

function isFakeUnitTest(content: string, filePath: string): boolean {
  // A "fake unit" test is one that defines a full inline implementation (service/engine/etc.)
  // and tests that implementation, without importing any real app code.
  //
  // This is intentionally conservative to avoid false positives.
  if (usesPlaywright(content, filePath)) return false;
  if (hasRealCodeImport(content, filePath)) return false;
  if (usesSupertest(content)) return false;

  const hasInlineMarker =
    /INLINE HELPER IMPLEMENTATION/i.test(content) ||
    /\b(services?|engine|middleware)\s+implementation\b/i.test(content) ||
    /Uses inline implementation to avoid import issues/i.test(content);

  const hasFactory =
    /\bconst\s+create[A-Za-z0-9_]+\s*=\s*\(\)\s*=>\s*\{/.test(content) ||
    /\bfunction\s+create[A-Za-z0-9_]+\s*\(\)\s*\{/.test(content);

  const testsFactory =
    /\b(beforeEach|beforeAll)\s*\(\s*\(\s*\)\s*=>[\s\S]{0,250}\bcreate[A-Za-z0-9_]+\s*\(/.test(
      content
    ) || /\bcreate[A-Za-z0-9_]+\s*\(\s*\)\s*;/.test(content);

  // Inline service objects tend to return an object with many methods.
  const returnObjectMethodCount = (
    content.match(/\n\s{2,}[a-zA-Z_$][\w$]*\s*:\s*(async\s*)?\(/g) || []
  ).length;

  return (hasInlineMarker || hasFactory) && testsFactory && returnObjectMethodCount >= 5;
}

function readsSourceFiles(content: string): boolean {
  return /\bfs\.readFileSync\s*\(/.test(content);
}

function isLowSignal(content: string): boolean {
  return /\bexpect\s*\(\s*true\s*\)\s*\.\s*toBe\s*\(\s*true\s*\)/.test(content);
}

function isPlaceholder(content: string): boolean {
  // Heuristic placeholders: object literal + shallow expect on its fields (common "spec-only" pattern)
  const placeholderPattern = /const\s+\w+\s*=\s*\{[^}]*\}[\s\S]{0,200}expect\s*\(\s*\w+\.\w+/;
  // Explicit markers
  const markerPattern =
    /@test-quality\s+PLACEHOLDER|needs real implementation|NOT IMPLEMENTED|\bPLACEHOLDER\b/i;
  return placeholderPattern.test(content) || markerPattern.test(content);
}

type Bucket =
  | 'REAL_CODE'
  | 'REAL_RUNTIME'
  | 'FAKE_UNIT'
  | 'PLACEHOLDER'
  | 'FAKE_INTEGRATION'
  | 'FAKE_INTEGRATION_RISK'
  | 'SPEC_FILE'
  | 'LOW_SIGNAL'
  | 'OTHER';

function importsServerRoutes(content: string): boolean {
  const sources = extractImportSources(content);
  return sources.some((s) => /server\/src\/routes\b|server\/src\/routes\//.test(s));
}

function importsServerGatewayOrApp(content: string): boolean {
  const sources = extractImportSources(content);
  return sources.some((s) => /server\/src\/(Gateway|app|createApp)\b/.test(s));
}

function definesInlineExpressRoutes(content: string): boolean {
  // Inline route handlers in a test file are a strong signal of "fake integration".
  return /\bapp\.(get|post|put|delete|patch|all)\s*\(/.test(content);
}

function classifyTest(content: string, filePath: string): Bucket {
  // Placeholder always loses to REAL signals (avoid misclassifying real tests).
  const realCode = hasRealCodeImport(content, filePath);
  const supertest = usesSupertest(content);
  const expressApp = createsLocalExpressApp(content);
  const serverIndex = importsServerIndex(content);
  const serverRoutes = importsServerRoutes(content);
  const serverGatewayOrApp = importsServerGatewayOrApp(content);
  const inlineExpressRoutes = definesInlineExpressRoutes(content);
  const playwright = usesPlaywright(content, filePath);
  const fakeUnit = isFakeUnitTest(content, filePath);
  const placeholder = isPlaceholder(content);
  const specFile = readsSourceFiles(content);
  const lowSignal = isLowSignal(content);

  // Integration honesty: supertest + local express() is "real" only if it mounts our real route stack
  // (or imports the real server entry). Inline route handlers in the test are treated as fake.
  if (supertest && expressApp) {
    const hasRuntimeSignal = serverIndex || serverRoutes || serverGatewayOrApp;

    // Explicit fake: local app with inline handlers and no real route stack imports.
    if (inlineExpressRoutes && !hasRuntimeSignal) return 'FAKE_INTEGRATION';

    // Risk: the file imports real app code, but also defines inline handlers (common try/catch fallback).
    // This can silently become fake if the import path changes or fails.
    if (inlineExpressRoutes && hasRuntimeSignal && !serverRoutes && !serverIndex) {
      return 'FAKE_INTEGRATION_RISK';
    }

    // Without any runtime signal, it's almost certainly a mocked app (even if it imports some src types).
    if (!hasRuntimeSignal) return 'FAKE_INTEGRATION';
  }

  // REAL: must touch application code, not just testing libs.
  if (realCode) return 'REAL_CODE';

  // Real runtime E2E (Playwright) tests. Note: these are executed by Playwright, not Vitest.
  if (playwright) return 'REAL_RUNTIME';

  // Runtime integration: supertest + server app import (no local express() "mock app" signal).
  if (supertest && serverIndex && !expressApp) return 'REAL_RUNTIME';

  // Fake integration: supertest hitting local express app with mock routes.
  if (supertest && expressApp && !serverIndex) return 'FAKE_INTEGRATION';

  if (fakeUnit) return 'FAKE_UNIT';
  if (placeholder) return 'PLACEHOLDER';
  if (specFile) return 'SPEC_FILE';
  if (lowSignal) return 'LOW_SIGNAL';

  return 'OTHER';
}

function scan(): void {
  const buckets: Record<Bucket, { count: number; files: string[] }> = {
    REAL_CODE: { count: 0, files: [] },
    REAL_RUNTIME: { count: 0, files: [] },
    FAKE_UNIT: { count: 0, files: [] },
    PLACEHOLDER: { count: 0, files: [] },
    FAKE_INTEGRATION: { count: 0, files: [] },
    FAKE_INTEGRATION_RISK: { count: 0, files: [] },
    SPEC_FILE: { count: 0, files: [] },
    LOW_SIGNAL: { count: 0, files: [] },
    OTHER: { count: 0, files: [] },
  };

  for (const dir of testDirs) {
    const fullPath = path.join(projectRoot, dir);
    if (!fs.existsSync(fullPath)) continue;

    const files = findTestFiles(fullPath);
    for (const file of files) {
      const content = fs.readFileSync(file, 'utf-8');
      const bucket = classifyTest(content, file);
      buckets[bucket].count++;
      buckets[bucket].files.push(path.relative(projectRoot, file));
    }
  }

  const real = buckets.REAL_CODE.count + buckets.REAL_RUNTIME.count;
  const placeholder = buckets.PLACEHOLDER.count + buckets.FAKE_UNIT.count;
  const other =
    buckets.OTHER.count +
    buckets.FAKE_INTEGRATION.count +
    buckets.FAKE_INTEGRATION_RISK.count +
    buckets.SPEC_FILE.count +
    buckets.LOW_SIGNAL.count;

  const total = Object.values(buckets).reduce((sum, b) => sum + b.count, 0);
  const scored = real + placeholder;
  const authenticityOverall = total > 0 ? ((real / total) * 100).toFixed(1) : '0.0';
  const authenticityScored = scored > 0 ? ((real / scored) * 100).toFixed(1) : '100.0';
  const baseline = loadBaseline();

  const placeholderShareScored = scored > 0 ? ((placeholder / scored) * 100).toFixed(1) : '0.0';

  console.log('\n📊 Test Quality Report');
  console.log('====================');
  console.log(`Scanned roots: ${testDirs.join(', ')}`);
  console.log(`REAL: ${real}`);
  console.log(`PLACEHOLDER: ${placeholder}`);
  console.log(`OTHER: ${other}`);
  console.log('');
  console.log(`Breakdown:`);
  console.log(`  - REAL_CODE: ${buckets.REAL_CODE.count}`);
  console.log(`  - REAL_RUNTIME: ${buckets.REAL_RUNTIME.count}`);
  console.log(`  - FAKE_INTEGRATION: ${buckets.FAKE_INTEGRATION.count}`);
  console.log(`  - FAKE_INTEGRATION_RISK: ${buckets.FAKE_INTEGRATION_RISK.count}`);
  console.log(`  - FAKE_UNIT: ${buckets.FAKE_UNIT.count}`);
  console.log(`  - SPEC_FILE: ${buckets.SPEC_FILE.count}`);
  console.log(`  - LOW_SIGNAL: ${buckets.LOW_SIGNAL.count}`);
  console.log(`  - OTHER: ${buckets.OTHER.count}`);
  console.log(`AUTHENTICITY (SCORED = REAL/(REAL+PLACEHOLDER)): ${authenticityScored}%`);
  console.log(
    `PLACEHOLDER SHARE (SCORED = PLACEHOLDER/(REAL+PLACEHOLDER)): ${placeholderShareScored}%`
  );
  console.log(`AUTHENTICITY (OVERALL = REAL/(ALL)): ${authenticityOverall}%`);
  console.log('');

  const report = {
    generatedAt: new Date().toISOString(),
    root: projectRoot,
    scannedRoots: testDirs,
    totals: {
      total,
      scored,
      real,
      placeholder,
      other,
    },
    ratios: {
      authenticityScoredPct: Number(authenticityScored),
      authenticityOverallPct: Number(authenticityOverall),
      placeholderShareScoredPct: Number(placeholderShareScored),
    },
    buckets,
  };

  try {
    fs.mkdirSync(outputDir, { recursive: true });
    fs.writeFileSync(reportJsonPath, JSON.stringify(report, null, 2), 'utf-8');
    fs.writeFileSync(reportMdPath, renderMarkdown(report), 'utf-8');
    console.log(`Report written: ${path.relative(projectRoot, reportJsonPath)}`);
    console.log(`Report written: ${path.relative(projectRoot, reportMdPath)}`);
    console.log('');
  } catch (e) {
    console.log(`⚠️  Failed to write report files: ${(e as Error).message}`);
  }

  // Hard gate: don't allow "sham" tests back into the suite.
  const newPlaceholderFiles = [
    ...unbaselinedFiles('PLACEHOLDER', buckets.PLACEHOLDER.files || [], baseline),
    ...unbaselinedFiles('FAKE_UNIT', buckets.FAKE_UNIT.files || [], baseline),
  ];
  if (newPlaceholderFiles.length > 0) {
    console.log(`❌ New PLACEHOLDER/FAKE_UNIT tests detected: ${newPlaceholderFiles.length}`);
    console.log('Files:', newPlaceholderFiles.join(', '));
    process.exit(1);
  }
  const newFakeIntegrationFiles = unbaselinedFiles(
    'FAKE_INTEGRATION',
    buckets.FAKE_INTEGRATION.files || [],
    baseline
  );
  if (newFakeIntegrationFiles.length > 0) {
    console.log(`❌ New FAKE_INTEGRATION tests detected: ${newFakeIntegrationFiles.length}`);
    console.log('Files:', newFakeIntegrationFiles.join(', '));
    process.exit(1);
  }

  const failOnRisk = process.env.QUALITY_CHECK_FAIL_ON_RISK === '1';
  if (buckets.FAKE_INTEGRATION_RISK.count > 0) {
    console.log(
      `⚠️  FAKE_INTEGRATION_RISK detected: ${buckets.FAKE_INTEGRATION_RISK.count} (see report JSON)`
    );
    if (failOnRisk) process.exit(1);
  }
  process.exit(0);
}

function findTestFiles(dir: string): string[] {
  const results: string[] = [];
  const walk = (d: string) => {
    if (!fs.existsSync(d)) return;
    const entries = fs.readdirSync(d, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(d, e.name);
      if (e.isDirectory() && !e.name.startsWith('.') && e.name !== 'node_modules') {
        walk(full);
      } else if (
        e.isFile() &&
        (/\.(test|spec)\.(ts|tsx|js|jsx)$/.test(e.name) ||
          e.name.endsWith('.test') ||
          e.name.endsWith('.spec'))
      ) {
        results.push(full);
      }
    }
  };
  walk(dir);
  return results;
}

function renderMarkdown(report: any): string {
  const { totals, ratios, buckets } = report;
  const lines: string[] = [];

  lines.push('# Test Quality Report');
  lines.push('');
  lines.push(`Generated: \`${report.generatedAt}\``);
  lines.push(`Scanned roots: \`${(report.scannedRoots || []).join(', ')}\``);
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push(`- Total scanned: **${totals.total}**`);
  lines.push(`- REAL: **${totals.real}**`);
  lines.push(`- PLACEHOLDER: **${totals.placeholder}**`);
  lines.push(`- OTHER: **${totals.other}**`);
  lines.push('');
  lines.push('## Ratios');
  lines.push('');
  lines.push(
    `- Authenticity (scored): **${ratios.authenticityScoredPct}%** (REAL/(REAL+PLACEHOLDER))`
  );
  lines.push(
    `- Placeholder share (scored): **${ratios.placeholderShareScoredPct}%** (PLACEHOLDER/(REAL+PLACEHOLDER))`
  );
  lines.push(`- Authenticity (overall): **${ratios.authenticityOverallPct}%** (REAL/ALL)`);
  lines.push('');
  lines.push('## Breakdown');
  lines.push('');
  const order: Bucket[] = [
    'REAL_CODE',
    'REAL_RUNTIME',
    'FAKE_INTEGRATION',
    'FAKE_INTEGRATION_RISK',
    'FAKE_UNIT',
    'PLACEHOLDER',
    'SPEC_FILE',
    'LOW_SIGNAL',
    'OTHER',
  ];
  for (const k of order) {
    lines.push(`- **${k}**: ${buckets[k].count}`);
  }
  lines.push('');
  lines.push('## Key Lists (paths)');
  lines.push('');
  lines.push(`- REAL_CODE: see \`buckets.REAL_CODE.files\` in JSON`);
  lines.push(`- REAL_RUNTIME: see \`buckets.REAL_RUNTIME.files\` in JSON`);
  lines.push(
    `- FAKE_INTEGRATION (REAL-but-fake risk): see \`buckets.FAKE_INTEGRATION.files\` in JSON`
  );
  lines.push(
    `- FAKE_INTEGRATION_RISK (REAL-but-fake risk): see \`buckets.FAKE_INTEGRATION_RISK.files\` in JSON`
  );
  lines.push(`- FAKE_UNIT (inline implementations): see \`buckets.FAKE_UNIT.files\` in JSON`);
  lines.push(`- PLACEHOLDER: see \`buckets.PLACEHOLDER.files\` in JSON`);
  lines.push(`- LOW_SIGNAL: see \`buckets.LOW_SIGNAL.files\` in JSON`);
  lines.push(`- SPEC_FILE (file-based): see \`buckets.SPEC_FILE.files\` in JSON`);
  lines.push('');

  return lines.join('\n');
}

scan();
