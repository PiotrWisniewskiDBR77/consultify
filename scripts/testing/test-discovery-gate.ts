/**
 * STREAM 6 (2026-08-13) — discovery gate.
 *
 * Compares FOUR sets:
 *   1. discovered  — every test/spec file (*.test.ts etc, *.spec.ts etc) tracked in git
 *   2. classified  — every file with an entry in test-inventory.json
 *   3. executed    — every file actually collected by a configured runner
 *                    (vitest.config.ts / vitest.acceptance.config.ts /
 *                    vitest.orphans.config.ts / node:test / playwright)
 *   4. deliberately excluded — classified INTENTIONALLY_EXCLUDED, LEGACY,
 *      or PLAYWRIGHT/BROKEN_ORPHAN in the manifest (i.e. NOT expected in
 *      the "executed" set for vitest's sake)
 *
 * FAILS when:
 *   (a) a discovered file has no manifest entry (`UNCLASSIFIED`), or
 *   (b) a file classified ACTIVE in the manifest is not actually collected
 *       by any of the wired runners (`ACTIVE_BUT_NOT_EXECUTED`).
 *
 * This is a pure function (`runDiscoveryGate`) over injectable sets, so it
 * can be exercised with synthetic data in a unit test without touching the
 * real repo tree — see tests/unit/testing/testDiscoveryGate.test.ts for the
 * permanent negative-control regression test, and
 * docs/program/METHOD_TOOLS_2026-08-13/TEST_INVENTORY.md §"Negative control"
 * for the one-time manual proof against the real tree (add a throwaway
 * unclassified file, watch this gate name it, remove the file).
 *
 * CLI usage:
 *   npx tsx scripts/testing/test-discovery-gate.ts
 * Exits 1 and prints every offending path on failure.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, '../..');

const TEST_FILE_RE = /\.(test|spec)\.(ts|tsx|js|jsx|mjs)$/;

export interface ManifestEntry {
  path: string;
  classification: 'ACTIVE' | 'PLAYWRIGHT' | 'LEGACY' | 'INTENTIONALLY_EXCLUDED' | 'BROKEN_ORPHAN';
  reason: string;
  runner?: string;
}

export interface Manifest {
  entries: ManifestEntry[];
}

export interface GateInput {
  /** Every discovered test/spec file path (repo-relative). */
  discovered: string[];
  /** The classification manifest. */
  manifest: Manifest;
  /** Every file path actually collected/executed by a configured runner. */
  executed: Set<string>;
}

export interface GateResult {
  ok: boolean;
  unclassified: string[];
  activeButNotExecuted: string[];
  manifestEntriesForMissingFiles: string[];
}

export function runDiscoveryGate(input: GateInput): GateResult {
  const { discovered, manifest, executed } = input;
  const byPath = new Map(manifest.entries.map((e) => [e.path, e]));

  const unclassified: string[] = [];
  const activeButNotExecuted: string[] = [];

  for (const p of discovered) {
    const entry = byPath.get(p);
    if (!entry) {
      unclassified.push(p);
      continue;
    }
    if (entry.classification === 'ACTIVE' && !executed.has(p)) {
      activeButNotExecuted.push(p);
    }
  }

  // Also flag manifest entries pointing at files that no longer exist on
  // disk (stale manifest) — not a hard failure condition by default, but
  // surfaced for visibility.
  const discoveredSet = new Set(discovered);
  const manifestEntriesForMissingFiles = manifest.entries
    .map((e) => e.path)
    .filter((p) => !discoveredSet.has(p));

  return {
    ok: unclassified.length === 0 && activeButNotExecuted.length === 0,
    unclassified: unclassified.sort(),
    activeButNotExecuted: activeButNotExecuted.sort(),
    manifestEntriesForMissingFiles: manifestEntriesForMissingFiles.sort(),
  };
}

// ---- real-repo data gathering (used by the CLI + by the "against real
// repo" test in testDiscoveryGate.test.ts) -----------------------------

function sh(cmd: string, args: string[]): string {
  return execFileSync(cmd, args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}

export function discoverRealFiles(): string[] {
  const out = sh('git', ['ls-files']);
  return out
    .split('\n')
    .filter(Boolean)
    .filter((p) => TEST_FILE_RE.test(p))
    .sort();
}

export function loadRealManifest(): Manifest {
  const p = path.join(ROOT, 'docs/program/METHOD_TOOLS_2026-08-13/test-inventory.json');
  const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
  return { entries: raw.entries };
}

function vitestList(config: string): string[] {
  const out = sh('npx', ['vitest', 'list', '--filesOnly', '--config', config]);
  return out
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('EXIT'))
    .map((l) => path.relative(ROOT, path.resolve(ROOT, l)));
}

/**
 * Real "executed" set. NOTE: for the vitest-collected configs this asks
 * vitest to COLLECT (parse + list) every file, not RUN it — cheap and
 * deterministic, unlike spawning the full multi-minute regression run. For
 * classifications that are inherently not vitest-collectible (PLAYWRIGHT /
 * LEGACY / INTENTIONALLY_EXCLUDED / BROKEN_ORPHAN), the gate does not
 * require the file to appear here at all — only ACTIVE entries are checked
 * against this set.
 */
export function computeRealExecutedSet(): Set<string> {
  const sets = [
    vitestList('vitest.config.ts'),
    vitestList('vitest.acceptance.config.ts'),
    vitestList('vitest.orphans.config.ts'),
    // node:test-run file(s), wired via `npm run test:node-native`.
    ['scripts/testing/__tests__/artifact-studio-release-evidence-gate.test.mjs'],
  ];
  return new Set(sets.flat());
}

function main() {
  const discovered = discoverRealFiles();
  const manifest = loadRealManifest();
  const executed = computeRealExecutedSet();

  const result = runDiscoveryGate({ discovered, manifest, executed });

  console.log(`Discovered: ${discovered.length}`);
  console.log(`Manifest entries: ${manifest.entries.length}`);
  console.log(`Executed (vitest-collected + node:test): ${executed.size}`);

  if (result.unclassified.length > 0) {
    console.error(`\nUNCLASSIFIED (${result.unclassified.length}) — discovered but no manifest entry:`);
    for (const p of result.unclassified) console.error(`  ${p}`);
  }
  if (result.activeButNotExecuted.length > 0) {
    console.error(`\nACTIVE_BUT_NOT_EXECUTED (${result.activeButNotExecuted.length}) — classified ACTIVE but no configured runner collects it:`);
    for (const p of result.activeButNotExecuted) console.error(`  ${p}`);
  }
  if (result.manifestEntriesForMissingFiles.length > 0) {
    console.warn(`\nSTALE MANIFEST ENTRIES (${result.manifestEntriesForMissingFiles.length}) — in manifest but not found on disk (informational, not a failure):`);
    for (const p of result.manifestEntriesForMissingFiles) console.warn(`  ${p}`);
  }

  if (result.ok) {
    console.log('\nDiscovery gate: PASS');
  } else {
    console.error('\nDiscovery gate: FAIL');
    process.exitCode = 1;
  }
}

// Only run when executed directly (not when imported by tests).
const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMain) {
  main();
}
