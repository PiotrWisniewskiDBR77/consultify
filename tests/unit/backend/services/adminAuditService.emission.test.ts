/**
 * Admin Audit Service — emission + org-scoping + fail-safe (H2.12 / BUG A).
 *
 * These tests exercise the REAL adminAuditService against an in-memory fake
 * IDatabase so we prove:
 *   1. logAction persists org_id into the indexed organization_id column.
 *   2. getLogs({ organizationId }) reads by that column (SQL-level, not a
 *      top-N JS over-fetch) and returns the just-written entry.
 *   3. A DB failure inside logAction NEVER throws (fail-safe) — the caller
 *      action must be able to proceed.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

import adminAuditService from '../../../../server/src/services/adminAuditService.ts';

interface Row {
  id: string;
  organization_id: string | null;
  admin_id: string;
  action_type: string;
  resource_type: string;
  metadata_json: string;
  risk_score: number;
  status: string;
  created_at: string;
}

class FakeDb {
  rows: Row[] = [];
  throwOnRun = false;

  async run(sql: string, params: unknown[] = []): Promise<{ changes: number }> {
    if (this.throwOnRun) throw new Error('simulated audit write failure');
    if (/INSERT INTO admin_audit_logs/i.test(sql)) {
      const [id, organization_id, admin_id, action_type, resource_type, metadata_json, risk_score, status] =
        params as any[];
      this.rows.push({
        id,
        organization_id: organization_id ?? null,
        admin_id,
        action_type,
        resource_type,
        metadata_json,
        risk_score: Number(risk_score),
        status,
        created_at: new Date(Date.now() + this.rows.length).toISOString(),
      });
    }
    return { changes: 1 };
  }

  async all(sql: string, params: unknown[] = []): Promise<any[]> {
    // getLogs org-scope query: WHERE organization_id = ? OR (organization_id IS NULL AND metadata_json LIKE ?)
    if (/WHERE organization_id/i.test(sql)) {
      const [orgStr, like] = params as any[];
      const likeCore = String(like).replace(/%/g, '');
      const matched = this.rows
        .filter(
          (r) =>
            r.organization_id === orgStr ||
            (r.organization_id === null && r.metadata_json.includes(likeCore))
        )
        .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
      return matched;
    }
    // superadmin / unscoped path
    return [...this.rows].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  }

  async get(): Promise<any> {
    return { total_logs: this.rows.length, unresolved_count: this.rows.length };
  }
}

describe('adminAuditService emission + org-scoping (BUG A / H2.12)', () => {
  let fake: FakeDb;

  beforeEach(() => {
    fake = new FakeDb();
    adminAuditService.setDependencies({
      db: fake as any,
      uuidv4: (() => `id-${fake.rows.length + 1}`) as any,
      logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
    });
  });

  it('persists organization_id to the indexed column on a role-change emission', async () => {
    await adminAuditService.logAction({
      adminId: 'actor-1',
      actionType: 'update_member_role',
      details: { orgId: 'org-1', targetUserId: 'user-9', fromRole: 'MEMBER', toRole: 'ADMIN' },
    });

    expect(fake.rows).toHaveLength(1);
    expect(fake.rows[0].organization_id).toBe('org-1');
    expect(fake.rows[0].action_type).toBe('update_member_role');
    expect(fake.rows[0].admin_id).toBe('actor-1');
    // resource_type is NOT NULL in the strict schema — must be populated.
    expect(fake.rows[0].resource_type).toBeTruthy();
  });

  it('getLogs returns the just-written entry for the active org (BUG A repro)', async () => {
    await adminAuditService.logAction({
      adminId: 'actor-1',
      actionType: 'update_security_policy',
      details: { orgId: 'org-1' },
    });

    const logs = await adminAuditService.getLogs({ organizationId: 'org-1', limit: 50, offset: 0 });
    expect(logs).toHaveLength(1);
    expect(logs[0].action_type).toBe('update_security_policy');
  });

  it('scopes strictly to the requested org (no cross-tenant leak)', async () => {
    await adminAuditService.logAction({
      adminId: 'a',
      actionType: 'update_security_policy',
      details: { orgId: 'org-1' },
    });
    await adminAuditService.logAction({
      adminId: 'b',
      actionType: 'update_security_policy',
      details: { orgId: 'org-2' },
    });

    const org1 = await adminAuditService.getLogs({ organizationId: 'org-1', limit: 50 });
    expect(org1).toHaveLength(1);
    expect(org1[0].admin_id).toBe('a');
  });

  it('reads legacy rows that only carry orgId inside metadata_json (organization_id NULL)', async () => {
    // Simulate a legacy row written before the organization_id column was populated.
    fake.rows.push({
      id: 'legacy-1',
      organization_id: null,
      admin_id: 'legacy-actor',
      action_type: 'update_security_policy',
      resource_type: 'update_security_policy',
      metadata_json: JSON.stringify({ orgId: 'org-legacy' }),
      risk_score: 20,
      status: 'logged',
      created_at: new Date().toISOString(),
    });

    const logs = await adminAuditService.getLogs({ organizationId: 'org-legacy', limit: 50 });
    expect(logs).toHaveLength(1);
    expect(logs[0].id).toBe('legacy-1');
  });

  it('is fail-safe: a DB write failure does NOT throw (action can proceed)', async () => {
    fake.throwOnRun = true;
    const warn = vi.fn();
    adminAuditService.setDependencies({ db: fake as any, logger: { warn, error: vi.fn(), info: vi.fn() } });

    let threw = false;
    let result: any;
    try {
      result = await adminAuditService.logAction({
        adminId: 'actor-1',
        actionType: 'update_security_policy',
        details: { orgId: 'org-1' },
      });
    } catch {
      threw = true;
    }

    expect(threw).toBe(false);
    expect(result?.persisted).toBe(false);
    expect(warn).toHaveBeenCalled();
  });
});
