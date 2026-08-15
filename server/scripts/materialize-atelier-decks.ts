#!/usr/bin/env npx tsx
/* eslint-disable no-console */
/**
 * MAT-006B — SAFE, DECK-ONLY materialization of the three canonical Atelier decks,
 * plus the signed rollback path that undoes it.
 *
 * WHAT THIS IS NOT
 * ----------------
 * This is NOT `build-demo-dataset.ts`. It never deletes a tenant, it never calls
 * `deleteDemoDatasetForOrganization`, it never touches users / initiatives /
 * assessments. It writes AT MOST three rows in `presentation_decks`, through the
 * seed's own transaction.
 *
 * PREFLIGHT — identical for --write and --rollback (`runTargetPreflight`)
 * ----------------------------------------------------------------------
 *   T0 the operator NAMED the environment on the command line (`--target=demo`)
 *   T1 the full demo target fingerprint matches, element by element
 *      -> server/src/config/demoTargetAuthority.ts (ALLOWLIST: Railway project id,
 *         environment id + name, service id + name, database host, EXPLICIT port,
 *         database name — all eight declared, observed and equal, or REFUSE)
 *   T2 organizationId is EXACTLY `atelier`
 *   T3 the `atelier` row really is `organization_type = 'DEMO'`
 * There is NO force flag, NO override and NO environment variable for T0–T3.
 *
 * WRITE GATES (all checked BEFORE any write)
 * ------------------------------------------
 *   G3 `--write` requires DECK_MATERIALIZE_CONFIRM=MATERIALIZE_ATELIER_DECKS
 *   G4 the backup must be COMPLETE (no `unknown` entry) — otherwise abort before
 *      any write, and emit NO rollback SQL at all
 *   G5 a durable, HMAC-signed rollback manifest exists on disk BEFORE the
 *      transaction opens; it is the crash-recovery anchor
 *   G6 no foreign content (unless --force-overwrite-foreign-content)
 *   G7 no active editors in the last ACTIVE_EDITOR_WINDOW_MINUTES minutes
 *   G8 the write itself is the seed's own transaction — we never open ours, and
 *      `atomicity !== 'pinned-pg'` in `--write` is a HARD FAILURE (non-zero exit,
 *      reported as a failed materialization, no success wording). A batched
 *      fallback is acceptable only where nothing is mutated: the dry run and tests.
 *   G9 read back all three rows and verify 3/3 (tenant, status, content, count)
 *   G10a the recovery anchor was durable BEFORE the COMMIT. The tool passes
 *      `persistRecoveryAnchor` into the seed; the seed runs it inside the
 *      transaction, after the post-state read-back and before COMMIT, and a
 *      throw from it ABORTS that transaction. Re-signing the manifest after the
 *      seed returns is re-signing it after COMMIT, which leaves a window with a
 *      CHANGED database and a manifest `--rollback` would refuse. A run that
 *      reaches G10a without a pre-COMMIT anchor is reported as FAILED.
 *   G10 the post-state fingerprint made it into the SIGNED manifest — a write
 *      this tool cannot undo is not reported as a success
 *
 * AN AMBIGUOUS COMMIT IS NOT A ROLLBACK
 * -------------------------------------
 * An error raised by COMMIT is not evidence that COMMIT did not happen. Both the
 * materialization (`seedResult.commitState === 'indeterminate'`) and the restore
 * (`RollbackOutcome` with `stage: 'indeterminate'`) can come back ambiguous. On
 * those paths the tool exits non-zero, prints what a FRESH read actually saw per
 * deck id, the manifest path, a step-by-step operator instruction and an explicit
 * do-not-re-run-blind warning — and never says "nothing was changed", "nothing
 * was restored" or "the transaction rolled back", none of which it knows.
 *
 * After an unanswered COMMIT the executor reconciles by re-reading the rows, and
 * that read has THREE ambiguous outcomes, worded separately (R5b §C2):
 *   `not-applied` — every deck reads as the post-materialization state, so the
 *                   restore most likely did not land. Recovery is a COMPLETE new
 *                   rollback run (preflight + lock + CAS), never the write alone.
 *   `mixed`       — the decks disagree with each other. Escalate; act on nothing.
 *   `unreadable`  — no state could be established at all, INCLUDING the case where
 *                   the in-doubt transaction still holds the advisory lock and has
 *                   therefore not finished.
 * None of them may borrow a determinate stage, and a determinate stage that
 * arrives carrying reconciliation evidence is refused that wording
 * (`carriesReconciliationEvidence`).
 *
 * ROLLBACK GATES
 * --------------
 *   R1 the SAME preflight as the write (`runTargetPreflight`, one function)
 *   R2 the manifest's HMAC verifies under the runtime key, and the key id matches
 *   R3 the manifest's target digest equals the LIVE target digest
 *   R4 preconditions still hold (complete backup, same tenant, a `postState`
 *      compare-and-swap target, and — as an ADDITIONAL early gate, not as the
 *      concurrency control — no active editors)
 *   R5 DECK_ROLLBACK_CONFIRM=ROLLBACK_ATELIER_DECKS
 *   R6 the restore runs ONLY through `rollbackAtelierDecksOnPinnedClient`:
 *      advisory lock -> re-read -> CAS against the manifest post-state ->
 *      restore -> read-back -> COMMIT, on one pinned client. `rollback.sql` is
 *      kept in the manifest as the reviewed manual escape hatch, not as the path
 *      this tool executes.
 *
 * DRY RUN IS THE DEFAULT. Without `--write` this process issues ZERO write
 * statements: every SQL it sends is a SELECT.
 *
 * OPERATOR COMMAND LINES — see `USAGE` at the bottom of this header.
 *
 * TESTABILITY NOTE: every side effect (database, seed module, filesystem, clock,
 * console) arrives through `MaterializeDeps`. The real implementations are loaded
 * with DYNAMIC imports inside `createDefaultDeps()` so that importing this module
 * from a unit test pulls in no dotenv, no Logger and no pg driver.
 *
 * USAGE
 * -----
 *   # 0. Declare the target ONCE per shell (all eight elements are mandatory).
 *   #    Read the real values with:  railway status --json
 *   export DEMO_TARGET_RAILWAY_PROJECT_ID=…      RAILWAY_PROJECT_ID=…
 *   export DEMO_TARGET_RAILWAY_ENVIRONMENT_ID=…  RAILWAY_ENVIRONMENT_ID=…
 *   export DEMO_TARGET_RAILWAY_ENVIRONMENT_NAME=demo RAILWAY_ENVIRONMENT_NAME=demo
 *   export DEMO_TARGET_RAILWAY_SERVICE_ID=…      RAILWAY_SERVICE_ID=…
 *   export DEMO_TARGET_RAILWAY_SERVICE_NAME=…    RAILWAY_SERVICE_NAME=…
 *   export DEMO_TARGET_DATABASE_HOST=…  DEMO_TARGET_DATABASE_PORT=…  DEMO_TARGET_DATABASE_NAME=railway
 *   export DECK_MANIFEST_HMAC_KEY_ID=…  DECK_MANIFEST_HMAC_SECRET=…
 *
 *   # 1. DRY RUN (default, read-only)
 *   cd server
 *   DATABASE_PUBLIC_URL="postgres://…:PORT/railway" \
 *     npx tsx scripts/materialize-atelier-decks.ts --target=demo
 *
 *   # 2. WRITE (after the dry-run plan is approved)
 *   cd server
 *   DATABASE_PUBLIC_URL="postgres://…:PORT/railway" \
 *   DECK_MATERIALIZE_CONFIRM=MATERIALIZE_ATELIER_DECKS \
 *     npx tsx scripts/materialize-atelier-decks.ts --target=demo --write
 *
 *   # 3. ROLLBACK (re-runs the whole preflight, then restores)
 *   cd server
 *   DATABASE_PUBLIC_URL="postgres://…:PORT/railway" \
 *   DECK_ROLLBACK_CONFIRM=ROLLBACK_ATELIER_DECKS \
 *     npx tsx scripts/materialize-atelier-decks.ts --target=demo --rollback \
 *       --manifest=_backup/mat-006b/atelier-decks-<stamp>/manifest.json
 *
 * This script is an operator tool. It is NOT wired into any boot/autorun path.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  assertDemoOrganization,
  assertDemoTargetAuthority,
  describeDemoTargetRefusals,
  type DemoTargetFingerprint,
  type DemoTargetRefusal,
} from '../src/config/demoTargetAuthority.js';

// ---------------------------------------------------------------------------
// Constants — the gate vocabulary. Nothing here is configurable at runtime.
// ---------------------------------------------------------------------------

/** T0: the only environment this tool will ever touch. */
export const MATERIALIZE_TARGET_ENVIRONMENT = 'demo';

/** T2: the only tenant this tool will ever touch. */
export const MATERIALIZE_ORGANIZATION_ID = 'atelier';

/** G3: confirmation token, in the style of DEMO_DATASET_CONFIRM=REBUILD_CANONICAL_DEMO. */
export const MATERIALIZE_CONFIRM_ENV = 'DECK_MATERIALIZE_CONFIRM';
export const MATERIALIZE_CONFIRM_VALUE = 'MATERIALIZE_ATELIER_DECKS';

/** R5: a separate token, so a shell authorized to write is not thereby authorized to restore. */
export const ROLLBACK_CONFIRM_ENV = 'DECK_ROLLBACK_CONFIRM';
export const ROLLBACK_CONFIRM_VALUE = 'ROLLBACK_ATELIER_DECKS';

/** Manifest signing. Absent secret => refuse to write a manifest => refuse to run. */
export const MANIFEST_HMAC_SECRET_ENV = 'DECK_MANIFEST_HMAC_SECRET';
export const MANIFEST_HMAC_KEY_ID_ENV = 'DECK_MANIFEST_HMAC_KEY_ID';
export const MANIFEST_ENVELOPE_VERSION = 1;
export const MANIFEST_HMAC_ALGORITHM = 'HMAC-SHA256';

/** Directories 0700, files 0600. A manifest is a full copy of tenant content. */
export const MANIFEST_DIR_MODE = 0o700;
export const MANIFEST_FILE_MODE = 0o600;

/**
 * G7: "active editor" window.
 *
 * A deck is considered MID-EDIT when, within this many minutes, any of the
 * following happened: a `presentation_deck_versions` snapshot was created, a
 * `deck_collab_sessions` heartbeat arrived, or the deck row's `updated_at` moved
 * while the row was NOT seed-owned. 30 minutes is deliberately wider than the
 * deck editor's autosave debounce (seconds) and than a rehearsal pass on one
 * deck, so a presenter who stepped away for coffee still blocks the write.
 */
export const ACTIVE_EDITOR_WINDOW_MINUTES = 30;

/**
 * Rollback manifests land in `server/_backup/mat-006b/` (git-ignored), resolved
 * from THIS file's location so the path does not depend on the operator's cwd.
 */
const MANIFEST_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../_backup/mat-006b'
);

// ---------------------------------------------------------------------------
// Types consumed from the FROZEN CONTRACT (R3, extended by MAT006B_CONTRACT_R4.md
// with the post-state fingerprint and the transactional rollback executor).
// Declared structurally here so this file does not import the seed module at
// module-evaluation time.
// ---------------------------------------------------------------------------

export type AtelierDeckOutcome =
  | 'inserted'
  | 'updated'
  | 'unchanged'
  | 'skipped'
  | 'failed';

export interface AtelierDeckPlanEntry {
  slug: string;
  deckId: string;
  outcome: AtelierDeckOutcome;
  reason: string | null;
  currentVersion: number | null;
  nextVersion: number | null;
  currentSlideCount: number | null;
  desiredSlideCount: number;
  currentFingerprint: string | null;
  desiredFingerprint: string;
  ownedBySeed: boolean;
  hasExistingContent: boolean;
  foreignTenant: string | null;
}

export interface SeedAtelierPresentationDeckFailure {
  deckId: string;
  reason: string;
}

/**
 * Contract R4 §1 — what a row looked like AFTER the write, per deck id. This is
 * the compare-and-swap target the transactional rollback checks against, so that
 * "restore the pre-state" is conditional on the rows still being the ones this
 * run produced, instead of a hopeful UPDATE over whatever is there now.
 */
export interface AtelierDeckPostState {
  deckId: string;
  /** 'exists' — the write produced/kept a row; 'absent' — there is no row. */
  state: 'exists' | 'absent';
  organizationId: string | null;
  version: number | null;
  /** DB text rendering, never a JS Date. */
  updatedAt: string | null;
  /** fingerprintDeckContent(deck_json, unified_json), null when absent. */
  contentFingerprint: string | null;
  slideCount: number | null;
  status: string | null;
}

export interface SeedAtelierPresentationDecksResult {
  decks: number;
  slides: number;
  deckIds: string[];
  unchanged: number;
  skipped: number;
  failures: SeedAtelierPresentationDeckFailure[];
  plan: AtelierDeckPlanEntry[];
  applied: boolean;
  /** Contract R3: what actually protected this run. */
  atomicity: 'pinned-pg' | 'batched-fallback';
  /** Contract R4 §1: the CAS target. Empty on a dry run or an aborted run. */
  postState: AtelierDeckPostState[];
  /**
   * Contract R5 §1, OPTIONAL — the seed's own verdict on its COMMIT.
   *
   * `undefined` (an older seed) and `null` (this seed, on a path with no COMMIT
   * to report — a dry run, a plan) both mean the same thing: NO verdict. The
   * tool must not manufacture one, because `applied: false` is not evidence of
   * a rollback, only evidence of what the seed believes. Only the literal
   * `'indeterminate'` switches the run to the operator-action report.
   *
   * Declared optional AND nullable on purpose: `atelierPresentationDeckSeed.ts`
   * types it `PinnedTxState | null` (always present), and a seed predating R5
   * omits it entirely. Both satisfy this slice.
   */
  commitState?: PinnedTxState | null;
}

