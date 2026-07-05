import { beforeEach, describe, expect, it, vi } from 'vitest';

type Row = Record<string, any>;

const db = vi.hoisted(() => ({
  runbooks: new Map<string, Row>(),
  steps: new Map<string, Row>(),
  uuidCounter: 0,
}));

function nextUuid() {
  db.uuidCounter += 1;
  return `cutover-id-${db.uuidCounter}`;
}

vi.mock('uuid', () => ({ v4: () => nextUuid() }));

vi.mock('../../../server/src/utils/DbPromise.js', () => ({
  run: async (sql: string, params: any[] = []) => {
    const n = sql.replace(/\s+/g, ' ').trim();

    if (n.startsWith('INSERT INTO cutover_runbooks')) {
      const [id, organizationId, initiativeId, stageId, name, status, goNoGo, createdAt, updatedAt] =
        params;
      db.runbooks.set(id, {
        id,
        organization_id: organizationId,
        initiative_id: initiativeId,
        stage_id: stageId,
        name,
        status,
        go_no_go: goNoGo,
        created_at: createdAt,
        updated_at: updatedAt,
      });
      return { success: true, changes: 1 };
    }

    if (n.startsWith('INSERT INTO cutover_steps')) {
      const [
        id,
        organizationId,
        runbookId,
        sequence,
        title,
        ownerId,
        timeWindow,
        status,
        isRollback,
        createdAt,
        updatedAt,
      ] = params;
      db.steps.set(id, {
        id,
        organization_id: organizationId,
        runbook_id: runbookId,
        sequence,
        title,
        owner_id: ownerId,
        time_window: timeWindow,
        status,
        is_rollback: isRollback,
        created_at: createdAt,
        updated_at: updatedAt,
      });
      return { success: true, changes: 1 };
    }

    if (n.startsWith('UPDATE cutover_steps')) {
      const [status, updatedAt, organizationId, stepId] = params;
      const row = db.steps.get(stepId);
      if (row && row.organization_id === organizationId) {
        row.status = status;
        row.updated_at = updatedAt;
      }
      return { success: true, changes: row ? 1 : 0 };
    }

    return { success: true, changes: 0 };
  },

  get: async (sql: string, params: any[] = []) => {
    const n = sql.replace(/\s+/g, ' ').trim();

    if (n.startsWith('SELECT * FROM cutover_runbooks')) {
      const [orgId, initiativeId] = params;
      const matches = [...db.runbooks.values()]
        .filter((r) => r.organization_id === orgId && r.initiative_id === initiativeId)
        .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
      return matches[0] ?? null;
    }

    if (n.startsWith('SELECT MAX(sequence)')) {
      const [orgId, runbookId] = params;
      const seqs = [...db.steps.values()]
        .filter((r) => r.organization_id === orgId && r.runbook_id === runbookId)
        .map((r) => Number(r.sequence));
      return { max_seq: seqs.length ? Math.max(...seqs) : null };
    }

    if (n.startsWith('SELECT * FROM cutover_steps')) {
      const [orgId, stepId] = params;
      const row = db.steps.get(stepId);
      return row && row.organization_id === orgId ? row : null;
    }

    return null;
  },

  all: async (sql: string, params: any[] = []) => {
    const n = sql.replace(/\s+/g, ' ').trim();
    if (n.startsWith('SELECT * FROM cutover_steps')) {
      const [orgId, runbookId] = params;
      return [...db.steps.values()]
        .filter((r) => r.organization_id === orgId && r.runbook_id === runbookId)
        .sort((a, b) => Number(a.sequence) - Number(b.sequence));
    }
    return [];
  },
}));

import {
  addStep,
  advanceStep,
  createRunbook,
  evaluateRollbackTriggers,
  getRunbook,
} from '../../../server/src/services/cutoverRunbookService.js';

beforeEach(() => {
  db.runbooks.clear();
  db.steps.clear();
  db.uuidCounter = 0;
});

const ORG = 'org-1';
const OTHER_ORG = 'org-2';

