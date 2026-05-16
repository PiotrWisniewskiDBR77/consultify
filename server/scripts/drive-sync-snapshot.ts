/**
 * Drive Sync Snapshot
 *
 * Defends the workspace against Google Drive Desktop sync occasionally
 * reverting recently-edited files or removing newly-created ones. Walks the
 * configured paths recursively, computes a per-file SHA-256, and writes a
 * verbatim copy under `<root>/<out>/<ISO_TS>/...` mirroring the source tree
 * (each tracked file gets a `.snapshot` suffix). A `manifest.json` at the
 * snapshot root captures relative path, sha256, size, and mtimeMs.
 *
 * Aligns with .cursor/rules/drive-sync-resilience.mdc and
 * docs/operations/DRIVE_SYNC_RESILIENCE.md.
 *
 * Usage:
 *   npx tsx server/scripts/drive-sync-snapshot.ts \
 *     [--root <path>] \
 *     [--paths "consultify/src,consultify/server/src,consultify/server/scripts,consultify/docs/testing,consultify/docs/product"] \
 *     [--out .drive-sync-backup] \
 *     [--watch] \
 *     [--interval-ms 60000] \
 *     [--max-snapshots 10] \
 *     [--report-file out/snapshot-<date>.json] \
 *     [--allow-any-root]
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_PATHS: string[] = [
  'consultify/src',
  'consultify/server/src',
  'consultify/server/scripts',
  'consultify/server/migrations',
  'consultify/docs/testing',
  'consultify/docs/product',
  'consultify/tests/e2e',
];

const EXCLUDE_DIRS: Set<string> = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  '.drive-sync-backup',
  'coverage',
  'out',
  'exports',
]);

const EXCLUDE_EXTS: Set<string> = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.pdf',
  '.pptx',
  '.xlsx',
  '.zip',
  '.tgz',
  '.gz',
  '.ico',
  '.woff',
  '.woff2',
  '.ttf',
  '.svg',
]);

// Skip secrets even if they live inside a tracked path.
const EXCLUDE_NAME_REGEX: RegExp[] = [/^\.env(\..*)?$/i, /\.key$/i];

const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MiB
const DEFAULT_OUT = '.drive-sync-backup';
const DEFAULT_INTERVAL_MS = 60_000;
const DEFAULT_MAX_SNAPSHOTS = 10;
const MIN_KEEP_SNAPSHOTS = 3;
const SNAPSHOT_SUFFIX = '.snapshot';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CliArgs {
  root: string | null;
  paths: string[];
  out: string;
  watch: boolean;
  intervalMs: number;
  maxSnapshots: number;
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

interface SkippedEntry {
  relPath: string;
  reason: string;
  size?: number;
}

interface ManifestShape {
  generatedAt: string;
  root: string;
  paths: string[];
  totals: { files: number; bytes: number; skipped: number };
  files: ManifestFileEntry[];
  skipped: SkippedEntry[];
}

interface SnapshotResult {
  snapshotDir: string;
  totals: { files: number; bytes: number; skipped: number };
  pruned: string[];
  warnings: string[];
}

interface SnapshotReport {
  startedAt: string;
  completedAt: string;
  root: string;
  paths: string[];
  snapshotDir: string;
  totals: { files: number; bytes: number; skipped: number };
  pruned: string[];
  warnings: string[];
}

// ---------------------------------------------------------------------------
// CLI parsing — supports `--flag`, `--flag=value`, `--flag value`.
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

  const pathsRaw = findArgValue('paths');
  let paths: string[] = DEFAULT_PATHS.slice();
  if (pathsRaw !== null && pathsRaw !== '') {
    paths = pathsRaw
      .split(',')
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
    if (paths.length === 0) {
      return { ok: false, error: '--paths must contain at least one entry' };
    }
  }

  const outRaw = findArgValue('out');
  const out = outRaw !== null && outRaw !== '' ? outRaw : DEFAULT_OUT;

  const watch = hasBareFlag('watch') || findArgValue('watch') === 'true';

  let intervalMs = DEFAULT_INTERVAL_MS;
  const intervalRaw = findArgValue('interval-ms');
  if (intervalRaw !== null && intervalRaw !== '') {
    const parsed = Number(intervalRaw);
    if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < 1000) {
      return {
        ok: false,
        error: `--interval-ms must be an integer >= 1000 (got "${intervalRaw}")`,
      };
    }
    intervalMs = parsed;
  }

  let maxSnapshots = DEFAULT_MAX_SNAPSHOTS;
  const maxRaw = findArgValue('max-snapshots');
  if (maxRaw !== null && maxRaw !== '') {
    const parsed = Number(maxRaw);
    if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < 1 || parsed > 1000) {
      return {
        ok: false,
        error: `--max-snapshots must be an integer between 1 and 1000 (got "${maxRaw}")`,
      };
    }
    maxSnapshots = parsed;
  }

  const reportFileRaw = findArgValue('report-file');
  const reportFile = reportFileRaw !== null && reportFileRaw !== '' ? reportFileRaw : null;

  const allowAnyRoot = hasBareFlag('allow-any-root') || findArgValue('allow-any-root') === 'true';

  return {
    ok: true,
    args: { root, paths, out, watch, intervalMs, maxSnapshots, reportFile, allowAnyRoot },
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
    return { ok: false, error: `Failed to resolve root: ${String((err as { message?: unknown })?.message ?? err)}` };
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
        error: `Refusing to snapshot outside ${expectedBase}: got ${resolved}. Use --allow-any-root to override.`,
      };
    }
  }
  return { ok: true, root: resolved };
}

// ---------------------------------------------------------------------------
// Walk
// ---------------------------------------------------------------------------

interface WalkAccumulator {
  tracked: string[];
  skipped: SkippedEntry[];
}

function walkPath(absStart: string, root: string, acc: WalkAccumulator): void {
  let stat: fs.Stats;
  try {
    stat = fs.statSync(absStart);
  } catch {
    return;
  }
  if (stat.isFile()) {
    considerFile(absStart, root, acc);
    return;
  }
  if (!stat.isDirectory()) {
    return;
  }

  const stack: string[] = [absStart];
  while (stack.length > 0) {
    const dir = stack.pop();
    if (dir === undefined) break;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isSymbolicLink()) {
        const rel = path.relative(root, full);
        acc.skipped.push({ relPath: rel, reason: 'symlink_skipped' });
        continue;
      }
      if (entry.isDirectory()) {
        if (EXCLUDE_DIRS.has(entry.name)) continue;
        stack.push(full);
        continue;
      }
      if (entry.isFile()) {
        considerFile(full, root, acc);
      }
    }
  }
}

function considerFile(absFile: string, root: string, acc: WalkAccumulator): void {
  const rel = path.relative(root, absFile);
  const base = path.basename(absFile);
  const ext = path.extname(base).toLowerCase();

  if (EXCLUDE_NAME_REGEX.some((re) => re.test(base))) {
    acc.skipped.push({ relPath: rel, reason: 'excluded_secret' });
    return;
  }
  if (EXCLUDE_EXTS.has(ext)) {
    acc.skipped.push({ relPath: rel, reason: 'excluded_binary_extension' });
    return;
  }

  let stat: fs.Stats;
  try {
    stat = fs.statSync(absFile);
  } catch {
    acc.skipped.push({ relPath: rel, reason: 'stat_failed' });
    return;
  }

  if (stat.size > MAX_FILE_BYTES) {
    acc.skipped.push({ relPath: rel, reason: 'too_large', size: stat.size });
    return;
  }

  acc.tracked.push(absFile);
}

// ---------------------------------------------------------------------------
// Hashing & copy
// ---------------------------------------------------------------------------

function sha256OfFile(filePath: string): string {
  const data = fs.readFileSync(filePath);
  const hash = crypto.createHash('sha256');
  hash.update(data);
  return hash.digest('hex');
}

function copyVerbatim(srcAbs: string, destAbs: string): void {
  fs.mkdirSync(path.dirname(destAbs), { recursive: true });
  fs.copyFileSync(srcAbs, destAbs);
}

// ---------------------------------------------------------------------------
// Snapshot directory naming & rotation
// ---------------------------------------------------------------------------

function isoTimestampDirName(): string {
  // Filesystem-safe (no ":"), still ISO-sortable as a string.
  return new Date().toISOString().replace(/:/g, '-');
}

function pruneOldSnapshots(outDirAbs: string, maxSnapshots: number): string[] {
  const keep = Math.max(maxSnapshots, MIN_KEEP_SNAPSHOTS);
  if (!fs.existsSync(outDirAbs)) return [];
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(outDirAbs, { withFileTypes: true });
  } catch {
    return [];
  }
  const dirNames = entries
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort()
    .reverse();
  const toRemove = dirNames.slice(keep);
  const removed: string[] = [];
  for (const name of toRemove) {
    const full = path.join(outDirAbs, name);
    try {
      fs.rmSync(full, { recursive: true, force: true });
      removed.push(name);
    } catch {
      // best effort
    }
  }
  return removed;
}

// ---------------------------------------------------------------------------
// Snapshot run
// ---------------------------------------------------------------------------

function runOnce(root: string, args: CliArgs): SnapshotResult {
  const outDirAbs = path.resolve(root, args.out);
  fs.mkdirSync(outDirAbs, { recursive: true });

  const tsName = isoTimestampDirName();
  const snapshotDirAbs = path.join(outDirAbs, tsName);
  fs.mkdirSync(snapshotDirAbs, { recursive: true });

  const acc: WalkAccumulator = { tracked: [], skipped: [] };
  const warnings: string[] = [];

  for (const rel of args.paths) {
    const startAbs = path.resolve(root, rel);
    if (!fs.existsSync(startAbs)) {
      warnings.push(`path_missing:${rel}`);
      continue;
    }
    walkPath(startAbs, root, acc);
  }

  const files: ManifestFileEntry[] = [];
  let totalBytes = 0;

  for (const absFile of acc.tracked) {
    const rel = path.relative(root, absFile);
    let stat: fs.Stats;
    try {
      stat = fs.statSync(absFile);
    } catch (err: unknown) {
      acc.skipped.push({
        relPath: rel,
        reason: `stat_failed:${String((err as { message?: unknown })?.message ?? err)}`,
      });
      continue;
    }
    let sha256: string;
    try {
      sha256 = sha256OfFile(absFile);
    } catch (err: unknown) {
      acc.skipped.push({
        relPath: rel,
        reason: `hash_failed:${String((err as { message?: unknown })?.message ?? err)}`,
      });
      continue;
    }
    const destAbs = path.join(snapshotDirAbs, rel + SNAPSHOT_SUFFIX);
    try {
      copyVerbatim(absFile, destAbs);
    } catch (err: unknown) {
      acc.skipped.push({
        relPath: rel,
        reason: `copy_failed:${String((err as { message?: unknown })?.message ?? err)}`,
      });
      continue;
    }
    files.push({ relPath: rel, sha256, size: stat.size, mtimeMs: stat.mtimeMs });
    totalBytes += stat.size;
  }

  const manifest: ManifestShape = {
    generatedAt: new Date().toISOString(),
    root,
    paths: args.paths,
    totals: { files: files.length, bytes: totalBytes, skipped: acc.skipped.length },
    files,
    skipped: acc.skipped,
  };
  const manifestPath = path.join(snapshotDirAbs, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');

  const pruned = pruneOldSnapshots(outDirAbs, args.maxSnapshots);

  return {
    snapshotDir: snapshotDirAbs,
    totals: manifest.totals,
    pruned,
    warnings,
  };
}

// ---------------------------------------------------------------------------
// Report writing
// ---------------------------------------------------------------------------

function writeReportFile(reportPath: string, report: SnapshotReport): void {
  const dir = path.dirname(reportPath);
  if (dir && dir !== '.' && dir !== '') {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n', 'utf8');
}

function printSummary(report: SnapshotReport): void {
  console.log('Drive Sync Snapshot');
  console.log(`- Root: ${report.root}`);
  console.log(`- Snapshot: ${report.snapshotDir}`);
  console.log(`- Files: ${report.totals.files}`);
  console.log(`- Bytes: ${report.totals.bytes}`);
  console.log(`- Skipped: ${report.totals.skipped}`);
  if (report.pruned.length > 0) {
    console.log(`- Pruned: ${report.pruned.length} (${report.pruned.join(', ')})`);
  }
  if (report.warnings.length > 0) {
    console.log(`- Warnings: ${report.warnings.join(', ')}`);
  }
}

// ---------------------------------------------------------------------------
// Watch loop
// ---------------------------------------------------------------------------

function runWatch(root: string, args: CliArgs): number {
  let firstResult: SnapshotResult;
  try {
    firstResult = runOnce(root, args);
  } catch (err: unknown) {
    console.error(`Runtime error: ${String((err as { message?: unknown })?.message ?? err)}`);
    return 1;
  }

  console.log('watch_started=true');
  console.log(
    `snapshot=${firstResult.snapshotDir} files=${firstResult.totals.files} bytes=${firstResult.totals.bytes}`
  );

  let running = false;
  const handle: NodeJS.Timeout = setInterval(() => {
    if (running) return;
    running = true;
    try {
      const r = runOnce(root, args);
      console.log(
        `snapshot=${r.snapshotDir} files=${r.totals.files} bytes=${r.totals.bytes}`
      );
    } catch (err: unknown) {
      console.error(
        `tick_error: ${String((err as { message?: unknown })?.message ?? err)}`
      );
    } finally {
      running = false;
    }
  }, args.intervalMs);

  const stop = (): void => {
    clearInterval(handle);
    console.log('watch_stopped=true');
    process.exit(0);
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);

  return 0;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function run(): number {
  const startedAt = new Date().toISOString();

  const parsed = parseArgs();
  if (!parsed.ok) {
    console.error(`Argument error: ${parsed.error}`);
    return 2;
  }
  const args = parsed.args;

  const rootResult = resolveRoot(args);
  if (!rootResult.ok) {
    console.error(`Argument error: ${rootResult.error}`);
    return 2;
  }
  const root = rootResult.root;

  if (args.watch) {
    return runWatch(root, args);
  }

  let result: SnapshotResult;
  try {
    result = runOnce(root, args);
  } catch (err: unknown) {
    console.error(
      `Runtime error: ${String((err as { message?: unknown })?.message ?? err)}`
    );
    return 1;
  }

  const report: SnapshotReport = {
    startedAt,
    completedAt: new Date().toISOString(),
    root,
    paths: args.paths,
    snapshotDir: result.snapshotDir,
    totals: result.totals,
    pruned: result.pruned,
    warnings: result.warnings,
  };

  printSummary(report);

  if (args.reportFile) {
    try {
      writeReportFile(args.reportFile, report);
    } catch (err: unknown) {
      console.error(
        `Report write failed: ${String((err as { message?: unknown })?.message ?? err)}`
      );
      return 1;
    }
  }

  return 0;
}

function main(): void {
  let exitCode = 1;
  try {
    exitCode = run();
  } catch (err: unknown) {
    console.error(
      `Runtime error: ${String((err as { message?: unknown })?.message ?? err)}`
    );
    exitCode = 1;
  }

  // In watch mode, runWatch keeps the loop alive and only exits on SIGINT.
  // For non-watch runs, surface the exit code on the last stdout line.
  if (!hasBareFlag('watch') && findArgValue('watch') !== 'true') {
    console.log(`Exit code: ${exitCode}`);
    process.exit(exitCode);
  }
}

main();
