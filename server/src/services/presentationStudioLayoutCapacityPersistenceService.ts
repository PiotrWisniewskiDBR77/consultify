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

import {
  applyOverrides,
  type LayoutCapacityApplyResult,
  type LayoutCapacityOverridesPayload,
  type LayoutCapacityRegistryHooks,
  resetToDefaults,
  setRegistryHooks,
  setRegistryLoadWarning,
} from './presentationStudioLayoutCapacityRegistryService.js';

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
      const dir = path.dirname(p);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(p, contents, 'utf-8');
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
}

// ---------------------------------------------------------------------------
// Read path
// ---------------------------------------------------------------------------

export type LoadPersistedOverridesResult =
  | { ok: true; payload: LayoutCapacityOverridesPayload; writtenAt: string; sourcePath: string }
  | {
      ok: false;
      reason: 'missing' | 'corrupt' | 'unsupported_schema' | 'io_error';
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
  const obj = parsed as Partial<PersistedOverridesFileV1>;
  if (obj.schemaVersion !== 1) {
    return {
      ok: false,
      reason: 'unsupported_schema',
      sourcePath,
      details: `expected schemaVersion=1, got ${String(obj.schemaVersion)}`,
    };
  }
  if (!obj.overrides || typeof obj.overrides !== 'object') {
    return {
      ok: false,
      reason: 'corrupt',
      sourcePath,
      details: 'overrides field missing or not an object',
    };
  }
  const writtenAt = typeof obj.writtenAt === 'string' ? obj.writtenAt : '';
  return {
    ok: true,
    payload: obj.overrides as LayoutCapacityOverridesPayload,
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
  const file: PersistedOverridesFileV1 = {
    schemaVersion: 1,
    writtenAt,
    overrides: payload,
  };
  const driver = getDriver();
  try {
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
      reason: 'corrupt' | 'unsupported_schema' | 'io_error';
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
  if (!load.ok) {
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
  if (!applyResult.ok) {
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
    onApply(snapshot) {
      // Persist the FULL snapshot. We cannot just persist the delta
      // because a future restart needs to replay the whole thing.
      // Note: we round-trip through `LayoutCapacityOverridesPayload`
      // shape (the snapshot already matches the payload shape's
      // overlap), so the file is self-contained.
      const payload: LayoutCapacityOverridesPayload = {
        densityBudgets: snapshot.densityBudgets,
        templateFamilyOverrides: snapshot.templateFamilyOverrides,
        familyAliasByDeckType: snapshot.familyAliasByDeckType,
      };
      const result = savePersistedOverrides(payload);
      if (!result.ok) {
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
    onReset() {
      const cleared = clearPersistedOverrides();
      if (!cleared.ok) {
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
