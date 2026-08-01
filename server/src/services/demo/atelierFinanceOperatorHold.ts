/**
 * FIN-005 P1-B — the DURABLE operator record: the `NEEDS_OPERATOR` hold, the
 * `PROMOTION_IN_PROGRESS` marker, and the proof that either of them can survive
 * the container they were written in.
 *
 * ===========================================================================
 * WHY THIS MODULE EXISTS AT ALL
 * ===========================================================================
 * `commit-indeterminate` used to be a string in a return value. Nothing wrote
 * it down, so the very next seed run healed the residue and reported `complete`
 * — a `NEEDS_OPERATOR` that clears itself. That was fixed by writing a hold
 * file and making phase 0 consult it.
 *
 * The fix had a hole the size of a redeploy. `baseStorageDir()` resolves
 * `STORAGE_DIR` > `RAILWAY_VOLUME_MOUNT_PATH` > `process.cwd()`, and on a
 * Railway service with no mounted volume that last branch is the container's
 * ephemeral filesystem. So the hold was written, the run reported
 * NEEDS_OPERATOR, the service redeployed — and the hold EVAPORATED, precisely
 * when it mattered. The seed then ran, saw the residue, healed it, and returned
 * `complete` over a fixture nobody had ever looked at. The old code knew: it
 * logged a warning about `process.cwd()` AFTER the hold had already been
 * written, which is a note in the flight recorder, not a guard.
 *
 * ===========================================================================
 * WHAT IS ENFORCED NOW
 * ===========================================================================
 *  1. DURABILITY IS PROVED, NOT DECLARED. `proveDurableStorage()` performs the
 *     whole sequence a hold write will perform — mkdir, write a temp file,
 *     `fsync` the FILE, atomic `rename` into place, `fsync` the DIRECTORY, read
 *     the bytes back, unlink the probe. Any step failing is a refusal. The
 *     directory `fsync` is the step people skip and the step that matters: on
 *     ext4/xfs a renamed file's DIRECTORY ENTRY is not durable until the
 *     directory itself is synced, so a crash can lose a file whose own data was
 *     already on disk.
 *  2. THE ENV VAR EXISTING IS NOT ENOUGH. `requireDurableOperatorHoldStorage()`
 *     insists on an explicit `STORAGE_DIR`, or a `RAILWAY_VOLUME_MOUNT_PATH`
 *     that is a real MOUNT (its `st_dev` differs from the filesystem root's) —
 *     and then still runs the full probe on it. A `STORAGE_DIR` pointing at the
 *     container's own working directory is refused for the same reason.
 *  3. THE TEST OVERRIDE DOES NOT OPEN THE GATE. `ATELIER_FINANCE_HOLD_DIR`
 *     relocates the holds (the suites use it) and is REFUSED outright for a
 *     hosted write. An env var of convenience that can satisfy a production
 *     durability guard is the same defect class as `MOCK_DB=true` deciding the
 *     database seam — see the P1-1b note in
 *     `atelierFinancePromotionTransaction.ts`.
 *
 * ===========================================================================
 * THE PROCESS-DEATH WINDOW, AND THE MARKER THAT CLOSES IT
 * ===========================================================================
 * The pinned transaction removes the "killed between two UPDATEs" hole: the
 * server aborts an uncommitted transaction when the connection drops. It does
 * NOT remove the window around the COMMIT itself. If the process dies in the
 * COMMIT round-trip, no code runs: no reconciliation, no hold, no result
 * object. The transaction may have committed. The next run finds a fully
 * promoted fixture, calls it healthy and returns `complete` — which is the
 * right answer if the commit landed and a silent fabrication if it did not.
 *
 * So a `PROMOTION_IN_PROGRESS` marker is written — durably, with the same
 * fsync/rename discipline — BEFORE `BEGIN`. It carries the run id, the tenant,
 * the exact five row ids, the digest of the pre-state, the digest of the
 * intended post-state, the target's identity and a timestamp. After a CONFIRMED
 * outcome the marker is updated with it, durably, and only then removed.
 *
 * The consequence is the point: a marker still reading `PROMOTION_IN_PROGRESS`
 * means a process died somewhere between `BEGIN` and the confirmed outcome, and
 * the next run treats it EXACTLY like `NEEDS_OPERATOR` — it blocks. It does not
 * heal, it does not re-promote, and it cannot clear the marker: removal is
 * gated on the marker's `runId` matching the run that wrote it, so a later seed
 * is structurally incapable of tidying away the evidence.
 *
 * Acknowledgement is a named operator, a decision and a note, written to an
 * audit record that is fsync'd BEFORE the hold is cleared. `rm` on the hold file
 * still technically unblocks the seed — a file-existence gate cannot prevent
 * that — but it leaves no record, and the runbook names the acknowledge command
 * as the only sanctioned path.
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import logger from '../../utils/Logger.js';
import { baseStorageDir } from '../../utils/storagePaths.js';

// ---------------------------------------------------------------------------
// Where the records live
// ---------------------------------------------------------------------------

/**
 * Directory the holds, markers and acknowledgements live in.
 *
 * `ATELIER_FINANCE_HOLD_DIR` overrides the location outright (the suites use
 * it). It relocates; it never satisfies the hosted durability gate — see
 * `requireDurableOperatorHoldStorage`.
 */
