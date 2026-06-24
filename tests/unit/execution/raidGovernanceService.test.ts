/**
 * M14/F8 (8.2) — raidGovernanceService.
 * Pure signal logic (assumptions + issues) and org-scoped linkIssueToRisk.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Row = Record<string, any>;

const db = vi.hoisted(() => ({
  items: new Map<string, Row>(),
  calls: [] as Array<{ kind: 'get' | 'run'; sql: string; params: any[] }>,
}));

vi.mock('uuid', () => ({ v4: () => 'new-issue-id' }));

vi.mock('../../../server/src/utils/Logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../../server/src/utils/DbPromise.js', () => ({
  all: async () => [],
  get: async (sql: string, params: any[] = []) => {
    db.calls.push({ kind: 'get', sql: sql.replace(/\s+/g, ' ').trim(), params });
    // org-scoped lookup: WHERE organization_id = ? AND id = ?
    const [orgId, id] = params;
    const row = db.items.get(id);
    if (!row || row.organization_id !== orgId) return null;
    return { ...row };
  },
  run: async (sql: string, params: any[] = []) => {
    const normalized = sql.replace(/\s+/g, ' ').trim();
    db.calls.push({ kind: 'run', sql: normalized, params });
    if (normalized.startsWith('UPDATE raid_items')) {
      // params: [linked_items, updated_at, organization_id, id]
      const [linked, , orgId, id] = params;
      const row = db.items.get(id);
      if (!row || row.organization_id !== orgId) return { success: true, changes: 0 };
      row.linked_items = linked;
      return { success: true, changes: 1 };
    }
    if (normalized.startsWith('INSERT INTO raid_items')) {
      // type & status are SQL literals (not bound), so params are:
      // [id, orgId, initiativeId, title, description, impact, owner_id,
      //  linked_items, materialized_at, created_at, updated_at]
      const [id, orgId, initiativeId] = params;
      db.items.set(id, {
        id,
        organization_id: orgId,
        initiative_id: initiativeId,
        type: 'ISSUE',
        linked_items: params[7],
        materialized_at: params[8],
      });
      return { success: true, changes: 1 };
    }
    return { success: true, changes: 0 };
  },
}));

import {
  assumptionSignals,
  issueSignals,
  linkIssueToRisk,
  materializeRiskToIssue,
} from '../../../server/src/services/raidGovernanceService.js';

const NOW = new Date('2026-06-23T12:00:00Z').getTime();
const PAST = '2026-06-01T00:00:00Z';
const FUTURE = '2026-12-31T00:00:00Z';

beforeEach(() => {
  db.items.clear();
  db.calls.length = 0;
});

describe('assumptionSignals (pure)', () => {
  it('flags an invalidated assumption regardless of date', () => {
    const out = assumptionSignals(
      [{ id: 'a1', title: 'Vendor will deliver', validation_status: 'invalidated' }],
      NOW
    );
    expect(out).toEqual([
      { raidId: 'a1', type: 'UNVALIDATED_ASSUMPTION_OVERDUE', title: 'Vendor will deliver' },
    ]);
  });

  it('flags an unvalidated assumption past its validation_due_date', () => {
    const out = assumptionSignals(
      [{ id: 'a2', title: 'API stable', validation_status: 'unvalidated', validation_due_date: PAST }],
      NOW
    );
    expect(out).toHaveLength(1);
    expect(out[0].raidId).toBe('a2');
  });

  it('stays silent for validated, or unvalidated-but-not-yet-due', () => {
    const out = assumptionSignals(
      [
        { id: 'a3', title: 'OK', validation_status: 'validated', validation_due_date: PAST },
        { id: 'a4', title: 'Pending', validation_status: 'unvalidated', validation_due_date: FUTURE },
        { id: 'a5', title: 'No due date', validation_status: 'unvalidated' },
      ],
      NOW
    );
    expect(out).toEqual([]);
  });
});

describe('issueSignals (pure)', () => {
  it('flags an open issue past resolution_due_date with impact-driven severity', () => {
    const out = issueSignals(
      [{ id: 'i1', title: 'Prod down', status: 'OPEN', resolution_due_date: PAST, impact: 'CRITICAL' }],
      NOW
    );
    expect(out).toEqual([{ raidId: 'i1', type: 'UNRESOLVED_ISSUE_OVERDUE', severity: 'CRITICAL' }]);
  });

  it('defaults severity to MEDIUM when impact is unknown', () => {
    const out = issueSignals(
      [{ id: 'i2', title: 'Slow', status: 'OPEN', resolution_due_date: PAST }],
      NOW
    );
    expect(out[0].severity).toBe('MEDIUM');
  });

  it('stays silent for closed issues or issues still within SLA', () => {
    const out = issueSignals(
      [
        { id: 'i3', title: 'Done', status: 'CLOSED', resolution_due_date: PAST },
        { id: 'i4', title: 'On track', status: 'OPEN', resolution_due_date: FUTURE },
        { id: 'i5', title: 'No SLA', status: 'OPEN' },
      ],
      NOW
    );
    expect(out).toEqual([]);
  });
});

describe('linkIssueToRisk (org-scoped, JSON merge)', () => {
  it('merges riskId into the issue linked_items without duplicating, scoped to org', async () => {
    db.items.set('issue-1', {
      id: 'issue-1',
      organization_id: 'org-A',
      type: 'ISSUE',
      linked_items: JSON.stringify(['risk-existing']),
    });

    const res = await linkIssueToRisk('org-A', 'issue-1', 'risk-new');
    expect(res.success).toBe(true);
    expect(res.linkedItems).toEqual(['risk-existing', 'risk-new']);
    expect(db.items.get('issue-1')!.linked_items).toBe(
      JSON.stringify(['risk-existing', 'risk-new'])
    );

    // idempotent on repeat
    const res2 = await linkIssueToRisk('org-A', 'issue-1', 'risk-new');
    expect(res2.linkedItems).toEqual(['risk-existing', 'risk-new']);

    // every statement (SELECT + UPDATE) is org-scoped — carries the org id
    expect(db.calls.length).toBeGreaterThan(0);
    expect(db.calls.every((c) => c.params.includes('org-A'))).toBe(true);
    // and every SQL touching raid_items filters on organization_id
    expect(
      db.calls.every((c) => /organization_id\s*=\s*\?/.test(c.sql))
    ).toBe(true);
  });

  it('refuses to link an issue belonging to a different org', async () => {
    db.items.set('issue-2', { id: 'issue-2', organization_id: 'org-A', type: 'ISSUE' });
    const res = await linkIssueToRisk('org-B', 'issue-2', 'risk-x');
    expect(res.success).toBe(false);
    expect(res.error).toBe('issue_not_found');
  });
});

describe('materializeRiskToIssue (org-scoped)', () => {
  it('creates an ISSUE from a RISK carrying the source risk id + materialized_at', async () => {
    db.items.set('risk-1', {
      id: 'risk-1',
      organization_id: 'org-A',
      type: 'RISK',
      initiative_id: 'init-1',
      title: 'Vendor risk',
      description: 'desc',
      impact: 'HIGH',
      owner_id: 'u1',
    });

    const res = await materializeRiskToIssue('org-A', 'risk-1');
    expect(res.success).toBe(true);
    expect(res.issueId).toBe('new-issue-id');

    const issue = db.items.get('new-issue-id')!;
    expect(issue.type).toBe('ISSUE');
    expect(issue.linked_items).toBe(JSON.stringify(['risk-1']));
    expect(typeof issue.materialized_at).toBe('string');
  });

  it('refuses a risk from another org', async () => {
    db.items.set('risk-2', { id: 'risk-2', organization_id: 'org-A', type: 'RISK' });
    const res = await materializeRiskToIssue('org-B', 'risk-2');
    expect(res.success).toBe(false);
    expect(res.error).toBe('risk_not_found');
  });
});
