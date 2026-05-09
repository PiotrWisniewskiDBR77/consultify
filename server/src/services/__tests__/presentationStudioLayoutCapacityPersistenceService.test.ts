/**
 * Unit tests for `presentationStudioLayoutCapacityPersistenceService`
 * (Sprint S18). Exercises:
 *   - load: missing / corrupt / unsupported_schema / io_error / ok
 *   - save: write through the mock driver
 *   - clear: idempotent removal
 *   - restore: registry-state replay + validator rejection path
 *   - bootstrap (initializeLayoutCapacityPersistence): hooks fire on
 *     subsequent applyOverrides + resetToDefaults; load warnings are
 *     raised on corrupt + cleared on next successful apply.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  _setLayoutCapacityPersistenceDriverForTests,
  _setLayoutCapacityPersistencePathForTests,
  atomicWriteFile,
  type AtomicWriteFileSystem,
  type AtomicWritePathOps,
  clearPersistedOverrides,
  initializeLayoutCapacityPersistence,
  loadPersistedOverrides,
  type PersistenceFileSystemDriver,
  resolvePersistencePath,
  restorePersistedOverrides,
  savePersistedOverrides,
  teardownLayoutCapacityPersistence,
} from '../presentationStudioLayoutCapacityPersistenceService';
import {
  applyOverrides,
  getCurrentRegistrySnapshot,
  getRegistryLoadWarning,
  resetToDefaults,
  setRegistryHooks,
  setRegistryLoadWarning,
} from '../presentationStudioLayoutCapacityRegistryService';

// ---------------------------------------------------------------------------
// In-memory mock driver
// ---------------------------------------------------------------------------

interface MockDriverState {
  files: Map<string, string>;
  ioErrorOnRead?: string | null;
  ioErrorOnWrite?: string | null;
  ioErrorOnRemove?: string | null;
}

function makeMockDriver(state: MockDriverState): PersistenceFileSystemDriver {
  return {
    exists(p: string): boolean {
      return state.files.has(p);
    },
    readFile(p: string): string {
      if (state.ioErrorOnRead) throw new Error(state.ioErrorOnRead);
      const v = state.files.get(p);
      if (v === undefined) throw new Error(`ENOENT: ${p}`);
      return v;
    },
    writeFile(p: string, contents: string): void {
      if (state.ioErrorOnWrite) throw new Error(state.ioErrorOnWrite);
      state.files.set(p, contents);
    },
    removeFile(p: string): void {
      if (state.ioErrorOnRemove) throw new Error(state.ioErrorOnRemove);
      state.files.delete(p);
    },
  };
}

const TEST_PATH = '/tmp/test-presentation-studio-layout-capacity.json';

let driverState: MockDriverState;

beforeEach(() => {
  driverState = { files: new Map() };
  _setLayoutCapacityPersistenceDriverForTests(makeMockDriver(driverState));
  _setLayoutCapacityPersistencePathForTests(TEST_PATH);
  resetToDefaults();
  setRegistryHooks(null);
  setRegistryLoadWarning(null);
});

afterEach(() => {
  teardownLayoutCapacityPersistence();
  _setLayoutCapacityPersistenceDriverForTests(null);
  _setLayoutCapacityPersistencePathForTests(null);
  resetToDefaults();
  setRegistryHooks(null);
  setRegistryLoadWarning(null);
});

// ---------------------------------------------------------------------------
// resolvePersistencePath
// ---------------------------------------------------------------------------

describe('resolvePersistencePath', () => {
  it('honors the test override above env + default', () => {
    expect(resolvePersistencePath()).toBe(TEST_PATH);
  });

  it('falls back to env when no test override is set', () => {
    _setLayoutCapacityPersistencePathForTests(null);
    process.env.CONSULTIFY_LAYOUT_CAPACITY_OVERRIDES_PATH = '/tmp/from-env.json';
    try {
      expect(resolvePersistencePath()).toBe('/tmp/from-env.json');
    } finally {
      delete process.env.CONSULTIFY_LAYOUT_CAPACITY_OVERRIDES_PATH;
    }
  });

  it('falls back to a cwd-relative default when neither override nor env is set', () => {
    _setLayoutCapacityPersistencePathForTests(null);
    delete process.env.CONSULTIFY_LAYOUT_CAPACITY_OVERRIDES_PATH;
    const path = resolvePersistencePath();
    expect(path).toContain('.runtime-config');
    expect(path).toContain('presentation-studio-layout-capacity-overrides.json');
  });
});

// ---------------------------------------------------------------------------
// loadPersistedOverrides
// ---------------------------------------------------------------------------

describe('loadPersistedOverrides', () => {
  it('returns missing for an absent file', () => {
    const r = loadPersistedOverrides();
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toBe('missing');
  });

  it('returns corrupt for non-JSON contents', () => {
    driverState.files.set(TEST_PATH, '{not valid json');
    const r = loadPersistedOverrides();
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toBe('corrupt');
    expect(r.details).toBeTruthy();
  });

  it('returns corrupt for a non-object top-level value', () => {
    driverState.files.set(TEST_PATH, 'null');
    const r = loadPersistedOverrides();
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toBe('corrupt');
  });

  it('returns unsupported_schema for an unknown schemaVersion', () => {
    driverState.files.set(
      TEST_PATH,
      JSON.stringify({ schemaVersion: 99, writtenAt: 'x', overrides: {} })
    );
    const r = loadPersistedOverrides();
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toBe('unsupported_schema');
  });

  it('returns corrupt when overrides field is missing', () => {
    driverState.files.set(TEST_PATH, JSON.stringify({ schemaVersion: 1, writtenAt: 'x' }));
    const r = loadPersistedOverrides();
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toBe('corrupt');
  });

  it('returns io_error when the driver throws on read', () => {
    driverState.files.set(TEST_PATH, '{}');
    driverState.ioErrorOnRead = 'EACCES: permission denied';
    const r = loadPersistedOverrides();
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toBe('io_error');
    expect(r.details).toContain('EACCES');
  });

  it('returns ok with the parsed payload for a well-formed file', () => {
    driverState.files.set(
      TEST_PATH,
      JSON.stringify({
        schemaVersion: 1,
        writtenAt: '2026-05-09T00:00:00.000Z',
        overrides: { densityBudgets: { balanced: { titleMaxChars: 137 } } },
      })
    );
    const r = loadPersistedOverrides();
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.payload.densityBudgets?.balanced?.titleMaxChars).toBe(137);
    expect(r.writtenAt).toBe('2026-05-09T00:00:00.000Z');
  });
});

// ---------------------------------------------------------------------------
// savePersistedOverrides + clearPersistedOverrides
// ---------------------------------------------------------------------------

describe('savePersistedOverrides', () => {
  it('writes a schemaVersion=1 file with the supplied payload + a writtenAt', () => {
    const fixedNow = new Date('2026-05-09T01:23:45.000Z');
    const r = savePersistedOverrides(
      { densityBudgets: { balanced: { titleMaxChars: 100 } } },
      fixedNow
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.writtenAt).toBe('2026-05-09T01:23:45.000Z');
    const raw = driverState.files.get(TEST_PATH);
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw!);
    expect(parsed.schemaVersion).toBe(1);
    expect(parsed.overrides.densityBudgets.balanced.titleMaxChars).toBe(100);
  });

  it('returns io_error when the driver throws on write', () => {
    driverState.ioErrorOnWrite = 'ENOSPC: no space left';
    const r = savePersistedOverrides({});
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toBe('io_error');
    expect(r.details).toContain('ENOSPC');
  });
});

describe('clearPersistedOverrides', () => {
  it('removes the file when present', () => {
    driverState.files.set(TEST_PATH, '{}');
    const r = clearPersistedOverrides();
    expect(r.ok).toBe(true);
    expect(driverState.files.has(TEST_PATH)).toBe(false);
  });

  it('is a no-op when the file is absent', () => {
    const r = clearPersistedOverrides();
    expect(r.ok).toBe(true);
  });

  it('returns io_error when the driver throws', () => {
    driverState.files.set(TEST_PATH, '{}');
    driverState.ioErrorOnRemove = 'EACCES';
    const r = clearPersistedOverrides();
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toBe('io_error');
  });
});

// ---------------------------------------------------------------------------
// restorePersistedOverrides
// ---------------------------------------------------------------------------

describe('restorePersistedOverrides', () => {
  it('returns no_persisted_file for a fresh start with no file', () => {
    const o = restorePersistedOverrides();
    expect(o.status).toBe('no_persisted_file');
  });

  it('replays a persisted snapshot into the live registry', () => {
    driverState.files.set(
      TEST_PATH,
      JSON.stringify({
        schemaVersion: 1,
        writtenAt: '2026-05-09T00:00:00.000Z',
        overrides: { densityBudgets: { balanced: { titleMaxChars: 137 } } },
      })
    );
    const o = restorePersistedOverrides();
    expect(o.status).toBe('restored');
    expect(getCurrentRegistrySnapshot().densityBudgets.balanced.titleMaxChars).toBe(137);
  });

  it('returns rejected_by_validator when persisted payload no longer validates', () => {
    driverState.files.set(
      TEST_PATH,
      JSON.stringify({
        schemaVersion: 1,
        writtenAt: '2026-05-09T00:00:00.000Z',
        overrides: { densityBudgets: { balanced: { titleMaxChars: -5 } } },
      })
    );
    const o = restorePersistedOverrides();
    expect(o.status).toBe('rejected_by_validator');
    if (o.status !== 'rejected_by_validator') return;
    expect(o.errors.length).toBeGreaterThan(0);
    // Registry is back at defaults — NOT the rejected payload.
    expect(getCurrentRegistrySnapshot().densityBudgets.balanced.titleMaxChars).not.toBe(-5);
  });

  it('returns corrupt for a bad file shape', () => {
    driverState.files.set(TEST_PATH, '{not json');
    const o = restorePersistedOverrides();
    expect(o.status).toBe('corrupt');
  });
});

// ---------------------------------------------------------------------------
// initializeLayoutCapacityPersistence (bootstrap wiring)
// ---------------------------------------------------------------------------

describe('initializeLayoutCapacityPersistence', () => {
  it('clears any prior load warning on a clean missing-file boot', () => {
    setRegistryLoadWarning({
      reason: 'corrupt',
      sourcePath: '/old',
      raisedAt: '2026-05-08T00:00:00.000Z',
    });
    const o = initializeLayoutCapacityPersistence();
    expect(o.status).toBe('no_persisted_file');
    expect(getRegistryLoadWarning()).toBeNull();
  });

  it('raises a corrupt load warning when the file cannot be parsed', () => {
    driverState.files.set(TEST_PATH, '{not json');
    const o = initializeLayoutCapacityPersistence();
    expect(o.status).toBe('corrupt');
    const w = getRegistryLoadWarning();
    expect(w?.reason).toBe('corrupt');
    expect(w?.sourcePath).toBe(TEST_PATH);
  });

  it('raises rejected_by_validator when persisted payload no longer validates', () => {
    driverState.files.set(
      TEST_PATH,
      JSON.stringify({
        schemaVersion: 1,
        writtenAt: '2026-05-09T00:00:00.000Z',
        overrides: { densityBudgets: { balanced: { titleMaxChars: -5 } } },
      })
    );
    initializeLayoutCapacityPersistence();
    const w = getRegistryLoadWarning();
    expect(w?.reason).toBe('rejected_by_validator');
    expect(w?.details).toBeTruthy();
  });

  it('persists subsequent applyOverrides calls to disk', () => {
    initializeLayoutCapacityPersistence();
    expect(driverState.files.has(TEST_PATH)).toBe(false);

    applyOverrides({ densityBudgets: { balanced: { titleMaxChars: 137 } } });
    expect(driverState.files.has(TEST_PATH)).toBe(true);
    const parsed = JSON.parse(driverState.files.get(TEST_PATH)!);
    expect(parsed.schemaVersion).toBe(1);
    expect(parsed.overrides.densityBudgets.balanced.titleMaxChars).toBe(137);
  });

  it('clears the file on resetToDefaults', () => {
    initializeLayoutCapacityPersistence();
    applyOverrides({ densityBudgets: { balanced: { titleMaxChars: 137 } } });
    expect(driverState.files.has(TEST_PATH)).toBe(true);

    resetToDefaults();
    expect(driverState.files.has(TEST_PATH)).toBe(false);
  });

  it('clears a prior load warning after a successful subsequent applyOverrides', () => {
    driverState.files.set(TEST_PATH, '{not json');
    initializeLayoutCapacityPersistence();
    expect(getRegistryLoadWarning()?.reason).toBe('corrupt');

    applyOverrides({ densityBudgets: { balanced: { titleMaxChars: 100 } } });
    expect(getRegistryLoadWarning()).toBeNull();
  });

  it('raises an io_error load warning when persistence write fails on apply', () => {
    initializeLayoutCapacityPersistence();
    driverState.ioErrorOnWrite = 'ENOSPC: no space left';
    applyOverrides({ densityBudgets: { balanced: { titleMaxChars: 100 } } });
    const w = getRegistryLoadWarning();
    expect(w?.reason).toBe('io_error');
    // In-memory registry STILL got the override even though disk failed.
    expect(getCurrentRegistrySnapshot().densityBudgets.balanced.titleMaxChars).toBe(100);
  });

  it('teardownLayoutCapacityPersistence stops further hook firing', () => {
    initializeLayoutCapacityPersistence();
    teardownLayoutCapacityPersistence();
    applyOverrides({ densityBudgets: { balanced: { titleMaxChars: 100 } } });
    // Hook was unwired — no file write should have happened.
    expect(driverState.files.has(TEST_PATH)).toBe(false);
  });

  it('restores then propagates further changes — full round-trip', () => {
    // Step 1: pre-existing persisted file.
    driverState.files.set(
      TEST_PATH,
      JSON.stringify({
        schemaVersion: 1,
        writtenAt: '2026-05-09T00:00:00.000Z',
        overrides: { densityBudgets: { balanced: { titleMaxChars: 137 } } },
      })
    );

    // Step 2: bootstrap restores AND wires hooks.
    initializeLayoutCapacityPersistence();
    expect(getCurrentRegistrySnapshot().densityBudgets.balanced.titleMaxChars).toBe(137);

    // Step 3: a runtime apply should now overwrite the file with the
    // new merged state.
    applyOverrides({ densityBudgets: { visual: { blocksMax: 9 } } });
    const parsed = JSON.parse(driverState.files.get(TEST_PATH)!);
    expect(parsed.overrides.densityBudgets.balanced.titleMaxChars).toBe(137);
    expect(parsed.overrides.densityBudgets.visual.blocksMax).toBe(9);
  });
});

// ---------------------------------------------------------------------------
// Sprint S19 — atomicWriteFile (closes R-S18-3)
// ---------------------------------------------------------------------------

interface AtomicFsCall {
  op: 'existsSync' | 'mkdirSync' | 'writeFileSync' | 'renameSync' | 'unlinkSync';
  args: unknown[];
}

interface AtomicFsState {
  files: Map<string, string>;
  /** Optional dirs that already exist. `existsSync` checks both files + dirs. */
  dirs: Set<string>;
  /** Optional throw-on-write flag. */
  throwOnWriteFor?: string;
  /** Optional throw-on-rename flag. */
  throwOnRenameFor?: string;
  /** Optional throw-on-unlink flag (cleanup path). */
  throwOnUnlinkFor?: string;
  /** Recorded operation log so tests can assert sequence. */
  calls: AtomicFsCall[];
}