/** Contract R5 §1. An error from COMMIT is not evidence that COMMIT did not happen. */
export type PinnedTxState = 'committed' | 'rolled_back' | 'indeterminate';

export interface SeedAtelierPresentationDecksInput {
  organizationId: string;
  anchorDate?: Date | string | null;
  force?: boolean;
  dryRun?: boolean;
  /**
   * Contract R5 §2 — the pre-COMMIT recovery anchor.
   *
   * Called INSIDE the transaction, on the pinned client, after the post-state
   * has been read back and BEFORE COMMIT. It must durably persist the SIGNED
   * manifest carrying that post-state; a throw ABORTS the transaction.
   *
   * The window it closes: re-signing the manifest AFTER the seed returns means
   * re-signing it after COMMIT, and between those two moments the database has
   * changed while the only manifest on disk carries no compare-and-swap target
   * — i.e. a changed database with a manifest `--rollback` would refuse. The
   * anchor makes "the rows changed" and "the way back is durable" one atomic
   * decision instead of two.
   */
  persistRecoveryAnchor?: (postState: AtelierDeckPostState[]) => Promise<void>;
}

/**
 * Contract R3: the backup captures every one of the 24 columns the upsert
 * overwrites, plus the two key columns. Anything less is a rollback that
 * silently drops data.
 */
export interface AtelierDeckBackupRow {
  id: string;
  organization_id: string | null;
  title: string | null;
  description: string | null;
  template_id: string | null;
  deck_type: string | null;
  audience: string | null;
  goal: string | null;
  language: string | null;
  confidentiality: string | null;
  theme: string | null;
  presentation_mode: string | null;
  source_type: string | null;
  source_id: string | null;
  source_artifacts: string | null;
  outline_json: string | null;
  unified_json: string | null;
  deck_json: string | null;
  source_refs_json: string | null;
  slide_count: number | null;
  status: string | null;
  generated_by: string | null;
  created_by: string | null;
  created_at: string | null;
  updated_at: string | null;
  version: number | null;
}

/** The 24 value columns, in contract order. Exported so tests can assert coverage. */
export const ATELIER_DECK_BACKUP_COLUMNS: Array<keyof AtelierDeckBackupRow> = [
  'title',
  'description',
  'template_id',
  'deck_type',
  'audience',
  'goal',
  'language',
  'confidentiality',
  'theme',
  'presentation_mode',
  'source_type',
  'source_id',
  'source_artifacts',
  'outline_json',
  'unified_json',
  'deck_json',
  'source_refs_json',
  'slide_count',
  'status',
  'generated_by',
  'created_by',
  'created_at',
  'updated_at',
  'version',
];

/** Contract R3: `unknown` means the SELECT itself failed. Never inferred. */
export type AtelierDeckBackupState = 'exists' | 'verified_absent' | 'unknown';

export interface AtelierDeckBackupEntry {
  deckId: string;
  state: AtelierDeckBackupState;
  row: AtelierDeckBackupRow | null;
  error: string | null;
}

export interface AtelierDeckBackup {
  organizationId: string;
  entries: AtelierDeckBackupEntry[];
  /** True only when every entry is 'exists' or 'verified_absent'. */
  complete: boolean;
}

/** Contract R4 §2 — the input to the one and only rollback executor. */
export interface RollbackAtelierDecksInput {
  organizationId: string;
  /** The pre-state to restore, all 24 columns. */
  backup: AtelierDeckBackup;
  /** CAS target, read out of the signed manifest. */
  expectedPostState: AtelierDeckPostState[];
}

/**
 * Contract R4 §2. The executor NEVER throws: every failure is a named stage, so
 * the operator learns WHERE it stopped (and therefore what is still true of the
 * database) instead of reading a stack trace.
 */
export type RollbackDeterminateStage = 'unavailable' | 'lock' | 'cas' | 'write' | 'readback';

/** What a FRESH connection saw in a row after an ambiguous COMMIT. */
export type RollbackObservedMatch = 'pre-state' | 'post-state' | 'neither' | 'unreadable';

export interface RollbackObservation {
  deckId: string;
  matches: RollbackObservedMatch;
}

/**
 * Contract R5b §C2 — the reconciliation's four possible readings.
 *
 * `restored` is the only one that comes back as a SUCCESS (`{ok:true,
 * restored:true}`): every deck read byte-identical to the backup on a connection
 * that never saw the in-doubt transaction. The other three stay on
 * `stage:'indeterminate'`, because none of them is a fact about the transaction
 * — they are facts about ROWS, read after a COMMIT whose answer never arrived.
 */
export type RollbackReconciliationVerdict = 'restored' | 'not-applied' | 'mixed' | 'unreadable';

/**
 * The three readings that arrive as `RollbackIndeterminate`. They must NEVER be
 * expressed as a determinate stage: `stage:'write'` licenses "the executor rolled
 * its own transaction back", and on this path the executor dispatched COMMIT and
 * rolled nothing back. That substitution IS the defect this discriminator exists
 * to make impossible.
 */
export type RollbackIndeterminateVerdict = Exclude<RollbackReconciliationVerdict, 'restored'>;

export const ROLLBACK_INDETERMINATE_VERDICTS: ReadonlyArray<RollbackIndeterminateVerdict> = [
  'not-applied',
  'mixed',
  'unreadable',
];

/**
 * Contract R5 §3 / R5b §C2 — the executor sent COMMIT and never learned whether
 * it took. This is NOT a stage where the transaction is known to have rolled
 * back, which is why it is a separate variant: every determinate stage licenses
 * the sentence "the rows are as they were", and this one does not.
 */
export interface RollbackIndeterminate {
  ok: false;
  restored: false;
  stage: 'indeterminate';
  needsOperator: true;
  /**
   * R5b §C2 — WHICH reading the reconciliation produced, so the runner can word
   * each case precisely instead of collapsing three different situations into
   * one paragraph.
   *
   * Declared OPTIONAL on purpose: an executor predating R5b reports the ambiguity
   * without the discriminator, and the honest response to that is to derive the
   * reading from `observed` (see `deriveIndeterminateVerdict`) and say that it was
   * derived — not to crash, and not to silently pick the mildest wording.
   */
  verdict?: RollbackIndeterminateVerdict;
  /** What a FRESH connection saw, per deck id, after the ambiguous COMMIT. */
  observed: RollbackObservation[];
  reason: string;
}

export type RollbackOutcome =
  | {
      ok: false;
      reason: string;
      stage: RollbackDeterminateStage;
      restored: false;
    }
  | RollbackIndeterminate
  | { ok: true; restored: true; rows: AtelierDeckBackupRow[] };

/**
 * Every DETERMINATE stage the executor can stop at, in the order it can reach
 * them. `'indeterminate'` is deliberately absent: on these stages the transaction
 * provably did not commit — the executor ROLLBACKed it after the body threw, the
 * connection failed before COMMIT was ever put on the wire, the SERVER rejected
 * the COMMIT with a SQLSTATE that can only mean it aborted the transaction, or no
 * transaction was ever begun. Adding the ambiguous outcome to this list is how a
 * tool starts describing an unknown database with the vocabulary of a known one.
 */
export const ROLLBACK_STAGES: ReadonlyArray<RollbackDeterminateStage> = [
  'unavailable',
  'lock',
  'cas',
  'write',
  'readback',
];

export const ROLLBACK_INDETERMINATE_STAGE = 'indeterminate';

export function isIndeterminateRollback(outcome: RollbackOutcome): outcome is RollbackIndeterminate {
  return outcome.ok === false && outcome.stage === ROLLBACK_INDETERMINATE_STAGE;
}

/**
 * R5b §C2 — the STRUCTURAL close of the mislabelling route.
 *
 * `observed[]` and `needsOperator` can only be produced by the reconciling
 * re-read, and that read only happens AFTER a COMMIT whose answer never came
 * back. So an outcome that carries either of them has been through the ambiguous
 * path, whatever stage label it wears. An executor that labels such an outcome
 * `'write'` (which the pre-R5b seed did, for the all-post reading) would route it
 * into the determinate branch and have this tool say "the executor rolled its own
 * transaction back, so nothing was changed" about a database it never got an
 * answer from.
 *
 * The runner therefore does not trust the label alone: a determinate stage
 * carrying reconciliation evidence is treated as indeterminate.
 */
export function carriesReconciliationEvidence(outcome: RollbackOutcome): boolean {
  if (outcome.ok !== false) return false;
  const candidate = outcome as { observed?: unknown; needsOperator?: unknown };
  return Array.isArray(candidate.observed) || candidate.needsOperator === true;
}

/**
 * R5b §C2 — what the observations themselves say, for an executor that reported
 * the ambiguity without the discriminator.
 *
 * Deliberately conservative in the residual case: anything that is not "every
 * deck reads as the post-materialization state" and not "nothing could be read"
 * lands on `'mixed'`, whose instruction is *escalate, do not act*. That includes
 * the contract violation of an `ok:false` outcome claiming `verdict:'restored'`
 * — a claim of success on a failed outcome is exactly when a human should look.
 */
export function deriveIndeterminateVerdict(
  observed: RollbackObservation[] | null | undefined
): RollbackIndeterminateVerdict {
  if (!Array.isArray(observed) || observed.length === 0) return 'unreadable';
  if (observed.every((observation) => observation.matches === 'post-state')) return 'not-applied';
  if (observed.every((observation) => observation.matches === 'unreadable')) return 'unreadable';
  return 'mixed';
}

/**
 * The verdict the report is worded from, plus whether the executor DECLARED it.
 * A derived verdict is printed as derived: the operator has to be able to tell a
 * reading the executor stands behind from one this tool inferred for it.
 */
export function resolveIndeterminateVerdict(outcome: RollbackIndeterminate): {
  verdict: RollbackIndeterminateVerdict;
  declared: boolean;
} {
  const declared = outcome.verdict;
  if (declared && (ROLLBACK_INDETERMINATE_VERDICTS as readonly string[]).includes(declared)) {
    return { verdict: declared, declared: true };
  }
  return { verdict: deriveIndeterminateVerdict(outcome.observed), declared: false };
}

/** The slice of `atelierPresentationDeckSeed.ts` this tool consumes. */
export interface AtelierDeckSeedModule {
  ATELIER_DECK_SLUGS: readonly string[];
  atelierDeckId(organizationId: string, slug: string): string;
  planAtelierPresentationDecks(
    input: SeedAtelierPresentationDecksInput
  ): Promise<SeedAtelierPresentationDecksResult>;
  seedAtelierPresentationDecks(
    input: SeedAtelierPresentationDecksInput
  ): Promise<SeedAtelierPresentationDecksResult>;
  readAtelierDeckBackup(organizationId: string): Promise<AtelierDeckBackup>;
  /** Contract R3: owned by the seed. Throws when `backup.complete` is false. */
  buildRollbackSql(backup: AtelierDeckBackup): string;
  /** Contract R4 §1: read-only capture of the post-write fingerprint. */
  readAtelierDeckPostState(organizationId: string): Promise<AtelierDeckPostState[]>;
  /**
   * Contract R4 §2: the ONLY way this tool restores anything. Lock -> re-read ->
   * CAS -> restore -> read-back -> COMMIT, all on one pinned PoolClient.
   */
  rollbackAtelierDecksOnPinnedClient(input: RollbackAtelierDecksInput): Promise<RollbackOutcome>;
}

/** Read-only database seam. Intentionally has NO `run`/`exec` — this tool never writes SQL. */
export interface ReadOnlyDbSeam {
  all<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
  tableExists(tableName: string): Promise<boolean>;
}

export interface ScriptTargetInfo {
  connectionString: string;
  host: string;
  database: string;
  source: string;
}

/**
 * Filesystem seam expressed at SYSCALL granularity, because the durability
 * property IS the call order: temp file -> fsync(file) -> rename -> fsync(dir).
 * A `writeFileSync` seam could not express, or test, any of that.
 */
export interface ManifestFsSeam {
  mkdirSecure(dirPath: string, mode: number): void;
  openForWrite(filePath: string, mode: number): number;
  writeAll(fd: number, contents: string): void;
  fsyncFile(fd: number): void;
  closeFile(fd: number): void;
  renameFile(fromPath: string, toPath: string): void;
  fsyncDirectory(dirPath: string): void;
  readTextFile(filePath: string): string;
}

export interface MaterializeDeps {
  seed: AtelierDeckSeedModule;
  db: ReadOnlyDbSeam;
  /** Mirrors `isDbWritableDeckStatus` from atelierPresentationDeckTemplate.ts. */
  isWritableStatus(status: string): boolean;
  resolveTarget(options: { requireExplicitTarget: boolean }): ScriptTargetInfo;
  env: NodeJS.ProcessEnv;
  now(): Date;
  fs: ManifestFsSeam;
  log(message: string): void;
}

export type MaterializeMode = 'dry-run' | 'write' | 'rollback';

export interface MaterializeOptions {
  write: boolean;
  rollback: boolean;
  /** Required by --rollback: the signed manifest to restore from. */
  manifestPath: string | null;
  targetEnvironment: string;
  organizationId: string;
  /** Operator escape hatch for G6 ONLY. Separate from the confirmation token. */
  forceOverwriteForeignContent: boolean;
  manifestRoot: string;
  anchorDate?: string | null;
}