export function atelierFinanceOperatorHoldDir(): string {
  const override = process.env.ATELIER_FINANCE_HOLD_DIR;
  if (override && override.trim()) return path.resolve(override.trim());
  return path.join(baseStorageDir(), 'fin005-operator-holds');
}

/**
 * One record per tenant, per kind. The organization id is slugified for
 * readability and suffixed with a hash of the raw value, so two ids that
 * slugify the same cannot share (or clear) each other's record.
 */
function recordPath(kind: string, organizationId: string): string {
  const slug = organizationId.replace(/[^a-zA-Z0-9._-]+/g, '-').slice(0, 80) || 'org';
  const digest = crypto.createHash('sha256').update(organizationId).digest('hex').slice(0, 12);
  return path.join(atelierFinanceOperatorHoldDir(), `${kind}--${slug}--${digest}.json`);
}

/** The `commit-indeterminate` hold. Name unchanged — operators have it in runbooks. */
export function atelierFinanceOperatorHoldPath(organizationId: string): string {
  return recordPath('atelier-finance-commit-indeterminate', organizationId);
}

/** The promotion marker that closes the process-death window. */
export function atelierFinancePromotionMarkerPath(organizationId: string): string {
  return recordPath('atelier-finance-promotion-marker', organizationId);
}

/** Where an acknowledgement is recorded, before anything is cleared. */
export function atelierFinanceAcknowledgementPath(organizationId: string, at: Date): string {
  const slug = organizationId.replace(/[^a-zA-Z0-9._-]+/g, '-').slice(0, 80) || 'org';
  const digest = crypto.createHash('sha256').update(organizationId).digest('hex').slice(0, 12);
  const stamp = at.toISOString().replace(/[:.]/g, '-');
  return path.join(
    atelierFinanceOperatorHoldDir(),
    'acknowledged',
    `atelier-finance-ack--${slug}--${digest}--${stamp}.json`
  );
}

// ---------------------------------------------------------------------------
// Durability — proved by doing it, never by reading an env var
// ---------------------------------------------------------------------------

export interface DurabilityProof {
  durable: boolean;
  /** The directory that was probed. */
  dir: string;
  /** The step that failed, or the full sequence that succeeded. */
  reason: string;
  /** Every step that completed, in order. Goes into the report verbatim. */
  steps: string[];
}

