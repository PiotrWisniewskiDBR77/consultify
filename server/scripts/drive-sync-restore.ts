/**
 * Drive Sync Restore
 *
 * Restores files from a snapshot produced by drive-sync-snapshot.ts. Never
 * overwrites a present file unless `--force` is passed. Always emits a JSON
 * report with `restored`, `skipped`, and `conflicts` arrays so the caller can
 * audit the result before re-running with a stronger flag.
 *
 * Aligns with .cursor/rules/drive-sync-resilience.mdc and
 * docs/operations/DRIVE_SYNC_RESILIENCE.md.
 *
 * Usage:
 *   npx tsx server/scripts/drive-sync-restore.ts \
 *     [--root <path>] \
 *     [--snapshot <path>] \
 *     [--missing-only] \
 *     [--diff-only] \
 *     [--paths "consultify/src,consultify/server/src,..."] \
 *     [--force] \
 *     [--dry-run] \
 *     [--report-file out/restore-<date>.json] \
 *     [--allow-any-root]
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_OUT = '.drive-sync-backup';
const SNAPSHOT_SUFFIX = '.snapshot';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Mode = 'default' | 'missing-only' | 'diff-only';

interface CliArgs {
  root: string | null;
  snapshot: string | null;
  missingOnly: boolean;
  diffOnly: boolean;
  paths: string[] | null;
  force: boolean;
  dryRun: boolean;
  reportFile: string | null;
  allowAnyRoot: boolean;
}

type ParseResult = { ok: true; args: CliArgs } | { ok: false; error: string };

interface ManifestFileEntry {
  relPath: string;
  sha256: string;
  size: number;
  mtimeMs: number;
}

interface ManifestShape {
  generatedAt: string;
  root: string;
  paths?: string[];
  totals: { files: number; bytes: number; skipped: number };
  files: ManifestFileEntry[];
  skipped?: Array<{ relPath: string; reason: string; size?: number }>;
}

interface RestoredEntry {
  relPath: string;
  reason: string;
}

interface SkippedEntry {
  relPath: string;
  reason: string;
}

interface ConflictEntry {
  relPath: string;
  reason: string;
  sha256Expected: string;
  sha256Actual: string | null;
}

interface RestoreReport {
  startedAt: string;
  completedAt: string;
  root: string;
  snapshotDir: string;
  mode: Mode;
  force: boolean;
  dryRun: boolean;
  paths: string[] | null;
  totals: {
    manifestEntries: number;
    restored: number;
    skipped: number;
    conflicts: number;
  };
  restored: RestoredEntry[];
  skipped: SkippedEntry[];
  conflicts: ConflictEntry[];
  warnings: string[];
}

// ---------------------------------------------------------------------------
// CLI parsing — mirrors drive-sync-snapshot.ts
// ---------------------------------------------------------------------------

function findArgValue(name: string): string | null {
  const eqFlag = `--${name}=`;
  const bareFlag = `--${name}`;
  const argv = process.argv;

  for (let i = 0; i < argv.length; i++) {
    const entry = argv[i];
    if (entry === undefined) continue;
    if (entry.startsWith(eqFlag)) {
      return entry.slice(eqFlag.length);
    }
    if (entry === bareFlag) {
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith('--')) {
        return next;
      }
      return '';
    }
  }
  return null;
}

function hasBareFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function parseArgs(): ParseResult {
  const rootRaw = findArgValue('root');
  const root = rootRaw !== null && rootRaw !== '' ? rootRaw : null;

  const snapshotRaw = findArgValue('snapshot');
  const snapshot = snapshotRaw !== null && snapshotRaw !== '' ? snapshotRaw : null;

  const missingOnly = hasBareFlag('missing-only') || findArgValue('missing-only') === 'true';
  const diffOnly = hasBareFlag('diff-only') || findArgValue('diff-only') === 'true';
  const force = hasBareFlag('force') || findArgValue('force') === 'true';
  const dryRun = hasBareFlag('dry-run') || findArgValue('dry-run') === 'true';
  const allowAnyRoot = hasBareFlag('allow-any-root') || findArgValue('allow-any-root') === 'true';

  if (missingOnly && diffOnly) {
    return { ok: false, error: '--missing-only and --diff-only are mutually exclusive' };
  }
  if (missingOnly && force) {
    return { ok: false, error: '--missing-only cannot be combined with --force' };
  }

  let paths: string[] | null = null;
  const pathsRaw = findArgValue('paths');
  if (pathsRaw !== null && pathsRaw !== '') {
    paths = pathsRaw
      .split(',')
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
    if (paths.length === 0) {
      return { ok: false, error: '--paths must contain at least one entry' };
    }
  }

  const reportFileRaw = findArgValue('report-file');
  const reportFile = reportFileRaw !== null && reportFileRaw !== '' ? reportFileRaw : null;

  return {
    ok: true,
    args: {
      root,
      snapshot,
      missingOnly,
      diffOnly,
      paths,
      force,
      dryRun,
      reportFile,
      allowAnyRoot,
    },
  };
}

// ---------------------------------------------------------------------------
// Root resolution & safety guard
// ---------------------------------------------------------------------------

function resolveRoot(args: CliArgs): { ok: true; root: string } | { ok: false; error: string } {
  const candidate = args.root ?? process.cwd();
  let resolved: string;
  try {
    resolved = path.resolve(candidate);
  } catch (err: unknown) {
    return {
      ok: false,
      error: `Failed to resolve root: ${String((err as { message?: unknown })?.message ?? err)}`,
    };
  }
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) {
    return { ok: false, error: `Root is not a directory: ${resolved}` };
  }
  if (!args.allowAnyRoot) {
    const home = process.env.HOME || process.env.USERPROFILE || '';
    const expectedBase = home ? path.resolve(home, 'Documents', 'Antygracity') : '';
    if (!expectedBase) {
      return {
        ok: false,
        error: 'HOME is not set; cannot verify workspace boundary. Pass --allow-any-root to override.',
      };
    }
    const withSep = expectedBase.endsWith(path.sep) ? expectedBase : expectedBase + path.sep;
    if (resolved !== expectedBase && !resolved.startsWith(withSep)) {
      return {
        ok: false,
        error: `Refusing to restore outside ${expectedBase}: got ${resolved}. Use --allow-any-root to override.`,
      };
    }
  }
  return { ok: true, root: resolved };
}

// ---------------------------------------------------------------------------
// Snapshot selection
// ---------------------------------------------------------------------------

function pickLatestSnapshot(root: string): { ok: true; dir: string } | { ok: false; error: string } {
  const outDir = path.resolve(root, DEFAULT_OUT);
  if (!fs.existsSync(outDir) || !fs.statSync(outDir).isDirectory()) {
    return { ok: false, error: `No snapshot directory at ${outDir}` };
  }
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(outDir, { withFileTypes: true });
  } catch (err: unknown) {
    return {
      ok: false,
      error: `Failed to read ${outDir}: ${String((err as { message?: unknown })?.message ?? err)}`,
    };
  }
  const dirs = entries
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
  if (dirs.length === 0) {
    return { ok: false, error: `No snapshots found under ${outDir}` };
  }
  const latest = dirs[dirs.length - 1];
  if (latest === undefined) {
    return { ok: false, error: `No snapshots found under ${outDir}` };
  }
  return { ok: true, dir: path.join(outDir, latest) };
}

function loadManifest(snapshotDir: string): { ok: true; manifest: ManifestShape } | { ok: false; error: string } {
  const manifestPath = path.join(snapshotDir, 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    return { ok: false, error: `Manifest not found at ${manifestPath}` };
  }
  let raw: string;
  try {
    raw = fs.readFileSync(manifestPath, 'utf8');
  } catch (err: unknown) {
    return {
      ok: false,
      error: `Failed to read manifest: ${String((err as { message?: unknown })?.message ?? err)}`,
    };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err: unknown) {
    return {
      ok: false,
      error: `Manifest is not valid JSON: ${String((err as { message?: unknown })?.message ?? err)}`,
    };
  }
  if (!parsed || typeof parsed !== 'object' || !Array.isArray((parsed as { files?: unknown }).files)) {
    return { ok: false, error: 'Manifest is missing the "files" array' };
  }
  return { ok: true, manifest: parsed as ManifestShape };
}

// ---------------------------------------------------------------------------
// Hashing
// ---------------------------------------------------------------------------

function sha256OfFile(filePath: string): string {
  const data = fs.readFileSync(filePath);
  const hash = crypto.createHash('sha256');
  hash.update(data);
  return hash.digest('hex');
}

// ---------------------------------------------------------------------------
// Path filter
// ---------------------------------------------------------------------------

function relMatchesAnyPath(rel: string, paths: string[]): boolean {
  const normalizedRel = rel.split(path.sep).join('/');
  return paths.some((p) => {
    const normalized = p.split(path.sep).join('/').replace(/\/+$/, '');
    return normalizedRel === normalized || normalizedRel.startsWith(normalized + '/');
  });
}

// ---------------------------------------------------------------------------
// Restore single file
// ---------------------------------------------------------------------------

function restoreFile(
  snapshotDir: string,
  root: string,
  entry: ManifestFileEntry,
  dryRun: boolean
): { ok: true } | { ok: false; reason: string } {
  const srcAbs = path.join(snapshotDir, entry.relPath + SNAPSHOT_SUFFIX);
  if (!fs.existsSync(srcAbs)) {
    return { ok: false, reason: `snapshot_file_missing:${srcAbs}` };
  }
  const destAbs = path.join(root, entry.relPath);
  if (dryRun) return { ok: true };
  try {
    fs.mkdirSync(path.dirname(destAbs), { recursive: true });
    fs.copyFileSync(srcAbs, destAbs);
  } catch (err: unknown) {
    return {
      ok: false,
      reason: `copy_failed:${String((err as { message?: unknown })?.message ?? err)}`,
    };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Main run
// ---------------------------------------------------------------------------

function deriveMode(args: CliArgs): Mode {
  if (args.missingOnly) return 'missing-only';
  if (args.diffOnly) return 'diff-only';
  return 'default';
}

function runRestore(): { code: number; report: RestoreReport | null } {
  const startedAt = new Date().toISOString();

  const parsed = parseArgs();
  if (!parsed.ok) {
    console.error(`Argument error: ${parsed.error}`);
    return { code: 2, report: null };
  }
  const args = parsed.args;

  const rootResult = resolveRoot(args);
  if (!rootResult.ok) {
    console.error(`Argument error: ${rootResult.error}`);
    return { code: 2, report: null };
  }
  const root = rootResult.root;

  let snapshotDir: string;
  if (args.snapshot) {
    const candidate = path.resolve(args.snapshot);
    if (!fs.existsSync(candidate) || !fs.statSync(candidate).isDirectory()) {
      console.error(`Argument error: --snapshot is not a directory: ${candidate}`);
      return { code: 2, report: null };
    }
    snapshotDir = candidate;
  } else {
    const latest = pickLatestSnapshot(root);
    if (!latest.ok) {
      console.error(`Argument error: ${latest.error}`);
      return { code: 2, report: null };
    }
    snapshotDir = latest.dir;
  }

  const manifestResult = loadManifest(snapshotDir);
  if (!manifestResult.ok) {
    console.error(`Runtime error: ${manifestResult.error}`);
    return { code: 1, report: null };
  }
  const manifest = manifestResult.manifest;

  const mode = deriveMode(args);
  const restored: RestoredEntry[] = [];
  const skipped: SkippedEntry[] = [];
  const conflicts: ConflictEntry[] = [];
  const warnings: string[] = [];

  for (const entry of manifest.files) {
    if (args.paths && !relMatchesAnyPath(entry.relPath, args.paths)) {
      skipped.push({ relPath: entry.relPath, reason: 'path_filter' });
      continue;
    }

    const destAbs = path.join(root, entry.relPath);
    const present = fs.existsSync(destAbs);

    if (!present) {
      if (mode === 'diff-only') {
        // diff-only still treats absent files as a diff and restores them.
        const r = restoreFile(snapshotDir, root, entry, args.dryRun);
        if (r.ok) {
          restored.push({ relPath: entry.relPath, reason: 'restored_missing' });
        } else {
          warnings.push(`${entry.relPath}:${r.reason}`);
          skipped.push({ relPath: entry.relPath, reason: r.reason });
        }
        continue;
      }
      const r = restoreFile(snapshotDir, root, entry, args.dryRun);
      if (r.ok) {
        restored.push({ relPath: entry.relPath, reason: 'restored_missing' });
      } else {
        warnings.push(`${entry.relPath}:${r.reason}`);
        skipped.push({ relPath: entry.relPath, reason: r.reason });
      }
      continue;
    }

    let actualSha: string | null = null;
    try {
      actualSha = sha256OfFile(destAbs);
    } catch (err: unknown) {
      warnings.push(
        `${entry.relPath}:hash_failed:${String((err as { message?: unknown })?.message ?? err)}`
      );
    }

    if (actualSha !== null && actualSha === entry.sha256) {
      skipped.push({ relPath: entry.relPath, reason: 'match' });
      continue;
    }

    if (mode === 'missing-only') {
      conflicts.push({
        relPath: entry.relPath,
        reason: 'present_modified',
        sha256Expected: entry.sha256,
        sha256Actual: actualSha,
      });
      skipped.push({ relPath: entry.relPath, reason: 'present_modified' });
      continue;
    }

    // default or diff-only with conflict
    if (!args.force) {
      conflicts.push({
        relPath: entry.relPath,
        reason: 'conflict',
        sha256Expected: entry.sha256,
        sha256Actual: actualSha,
      });
      skipped.push({ relPath: entry.relPath, reason: 'conflict' });
      continue;
    }

    const r = restoreFile(snapshotDir, root, entry, args.dryRun);
    if (r.ok) {
      restored.push({ relPath: entry.relPath, reason: 'force_overwrite' });
    } else {
      warnings.push(`${entry.relPath}:${r.reason}`);
      skipped.push({ relPath: entry.relPath, reason: r.reason });
    }
  }

  const report: RestoreReport = {
    startedAt,
    completedAt: new Date().toISOString(),
    root,
    snapshotDir,
    mode,
    force: args.force,
    dryRun: args.dryRun,
    paths: args.paths,
    totals: {
      manifestEntries: manifest.files.length,
      restored: restored.length,
      skipped: skipped.length,
      conflicts: conflicts.length,
    },
    restored,
    skipped,
    conflicts,
    warnings,
  };

  return { code: 0, report };
}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

function printSummary(report: RestoreReport): void {
  console.log('Drive Sync Restore');
  console.log(`- Root: ${report.root}`);
  console.log(`- Snapshot: ${report.snapshotDir}`);
  console.log(`- Mode: ${report.mode}${report.force ? ' (force)' : ''}${report.dryRun ? ' (dry-run)' : ''}`);
  console.log(`- Manifest entries: ${report.totals.manifestEntries}`);
  console.log(`- Restored: ${report.totals.restored}`);
  console.log(`- Skipped: ${report.totals.skipped}`);
  console.log(`- Conflicts: ${report.totals.conflicts}`);
  if (report.warnings.length > 0) {
    console.log(`- Warnings: ${report.warnings.length}`);
  }
  if (report.conflicts.length > 0) {
    console.log('Inspect conflicts and rerun with --force only after review.');
  }
}

function writeReportFile(reportPath: string, report: RestoreReport): void {
  const dir = path.dirname(reportPath);
  if (dir && dir !== '.' && dir !== '') {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n', 'utf8');
}

// ---------------------------------------------------------------------------
// Entrypoint
// ---------------------------------------------------------------------------

function main(): void {
  let exitCode = 1;
  let report: RestoreReport | null = null;
  try {
    const result = runRestore();
    exitCode = result.code;
    report = result.report;
  } catch (err: unknown) {
    console.error(
      `Runtime error: ${String((err as { message?: unknown })?.message ?? err)}`
    );
    exitCode = 1;
  }

  if (report) {
    printSummary(report);
    const reportFileRaw = findArgValue('report-file');
    const reportFile = reportFileRaw !== null && reportFileRaw !== '' ? reportFileRaw : null;
    if (reportFile) {
      try {
        writeReportFile(reportFile, report);
      } catch (err: unknown) {
        console.error(
          `Report write failed: ${String((err as { message?: unknown })?.message ?? err)}`
        );
        if (exitCode === 0) exitCode = 1;
      }
    }
  }

  console.log(`Exit code: ${exitCode}`);
  process.exit(exitCode);
}

main();
