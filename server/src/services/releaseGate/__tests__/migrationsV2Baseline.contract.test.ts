/**
 * migrations-v2 baseline — architectural classification contract.
 *
 * CLASSIFICATION (2026-08-13 forensic pass): LEGACY_REFERENCE_ONLY.
 *
 *   `server/migrations-v2/001_baseline_20260413.sql` is an 86,006-line
 *   `pg_dump --schema-only` snapshot of PRODUCTION taken 2026-04-13 (~1711 tables). It is:
 *     - NOT executed by any runner or entry point in this repo (migrate.postgres.ts,
 *       migrate.ts, v8-migrate.ts, run-migrations-staging.cjs, release-migration-gate.ts,
 *       DatabaseInitializer.ts, tablePlatform/migrationRunner.ts, server/src/index.ts, and every
 *       package.json `db:migrate*` script all hard-resolve to `server/migrations`, never
 *       `migrations-v2`; no env var or config redirects any of them there).
 *     - NOT shipped in the production Docker image (Dockerfile.api's final `api` stage only
 *       copies `/app/migrations` — built from `server/migrations` — into `/app/server/migrations`;
 *       there is no COPY of `migrations-v2` in any final stage).
 *     - Explicitly excluded from Railway build context by `.railwayignore`
 *       (`/server/migrations-v2/` and `/server/migrations-v2/**`).
 *     - Actively CITED (not executed) as ground truth for the real production schema by comments
 *       in `server/src/services/usageService.ts`, `dataRetentionAdminService.ts`,
 *       `results/kpiRecoveryCardService.ts`, `src/components/DiscoveryTools/KnownToolDetailView.tsx`,
 *       and by numerous headers inside CURRENTLY-active files under `server/migrations/*.sql`
 *       (e.g. `20260813_rvn_kpi_initiative_impacts.sql`, dated the same day as this test) — i.e.
 *       engineers keep reading it to verify what columns/tables already exist on production
 *       before writing a new additive migration in `server/migrations/`.
 *
 *   Note: `server/migrations/README.md` claims "New migrations live in `server/migrations-v2/`"
 *   and `server/migrations-archive/README.md` repeats that claim. This is STALE / CONTRADICTED
 *   BY PRACTICE: `server/migrations-v2/` has had no new dated file since 2026-04-15 (last file
 *   `038_health_panel_probe_cache.sql`), while `server/migrations/` is the directory every runner
 *   above actually reads and where new migrations keep landing daily (891 files as of this test,
 *   including several dated today). Do not use those two README files as evidence of current
 *   behavior — they describe an intent that was never carried out.
 *
 * Changing this classification (e.g. actually wiring migrations-v2 into the release/runtime
 * path, or deleting it) requires an explicit CTO decision — see CLAUDE.md "ZŁOTE REGUŁY" on
 * verifying real runtime over docs, and the demo-safety rules around what may reach a deploy
 * pipeline. This suite exists to make any accidental re-wiring fail loudly, not to preserve the
 * file for its own sake.
 *
 * Deliberately narrow: fs + path + vitest only. No DB, no network, no process spawn.
 * MUST be run from the repo root (colocated `server/` tests rely on process.cwd() == repo root):
 *   cd <repo root> && ./node_modules/.bin/vitest run --no-file-parallelism \
 *     server/src/services/releaseGate/__tests__/migrationsV2Baseline.contract.test.ts
 */
import fs from 'fs';
import path from 'path';

import { describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(process.cwd());

const BASELINE_FILE = path.resolve(
  REPO_ROOT,
  'server/migrations-v2/001_baseline_20260413.sql'
);

const RAILWAY_CONFIG_FILES = ['railway.json', 'railway.api.json', 'railway.frontend.json'] as const;

const PACKAGE_JSON_FILES = ['package.json', 'server/package.json'] as const;

/** Directories whose EXECUTABLE code must never reference migrations-v2 (comments are fine). */
const EXECUTABLE_SCAN_DIRS = ['server/scripts', 'server/src/startup'] as const;

/**
 * Strip // line comments and /* block comments *\/ from a TypeScript/JavaScript source string so
 * we can assert on EXECUTABLE code only. Deliberately simple (no string-literal awareness) — that
 * bias only makes the check stricter (a `migrations-v2` substring inside a string literal would
 * still be flagged, which is the safe direction for a guard like this).
 */
function stripComments(source: string): string {
  const withoutBlockComments = source.replace(/\/\*[\s\S]*?\*\//g, '');
  return withoutBlockComments
    .split('\n')
    .map((line) => {
      const idx = line.indexOf('//');
      return idx === -1 ? line : line.slice(0, idx);
    })
    .join('\n');
}

function listFilesRecursive(dir: string): string[] {
  const abs = path.resolve(REPO_ROOT, dir);
  if (!fs.existsSync(abs)) return [];
  const out: string[] = [];
  const stack = [abs];
  while (stack.length) {
    const current = stack.pop() as string;
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === '__tests__') continue;
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
      } else if (/\.(ts|tsx|js|mjs|cjs)$/.test(entry.name)) {
        out.push(full);
      }
    }
  }
  return out;
}

