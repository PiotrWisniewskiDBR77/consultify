/**
 * Presentation Studio Layout Capacity Persistence Service (Sprint S18).
 *
 * Source of truth:
 *   - .cursor/MODULE_DELIVERY_CONTRACT_STANDARD.md
 *   - consultify/docs/product/CONSULTIFY_PRESENTATION_STUDIO_100_PERCENT_IMPLEMENTATION_CONTRACT_2026-05-08.md
 *   - WP-06 carry / R-S13-2.
 *
 * Closes R-S13-2: registry overrides applied via the SuperAdmin admin
 * surface (S17) now survive a Node restart. Before S18 the registry
 * was process-memory-only — a SuperAdmin who carefully tuned the
 * runtime caps via /admin/layout-capacity/execute would see the entire
 * configuration silently revert on the next deploy or the next
 * `pm2 restart`. That is a serious honesty gap: the operator could
 * believe their tuning was in effect for hours after it had silently
 * reverted.
 *
 * Phase 2 constraint Q2=A says NO database migrations, so we persist
 * to a JSON file at a configurable path. The file lives outside the
 * source tree (default: `<cwd>/.runtime-config/...`) so deploys never
 * stomp on it and a `git clean` does not nuke an operator's tuning.
 *
 * Honest degraded UI: a missing file is the steady-state default and
 * is silent. A corrupt file (parse error, unknown shape, validation
 * rejection) does NOT crash the server — we log the failure, fall
 * back to the canonical defaults, and surface a `loadWarning` field
 * the registry exposes so the admin GET can render the honest state.
 *
 * The service is pure with respect to the file system: a small
 * `FileSystemDriver` interface + an injectable factory let tests pass
 * a mock driver without touching disk. Production code uses the
 * default driver (sync `fs.readFileSync` / `fs.writeFileSync` /
 * `fs.unlinkSync` plus `mkdirSync` for the parent dir).
 */

import { createRequire } from 'module';

import {
  applyOverrides,
  getAllTenantRegistrySnapshots,
  getCurrentRegistrySnapshot,
  type LayoutCapacityApplyResult,
  type LayoutCapacityOverridesPayload,
  type LayoutCapacityRegistryHooks,
  type LayoutCapacityRegistrySnapshot,
  resetToDefaults,
  setRegistryHooks,
  setRegistryLoadWarning,
} from './presentationStudioLayoutCapacityRegistryService.js';

// The ESM production build has no global require(); the lazy require('fs'|'path'|'crypto')
// calls below would otherwise throw "require is not defined" and the layout-capacity
// persistence init would fail on every boot. createRequire restores it.
const require = createRequire(import.meta.url);

// ---------------------------------------------------------------------------
// File system driver (mockable for tests)
// ---------------------------------------------------------------------------

export interface PersistenceFileSystemDriver {
  /** Returns true iff the file (or parent dir) exists. */
  exists(path: string): boolean;
  /** Reads UTF-8 contents. Throws on I/O failure. */
  readFile(path: string): string;
  /** Writes UTF-8 contents. Creates parent dir(s) if missing. Throws on I/O failure. */
  writeFile(path: string, contents: string): void;
  /** Removes the file. No-op if missing. Throws on other I/O failures. */
  removeFile(path: string): void;
}

/**
 * Minimal structural surface of `node:fs` used by `atomicWriteFile`.
 * Letting tests pass a mock fs without spinning up a real temp dir
 * keeps the helper pure and lets us assert the exact sequence of
 * operations.
 *
 * Sprint S19 introduced the file-system surface (R-S18-3 atomic
 * write). Sprint S21 adds `openSync` / `fsyncSync` / `closeSync` to
 * close R-S19-1: the atomic rename is consistent across crashes, but
 * not durable — a power-loss between `rename(2)` and the next
 * directory cache flush can lose the rename and leave the OLD file
 * on disk despite our caller observing a successful write. Adding
 * fsync on both the file and its parent directory closes that gap.
 */
