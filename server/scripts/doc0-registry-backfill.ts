#!/usr/bin/env tsx
/**
 * DOC-0 etap 1 (b) (DEC-594/DEC-595) — CLI wołacz dla `documentRegistryBackfillService`.
 *
 * Serwis backfillu nie miał ŻADNEGO wołacza (0 trafień poza testem) — bez tego
 * skryptu nie da się go uruchomić na stagingu inaczej niż kodem ad hoc. Uruchomienie
 * na stagingu = runbook CTO (wdrożenie 22); stanowisko C pokazuje przebieg na kopii
 * dumpu: dry-run 119/6 → apply → drugi apply 0/0 → restore 6 → dry-run 119/6.
 *
 * TRYBY (dry-run DOMYŚLNY, zero zapisu):
 *   --dry-run  liczby: unlisted (treści wave5 bez wiersza listy), contentless (sieroty 404)
 *   --apply    backfill + archiwizacja sierot (idempotentne), zapisuje log JSON
 *   --restore  cofnięcie archiwizacji z logu + usunięcie wierszy utworzonych przez backfill
 *
 * Log (domyślnie `doc0-registry-backfill.log.json`, nadpisywalny `--log <path>`)
 * przechowuje `archiveEntries` (stan sprzed archiwizacji per wiersz) — wejście
 * `restoreArchivedDocumentRows`. `--restore` usuwa dodatkowo wiersze rejestru, które
 * utworzył `--apply`: rozpoznaje je po znaczniku `sourceType='doc0_native_backfill'`
 * w `origin_summary_json` (stempel samego backfillu), więc bez logu ID — idempotentnie.
 *
 * Wymaga DATABASE_URL (bez niego exit 1, zero połączeń).
 *
 * Usage (kopia dumpu, kontener puli C):
 *   NODE_ENV=test MOCK_DB=false DATABASE_URL=postgres://postgres:qoder@127.0.0.1:66xx/consultify_qoder \
 *     npx tsx server/scripts/doc0-registry-backfill.ts [--dry-run|--apply|--restore] [--org=<id>] [--log=<path>]
 */
import { readFileSync, writeFileSync } from 'node:fs';

import {
  archiveContentlessDocumentRows,
  backfillUnlistedNativeArtifacts,
  findContentlessDocumentRows,
  findUnlistedNativeArtifacts,
  restoreArchivedDocumentRows,
  type ArchiveSummary,
  type ArchivedDocumentEntry,
  type NativeBackfillSummary,
} from '../src/services/documentRegistryBackfillService.js';
import { run as dbRun } from '../src/utils/DbPromise.js';

export const DOC0_BACKFILL_SOURCE_MARKER = 'doc0_native_backfill';
export const DEFAULT_LOG_PATH = 'doc0-registry-backfill.log.json';

export type Doc0CliMode = 'dry-run' | 'apply' | 'restore';

export interface Doc0CliOptions {
  mode: Doc0CliMode;
  logPath: string;
  organizationId?: string;
}

export class Doc0CliUsageError extends Error {}

export function parseArgs(argv: string[]): Doc0CliOptions {
  const options: Doc0CliOptions = { mode: 'dry-run', logPath: DEFAULT_LOG_PATH };
  let modeExplicit = false;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--dry-run' || arg === '--apply' || arg === '--restore') {
      const mode = arg.slice(2) as Doc0CliMode;
      if (modeExplicit && options.mode !== mode) {
        throw new Doc0CliUsageError(`conflicting modes: --${options.mode} and ${arg}`);
      }
      options.mode = mode;
      modeExplicit = true;
      continue;
    }
    if (arg === '--org' || arg === '--log') {
      const value = argv[i + 1];
      if (!value || value.startsWith('--')) {
        throw new Doc0CliUsageError(`${arg} requires a value`);
      }
      if (arg === '--org') options.organizationId = value;
      else options.logPath = value;
      i += 1;
      continue;
    }
    if (arg.startsWith('--org=')) {
      options.organizationId = arg.slice('--org='.length);
      if (!options.organizationId) throw new Doc0CliUsageError('--org= requires a value');
      continue;
    }
    if (arg.startsWith('--log=')) {
      options.logPath = arg.slice('--log='.length);
      if (!options.logPath) throw new Doc0CliUsageError('--log= requires a value');
      continue;
    }
    throw new Doc0CliUsageError(`unknown argument: ${arg}`);
  }
  return options;
}

export interface Doc0ApplyLog {
  appliedAt: string;
  organizationId: string | null;
  backfill: Pick<
    NativeBackfillSummary,
    'scanned' | 'inserted' | 'failed' | 'skippedUnsupportedType'
  >;
  archived: number;
  archiveEntries: ArchivedDocumentEntry[];
}

export interface Doc0CliDeps {
  env: { DATABASE_URL?: string };
  findUnlisted: (params: { organizationId?: string }) => Promise<unknown[]>;
  findContentless: (params: { organizationId?: string }) => Promise<unknown[]>;
  backfill: (params: {
    organizationId?: string;
    dryRun?: boolean;
  }) => Promise<NativeBackfillSummary>;
  archive: (params: { organizationId?: string; dryRun?: boolean }) => Promise<ArchiveSummary>;
  restore: (entries: ArchivedDocumentEntry[]) => Promise<{ restored: number; failed: number }>;
  removeBackfilledRows: () => Promise<{ linksDeleted: number; artifactsDeleted: number }>;
  readLog: (path: string) => string | null;
  writeLog: (path: string, contents: string) => void;
  print: (line: string) => void;
  now: () => string;
}

