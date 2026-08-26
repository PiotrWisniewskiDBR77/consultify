import { describe, expect, it, vi } from 'vitest';

vi.mock('../../v8/executionVisibilityService.js', () => ({
  emitSignal: vi.fn(async () => ({ signalId: 'legacy-1' })),
}));

import { emitSignal } from '../../v8/executionVisibilityService.js';
import type { RuleHit, SignalRule } from '../../../types/workSignals.js';
import { adaptNewExecutionSignal } from '../executionSignalAdapter.js';

const hit: RuleHit = {
  subjectId: 'task-1',
  observedValue: 4,
  observedAt: '2026-08-26T10:00:00.000Z',
  data: {},
};

const rule = (ruleId: string, domain: SignalRule['domain'] = 'EXECUTION'): SignalRule => ({
  ruleId,
  ruleVersion: 1,
  domain,
  signalType: 'task_overdue',
  severity: 'critical',
  subjectType: 'task',
  titleKey: 'signals.exec.task.overdue.title',
  evaluate: async () => [hit],
  dedupeKey: () => 'fixture',
  evidence: () => [],
  action: () => ({ kind: 'OPEN_TASK', route: '/tasks/task-1', params: {} }),
  audience: () => ({ userId: 'user-1', role: null }),
  maxPerRunPerOrg: 25,
  minSeverityToSurface: 'info',
});

describe('execution signal compatibility adapter', () => {
  it('maps a new canonical execution signal to the frozen legacy vocabulary', async () => {
    await expect(
      adaptNewExecutionSignal({
        organizationId: 'org-a',
        canonicalSignalId: 'canonical-1',
        rule: rule('exec.task.overdue'),
        hit,
      })
    ).resolves.toBe(true);
    expect(emitSignal).toHaveBeenCalledWith(
      expect.objectContaining({
        signalType: 'overdue_tasks_count',
        sourceObjectType: 'task',
        organizationId: 'org-a',
      })
    );
  });

  it('does not adapt non-execution rules or rules without a frozen mapping', async () => {
    await expect(
      adaptNewExecutionSignal({
        organizationId: 'org-a',
        canonicalSignalId: 'canonical-2',
        rule: rule('dec.pending_stale', 'DECISION'),
        hit,
      })
    ).resolves.toBe(false);
    await expect(
      adaptNewExecutionSignal({
        organizationId: 'org-a',
        canonicalSignalId: 'canonical-3',
        rule: rule('exec.unmapped'),
        hit,
      })
    ).resolves.toBe(false);
    expect(emitSignal).not.toHaveBeenCalled();
  });
});
