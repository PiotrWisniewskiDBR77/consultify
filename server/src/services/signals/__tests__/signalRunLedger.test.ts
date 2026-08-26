import { describe, expect, it, vi } from 'vitest';

const { alertMock } = vi.hoisted(() => ({ alertMock: vi.fn() }));
vi.mock('../../systemAlertNotifier.js', () => ({ sendSystemAlert: alertMock }));

import type { SignalQuery, SignalRule } from '../../../types/workSignals.js';
import { evaluateSignalRules } from '../signalEvaluator.js';

const rule: SignalRule = {
  ruleId: 'exec.fixture',
  ruleVersion: 1,
  domain: 'EXECUTION',
  signalType: 'fixture',
  severity: 'warning',
  subjectType: 'task',
  titleKey: 'fixture',
  evaluate: async () => [],
  dedupeKey: () => 'fixture',
  evidence: () => [],
  action: () => ({ kind: 'OPEN_TASK', route: '/tasks/x', params: {}, permission: 'tasks.read' }),
  audience: () => ({ userId: null, role: null }),
  maxPerRunPerOrg: 25,
  minSeverityToSurface: 'info',
};

describe('signal run global failure ledger', () => {
  it('marks a global read failure FAILED and emits an operational alert', async () => {
    let calls = 0;
    const db: SignalQuery = {
      query: vi.fn(async () => {
        calls += 1;
        if (calls === 1) return [];
        if (calls === 2) throw new Error('database unavailable');
        return [];
      }),
    };
    const result = await evaluateSignalRules({ db, organizationId: 'org-a', rules: [rule] });
    expect(result.status).toBe('FAILED');
    expect(result.errors[0]).toMatchObject({
      ruleId: '__GLOBAL__',
      message: 'database unavailable',
    });
    expect(alertMock).toHaveBeenCalledWith(expect.objectContaining({ severity: 'CRITICAL' }));
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining("status = 'FAILED'"),
      expect.any(Array)
    );
  });
});