describe('migrations-v2 baseline — must stay LEGACY_REFERENCE_ONLY', () => {
  it('the baseline dump file still exists (must not be silently deleted)', () => {
    expect(fs.existsSync(BASELINE_FILE)).toBe(true);
    const stat = fs.statSync(BASELINE_FILE);
    expect(stat.isFile()).toBe(true);
    // Sanity floor: the real file is 86,006 lines / ~2.6MB. A near-empty file at this path would
    // indicate silent truncation/corruption rather than deletion, which this existence check
    // alone would not catch.
    expect(stat.size).toBeGreaterThan(1_000_000);
  });

  it.each(RAILWAY_CONFIG_FILES)('%s preDeployCommand never references migrations-v2', (relPath) => {
    const abs = path.resolve(REPO_ROOT, relPath);
    expect(fs.existsSync(abs)).toBe(true);
    const config = JSON.parse(fs.readFileSync(abs, 'utf-8'));
    const preDeploy = config?.deploy?.preDeployCommand;
    const text = Array.isArray(preDeploy) ? preDeploy.join(' ') : String(preDeploy ?? '');
    expect(text).not.toMatch(/migrations-v2/);
  });

  it.each(PACKAGE_JSON_FILES)('%s has no script referencing migrations-v2', (relPath) => {
    const abs = path.resolve(REPO_ROOT, relPath);
    expect(fs.existsSync(abs)).toBe(true);
    const pkg = JSON.parse(fs.readFileSync(abs, 'utf-8'));
    const scripts: Record<string, string> = pkg.scripts || {};
    const offenders = Object.entries(scripts).filter(([, cmd]) => /migrations-v2/.test(cmd));
    expect(offenders).toEqual([]);
  });

  it.each(EXECUTABLE_SCAN_DIRS)(
    'no file under %s references migrations-v2 in executable code (comments allowed)',
    (dir) => {
      const files = listFilesRecursive(dir);
      // Guard the guard: if the directory listing came back empty, the recursive walk itself is
      // broken (wrong cwd, renamed dir) — fail loudly instead of vacuously passing.
      expect(files.length).toBeGreaterThan(0);

      const offenders: string[] = [];
      for (const file of files) {
        const raw = fs.readFileSync(file, 'utf-8');
        const codeOnly = stripComments(raw);
        if (/migrations-v2/.test(codeOnly)) {
          offenders.push(path.relative(REPO_ROOT, file));
        }
      }
      expect(offenders).toEqual([]);
    }
  );

  it('release-migration-gate.ts resolves a migrations dir that is not migrations-v2', () => {
    const gateSource = fs.readFileSync(
      path.resolve(REPO_ROOT, 'server/scripts/release-migration-gate.ts'),
      'utf-8'
    );
    const codeOnly = stripComments(gateSource);
    // The gate must resolve against '../migrations' / '../../migrations' / 'server/migrations' —
    // i.e. plain "migrations", never "migrations-v2" — in its directory candidate list.
    expect(codeOnly).not.toMatch(/migrations-v2/);
    expect(codeOnly).toMatch(/['"]\.\.\/migrations['"]/);
  });

  it('migrate.postgres.ts (the canonical Postgres runner) defaults --dir to server/migrations, not migrations-v2', () => {
    const runnerSource = fs.readFileSync(
      path.resolve(REPO_ROOT, 'server/scripts/migrate.postgres.ts'),
      'utf-8'
    );
    const codeOnly = stripComments(runnerSource);
    expect(codeOnly).not.toMatch(/migrations-v2/);
    // The documented/actual default directory literal.
    expect(codeOnly).toMatch(/args\.dir\s*\|\|\s*['"]server\/migrations['"]/);
  });

  it('.railwayignore excludes migrations-v2 from the Railway build context', () => {
    const ignoreFile = path.resolve(REPO_ROOT, '.railwayignore');
    expect(fs.existsSync(ignoreFile)).toBe(true);
    const content = fs.readFileSync(ignoreFile, 'utf-8');
    expect(content).toMatch(/\/server\/migrations-v2\//);
  });

  it('Dockerfile.api final stage does not COPY migrations-v2 into the image', () => {
    const dockerfile = fs.readFileSync(path.resolve(REPO_ROOT, 'Dockerfile.api'), 'utf-8');
    const copyLines = dockerfile
      .split('\n')
      .filter((line) => /^\s*COPY\b/.test(line));
    const offenders = copyLines.filter((line) => /migrations-v2/.test(line));
    expect(offenders).toEqual([]);
    // Positive check: the runtime migrations COPY line that DOES exist must point at the plain
    // `/app/migrations` (built from server/migrations), confirming the intended source survives.
    expect(dockerfile).toMatch(/COPY --from=backend-builder[^\n]*\/app\/migrations\s+\/app\/server\/migrations/);
  });
});