/**
 * Do exactly what a hold write does, then undo it.
 *
 * mkdir -> write temp -> fsync(file) -> rename -> fsync(dir) -> read back ->
 * unlink. Every failure returns `durable: false` with the failing step named;
 * nothing throws, because the caller's job is to REFUSE, not to crash.
 */
export function proveDurableStorage(dir: string): DurabilityProof {
  const steps: string[] = [];
  const token = crypto.randomBytes(16).toString('hex');
  const payload = `fin005-durability-probe ${token}\n`;
  const temp = path.join(dir, `.fin005-durability-probe-${token}.tmp`);
  const target = path.join(dir, `.fin005-durability-probe-${token}.json`);

  const fail = (step: string, error: unknown): DurabilityProof => {
    // Best-effort tidy-up: a probe file left behind is litter, not evidence.
    for (const file of [temp, target]) {
      try {
        fs.unlinkSync(file);
      } catch {
        /* never existed, or the directory is the thing that is broken */
      }
    }
    return {
      durable: false,
      dir,
      reason: `${step} failed: ${(error as Error).message}`,
      steps,
    };
  };

  try {
    fs.mkdirSync(dir, { recursive: true });
    steps.push(`mkdir -p ${dir}`);
  } catch (error) {
    return fail('mkdir', error);
  }

  let handle: number;
  try {
    handle = fs.openSync(temp, 'wx', 0o600);
  } catch (error) {
    return fail('open(temp, wx)', error);
  }
  try {
    fs.writeFileSync(handle, payload, 'utf8');
    steps.push('write temp file');
    fs.fsyncSync(handle);
    steps.push('fsync the FILE');
  } catch (error) {
    try {
      fs.closeSync(handle);
    } catch {
      /* already gone */
    }
    return fail('write+fsync(temp)', error);
  }
  try {
    fs.closeSync(handle);
  } catch (error) {
    return fail('close(temp)', error);
  }

  try {
    fs.renameSync(temp, target);
    steps.push('atomic rename into place');
  } catch (error) {
    return fail('rename', error);
  }

  // THE STEP PEOPLE SKIP. A rename is atomic with respect to readers, but the
  // DIRECTORY ENTRY it created is not durable until the directory is synced.
  try {
    const fd = fs.openSync(dir, fs.constants.O_RDONLY);
    try {
      fs.fsyncSync(fd);
      steps.push('fsync the DIRECTORY');
    } finally {
      fs.closeSync(fd);
    }
  } catch (error) {
    return fail('fsync(directory)', error);
  }

  try {
    const readBack = fs.readFileSync(target, 'utf8');
    if (readBack !== payload) {
      return fail('read back', new Error(`the bytes differ (${readBack.length} bytes read)`));
    }
    steps.push('read the bytes back and compare');
  } catch (error) {
    return fail('read back', error);
  }

  try {
    fs.unlinkSync(target);
    steps.push('clean the probe file up');
  } catch (error) {
    return fail('unlink(probe)', error);
  }

  return {
    durable: true,
    dir,
    reason: `durability PROVED on ${dir}: ${steps.join(' -> ')}`,
    steps,
  };
}

export interface DurableStorageVerdict {
  ok: boolean;
  dir: string;
  /** Which declaration was accepted, or why none was. */
  source: 'STORAGE_DIR' | 'RAILWAY_VOLUME_MOUNT_PATH' | 'none';
  reason: string;
  proof?: DurabilityProof;
}

/** `st_dev` differs from the filesystem root's ⇒ something is mounted there. */
function looksLikeMountedVolume(
  dir: string,
  stat: (target: string) => { dev: number } = (target) => fs.statSync(target)
): { mounted: boolean; detail: string } {
  try {
    const resolved = path.resolve(dir);
    const root = path.parse(resolved).root;
    const here = stat(resolved).dev;
    const there = stat(root).dev;
    if (here === there) {
      return {
        mounted: false,
        detail: `${resolved} is on the SAME filesystem as ${root} (st_dev ${here}) — nothing is mounted there`,
      };
    }
    return {
      mounted: true,
      detail: `${resolved} is on its own filesystem (st_dev ${here}, root ${there})`,
    };
  } catch (error) {
    return { mounted: false, detail: `could not stat the path: ${(error as Error).message}` };
  }
}

