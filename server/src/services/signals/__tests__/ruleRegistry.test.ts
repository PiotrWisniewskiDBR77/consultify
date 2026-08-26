import { describe, expect, it } from 'vitest';

import type { SignalRule } from '../../../types/workSignals.js';
import { validateRuleRegistry } from '../ruleRegistry.js';

const fixtureRule = (overrides: Partial<SignalRule> = {}): SignalRule => ({
  ruleId: 'exec.task.overdue',
  ruleVersion: 1,
  domain: 'EXECUTION',
  signalType: 'task_overdue',
  severity: 'warning',
  subjectType: 'task',
  titleKey: 'signals.exec.task.overdue.title',
  evaluate: async () => [],
  dedupeKey: (hit) => `exec.task.overdue:${hit.subjectId}`,
  evidence: () => [],
  action: () => ({ kind: 'OPEN_TASK', route: '/tasks/x', params: {}, permission: 'tasks.read' }),
  audience: () => ({ userId: null, role: null }),
  maxPerRunPerOrg: 25,
  minSeverityToSurface: 'info',
  ...overrides,
});

describe('validateRuleRegistry', () => {
  it('accepts a valid declarative rule', () => {
    expect(validateRuleRegistry([fixtureRule()])).toHaveLength(1);
  });

  it('rejects duplicate rule ids', () => {
    expect(() => validateRuleRegistry([fixtureRule(), fixtureRule()])).toThrow(/Duplicate/);
  });

  it('rejects a zero per-org limit', () => {
    expect(() => validateRuleRegistry([fixtureRule({ maxPerRunPerOrg: 0 })])).toThrow(
      /maxPerRunPerOrg/
    );
  });

  it('rejects a domain outside the dictionary', () => {
    expect(() =>
      validateRuleRegistry([fixtureRule({ domain: 'UNKNOWN' as SignalRule['domain'] })])
    ).toThrow(/Invalid domain/);
  });

  it('rejects a runtime rule without a destination producer', () => {
    expect(() => validateRuleRegistry([fixtureRule({ action: undefined as never })])).toThrow(
      /missing action/
    );
  });
});