export interface RollbackManifest {
  tool: 'materialize-atelier-decks';
  manifestVersion: number;
  generatedAt: string;
  mode: MaterializeMode;
  organizationId: string;
  organizationType: string;
  target: {
    environmentName: string;
    /** The FULL fingerprint, not a summary. Rollback re-derives and compares it. */
    fingerprint: DemoTargetFingerprint;
    digest: string;
    source: string;
  };
  deckIds: string[];
  /** The FULL backup: per-id state plus every one of the 24 columns. */
  backup: AtelierDeckBackup;
  /**
   * Contract R4 §1 — what the rows looked like AFTER the write, captured once
   * the transaction closed and folded back into the SIGNED payload. `--rollback`
   * uses it as the compare-and-swap target; a manifest written before the
   * transactional executor existed has an EMPTY array here and is REFUSED rather
   * than restored against an unverified present state.
   */
  postState: AtelierDeckPostState[];
  /**
   * Kept for the manual escape hatch (`psql -f rollback.sql`) and for the audit
   * trail. It is NOT what `--rollback` executes any more: the restore goes
   * through the seed's transactional executor, which locks, CASes and reads back.
   */
  rollbackSql: string;
  manifestPath: string;
  rollbackSqlPath: string;
}

export interface SignedManifestEnvelope {
  envelopeVersion: number;
  algorithm: string;
  keyId: string;
  /** hex HMAC-SHA256 over `envelopeVersion\nalgorithm\nkeyId\npayload`. */
  signature: string;
  /** The manifest, serialized EXACTLY as signed. Never re-serialized on verify. */
  payload: string;
}

export interface MaterializeRunResult {
  exitCode: number;
  mode: MaterializeMode;
  aborted: boolean;
  abortReason: string | null;
  gatesPassed: string[];
  manifest: RollbackManifest | null;
  plan: AtelierDeckPlanEntry[] | null;
  seedResult: SeedAtelierPresentationDecksResult | null;
  verification: DeckVerificationRow[] | null;
  failures: SeedAtelierPresentationDeckFailure[];
  /** Populated on a target refusal so the caller sees every failing element. */
  targetRefusals: DemoTargetRefusal[];
  restored: boolean;
  /**
   * Contract R5 §3/§5 — the outcome is AMBIGUOUS and a human has to look. It is
   * a distinct field rather than a flavour of `aborted`, because "we refused to
   * act" and "we acted and cannot tell what happened" are opposite facts.
   */
  needsOperator: boolean;
  /** The per-deck state a fresh connection read, when the outcome was ambiguous. */
  rollbackObserved: RollbackObservation[] | null;
  /**
   * R5b §C2 — WHICH of the three ambiguous readings this run reported, so a
   * caller can branch on it without parsing prose. `null` on every other path,
   * including a determinate refusal: there was no reconciliation to have a
   * reading.
   */
  rollbackVerdict: RollbackIndeterminateVerdict | null;
}

export interface DeckVerificationRow {
  deckId: string;
  tenantOk: boolean;
  statusOk: boolean;
  contentOk: boolean;
  countOk: boolean;
  persistedSlideCount: number | null;
  derivedCardCount: number | null;
  status: string | null;
  ok: boolean;
  detail: string | null;
}

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------

function readFlagValue(argv: string[], name: string): string | undefined {
  const inline = argv.find((arg) => arg.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1).trim();
  const index = argv.indexOf(name);
  if (index >= 0 && argv[index + 1] && !argv[index + 1].startsWith('--')) {
    return argv[index + 1].trim();
  }
  return undefined;
}

export function parseMaterializeArgs(argv: string[]): MaterializeOptions {
  return {
    write: argv.includes('--write'),
    rollback: argv.includes('--rollback'),
    manifestPath: readFlagValue(argv, '--manifest') ?? null,
    // No default: the operator must NAME the environment. An unset --target is
    // not `demo`, and T0 rejects it.
    targetEnvironment: readFlagValue(argv, '--target') ?? '',
    organizationId: readFlagValue(argv, '--organization') ?? MATERIALIZE_ORGANIZATION_ID,
    forceOverwriteForeignContent: argv.includes('--force-overwrite-foreign-content'),
    manifestRoot: readFlagValue(argv, '--manifest-root') ?? MANIFEST_ROOT,
    anchorDate: readFlagValue(argv, '--anchor-date') ?? null,
  };
}

// ---------------------------------------------------------------------------
// T0 / T2 — stated intent
// ---------------------------------------------------------------------------

function normalizeLower(value: unknown): string {
  return String(value ?? '').trim().toLowerCase();
}

/** T0. The operator must NAME the environment; an unset flag is not `demo`. */
export function assertTargetEnvironmentFlag(targetEnvironment: string): string | null {
  if (normalizeLower(targetEnvironment) === MATERIALIZE_TARGET_ENVIRONMENT) return null;
  return (
    `T0 target environment must be exactly "${MATERIALIZE_TARGET_ENVIRONMENT}". ` +
    `Got "${targetEnvironment || '<unset>'}". Pass --target=${MATERIALIZE_TARGET_ENVIRONMENT}.`
  );
}

/** T2. Exact match only — no normalization games, no prefix matching. */
export function assertOrganizationId(organizationId: string): string | null {
  if (organizationId !== MATERIALIZE_ORGANIZATION_ID) {
    return (
      `T2 organizationId must be exactly "${MATERIALIZE_ORGANIZATION_ID}". ` +
      `Got "${organizationId}". This tool materializes the canonical Atelier decks and nothing else.`
    );
  }
  return null;
}

// ---------------------------------------------------------------------------
// G3 / R5 — confirmation tokens
// ---------------------------------------------------------------------------

/**
 * Same shape as `requireConfirmation(...)` in scripts/lib/scriptDatabaseTarget.ts
 * (env var + exact literal), with its own distinct value so a shell that still has
 * DEMO_DATASET_CONFIRM exported cannot accidentally authorize this tool.
 */
export function assertConfirmationToken(
  env: NodeJS.ProcessEnv,
  envName: string,
  expected: string,
  gate: string
): string | null {
  const actual = String(env[envName] ?? '').trim();
  if (actual === expected) return null;
  return (
    `${gate} confirmation required. Set ${envName}=${expected} to continue. ` +
    `Current value: ${actual || '<unset>'}`
  );
}

// ---------------------------------------------------------------------------
// Manifest signing
// ---------------------------------------------------------------------------

export interface ManifestSigningKey {
  keyId: string;
  secret: string;
}

/**
 * The secret and its id are runtime input, never repo content. A missing secret
 * is fatal: an UNSIGNED manifest is not a recovery anchor, it is a suggestion.
 */
export function readManifestSigningKey(
  env: NodeJS.ProcessEnv
): { key: ManifestSigningKey; error: null } | { key: null; error: string } {
  const secret = String(env[MANIFEST_HMAC_SECRET_ENV] ?? '').trim();
  const keyId = String(env[MANIFEST_HMAC_KEY_ID_ENV] ?? '').trim();
  if (!secret) {
    return {
      key: null,
      error:
        `${MANIFEST_HMAC_SECRET_ENV} is not set. The rollback manifest must be signed, ` +
        `so this tool refuses to write one — and therefore refuses to run.`,
    };
  }
  if (!keyId) {
    return {
      key: null,
      error:
        `${MANIFEST_HMAC_KEY_ID_ENV} is not set. A signature without a key id cannot be ` +
        `rotated or attributed; refusing to write an unattributable manifest.`,
    };
  }
  return { key: { keyId, secret }, error: null };
}

function manifestMacInput(params: {
  envelopeVersion: number;
  algorithm: string;
  keyId: string;
  payload: string;
}): string {
  // The key id is INSIDE the MAC input: re-labelling a manifest with a different
  // key id must invalidate it, not merely mislead the reader.
  return `${params.envelopeVersion}\n${params.algorithm}\n${params.keyId}\n${params.payload}`;
}

export function signManifest(
  manifest: RollbackManifest,
  key: ManifestSigningKey
): SignedManifestEnvelope {
  const payload = JSON.stringify(manifest);
  const signature = createHmac('sha256', key.secret)
    .update(
      manifestMacInput({
        envelopeVersion: MANIFEST_ENVELOPE_VERSION,
        algorithm: MANIFEST_HMAC_ALGORITHM,
        keyId: key.keyId,
        payload,
      }),
      'utf8'
    )
    .digest('hex');
  return {
    envelopeVersion: MANIFEST_ENVELOPE_VERSION,
    algorithm: MANIFEST_HMAC_ALGORITHM,
    keyId: key.keyId,
    signature,
    payload,
  };
}

export function serializeSignedManifest(envelope: SignedManifestEnvelope): string {
  return `${JSON.stringify(envelope, null, 2)}\n`;
}

/**
 * Verifies an on-disk manifest. Every failure mode is distinct and named:
 * unparseable envelope, wrong version/algorithm, foreign key id, bad signature,
 * unparseable payload. The payload is verified as the EXACT bytes that were
 * signed and only then parsed — re-serializing before checking would let a
 * whitespace-equivalent forgery through.
 */
export function verifyManifestEnvelope(
  contents: string,
  key: ManifestSigningKey
): { ok: true; manifest: RollbackManifest; envelope: SignedManifestEnvelope } | { ok: false; reason: string } {
  let envelope: SignedManifestEnvelope;
  try {
    envelope = JSON.parse(contents) as SignedManifestEnvelope;
  } catch (error) {
    return { ok: false, reason: `manifest is not valid JSON: ${String(error)}` };
  }
  if (!envelope || typeof envelope !== 'object') {
    return { ok: false, reason: 'manifest envelope is not an object.' };
  }
  if (envelope.envelopeVersion !== MANIFEST_ENVELOPE_VERSION) {
    return {
      ok: false,
      reason: `manifest envelopeVersion=${String(envelope.envelopeVersion)}; this tool writes and accepts ${MANIFEST_ENVELOPE_VERSION}.`,
    };
  }
  if (envelope.algorithm !== MANIFEST_HMAC_ALGORITHM) {
    return {
      ok: false,
      reason: `manifest algorithm="${String(envelope.algorithm)}"; only ${MANIFEST_HMAC_ALGORITHM} is accepted.`,
    };
  }
  if (typeof envelope.payload !== 'string' || typeof envelope.signature !== 'string') {
    return { ok: false, reason: 'manifest envelope is missing `payload` or `signature`.' };
  }
  if (envelope.keyId !== key.keyId) {
    return {
      ok: false,
      reason: `manifest was signed with key id "${String(envelope.keyId)}" but the runtime key id is "${key.keyId}". Refusing to restore from a manifest this key did not sign.`,
    };
  }

  const expected = createHmac('sha256', key.secret)
    .update(
      manifestMacInput({
        envelopeVersion: envelope.envelopeVersion,
        algorithm: envelope.algorithm,
        keyId: envelope.keyId,
        payload: envelope.payload,
      }),
      'utf8'
    )
    .digest('hex');
  const actualBuffer = Buffer.from(envelope.signature, 'hex');
  const expectedBuffer = Buffer.from(expected, 'hex');
  if (
    actualBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(actualBuffer, expectedBuffer)
  ) {
    return {
      ok: false,
      reason: 'manifest HMAC does not verify — the file was modified after it was written.',
    };
  }

  let manifest: RollbackManifest;
  try {
    manifest = JSON.parse(envelope.payload) as RollbackManifest;
  } catch (error) {
    return { ok: false, reason: `manifest payload is not valid JSON: ${String(error)}` };
  }
  return { ok: true, manifest, envelope };
}

// ---------------------------------------------------------------------------
// Durable write: temp -> fsync(file) -> rename -> fsync(dir)
// ---------------------------------------------------------------------------

let durableWriteCounter = 0;

/**
 * A manifest that is merely `write()`n can vanish in the crash it exists to
 * survive. The rename is atomic, the file fsync is what makes the renamed inode
 * carry data, and the directory fsync is what makes the rename itself durable.
 * Omitting any one of the four leaves a window with no recovery anchor.
 */
export function writeDurableFile(
  fsSeam: ManifestFsSeam,
  params: { directory: string; filePath: string; contents: string; nonce: string }
): void {
  fsSeam.mkdirSecure(params.directory, MANIFEST_DIR_MODE);
  durableWriteCounter += 1;
  const temporaryPath = `${params.filePath}.tmp-${params.nonce}-${durableWriteCounter}`;
  const fd = fsSeam.openForWrite(temporaryPath, MANIFEST_FILE_MODE);
  try {
    fsSeam.writeAll(fd, params.contents);
    fsSeam.fsyncFile(fd);
  } finally {
    fsSeam.closeFile(fd);
  }
  fsSeam.renameFile(temporaryPath, params.filePath);
  fsSeam.fsyncDirectory(params.directory);
}

function manifestTimestamp(now: Date): string {
  return now.toISOString().replace(/[:.]/g, '-');
}

// ---------------------------------------------------------------------------
// Contract R5 §2 — the pre-COMMIT recovery anchor
// ---------------------------------------------------------------------------

export interface RecoveryAnchor {
  /** Handed to the seed as `persistRecoveryAnchor`. THROWS on any failure. */
  persist: (postState: AtelierDeckPostState[]) => Promise<void>;
  /** True only while a signed manifest carrying a post-state is durable on disk. */
  readonly persisted: boolean;
  /** How many times the seed invoked the anchor. 0 = the seed ignored it. */
  readonly attempts: number;
  /** The manifest as last made durable — the post-state one once `persisted`. */
  readonly manifest: RollbackManifest;
  /** Why the last attempt failed, for the operator-facing report. */
  readonly failure: string | null;
}

/**
 * Builds the callback the seed runs INSIDE its transaction, before COMMIT.
 *
 * Two properties matter and both are load-bearing:
 *
 * 1. It writes through the SAME durable sequence as the pre-write manifest
 *    (temp -> fsync(file) -> rename -> fsync(dir)) and to the SAME path, so the
 *    recovery anchor is never a second, weaker artefact sitting beside the real
 *    one. `writeDurableFile` is the only writer.
 * 2. It THROWS on every failure — an empty post-state included. A post-state
 *    with no entries is not a compare-and-swap target, so persisting it would
 *    produce a manifest `--rollback` refuses; throwing instead makes the seed
 *    ROLL BACK, which leaves a database that never changed. Failing the write
 *    is strictly better than succeeding the write with no way back.
 */
