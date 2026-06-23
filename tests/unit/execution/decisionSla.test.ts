/**
 * M14/F3 — decision SLA per priority (was flat 7d/14d for everything).
 */
import { describe, expect, it } from 'vitest';

import {
  decisionSlaDays,
  overdueDecisionSeverity,
  pendingDecisionSeverity,
} from '../../../server/src/services/v8/managerProblemsService.js';

describe('decision SLA per priority', () => {
  it('SLA days scale with priority', () => {
    expect(decisionSlaDays('CRITICAL')).toBe(2);
    expect(decisionSlaDays('HIGH')).toBe(3);
    expect(decisionSlaDays('MEDIUM')).toBe(7);
    expect(decisionSlaDays('LOW')).toBe(14);
    expect(decisionSlaDays(undefined)).toBe(7);
  });

  it('overdue severity: high-stakes is always critical; low only after its SLA', () => {
    expect(overdueDecisionSeverity('CRITICAL', 1)).toBe('critical');
    expect(overdueDecisionSeverity('HIGH', 1)).toBe('critical');
    expect(overdueDecisionSeverity('LOW', 1)).toBe('warning');
    expect(overdueDecisionSeverity('LOW', 20)).toBe('critical'); // > 14d SLA
  });

  it('pending severity escalates at SLA and 2×SLA', () => {
    expect(pendingDecisionSeverity('MEDIUM', 3)).toBe('info'); // < 7
    expect(pendingDecisionSeverity('MEDIUM', 8)).toBe('warning'); // > 7
    expect(pendingDecisionSeverity('MEDIUM', 15)).toBe('critical'); // > 14
    expect(pendingDecisionSeverity('CRITICAL', 3)).toBe('warning'); // > 2
    expect(pendingDecisionSeverity('CRITICAL', 5)).toBe('critical'); // > 4
  });
});
