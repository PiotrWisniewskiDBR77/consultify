/**
 * MAT-006B — unit tests for `server/scripts/materialize-atelier-decks.ts`.
 *
 * The seed module (`atelierPresentationDeckSeed.ts`, owned by another agent) and
 * the database are mocked at the module boundary through `MaterializeDeps`, so
 * these tests do not depend on that module landing on disk, and never open a
 * connection to anything. The filesystem seam is mocked at SYSCALL granularity
 * because the durability property under test IS the call order.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  DECLARED_TARGET_ENV_VARS,
  DEMO_TARGET_ELEMENTS,
  type DemoTargetElement,
  OBSERVED_TARGET_ENV_VARS,
} from '../../../../server/src/config/demoTargetAuthority.js';
import {
  ACTIVE_EDITOR_WINDOW_MINUTES,
  ATELIER_DECK_BACKUP_COLUMNS,
  assertSeedModuleContract,
  carriesReconciliationEvidence,
  deriveIndeterminateVerdict,
  type RollbackIndeterminateVerdict,
  type RollbackObservation,
  ROLLBACK_INDETERMINATE_VERDICTS,
  type AtelierDeckBackup,
  type AtelierDeckBackupRow,
  type AtelierDeckPlanEntry,
  type AtelierDeckPostState,
  createNodeManifestFsSeam,
  MANIFEST_DIR_MODE,
  MANIFEST_FILE_MODE,
  MANIFEST_HMAC_KEY_ID_ENV,
  MANIFEST_HMAC_SECRET_ENV,
  DO_NOT_RERUN_BLIND_WARNING,
  type MaterializeDeps,
  type MaterializeOptions,
  type MaterializeRunResult,
  MATERIALIZE_CONFIRM_ENV,
  MATERIALIZE_CONFIRM_VALUE,
  parseMaterializeArgs,
  ROLLBACK_CONFIRM_ENV,
  ROLLBACK_CONFIRM_VALUE,
  type RollbackManifest,
  type RollbackOutcome,
  ROLLBACK_STAGES,
  runMaterializeAtelierDecks,
  type SeedAtelierPresentationDecksInput,
  type SeedAtelierPresentationDecksResult,
  serializeSignedManifest,
  signManifest,
  type SignedManifestEnvelope,
  verifyManifestEnvelope,
} from '../../../../server/scripts/materialize-atelier-decks.js';

const SLUGS = ['forward-board-readout', 'line3-steering', 'connected-play-growth'] as const;
const ORG = 'atelier';
const deckId = (slug: string) => `${ORG}--deck--${slug}`;
const NOW = new Date('2026-08-01T12:00:00.000Z');

const DEMO_HOST = 'trolley.proxy.rlwy.net';
const DEMO_PORT = '28146';
const DEMO_DATABASE = 'railway';

const KEY_ID = 'mat006b-2026-08';
const SECRET = 'a-runtime-secret-not-in-the-repo';

const TARGET_VALUES: Record<DemoTargetElement, string> = {
  railwayProjectId: 'prj_consultify_0001',
  railwayEnvironmentId: 'env_demo_0002',
  railwayEnvironmentName: 'demo',
  railwayServiceId: 'svc_consultify_0003',
  railwayServiceName: 'consultify',
  databaseHost: DEMO_HOST,
  databasePort: DEMO_PORT,
  databaseName: DEMO_DATABASE,
};

function targetEnv(values: Record<DemoTargetElement, string> = TARGET_VALUES): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};
  for (const element of DEMO_TARGET_ELEMENTS) {
    env[DECLARED_TARGET_ENV_VARS[element]] = values[element];
  }
  for (const [element, envVar] of Object.entries(OBSERVED_TARGET_ENV_VARS)) {
    env[envVar] = values[element as DemoTargetElement];
  }
  return env;
}

const SIGNING_ENV: NodeJS.ProcessEnv = {
  [MANIFEST_HMAC_SECRET_ENV]: SECRET,
  [MANIFEST_HMAC_KEY_ID_ENV]: KEY_ID,
};
const BASE_ENV: NodeJS.ProcessEnv = { ...targetEnv(), ...SIGNING_ENV };
const WRITE_ENV: NodeJS.ProcessEnv = {
  ...BASE_ENV,
  [MATERIALIZE_CONFIRM_ENV]: MATERIALIZE_CONFIRM_VALUE,
};
const ROLLBACK_ENV: NodeJS.ProcessEnv = {
  ...BASE_ENV,
  [ROLLBACK_CONFIRM_ENV]: ROLLBACK_CONFIRM_VALUE,
};

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function planEntry(slug: string, overrides: Partial<AtelierDeckPlanEntry> = {}): AtelierDeckPlanEntry {
  return {
    slug,
    deckId: deckId(slug),
    outcome: 'updated',
    reason: null,
    currentVersion: 1,
    nextVersion: 2,
    currentSlideCount: null,
    desiredSlideCount: 7,
    currentFingerprint: null,
    desiredFingerprint: `fp-${slug}`,
    ownedBySeed: false,
    hasExistingContent: false,
    foreignTenant: null,
    ...overrides,
  };
}

/** All 24 value columns plus the two keys, per contract R3. */
function backupRow(slug: string, overrides: Partial<AtelierDeckBackupRow> = {}): AtelierDeckBackupRow {
  return {
    id: deckId(slug),
    organization_id: ORG,
    title: `Deck ${slug}`,
    description: `description of ${slug}`,
    template_id: 'tpl-canonical',
    deck_type: 'steering',
    audience: 'board',
    goal: 'decide',
    language: 'en',
    confidentiality: 'internal',
    theme: 'atelier',
    presentation_mode: 'standard',
    source_type: 'seed',
    source_id: 'atelier-canonical',
    source_artifacts: '[]',
    outline_json: '{"sections":[]}',
    unified_json: null,
    deck_json: null,
    source_refs_json: '{}',
    slide_count: 0,
    status: 'draft',
    generated_by: 'seed',
    created_by: 'seed',
    created_at: '2026-06-01T09:00:00.000Z',
    updated_at: '2026-07-01T09:00:00.000Z',
    version: 1,
    ...overrides,
  };
}

function writtenRow(slug: string, cards = 7): AtelierDeckBackupRow {
  return backupRow(slug, {
    status: 'draft',
    slide_count: cards,
    version: 2,
    deck_json: JSON.stringify({ cards: Array.from({ length: cards }, (_, i) => ({ id: `c${i}` })) }),
    unified_json: JSON.stringify({ sections: [] }),
    updated_at: NOW.toISOString(),
  });
}

function backupOf(rows: AtelierDeckBackupRow[], overrides: Partial<AtelierDeckBackup> = {}): AtelierDeckBackup {
  const byId = new Map(rows.map((row) => [row.id, row]));
  return {
    organizationId: ORG,
    entries: SLUGS.map((slug) => {
      const row = byId.get(deckId(slug)) ?? null;
      return {
        deckId: deckId(slug),
        state: row ? ('exists' as const) : ('verified_absent' as const),
        row,
        error: null,
      };
    }),
    complete: true,
    ...overrides,
  };
}

/** Contract R4 §1: the post-write fingerprint that becomes the rollback CAS target. */
function postStateEntry(
  slug: string,
  overrides: Partial<AtelierDeckPostState> = {}
): AtelierDeckPostState {
  return {
    deckId: deckId(slug),
    state: 'exists',
    organizationId: ORG,
    version: 2,
    updatedAt: NOW.toISOString(),
    contentFingerprint: `fp-after-${slug}`,
    slideCount: 7,
    status: 'draft',
    ...overrides,
  };
}

const POST_STATE: AtelierDeckPostState[] = SLUGS.map((slug) => postStateEntry(slug));

function seedResult(
  overrides: Partial<SeedAtelierPresentationDecksResult> = {}
): SeedAtelierPresentationDecksResult {
  return {
    decks: 3,
    slides: 21,
    deckIds: SLUGS.map(deckId),
    unchanged: 0,
    skipped: 0,
    failures: [],
    plan: SLUGS.map((slug) => planEntry(slug)),
    applied: true,
    atomicity: 'pinned-pg',
    postState: POST_STATE,
    ...overrides,
  };
}

/** Success wording, in every form this tool can emit it. */
const SUCCESS_WORDING = [
  /READY/,
  /RESTORED/,
  /\bOK\b/,
  /materialized and verified/,
  /DRY RUN complete/,
  /succe/i,
];

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------

type Harness = {
  deps: MaterializeDeps;
  sqlSeen: string[];
  calls: string[];
  fsCalls: Array<{ op: string; args: unknown[] }>;
  files: Map<string, string>;
  logs: string[];
  seedSpy: ReturnType<typeof vi.fn>;
  planSpy: ReturnType<typeof vi.fn>;
  rollbackSqlSpy: ReturnType<typeof vi.fn>;
  postStateSpy: ReturnType<typeof vi.fn>;
  executorSpy: ReturnType<typeof vi.fn>;
  /** Every `persistRecoveryAnchor` argument the mocked seed saw, in order. */
  anchorCalls: AtelierDeckPostState[][];
  /** What the anchor callback threw back at the seed, if anything. */
  anchorThrew: Error[];
};

