#!/usr/bin/env npx tsx
/**
 * STREAM 6 (2026-08-13) — test discovery + classification.
 *
 * Regenerates docs/program/METHOD_TOOLS_2026-08-13/test-inventory.json:
 * every test/spec file discovered on disk, mapped to exactly one bucket
 * (ACTIVE | PLAYWRIGHT | LEGACY | INTENTIONALLY_EXCLUDED | BROKEN_ORPHAN)
 * with a one-line reason. This manifest is the ground truth the discovery
 * gate (scripts/testing/test-discovery-gate.ts) checks against.
 *
 * Run: npx tsx scripts/testing/generate-test-inventory.ts
 *
 * Classification is derived from REAL collection, not path guessing:
 *  - ACTIVE: file is returned by `vitest list --filesOnly` for one of the
 *    wired configs (vitest.config.ts / vitest.acceptance.config.ts /
 *    vitest.orphans.config.ts), or is the one node:test file wired via
 *    `npm run test:node-native`.
 *  - PLAYWRIGHT: file textually imports '@playwright/test' (content check,
 *    not a path guess — see tests/e2e/security-cookie-auth.spec.ts, which
 *    LOOKS like a playwright spec by path but is not one).
 *  - INTENTIONALLY_EXCLUDED / LEGACY / BROKEN_ORPHAN: everything left over,
 *    resolved by the MANUAL_OVERRIDES table below with a citable reason.
 *    A file landing here with NO override is a bug in this script — the
 *    gate will fail on it (fail-closed, see UNRESOLVED bucket).
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');

const TEST_FILE_RE = /\.(test|spec)\.(ts|tsx|js|jsx|mjs)$/;

function sh(cmd: string, args: string[]): string {
  return execFileSync(cmd, args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}

/**
 * Discovery source = `git ls-files` (tracked files only), filtered to the
 * test/spec naming convention. Deliberately NOT a raw filesystem walk: this
 * repo has a gitignored `server/src/_backup/**` snapshot tree (ts/js
 * collision backups) containing files that match `*.test.js` by name but
 * were never part of the real test corpus — `git ls-files` excludes them
 * the same way `rg --files` (which respects .gitignore) does, keeping this
 * consistent with the STREAM 6 baseline measurement (~4215 files via rg).
 * Also avoids depending on a real `rg` binary on PATH — in this harness
 * `rg` is shadowed by a shell function, not the actual ripgrep executable,
 * so `execFileSync('rg', ...)` fails with ENOENT.
 */
function discoverAll(): string[] {
  const out = sh('git', ['ls-files']);
  return out
    .split('\n')
    .filter(Boolean)
    .filter((p) => TEST_FILE_RE.test(p))
    .sort();
}

function vitestList(config: string): Set<string> {
  const out = sh('npx', ['vitest', 'list', '--filesOnly', '--config', config]);
  return new Set(
    out
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('EXIT'))
      .map((l) => path.relative(ROOT, path.resolve(ROOT, l)))
  );
}

function playwrightImporters(all: string[]): Set<string> {
  const result = new Set<string>();
  for (const p of all) {
    let content: string;
    try {
      content = fs.readFileSync(path.join(ROOT, p), 'utf8');
    } catch {
      continue;
    }
    if (content.includes('@playwright/test')) result.add(p);
  }
  return result;
}

interface Entry {
  path: string;
  classification: 'ACTIVE' | 'PLAYWRIGHT' | 'LEGACY' | 'INTENTIONALLY_EXCLUDED' | 'BROKEN_ORPHAN';
  reason: string;
  runner?: string;
}

/**
 * Manual overrides: files whose correct bucket cannot be derived purely from
 * "is it collected by a wired vitest config" / "does it import playwright".
 * Every entry here was individually investigated during the 2026-08-13
 * STREAM 6 sprint — see docs/program/METHOD_TOOLS_2026-08-13/TEST_INVENTORY.md
 * for the full narrative per file.
 */
const MANUAL_OVERRIDES: Record<string, { classification: Entry['classification']; reason: string; runner?: string }> = {
  'tests/unit/backend/services/StageGateService.test.ts': {
    classification: 'INTENTIONALLY_EXCLUDED',
    reason: "Explicit exclude in vitest.config.ts: duplicate of the .js version, which is the one that runs.",
  },
  'server/tests/virtual-workers-integration.test.ts': {
    classification: 'LEGACY',
    reason: 'Not a vitest suite (hand-rolled test() helper, needs a live server on :3001, ends with process.exit). "No test suite found" under vitest. Run manually: tsx server/tests/virtual-workers-integration.test.ts.',
  },
  'tests/e2e/security-cookie-auth.spec.ts': {
    classification: 'BROKEN_ORPHAN',
    reason: 'Genuine vitest suite (imports describe/it from vitest, not @playwright/test) sitting inside the playwright testDir (tests/e2e). vitest.config.ts excludes tests/e2e/** wholesale; `playwright test --list` finds 0 tests in it (no playwright test() calls). Invisible to BOTH runners. When run standalone: 7/11 fail (production-guard tests mutate process.env.NODE_ENV at runtime, but auth.middleware.ts:27 caches isProductionEnv at module load, so the guard never re-evaluates — the test cannot validate what it claims to). Needs owner triage; not fixed in this test-discovery sprint.',
  },
  'scripts/testing/__tests__/artifact-studio-release-evidence-gate.test.mjs': {
    classification: 'ACTIVE',
    reason: 'node:test suite (not vitest) for scripts/testing/artifact-studio-release-evidence-gate.mjs. Wired 2026-08-13 via npm run test:node-native.',
    runner: 'node --test (npm run test:node-native)',
  },
};

