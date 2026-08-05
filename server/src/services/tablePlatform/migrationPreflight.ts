/**
 * The preflight ANALYSIS, separated from the CLI that prints it.
 *
 * It used to live inside `server/scripts/preflight-pending-migrations.ts`, which
 * always reads the canonical `server/migrations`. The only way to exercise drift
 * end-to-end was therefore to write a fixture INTO that canonical directory —
 * and for the duration of the test a concurrently running backend could discover
 * that fixture and apply it to its own database. Cleaning up afterwards proves
 * tidiness, not isolation.
 *
 * With the analysis importable and directory-parameterised, a test can point it
 * at its own `mkdtemp` — the same one the runner used — and the canonical
 * directory is never touched at all.
 *
 * The directory is a FUNCTION ARGUMENT. It is deliberately not read from the
 * environment, a request, or any other runtime data: a preflight that could be
 * talked into reporting on a different directory than the one production will
 * actually run is worse than no preflight.
 */
import fs from 'node:fs';
import path from 'node:path';

import { classifyMigrationChecksum, isRuntimeMigrationFile } from './migrationIdentity.js';

/** Minimal shape of whatever database handle the caller already has. */
export interface PreflightQueryable {
  query: (text: string, params?: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }>;
}

export interface PreflightReport {
  migrationsDir: string;
  historyTablePresent: boolean;
  onDisk: number;
  applied: number;
  pending: string[];
  pendingCount: number;
  /** Applied migrations whose file no longer matches the recorded checksum. */
  checksumMismatches: string[];
  checksumMismatchCount: number;
  /** Exact approved old/current pairs; compatible without rewriting history. */
  acceptedHistoricalChecksumVariants: string[];
  acceptedHistoricalChecksumVariantCount: number;
  /** Rows recorded before checksums existed — unverifiable, NOT drift. */
  legacyUnverifiableChecksums: number;
  /** History rows with no file on disk. Hygiene debt, inert. */
  orphanHistoryEntries: number;
}

const MIGRATION_TABLE = 'tp_migration_history';

/**
 * Read-only. Issues SELECTs only: never creates or writes
 * `tp_migration_history`, never runs a migration, never reads business data.
 */
export async function analyzePendingMigrations(options: {
  migrationsDir: string;
  client: PreflightQueryable;
}): Promise<PreflightReport> {
  const { migrationsDir, client } = options;

  const historyExists = await client.query(
    `SELECT 1 FROM information_schema.tables
      WHERE table_schema='public' AND table_name='${MIGRATION_TABLE}'`
  );
  const historyTablePresent = historyExists.rows.length > 0;

  const applied = new Map<string, string | null>();
  if (historyTablePresent) {
    const { rows } = await client.query(`SELECT filename, checksum FROM ${MIGRATION_TABLE}`);
    for (const r of rows as Array<{ filename: string; checksum: string | null }>) {
      applied.set(r.filename, r.checksum);
    }
  }

  // Same predicate as the runtime runner — including the allowlist.
  const onDisk = fs.readdirSync(migrationsDir).filter((f) => isRuntimeMigrationFile(f));
  const pending = onDisk.filter((f) => !applied.has(f)).sort();

  const checksumMismatches: string[] = [];
  const acceptedHistoricalChecksumVariants: string[] = [];
  let legacyUnverifiableChecksums = 0;
  for (const file of onDisk) {
    if (!applied.has(file)) continue;
    const verdict = classifyMigrationChecksum(
      file,
      applied.get(file),
      fs.readFileSync(path.join(migrationsDir, file), 'utf-8')
    );
    if (verdict === 'unverifiable') legacyUnverifiableChecksums++;
    else if (verdict === 'accepted_historical_variant') {
      acceptedHistoricalChecksumVariants.push(file);
    } else if (verdict === 'drift') checksumMismatches.push(file);
  }
  checksumMismatches.sort();
  acceptedHistoricalChecksumVariants.sort();

  const orphans = [...applied.keys()].filter((f) => !fs.existsSync(path.join(migrationsDir, f)));

  return {
    migrationsDir,
    historyTablePresent,
    onDisk: onDisk.length,
    applied: applied.size,
    pending,
    pendingCount: pending.length,
    checksumMismatches,
    checksumMismatchCount: checksumMismatches.length,
    acceptedHistoricalChecksumVariants,
    acceptedHistoricalChecksumVariantCount: acceptedHistoricalChecksumVariants.length,
    legacyUnverifiableChecksums,
    orphanHistoryEntries: orphans.length,
  };
}

/**
 * The gate decision, shared by the CLI and its tests so the exit contract
 * cannot drift from what the tests claim it is.
 *
 * Drift fails unconditionally — the runner is fail-closed on it, so a release
 * that ignored drift here would simply fail later, in a worse place.
 */
export function preflightExitCode(
  report: PreflightReport,
  options: { failOnPending?: boolean } = {}
): 0 | 1 {
  if (report.checksumMismatchCount > 0) return 1;
  if (options.failOnPending && report.pendingCount > 0) return 1;
  return 0;
}

export function formatPreflightReport(report: PreflightReport): string {
  const lines = [
    '── Table Platform migration preflight (read-only) ──',
    `migrations on disk        : ${report.onDisk}`,
    `recorded in history       : ${report.applied}`,
    `legacy NULL checksums     : ${report.legacyUnverifiableChecksums} (unverifiable, NOT drift)`,
    `orphan history entries    : ${report.orphanHistoryEntries} (hygiene debt, inert)`,
    `approved history variants : ${report.acceptedHistoricalChecksumVariantCount} (exact pairs, history unchanged)`,
    ...report.acceptedHistoricalChecksumVariants.map((f) => `   ≈ ${f}`),
    `CHECKSUM DRIFT            : ${report.checksumMismatchCount}`,
    ...report.checksumMismatches.map((f) => `   ✗ ${f}`),
    `PENDING on next start     : ${report.pendingCount}`,
    ...report.pending.map((f) => `   → ${f}`),
  ];
  if (!report.historyTablePresent) {
    lines.push('note: tp_migration_history does not exist yet; the runner will create it.');
  }
  return lines.join('\n');
}