function makeHarness(
  config: {
    plan?: AtelierDeckPlanEntry[];
    planAtomicity?: 'pinned-pg' | 'batched-fallback';
    backupBefore?: AtelierDeckBackup;
    backupAfter?: AtelierDeckBackup;
    backupAfterThrows?: Error;
    seedResult?: SeedAtelierPresentationDecksResult;
    seedThrows?: Error;
    /** Throw only AFTER the pre-COMMIT anchor ran — i.e. COMMIT itself blew up. */
    seedThrowsAfterAnchor?: boolean;
    /** Emulate a seed that ignores `persistRecoveryAnchor` entirely. */
    skipRecoveryAnchor?: boolean;
    /** What the seed hands the anchor; defaults to its own result post-state. */
    anchorPostState?: AtelierDeckPostState[];
    /** How the mocked seed reacts when the anchor throws at it. */
    onAnchorThrow?: 'rolled-back-result' | 'rethrow';
    postState?: AtelierDeckPostState[];
    postStateThrows?: Error;
    rollbackOutcome?: RollbackOutcome;
    rollbackExecutorThrows?: Error;
    rows?: Record<string, Record<string, unknown>[]>;
    organizationRow?: Record<string, unknown> | null;
    env?: NodeJS.ProcessEnv;
    host?: string;
    port?: string;
    database?: string;
    files?: Map<string, string>;
  } = {}
): Harness {
  const sqlSeen: string[] = [];
  const calls: string[] = [];
  const fsCalls: Array<{ op: string; args: unknown[] }> = [];
  const files = config.files ?? new Map<string, string>();
  const openFiles = new Map<number, { path: string; buffer: string; synced: boolean }>();
  let nextFd = 10;
  const logs: string[] = [];
  const plan = config.plan ?? SLUGS.map((slug) => planEntry(slug));
  const backups: AtelierDeckBackup[] = [
    config.backupBefore ?? backupOf(SLUGS.map((slug) => backupRow(slug))),
    config.backupAfter ?? backupOf(SLUGS.map((slug) => writtenRow(slug))),
  ];
  let backupCall = 0;

  const planSpy = vi.fn(async () => {
    calls.push('plan');
    return seedResult({
      plan,
      applied: false,
      decks: 0,
      postState: [],
      atomicity: config.planAtomicity ?? 'pinned-pg',
    });
  });
  const anchorCalls: AtelierDeckPostState[][] = [];
  const anchorThrew: Error[] = [];
  /**
   * The mocked seed models contract R5 §2: it runs `persistRecoveryAnchor`
   * INSIDE its transaction, after the post-state read-back and BEFORE COMMIT,
   * and a throw from the anchor aborts that transaction.
   */
  const seedSpy = vi.fn(async (input: SeedAtelierPresentationDecksInput) => {
    calls.push('seed');
    if (config.seedThrows && !config.seedThrowsAfterAnchor) throw config.seedThrows;
    const result = config.seedResult ?? seedResult({ plan });

    if (!config.skipRecoveryAnchor && input.persistRecoveryAnchor) {
      const offered = config.anchorPostState ?? result.postState;
      anchorCalls.push(offered);
      calls.push('persistRecoveryAnchor');
      try {
        await input.persistRecoveryAnchor(offered);
      } catch (error) {
        anchorThrew.push(error as Error);
        calls.push('ROLLBACK(anchor threw)');
        if ((config.onAnchorThrow ?? 'rolled-back-result') === 'rethrow') throw error;
        // The transaction was discarded before COMMIT: nothing applied, and no
        // post-state, because there is no committed state to fingerprint.
        return {
          ...result,
          applied: false,
          decks: 0,
          slides: 0,
          postState: [],
          commitState: 'rolled_back' as const,
          failures: [
            {
              deckId: '*',
              reason: `transaction rolled back: ${String(error)}`,
            },
          ],
        };
      }
    }

    calls.push('COMMIT');
    if (config.seedThrows && config.seedThrowsAfterAnchor) throw config.seedThrows;
    return result;
  });
  const rollbackSqlSpy = vi.fn((backup: AtelierDeckBackup) => {
    calls.push('buildRollbackSql');
    if (!backup.complete) throw new Error('buildRollbackSql called on an incomplete backup');
    const lines = ['BEGIN;'];
    for (const entry of backup.entries) {
      lines.push(
        entry.state === 'exists'
          ? `UPDATE presentation_decks SET title = '${entry.row?.title}' WHERE id = '${entry.deckId}' AND organization_id = '${ORG}';`
          : `DELETE FROM presentation_decks WHERE id = '${entry.deckId}' AND organization_id = '${ORG}';`
      );
    }
    lines.push('COMMIT;', '');
    return lines.join('\n');
  });
  const postStateSpy = vi.fn(async () => {
    calls.push('readAtelierDeckPostState');
    if (config.postStateThrows) throw config.postStateThrows;
    return config.postState ?? POST_STATE;
  });
  /** Agent 1's transactional executor, mocked at the module boundary. */
  const executorSpy = vi.fn(async () => {
    calls.push('rollbackAtelierDecksOnPinnedClient');
    if (config.rollbackExecutorThrows) throw config.rollbackExecutorThrows;
    return (
      config.rollbackOutcome ?? {
        ok: true as const,
        restored: true as const,
        rows: SLUGS.map((slug) => backupRow(slug)),
      }
    );
  });

  const deps: MaterializeDeps = {
    seed: {
      ATELIER_DECK_SLUGS: SLUGS,
      atelierDeckId: (organizationId, slug) => `${organizationId}--deck--${slug}`,
      planAtelierPresentationDecks: planSpy as never,
      seedAtelierPresentationDecks: seedSpy as never,
      readAtelierDeckBackup: vi.fn(async () => {
        calls.push('readAtelierDeckBackup');
        const index = Math.min(backupCall, backups.length - 1);
        backupCall += 1;
        if (index === 1 && config.backupAfterThrows) throw config.backupAfterThrows;
        return backups[index];
      }) as never,
      buildRollbackSql: rollbackSqlSpy as never,
      readAtelierDeckPostState: postStateSpy as never,
      rollbackAtelierDecksOnPinnedClient: executorSpy as never,
    },
    db: {
      all: vi.fn(async (sql: string) => {
        sqlSeen.push(sql);
        calls.push('db.all');
        if (sql.includes('FROM organizations')) {
          const row =
            config.organizationRow === undefined
              ? { id: ORG, name: 'Atelier Toys', organization_type: 'DEMO' }
              : config.organizationRow;
          return (row ? [row] : []) as never;
        }
        const table = Object.keys(config.rows ?? {}).find((name) => sql.includes(name));
        return (table ? (config.rows ?? {})[table] : []) as never;
      }) as never,
      tableExists: vi.fn(async () => true),
    },
    isWritableStatus: (status: string) =>
      ['draft', 'ready', 'shared', 'archived'].includes(status),
    resolveTarget: vi.fn(() => {
      const host = config.host ?? DEMO_HOST;
      const port = config.port === undefined ? `:${DEMO_PORT}` : config.port ? `:${config.port}` : '';
      const database = config.database ?? DEMO_DATABASE;
      return {
        connectionString: `postgres://user:pw@${host}${port}/${database}`,
        host,
        database,
        source: 'DATABASE_PUBLIC_URL',
      };
    }),
    env: config.env ?? BASE_ENV,
    now: () => NOW,
    fs: {
      mkdirSecure: (dirPath, mode) => {
        fsCalls.push({ op: 'mkdirSecure', args: [dirPath, mode] });
      },
      openForWrite: (filePath, mode) => {
        fsCalls.push({ op: 'openForWrite', args: [filePath, mode] });
        const fd = nextFd++;
        openFiles.set(fd, { path: filePath, buffer: '', synced: false });
        return fd;
      },
      writeAll: (fd, contents) => {
        fsCalls.push({ op: 'writeAll', args: [fd] });
        const handle = openFiles.get(fd);
        if (!handle) throw new Error(`writeAll on a closed fd ${fd}`);
        handle.buffer += contents;
      },
      fsyncFile: (fd) => {
        fsCalls.push({ op: 'fsyncFile', args: [fd] });
        const handle = openFiles.get(fd);
        if (!handle) throw new Error(`fsyncFile on a closed fd ${fd}`);
        handle.synced = true;
        // Only fsynced bytes are modelled as durable.
        files.set(handle.path, handle.buffer);
      },
      closeFile: (fd) => {
        fsCalls.push({ op: 'closeFile', args: [fd] });
        openFiles.delete(fd);
      },
      renameFile: (fromPath, toPath) => {
        fsCalls.push({ op: 'renameFile', args: [fromPath, toPath] });
        const contents = files.get(fromPath);
        if (contents === undefined) throw new Error(`rename of a non-durable file ${fromPath}`);
        files.delete(fromPath);
        files.set(toPath, contents);
        calls.push(`file:${toPath.split('/').pop()}`);
      },
      fsyncDirectory: (dirPath) => {
        fsCalls.push({ op: 'fsyncDirectory', args: [dirPath] });
      },
      readTextFile: (filePath) => {
        fsCalls.push({ op: 'readTextFile', args: [filePath] });
        const contents = files.get(filePath);
        if (contents === undefined) throw new Error(`ENOENT: ${filePath}`);
        return contents;
      },
    },
    log: (message) => logs.push(message),
  };

  return {
    deps,
    sqlSeen,
    calls,
    fsCalls,
    files,
    logs,
    seedSpy,
    planSpy,
    rollbackSqlSpy,
    postStateSpy,
    executorSpy,
    anchorCalls,
    anchorThrew,
  };
}

function options(overrides: Partial<MaterializeOptions> = {}): MaterializeOptions {
  return {
    write: false,
    rollback: false,
    manifestPath: null,
    targetEnvironment: 'demo',
    organizationId: ORG,
    forceOverwriteForeignContent: false,
    manifestRoot: '/srv/_backup/mat-006b',
    anchorDate: null,
    ...overrides,
  };
}

function manifestFileOf(harness: Harness): { path: string; contents: string } {
  const entry = [...harness.files.entries()].find(([filePath]) => filePath.endsWith('manifest.json'));
  if (!entry) throw new Error('no manifest.json was written');
  return { path: entry[0], contents: entry[1] };
}

// ---------------------------------------------------------------------------

describe('materialize-atelier-decks — argument parsing', () => {
  it('defaults to a dry run and refuses to assume an environment', () => {
    const parsed = parseMaterializeArgs([]);
    expect(parsed.write).toBe(false);
    expect(parsed.rollback).toBe(false);
    expect(parsed.targetEnvironment).toBe('');
    expect(parsed.organizationId).toBe('atelier');
    expect(parsed.forceOverwriteForeignContent).toBe(false);
  });

  it('reads --target, --write, --rollback, --manifest and the force flag', () => {
    const parsed = parseMaterializeArgs([
      '--target=demo',
      '--write',
      '--rollback',
      '--manifest=/srv/_backup/mat-006b/x/manifest.json',
      '--force-overwrite-foreign-content',
    ]);
    expect(parsed).toMatchObject({
      write: true,
      rollback: true,
      manifestPath: '/srv/_backup/mat-006b/x/manifest.json',
      targetEnvironment: 'demo',
      forceOverwriteForeignContent: true,
    });
  });
});

describe('materialize-atelier-decks — seed contract guard', () => {
  it('refuses a seed module that predates the MAT-006B R3 contract', () => {
    expect(() =>
      assertSeedModuleContract({
        atelierDeckId: () => 'x',
        seedAtelierPresentationDecks: () => undefined,
      })
    ).toThrow(
      /Missing export\(s\): ATELIER_DECK_SLUGS, planAtelierPresentationDecks, readAtelierDeckBackup, buildRollbackSql/
    );
  });

  it('refuses an R3 module that lacks the R4 post-state and transactional rollback', () => {
    expect(() =>
      assertSeedModuleContract({
        ATELIER_DECK_SLUGS: SLUGS,
        atelierDeckId: () => 'x',
        planAtelierPresentationDecks: () => undefined,
        seedAtelierPresentationDecks: () => undefined,
        readAtelierDeckBackup: () => undefined,
        buildRollbackSql: () => '',
      })
    ).toThrow(
      /Missing export\(s\): readAtelierDeckPostState, rollbackAtelierDecksOnPinnedClient/
    );
  });

  it('accepts a module that implements the full contract', () => {
    expect(() =>
      assertSeedModuleContract({
        ATELIER_DECK_SLUGS: SLUGS,
        atelierDeckId: () => 'x',
        planAtelierPresentationDecks: () => undefined,
        seedAtelierPresentationDecks: () => undefined,
        readAtelierDeckBackup: () => undefined,
        buildRollbackSql: () => '',
        readAtelierDeckPostState: () => undefined,
        rollbackAtelierDecksOnPinnedClient: () => undefined,
      })
    ).not.toThrow();
  });
});

describe('materialize-atelier-decks — dry run is genuinely read-only', () => {
  let harness: Harness;
  let result: MaterializeRunResult;

  beforeEach(async () => {
    harness = makeHarness();
    result = await runMaterializeAtelierDecks(options(), harness.deps);
  });

  it('exits 0 and reports dry-run mode', () => {
    expect(result.exitCode).toBe(0);
    expect(result.mode).toBe('dry-run');
    expect(result.aborted).toBe(false);
  });

  it('issues ZERO write statements — every SQL it runs is a SELECT', () => {
    expect(harness.sqlSeen.length).toBeGreaterThan(0);
    for (const sql of harness.sqlSeen) {
      expect(sql.trim()).toMatch(/^SELECT\b/i);
      expect(sql).not.toMatch(/\b(INSERT|UPDATE|DELETE|TRUNCATE|DROP|ALTER|BEGIN|COMMIT)\b/i);
    }
    expect(harness.executorSpy).not.toHaveBeenCalled();
    expect(harness.postStateSpy).not.toHaveBeenCalled();
  });

  it('calls the read-only plan variant and never the applying seed', () => {
    expect(harness.planSpy).toHaveBeenCalledTimes(1);
    expect(harness.planSpy.mock.calls[0][0]).toMatchObject({ organizationId: ORG, dryRun: true });
    expect(harness.seedSpy).not.toHaveBeenCalled();
  });

  it('still runs the full preflight and produces the signed manifest', () => {
    expect(result.manifest).not.toBeNull();
    expect(result.gatesPassed).toEqual([
      'T0:--target=demo',
      'T1:demo-target-fingerprint',
      'T2:organization=atelier',
      'T3:organization_type=DEMO',
      'G4:backup-complete',
      'G5:signed-durable-manifest',
      'G6:no-foreign-content',
      `G7:no-active-editors(${ACTIVE_EDITOR_WINDOW_MINUTES}m)`,
    ]);
  });
});