export interface AtomicWriteFileSystem {
  existsSync(path: string): boolean;
  mkdirSync(path: string, options?: { recursive?: boolean }): void;
  writeFileSync(path: string, contents: string, encoding: 'utf-8'): void;
  renameSync(oldPath: string, newPath: string): void;
  unlinkSync(path: string): void;
  /**
   * Opens a file or directory and returns a numeric file descriptor.
   * Used by the fsync hardening pass to obtain a handle that can be
   * passed to `fsyncSync`. The flag string accepts `'r'` (read-only)
   * which is sufficient for both file and directory fsync paths.
   * (Sprint S21, R-S19-1.)
   */
  openSync(path: string, flags: 'r'): number;
  /**
   * Flushes any kernel-buffered writes for the supplied fd to the
   * underlying storage device. After this call returns, the contents
   * (for a file fd) or the directory entry change (for a directory
   * fd) are durable across a power-loss. (Sprint S21, R-S19-1.)
   */
  fsyncSync(fd: number): void;
  /** Releases the fd. Always called from a `try/finally` after open. */
  closeSync(fd: number): void;
}

export interface AtomicWritePathOps {
  dirname(p: string): string;
}

/**
 * Atomic write helper.
 *
 * S19 (R-S18-3) introduced the canonical tmp-file + rename dance so
 * a crash mid-write cannot leave the target file in a corrupted
 * state. S21 (R-S19-1) hardens that dance with the canonical
 * Postgres / SQLite / lmdb durability sequence:
 *
 *   1. Ensure the parent dir exists.
 *   2. Write the FULL contents to `<path>.<pid>.<n>.tmp`.
 *   3. fsync the tmp file's contents to disk so a power-loss after
 *      this point preserves the new bytes (not just the directory
 *      entry that points at unflushed pages).
 *   4. Atomically `rename` the tmp file onto the target path.
 *   5. fsync the parent directory so the rename itself is durable —
 *      without this, a power-loss after the rename(2) syscall but
 *      before the directory cache flush could lose the new entry and
 *      leave the OLD file (or no file) on disk despite the caller
 *      observing a successful return.
 *   6. On any failure during 2..5, attempt to `unlink` the tmp file
 *      so it does not linger as garbage on disk. The unlink failure
 *      itself is swallowed — we cannot meaningfully recover.
 *
 * Why both fsyncs?
 *   - File fsync (step 3) makes the NEW contents durable. Without it,
 *     a crash between `writeFileSync` and `rename` can leave the
 *     directory entry pointing at unflushed pages — the rename then
 *     "succeeds" in cache but the post-crash state has the directory
 *     entry but garbage / zero-length contents.
 *   - Directory fsync (step 5) makes the rename itself durable.
 *     Without it, a crash AFTER `rename(2)` returns can lose the
 *     rename — the kernel acknowledged the rename in its in-memory
 *     directory cache but had not yet flushed the directory inode
 *     when the power dropped. The post-crash state then reverts to
 *     the OLD file (or no file at all if the OLD file was new).
 *
 * Tmp file naming embeds `process.pid` + a per-call counter so two
 * concurrent writers (e.g. the registry hook + a manual SuperAdmin
 * debug script in a sibling process) never collide on the same tmp
 * path.
 *
 * Throws on any unrecoverable I/O failure. Caller
 * (`savePersistedOverrides`) already wraps in try/catch and converts
 * to a structured result so the registry can surface the failure as
 * a `loadWarning` instead of crashing.
 */
let _tmpCounter = 0;
export function atomicWriteFile(
  targetPath: string,
  contents: string,
  fsDriver: AtomicWriteFileSystem,
  pathOps: AtomicWritePathOps
): void {
  const dir = pathOps.dirname(targetPath);
  if (!fsDriver.existsSync(dir)) {
    fsDriver.mkdirSync(dir, { recursive: true });
  }
  // Tmp suffix: pid + per-process counter + ".tmp" — survives concurrent
  // writers in the same process (the counter is monotonic) and across
  // processes (pid is unique enough at the granularity we care about).
  _tmpCounter = (_tmpCounter + 1) % Number.MAX_SAFE_INTEGER;
  const tmpPath = `${targetPath}.${process.pid}.${_tmpCounter}.tmp`;
  try {
    fsDriver.writeFileSync(tmpPath, contents, 'utf-8');
    // Step 3 (S21, R-S19-1): fsync the tmp file BEFORE rename so the
    // NEW contents are durable. The try/finally guarantees the fd is
    // released even if fsync throws — leaking an fd here would
    // eventually trip Node's per-process fd limit on a long-running
    // server with frequent override applies.
    fsyncPathThenClose(fsDriver, tmpPath);
    fsDriver.renameSync(tmpPath, targetPath);
    // Step 5 (S21, R-S19-1): fsync the parent directory AFTER rename
    // so the rename itself is durable. We open the dir read-only —
    // POSIX requires no additional permissions for an inode fsync.
    // On Linux + macOS this is the canonical durability sequence; on
    // Windows directory fsync may fail with EPERM, in which case the
    // error propagates up to the caller (we'd rather surface an
    // honest "could not persist durably" than silently degrade).
    fsyncPathThenClose(fsDriver, dir);
  } catch (err: unknown) {
    // Best-effort cleanup of the tmp file. We deliberately do NOT
    // surface the cleanup error — the original write/fsync/rename
    // error is the meaningful one for the caller.
    try {
      if (fsDriver.existsSync(tmpPath)) fsDriver.unlinkSync(tmpPath);
    } catch {
      // Swallow. Tmp file may linger as garbage; acceptable trade-off.
    }
    throw err;
  }
}