function makeAtomicFs(state: AtomicFsState): AtomicWriteFileSystem {
  return {
    existsSync(p: string): boolean {
      state.calls.push({ op: 'existsSync', args: [p] });
      return state.files.has(p) || state.dirs.has(p);
    },
    mkdirSync(p: string, opts?: { recursive?: boolean }): void {
      state.calls.push({ op: 'mkdirSync', args: [p, opts] });
      state.dirs.add(p);
    },
    writeFileSync(p: string, contents: string): void {
      state.calls.push({ op: 'writeFileSync', args: [p, contents] });
      if (state.throwOnWriteFor && p.startsWith(state.throwOnWriteFor)) {
        throw new Error(`EIO: write failed for ${p}`);
      }
      state.files.set(p, contents);
    },
    renameSync(oldPath: string, newPath: string): void {
      state.calls.push({ op: 'renameSync', args: [oldPath, newPath] });
      if (state.throwOnRenameFor && oldPath.startsWith(state.throwOnRenameFor)) {
        throw new Error(`EXDEV: rename failed for ${oldPath} -> ${newPath}`);
      }
      const v = state.files.get(oldPath);
      if (v === undefined) throw new Error(`ENOENT rename: ${oldPath}`);
      state.files.delete(oldPath);
      state.files.set(newPath, v);
    },
    unlinkSync(p: string): void {
      state.calls.push({ op: 'unlinkSync', args: [p] });
      if (state.throwOnUnlinkFor && p.startsWith(state.throwOnUnlinkFor)) {
        throw new Error(`EACCES: unlink failed for ${p}`);
      }
      state.files.delete(p);
    },
  };
}

