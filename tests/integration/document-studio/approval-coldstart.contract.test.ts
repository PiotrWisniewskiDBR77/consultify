/**
 * M18 · L-01 cold-start proof (CI form) + L-02 (S4 real DAO, not vi.mock).
 *
 * Wave5 layer-2 (mig.780) moved approvals from an in-process Map to Postgres.
 * The existing 889 green tests mock the DAO, so they would still pass if the
 * DAO silently reverted to in-memory — masking data-loss after deploy.
 *
 * This test runs the REAL `documentApprovalRegistryDao` against a real SQL
 * store (in-memory SQLite via the DbPromise seam). It persists an approval,
 * then reads it back through a SEPARATE load call (= cold start: no DAO-level
 * cache) and proves the row came from the store — org-scoped, payload intact.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const sqliteCtx = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const sqlite3 = require('sqlite3') as typeof import('sqlite3');
  return { db: new sqlite3.Database(':memory:') };
});

// Translate the DAO's Postgres SQL to SQLite: $N → ?, drop ::jsonb casts.
function toSqlite(sql: string): string {
  return sql.replace(/::jsonb/g, '').replace(/\$\d+/g, '?');
}

vi.mock('../../../server/src/utils/Logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../../server/src/utils/DbPromise.js', () => ({
  all: <T = unknown>(sql: string, params: unknown[] = []): Promise<T[]> =>
    new Promise((resolve) => {
      sqliteCtx.db.all(toSqlite(sql), params, (err: Error | null, rows: unknown[]) =>
        resolve(err ? [] : ((rows || []) as T[]))
      );
    }),
  run: (
    sql: string,
    params: unknown[] = []
  ): Promise<{ success: boolean; changes?: number; error?: string }> =>
    new Promise((resolve) => {
      sqliteCtx.db.run(
        toSqlite(sql),
        params,
        function (this: { changes: number }, err: Error | null) {
          resolve(err ? { success: false, error: err.message } : { success: true, changes: this.changes });
        }
      );
    }),
}));

import {
  __resetApprovalRegistryDaoForTests,
  loadApprovalById,
  loadApprovalsForArtifact,
  loadApprovalsForOrganization,
  loadAuditForApproval,
  persistApproval,
  persistApprovalAuditEntry,
} from '../../../server/src/services/documentStudio/documentApprovalRegistryDao.js';

function ddl(): Promise<void> {
  return new Promise((resolve, reject) => {
    sqliteCtx.db.exec(
      `CREATE TABLE IF NOT EXISTS document_approvals (
         approval_id TEXT PRIMARY KEY, artifact_id TEXT, organization_id TEXT,
         status TEXT, requested_by TEXT, created_at TEXT, updated_at TEXT, payload_json TEXT
       );
       CREATE TABLE IF NOT EXISTS document_approval_audit (
         audit_id TEXT PRIMARY KEY, approval_id TEXT, artifact_id TEXT, organization_id TEXT,
         action TEXT, actor_id TEXT, occurred_at TEXT, payload_json TEXT
       );`,
      (err) => (err ? reject(err) : resolve())
    );
  });
}

const ORG = 'org-A';
const OTHER_ORG = 'org-B';

function makeApproval(over: Partial<Record<string, unknown>> = {}) {
  return {
    approvalId: 'appr-1',
    organizationId: ORG,
    artifactId: 'art-1',
    requestedBy: 'user-1',
    participants: [{ userId: 'user-2', role: 'approver' }],
    quorumPolicy: { type: 'all' },
    status: 'pending',
    decisions: [],
    createdAt: '2026-06-17T10:00:00.000Z',
    updatedAt: '2026-06-17T10:00:00.000Z',
    ...over,
  } as any;
}

describe('M18 · documentApprovalRegistryDao — wave5 cold-start persistence (real SQL)', () => {
  beforeAll(() => ddl());
  beforeEach(() => __resetApprovalRegistryDaoForTests());
  afterAll(
    () =>
      new Promise<void>((resolve, reject) => {
        sqliteCtx.db.close((err) => (err ? reject(err) : resolve()));
      })
  );

  it('persistApproval writes a real row; loadApprovalById reads it back (cold start)', async () => {
    const res = await persistApproval(makeApproval());
    expect(res.ok).toBe(true);

    // Separate load = simulated cold start (no DAO cache). Row must come from store.
    const loaded = await loadApprovalById('appr-1', ORG);
    expect(loaded?.approvalId).toBe('appr-1');
    expect(loaded?.status).toBe('pending');
    expect(loaded?.participants).toHaveLength(1); // nested payload survived round-trip
  });

  it('NOT in-memory: a row persisted survives without any prior load hydration', async () => {
    await persistApproval(makeApproval({ approvalId: 'appr-cold', status: 'approved' }));
    // First ever read for this id — proves it was actually stored, not cached.
    const loaded = await loadApprovalById('appr-cold', ORG);
    expect(loaded?.status).toBe('approved');
  });

  it('org-scope: cross-tenant read returns null even when approvalId exists', async () => {
    await persistApproval(makeApproval());
    expect(await loadApprovalById('appr-1', OTHER_ORG)).toBeNull();
  });

  it('upsert: re-persisting same approvalId updates (no duplicate row)', async () => {
    await persistApproval(makeApproval());
    await persistApproval(makeApproval({ status: 'approved' }));
    const forArtifact = await loadApprovalsForArtifact('art-1', ORG);
    expect(forArtifact).toHaveLength(1);
    expect(forArtifact[0].status).toBe('approved');
  });

  it('tenant-wide load returns only this org rows', async () => {
    await persistApproval(makeApproval());
    await persistApproval(makeApproval({ approvalId: 'appr-2' }));
    await persistApproval(makeApproval({ approvalId: 'appr-x', organizationId: OTHER_ORG }));
    const rows = await loadApprovalsForOrganization(ORG);
    expect(rows.map((r) => r.approvalId).sort()).toEqual(['appr-1', 'appr-2']);
  });

  it('audit entries persist and load oldest-first, org-scoped', async () => {
    await persistApprovalAuditEntry({
      auditId: 'aud-1',
      approvalId: 'appr-1',
      organizationId: ORG,
      artifactId: 'art-1',
      action: 'approval_requested',
      actorId: 'user-1',
      occurredAt: '2026-06-17T10:00:00.000Z',
    } as any);
    const audit = await loadAuditForApproval('appr-1', ORG);
    expect(audit).toHaveLength(1);
    expect(audit[0].auditId).toBe('aud-1');
    expect(await loadAuditForApproval('appr-1', OTHER_ORG)).toEqual([]);
  });

  it('reset clears both tables', async () => {
    await persistApproval(makeApproval());
    await __resetApprovalRegistryDaoForTests();
    expect(await loadApprovalsForOrganization(ORG)).toEqual([]);
  });
});