/**
 * Internal helper: open `<path>` read-only, fsync the resulting fd,
 * and close the fd in a `try/finally` so the descriptor is always
 * released even if fsync throws. The close error is propagated only
 * when fsync itself succeeded — otherwise we re-throw the original
 * fsync error to keep the failure mode unambiguous.
 *
 * Used by `atomicWriteFile` for both the file path (durability of
 * NEW contents) and the parent dir path (durability of the rename).
 */
function fsyncPathThenClose(fsDriver: AtomicWriteFileSystem, path: string): void {
  const fd = fsDriver.openSync(path, 'r');
  let fsyncError: unknown = null;
  let closeError: unknown = null;
  try {
    fsDriver.fsyncSync(fd);
  } catch (err: unknown) {
    fsyncError = err;
  }
  // Always attempt to release the fd. We deliberately do NOT throw
  // from a `finally` block (eslint `no-unsafe-finally`) because that
  // would shadow any error already in flight. Instead we record both
  // errors and decide which one to propagate after the close attempt
  // returns (whether by success or by throw).
  try {
    fsDriver.closeSync(fd);
  } catch (err: unknown) {
    closeError = err;
  }
  // Resolution order:
  //   1. fsync error wins — it is the meaningful durability failure.
  //   2. close error after a successful fsync surfaces unchanged —
  //      it usually indicates fd-table corruption / EBADF and should
  //      not be hidden.
  if (fsyncError !== null) throw fsyncError;
  if (closeError !== null) throw closeError;
}

let _driver: PersistenceFileSystemDriver | null = null;

function defaultDriver(): PersistenceFileSystemDriver {
  // Lazy-loaded so the test suite that swaps the driver never imports
  // `node:fs` (keeps coverage tools / sandboxed runners happy).
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fs = require('fs') as typeof import('fs');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const path = require('path') as typeof import('path');
  return {
    exists(p: string): boolean {
      try {
        return fs.existsSync(p);
      } catch {
        return false;
      }
    },
    readFile(p: string): string {
      return fs.readFileSync(p, 'utf-8');
    },
    writeFile(p: string, contents: string): void {
      // Sprint S19 (R-S18-3): tmp-file + rename so a crash mid-write
      // leaves the previous good copy intact instead of producing a
      // corrupt file.
      // Sprint S21 (R-S19-1): plus fsync on the file fd (durability
      // of NEW contents) and fsync on the parent directory fd
      // (durability of the rename) so a power-loss after this call
      // returns cannot lose the write.
      atomicWriteFile(
        p,
        contents,
        {
          existsSync: fs.existsSync.bind(fs),
          mkdirSync: (dirPath: string, opts?: { recursive?: boolean }) => {
            fs.mkdirSync(dirPath, opts);
          },
          writeFileSync: (filePath: string, c: string, encoding: 'utf-8') => {
            fs.writeFileSync(filePath, c, encoding);
          },
          renameSync: fs.renameSync.bind(fs),
          unlinkSync: fs.unlinkSync.bind(fs),
          openSync: (filePath: string, flags: 'r') => fs.openSync(filePath, flags),
          fsyncSync: fs.fsyncSync.bind(fs),
          closeSync: fs.closeSync.bind(fs),
        },
        { dirname: path.dirname.bind(path) }
      );
    },
    removeFile(p: string): void {
      if (!fs.existsSync(p)) return;
      fs.unlinkSync(p);
    },
  };
}