describe('materialize-atelier-decks — target authority preflight (T0/T1)', () => {
  it('aborts when the environment flag is not exactly demo', async () => {
    const harness = makeHarness();
    const result = await runMaterializeAtelierDecks(
      options({ targetEnvironment: 'production' }),
      harness.deps
    );
    expect(result.exitCode).not.toBe(0);
    expect(result.abortReason).toMatch(/T0 target environment must be exactly "demo"/);
    expect(harness.seedSpy).not.toHaveBeenCalled();
    expect(harness.files.size).toBe(0);
  });

  it('aborts when --target is missing entirely', async () => {
    const harness = makeHarness();
    const result = await runMaterializeAtelierDecks(options({ targetEnvironment: '' }), harness.deps);
    expect(result.exitCode).not.toBe(0);
    expect(result.abortReason).toMatch(/T0/);
  });

  for (const element of DEMO_TARGET_ELEMENTS) {
    it(`aborts the whole run when the target fingerprint element ${element} is missing`, async () => {
      const env: NodeJS.ProcessEnv = { ...BASE_ENV };
      delete env[DECLARED_TARGET_ENV_VARS[element]];
      const harness = makeHarness({ env });
      const result = await runMaterializeAtelierDecks(options({ write: true }), harness.deps);
      expect(result.exitCode).not.toBe(0);
      expect(result.abortReason).toContain('T1 demo target authority refused');
      expect(result.abortReason).toContain(`[${element}]`);
      expect(result.targetRefusals.map((refusal) => refusal.element)).toContain(element);
      expect(harness.seedSpy).not.toHaveBeenCalled();
      expect(harness.files.size).toBe(0);
    });
  }

  it('aborts when the connection string has no explicit port', async () => {
    const harness = makeHarness({ port: '' });
    const result = await runMaterializeAtelierDecks(options({ write: true }), harness.deps);
    expect(result.exitCode).not.toBe(0);
    expect(result.abortReason).toContain('[databasePort]');
    expect(result.abortReason).toContain('no explicit port');
  });

  it('refuses a production-looking database host even when --target=demo', async () => {
    const harness = makeHarness({ host: 'centerbeam.proxy.rlwy.net' });
    const result = await runMaterializeAtelierDecks(options({ write: true }), harness.deps);
    expect(result.exitCode).not.toBe(0);
    expect(result.abortReason).toContain('[databaseHost]');
    expect(harness.files.size).toBe(0);
  });

  it('refuses a production environment name in the declared fingerprint', async () => {
    const harness = makeHarness({
      env: {
        ...BASE_ENV,
        [DECLARED_TARGET_ENV_VARS.railwayEnvironmentName]: 'production',
        [OBSERVED_TARGET_ENV_VARS.railwayEnvironmentName]: 'production',
      },
    });
    const result = await runMaterializeAtelierDecks(options({ write: true }), harness.deps);
    expect(result.exitCode).not.toBe(0);
    expect(result.abortReason).toContain('production-class environment');
  });

  it('refuses a non-demo consultify.ai origin', async () => {
    const harness = makeHarness({ env: { ...BASE_ENV, APP_URL: 'https://app.consultify.ai' } });
    const result = await runMaterializeAtelierDecks(options({ write: true }), harness.deps);
    expect(result.exitCode).not.toBe(0);
    expect(result.abortReason).toContain('[appOrigin]');
  });
});

describe('materialize-atelier-decks — organization gates (T2/T3)', () => {
  it('aborts for any organizationId other than atelier', async () => {
    const harness = makeHarness();
    const result = await runMaterializeAtelierDecks(
      options({ organizationId: 'demo-org' }),
      harness.deps
    );
    expect(result.exitCode).not.toBe(0);
    expect(result.abortReason).toMatch(/T2 organizationId must be exactly "atelier"/);
    expect(harness.files.size).toBe(0);
  });

  it('aborts when the atelier row is not organization_type=DEMO', async () => {
    const harness = makeHarness({
      organizationRow: { id: ORG, name: 'Atelier Toys', organization_type: 'CLIENT' },
    });
    const result = await runMaterializeAtelierDecks(options({ write: true }), harness.deps);
    expect(result.exitCode).not.toBe(0);
    expect(result.abortReason).toContain('T3 tenant class refused');
    expect(result.abortReason).toContain('organization_type="CLIENT"');
    expect(harness.seedSpy).not.toHaveBeenCalled();
    expect(harness.files.size).toBe(0);
  });

  it('aborts when the atelier row does not exist at all', async () => {
    const harness = makeHarness({ organizationRow: null });
    const result = await runMaterializeAtelierDecks(options({ write: true }), harness.deps);
    expect(result.exitCode).not.toBe(0);
    expect(result.abortReason).toContain('[organization]');
  });
});

describe('materialize-atelier-decks — confirmation token (G3)', () => {
  it('aborts --write without the confirmation token', async () => {
    const harness = makeHarness();
    const result = await runMaterializeAtelierDecks(options({ write: true }), harness.deps);
    expect(result.exitCode).not.toBe(0);
    expect(result.abortReason).toContain(`${MATERIALIZE_CONFIRM_ENV}=${MATERIALIZE_CONFIRM_VALUE}`);
    expect(harness.seedSpy).not.toHaveBeenCalled();
  });

  it('aborts --write when the token carries the wrong value', async () => {
    const harness = makeHarness({
      env: { ...BASE_ENV, [MATERIALIZE_CONFIRM_ENV]: 'REBUILD_CANONICAL_DEMO' },
    });
    const result = await runMaterializeAtelierDecks(options({ write: true }), harness.deps);
    expect(result.exitCode).not.toBe(0);
    expect(harness.seedSpy).not.toHaveBeenCalled();
  });

  it('proceeds to the write once the token is correct', async () => {
    const harness = makeHarness({ env: WRITE_ENV });
    const result = await runMaterializeAtelierDecks(options({ write: true }), harness.deps);
    expect(result.exitCode).toBe(0);
    expect(harness.seedSpy).toHaveBeenCalledTimes(1);
    expect(harness.seedSpy.mock.calls[0][0]).toMatchObject({ organizationId: ORG, force: false });
  });
});

describe('materialize-atelier-decks — an INCOMPLETE backup stops everything (G4)', () => {
  const incomplete = backupOf(SLUGS.map((slug) => backupRow(slug)), {
    entries: [
      { deckId: deckId(SLUGS[0]), state: 'exists', row: backupRow(SLUGS[0]), error: null },
      {
        deckId: deckId(SLUGS[1]),
        state: 'unknown',
        row: null,
        error: 'SELECT failed: connection reset',
      },
      { deckId: deckId(SLUGS[2]), state: 'verified_absent', row: null, error: null },
    ],
    complete: false,
  });

  it('aborts before any write and names the unknown deck id', async () => {
    const harness = makeHarness({ env: WRITE_ENV, backupBefore: incomplete });
    const result = await runMaterializeAtelierDecks(options({ write: true }), harness.deps);
    expect(result.exitCode).not.toBe(0);
    expect(result.abortReason).toContain('G4 backup is INCOMPLETE');
    expect(result.abortReason).toContain(deckId(SLUGS[1]));
    expect(result.abortReason).toContain('connection reset');
    expect(harness.seedSpy).not.toHaveBeenCalled();
    expect(harness.planSpy).not.toHaveBeenCalled();
  });

  it('emits NO rollback SQL at all — buildRollbackSql is never called and nothing is written', async () => {
    const harness = makeHarness({ env: WRITE_ENV, backupBefore: incomplete });
    await runMaterializeAtelierDecks(options({ write: true }), harness.deps);
    expect(harness.rollbackSqlSpy).not.toHaveBeenCalled();
    expect(harness.files.size).toBe(0);
    expect(harness.fsCalls).toEqual([]);
    const everythingWritten = [...harness.files.values()].join('\n');
    expect(everythingWritten).not.toMatch(/DELETE/i);
  });

  it('aborts a DRY RUN on an incomplete backup too', async () => {
    const harness = makeHarness({ backupBefore: incomplete });
    const result = await runMaterializeAtelierDecks(options(), harness.deps);
    expect(result.exitCode).not.toBe(0);
    expect(result.abortReason).toContain('G4 backup is INCOMPLETE');
    expect(harness.files.size).toBe(0);
  });
});

describe('materialize-atelier-decks — durable signed manifest (G5)', () => {
  it('refuses to run at all when the signing secret is absent', async () => {
    const env: NodeJS.ProcessEnv = { ...WRITE_ENV };
    delete env[MANIFEST_HMAC_SECRET_ENV];
    const harness = makeHarness({ env });
    const result = await runMaterializeAtelierDecks(options({ write: true }), harness.deps);
    expect(result.exitCode).not.toBe(0);
    expect(result.abortReason).toContain(MANIFEST_HMAC_SECRET_ENV);
    expect(harness.files.size).toBe(0);
    expect(harness.seedSpy).not.toHaveBeenCalled();
  });

  it('refuses to run when the key id is absent', async () => {
    const env: NodeJS.ProcessEnv = { ...WRITE_ENV };
    delete env[MANIFEST_HMAC_KEY_ID_ENV];
    const harness = makeHarness({ env });
    const result = await runMaterializeAtelierDecks(options({ write: true }), harness.deps);
    expect(result.exitCode).not.toBe(0);
    expect(result.abortReason).toContain(MANIFEST_HMAC_KEY_ID_ENV);
    expect(harness.files.size).toBe(0);
  });

  it('creates the directory 0700 and every file 0600', async () => {
    const harness = makeHarness({ env: WRITE_ENV });
    await runMaterializeAtelierDecks(options({ write: true }), harness.deps);
    const mkdirs = harness.fsCalls.filter((call) => call.op === 'mkdirSecure');
    const opens = harness.fsCalls.filter((call) => call.op === 'openForWrite');
    expect(mkdirs.length).toBeGreaterThan(0);
    // manifest.json + rollback.sql before the write, then manifest.json again
    // once the post-state fingerprint is folded into the signed payload.
    expect(opens.length).toBe(3);
    for (const call of mkdirs) expect(call.args[1]).toBe(MANIFEST_DIR_MODE);
    for (const call of opens) expect(call.args[1]).toBe(MANIFEST_FILE_MODE);
    expect(MANIFEST_DIR_MODE).toBe(0o700);
    expect(MANIFEST_FILE_MODE).toBe(0o600);
  });

  it('writes temp -> fsync(file) -> rename -> fsync(dir), in exactly that ORDER', async () => {
    const harness = makeHarness({ env: WRITE_ENV });
    await runMaterializeAtelierDecks(options({ write: true }), harness.deps);
    const ops = harness.fsCalls.map((call) => call.op);
    expect(ops.slice(0, 14)).toEqual([
      'mkdirSecure',
      'openForWrite',
      'writeAll',
      'fsyncFile',
      'closeFile',
      'renameFile',
      'fsyncDirectory',
      'mkdirSecure',
      'openForWrite',
      'writeAll',
      'fsyncFile',
      'closeFile',
      'renameFile',
      'fsyncDirectory',
    ]);
    // the post-state re-write is durable in exactly the same way
    expect(ops.slice(14)).toEqual([
      'mkdirSecure',
      'openForWrite',
      'writeAll',
      'fsyncFile',
      'closeFile',
      'renameFile',
      'fsyncDirectory',
    ]);
    // the file opened for writing is a TEMP path, never the destination
    const [temporaryPath] = harness.fsCalls.find((call) => call.op === 'openForWrite')!.args as string[];
    const [from, to] = harness.fsCalls.find((call) => call.op === 'renameFile')!.args as string[];
    expect(temporaryPath).toBe(from);
    expect(temporaryPath).not.toBe(to);
    expect(temporaryPath).toContain('.tmp-');
    expect(to).toMatch(/manifest\.json$/);
  });

  it('is durable BEFORE the plan and long before the transaction', async () => {
    const harness = makeHarness({ env: WRITE_ENV });
    await runMaterializeAtelierDecks(options({ write: true }), harness.deps);
    const manifestIndex = harness.calls.indexOf('file:manifest.json');
    const rollbackIndex = harness.calls.indexOf('file:rollback.sql');
    const seedIndex = harness.calls.indexOf('seed');
    const planIndex = harness.calls.indexOf('plan');
    expect(manifestIndex).toBeGreaterThanOrEqual(0);
    expect(rollbackIndex).toBeGreaterThan(manifestIndex);
    expect(planIndex).toBeGreaterThan(rollbackIndex);
    expect(seedIndex).toBeGreaterThan(planIndex);
  });

  it('carries the FULL target fingerprint and the FULL 24-column rows', async () => {
    const harness = makeHarness({ env: WRITE_ENV });
    const result = await runMaterializeAtelierDecks(options({ write: true }), harness.deps);
    const manifest = result.manifest!;
    expect(manifest.target.fingerprint).toEqual(TARGET_VALUES);
    expect(manifest.target.digest).toMatch(/^[0-9a-f]{64}$/);
    expect(manifest.organizationType).toBe('DEMO');
    expect(manifest.deckIds).toEqual(SLUGS.map(deckId));
    expect(manifest.backup.complete).toBe(true);
    expect(manifest.backup.entries).toHaveLength(3);
    for (const entry of manifest.backup.entries) {
      expect(entry.state).toBe('exists');
      for (const column of ATELIER_DECK_BACKUP_COLUMNS) {
        expect(entry.row).toHaveProperty(column);
      }
      expect(entry.row).toHaveProperty('id');
      expect(entry.row).toHaveProperty('organization_id');
    }
    expect(ATELIER_DECK_BACKUP_COLUMNS).toHaveLength(24);
  });

  it('verifies under the runtime key, and the on-disk bytes are the signed bytes', async () => {
    const harness = makeHarness({ env: WRITE_ENV });
    const result = await runMaterializeAtelierDecks(options({ write: true }), harness.deps);
    const file = manifestFileOf(harness);
    expect(file.path).toBe(result.manifest!.manifestPath);
    const verified = verifyManifestEnvelope(file.contents, { keyId: KEY_ID, secret: SECRET });
    expect(verified.ok).toBe(true);
    if (verified.ok) {
      expect(verified.envelope.keyId).toBe(KEY_ID);
      expect(verified.manifest.target.digest).toBe(result.manifest!.target.digest);
      expect(verified.manifest.backup.entries[0].row?.title).toBe(`Deck ${SLUGS[0]}`);
    }
  });
});

