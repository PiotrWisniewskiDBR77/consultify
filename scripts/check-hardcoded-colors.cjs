#!/usr/bin/env node
/**
 * VEGAS V7.7 — hardcoded-color RATCHET gate.
 *
 * Scans src/** for RAW color debt that bypasses the design-system tokens:
 *   1. Raw hex literals            — #fff, #85182F, #12345678
 *   2. Raw rgb()/rgba() literals   — rgb(0 0 0), rgba(133,24,47,.1)
 *   3. Raw Tailwind palette classes — text-red-500, bg-slate-100, border-blue-600, …
 *      (the built-in palette scales; the approved `c.*`, crimson/primary/danger/
 *       success/secondary/brand/navy semantic tokens are ALLOWED and never flagged)
 *
 * The design-system SSOT is the `c.*` namespace + brand semantic scales defined in
 * tailwind.config.js and src/index.css. Anything else is new color debt.
 *
 * The repo carries a large residual debt today, so a hard "== 0" gate is impossible.
 * Instead this is a RATCHET: a baseline JSON holds the per-file violation count, and
 * the gate FAILS only for files whose count ROSE above baseline (or brand-new files
 * that introduce any violation). Reducing debt is always allowed; growing it is not.
 *
 * Usage:
 *   node scripts/check-hardcoded-colors.cjs               # gate (CI): fail on regressions
 *   node scripts/check-hardcoded-colors.cjs --update      # (re)write the baseline
 *   node scripts/check-hardcoded-colors.cjs --list        # list every violation
 *   node scripts/check-hardcoded-colors.cjs --filter x    # restrict --list to path/line substring
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const BASELINE = path.join(__dirname, 'hardcoded-colors.baseline.json');

// ── Files/dirs excluded from the scan ────────────────────────────────────────
// Token/config files legitimately define the raw color values the rest of the app
// must consume through tokens. Tests, mocks and type decls are not shipped UI.
const EXCLUDE_DIRS = new Set(['node_modules', '__tests__', '__mocks__', '__snapshots__']);
const EXCLUDE_FILE_RE = /\.(test|spec|stories|d)\.tsx?$/;
// Explicit allow-list of token/theme SSOT files (relative to repo root).
const EXCLUDE_PATHS = new Set([
  'src/index.css',
  'src/styles/tokens.css',
  'src/services/tokenService.ts',
].map((p) => p.replace(/\//g, path.sep)));

// ── Tailwind built-in palette hues (raw, non-semantic) ───────────────────────
const RAW_HUES = [
  'slate', 'gray', 'zinc', 'neutral', 'stone',
  'red', 'orange', 'amber', 'yellow', 'lime', 'green', 'emerald', 'teal',
  'cyan', 'sky', 'blue', 'indigo', 'violet', 'purple', 'fuchsia', 'pink', 'rose',
].join('|');
// Color-bearing tailwind utility prefixes.
const COLOR_PREFIXES = [
  'text', 'bg', 'border', 'ring', 'ring-offset', 'from', 'to', 'via',
  'fill', 'stroke', 'divide', 'placeholder', 'shadow', 'outline',
  'decoration', 'caret', 'accent',
].join('|');
const STOPS = '(?:50|100|200|300|400|500|600|700|800|900|950)';

// A raw palette class, optionally with a variant prefix (hover:, dark:, md:) and
// an opacity modifier (/50). Bounded by a non-class char on each side.
const PALETTE_RE = new RegExp(
  `(?<![\\w-])(?:${COLOR_PREFIXES})-(?:${RAW_HUES})-${STOPS}(?:/\\d{1,3})?(?![\\w-])`,
  'g',
);
// Raw hex color: #rgb, #rgba, #rrggbb, #rrggbbaa (word-bounded so we skip #region etc.)
const HEX_RE = /#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/g;
// Raw rgb()/rgba() literal.
const RGB_RE = /\brgba?\(\s*[\d.]+[\s,]/g;

function shouldSkip(relPath, name) {
  if (EXCLUDE_FILE_RE.test(name)) return true;
  if (EXCLUDE_PATHS.has(relPath)) return true;
  return false;
}

function walk(dir, acc) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (EXCLUDE_DIRS.has(entry.name)) continue;
      walk(p, acc);
    } else if (/\.(ts|tsx|css)$/.test(entry.name)) {
      const rel = path.relative(ROOT, p);
      if (!shouldSkip(rel, entry.name)) acc.push(p);
    }
  }
  return acc;
}

function countViolations(text) {
  // Returns { total, hits: [{ line, kind, match }] }
  const hits = [];
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i];
    for (const [kind, re] of [['palette', PALETTE_RE], ['hex', HEX_RE], ['rgb', RGB_RE]]) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(ln)) !== null) {
        hits.push({ line: i + 1, kind, match: m[0] });
      }
    }
  }
  return { total: hits.length, hits };
}

function scan() {
  const files = walk(SRC, []);
  const perFile = {}; // relPath -> count
  const detail = {}; // relPath -> hits[]
  let total = 0;
  for (const file of files) {
    const rel = path.relative(ROOT, file).split(path.sep).join('/');
    const { total: n, hits } = countViolations(fs.readFileSync(file, 'utf8'));
    if (n > 0) {
      perFile[rel] = n;
      detail[rel] = hits;
      total += n;
    }
  }
  return { files, perFile, detail, total };
}

function main() {
  const args = process.argv.slice(2);
  const { files, perFile, detail, total } = scan();

  if (args.includes('--update')) {
    const sorted = Object.fromEntries(Object.entries(perFile).sort(([a], [b]) => a.localeCompare(b)));
    fs.writeFileSync(
      BASELINE,
      JSON.stringify({ _comment: 'VEGAS V7.7 hardcoded-color ratchet baseline. Regenerate: npm run check:colors:update', generatedAt: new Date().toISOString(), total, files: sorted }, null, 2) + '\n',
    );
    console.log(`Baseline written → ${path.relative(ROOT, BASELINE)}`);
    console.log(`  ${Object.keys(sorted).length} files, ${total} total violations, ${files.length} files scanned.`);
    return;
  }

  if (args.includes('--list')) {
    const filter = args.includes('--filter') ? args[args.indexOf('--filter') + 1] : null;
    for (const [rel, hits] of Object.entries(detail)) {
      for (const h of hits) {
        const label = `${rel}:${h.line}\t${h.kind}\t${h.match}`;
        if (!filter || label.includes(filter)) console.log(label);
      }
    }
    console.log(`\nTOTAL violations: ${total} across ${Object.keys(perFile).length} files.`);
    return;
  }

  // ── Ratchet gate ──────────────────────────────────────────────────────────
  if (!fs.existsSync(BASELINE)) {
    console.error('No baseline found. Generate it first: npm run check:colors:update');
    process.exit(2);
  }
  const baseline = JSON.parse(fs.readFileSync(BASELINE, 'utf8')).files || {};

  const regressions = [];
  for (const [rel, count] of Object.entries(perFile)) {
    const base = baseline[rel] ?? 0;
    if (count > base) regressions.push({ rel, base, count });
  }

  console.log('VEGAS V7.7 — hardcoded-color ratchet gate');
  console.log(`  scanned ${files.length} files; ${total} total violations (baseline total ${Object.values(baseline).reduce((a, b) => a + b, 0)}).`);

  if (regressions.length === 0) {
    console.log('  PASS — no file grew its color debt above baseline.');
    process.exit(0);
  }

  console.error(`\n  FAIL — ${regressions.length} file(s) introduced NEW hardcoded-color debt:`);
  for (const r of regressions.sort((a, b) => (b.count - b.base) - (a.count - a.base))) {
    console.error(`    ${r.rel}  ${r.base} → ${r.count}  (+${r.count - r.base})`);
  }
  console.error('\n  Use design-system tokens (c.*, crimson/primary/danger/success, CSS vars) instead of raw hex/rgb/palette classes.');
  console.error('  Inspect: node scripts/check-hardcoded-colors.cjs --list --filter <path>');
  console.error('  If this debt is intentional & unavoidable, re-baseline: npm run check:colors:update');
  process.exit(1);
}

main();
