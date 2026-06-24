import { beforeEach, describe, expect, it, vi } from 'vitest';

// Capture INSERT calls routed through DbPromise.all
const dbAllCalls: Array<{ sql: string; params: unknown[] }> = [];

vi.mock('../../../server/src/utils/DbPromise.js', () => ({
  all: async (sql: string, params: unknown[] = []) => {
    dbAllCalls.push({ sql, params });
    // Echo back a row shaped like the RETURNING clause expects.
    return [
      {
        id: 'chg-1',
        organization_id: params[0],
        project_id: params[1],
        title: params[2],
        type: params[3],
        status: params[4],
        change_class: params[5],
        requested_by: params[6],
        assessment: params[7],
        decision_date: null,
        created_at: '2026-06-23T00:00:00.000Z',
        updated_at: '2026-06-23T00:00:00.000Z',
      },
    ];
  },
}));

beforeEach(() => {
  dbAllCalls.length = 0;
});

describe('classifyChange', () => {
  it('returns "standard" for pre-approved changes', async () => {
    const { classifyChange } = await import(
      '../../../server/src/services/changeControlService.js'
    );
    expect(classifyChange({ preApproved: true })).toBe('standard');
    // preApproved wins even over high impact / irreversible
    expect(
      classifyChange({ preApproved: true, impact: 'critical', reversible: false }),
    ).toBe('standard');
  });

  it('returns "emergency" for high-impact or irreversible changes', async () => {
    const { classifyChange } = await import(
      '../../../server/src/services/changeControlService.js'
    );
    expect(classifyChange({ impact: 'high' })).toBe('emergency');
    expect(classifyChange({ impact: 'CRITICAL' })).toBe('emergency');
    expect(classifyChange({ reversible: false })).toBe('emergency');
  });

  it('returns "normal" for everything else', async () => {
    const { classifyChange } = await import(
      '../../../server/src/services/changeControlService.js'
    );
    expect(classifyChange({})).toBe('normal');
    expect(classifyChange({ impact: 'low', reversible: true })).toBe('normal');
    expect(classifyChange({ impact: 'medium' })).toBe('normal');
  });
});

describe('assessChangeRisk', () => {
  it('returns LOW for negligible changes', async () => {
    const { assessChangeRisk } = await import(
      '../../../server/src/services/changeControlService.js'
    );
    const r = assessChangeRisk({});
    expect(r.score).toBe(0);
    expect(r.level).toBe('LOW');

    // small slip alone stays LOW (score 1)
    expect(assessChangeRisk({ scheduleImpactDays: 3 }).level).toBe('LOW');
  });

  it('returns MEDIUM for moderate changes', async () => {
    const { assessChangeRisk } = await import(
      '../../../server/src/services/changeControlService.js'
    );
    // 10 days → ceil(10/5)=2, 2 initiatives → 2 ⇒ score 4
    const r = assessChangeRisk({ scheduleImpactDays: 10, affectedInitiatives: 2 });
    expect(r.score).toBe(4);
    expect(r.level).toBe('MEDIUM');
  });

  it('returns HIGH for large multi-dimension changes', async () => {
    const { assessChangeRisk } = await import(
      '../../../server/src/services/changeControlService.js'
    );
    // 25 days → cap... ceil(25/5)=5; cost 30k → 3; reach 4 ⇒ 12 (>6)
    const r = assessChangeRisk({
      scheduleImpactDays: 25,
      costImpact: 30_000,
      affectedInitiatives: 4,
    });
    expect(r.level).toBe('HIGH');
    expect(r.score).toBeGreaterThan(6);
  });

  it('caps each dimension so one factor cannot dominate', async () => {
    const { assessChangeRisk } = await import(
      '../../../server/src/services/changeControlService.js'
    );
    // huge schedule alone capped at 6 ⇒ still MEDIUM, not HIGH
    const r = assessChangeRisk({ scheduleImpactDays: 1000 });
    expect(r.score).toBe(6);
    expect(r.level).toBe('MEDIUM');
  });
});

describe('emitChange', () => {
  it('inserts an org-scoped row into rollout_changes', async () => {
    const { emitChange } = await import(
      '../../../server/src/services/changeControlService.js'
    );
    const result = await emitChange('org-42', {
      initiativeId: 'init-7',
      title: 'Rebaseline schedule',
      type: 'rebaseline',
      change_class: 'normal',
      requested_by: 'system',
      assessment: 'MEDIUM',
    });

    expect(dbAllCalls).toHaveLength(1);
    const { sql, params } = dbAllCalls[0];
    expect(sql).toContain('INSERT INTO rollout_changes');
    expect(sql).toContain('organization_id');
    expect(sql).toContain('change_class');
    // org-scope: first bound param is the org id
    expect(params[0]).toBe('org-42');
    expect(params[1]).toBe('init-7');
    expect(params[2]).toBe('Rebaseline schedule');
    expect(params[3]).toBe('rebaseline');
    expect(params[4]).toBe('PROPOSED');
    expect(params[5]).toBe('normal');

    expect(result.id).toBe('chg-1');
    expect(result.organization_id).toBe('org-42');
  });

  it('applies safe defaults for optional fields', async () => {
    const { emitChange } = await import(
      '../../../server/src/services/changeControlService.js'
    );
    await emitChange('org-9', { title: 'KPI target changed' });

    const { params } = dbAllCalls[0];
    expect(params[0]).toBe('org-9');
    expect(params[1]).toBeNull(); // initiativeId
    expect(params[3]).toBe('process'); // default type
    expect(params[4]).toBe('PROPOSED'); // default status
    expect(params[5]).toBeNull(); // change_class
    expect(params[6]).toBeNull(); // requested_by
    expect(params[7]).toBeNull(); // assessment
  });
});