/**
 * The gate for a HOSTED `--write` (FIN-005 P1-B #1-#4).
 *
 * Refuses unless a durable location is DECLARED and PROVED. Nothing here is
 * inferred: an unset variable, a variable pointing at the working directory, a
 * variable pointing at a path that is not a mount, and a path that fails the
 * fsync probe all end the same way — a refusal, before the first SQL write.
 *
 * `stat` is a parameter, not an environment variable, on purpose: the suites
 * need to exercise the mounted branch on a machine where nothing is mounted,
 * and a parameter cannot be reached from the CLI.
 */
export function requireDurableOperatorHoldStorage(options?: {
  stat?: (target: string) => { dev: number };
}): DurableStorageVerdict {
  const holdDirOverride = process.env.ATELIER_FINANCE_HOLD_DIR;
  if (holdDirOverride && holdDirOverride.trim()) {
    return {
      ok: false,
      dir: path.resolve(holdDirOverride.trim()),
      source: 'none',
      reason:
        `ATELIER_FINANCE_HOLD_DIR is set (${holdDirOverride.trim()}). It is a TEST relocation and is ` +
        `refused for a hosted write: an env var of convenience must never satisfy a durability guard. ` +
        `Unset it and declare STORAGE_DIR (a mounted volume) instead.`,
    };
  }

  const storageDir = (process.env.STORAGE_DIR ?? '').trim();
  const railwayDir = (process.env.RAILWAY_VOLUME_MOUNT_PATH ?? '').trim();

  if (!storageDir && !railwayDir) {
    return {
      ok: false,
      dir: path.join(baseStorageDir(), 'fin005-operator-holds'),
      source: 'none',
      reason:
        `neither STORAGE_DIR nor RAILWAY_VOLUME_MOUNT_PATH is set, so the operator hold would be written ` +
        `under process.cwd() (${process.cwd()}). On a hosted container that is ephemeral: the hold — and ` +
        `with it NEEDS_OPERATOR — would not survive a redeploy, which is exactly when it is needed.`,
    };
  }

  const source: 'STORAGE_DIR' | 'RAILWAY_VOLUME_MOUNT_PATH' = storageDir
    ? 'STORAGE_DIR'
    : 'RAILWAY_VOLUME_MOUNT_PATH';
  const declared = path.resolve(storageDir || railwayDir);
  const dir = path.join(declared, 'fin005-operator-holds');

  if (declared === path.resolve(process.cwd())) {
    return {
      ok: false,
      dir,
      source,
      reason:
        `${source} points at the process working directory (${declared}). That is the ephemeral container ` +
        `filesystem under another name — the hold would still be lost on redeploy.`,
    };
  }

  // "Set" is a declaration. "Mounted" is a fact.
  const mount = looksLikeMountedVolume(declared, options?.stat);
  if (!mount.mounted) {
    return {
      ok: false,
      dir,
      source,
      reason:
        `${source}=${declared} does not look like a mounted volume: ${mount.detail}. The variable merely ` +
        `existing is not durability — attach a volume and point ${source} at its mount path.`,
    };
  }

  const proof = proveDurableStorage(dir);
  if (!proof.durable) {
    return {
      ok: false,
      dir,
      source,
      reason: `${source}=${declared} is a mount, but the durability probe on ${dir} ${proof.reason}`,
      proof,
    };
  }

  return {
    ok: true,
    dir,
    source,
    reason: `${source}=${declared} (${mount.detail}); ${proof.reason}`,
    proof,
  };
}

// ---------------------------------------------------------------------------
// Durable writes
// ---------------------------------------------------------------------------

