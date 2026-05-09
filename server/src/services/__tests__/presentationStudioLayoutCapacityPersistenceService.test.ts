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