export function createRecoveryAnchor(params: {
  deps: MaterializeDeps;
  manifest: RollbackManifest;
  signingKey: ManifestSigningKey;
}): RecoveryAnchor {
  let current = params.manifest;
  let persisted = false;
  let attempts = 0;
  let failure: string | null = null;

  return {
    get persisted() {
      return persisted;
    },
    get attempts() {
      return attempts;
    },
    get manifest() {
      return current;
    },
    get failure() {
      return failure;
    },
    persist: async (postState: AtelierDeckPostState[]): Promise<void> => {
      attempts += 1;
      // Reset first: a second attempt that fails must not leave the runner
      // believing the first one still describes what is about to be committed.
      persisted = false;

      if (!Array.isArray(postState) || postState.length === 0) {
        failure =
          'the seed offered an EMPTY post-state, which is not a compare-and-swap target';
        params.deps.log(
          `\nRECOVERY ANCHOR REFUSED: ${failure}. Throwing so the transaction rolls back ` +
            `rather than committing rows this tool could not undo.`
        );
        throw new Error(`recovery anchor refused: ${failure}.`);
      }

      const updated: RollbackManifest = { ...current, postState };
      try {
        const envelope = signManifest(updated, params.signingKey);
        writeDurableFile(params.deps.fs, {
          directory: path.dirname(current.manifestPath),
          filePath: current.manifestPath,
          contents: serializeSignedManifest(envelope),
          nonce: `anchor-${manifestTimestamp(params.deps.now())}-${attempts}`,
        });
      } catch (error) {
        failure = String(error);
        params.deps.log(
          `\nRECOVERY ANCHOR FAILED to become durable (${failure}). Throwing so the ` +
            `transaction rolls back rather than committing rows this tool could not undo.`
        );
        throw new Error(`recovery anchor could not be persisted: ${failure}`);
      }

      current = updated;
      persisted = true;
      failure = null;
      params.deps.log(
        `\nRECOVERY ANCHOR durable BEFORE COMMIT — post-state fingerprint for ` +
          `${postState.length} deck id(s) is inside the SIGNED manifest:\n  ${current.manifestPath}`
      );
    },
  };
}

/**
 * The one sentence this tool must be able to say without lying, and the one it
 * must never say by accident. Exported so the runner and the tests share it.
 */
export const DO_NOT_RERUN_BLIND_WARNING =
  'DO NOT RE-RUN THIS COMMAND BLIND. A second attempt would take the current rows as its ' +
  'starting point, and the current rows are exactly what is in question. Establish what is ' +
  'in the database first; only then decide.';

// ---------------------------------------------------------------------------
// G6 — foreign content
// ---------------------------------------------------------------------------

/**
 * G6. A target row must be NULL/blank or carry the seed's own fingerprint.
 * Anything else is content this seed does not own -> ABORT, unless the operator
 * passed the explicit (and loudly logged) force flag.
 *
 * `foreignTenant` is NEVER forceable: per the contract the seed writes nothing
 * for a cross-tenant collision even with `force: true`.
 */
export function evaluateForeignContentGate(params: {
  plan: AtelierDeckPlanEntry[];
  force: boolean;
}): { abortReason: string | null; foreign: AtelierDeckPlanEntry[] } {
  const crossTenant = params.plan.filter((entry) => entry.foreignTenant);
  if (crossTenant.length > 0) {
    const detail = crossTenant
      .map((entry) => `${entry.deckId} belongs to tenant "${entry.foreignTenant}"`)
      .join('; ');
    return {
      abortReason: `G6 cross-tenant collision, not forceable: ${detail}`,
      foreign: crossTenant,
    };
  }

  // Any OTHER planning failure (a status the DB CHECK rejects, an unreadable
  // row) is equally fatal and equally unforceable: the seed applies strict
  // all-or-nothing, so it would refuse to write anything anyway. Abort here so
  // the operator sees the reason instead of a silent "0 decks written".
  const planFailures = params.plan.filter((entry) => entry.outcome === 'failed');
  if (planFailures.length > 0) {
    const detail = planFailures
      .map((entry) => `${entry.deckId} (${entry.reason || 'unknown planning failure'})`)
      .join('; ');
    return {
      abortReason: `G6 plan contains failures the seed will not write, not forceable: ${detail}`,
      foreign: planFailures,
    };
  }

  const foreign = params.plan.filter(
    (entry) => entry.outcome === 'skipped' || (entry.hasExistingContent && !entry.ownedBySeed)
  );
  if (foreign.length === 0) return { abortReason: null, foreign: [] };

  if (!params.force) {
    const detail = foreign
      .map((entry) => `${entry.deckId} (${entry.reason || 'content not owned by the seed'})`)
      .join('; ');
    return {
      abortReason:
        `G6 ${foreign.length} row(s) carry content this seed does not own: ${detail}. ` +
        `Re-run with --force-overwrite-foreign-content only after the owner has signed off.`,
      foreign,
    };
  }

  return { abortReason: null, foreign };
}

// ---------------------------------------------------------------------------
// G7 — active editors
// ---------------------------------------------------------------------------

export interface ActiveEditorSignal {
  source: 'presentation_deck_versions' | 'deck_collab_sessions' | 'presentation_decks.updated_at';
  deckId: string;
  detail: string;
}

/**
 * G7. Read-only sweep for anyone mid-edit inside ACTIVE_EDITOR_WINDOW_MINUTES.
 *
 * Every query here is a SELECT. Missing tables are tolerated (the collaboration
 * surface is additive and absent on some replicas) — an absent table simply
 * yields no signal, and that is logged.
 *
 * The `updated_at` probe deliberately ignores rows the seed already owns: a
 * recent touch on a seed-owned row is OUR previous run, not a human editor.
 */
export async function detectActiveEditors(params: {
  db: ReadOnlyDbSeam;
  organizationId: string;
  deckIds: string[];
  seedOwnedDeckIds: string[];
  now: Date;
  log: (message: string) => void;
}): Promise<ActiveEditorSignal[]> {
  const cutoffIso = new Date(
    params.now.getTime() - ACTIVE_EDITOR_WINDOW_MINUTES * 60 * 1000
  ).toISOString();
  const placeholders = params.deckIds.map(() => '?').join(', ');
  const signals: ActiveEditorSignal[] = [];

  if (params.deckIds.length === 0) return signals;

  if (await params.db.tableExists('presentation_deck_versions')) {
    const rows = await params.db.all<{ deck_id: string; version: number; created_at: string }>(
      `SELECT deck_id, version, created_at
         FROM presentation_deck_versions
        WHERE deck_id IN (${placeholders})
          AND created_at > ?
        ORDER BY created_at DESC`,
      [...params.deckIds, cutoffIso]
    );
    for (const row of rows) {
      signals.push({
        source: 'presentation_deck_versions',
        deckId: row.deck_id,
        detail: `version ${row.version} snapshot at ${row.created_at}`,
      });
    }
  } else {
    params.log('[G7] presentation_deck_versions is absent — no version-history signal.');
  }

  if (await params.db.tableExists('deck_collab_sessions')) {
    const rows = await params.db.all<{
      deck_id: string;
      user_id: string;
      last_heartbeat_at: string;
    }>(
      `SELECT deck_id, user_id, last_heartbeat_at
         FROM deck_collab_sessions
        WHERE organization_id = ?
          AND deck_id IN (${placeholders})
          AND is_active = 1
          AND last_heartbeat_at > ?
        ORDER BY last_heartbeat_at DESC`,
      [params.organizationId, ...params.deckIds, cutoffIso]
    );
    for (const row of rows) {
      signals.push({
        source: 'deck_collab_sessions',
        deckId: row.deck_id,
        detail: `user ${row.user_id} heartbeat at ${row.last_heartbeat_at}`,
      });
    }
  } else {
    params.log('[G7] deck_collab_sessions is absent — no live-presence signal.');
  }

  const seedOwned = new Set(params.seedOwnedDeckIds);
  const touched = await params.db.all<{ id: string; updated_at: string }>(
    `SELECT id, updated_at
       FROM presentation_decks
      WHERE organization_id = ?
        AND id IN (${placeholders})
        AND updated_at > ?`,
    [params.organizationId, ...params.deckIds, cutoffIso]
  );
  for (const row of touched) {
    if (seedOwned.has(row.id)) continue;
    signals.push({
      source: 'presentation_decks.updated_at',
      deckId: row.id,
      detail: `row touched at ${row.updated_at} and is not seed-owned`,
    });
  }

  return signals;
}

// ---------------------------------------------------------------------------
// G9 — read-back verification
// ---------------------------------------------------------------------------

function isBlank(value: string | null | undefined): boolean {
  return value === null || value === undefined || String(value).trim() === '';
}

function derivedCardCount(deckJson: string | null): number | null {
  if (isBlank(deckJson)) return null;
  try {
    const parsed = JSON.parse(String(deckJson)) as { cards?: unknown };
    return Array.isArray(parsed.cards) ? parsed.cards.length : null;
  } catch {
    return null;
  }
}

export function backupRowsOf(backup: AtelierDeckBackup): AtelierDeckBackupRow[] {
  return backup.entries
    .filter((entry) => entry.state === 'exists' && entry.row)
    .map((entry) => entry.row as AtelierDeckBackupRow);
}

export function incompleteBackupEntries(backup: AtelierDeckBackup): AtelierDeckBackupEntry[] {
  return backup.entries.filter((entry) => entry.state === 'unknown');
}

/**
 * G9. Read-back proof: tenant, status, both content columns present, and the
 * card count DERIVED from the persisted `deck_json` equal to the persisted
 * `slide_count` (and to what the plan intended).
 */
