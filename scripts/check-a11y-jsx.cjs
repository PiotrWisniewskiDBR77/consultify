#!/usr/bin/env node
/**
 * VF0-7 — a11y (jsx-a11y-style) RATCHET gate.
 *
 * `eslint-plugin-jsx-a11y` is NOT installed in this repo's node_modules today
 * (checked 2026-07-19 — not in package.json, not in node_modules, not a
 * transitive dep). Installing it requires a real `npm install` that touches
 * the shared node_modules tree — out of scope for a mechanical-gate worker
 * task on a shared worktree. TODO(a11y): once the plugin is added for real
 * (flat-config `jsxA11y.flatConfigs.recommended` + `plugins: { 'jsx-a11y': ... }`
 * in eslint.config.js), retire this standalone scanner in favour of the real
 * ESLint rule set — it covers far more than the 4 checks below.
 *
 * Until then, this script emulates the highest-value jsx-a11y rules with a
 * regex/tag scan over src/**\/*.tsx (same ratchet architecture as
 * scripts/check-hardcoded-colors.cjs):
 *   1. img-alt            — <img> with no `alt` attribute at all
 *   2. img-redundant-alt   — alt text that redundantly says "image/photo/picture"
 *   3. no-autofocus        — autoFocus JSX attribute
 *   4. tabindex-positive   — tabIndex value > 0 (WCAG: never use positive tabindex)
 *   5. click-events-have-key-events — onClick on a non-interactive tag
 *      (div/span/li/td/tr/section/article/p) with no onKeyDown/onKeyUp/onKeyPress
 *      and no `role` attribute
 *
 * RATCHET, not zero-gate: a baseline JSON holds the per-file violation count.
 * The gate FAILS only for files whose count ROSE above baseline (or brand-new
 * files that introduce any violation). Reducing debt is always allowed.
 *
 * Usage:
 *   node scripts/check-a11y-jsx.cjs               # gate (CI): fail on regressions
 *   node scripts/check-a11y-jsx.cjs --update      # (re)write the baseline
 *   node scripts/check-a11y-jsx.cjs --list        # list every violation
 *   node scripts/check-a11y-jsx.cjs --filter x    # restrict --list to path/line substring
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const BASELINE = path.join(__dirname, 'a11y-jsx.baseline.json');

const EXCLUDE_DIRS = new Set(['node_modules', '__tests__', '__mocks__', '__snapshots__']);
const EXCLUDE_FILE_RE = /\.(test|spec|stories|d)\.tsx?$/;

function walk(dir, acc) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (EXCLUDE_DIRS.has(entry.name)) continue;
      walk(p, acc);
    } else if (/\.tsx$/.test(entry.name) && !EXCLUDE_FILE_RE.test(entry.name)) {
      acc.push(p);
    }
  }
  return acc;
}

function lineOf(text, index) {
  let line = 1;
  for (let i = 0; i < index; i++) if (text.charCodeAt(i) === 10) line++;
  return line;
}

// Matches one JSX opening/self-closing tag: `<tagname ...attrs.../>` or `<tagname ...attrs>`
// Non-greedy across newlines (multi-line JSX attrs are common).
function tagRe(name) {
  return new RegExp(`<${name}\\b([\\s\\S]*?)(/?>)`, 'g');
}

const NON_INTERACTIVE_TAGS = ['div', 'span', 'li', 'td', 'tr', 'section', 'article', 'p'];

function countViolations(text) {
  const hits = [];

  // 1 + 2: <img ...>
  {
    const re = tagRe('img');
    let m;
    while ((m = re.exec(text)) !== null) {
      const attrs = m[1];
      const altMatch = attrs.match(/\balt\s*=\s*(?:"([^"]*)"|'([^']*)'|\{([^}]*)\})/);
      if (!altMatch) {
        hits.push({ line: lineOf(text, m.index), kind: 'img-alt', match: '<img> missing alt' });
      } else {
        const altText = (altMatch[1] ?? altMatch[2] ?? altMatch[3] ?? '').toLowerCase();
        if (/\b(image|photo|picture)\b/.test(altText)) {
          hits.push({ line: lineOf(text, m.index), kind: 'img-redundant-alt', match: `alt="${altText}"` });
        }
      }
    }
  }

  // 3: autoFocus
  {
    const re = /\bautoFocus\b(?:\s*=\s*(?:\{[^}]*\}|"[^"]*"|'[^']*'))?/g;
    let m;
    while ((m = re.exec(text)) !== null) {
      hits.push({ line: lineOf(text, m.index), kind: 'no-autofocus', match: 'autoFocus' });
    }
  }

  // 4: tabIndex positive (explicit literal > 0; tabIndex={0}/{-1}/"0"/"-1" are fine)
  {
    const re = /\btabIndex\s*=\s*(?:\{(-?\d+)\}|"(-?\d+)"|'(-?\d+)')/g;
    let m;
    while ((m = re.exec(text)) !== null) {
      const val = Number(m[1] ?? m[2] ?? m[3]);
      if (val > 0) {
        hits.push({ line: lineOf(text, m.index), kind: 'tabindex-positive', match: `tabIndex=${val}` });
      }
    }
  }

  // 5: onClick on non-interactive tag without keyboard handler / role
  for (const tag of NON_INTERACTIVE_TAGS) {
    const re = tagRe(tag);
    let m;
    while ((m = re.exec(text)) !== null) {
      const attrs = m[1];
      if (!/\bonClick\s*=/.test(attrs)) continue;
      const hasKeyHandler = /\bonKey(Down|Up|Press)\s*=/.test(attrs);
      const hasRole = /\brole\s*=/.test(attrs);
      if (!hasKeyHandler && !hasRole) {
        hits.push({
          line: lineOf(text, m.index),
          kind: 'click-events-have-key-events',
          match: `<${tag}> onClick without onKeyDown/role`,
        });
      }
    }
  }

  return { total: hits.length, hits: hits.sort((a, b) => a.line - b.line) };
}

function scan() {
  const files = walk(SRC, []);
  const perFile = {};
  const detail = {};
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
      JSON.stringify(
        {
          _comment:
            'VF0-7 a11y (jsx-a11y-style) ratchet baseline. Regenerate: npm run check:a11y-jsx:update',
          generatedAt: new Date().toISOString(),
          total,
          files: sorted,
        },
        null,
        2,
      ) + '\n',
    );
    console.log(`Baseline written -> ${path.relative(ROOT, BASELINE)}`);
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

  if (!fs.existsSync(BASELINE)) {
    console.error('No baseline found. Generate it first: npm run check:a11y-jsx:update');
    process.exit(2);
  }
  const baseline = JSON.parse(fs.readFileSync(BASELINE, 'utf8')).files || {};

  const regressions = [];
  for (const [rel, count] of Object.entries(perFile)) {
    const base = baseline[rel] ?? 0;
    if (count > base) regressions.push({ rel, base, count });
  }

  console.log('VF0-7 — a11y (jsx-a11y-style) ratchet gate');
  console.log(
    `  scanned ${files.length} files; ${total} total violations (baseline total ${Object.values(baseline).reduce((a, b) => a + b, 0)}).`,
  );

  if (regressions.length === 0) {
    console.log('  PASS — no file grew its a11y debt above baseline.');
    process.exit(0);
  }

  console.error(`\n  FAIL — ${regressions.length} file(s) introduced NEW a11y debt:`);
  for (const r of regressions.sort((a, b) => b.count - b.base - (a.count - a.base))) {
    console.error(`    ${r.rel}  ${r.base} -> ${r.count}  (+${r.count - r.base})`);
  }
  console.error('\n  Fix: add alt text, remove autoFocus/positive tabIndex, add onKeyDown+role to clickable divs.');
  console.error('  Inspect: node scripts/check-a11y-jsx.cjs --list --filter <path>');
  console.error('  If this debt is intentional & unavoidable, re-baseline: npm run check:a11y-jsx:update');
  process.exit(1);
}

main();