describe('cutoverRunbookService — CRUD', () => {
  it('creates a runbook and reads it back by initiative', async () => {
    const created = await createRunbook(ORG, {
      initiativeId: 'init-1',
      stageId: 'stage-1',
      name: 'Go-live R1',
    });
    expect(created.id).toBe('cutover-id-1');
    expect(created.status).toBe('planned');
    expect(created.organizationId).toBe(ORG);

    const fetched = await getRunbook(ORG, 'init-1');
    expect(fetched).not.toBeNull();
    expect(fetched!.name).toBe('Go-live R1');
    expect(fetched!.steps).toEqual([]);
  });

  it('does not leak runbooks across orgs', async () => {
    await createRunbook(ORG, { initiativeId: 'init-1', name: 'A' });
    const fetched = await getRunbook(OTHER_ORG, 'init-1');
    expect(fetched).toBeNull();
  });

  it('auto-assigns sequences and returns ordered steps incl. rollback', async () => {
    const rb = await createRunbook(ORG, { initiativeId: 'init-1', name: 'RB' });

    const s1 = await addStep(ORG, rb.id, { title: 'Freeze writes', ownerId: 'u1' });
    const s2 = await addStep(ORG, rb.id, { title: 'Migrate data', timeWindow: '02:00-03:00' });
    const rollback = await addStep(ORG, rb.id, {
      title: 'Restore snapshot',
      isRollback: true,
    });

    expect(s1.sequence).toBe(0);
    expect(s2.sequence).toBe(1);
    expect(rollback.sequence).toBe(2);
    expect(rollback.isRollback).toBe(true);

    const fetched = await getRunbook(ORG, 'init-1');
    expect(fetched!.steps!.map((s) => s.title)).toEqual([
      'Freeze writes',
      'Migrate data',
      'Restore snapshot',
    ]);
    expect(fetched!.steps!.find((s) => s.isRollback)?.title).toBe('Restore snapshot');
  });

  it('advances a step status (org-scoped)', async () => {
    const rb = await createRunbook(ORG, { initiativeId: 'init-1', name: 'RB' });
    const step = await addStep(ORG, rb.id, { title: 'Cutover', status: 'pending' });

    const advanced = await advanceStep(ORG, step.id, 'in_progress');
    expect(advanced).not.toBeNull();
    expect(advanced!.status).toBe('in_progress');

    // wrong org cannot read the step back
    const crossOrg = await advanceStep(OTHER_ORG, step.id, 'done');
    expect(crossOrg).toBeNull();
  });
});

describe('evaluateRollbackTriggers — pure', () => {
  it('GO when healthy', () => {
    const result = evaluateRollbackTriggers({
      errorRatePct: 0.5,
      perfVsBaselinePct: 102,
      criticalProcessesOk: true,
    });
    expect(result.rollback).toBe(false);
    expect(result.reasons).toEqual([]);
  });

  it('ROLLBACK on error rate over threshold', () => {
    const result = evaluateRollbackTriggers({ errorRatePct: 5 });
    expect(result.rollback).toBe(true);
    expect(result.reasons.join(' ')).toMatch(/error rate/i);
  });

  it('ROLLBACK on performance over 110% of baseline', () => {
    const result = evaluateRollbackTriggers({ perfVsBaselinePct: 125 });
    expect(result.rollback).toBe(true);
    expect(result.reasons.join(' ')).toMatch(/performance/i);
  });

  it('ROLLBACK when a critical process is not OK', () => {
    const result = evaluateRollbackTriggers({ criticalProcessesOk: false });
    expect(result.rollback).toBe(true);
    expect(result.reasons.join(' ')).toMatch(/critical/i);
  });

  it('aggregates multiple reasons', () => {
    const result = evaluateRollbackTriggers({
      errorRatePct: 9,
      perfVsBaselinePct: 200,
      criticalProcessesOk: false,
    });
    expect(result.rollback).toBe(true);
    expect(result.reasons).toHaveLength(3);
  });

  it('treats undefined metrics as no signal (GO)', () => {
    expect(evaluateRollbackTriggers({}).rollback).toBe(false);
  });

  it('honors custom thresholds', () => {
    const strict = evaluateRollbackTriggers(
      { errorRatePct: 1.5 },
      { errorRatePct: 1, perfVsBaselinePct: 105 }
    );
    expect(strict.rollback).toBe(true);
  });
});
