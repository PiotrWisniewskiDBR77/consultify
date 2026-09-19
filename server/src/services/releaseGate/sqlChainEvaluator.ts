/**
 * The single evaluator for "is the SQL migration chain in an acceptable state".
 *
 * ONE implementation, used by all four consumers:
 *   - server/scripts/release-migration-gate.ts   (pre-deploy)
 *   - server/src/startup/databaseReadiness.ts     (startup, once)
 *   - /api/ready and /api/health/migrations       (serve the stored receipt)
 *   - tests
 *
 * A second, divergent copy of this logic is exactly the defect class this wave exists to remove:
 * the release gate's first draft computed "pending" from a raw directory listing and reported 212
 * phantom pending migrations, because the runner deliberately skips legacy/seed/SQLite-only files.
 *
 * Cost note: this reads the migrations directory and two small ledger queries. It is cheap enough
 * to run once at startup, but it is NOT a per-request operation — readiness computes it during
 * boot, stores the receipt, and endpoints serve that receipt.
 */
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

import {
  POSTCONDITION_ATTESTATIONS,
  attestPartnerUsersUuidVariant,
  type AttestationQueryable,
  type AttestationResult,
} from './schemaAttestation.js';
import { classifyMigrationChecksum, fileChecksum } from '../tablePlatform/migrationIdentity.js';
import { attestTablePlatformPresentWithoutHistory } from './tablePlatformPresentWithoutHistory.js';
import { isExecutableMigration } from './migrationExecutionPolicy.js';
import { classifySqlChainChecksum } from './sqlChainChecksumPolicy.js';

export type SqlChainState =
  | 'ok'
  | 'ledger_missing'
  | 'failed'
  | 'skipped'
  | 'pending'
  | 'unexplained_drift'
  | 'attestation_failed'
  | 'error';

export interface SqlChainEvaluation {
  state: SqlChainState;
  ledgerPresent: boolean;
  failed: string[];
  /** rows recorded 'skipped' — a skipped row means the migration did not actually apply */
  skipped: string[];
  /** executable migrations on disk with no successful ledger row */
  pending: string[];
  /** drift that no reviewed (stored,current) pair explains */
  unexplainedDrift: string[];
  /** accepted via the exact per-file allowlist */
  approvedVariants: string[];
  /** approved files that ALSO had to re-prove their live schema shape */
  postconditionVerified: string[];
  /** accepted only after live schema postconditions were re-proven */
  attestedLegacyVariants: string[];
  /** applied rows with no stored checksum at all (legacy rows; reported, never fatal) */
  unverifiable: string[];
  detail: string;
}

type WarnFn = (message?: unknown, ...optionalParams: unknown[]) => void;

export interface SqlChainEvaluatorDeps {
  db: AttestationQueryable;
  migrationsDir: string;
  /** override for tests; defaults to the real attestation */
  attest?: (db: AttestationQueryable) => Promise<AttestationResult>;
  /** override for tests; defaults to console.warn */
  warn?: WarnFn;
}

const RUNNABLE_MIGRATION_EXTENSIONS_RE = /\.(sql|js|ts)$/;
const SKIPPED_LEDGER_CHECKSUM_RE = /^skipped:([0-9a-f]{64})$/;

function addHistoricalMigrationFiles(
  migrationsDir: string,
  checksums: Map<string, { full: string; short: string }>
): void {
  const historicalDir = path.join(migrationsDir, 'never-ran');
  if (!fs.existsSync(historicalDir)) return;
  for (const entry of fs.readdirSync(historicalDir, { withFileTypes: true })) {
    if (!entry.isFile() || !RUNNABLE_MIGRATION_EXTENSIONS_RE.test(entry.name)) continue;
    const rel = `never-ran/${entry.name}`;
    const content = fs.readFileSync(path.join(historicalDir, entry.name), 'utf-8');
    const checksum = {
      full: crypto.createHash('sha256').update(content).digest('hex'),
      short: fileChecksum(content),
    };
    checksums.set(rel, checksum);
    // Older schema_migrations rows used the basename because the file used to
    // live at server/migrations/<name>. Once archived under never-ran/, it is
    // still historical ledger evidence and still checksum-verifiable.
    if (!checksums.has(entry.name)) checksums.set(entry.name, checksum);
  }
}