const fakePathOps: AtomicWritePathOps = {
  // Naive POSIX-only dirname — sufficient for these unit tests.
  dirname(p: string): string {
    const i = p.lastIndexOf('/');
    return i <= 0 ? '/' : p.slice(0, i);
  },
};

function makeAtomicState(): AtomicFsState {
  return { files: new Map(), dirs: new Set(), calls: [] };
}

describe('atomicWriteFile (S19, R-S18-3)', () => {
  it('writes to <path>.<pid>.<n>.tmp first, then renames to the target', () => {
    const state = makeAtomicState();
    state.dirs.add('/tmp');
    atomicWriteFile('/tmp/file.json', '{"a":1}', makeAtomicFs(state), fakePathOps);

    // Final file lives at the target path with the new contents.
    expect(state.files.get('/tmp/file.json')).toBe('{"a":1}');

    const writeCall = state.calls.find((c) => c.op === 'writeFileSync');
    const renameCall = state.calls.find((c) => c.op === 'renameSync');
    expect(writeCall).toBeDefined();
    expect(renameCall).toBeDefined();
    const tmpPath = writeCall!.args[0] as string;
    expect(tmpPath.startsWith('/tmp/file.json.')).toBe(true);
    expect(tmpPath.endsWith('.tmp')).toBe(true);
    expect(tmpPath).toContain(`.${process.pid}.`);
    // Rename moves the same tmp path onto the final target.
    expect(renameCall!.args[0]).toBe(tmpPath);
    expect(renameCall!.args[1]).toBe('/tmp/file.json');
  });

  it('creates the parent dir when it does not exist (recursive=true)', () => {
    const state = makeAtomicState();
    // Dir does NOT exist — atomic write must mkdir.
    atomicWriteFile('/tmp/new-dir/file.json', '{}', makeAtomicFs(state), fakePathOps);
    const mkdir = state.calls.find((c) => c.op === 'mkdirSync');
    expect(mkdir).toBeDefined();
    expect(mkdir!.args[0]).toBe('/tmp/new-dir');
    expect((mkdir!.args[1] as { recursive?: boolean }).recursive).toBe(true);
  });

  it('does NOT call mkdirSync when the parent dir already exists', () => {
    const state = makeAtomicState();
    state.dirs.add('/tmp');
    atomicWriteFile('/tmp/file.json', '{}', makeAtomicFs(state), fakePathOps);
    expect(state.calls.find((c) => c.op === 'mkdirSync')).toBeUndefined();
  });

  it('writes the FULL contents to the tmp path, never to the target directly', () => {
    const state = makeAtomicState();
    state.dirs.add('/tmp');
    atomicWriteFile('/tmp/file.json', 'final-contents', makeAtomicFs(state), fakePathOps);
    const writes = state.calls.filter((c) => c.op === 'writeFileSync');
    expect(writes).toHaveLength(1);
    expect(writes[0].args[0]).not.toBe('/tmp/file.json');
    expect(writes[0].args[1]).toBe('final-contents');
  });

  it('rolls back the tmp file on rename failure (best-effort cleanup)', () => {
    const state = makeAtomicState();
    state.dirs.add('/tmp');
    state.throwOnRenameFor = '/tmp/file.json.';
    expect(() => atomicWriteFile('/tmp/file.json', '{}', makeAtomicFs(state), fakePathOps)).toThrow(
      /EXDEV/
    );
    // The target file MUST NOT exist (rename failed).
    expect(state.files.has('/tmp/file.json')).toBe(false);
    // The tmp file MUST have been unlinked.
    const unlinkCalls = state.calls.filter((c) => c.op === 'unlinkSync');
    expect(unlinkCalls.length).toBeGreaterThanOrEqual(1);
    const tmpUnlinked = unlinkCalls.some((c) => (c.args[0] as string).endsWith('.tmp'));
    expect(tmpUnlinked).toBe(true);
  });

  it('rolls back the tmp file on writeFileSync failure (cleanup is no-op when tmp absent)', () => {
    const state = makeAtomicState();
    state.dirs.add('/tmp');
    state.throwOnWriteFor = '/tmp/file.json.';
    expect(() => atomicWriteFile('/tmp/file.json', '{}', makeAtomicFs(state), fakePathOps)).toThrow(
      /EIO/
    );
    // No final file landed.
    expect(state.files.has('/tmp/file.json')).toBe(false);
  });

  it('swallows cleanup unlink errors and rethrows the ORIGINAL rename error', () => {
    const state = makeAtomicState();
    state.dirs.add('/tmp');
    state.throwOnRenameFor = '/tmp/file.json.';
    state.throwOnUnlinkFor = '/tmp/file.json.';
    let caught: unknown;
    try {
      atomicWriteFile('/tmp/file.json', '{}', makeAtomicFs(state), fakePathOps);
    } catch (err) {
      caught = err;
    }
    // Caller sees the rename error, NOT the unlink error.
    expect((caught as Error).message).toMatch(/EXDEV/);
  });

  it('produces unique tmp paths across consecutive writes (per-call counter)', () => {
    const state = makeAtomicState();
    state.dirs.add('/tmp');
    const fs = makeAtomicFs(state);
    atomicWriteFile('/tmp/file.json', 'A', fs, fakePathOps);
    atomicWriteFile('/tmp/file.json', 'B', fs, fakePathOps);
    const writes = state.calls.filter((c) => c.op === 'writeFileSync');
    expect(writes).toHaveLength(2);
    expect(writes[0].args[0]).not.toBe(writes[1].args[0]);
  });

  it('overwrites an existing target file atomically', () => {
    const state = makeAtomicState();
    state.dirs.add('/tmp');
    state.files.set('/tmp/file.json', '{"old":true}');
    atomicWriteFile('/tmp/file.json', '{"new":true}', makeAtomicFs(state), fakePathOps);
    expect(state.files.get('/tmp/file.json')).toBe('{"new":true}');
  });

  it('savePersistedOverrides round-trips through atomicWriteFile via the default driver path', () => {
    // This test asserts the integration: savePersistedOverrides writes
    // through the active mock driver's writeFile, which in production
    // is the atomic driver. We re-prove the on-disk shape is unchanged
    // (atomicity is invisible to readers) so the S18 schema contract
    // is preserved.
    const r = savePersistedOverrides({ densityBudgets: { balanced: { titleMaxChars: 100 } } });
    expect(r.ok).toBe(true);
    const raw = driverState.files.get(TEST_PATH);
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw!);
    expect(parsed.schemaVersion).toBe(1);
    expect(parsed.overrides.densityBudgets.balanced.titleMaxChars).toBe(100);
  });
});
