#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * light-mode-contrast.cjs
 *
 * Safe, mode-aware codemod that fixes light-mode legibility by remapping the
 * UNPREFIXED Tailwind utility classes for text/border to higher-contrast
 * shades. It deliberately leaves variant-prefixed forms (e.g. `dark:`,
 * `hover:`, `focus:`, `group-hover:`, `placeholder:`, `peer-…:`, etc.) alone
 * because the negative lookbehind on `:` disqualifies them.
 *
 * Scope:
 *   src/**\/*.{ts,tsx,js,jsx,css}
 *   EXCLUDES src/components/Landing/**, node_modules, dist, .next, build
 *
 * Rules (applied to the bare class only):
 *   text-slate-400  -> text-slate-600
 *   text-slate-300  -> text-slate-600
 *   text-gray-400   -> text-gray-600
 *   text-gray-300   -> text-gray-600
 *   text-zinc-400   -> text-zinc-600
 *   text-zinc-300   -> text-zinc-600
 *   text-neutral-400 -> text-neutral-600
 *   text-neutral-300 -> text-neutral-600
 *   border-slate-100 -> border-slate-200
 *   divide-slate-100 -> divide-slate-200
 *   border-gray-100  -> border-gray-200
 *
 * Boundary semantics (per rule):
 *   - Left:  (?<![\w:-])   — char before MUST NOT be a word char, `-`, or `:`.
 *                            This blocks dark:/hover:/placeholder: prefixes,
 *                            and prevents matching inside longer identifiers.
 *   - Right: \b            — word boundary, so `text-slate-400/50` is NOT hit
 *                            (slash is non-word, but the trailing digits stay
 *                            untouched because we don't capture beyond \b).
 *
 * Usage:
 *   node scripts/codemods/light-mode-contrast.cjs           # write
 *   node scripts/codemods/light-mode-contrast.cjs --dry     # preview only
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const DRY_RUN = process.argv.includes('--dry');

const RULES = [
  { from: 'text-slate-400', to: 'text-slate-600' },
  { from: 'text-slate-300', to: 'text-slate-600' },
  { from: 'text-gray-400',  to: 'text-gray-600'  },
  { from: 'text-gray-300',  to: 'text-gray-600'  },
  { from: 'text-zinc-400',  to: 'text-zinc-600'  },
  { from: 'text-zinc-300',  to: 'text-zinc-600'  },
  { from: 'text-neutral-400', to: 'text-neutral-600' },
  { from: 'text-neutral-300', to: 'text-neutral-600' },
  { from: 'border-slate-100', to: 'border-slate-200' },
  { from: 'divide-slate-100', to: 'divide-slate-200' },
  { from: 'border-gray-100',  to: 'border-gray-200'  },
];

const EXTS = new Set(['.ts', '.tsx', '.js', '.jsx', '.css']);
const EXCLUDE_DIR_NAMES = new Set([
  'node_modules', 'dist', '.next', 'build', '.git', 'coverage', '.turbo',
]);
const EXCLUDE_PATH_FRAGMENTS = [
  // Posix-style fragment; we normalize to forward slashes before compare.
  'src/components/Landing/',
];

function listFiles(rootRel) {
  const out = [];
  const rootAbs = path.join(REPO_ROOT, rootRel);
  if (!fs.existsSync(rootAbs)) return out;
  const stack = [rootAbs];
  while (stack.length) {
    const cur = stack.pop();
    let ents;
    try {
      ents = fs.readdirSync(cur, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const ent of ents) {
      const full = path.join(cur, ent.name);
      if (ent.isDirectory()) {
        if (EXCLUDE_DIR_NAMES.has(ent.name)) continue;
        stack.push(full);
        continue;
      }
      if (!ent.isFile()) continue;
      if (!EXTS.has(path.extname(ent.name))) continue;
      const rel = path.relative(REPO_ROOT, full).split(path.sep).join('/');
      if (EXCLUDE_PATH_FRAGMENTS.some((frag) => rel.includes(frag))) continue;
      out.push(full);
    }
  }
  return out;
}

function buildRegex(token) {
  // Escape `-` for safety; lookbehind blocks word char, `-`, or `:`.
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?<![\\w:-])${escaped}\\b`, 'g');
}

const COMPILED = RULES.map((r) => ({ ...r, re: buildRegex(r.from) }));

function processFile(absPath, perRule, perFileCounts) {
  const src = fs.readFileSync(absPath, 'utf8');
  let out = src;
  let fileTotal = 0;
  for (const rule of COMPILED) {
    let count = 0;
    out = out.replace(rule.re, () => {
      count += 1;
      return rule.to;
    });
    if (count > 0) {
      perRule[rule.from] = (perRule[rule.from] || 0) + count;
      fileTotal += count;
    }
  }
  if (fileTotal > 0) {
    perFileCounts.push({ file: path.relative(REPO_ROOT, absPath), count: fileTotal });
    if (!DRY_RUN && out !== src) {
      fs.writeFileSync(absPath, out, 'utf8');
    }
  }
  return fileTotal;
}

function fmtTable(rows, headers) {
  const widths = headers.map((h, i) =>
    Math.max(h.length, ...rows.map((r) => String(r[i]).length))
  );
  const fmtRow = (r) => r.map((c, i) => String(c).padEnd(widths[i])).join('  ');
  const sep = widths.map((w) => '-'.repeat(w)).join('  ');
  return [fmtRow(headers), sep, ...rows.map(fmtRow)].join('\n');
}

function main() {
  const files = listFiles('src');
  console.log(`Scanning ${files.length} files under src/ (excluding Landing)…`);
  const perRule = {};
  const perFile = [];
  let totalEdits = 0;
  for (const f of files) totalEdits += processFile(f, perRule, perFile);

  const ruleRows = RULES.map((r) => [r.from, '->', r.to, perRule[r.from] || 0]);
  console.log('\nReplacements per rule:');
  console.log(fmtTable(ruleRows, ['from', '', 'to', 'count']));

  perFile.sort((a, b) => b.count - a.count);
  console.log(`\nFiles touched: ${perFile.length} (total edits: ${totalEdits})`);
  console.log('Top 15 files by edits:');
  console.log(
    fmtTable(
      perFile.slice(0, 15).map((r) => [r.count, r.file]),
      ['edits', 'file']
    )
  );

  if (DRY_RUN) {
    console.log('\nDRY RUN — no files written.');
  } else {
    console.log('\nWrites complete.');
  }

  // Emit machine-readable summary for downstream tooling.
  const summary = { dryRun: DRY_RUN, totalEdits, perRule, perFile };
  const summaryPath = path.join(REPO_ROOT, 'scripts', 'codemods', 'light-mode-contrast.last-run.json');
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
  console.log(`Summary JSON: ${path.relative(REPO_ROOT, summaryPath)}`);
}

main();