function warnSkippedLedgerDrift(
  filename: string,
  stored: string | null,
  current: string | undefined,
  warn: WarnFn
): void {
  if (!stored || !current) return;
  const match = SKIPPED_LEDGER_CHECKSUM_RE.exec(stored);
  if (!match) return;
  if (match[1] === current) return;
  warn(
    `[sqlChainEvaluator] skipped migration checksum drift: ${filename} ledger checksum ${stored} ` +
      `does not match current file sha256 ${current}`
  );
}

function summarize(e: Omit<SqlChainEvaluation, 'detail' | 'state'>): { state: SqlChainState; detail: string } {
  if (!e.ledgerPresent) return { state: 'ledger_missing', detail: 'schema_migrations table does not exist' };
  if (e.failed.length > 0) return { state: 'failed', detail: `${e.failed.length} failed migration(s): ${e.failed.slice(0, 5).join(', ')}` };
  if (e.skipped.length > 0)
    return {
      state: 'skipped',
      detail: `${e.skipped.length} skipped migration(s) — a skipped row means the migration did not apply: ${e.skipped.slice(0, 5).join(', ')}`,
    };
  if (e.unexplainedDrift.length > 0)
    return {
      state: 'unexplained_drift',
      detail: `${e.unexplainedDrift.length} migration(s) drifted with no approved (stored,current) pair: ${e.unexplainedDrift.slice(0, 5).join(', ')}`,
    };
  if (e.pending.length > 0)
    return { state: 'pending', detail: `${e.pending.length} pending migration(s): ${e.pending.slice(0, 5).join(', ')}` };
  return {
    state: 'ok',
    detail:
      `chain complete` +
      (e.approvedVariants.length ? `; ${e.approvedVariants.length} approved historical variant(s)` : '') +
      (e.postconditionVerified.length ? `; ${e.postconditionVerified.length} postcondition-verified` : '') +
      (e.attestedLegacyVariants.length ? `; ${e.attestedLegacyVariants.length} schema-attested legacy variant(s)` : '') +
      (e.unverifiable.length ? `; ${e.unverifiable.length} legacy row(s) without a stored checksum` : ''),
  };
}

/**
 * Evaluate the chain. Never throws for a *state* problem — it returns a state. It only returns
 * state 'error' when it genuinely could not determine the answer, which callers must treat as
 * NOT ready (fail closed), never as ok.
 */
