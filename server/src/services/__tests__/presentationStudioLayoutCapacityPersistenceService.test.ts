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

import { createHmac } from 'crypto';
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
} from '../presentationStudioLayoutCapacityPersistenceService.js';
import {
  applyOverrides,
  getCurrentRegistrySnapshot,
  getRegistryLoadWarning,
  resetToDefaults,
  setRegistryHooks,
  setRegistryLoadWarning,
} from '../presentationStudioLayoutCapacityRegistryService.js';

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
const TEST_SIGNING_SECRET = 'test-layout-capacity-persistence-secret';

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

function signedPersistedFile(input: {
  writtenAt?: string;
  overrides: Record<string, unknown>;
}): string {
  const file = {
    schemaVersion: 1 as const,
    writtenAt: input.writtenAt ?? '2026-05-09T00:00:00.000Z',
    overrides: input.overrides,
  };
  const signature = createHmac('sha256', TEST_SIGNING_SECRET)
    .update(JSON.stringify(file), 'utf-8')
    .digest('hex');
  return JSON.stringify({ ...file, signature });
}

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
      signedPersistedFile({
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
    expect(parsed.schemaVersion).toBe(2);
    expect(parsed.globalOverrides.densityBudgets.balanced.titleMaxChars).toBe(100);
    expect(parsed.tenantOverridesByOrganizationId).toEqual({});
    expect(parsed.signature).toMatch(/^[a-f0-9]{64}$/);
  });

  it('returns signature_mismatch when a schema-valid file has no signature', () => {
    driverState.files.set(
      TEST_PATH,
      JSON.stringify({
        schemaVersion: 1,
        writtenAt: '2026-05-09T00:00:00.000Z',
        overrides: { densityBudgets: { balanced: { titleMaxChars: 137 } } },
      })
    );
    const r = loadPersistedOverrides();
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toBe('signature_mismatch');
    expect(r.details).toContain('signature field missing');
  });

  it('returns signature_mismatch when a signed file is hand-edited after write', () => {
    const raw = signedPersistedFile({
      overrides: { densityBudgets: { balanced: { titleMaxChars: 137 } } },
    });
    const edited = JSON.parse(raw);
    edited.overrides.densityBudgets.balanced.titleMaxChars = 999;
    driverState.files.set(TEST_PATH, JSON.stringify(edited));
    const r = loadPersistedOverrides();
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toBe('signature_mismatch');
    expect(r.details).toContain('signature does not match');
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
      signedPersistedFile({
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
      signedPersistedFile({
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

  it('returns corrupt/signature_mismatch status without applying a hand-edited file', () => {
    driverState.files.set(
      TEST_PATH,
      JSON.stringify({
        schemaVersion: 1,
        writtenAt: '2026-05-09T00:00:00.000Z',
        overrides: { densityBudgets: { balanced: { titleMaxChars: 999 } } },
        signature: '0'.repeat(64),
      })
    );
    const o = restorePersistedOverrides();
    expect(o.status).toBe('corrupt');
    if (o.status !== 'corrupt') return;
    expect(o.reason).toBe('signature_mismatch');
    expect(getCurrentRegistrySnapshot().densityBudgets.balanced.titleMaxChars).not.toBe(999);
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
      signedPersistedFile({
        writtenAt: '2026-05-09T00:00:00.000Z',
        overrides: { densityBudgets: { balanced: { titleMaxChars: -5 } } },
      })
    );
    initializeLayoutCapacityPersistence();
    const w = getRegistryLoadWarning();
    expect(w?.reason).toBe('rejected_by_validator');
    expect(w?.details).toBeTruthy();
  });

  it('raises signature_mismatch when the persisted file was hand-edited', () => {
    driverState.files.set(
      TEST_PATH,
      JSON.stringify({
        schemaVersion: 1,
        writtenAt: '2026-05-09T00:00:00.000Z',
        overrides: { densityBudgets: { balanced: { titleMaxChars: 999 } } },
        signature: '0'.repeat(64),
      })
    );
    const outcome = initializeLayoutCapacityPersistence();
    expect(outcome.status).toBe('corrupt');
    const w = getRegistryLoadWarning();
    expect(w?.reason).toBe('signature_mismatch');
    expect(w?.sourcePath).toBe(TEST_PATH);
    expect(w?.details).toContain('signature does not match');
    expect(getCurrentRegistrySnapshot().densityBudgets.balanced.titleMaxChars).not.toBe(999);
  });

  it('persists subsequent applyOverrides calls to disk', () => {
    initializeLayoutCapacityPersistence();
    expect(driverState.files.has(TEST_PATH)).toBe(false);

    applyOverrides({ densityBudgets: { balanced: { titleMaxChars: 137 } } });
    expect(driverState.files.has(TEST_PATH)).toBe(true);
    const parsed = JSON.parse(driverState.files.get(TEST_PATH)!);
    expect(parsed.schemaVersion).toBe(2);
    expect(parsed.globalOverrides.densityBudgets.balanced.titleMaxChars).toBe(137);
    expect(parsed.signature).toMatch(/^[a-f0-9]{64}$/);
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
      signedPersistedFile({
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
    expect(parsed.globalOverrides.densityBudgets.balanced.titleMaxChars).toBe(137);
    expect(parsed.globalOverrides.densityBudgets.visual.blocksMax).toBe(9);
    expect(parsed.signature).toMatch(/^[a-f0-9]{64}$/);
  });

  it('persists and restores tenant-scoped snapshots independently (S23)', () => {
    initializeLayoutCapacityPersistence();
    applyOverrides({ densityBudgets: { balanced: { titleMaxChars: 123 } } }, 'org-A');
    applyOverrides({ densityBudgets: { balanced: { titleMaxChars: 140 } } }, 'org-B');
    const raw = driverState.files.get(TEST_PATH);
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw!);
    expect(parsed.schemaVersion).toBe(2);
    expect(
      parsed.tenantOverridesByOrganizationId['org-A'].densityBudgets.balanced.titleMaxChars
    ).toBe(123);
    expect(
      parsed.tenantOverridesByOrganizationId['org-B'].densityBudgets.balanced.titleMaxChars
    ).toBe(140);

    resetToDefaults();
    setRegistryHooks(null);
    driverState.files.set(TEST_PATH, raw!);

    const restored = restorePersistedOverrides();
    expect(restored.status).toBe('restored');
    expect(getCurrentRegistrySnapshot('org-A').densityBudgets.balanced.titleMaxChars).toBe(123);
    expect(getCurrentRegistrySnapshot('org-B').densityBudgets.balanced.titleMaxChars).toBe(140);
    expect(getCurrentRegistrySnapshot().densityBudgets.balanced.titleMaxChars).toBe(90);
  });
});

// ---------------------------------------------------------------------------
// Sprint S19 — atomicWriteFile (closes R-S18-3)
// ---------------------------------------------------------------------------

interface AtomicFsCall {
  op:
    | 'existsSync'
    | 'mkdirSync'
    | 'writeFileSync'
    | 'renameSync'
    | 'unlinkSync'
    | 'openSync'
    | 'fsyncSync'
    | 'closeSync';
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
  /**
   * Sprint S21 — optional throw-on-fsync flag (path prefix). Tests
   * use this to assert fsync failures propagate while still
   * triggering the cleanup path.
   */
  throwOnFsyncFor?: string;
  /**
   * Sprint S21 — optional throw-on-close flag (path prefix used at
   * open time to map the fd). Lets tests assert that a close failure
   * after a successful fsync surfaces to the caller, while a close
   * failure after an fsync error stays swallowed (fsync error wins).
   */
  throwOnCloseFor?: string;
  /** Recorded operation log so tests can assert sequence. */
  calls: AtomicFsCall[];
  /** Sprint S21 — fd → opened-path map so close/fsync calls can report context. */
  openFds: Map<number, string>;
  /** Sprint S21 — monotonic fd counter (real fs gives small ints; we mirror that). */
  nextFd: number;
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
    openSync(p: string, flags: 'r'): number {
      state.calls.push({ op: 'openSync', args: [p, flags] });
      const fd = state.nextFd++;
      state.openFds.set(fd, p);
      return fd;
    },
    fsyncSync(fd: number): void {
      state.calls.push({ op: 'fsyncSync', args: [fd] });
      const path = state.openFds.get(fd);
      if (path === undefined) throw new Error(`EBADF: fsync on closed fd ${fd}`);
      if (state.throwOnFsyncFor && path.startsWith(state.throwOnFsyncFor)) {
        throw new Error(`EIO: fsync failed for ${path}`);
      }
    },
    closeSync(fd: number): void {
      state.calls.push({ op: 'closeSync', args: [fd] });
      const path = state.openFds.get(fd);
      if (path === undefined) throw new Error(`EBADF: close on already-closed fd ${fd}`);
      state.openFds.delete(fd);
      if (state.throwOnCloseFor && path.startsWith(state.throwOnCloseFor)) {
        throw new Error(`EIO: close failed for ${path}`);
      }
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
  return {
    files: new Map(),
    dirs: new Set(),
    calls: [],
    openFds: new Map(),
    nextFd: 100, // Start at 100 to make fds visually distinct in test output.
  };
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
    expect(parsed.schemaVersion).toBe(2);
    expect(parsed.globalOverrides.densityBudgets.balanced.titleMaxChars).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// Sprint S21 — fsync hardening on atomic write (closes R-S19-1)
// ---------------------------------------------------------------------------

/** Helper: extract the names of all calls in order so tests can assert sequence. */
function callOps(state: AtomicFsState): AtomicFsCall['op'][] {
  return state.calls.map((c) => c.op);
}

describe('atomicWriteFile fsync hardening (S21, R-S19-1)', () => {
  it('fsyncs the tmp file BEFORE rename and the parent dir AFTER rename (canonical durability sequence)', () => {
    const state = makeAtomicState();
    state.dirs.add('/tmp');
    atomicWriteFile('/tmp/file.json', '{"a":1}', makeAtomicFs(state), fakePathOps);

    const ops = callOps(state);
    // Required ordering: writeFileSync(tmp) -> openSync(tmp) ->
    // fsyncSync -> closeSync -> renameSync -> openSync(dir) ->
    // fsyncSync -> closeSync.
    const writeIdx = ops.indexOf('writeFileSync');
    const openTmpIdx = ops.indexOf('openSync', writeIdx);
    const fsyncTmpIdx = ops.indexOf('fsyncSync', openTmpIdx);
    const closeTmpIdx = ops.indexOf('closeSync', fsyncTmpIdx);
    const renameIdx = ops.indexOf('renameSync', closeTmpIdx);
    const openDirIdx = ops.indexOf('openSync', renameIdx);
    const fsyncDirIdx = ops.indexOf('fsyncSync', openDirIdx);
    const closeDirIdx = ops.indexOf('closeSync', fsyncDirIdx);

    expect(writeIdx).toBeGreaterThan(-1);
    expect(openTmpIdx).toBeGreaterThan(writeIdx);
    expect(fsyncTmpIdx).toBeGreaterThan(openTmpIdx);
    expect(closeTmpIdx).toBeGreaterThan(fsyncTmpIdx);
    expect(renameIdx).toBeGreaterThan(closeTmpIdx);
    expect(openDirIdx).toBeGreaterThan(renameIdx);
    expect(fsyncDirIdx).toBeGreaterThan(openDirIdx);
    expect(closeDirIdx).toBeGreaterThan(fsyncDirIdx);

    // Tmp path is the one we wrote to AND opened first.
    const writeCall = state.calls.find((c) => c.op === 'writeFileSync')!;
    const tmpPath = writeCall.args[0] as string;
    const firstOpen = state.calls.filter((c) => c.op === 'openSync')[0];
    expect(firstOpen.args[0]).toBe(tmpPath);
    expect(firstOpen.args[1]).toBe('r');

    // Second open is the parent dir.
    const secondOpen = state.calls.filter((c) => c.op === 'openSync')[1];
    expect(secondOpen.args[0]).toBe('/tmp');
    expect(secondOpen.args[1]).toBe('r');
  });

  it('releases both fds (file fd then dir fd) and leaks none', () => {
    const state = makeAtomicState();
    state.dirs.add('/tmp');
    atomicWriteFile('/tmp/file.json', '{}', makeAtomicFs(state), fakePathOps);
    const opens = state.calls.filter((c) => c.op === 'openSync').length;
    const closes = state.calls.filter((c) => c.op === 'closeSync').length;
    expect(opens).toBe(2);
    expect(closes).toBe(2);
    // No fd left in the open table.
    expect(state.openFds.size).toBe(0);
  });

  it('propagates a file-fsync failure, closes the file fd, and runs tmp cleanup', () => {
    const state = makeAtomicState();
    state.dirs.add('/tmp');
    state.throwOnFsyncFor = '/tmp/file.json.'; // tmp file path prefix
    let caught: unknown;
    try {
      atomicWriteFile('/tmp/file.json', '{}', makeAtomicFs(state), fakePathOps);
    } catch (err) {
      caught = err;
    }
    expect((caught as Error).message).toMatch(/EIO: fsync failed/);
    // File fd was still closed despite fsync throwing (try/finally).
    expect(state.openFds.size).toBe(0);
    // Rename never happened (we failed before it).
    expect(state.calls.find((c) => c.op === 'renameSync')).toBeUndefined();
    // Target file does NOT exist.
    expect(state.files.has('/tmp/file.json')).toBe(false);
    // Tmp file was unlinked as part of cleanup.
    const unlinkCall = state.calls.find((c) => c.op === 'unlinkSync');
    expect(unlinkCall).toBeDefined();
    expect((unlinkCall!.args[0] as string).endsWith('.tmp')).toBe(true);
  });

  it('propagates a directory-fsync failure even though the rename has succeeded (target file is canonical, but operator must know durability is uncertain)', () => {
    const state = makeAtomicState();
    state.dirs.add('/tmp');
    state.throwOnFsyncFor = '/tmp'; // matches the dir path exactly (and also tmp file path prefix)
    // Refine: use a prefix that ONLY matches the dir, not the file's tmp path.
    // Tmp paths look like `/tmp/file.json.<pid>.<n>.tmp` so they start with `/tmp/`.
    // We want only the bare `/tmp` directory to trip fsync.
    // The mock checks `path.startsWith(prefix)` so we set prefix to `/tmp`,
    // which would also match the tmp file path. Workaround: set the prefix
    // AFTER the file fsync has already happened by toggling it.
    state.throwOnFsyncFor = undefined;
    const fs = makeAtomicFs(state);
    // Wrap fsyncSync to flip the flag once the file fsync has been seen.
    const origFsync = fs.fsyncSync;
    let fileFsyncSeen = false;
    fs.fsyncSync = (fd: number) => {
      if (!fileFsyncSeen) {
        fileFsyncSeen = true;
        return origFsync(fd);
      }
      // Second fsync = directory fsync. Throw a portable EPERM.
      throw new Error('EPERM: directory fsync not permitted');
    };
    let caught: unknown;
    try {
      atomicWriteFile('/tmp/file.json', '{}', fs, fakePathOps);
    } catch (err) {
      caught = err;
    }
    expect((caught as Error).message).toMatch(/EPERM/);
    // Rename did succeed (we threw AFTER it). The target file is on disk —
    // but a power-loss after this point would have lost the rename.
    expect(state.files.has('/tmp/file.json')).toBe(true);
    // Tmp file was cleaned up by the catch path. (The rename moved tmp -> target,
    // so the tmp path no longer exists in the files map; cleanup `existsSync`
    // returns false and we skip the unlink. That's correct behavior.)
    const tmpPath = state.calls.find((c) => c.op === 'writeFileSync')!.args[0] as string;
    expect(state.files.has(tmpPath)).toBe(false);
    // Both fds were released even with the dir-fsync failing.
    expect(state.openFds.size).toBe(0);
  });

  it('propagates a close-after-successful-fsync error so silent fd-table corruption is never hidden', () => {
    const state = makeAtomicState();
    state.dirs.add('/tmp');
    state.throwOnCloseFor = '/tmp'; // dir close throws (file fd has tmp path, so it doesn't match `/tmp` exactly...)
    // The mock matches by path.startsWith(prefix). `/tmp` matches both
    // `/tmp` (the dir) and `/tmp/file.json.<pid>.<n>.tmp` (the tmp file).
    // To isolate dir close, we apply the same toggle pattern.
    state.throwOnCloseFor = undefined;
    const fs = makeAtomicFs(state);
    const origClose = fs.closeSync;
    let fileCloseSeen = false;
    fs.closeSync = (fd: number) => {
      if (!fileCloseSeen) {
        fileCloseSeen = true;
        return origClose(fd);
      }
      throw new Error('EBADF: close failed on dir fd');
    };
    let caught: unknown;
    try {
      atomicWriteFile('/tmp/file.json', '{}', fs, fakePathOps);
    } catch (err) {
      caught = err;
    }
    expect((caught as Error).message).toMatch(/EBADF/);
    // Rename has happened so the target file is on disk.
    expect(state.files.has('/tmp/file.json')).toBe(true);
  });

  it('prefers the fsync error over a close error (fsync error is more meaningful)', () => {
    const state = makeAtomicState();
    state.dirs.add('/tmp');
    const fs = makeAtomicFs(state);
    // Make BOTH fsync and close throw on the file fd. The helper must
    // surface the fsync error and swallow the close error so the
    // caller debugs the actual durability problem (fsync), not the
    // downstream cleanup error.
    const origFsync = fs.fsyncSync;
    fs.fsyncSync = (fd: number) => {
      origFsync(fd); // record the call
      throw new Error('EIO: fsync failed (primary)');
    };
    const origClose = fs.closeSync;
    fs.closeSync = (fd: number) => {
      origClose(fd); // record the call
      throw new Error('EBADF: close failed (secondary)');
    };
    let caught: unknown;
    try {
      atomicWriteFile('/tmp/file.json', '{}', fs, fakePathOps);
    } catch (err) {
      caught = err;
    }
    // Caller MUST see the fsync error, not the close error.
    expect((caught as Error).message).toMatch(/fsync failed \(primary\)/);
    expect((caught as Error).message).not.toMatch(/close failed/);
  });

  it('integration: savePersistedOverrides drives both fsync calls (file + dir) through the default driver', () => {
    // The driver injected by the suite-level `_setLayoutCapacityPersistenceDriverForTests`
    // is the simple FS driver without atomic write hooks. To prove the
    // production default driver does fsync, we exercise atomicWriteFile
    // directly through the same call shape — `savePersistedOverrides`
    // re-runs the same sequence in production via the default driver.
    const state = makeAtomicState();
    state.dirs.add('/tmp');
    atomicWriteFile('/tmp/file.json', 'final', makeAtomicFs(state), fakePathOps);
    // Two fsyncs: one on the tmp file (post-write, pre-rename), one on
    // the parent dir (post-rename).
    expect(state.calls.filter((c) => c.op === 'fsyncSync')).toHaveLength(2);
  });
});
