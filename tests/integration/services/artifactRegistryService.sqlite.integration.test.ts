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
  submitForReview: vi.fn().mockResolvedValue({}),
  approveRun: vi.fn().mockResolvedValue({}),
  applyRun: vi.fn().mockResolvedValue({}),
  completeRun: vi.fn().mockResolvedValue({}),
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
  submitForReview: (...args: unknown[]) => spineMocks.submitForReview(...args),
  approveRun: (...args: unknown[]) => spineMocks.approveRun(...args),
  applyRun: (...args: unknown[]) => spineMocks.applyRun(...args),
  completeRun: (...args: unknown[]) => spineMocks.completeRun(...args),
}));

import * as artifactRegistryService from '../../../server/src/services/v8/artifactRegistryService.js';
import * as reportBuilderService from '../../../server/src/services/reportBuilderService.js';

describe('artifactRegistryService (sqlite-backed integration)', () => {
  beforeAll(async () => {
    await applyArtifactSubstrateDdl(sqliteCtx.db);
    reportBuilderService.setDependencies({ db: sqliteCtx.db as any });
  });

  beforeEach(async () => {
    await clearArtifactSubstrateTables(sqliteCtx.db);
    spineMocks.initiateHandoff.mockReset();
    spineMocks.transitionRunState.mockReset();
    spineMocks.createProposal.mockReset();
    spineMocks.submitForReview.mockReset();
    spineMocks.approveRun.mockReset();
    spineMocks.applyRun.mockReset();
    spineMocks.completeRun.mockReset();
    spineMocks.transitionRunState.mockResolvedValue({});
    spineMocks.submitForReview.mockResolvedValue({});
    spineMocks.approveRun.mockResolvedValue({});
    spineMocks.applyRun.mockResolvedValue({});
    spineMocks.completeRun.mockResolvedValue({});
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

  it('listMyWorkArtifacts builds mine and review lanes from dedicated filtered queries', async () => {
    const owned = await artifactRegistryService.registerArtifactOrigin({
      organizationId: 'org-a',
      outputType: 'report',
      artifactFamily: 'document',
      originRuntime: 'report',
      originRecordId: 'rep-owned-1',
      titleSnapshot: 'Owned draft',
      ownerUserId: 'user-owner',
      createdBy: 'user-owner',
      deliveryState: 'draft',
      visibilityScope: 'private',
    });

    const reviewShared = await artifactRegistryService.registerArtifactOrigin({
      organizationId: 'org-a',
      outputType: 'presentation',
      artifactFamily: 'presentation',
      originRuntime: 'presentation',
      originRecordId: 'deck-review-1',
      titleSnapshot: 'Review deck',
      ownerUserId: 'user-reviewer',
      createdBy: 'user-reviewer',
      deliveryState: 'review',
      visibilityScope: 'review_shared',
    });

    await new Promise<void>((resolve, reject) => {
      sqliteCtx.db.run(
        `INSERT INTO v8_publish_records (
          record_id, artifact_id, artifact_type, organization_id, current_state, published_by, reviewers
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          'pub-review-1',
          reviewShared.artifactId,
          'presentation',
          'org-a',
          'in_review',
          'user-reviewer',
          JSON.stringify(['user-owner']),
        ],
        (err) => (err ? reject(err) : resolve()),
      );
    });

    for (let index = 0; index < 10; index += 1) {
      await artifactRegistryService.registerArtifactOrigin({
        organizationId: 'org-a',
        outputType: 'report',
        artifactFamily: 'document',
        originRuntime: 'report',
        originRecordId: `rep-recent-${index}`,
        titleSnapshot: `Recent ${index}`,
        ownerUserId: `user-${index}`,
        createdBy: `user-${index}`,
        deliveryState: 'draft',
        visibilityScope: 'organization',
      });
    }

    const outputs = await artifactRegistryService.listMyWorkArtifacts({
      organizationId: 'org-a',
      userId: 'user-owner',
      roleKey: null,
      limit: 8,
    });

    expect(outputs.mine.some((item) => item.artifactId === owned.artifactId)).toBe(true);
    expect(outputs.review.some((item) => item.artifactId === reviewShared.artifactId)).toBe(true);
    expect(outputs.recent).toHaveLength(8);
    expect(outputs.recent.some((item) => item.artifactId === owned.artifactId)).toBe(false);
    expect(outputs.recent.some((item) => item.artifactId === reviewShared.artifactId)).toBe(false);
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

  it('registerGovernedTableSheetArtifact persists sheet output_type and origin link for tp_tables id', async () => {
    const record = await artifactRegistryService.registerGovernedTableSheetArtifact({
      organizationId: 'org-a',
      userId: 'user-sheet',
      tableId: 'tp-table-99',
      tableName: 'Cap table model',
    });

    expect(record.outputType).toBe('sheet');
    expect(record.artifactFamily).toBe('sheet');
    expect(record.deliveryState).toBe('ready');
    expect(record.visibilityScope).toBe('organization');
    expect(record.originSummary).toMatchObject({
      sourceTable: 'tp_tables',
      exportFormat: 'xlsx',
      governanceMode: 'governed',
    });

    const byOrigin = await artifactRegistryService.getArtifactByOrigin({
      organizationId: 'org-a',
      originRuntime: 'sheet',
      originRecordId: 'tp-table-99',
      userId: 'user-peer',
      roleKey: null,
    });
    expect(byOrigin?.artifactId).toBe(record.artifactId);
    expect(byOrigin?.resolvedTitle).toBe('Cap table model');
    expect(byOrigin?.exportFormat).toBe('xlsx');
  });

  it('registerGovernedTableSheetArtifact refreshes metadata when origin already exists (idempotent)', async () => {
    const first = await artifactRegistryService.registerGovernedTableSheetArtifact({
      organizationId: 'org-a',
      userId: 'user-sheet',
      tableId: 'tp-table-dup',
      tableName: 'Version A',
    });
    const second = await artifactRegistryService.registerGovernedTableSheetArtifact({
      organizationId: 'org-a',
      userId: 'user-sheet',
      tableId: 'tp-table-dup',
      tableName: 'Version B',
    });

    expect(second.artifactId).toBe(first.artifactId);
    expect(second.titleSnapshot).toBe('Version B');

    const loaded = await artifactRegistryService.getArtifactForUser({
      organizationId: 'org-a',
      artifactId: first.artifactId,
      userId: 'user-stranger',
      roleKey: null,
    });
    expect(loaded?.titleSnapshot).toBe('Version B');
  });

  it('listArtifactsForUser includes sheet artifacts when outputType filter is sheet', async () => {
    await artifactRegistryService.registerGovernedTableSheetArtifact({
      organizationId: 'org-a',
      userId: 'user-sheet',
      tableId: 'tp-sheet-list',
      tableName: 'Only sheet here',
    });

    const sheets = await artifactRegistryService.listArtifactsForUser({
      organizationId: 'org-a',
      userId: 'user-stranger',
      filters: { outputType: 'sheet', limit: 50 },
    });
    expect(sheets.length).toBeGreaterThanOrEqual(1);
    expect(sheets.every((i) => i.outputType === 'sheet')).toBe(true);
    expect(sheets.some((i) => i.resolvedTitle === 'Only sheet here')).toBe(true);
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

  it('listArtifactsForUser applies sourceInitiativeId filter against persisted rows', async () => {
    await artifactRegistryService.registerArtifactOrigin({
      organizationId: 'org-a',
      outputType: 'report',
      artifactFamily: 'document',
      originRuntime: 'report',
      originRecordId: 'rep-init-a',
      titleSnapshot: 'Initiative A report',
      ownerUserId: 'user-owner',
      createdBy: 'user-owner',
      deliveryState: 'draft',
      visibilityScope: 'organization',
      sourceInitiativeId: 'init-a',
    });
    await artifactRegistryService.registerArtifactOrigin({
      organizationId: 'org-a',
      outputType: 'presentation',
      artifactFamily: 'presentation',
      originRuntime: 'presentation',
      originRecordId: 'deck-init-b',
      titleSnapshot: 'Initiative B deck',
      ownerUserId: 'user-owner',
      createdBy: 'user-owner',
      deliveryState: 'draft',
      visibilityScope: 'organization',
      sourceInitiativeId: 'init-b',
    });

    const initiativeA = await artifactRegistryService.listArtifactsForUser({
      organizationId: 'org-a',
      userId: 'user-owner',
      filters: { sourceInitiativeId: 'init-a', limit: 50 },
    });

    expect(initiativeA).toHaveLength(1);
    expect(initiativeA[0]?.resolvedTitle).toBe('Initiative A report');
    expect(initiativeA[0]?.sourceInitiativeId).toBe('init-a');
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

  it('materializeArtifactRun completes a report run and links the canonical artifact', async () => {
    spineMocks.initiateHandoff.mockResolvedValue({ executionRunId: 'exec-run-5' });
    spineMocks.createProposal.mockResolvedValue({ proposalId: 'proposal-report-1' });

    await new Promise<void>((resolve, reject) => {
      sqliteCtx.db.run(
        `INSERT INTO report_builder_templates (
          id, organization_id, source_type, report_type, sections_json, is_default, is_public
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          'tpl-report-1',
          'org-a',
          'INTERVIEW',
          'INTERVIEW',
          JSON.stringify([
            {
              key: 'summary',
              type: 'summary',
              title: 'Summary',
              required: true,
              order: 1,
            },
          ]),
          1,
          0,
        ],
        (err) => (err ? reject(err) : resolve()),
      );
    });

    const created = await artifactRegistryService.createArtifactRunFromChat({
      organizationId: 'org-a',
      userId: 'user-owner',
      conversationId: 'conv-4',
      contextSnapshotId: 'snap-4',
      goal: 'Quarterly board report',
      requestedArtifactFamily: 'document',
      requestedOutputType: 'report',
    });

    await artifactRegistryService.acceptArtifactRunPlan({
      runId: created.artifactRunId,
      organizationId: 'org-a',
      actorUserId: 'user-owner',
    });

    const completed = await artifactRegistryService.materializeArtifactRun({
      runId: created.artifactRunId,
      organizationId: 'org-a',
      actorUserId: 'user-owner',
      title: 'Quarterly board report',
      sourceType: 'INTERVIEW',
      sourceId: 'interview-1',
      sourceName: 'Founder interview',
      templateId: 'tpl-report-1',
      config: { audience: 'board' },
    });

    expect(completed.runStatus).toBe('completed');
    expect(completed.artifactId).toBeTruthy();
    expect(completed.completedAt).toBeTruthy();
    expect(spineMocks.submitForReview).toHaveBeenCalledWith(
      'exec-run-5',
      'org-a',
      'user-owner',
    );
    expect(spineMocks.approveRun).toHaveBeenCalledWith(
      'exec-run-5',
      'org-a',
      'user-owner',
      'ArtifactRun materialization approved',
    );
    expect(spineMocks.applyRun).toHaveBeenCalledWith('exec-run-5', 'org-a', 'user-owner');
    expect(spineMocks.completeRun).toHaveBeenCalledWith('exec-run-5', 'org-a', 'user-owner');

    const artifact = await artifactRegistryService.getArtifactForUser({
      organizationId: 'org-a',
      artifactId: completed.artifactId!,
      userId: 'user-owner',
      roleKey: null,
    });
    expect(artifact).not.toBeNull();
    expect(artifact?.outputType).toBe('report');
    expect(artifact?.originRuntime).toBe('report');
    expect(artifact?.resolvedTitle).toBe('Quarterly board report');
  });

  it('materializeArtifactRun completes a presentation run and links the canonical artifact', async () => {
    spineMocks.initiateHandoff.mockResolvedValueOnce({ executionRunId: 'exec-run-6' });
    spineMocks.createProposal.mockResolvedValue({ proposalId: 'proposal-deck-1' });

    const created = await artifactRegistryService.createArtifactRunFromChat({
      organizationId: 'org-a',
      userId: 'user-owner',
      conversationId: 'conv-6',
      contextSnapshotId: 'snap-6',
      goal: 'Executive board deck',
      requestedArtifactFamily: 'presentation',
      requestedOutputType: 'presentation',
    });

    await artifactRegistryService.acceptArtifactRunPlan({
      runId: created.artifactRunId,
      organizationId: 'org-a',
      actorUserId: 'user-owner',
    });

    const completed = await artifactRegistryService.materializeArtifactRun({
      runId: created.artifactRunId,
      organizationId: 'org-a',
      actorUserId: 'user-owner',
      title: 'Executive board deck',
      sourceType: 'tool',
      sourceId: 'tool-session-1',
      sourceName: 'Strategy workshop',
      config: {
        audience: 'executive',
        goal: 'decide',
        language: 'en',
        theme: 'modern',
        confidentiality: 'internal',
      },
    });

    expect(completed.runStatus).toBe('completed');
    expect(completed.artifactId).toBeTruthy();
    expect(completed.completedAt).toBeTruthy();
    expect(spineMocks.submitForReview).toHaveBeenCalledWith(
      'exec-run-6',
      'org-a',
      'user-owner',
    );
    expect(spineMocks.approveRun).toHaveBeenCalledWith(
      'exec-run-6',
      'org-a',
      'user-owner',
      'ArtifactRun materialization approved',
    );
    expect(spineMocks.applyRun).toHaveBeenCalledWith('exec-run-6', 'org-a', 'user-owner');
    expect(spineMocks.completeRun).toHaveBeenCalledWith('exec-run-6', 'org-a', 'user-owner');

    const artifact = await artifactRegistryService.getArtifactForUser({
      organizationId: 'org-a',
      artifactId: completed.artifactId!,
      userId: 'user-owner',
      roleKey: null,
    });
    expect(artifact).not.toBeNull();
    expect(artifact?.outputType).toBe('presentation');
    expect(artifact?.originRuntime).toBe('presentation');
    expect(artifact?.resolvedTitle).toBe('Executive board deck');
  });

  it('retryArtifactRun persists retry lineage and returns a fresh planned run (spine mocked)', async () => {
    spineMocks.initiateHandoff
      .mockResolvedValueOnce({ executionRunId: 'exec-run-3' })
      .mockResolvedValueOnce({ executionRunId: 'exec-run-4' });

    const created = await artifactRegistryService.createArtifactRunFromChat({
      organizationId: 'org-a',
      userId: 'user-owner',
      conversationId: 'conv-3',
      contextSnapshotId: 'snap-3',
      goal: 'Executive board deck',
      requestedArtifactFamily: 'presentation',
      requestedOutputType: 'presentation',
    });

    const retried = await artifactRegistryService.retryArtifactRun({
      runId: created.artifactRunId,
      organizationId: 'org-a',
      actorUserId: 'user-owner',
    });

    expect(retried.runId).not.toBe(created.artifactRunId);
    expect(retried.retryOfRunId).toBe(created.artifactRunId);
    expect(retried.executionRunId).toBe('exec-run-4');
    expect(retried.runStatus).toBe('planned');
  });
});
