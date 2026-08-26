import { describe, expect, it } from 'vitest';

import {
  SignalDomainValues,
  SignalOriginValues,
  SignalResolvedReasonValues,
  SignalStatusValues,
  type SignalRule,
} from '../../../server/src/types/workSignals.js';

describe('work signal dictionaries', () => {
  it('contains the eight accepted domains', () => {
    expect(SignalDomainValues).toHaveLength(8);
    expect(SignalDomainValues).toContain('EXECUTION');
    expect(SignalDomainValues).toContain('FINANCE');
  });

  it('keeps deterministic and interpreted origins distinct', () => {
    expect(SignalOriginValues).toEqual(['DETERMINISTIC', 'AGGREGATED', 'INTERPRETED']);
  });

  it('does not treat a resolved signal as open', () => {
    expect(SignalStatusValues.includes('RESOLVED')).toBe(true);
    expect(SignalStatusValues.indexOf('RESOLVED')).not.toBe(SignalStatusValues.indexOf('OPEN'));
  });

  it('defines an explicit condition-cleared reason', () => {
    expect(SignalResolvedReasonValues).toContain('CONDITION_CLEARED');
  });

  it('requires destination and evidence at compile time', () => {
    // @ts-expect-error action and evidence are intentionally absent.
    const invalidRule: SignalRule = {
      ruleId: 'invalid',
      ruleVersion: 1,
      domain: 'EXECUTION',
      signalType: 'invalid',
      severity: 'warning',
      subjectType: 'task',
      titleKey: 'signals.invalid.title',
      evaluate: async () => [],
      dedupeKey: () => 'invalid',
      audience: () => ({ userId: null, role: null }),
      maxPerRunPerOrg: 25,
      minSeverityToSurface: 'info',
    };
    expect(invalidRule.ruleId).toBe('invalid');
  });
});
