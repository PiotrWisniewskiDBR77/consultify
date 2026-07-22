/**
 * storagePaths — single source of truth for where server-generated artifacts
 * (exports, uploads, generated attachments) live on disk.
 *
 * WHY THIS EXISTS (P0 reliability / G2):
 * Railway containers run on ephemeral local disk. Anything written under
 * `process.cwd()` (the historic pattern used across this codebase — see
 * `exports/`, `uploads/` directories) is LOST on every redeploy/restart. This
 * module centralizes the base directory so ops can mount a persistent Railway
 * Volume and point the app at it via env, with ZERO code changes required
 * beyond what already routes through these helpers.
 *
 * DEFAULT BEHAVIOR IS UNCHANGED: with no env vars set, `baseStorageDir()`
 * resolves to `process.cwd()` — identical to the historic
 * `path.join(process.cwd(), 'exports'|'uploads', ...)` call sites this module
 * replaces. Nothing moves, nothing breaks, until an operator opts in.
 *
 * TO ENABLE THE PERSISTENT VOLUME (Railway):
 *   1. Railway dashboard → consultify service → Volumes → Add Volume
 *      (e.g. mount path `/data`).
 *   2. Set service variable `STORAGE_DIR=/data`.
 *   3. Redeploy. New exports/uploads now land under `/data/exports` and
 *      `/data/uploads` and survive redeploys.
 *
 * Precedence: `STORAGE_DIR` > `RAILWAY_VOLUME_MOUNT_PATH` (Railway's own
 * convention for the mount path, used as a zero-config fallback if present)
 * > `process.cwd()` (historic default).
 *
 * Call sites should prefer `exportsDir(...segments)` / `uploadsDir(...segments)`
 * over touching `baseStorageDir()` directly — they also create the directory
 * (mkdir -p, sync) so callers don't each need their own existsSync/mkdirSync
 * boilerplate.
 */

import fs from 'fs';
import path from 'path';

/**
 * Absolute base directory all server-managed storage is rooted under.
 * Historic default (`process.cwd()`) is preserved exactly when no storage env
 * var is set — this is what makes the migration to this helper behavior
 * preserving for every existing call site.
 */
export function baseStorageDir(): string {
  const fromEnv = process.env.STORAGE_DIR || process.env.RAILWAY_VOLUME_MOUNT_PATH;
  if (fromEnv && fromEnv.trim()) {
    return path.resolve(fromEnv.trim());
  }
  return process.cwd();
}

/**
 * mkdir -p, sync, idempotent, FAIL-SOFT. Small helper to avoid repeating
 * existsSync+mkdirSync everywhere.
 *
 * HOTFIX 2026-07-22 (P0 incident): a freshly-attached Railway Volume is
 * mounted root-owned by default — the app runs as non-root (`USER nodejs` in
 * Dockerfile), so the FIRST mkdir under it throws EACCES. That's an
 * unhandled exception at server boot (this helper is called eagerly from
 * index.ts), which crash-loops the whole service — exactly the kind of
 * storage-path failure this module was built to make harmless. Never let a
 * directory-creation failure take the process down: on ANY error (EACCES,
 * EROFS, quota, whatever), log a warning and fall back to the historic
 * `process.cwd()`-rooted path (`relTail`) — the same location used before
 * this module existed, so behavior degrades to "ephemeral but working"
 * instead of "down". Once the volume's permissions are fixed, this silently
 * starts using it again with zero further code changes.
 */
function ensureDirSync(preferredDir: string, relTail: string): string {
  try {
    if (!fs.existsSync(preferredDir)) {
      fs.mkdirSync(preferredDir, { recursive: true });
    }
    fs.accessSync(preferredDir, fs.constants.W_OK);
    return preferredDir;
  } catch (err) {
    const fallbackDir = path.join(process.cwd(), relTail);
    try {
      if (!fs.existsSync(fallbackDir)) {
        fs.mkdirSync(fallbackDir, { recursive: true });
      }
    } catch {
      // Fallback itself failed — nothing safer left to try; callers will hit
      // their own write error naturally, but we still return a path rather
      // than throwing from a low-level directory helper.
    }
    // eslint-disable-next-line no-console -- boot-time diagnostic, no logger wired here to avoid import cycles
    console.warn(
      `[storagePaths] "${preferredDir}" not writable (${(err as Error).message}) — falling back to ephemeral "${fallbackDir}". Fix volume permissions to persist.`
    );
    return fallbackDir;
  }
}

/**
 * Absolute path to (a subdirectory of) the `exports/` tree, created if
 * missing. Mirrors the historic `path.join(process.cwd(), 'exports', ...)`
 * call sites, just rooted at {@link baseStorageDir} instead of always
 * `process.cwd()`.
 *
 *   exportsDir()                          -> <base>/exports
 *   exportsDir('presentations')           -> <base>/exports/presentations
 *   exportsDir('presentations', 'assets') -> <base>/exports/presentations/assets
 */
export function exportsDir(...segments: string[]): string {
  const relTail = path.join('exports', ...segments);
  return ensureDirSync(path.join(baseStorageDir(), relTail), relTail);
}

/**
 * Absolute path to (a subdirectory of) the `uploads/` tree, created if
 * missing. Mirrors the historic `path.join(process.cwd(), 'uploads', ...)`
 * call sites.
 *
 *   uploadsDir()            -> <base>/uploads
 *   uploadsDir('avatars')   -> <base>/uploads/avatars
 */
export function uploadsDir(...segments: string[]): string {
  const relTail = path.join('uploads', ...segments);
  return ensureDirSync(path.join(baseStorageDir(), relTail), relTail);
}

/**
 * Resolve an absolute filesystem path from a value stored in the DB in the
 * historic "/uploads/..." or "/exports/..." relative-looking form (e.g.
 * `valuations.export_path`, `users.avatar_url`). These values were always
 * joined onto `process.cwd()` at read time — this helper does the same thing
 * against {@link baseStorageDir}, so already-stored rows keep resolving
 * correctly and new rows written after a STORAGE_DIR migration resolve under
 * the volume.
 *
 * Absolute paths stored verbatim in the DB (the more common historic pattern
 * — e.g. `presentation_decks.export_path`) do NOT go through this helper:
 * they are read back literally, which stays correct as long as
 * STORAGE_DIR/RAILWAY_VOLUME_MOUNT_PATH does not change between the write and
 * the read (true for the lifetime of a deployment; see storagePaths.ts
 * module doc / migration report for the one-time-cutover caveat).
 */
export function resolveStoredRelativePath(storedValue: string): string {
  const normalized = storedValue.replace(/^[/\\]+/, '');
  return path.resolve(baseStorageDir(), normalized);
}