export async function evaluateSqlChain(deps: SqlChainEvaluatorDeps): Promise<SqlChainEvaluation> {
  const empty = {
    ledgerPresent: false,
    failed: [] as string[],
    skipped: [] as string[],
    pending: [] as string[],
    unexplainedDrift: [] as string[],
    approvedVariants: [] as string[],
    postconditionVerified: [] as string[],
    attestedLegacyVariants: [] as string[],
    unverifiable: [] as string[],
  };

  try {
    const exists = await deps.db.query(
      `SELECT to_regclass('public.schema_migrations') IS NOT NULL AS present`
    );
    if (!exists.rows[0]?.present) {
      const s = summarize(empty);
      return { ...empty, ...s };
    }

    const rows = await deps.db.query(`SELECT filename, status, checksum FROM schema_migrations`);
    const applied = new Map<string, { status: string; checksum: string | null }>();
    for (const r of rows.rows) {
      applied.set(String(r.filename), {
        status: String(r.status ?? 'success'),
        checksum: r.checksum == null ? null : String(r.checksum),
      });
    }

    const warn = deps.warn ?? console.warn;
    const onDisk = fs
      .readdirSync(deps.migrationsDir)
      .filter((f) => /\.(sql|js|ts)$/.test(f));
    // The runner's own definition of "required" — never a raw directory listing.
    const required = onDisk.filter((f) => isExecutableMigration(f));

    const currentChecksums = new Map<string, { full: string; short: string }>();
    for (const filename of required) {
      const content = fs.readFileSync(path.join(deps.migrationsDir, filename), 'utf-8');
      currentChecksums.set(filename, {
        full: crypto.createHash('sha256').update(content).digest('hex'),
        short: fileChecksum(content),
      });
    }
    addHistoricalMigrationFiles(deps.migrationsDir, currentChecksums);

    const tpExists = await deps.db.query(
      `SELECT to_regclass('public.tp_migration_history') IS NOT NULL AS present`
    );
    const tpLedgerFilenames = new Set<string>();
    if (tpExists.rows[0]?.present && required.length > 0) {
      const tpRows = await deps.db.query(
        `SELECT filename, checksum FROM tp_migration_history WHERE filename = ANY($1::text[])`,
        [required]
      );
      for (const row of tpRows.rows) {
        const filename = String(row.filename);
        tpLedgerFilenames.add(filename);
        if (applied.get(filename)?.status === 'success') continue;
        const current = currentChecksums.get(filename);
        const stored = row.checksum == null ? null : String(row.checksum);
        if (!current) continue;
        const content = fs.readFileSync(path.join(deps.migrationsDir, filename), 'utf-8');
        const tpVerdict = classifyMigrationChecksum(filename, stored, content);
        if (tpVerdict === 'drift') continue;
        applied.set(filename, { status: 'success', checksum: current.full });
      }
    }

    for (const filename of required) {
      if (applied.get(filename)?.status === 'success' || tpLedgerFilenames.has(filename)) continue;
      if (!(await attestTablePlatformPresentWithoutHistory(deps.db, filename))) continue;
      const current = currentChecksums.get(filename);
      if (current) applied.set(filename, { status: 'success', checksum: current.full });
    }

    const acc = { ...empty, ledgerPresent: true };

    const requiredSet = new Set(required);
    const ledgerRelevantSet = new Set([...required, ...currentChecksums.keys()]);
    for (const [filename, row] of applied) {
      // Historical ledgers can retain rows for files that no longer exist or are now explicitly
      // excluded from the Postgres chain. They are audit history, not a missing required step.
      if (!ledgerRelevantSet.has(filename)) continue;
      if (row.status === 'failed') acc.failed.push(filename);
      else if (row.status === 'skipped') {
        warnSkippedLedgerDrift(filename, row.checksum, currentChecksums.get(filename)?.full, warn);
        acc.skipped.push(filename);
      }
    }

    for (const filename of required) {
      const row = applied.get(filename);
      if (!row || row.status !== 'success') {
        if (!row) acc.pending.push(filename);
        continue;
      }
      if (row.checksum == null || row.checksum === '') {
        acc.unverifiable.push(filename);
        continue;
      }
      const current = currentChecksums.get(filename)?.full ?? crypto
        .createHash('sha256')
        .update(fs.readFileSync(path.join(deps.migrationsDir, filename), 'utf-8'))
        .digest('hex');
      const verdict = classifySqlChainChecksum(filename, row.checksum, current);
      if (verdict === 'MATCH') continue;
      if (verdict === 'APPROVED_HISTORICAL_VARIANT') {
        // A reviewed checksum pair proves WHICH bytes ran, not that the resulting schema is
        // acceptable. For files whose historical version produced a shape different from a fresh
        // install, re-prove the live shape too — every evaluation, never cached.
        const postcondition = POSTCONDITION_ATTESTATIONS[filename];
        if (postcondition) {
          const result = await postcondition(deps.db);
          if (!result.attested) {
            const failed = result.checks.filter((c) => !c.ok).map((c) => c.name).join(', ');
            acc.unexplainedDrift.push(
              `${filename} (approved checksum but postcondition FAILED: ${result.failureReason}${failed ? `; failed: ${failed}` : ''})`
            );
            continue;
          }
          acc.postconditionVerified.push(filename);
        }
        acc.approvedVariants.push(filename);
        continue;
      }
      if (verdict === 'SCHEMA_ATTESTED_LEGACY_VARIANT') {
        // Never acceptable on the checksum alone: re-prove the schema, every evaluation.
        const attest = deps.attest ?? attestPartnerUsersUuidVariant;
        const result = await attest(deps.db);
        if (!result.attested) {
          acc.unexplainedDrift.push(`${filename} (attestation failed: ${result.failureReason})`);
        } else {
          acc.attestedLegacyVariants.push(filename);
        }
        continue;
      }
      acc.unexplainedDrift.push(filename);
    }

    const s = summarize(acc);
    return { ...acc, ...s };
  } catch (error: any) {
    return {
      ...empty,
      state: 'error',
      detail: `evaluation failed: ${error?.message || String(error)}`,
    };
  }
}

/** Readiness/gate acceptance predicate — one definition, so no caller can invent a looser one. */
export function isSqlChainAcceptable(evaluation: SqlChainEvaluation): boolean {
  return evaluation.state === 'ok';
}
