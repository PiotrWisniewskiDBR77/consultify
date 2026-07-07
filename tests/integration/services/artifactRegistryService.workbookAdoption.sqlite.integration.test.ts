/**
 * P-2 split-brain fix (excele lane): `adoptRunArtifactForWorkbook` must make the
 * real .xlsx workbook adopt the run's SINGLE canonical artifact instead of
 * spawning a second Outputs card. One click = one entity.
 *
 * Integration-grade: real `artifactRegistryService` against in-memory SQLite via a
 * local DbPromise mock (same harness as artifactRegistryService.sqlite.integration).
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  applyArtifactSubstrateDdl,
  clearArtifactSubstrateTables,
} from '../helpers/artifactSubstrateSqliteContext.js';

const sqliteCtx = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const sqlite3 = require('sqlite3') as typeof import('sqlite3');
  const db = new sqlite3.Database(':memory:');
  return { db };
});

vi.mock('../../../server/src/utils/Logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../../server/src/utils/DbPromise.js', () => ({
  get: <T = unknown>(
    sql: string,
    params?: unknown[],
    opts?: { fallback?: boolean },
  ): Promise<T | null> =>
    new Promise((resolve, reject) => {
      const fallback = opts?.fallback !== false;
      sqliteCtx.db.get(sql, params || [], (err: Error | null, row: unknown) => {
        if (err) {
          if (fallback) resolve(null);
          else reject(err);
          return;
        }
        resolve((row || null) as T | null);
      });
    }),
  all: <T = unknown>(sql: string, params?: unknown[], opts?: { fallback?: boolean }): Promise<T[]> =>
    new Promise((resolve, reject) => {
      const fallback = opts?.fallback !== false;
      sqliteCtx.db.all(sql, params || [], (err: Error | null, rows: unknown[]) => {
        if (err) {
          if (fallback) resolve([]);
          else reject(err);
          return;
        }
        resolve((rows || []) as T[]);
      });
    }),
  run: (
    sql: string,
    params?: unknown[],
    opts?: { fallback?: boolean },
  ): Promise<{ success: boolean; changes?: number; lastID?: number; error?: string }> =>
    new Promise((resolve, reject) => {
      const fallback = opts?.fallback !== false;
      sqliteCtx.db.run(
        sql,
        params || [],
        function (this: { changes: number; lastID?: number }, err: Error | null) {
          if (err) {
            if (fallback) resolve({ success: false, error: err.message });
            else reject(err);
            return;
          }
          resolve({ success: true, changes: this.changes, lastID: this.lastID });
        },
      );
    }),
  default: {},
}));

import * as artifactRegistryService from '../../../server/src/services/v8/artifactRegistryService.js';

const ORG = 'org-excele';
const USER = 'user-owner';

async function seedSheetRun(runId: string, tableId: string): Promise<string> {
  // Register the governed tp_tables sheet artifact the excele materialize path creates.
  const artifact = await artifactRegistryService.registerArtifactOrigin({
    organizationId: ORG,
    outputType: 'sheet',
    artifactFamily: 'sheet',
    originRuntime: 'sheet',
    originRecordId: tableId,
    titleSnapshot: 'Starter table',
    ownerUserId: USER,
    createdBy: USER,
    deliveryState: 'ready',
    visibilityScope: 'organization',
    originSummary: { sourceTable: 'tp_tables', exportFormat: 'xlsx', governanceMode: 'governed' },
  });
  const artifactId = artifact!.artifactId;

  // Seed the completed sheet run pointing at that artifact.
  await new Promise<void>((resolve, reject) => {
    sqliteCtx.db.run(
      `INSERT INTO v8_artifact_runs
         (run_id, artifact_id, organization_id, execution_run_id, context_snapshot_id,
          trigger_type, requested_by_user_id, plan_json, run_status,
          materialization_origin_runtime, materialization_origin_record_id)
       VALUES (?, ?, ?, ?, ?, 'chat', ?, ?, 'completed', 'sheet', ?)`,
      [
        runId,
        artifactId,
        ORG,
        'exec-1',
        'snap-1',
        USER,
        JSON.stringify({
          artifactFamily: 'sheet',
          outputType: 'sheet',
          titleHint: 'Budget model',
          governancePath: 'execution_spine',
          visibilityScope: 'organization',
        }),
        tableId,
      ],
      (err) => (err ? reject(err) : resolve()),
    );
  });

  return artifactId;
}

async function countArtifacts(): Promise<number> {
  const row = await new Promise<{ cnt: number }>((resolve, reject) => {
    sqliteCtx.db.get(
      `SELECT COUNT(*) AS cnt FROM v8_output_artifacts WHERE organization_id = ?`,
      [ORG],
      (err, r: any) => (err ? reject(err) : resolve(r)),
    );
  });
  return row.cnt;
}

describe('adoptRunArtifactForWorkbook (P-2 excele split-brain)', () => {
  beforeAll(async () => {
    await applyArtifactSubstrateDdl(sqliteCtx.db);
  });

  beforeEach(async () => {
    await clearArtifactSubstrateTables(sqliteCtx.db);
  });

  afterAll(
    () =>
      new Promise<void>((resolve, reject) => {
        sqliteCtx.db.close((err) => (err ? reject(err) : resolve()));
      }),
  );

  it('1 click = 1 entity: workbook adopts the run artifact, no second Outputs card', async () => {
    const runArtifactId = await seedSheetRun('run-1', 'table-1');
    expect(await countArtifacts()).toBe(1);

    const adoptedId = await artifactRegistryService.adoptRunArtifactForWorkbook({
      runId: 'run-1',
      organizationId: ORG,
      workbookId: 'wb-1',
      title: 'Budget model',
      originSummary: { source: 'workbook_generator_p23d', exportFormat: 'xlsx' },
    });

    // Same artifact adopted — NOT a new one.
    expect(adoptedId).toBe(runArtifactId);
    // Still exactly ONE Outputs card for the org.
    expect(await countArtifacts()).toBe(1);

    // The primary origin link now points at the real workbook (canonical .xlsx),
    // so download resolves to generated_workbooks — no orphan tp_tables card.
    const links = await artifactRegistryService.getArtifactOriginLinks(runArtifactId, ORG);
    const primary = links.find((l) => l.isPrimaryOrigin);
    expect(primary?.originRuntime).toBe('sheet');
    expect(primary?.originRecordId).toBe('wb-1');
    // The old tableId origin is gone (re-pointed, not appended).
    expect(links.some((l) => l.originRecordId === 'table-1')).toBe(false);
  });

  it('is idempotent: re-adopting the same workbook does not duplicate links or cards', async () => {
    await seedSheetRun('run-2', 'table-2');

    await artifactRegistryService.adoptRunArtifactForWorkbook({
      runId: 'run-2',
      organizationId: ORG,
      workbookId: 'wb-2',
      title: 'Budget model',
    });
    await artifactRegistryService.adoptRunArtifactForWorkbook({
      runId: 'run-2',
      organizationId: ORG,
      workbookId: 'wb-2',
      title: 'Budget model',
    });

    expect(await countArtifacts()).toBe(1);
  });

  it('returns null when the run has no adoptable artifact (caller registers fresh)', async () => {
    // No run seeded → adoption declines, workbook route falls back to a fresh card.
    const adoptedId = await artifactRegistryService.adoptRunArtifactForWorkbook({
      runId: 'run-missing',
      organizationId: ORG,
      workbookId: 'wb-3',
      title: 'Orphan workbook',
    });
    expect(adoptedId).toBeNull();
  });
});
