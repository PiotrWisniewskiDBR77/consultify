#!/usr/bin/env node
/**
 * VF0-7 — focus-visibility grep-gate (diff-based, not a baseline ratchet).
 *
 * Removing the browser's default focus ring (`outline-none` Tailwind class, or
 * raw `outline: none` CSS) without supplying a keyboard-focus replacement is a
 * classic a11y regression: mouse users see nothing missing, keyboard users
 * lose all indication of where focus is. The safe pattern pairs the removal
 * with a `focus-visible:` (or `:focus-visible`) rule that restores a ring only
 * for keyboard navigation.
 *
 * Unlike scripts/check-hardcoded-colors.cjs / check-a11y-jsx.cjs (whole-repo
 * baseline ratchet), this gate is DIFF-based: it only inspects lines ADDED
 * relative to a base ref, so it never re-flags pre-existing debt — only NEW
 * `outline-none`/`outline: none` introduced without a `focus-visible`
 * counterpart in the same file's diff. That satisfies "fail on growth, not on
 * existing zero" without needing a baseline JSON at all: existing violations
 * are untouched code, so they never show up as "added" lines.
 *
 * Usage:
 *   node scripts/check-a11y-focus.cjs                     # diff HEAD vs working tree (+ staged)
 *   node scripts/check-a11y-focus.cjs --base origin/demo   # diff against another ref (e.g. in CI)
 *   node scripts/check-a11y-focus.cjs --base HEAD~5 --list # show every flagged added line
 */
const { execFileSync } = require('child_process');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

const OUTLINE_NONE_RE = /(?:\boutline-none\b|\boutline\s*:\s*none\b)/;
const FOCUS_VISIBLE_RE = /focus-visible/;

function parseArgs(argv) {
  let base = 'HEAD';
  let list = false;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--base') base = argv[++i];
    else if (argv[i] === '--list') list = true;
  }
  return { base, list };
}

function git(args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 1024 * 1024 * 64 });
}

// Parses `git diff --unified=0 <base> -- <pathspecs>` output into
// { file -> [{ line, text }] } for ADDED lines only ('+' prefixed, not '+++').
function parseAddedLines(diffText) {
  const perFile = {};
  let currentFile = null;
  let newLineNo = 0;
  for (const raw of diffText.split('\n')) {
    if (raw.startsWith('+++ b/')) {
      currentFile = raw.slice(6);
      perFile[currentFile] = perFile[currentFile] || [];
      continue;
    }
    if (raw.startsWith('@@')) {
      const m = raw.match(/@@ -\d+(?:,\d+)? \+(\d+)/);
      newLineNo = m ? Number(m[1]) : 0;
      continue;
    }
    if (currentFile === null) continue;
    if (raw.startsWith('+++') || raw.startsWith('---')) continue;
    if (raw.startsWith('+')) {
      perFile[currentFile].push({ line: newLineNo, text: raw.slice(1) });
      newLineNo++;
    } else if (raw.startsWith('-')) {
      // removed line, doesn't advance new-file line counter
    } else {
      newLineNo++;
    }
  }
  return perFile;
}

function main() {
  const { base, list } = parseArgs(process.argv.slice(2));

  let diffText;
  try {
    diffText = git([
      'diff',
      '--unified=0',
      '--no-color',
      base,
      '--',
      '*.ts',
      '*.tsx',
      '*.css',
      '*.js',
      '*.jsx',
    ]);
  } catch (err) {
    console.error(`git diff against '${base}' failed: ${err.message}`);
    process.exit(2);
  }

  const perFile = parseAddedLines(diffText);

  const violations = [];
  for (const [file, lines] of Object.entries(perFile)) {
    const addedOutlineNone = lines.filter((l) => OUTLINE_NONE_RE.test(l.text));
    if (addedOutlineNone.length === 0) continue;
    // A focus-visible replacement anywhere among this file's ADDED lines counts
    // (attribute/class may live on the same or a nearby line in the same edit).
    const hasFocusVisibleAdded = lines.some((l) => FOCUS_VISIBLE_RE.test(l.text));
    if (hasFocusVisibleAdded) continue;
    for (const hit of addedOutlineNone) {
      violations.push({ file, line: hit.line, text: hit.text.trim() });
    }
  }

  console.log(`VF0-7 — focus-visibility gate (diff vs '${base}')`);
  console.log(`  ${Object.keys(perFile).length} file(s) changed; ${violations.length} new outline-none without focus-visible.`);

  if (list) {
    for (const v of violations) console.log(`  ${v.file}:${v.line}\t${v.text}`);
  }

  if (violations.length === 0) {
    console.log('  PASS — no new outline removal without a focus-visible replacement.');
    process.exit(0);
  }

  console.error(`\n  FAIL — ${violations.length} new outline-none/outline:none without focus-visible:`);
  for (const v of violations) {
    console.error(`    ${v.file}:${v.line}  ${v.text}`);
  }
  console.error('\n  Pair the removal with a focus-visible: ring (e.g. focus-visible:ring-2 focus-visible:ring-c-focus)');
  console.error('  so keyboard users keep a focus indicator. See docs/ui-standards CANON focus tokens (c-focus).');
  process.exit(1);
}

main();