function getDriver(): PersistenceFileSystemDriver {
  return _driver ?? defaultDriver();
}

/**
 * Test-only helper: swap the driver. Production MUST NOT call this.
 * Pass `null` to revert to the default (real-fs) driver.
 */
export function _setLayoutCapacityPersistenceDriverForTests(
  driver: PersistenceFileSystemDriver | null
): void {
  _driver = driver;
}

// ---------------------------------------------------------------------------
// Path resolution
// ---------------------------------------------------------------------------

const DEFAULT_RUNTIME_CONFIG_DIR = '.runtime-config';
const DEFAULT_FILENAME = 'presentation-studio-layout-capacity-overrides.json';

let _persistencePathOverride: string | null = null;

/**
 * Resolve the on-disk path for the persisted overrides file. Resolution
 * order (highest priority first):
 *   1. test override (`_setLayoutCapacityPersistencePathForTests`).
 *   2. environment variable `CONSULTIFY_LAYOUT_CAPACITY_OVERRIDES_PATH`.
 *   3. default `<cwd>/.runtime-config/presentation-studio-layout-capacity-overrides.json`.
 */
export function resolvePersistencePath(): string {
  if (_persistencePathOverride) return _persistencePathOverride;
  const fromEnv = process.env.CONSULTIFY_LAYOUT_CAPACITY_OVERRIDES_PATH;
  if (typeof fromEnv === 'string' && fromEnv.trim()) return fromEnv.trim();
  // Lazy require to keep this module side-effect-free at import time.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const path = require('path') as typeof import('path');
  return path.join(process.cwd(), DEFAULT_RUNTIME_CONFIG_DIR, DEFAULT_FILENAME);
}

/**
 * Test-only helper: pin the persistence path for a test. Pass `null`
 * to revert to env / default resolution.
 */
export function _setLayoutCapacityPersistencePathForTests(p: string | null): void {
  _persistencePathOverride = p;
}

// ---------------------------------------------------------------------------
// File schema
// ---------------------------------------------------------------------------

/**
 * On-disk schema. Version 1 stores the FULL accumulated override payload
 * (not a delta vs defaults). On restore we feed it through `applyOverrides`
 * which does its own validation; if a future code-baseline tightens the
 * validator and rejects a previously-valid payload, the restore degrades
 * gracefully (file becomes "corrupt" vs the new validator and we fall
 * back to defaults — see `loadPersistedOverrides`).
 */
export interface PersistedOverridesFileV1 {
  schemaVersion: 1;
  /**
   * ISO timestamp of the last successful write. Diagnostic only —
   * the registry does not key any logic on it.
   */
  writtenAt: string;
  /**
   * The full overrides payload to be applied at server start. Shape
   * is the canonical `LayoutCapacityOverridesPayload`; the registry's
   * validator gates apply-time correctness, so a corrupted shape is
   * caught by the same code path the SuperAdmin route uses.
   */
  overrides: LayoutCapacityOverridesPayload;
  /**
   * Sprint S22 (R-S18-2): HMAC-SHA256 over the canonical
   * `{ schemaVersion, writtenAt, overrides }` payload. This prevents
   * hand-edits from bypassing the audited SuperAdmin propose ->
   * execute flow. A missing or invalid signature is an honest
   * degraded-load state (`signature_mismatch`), not a silent restore.
   */
  signature: string;
}

export interface PersistedOverridesFileV2 {
  schemaVersion: 2;
  writtenAt: string;
  /** Legacy/global snapshot used by test helpers and any non-tenant future admin flow. */
  globalOverrides: LayoutCapacityOverridesPayload;
  /** Tenant-scoped snapshots keyed by authenticated organizationId. */
  tenantOverridesByOrganizationId: Record<string, LayoutCapacityRegistrySnapshot>;
  /** HMAC-SHA256 over `{ schemaVersion, writtenAt, globalOverrides, tenantOverridesByOrganizationId }`. */
  signature: string;
}

type PersistedOverridesFile = PersistedOverridesFileV1 | PersistedOverridesFileV2;

const PERSISTENCE_HMAC_SECRET_ENV = 'CONSULTIFY_LAYOUT_CAPACITY_OVERRIDES_HMAC_SECRET';