/**
 * Write JSON with the full durability sequence. Returns the error message on
 * failure — never throws, because every caller's correct response is to refuse
 * and say so, not to unwind.
 */
function writeJsonDurably(file: string, value: unknown): string | null {
  const dir = path.dirname(file);
  const temp = `${file}.${crypto.randomBytes(8).toString('hex')}.tmp`;
  const payload = `${JSON.stringify(value, null, 2)}\n`;
  try {
    fs.mkdirSync(dir, { recursive: true });
    const handle = fs.openSync(temp, 'w', 0o600);
    try {
      fs.writeFileSync(handle, payload, 'utf8');
      fs.fsyncSync(handle);
    } finally {
      fs.closeSync(handle);
    }
    fs.renameSync(temp, file);
    const fd = fs.openSync(dir, fs.constants.O_RDONLY);
    try {
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
    // Read back: a write that cannot be read is not a record.
    const readBack = fs.readFileSync(file, 'utf8');
    if (readBack !== payload) {
      return `the record read back differently than it was written (${readBack.length} vs ${payload.length} bytes)`;
    }
    return null;
  } catch (error) {
    try {
      fs.unlinkSync(temp);
    } catch {
      /* nothing to tidy */
    }
    return (error as Error).message;
  }
}

// ---------------------------------------------------------------------------
// The NEEDS_OPERATOR hold
// ---------------------------------------------------------------------------

export interface AtelierFinanceOperatorHold {
  organizationId: string;
  recordedAt: string;
  packId: string | null;
  analysisId: string | null;
  statementIds: string[];
  /** The adapter's reason string, verbatim. */
  reason: string;
  /** The reconciliation detail, verbatim — the evidence a human starts from. */
  reconciliation: string;
  /** Write labels the transaction issued before the COMMIT went in doubt. */
  applied: string[];
  backendPid: number | null;
  /** Row ids that claimed READY when the reconciliation looked. */
  rowsClaimingReady: string[];
  /** Literal instruction, stored in the file so it travels with the evidence. */
  acknowledgement: string;
}

/**
 * Is this tenant on hold?
 *
 * FAIL-CLOSED ON AMBIGUITY. `ENOENT` — the file, or the whole directory, is not
 * there — is the ONLY answer that means "no hold". Any other error (EACCES on
 * the directory, an I/O fault) means a hold may exist and we cannot see it, so
 * it is treated as one. A file we cannot parse is likewise a hold: its content
 * is evidence for a human, not a machine-readable permission slip.
 */
export function readAtelierFinanceOperatorHold(
  organizationId: string
): AtelierFinanceOperatorHold | null {
  const file = atelierFinanceOperatorHoldPath(organizationId);
  let raw: string;
  try {
    raw = fs.readFileSync(file, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    return {
      organizationId,
      recordedAt: 'unknown',
      packId: null,
      analysisId: null,
      statementIds: [],
      reason: `a commit-indeterminate hold may exist but could not be read: ${(error as Error).message}`,
      reconciliation: 'unreadable',
      applied: [],
      backendPid: null,
      rowsClaimingReady: [],
      acknowledgement: acknowledgementInstruction(organizationId),
    };
  }
  try {
    return { ...(JSON.parse(raw) as AtelierFinanceOperatorHold), organizationId };
  } catch (error) {
    return {
      organizationId,
      recordedAt: 'unknown',
      packId: null,
      analysisId: null,
      statementIds: [],
      reason: `a commit-indeterminate hold exists but its file is not valid JSON: ${(error as Error).message}`,
      reconciliation: raw.slice(0, 500),
      applied: [],
      backendPid: null,
      rowsClaimingReady: [],
      acknowledgement: acknowledgementInstruction(organizationId),
    };
  }
}

/** The exact words handed to the operator, in the log AND inside the file. */
export function acknowledgementInstruction(organizationId: string): string {
  return (
    `INVESTIGATE FIRST, THEN ACKNOWLEDGE. Read the five canonical Finance rows for ` +
    `organization "${organizationId}" and decide whether the in-doubt COMMIT landed. ` +
    `The seed will REFUSE to run for this tenant — it will not heal, rewrite or re-promote ` +
    `anything — until the hold is acknowledged. Acknowledge it with ` +
    `acknowledgeAtelierFinanceCommitIndeterminate("${organizationId}", { operator, decision, note }), ` +
    `which writes a durable audit record naming who decided what and only then clears the hold. ` +
    `Do NOT simply delete ${atelierFinanceOperatorHoldPath(organizationId)}: that unblocks the seed ` +
    `and leaves no record of the decision. Acknowledging authorises the NEXT run to demote the ` +
    `residue and re-earn READY.`
  );
}

/**
 * Record the hold, DURABLY. Returns the error message when it could NOT be
 * written — which the caller must surface, because an unpersisted hold means the
 * next run would erase the evidence, i.e. exactly the defect this closes.
 */
export function writeAtelierFinanceOperatorHold(hold: AtelierFinanceOperatorHold): string | null {
  const file = atelierFinanceOperatorHoldPath(hold.organizationId);
  const error = writeJsonDurably(file, hold);
  if (error) return error;
  if (
    !process.env.ATELIER_FINANCE_HOLD_DIR &&
    !process.env.STORAGE_DIR &&
    !process.env.RAILWAY_VOLUME_MOUNT_PATH
  ) {
    logger.error(
      `[atelier-finance-seed] the NEEDS_OPERATOR hold was written under process.cwd() (${file}) because neither STORAGE_DIR nor RAILWAY_VOLUME_MOUNT_PATH is set. On an ephemeral container this hold DOES NOT SURVIVE A REDEPLOY — set STORAGE_DIR to a mounted volume before running this seed against a hosted database. (A hosted --write refuses outright; see requireDurableOperatorHoldStorage.)`
    );
  }
  return null;
}

// ---------------------------------------------------------------------------
// The PROMOTION_IN_PROGRESS marker
// ---------------------------------------------------------------------------

export type PromotionMarkerState =
  /** Written before BEGIN. A marker still in this state means a process died. */
  | 'PROMOTION_IN_PROGRESS'
  /** The COMMIT was confirmed. */
  | 'COMMITTED'
  /** The transaction was proved not to have committed (rollback, or refusal before BEGIN). */
  | 'ROLLED_BACK'
  /** The COMMIT is in doubt. Blocks exactly like the hold. */
  | 'NEEDS_OPERATOR';

export interface PromotionMarkerTarget {
  database: string;
  databaseOid: string;
  serverAddr: string;
  serverPort: string;
  backendPid: string;
  systemIdentifier: string | null;
}

export interface AtelierFinancePromotionMarker {
  state: PromotionMarkerState;
  runId: string;
  organizationId: string;
  /** The exact five rows the promotion may touch: pack, 3 statements, analysis. */
  rowIds: string[];
  /** sha256 over the canonical pre-transaction state of those five rows. */
  preStateDigest: string;
  /** sha256 over the state the planned writes intend. */
  intendedPostStateDigest: string;
  target: PromotionMarkerTarget;
  startedAt: string;
  /** Set when the marker reaches a terminal state. */
  finishedAt?: string;
  /** Verbatim reason from the adapter, on any non-committed terminal state. */
  outcomeDetail?: string;
  /** Present on NEEDS_OPERATOR: the same words the hold carries. */
  acknowledgement?: string;
}

/**
 * Read the marker.
 *
 * Same fail-closed doctrine as the hold: only `ENOENT` means "no marker".
 * Anything unreadable or unparseable is reported as a marker in
 * `NEEDS_OPERATOR`, because a record we cannot read is not a record we may
 * ignore.
 */
export function readAtelierFinancePromotionMarker(
  organizationId: string
): AtelierFinancePromotionMarker | null {
  const file = atelierFinancePromotionMarkerPath(organizationId);
  const unreadable = (detail: string): AtelierFinancePromotionMarker => ({
    state: 'NEEDS_OPERATOR',
    runId: 'unknown',
    organizationId,
    rowIds: [],
    preStateDigest: 'unknown',
    intendedPostStateDigest: 'unknown',
    target: {
      database: 'unknown',
      databaseOid: 'unknown',
      serverAddr: 'unknown',
      serverPort: 'unknown',
      backendPid: 'unknown',
      systemIdentifier: null,
    },
    startedAt: 'unknown',
    outcomeDetail: detail,
    acknowledgement: acknowledgementInstruction(organizationId),
  });

  let raw: string;
  try {
    raw = fs.readFileSync(file, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    return unreadable(
      `a promotion marker may exist but could not be read: ${(error as Error).message}`
    );
  }
  try {
    const parsed = JSON.parse(raw) as AtelierFinancePromotionMarker;
    return { ...parsed, organizationId };
  } catch (error) {
    return unreadable(
      `a promotion marker exists but its file is not valid JSON: ${(error as Error).message}`
    );
  }
}

/** Does this marker block a run? Everything except the two clean terminal states. */
export function promotionMarkerBlocks(marker: AtelierFinancePromotionMarker | null): boolean {
  if (!marker) return false;
  return marker.state === 'PROMOTION_IN_PROGRESS' || marker.state === 'NEEDS_OPERATOR';
}

/** Write / update the marker, DURABLY. Returns the failure message or null. */
export function writeAtelierFinancePromotionMarker(
  marker: AtelierFinancePromotionMarker
): string | null {
  return writeJsonDurably(atelierFinancePromotionMarkerPath(marker.organizationId), marker);
}

/**
 * Remove a marker — but ONLY the one this run wrote (FIN-005 P1-B #10).
 *
 * The runId check is the whole guard. Without it a later seed run could delete a
 * `PROMOTION_IN_PROGRESS` marker left by a process that died, which is precisely
 * the evidence the marker exists to preserve. A marker whose runId is not ours,
 * or whose state is not the terminal one we just wrote, is left exactly where it
 * is and reported.
 */
export function removeOwnPromotionMarker(params: { organizationId: string; runId: string }): {
  removed: boolean;
  reason: string;
} {
  const file = atelierFinancePromotionMarkerPath(params.organizationId);
  const marker = readAtelierFinancePromotionMarker(params.organizationId);
  if (!marker) return { removed: false, reason: 'no marker is present' };
  if (marker.runId !== params.runId) {
    return {
      removed: false,
      reason: `the marker on disk belongs to run "${marker.runId}", not to this run ("${params.runId}") — left untouched`,
    };
  }
  if (marker.state === 'PROMOTION_IN_PROGRESS' || marker.state === 'NEEDS_OPERATOR') {
    return {
      removed: false,
      reason: `the marker is in state ${marker.state}; only a marker carrying a confirmed terminal outcome may be removed`,
    };
  }
  try {
    fs.unlinkSync(file);
    return {
      removed: true,
      reason: `marker for run "${params.runId}" removed after a durable ${marker.state}`,
    };
  } catch (error) {
    return { removed: false, reason: `could not remove the marker: ${(error as Error).message}` };
  }
}

// ---------------------------------------------------------------------------
// Acknowledgement — explicit, attributed, audited
// ---------------------------------------------------------------------------

export interface OperatorAcknowledgement {
  /** Who. A name or an account — never blank, never "operator". */
  operator: string;
  /** What was decided about the in-doubt COMMIT. */
  decision: 'commit-landed' | 'commit-did-not-land' | 'residue-reseeded-by-hand' | 'other';
  /** Why. The evidence a reader of the runbook will want. */
  note: string;
}

export interface AcknowledgementResult {
  cleared: boolean;
  /** Where the audit record was written. */
  auditPath: string | null;
  reason: string;
}

/**
 * Acknowledge a hold and/or a blocking marker for one tenant.
 *
 * ORDER IS THE POINT: the audit record is written and fsync'd FIRST, and the
 * hold is cleared only after that write succeeded. The reverse order can clear
 * the block and then fail to record why — an unblocked tenant with no
 * explanation, which is worse than a stuck one.
 *
 * Returns `cleared: false` when there was nothing to acknowledge, so a caller
 * cannot mistake "no hold existed" for "a hold was resolved".
 */
export function acknowledgeAtelierFinanceCommitIndeterminate(
  organizationId: string,
  acknowledgement: OperatorAcknowledgement,
  now: Date = new Date()
): AcknowledgementResult {
  const operator = String(acknowledgement?.operator ?? '').trim();
  const note = String(acknowledgement?.note ?? '').trim();
  if (!operator) {
    throw new Error(
      '[atelier-finance-seed] refusing to acknowledge a NEEDS_OPERATOR hold anonymously: `operator` is required.'
    );
  }
  if (!note) {
    throw new Error(
      '[atelier-finance-seed] refusing to acknowledge a NEEDS_OPERATOR hold without a note: state what was found and why it is safe to proceed.'
    );
  }

  const holdFile = atelierFinanceOperatorHoldPath(organizationId);
  const markerFile = atelierFinancePromotionMarkerPath(organizationId);
  const hold = readAtelierFinanceOperatorHold(organizationId);
  const marker = readAtelierFinancePromotionMarker(organizationId);

  if (!hold && !promotionMarkerBlocks(marker)) {
    return {
      cleared: false,
      auditPath: null,
      reason: `nothing to acknowledge for organization "${organizationId}": no hold and no blocking marker`,
    };
  }

  const auditPath = atelierFinanceAcknowledgementPath(organizationId, now);
  const auditError = writeJsonDurably(auditPath, {
    kind: 'fin005-atelier-finance-operator-acknowledgement',
    organizationId,
    acknowledgedAt: now.toISOString(),
    operator,
    decision: acknowledgement.decision,
    note,
    clearedHold: hold ?? null,
    clearedMarker: promotionMarkerBlocks(marker) ? marker : null,
    holdFile,
    markerFile,
  });
  if (auditError) {
    throw new Error(
      `[atelier-finance-seed] refusing to clear the hold for "${organizationId}": the acknowledgement audit ` +
        `record could not be written durably at ${auditPath} (${auditError}). Clearing a block without ` +
        `recording who cleared it and why is the failure this record exists to prevent.`
    );
  }

  const removed: string[] = [];
  for (const file of [holdFile, markerFile]) {
    try {
      fs.unlinkSync(file);
      removed.push(file);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }

  logger.warn(
    `[atelier-finance-seed] NEEDS_OPERATOR ACKNOWLEDGED for organization "${organizationId}" by "${operator}" ` +
      `(${acknowledgement.decision}): ${note}. Audit record: ${auditPath}. Cleared: ${removed.join(', ') || 'nothing'}. ` +
      `The next seed run may heal the residue.`
  );

  return {
    cleared: removed.length > 0,
    auditPath,
    reason: `acknowledged by "${operator}" (${acknowledgement.decision}); audit record at ${auditPath}`,
  };
}

/** Stable digest over a promotion-state snapshot, for the marker. */
export function digestPromotionState(state: unknown): string {
  return crypto.createHash('sha256').update(canonicalJson(state)).digest('hex');
}

/** Key-sorted JSON so two structurally equal states digest identically. */
function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value ?? null);
  if (Array.isArray(value)) return `[${value.map((item) => canonicalJson(item)).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
    a < b ? -1 : a > b ? 1 : 0
  );
  return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(',')}}`;
}