async function main() {
  const all = discoverAll();

  const defaultSet = vitestList('vitest.config.ts');
  const acceptanceSet = vitestList('vitest.acceptance.config.ts');
  const orphansSet = vitestList('vitest.orphans.config.ts');
  const pwSet = playwrightImporters(all);

  const entries: Entry[] = [];
  const unresolved: string[] = [];

  for (const p of all) {
    if (MANUAL_OVERRIDES[p]) {
      const o = MANUAL_OVERRIDES[p];
      entries.push({ path: p, classification: o.classification, reason: o.reason, runner: o.runner });
      continue;
    }
    if (p.startsWith('server/src/_backup/')) {
      // Tracked-but-gitignored ts/js-collision snapshot tree. `git ls-files`
      // still lists it (gitignore doesn't retroactively untrack); vitest.config.ts
      // explicitly excludes it (`server/src/_backup/**`, comment: "never run as
      // live tests"). One deliberate exclusion covers the whole subtree.
      entries.push({
        path: p,
        classification: 'INTENTIONALLY_EXCLUDED',
        reason: 'Under server/src/_backup/** — explicit blanket exclude in vitest.config.ts ("Backup tree (ts/js collision snapshots) — never run as live tests"). Tracked-but-gitignored (pre-dates the .gitignore rule), not deleted because it is a historical reference snapshot.',
      });
      continue;
    }
    if (defaultSet.has(p)) {
      entries.push({ path: p, classification: 'ACTIVE', reason: 'Collected by default vitest.config.ts.', runner: 'vitest.config.ts (npm run test:unit / test:component / test:integration / ...)' });
      continue;
    }
    if (acceptanceSet.has(p)) {
      entries.push({ path: p, classification: 'ACTIVE', reason: 'Collected by vitest.acceptance.config.ts.', runner: 'vitest.acceptance.config.ts (npm run test:acceptance)' });
      continue;
    }
    if (orphansSet.has(p)) {
      entries.push({ path: p, classification: 'ACTIVE', reason: 'Collected by vitest.orphans.config.ts (server/tests + tests/simple_import.test.js, wired 2026-08-13).', runner: 'vitest.orphans.config.ts (npm run test:orphans)' });
      continue;
    }
    if (pwSet.has(p)) {
      entries.push({ path: p, classification: 'PLAYWRIGHT', reason: 'Imports @playwright/test; runs under the Playwright test runner, not vitest.', runner: 'playwright test (various playwright*.config.ts)' });
      continue;
    }
    unresolved.push(p);
  }

  for (const p of unresolved) {
    entries.push({
      path: p,
      classification: 'BROKEN_ORPHAN',
      reason: 'UNRESOLVED by generate-test-inventory.ts: not collected by any wired vitest config, does not import @playwright/test, and has no manual override. Investigate and either wire it or add a MANUAL_OVERRIDES entry.',
    });
  }

  entries.sort((a, b) => a.path.localeCompare(b.path));

  const counts: Record<string, number> = {};
  for (const e of entries) counts[e.classification] = (counts[e.classification] ?? 0) + 1;

  const manifest = {
    generatedAt: new Date().toISOString(),
    generatedBy: 'scripts/testing/generate-test-inventory.ts',
    totalDiscovered: entries.length,
    counts,
    unresolvedCount: unresolved.length,
    entries,
  };

  const outPath = path.join(ROOT, 'docs/program/METHOD_TOOLS_2026-08-13/test-inventory.json');
  fs.writeFileSync(outPath, JSON.stringify(manifest, null, 2) + '\n');

  console.log(`Wrote ${entries.length} entries to ${path.relative(ROOT, outPath)}`);
  console.log(JSON.stringify(counts, null, 2));
  if (unresolved.length > 0) {
    console.error(`\n${unresolved.length} file(s) UNRESOLVED (no override, not collected anywhere):`);
    for (const p of unresolved) console.error(`  ${p}`);
    process.exitCode = 1;
  }
}

main();