function resolvePersistenceSigningSecret(): string | null {
  const secret = process.env[PERSISTENCE_HMAC_SECRET_ENV];
  if (typeof secret === 'string' && secret.trim()) return secret.trim();
  // Tests use an implicit deterministic secret so existing mock-driver
  // tests stay hermetic without leaking a production default.
  if (process.env.NODE_ENV === 'test') return 'test-layout-capacity-persistence-secret';
  return null;
}

function canonicalSigningPayload(
  file:
    | Pick<PersistedOverridesFileV1, 'schemaVersion' | 'writtenAt' | 'overrides'>
    | Pick<
        PersistedOverridesFileV2,
        'schemaVersion' | 'writtenAt' | 'globalOverrides' | 'tenantOverridesByOrganizationId'
      >
): string {
  if (file.schemaVersion === 1) {
    return JSON.stringify({
      schemaVersion: file.schemaVersion,
      writtenAt: file.writtenAt,
      overrides: file.overrides,
    });
  }
  return JSON.stringify({
    schemaVersion: file.schemaVersion,
    writtenAt: file.writtenAt,
    globalOverrides: file.globalOverrides,
    tenantOverridesByOrganizationId: file.tenantOverridesByOrganizationId,
  });
}

function signPersistedOverridesFile(
  file:
    | Pick<PersistedOverridesFileV1, 'schemaVersion' | 'writtenAt' | 'overrides'>
    | Pick<
        PersistedOverridesFileV2,
        'schemaVersion' | 'writtenAt' | 'globalOverrides' | 'tenantOverridesByOrganizationId'
      >,
  secret: string
): string {
  // Lazy require keeps import-time behavior unchanged for tests that
  // replace the file-system driver before defaultDriver() is touched.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const crypto = require('crypto') as typeof import('crypto');
  return crypto
    .createHmac('sha256', secret)
    .update(canonicalSigningPayload(file), 'utf-8')
    .digest('hex');
}

