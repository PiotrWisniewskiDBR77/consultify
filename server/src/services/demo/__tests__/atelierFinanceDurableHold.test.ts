/**
 * FIN-005 P1-B — the operator record is DURABLE, and the promotion marker has a
 * lifecycle no later run can shortcut.
 *
 * ===========================================================================
 * THE DEFECT
 * ===========================================================================
 * The `NEEDS_OPERATOR` hold was written to `baseStorageDir()`, which resolves
 * `STORAGE_DIR` > `RAILWAY_VOLUME_MOUNT_PATH` > `process.cwd()`. On a Railway
 * service with no mounted volume that last branch is the container's ephemeral
 * filesystem, so the hold died with the next redeploy — which is exactly the
 * event that follows a run ending in NEEDS_OPERATOR. The next seed then saw the
 * residue, healed it and reported `complete`. The old code KNEW: it logged a
 * warning about `process.cwd()` AFTER the hold had already been written. A note
 * in the flight recorder is not a guard.
 *
 * ===========================================================================
 * WHAT IS ASSERTED HERE, AND WHY IT IS ASSERTED THIS WAY
 * ===========================================================================
 * Durability is not a claim about an environment variable, so nothing here
 * checks one. `proveDurableStorage()` is exercised by making the filesystem
 * refuse, and the refusal must name the step that failed. The hosted gate is
 * exercised by every shape of declaration an operator can produce — unset, set
 * to the working directory, set to a path that is not a mount, and set to a real
 * mount — and only the last one opens.
 *
 * The mounted branch takes an INJECTED `stat`, not an environment variable.
 * Nothing is mounted on a CI worker, and an env var that could satisfy a
 * durability guard would be the same defect class as `MOCK_DB=true` deciding the
 * database seam (see the P1-1b note in
 * `atelierFinancePromotionTransaction.ts`). A function parameter cannot be
 * reached from the CLI.
 *
 * ===========================================================================
 * HOW THIS WAS PROVED RED
 * ===========================================================================
 * Every assertion here fails against the previous build, because the code it
 * calls did not exist: `proveDurableStorage`,
 * `requireDurableOperatorHoldStorage`, the marker read/write/remove trio and
 * the attributed `acknowledgeAtelierFinanceCommitIndeterminate` are all new. The
 * two that describe BEHAVIOUR CHANGES rather than new surface were checked
 * against the old semantics explicitly:
 *
 *   - `acknowledge…` used to be `(organizationId) => boolean` and cleared the
 *     hold with a bare `unlinkSync` and no record. Calling it with the old
 *     single argument now throws (`operator` is required), and the audit-record
 *     assertions have nothing to read.
 *   - the hold used to be written with a plain `writeFileSync` — no temp file,
 *     no `fsync`, no atomic rename, no read-back. `writes the record with the
 *     full durability sequence` fails against it, because a crash-consistent
 *     write is observable: the temp file is created and renamed, and a plain
 *     write leaves no rename to observe.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  acknowledgeAtelierFinanceCommitIndeterminate,
  atelierFinanceOperatorHoldDir,
  atelierFinanceOperatorHoldPath,
  type AtelierFinancePromotionMarker,
  atelierFinancePromotionMarkerPath,
  digestPromotionState,
  promotionMarkerBlocks,
  proveDurableStorage,
  readAtelierFinanceOperatorHold,
  readAtelierFinancePromotionMarker,
  removeOwnPromotionMarker,
  requireDurableOperatorHoldStorage,
  writeAtelierFinanceOperatorHold,
  writeAtelierFinancePromotionMarker,
} from '../atelierFinanceOperatorHold.js';

const ORG = 'fin005-durable-hold-test';

let scratch: string;
const savedEnv: Record<string, string | undefined> = {};

function saveEnv(...keys: string[]): void {
  for (const key of keys) savedEnv[key] = process.env[key];
}

beforeEach(() => {
  scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'fin005-durable-'));
  saveEnv('ATELIER_FINANCE_HOLD_DIR', 'STORAGE_DIR', 'RAILWAY_VOLUME_MOUNT_PATH');
  process.env.ATELIER_FINANCE_HOLD_DIR = path.join(scratch, 'holds');
  delete process.env.STORAGE_DIR;
  delete process.env.RAILWAY_VOLUME_MOUNT_PATH;
});

afterEach(() => {
  for (const [key, value] of Object.entries(savedEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  fs.rmSync(scratch, { recursive: true, force: true, maxRetries: 3 });
});

// ---------------------------------------------------------------------------
// The durability probe
// ---------------------------------------------------------------------------

describe('FIN-005 P1-B — durability is PROVED by performing it', () => {
  it('runs the whole sequence and cleans the probe file up', () => {
    const dir = path.join(scratch, 'proof');
    const proof = proveDurableStorage(dir);

    expect(proof.durable, proof.reason).toBe(true);
    // The order is the contract: a rename is atomic for readers, but the
    // DIRECTORY ENTRY it creates is not durable until the directory is fsync'd.
    expect(proof.steps).toEqual([
      `mkdir -p ${dir}`,
      'write temp file',
      'fsync the FILE',
      'atomic rename into place',
      'fsync the DIRECTORY',
      'read the bytes back and compare',
      'clean the probe file up',
    ]);
    // Nothing is left behind — a probe that litters is a probe operators mute.
    expect(fs.readdirSync(dir)).toEqual([]);
  });

  it('refuses, and NAMES THE STEP, when the directory cannot be created', () => {
    // A FILE where the directory should be. `mkdir -p` cannot proceed.
    const blocker = path.join(scratch, 'blocked');
    fs.writeFileSync(blocker, 'not a directory', 'utf8');

    const proof = proveDurableStorage(path.join(blocker, 'holds'));
    expect(proof.durable).toBe(false);
    expect(proof.reason).toMatch(/^mkdir failed: /);
    expect(proof.steps).toEqual([]);
  });

  it('refuses when the directory exists but cannot be written to', () => {
    const dir = path.join(scratch, 'readonly');
    fs.mkdirSync(dir, { recursive: true });
    fs.chmodSync(dir, 0o500);
    try {
      const proof = proveDurableStorage(dir);
      expect(proof.durable).toBe(false);
      expect(proof.reason).toMatch(/open\(temp, wx\) failed: /);
      expect(proof.reason).toMatch(/EACCES|EPERM/);
      // mkdir on an existing directory succeeds, so that step IS recorded — the
      // report says how far it got, which is what an operator needs.
      expect(proof.steps).toEqual([`mkdir -p ${dir}`]);
    } finally {
      fs.chmodSync(dir, 0o700);
    }
  });
});

// ---------------------------------------------------------------------------
// The hosted gate
// ---------------------------------------------------------------------------

describe('FIN-005 P1-B — a hosted --write refuses without DECLARED, PROVED durability', () => {
  it('refuses when neither STORAGE_DIR nor RAILWAY_VOLUME_MOUNT_PATH is set', () => {
    delete process.env.ATELIER_FINANCE_HOLD_DIR;
    const verdict = requireDurableOperatorHoldStorage();
    expect(verdict.ok).toBe(false);
    expect(verdict.source).toBe('none');
    expect(verdict.reason).toMatch(/neither STORAGE_DIR nor RAILWAY_VOLUME_MOUNT_PATH is set/);
    expect(verdict.reason).toMatch(/would not survive a redeploy/);
  });

  it('refuses the TEST override outright — a convenience var never satisfies a durability guard', () => {
    // `ATELIER_FINANCE_HOLD_DIR` relocates the holds and every suite uses it.
    // Letting it also open the hosted gate is the `MOCK_DB=true` defect again.
    process.env.ATELIER_FINANCE_HOLD_DIR = path.join(scratch, 'holds');
    process.env.STORAGE_DIR = path.join(scratch, 'volume');
    const verdict = requireDurableOperatorHoldStorage();
    expect(verdict.ok).toBe(false);
    expect(verdict.reason).toMatch(/ATELIER_FINANCE_HOLD_DIR is set/);
    expect(verdict.reason).toMatch(/refused for a hosted write/);
  });

  it('refuses STORAGE_DIR pointing at the working directory — that IS the ephemeral filesystem', () => {
    delete process.env.ATELIER_FINANCE_HOLD_DIR;
    process.env.STORAGE_DIR = process.cwd();
    const verdict = requireDurableOperatorHoldStorage();
    expect(verdict.ok).toBe(false);
    expect(verdict.reason).toMatch(/points at the process working directory/);
  });

  it('refuses a declared path that is NOT a mount — "set" is a declaration, "mounted" is a fact', () => {
    delete process.env.ATELIER_FINANCE_HOLD_DIR;
    const volume = path.join(scratch, 'volume');
    fs.mkdirSync(volume, { recursive: true });
    process.env.STORAGE_DIR = volume;

    const verdict = requireDurableOperatorHoldStorage();
    expect(verdict.ok).toBe(false);
    expect(verdict.reason).toMatch(/does not look like a mounted volume/);
    expect(verdict.reason).toMatch(/SAME filesystem as/);
    expect(verdict.reason).toMatch(/The variable merely existing is not durability/);
  });

  it('accepts a real mount — and still proves the fsync sequence on it', () => {
    delete process.env.ATELIER_FINANCE_HOLD_DIR;
    const volume = path.join(scratch, 'volume');
    fs.mkdirSync(volume, { recursive: true });
    process.env.STORAGE_DIR = volume;

    // The only thing that cannot be reproduced on a CI worker: a separate
    // device. Injected as a PARAMETER, never as an environment variable.
    const verdict = requireDurableOperatorHoldStorage({
      stat: (target: string) => ({ dev: path.resolve(target) === volume ? 4242 : 1 }),
    });
    expect(verdict.ok, verdict.reason).toBe(true);
    expect(verdict.source).toBe('STORAGE_DIR');
    expect(verdict.dir).toBe(path.join(volume, 'fin005-operator-holds'));
    expect(verdict.proof?.durable).toBe(true);
    expect(verdict.proof?.steps).toContain('fsync the DIRECTORY');
  });

  it('accepts a verified RAILWAY_VOLUME_MOUNT_PATH, and refuses it when it is only SET', () => {
    delete process.env.ATELIER_FINANCE_HOLD_DIR;
    const volume = path.join(scratch, 'railway-volume');
    fs.mkdirSync(volume, { recursive: true });
    process.env.RAILWAY_VOLUME_MOUNT_PATH = volume;

    expect(requireDurableOperatorHoldStorage().ok, 'merely set must not pass').toBe(false);

    const verified = requireDurableOperatorHoldStorage({
      stat: (target: string) => ({ dev: path.resolve(target) === volume ? 99 : 1 }),
    });
    expect(verified.ok, verified.reason).toBe(true);
    expect(verified.source).toBe('RAILWAY_VOLUME_MOUNT_PATH');
  });

  it('refuses a mount whose fsync probe fails — the mount is not the proof, the probe is', () => {
    delete process.env.ATELIER_FINANCE_HOLD_DIR;
    const volume = path.join(scratch, 'ro-volume');
    fs.mkdirSync(volume, { recursive: true });
    fs.chmodSync(volume, 0o500);
    process.env.STORAGE_DIR = volume;
    try {
      const verdict = requireDurableOperatorHoldStorage({
        stat: (target: string) => ({ dev: path.resolve(target) === volume ? 7 : 1 }),
      });
      expect(verdict.ok).toBe(false);
      expect(verdict.reason).toMatch(/is a mount, but the durability probe on/);
      expect(verdict.proof?.durable).toBe(false);
    } finally {
      fs.chmodSync(volume, 0o700);
    }
  });
});

// ---------------------------------------------------------------------------
// Durable writes
// ---------------------------------------------------------------------------

describe('FIN-005 P1-B — records are written with the durability sequence', () => {
  it('writes the record with the full durability sequence, not a plain writeFileSync', () => {
    const renameSpy = vi.spyOn(fs, 'renameSync');
    const fsyncSpy = vi.spyOn(fs, 'fsyncSync');
    try {
      const error = writeAtelierFinanceOperatorHold({
        organizationId: ORG,
        recordedAt: new Date().toISOString(),
        packId: 'pack',
        analysisId: 'analysis',
        statementIds: ['s1'],
        reason: 'in doubt',
        reconciliation: 'mixed',
        applied: [],
        backendPid: null,
        rowsClaimingReady: [],
        acknowledgement: 'ack',
      });
      expect(error).toBeNull();
      // A temp file, renamed into place — so a torn write can never be observed
      // as a valid hold.
      expect(renameSpy).toHaveBeenCalledTimes(1);
      const [from, to] = renameSpy.mock.calls[0] as [string, string];
      expect(String(from)).toMatch(/\.tmp$/);
      expect(String(to)).toBe(atelierFinanceOperatorHoldPath(ORG));
      // Two fsyncs: the FILE and the DIRECTORY.
      expect(fsyncSpy.mock.calls.length).toBeGreaterThanOrEqual(2);
    } finally {
      renameSpy.mockRestore();
      fsyncSpy.mockRestore();
    }

    expect(readAtelierFinanceOperatorHold(ORG)?.reason).toBe('in doubt');
  });

  it('reports the failure instead of throwing when the record cannot be written', () => {
    process.env.ATELIER_FINANCE_HOLD_DIR = path.join(scratch, 'nope');
    fs.writeFileSync(path.join(scratch, 'nope'), 'a file, not a directory', 'utf8');
    const error = writeAtelierFinancePromotionMarker(marker('run-1'));
    expect(error).toBeTruthy();
    expect(String(error)).toMatch(/ENOTDIR|EEXIST|ENOENT/);
  });
});

// ---------------------------------------------------------------------------
// The marker lifecycle
// ---------------------------------------------------------------------------

function marker(
  runId: string,
  state: AtelierFinancePromotionMarker['state'] = 'PROMOTION_IN_PROGRESS'
): AtelierFinancePromotionMarker {
  return {
    state,
    runId,
    organizationId: ORG,
    rowIds: ['pack', 's1', 's2', 's3', 'analysis'],
    preStateDigest: digestPromotionState({ pack: { pack_status: 'draft' } }),
    intendedPostStateDigest: digestPromotionState({ pack: { pack_status: 'confirmed' } }),
    target: {
      database: 'fin005_pri',
      databaseOid: '16384',
      serverAddr: '127.0.0.1',
      serverPort: '5432',
      backendPid: '999',
      systemIdentifier: '7000000000000000000',
    },
    startedAt: new Date().toISOString(),
  };
}

describe('FIN-005 P1-B — the PROMOTION_IN_PROGRESS marker', () => {
  it('carries everything a human needs to resolve it by hand', () => {
    expect(writeAtelierFinancePromotionMarker(marker('run-1'))).toBeNull();
    const onDisk = readAtelierFinancePromotionMarker(ORG);
    expect(onDisk?.state).toBe('PROMOTION_IN_PROGRESS');
    expect(onDisk?.runId).toBe('run-1');
    expect(onDisk?.rowIds).toHaveLength(5);
    expect(onDisk?.preStateDigest).toMatch(/^[0-9a-f]{64}$/);
    expect(onDisk?.intendedPostStateDigest).toMatch(/^[0-9a-f]{64}$/);
    expect(onDisk?.preStateDigest).not.toBe(onDisk?.intendedPostStateDigest);
    expect(onDisk?.target.database).toBe('fin005_pri');
    expect(onDisk?.startedAt).toBeTruthy();
    expect(promotionMarkerBlocks(onDisk)).toBe(true);
  });

  it('digests by VALUE, not by key order', () => {
    expect(digestPromotionState({ a: 1, b: { c: 2, d: 3 } })).toBe(
      digestPromotionState({ b: { d: 3, c: 2 }, a: 1 })
    );
    expect(digestPromotionState({ a: 1 })).not.toBe(digestPromotionState({ a: 2 }));
  });

  it('blocks while IN_PROGRESS or NEEDS_OPERATOR, and not once it is terminal', () => {
    expect(promotionMarkerBlocks(marker('r', 'PROMOTION_IN_PROGRESS'))).toBe(true);
    expect(promotionMarkerBlocks(marker('r', 'NEEDS_OPERATOR'))).toBe(true);
    expect(promotionMarkerBlocks(marker('r', 'COMMITTED'))).toBe(false);
    expect(promotionMarkerBlocks(marker('r', 'ROLLED_BACK'))).toBe(false);
    expect(promotionMarkerBlocks(null)).toBe(false);
  });

  it('an unparseable marker BLOCKS — a record we cannot read is not one we may ignore', () => {
    const file = atelierFinancePromotionMarkerPath(ORG);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, '{ truncated mid-write', 'utf8');
    const onDisk = readAtelierFinancePromotionMarker(ORG);
    expect(onDisk?.state).toBe('NEEDS_OPERATOR');
    expect(onDisk?.outcomeDetail).toMatch(/not valid JSON/);
    expect(promotionMarkerBlocks(onDisk)).toBe(true);
  });

  // -------------------------------------------------------------------------
  // FIN-005 P1-B #10 — a LATER run cannot tidy the evidence away.
  // -------------------------------------------------------------------------
  it('refuses to remove a marker belonging to ANOTHER run', () => {
    writeAtelierFinancePromotionMarker(marker('run-that-died'));
    const attempt = removeOwnPromotionMarker({ organizationId: ORG, runId: 'a-later-run' });
    expect(attempt.removed).toBe(false);
    expect(attempt.reason).toMatch(/belongs to run "run-that-died", not to this run/);
    expect(readAtelierFinancePromotionMarker(ORG)?.state).toBe('PROMOTION_IN_PROGRESS');
  });

  it('refuses to remove its OWN marker while it is still non-terminal', () => {
    writeAtelierFinancePromotionMarker(marker('run-1'));
    const attempt = removeOwnPromotionMarker({ organizationId: ORG, runId: 'run-1' });
    expect(attempt.removed).toBe(false);
    expect(attempt.reason).toMatch(/only a marker carrying a confirmed terminal outcome/);
    expect(readAtelierFinancePromotionMarker(ORG)).not.toBeNull();
  });

  it('removes its own marker only AFTER the terminal outcome is durably written', () => {
    writeAtelierFinancePromotionMarker(marker('run-1'));
    writeAtelierFinancePromotionMarker({
      ...marker('run-1'),
      state: 'COMMITTED',
      finishedAt: new Date().toISOString(),
      outcomeDetail: 'commit ack acknowledged',
    });
    // The outcome is on disk BEFORE the removal — a crash here leaves a
    // terminal marker, which does not block. The reverse order would leave
    // PROMOTION_IN_PROGRESS after a successful commit.
    expect(readAtelierFinancePromotionMarker(ORG)?.state).toBe('COMMITTED');
    const removal = removeOwnPromotionMarker({ organizationId: ORG, runId: 'run-1' });
    expect(removal.removed).toBe(true);
    expect(readAtelierFinancePromotionMarker(ORG)).toBeNull();
  });

  it('never removes a NEEDS_OPERATOR marker, even its own', () => {
    writeAtelierFinancePromotionMarker({ ...marker('run-1'), state: 'NEEDS_OPERATOR' });
    expect(removeOwnPromotionMarker({ organizationId: ORG, runId: 'run-1' }).removed).toBe(false);
    expect(readAtelierFinancePromotionMarker(ORG)?.state).toBe('NEEDS_OPERATOR');
  });
});

// ---------------------------------------------------------------------------
// Acknowledgement
// ---------------------------------------------------------------------------

describe('FIN-005 P1-B #11 — acknowledgement is explicit, attributed and audited', () => {
  it('refuses an anonymous acknowledgement', () => {
    writeAtelierFinancePromotionMarker({ ...marker('run-1'), state: 'NEEDS_OPERATOR' });
    expect(() =>
      acknowledgeAtelierFinanceCommitIndeterminate(ORG, {
        operator: '   ',
        decision: 'other',
        note: 'looked fine',
      })
    ).toThrow(/anonymously/);
    expect(readAtelierFinancePromotionMarker(ORG)).not.toBeNull();
  });

  it('refuses an acknowledgement with no note', () => {
    writeAtelierFinancePromotionMarker({ ...marker('run-1'), state: 'NEEDS_OPERATOR' });
    expect(() =>
      acknowledgeAtelierFinanceCommitIndeterminate(ORG, {
        operator: 'piotr',
        decision: 'other',
        note: '',
      })
    ).toThrow(/without a note/);
    expect(readAtelierFinancePromotionMarker(ORG)).not.toBeNull();
  });

  it('says so when there is nothing to acknowledge, instead of reporting a resolution', () => {
    const result = acknowledgeAtelierFinanceCommitIndeterminate(ORG, {
      operator: 'piotr',
      decision: 'other',
      note: 'checking',
    });
    expect(result.cleared).toBe(false);
    expect(result.auditPath).toBeNull();
    expect(result.reason).toMatch(/nothing to acknowledge/);
  });

  it('writes the audit record BEFORE clearing, and clears BOTH records', () => {
    writeAtelierFinanceOperatorHold({
      organizationId: ORG,
      recordedAt: '2026-08-01T00:00:00.000Z',
      packId: 'pack',
      analysisId: 'analysis',
      statementIds: ['s1', 's2', 's3'],
      reason: 'COMMIT did not return a result',
      reconciliation: 'MIXED state after a lost COMMIT ack: 4/5',
      applied: ['s1'],
      backendPid: 4242,
      rowsClaimingReady: ['s1', 'pack'],
      acknowledgement: 'ack',
    });
    writeAtelierFinancePromotionMarker({ ...marker('run-1'), state: 'NEEDS_OPERATOR' });

    const result = acknowledgeAtelierFinanceCommitIndeterminate(ORG, {
      operator: 'piotr',
      decision: 'commit-did-not-land',
      note: 'read all five rows on the primary; none carried the promotion',
    });

    expect(result.cleared).toBe(true);
    const audit = JSON.parse(fs.readFileSync(result.auditPath as string, 'utf8'));
    expect(audit.operator).toBe('piotr');
    expect(audit.decision).toBe('commit-did-not-land');
    expect(audit.note).toMatch(/none carried the promotion/);
    // The evidence travels INTO the audit record, so clearing the hold does not
    // destroy what the decision was made about.
    expect(audit.clearedHold.reconciliation).toMatch(/MIXED state after a lost COMMIT ack: 4\/5/);
    expect(audit.clearedMarker.runId).toBe('run-1');

    expect(readAtelierFinanceOperatorHold(ORG)).toBeNull();
    expect(readAtelierFinancePromotionMarker(ORG)).toBeNull();
  });

  it('does NOT clear anything when the audit record cannot be written', () => {
    writeAtelierFinancePromotionMarker({ ...marker('run-1'), state: 'NEEDS_OPERATOR' });
    // Make the `acknowledged/` subdirectory impossible to create.
    fs.writeFileSync(path.join(atelierFinanceOperatorHoldDir(), 'acknowledged'), 'a file', 'utf8');

    expect(() =>
      acknowledgeAtelierFinanceCommitIndeterminate(ORG, {
        operator: 'piotr',
        decision: 'other',
        note: 'attempting to acknowledge',
      })
    ).toThrow(/audit\s+record could not be written durably|could not be written durably/);

    // The block STANDS. Clearing without a record is the failure being prevented.
    expect(readAtelierFinancePromotionMarker(ORG)?.state).toBe('NEEDS_OPERATOR');
  });
});