/**
 * Usuwa wiersze rejestru utworzone przez `--apply`: znacznik
 * `sourceType='doc0_native_backfill'` w `origin_summary_json` stempluje sam
 * backfill (BACKFILL_SOURCE_TYPE w serwisie), więc warunek jest dokładny.
 * `fallback: false` — DELETE ma wybuchnąć, nie zameldować `{success:false}`.
 */
export async function removeBackfilledRegistryRows(): Promise<{
  linksDeleted: number;
  artifactsDeleted: number;
}> {
  const marker = `%${DOC0_BACKFILL_SOURCE_MARKER}%`;
  const links = await dbRun(
    `DELETE FROM v8_artifact_origin_links
      WHERE artifact_id IN (
        SELECT artifact_id FROM v8_output_artifacts WHERE origin_summary_json LIKE ?
      )`,
    [marker],
    { fallback: false }
  );
  const artifacts = await dbRun(
    `DELETE FROM v8_output_artifacts WHERE origin_summary_json LIKE ?`,
    [marker],
    { fallback: false }
  );
  return {
    linksDeleted: links?.changes ?? 0,
    artifactsDeleted: artifacts?.changes ?? 0,
  };
}

export async function runCli(options: Doc0CliOptions, deps: Doc0CliDeps): Promise<number> {
  if (!deps.env.DATABASE_URL) {
    deps.print('ERROR: DATABASE_URL is required (refusing to run without a target database)');
    return 1;
  }
  const scope = { organizationId: options.organizationId };

  if (options.mode === 'dry-run') {
    const unlisted = await deps.findUnlisted(scope);
    const contentless = await deps.findContentless(scope);
    deps.print(
      `dry-run: unlisted=${unlisted.length} contentless=${contentless.length}` +
        (options.organizationId ? ` org=${options.organizationId}` : ' (all orgs)')
    );
    deps.print('dry-run makes ZERO writes; pass --apply to backfill + archive');
    return 0;
  }

  if (options.mode === 'apply') {
    const backfill = await deps.backfill({ ...scope, dryRun: false });
    const archive = await deps.archive({ ...scope, dryRun: false });
    const log: Doc0ApplyLog = {
      appliedAt: deps.now(),
      organizationId: options.organizationId ?? null,
      backfill: {
        scanned: backfill.scanned,
        inserted: backfill.inserted,
        failed: backfill.failed,
        skippedUnsupportedType: backfill.skippedUnsupportedType,
      },
      archived: archive.archived,
      archiveEntries: archive.entries,
    };
    deps.writeLog(options.logPath, JSON.stringify(log, null, 2));
    deps.print(
      `apply: backfill inserted=${backfill.inserted}/${backfill.scanned} ` +
        `failed=${backfill.failed} skippedUnsupportedType=${backfill.skippedUnsupportedType} :: ` +
        `archived=${archive.archived} alreadyArchived=${archive.alreadyArchived} :: ` +
        `log=${options.logPath}`
    );
    return 0;
  }

  const raw = deps.readLog(options.logPath);
  if (raw === null) {
    deps.print(`ERROR: no apply log at ${options.logPath} — run --apply first`);
    return 1;
  }
  let log: Doc0ApplyLog;
  try {
    log = JSON.parse(raw) as Doc0ApplyLog;
  } catch {
    deps.print(`ERROR: apply log at ${options.logPath} is not valid JSON`);
    return 1;
  }
  const restored = await deps.restore(log.archiveEntries || []);
  const removed = await deps.removeBackfilledRows();
  deps.print(
    `restore: restored=${restored.restored} failed=${restored.failed} :: ` +
      `removed backfill rows: links=${removed.linksDeleted} artifacts=${removed.artifactsDeleted}`
  );
  return 0;
}

export const defaultDeps: Doc0CliDeps = {
  env: process.env,
  findUnlisted: (params) => findUnlistedNativeArtifacts(params),
  findContentless: (params) => findContentlessDocumentRows(params),
  backfill: (params) => backfillUnlistedNativeArtifacts(params),
  archive: (params) => archiveContentlessDocumentRows(params),
  restore: (entries) => restoreArchivedDocumentRows(entries),
  removeBackfilledRows: removeBackfilledRegistryRows,
  readLog: (path) => {
    try {
      return readFileSync(path, 'utf8');
    } catch {
      return null;
    }
  },
  writeLog: (path, contents) => writeFileSync(path, contents, 'utf8'),
  print: (line) => process.stdout.write(`${line}\n`),
  now: () => new Date().toISOString(),
};

async function main(): Promise<void> {
  let options: Doc0CliOptions;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error: unknown) {
    process.stdout.write(
      `ERROR: ${error instanceof Error ? error.message : String(error)}\n` +
        'usage: doc0-registry-backfill.ts [--dry-run|--apply|--restore] [--org=<id>] [--log=<path>]\n'
    );
    process.exit(1);
    return;
  }
  const code = await runCli(options, defaultDeps);
  process.exit(code);
}

// Run only when invoked directly (tsx server/scripts/...), never on import — the
// parser and runCli above are unit-tested from tests/backend with injected deps.
const invokedDirectly = String(process.argv[1] || '')
  .replace(/\\/g, '/')
  .endsWith('doc0-registry-backfill.ts');
if (invokedDirectly) {
  main().catch((error) => {
    process.stdout.write(`ERROR: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  });
}