describe('materialize-atelier-decks — a TAMPERED manifest is refused', () => {
  let original: string;

  beforeEach(async () => {
    const harness = makeHarness({ env: WRITE_ENV });
    await runMaterializeAtelierDecks(options({ write: true }), harness.deps);
    original = manifestFileOf(harness).contents;
  });

  const verify = (contents: string) =>
    verifyManifestEnvelope(contents, { keyId: KEY_ID, secret: SECRET });

  it('refuses a single mutated BYTE in the payload', () => {
    const envelope = JSON.parse(original) as SignedManifestEnvelope;
    const index = envelope.payload.indexOf('atelier');
    envelope.payload =
      envelope.payload.slice(0, index) + 'Atelier' + envelope.payload.slice(index + 'atelier'.length);
    const result = verify(JSON.stringify(envelope, null, 2));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain('HMAC does not verify');
  });

  it('refuses a mutated ROW inside the backup', () => {
    const envelope = JSON.parse(original) as SignedManifestEnvelope;
    const payload = JSON.parse(envelope.payload) as { backup: AtelierDeckBackup };
    payload.backup.entries[1].row!.deck_json = JSON.stringify({ cards: [{ id: 'injected' }] });
    envelope.payload = JSON.stringify(payload);
    const result = verify(JSON.stringify(envelope, null, 2));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain('HMAC does not verify');
  });

  it('refuses a mutated target FINGERPRINT', () => {
    const envelope = JSON.parse(original) as SignedManifestEnvelope;
    const payload = JSON.parse(envelope.payload) as {
      target: { fingerprint: Record<string, string> };
    };
    payload.target.fingerprint.databaseHost = 'centerbeam.proxy.rlwy.net';
    envelope.payload = JSON.stringify(payload);
    const result = verify(JSON.stringify(envelope, null, 2));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain('HMAC does not verify');
  });

  it('refuses a mutated SIGNATURE', () => {
    const envelope = JSON.parse(original) as SignedManifestEnvelope;
    envelope.signature = envelope.signature.replace(/^./, (c) => (c === 'a' ? 'b' : 'a'));
    const result = verify(JSON.stringify(envelope, null, 2));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain('HMAC does not verify');
  });

  it('refuses a manifest signed with a DIFFERENT KEY ID', () => {
    const envelope = JSON.parse(original) as SignedManifestEnvelope;
    const relabelled = verifyManifestEnvelope(JSON.stringify(envelope), {
      keyId: 'mat006b-2026-09-rotated',
      secret: SECRET,
    });
    expect(relabelled.ok).toBe(false);
    if (!relabelled.ok) {
      expect(relabelled.reason).toContain('key id');
      expect(relabelled.reason).toContain('mat006b-2026-09-rotated');
    }
  });

  it('refuses a manifest re-signed under a different SECRET', () => {
    const envelope = JSON.parse(original) as SignedManifestEnvelope;
    const result = verifyManifestEnvelope(JSON.stringify(envelope), {
      keyId: KEY_ID,
      secret: 'attacker-secret',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain('HMAC does not verify');
  });

  it('refuses a downgraded envelope version and an unknown algorithm', () => {
    const downgraded = JSON.parse(original) as SignedManifestEnvelope;
    downgraded.envelopeVersion = 0;
    expect(verify(JSON.stringify(downgraded)).ok).toBe(false);
    const swapped = JSON.parse(original) as SignedManifestEnvelope;
    swapped.algorithm = 'none';
    expect(verify(JSON.stringify(swapped)).ok).toBe(false);
  });
});

describe('materialize-atelier-decks — the manifest survives a crash', () => {
  it('survives a failure injected BEFORE COMMIT (the seed transaction throws)', async () => {
    const harness = makeHarness({ env: WRITE_ENV, seedThrows: new Error('connection died mid-BEGIN') });
    const result = await runMaterializeAtelierDecks(options({ write: true }), harness.deps);
    expect(result.exitCode).not.toBe(0);
    expect(result.abortReason).toContain('G8 seed threw');
    const file = manifestFileOf(harness);
    expect(verifyManifestEnvelope(file.contents, { keyId: KEY_ID, secret: SECRET }).ok).toBe(true);
    expect(harness.logs.join('\n')).toContain(result.manifest!.manifestPath);
  });

  it('survives a failure injected AFTER COMMIT (the read-back throws)', async () => {
    const harness = makeHarness({
      env: WRITE_ENV,
      backupAfterThrows: new Error('read-back connection reset after COMMIT'),
    });
    const result = await runMaterializeAtelierDecks(options({ write: true }), harness.deps);
    expect(result.exitCode).toBe(1);
    expect(result.abortReason).toContain('G9 read-back failed');
    expect(harness.seedSpy).toHaveBeenCalledTimes(1);
    const file = manifestFileOf(harness);
    const verified = verifyManifestEnvelope(file.contents, { keyId: KEY_ID, secret: SECRET });
    expect(verified.ok).toBe(true);
    if (verified.ok) expect(verified.manifest.backup.complete).toBe(true);
    expect(harness.logs.join('\n')).toContain('RECOVERY ANCHOR');
  });

  it('is on disk before the transaction is even attempted', async () => {
    const harness = makeHarness({ env: WRITE_ENV, seedThrows: new Error('boom') });
    await runMaterializeAtelierDecks(options({ write: true }), harness.deps);
    const renameIndex = harness.fsCalls.findIndex((call) => call.op === 'renameFile');
    expect(renameIndex).toBeGreaterThanOrEqual(0);
    expect(harness.calls.indexOf('file:manifest.json')).toBeLessThan(harness.calls.indexOf('seed'));
  });
});

describe('materialize-atelier-decks — rollback repeats the preflight (R1..R6)', () => {
  async function writeManifest(harnessConfig: Parameters<typeof makeHarness>[0] = {}) {
    const files = new Map<string, string>();
    const harness = makeHarness({ env: WRITE_ENV, files, ...harnessConfig });
    const result = await runMaterializeAtelierDecks(options({ write: true }), harness.deps);
    expect(result.manifest).not.toBeNull();
    return { files, manifestPath: result.manifest!.manifestPath, digest: result.manifest!.target.digest };
  }

  it('delegates the restore to the transactional executor and prints RESTORED on ok:true', async () => {
    const { files, manifestPath } = await writeManifest();
    const harness = makeHarness({ env: ROLLBACK_ENV, files });
    const result = await runMaterializeAtelierDecks(
      options({ rollback: true, manifestPath }),
      harness.deps
    );
    expect(result.exitCode).toBe(0);
    expect(result.restored).toBe(true);
    expect(result.gatesPassed).toEqual([
      'T0:--target=demo',
      'T1:demo-target-fingerprint',
      'T2:organization=atelier',
      'T3:organization_type=DEMO',
      'R1:same-preflight-as-write',
      `R2:hmac-verified(keyId=${KEY_ID})`,
      'R3:target-fingerprint-unchanged',
      'R4:preconditions-hold',
      'R5:confirmation-token',
      'R6:restored(pinned-pg,cas)',
    ]);
    expect(harness.executorSpy).toHaveBeenCalledTimes(1);
    expect(harness.logs.join('\n')).toContain('RESTORED');
  });

  it('hands the executor the tenant, the 24-column backup and the manifest CAS target', async () => {
    const { files, manifestPath } = await writeManifest();
    const harness = makeHarness({ env: ROLLBACK_ENV, files });
    await runMaterializeAtelierDecks(options({ rollback: true, manifestPath }), harness.deps);
    const input = harness.executorSpy.mock.calls[0][0] as {
      organizationId: string;
      backup: AtelierDeckBackup;
      expectedPostState: AtelierDeckPostState[];
    };
    expect(input.organizationId).toBe(ORG);
    expect(input.backup.complete).toBe(true);
    expect(input.expectedPostState).toEqual(POST_STATE);
    for (const column of ATELIER_DECK_BACKUP_COLUMNS) {
      expect(input.backup.entries[0].row).toHaveProperty(column);
    }
    // The tool never executes SQL of its own any more: every statement it sent
    // in this process is still a SELECT.
    for (const sql of harness.sqlSeen) expect(sql.trim()).toMatch(/^SELECT\b/i);
  });

  it('REFUSES when the target fingerprint changed since the manifest was written', async () => {
    const { files, manifestPath } = await writeManifest();
    // A different, perfectly legitimate demo-shaped target: same canon, other host.
    const movedValues = { ...TARGET_VALUES, databaseHost: 'switchback.proxy.rlwy.net' };
    const harness = makeHarness({
      env: { ...targetEnv(movedValues), ...SIGNING_ENV, [ROLLBACK_CONFIRM_ENV]: ROLLBACK_CONFIRM_VALUE },
      host: 'switchback.proxy.rlwy.net',
      files,
    });
    const result = await runMaterializeAtelierDecks(
      options({ rollback: true, manifestPath }),
      harness.deps
    );
    expect(result.exitCode).not.toBe(0);
    expect(result.abortReason).toContain('R3 target fingerprint CHANGED');
    expect(harness.executorSpy).not.toHaveBeenCalled();
  });

  it('REFUSES a rollback whose preflight fails, before reading the manifest', async () => {
    const { files, manifestPath } = await writeManifest();
    const harness = makeHarness({ env: ROLLBACK_ENV, host: 'centerbeam.proxy.rlwy.net', files });
    const result = await runMaterializeAtelierDecks(
      options({ rollback: true, manifestPath }),
      harness.deps
    );
    expect(result.exitCode).not.toBe(0);
    expect(result.abortReason).toContain('[databaseHost]');
    expect(harness.fsCalls.filter((call) => call.op === 'readTextFile')).toHaveLength(0);
    expect(harness.executorSpy).not.toHaveBeenCalled();
  });

  it('REFUSES a rollback when the tenant is no longer organization_type=DEMO', async () => {
    const { files, manifestPath } = await writeManifest();
    const harness = makeHarness({
      env: ROLLBACK_ENV,
      files,
      organizationRow: { id: ORG, organization_type: 'CLIENT' },
    });
    const result = await runMaterializeAtelierDecks(
      options({ rollback: true, manifestPath }),
      harness.deps
    );
    expect(result.exitCode).not.toBe(0);
    expect(result.abortReason).toContain('T3 tenant class refused');
    expect(harness.executorSpy).not.toHaveBeenCalled();
  });

  it('REFUSES a tampered manifest end to end', async () => {
    const { files, manifestPath } = await writeManifest();
    const envelope = JSON.parse(files.get(manifestPath)!) as SignedManifestEnvelope;
    const payload = JSON.parse(envelope.payload) as { rollbackSql: string };
    payload.rollbackSql = 'DELETE FROM presentation_decks;';
    envelope.payload = JSON.stringify(payload);
    files.set(manifestPath, JSON.stringify(envelope, null, 2));

    const harness = makeHarness({ env: ROLLBACK_ENV, files });
    const result = await runMaterializeAtelierDecks(
      options({ rollback: true, manifestPath }),
      harness.deps
    );
    expect(result.exitCode).not.toBe(0);
    expect(result.abortReason).toContain('HMAC does not verify');
    expect(harness.executorSpy).not.toHaveBeenCalled();
  });

  it('REFUSES without the rollback confirmation token', async () => {
    const { files, manifestPath } = await writeManifest();
    const harness = makeHarness({ env: BASE_ENV, files });
    const result = await runMaterializeAtelierDecks(
      options({ rollback: true, manifestPath }),
      harness.deps
    );
    expect(result.exitCode).not.toBe(0);
    expect(result.abortReason).toContain(`${ROLLBACK_CONFIRM_ENV}=${ROLLBACK_CONFIRM_VALUE}`);
    expect(harness.executorSpy).not.toHaveBeenCalled();
  });

  it('REFUSES when someone is mid-edit on the decks it would overwrite', async () => {
    const { files, manifestPath } = await writeManifest();
    const harness = makeHarness({
      env: ROLLBACK_ENV,
      files,
      rows: {
        deck_collab_sessions: [
          { deck_id: deckId(SLUGS[0]), user_id: 'user-7', last_heartbeat_at: '2026-08-01T11:59:00.000Z' },
        ],
      },
    });
    const result = await runMaterializeAtelierDecks(
      options({ rollback: true, manifestPath }),
      harness.deps
    );
    expect(result.exitCode).not.toBe(0);
    expect(result.abortReason).toContain('R4');
    expect(harness.executorSpy).not.toHaveBeenCalled();
  });

  it('REFUSES without --manifest', async () => {
    const harness = makeHarness({ env: ROLLBACK_ENV });
    const result = await runMaterializeAtelierDecks(options({ rollback: true }), harness.deps);
    expect(result.exitCode).not.toBe(0);
    expect(result.abortReason).toContain('R0 --rollback requires --manifest');
  });

  for (const stage of ROLLBACK_STAGES) {
    it(`does not pretend to restore when the executor stops at stage "${stage}"`, async () => {
      const { files, manifestPath } = await writeManifest();
      const harness = makeHarness({
        env: ROLLBACK_ENV,
        files,
        rollbackOutcome: {
          ok: false,
          restored: false,
          stage,
          reason: `the executor stopped at ${stage}.`,
        },
      });
      const result = await runMaterializeAtelierDecks(
        options({ rollback: true, manifestPath }),
        harness.deps
      );
      expect(result.exitCode).not.toBe(0);
      expect(result.restored).toBe(false);
      // The stage is NAMED, so the operator learns where it stopped.
      expect(result.abortReason).toContain(`stage=${stage}`);
      expect(result.abortReason).toContain(`the executor stopped at ${stage}.`);
      expect(result.gatesPassed).not.toContain('R6:restored(pinned-pg,cas)');
      expect(harness.logs.join('\n')).not.toContain('RESTORED');
      // A DETERMINATE stage is one where the executor stopped BEFORE COMMIT, so
      // this wording is licensed here and must NOT be softened by the ambiguous
      // path's arrival. Exit code 2 (refused) is likewise unchanged.
      expect(result.exitCode).toBe(2);
      expect(result.abortReason).toContain(
        'The executor rolled its own transaction back, so nothing was changed.'
      );
      expect(result.needsOperator).toBe(false);
      expect(result.rollbackObserved).toBeNull();
    });
  }

  it('treats a throwing executor as a failed restore rather than dying mid-report', async () => {
    const { files, manifestPath } = await writeManifest();
    const harness = makeHarness({
      env: ROLLBACK_ENV,
      files,
      rollbackExecutorThrows: new Error('pool exploded'),
    });
    const result = await runMaterializeAtelierDecks(
      options({ rollback: true, manifestPath }),
      harness.deps
    );
    expect(result.exitCode).not.toBe(0);
    expect(result.restored).toBe(false);
    expect(result.abortReason).toContain('which its contract forbids');
    expect(harness.logs.join('\n')).not.toContain('RESTORED');
  });

  it('REFUSES a manifest written before postState existed, instead of guessing', async () => {
    const { files, manifestPath } = await writeManifest();
    // A pre-R4 manifest: no `postState` key at all, validly signed by this key.
    const envelope = JSON.parse(files.get(manifestPath)!) as SignedManifestEnvelope;
    const payload = JSON.parse(envelope.payload) as Record<string, unknown>;
    expect(payload.postState).toBeDefined();
    delete payload.postState;
    files.set(
      manifestPath,
      serializeSignedManifest(
        signManifest(payload as unknown as RollbackManifest, { keyId: KEY_ID, secret: SECRET })
      )
    );

    const harness = makeHarness({ env: ROLLBACK_ENV, files });
    const result = await runMaterializeAtelierDecks(
      options({ rollback: true, manifestPath }),
      harness.deps
    );
    // The signature is VALID — this is refused on substance, not on tampering.
    expect(result.gatesPassed).toContain(`R2:hmac-verified(keyId=${KEY_ID})`);
    expect(result.exitCode).not.toBe(0);
    expect(result.restored).toBe(false);
    expect(result.abortReason).toContain('carries no postState fingerprint');
    expect(harness.executorSpy).not.toHaveBeenCalled();
    expect(harness.logs.join('\n')).not.toContain('RESTORED');
  });

  it('REFUSES a manifest whose postState is an empty array', async () => {
    const { files, manifestPath } = await writeManifest({ postState: [], seedResult: seedResult({ postState: [] }) });
    const harness = makeHarness({ env: ROLLBACK_ENV, files });
    const result = await runMaterializeAtelierDecks(
      options({ rollback: true, manifestPath }),
      harness.deps
    );
    expect(result.exitCode).not.toBe(0);
    expect(result.abortReason).toContain('carries no postState fingerprint');
    expect(harness.executorSpy).not.toHaveBeenCalled();
  });
});

describe('materialize-atelier-decks — the CAS target lives INSIDE the signature', () => {
  async function writeManifest(harnessConfig: Parameters<typeof makeHarness>[0] = {}) {
    const files = new Map<string, string>();
    const harness = makeHarness({ env: WRITE_ENV, files, ...harnessConfig });
    const result = await runMaterializeAtelierDecks(options({ write: true }), harness.deps);
    return { files, harness, result, manifestPath: result.manifest!.manifestPath };
  }

  it('folds postState into the SIGNED payload after a successful materialization', async () => {
    const { files, manifestPath, result } = await writeManifest();
    expect(result.exitCode).toBe(0);
    expect(result.gatesPassed).toContain('G10:post-state-in-signed-manifest');

    const verified = verifyManifestEnvelope(files.get(manifestPath)!, {
      keyId: KEY_ID,
      secret: SECRET,
    });
    expect(verified.ok).toBe(true);
    if (!verified.ok) return;
    expect(verified.manifest.postState).toEqual(POST_STATE);
    // Not merely returned in memory — it is what is on disk, under the HMAC.
    expect(JSON.parse(files.get(manifestPath)!).payload).toContain('postState');
  });

  it('cannot have its postState swapped: the signature covers it', async () => {
    const { files, manifestPath } = await writeManifest();
    const envelope = JSON.parse(files.get(manifestPath)!) as SignedManifestEnvelope;
    const payload = JSON.parse(envelope.payload) as RollbackManifest;
    payload.postState = POST_STATE.map((entry) => ({ ...entry, version: 99 }));
    envelope.payload = JSON.stringify(payload);
    files.set(manifestPath, JSON.stringify(envelope, null, 2));

    expect(verifyManifestEnvelope(files.get(manifestPath)!, { keyId: KEY_ID, secret: SECRET }).ok).toBe(
      false
    );

    const harness = makeHarness({ env: ROLLBACK_ENV, files });
    const result = await runMaterializeAtelierDecks(
      options({ rollback: true, manifestPath }),
      harness.deps
    );
    expect(result.exitCode).not.toBe(0);
    expect(result.abortReason).toContain('HMAC does not verify');
    expect(harness.executorSpy).not.toHaveBeenCalled();
  });

  it('records the post-state even when the seed THREW, so the crash is still recoverable', async () => {
    // The seed dies before it ever reaches the anchor, so the SALVAGE path is
    // what puts a compare-and-swap target on disk. It is a late anchor, and the
    // run is failed either way — but the operator still gets a way back.
    const { files, manifestPath, harness, result } = await writeManifest({
      seedThrows: new Error('connection died mid-BEGIN'),
    });
    expect(result.exitCode).not.toBe(0);
    expect(harness.anchorCalls).toHaveLength(0);
    expect(harness.postStateSpy).toHaveBeenCalledWith(ORG);
    const verified = verifyManifestEnvelope(files.get(manifestPath)!, {
      keyId: KEY_ID,
      secret: SECRET,
    });
    expect(verified.ok).toBe(true);
    if (verified.ok) expect(verified.manifest.postState).toEqual(POST_STATE);
    // …and it is labelled as the salvage it is, never as a timely anchor.
    expect(harness.logs.join('\n')).toContain('NOT a pre-COMMIT recovery anchor');
  });

  it('does NOT report a materialization whose way back was written after the fact', async () => {
    // A seed that ignores `persistRecoveryAnchor`: the rows verify 3/3, and the
    // run is STILL failed, because for the length of the transaction the
    // database had changed and no manifest on disk could have driven a rollback.
    const { harness, result } = await writeManifest({ skipRecoveryAnchor: true });
    expect(result.exitCode).toBe(1);
    expect(harness.anchorCalls).toHaveLength(0);
    expect(result.abortReason).toContain('G10 no pre-COMMIT recovery anchor');
    // The rows themselves verified — this is about WHEN the way back was written.
    expect(result.verification!.every((row) => row.ok)).toBe(true);
    expect(result.gatesPassed).not.toContain('G10a:recovery-anchor-durable-pre-commit');
    expect(result.gatesPassed).not.toContain('G10:post-state-in-signed-manifest');
    const output = harness.logs.join('\n');
    for (const wording of SUCCESS_WORDING) expect(output).not.toMatch(wording);
  });

  it('does NOT report a materialization it cannot undo (no post-state captured at all)', async () => {
    const { harness, result } = await writeManifest({
      skipRecoveryAnchor: true,
      seedResult: seedResult({ postState: [] }),
      postStateThrows: new Error('post-state read timed out'),
    });
    expect(result.exitCode).toBe(1);
    expect(result.abortReason).toContain('G10 no pre-COMMIT recovery anchor');
    expect(result.manifest!.postState).toEqual([]);
    expect(result.verification!.every((row) => row.ok)).toBe(true);
    const output = harness.logs.join('\n');
    expect(output).toContain('psql "$DATABASE_PUBLIC_URL" -f');
    expect(output).not.toMatch(/materialized and verified/);
  });
});

// ---------------------------------------------------------------------------
// Contract R5 §3/§4/§5 — an ambiguous COMMIT is not a rollback
// ---------------------------------------------------------------------------

/**
 * ★ The three sentences this tool must never say about a database whose state it
 * does not know. They are regexes rather than string matches because each of
 * them has several natural phrasings and the point is that NONE of them appears.
 */
const BANNED_WHEN_INDETERMINATE = [
  /nothing was changed/i,
  /nothing was restored/i,
  /rolled (its own )?transaction back/i,
];

const INDETERMINATE_OBSERVED = [
  { deckId: deckId(SLUGS[0]), matches: 'pre-state' as const },
  { deckId: deckId(SLUGS[1]), matches: 'post-state' as const },
  { deckId: deckId(SLUGS[2]), matches: 'unreadable' as const },
];

function indeterminateOutcome(
  overrides: Partial<Extract<RollbackOutcome, { stage: 'indeterminate' }>> = {}
): RollbackOutcome {
  return {
    ok: false,
    restored: false,
    stage: 'indeterminate',
    needsOperator: true,
    observed: INDETERMINATE_OBSERVED,
    reason: 'the connection dropped while COMMIT was in flight; the server never answered.',
    ...overrides,
  };
}

describe('materialize-atelier-decks — an INDETERMINATE rollback (R5 §3/§5)', () => {
  async function writeManifest(harnessConfig: Parameters<typeof makeHarness>[0] = {}) {
    const files = new Map<string, string>();
    const harness = makeHarness({ env: WRITE_ENV, files, ...harnessConfig });
    const result = await runMaterializeAtelierDecks(options({ write: true }), harness.deps);
    expect(result.exitCode).toBe(0);
    return { files, manifestPath: result.manifest!.manifestPath };
  }

  async function rollback(outcome: RollbackOutcome = indeterminateOutcome()) {
    const { files, manifestPath } = await writeManifest();
    const harness = makeHarness({ env: ROLLBACK_ENV, files, rollbackOutcome: outcome });
    const result = await runMaterializeAtelierDecks(
      options({ rollback: true, manifestPath }),
      harness.deps
    );
    return { harness, result, manifestPath, output: harness.logs.join('\n') };
  }

  it('exits NON-ZERO and does not claim a restore', async () => {
    const { result } = await rollback();
    expect(result.exitCode).not.toBe(0);
    expect(result.exitCode).toBe(1);
    expect(result.restored).toBe(false);
    expect(result.needsOperator).toBe(true);
    expect(result.gatesPassed).not.toContain('R6:restored(pinned-pg,cas)');
  });

  it('prints the CURRENT state read from the database, per deck id', async () => {
    const { result, output } = await rollback();
    expect(output).toContain('read on a FRESH connection after the ambiguous COMMIT');
    for (const observation of INDETERMINATE_OBSERVED) {
      expect(output).toMatch(
        new RegExp(`${observation.deckId}\\s+${observation.matches}`)
      );
    }
    // Not merely printed — carried on the result, so a caller can act on it.
    expect(result.rollbackObserved).toEqual(INDETERMINATE_OBSERVED);
    // …and summarised without rounding any of it away.
    expect(output).toContain('1 pre-state, 1 post-state, 1 unreadable');
  });

  it('prints the manifest path', async () => {
    const { output, manifestPath } = await rollback();
    expect(output).toContain('SIGNED MANIFEST');
    expect(output).toContain(manifestPath);
  });

  it('prints a safe, ordered operator instruction', async () => {
    const { output } = await rollback();
    expect(output).toContain('OPERATOR ACTION REQUIRED');
    expect(output).toContain('WHAT TO DO:');
    // The instruction is a READ first, and it names the rows to read.
    expect(output).toContain('SELECT id, organization_id, version, slide_count, status, updated_at');
    for (const slug of SLUGS) expect(output).toContain(deckId(slug));
    // Escalate rather than act when a row is unreadable or unrecognised.
    expect(output).toContain('stop and escalate');
  });

  it('prints an explicit do-not-re-run-blind warning', async () => {
    const { output } = await rollback();
    expect(output).toContain(DO_NOT_RERUN_BLIND_WARNING);
    expect(output).toMatch(/DO NOT RE-RUN THIS COMMAND BLIND/);
  });

  it('★ says NONE of the three sentences it cannot know to be true', async () => {
    const { result, output } = await rollback();
    for (const banned of BANNED_WHEN_INDETERMINATE) {
      expect(output).not.toMatch(banned);
      expect(result.abortReason ?? '').not.toMatch(banned);
    }
    // Nor any of the success wording, in any of its forms.
    for (const wording of SUCCESS_WORDING) expect(output).not.toMatch(wording);
    // What it says instead: it OBSERVED, and it makes no claim.
    expect(result.abortReason).toContain('INDETERMINATE');
    expect(result.abortReason).toContain('makes no claim about the rows');
  });

  it('★ never reaches the determinate wording, even though that branch is next', async () => {
    // The determinate branch is one `if` below and its text is licensed only by
    // a pre-COMMIT stop. Falling through to it is the specific bug under test.
    const { output, result } = await rollback();
    expect(output).not.toContain('did NOT restore');
    expect(result.abortReason).not.toContain('did NOT restore');
  });

  it('says so plainly when the executor could not observe ANY row', async () => {
    const { output, result } = await rollback(indeterminateOutcome({ observed: [] }));
    expect(result.exitCode).not.toBe(0);
    expect(output).toContain('NO per-deck observations');
    expect(output).toContain('nothing at all is known about the rows');
    for (const banned of BANNED_WHEN_INDETERMINATE) expect(output).not.toMatch(banned);
  });

  it('carries the executor reason through verbatim', async () => {
    const { output, result } = await rollback();
    const reason = 'the connection dropped while COMMIT was in flight; the server never answered.';
    expect(output).toContain(reason);
    expect(result.abortReason).toContain(reason);
  });
});

// ---------------------------------------------------------------------------
// Contract R5b §C2 — the three ambiguous readings are worded SEPARATELY, and a
// determinate stage can no longer carry one
// ---------------------------------------------------------------------------

const OBSERVED_ALL_POST: RollbackObservation[] = SLUGS.map((slug) => ({
  deckId: deckId(slug),
  matches: 'post-state' as const,
}));
const OBSERVED_ALL_UNREADABLE: RollbackObservation[] = SLUGS.map((slug) => ({
  deckId: deckId(slug),
  matches: 'unreadable' as const,
}));

const VERDICT_FIXTURES: Record<
  RollbackIndeterminateVerdict,
  { observed: RollbackObservation[]; reason: string }
> = {
  'not-applied': {
    observed: OBSERVED_ALL_POST,
    reason: 'the proxy timed out while COMMIT was in flight; the server never answered.',
  },
  mixed: {
    observed: INDETERMINATE_OBSERVED,
    reason: 'the socket was reset while COMMIT was in flight; the server never answered.',
  },
  unreadable: {
    observed: OBSERVED_ALL_UNREADABLE,
    reason: 'the reconciling connection could not take the advisory lock, so it did not read.',
  },
};

/**
 * ★ Phrases that must appear in EXACTLY ONE of the three reports. Wording the
 * three readings apart is the whole point of the discriminator; a shared,
 * hedged paragraph would satisfy every other assertion here while losing the
 * distinction the operator acts on.
 */
const DISTINCTIVE: Record<RollbackIndeterminateVerdict, RegExp[]> = {
  'not-applied': [
    /EVERY deck row still carrying the post-materialization state/,
    /the restore did not land/,
    // Steps 3+4 of "re-read, then re-run the whole command" are deliberately
    // shared with `unreadable`; this clause is not.
    /Never re-issue the restore write alone/,
  ],
  mixed: [/the deck rows in\s+DIFFERENT states/, /do not agree with one another/],
  unreadable: [
    /could not establish the state of the rows AT ALL/,
    /still be HOLDING the advisory\s+lock/,
    /pg_locks/,
  ],
};

describe('materialize-atelier-decks — each ambiguous READING is worded on its own (R5b §C2)', () => {
  async function writeManifest() {
    const files = new Map<string, string>();
    const harness = makeHarness({ env: WRITE_ENV, files });
    const result = await runMaterializeAtelierDecks(options({ write: true }), harness.deps);
    expect(result.exitCode).toBe(0);
    return { files, manifestPath: result.manifest!.manifestPath };
  }

  async function rollbackWith(outcome: RollbackOutcome) {
    const { files, manifestPath } = await writeManifest();
    const harness = makeHarness({ env: ROLLBACK_ENV, files, rollbackOutcome: outcome });
    const result = await runMaterializeAtelierDecks(
      options({ rollback: true, manifestPath }),
      harness.deps
    );
    return { harness, result, manifestPath, output: harness.logs.join('\n') };
  }

  function outcomeFor(verdict: RollbackIndeterminateVerdict): RollbackOutcome {
    return indeterminateOutcome({ verdict, ...VERDICT_FIXTURES[verdict] });
  }

  for (const verdict of ROLLBACK_INDETERMINATE_VERDICTS) {
    describe(`verdict "${verdict}"`, () => {
      it('exits NON-ZERO, claims no restore, and names the reading', async () => {
        const { result } = await rollbackWith(outcomeFor(verdict));
        expect(result.exitCode).toBe(1);
        expect(result.restored).toBe(false);
        expect(result.needsOperator).toBe(true);
        expect(result.rollbackVerdict).toBe(verdict);
        expect(result.gatesPassed).not.toContain('R6:restored(pinned-pg,cas)');
        expect(result.abortReason).toContain(`verdict=${verdict}`);
        expect(result.abortReason).toContain('stage=indeterminate');
      });

      it('prints the per-deck observed state, the manifest, an instruction and the warning', async () => {
        const { output, result, manifestPath } = await rollbackWith(outcomeFor(verdict));
        // The observed state, per deck id — printed, and carried on the result.
        for (const observation of VERDICT_FIXTURES[verdict].observed) {
          expect(output).toMatch(new RegExp(`${observation.deckId}\\s+${observation.matches}`));
        }
        expect(result.rollbackObserved).toEqual(VERDICT_FIXTURES[verdict].observed);
        expect(output).toContain(`RECONCILIATION VERDICT: ${verdict}`);
        // The manifest path…
        expect(output).toContain('SIGNED MANIFEST');
        expect(output).toContain(manifestPath);
        // …an ordered operator instruction that starts by READING…
        expect(output).toContain('WHAT TO DO:');
        expect(output).toContain(
          'SELECT id, organization_id, version, slide_count, status, updated_at'
        );
        // …and the do-not-re-run-blind warning, verbatim.
        expect(output).toContain(DO_NOT_RERUN_BLIND_WARNING);
        // The executor's own reason survives verbatim, in both places.
        expect(output).toContain(VERDICT_FIXTURES[verdict].reason);
        expect(result.abortReason).toContain(VERDICT_FIXTURES[verdict].reason);
      });

      it('★ says NONE of the three sentences an unanswered COMMIT forbids', async () => {
        const { output, result } = await rollbackWith(outcomeFor(verdict));
        for (const banned of BANNED_WHEN_INDETERMINATE) {
          expect(output).not.toMatch(banned);
          expect(result.abortReason ?? '').not.toMatch(banned);
        }
        // Nor the determinate branch's headline, which is one `if` further down.
        expect(output).not.toContain('did NOT restore');
        expect(result.abortReason).not.toContain('did NOT restore');
        for (const wording of SUCCESS_WORDING) expect(output).not.toMatch(wording);
      });

      it('★ is worded DIFFERENTLY from the other two readings', async () => {
        const { output } = await rollbackWith(outcomeFor(verdict));
        for (const [other, phrases] of Object.entries(DISTINCTIVE) as Array<
          [RollbackIndeterminateVerdict, RegExp[]]
        >) {
          for (const phrase of phrases) {
            if (other === verdict) expect(output).toMatch(phrase);
            else expect(output).not.toMatch(phrase);
          }
        }
      });
    });
  }

  it('"not-applied" sends the operator through preflight + lock + CAS, never the write alone', async () => {
    const { output, result } = await rollbackWith(outcomeFor('not-applied'));
    expect(output).toContain('same --target preflight, same --manifest');
    expect(output).toMatch(/advisory lock and the\s+compare-and-swap run again/);
    expect(output).toMatch(/Never re-issue the restore write alone/);
    expect(result.abortReason).toContain(
      'never the restore write on its own'
    );
    // And it says WHY the comfortable sentence is unavailable here.
    expect(output).toContain('the executor rolled nothing back');
  });

  it('"mixed" tells the operator to escalate rather than act', async () => {
    const { output, result } = await rollbackWith(outcomeFor('mixed'));
    expect(output).toContain('ESCALATE, do not act');
    expect(output).toContain('stop and escalate');
    expect(output).toMatch(/It licenses no next action/);
    expect(result.abortReason).toContain('this is not a state to act on');
  });

  it('"unreadable" says plainly that no state was established, lock included', async () => {
    const { output, result } = await rollbackWith(outcomeFor('unreadable'));
    expect(output).toContain('it has not finished');
    expect(output).toMatch(/no usable reading/);
    expect(output).toContain('pg_stat_activity');
    expect(result.abortReason).toContain('still holds the advisory lock');
    expect(result.abortReason).toContain('could not establish the state of the rows at all');
  });

  it('derives the reading, and says it derived it, when the executor names none', async () => {
    // Contract-tolerant: an executor predating R5b reports the ambiguity without
    // the discriminator. Deriving beats crashing, and beats the mildest wording.
    expect(deriveIndeterminateVerdict(OBSERVED_ALL_POST)).toBe('not-applied');
    expect(deriveIndeterminateVerdict(OBSERVED_ALL_UNREADABLE)).toBe('unreadable');
    expect(deriveIndeterminateVerdict(INDETERMINATE_OBSERVED)).toBe('mixed');
    expect(deriveIndeterminateVerdict([])).toBe('unreadable');

    const { output, result } = await rollbackWith(
      indeterminateOutcome({ observed: OBSERVED_ALL_POST })
    );
    expect(result.rollbackVerdict).toBe('not-applied');
    expect(output).toContain('DERIVED by this tool');
    for (const banned of BANNED_WHEN_INDETERMINATE) {
      expect(output).not.toMatch(banned);
      expect(result.abortReason ?? '').not.toMatch(banned);
    }
  });

  it('refuses to inherit a "restored" claim from an ok:false outcome', async () => {
    // A success verdict on a failed outcome is a contract violation, and the
    // conservative reading — escalate — is the right one to fall back to.
    const { result } = await rollbackWith(
      indeterminateOutcome({
        verdict: 'restored' as unknown as RollbackIndeterminateVerdict,
        observed: INDETERMINATE_OBSERVED,
      })
    );
    expect(result.rollbackVerdict).toBe('mixed');
    expect(result.restored).toBe(false);
  });

  it('★ REGRESSION (F2): a "write"-stage outcome can no longer arrive carrying observations', async () => {
    // The pre-R5b seed returned the all-post reading as `refuseRollback('write', …)`.
    // `stage:'write'` is determinate, so the runner printed "The executor rolled its
    // own transaction back, so nothing was changed" about a COMMIT it had dispatched
    // and never heard back from. The route is closed structurally: reconciliation
    // evidence outranks the stage label.
    const mislabelled = {
      ok: false,
      restored: false,
      stage: 'write',
      reason:
        'the rollback COMMIT got no answer and a fresh re-read shows every deck still carrying ' +
        'the post-materialization state.',
      observed: OBSERVED_ALL_POST,
    } as unknown as RollbackOutcome;

    expect(carriesReconciliationEvidence(mislabelled)).toBe(true);

    const { output, result } = await rollbackWith(mislabelled);
    expect(result.exitCode).toBe(1); // not 2 — this is not a refusal-before-COMMIT
    expect(result.needsOperator).toBe(true);
    expect(result.rollbackVerdict).toBe('not-applied');
    expect(result.rollbackObserved).toEqual(OBSERVED_ALL_POST);
    expect(result.abortReason).toContain('stage=indeterminate');
    expect(result.abortReason).toContain('labelled this outcome stage="write"');
    for (const banned of BANNED_WHEN_INDETERMINATE) {
      expect(output).not.toMatch(banned);
      expect(result.abortReason ?? '').not.toMatch(banned);
    }
    expect(output).not.toContain('did NOT restore');
  });

  it('★ REGRESSION (F2): a bare determinate stage is untouched by that guard', async () => {
    // The other half of the pin: the guard must not soften a genuine pre-COMMIT
    // stop, which keeps its exit code, its stage name and its licensed sentence.
    const bare = {
      ok: false,
      restored: false,
      stage: 'write',
      reason: 'UPDATE matched 0 rows, expected exactly 1',
    } as RollbackOutcome;
    expect(carriesReconciliationEvidence(bare)).toBe(false);

    const { result } = await rollbackWith(bare);
    expect(result.exitCode).toBe(2);
    expect(result.needsOperator).toBe(false);
    expect(result.rollbackObserved).toBeNull();
    expect(result.rollbackVerdict).toBeNull();
    expect(result.abortReason).toContain('stage=write');
    expect(result.abortReason).toContain(
      'The executor rolled its own transaction back, so nothing was changed.'
    );
  });

  it('leaves rollbackVerdict null on a successful restore', async () => {
    const { result, output } = await rollbackWith({
      ok: true,
      restored: true,
      rows: SLUGS.map((slug) => backupRow(slug)),
    });
    expect(result.exitCode).toBe(0);
    expect(result.restored).toBe(true);
    expect(result.rollbackVerdict).toBeNull();
    expect(output).toContain('RESTORED');
  });
});

describe('materialize-atelier-decks — an INDETERMINATE materialization COMMIT (R5 §1/§4)', () => {
  async function write(commitState: 'committed' | 'rolled_back' | 'indeterminate') {
    const files = new Map<string, string>();
    const harness = makeHarness({
      env: WRITE_ENV,
      files,
      seedResult: seedResult({ commitState }),
    });
    const result = await runMaterializeAtelierDecks(options({ write: true }), harness.deps);
    return { harness, result, output: harness.logs.join('\n') };
  }

  it('★ exits non-zero and applies the same wording ban to the write path', async () => {
    const { result, output } = await write('indeterminate');
    expect(result.exitCode).toBe(1);
    expect(result.needsOperator).toBe(true);
    expect(result.abortReason).toContain('COMMIT outcome INDETERMINATE');
    for (const banned of BANNED_WHEN_INDETERMINATE) {
      expect(output).not.toMatch(banned);
      expect(result.abortReason ?? '').not.toMatch(banned);
    }
    for (const wording of SUCCESS_WORDING) expect(output).not.toMatch(wording);
  });

  it('prints both possible states, the manifest, the instruction and the warning', async () => {
    const { result, output } = await write('indeterminate');
    expect(output).toContain('OUTCOME INDETERMINATE');
    expect(output).toContain('the write committed');
    expect(output).toContain('the write did not commit');
    // The post-state fingerprint, per deck id, so the operator can compare rows.
    for (const slug of SLUGS) expect(output).toMatch(new RegExp(`${deckId(slug)}\\s+exists v2`));
    expect(output).toContain(result.manifest!.manifestPath);
    expect(output).toContain('WHAT TO DO:');
    expect(output).toContain(DO_NOT_RERUN_BLIND_WARNING);
  });

  it('does NOT skip the read-back gates — it stops before them', async () => {
    const { harness, result } = await write('indeterminate');
    expect(result.gatesPassed).not.toContain('G9:read-back-3-of-3');
    expect(result.gatesPassed).not.toContain('G10a:recovery-anchor-durable-pre-commit');
    // Because the rows are unknown, a read-back verdict would be meaningless.
    expect(result.verification).toBeNull();
    // The anchor still ran, so the manifest is a usable way back.
    expect(harness.anchorCalls).toEqual([POST_STATE]);
  });

  it('a seed that reports commitState=committed is unaffected', async () => {
    const { result, output } = await write('committed');
    expect(result.exitCode).toBe(0);
    expect(result.needsOperator).toBe(false);
    expect(output).toContain('commitState=committed');
    expect(output).toMatch(/materialized and verified/);
  });

  it('a seed that reports NO commitState at all is unaffected', async () => {
    const files = new Map<string, string>();
    const harness = makeHarness({ env: WRITE_ENV, files });
    const result = await runMaterializeAtelierDecks(options({ write: true }), harness.deps);
    expect(result.exitCode).toBe(0);
    expect(result.seedResult!.commitState).toBeUndefined();
    // The tool does NOT infer one from `applied`.
    expect(harness.logs.join('\n')).not.toContain('commitState=');
    expect(harness.logs.join('\n')).not.toContain('INDETERMINATE');
  });

  it('accepts the NULLABLE form the real seed uses (commitState: null = no verdict)', async () => {
    // atelierPresentationDeckSeed.ts types it `PinnedTxState | null` and always
    // sets the key; `null` must read as "no verdict", never as "rolled back".
    const files = new Map<string, string>();
    const harness = makeHarness({
      env: WRITE_ENV,
      files,
      seedResult: seedResult({ commitState: null }),
    });
    const result = await runMaterializeAtelierDecks(options({ write: true }), harness.deps);
    expect(result.exitCode).toBe(0);
    expect(result.needsOperator).toBe(false);
    expect(harness.logs.join('\n')).not.toContain('INDETERMINATE');
  });

  it('a seed that reports commitState=rolled_back is not treated as ambiguous', async () => {
    const files = new Map<string, string>();
    const harness = makeHarness({
      env: WRITE_ENV,
      files,
      seedResult: seedResult({ commitState: 'rolled_back', applied: false, decks: 0 }),
    });
    const result = await runMaterializeAtelierDecks(options({ write: true }), harness.deps);
    // Failed, but on the ordinary read-back path — no operator escalation.
    expect(result.exitCode).toBe(1);
    expect(result.needsOperator).toBe(false);
    expect(harness.logs.join('\n')).not.toContain('OUTCOME INDETERMINATE');
  });
});

// ---------------------------------------------------------------------------
// Contract R5 §2 — the recovery anchor is durable BEFORE COMMIT
// ---------------------------------------------------------------------------

describe('materialize-atelier-decks — the recovery anchor is durable BEFORE COMMIT', () => {
  async function write(harnessConfig: Parameters<typeof makeHarness>[0] = {}) {
    const files = new Map<string, string>();
    const harness = makeHarness({ env: WRITE_ENV, files, ...harnessConfig });
    const result = await runMaterializeAtelierDecks(options({ write: true }), harness.deps);
    return { files, harness, result };
  }

  it('★ passes persistRecoveryAnchor into the seed, and the seed calls it', async () => {
    const { harness, result } = await write();
    expect(result.exitCode).toBe(0);
    const input = harness.seedSpy.mock.calls[0][0] as SeedAtelierPresentationDecksInput;
    expect(typeof input.persistRecoveryAnchor).toBe('function');
    expect(harness.anchorCalls).toEqual([POST_STATE]);
    expect(result.gatesPassed).toContain('G10a:recovery-anchor-durable-pre-commit');
  });

  it('★ the manifest it writes carries postState INSIDE the signed payload', async () => {
    const { files, harness, result } = await write();
    const manifestPath = result.manifest!.manifestPath;
    const verified = verifyManifestEnvelope(files.get(manifestPath)!, {
      keyId: KEY_ID,
      secret: SECRET,
    });
    expect(verified.ok).toBe(true);
    if (!verified.ok) return;
    expect(verified.manifest.postState).toEqual(POST_STATE);
    // Under the HMAC, not beside it: the payload BYTES are what was signed.
    expect(JSON.parse(files.get(manifestPath)!).payload).toContain('postState');
    // And it says so while it is still inside the transaction.
    expect(harness.logs.join('\n')).toContain('RECOVERY ANCHOR durable BEFORE COMMIT');
  });

  it('★ the anchor runs BEFORE the seed commits, not after it returns', async () => {
    const { harness } = await write();
    const anchorIndex = harness.calls.indexOf('persistRecoveryAnchor');
    const commitIndex = harness.calls.indexOf('COMMIT');
    expect(anchorIndex).toBeGreaterThanOrEqual(0);
    expect(commitIndex).toBeGreaterThan(anchorIndex);
    // The manifest rename that carries the post-state also precedes the COMMIT.
    const manifestRenames = harness.calls
      .map((call, index) => (call === 'file:manifest.json' ? index : -1))
      .filter((index) => index >= 0);
    expect(manifestRenames.length).toBeGreaterThanOrEqual(2);
    expect(manifestRenames[manifestRenames.length - 1]).toBeLessThan(commitIndex);
  });

  it('★ uses the durable sequence — asserted by call ORDER, not by call count', async () => {
    const { harness } = await write();
    // The anchor's own write is the LAST manifest.json write of the run.
    const anchorOps = harness.fsCalls
      .filter((call) => {
        const target = String(call.args[0] ?? '');
        return (
          call.op === 'mkdirSecure' ||
          target.includes('manifest.json') ||
          ['writeAll', 'fsyncFile', 'closeFile', 'fsyncDirectory'].includes(call.op)
        );
      })
      .map((call) => call.op);
    const lastOpen = anchorOps.lastIndexOf('openForWrite');
    expect(anchorOps.slice(lastOpen - 1)).toEqual([
      'mkdirSecure',
      'openForWrite',
      'writeAll',
      'fsyncFile',
      'closeFile',
      'renameFile',
      'fsyncDirectory',
    ]);
  });

  for (const step of ['openForWrite', 'writeAll', 'fsyncFile', 'renameFile', 'fsyncDirectory'] as const) {
    it(`★ THROWS at the seed when the durable step "${step}" fails`, async () => {
      const files = new Map<string, string>();
      const harness = makeHarness({ env: WRITE_ENV, files });
      // Break the step only for the anchor's write (the 2nd manifest.json write).
      let manifestWrites = 0;
      const inner = harness.deps.fs[step] as (...args: never[]) => unknown;
      let armed = false;
      const originalOpen = harness.deps.fs.openForWrite;
      harness.deps.fs.openForWrite = (filePath, mode) => {
        if (filePath.includes('manifest.json')) {
          manifestWrites += 1;
          armed = manifestWrites >= 2;
        }
        if (armed && step === 'openForWrite') throw new Error(`${step} failed`);
        return originalOpen(filePath, mode);
      };
      if (step !== 'openForWrite') {
        (harness.deps.fs as unknown as Record<string, unknown>)[step] = (...args: never[]) => {
          if (armed) throw new Error(`${step} failed`);
          return inner(...args);
        };
      }

      const result = await runMaterializeAtelierDecks(options({ write: true }), harness.deps);

      // The seed saw the throw…
      expect(harness.anchorThrew).toHaveLength(1);
      expect(String(harness.anchorThrew[0])).toContain('recovery anchor could not be persisted');
      // …and rolled back, so the run is a FAILED materialization.
      expect(result.exitCode).not.toBe(0);
      expect(harness.calls).toContain('ROLLBACK(anchor threw)');
      expect(harness.calls).not.toContain('COMMIT');
      const output = harness.logs.join('\n');
      for (const wording of SUCCESS_WORDING) expect(output).not.toMatch(wording);
    });
  }

  it('★ THROWS on an EMPTY post-state rather than anchoring a manifest with no CAS target', async () => {
    const { harness, result } = await write({ anchorPostState: [] });
    expect(harness.anchorThrew).toHaveLength(1);
    expect(String(harness.anchorThrew[0])).toContain('recovery anchor refused');
    expect(String(harness.anchorThrew[0])).toContain('EMPTY post-state');
    expect(harness.calls).toContain('ROLLBACK(anchor threw)');
    expect(harness.calls).not.toContain('COMMIT');
    expect(result.exitCode).not.toBe(0);
    for (const wording of SUCCESS_WORDING) expect(harness.logs.join('\n')).not.toMatch(wording);
  });

  it('★ a manifest-write failure is a FAILED materialization, with no success wording', async () => {
    const files = new Map<string, string>();
    const harness = makeHarness({ env: WRITE_ENV, files, onAnchorThrow: 'rethrow' });
    let manifestWrites = 0;
    const originalOpen = harness.deps.fs.openForWrite;
    harness.deps.fs.openForWrite = (filePath, mode) => {
      if (filePath.includes('manifest.json')) {
        manifestWrites += 1;
        if (manifestWrites >= 2) throw new Error('ENOSPC: no space left on device');
      }
      return originalOpen(filePath, mode);
    };

    const result = await runMaterializeAtelierDecks(options({ write: true }), harness.deps);
    expect(result.exitCode).not.toBe(0);
    expect(result.abortReason).toContain('G8 seed threw');
    expect(result.gatesPassed).not.toContain('G10a:recovery-anchor-durable-pre-commit');
    const output = harness.logs.join('\n');
    expect(output).toContain('RECOVERY ANCHOR FAILED to become durable');
    expect(output).toContain('ENOSPC');
    for (const wording of SUCCESS_WORDING) expect(output).not.toMatch(wording);
  });

  it('★ keeps the anchored manifest when the failure comes at COMMIT, after the anchor', async () => {
    const { files, harness, result } = await write({
      seedThrows: new Error('connection reset while COMMIT was in flight'),
      seedThrowsAfterAnchor: true,
    });
    expect(result.exitCode).not.toBe(0);
    expect(harness.anchorCalls).toEqual([POST_STATE]);
    const verified = verifyManifestEnvelope(files.get(result.manifest!.manifestPath)!, {
      keyId: KEY_ID,
      secret: SECRET,
    });
    expect(verified.ok && verified.manifest.postState).toEqual(POST_STATE);
    // Having anchored already, it does not re-read the post-state after the crash.
    expect(harness.postStateSpy).not.toHaveBeenCalled();
    // And it refuses to say which side of the COMMIT the failure fell on.
    const output = harness.logs.join('\n');
    expect(output).toContain('does NOT know whether the write took effect');
    expect(output).toContain(DO_NOT_RERUN_BLIND_WARNING);
    expect(output).not.toMatch(/nothing was changed/i);
    expect(output).not.toMatch(/nothing was restored/i);
    expect(output).not.toMatch(/rolled (its own )?transaction back/i);
  });
});

describe('materialize-atelier-decks — foreign content gate (G6)', () => {
  const foreignPlan = [
    planEntry(SLUGS[0]),
    planEntry(SLUGS[1], {
      outcome: 'skipped',
      hasExistingContent: true,
      ownedBySeed: false,
      reason: 'row carries content the seed does not own',
    }),
    planEntry(SLUGS[2]),
  ];

  it('aborts when a row carries content the seed does not own', async () => {
    const harness = makeHarness({ plan: foreignPlan, env: WRITE_ENV });
    const result = await runMaterializeAtelierDecks(options({ write: true }), harness.deps);
    expect(result.exitCode).not.toBe(0);
    expect(result.abortReason).toMatch(/G6 1 row\(s\) carry content this seed does not own/);
    expect(harness.seedSpy).not.toHaveBeenCalled();
  });

  it('proceeds with the explicit force flag and logs it loudly', async () => {
    const harness = makeHarness({ plan: foreignPlan, env: WRITE_ENV });
    const result = await runMaterializeAtelierDecks(
      options({ write: true, forceOverwriteForeignContent: true }),
      harness.deps
    );
    expect(result.exitCode).toBe(0);
    expect(harness.seedSpy.mock.calls[0][0]).toMatchObject({ force: true });
    expect(harness.logs.join('\n')).toContain('--force-overwrite-foreign-content IS ACTIVE');
  });

  it('never forces past a cross-tenant collision', async () => {
    const harness = makeHarness({
      plan: [
        planEntry(SLUGS[0], { outcome: 'failed', foreignTenant: 'dbr77' }),
        planEntry(SLUGS[1]),
        planEntry(SLUGS[2]),
      ],
      env: WRITE_ENV,
    });
    const result = await runMaterializeAtelierDecks(
      options({ write: true, forceOverwriteForeignContent: true }),
      harness.deps
    );
    expect(result.exitCode).not.toBe(0);
    expect(result.abortReason).toMatch(/cross-tenant collision, not forceable/);
    expect(harness.seedSpy).not.toHaveBeenCalled();
  });
});

describe('materialize-atelier-decks — active editor gate (G7)', () => {
  it('aborts when a recent deck version snapshot exists', async () => {
    const harness = makeHarness({
      env: WRITE_ENV,
      rows: {
        presentation_deck_versions: [
          { deck_id: deckId(SLUGS[0]), version: 4, created_at: '2026-08-01T11:55:00.000Z' },
        ],
      },
    });
    const result = await runMaterializeAtelierDecks(options({ write: true }), harness.deps);
    expect(result.exitCode).not.toBe(0);
    expect(result.abortReason).toMatch(/active-editor signal/);
    expect(harness.seedSpy).not.toHaveBeenCalled();
  });

  it('aborts on a live collaborator heartbeat', async () => {
    const harness = makeHarness({
      env: WRITE_ENV,
      rows: {
        deck_collab_sessions: [
          { deck_id: deckId(SLUGS[1]), user_id: 'user-7', last_heartbeat_at: '2026-08-01T11:59:00.000Z' },
        ],
      },
    });
    const result = await runMaterializeAtelierDecks(options({ write: true }), harness.deps);
    expect(result.exitCode).not.toBe(0);
    expect(result.abortReason).toMatch(/active-editor signal/);
  });

  it('ignores a recent updated_at on a row the seed already owns', async () => {
    const harness = makeHarness({
      env: WRITE_ENV,
      plan: SLUGS.map((slug) => planEntry(slug, { ownedBySeed: true, outcome: 'updated' })),
      rows: {
        presentation_decks: [{ id: deckId(SLUGS[0]), updated_at: '2026-08-01T11:59:00.000Z' }],
      },
    });
    const result = await runMaterializeAtelierDecks(options({ write: true }), harness.deps);
    expect(result.exitCode).toBe(0);
  });
});

describe('materialize-atelier-decks — the pinned-PG check is a GATE, not a warning (G8)', () => {
  it('★ --write on a batched-fallback: FAILED report, non-zero exit, no success wording', async () => {
    const harness = makeHarness({
      env: WRITE_ENV,
      seedResult: seedResult({ atomicity: 'batched-fallback' }),
    });
    const result = await runMaterializeAtelierDecks(options({ write: true }), harness.deps);
    const output = harness.logs.join('\n');

    // (1) the run is reported as a FAILED materialization
    expect(result.abortReason).toContain('G8 atomicity=batched-fallback');
    expect(result.abortReason).toContain('FAILED materialization');
    expect(result.gatesPassed).not.toContain('G8:seed-transaction(batched-fallback)');
    expect(result.gatesPassed).not.toContain('G9:read-back-3-of-3');
    expect(result.verification).toBeNull();

    // (2) non-zero exit code
    expect(result.exitCode).not.toBe(0);
    expect(result.exitCode).toBe(1);

    // (3) no READY / RESTORED / success wording ANYWHERE in the output
    for (const pattern of SUCCESS_WORDING) expect(output).not.toMatch(pattern);
    expect(output).toContain('FAILED — atomicity=batched-fallback');
    expect(output).toContain('--rollback --manifest=');
  });

  it('★ still leaves a rollback-capable signed manifest behind', async () => {
    const files = new Map<string, string>();
    const harness = makeHarness({
      env: WRITE_ENV,
      files,
      seedResult: seedResult({ atomicity: 'batched-fallback' }),
    });
    const result = await runMaterializeAtelierDecks(options({ write: true }), harness.deps);
    const verified = verifyManifestEnvelope(files.get(result.manifest!.manifestPath)!, {
      keyId: KEY_ID,
      secret: SECRET,
    });
    expect(verified.ok).toBe(true);
    if (verified.ok) expect(verified.manifest.postState).toEqual(POST_STATE);
  });

  it('--write on pinned-pg proceeds normally', async () => {
    const harness = makeHarness({ env: WRITE_ENV });
    const result = await runMaterializeAtelierDecks(options({ write: true }), harness.deps);
    expect(result.exitCode).toBe(0);
    expect(result.gatesPassed).toContain('G8:seed-transaction(pinned-pg)');
    expect(result.gatesPassed).toContain('G9:read-back-3-of-3');
    expect(harness.logs.join('\n')).toContain('canonical decks materialized and verified');
  });

  it('a DRY RUN on a batched-fallback is still fine — it mutates nothing', async () => {
    const harness = makeHarness({ planAtomicity: 'batched-fallback' });
    const result = await runMaterializeAtelierDecks(options(), harness.deps);
    expect(result.exitCode).toBe(0);
    expect(result.aborted).toBe(false);
    expect(harness.seedSpy).not.toHaveBeenCalled();
    for (const sql of harness.sqlSeen) expect(sql.trim()).toMatch(/^SELECT\b/i);
    expect(harness.logs.join('\n')).toContain('DRY RUN complete');
  });
});

describe('materialize-atelier-decks — read-back verification (G9)', () => {
  it('verifies 3/3 and exits 0 on a clean write', async () => {
    const harness = makeHarness({ env: WRITE_ENV });
    const result = await runMaterializeAtelierDecks(options({ write: true }), harness.deps);
    expect(result.exitCode).toBe(0);
    expect(result.verification).toHaveLength(3);
    expect(result.verification!.every((row) => row.ok)).toBe(true);
    expect(result.gatesPassed).toContain('G9:read-back-3-of-3');
    expect(result.gatesPassed).toContain('G8:seed-transaction(pinned-pg)');
  });

  it('exits non-zero when slide_count disagrees with the derived card count', async () => {
    const harness = makeHarness({
      env: WRITE_ENV,
      backupAfter: backupOf([
        writtenRow(SLUGS[0]),
        { ...writtenRow(SLUGS[1]), slide_count: 12 },
        writtenRow(SLUGS[2]),
      ]),
    });
    const result = await runMaterializeAtelierDecks(options({ write: true }), harness.deps);
    expect(result.exitCode).toBe(1);
    expect(result.abortReason).toMatch(/G9 read-back mismatch: 2\/3/);
    expect(result.verification!.find((row) => row.deckId === deckId(SLUGS[1]))!.countOk).toBe(false);
  });

  it('exits non-zero when a row came back under the wrong tenant', async () => {
    const harness = makeHarness({
      env: WRITE_ENV,
      backupAfter: backupOf([
        { ...writtenRow(SLUGS[0]), organization_id: 'dbr77' },
        writtenRow(SLUGS[1]),
        writtenRow(SLUGS[2]),
      ]),
    });
    const result = await runMaterializeAtelierDecks(options({ write: true }), harness.deps);
    expect(result.exitCode).toBe(1);
    expect(result.verification!.find((row) => row.deckId === deckId(SLUGS[0]))!.tenantOk).toBe(false);
  });

  it('exits non-zero when a post-write read is in state unknown', async () => {
    const after = backupOf(SLUGS.map((slug) => writtenRow(slug)));
    after.entries[2] = {
      deckId: deckId(SLUGS[2]),
      state: 'unknown',
      row: null,
      error: 'timeout',
    };
    after.complete = false;
    const harness = makeHarness({ env: WRITE_ENV, backupAfter: after });
    const result = await runMaterializeAtelierDecks(options({ write: true }), harness.deps);
    expect(result.exitCode).toBe(1);
    expect(result.verification!.find((row) => row.deckId === deckId(SLUGS[2]))!.detail).toContain(
      'post-write read failed'
    );
  });

  it('exits non-zero and prints result.failures verbatim when the seed reports failures', async () => {
    const failures = [{ deckId: deckId(SLUGS[2]), reason: 'cross-tenant collision with dbr77' }];
    const harness = makeHarness({
      env: WRITE_ENV,
      seedResult: seedResult({ applied: false, decks: 0, failures }),
    });
    const result = await runMaterializeAtelierDecks(options({ write: true }), harness.deps);
    expect(result.exitCode).toBe(1);
    expect(result.failures).toEqual(failures);
    expect(harness.logs.join('\n')).toContain(JSON.stringify(failures, null, 2));
  });
});

describe('materialize-atelier-decks — the REAL filesystem seam', () => {
  let root: string;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'mat006b-'));
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('really creates a 0700 directory and a 0600 file, and really renames', () => {
    const seam = createNodeManifestFsSeam();
    const directory = path.join(root, 'atelier-decks-2026');
    const finalPath = path.join(directory, 'manifest.json');
    const temporaryPath = `${finalPath}.tmp-1`;

    seam.mkdirSecure(directory, MANIFEST_DIR_MODE);
    const fd = seam.openForWrite(temporaryPath, MANIFEST_FILE_MODE);
    seam.writeAll(fd, '{"ok":true}');
    seam.fsyncFile(fd);
    seam.closeFile(fd);
    seam.renameFile(temporaryPath, finalPath);
    seam.fsyncDirectory(directory);

    expect(fs.statSync(directory).mode & 0o777).toBe(0o700);
    expect(fs.statSync(finalPath).mode & 0o777).toBe(0o600);
    expect(fs.existsSync(temporaryPath)).toBe(false);
    expect(seam.readTextFile(finalPath)).toBe('{"ok":true}');
  });

  it('refuses to clobber an existing temp file (O_EXCL)', () => {
    const seam = createNodeManifestFsSeam();
    const target = path.join(root, 'x.tmp');
    fs.writeFileSync(target, 'existing');
    expect(() => seam.openForWrite(target, MANIFEST_FILE_MODE)).toThrow(/EEXIST/);
  });
});