function verifyPersistedOverridesSignature(file: Partial<PersistedOverridesFile>): {
  ok: boolean;
  details?: string;
} {
  if (typeof file.signature !== 'string' || !file.signature.trim()) {
    return { ok: false, details: 'signature field missing or empty' };
  }
  const secret = resolvePersistenceSigningSecret();
  if (!secret) {
    return {
      ok: false,
      details: `${PERSISTENCE_HMAC_SECRET_ENV} is not configured; refusing to trust persisted overrides`,
    };
  }
  const expected =
    file.schemaVersion === 2
      ? signPersistedOverridesFile(
          {
            schemaVersion: 2,
            writtenAt: typeof file.writtenAt === 'string' ? file.writtenAt : '',
            globalOverrides: (file as Partial<PersistedOverridesFileV2>)
              .globalOverrides as LayoutCapacityOverridesPayload,
            tenantOverridesByOrganizationId: (file as Partial<PersistedOverridesFileV2>)
              .tenantOverridesByOrganizationId as Record<string, LayoutCapacityRegistrySnapshot>,
          },
          secret
        )
      : signPersistedOverridesFile(
          {
            schemaVersion: 1,
            writtenAt: typeof file.writtenAt === 'string' ? file.writtenAt : '',
            overrides: (file as Partial<PersistedOverridesFileV1>)
              .overrides as LayoutCapacityOverridesPayload,
          },
          secret
        );
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const crypto = require('crypto') as typeof import('crypto');
  const actualBuffer = Buffer.from(file.signature, 'hex');
  const expectedBuffer = Buffer.from(expected, 'hex');
  if (
    actualBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(actualBuffer, expectedBuffer)
  ) {
    return { ok: false, details: 'signature does not match persisted override contents' };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Read path
// ---------------------------------------------------------------------------

export type LoadPersistedOverridesResult =
  | {
      ok: true;
      payload: LayoutCapacityOverridesPayload;
      tenantPayloadsByOrganizationId: Record<string, LayoutCapacityRegistrySnapshot>;
      writtenAt: string;
      sourcePath: string;
    }
  | {
      ok: false;
      reason: 'missing' | 'corrupt' | 'unsupported_schema' | 'io_error' | 'signature_mismatch';
      sourcePath: string;
      details?: string;
    };

/**
 * Read the persisted overrides file. Pure with respect to side effects
 * (it does not mutate the registry — `restorePersistedOverrides` does).
 *
 * Behaviour:
 *   - missing file -> `{ ok: false, reason: 'missing' }` (silent default).
 *   - parse error / wrong shape -> `{ ok: false, reason: 'corrupt' }`.
 *   - unsupported schemaVersion -> `{ ok: false, reason: 'unsupported_schema' }`.
 *   - missing / invalid signature -> `{ ok: false, reason: 'signature_mismatch' }`.
 *   - I/O failure -> `{ ok: false, reason: 'io_error', details }`.
 *   - success -> `{ ok: true, payload, writtenAt, sourcePath }`.
 */
export function loadPersistedOverrides(): LoadPersistedOverridesResult {
  const sourcePath = resolvePersistencePath();
  const driver = getDriver();
  if (!driver.exists(sourcePath)) {
    return { ok: false, reason: 'missing', sourcePath };
  }
  let raw: string;
  try {
    raw = driver.readFile(sourcePath);
  } catch (err: unknown) {
    return {
      ok: false,
      reason: 'io_error',
      sourcePath,
      details: err instanceof Error ? err.message : String(err),
    };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err: unknown) {
    return {
      ok: false,
      reason: 'corrupt',
      sourcePath,
      details: err instanceof Error ? err.message : String(err),
    };
  }
  if (!parsed || typeof parsed !== 'object') {
    return {
      ok: false,
      reason: 'corrupt',
      sourcePath,
      details: 'top-level value is not an object',
    };
  }
  const obj = parsed as Partial<PersistedOverridesFile>;
  const schemaVersion: unknown = obj.schemaVersion;
  if (schemaVersion !== 1 && schemaVersion !== 2) {
    return {
      ok: false,
      reason: 'unsupported_schema',
      sourcePath,
      details: `expected schemaVersion=1 or 2, got ${String(schemaVersion)}`,
    };
  }
  if (
    obj.schemaVersion === 1 &&
    (!(obj as Partial<PersistedOverridesFileV1>).overrides ||
      typeof (obj as Partial<PersistedOverridesFileV1>).overrides !== 'object')
  ) {
    return {
      ok: false,
      reason: 'corrupt',
      sourcePath,
      details: 'overrides field missing or not an object',
    };
  }
  if (obj.schemaVersion === 2) {
    const v2 = obj as Partial<PersistedOverridesFileV2>;
    if (!v2.globalOverrides || typeof v2.globalOverrides !== 'object') {
      return {
        ok: false,
        reason: 'corrupt',
        sourcePath,
        details: 'globalOverrides field missing or not an object',
      };
    }
    if (
      !v2.tenantOverridesByOrganizationId ||
      typeof v2.tenantOverridesByOrganizationId !== 'object'
    ) {
      return {
        ok: false,
        reason: 'corrupt',
        sourcePath,
        details: 'tenantOverridesByOrganizationId field missing or not an object',
      };
    }
  }
  const signature = verifyPersistedOverridesSignature(obj);
  if (signature.ok === false) {
    return {
      ok: false,
      reason: 'signature_mismatch',
      sourcePath,
      details: signature.details,
    };
  }
  const writtenAt = typeof obj.writtenAt === 'string' ? obj.writtenAt : '';
  const payload =
    obj.schemaVersion === 2
      ? ((obj as Partial<PersistedOverridesFileV2>)
          .globalOverrides as LayoutCapacityOverridesPayload)
      : ((obj as Partial<PersistedOverridesFileV1>).overrides as LayoutCapacityOverridesPayload);
  const tenantPayloadsByOrganizationId =
    obj.schemaVersion === 2
      ? ((obj as Partial<PersistedOverridesFileV2>).tenantOverridesByOrganizationId as Record<
          string,
          LayoutCapacityRegistrySnapshot
        >)
      : {};
  return {
    ok: true,
    payload,
    tenantPayloadsByOrganizationId,
    writtenAt,
    sourcePath,
  };
}

// ---------------------------------------------------------------------------
// Write path
// ---------------------------------------------------------------------------

export type SavePersistedOverridesResult =
  | { ok: true; sourcePath: string; writtenAt: string }
  | { ok: false; reason: 'io_error'; sourcePath: string; details: string };

/**
 * Persist the supplied overrides payload to disk. Returns a structured
 * result; on failure NO exception is thrown so the caller (registry's
 * apply path) can decide whether to surface the failure or swallow it.
 *
 * The payload is written verbatim — caller is responsible for passing
 * the FULL accumulated state (not a delta), so a future load fully
 * restores the registry without needing intermediate history.
 */
export function savePersistedOverrides(
  payload: LayoutCapacityOverridesPayload,
  now?: Date
): SavePersistedOverridesResult {
  const sourcePath = resolvePersistencePath();
  const writtenAt = (now ?? new Date()).toISOString();
  const file: PersistedOverridesFileV2 = {
    schemaVersion: 2,
    writtenAt,
    globalOverrides: payload,
    tenantOverridesByOrganizationId: getAllTenantRegistrySnapshots(),
    signature: '',
  };
  const driver = getDriver();
  try {
    const secret = resolvePersistenceSigningSecret();
    if (!secret) {
      throw new Error(`${PERSISTENCE_HMAC_SECRET_ENV} is not configured`);
    }
    file.signature = signPersistedOverridesFile(file, secret);
    driver.writeFile(sourcePath, JSON.stringify(file, null, 2));
    return { ok: true, sourcePath, writtenAt };
  } catch (err: unknown) {
    return {
      ok: false,
      reason: 'io_error',
      sourcePath,
      details: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Remove the persisted file. Used by `resetToDefaults` so a future
 * "reset" admin action (R-S17-4) is honest — without this, a reset
 * would re-load the persisted overrides on the next restart.
 */
export function clearPersistedOverrides():
  | { ok: true; sourcePath: string }
  | { ok: false; reason: 'io_error'; sourcePath: string; details: string } {
  const sourcePath = resolvePersistencePath();
  const driver = getDriver();
  try {
    driver.removeFile(sourcePath);
    return { ok: true, sourcePath };
  } catch (err: unknown) {
    return {
      ok: false,
      reason: 'io_error',
      sourcePath,
      details: err instanceof Error ? err.message : String(err),
    };
  }
}

// ---------------------------------------------------------------------------
// Restore path (read + apply)
// ---------------------------------------------------------------------------

export type RestoreLoadOutcome =
  | {
      status: 'restored';
      sourcePath: string;
      writtenAt: string;
      applyResult: LayoutCapacityApplyResult;
    }
  | { status: 'no_persisted_file'; sourcePath: string }
  | {
      status: 'corrupt';
      sourcePath: string;
      reason: 'corrupt' | 'unsupported_schema' | 'io_error' | 'signature_mismatch';
      details?: string;
    }
  | {
      status: 'rejected_by_validator';
      sourcePath: string;
      writtenAt: string;
      errors: LayoutCapacityApplyResult['errors'];
    };

/**
 * Read the persisted file (if any) and apply it to the live registry.
 * Calls into `applyOverrides` so the registry validator gates the
 * payload — a previously-valid persisted payload that the current
 * baseline rejects is treated as `rejected_by_validator` and the
 * registry stays at its pre-restore (defaults) state.
 *
 * This function is intended to be called once at server boot. The
 * registry module wires it via `restorePersistedOverridesIfPresent`
 * (S18). Tests can call it directly with a mock driver.
 */
export function restorePersistedOverrides(): RestoreLoadOutcome {
  const load = loadPersistedOverrides();
  if (load.ok === false) {
    if (load.reason === 'missing') {
      return { status: 'no_persisted_file', sourcePath: load.sourcePath };
    }
    return {
      status: 'corrupt',
      sourcePath: load.sourcePath,
      reason: load.reason,
      details: load.details,
    };
  }
  // Reset to defaults BEFORE applying so we replay an exact snapshot
  // (the persisted payload is the FULL accumulated state, not a delta).
  resetToDefaults();
  const applyResult = applyOverrides(load.payload);
  if (applyResult.ok === false) {
    // Roll back: registry already had defaults at this point but the
    // partial apply would have been short-circuited by the validator
    // (apply is all-or-nothing). Defaults remain.
    return {
      status: 'rejected_by_validator',
      sourcePath: load.sourcePath,
      writtenAt: load.writtenAt,
      errors: applyResult.errors,
    };
  }
  for (const [organizationId, snapshot] of Object.entries(load.tenantPayloadsByOrganizationId)) {
    const tenantApply = applyOverrides(snapshot, organizationId);
    if (tenantApply.ok === false) {
      resetToDefaults();
      return {
        status: 'rejected_by_validator',
        sourcePath: load.sourcePath,
        writtenAt: load.writtenAt,
        errors: tenantApply.errors,
      };
    }
  }
  return {
    status: 'restored',
    sourcePath: load.sourcePath,
    writtenAt: load.writtenAt,
    applyResult,
  };
}

// ---------------------------------------------------------------------------
// Bootstrap: wire registry hooks + restore on startup
// ---------------------------------------------------------------------------

/**
 * One-shot bootstrap entry point. Called once at server start (from the
 * Gateway initialization path) to:
 *   1. Attempt to restore the persisted overrides into the live registry.
 *      A missing file is silent; a corrupt file raises a degraded
 *      load-warning on the registry's load-warning channel and falls
 *      back to defaults.
 *   2. Wire the registry hooks so subsequent `applyOverrides` /
 *      `resetToDefaults` calls keep the on-disk file in sync with the
 *      live registry state.
 *
 * Returns the restore outcome so the caller can log it. The function
 * is idempotent — calling it twice is safe (it re-restores from disk
 * and re-wires the hooks; the latter replaces any prior hooks).
 *
 * Test isolation: tests SHOULD NOT call this function directly. They
 * should set the driver / path overrides and call
 * `restorePersistedOverrides` for read paths, or call the registry's
 * `applyOverrides` with hooks already wired by their own setup.
 */
export function initializeLayoutCapacityPersistence(): RestoreLoadOutcome {
  const outcome = restorePersistedOverrides();
  if (outcome.status === 'corrupt') {
    setRegistryLoadWarning({
      reason: outcome.reason,
      sourcePath: outcome.sourcePath,
      details: outcome.details,
      raisedAt: new Date().toISOString(),
    });
  } else if (outcome.status === 'rejected_by_validator') {
    setRegistryLoadWarning({
      reason: 'rejected_by_validator',
      sourcePath: outcome.sourcePath,
      details: outcome.errors.map((e) => `${e.path}: ${e.reason}`).join('; '),
      raisedAt: new Date().toISOString(),
    });
  } else {
    // 'restored' or 'no_persisted_file' both clear any prior warning.
    setRegistryLoadWarning(null);
  }

  const hooks: LayoutCapacityRegistryHooks = {
    onApply() {
      // Persist the FULL snapshot. We cannot just persist the delta
      // because a future restart needs to replay the whole thing.
      // Note: we round-trip through `LayoutCapacityOverridesPayload`
      // shape (the snapshot already matches the payload shape's
      // overlap), so the file is self-contained.
      const payload: LayoutCapacityOverridesPayload = {
        densityBudgets: getCurrentRegistrySnapshot().densityBudgets,
        templateFamilyOverrides: getCurrentRegistrySnapshot().templateFamilyOverrides,
        familyAliasByDeckType: getCurrentRegistrySnapshot().familyAliasByDeckType,
      };
      const result = savePersistedOverrides(payload);
      if (result.ok === false) {
        // Surface as a load-warning so the admin GET shows the
        // honest "we could not persist your last write" state. We
        // intentionally do NOT throw — the in-memory apply already
        // succeeded and we do not want to roll it back.
        setRegistryLoadWarning({
          reason: 'io_error',
          sourcePath: result.sourcePath,
          details: result.details,
          raisedAt: new Date().toISOString(),
        });
      } else {
        // Successful write clears any prior warning.
        setRegistryLoadWarning(null);
      }
    },
    onReset(organizationId) {
      const cleared = organizationId
        ? savePersistedOverrides({
            densityBudgets: getCurrentRegistrySnapshot().densityBudgets,
            templateFamilyOverrides: getCurrentRegistrySnapshot().templateFamilyOverrides,
            familyAliasByDeckType: getCurrentRegistrySnapshot().familyAliasByDeckType,
          })
        : clearPersistedOverrides();
      if (cleared.ok === false) {
        setRegistryLoadWarning({
          reason: 'io_error',
          sourcePath: cleared.sourcePath,
          details: cleared.details,
          raisedAt: new Date().toISOString(),
        });
      } else {
        setRegistryLoadWarning(null);
      }
    },
  };
  setRegistryHooks(hooks);
  return outcome;
}

/**
 * Tear down the persistence wiring. Used by tests (and by future
 * graceful-shutdown paths) to disconnect the hooks without affecting
 * the on-disk file. Calling this DOES NOT clear the registry's
 * load-warning channel.
 */
export function teardownLayoutCapacityPersistence(): void {
  setRegistryHooks(null);
}