export function verifyReadBack(params: {
  organizationId: string;
  deckIds: string[];
  backup: AtelierDeckBackup;
  plan: AtelierDeckPlanEntry[];
  isWritableStatus: (status: string) => boolean;
}): DeckVerificationRow[] {
  const entryById = new Map(params.backup.entries.map((entry) => [entry.deckId, entry]));
  const desiredById = new Map(
    params.plan.map((entry) => [entry.deckId, entry.desiredSlideCount])
  );

  return params.deckIds.map((deckId) => {
    const entry = entryById.get(deckId);
    const row = entry?.state === 'exists' ? entry.row : null;
    if (!row) {
      return {
        deckId,
        tenantOk: false,
        statusOk: false,
        contentOk: false,
        countOk: false,
        persistedSlideCount: null,
        derivedCardCount: null,
        status: null,
        ok: false,
        detail:
          entry?.state === 'unknown'
            ? `post-write read failed: ${entry.error ?? 'unknown error'}`
            : 'row missing after write',
      };
    }

    const tenantOk = row.organization_id === params.organizationId;
    const statusOk = !isBlank(row.status) && params.isWritableStatus(String(row.status));
    const contentOk = !isBlank(row.deck_json) && !isBlank(row.unified_json);
    const derived = derivedCardCount(row.deck_json);
    const desired = desiredById.get(deckId);
    const countOk =
      derived !== null &&
      derived === row.slide_count &&
      (desired === undefined || derived === desired);

    const problems: string[] = [];
    if (!tenantOk) problems.push(`tenant=${row.organization_id}`);
    if (!statusOk) problems.push(`status=${row.status}`);
    if (!contentOk) problems.push('deck_json/unified_json blank');
    if (!countOk) {
      problems.push(
        `derived=${derived} slide_count=${row.slide_count} desired=${desired ?? 'n/a'}`
      );
    }

    return {
      deckId,
      tenantOk,
      statusOk,
      contentOk,
      countOk,
      persistedSlideCount: row.slide_count,
      derivedCardCount: derived,
      status: row.status,
      ok: tenantOk && statusOk && contentOk && countOk,
      detail: problems.length ? problems.join(', ') : null,
    };
  });
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

function emptyResult(mode: MaterializeMode): MaterializeRunResult {
  return {
    exitCode: 0,
    mode,
    aborted: false,
    abortReason: null,
    gatesPassed: [],
    manifest: null,
    plan: null,
    seedResult: null,
    verification: null,
    failures: [],
    targetRefusals: [],
    restored: false,
    needsOperator: false,
    rollbackObserved: null,
    rollbackVerdict: null,
  };
}

function abort(
  mode: MaterializeMode,
  gatesPassed: string[],
  reason: string,
  log: (m: string) => void,
  extra: Partial<MaterializeRunResult> = {}
): MaterializeRunResult {
  log(`\nABORT: ${reason}\n`);
  return {
    ...emptyResult(mode),
    exitCode: 2,
    aborted: true,
    abortReason: reason,
    gatesPassed,
    ...extra,
  };
}

export interface TargetPreflightOutcome {
  ok: boolean;
  reason: string | null;
  refusals: DemoTargetRefusal[];
  target: ScriptTargetInfo | null;
  fingerprint: DemoTargetFingerprint | null;
  digest: string | null;
  organizationType: string | null;
}

/**
 * T0–T3. ONE function, called from exactly two places — the write path and the
 * rollback path — so "the rollback repeats the same preflight" is a fact about
 * the call graph rather than a claim in a comment.
 */
export async function runTargetPreflight(
  options: MaterializeOptions,
  deps: MaterializeDeps,
  gatesPassed: string[]
): Promise<TargetPreflightOutcome> {
  const fail = (reason: string, refusals: DemoTargetRefusal[] = []): TargetPreflightOutcome => ({
    ok: false,
    reason,
    refusals,
    target: null,
    fingerprint: null,
    digest: null,
    organizationType: null,
  });

  // --- T0 --------------------------------------------------------------------
  const flagAbort = assertTargetEnvironmentFlag(options.targetEnvironment);
  if (flagAbort) return fail(flagAbort);
  gatesPassed.push('T0:--target=demo');

  // --- T1 --------------------------------------------------------------------
  let target: ScriptTargetInfo;
  try {
    target = deps.resolveTarget({ requireExplicitTarget: options.write || options.rollback });
  } catch (error) {
    return fail(`T1 database target unusable: ${String(error)}`);
  }
  deps.log(
    `database:     source=${target.source} host=${target.host} database=${target.database}`
  );

  const authority = assertDemoTargetAuthority({
    env: deps.env,
    connectionString: target.connectionString,
  });
  if (!authority.ok || !authority.fingerprint || !authority.digest) {
    return fail(
      `T1 demo target authority refused (${authority.refusals.length} element(s)): ` +
        describeDemoTargetRefusals(authority.refusals),
      authority.refusals
    );
  }
  deps.log(`target digest: ${authority.digest}`);
  gatesPassed.push('T1:demo-target-fingerprint');

  // --- T2 --------------------------------------------------------------------
  const organizationAbort = assertOrganizationId(options.organizationId);
  if (organizationAbort) return fail(organizationAbort);
  gatesPassed.push('T2:organization=atelier');

  // --- T3 --------------------------------------------------------------------
  const organizationRefusal = await assertDemoOrganization({
    organizationId: options.organizationId,
    query: (sql, values) => deps.db.all(sql, values),
  });
  if (organizationRefusal) {
    return fail(
      `T3 tenant class refused: DEMO TARGET REFUSED [${organizationRefusal.element}]: ${organizationRefusal.reason}`,
      [organizationRefusal]
    );
  }
  gatesPassed.push('T3:organization_type=DEMO');

  return {
    ok: true,
    reason: null,
    refusals: [],
    target,
    fingerprint: authority.fingerprint,
    digest: authority.digest,
    organizationType: 'DEMO',
  };
}

export async function runMaterializeAtelierDecks(
  options: MaterializeOptions,
  deps: MaterializeDeps
): Promise<MaterializeRunResult> {
  if (options.rollback) return runRollbackAtelierDecks(options, deps);

  const mode: MaterializeMode = options.write ? 'write' : 'dry-run';
  const gatesPassed: string[] = [];
  const { log } = deps;

  log('\nmaterialize-atelier-decks — canonical Atelier deck materialization');
  log(`mode:         ${mode}${mode === 'dry-run' ? ' (default, read-only)' : ''}`);
  log(`environment:  ${options.targetEnvironment || '<unset>'}`);
  log(`organization: ${options.organizationId}`);

  // --- T0..T3 ----------------------------------------------------------------
  const preflight = await runTargetPreflight(options, deps, gatesPassed);
  if (!preflight.ok) {
    return abort(mode, gatesPassed, preflight.reason ?? 'target preflight refused', log, {
      targetRefusals: preflight.refusals,
    });
  }
  const target = preflight.target as ScriptTargetInfo;

  // --- G3 (write only) -------------------------------------------------------
  if (options.write) {
    const confirmationAbort = assertConfirmationToken(
      deps.env,
      MATERIALIZE_CONFIRM_ENV,
      MATERIALIZE_CONFIRM_VALUE,
      'G3'
    );
    if (confirmationAbort) return abort(mode, gatesPassed, confirmationAbort, log);
    gatesPassed.push('G3:confirmation-token');
  }

  // The signing key is checked BEFORE anything is read: a run that cannot produce
  // a signed manifest must not start, not fail halfway.
  const signing = readManifestSigningKey(deps.env);
  if (!signing.key) {
    return abort(mode, gatesPassed, `G5 manifest cannot be signed: ${signing.error}`, log);
  }

  if (options.forceOverwriteForeignContent) {
    log(
      '\n**** --force-overwrite-foreign-content IS ACTIVE ****\n' +
        '**** Rows carrying content this seed does not own WILL BE OVERWRITTEN. ****\n' +
        '**** The rollback manifest below is the only way back. ****\n'
    );
  }

  const deckIds = deps.seed.ATELIER_DECK_SLUGS.map((slug) =>
    deps.seed.atelierDeckId(options.organizationId, slug)
  );

  // --- G4: the backup must be COMPLETE --------------------------------------
  let backup: AtelierDeckBackup;
  try {
    backup = await deps.seed.readAtelierDeckBackup(options.organizationId);
  } catch (error) {
    return abort(mode, gatesPassed, `G4 could not read the pre-state backup: ${String(error)}`, log);
  }
  const unknownEntries = incompleteBackupEntries(backup);
  if (!backup.complete || unknownEntries.length > 0) {
    const detail = unknownEntries
      .map((entry) => `${entry.deckId} (${entry.error ?? 'SELECT failed'})`)
      .join('; ');
    return abort(
      mode,
      gatesPassed,
      `G4 backup is INCOMPLETE — ${unknownEntries.length || 'some'} deck id(s) are in state "unknown": ${detail || '<none reported>'}. ` +
        `An unknown pre-state cannot be rolled back, so no manifest, no rollback SQL and no write are produced. ` +
        `Fix the read path and re-run.`,
      log
    );
  }
  gatesPassed.push('G4:backup-complete');

  // --- G5: durable signed manifest, BEFORE the plan and long before any write --
  let manifest: RollbackManifest;
  try {
    const generatedAt = deps.now().toISOString();
    // Owned by the seed per contract R3; it throws when the backup is incomplete,
    // which G4 has already made impossible to reach.
    const rollbackSql = deps.seed.buildRollbackSql(backup);
    const directory = path.join(
      options.manifestRoot,
      `${options.organizationId}-decks-${manifestTimestamp(deps.now())}`
    );
    const manifestPath = path.join(directory, 'manifest.json');
    const rollbackSqlPath = path.join(directory, 'rollback.sql');

    manifest = {
      tool: 'materialize-atelier-decks',
      manifestVersion: MANIFEST_ENVELOPE_VERSION,
      generatedAt,
      mode,
      organizationId: options.organizationId,
      organizationType: preflight.organizationType ?? 'DEMO',
      target: {
        environmentName: options.targetEnvironment,
        fingerprint: preflight.fingerprint as DemoTargetFingerprint,
        digest: preflight.digest as string,
        source: target.source,
      },
      deckIds,
      backup,
      // Filled in AFTER the transaction closes; see `foldPostStateIntoManifest`.
      // Empty here on purpose: at this point nothing has been written, so there
      // is no post-state to compare against and nothing to roll back either.
      postState: [],
      rollbackSql,
      manifestPath,
      rollbackSqlPath,
    };

    const envelope = signManifest(manifest, signing.key);
    const nonce = manifestTimestamp(deps.now());
    writeDurableFile(deps.fs, {
      directory,
      filePath: manifestPath,
      contents: serializeSignedManifest(envelope),
      nonce,
    });
    writeDurableFile(deps.fs, {
      directory,
      filePath: rollbackSqlPath,
      contents: rollbackSql,
      nonce,
    });
    log(`\nG5 signed rollback manifest written BEFORE any write (keyId=${signing.key.keyId}):`);
    log(`  ${manifestPath}`);
    log(`  ${rollbackSqlPath}`);
    log(`  RECOVERY ANCHOR — if this process dies from here on, restore with:`);
    log(
      `    npx tsx scripts/materialize-atelier-decks.ts --target=demo --rollback --manifest=${manifestPath}`
    );
    gatesPassed.push('G5:signed-durable-manifest');
  } catch (error) {
    return abort(mode, gatesPassed, `G5 could not produce the rollback manifest: ${String(error)}`, log);
  }

  // --- Plan (read-only) ------------------------------------------------------
  let plan: AtelierDeckPlanEntry[];
  try {
    const planResult = await deps.seed.planAtelierPresentationDecks({
      organizationId: options.organizationId,
      anchorDate: options.anchorDate ?? null,
      force: options.forceOverwriteForeignContent,
      dryRun: true,
    });
    plan = planResult.plan;
    if (planResult.failures.length > 0) {
      log('\nplan failures (verbatim):');
      log(JSON.stringify(planResult.failures, null, 2));
      return abort(
        mode,
        gatesPassed,
        `plan reported ${planResult.failures.length} failure(s); refusing to continue.`,
        log,
        { manifest, plan }
      );
    }
  } catch (error) {
    return abort(mode, gatesPassed, `plan failed: ${String(error)}`, log, { manifest });
  }

  log('\nplan:');
  for (const entry of plan) {
    log(
      `  ${entry.deckId.padEnd(46)} ${entry.outcome.padEnd(10)} ` +
        `v${entry.currentVersion ?? '-'}→v${entry.nextVersion ?? '-'} ` +
        `slides ${entry.currentSlideCount ?? '-'}→${entry.desiredSlideCount} ` +
        `ownedBySeed=${entry.ownedBySeed}${entry.reason ? ` — ${entry.reason}` : ''}`
    );
  }

  // --- G6 --------------------------------------------------------------------
  const foreignGate = evaluateForeignContentGate({
    plan,
    force: options.forceOverwriteForeignContent,
  });
  if (foreignGate.abortReason) {
    return abort(mode, gatesPassed, foreignGate.abortReason, log, { manifest, plan });
  }
  if (foreignGate.foreign.length > 0) {
    log(
      `G6 FORCED past ${foreignGate.foreign.length} row(s) with foreign content: ` +
        foreignGate.foreign.map((entry) => entry.deckId).join(', ')
    );
  }
  gatesPassed.push('G6:no-foreign-content');

  // --- G7 --------------------------------------------------------------------
  const idleAbort = await assertNoActiveEditors({
    deps,
    organizationId: options.organizationId,
    deckIds,
    seedOwnedDeckIds: plan.filter((entry) => entry.ownedBySeed).map((entry) => entry.deckId),
    gate: 'G7',
  });
  if (idleAbort) return abort(mode, gatesPassed, idleAbort, log, { manifest, plan });
  gatesPassed.push(`G7:no-active-editors(${ACTIVE_EDITOR_WINDOW_MINUTES}m)`);

  // --- Dry run stops here, having issued no write statement -------------------
  if (!options.write) {
    log(
      `\nDRY RUN complete. Zero write statements issued. ` +
        `Re-run with --write and ${MATERIALIZE_CONFIRM_ENV}=${MATERIALIZE_CONFIRM_VALUE} to materialize.\n`
    );
    return { ...emptyResult(mode), gatesPassed, manifest, plan };
  }

  // --- G8: the seed's own transaction ----------------------------------------
  // The recovery anchor goes IN with the call. Contract R5 §2: the seed runs it
  // inside the transaction, after the post-state read-back and before COMMIT, so
  // there is no instant in which the rows have changed and the manifest on disk
  // carries no compare-and-swap target.
  const anchor = createRecoveryAnchor({ deps, manifest, signingKey: signing.key });

  let seedResult: SeedAtelierPresentationDecksResult;
  try {
    seedResult = await deps.seed.seedAtelierPresentationDecks({
      organizationId: options.organizationId,
      anchorDate: options.anchorDate ?? null,
      force: options.forceOverwriteForeignContent,
      persistRecoveryAnchor: anchor.persist,
    });
  } catch (error) {
    // A throw is NOT evidence that the transaction rolled back: a connection
    // that dies while COMMIT is in flight throws here too. So say nothing about
    // the rows, and make sure a way back exists either way.
    manifest = anchor.persisted
      ? anchor.manifest
      : await recoverPostStateAfterCrash({
          deps,
          manifest,
          signingKey: signing.key,
        });
    log(
      `\nThe seed threw. This tool does NOT know whether the write took effect — a failure ` +
        `raised at or after COMMIT looks exactly like one raised before it. Treat the rows as ` +
        `UNKNOWN until read.\nThe manifest survives this failure and is the way back:\n  ` +
        `${manifest.manifestPath}\n${DO_NOT_RERUN_BLIND_WARNING}\n`
    );
    return abort(mode, gatesPassed, `G8 seed threw: ${String(error)}`, log, { manifest, plan });
  }

  log(
    `\nseed: applied=${seedResult.applied} atomicity=${seedResult.atomicity} decks=${seedResult.decks} ` +
      `slides=${seedResult.slides} unchanged=${seedResult.unchanged} skipped=${seedResult.skipped} ` +
      `failures=${seedResult.failures.length}` +
      (seedResult.commitState ? ` commitState=${seedResult.commitState}` : '')
  );

  // The manifest to report is the one the anchor made durable. The post-COMMIT
  // fallback below exists ONLY for a seed that never called the anchor — and a
  // run that lands there is failed by G10 further down, so a manifest re-signed
  // after COMMIT can never be the sole way back on a run reported as a success.
  if (anchor.persisted) {
    manifest = anchor.manifest;
  } else {
    manifest = await recoverPostStateAfterCrash({
      deps,
      manifest,
      signingKey: signing.key,
      postState: seedResult.postState,
    });
  }

  // --- Contract R5 §1/§4: the seed's own COMMIT came back AMBIGUOUS ----------
  if (seedResult.commitState === 'indeterminate') {
    return reportIndeterminateMaterialization({
      deps,
      mode,
      gatesPassed,
      manifest,
      plan,
      seedResult,
    });
  }

  // --- G8 VERDICT: `batched-fallback` is a FAILURE in --write -----------------
  // A batched fallback means the statements went out without one PostgreSQL
  // transaction behind them, i.e. exactly the all-or-nothing guarantee this tool
  // exists to provide did not hold. It is tolerable ONLY where nothing is
  // mutated — the dry run (which returned above, before the seed was called) and
  // the tests. Here, in --write, it fails closed: non-zero exit, reported as a
  // FAILED materialization, and no success wording is emitted for this run.
  if (seedResult.atomicity !== 'pinned-pg') {
    if (seedResult.failures.length > 0) {
      log('\nresult.failures (verbatim):');
      log(JSON.stringify(seedResult.failures, null, 2));
    }
    log(
      `\nFAILED — atomicity=${seedResult.atomicity}, not pinned-pg. The write did NOT run inside a ` +
        `single PostgreSQL transaction, so the all-or-nothing guarantee did not hold and the rows may ` +
        `be partially written. Roll back with:\n  npx tsx scripts/materialize-atelier-decks.ts ` +
        `--target=demo --rollback --manifest=${manifest.manifestPath}\n`
    );
    return {
      ...emptyResult(mode),
      exitCode: 1,
      abortReason:
        `G8 atomicity=${seedResult.atomicity} (expected pinned-pg). --write requires a real ` +
        `PostgreSQL transaction on one pinned client; a batched fallback is not one, so this run is ` +
        `reported as a FAILED materialization even though statements were sent.`,
      gatesPassed,
      manifest,
      plan,
      seedResult,
      failures: seedResult.failures,
    };
  }
  gatesPassed.push(`G8:seed-transaction(${seedResult.atomicity})`);

  if (seedResult.failures.length > 0) {
    log('\nresult.failures (verbatim):');
    log(JSON.stringify(seedResult.failures, null, 2));
  }

  // --- G9: read back ---------------------------------------------------------
  let verification: DeckVerificationRow[];
  try {
    const after = await deps.seed.readAtelierDeckBackup(options.organizationId);
    verification = verifyReadBack({
      organizationId: options.organizationId,
      deckIds,
      backup: after,
      plan,
      isWritableStatus: deps.isWritableStatus,
    });
  } catch (error) {
    log('\nresult.failures (verbatim):');
    log(JSON.stringify(seedResult.failures, null, 2));
    log(`\nRECOVERY ANCHOR: ${manifest.manifestPath}\n`);
    return {
      ...emptyResult(mode),
      exitCode: 1,
      abortReason: `G9 read-back failed: ${String(error)}`,
      gatesPassed,
      manifest,
      plan,
      seedResult,
      failures: seedResult.failures,
    };
  }

  const okCount = verification.filter((row) => row.ok).length;
  log(`\nG9 read-back verification (${okCount}/${verification.length}):`);
  log('  deck                                           tenant status content count  slides');
  for (const row of verification) {
    log(
      `  ${row.deckId.padEnd(46)} ${String(row.tenantOk).padEnd(6)} ${String(row.statusOk).padEnd(6)} ` +
        `${String(row.contentOk).padEnd(7)} ${String(row.countOk).padEnd(5)} ` +
        `${row.derivedCardCount ?? '-'}/${row.persistedSlideCount ?? '-'}` +
        `${row.detail ? `  <- ${row.detail}` : ''}`
    );
  }

  const failed =
    !seedResult.applied ||
    seedResult.failures.length > 0 ||
    okCount !== verification.length ||
    verification.length !== deckIds.length;

  if (failed) {
    log('\nresult.failures (verbatim):');
    log(JSON.stringify(seedResult.failures, null, 2));
    log(
      `\nFAILED. Roll back with:\n  npx tsx scripts/materialize-atelier-decks.ts ` +
        `--target=demo --rollback --manifest=${manifest.manifestPath}\n`
    );
    return {
      ...emptyResult(mode),
      exitCode: 1,
      abortReason:
        okCount !== verification.length
          ? `G9 read-back mismatch: ${okCount}/${verification.length} rows verified.`
          : 'seed reported failures.',
      gatesPassed,
      manifest,
      plan,
      seedResult,
      verification,
      failures: seedResult.failures,
    };
  }

  gatesPassed.push('G9:read-back-3-of-3');

  // --- G10a: the way back must have been durable BEFORE the COMMIT ------------
  // A manifest re-signed after the seed returns is re-signed after COMMIT, and
  // for the length of that window the database had changed while the only
  // manifest on disk carried no compare-and-swap target. That window is not
  // visible in the rows afterwards, so it cannot be checked by reading them —
  // the only evidence is whether the anchor ran. Fail closed on its absence.
  if (!anchor.persisted) {
    log(
      `\nFAILED — the rows read back clean, but no signed recovery anchor was made durable ` +
        `BEFORE the COMMIT (persistRecoveryAnchor was invoked ${anchor.attempts} time(s)` +
        `${anchor.failure ? `, last failure: ${anchor.failure}` : ''}). There was therefore a ` +
        `window in which the rows had changed and no manifest on disk could drive a rollback. ` +
        `This tool does not report a materialization whose way back was written after the fact.\n` +
        `Review the rows, then restore manually if that is the right call:\n` +
        `  psql "$DATABASE_PUBLIC_URL" -f ${manifest.rollbackSqlPath}\n`
    );
    return {
      ...emptyResult(mode),
      exitCode: 1,
      abortReason:
        `G10 no pre-COMMIT recovery anchor: the seed invoked persistRecoveryAnchor ` +
        `${anchor.attempts} time(s) and left nothing durable` +
        `${anchor.failure ? ` (${anchor.failure})` : ''}. A manifest signed after COMMIT is ` +
        `not a recovery anchor for the window it was missing from.`,
      gatesPassed,
      manifest,
      plan,
      seedResult,
      verification,
      failures: seedResult.failures,
    };
  }
  gatesPassed.push('G10a:recovery-anchor-durable-pre-commit');

  // --- G10: a materialization this tool cannot undo is not a success ----------
  // Without a post-state fingerprint in the signed manifest, `--rollback` has no
  // compare-and-swap target and REFUSES the manifest. Saying "OK" here would be
  // claiming a way back that does not exist. (Unreachable once G10a passes — the
  // anchor refuses an empty post-state — and kept as the belt to that braces.)
  if (manifest.postState.length === 0) {
    log(
      `\nFAILED — the rows read back clean, but no post-state fingerprint was recorded, so ` +
        `--rollback will refuse this manifest. This tool does not report a materialization it ` +
        `cannot undo. Restore manually after review:\n  psql "$DATABASE_PUBLIC_URL" -f ${manifest.rollbackSqlPath}\n`
    );
    return {
      ...emptyResult(mode),
      exitCode: 1,
      abortReason:
        `G10 no post-state fingerprint was captured, so the signed manifest carries no ` +
        `compare-and-swap target and --rollback would refuse it.`,
      gatesPassed,
      manifest,
      plan,
      seedResult,
      verification,
      failures: seedResult.failures,
    };
  }
  gatesPassed.push('G10:post-state-in-signed-manifest');

  log(`\nOK — ${okCount}/${verification.length} canonical decks materialized and verified.\n`);
  return { ...emptyResult(mode), gatesPassed, manifest, plan, seedResult, verification };
}

/**
 * SALVAGE ONLY — never the recovery anchor.
 *
 * Contract R5 §2 moved the real anchor INSIDE the transaction (see
 * `createRecoveryAnchor`). This function is what is left of the old post-COMMIT
 * fold, and it is now reachable on exactly two kinds of path, both of them
 * already failing:
 *
 *  - the seed THREW, so the anchor may never have run and the rows are unknown;
 *  - the seed returned without ever calling the anchor, which G10a turns into a
 *    FAILED materialization a few lines later.
 *
 * On a run this tool reports as a success it is therefore structurally incapable
 * of being the sole writer of the post-state — that is the whole point of
 * keeping it rather than deleting it. It exists because a crashed write is
 * precisely when the operator most needs *some* usable way back, and a late
 * anchor beats none; it must never be mistaken for a timely one.
 *
 * It never throws: a manifest that cannot be updated stays exactly as it was
 * written before the transaction, the failure is logged, and `--rollback` will
 * refuse it rather than guess.
 */
async function recoverPostStateAfterCrash(params: {
  deps: MaterializeDeps;
  manifest: RollbackManifest;
  signingKey: ManifestSigningKey;
  postState?: AtelierDeckPostState[] | null;
}): Promise<RollbackManifest> {
  const { deps, manifest, signingKey } = params;
  let postState = params.postState ?? null;
  try {
    if (!Array.isArray(postState) || postState.length === 0) {
      postState = await deps.seed.readAtelierDeckPostState(manifest.organizationId);
    }
    if (!Array.isArray(postState) || postState.length === 0) {
      deps.log(
        `\nWARNING: no post-state fingerprint was captured. The signed manifest keeps its ` +
          `pre-write content, and --rollback will REFUSE it (no compare-and-swap target). ` +
          `Restore manually after review: psql "$DATABASE_PUBLIC_URL" -f ${manifest.rollbackSqlPath}`
      );
      return manifest;
    }

    const updated: RollbackManifest = { ...manifest, postState };
    const envelope = signManifest(updated, signingKey);
    writeDurableFile(deps.fs, {
      directory: path.dirname(manifest.manifestPath),
      filePath: manifest.manifestPath,
      contents: serializeSignedManifest(envelope),
      nonce: `poststate-${manifestTimestamp(deps.now())}`,
    });
    deps.log(
      `\nLATE post-state fingerprint for ${postState.length} deck id(s) folded into the SIGNED ` +
        `manifest AFTER the transaction closed (salvage, NOT a pre-COMMIT recovery anchor):\n` +
        `  ${manifest.manifestPath}`
    );
    return updated;
  } catch (error) {
    deps.log(
      `\nWARNING: could not record the post-state fingerprint (${String(error)}). The signed ` +
        `manifest keeps its pre-write content, and --rollback will REFUSE it. ` +
        `Restore manually after review: psql "$DATABASE_PUBLIC_URL" -f ${manifest.rollbackSqlPath}`
    );
    return manifest;
  }
}

// ---------------------------------------------------------------------------
// Contract R5 §4/§5 — reporting an outcome nobody knows
// ---------------------------------------------------------------------------

/**
 * The header both ambiguous paths share. It exists as one function so the two
 * reports cannot drift into different levels of candour, and so the banned
 * vocabulary has exactly one place it could ever creep back into.
 */
function logIndeterminateHeader(log: (m: string) => void, what: string): void {
  log(
    `\n**************************************************************************\n` +
      `**** OUTCOME INDETERMINATE — OPERATOR ACTION REQUIRED                  ****\n` +
      `**************************************************************************\n` +
      `${what}\n` +
      `An error raised by COMMIT is not evidence that COMMIT did not happen: if the ` +
      `connection dies after COMMIT was sent, PostgreSQL may have committed and only the ` +
      `acknowledgement was lost. This tool therefore states what it OBSERVED and nothing more.`
  );
}

function logIndeterminateFooter(
  log: (m: string) => void,
  manifest: RollbackManifest,
  instruction: string
): void {
  log(`\nSIGNED MANIFEST (the recovery anchor for this run):\n  ${manifest.manifestPath}`);
  log(`Manual restore SQL, for review — do not apply it before reading the rows:\n  ${manifest.rollbackSqlPath}`);
  log(`\nWHAT TO DO:\n${instruction}`);
  log(`\n${DO_NOT_RERUN_BLIND_WARNING}\n`);
}

/** The one read-the-rows command every ambiguous instruction opens with. */
function readTheRowsCommand(manifest: RollbackManifest): string {
  return (
    `psql "$DATABASE_PUBLIC_URL" -c "SELECT id, organization_id, version, slide_count, status, ` +
    `updated_at FROM presentation_decks WHERE id IN (${manifest.deckIds
      .map((id) => `'${id}'`)
      .join(', ')});"`
  );
}

/**
 * R5b §C2 — the wording of ONE of the three ambiguous readings. Kept as data so
 * the three cases cannot quietly converge on a single vague paragraph, which is
 * how "we don't know" turns back into "nothing happened".
 */
interface IndeterminateVerdictCopy {
  /** The sentence in the banner: what the executor did and what the re-read saw. */
  headline: string;
  /** What that reading does and does not license. */
  finding: string;
  /** The ordered operator instruction. */
  instruction: string;
  /** The machine-facing summary, on `abortReason`. */
  abortReason: string;
}

function indeterminateVerdictCopy(params: {
  verdict: RollbackIndeterminateVerdict;
  outcome: RollbackIndeterminate;
  manifest: RollbackManifest;
}): IndeterminateVerdictCopy {
  const { outcome, manifest } = params;
  const readRows = readTheRowsCommand(manifest);
  const manifestBlocks =
    `the signed manifest ("backup" = the pre-state the rollback is trying to restore, ` +
    `"postState" = what the materialization wrote)`;

  if (params.verdict === 'not-applied') {
    return {
      headline:
        `The transactional rollback executor dispatched COMMIT for the restore and never received ` +
        `its answer. A reconciling read, on a fresh connection, then found EVERY deck row still ` +
        `carrying the post-materialization state: ${outcome.reason}`,
      finding:
        `\nWHAT THAT READING LICENSES — AND WHAT IT DOES NOT:\n` +
        `  · Every deck below reads as the state the MATERIALIZATION wrote. The most likely\n` +
        `    reading is therefore that the restore did not land.\n` +
        `  · That is a reading of ROWS, not a verdict on the transaction. The COMMIT was\n` +
        `    dispatched and its answer never arrived, so this tool does not know what the server\n` +
        `    decided, and the executor rolled nothing back — there was nothing left to roll back\n` +
        `    once COMMIT was on the wire. A restore that committed just after the reconciling\n` +
        `    read would look exactly like this from here.\n` +
        `  · Recovery is therefore a COMPLETE new --rollback run: target preflight, advisory lock\n` +
        `    and the compare-and-swap against the manifest post-state. The CAS is what makes a\n` +
        `    second attempt legitimate — it refuses unless the rows are still exactly what this\n` +
        `    reading saw. Re-issuing the restore write on its own skips that check.`,
      instruction:
        `  1. Read the rows yourself, on a connection of your own:\n` +
        `       ${readRows}\n` +
        `  2. Compare each one with ${manifestBlocks}.\n` +
        `  3. If they still read as "postState", re-run the WHOLE rollback command deliberately —\n` +
        `     same --target preflight, same --manifest — so the advisory lock and the\n` +
        `     compare-and-swap run again. Never re-issue the restore write alone, and never patch\n` +
        `     the rows by hand to "finish" it.\n` +
        `  4. If they read as the manifest "backup" block instead, the restore landed after all:\n` +
        `     record that and run nothing further.\n` +
        `  5. If they read as neither, stop and escalate — a third writer is in play.`,
      abortReason:
        `R6 rollback outcome INDETERMINATE (stage=${outcome.stage}, verdict=not-applied): ` +
        `${outcome.reason} The COMMIT was dispatched and its answer never arrived, so this tool ` +
        `has no verdict on the transaction; what it has is a fresh read in which every deck still ` +
        `carries the post-materialization state, which is how a restore that did not land reads. ` +
        `Recover by re-running the COMPLETE rollback — target preflight, advisory lock and ` +
        `compare-and-swap — never the restore write on its own.`,
    };
  }

  if (params.verdict === 'mixed') {
    return {
      headline:
        `The transactional rollback executor dispatched COMMIT for the restore and never received ` +
        `its answer. A reconciling read, on a fresh connection, then found the deck rows in ` +
        `DIFFERENT states — some at the pre-state, some not — so there is no single reading of ` +
        `this run: ${outcome.reason}`,
      finding:
        `\nWHAT THAT READING LICENSES — AND WHAT IT DOES NOT:\n` +
        `  · The decks below do not agree with one another. A restore is all-or-nothing by\n` +
        `    construction, so a split reading is evidence that something other than this\n` +
        `    transaction has touched these rows, or that they were read while still moving.\n` +
        `  · It licenses no next action. Re-running the rollback and re-materializing would both\n` +
        `    take this disagreement as their starting point.\n` +
        `  · ESCALATE, do not act: get a second person onto the rows and onto who else writes\n` +
        `    presentation_decks for this tenant, BEFORE any further write of any kind.`,
      instruction:
        `  1. Read the rows yourself, on a connection of your own:\n` +
        `       ${readRows}\n` +
        `  2. Compare each one with ${manifestBlocks}, and write down, per deck, which it is.\n` +
        `  3. Then stop and escalate. Do not run this tool again in either direction until a\n` +
        `     human has decided what the intended state of each deck is; the disagreement, not\n` +
        `     the ambiguity, is the thing that has to be explained first.\n` +
        `  4. Only once that decision is written down should anyone touch these rows, and then\n` +
        `     through a deliberate reviewed command — not by re-running this one on a hunch.`,
      abortReason:
        `R6 rollback outcome INDETERMINATE (stage=${outcome.stage}, verdict=mixed): ` +
        `${outcome.reason} The COMMIT was dispatched and its answer never arrived, and the ` +
        `reconciling read found the decks in different states, so this tool makes no claim about ` +
        `the rows in either direction. A human must read them and escalate; this is not a state ` +
        `to act on.`,
    };
  }

  return {
    headline:
      `The transactional rollback executor dispatched COMMIT for the restore, never received its ` +
      `answer, and the reconciling read could not establish the state of the rows AT ALL: ` +
      `${outcome.reason}`,
    finding:
      `\nWHAT THAT READING LICENSES — AND WHAT IT DOES NOT:\n` +
      `  · Nothing below is a statement about what the rows contain. The reconciliation produced\n` +
      `    no usable reading, so this tool knows neither that the restore landed nor that it did\n` +
      `    not.\n` +
      `  · Rule this cause out FIRST: the in-doubt transaction may still be HOLDING the advisory\n` +
      `    lock, which means it has not finished. The reconciling connection takes that same lock\n` +
      `    before reading, and when it cannot get it the transaction is still live and undecided —\n` +
      `    there is nothing yet to read, and the rows can still change without anyone touching\n` +
      `    them. Wait for it to end.\n` +
      `  · The other causes read identically from here: the database was unreachable, the read\n` +
      `    timed out, or the rows could not be selected.\n` +
      `  · Until a reading exists there must be no further write of any kind — not this rollback,\n` +
      `    not a re-run of the materialization, not a manual UPDATE.`,
    instruction:
      `  1. First establish whether the in-doubt transaction has ENDED:\n` +
      `       psql "$DATABASE_PUBLIC_URL" -c "SELECT pid, state, wait_event_type, xact_start, query FROM pg_stat_activity WHERE datname = current_database() AND state <> 'idle';"\n` +
      `       psql "$DATABASE_PUBLIC_URL" -c "SELECT locktype, objid, pid, granted FROM pg_locks WHERE locktype = 'advisory';"\n` +
      `     If a backend still holds an advisory lock for this tenant, WAIT for it. Do not cancel\n` +
      `     or kill it on a hunch: a COMMIT the server accepted and one it aborted leave different\n` +
      `     rows behind, and killing the backend does not tell you which happened.\n` +
      `  2. Once no such backend remains, read the rows:\n` +
      `       ${readRows}\n` +
      `  3. Compare each one with ${manifestBlocks}.\n` +
      `  4. If they read as the "backup" block, the restore landed. If they read as "postState",\n` +
      `     re-run the WHOLE rollback command deliberately — target preflight, advisory lock and\n` +
      `     compare-and-swap included — never the restore write alone.\n` +
      `  5. If they read as neither, or still cannot be read, stop and escalate.`,
    abortReason:
      `R6 rollback outcome INDETERMINATE (stage=${outcome.stage}, verdict=unreadable): ` +
      `${outcome.reason} The COMMIT was dispatched, its answer never arrived, and the reconciling ` +
      `read could not establish the state of the rows at all — including the case where the ` +
      `in-doubt transaction still holds the advisory lock and has therefore not finished. This ` +
      `tool makes no claim about the rows in either direction. A human must read them once that ` +
      `transaction has ended.`,
  };
}

/**
 * Contract R5 §3/§5 + R5b §C2 — the rollback executor sent COMMIT and never
 * learned whether it took. Print what a fresh connection actually saw, per deck
 * id, word the specific reading it produced, and refuse to summarise any of it
 * into one of the comfortable sentences.
 */
function reportIndeterminateRollback(params: {
  deps: MaterializeDeps;
  mode: MaterializeMode;
  gatesPassed: string[];
  manifest: RollbackManifest;
  outcome: RollbackIndeterminate;
}): MaterializeRunResult {
  const { deps, manifest, outcome } = params;
  const { log } = deps;
  const { verdict, declared } = resolveIndeterminateVerdict(outcome);
  const copy = indeterminateVerdictCopy({ verdict, outcome, manifest });

  logIndeterminateHeader(log, copy.headline);
  log(
    `\nRECONCILIATION VERDICT: ${verdict}` +
      (declared
        ? ''
        : `  (DERIVED by this tool from the observations below — the executor reported the ` +
          `ambiguity without naming a reading.)`)
  );

  log(`\nCURRENT state of each deck row, read on a FRESH connection after the ambiguous COMMIT:`);
  if (outcome.observed.length === 0) {
    log(
      `  (the executor reported NO per-deck observations — the reconciling re-read did not ` +
        `produce a reading for any deck id, so nothing at all is known about the rows.)`
    );
  } else {
    for (const observation of outcome.observed) {
      log(`  ${observation.deckId.padEnd(46)} ${observation.matches}`);
    }
  }
  log(
    `\n  pre-state  = the row matches the manifest backup, i.e. the restore DID take effect there\n` +
      `  post-state = the row still matches what the materialization wrote, i.e. it did not\n` +
      `  neither    = the row holds something else; a third party may have written it\n` +
      `  unreadable = the row could not be read at all; its content is unknown`
  );

  const perDeck = summarizeObservations(outcome.observed);
  log(`\ncounts: ${perDeck}`);
  log(copy.finding);

  logIndeterminateFooter(log, manifest, copy.instruction);

  return {
    ...emptyResult(params.mode),
    exitCode: 1,
    gatesPassed: params.gatesPassed,
    manifest,
    restored: false,
    needsOperator: true,
    rollbackObserved: outcome.observed,
    rollbackVerdict: verdict,
    abortReason: copy.abortReason,
  };
}

/**
 * Contract R5 §1/§4 — the same discipline for a MATERIALIZATION whose own COMMIT
 * came back ambiguous. Reachable only when the seed reports `commitState:
 * 'indeterminate'`; a seed that does not report a commit state never lands here,
 * and the tool never infers one.
 */
function reportIndeterminateMaterialization(params: {
  deps: MaterializeDeps;
  mode: MaterializeMode;
  gatesPassed: string[];
  manifest: RollbackManifest;
  plan: AtelierDeckPlanEntry[];
  seedResult: SeedAtelierPresentationDecksResult;
}): MaterializeRunResult {
  const { deps, manifest, seedResult } = params;
  const { log } = deps;

  logIndeterminateHeader(
    log,
    `The seed reports commitState=indeterminate: it sent COMMIT for the deck write and never ` +
      `learned whether the server applied it.`
  );

  log(
    `\nThe rows are in ONE of two states and this process cannot tell which:\n` +
      `  a) the write committed — the rows carry the ${seedResult.postState.length} post-state ` +
      `fingerprint(s) recorded in the signed manifest;\n` +
      `  b) the write did not commit — the rows are still the pre-state captured in that same ` +
      `manifest's backup.`
  );
  if (seedResult.postState.length > 0) {
    log(`\npost-state fingerprint the write would have produced, per deck id:`);
    for (const entry of seedResult.postState) {
      log(
        `  ${entry.deckId.padEnd(46)} ${entry.state} v${entry.version ?? '-'} ` +
          `slides=${entry.slideCount ?? '-'} status=${entry.status ?? '-'} ` +
          `updatedAt=${entry.updatedAt ?? '-'}`
      );
    }
  }
  if (seedResult.failures.length > 0) {
    log('\nresult.failures (verbatim):');
    log(JSON.stringify(seedResult.failures, null, 2));
  }

  logIndeterminateFooter(
    log,
    manifest,
    `  1. Read the three rows yourself:\n` +
      `       psql "$DATABASE_PUBLIC_URL" -c "SELECT id, organization_id, version, slide_count, status, updated_at FROM presentation_decks WHERE id IN (${manifest.deckIds
        .map((id) => `'${id}'`)
        .join(', ')});"\n` +
      `  2. Compare version/slide_count/status/updated_at with the post-state block printed above.\n` +
      `  3. If they match the post-state, the write committed: verify it is what you wanted, and\n` +
      `     use --rollback if it is not.\n` +
      `  4. If they match the manifest backup, the write did not commit: you may re-run --write\n` +
      `     DELIBERATELY, having confirmed that by hand.\n` +
      `  5. If they match neither, stop and escalate.`
  );

  return {
    ...emptyResult(params.mode),
    exitCode: 1,
    gatesPassed: params.gatesPassed,
    manifest,
    plan: params.plan,
    seedResult,
    failures: seedResult.failures,
    needsOperator: true,
    abortReason:
      `G8 materialization COMMIT outcome INDETERMINATE: the seed sent COMMIT and never learned ` +
      `whether it took effect, so this tool makes no claim about the rows in either direction. ` +
      `A human must read them.`,
  };
}

function summarizeObservations(observed: RollbackObservation[]): string {
  const counts = new Map<RollbackObservedMatch, number>();
  for (const observation of observed) {
    counts.set(observation.matches, (counts.get(observation.matches) ?? 0) + 1);
  }
  if (counts.size === 0) return '0 deck id(s) observed';
  return [...counts.entries()].map(([match, count]) => `${count} ${match}`).join(', ');
}

async function assertNoActiveEditors(params: {
  deps: MaterializeDeps;
  organizationId: string;
  deckIds: string[];
  seedOwnedDeckIds: string[];
  gate: string;
}): Promise<string | null> {
  let signals: ActiveEditorSignal[];
  try {
    signals = await detectActiveEditors({
      db: params.deps.db,
      organizationId: params.organizationId,
      deckIds: params.deckIds,
      seedOwnedDeckIds: params.seedOwnedDeckIds,
      now: params.deps.now(),
      log: params.deps.log,
    });
  } catch (error) {
    return `${params.gate} could not prove the decks are idle: ${String(error)}`;
  }
  if (signals.length === 0) return null;
  params.deps.log(`\n${params.gate} active-editor evidence:`);
  for (const signal of signals) {
    params.deps.log(`  [${signal.source}] ${signal.deckId}: ${signal.detail}`);
  }
  return (
    `${params.gate} ${signals.length} active-editor signal(s) inside the last ` +
    `${ACTIVE_EDITOR_WINDOW_MINUTES} minutes. Someone is mid-edit; refusing to touch the rows.`
  );
}

// ---------------------------------------------------------------------------
// Rollback
// ---------------------------------------------------------------------------

export async function runRollbackAtelierDecks(
  options: MaterializeOptions,
  deps: MaterializeDeps
): Promise<MaterializeRunResult> {
  const mode: MaterializeMode = 'rollback';
  const gatesPassed: string[] = [];
  const { log } = deps;

  log('\nmaterialize-atelier-decks — ROLLBACK from a signed manifest');
  log(`environment:  ${options.targetEnvironment || '<unset>'}`);
  log(`organization: ${options.organizationId}`);
  log(`manifest:     ${options.manifestPath ?? '<unset>'}`);

  if (!options.manifestPath) {
    return abort(mode, gatesPassed, 'R0 --rollback requires --manifest=<path to manifest.json>.', log);
  }

  // --- R1: THE SAME preflight as the write path ------------------------------
  const preflight = await runTargetPreflight(options, deps, gatesPassed);
  if (!preflight.ok) {
    return abort(mode, gatesPassed, preflight.reason ?? 'target preflight refused', log, {
      targetRefusals: preflight.refusals,
    });
  }
  gatesPassed.push('R1:same-preflight-as-write');

  // --- R2: signature ---------------------------------------------------------
  const signing = readManifestSigningKey(deps.env);
  if (!signing.key) {
    return abort(mode, gatesPassed, `R2 manifest cannot be verified: ${signing.error}`, log);
  }
  let contents: string;
  try {
    contents = deps.fs.readTextFile(options.manifestPath);
  } catch (error) {
    return abort(mode, gatesPassed, `R2 could not read the manifest: ${String(error)}`, log);
  }
  const verified = verifyManifestEnvelope(contents, signing.key);
  if (!verified.ok) {
    return abort(mode, gatesPassed, `R2 manifest rejected: ${verified.reason}`, log);
  }
  const manifest = verified.manifest;
  gatesPassed.push(`R2:hmac-verified(keyId=${signing.key.keyId})`);

  // --- R3: the target must be the SAME target --------------------------------
  if (manifest.target?.digest !== preflight.digest) {
    return abort(
      mode,
      gatesPassed,
      `R3 target fingerprint CHANGED since the manifest was written. ` +
        `manifest digest=${manifest.target?.digest ?? '<none>'} live digest=${preflight.digest}. ` +
        `Restoring one environment's rows into another is exactly the accident this refuses.`,
      log,
      { manifest }
    );
  }
  gatesPassed.push('R3:target-fingerprint-unchanged');

  // --- R4: preconditions still hold ------------------------------------------
  if (manifest.organizationId !== options.organizationId) {
    return abort(
      mode,
      gatesPassed,
      `R4 manifest is for organization "${manifest.organizationId}" but this run targets ` +
        `"${options.organizationId}".`,
      log,
      { manifest }
    );
  }
  if (!manifest.backup?.complete || incompleteBackupEntries(manifest.backup).length > 0) {
    return abort(
      mode,
      gatesPassed,
      `R4 manifest carries an INCOMPLETE backup; it cannot restore a pre-state it never captured.`,
      log,
      { manifest }
    );
  }
  if (!manifest.rollbackSql || !manifest.rollbackSql.trim()) {
    return abort(mode, gatesPassed, 'R4 manifest carries no rollback SQL.', log, { manifest });
  }
  // R4b: no post-state fingerprint => no compare-and-swap target. Manifests
  // written before the transactional executor existed land here. Restoring from
  // one would mean UPDATEing rows nobody checked, on the assumption that they
  // are still what the write produced. Refuse instead of guessing.
  const expectedPostState = manifest.postState;
  if (!Array.isArray(expectedPostState) || expectedPostState.length === 0) {
    return abort(
      mode,
      gatesPassed,
      `R4 manifest carries no postState fingerprint, so there is nothing to compare the live rows ` +
        `against. A rollback without a compare-and-swap target would overwrite whatever is there now. ` +
        `(Manifests written before the transactional rollback executor have this shape.) ` +
        `Review the rows and, if the pre-state really is the right thing to restore, apply the SQL ` +
        `by hand: psql "$DATABASE_PUBLIC_URL" -f ${manifest.rollbackSqlPath}`,
      log,
      { manifest }
    );
  }
  const foreignRows = manifest.backup.entries.filter(
    (entry) => entry.row && entry.row.organization_id && entry.row.organization_id !== options.organizationId
  );
  if (foreignRows.length > 0) {
    return abort(
      mode,
      gatesPassed,
      `R4 manifest captured ${foreignRows.length} row(s) owned by another tenant ` +
        `(${foreignRows.map((entry) => `${entry.deckId}->${entry.row?.organization_id}`).join(', ')}). Refusing.`,
      log,
      { manifest }
    );
  }
  // The active-editor preflight is an ADDITIONAL gate, not the concurrency
  // control. It runs before the transaction, over its own connection, so by the
  // time the restore begins its answer is already stale — a presenter can open a
  // deck in the gap. What actually serializes this restore against a concurrent
  // writer is `pg_advisory_xact_lock` inside the executor, and what actually
  // proves the rows are still the ones this run produced is the CAS against
  // `expectedPostState`. This check is here to refuse EARLY and loudly (with the
  // human-readable evidence of who is editing) in the common case, so the
  // operator is not told about a collision only after a transaction rolled back.
  const idleAbort = await assertNoActiveEditors({
    deps,
    organizationId: options.organizationId,
    deckIds: manifest.deckIds,
    seedOwnedDeckIds: [],
    gate: 'R4',
  });
  if (idleAbort) return abort(mode, gatesPassed, idleAbort, log, { manifest });
  gatesPassed.push('R4:preconditions-hold');

  // --- R5: confirmation ------------------------------------------------------
  const confirmationAbort = assertConfirmationToken(
    deps.env,
    ROLLBACK_CONFIRM_ENV,
    ROLLBACK_CONFIRM_VALUE,
    'R5'
  );
  if (confirmationAbort) return abort(mode, gatesPassed, confirmationAbort, log, { manifest });
  gatesPassed.push('R5:confirmation-token');

  // --- R6: restore, through the ONE transactional executor --------------------
  // This tool no longer executes SQL of its own. The restore is a single call
  // into the seed's executor, which does lock -> re-read -> CAS -> restore ->
  // read-back -> COMMIT on one pinned client, and ROLLBACKs that same client on
  // any failure. Every failure comes back as a named stage; it never throws.
  let outcome: RollbackOutcome;
  try {
    outcome = await deps.seed.rollbackAtelierDecksOnPinnedClient({
      organizationId: options.organizationId,
      backup: manifest.backup,
      expectedPostState,
    });
  } catch (error) {
    // The executor is contractually non-throwing; if it throws anyway, treat it
    // as a failed restore rather than letting the process die mid-report.
    return abort(
      mode,
      gatesPassed,
      `R6 rollback executor threw, which its contract forbids: ${String(error)}. Nothing is ` +
        `claimed about the rows — a throw is not evidence that the transaction was discarded, ` +
        `since a connection that dies with COMMIT in flight throws here too. Read the rows ` +
        `against the manifest (${manifest.manifestPath}) before doing anything else. ` +
        DO_NOT_RERUN_BLIND_WARNING,
      log,
      { manifest }
    );
  }

  // The AMBIGUOUS outcome is handled FIRST and separately. Every sentence below
  // it — "did NOT restore", "rolled its own transaction back", "nothing was
  // changed" — is true only because the executor stopped BEFORE COMMIT, which is
  // exactly what `stage: 'indeterminate'` denies. Falling through to that wording
  // is the specific lie this branch exists to prevent.
  if (isIndeterminateRollback(outcome)) {
    return reportIndeterminateRollback({ deps, mode, gatesPassed, manifest, outcome });
  }

  // R5b §C2 — and the label alone is not trusted. `observed[]`/`needsOperator`
  // exist only because a reconciling re-read ran, and that read only runs after a
  // COMMIT whose answer never came back. An executor that ships that evidence
  // under a determinate stage (the pre-R5b seed labelled the all-post reading
  // `'write'`) would otherwise buy the determinate wording for a database it never
  // got an answer from. Report it for what it is instead.
  if (!outcome.ok && carriesReconciliationEvidence(outcome)) {
    const mislabelled = outcome as unknown as Partial<RollbackIndeterminate>;
    return reportIndeterminateRollback({
      deps,
      mode,
      gatesPassed,
      manifest,
      outcome: {
        ok: false,
        restored: false,
        stage: ROLLBACK_INDETERMINATE_STAGE,
        needsOperator: true,
        verdict: mislabelled.verdict,
        observed: Array.isArray(mislabelled.observed) ? mislabelled.observed : [],
        reason:
          `the executor labelled this outcome stage="${outcome.stage}", yet it carries the ` +
          `per-deck reconciliation evidence that only a re-read AFTER an unanswered COMMIT can ` +
          `produce. A determinate stage would license the claim that the transaction never ` +
          `reached COMMIT; on this path it was dispatched, so that claim is refused and the ` +
          `outcome is reported for what it is — ambiguous. Executor reason: ${outcome.reason}`,
      },
    });
  }

  if (!outcome.ok) {
    return abort(
      mode,
      gatesPassed,
      // LICENSED, and only here. Every determinate stage means the transaction
      // never committed, on one of four provable paths: the executor's own
      // ROLLBACK after the body threw (`lock`/`cas`/`write`/`readback`); a COMMIT
      // that was never put on the wire because the connection had already failed;
      // a COMMIT the SERVER rejected with a SQLSTATE that can only mean it aborted
      // the transaction; or no transaction at all (`unavailable`, a failed BEGIN).
      // The rows are as they were on all four. The parenthesis is there because
      // only the first path is literally the executor rolling itself back.
      `R6 transactional rollback did NOT restore (stage=${outcome.stage}): ${outcome.reason} ` +
        `The executor rolled its own transaction back, so nothing was changed. ` +
        `(On this stage the transaction provably never committed — it was rolled back by the ` +
        `executor, aborted by the server at COMMIT, or never begun — so the rows are as they ` +
        `were before this command ran.) ` +
        `Manual path, after review: psql "$DATABASE_PUBLIC_URL" -f ${manifest.rollbackSqlPath}`,
      log,
      { manifest }
    );
  }

  gatesPassed.push('R6:restored(pinned-pg,cas)');
  log(
    `\nRESTORED ${outcome.rows.length} deck row(s) from ${manifest.manifestPath} ` +
      `(locked, compare-and-swapped against the manifest post-state, read back inside the ` +
      `transaction).\n`
  );
  return { ...emptyResult(mode), gatesPassed, manifest, restored: true };
}

// ---------------------------------------------------------------------------
// Default (real) dependencies — dynamically imported so tests stay hermetic.
// ---------------------------------------------------------------------------

/**
 * Fail LOUDLY (not silently) if the seed module on disk does not implement the
 * frozen MAT-006B contract. Without this, a stale module would make the tool
 * crash deep inside the run with an opaque "not a function".
 */
const REQUIRED_SEED_EXPORTS = [
  'ATELIER_DECK_SLUGS',
  'atelierDeckId',
  'planAtelierPresentationDecks',
  'seedAtelierPresentationDecks',
  'readAtelierDeckBackup',
  'buildRollbackSql',
  // Contract R4: without these two there is no CAS target and no transactional
  // restore, so the tool would be back to firing SQL and hoping.
  'readAtelierDeckPostState',
  'rollbackAtelierDecksOnPinnedClient',
] as const;

export function assertSeedModuleContract(seed: Record<string, unknown>): AtelierDeckSeedModule {
  const missing = REQUIRED_SEED_EXPORTS.filter((name) => seed[name] === undefined);
  if (missing.length > 0) {
    throw new Error(
      `atelierPresentationDeckSeed.ts does not implement the MAT-006B contract. ` +
        `Missing export(s): ${missing.join(', ')}. Refusing to run.`
    );
  }
  if (!Array.isArray(seed.ATELIER_DECK_SLUGS) || seed.ATELIER_DECK_SLUGS.length === 0) {
    throw new Error('ATELIER_DECK_SLUGS is not a non-empty array. Refusing to run.');
  }
  return seed as unknown as AtelierDeckSeedModule;
}

/** The real syscall seam. 0700 directories, 0600 files, O_EXCL temp files. */
export function createNodeManifestFsSeam(): ManifestFsSeam {
  return {
    mkdirSecure: (dirPath, mode) => {
      fs.mkdirSync(dirPath, { recursive: true, mode });
      // `recursive: true` does not re-apply the mode to a directory that already
      // exists (nor, on some platforms, past the umask). Say what we mean.
      fs.chmodSync(dirPath, mode);
    },
    // 'wx' => O_CREAT|O_EXCL: never follow or clobber something already there.
    openForWrite: (filePath, mode) => fs.openSync(filePath, 'wx', mode),
    writeAll: (fd, contents) => {
      const buffer = Buffer.from(contents, 'utf8');
      let offset = 0;
      while (offset < buffer.length) {
        offset += fs.writeSync(fd, buffer, offset, buffer.length - offset);
      }
    },
    fsyncFile: (fd) => fs.fsyncSync(fd),
    closeFile: (fd) => fs.closeSync(fd),
    renameFile: (fromPath, toPath) => fs.renameSync(fromPath, toPath),
    fsyncDirectory: (dirPath) => {
      const dirFd = fs.openSync(dirPath, 'r');
      try {
        fs.fsyncSync(dirFd);
      } finally {
        fs.closeSync(dirFd);
      }
    },
    readTextFile: (filePath) => fs.readFileSync(filePath, 'utf8'),
  };
}

export async function createDefaultDeps(): Promise<MaterializeDeps> {
  const [{ logSelectedDatabaseTarget, resolveScriptDatabaseTarget }, dbPromise, template, seed] =
    await Promise.all([
      import('./lib/scriptDatabaseTarget.js'),
      import('../src/utils/DbPromise.js'),
      import('../src/services/demo/atelierPresentationDeckTemplate.js'),
      import('../src/services/demo/atelierPresentationDeckSeed.js'),
    ]);

  return {
    seed: assertSeedModuleContract(seed as unknown as Record<string, unknown>),
    db: {
      all: (sql, params) => dbPromise.all(sql, params ?? []),
      tableExists: (tableName) => dbPromise.tableExists(tableName),
    },
    isWritableStatus: (status: string) => template.isDbWritableDeckStatus(status),
    resolveTarget: ({ requireExplicitTarget }) => {
      const resolved = resolveScriptDatabaseTarget({
        label: 'materialize-atelier-decks',
        databaseUrl: process.env.DATABASE_URL,
        publicDatabaseUrl: process.env.DATABASE_PUBLIC_URL,
        requireExplicitTarget,
      });
      // The seed reads DATABASE_URL through DbPromise; align it with what we resolved.
      process.env.DATABASE_URL = resolved.connectionString;
      logSelectedDatabaseTarget('materialize-atelier-decks', resolved);
      return resolved;
    },
    env: process.env,
    now: () => new Date(),
    fs: createNodeManifestFsSeam(),
    log: (message) => console.log(message),
    // There is deliberately NO generic write seam here any more. The write goes
    // through the seed's transaction and the restore goes through the seed's
    // transactional executor, so this process is structurally incapable of
    // executing arbitrary SQL in either mode.
  };
}

async function main(): Promise<void> {
  const options = parseMaterializeArgs(process.argv.slice(2));
  const deps = await createDefaultDeps();
  const result = await runMaterializeAtelierDecks(options, deps);
  process.exit(result.exitCode);
}

const invokedDirectly = (() => {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return path.resolve(entry) === path.resolve(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
})();

if (invokedDirectly) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
