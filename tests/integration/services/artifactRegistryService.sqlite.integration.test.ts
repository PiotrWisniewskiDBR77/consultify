/**
 * Integration-grade: real `artifactRegistryService` against an in-memory SQLite database
 * wired through a local DbPromise mock. This exercises SQL, mapping, and ACL helpers
 * without mocking the registry service itself. Not Postgres parity or full API e2e.
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

const spineMocks = vi.hoisted(() => ({
  initiateHandoff: vi.fn(),
  transitionRunState: vi.fn().mockResolvedValue({}),
  createProposal: vi.fn(),
}));

vi.mock('../../../server/src/utils/Logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
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
      sqliteCtx.db.run(sql, params || [], function (this: { changes: number; lastID?: number }, err: Error | null) {
        if (err) {
          if (fallback) resolve({ success: false, error: err.message });
          else reject(err);
          return;
        }
        resolve({ success: true, changes: this.changes, lastID: this.lastID });
      });
    }),
  default: {},
}));

vi.mock('../../../server/src/services/v8/chatExecutionService.js', () => ({
  initiateHandoff: (...args: unknown[]) => spineMocks.initiateHandoff(...args),
}));

vi.mock('../../../server/src/services/v8/executionSpineService.js', () => ({
  transitionRunState: (...args: unknown[]) => spineMocks.transitionRunState(...args),
  createProposal: (...args: unknown[]) => spineMocks.createProposal(...args),
}));

import * as artifactRegistryService from '../../../server/src/services/v8/artifactRegistryService.js';

describe('artifactRegistryService (sqlite-backed integration)', () => {
  beforeAll(async () => {
    await applyArtifactSubstrateDdl(sqliteCtx.db);
  });

  beforeEach(async () => {
    await clearArtifactSubstrateTables(sqliteCtx.db);
    spineMocks.initiateHandoff.mockReset();
    spineMocks.transitionRunState.mockReset();
    spineMocks.createProposal.mockReset();
    spineMocks.transitionRunState.mockResolvedValue({});
  });

  afterAll(
    () =>
      new Promise<void>((resolve, reject) => {
        sqliteCtx.db.close((err) => (err ? reject(err) : resolve()));
      }),
  );

  it('registerArtifactOrigin persists artifact and origin link for report runtime', async () => {
    const record = await artifactRegistryService.registerArtifactOrigin({
      organizationId: 'org-a',
      outputType: 'report',
      artifactFamily: 'document',
      originRuntime: 'report',
      originRecordId: 'rep-native-1',
      titleSnapshot: 'QBR draft',
      ownerUserId: 'user-owner',
      createdBy: 'user-owner',
      deliveryState: 'draft',
      visibilityScope: 'organization',
    });

    expect(record.artifactId).toBeTruthy();
    expect(record.titleSnapshot).toBe('QBR draft');

    const item = await artifactRegistryService.getArtifactForUser({
      organizationId: 'org-a',
      artifactId: record.artifactId,
      userId: 'user-stranger',
      roleKey: null,
    });
    expect(item).not.toBeNull();
    expect(item?.resolvedTitle).toBe('QBR draft');
  });

  it('getArtifactForUser hides private artifacts from non-owners', async () => {
    const record = await artifactRegistryService.registerArtifactOrigin({
      organizationId: 'org-a',
      outputType: 'report',
      artifactFamily: 'document',
      originRuntime: 'report',
      originRecordId: 'rep-native-2',
      titleSnapshot: 'Secret',
      ownerUserId: 'user-owner',
      createdBy: 'user-owner',
      deliveryState: 'draft',
      visibilityScope: 'private',
    });

    const peer = await artifactRegistryService.getArtifactForUser({
      organizationId: 'org-a',
      artifactId: record.artifactId,
      userId: 'user-peer',
      roleKey: null,
    });
    expect(peer).toBeNull();

    const owner = await artifactRegistryService.getArtifactForUser({
      organizationId: 'org-a',
      artifactId: record.artifactId,
      userId: 'user-owner',
      roleKey: null,
    });
    expect(owner?.artifactId).toBe(record.artifactId);
  });

  it('project visibility requires tenant-scoped project membership', async () => {
    await new Promise<void>((resolve, reject) => {
      sqliteCtx.db.run(
        `INSERT INTO projects (id, organization_id) VALUES (?, ?)`,
        ['proj-1', 'org-a'],
        (err) => (err ? reject(err) : resolve()),
      );
    });
    await new Promise<void>((resolve, reject) => {
      sqliteCtx.db.run(
        `INSERT INTO project_members (project_id, user_id) VALUES (?, ?)`,
        ['proj-1', 'user-member'],
        (err) => (err ? reject(err) : resolve()),
      );
    });

    const record = await artifactRegistryService.registerArtifactOrigin({
      organizationId: 'org-a',
      outputType: 'report',
      artifactFamily: 'document',
      originRuntime: 'report',
      originRecordId: 'rep-native-3',
      titleSnapshot: 'Project brief',
      ownerUserId: 'user-owner',
      createdBy: 'user-owner',
      deliveryState: 'draft',
      visibilityScope: 'project',
      projectId: 'proj-1',
    });

    const member = await artifactRegistryService.getArtifactForUser({
      organizationId: 'org-a',
      artifactId: record.artifactId,
      userId: 'user-member',
      roleKey: null,
    });
    expect(member?.artifactId).toBe(record.artifactId);

    const outsider = await artifactRegistryService.getArtifactForUser({
      organizationId: 'org-a',
      artifactId: record.artifactId,
      userId: 'user-outsider',
      roleKey: null,
    });
    expect(outsider).toBeNull();
  });

  it('createArtifactAccessGrant is readable via access grant list helpers', async () => {
    const record = await artifactRegistryService.registerArtifactOrigin({
      organizationId: 'org-a',
      outputType: 'presentation',
      artifactFamily: 'presentation',
      originRuntime: 'presentation',
      originRecordId: 'deck-1',
      titleSnapshot: 'Board deck',
      ownerUserId: 'user-owner',
      createdBy: 'user-owner',
      deliveryState: 'draft',
      visibilityScope: 'private',
    });

    const grant = await artifactRegistryService.createArtifactAccessGrant({
      organizationId: 'org-a',
      artifactId: record.artifactId,
      grantKind: 'user',
      userId: 'user-grantee',
      roleKey: null,
      createdBy: 'user-owner',
    });

    expect(grant.grantId).toBeTruthy();

    const grants = await artifactRegistryService.getArtifactAccessGrantsForArtifact(
      record.artifactId,
      'org-a',
    );
    expect(grants.some((g) => g.grantId === grant.grantId && g.userId === 'user-grantee')).toBe(true);
  });

  it('createArtifactRunFromChat persists plan_json and returns run envelope (spine mocked)', async () => {
    spineMocks.initiateHandoff.mockResolvedValue({ executionRunId: 'exec-run-1' });

    const result = await artifactRegistryService.createArtifactRunFromChat({
      organizationId: 'org-a',
      userId: 'user-owner',
      conversationId: 'conv-1',
      contextSnapshotId: 'snap-1',
      goal: 'Build an Excel operating model',
      requestedArtifactFamily: 'sheet',
      requestedOutputType: 'sheet',
    });

    expect(result.artifactRunId).toBeTruthy();
    expect(result.executionRunId).toBe('exec-run-1');
    expect(result.artifactPlan.outputType).toBe('sheet');
    expect(result.run.plan.outputType).toBe('sheet');

    const loaded = await artifactRegistryService.getArtifactRun(result.artifactRunId, 'org-a');
    expect(loaded?.runStatus).toBe('planned');
    expect(loaded?.plan.outputType).toBe('sheet');
    expect(spineMocks.transitionRunState).toHaveBeenCalled();
  });

  it('listArtifactsForUser applies outputType filter against persisted rows', async () => {
    await artifactRegistryService.registerArtifactOrigin({
      organizationId: 'org-a',
      outputType: 'report',
      artifactFamily: 'document',
      originRuntime: 'report',
      originRecordId: 'rep-f1',
      titleSnapshot: 'Report A',
      ownerUserId: 'user-owner',
      createdBy: 'user-owner',
      deliveryState: 'draft',
      visibilityScope: 'organization',
    });
    await artifactRegistryService.registerArtifactOrigin({
      organizationId: 'org-a',
      outputType: 'presentation',
      artifactFamily: 'presentation',
      originRuntime: 'presentation',
      originRecordId: 'deck-f1',
      titleSnapshot: 'Deck A',
      ownerUserId: 'user-owner',
      createdBy: 'user-owner',
      deliveryState: 'draft',
      visibilityScope: 'organization',
    });

    const decksOnly = await artifactRegistryService.listArtifactsForUser({
      organizationId: 'org-a',
      userId: 'user-owner',
      filters: { outputType: 'presentation', limit: 50 },
    });
    expect(decksOnly.every((i) => i.outputType === 'presentation')).toBe(true);
    expect(decksOnly.some((i) => i.resolvedTitle === 'Deck A')).toBe(true);

    const reportsOnly = await artifactRegistryService.listArtifactsForUser({
      organizationId: 'org-a',
      userId: 'user-owner',
      filters: { outputType: 'report', limit: 50 },
    });
    expect(reportsOnly.every((i) => i.outputType === 'report')).toBe(true);
  });

  it('acceptArtifactRunPlan updates run row when spine returns a proposal (spine mocked)', async () => {
    spineMocks.initiateHandoff.mockResolvedValue({ executionRunId: 'exec-run-2' });
    spineMocks.createProposal.mockResolvedValue({ proposalId: 'proposal-xyz' });

    const created = await artifactRegistryService.createArtifactRunFromChat({
      organizationId: 'org-a',
      userId: 'user-owner',
      conversationId: 'conv-2',
      contextSnapshotId: 'snap-2',
      goal: 'Quarterly report',
      requestedArtifactFamily: 'document',
      requestedOutputType: 'report',
    });

    const accepted = await artifactRegistryService.acceptArtifactRunPlan({
      runId: created.artifactRunId,
      organizationId: 'org-a',
      actorUserId: 'user-owner',
    });

    expect(accepted.runStatus).toBe('proposal_created');
    expect(accepted.proposalId).toBe('proposal-xyz');
    expect(spineMocks.createProposal).toHaveBeenCalled();
  });
});
